import { useRef, useEffect, useMemo } from 'react'
import { scaleLinear, scaleDiverging } from 'd3-scale'
import { interpolateRdBu } from 'd3-scale-chromatic'
import { arc } from 'd3-shape'
import { select } from 'd3-selection'
import { easeCubicOut } from 'd3-ease'
import { interpolate } from 'd3-interpolate'
import 'd3-transition' // side-effect import to add .transition() to selections

/* ── Formatters ── */

function fmtR(r) {
  if (r == null) return '—'
  return r.toFixed(3)
}

function fmtP(p) {
  if (p == null) return '—'
  if (p < 0.001) return '< 0.001'
  return p.toFixed(3)
}

function sigLabel(p) {
  if (p == null) return { stars: '', text: 'no data' }
  if (p < 0.001) return { stars: '★★★', text: 'p < 0.001' }
  if (p < 0.01) return { stars: '★★', text: 'p < 0.01' }
  if (p < 0.05) return { stars: '★', text: 'p < 0.05' }
  return { stars: 'n.s.', text: 'not significant' }
}

/* ── Color for r value: blue (+) ↔ neutral (0) ↔ red (-) ── */

function rColor(r) {
  if (r == null) return 'var(--color-text-tertiary)'
  // Diverging: negative → warm red, positive → cool blue
  const scale = scaleDiverging()
    .domain([-1, 0, 1])
    .interpolator(interpolateRdBu)
  return scale(r)
}

/* ── SVG Arc Gauge ── */

function ArcGauge({ r, width = 240, height = 175 }) {
  const pathRef = useRef(null)
  const needleRef = useRef(null)
  const cx = width / 2
  const cy = height - 22
  const outerR = Math.min(cx - 20, cy - 20)
  const innerR = outerR - 14
  const trackR = outerR - 7

  // Angle scale: r ∈ [-1, 1] → angle ∈ [-π/2, π/2] (left to right semicircle)
  const angleScale = useMemo(() =>
    scaleLinear().domain([-1, 1]).range([-Math.PI / 2, Math.PI / 2]),
    []
  )

  const arcGen = useMemo(() =>
    arc()
      .innerRadius(innerR)
      .outerRadius(outerR)
      .startAngle(-Math.PI / 2)
      .cornerRadius(3),
    [innerR, outerR]
  )

  // Animate arc fill on r change
  useEffect(() => {
    if (!pathRef.current || r == null) return

    const target = angleScale(Math.max(-1, Math.min(1, r)))

    select(pathRef.current)
      .transition()
      .duration(900)
      .ease(easeCubicOut)
      .attrTween('d', function () {
        const prev = this._current ?? -Math.PI / 2
        const interp = interpolate(prev, target)
        return t => {
          this._current = interp(t)
          return arcGen({ endAngle: interp(t) })
        }
      })
  }, [r, angleScale, arcGen])

  // Animate needle rotation
  useEffect(() => {
    if (!needleRef.current || r == null) return

    const angleDeg = (angleScale(Math.max(-1, Math.min(1, r))) * 180) / Math.PI

    select(needleRef.current)
      .transition()
      .duration(900)
      .ease(easeCubicOut)
      .attr('transform', `rotate(${angleDeg} ${cx} ${cy})`)
  }, [r, angleScale, cx, cy])

  // Track tick marks
  const ticks = [-1, -0.5, 0, 0.5, 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Background track */}
      <path
        d={arc()
          .innerRadius(innerR - 1)
          .outerRadius(outerR + 1)
          .startAngle(-Math.PI / 2)
          .endAngle(Math.PI / 2)
          .cornerRadius(4)()
        }
        transform={`translate(${cx}, ${cy})`}
        fill="var(--color-bg-muted)"
      />

      {/* Colored fill arc */}
      <path
        ref={pathRef}
        transform={`translate(${cx}, ${cy})`}
        fill={rColor(r)}
        d={arcGen({ endAngle: -Math.PI / 2 })}
      />

      {/* Tick marks and labels */}
      {ticks.map(v => {
        const angle = angleScale(v)
        const labelR = outerR + 14
        const x = cx + Math.cos(angle - Math.PI / 2) * labelR
        const y = cy + Math.sin(angle - Math.PI / 2) * labelR
        const tickInner = outerR + 2
        const tickOuter = outerR + 6
        const x1 = cx + Math.cos(angle - Math.PI / 2) * tickInner
        const y1 = cy + Math.sin(angle - Math.PI / 2) * tickInner
        const x2 = cx + Math.cos(angle - Math.PI / 2) * tickOuter
        const y2 = cy + Math.sin(angle - Math.PI / 2) * tickOuter

        return (
          <g key={v}>
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="var(--color-text-tertiary)"
              strokeWidth={1}
            />
            <text
              x={x} y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fontFamily="var(--font-mono)"
              fill="var(--color-text-tertiary)"
            >
              {v > 0 ? `+${v}` : v}
            </text>
          </g>
        )
      })}

      {/* Needle */}
      <g ref={needleRef} transform={`rotate(-90 ${cx} ${cy})`}>
        <line
          x1={cx} y1={cy}
          x2={cx} y2={cy - trackR + 4}
          stroke="var(--color-text)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={4} fill="var(--color-text)" />
      </g>
    </svg>
  )
}

