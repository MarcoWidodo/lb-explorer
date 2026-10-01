import { useState, useEffect, useMemo } from 'react'
import { useData, useResource, useYearVariables, api, useSourceNote } from '../context/DataProvider'
import VariablePicker from '../components/shared/VariablePicker'
import CountryPicker from '../components/shared/CountryPicker'
import DetailPanel, { QuestionHistory } from '../components/shared/DetailPanel'
import { WaveSelector, ExportBar, ChartPanel, Segmented, Select } from '../components/shared/Controls'
import ScatterChart from '../components/charts/ScatterChart'
import CorrelationGauge from '../components/shared/CorrelationGauge'
import { pearson, pValueR, cellValue, fmtP, fmtN, fmtNum, fmtValue } from '../lib/stats'
import { useChartExport, capFirst, questionText } from '../lib/useChartExport'
import { exportCSV } from '../lib/exporter'
import { defaultIndicator, indicatorLabel } from '../lib/indicators'

// Default pair: confidence in the government × satisfaction with democracy, then other pairs
const DEFAULT_PAIRS = [['H_002_031', 'A_003_031'], ['H_002_011', 'A_003_031'], ['H_002_041', 'A_001_001']]

// Across countries each axis shows the question's default summary: a mean only for
// interval-like scales (0–10, 1–10, numeric), otherwise the % in the top categories (rule 7).
function axisTitle(entry, rec, ind) {
  if (!entry || !rec || !ind) return ''
  return `${entry.id}: ${indicatorLabel(ind, rec, 'valid')}`
}

