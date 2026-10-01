import { useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { useWidth, useUid } from './useWidth'
import { Marker, AXIS, PRINT_FONT, wrapText } from './theme'
import Tooltip from './Tooltip'

/**
 * Country-level scatter plot with an OLS line.
 * points: [{ key, label, x, y, color, nx, ny }]
 */
export default function ScatterChart({ points, fit, xTitle, yTitle, xFormat, yFormat, printMode, svgRef, ariaLabel, height = 440 }) {
  const [wrapRef, width] = useWidth()
  const [tip, setTip] = useState(null)
  const uid = useUid('sc')
  const xl = wrapText(xTitle, Math.floor(width / 7.2)).slice(0, 2)
  const yl = wrapText(yTitle, Math.floor(height / 7.2)).slice(0, 2)
  const m = { top: 20, right: 24, bottom: 44 + xl.length * 14, left: 58 + yl.length * 14 }
  const pad = (a, b) => { const d = (b - a) * 0.12 || 0.5; return [a - d, b + d] }
  const xs = points.map(p => p.x), ys = points.map(p => p.y)
  const x = scaleLinear().domain(pad(Math.min(...xs), Math.max(...xs))).range([m.left, width - m.right]).nice()
  const y = scaleLinear().domain(pad(Math.min(...ys), Math.max(...ys))).range([height - m.bottom, m.top]).nice()
  const font = printMode ? PRINT_FONT : 'var(--font-body)'
  const mono = printMode ? PRINT_FONT : 'var(--font-mono)'
  const [dx0, dx1] = x.domain()

  return (
    <div ref={wrapRef} className="chart-svg-wrap" onMouseLeave={() => setTip(null)}>
      <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} style={{ fontFamily: font }}>
        <defs><clipPath id={`${uid}-clip`}><rect x={m.left} y={m.top} width={width - m.left - m.right} height={height - m.top - m.bottom} /></clipPath></defs>
        {y.ticks(6).map(t => (
          <g key={`y${t}`}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={AXIS.grid} strokeDasharray="3 3" />
            <text x={m.left - 8} y={y(t) + 4} textAnchor="end" {...AXIS.tick} fontFamily={mono}>{yFormat(t)}</text>
          </g>
        ))}
        {x.ticks(7).map(t => (
          <g key={`x${t}`}>
            <line x1={x(t)} x2={x(t)} y1={m.top} y2={height - m.bottom} stroke={AXIS.grid} strokeDasharray="3 3" />
            <text x={x(t)} y={height - m.bottom + 16} textAnchor="middle" {...AXIS.tick} fontFamily={mono}>{xFormat(t)}</text>
          </g>
        ))}
        {xl.map((ln, i) => (
          <text key={i} x={(m.left + width - m.right) / 2} y={height - m.bottom + 34 + i * 14} textAnchor="middle" {...AXIS.label}>{ln}</text>
        ))}
        {yl.map((ln, i) => (
          <text key={i} transform={`translate(${14 + i * 14}, ${(m.top + height - m.bottom) / 2}) rotate(-90)`} textAnchor="middle" {...AXIS.label}>{ln}</text>
        ))}
        {fit && (
          <line x1={x(dx0)} x2={x(dx1)} y1={y(fit.intercept + fit.slope * dx0)} y2={y(fit.intercept + fit.slope * dx1)}
                stroke={printMode ? '#000' : 'var(--color-accent)'} strokeWidth={1.5} strokeDasharray="6 4" clipPath={`url(#${uid}-clip)`} />
        )}
        {points.map(p => (
          <g key={p.key} onMouseMove={e => {
            const box = e.currentTarget.ownerSVGElement.getBoundingClientRect()
            setTip({ x: e.clientX - box.left, y: e.clientY - box.top, title: p.label,
                     rows: [{ name: 'X', value: xFormat(p.x, true) + (p.nx ? ` (n=${p.nx.toLocaleString('en-US')})` : '') },
                            { name: 'Y', value: yFormat(p.y, true) + (p.ny ? ` (n=${p.ny.toLocaleString('en-US')})` : '') }] })
          }}>
            <Marker x={x(p.x)} y={y(p.y)} r={7} fill={printMode ? '#595959' : p.color} stroke={printMode ? '#000' : 'var(--color-bg-raised)'} strokeWidth={2} />
            <text x={x(p.x)} y={y(p.y) - 12} textAnchor="middle" fontSize={11} fontWeight={600} fontFamily={mono} fill="var(--color-text-secondary)">{p.key}</text>
          </g>
        ))}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  )
}
