import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useData } from '../../context/DataProvider'
import { TYPE_LABEL } from './VariablePicker'

/**
 * Collapsible "Question details" panel used by every view.
 * rec: a variable file ({ codes, labels, nr, nr_labels, offscale }) or a trend item.
 */
export default function DetailPanel({ title = 'Question details', code, question, section, type, rec, countries, countriesLabel = 'Asked in', harmonized, extra, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const { countryName } = useData()
  if (!question) return null
  const off = new Set(rec?.offscale || [])
  return (
    <div className="detail-panel">
      <button className="detail-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="detail-toggle-text">{title}{code ? <span className="detail-toggle-code"> · {code}</span> : null}</span>
        <ChevronDown size={15} style={{ transition: 'transform 0.25s ease', transform: open ? 'rotate(180deg)' : 'none', color: 'var(--color-text-tertiary)' }} />
      </button>
      {open && (
        <div className="detail-content animate-fade-in">
          <div className="detail-question">{question}</div>
          <div className="detail-meta">
            {section && <span className="detail-tag">{section}</span>}
            {type && <span className="detail-tag">{TYPE_LABEL[type] || type}</span>}
            {rec?.codes && type !== 'continuous' && <span className="detail-tag">{rec.codes.length - off.size} scale points</span>}
          </div>
          {rec?.codes && (
            <div className="detail-responses">
              <div className="detail-responses-label">{type === 'continuous' ? 'Bins used for the chart' : 'Answers'}</div>
              {rec.codes.slice(0, 60).map((c, i) => (
                <div key={c} className="detail-response-row">
                  <span className="detail-response-code">{type === 'continuous' ? '' : c}</span>
                  <span className="detail-response-label">{rec.labels[i]}</span>
                  {off.has(c) && <span className="detail-nr-badge" title="Valid answer that is not on the scale: counted in percentages, not in means">off-scale</span>}
                </div>
              ))}
              {rec.codes.length > 60 && <div className="detail-response-row"><span className="detail-response-label">…and {rec.codes.length - 60} more</span></div>}
              {rec.nr?.map((c, j) => (
                <div key={`nr${c}`} className="detail-response-row non-response">
                  <span className="detail-response-code">{c}</span>
                  <span className="detail-response-label">{rec.nr_labels?.[j] ?? 'No answer'}</span>
                  <span className="detail-nr-badge">non-response</span>
                </div>
              ))}
              {type === 'continuous' && rec.range && (
                <div className="detail-note">Observed range {rec.range[0]}–{rec.range[1]}. Means use exact values, not bins.</div>
              )}
            </div>
          )}
          {countries && (
            <div className="detail-note"><strong>{countriesLabel}:</strong> {countries.map(countryName).join(', ')}</div>
          )}
          {harmonized && (
            <div className="detail-note">
              Also part of the harmonized series <Link to={`/trends?item=${harmonized}`} className="detail-link">{harmonized}</Link>, comparable across waves.
            </div>
          )}
          {extra}
        </div>
      )}
    </div>
  )
}

/**
 * Latinobarómetro question history: years asked, the original question number in
 * each year's questionnaire (from the harmonisation crosswalk), the Spanish title,
 * comparability notes, and a link to the trend.
 */
export function QuestionHistory({ entry, rec, showTrendLink = true }) {
  if (!entry) return null
  const qn = rec?.qn || {}
  return (
    <>
      {rec?.title_es && <div className="detail-note"><strong>Spanish title:</strong> {rec.title_es}</div>}
      {entry.note && <div className="detail-note"><strong>Comparability:</strong> {entry.note}</div>}
      {entry.tb && <div className="detail-note"><strong>Trend:</strong> {entry.tb.note}</div>}
      <div className="detail-responses-label" style={{ marginTop: '0.75rem' }}>Asked in {entry.y.length} survey years · question number</div>
      <div className="detail-qn-grid">
        {entry.y.map(y => (
          <span key={y} className="detail-qn"><span className="detail-response-code">{y}</span><span className="detail-source-var">{qn[y] ?? '—'}</span></span>
        ))}
      </div>
      {showTrendLink && entry.tb?.years !== 'all' && (
        <div className="detail-note">See this question over time in the <Link to={`/trends?item=${entry.id}`} className="detail-link">Time-Series Explorer</Link>.</div>
      )}
    </>
  )
}