export default function CorrelationsExplorer() {
  const { manifest, countryName, countryColor, iso3, waveCountries } = useData()
  const sourceNote = useSourceNote()
  const [wave, setWave] = useState(manifest.waves[manifest.waves.length - 1].id)
  const [mode, setMode] = useState('country')
  const [varA, setVarA] = useState(null)
  const [varB, setVarB] = useState(null)
  const [countries, setCountries] = useState([])
  const [single, setSingle] = useState(null)
  const [sortBy, setSortBy] = useState('abs')

  const { data: catalogue } = useResource(() => api.index(), [])
  const { data: cidx } = useResource(() => api.corrIndex(wave), [wave])
  const index = useMemo(() => (catalogue && cidx && cidx.year === wave ? { sections: catalogue.sections, vars: catalogue.vars, corr: cidx.corr } : null),
    [catalogue, cidx, wave])
  const eligible = useMemo(() => new Set(index?.corr || []), [index])
  const okA = eligible.has(varA), okB = eligible.has(varB)
  const { data: recs } = useYearVariables(wave, [okA ? varA : null, okB ? varB : null])
  const { data: corrA } = useResource(() => (index && okA ? api.correlations(wave, varA) : null), [index, wave, varA, okA])
  const [recA, recB] = (recs || []).map(r => (r && r.year === wave ? r : null))
  const entryOf = id => index?.vars.find(v => v.id === id)
  const eA = entryOf(varA), eB = entryOf(varB)
  const indA = recA && eA ? defaultIndicator(recA, eA) : null
  const indB = recB && eB ? defaultIndicator(recB, eB) : null

  useEffect(() => {
    if (!index) return
    const ok = id => id && eligible.has(id)
    if (ok(varA) && ok(varB)) return
    const pair = DEFAULT_PAIRS.find(([a, b]) => ok(a) && ok(b)) || index.corr.slice(0, 2)
    const a = ok(varA) ? varA : pair[0]
    setVarA(a); setVarB(ok(varB) && varB !== a ? varB : (pair[1] !== a ? pair[1] : pair[0]))
  }, [index]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const wc = waveCountries(wave)
    setCountries(wc)
    setSingle(s => (wc.includes(s) ? s : wc[0]))
  }, [wave, waveCountries])

  const pos = useMemo(() => Object.fromEntries((index?.corr || []).map((v, i) => [v, i])), [index])
  // pairwise N is stored as n0 (valid on the focal question) minus dn (missing on the other one)
  const nPair = (c, i) => (corrA?.n0?.[c] == null || corrA?.dn?.[c]?.[i] == null ? null : corrA.n0[c] - corrA.dn[c][i])
  const rWithin = (c, other) => {
    if (!corrA || corrA.id !== varA) return null
    const r = corrA.r?.[c]?.[pos[other]]; const n = nPair(c, pos[other])
    return r == null ? null : { r: r / 1000, n, p: pValueR(r / 1000, n) }
  }

  const rows = useMemo(() => {
    if (!recA || !recB || !indA || !indB) return []
    return countries.map(c => {
      const a = cellValue(recA.est[c]?.all, recA.codes, indA, 'valid'), b = cellValue(recB.est[c]?.all, recB.codes, indB, 'valid')
      if (a?.value == null || b?.value == null) return null
      return { c, x: a.value, y: b.value, nx: a.n, ny: b.n, within: rWithin(c, varB) }
    }).filter(Boolean)
  }, [recA, recB, countries, corrA, indA?.type, indB?.type]) // eslint-disable-line react-hooks/exhaustive-deps
  const fit = pearson(rows.map(r => ({ x: r.x, y: r.y })))

  const matrix = useMemo(() => {
    if (!corrA || corrA.id !== varA || !single || !corrA.r[single]) return []
    const out = (index?.corr || []).map((v, i) => {
      if (v === varA) return null
      const r = corrA.r[single][i]; const n = nPair(single, i)
      if (r == null) return null
      const e = entryOf(v)
      return { v, q: e ? questionText(e) : v, r: r / 1000, n, p: pValueR(r / 1000, n) }
    }).filter(Boolean)
    out.sort(sortBy === 'abs' ? (a, b) => Math.abs(b.r) - Math.abs(a.r) : sortBy === 'r' ? (a, b) => b.r - a.r : (a, b) => a.v.localeCompare(b.v, undefined, { numeric: true }))
    return out
  }, [corrA, single, sortBy, varA, index]) // eslint-disable-line react-hooks/exhaustive-deps

  const yearTxt = String(wave)
  const title = eA && eB ? `${questionText(eA)} × ${questionText(eB)}` : ''
  const note = sourceNote({ waves: yearTxt, base: 'valid',
    extra: 'Country values are weighted; the fitted line and r are across countries (each country one point). "Within-country r" is the weighted Pearson correlation between respondents in that country-year, on the original answer codes.' })
  const exp = useChartExport({
    title, subtitle: `Country values · ${yearTxt} · r = ${fit ? fit.r.toFixed(2) : '—'} across ${rows.length} countries`,
    note, filename: `lb_corr_${wave}_${varA}_${varB}`,
  })
  const fmtAxis = (ind) => (v) => (ind?.type === 'mean' ? fmtNum(v, 2) : fmtValue(v, { type: 'share' }, 0))
  const csvCols = ['country', 'iso3', 'year', `value_${varA}`, `value_${varB}`, `indicator_${varA}`, `indicator_${varB}`, `n_${varA}`, `n_${varB}`, 'r_within', 'p_within', 'n_pair']
  const onCSV = () => exportCSV(rows.map(r => ({ country: countryName(r.c), iso3: iso3(r.c), year: wave, [`value_${varA}`]: r.x, [`value_${varB}`]: r.y,
    [`indicator_${varA}`]: axisTitle(eA, recA, indA), [`indicator_${varB}`]: axisTitle(eB, recB, indB),
    [`n_${varA}`]: r.nx, [`n_${varB}`]: r.ny, r_within: r.within?.r, p_within: r.within?.p, n_pair: r.within?.n })),
    `lb_corr_${wave}_${varA}_${varB}.csv`, csvCols)

  const items = useMemo(() => (index?.vars || []).filter(v => eligible.has(v.id)).map(v => ({ ...v, q: capFirst(v.q), code: v.id })), [index, eligible])
  const indiv = mode === 'individual' ? rWithin(single, varB) : null

  return (
    <div className="view-page dock-clearance">
      <div className="view-inner">
        <div className="view-header-stack animate-fade-up">
          <div>
            <h1>Correlations Explorer</h1>
            <p className="view-subtitle">How two questions move together in one survey year: across countries, or among respondents within one country.</p>
          </div>
          <WaveSelector value={wave} onChange={setWave} />
        </div>
        <div className="explorer-layout animate-fade-up stagger-1" style={{ marginTop: '1.5rem' }}>
          <div className="explorer-controls">
            <Segmented label="Level" value={mode} onChange={setMode}
              options={[{ value: 'country', label: 'Across countries' }, { value: 'individual', label: 'Within a country' }]} />
            {index && <VariablePicker items={items} sections={index.sections} value={varA} onChange={setVarA} label="Question A (x-axis)" />}
            {index && <VariablePicker items={items} sections={index.sections} value={varB} onChange={setVarB} label="Question B (y-axis)" />}
            <p className="nr-hint" style={{ marginTop: '-0.4rem' }}>Only ordered scales, yes/no items and numeric questions can be correlated.</p>
            {mode === 'country'
              ? <CountryPicker countries={waveCountries(wave)} selected={countries} onChange={setCountries} />
              : <Select label="Country" value={single} onChange={setSingle} options={waveCountries(wave).map(c => ({ value: c, label: countryName(c) }))} />}
            {mode === 'country'
              ? <ExportBar {...exp} onCSV={onCSV} onPrintMode={exp.setPrintMode} disabled={rows.length < 3} />
              : null}
            {eA && recA && <DetailPanel title="Question A" code={eA.id} question={questionText(eA)} section={eA.s} type={eA.t} rec={recA} countries={Object.keys(recA.est)} countriesLabel={`Asked in ${wave}`} extra={<QuestionHistory entry={eA} rec={recA} />} />}
            {eB && recB && <DetailPanel title="Question B" code={eB.id} question={questionText(eB)} section={eB.s} type={eB.t} rec={recB} countries={Object.keys(recB.est)} countriesLabel={`Asked in ${wave}`} extra={<QuestionHistory entry={eB} rec={recB} />} />}
          </div>

          <div className="explorer-main">
            {varA === varB && <div className="corr-warning">Choose two different questions.</div>}
            {mode === 'country' && varA !== varB && (
              !recA || !recB ? <div className="chart-empty"><div className="spinner" /></div> : rows.length < 3
                ? <div className="chart-empty"><p>Fewer than three selected countries were asked both questions.</p></div>
                : (
                  <>
                    <ChartPanel title={title} badge={yearTxt} note={note}>
                      <ScatterChart points={rows.map(r => ({ key: r.c, label: countryName(r.c), x: r.x, y: r.y, color: countryColor(r.c), nx: r.nx, ny: r.ny }))}
                        fit={fit} xTitle={axisTitle(eA, recA, indA)} yTitle={axisTitle(eB, recB, indB)} xFormat={fmtAxis(indA)} yFormat={fmtAxis(indB)}
                        printMode={exp.printMode} svgRef={exp.svgRef} ariaLabel={title} />
                      {fit && (
                        <div className="scatter-stats">
                          <div className="scatter-stat"><span className="scatter-stat-label">Pearson r</span><span className="scatter-stat-value">{fit.r.toFixed(3)}</span></div>
                          <div className="scatter-stat"><span className="scatter-stat-label">p-value</span><span className="scatter-stat-value">{fmtP(fit.p)}</span></div>
                          <div className="scatter-stat"><span className="scatter-stat-label">R²</span><span className="scatter-stat-value">{(fit.r ** 2).toFixed(3)}</span></div>
                          <div className="scatter-stat"><span className="scatter-stat-label">Countries</span><span className="scatter-stat-value">{fit.n}</span></div>
                        </div>
                      )}
                    </ChartPanel>
                    <div className="corr-summary">
                      <div className="corr-summary-header">
                        <h4 className="corr-summary-title">By country</h4>
                        <span className="corr-summary-count">{rows.length} countries</span>
                      </div>
                      <div className="corr-table-scroll">
                        <table className="corr-table">
                          <thead><tr>
                            <th>Country</th><th className="corr-th-num">A</th><th className="corr-th-num">B</th>
                            <th className="corr-th-num">N A</th><th className="corr-th-num">N B</th>
                            <th className="corr-th-num" title="Weighted correlation among respondents in this country">Within-country r</th>
                            <th className="corr-th-num">p</th><th className="corr-th-num">N (both)</th>
                          </tr></thead>
                          <tbody>
                            {rows.map(r => (
                              <tr key={r.c}>
                                <td><span className="stat-dot" style={{ background: countryColor(r.c), display: 'inline-block', marginRight: 6 }} />{countryName(r.c)}</td>
                                <td className="corr-td-num">{fmtAxis(indA)(r.x)}</td><td className="corr-td-num">{fmtAxis(indB)(r.y)}</td>
                                <td className="corr-td-num">{fmtN(r.nx)}</td><td className="corr-td-num">{fmtN(r.ny)}</td>
                                <td className="corr-td-num">{r.within ? fmtNum(r.within.r, 3) : '—'}</td>
                                <td className="corr-td-num">{fmtP(r.within?.p)}</td><td className="corr-td-num">{fmtN(r.within?.n)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )
            )}

            {mode === 'individual' && varA !== varB && (
              <>
                <div className="chart-panel">
                  <div className="chart-title-bar">
                    <h3 className="chart-title">Correlation within {countryName(single)}</h3>
                    <span className="chart-wave-badge">{yearTxt}</span>
                  </div>
                  <CorrelationGauge r={indiv?.r} p={indiv?.p} n={indiv?.n} varA={varA} varB={varB}
                                    varALabel={questionText(eA)} varBLabel={questionText(eB)} countryName={countryName(single)} />
                  <p className="source-note">{sourceNote({ waves: yearTxt, extra: 'Weighted Pearson correlation among respondents who answered both questions; two-sided t-test.' })}</p>
                </div>
                <div className="corr-matrix-section">
                  <div className="corr-matrix-header">
                    <h4 className="corr-summary-title">Everything that correlates with {varA}</h4>
                    <span className="corr-matrix-hint">in {countryName(single)}, {yearTxt}</span>
                  </div>
                  <div className="corr-matrix-controls">
                    <Select label="Sort by" value={sortBy} onChange={setSortBy}
                            options={[{ value: 'abs', label: 'Strongest first (|r|)' }, { value: 'r', label: 'r, high to low' }, { value: 'name', label: 'Question number' }]} />
                    <button className="export-btn" style={{ alignSelf: 'flex-end', marginBottom: 2 }} disabled={!matrix.length}
                            onClick={() => exportCSV(matrix.map(m => ({ focal: varA, variable: m.v, question: m.q, country: countryName(single), year: wave, r: m.r, p: m.p, n: m.n })),
                                                     `lb_corr_${wave}_${single}_${varA}.csv`, ['focal', 'variable', 'question', 'country', 'year', 'r', 'p', 'n'])}>CSV</button>
                  </div>
                  {matrix.length ? (
                    <div className="corr-table-scroll" style={{ maxHeight: 440 }}>
                      <table className="corr-table corr-matrix-table">
                        <thead><tr><th style={{ width: 80 }}>Question</th><th>Text</th><th className="corr-th-num" style={{ width: 80 }}>r</th>
                          <th className="corr-th-num" style={{ width: 80 }}>p</th><th className="corr-th-num" style={{ width: 70 }}>N</th></tr></thead>
                        <tbody>
                          {matrix.map(m => (
                            <tr key={m.v} className={Math.abs(m.r) >= 0.3 ? 'corr-row-strong' : ''} onClick={() => setVarB(m.v)} style={{ cursor: 'pointer' }} title="Set as question B">
                              <td><span className="corr-matrix-var">{m.v}</span></td>
                              <td className="corr-matrix-label">{m.q}</td>
                              <td className="corr-td-num"><span className={`corr-r-badge ${m.r > 0 ? 'positive' : 'negative'}`}>{m.r.toFixed(3)}</span></td>
                              <td className="corr-td-num">{fmtP(m.p)}</td>
                              <td className="corr-td-num">{fmtN(m.n)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="corr-matrix-empty">{varA} was not asked in {countryName(single)}.</div>}
                  <div className="corr-matrix-footer">{matrix.length} questions · click a row to make it question B · r ≥ 0.3 highlighted</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
