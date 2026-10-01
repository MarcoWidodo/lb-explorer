import { useState, useEffect, useMemo } from 'react'
import { useData, useResource, api, useSourceNote } from '../context/DataProvider'
import VariablePicker from '../components/shared/VariablePicker'
import CountryPicker from '../components/shared/CountryPicker'
import DetailPanel from '../components/shared/DetailPanel'
import { WaveSelector, IndicatorControl, BaseControl, BreakdownControl, ExportBar, ChartPanel, Checkbox } from '../components/shared/Controls'
import BarChart from '../components/charts/BarChart'
import DotPlot from '../components/charts/DotPlot'
import { cellValue, cellDistribution, fmtValue, fmtN } from '../lib/stats'
import { useChartExport, capFirst, questionText } from '../lib/useChartExport'
import { defaultIndicator, indicatorLabel, MAX_BARS } from '../lib/indicators'

const PREFERRED = ['JP', 'KR', 'TW', 'PH', 'ID', 'TH']
const GROUP_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export default function SingleWaveExplorer() {
  const { manifest, countryName, countryColor, waveCountries, wave: waveInfo, iso3 } = useData()
  const sourceNote = useSourceNote()
  const [wave, setWave] = useState(manifest.waves[manifest.waves.length - 1].id)
  const [varId, setVarId] = useState(null)
  const [countries, setCountries] = useState([])
  const [base, setBase] = useState('valid')
  const [breakdown, setBreakdown] = useState('')
  const [metric, setMetric] = useState('share')
  const [codesSel, setCodesSel] = useState([])
  const [showCI, setShowCI] = useState(false)

  const { data: index } = useResource(() => api.waveIndex(wave), [wave])
  const { data: rec, loading } = useResource(() => (varId ? api.variable(wave, varId) : null), [wave, varId])
  const entry = index?.vars.find(v => v.id === varId)

  // choose a sensible first question when the wave changes (keep the current one if it exists)
  useEffect(() => {
    if (!index) return
    if (varId && index.vars.some(v => v.id === varId)) return
    const first = index.vars.find(v => /^q0*1$/.test(v.id)) || index.vars.find(v => v.t === 'ordinal') || index.vars[0]
    setVarId(first.id)
  }, [index]) // eslint-disable-line react-hooks/exhaustive-deps

  // default countries: keep choices that were asked; otherwise the first preferred ones
  const asked = entry?.c || []
  useEffect(() => {
    if (!entry) return
    setCountries(prev => {
      const keep = prev.filter(c => asked.includes(c))
      if (keep.length) return keep
      return PREFERRED.filter(c => asked.includes(c)).slice(0, 4).concat(asked).filter((c, i, a) => a.indexOf(c) === i).slice(0, 4)
    })
  }, [entry]) // eslint-disable-line react-hooks/exhaustive-deps

  // default indicator when the question changes
  useEffect(() => {
    if (!rec) return
    const d = defaultIndicator(rec)
    setMetric(d.type)
    setCodesSel(d.codes || [])
  }, [rec])

  const allowMean = rec && rec.type !== 'nominal'
  const indicator = metric === 'mean' && allowMean ? { type: 'mean' } : { type: 'share', codes: codesSel }
  const shown = countries.filter(c => rec?.est?.[c])
  const shownKey = shown.join()
  const scaleNote = entry?.ends ? `${entry.ends[0]} … ${entry.ends[1]}` : null

  /* ── distribution (no breakdown) ── */
  const dist = useMemo(() => {
    if (!rec) return null
    const byCountry = Object.fromEntries(shown.map(c => [c, cellDistribution(rec.est[c].all, rec, base)]))
    const catsAll = []
    const seen = new Set()
    const labelOf = (code, nr) => nr ? rec.nr_labels[rec.nr.indexOf(code)] : rec.labels[rec.codes.indexOf(code)] ?? String(code)
    shown.forEach(c => byCountry[c]?.forEach(d => {
      const key = `${d.nr ? 'nr' : 'c'}${d.code}`
      if (!seen.has(key)) { seen.add(key); catsAll.push({ key, code: d.code, nr: d.nr, label: labelOf(d.code, d.nr) }) }
    }))
    const order = (a) => a.nr ? 1e6 + rec.nr.indexOf(a.code) : rec.codes.indexOf(a.code)
    catsAll.sort((a, b) => order(a) - order(b))
    let cats = catsAll
    let other = null
    if (catsAll.length > MAX_BARS) {  // nominal items with long code lists: largest categories + "Other"
      const peak = (k) => Math.max(...shown.map(c => byCountry[c]?.find(d => `${d.nr ? 'nr' : 'c'}${d.code}` === k)?.pct ?? 0))
      const top = new Set([...catsAll].filter(c => !c.nr).sort((a, b) => peak(b.key) - peak(a.key)).slice(0, MAX_BARS - 1).map(c => c.key))
      cats = catsAll.filter(c => top.has(c.key) || c.nr)
      other = catsAll.filter(c => !top.has(c.key) && !c.nr).map(c => c.key)
      cats.splice(cats.findIndex(c => c.nr) >= 0 ? cats.findIndex(c => c.nr) : cats.length, 0, { key: '_other', label: `All other answers (${other.length})`, code: null })
    }
    const get = (c, k) => {
      const list = byCountry[c]
      if (!list) return null
      if (k === '_other') return { value: list.filter(d => other.includes(`${d.nr ? 'nr' : 'c'}${d.code}`)).reduce((s, d) => s + d.pct, 0) }
      const d = list.find(x => `${x.nr ? 'nr' : 'c'}${x.code}` === k)
      return d ? { value: d.pct, count: d.count } : { value: 0, count: 0 }
    }
    return { cats: cats.map(c => ({ ...c, muted: c.nr })), get }
  }, [rec, shownKey, base]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── indicator per country × group ── */
  const valueOf = (c, g = 'all') => cellValue(rec?.est?.[c]?.[g], rec?.codes, indicator, base)
  const sg = manifest.subgroups.find(s => s.id === breakdown)
  const indLabel = rec ? indicatorLabel(indicator, rec, base) : ''
  const w = waveInfo(wave)
  const note = sourceNote({ waves: `${w.label} (${w.years})`, base: indicator.type === 'share' || !breakdown ? base : null,
    extra: breakdown ? `Subgroups with fewer than ${manifest.min_cell_n} respondents are not shown.` : undefined })

  const exp = useChartExport({
    title: questionText(entry),
    subtitle: breakdown ? `${indLabel}, by ${sg?.label.toLowerCase()} · ${w.label} (${w.years})` : `% of respondents · ${w.label} (${w.years})`,
    note, filename: `abs_w${wave}_${varId}${breakdown ? '_' + breakdown : ''}`,
    rows: () => {
      if (!rec) return []
      const rows = []
      if (!breakdown) {
        shown.forEach(c => cellDistribution(rec.est[c].all, rec, base)?.forEach(d => rows.push({
          indicator: d.nr ? rec.nr_labels[rec.nr.indexOf(d.code)] : rec.labels[rec.codes.indexOf(d.code)], variable: varId,
          success_codes: d.code, base, country_set: 'country', wave, year: manifest.countries[c].waves[wave]?.year,
          iso3: iso3(c), country: countryName(c), group: 'all', value: d.pct,
          n: base === 'asked' ? rec.est[c].all.n : rec.est[c].all.nv, n_countries: 1 })))
      } else {
        shown.forEach(c => ['all', ...sg.groups.map(g => g.id)].forEach(g => {
          const v = valueOf(c, g)
          if (v) rows.push({ indicator: indLabel, variable: varId, success_codes: indicator.codes?.join(';') ?? 'mean', base,
            country_set: 'country', wave, year: manifest.countries[c].waves[wave]?.year, iso3: iso3(c), country: countryName(c),
            group: g, value: v.value, se: v.se, n: v.n, n_countries: 1 })
        }))
      }
      return rows
    },
  })

  const items = useMemo(() => (index?.vars || []).map(v => ({ ...v, q: capFirst(v.q), code: v.id.toUpperCase() })), [index])

  return (
    <div className="view-page dock-clearance">
      <div className="view-inner">
        <div className="view-header-row animate-fade-up">
          <div>
            <h1>Single-Wave Explorer</h1>
            <p className="view-subtitle">Answers to any question in one wave, compared across countries and groups.</p>
          </div>
          <WaveSelector value={wave} onChange={setWave} />
        </div>

        <div className="explorer-layout animate-fade-up stagger-1">
          <div className="explorer-controls">
            {index && <VariablePicker items={items} sections={index.sections} value={varId} onChange={setVarId} label="Question" />}
            {rec && (
              <IndicatorControl allowMean={allowMean} metric={indicator.type} onMetric={setMetric}
                codes={rec.codes} labels={rec.labels} selected={codesSel} onSelected={setCodesSel}
                meanHint={rec.type === 'continuous' ? 'Mean of the exact values.' : scaleNote ? `Mean on the original codes: ${scaleNote}. Off-scale answers excluded.` : null} />
            )}
            <BaseControl value={base} onChange={setBase} />
            <BreakdownControl value={breakdown} onChange={setBreakdown} />
            {breakdown && <Checkbox checked={showCI} onChange={setShowCI} label="Show 95% confidence intervals" />}
            <CountryPicker countries={waveCountries(wave)} available={asked} selected={countries} onChange={setCountries} />
            <ExportBar {...exp} onPrintMode={exp.setPrintMode} disabled={!rec || !shown.length}
                       printWarning={exp.printMode && shown.length > 4 && !breakdown ? 'Print style reads best with 4 or fewer countries.' : null} />
            {entry && rec && (
              <DetailPanel code={entry.id.toUpperCase()} question={questionText(entry)} section={entry.s} type={entry.t} rec={rec}
                           countries={entry.c} harmonized={entry.h} />
            )}
          </div>

          <div className="explorer-main">
            {!rec || !entry ? (
              <div className="chart-empty"><div className="spinner" /></div>
            ) : !shown.length ? (
              <div className="chart-empty"><p>Choose at least one country where this question was asked.</p></div>
            ) : (
              <ChartPanel title={questionText(entry)} badge={`${w.label} · ${w.years}`} note={note}
                          warning={loading ? null : entry.t === 'nominal' && dist?.cats.some(c => c.key === '_other') ? `Showing the ${MAX_BARS - 1} most common answers; the rest are grouped.` : null}>
                {!breakdown ? (
                  <BarChart categories={dist.cats} series={shown.map(c => ({ key: c, label: countryName(c), color: countryColor(c) }))}
                            get={dist.get} printMode={exp.printMode} svgRef={exp.svgRef} ariaLabel={entry.q} />
                ) : (
                  <DotPlot rows={shown.map(c => ({ key: c, label: countryName(c) }))}
                           groups={sg.groups.map((g, i) => ({ key: g.id, label: g.label, color: GROUP_COLORS[i] }))}
                           get={(c, g) => valueOf(c, g)} overall={c => valueOf(c)?.value}
                           domain={indicator.type === 'mean' ? meanDomain(rec) : [0, 100]}
                           format={(v, tick) => fmtValue(v, indicator, tick ? 0 : indicator.type === 'mean' ? 2 : 0)}
                           showCI={showCI} printMode={exp.printMode} svgRef={exp.svgRef} minN={manifest.min_cell_n} ariaLabel={entry.q} />
                )}
                <div className="stats-row">
                  {shown.map(c => {
                    const v = valueOf(c)
                    return (
                      <div key={c} className="stat-card">
                        <div className="stat-country"><span className="stat-dot" style={{ background: countryColor(c) }} />{countryName(c)}</div>
                        <div className="stat-values">
                          <span className="stat-mean">{v ? fmtValue(v.value, indicator, indicator.type === 'mean' ? 2 : 0) : '—'}</span>
                          {v?.se != null && <span className="stat-std">± {fmtValue(1.96 * v.se, indicator, indicator.type === 'mean' ? 2 : 0)}</span>}
                        </div>
                        <div className="stat-n">{indLabel.length > 42 ? indLabel.slice(0, 40) + '…' : indLabel} · N = {fmtN(v?.n)}</div>
                      </div>
                    )
                  })}
                </div>
              </ChartPanel>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function meanDomain(rec) {
  if (rec.type === 'continuous') return rec.range
  const on = rec.codes.filter(c => !(rec.offscale || []).includes(c))
  return [Math.min(...on), Math.max(...on)]
}
