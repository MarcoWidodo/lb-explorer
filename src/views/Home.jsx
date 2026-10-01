import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'motion/react'
import { BarChart3, TrendingUp, Globe2, GitCompareArrows, ArrowRight } from 'lucide-react'
import { useData } from '../context/DataProvider'
import GlobeCanvas from '../components/shared/GlobeCanvas'
import WaveDotMatrix from '../components/shared/WaveDotMatrix'

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Single-Wave Explorer',
    desc: 'Answers to any question in any wave, compared across countries and by gender, age, education and urban/rural.',
    path: '/explore',
    color: 'var(--chart-1)',
  },
  {
    icon: TrendingUp,
    title: 'Time-Series Explorer',
    desc: 'Harmonized questions on one scale across all six waves, by fieldwork year, with regional averages.',
    path: '/trends',
    color: 'var(--chart-3)',
  },
  {
    icon: Globe2,
    title: 'Choropleth Map',
    desc: 'One number per country, from any question in any wave, on a map of the region.',
    path: '/map',
    color: 'var(--chart-4)',
  },
  {
    icon: GitCompareArrows,
    title: 'Correlations Explorer',
    desc: 'How two questions move together, across countries or among respondents within a country.',
    path: '/correlations',
    color: 'var(--chart-5)',
  },
]

/* ── Animated number counter ── */
function CountUp({ target, duration = 1.5 }) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const start = performance.now()
          function tick(now) {
            const elapsed = (now - start) / (duration * 1000)
            if (elapsed >= 1) {
              setValue(target)
            } else {
              const eased = 1 - Math.pow(1 - elapsed, 3)
              setValue(Math.round(eased * target))
              requestAnimationFrame(tick)
            }
          }
          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, duration])

  return <span ref={ref}>{value.toLocaleString()}</span>
}

/* ── Main Home component ── */
export default function Home() {
  const navigate = useNavigate()
  const { manifest } = useData()
  const nWaves = manifest.waves.length
  const totalN = manifest.waves.reduce((s, w) => s + w.n, 0)
  const years = Object.values(manifest.countries).flatMap(c => Object.values(c.waves).map(w => w.year))
  const y0 = Math.min(...years), y1 = Math.max(...years)
  const heroRef = useRef(null)

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })

  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])
  const heroY = useTransform(scrollYProgress, [0, 0.7], ['0%', '12%'])

  const totalCountries = Object.keys(manifest.countries).length

  return (
    <div className="dock-clearance">
      {/* ── Hero with topographic background ── */}
      <section className="hero" ref={heroRef}>
        {/* Topographic contour pattern (pure CSS) */}
        <div className="hero-topo-bg" />

        <motion.div
          className="hero-content"
          style={{ opacity: heroOpacity, y: heroY }}
        >
          {/* Left: text */}
          <div className="hero-text">
            <motion.p
              className="hero-overline"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              Interactive Data Explorer
            </motion.p>

            <motion.h1
              className="hero-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
            >
              {manifest.survey.name.replace(/ Survey$/, '')}{' '}
              <span className="hero-title-accent">Survey Explorer</span>
            </motion.h1>

            <motion.p
              className="hero-subtitle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.6 }}
            >
              Explore {y1 - y0 + 1} years of public opinion ({y0}–{y1}) from {totalN.toLocaleString('en-US')} interviews
              in {totalCountries} countries in {manifest.survey.region}: democratic values, institutional trust,
              political participation and economic perceptions.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75, duration: 0.6 }}
              style={{ marginTop: '2rem' }}
            >
              <button onClick={() => navigate('/explore')} className="hero-cta">
                Start Exploring
                <ArrowRight size={17} />
              </button>
            </motion.div>

            {/* Stats row */}
            <motion.div
              className="hero-stats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.8 }}
            >
              <div className="hero-stat">
                <span className="hero-stat-num"><CountUp target={nWaves} duration={1} /></span>
                <span className="hero-stat-label">Survey Waves</span>
              </div>
              <div className="hero-stat-divider" />
              <div className="hero-stat">
                <span className="hero-stat-num"><CountUp target={totalCountries} duration={1.2} /></span>
                <span className="hero-stat-label">Countries</span>
              </div>
              <div className="hero-stat-divider" />
              <div className="hero-stat">
                <span className="hero-stat-num"><CountUp target={Math.round(totalN / 1000)} duration={1.4} />k</span>
                <span className="hero-stat-label">Interviews</span>
              </div>
            </motion.div>
          </div>

          {/* Right: globe */}
          <motion.div
            className="hero-globe-wrap"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 1.0, ease: [0.25, 0.4, 0.25, 1] }}
          >
            <GlobeCanvas width={750} height={750} />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Wave Coverage: Dot Matrix ── */}
      <section className="wave-section">
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <motion.h2
            className="section-heading"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6 }}
          >
            {nWaves === 6 ? 'Six' : nWaves} Waves of Data
          </motion.h2>

          <motion.p
            className="section-subheading"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ delay: 0.15, duration: 0.6 }}
          >
            Survey coverage across {totalCountries} countries, {y0}–{y1}. Hover a dot for the fieldwork year and sample size.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ delay: 0.25, duration: 0.6 }}
          >
            <WaveDotMatrix />
          </motion.div>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="features-section">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <motion.h2
            className="section-heading"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6 }}
          >
            Explore the Data
          </motion.h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {FEATURES.map(({ icon: Icon, title, desc, path, color }, i) => (
              <motion.button
                key={path}
                onClick={() => navigate(path)}
                className="feature-card"
                style={{ '--feature-color': color }}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  delay: i * 0.12,
                  duration: 0.6,
                  ease: [0.25, 0.4, 0.25, 1],
                }}
                whileHover={{ y: -6 }}
              >
                <div className="feature-icon">
                  <Icon size={22} />
                </div>
                <div className="feature-title">{title}</div>
                <div className="feature-desc">{desc}</div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Attribution ── */}
      <motion.section
        className="attribution"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <p>
          Data source: {manifest.survey.attribution} Visit{' '}
          <a href={manifest.survey.url} target="_blank" rel="noopener noreferrer">{manifest.survey.url.replace(/^https?:\/\/(www\.)?/, '')}</a>{' '}
          for more information. How the numbers on this site are computed: <Link to="/about">About the data</Link>.
          Data built {manifest.built}.
        </p>
      </motion.section>
    </div>
  )
}
