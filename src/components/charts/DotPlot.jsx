import { useState } from 'react'
import { scaleLinear, scaleBand } from 'd3-scale'
import { useWidth, useUid } from './useWidth'
import { seriesStyle, Marker, SvgLegend, legendHeight, AXIS, PRINT_FONT } from './theme'
import Tooltip from './Tooltip'

/**
 * Subgroup comparison: one row per country, one marker per subgroup.
 * rows: [{ key, label }]   groups: [{ key, label, color }]
 * get(rowKey, groupKey) → { value, se, n } | null.  overall(rowKey) → value for all respondents (tick).
 */
export default function DotPlot({ rows, groups, get, overall, domain, format, showCI, printMode, svgRef, ariaLabel, minN = 30 }) {
  const [wrapRef, width] = useWidth()
  const uid = useUid('dot')
  const [tip, setTip] = useState(null)
  const styles = groups.map((g, i) => seriesStyle(i, g.color, printMode))
  const items = groups.map((g, i) => ({ key: g.key, label: g.label, style: styles[i] }))
    .concat([{ key: '_all', label: 'All respondents', style: { stroke: 'var(--color-text)', fill: 'none', dash: '', marker: 'cross' } }])
  const legH = legendHeight(items, width - 20)
  const rowH = 42
  const m = { top: 10, right: 20, bottom: 30 + legH + 8, left: Math.min(160, 14 + Math.max(...rows.map(r => r.label.length)) * 7) }
  const H = m.top + m.bottom + rows.length * rowH
  const x = scaleLinear().domain(domain).range([m.left, width - m.right]).nice()
  const yb = scaleBand().domain(rows.map(r => r.key)).range([m.top, H - m.bottom]).padding(0.2)
  const font = printMode ? PRINT_FONT : 'var(--font-body)'

  function showTip(e, r) {
    const box = e.currentTarget.ownerSVGElement.getBoundingClientRect()
    setTip({
      x: e.clientX - box.left, y: e.clientY - box.top, title: r.label,
      rows: groups.map((g, i) => {
        const v = get(r.key, g.key)
        return { name: g.label, color: printMode ? styles[i].fill : g.color,
                 value: v && v.n >= minN ? `${format(v.value)} (n=${v.n.toLocaleString('en-US')})` : v ? `n=${v.n} — too few` : '—' }
      }),
    })
  }

  return (
    <div ref={wrapRef} className="chart-svg-wrap" onMouseLeave={() => setTip(null)}>
      <svg ref={svgRef} width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={ariaLabel} style={{ fontFamily: font }}>
        {x.ticks(6).map(t => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={m.top} y2={H - m.bottom} stroke={AXIS.grid} strokeDasharray="3 3" />
            <text x={x(t)} y={H - m.bottom + 16} textAnchor="middle" {...AXIS.tick} fontFamily={printMode ? PRINT_FONT : 'var(--font-mono)'}>{format(t, true)}</text>
          </g>
        ))}
        {rows.map(r => {
          const cy = yb(r.key) + yb.bandwidth() / 2
          const vals = groups.map(g => get(r.key, g.key)).filter(v => v && v.n >= minN)
          const all = overall?.(r.key)
          return (
            <g key={r.key}>
              <rect x={0} y={yb(r.key) - 2} width={width} height={yb.bandwidth() + 4} fill="transparent" onMouseMove={e => showTip(e, r)} />
              <text x={m.left - 10} y={cy + 4} textAnchor="end" fontSize={12.5} fill="var(--color-text-secondary)">{r.label}</text>
              {vals.length > 1 && (
                <line x1={x(Math.min(...vals.map(v => v.value)))} x2={x(Math.max(...vals.map(v => v.value)))} y1={cy} y2={cy}
                      stroke="var(--color-border)" strokeWidth={3} strokeLinecap="round" pointerEvents="none" />
              )}
              {all != null && <Marker shape="cross" x={x(all)} y={cy} r={4.5} stroke="var(--color-text)" strokeWidth={1.3} pointerEvents="none" />}
              {groups.map((g, gi) => {
                const v = get(r.key, g.key)
                if (!v || v.n < minN) return null
                const st = styles[gi]
                return (
                  <g key={g.key} pointerEvents="none">
                    {showCI && v.se != null && (
                      <line x1={x(Math.max(domain[0], v.value - 1.96 * v.se))} x2={x(Math.min(domain[1], v.value + 1.96 * v.se))}
                            y1={cy} y2={cy} stroke={st.stroke} strokeWidth={1.5} opacity={0.6} />
                    )}
                    <Marker shape={st.marker} x={x(v.value)} y={cy} r={6.5} fill={st.fill}
                            stroke={printMode ? '#000' : 'var(--color-bg-raised)'} strokeWidth={1.2} />
                  </g>
                )
              })}
            </g>
          )
        })}
        <SvgLegend items={items} width={width - 20} y={H - legH + 4} printMode={printMode} uid={uid} kind="dot" />
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  )
}
