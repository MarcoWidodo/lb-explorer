import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useData, useResource, api, loadAllGroups, useSourceNote } from '../context/DataProvider'
import VariablePicker from '../components/shared/VariablePicker'
import CountryPicker from '../components/shared/CountryPicker'
import DetailPanel, { QuestionHistory } from '../components/shared/DetailPanel'
import { IndicatorControl, BaseControl, BreakdownControl, ExportBar, ChartPanel, Checkbox, Select } from '../components/shared/Controls'
import LineChart from '../components/charts/LineChart'
import { cellValue, regionValue, fmtValue } from '../lib/stats'
import { useChartExport, capFirst } from '../lib/useChartExport'
import { defaultIndicator, indicatorLabel, meanAllowed, meanDomain } from '../lib/indicators'

const GROUP_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']
const FEATURED = 'Core democracy & trust series'

/*
  Trends follow LB_Trend_Analysis_Instructions.md:
   - country-year estimates first; regional line = equal-weight mean over a FIXED set,
     shown only in years when every member has data (lb_region); an unbalanced set
     shows how many countries each point averages
   - a real calendar-year axis with a marker at each survey year; nothing interpolated;
     a line breaks where a country is missing in a year the question was asked
   - years listed as comparability breaks (e.g. left–right 1998, a 1–10 scale) are left out
   - nominal questions: lines join only years that offered the same answer list
*/
export default function TimeSeriesExplorer() {
  const { manifest, countryName, countryColor, iso3, sortByName } = useData()
  const sourceNote = useSourceNote()
  const [params, setParams] = useSearchParams()
  const { data: index } = useResource(() => api.index(), [])
  const [itemId, setItemId] = useState(params.get('item') || manifest.default_trend)
  const entry = index?.vars.find(v => v.id === itemId)
  const { data: rec } = useResource(() => (entry ? api.variable(itemId) : null), [itemId, !!entry])
  const ready = rec && rec.id === itemId

  const [countries, setCountries] = useState([])
  const [setId, setSetId] = useState(manifest.default_set)
  const [base, setBase] = useState('valid')
  const [metric, setMetric] = useState('share')
  const [codesSel, setCodesSel] = useState([])
  const [breakdown, setBreakdown] = useState('')
  const [focus, setFocus] = useState('')
  const [showCI, setShowCI] = useState(false)
  const [fitAxis, setFitAxis] = useState(false)
  const { data: groups } = useResource(() => (ready && breakdown ? loadAllGroups(rec) : null), [ready && rec.id, !!breakdown])

  useEffect(() => { if (params.get('item') && params.get('item') !== itemId) setItemId(params.get('item')) }, [params]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (index && !entry) setItemId(manifest.default_trend) }, [index, entry]) // eslint-disable-line react-hooks/exhaustive-deps
  function chooseItem(id) { setItemId(id); setParams({ item: id }, { replace: true }) }

  useEffect(() => {
    if (!ready) return
    const d = defaultIndicator(rec, entry)
    setMetric(d.type)
    setCodesSel(d.codes || [])
    // some questions have their own default set (armed forces: the 14 countries that have them)
    if (entry?.ds) setSetId(entry.ds)
    else setSetId(id => (manifest.country_sets.some(s => s.id === id && s.id !== 'bal14af') || id === '' ? id : manifest.default_set))
  }, [ready && rec.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const available = useMemo(() => {
    if (!ready) return []
    const s = new Set()
    Object.values(rec.est).forEach(yy => Object.keys(yy).forEach(c => s.add(c)))
    return sortByName([...s])
  }, [ready, rec, sortByName])

  const allowMean = ready && meanAllowed(rec, entry)
  const indicator = metric === 'mean' && allowMean ? { type: 'mean' } : { type: 'share', codes: codesSel }
  const codesKey = codesSel.join()
  const set = manifest.country_sets.find(s => s.id === setId)
  const sg = manifest.subgroups.find(s => s.id === breakdown)
  const focusKey = focus || (set ? `set:${set.id}` : countries[0] || available[0])
  const noTrend = entry?.tb?.years === 'all'
  const breakYears = useMemo(() => new Set(entry?.tb && !noTrend ? entry.tb.years : []), [entry, noTrend])

  // Years on the line and the position used to break it: +1 per year asked, +2 where a
  // nominal question's answer list changes (so lines only join years with the same list)
  const { years, pos, listChanges } = useMemo(() => {
    if (!ready || noTrend) return { years: [], pos: {}, listChanges: [] }
    // a left-out (break) year also breaks the line, so the gap stays visible
    const years = rec.years.filter(y => !breakYears.has(y))
    const pos = {}; const listChanges = []
    let k = 0, prevSig = null, skipped = false, first = true
    rec.years.forEach(y => {
      if (breakYears.has(y)) { skipped = true; return }
      const sig = rec.yc ? (rec.yc[y] || []).join(',') : ''
      if (!first) k += sig !== prevSig || skipped ? 2 : 1
      if (!first && sig !== prevSig) listChanges.push(y)
      pos[y] = k; prevSig = sig; skipped = false; first = false
    })
    return { years, pos, listChanges }
  }, [ready, rec, breakYears, noTrend])

  const cellAt = (c, y, g = 'all') => (g === 'all' ? rec?.est?.[y]?.[c] : groups?.[y]?.[c]?.[g])
  const valueAt = (c, y, g = 'all') => {
    const cell = cellAt(c, y, g)
    const v = cell ? cellValue(cell, rec.codes, indicator, base) : null
    return v && (g === 'all' || v.n >= manifest.min_cell_n) ? v : null
  }
  const nLabel = base === 'asked' ? 'N asked' : 'N valid'
  const baseRow = { name: 'Base', value: base === 'asked' ? 'all asked' : 'valid answers' }

  const { series, regionGaps } = useMemo(() => {
    if (!ready || !years.length) return { series: [], regionGaps: [] }
    const point = (y, v, extra) => ({ x: y, y: v.value, se: v.se, n: v.n, wave: y, waveIdx: pos[y],
      subtitle: String(y), nLabel, extraRows: [baseRow], ...extra })
    const regionPoints = (g) => {
      const gaps = []
      const pts = years.map(y => {
        const byC = Object.fromEntries(set.countries.map(c => [c, valueAt(c, y, g)]))
        const r = regionValue(byC, set.countries, !set.balanced)
        if (!r) { gaps.push(y); return null }
        return point(y, r, { n_countries: r.n_countries,
          extraRows: [baseRow, { name: 'Countries', value: `${r.n_countries}${set.balanced ? '' : ` of ${set.countries.length}`}` }],
          note: `${r.n_countries} countries, each weighted equally` })
      }).filter(Boolean)
      return { pts, gaps }
    }
    let series = [], regionGaps = []
    if (!breakdown) {
      series = countries.filter(c => available.includes(c)).map(c => ({
        key: c, label: countryName(c), color: countryColor(c),
        points: years.map(y => { const v = valueAt(c, y); return v ? point(y, v) : null }).filter(Boolean),
      }))
      if (set) {
        const { pts, gaps } = regionPoints('all')
        regionGaps = gaps
        if (pts.length) series.push({ key: `set:${set.id}`, label: set.short || set.label, bold: true, points: pts })
      }
    } else if (groups) {
      series = sg.groups.map((g, i) => {
        let pts
        if (focusKey?.startsWith('set:')) {
          const r = regionPoints(g.id); pts = r.pts; regionGaps = r.gaps
        } else {
          pts = years.map(y => { const v = valueAt(focusKey, y, g.id); return v ? point(y, v) : null }).filter(Boolean)
        }
        return { key: g.id, label: g.label, color: GROUP_COLORS[i], points: pts }
      })
    }
    return { series, regionGaps }
  }, [ready, rec, years, pos, countries, set, base, indicator.type, codesKey, breakdown, focusKey, available, groups]) // eslint-disable-line react-hooks/exhaustive-deps

  const scaleDomain = indicator.type === 'mean' && ready ? meanDomain(rec) : [0, 100]
  const vals = series.flatMap(s => s.points.map(p => p.y))
  const yDomain = fitAxis && vals.length
    ? (indicator.type === 'mean' ? [Math.min(...vals) - 0.2, Math.max(...vals) + 0.2] : [Math.max(0, Math.min(...vals) - 5), Math.min(100, Math.max(...vals) + 5)])
    : scaleDomain
  const indLabel = ready ? indicatorLabel(indicator, rec, base) : ''
  const yearsTxt = years.length ? `${years[0]}–${years[years.length - 1]}` : ''
  const focusLabel = focusKey?.startsWith('set:') ? (set?.short || set?.label) : countryName(focusKey)
  const setOnChart = set && (!breakdown || focusKey?.startsWith('set:'))
  const breakNote = entry?.tb && !noTrend ? entry.tb.note : null
  const listNote = listChanges.length ? `The list of answers offered changed in ${listChanges.join(', ')}; lines join only years with the same list.` : null
  const note = sourceNote({
    waves: yearsTxt ? `${yearsTxt}, question ${itemId}` : '', base,
    set: setOnChart ? `${set.short || set.label}: unweighted mean of ${set.countries.map(countryName).join(', ')}${set.balanced ? '; shown only in years when all were surveyed and asked' : '; an unbalanced set, so each point gives the number of countries averaged'}.` : null,
    extra: [breakNote, listNote, 'Lines break where a country was not surveyed or not asked; nothing is interpolated.'].filter(Boolean).join(' '),
    gaps: true,
  })

  const exp = useChartExport({
    title: entry ? capFirst(entry.q) : '', subtitle: breakdown ? `${indLabel} · ${focusLabel}, by ${sg?.label.toLowerCase()} · ${yearsTxt}` : `${indLabel} · ${yearsTxt}`,
    note, filename: `lb_trend_${itemId}${breakdown ? '_' + breakdown : ''}`,
    rows: () => series.flatMap(s => s.points.map(p => {
      const isSet = s.key.startsWith('set:') || (breakdown && focusKey?.startsWith('set:'))
      const cc = !isSet ? (breakdown ? focusKey : s.key) : null
      return { indicator: indLabel, variable: itemId, success_codes: indicator.codes?.join(';') ?? 'mean', base,
        country_set: isSet ? set.id : 'country', year: p.x, iso3: cc ? iso3(cc) : '',
        country: cc ? countryName(cc) : (set.short || set.label), group: breakdown ? s.key : 'all',
        value: p.y, se: p.se, n: p.n, n_countries: isSet ? p.n_countries : 1 }
    })),
  })

  const items = useMemo(() => (index?.vars || []).map(v => ({ id: v.id, q: capFirst(v.q), s: v.f ? FEATURED : v.s, code: v.id, t: v.t })), [index])
  const sections = useMemo(() => (index ? [FEATURED, ...index.sections] : []), [index])
  const fmt = (v, d) => fmtValue(v, indicator, d ?? (indicator.type === 'mean' ? 2 : 0))
  const xTicks = []; for (let y = 1996; y <= 2024; y += 4) xTicks.push(y)
  const surveyYears = manifest.waves.map(w => w.id)
  const warnings = [
    regionGaps.length && set ? `The ${set.short || set.label} is left out of ${regionGaps.join(', ')}: not every member was surveyed or asked.` : null,
    setOnChart && set && !set.balanced ? 'Unbalanced set: the countries averaged change over time, which can move the line by itself. See the number of countries in each tooltip and in the table.' : null,
  ].filter(Boolean)

  return (
    <div className="view-page dock-clearance">
      <div className="view-inner">
        <div className="animate-fade-up">
          <h1>Time-Series Explorer</h1>
          <p className="view-subtitle">{manifest.n_questions} questions asked in three or more years, 1995–2024, on a real year axis with regional averages over fixed country sets.</p>
        </div>

        <div className="explorer-layout animate-fade-up stagger-1" style={{ marginTop: '1.5rem' }}>
          <div className="explorer-controls">
            {index && <VariablePicker items={items} sections={sections} value={itemId} onChange={chooseItem} label="Question" />}
            {ready && !noTrend && (
              <IndicatorControl allowMean={allowMean} metric={indicator.type} onMetric={setMetric}
                codes={rec.codes} labels={rec.labels} selected={codesSel} onSelected={setCodesSel}
                meanHint={entry?.ends ? `Mean on the original codes: ${entry.ends[0]} … ${entry.ends[1]}.` : rec.type === 'continuous' ? 'Mean of the exact values.' : null} />
            )}
            <BaseControl value={base} onChange={setBase} />
            <Select label="Regional average" value={setId} onChange={setSetId}
              options={[{ value: '', label: 'None' }, ...manifest.country_sets.map(s => ({ value: s.id, label: `${s.label}${s.span ? ` · ${s.span}` : ''}` }))]}
              hint={set ? `${set.countries.map(countryName).join(', ')}. Each country counts equally.${set.note ? ' ' + set.note : ''}` : null} />
            <BreakdownControl value={breakdown} onChange={v => { setBreakdown(v); setFocus('') }} />
            {breakdown && (
              <Select label="Show groups for" value={focusKey} onChange={setFocus}
                options={[...(set ? [{ value: `set:${set.id}`, label: set.short || set.label }] : []),
                          ...available.map(c => ({ value: c, label: countryName(c) }))]} />
            )}
            {!breakdown && <CountryPicker countries={available} selected={countries} onChange={setCountries} label="Countries (the regional line stays for reference)" />}
            <Checkbox checked={showCI} onChange={setShowCI} label="Show 95% confidence intervals" />
            <Checkbox checked={fitAxis} onChange={setFitAxis} label="Zoom y-axis to the data" hint={fitAxis ? 'The axis no longer starts at the bottom of the scale.' : null} />
            <ExportBar {...exp} onPrintMode={exp.setPrintMode} disabled={!series.some(s => s.points.length)}
                       printWarning={exp.printMode && series.length > 4 ? 'Print style reads best with 4 or fewer lines.' : null} />
            {entry && ready && (
              <DetailPanel code={entry.id} question={capFirst(entry.q)} section={entry.s} type={entry.t} rec={rec}
                           extra={<QuestionHistory entry={entry} rec={rec} showTrendLink={false} />} />
            )}
          </div>

          <div className="explorer-main">
            {!ready || !entry ? <div className="chart-empty"><div className="spinner" /></div>
              : noTrend ? (
                <div className="chart-empty"><p>{entry.tb.note}</p>
                  {index.vars.some(v => v.id === `${itemId}_victim`) && <button className="hero-cta" style={{ marginTop: '1rem' }} onClick={() => chooseItem(`${itemId}_victim`)}>Show {itemId}_victim</button>}
                </div>)
              : breakdown && !groups ? <div className="chart-empty"><div className="spinner" /></div>
              : !series.some(s => s.points.length) ? <div className="chart-empty"><p>Choose a regional average or at least one country.</p></div>
              : (
                <ChartPanel title={capFirst(entry.q)} badge={indicator.type === 'mean' ? 'Mean' : base === 'asked' ? '% of all asked' : '% of valid answers'} note={note}
                  warning={warnings.length ? warnings.join(' ') : null}>
                  <div className="chart-subtitle">{breakdown ? `${indLabel} · ${focusLabel}, by ${sg.label.toLowerCase()}` : indLabel}</div>
                  {(entry.note || breakNote || listNote) && (
                    <p className="trend-break-note"><strong>Comparability:</strong> {[breakNote, listNote].filter(Boolean).join(' ')}{entry.note ? <>{breakNote || listNote ? ' ' : ''}<em>Audit note:</em> {entry.note}</> : null}</p>
                  )}
                  <LineChart series={series} yDomain={yDomain} showCI={showCI} printMode={exp.printMode} svgRef={exp.svgRef}
                    xDomain={[years[0] - 0.8, years[years.length - 1] + 0.8]} xTicks={xTicks} minorTicks={surveyYears}
                    yFormat={v => indicator.type === 'mean' ? v.toFixed(1) : `${Math.round(v)}%`} valueFormat={v => fmt(v, 1)} ariaLabel={entry.q} />
                  <TrendTable series={series} years={years} fmt={v => fmt(v, indicator.type === 'mean' ? 2 : 0)} showK={setOnChart && !set.balanced} />
                </ChartPanel>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TrendTable({ series, years, fmt, showK }) {
  return (
    <div className="corr-table-scroll trend-table">
      <table className="corr-table">
        <thead><tr><th>Series</th>{years.map(y => <th key={y} className="corr-th-num">{y}</th>)}</tr></thead>
        <tbody>
          {series.map(s => (
            <tr key={s.key} className={s.bold ? 'row-emph' : ''}>
              <td>{s.color && <span className="stat-dot" style={{ background: s.color, display: 'inline-block', marginRight: 6 }} />}{s.label}</td>
              {years.map(y => {
                const p = s.points.find(q => q.x === y)
                return <td key={y} className="corr-td-num" title={p ? `${y}; N = ${p.n?.toLocaleString('en-US')}${p.n_countries ? `; ${p.n_countries} countries` : ''}` : 'Not surveyed / not asked'}>
                  {p ? fmt(p.y) : '—'}{p && showK && p.n_countries ? <sup> {p.n_countries}</sup> : null}
                </td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
