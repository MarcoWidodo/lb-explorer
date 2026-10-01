import { useState } from 'react'
import { ChevronDown, Image, FileCode2, Table, Info } from 'lucide-react'
import { useData } from '../../context/DataProvider'

/* ── Segmented toggle (Mean / %, Valid / Asked, Country / Individual…) ── */
export function Segmented({ label, options, value, onChange, hint }) {
  return (
    <div className="picker-wrap">
      {label && <label className="picker-label">{label}</label>}
      <div className="mode-toggle" role="radiogroup" aria-label={label}>
        {options.map(o => (
          <button key={o.value} role="radio" aria-checked={value === o.value} disabled={o.disabled}
                  className={`mode-btn${value === o.value ? ' active' : ''}`} onClick={() => onChange(o.value)}
                  title={o.title}>
            {o.label}
          </button>
        ))}
      </div>
      {hint && <span className="control-hint">{hint}</span>}
    </div>
  )
}

/* ── Plain select in the site's style ── */
export function Select({ label, value, onChange, options, hint }) {
  return (
    <div className="picker-wrap">
      {label && <label className="picker-label">{label}</label>}
      <div className="ts-select-wrap">
        <select className="ts-select" value={value ?? ''} onChange={e => onChange(e.target.value)}>
          {options.map(o => o.group
            ? <optgroup key={o.group} label={o.group}>{o.options.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</optgroup>
            : <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} className="ts-select-icon" />
      </div>
      {hint && <span className="control-hint">{hint}</span>}
    </div>
  )
}

export function Checkbox({ checked, onChange, label, hint }) {
  return (
    <div className="nr-toggle">
      <label className="nr-toggle-label">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="nr-checkbox" />
        <span>{label}</span>
      </label>
      {hint && <span className="nr-hint">{hint}</span>}
    </div>
  )
}

/* ── Unit selector (from the manifest) ──
   A few waves: labelled pills (ABS). Many survey years: a calendar strip with the
   years without a survey shown as gaps, and a plain select on narrow screens.
   `available`: units with data for the current question (others are disabled). */
export function WaveSelector({ value, onChange, waves, available }) {
  const { manifest } = useData()
  const list = waves ? manifest.waves.filter(w => waves.includes(w.id)) : manifest.waves
  if (manifest.waves.length > 8) return <YearSelector value={value} onChange={onChange} available={available} />
  return (
    <div className="wave-selector" role="radiogroup" aria-label="Survey wave">
      {list.map(w => (
        <button key={w.id} role="radio" aria-checked={value === w.id} onClick={() => onChange(w.id)}
                disabled={available ? !available.includes(w.id) : false}
                className={`wave-pill${value === w.id ? ' active' : ''}`}>
          <span className="wave-pill-label">{w.label}</span>
          <span className="wave-pill-years">{w.years}</span>
        </button>
      ))}
    </div>
  )
}

export function YearSelector({ value, onChange, available, label = 'Survey year' }) {
  const { manifest } = useData()
  const years = manifest.waves.map(w => w.id)
  const avail = available ? new Set(available) : null
  const calendar = []
  for (let y = years[0]; y <= years[years.length - 1]; y++) calendar.push(y)
  const nAvail = avail ? years.filter(y => avail.has(y)).length : years.length
  return (
    <div className="year-picker">
      <div className="year-picker-head">
        <span className="year-picker-label">{label}</span>
        <span className="year-picker-value">{value ?? '—'}</span>
        <span className="year-picker-hint">
          {avail ? `asked in ${nAvail} of ${years.length} survey years` : `${years.length} survey years`} · dotted gaps: no survey
        </span>
      </div>
      <div className="year-strip" role="radiogroup" aria-label={label}>
        {calendar.map(y => years.includes(y) ? (
          <button key={y} role="radio" aria-checked={value === y} className={`year-cell${value === y ? ' active' : ''}`}
                  disabled={avail ? !avail.has(y) : false} onClick={() => onChange(y)}
                  title={avail && !avail.has(y) ? `${y}: not asked` : String(y)}>
            ’{String(y).slice(2)}
          </button>
        ) : <span key={y} className="year-gap" title={`No survey in ${y}`} aria-hidden="true" />)}
      </div>
      <div className="year-select-wrap">
        <div className="ts-select-wrap">
          <select className="ts-select" value={value ?? ''} onChange={e => onChange(Number(e.target.value))} aria-label={label}>
            {[...years].reverse().map(y => (
              <option key={y} value={y} disabled={avail ? !avail.has(y) : false}>{y}{avail && !avail.has(y) ? ' (not asked)' : ''}</option>
            ))}
          </select>
          <ChevronDown size={14} className="ts-select-icon" />
        </div>
      </div>
    </div>
  )
}

/* ── Indicator: what number summarises a country (mean, or % giving chosen answers) ──
   Long answer lists (e.g. vote intention, hundreds of country-specific party codes) get a
   search box; the chosen answers always stay visible. */
const MAX_CHIPS = 40
export function IndicatorControl({ allowMean, metric, onMetric, codes, labels, selected, onSelected, meanHint }) {
  const [q, setQ] = useState('')
  const toggle = (c) => {
    const next = selected.includes(c) ? selected.filter(x => x !== c) : [...selected, c].sort((a, b) => codes.indexOf(a) - codes.indexOf(b))
    if (next.length) onSelected(next)
  }
  const long = codes.length > MAX_CHIPS
  const needle = q.trim().toLowerCase()
  const visible = !long ? codes.map((c, i) => [c, i]) : codes.map((c, i) => [c, i])
    .filter(([c, i]) => selected.includes(c) || (needle && (String(labels[i]).toLowerCase().includes(needle) || String(c) === needle)))
    .slice(0, MAX_CHIPS + selected.length)
  return (
    <div className="picker-wrap">
      <label className="picker-label">Show</label>
      <div className="mode-toggle">
        <button className={`mode-btn${metric === 'share' ? ' active' : ''}`} onClick={() => onMetric('share')}>% choosing</button>
        <button className={`mode-btn${metric === 'mean' ? ' active' : ''}`} onClick={() => onMetric('mean')} disabled={!allowMean}
                title={allowMean ? '' : 'Means are offered only for interval-like scales (0–10, 1–10) and numeric questions'}>Mean</button>
      </div>
      {metric === 'share' ? (
        <>
          {long && (
            <input type="search" className="picker-search chip-search" placeholder={`Search ${codes.length} answers…`} value={q}
                   onChange={e => setQ(e.target.value)} aria-label="Search answers" />
          )}
          <div className="response-chips" role="group" aria-label="Answers counted">
            {visible.map(([c, i]) => (
              <button key={c} className={`response-chip${selected.includes(c) ? ' active' : ''}`} onClick={() => toggle(c)}
                      aria-pressed={selected.includes(c)}>
                <span className="response-chip-code">{c}</span>{labels[i]}
              </button>
            ))}
          </div>
          {long && !needle && <span className="control-hint">Type to find more answers.</span>}
        </>
      ) : (
        meanHint && <span className="control-hint">{meanHint}</span>
      )}
    </div>
  )
}

export function BaseControl({ value, onChange }) {
  const { manifest } = useData()
  const nr = manifest.survey.nr_text || "Don't know / can't choose / decline"
  return (
    <Segmented label="Denominator" value={value} onChange={onChange}
      options={[{ value: 'valid', label: 'Valid answers', title: `${nr} excluded` },
                { value: 'asked', label: 'All asked', title: `${nr} kept in the base (published-report style)` }]}
      hint={value === 'valid' ? `${nr} excluded from the base.` : `${nr} kept in the base, as in ${manifest.survey.short}'s published reports.`} />
  )
}

export function BreakdownControl({ value, onChange, hint }) {
  const { manifest } = useData()
  const sg = manifest.subgroups.find(s => s.id === value)
  return (
    <Select label="Break down by" value={value} onChange={onChange} hint={hint ?? sg?.note}
            options={[{ value: '', label: 'No breakdown' }, ...manifest.subgroups.map(s => ({ value: s.id, label: s.label }))]} />
  )
}

/* ── Export buttons + print style ── */
export function ExportBar({ onPNG, onSVG, onCSV, printMode, onPrintMode, disabled, printWarning }) {
  return (
    <div className="picker-wrap">
      <label className="picker-label">Export</label>
      <div className="export-bar">
        <button className="export-btn" onClick={onPNG} disabled={disabled} title="PNG, 300 dpi, 9 × 5.5 in"><Image size={14} /><span>PNG</span></button>
        <button className="export-btn" onClick={onSVG} disabled={disabled} title="Vector SVG, 9 × 5.5 in"><FileCode2 size={14} /><span>SVG</span></button>
        <button className="export-btn" onClick={onCSV} disabled={disabled} title="Tidy CSV of the plotted values"><Table size={14} /><span>CSV</span></button>
      </div>
      <div className="nr-toggle" style={{ marginTop: '0.55rem' }}>
        <label className="nr-toggle-label">
          <input type="checkbox" checked={printMode} onChange={e => onPrintMode(e.target.checked)} className="nr-checkbox" />
          <span>Print style (greyscale)</span>
        </label>
        <span className="nr-hint">{printWarning || 'Line types, marker shapes and hatching instead of colour, as in the slide deck.'}</span>
      </div>
    </div>
  )
}

/* ── Chart panel frame: title, badge, chart, source note ── */
export function ChartPanel({ title, badge, children, note, warning, panelRef }) {
  return (
    <div className="chart-panel" ref={panelRef}>
      <div className="chart-title-bar">
        <h3 className="chart-title">{title}</h3>
        {badge && <span className="chart-wave-badge">{badge}</span>}
      </div>
      {warning && <div className="chart-warning"><Info size={14} /> {warning}</div>}
      {children}
      {note && <p className="source-note">{note}</p>}
    </div>
  )
}
