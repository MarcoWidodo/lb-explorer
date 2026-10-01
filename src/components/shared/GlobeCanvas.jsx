import { useRef, useEffect, useState, useCallback } from 'react'
import { geoOrthographic, geoPath, geoGraticule10 } from 'd3-geo'
import { feature } from 'topojson-client'
import { api, useData } from '../../context/DataProvider'

// Stagger order for draw-in (roughly geographic sweep)
const DRAW_ORDER = ['JP', 'KR', 'CN', 'HK', 'TW', 'MN', 'PH', 'VN', 'TH', 'KH', 'MM', 'MY', 'SG', 'ID', 'IN', 'AU']


export default function GlobeCanvas({ width = 420, height = 420 }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const dataRef = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const hoverPause = useRef(false)
  const { manifest } = useData()
  const NUMERIC_TO_A2 = useRef(Object.fromEntries(Object.entries(manifest.countries).map(([iso, c]) => [c.iso_numeric, iso]))).current

  // Load TopoJSON once
  useEffect(() => {
    api.geoWorld()
      .then(topo => {
        const countries = feature(topo, topo.objects.countries)
        const land = feature(topo, topo.objects.land)

        const absFeatures = []
        const otherFeatures = []

        countries.features.forEach(f => {
          if (NUMERIC_TO_A2[f.id]) {
            f._a2 = NUMERIC_TO_A2[f.id]
            absFeatures.push(f)
          } else {
            otherFeatures.push(f)
          }
        })

        // Sort ABS features by draw order
        absFeatures.sort((a, b) =>
          DRAW_ORDER.indexOf(a._a2) - DRAW_ORDER.indexOf(b._a2)
        )

        dataRef.current = { land, absFeatures, otherFeatures, graticule: geoGraticule10() }
        setLoaded(true)
      })
      .catch(err => console.error('Globe: failed to load geo data', err))
  }, [])

  // Animation loop
  useEffect(() => {
    if (!loaded || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const { absFeatures, otherFeatures, graticule } = dataRef.current

    const projection = geoOrthographic()
      .translate([width / 2, height / 2])
      .scale(width * 0.42)
      .rotate([-110, -10, 0]) // centered on Asia-Pacific
      .clipAngle(90)

    const path = geoPath(projection, ctx)

    const startTime = performance.now()
    const DRAW_IN_START = 600    // ms before first country starts drawing
    const DRAW_IN_STAGGER = 180  // ms between each country
    const DRAW_IN_DURATION = 500 // ms for each country's animation
    const ROTATION_START = DRAW_IN_START + DRAW_ORDER.length * DRAW_IN_STAGGER + 800
    const ROTATION_SPEED = 0.008 // degrees per frame (~0.5°/sec at 60fps)

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let visible = true
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !animRef.current) animRef.current = requestAnimationFrame(render)
    })
    io.observe(canvas)

    function render(now) {
      animRef.current = null
      if (!visible) return
      const elapsed = reduceMotion ? 1e9 : now - startTime
      const cs = getComputedStyle(document.documentElement)
      const getCSSColor = (v) => cs.getPropertyValue(v).trim() || '#888'
      ctx.clearRect(0, 0, width, height)

      // Slow rotation after draw-in completes
      if (!reduceMotion && elapsed > ROTATION_START && !hoverPause.current) {
        const rot = projection.rotate()
        projection.rotate([rot[0] - ROTATION_SPEED, rot[1], rot[2]])
      }

      // Globe ocean background
      ctx.beginPath()
      path({ type: 'Sphere' })
      ctx.fillStyle = getCSSColor('--color-bg-subtle')
      ctx.fill()
      ctx.strokeStyle = getCSSColor('--color-border')
      ctx.lineWidth = 1
      ctx.stroke()

      // Graticule
      ctx.beginPath()
      path(graticule)
      ctx.strokeStyle = getCSSColor('--color-border')
      ctx.lineWidth = 0.3
      ctx.globalAlpha = 0.4
      ctx.stroke()
      ctx.globalAlpha = 1

      // Non-ABS countries (gray fill)
      otherFeatures.forEach(f => {
        ctx.beginPath()
        path(f)
        ctx.fillStyle = getCSSColor('--color-bg-muted')
        ctx.fill()
      })

      // ABS countries with draw-in animation
      absFeatures.forEach((f, i) => {
        const countryStart = DRAW_IN_START + i * DRAW_IN_STAGGER
        const progress = Math.min(1, Math.max(0, (elapsed - countryStart) / DRAW_IN_DURATION))

        if (progress <= 0) return // not started yet

        const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
        const color = getCSSColor(`--country-${f._a2}`)

        ctx.beginPath()
        path(f)

        // Fill fades in
        ctx.globalAlpha = eased * 0.7
        ctx.fillStyle = color
        ctx.fill()

        // Stroke: bright during animation, settles to subtle
        const strokeAlpha = progress < 1 ? 0.5 + (1 - progress) * 0.5 : 0.35
        const strokeWidth = progress < 1 ? 1.5 + (1 - progress) * 2 : 0.8
        ctx.globalAlpha = strokeAlpha
        ctx.strokeStyle = color
        ctx.lineWidth = strokeWidth
        ctx.stroke()

        ctx.globalAlpha = 1
      })

      // Globe rim highlight
      ctx.beginPath()
      path({ type: 'Sphere' })
      ctx.strokeStyle = getCSSColor('--color-border')
      ctx.lineWidth = 1.5
      ctx.stroke()

      animRef.current = requestAnimationFrame(render)
    }

    animRef.current = requestAnimationFrame(render)

    return () => {
      io.disconnect()
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [loaded, width, height])

  const onMouseEnter = useCallback(() => { hoverPause.current = true }, [])
  const onMouseLeave = useCallback(() => { hoverPause.current = false }, [])

  return (
    <canvas
      ref={canvasRef}
      className="globe-canvas"
      style={{ width, height }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  )
}
