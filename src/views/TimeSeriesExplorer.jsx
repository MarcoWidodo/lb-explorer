import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useData, useResource, api, useSourceNote } from '../context/DataProvider'
import VariablePicker from '../components/shared/VariablePicker'
import CountryPicker from '../components/shared/CountryPicker'
import DetailPanel from '../components/shared/DetailPanel'
import { IndicatorControl, BaseControl, BreakdownControl, ExportBar, ChartPanel, Checkbox, Select } from '../components/shared/Controls'
import LineChart from '../components/charts/LineChart'
import { cellValue, regionValue, fmtValue } from '../lib/stats'
import { useChartExport } from '../lib/useChartExport'

const DEFAULT_ITEM = 'dem_preference'
const GROUP_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export default function TimeSeriesExplorer() {
  const { manifest, countryName, countryColor, iso3, sortByName, wave: waveInfo } = useData()
  const sourceNote = useSourceNote()
  const [params, setParams] = useSearchParams()
  const { data: tindex } = useResource(() => api.trendIndex(), [])
  const [itemId, setItemId] = useState(params.get('item') || DEFAULT_ITEM)
  const { data: rec } = useResource(() => (itemId ? api.trend(itemId) : null), [itemId])
  const item = tindex?.items.find(i => i.id === itemId)

  const defaultSet = manifest.country_sets.find(s => s.id === manifest.default_set)
  const [countries, setCountries] = useState(defaultSet?.countries || [])
  const [setId, setSetId] = useState(manifest.default_set)
  const [base, setBase] = useState('valid')
  const [metric, setMetric] = useState('share')
  const [codesSel, setCodesSel] = useState([])
  const [breakdown, setBreakdown] = useState('')
  const [focus, setFocus] = useState('')
  const [showCI, setShowCI] = useState(false)
  const [fitAxis, setFitAxis] = useState(false)

  useEffect(() => { if (params.get('item') && params.get('item') !== itemId) setItemId(params.get('item')) }, [params]) // eslint-disable-line react-hooks/exhaustive-deps
  function chooseItem(id) { setItemId(id); setParams({ item: id }, { replace: true }) }

  useEffect(() => {
    if (!item) return
    setMetric(item.default.type)
    setCodesSel(item.default.codes || [])
  }, [item])

  const available = useMemo(() => {
    if (!rec) return []
    const s = new Set()
    Object.values(rec.waves).forEach(wd => Object.keys(wd).forEach(c => s.add(c)))
    return sortByName([...s])
  }, [rec, sortByName])

  const indicator = metric === 'mean' && item?.mean_ok !== false ? { type: 'mean' } : { type: 'share', codes: codesSel }
  const codesKey = codesSel.join()
  const waves = item?.waves || []
  const set = manifest.country_sets.find(s => s.id === setId)
  const sg = manifest.subgroups.find(s => s.id === breakdown)
  const focusKey = focus || (set ? `set:${set.id}` : countries[0])

  const valueAt = (c, w, g = 'all') => {
    const cell = rec?.waves?.[w]?.[c]?.[g]
    return cell ? cellValue(cell, rec.codes, indicator, base) : null
  }
  const year = (c, w) => manifest.countries[c]?.waves?.[w]?.year

  const { series, bands, regionGaps } = useMemo(() => {
    if (!rec || !item) return { series: [], bands: [], regionGaps: [] }
    const bands = waves.map(w => {
      const ys = Object.keys(rec.waves[w] || {}).map(c => year(c, w)).filter(Boolean)
      return { label: `W${w}`, x0: Math.min(...ys), x1: Math.max(...ys) }
    })
    const point = (w, v, x, extra) => ({ x, y: v.value, se: v.se, n: v.n, wave: w, waveIdx: waves.indexOf(w),
      waveLabel: `${waveInfo(w).label} (${waveInfo(w).years})`, nLabel: base === 'asked' ? 'N asked' : 'N valid', ...extra })
    const regionPoints = (g) => {
      const gaps = []
      const pts = waves.map(w => {
        const byC = Object.fromEntries(set.countries.map(c => [c, valueAt(c, w, g)]))
        const r = regionValue(byC, set.countries)
        if (!r) { gaps.push(w); return null }
        const x = Math.round(set.countries.reduce((s, c) => s + year(c, w), 0) / set.countries.length * 10) / 10
        return point(w, r, x, { yearLabel: `mean of member years (${x})`, note: `${r.n_countries} countries, each weighted equally` })
      }).filter(Boolean)
      return { pts, gaps }
    }
    let series = [], regionGaps = []
    if (!breakdown) {
      series = countries.filter(c => available.includes(c)).map(c => ({
        key: c, label: countryName(c), color: countryColor(c),
        points: waves.map(w => { const v = valueAt(c, w); return v ? point(w, v, year(c, w)) : null }).filter(Boolean),
      }))
      if (set) {
        const { pts, gaps } = regionPoints('all')
        regionGaps = gaps
        if (pts.length) series.push({ key: `set:${set.id}`, label: `${set.label.split(' (')[0]} average`, bold: true, points: pts })
      }
    } else {
      const groups = sg.groups
      series = groups.map((g, i) => {
        let pts
        if (focusKey?.startsWith('set:')) {
          const r = regionPoints(g.id); pts = r.pts; regionGaps = r.gaps
        } else {
          pts = waves.map(w => { const v = valueAt(focusKey, w, g.id); return v && v.n >= manifest.min_cell_n ? point(w, v, year(focusKey, w)) : null }).filter(Boolean)
        }
        return { key: g.id, label: g.label, color: GROUP_COLORS[i], points: pts }
      })
    }
    return { series, bands, regionGaps }
  }, [rec, item, countries, set, base, indicator.type, codesKey, breakdown, focusKey, available]) // eslint-disable-line react-hooks/exhaustive-deps

  const scaleDomain = indicator.type === 'mean' ? [1, item?.points || 5] : [0, 100]
  const vals = series.flatMap(s => s.points.map(p => p.y))
  const yDomain = fitAxis && vals.length
    ? (indicator.type === 'mean' ? [Math.min(...vals) - 0.2, Math.max(...vals) + 0.2] : [Math.max(0, Math.min(...vals) - 5), Math.min(100, Math.max(...vals) + 5)])
    : scaleDomain
  const indLabel = !item ? '' : indicator.type === 'mean'
    ? `Mean (1 = ${item.labels[0]} … ${item.points} = ${item.labels[item.points - 1]})`
    : `% ${indicator.codes.map(c => item.labels[c - 1]).join(' + ')}${base === 'asked' ? ' (all asked)' : ''}`
  const yearsTxt = bands.length ? `${Math.min(...bands.map(b => b.x0))}–${Math.max(...bands.map(b => b.x1))}` : ''
  const focusLabel = focusKey?.startsWith('set:') ? `${set?.label.split(' (')[0]} average` : countryName(focusKey)
  const note = sourceNote({
    waves: `Waves ${waves[0]}–${waves[waves.length - 1]} (${yearsTxt}), harmonized series "${itemId}"`, base,
    set: set && (!breakdown || focusKey?.startsWith('set:')) ? `Regional line: unweighted mean of ${set.countries.map(countryName).join(', ')}; shown only in waves where all were surveyed.` : null,
    extra: 'Points are placed at each country’s fieldwork year; lines break where a country skipped a wave.',
  })

  const exp = useChartExport({
    title: item?.q || '', subtitle: breakdown ? `${indLabel} · ${focusLabel}, by ${sg?.label.toLowerCase()}` : `${indLabel} · ${yearsTxt}`,
    note, filename: `abs_trend_${itemId}${breakdown ? '_' + breakdown : ''}`,
    rows: () => series.flatMap(s => s.points.map(p => ({
      indicator: indLabel, variable: itemId, success_codes: indicator.codes?.join(';') ?? 'mean', base,
      country_set: s.key.startsWith('set:') || focusKey?.startsWith('set:') ? set?.id : 'country',
      wave: p.wave, year: p.x, iso3: s.key.length === 2 ? iso3(s.key) : (breakdown && !focusKey.startsWith('set:') ? iso3(focusKey) : ''),
      country: s.key.length === 2 ? countryName(s.key) : (breakdown ? focusLabel : s.label),
      group: breakdown ? s.key : 'all', value: p.y, se: p.se, n: p.n,
      n_countries: s.key.startsWith('set:') || (breakdown && focusKey.startsWith('set:')) ? set.countries.length : 1 }))),
  })

  const items = useMemo(() => (tindex?.items || []).map(i => ({ id: i.id, q: i.q, s: i.cat, code: null, t: i.points >= 7 ? 'ordinal' : null })), [tindex])
  const categories = useMemo(() => [...new Set((tindex?.items || []).map(i => i.cat))], [tindex])
  const fmt = (v, d) => fmtValue(v, indicator, d ?? (indicator.type === 'mean' ? 2 : 0))

  return (
    <div className="view-page dock-clearance">
      <div className="view-inner">
        <div className="animate-fade-up">
          <h1>Time-Series Explorer</h1>
          <p className="view-subtitle">{manifest.n_trends} harmonized questions tracked across six waves, on a common scale.</p>
        </div>

        <div className="explorer-layout animate-fade-up stagger-1" style={{ marginTop: '1.5rem' }}>
          <div className="explorer-controls">
            {tindex && <VariablePicker items={items} sections={categories} value={itemId} onChange={chooseItem} label="Harmonized question" showType={false} />}
            {item && (
              <IndicatorControl allowMean={item.mean_ok !== false} metric={indicator.type} onMetric={setMetric}
                codes={item.labels.map((_, i) => i + 1)} labels={item.labels} selected={codesSel} onSelected={setCodesSel}
                meanHint={`Mean on the harmonized scale: 1 = ${item.labels[0]} … ${item.points} = ${item.labels[item.points - 1]}.`} />
            )}
            <BaseControl value={base} onChange={setBase} />
            <Select label="Regional average" value={setId} onChange={setSetId}
              options={[{ value: '', label: 'None' }, ...manifest.country_sets.map(s => ({ value: s.id, label: s.label }))]}
              hint={set ? `${set.countries.map(countryName).join(', ')}. Each country counts equally.` : null} />
            <BreakdownControl value={breakdown} onChange={v => { setBreakdown(v); setFocus('') }} />
            {breakdown && (
              <Select label="Show groups for" value={focusKey} onChange={setFocus}
                options={[...(set ? [{ value: `set:${set.id}`, label: `${set.label.split(' (')[0]} average` }] : []),
                          ...available.map(c => ({ value: c, label: countryName(c) }))]} />
            )}
            {!breakdown && <CountryPicker countries={available} selected={countries} onChange={setCountries} />}
            <Checkbox checked={showCI} onChange={setShowCI} label="Show 95% confidence intervals" />
            <Checkbox checked={fitAxis} onChange={setFitAxis} label="Zoom y-axis to the data" hint={fitAxis ? 'The axis no longer starts at the bottom of the scale.' : null} />
            <ExportBar {...exp} onPrintMode={exp.setPrintMode} disabled={!series.length}
                       printWarning={exp.printMode && series.length > 4 ? 'Print style reads best with 4 or fewer lines.' : null} />
            {item && (
              <DetailPanel question={item.q} section={item.cat} code={item.id}
                rec={{ codes: item.labels.map((_, i) => i + 1), labels: item.labels }} type="ordinal"
                extra={<>
                  <div className="detail-responses-label" style={{ marginTop: '0.75rem' }}>Source question by wave</div>
                  {item.waves.map(w => (
                    <div key={w} className="detail-response-row">
                      <span className="detail-response-code" style={{ minWidth: 34 }}>W{w}</span>
                      <span className="detail-source-var">{item.src[w].var.toUpperCase()}</span>
                      <span className="detail-nr-badge">{item.src[w].rule}{item.src[w].map ? `: ${item.src[w].map}` : ''}</span>
                    </div>
                  ))}
                  {item.notes && <div className="detail-note">{item.notes}</div>}
                </>} />
            )}
          </div>

          <div className="explorer-main">
            {!rec || !item ? <div className="chart-empty"><div className="spinner" /></div>
              : !series.some(s => s.points.length) ? <div className="chart-empty"><p>Choose at least one country or a regional average.</p></div>
              : (
                <ChartPanel title={item.q} badge={indicator.type === 'mean' ? 'Mean' : '% of respondents'} note={note}
                  warning={regionGaps.length && set ? `The ${set.label.split(' (')[0]} average is left out of ${regionGaps.map(w => `W${w}`).join(', ')} because not every member was surveyed or asked.` : null}>
                  <div className="chart-subtitle">{breakdown ? `${indLabel} · ${focusLabel}, by ${sg.label.toLowerCase()}` : indLabel}</div>
                  <LineChart series={series} bands={bands} yDomain={yDomain} showCI={showCI} printMode={exp.printMode} svgRef={exp.svgRef}
                    yFormat={v => indicator.type === 'mean' ? v.toFixed(1) : `${Math.round(v)}%`} valueFormat={v => fmt(v, 1)} ariaLabel={item.q} />
                  <TrendTable series={series} waves={waves} fmt={v => fmt(v, indicator.type === 'mean' ? 2 : 0)} />
                </ChartPanel>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TrendTable({ series, waves, fmt }) {
  return (
    <div className="corr-table-scroll trend-table">
      <table className="corr-table">
        <thead><tr><th>Series</th>{waves.map(w => <th key={w} className="corr-th-num">W{w}</th>)}</tr></thead>
        <tbody>
          {series.map(s => (
            <tr key={s.key} className={s.bold ? 'row-emph' : ''}>
              <td>{s.color && <span className="stat-dot" style={{ background: s.color, display: 'inline-block', marginRight: 6 }} />}{s.label}</td>
              {waves.map(w => {
                const p = s.points.find(q => q.wave === w)
                return <td key={w} className="corr-td-num" title={p ? `Fieldwork ${p.x}; N = ${p.n?.toLocaleString('en-US')}` : 'Not surveyed / not asked'}>{p ? fmt(p.y) : '—'}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
