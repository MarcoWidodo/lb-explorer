import { useRef, useCallback, useState } from 'react'
import { exportPNG, exportSVG, exportCSV, slug } from './exporter'

/**
 * Shared export plumbing for a view: a ref for the chart's <svg>, the print-style
 * switch, and PNG / SVG / CSV handlers that all use the same title and note.
 */
export function useChartExport({ title, subtitle, note, filename, rows }) {
  const svgRef = useRef(null)
  const [printMode, setPrintMode] = useState(false)
  const base = slug(filename || title || 'chart')
  const opts = () => ({ svgEl: svgRef.current, title, subtitle, note, printMode })
  const onPNG = useCallback(() => svgRef.current && exportPNG(opts(), `${base}.png`), [title, subtitle, note, printMode, base]) // eslint-disable-line react-hooks/exhaustive-deps
  const onSVG = useCallback(() => svgRef.current && exportSVG(opts(), `${base}.svg`), [title, subtitle, note, printMode, base]) // eslint-disable-line react-hooks/exhaustive-deps
  const onCSV = useCallback(() => rows && exportCSV(typeof rows === 'function' ? rows() : rows, `${base}.csv`), [rows, base])
  return { svgRef, printMode, setPrintMode, onPNG, onSVG, onCSV }
}

export const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/**
 * Full question text for display. Battery items are labelled in the data with only
 * the item ("The courts", "Parliament"); they get their section as a prefix so the
 * question reads on its own ("Trust in Institutions: The courts").
 */
export function questionText(entry) {
  if (!entry) return ''
  const q = capFirst(entry.q || '')
  const isItem = q.length < 48 && !/[?:]$/.test(q.trim()) && !/^(how|what|which|do|did|does|are|is|in|to|would|have|has|when|where|who)\b/i.test(q)
  return isItem && entry.s && !/^(Socio-economic|Interview|Sample)/.test(entry.s) ? `${entry.s}: ${q}` : q
}
