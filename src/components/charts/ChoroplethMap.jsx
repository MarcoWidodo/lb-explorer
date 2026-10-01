import { useMemo, useState } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import { scaleSequential } from 'd3-scale'
import { interpolateYlOrRd, interpolateBlues, interpolateRdYlBu, interpolateGreys, interpolateViridis } from 'd3-scale-chromatic'
import { useWidth, useUid } from './useWidth'
import { PRINT_FONT } from './theme'
import Tooltip from './Tooltip'

export const COLOR_SCHEMES = {
  'Yellow → Red': interpolateYlOrRd,
  'Blues': interpolateBlues,
  'Viridis': interpolateViridis,
  'Diverging (Red → Blue)': interpolateRdYlBu,
}

/**
 * Choropleth of one value per country.
 * geo: TopoJSON (region-50m.json). values: { ISO2: { value, se, n } }. isoByNumeric: { '392': 'JP', … }
 */
export default function ChoroplethMap({ geo, values, isoByNumeric, countryName, scheme, flipped, format, legendTitle, printMode, svgRef, ariaLabel }) {
  const [wrapRef, width] = useWidth()
  const uid = useUid('map')
  const [tip, setTip] = useState(null)
  const height = Math.round(width * 0.62)
  const legendH = 54

  const features = useMemo(() => (geo ? feature(geo, geo.objects.countries).features : []), [geo])
  const surveyed = useMemo(() => features.filter(f => isoByNumeric[f.id]), [features, isoByNumeric])

  const { path, projection } = useMemo(() => {
    const proj = geoMercator()
    if (surveyed.length) proj.fitExtent([[12, 12], [width - 12, height - 12]], { type: 'FeatureCollection', features: surveyed })
    proj.clipExtent([[0, 0], [width, height]])
    return { projection: proj, path: geoPath(proj) }
  }, [surveyed, width, height])

  const vals = Object.values(values).map(v => v?.value).filter(v => v != null)
  const lo = vals.length ? Math.min(...vals) : 0
  const hi = vals.length ? Math.max(...vals) : 1
  const domain = lo === hi ? [lo - 0.5, hi + 0.5] : [lo, hi]
  const interp = printMode ? interpolateGreys : (COLOR_SCHEMES[scheme] || interpolateYlOrRd)
  const color = scaleSequential(interp).domain(flipped ? [domain[1], domain[0]] : domain)
  const font = printMode ? PRINT_FONT : 'var(--font-body)'

  function hover(e, iso) {
    const box = e.currentTarget.ownerSVGElement.getBoundingClientRect()
    const v = values[iso]
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, title: countryName(iso),
             rows: v ? [{ name: 'Value', value: format(v.value) },
                        ...(v.se != null ? [{ name: '95% CI', value: `${format(v.value - 1.96 * v.se)} – ${format(v.value + 1.96 * v.se)}` }] : []),
                        { name: 'N', value: v.n?.toLocaleString('en-US') }]
                      : [{ name: 'Not asked in this wave', value: '' }] })
  }

  const gradId = `${uid}-grad`
  const stops = Array.from({ length: 11 }, (_, i) => i / 10)
  const H = height + legendH

  return (
    <div ref={wrapRef} className="chart-svg-wrap map-svg-wrap" onMouseLeave={() => setTip(null)}>
      <svg ref={svgRef} width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={ariaLabel} style={{ fontFamily: font, overflow: 'hidden' }}>
        <defs>
          <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
            {stops.map(t => <stop key={t} offset={`${t * 100}%`} stopColor={color(domain[0] + t * (domain[1] - domain[0]))} />)}
          </linearGradient>
        </defs>
        <rect width={width} height={height} rx={printMode ? 0 : 10} fill={printMode ? '#FFFFFF' : 'var(--color-bg-subtle)'} />
        {features.map((f, fi) => {
          const iso = isoByNumeric[f.id]
          const v = iso ? values[iso] : null
          const d = path(f)
          if (!d) return null
          const fill = !iso ? (printMode ? '#F2F2F2' : 'var(--color-bg-muted)')
            : v?.value != null ? color(v.value) : (printMode ? '#FFFFFF' : 'var(--color-bg-raised)')
          return (
            <path key={`${f.id}-${fi}`} d={d} fill={fill}
                  stroke={iso ? (printMode ? '#000' : 'var(--color-bg-raised)') : (printMode ? '#BFBFBF' : 'var(--color-border)')}
                  strokeWidth={iso ? 0.8 : 0.3}
                  onMouseMove={iso ? e => hover(e, iso) : undefined} style={{ cursor: iso ? 'pointer' : 'default' }} />
          )
        })}
        {/* small territories (Singapore, Hong Kong) get a visible marker */}
        {surveyed.map((f, fi) => {
          const iso = isoByNumeric[f.id]
          const area = (g) => { const [[x0, y0], [x1, y1]] = path.bounds(g); return (x1 - x0) * (y1 - y0) }
          // only for territories too small to see, and only once per country (Australia also owns
          // the Ashmore and Cartier Islands, which share its code)
          if (area(f) > 60 || surveyed.some((g, gi) => gi !== fi && isoByNumeric[g.id] === iso && area(g) > area(f))) return null
          const [cx, cy] = projection(geoCentroidSafe(f))
          const v = values[iso]
          return (
            <g key={`dot-${iso}`} onMouseMove={e => hover(e, iso)} style={{ cursor: 'pointer' }}>
              <circle cx={cx} cy={cy} r={6} fill={v?.value != null ? color(v.value) : 'var(--color-bg-raised)'}
                      stroke={printMode ? '#000' : 'var(--color-text-secondary)'} strokeWidth={1} />
              <text x={cx + 9} y={cy + 4} fontSize={10} fill="var(--color-text-secondary)" fontFamily={printMode ? PRINT_FONT : 'var(--font-mono)'}>{iso}</text>
            </g>
          )
        })}
        {/* legend */}
        {vals.length > 0 && (
          <g transform={`translate(${Math.max(12, width / 2 - 170)}, ${height + 14})`}>
            <text x={0} y={-2} fontSize={11} fill="var(--color-text-secondary)">{legendTitle}</text>
            <rect x={354} y={6} width={10} height={10} fill={printMode ? '#FFFFFF' : 'var(--color-bg-raised)'} stroke="var(--color-text-tertiary)" strokeWidth={0.6} />
            <text x={369} y={15} fontSize={10.5} fill="var(--color-text-tertiary)">not surveyed or not asked</text>
            <rect x={0} y={6} width={340} height={10} fill={`url(#${gradId})`} stroke={printMode ? '#000' : 'none'} strokeWidth={0.5} />
            {[0, 0.5, 1].map(t => (
              <text key={t} x={t * 340} y={30} fontSize={10.5} textAnchor={t === 0 ? 'start' : t === 1 ? 'end' : 'middle'}
                    fill="var(--color-text-tertiary)" fontFamily={printMode ? PRINT_FONT : 'var(--font-mono)'}>
                {format(domain[0] + t * (domain[1] - domain[0]))}
              </text>
            ))}
          </g>
        )}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  )
}

// Centroid of the largest polygon (so a country's marker lands on its main territory)
function geoCentroidSafe(f) {
  const g = f.geometry
  const ring = g.type === 'Polygon' ? g.coordinates[0]
    : g.coordinates.reduce((a, p) => (p[0].length > a.length ? p[0] : a), [])
  const n = ring.length || 1
  return [ring.reduce((s, c) => s + c[0], 0) / n, ring.reduce((s, c) => s + c[1], 0) / n]
}
