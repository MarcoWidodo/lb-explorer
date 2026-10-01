import { useState, useEffect, useMemo } from 'react'
import { useData, useResource, api, useSourceNote } from '../context/DataProvider'
import VariablePicker from '../components/shared/VariablePicker'
import DetailPanel from '../components/shared/DetailPanel'
import { WaveSelector, IndicatorControl, BaseControl, ExportBar, ChartPanel, Select, Checkbox } from '../components/shared/Controls'
import ChoroplethMap, { COLOR_SCHEMES } from '../components/charts/ChoroplethMap'
import { cellValue, fmtValue, fmtN } from '../lib/stats'
import { useChartExport, capFirst, questionText } from '../lib/useChartExport'
import { defaultIndicator, indicatorLabel } from '../lib/indicators'

export default function MapExplorer() {
  const { manifest, countryName, countryColor, iso3, wave: waveInfo, groupLabel } = useData()
  const sourceNote = useSourceNote()
  const [wave, setWave] = useState(manifest.waves[manifest.waves.length - 1].id)
  const [varId, setVarId] = useState(null)
  const [base, setBase] = useState('valid')
  const [metric, setMetric] = useState('share')
  const [codesSel, setCodesSel] = useState([])
  const [group, setGroup] = useState('all')
  const [scheme, setScheme] = useState('Yellow → Red')
  const [flipped, setFlipped] = useState(false)

  const { data: index } = useResource(() => api.waveIndex(wave), [wave])
  const { data: rec } = useResource(() => (varId ? api.variable(wave, varId) : null), [wave, varId])
  const { data: geo } = useResource(() => api.geoRegion(), [])
  const entry = index?.vars.find(v => v.id === varId)

  useEffect(() => {
    if (!index) return
    if (varId && index.vars.some(v => v.id === varId)) return
    const first = index.vars.find(v => /^q0*1$/.test(v.id)) || index.vars.find(v => v.t === 'ordinal') || index.vars[0]
    setVarId(first.id)
  }, [index]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (rec) { const d = defaultIndicator(rec); setMetric(d.type); setCodesSel(d.codes || []) } }, [rec])

  const isoByNumeric = useMemo(() => Object.fromEntries(Object.entries(manifest.countries).map(([iso, c]) => [c.iso_numeric, iso])), [manifest])
  const allowMean = rec && rec.type !== 'nominal'
  const indicator = metric === 'mean' && allowMean ? { type: 'mean' } : { type: 'share', codes: codesSel }
  const codesKey = codesSel.join()
  const values = useMemo(() => {
    if (!rec) return {}
    const out = {}
    for (const c of Object.keys(rec.est)) {
      const v = cellValue(rec.est[c][group], rec.codes, indicator, base)
      if (v && v.n >= manifest.min_cell_n) out[c] = v
    }
    return out
  }, [rec, group, base, indicator.type, codesKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const ranking = Object.entries(values).sort((a, b) => b[1].value - a[1].value)
  const indLabel = rec ? indicatorLabel(indicator, rec, base) : ''
  const w = waveInfo(wave)
  const fmt = (v) => fmtValue(v, indicator, indicator.type === 'mean' ? 2 : 0)
  const note = sourceNote({ waves: `${w.label} (${w.years})`, base: indicator.type === 'share' ? base : null,
    extra: group !== 'all' ? `${groupLabel(group)} only.` : undefined })
  const exp = useChartExport({
    title: questionText(entry), subtitle: `${indLabel}${group !== 'all' ? ` · ${groupLabel(group)}` : ''} · ${w.label} (${w.years})`,
    note, filename: `abs_map_w${wave}_${varId}`,
    rows: () => ranking.map(([c, v]) => ({ indicator: indLabel, variable: varId, success_codes: indicator.codes?.join(';') ?? 'mean', base,
      country_set: 'country', wave, year: manifest.countries[c].waves[wave]?.year, iso3: iso3(c), country: countryName(c),
      group, value: v.value, se: v.se, n: v.n, n_countries: 1 })),
  })
  const items = useMemo(() => (index?.vars || []).map(v => ({ ...v, q: capFirst(v.q), code: v.id.toUpperCase() })), [index])
  const groupOptions = [{ value: 'all', label: 'All respondents' },
    ...manifest.subgroups.map(s => ({ group: s.label, options: s.groups.map(g => ({ value: g.id, label: g.label })) }))]

  return (
    <div className="view-page dock-clearance">
      <div className="view-inner">
        <div className="view-header-row animate-fade-up">
          <div>
            <h1>Map</h1>
            <p className="view-subtitle">One number per country, on a map of the region.</p>
          </div>
          <WaveSelector value={wave} onChange={setWave} />
        </div>
        <div className="explorer-layout animate-fade-up stagger-1">
          <div className="explorer-controls">
            {index && <VariablePicker items={items} sections={index.sections} value={varId} onChange={setVarId} label="Question" />}
            {rec && <IndicatorControl allowMean={allowMean} metric={indicator.type} onMetric={setMetric} codes={rec.codes} labels={rec.labels}
                                      selected={codesSel} onSelected={setCodesSel}
                                      meanHint={entry?.ends ? `Mean on the original codes: ${entry.ends[0]} … ${entry.ends[1]}.` : null} />}
            <BaseControl value={base} onChange={setBase} />
            <Select label="Respondents" value={group} onChange={setGroup} options={groupOptions} />
            <Select label="Colour scale" value={scheme} onChange={setScheme} options={Object.keys(COLOR_SCHEMES).map(k => ({ value: k, label: k }))} />
            <Checkbox checked={flipped} onChange={setFlipped} label="Reverse colour scale" />
            <ExportBar {...exp} onPrintMode={exp.setPrintMode} disabled={!ranking.length} />
            {entry && rec && <DetailPanel code={entry.id.toUpperCase()} question={questionText(entry)} section={entry.s} type={entry.t} rec={rec} countries={entry.c} harmonized={entry.h} />}
          </div>
          <div className="explorer-main">
            {!rec || !geo || !entry ? <div className="chart-empty"><div className="spinner" /></div> : (
              <ChartPanel title={questionText(entry)} badge={`${w.label} · ${w.years}`} note={note}>
                <div className="chart-subtitle">{indLabel}{group !== 'all' ? ` · ${groupLabel(group)}` : ''}</div>
                <ChoroplethMap geo={geo} values={values} isoByNumeric={isoByNumeric} countryName={countryName} scheme={scheme} flipped={flipped}
                               format={fmt} legendTitle={indLabel} printMode={exp.printMode} svgRef={exp.svgRef} ariaLabel={entry.q} />
                <div className="map-ranking">
                  <div className="detail-responses-label">Ranking</div>
                  {ranking.map(([c, v], i) => (
                    <div key={c} className="map-rank-row">
                      <span className="map-rank-num">{i + 1}</span>
                      <span className="stat-dot" style={{ background: countryColor(c) }} />
                      <span className="map-rank-name">{countryName(c)}</span>
                      <span className="map-rank-value">{fmt(v.value)}</span>
                      <span className="map-rank-ci">{v.se != null ? `± ${fmtValue(1.96 * v.se, indicator, indicator.type === 'mean' ? 2 : 0)}` : ''}</span>
                      <span className="map-rank-n">N = {fmtN(v.n)}</span>
                    </div>
                  ))}
                  {w.countries.filter(c => !values[c]).length > 0 && (
                    <div className="map-rank-missing">Not asked{group !== 'all' ? ' or too few respondents' : ''}: {w.countries.filter(c => !values[c]).map(countryName).join(', ')}</div>
                  )}
                </div>
              </ChartPanel>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
