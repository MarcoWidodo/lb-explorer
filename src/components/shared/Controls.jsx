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

/* ── Wave selector (from the manifest) ── */
export function WaveSelector({ value, onChange, waves }) {
  const { manifest } = useData()
  const list = waves ? manifest.waves.filter(w => waves.includes(w.id)) : manifest.waves
  return (
    <div className="wave-selector" role="radiogroup" aria-label="Survey wave">
      {list.map(w => (
        <button key={w.id} role="radio" aria-checked={value === w.id} onClick={() => onChange(w.id)}
                className={`wave-pill${value === w.id ? ' active' : ''}`}>
          <span className="wave-pill-label">{w.label}</span>
          <span className="wave-pill-years">{w.years}</span>
        </button>
      ))}
    </div>
  )
}

/* ── Indicator: what number summarises a country (mean, or % giving chosen answers) ── */
export function IndicatorControl({ allowMean, metric, onMetric, codes, labels, selected, onSelected, meanHint }) {
  const toggle = (c) => {
    const next = selected.includes(c) ? selected.filter(x => x !== c) : [...selected, c].sort((a, b) => codes.indexOf(a) - codes.indexOf(b))
    if (next.length) onSelected(next)
  }
  return (
    <div className="picker-wrap">
      <label className="picker-label">Show</label>
      <div className="mode-toggle">
        <button className={`mode-btn${metric === 'share' ? ' active' : ''}`} onClick={() => onMetric('share')}>% choosing</button>
        <button className={`mode-btn${metric === 'mean' ? ' active' : ''}`} onClick={() => onMetric('mean')} disabled={!allowMean}
                title={allowMean ? '' : 'Means are only shown for ordered scales'}>Mean</button>
      </div>
      {metric === 'share' ? (
        <div className="response-chips" role="group" aria-label="Answers counted">
          {codes.map((c, i) => (
            <button key={c} className={`response-chip${selected.includes(c) ? ' active' : ''}`} onClick={() => toggle(c)}
                    aria-pressed={selected.includes(c)}>
              <span className="response-chip-code">{c}</span>{labels[i]}
            </button>
          ))}
        </div>
      ) : (
        meanHint && <span className="control-hint">{meanHint}</span>
      )}
    </div>
  )
}

export function BaseControl({ value, onChange }) {
  return (
    <Segmented label="Denominator" value={value} onChange={onChange}
      options={[{ value: 'valid', label: 'Valid answers', title: "Don't know / can't choose / decline excluded" },
                { value: 'asked', label: 'All asked', title: "Don't know / can't choose / decline kept in the base (published-report style)" }]}
      hint={value === 'valid' ? "Don't know, can't choose and decline are excluded." : "Don't know, can't choose and decline stay in the base."} />
  )
}

export function BreakdownControl({ value, onChange, hint }) {
  const { manifest } = useData()
  return (
    <Select label="Break down by" value={value} onChange={onChange} hint={hint}
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
