/* ─────────────────────────────────────────────────────────────
   stats.js: the only statistics the browser does.

   Every estimate (weighted %, mean, SE, N, correlation r) is computed by the
   R pipeline (pipeline/build_site_data.Rmd). The browser only:
     1. re-bases a valid-base % to the asked base:
          p_asked = p_valid × (1 − Σ nonresponse % / 100)
     2. sums the % of the response codes the user selects
     3. averages country estimates into a regional value (each country counts
        equally; only when every member of the set has data)
     4. turns r and N into a two-sided p-value (t-test, df = N − 2)
   ───────────────────────────────────────────────────────────── */

/** Index positions of `codes` in a variable's code list (or a sparse cell's own list). */
function positions(cell, allCodes, codes) {
  const list = cell.k || allCodes
  return codes.map(c => list.indexOf(c)).filter(i => i >= 0)
}

/** Share of valid answers (0–1) that are nonresponse, among ASKED respondents. */
export function nonresponseShare(cell) {
  if (!cell?.q) return 0
  return cell.q.reduce((s, v) => s + v, 0) / 100
}

/**
 * The value shown for one cell (country × group).
 * indicator = { type: 'mean' } | { type: 'share', codes: [..] }
 * base      = 'valid' | 'asked'
 * Returns { value, se, n } or null when the cell has no valid respondents.
 * For shares, value is a percentage (0–100) and se is in percentage points.
 */
export function cellValue(cell, codes, indicator, base = 'valid') {
  if (!cell || !cell.nv) return null
  if (indicator.type === 'mean') {
    if (cell.m == null) return null
    return { value: cell.m, se: cell.se ?? null, n: cell.nv }
  }
  const idx = positions(cell, codes, indicator.codes || [])
  let p = idx.reduce((s, i) => s + (cell.p[i] || 0), 0)
  let n = cell.nv
  let ne = cell.ne ?? cell.nv
  if (base === 'asked') {
    const f = 1 - nonresponseShare(cell)
    p = p * f
    ne = ne * (cell.n / cell.nv)   // effective N scales with the larger base
    n = cell.n
  }
  p = Math.min(100, Math.max(0, p))
  const prop = p / 100
  const se = ne > 0 ? Math.sqrt(prop * (1 - prop) / ne) * 100 : null
  return { value: p, se, n }
}

/**
 * Full distribution of one cell for a bar chart.
 * Valid base: substantive codes only, summing to 100.
 * Asked base: substantive codes re-based, plus one bar per nonresponse code.
 */
export function cellDistribution(cell, rec, base = 'valid') {
  if (!cell || !cell.nv) return null
  const out = []
  const f = base === 'asked' ? 1 - nonresponseShare(cell) : 1
  const codes = cell.k || rec.codes
  codes.forEach((code, i) => {
    out.push({ code, pct: (cell.p[i] || 0) * f, count: cell.c?.[i] ?? null, nr: false })
  })
  if (base === 'asked' && cell.q) {
    rec.nr.forEach((code, j) => out.push({ code, pct: cell.q[j] || 0, count: null, nr: true }))
  }
  return out
}

/** Equal-weight average of country values; null unless every member has a value. */
export function regionValue(byCountry, members) {
  const vals = members.map(m => byCountry[m])
  if (!vals.length || vals.some(v => v == null || v.value == null)) return null
  const k = vals.length
  const value = vals.reduce((s, v) => s + v.value, 0) / k
  const ses = vals.map(v => v.se)
  const se = ses.every(s => s != null) ? Math.sqrt(ses.reduce((s, x) => s + x * x, 0)) / k : null
  return { value, se, n: vals.reduce((s, v) => s + v.n, 0), n_countries: k }
}

/* ── Pearson correlation p-value (two-sided t-test) ─────────── */

function logGamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) ser += c[j] / ++y
  return -tmp + Math.log(2.5066282746310005 * ser / x)
}

function betacf(a, b, x) {
  const MAXIT = 300, EPS = 3e-14, FPMIN = 1e-300
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1, d = 1 - qab * x / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

/** Regularized incomplete beta I_x(a, b). */
export function incompleteBeta(x, a, b) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b
}

/** Two-sided p-value for Pearson r with n observations. */
export function pValueR(r, n) {
  if (r == null || n == null || n < 3) return null
  if (Math.abs(r) >= 1) return 0
  const df = n - 2
  const t2 = (r * r * df) / (1 - r * r)
  return incompleteBeta(df / (df + t2), df / 2, 0.5)
}

/** Unweighted Pearson r (for country-level scatter plots). */
export function pearson(points) {
  const n = points.length
  if (n < 3) return null
  const mx = points.reduce((s, p) => s + p.x, 0) / n
  const my = points.reduce((s, p) => s + p.y, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (const p of points) {
    sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2
  }
  if (sxx === 0 || syy === 0) return null
  const r = sxy / Math.sqrt(sxx * syy)
  const slope = sxy / sxx
  return { r, slope, intercept: my - slope * mx, n, p: pValueR(r, n) }
}

/* ── Formatting ─────────────────────────────────────────────── */

export const fmtPct = (v, d = 0) => (v == null ? '—' : `${v.toFixed(d)}%`)
export const fmtNum = (v, d = 2) => (v == null ? '—' : v.toFixed(d))
export const fmtN = (v) => (v == null ? '—' : Math.round(v).toLocaleString('en-US'))
export function fmtP(p) {
  if (p == null) return '—'
  if (p < 0.001) return '< 0.001'
  return p.toFixed(3)
}
export function fmtValue(v, indicator, digits) {
  if (v == null) return '—'
  return indicator.type === 'mean' ? v.toFixed(digits ?? 2) : `${v.toFixed(digits ?? 0)}%`
}
