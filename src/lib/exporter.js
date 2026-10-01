/* ─────────────────────────────────────────────────────────────
   Print-ready export.
   Every chart is an SVG drawn by our own components, so exports are vector.
   The exporter frames the chart at 9 × 5.5 in (the project's slide/figure
   size) with a title, subtitle and source note, and writes:
     • SVG  — vector, opens in PowerPoint/Word/Illustrator
     • PNG  — 300 dpi (2700 × 1650 px)
   plus a tidy CSV of exactly the plotted values.
   Colours are always resolved from the LIGHT theme so exports print on white.
   ───────────────────────────────────────────────────────────── */

import { wrapText, PRINT_FONT } from '../components/charts/theme'

const FRAME_W = 864   // 9 in at 96 px/in
const FRAME_H = 528   // 5.5 in
const DPI_SCALE = 300 / 96

/** Resolve var(--token) references using the light theme's values. */
function resolveVars(svgText) {
  const root = document.documentElement
  const wasDark = root.classList.contains('dark')
  if (wasDark) root.classList.remove('dark')
  const cs = getComputedStyle(root)
  const out = svgText.replace(/var\((--[\w-]+)\)/g, (_, name) => cs.getPropertyValue(name).trim() || '#888888')
  if (wasDark) root.classList.add('dark')
  return out
}

function escapeXml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Build the framed SVG string. */
export function composeSVG({ svgEl, title, subtitle, note, printMode }) {
  const font = printMode ? PRINT_FONT : "'Source Sans 3', 'Source Sans Pro', Arial, sans-serif"
  const titleFont = printMode ? PRINT_FONT : "Lora, Georgia, serif"
  const clone = svgEl.cloneNode(true)
  clone.querySelectorAll('.bar-hit').forEach(n => n.remove())
  const vw = Number(svgEl.getAttribute('width')), vh = Number(svgEl.getAttribute('height'))
  const titleLines = wrapText(title, 88).slice(0, 2)
  const subLines = subtitle ? wrapText(subtitle, 120).slice(0, 2) : []
  const noteLines = note ? wrapText(note, 165).slice(0, 4) : []
  const top = 22 + titleLines.length * 22 + subLines.length * 16 + 8
  const bottom = noteLines.length * 12 + 18
  const availW = FRAME_W - 48, availH = FRAME_H - top - bottom
  const k = Math.min(availW / vw, availH / vh)
  const cw = vw * k, ch = vh * k
  const cx = (FRAME_W - cw) / 2
  const cy = top + Math.max(0, (availH - ch) / 2)   // short charts sit in the middle of the frame
  clone.setAttribute('x', cx); clone.setAttribute('y', cy)
  clone.setAttribute('width', cw); clone.setAttribute('height', ch)
  clone.removeAttribute('style')
  clone.setAttribute('font-family', font)
  const inner = new XMLSerializer().serializeToString(clone)
  let y = 30
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_W}" height="${FRAME_H}" viewBox="0 0 ${FRAME_W} ${FRAME_H}">`,
    `<rect width="${FRAME_W}" height="${FRAME_H}" fill="#FFFFFF"/>`,
  ]
  titleLines.forEach(l => { parts.push(`<text x="24" y="${y}" font-family="${titleFont}" font-size="18" font-weight="700" fill="#1A1A1A">${escapeXml(l)}</text>`); y += 22 })
  subLines.forEach(l => { parts.push(`<text x="24" y="${y - 4}" font-family="${font}" font-size="12.5" fill="#404040">${escapeXml(l)}</text>`); y += 16 })
  parts.push(inner)
  let ny = FRAME_H - bottom + 14
  noteLines.forEach(l => { parts.push(`<text x="24" y="${ny}" font-family="${font}" font-size="9.5" fill="#595959">${escapeXml(l)}</text>`); ny += 12 })
  parts.push('</svg>')
  // strip HTML-only attributes React may leave and resolve theme tokens
  return resolveVars(parts.join('\n')).replace(/ data-print="[01]"/g, '')
}

function download(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export function exportSVG(opts, filename) {
  const svg = composeSVG(opts)
  download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename)
}

export async function exportPNG(opts, filename) {
  const svg = composeSVG(opts)
  const img = new Image()
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(FRAME_W * DPI_SCALE)
  canvas.height = Math.round(FRAME_H * DPI_SCALE)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  URL.revokeObjectURL(url)
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
  download(blob, filename)
}

/* ── Tidy CSV (rule 9 of the project's trend-analysis instructions) ── */
export const TIDY_COLUMNS = ['indicator', 'variable', 'success_codes', 'base', 'country_set', 'wave', 'year',
  'iso3', 'country', 'group', 'value', 'se', 'n', 'n_countries']

export function exportCSV(rows, filename, columns = TIDY_COLUMNS) {
  const esc = (v) => {
    if (v == null || (typeof v === 'number' && !Number.isFinite(v))) return ''
    const s = typeof v === 'number' ? String(Math.round(v * 10000) / 10000) : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const text = [columns.join(','), ...rows.map(r => columns.map(c => esc(r[c])).join(','))].join('\n')
  download(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }), filename)
}

export function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}
