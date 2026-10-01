import { Link } from 'react-router-dom'
import { Sun, Moon, Mail, Info } from 'lucide-react'
import { useTheme } from '../../context/ThemeProvider'
import { useData } from '../../context/DataProvider'

export default function Header() {
  const { isDark, toggle } = useTheme()
  const { manifest } = useData()
  const s = manifest.survey
  return (
    <header className="app-header">
      <a href="#main" className="skip-link">Skip to content</a>
      <Link to="/" className="app-header-title"><h1>{s.name} Explorer</h1></Link>
      <div className="header-actions">
        <Link to="/about" className="theme-btn" aria-label="About the data" title="About the data"><Info size={17} /></Link>
        <a href={`mailto:${s.contact}?subject=${encodeURIComponent(`${s.short} Explorer — issue report`)}`}
           className="theme-btn" aria-label="Report an issue" title="Report an issue"><Mail size={17} /></a>
        <button onClick={toggle} className="theme-btn" aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  )
}
