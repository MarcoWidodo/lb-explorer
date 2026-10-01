import { useMemo, useState } from 'react'
import { scaleBand, scaleLinear } from 'd3-scale'
import { useWidth, useUid } from './useWidth'
import { seriesStyle, barFill, PatternDefs, SvgLegend, legendHeight, wrapText, AXIS, PRINT_FONT } from './theme'
import Tooltip from './Tooltip'

/**
 * Grouped bar chart of response distributions.
 * categories: [{ key, label, muted }]   series: [{ key, label, color }]
 * get(seriesKey, catKey) → { value, count } | null   (value in %)
 */
export default function BarChart({ categories, series, get, printMode, svgRef, fmt = v => `${v.toFixed(1)}%`, ariaLabel }) {
  const [wrapRef, width] = useWidth()
  const uid = useUid('bar')
  const [tip, setTip] = useState(null)

  const longest = Math.max(...categories.map(c => c.label.length), 1)
  const horizontal = categories.length > 8 || (longest > 32 && categories.length > 5)
  const styles = series.map((s, i) => seriesStyle(i, s.color, printMode))
  const legendItems = series.map((s, i) => ({ key: s.key, label: s.label, style: styles[i] }))
  const legH = legendHeight(legendItems, width - 20)

  const maxV = useMemo(() => {
    let m = 0
    for (const s of series) for (const c of categories) m = Math.max(m, get(s.key, c.key)?.value ?? 0)
    return m
  }, [series, categories, get])
  const yMax = Math.min(100, Math.max(10, Math.ceil((maxV * 1.08) / 10) * 10))

  const catLines = categories.map(c => wrapText(c.label, horizontal ? 30 : Math.max(10, Math.floor(width / categories.length / 7))))
  const labelLines = Math.min(3, Math.max(...catLines.map(l => l.length)))

  let height, m, x, y, inner
  if (!horizontal) {
    m = { top: 12, right: 12, bottom: 16 + labelLines * 14 + legH + 14, left: 44 }
    height = 360 + labelLines * 14 + legH
    x = scaleBand().domain(categories.map(c => c.key)).range([m.left, width - m.right]).paddingInner(0.22).paddingOuter(0.08)
    inner = scaleBand().domain(series.map(s => s.key)).range([0, x.bandwidth()]).padding(0.08)
    y = scaleLinear().domain([0, yMax]).range([height - m.bottom, m.top])
  } else {
    const rowH = Math.max(18, series.length * 12 + 10)
    m = { top: 8, right: 16, bottom: 34 + legH, left: Math.min(230, 12 + Math.min(30, longest) * 6.4) }
    height = m.top + m.bottom + categories.length * rowH
    y = scaleBand().domain(categories.map(c => c.key)).range([m.top, height - m.bottom]).paddingInner(0.2)
    inner = scaleBand().domain(series.map(s => s.key)).range([0, y.bandwidth()]).padding(0.06)
    x = scaleLinear().domain([0, yMax]).range([m.left, width - m.right])
  }
  const ticks = (horizontal ? x : y).ticks(5)
  const font = printMode ? PRINT_FONT : 'var(--font-body)'

  function showTip(e, c) {
    const box = e.currentTarget.ownerSVGElement.getBoundingClientRect()
    setTip({
      x: e.clientX - box.left, y: e.clientY - box.top, title: c.label,
      rows: series.map((s, i) => {
        const v = get(s.key, c.key)
        return { name: s.label, color: printMode ? styles[i].fill : s.color, value: v ? fmt(v.value) + (v.count != null ? ` (n=${v.count.toLocaleString('en-US')})` : '') : '—' }
      }),
    })
  }

  return (
    <div ref={wrapRef} className="chart-svg-wrap" onMouseLeave={() => setTip(null)}>
      <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
           aria-label={ariaLabel} style={{ fontFamily: font }} data-print={printMode ? '1' : '0'}>
        <PatternDefs uid={uid} />
        {/* grid + value axis */}
        {ticks.map(t => horizontal ? (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={m.top} y2={height - m.bottom} stroke={AXIS.grid} strokeDasharray="3 3" />
            <text x={x(t)} y={height - m.bottom + 14} textAnchor="middle" {...AXIS.tick} fontFamily="var(--font-mono)">{t}%</text>
          </g>
        ) : (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={AXIS.grid} strokeDasharray="3 3" />
            <text x={m.left - 8} y={y(t) + 4} textAnchor="end" {...AXIS.tick} fontFamily="var(--font-mono)">{t}%</text>
          </g>
        ))}
        {/* bars */}
        {categories.map((c, ci) => (
          <g key={c.key} opacity={c.muted ? 0.55 : 1}>
            <rect className="bar-hit" x={horizontal ? m.left : x(c.key)} y={horizontal ? y(c.key) : m.top}
                  width={horizontal ? width - m.left - m.right : x.bandwidth()} height={horizontal ? y.bandwidth() : height - m.top - m.bottom}
                  fill="transparent" onMouseMove={e => showTip(e, c)} />
            {series.map((s, si) => {
              const v = get(s.key, c.key)?.value
              if (v == null) return null
              const st = styles[si]
              const common = { fill: barFill(st, uid, printMode), stroke: printMode ? '#000' : 'none', strokeWidth: printMode ? 0.6 : 0, pointerEvents: 'none' }
              return horizontal
                ? <rect key={s.key} x={x(0)} y={y(c.key) + inner(s.key)} width={Math.max(0, x(v) - x(0))} height={inner.bandwidth()} rx={printMode ? 0 : 2} {...common} />
                : <rect key={s.key} x={x(c.key) + inner(s.key)} y={y(v)} width={inner.bandwidth()} height={Math.max(0, y(0) - y(v))} rx={printMode ? 0 : 2} {...common} />
            })}
            {/* category labels */}
            {catLines[ci].slice(0, 3).map((ln, li) => horizontal ? (
              <text key={li} x={m.left - 8} y={y(c.key) + y.bandwidth() / 2 + 4 + (li - (Math.min(3, catLines[ci].length) - 1) / 2) * 13}
                    textAnchor="end" fontSize={12} fill="var(--color-text-secondary)">{ln}</text>
            ) : (
              <text key={li} x={x(c.key) + x.bandwidth() / 2} y={height - m.bottom + 16 + li * 14}
                    textAnchor="middle" fontSize={12} fill="var(--color-text-secondary)">{ln}</text>
            ))}
          </g>
        ))}
        <line x1={m.left} x2={horizontal ? m.left : width - m.right} y1={horizontal ? m.top : y(0)} y2={horizontal ? height - m.bottom : y(0)}
              stroke="var(--color-text-tertiary)" strokeWidth={1} />
        <SvgLegend items={legendItems} width={width - 20} y={height - legH + 6} printMode={printMode} uid={uid} kind="bar" />
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  )
}
