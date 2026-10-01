import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'

/* ─────────────────────────────────────────────────────────────
   Data layer. Only manifest.json (~10 KB) is fetched at start-up.
   Everything else is fetched per question when a view needs it, cached for
   the session, and de-duplicated if two components ask at once.

   Latinobarómetro layout (questions are harmonised across years, so one file
   per question covers every year):
     index.json               question catalogue
     v/<var>.json             all respondents, every year  → trends, map, single year
     g/<year>/<var>.json      subgroup cells for one year   (on demand)
     r/<year>/index.json      correlatable questions that year
     r/<year>/<var>.json      within-country correlations of <var> that year
   ───────────────────────────────────────────────────────────── */

const BASE = `${import.meta.env.BASE_URL}data`
const cache = new Map()

function fetchJSON(path) {
  const url = `${BASE}/${path}`
  if (!cache.has(url)) {
    const p = fetch(url).then(r => {
      if (!r.ok) throw new Error(`${r.status} loading ${path}`)
      return r.json()
    })
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return cache.get(url)
}

export const api = {
  manifest: () => fetchJSON('manifest.json'),
  index: () => fetchJSON('index.json'),
  variable: (id) => fetchJSON(`v/${id}.json`),
  groups: (year, id) => fetchJSON(`g/${year}/${id}.json`).catch(() => ({ est: {} })),
  corrIndex: (year) => fetchJSON(`r/${year}/index.json`),
  correlations: (year, id) => fetchJSON(`r/${year}/${id}.json`),
  geoWorld: () => fetchJSON('geo/world-110m.json'),
  geoRegion: () => fetchJSON('geo/region-50m.json'),
}

/**
 * One question in one year, in the shape the views use:
 * { ...question metadata, est: { ISO2: { all: cell, men: cell, … } } }.
 * Subgroup cells are merged in when `withGroups` is true.
 */
export function yearRecord(rec, year, groups) {
  if (!rec) return null
  const yy = rec.est[year]
  if (!yy) return { ...rec, year, est: {} }
  const est = {}
  for (const [cc, cell] of Object.entries(yy)) est[cc] = { all: cell, ...(groups?.est?.[cc] || {}) }
  return { ...rec, year, est }
}

/** All subgroup files of a question (one per year), for the trend view's breakdowns. */
export function loadAllGroups(rec) {
  return Promise.all(rec.years.map(y => api.groups(y, rec.id).then(g => [y, g.est || {}])))
    .then(pairs => Object.fromEntries(pairs))
}

/**
 * useResource(loader, deps): { data, loading, error } for any api call.
 * `loader` returns a promise (or null to skip). Stale responses are ignored.
 */
export function useResource(loader, deps) {
  const [state, setState] = useState({ data: null, loading: false, error: null })
  useEffect(() => {
    const p = loader()
    if (!p) { setState({ data: null, loading: false, error: null }); return }
    let live = true
    setState(s => ({ data: s.data, loading: true, error: null }))
    p.then(data => live && setState({ data, loading: false, error: null }))
     .catch(error => live && setState({ data: null, loading: false, error }))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

/** One question in one year (with subgroup cells when `withGroups`). */
export function useYearVariable(id, year, withGroups) {
  return useResource(
    () => (id && year ? Promise.all([api.variable(id), withGroups ? api.groups(year, id) : null])
      .then(([rec, g]) => yearRecord(rec, year, g)) : null),
    [id, year, withGroups]
  )
}

/** Several questions in one year (e.g. both axes of a scatter plot). */
export function useYearVariables(year, ids) {
  const key = ids.filter(Boolean).join('|')
  return useResource(
    () => (key && year ? Promise.all(ids.map(id => (id ? api.variable(id).then(r => yearRecord(r, year)) : null))) : null),
    [year, key]
  )
}

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [manifest, setManifest] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.manifest().then(setManifest).catch(e => setError(e.message))
  }, [])

  const helpers = useMemo(() => {
    if (!manifest) return {}
    const countries = manifest.countries
    const byName = (a, b) => countries[a].name.localeCompare(countries[b].name)
    const groupLabels = { all: 'All respondents' }
    manifest.subgroups.forEach(s => s.groups.forEach(g => { groupLabels[g.id] = g.label }))
    const waveById = Object.fromEntries(manifest.waves.map(w => [w.id, w]))
    const unit = manifest.unit_label || 'Wave'
    return {
      unit,
      years: manifest.waves.map(w => w.id),
      countryName: (iso) => countries[iso]?.name || iso,
      countryColor: (iso) => `var(--country-${iso})`,
      iso3: (iso) => countries[iso]?.iso3 || iso,
      allCountries: Object.keys(countries).sort(byName),
      waveCountries: (w) => [...(waveById[w]?.countries || [])].sort(byName),
      wave: (w) => waveById[w],
      waveLabel: (w) => waveById[w] ? (unit === 'Year' ? waveById[w].label : `${waveById[w].label} (${waveById[w].years})`) : `${unit} ${w}`,
      fieldworkYear: (iso, w) => countries[iso]?.waves?.[w]?.year ?? null,
      groupLabel: (g) => groupLabels[g] || g,
      countrySet: (id) => manifest.country_sets.find(s => s.id === id),
      sortByName: (list) => [...list].sort(byName),
    }
  }, [manifest])

  const value = useMemo(() => ({ manifest, error, loading: !manifest && !error, ...helpers }),
    [manifest, error, helpers])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}

/** Source line used under every chart and in every export. */
export function useSourceNote() {
  const { manifest } = useData()
  return useCallback(({ waves, base, weighted = true, set, extra, gaps } = {}) => {
    if (!manifest) return ''
    const nr = manifest.survey.nr_text || "Don't know / no answer"
    const parts = [`Source: ${manifest.survey.name}${waves ? `, ${waves}` : ''}.`]
    if (weighted) parts.push('Weighted within country-year.')
    if (base === 'valid') parts.push(`% of valid answers; ${nr.toLowerCase()} excluded from the base.`)
    if (base === 'asked') parts.push(`% of respondents asked; ${nr.toLowerCase()} included in the base.`)
    if (set) parts.push(set)
    if (extra) parts.push(extra)
    if (gaps && manifest.gaps_note) parts.push(manifest.gaps_note)
    return parts.join(' ')
  }, [manifest])
}
