// Regional lines computed by the SITE'S OWN JavaScript (src/lib/stats.js), from the
// published files, against lb_region() in R (pipeline/output/region_reference.csv,
// written by build_site_data.Rmd). Same rule as the Time-Series view: years listed as
// comparability breaks are left out; balanced sets need every member.
// Usage: node pipeline/check_regions.mjs        (exit code 1 on any difference)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cellValue, regionValue } from '../src/lib/stats.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(here, '..', 'public', 'data')
const read = (p) => JSON.parse(fs.readFileSync(path.join(DATA, p), 'utf8'))
const manifest = read('manifest.json')
const index = read('index.json')

const csv = fs.readFileSync(path.join(here, 'output', 'region_reference.csv'), 'utf8').trim().split('\n')
const head = csv[0].split(',').map(s => s.replace(/"/g, ''))
const ref = csv.slice(1).map(line => Object.fromEntries(line.split(',').map((v, i) => [head[i], v.replace(/"/g, '')])))

let points = 0, maxShare = 0, maxMean = 0
const fails = []
for (const entry of index.vars.filter(v => v.f)) {
  const rec = read(`v/${entry.id}.json`)
  const breaks = new Set(entry.tb && entry.tb.years !== 'all' ? entry.tb.years : [])
  const bases = entry.d.type === 'mean' ? ['mean'] : ['valid', 'asked']
  for (const base of bases) {
    const indicator = base === 'mean' ? { type: 'mean' } : { type: 'share', codes: entry.d.codes }
    for (const set of manifest.country_sets) {
      const site = new Map()
      for (const y of rec.years.filter(y => !breaks.has(y))) {
        const byC = Object.fromEntries(set.countries.map(c => {
          const cell = rec.est[y]?.[c]
          return [c, cell ? cellValue(cell, rec.codes, indicator, base === 'mean' ? 'valid' : base) : null]
        }))
        const r = regionValue(byC, set.countries, !set.balanced)
        if (r) site.set(y, r)
      }
      const want = ref.filter(r => r.var === entry.id && r.base === base && r.set === set.id)
      if (want.length !== site.size) fails.push([entry.id, base, set.id, 'years', want.length, site.size])
      const ks = new Set()
      for (const w of want) {
        const s = site.get(Number(w.year))
        if (!s) { fails.push([entry.id, base, set.id, w.year, 'missing on site']); continue }
        const d = Math.abs(s.value - Number(w.value))
        points++
        if (base === 'mean') maxMean = Math.max(maxMean, d); else maxShare = Math.max(maxShare, d)
        if (s.n_countries !== Number(w.n_countries)) fails.push([entry.id, base, set.id, w.year, 'n_countries', s.n_countries, w.n_countries])
        ks.add(s.n_countries)
      }
      if (set.balanced && ks.size > 1) fails.push([entry.id, base, set.id, 'n_countries not constant', [...ks].join('/')])
    }
  }
}
const ok = !fails.length && points > 0 && maxShare <= 0.101 && maxMean <= 0.0006
console.log(JSON.stringify({ featured: index.vars.filter(v => v.f).length, sets: manifest.country_sets.length, points, maxShare, maxMean }, null, 1))
if (fails.length) console.log('FAILURES', fails.slice(0, 20))
console.log(ok ? 'ALL REGIONAL LINES MATCH lb_region()' : 'CHECK FAILED')
process.exit(ok ? 0 : 1)