/* ── Gradient Bar with sliding indicator ── */

function GradientBar({ r }) {
  const pct = r != null ? ((r + 1) / 2) * 100 : 50

  return (
    <div className="corr-gradient-bar-wrap">
      <div className="corr-gradient-bar">
        <div
          className="corr-gradient-indicator"
          style={{
            left: `${pct}%`,
            transition: 'left 0.8s cubic-bezier(0.25, 0.4, 0.25, 1)',
          }}
        />
      </div>
      <div className="corr-gradient-labels">
        <span>−1</span>
        <span>0</span>
        <span>+1</span>
      </div>
    </div>
  )
}

/* ── Main CorrelationGauge component ── */

export default function CorrelationGauge({
  r,
  p,
  n,
  varA,
  varB,
  varALabel,
  varBLabel,
  countryName,
}) {
  const sig = sigLabel(p)
  const hasData = r != null

  return (
    <div className="corr-gauge-wrap">
      {/* Arc gauge */}
      <div className="corr-gauge-arc">
        {hasData ? (
          <ArcGauge r={r} />
        ) : (
          <div className="corr-gauge-empty">
            <span>No data for this pair</span>
          </div>
        )}
      </div>

      {/* r value display */}
      <div className="corr-gauge-value-row">
        <span className="corr-gauge-r" style={{ color: rColor(r) }}>
          {fmtR(r)}
        </span>
        <span className="corr-gauge-r-label">Pearson r</span>
      </div>

      {/* Gradient bar */}
      {hasData && <GradientBar r={r} />}

      {/* Stats row */}
      {hasData && (
        <div className="corr-gauge-stats">
          <div className="corr-gauge-stat">
            <span className="corr-gauge-stat-val">{fmtP(p)}</span>
            <span className="corr-gauge-stat-key">p-value</span>
          </div>
          <div className="corr-gauge-stat corr-gauge-sig">
            <span className="corr-gauge-stat-val">{sig.stars}</span>
            <span className="corr-gauge-stat-key">{sig.text}</span>
          </div>
          <div className="corr-gauge-stat">
            <span className="corr-gauge-stat-val">{n?.toLocaleString()}</span>
            <span className="corr-gauge-stat-key">observations</span>
          </div>
        </div>
      )}

      {/* Variable labels */}
      <div className="corr-gauge-vars">
        <div className="corr-gauge-var">
          <span className="corr-gauge-var-tag">X</span>
          <span className="corr-gauge-var-name">{varA}</span>
          <span className="corr-gauge-var-desc">{varALabel}</span>
        </div>
        <div className="corr-gauge-var">
          <span className="corr-gauge-var-tag">Y</span>
          <span className="corr-gauge-var-name">{varB}</span>
          <span className="corr-gauge-var-desc">{varBLabel}</span>
        </div>
      </div>
    </div>
  )
}
