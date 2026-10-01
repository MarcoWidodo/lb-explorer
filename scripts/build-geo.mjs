// Builds the two map files the site needs from world-atlas (Natural Earth):
//   public/data/geo/world-110m.json   — whole world, coarse (home-page globe)
//   public/data/geo/region-50m.json   — countries intersecting the survey region, finer (choropleth)
// Usage: node scripts/build-geo.mjs [minLon maxLon minLat maxLat]
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { feature } from 'topojson-client'
import { topology } from 'topojson-server'
import { geoBounds } from 'd3-geo'

const require = createRequire(import.meta.url)
const atlas = (f) => JSON.parse(fs.readFileSync(require.resolve(`world-atlas/${f}`), 'utf8'))
const [minLon, maxLon, minLat, maxLat] = process.argv.slice(2).map(Number).length === 4
  ? process.argv.slice(2).map(Number) : [55, 180, -50, 60]   // Asia and the Pacific

const out = path.resolve('public/data/geo')
fs.mkdirSync(out, { recursive: true })

// 1. globe: world at 110m, unchanged
fs.copyFileSync(require.resolve('world-atlas/countries-110m.json'), path.join(out, 'world-110m.json'))

// 2. choropleth: 50m countries whose bounding box intersects the region
const topo = atlas('countries-50m.json')
const fc = feature(topo, topo.objects.countries)
const keep = fc.features.filter(f => {
  const [[x0, y0], [x1, y1]] = geoBounds(f)
  const lonOk = x0 > x1 ? true : x1 >= minLon && x0 <= maxLon   // antimeridian-crossing features: keep
  return lonOk && y1 >= minLat && y0 <= maxLat
}).map(f => ({ type: 'Feature', id: f.id, properties: { name: f.properties.name }, geometry: f.geometry }))
const t = topology({ countries: { type: 'FeatureCollection', features: keep } }, 1e5)
fs.writeFileSync(path.join(out, 'region-50m.json'), JSON.stringify(t))
console.log(`region-50m.json: ${keep.length} countries, ${(fs.statSync(path.join(out, 'region-50m.json')).size / 1e3).toFixed(0)} KB`)
