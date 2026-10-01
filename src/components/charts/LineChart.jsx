import { useMemo, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { line as d3line } from 'd3-shape'
import { useWidth, useUid } from './useWidth'
import { seriesStyle, Marker, SvgLegend, legendHeight, AXIS, PRINT_FONT } from './theme'
import Tooltip from './Tooltip'

/**
 * Time-series chart on a real year axis.
 * series: [{ key, label, color, bold, points: [{ x, y, se, n, wave, waveIdx, note }] }]
 *   - x is the fieldwork year; waveIdx is the position of the wave in the item's wave list,
 *     used to break the line where a series skips a wave (no interpolation).
 * bands: [{ label, x0, x1 }] wave spans drawn along the top.
 */
export default function LineChart({
  series, yDomain, yFormat, valueFormat, bands = [], showCI, printMode, svgRef, ariaLabel, height = 400,
}) {
  const [wrapRef, width] = useWidth()
  const uid = useUid('line')
  const [tip, setTip] = useState(null)

  const styles = series.map((s, i) => (s.bold && !printMode)
    ? { stroke: 'var(--color-text)', fill: 'var(--color-text)', dash: '6 3', marker: 'diamond' }
    : seriesStyle(i, s.color, printMode))
  const legendItems = series.map((s, i) => ({ key: s.key, label: s.label, style: styles[i], bold: s.bold }))
  const legH = legendHeight(legendItems, width - 20)

  const allX = series.flatMap(s => s.points.map(p => p.x)).concat(bands.flatMap(b => [b.x0, b.x1]))
  const x0 = allX.length ? Math.min(...allX) - 0.8 : 2000
  const x1 = allX.length ? Math.max(...allX) + 0.8 : 2024
  const m = { top: bands.length ? 34 : 14, right: 18, bottom: 34 + legH + 8, left: 50 }
  const H = height + legH
  const x = scaleLinear().domain([x0, x1]).range([m.left, width - m.right])
  const y = scaleLinear().domain(yDomain).range([H - m.bottom, m.top]).nice()
  const xticks = x.ticks(Math.min(12, Math.floor(width / 70))).filter(t => Number.isInteger(t))
  const yticks = y.ticks(6)
  const font = printMode ? PRINT_FONT : 'var(--font-body)'

  const segments = useMemo(() => series.map(s => {
    const pts = [...s.points].sort((a, b) => a.waveIdx - b.waveIdx)
    const segs = []
    let cur = []
    pts.forEach((p, i) => {
      if (i > 0 && p.waveIdx !== pts[i - 1].waveIdx + 1) { segs.push(cur); cur = [] }
      cur.push(p)
    })
    if (cur.length) segs.push(cur)
    return segs
  }), [series])

  const path = d3line().x(p => x(p.x)).y(p => y(p.y))

  function onMove(e) {
    const box = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - box.left, my = e.clientY - box.top
    let best = null, bd = 900
    series.forEach((s, si) => s.points.forEach(p => {
      const d = (x(p.x) - mx) ** 2 + (y(p.y) - my) ** 2
      if (d < bd) { bd = d; best = { s, si, p } }
    }))
    if (!best) { setTip(null); return }
    const { s, si, p } = best
    setTip({
      x: x(p.x), y: y(p.y), title: s.label,
      subtitle: `${p.waveLabel ?? ''}${p.x ? ` · fieldwork ${p.yearLabel ?? p.x}` : ''}`,
      rows: [
        { name: 'Value', value: valueFormat(p.y), color: printMode ? styles[si].stroke : s.color },
        ...(p.se != null ? [{ name: '95% CI', value: `${valueFormat(p.y - 1.96 * p.se)} – ${valueFormat(p.y + 1.96 * p.se)}` }] : []),
        ...(p.n != null ? [{ name: p.nLabel || 'N', value: p.n.toLocaleString('en-US') }] : []),
      ],
      foot: p.note,
    })
  }

  return (
    <div ref={wrapRef} className="chart-svg-wrap" onMouseLeave={() => setTip(null)}>
      <svg ref={svgRef} width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={ariaLabel}
           style={{ fontFamily: font }} onMouseMove={onMove}>
        {/* wave bands */}
        {bands.map((b, i) => (
          <g key={b.label}>
            <rect x={x(b.x0 - 0.35)} width={Math.max(4, x(b.x1 + 0.35) - x(b.x0 - 0.35))} y={m.top - 22} height={H - m.bottom - m.top + 22}
                  fill={i % 2 ? 'transparent' : 'var(--color-bg-subtle)'} opacity={printMode ? 0 : 0.55} />
            <text x={(x(b.x0) + x(b.x1)) / 2} y={m.top - 9} textAnchor="middle" fontSize={11} fontWeight={600}
                  fill="var(--color-text-tertiary)" fontFamily={printMode ? PRINT_FONT : 'var(--font-mono)'}>{b.label}</text>
          </g>
        ))}
        {yticks.map(t => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={AXIS.grid} strokeDasharray="3 3" />
            <text x={m.left - 8} y={y(t) + 4} textAnchor="end" {...AXIS.tick} fontFamily={printMode ? PRINT_FONT : 'var(--font-mono)'}>{yFormat(t)}</text>
          </g>
        ))}
        {xticks.map(t => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={H - m.bottom} y2={H - m.bottom + 5} stroke="var(--color-text-tertiary)" />
            <text x={x(t)} y={H - m.bottom + 18} textAnchor="middle" {...AXIS.tick} fontFamily={printMode ? PRINT_FONT : 'var(--font-mono)'}>{t}</text>
          </g>
        ))}
        <line x1={m.left} x2={width - m.right} y1={H - m.bottom} y2={H - m.bottom} stroke="var(--color-text-tertiary)" />
        {/* series */}
        {series.map((s, si) => {
          const st = styles[si]
          return (
            <g key={s.key}>
              {showCI && s.points.map((p, i) => p.se != null && (
                <line key={`ci${i}`} x1={x(p.x)} x2={x(p.x)} y1={y(Math.max(yDomain[0], p.y - 1.96 * p.se))} y2={y(Math.min(yDomain[1], p.y + 1.96 * p.se))}
                      stroke={st.stroke} strokeWidth={s.bold ? 2 : 1.4} opacity={0.55} />
              ))}
              {segments[si].map((seg, k) => seg.length > 1 && (
                <path key={k} d={path(seg)} fill="none" stroke={st.stroke} strokeWidth={s.bold ? 3 : 2.2}
                      strokeDasharray={st.dash} strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {s.points.map((p, i) => (
                <Marker key={i} shape={st.marker} x={x(p.x)} y={y(p.y)} r={s.bold ? 4.5 : 3.8}
                        fill={printMode ? '#FFFFFF' : 'var(--color-bg-raised)'} stroke={st.stroke} strokeWidth={2} />
              ))}
            </g>
          )
        })}
        <SvgLegend items={legendItems} width={width - 20} y={H - legH + 4} printMode={printMode} uid={uid} kind="line" />
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  )
}
