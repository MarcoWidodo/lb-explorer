import { useData } from '../../context/DataProvider'

/**
 * Country chips. `available` = ISO2 codes that can be chosen; others are shown disabled
 * (e.g. countries where the question was not asked).
 */
export default function CountryPicker({ countries, available, selected, onChange, label = 'Countries', max }) {
  const { countryName } = useData()
  const avail = new Set(available || countries)
  function toggle(code) {
    if (!avail.has(code)) return
    if (selected.includes(code)) onChange(selected.filter(c => c !== code))
    else if (!max || selected.length < max) onChange([...selected, code])
  }
  return (
    <div className="country-picker">
      <div className="country-picker-header">
        <label className="picker-label">{label}{max ? <span className="picker-label-hint"> (up to {max})</span> : null}</label>
        <div className="country-picker-actions">
          {!max && <button className="country-action-btn" onClick={() => onChange(countries.filter(c => avail.has(c)))}>All</button>}
          <button className="country-action-btn" onClick={() => onChange([])}>None</button>
        </div>
      </div>
      <div className="country-grid">
        {countries.map(code => {
          const on = selected.includes(code)
          const dis = !avail.has(code)
          return (
            <button key={code} className={`country-chip${on ? ' active' : ''}${dis ? ' disabled' : ''}`} onClick={() => toggle(code)}
                    disabled={dis} aria-pressed={on} title={dis ? `${countryName(code)}: not asked` : countryName(code)}
                    style={{ '--chip-color': `var(--country-${code})` }}>
              <span className="country-chip-dot" />
              <span className="country-chip-code">{code}</span>
              <span className="country-chip-name">{countryName(code)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
