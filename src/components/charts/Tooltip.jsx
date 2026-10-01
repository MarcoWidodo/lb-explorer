/** HTML tooltip positioned inside a relatively positioned chart wrapper. */
export default function Tooltip({ tip, width }) {
  if (!tip) return null
  const left = Math.min(Math.max(tip.x + 14, 4), width - 250)
  return (
    <div className="chart-tooltip chart-tooltip-abs" style={{ left, top: Math.max(tip.y - 10, 0) }} role="status">
      {tip.title && <div className="chart-tooltip-label">{tip.title}</div>}
      {tip.subtitle && <div className="chart-tooltip-sub">{tip.subtitle}</div>}
      {tip.rows?.map((r, i) => (
        <div key={i} className="chart-tooltip-row">
          {r.color && <span className="chart-tooltip-dot" style={{ background: r.color }} />}
          <span className="chart-tooltip-name">{r.name}</span>
          <span className="chart-tooltip-value">{r.value}</span>
        </div>
      ))}
      {tip.foot && <div className="chart-tooltip-foot">{tip.foot}</div>}
    </div>
  )
}
