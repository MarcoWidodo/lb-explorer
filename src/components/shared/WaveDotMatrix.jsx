import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'

import { useData } from '../../context/DataProvider'

export default function WaveDotMatrix() {
  const { manifest } = useData()
  const WAVES = manifest.waves.map(w => ({ num: w.id, label: w.label, years: w.years }))
  const [hoveredWave, setHoveredWave] = useState(null)
  const [hoveredCountry, setHoveredCountry] = useState(null)

  // Build sorted country list with wave presence
  const countries = useMemo(() => Object.entries(manifest.countries)
      .map(([code, info]) => ({ code, name: info.name, waves: Object.keys(info.waves).map(Number),
                                n: info.waves }))
      .sort((a, b) => a.name.localeCompare(b.name)), [manifest])

  // Countries for hovered wave (for tooltip)
  const hoveredWaveCountries = useMemo(() => {
    if (hoveredWave == null) return []
    return countries.filter(c => c.waves.includes(hoveredWave))
  }, [hoveredWave, countries])

  return (
    <div className="dot-matrix-wrap">
      <div className="dot-matrix" style={{ '--n-waves': WAVES.length }}>
        {/* Header row: wave labels */}
        <div className="dot-matrix-corner" />
        {WAVES.map(w => (
          <div
            key={w.num}
            className={`dot-matrix-col-header${hoveredWave === w.num ? ' active' : ''}`}
            onMouseEnter={() => setHoveredWave(w.num)}
            onMouseLeave={() => setHoveredWave(null)}
          >
            <span className="dot-matrix-wave-num">W{w.num}</span>
            <span className="dot-matrix-wave-years">{w.years}</span>

            {/* Tooltip on wave header hover */}
            <AnimatePresence>
              {hoveredWave === w.num && (
                <motion.div
                  className="dot-matrix-tooltip"
                  initial={{ opacity: 0, y: -6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.95 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="dot-matrix-tooltip-title">Wave {w.num} ({w.years})</div>
                  <div className="dot-matrix-tooltip-count">{hoveredWaveCountries.length} countries</div>
                  <div className="dot-matrix-tooltip-chips">
                    {hoveredWaveCountries.map(c => (
                      <span
                        key={c.code}
                        className="timeline-chip"
                        style={{ '--chip-color': `var(--country-${c.code})` }}
                      >
                        <span className="timeline-chip-dot" />
                        {c.name}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {/* Country rows */}
        {countries.map((c, ri) => (
          <motion.div
            key={c.code}
            className="dot-matrix-row"
            onMouseEnter={() => setHoveredCountry(c.code)}
            onMouseLeave={() => setHoveredCountry(null)}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: ri * 0.03, duration: 0.4 }}
          >
            {/* Country label */}
            <div className={`dot-matrix-row-label${hoveredCountry === c.code ? ' active' : ''}`}>
              <span
                className="dot-matrix-country-dot"
                style={{ background: `var(--country-${c.code})` }}
              />
              <span className="dot-matrix-country-code">{c.code}</span>
              <span className="dot-matrix-country-name">{c.name}</span>
            </div>

            {/* Dots for each wave */}
            {WAVES.map((w, ci) => {
              const present = c.waves.includes(w.num)
              const isHighlighted =
                (hoveredWave === w.num) ||
                (hoveredCountry === c.code)
              const isDimmed =
                (hoveredWave != null && hoveredWave !== w.num && hoveredCountry == null) ||
                (hoveredCountry != null && hoveredCountry !== c.code && hoveredWave == null)

              return (
                <div
                  key={w.num}
                  className={`dot-matrix-cell${isHighlighted ? ' highlighted' : ''}${isDimmed ? ' dimmed' : ''}`}
                  title={present ? `${c.name}, ${w.label}: ${c.n[w.num].year}, N = ${c.n[w.num].n.toLocaleString('en-US')}` : `${c.name}: not surveyed in ${w.label}`}
                >
                  <motion.div
                    className={`dot-matrix-dot${present ? ' filled' : ' empty'}`}
                    style={present ? {
                      '--dot-color': `var(--country-${c.code})`,
                    } : {}}
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{
                      delay: 0.1 + ci * 0.08 + ri * 0.02,
                      duration: 0.35,
                      type: 'spring',
                      stiffness: 500,
                      damping: 25,
                    }}
                  />
                </div>
              )
            })}
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div className="dot-matrix-legend">
        <span className="dot-matrix-legend-item">
          <span className="dot-matrix-dot filled" style={{ '--dot-color': 'var(--color-accent)' }} />
          Surveyed
        </span>
        <span className="dot-matrix-legend-item">
          <span className="dot-matrix-dot empty" />
          Not surveyed
        </span>
      </div>
    </div>
  )
}
