/* ─────────────────────────────────────────────────────────────
   Shared chart styling. Screen style uses the country colour tokens;
   print style follows the project's greyscale slide conventions
   (Larry RA/Slides in greyscale.xlsx): series are told apart by line type
   and marker shape as well as shade, bars by solid grey vs. hatching.
   ───────────────────────────────────────────────────────────── */

export const PRINT_FONT = 'Arial, Helvetica, sans-serif'

// Greys from black to mid-grey; line types; marker shapes. Index = series order.
const PRINT_GREYS = ['#000000', '#595959', '#8C8C8C', '#262626', '#737373', '#A6A6A6']
const PRINT_DASHES = ['', '6 4', '2 3', '10 3 2 3', '', '6 4']
const PRINT_MARKERS = ['circle', 'square', 'triangle', 'diamond', 'triangleDown', 'cross']
const PRINT_FILLS = ['solid-dark', 'hatch', 'solid-light', 'crosshatch', 'dots', 'white']

const SCREEN_MARKERS = ['circle', 'circle', 'circle', 'circle', 'circle', 'circle']

export function seriesStyle(i, color, printMode) {
  if (!printMode) {
    return { stroke: color, fill: color, dash: '', marker: SCREEN_MARKERS[i % 6], pattern: null }
  }
  const k = i % 6
  const grey = PRINT_GREYS[k]
  return { stroke: grey, fill: grey, dash: PRINT_DASHES[k], marker: PRINT_MARKERS[k], pattern: PRINT_FILLS[k] }
}

/** <defs> with the print-style bar fills. `uid` keeps ids unique per chart. */
export function PatternDefs({ uid }) {
  return (
    <defs>
      <pattern id={`${uid}-hatch`} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="#FFFFFF" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="#595959" strokeWidth="2" />
      </pattern>
      <pattern id={`${uid}-crosshatch`} patternUnits="userSpaceOnUse" width="6" height="6">
        <rect width="6" height="6" fill="#FFFFFF" />
        <path d="M0 0 L6 6 M6 0 L0 6" stroke="#262626" strokeWidth="1" />
      </pattern>
      <pattern id={`${uid}-dots`} patternUnits="userSpaceOnUse" width="5" height="5">
        <rect width="5" height="5" fill="#FFFFFF" />
        <circle cx="2.5" cy="2.5" r="1.1" fill="#262626" />
      </pattern>
    </defs>
  )
}

export function barFill(style, uid, printMode) {
  if (!printMode) return style.fill
  switch (style.pattern) {
    case 'solid-dark': return '#7F7F7F'
    case 'solid-light': return '#D9D9D9'
    case 'hatch': return `url(#${uid}-hatch)`
    case 'crosshatch': return `url(#${uid}-crosshatch)`
    case 'dots': return `url(#${uid}-dots)`
    default: return '#FFFFFF'
  }
}

/** SVG marker shape centred on (x, y). */
export function Marker({ shape = 'circle', x, y, r = 4, fill, stroke, strokeWidth = 1.5, ...rest }) {
  switch (shape) {
    case 'square':
      return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...rest} />
    case 'triangle':
      return <path d={`M${x},${y - r * 1.2} L${x + r * 1.1},${y + r * 0.8} L${x - r * 1.1},${y + r * 0.8} Z`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...rest} />
    case 'triangleDown':
      return <path d={`M${x},${y + r * 1.2} L${x + r * 1.1},${y - r * 0.8} L${x - r * 1.1},${y - r * 0.8} Z`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...rest} />
    case 'diamond':
      return <path d={`M${x},${y - r * 1.3} L${x + r * 1.1},${y} L${x},${y + r * 1.3} L${x - r * 1.1},${y} Z`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...rest} />
    case 'cross':
      return <path d={`M${x - r},${y - r} L${x + r},${y + r} M${x + r},${y - r} L${x - r},${y + r}`} stroke={stroke} strokeWidth={strokeWidth + 0.5} fill="none" {...rest} />
    default:
      return <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...rest} />
  }
}

/** Break a label into lines of at most `max` characters. */
export function wrapText(text, max) {
  const words = String(text ?? '').split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max && line) { lines.push(line); line = w } else line = (line + ' ' + w).trim()
  }
  if (line) lines.push(line)
  return lines
}

export const AXIS = {
  tick: { fontSize: 11, fill: 'var(--color-text-tertiary)' },
  label: { fontSize: 12, fill: 'var(--color-text-secondary)' },
  grid: 'var(--color-border)',
}

/** Legend laid out inside the SVG (so it is part of every export). Returns rows and height. */
export function layoutLegend(items, width, charW = 6.6) {
  const rows = [[]]
  let x = 0
  for (const it of items) {
    const w = 26 + it.label.length * charW + 16
    if (x + w > width && rows[rows.length - 1].length) { rows.push([]); x = 0 }
    rows[rows.length - 1].push({ ...it, x, w })
    x += w
  }
  // centre each row
  return rows.map(r => {
    const total = r.reduce((s, it) => s + it.w, 0)
    const off = Math.max(0, (width - total) / 2)
    return r.map(it => ({ ...it, x: it.x + off }))
  })
}

export function SvgLegend({ items, width, y, printMode, uid, kind = 'line' }) {
  const rows = layoutLegend(items, width)
  return (
    <g className="svg-legend" transform={`translate(0, ${y})`}>
      {rows.map((row, ri) => row.map(it => (
        <g key={it.key} transform={`translate(${it.x}, ${ri * 20})`} opacity={it.muted ? 0.6 : 1}>
          {kind === 'bar' ? (
            <rect x={2} y={-6} width={14} height={11} rx={printMode ? 0 : 2}
                  fill={barFill(it.style, uid, printMode)} stroke={printMode ? '#000' : 'none'} strokeWidth={0.6} />
          ) : kind === 'dot' ? (
            <Marker shape={it.style.marker} x={9} y={0} r={4.5} fill={it.style.fill}
                    stroke={it.style.marker === 'cross' ? 'var(--color-text)' : printMode ? '#000' : 'var(--color-bg-raised)'} strokeWidth={it.style.marker === 'cross' ? 1.4 : 1} />
          ) : (
            <>
              <line x1={0} x2={18} y1={0} y2={0} stroke={it.style.stroke} strokeWidth={it.bold ? 3 : 2} strokeDasharray={it.style.dash} />
              <Marker shape={it.style.marker} x={9} y={0} r={3.5} fill={printMode ? '#FFFFFF' : it.style.stroke} stroke={it.style.stroke} strokeWidth={1.3} />
            </>
          )}
          <text x={24} y={4} fontSize={12} fill="var(--color-text-secondary)">{it.label}</text>
        </g>
      )))}
    </g>
  )
}

export function legendHeight(items, width) {
  return layoutLegend(items, width).length * 20
}
