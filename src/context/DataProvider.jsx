import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'

/* ─────────────────────────────────────────────────────────────
   Data layer. Only manifest.json (~10 KB) is fetched at start-up.
   Everything else is fetched per variable when a view needs it, cached for
   the session, and de-duplicated if two components ask at once.
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
  waveIndex: (w) => fetchJSON(`waves/w${w}/index.json`),
  variable: (w, id) => fetchJSON(`waves/w${w}/v/${id}.json`),
  correlations: (w, id) => fetchJSON(`waves/w${w}/r/${id}.json`),
  trendIndex: () => fetchJSON('trends/index.json'),
  trend: (id) => fetchJSON(`trends/${id}.json`),
  geoWorld: () => fetchJSON('geo/world-110m.json'),
  geoRegion: () => fetchJSON('geo/region-50m.json'),
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

/** Several variables at once (e.g. both axes of a scatter plot). */
export function useVariables(wave, ids) {
  const key = ids.filter(Boolean).join('|')
  return useResource(
    () => (key ? Promise.all(ids.map(id => (id ? api.variable(wave, id) : null))) : null),
    [wave, key]
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
    return {
      countryName: (iso) => countries[iso]?.name || iso,
      countryColor: (iso) => `var(--country-${iso})`,
      iso3: (iso) => countries[iso]?.iso3 || iso,
      allCountries: Object.keys(countries).sort(byName),
      waveCountries: (w) => [...(waveById[w]?.countries || [])].sort(byName),
      wave: (w) => waveById[w],
      waveLabel: (w) => waveById[w] ? `${waveById[w].label} (${waveById[w].years})` : `Wave ${w}`,
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
  return useCallback(({ waves, base, weighted = true, set, extra } = {}) => {
    if (!manifest) return ''
    const parts = [`Source: ${manifest.survey.name}${waves ? `, ${waves}` : ''}.`]
    if (weighted) parts.push('Weighted within country.')
    if (base === 'valid') parts.push("Don't know / can't choose / decline excluded from the base.")
    if (base === 'asked') parts.push("Don't know / can't choose / decline included in the base.")
    if (set) parts.push(set)
    if (extra) parts.push(extra)
    return parts.join(' ')
  }, [manifest])
}
