import { NavLink } from 'react-router-dom'
import { BarChart3, TrendingUp, Globe2, GitCompareArrows, Home } from 'lucide-react'

const ITEMS = [
  { path: '/', label: 'Home', icon: Home, end: true },
  { path: '/explore', label: 'Single Wave', icon: BarChart3 },
  { path: '/trends', label: 'Time Series', icon: TrendingUp },
  { path: '/map', label: 'Map', icon: Globe2 },
  { path: '/correlations', label: 'Correlations', icon: GitCompareArrows },
]

export default function Dock() {
  return (
    <nav className="dock-wrap" aria-label="Main navigation">
      <div className="dock">
        {ITEMS.map(({ path, label, icon: Icon, end }) => (
          <NavLink key={path} to={path} end={end} className={({ isActive }) => `dock-item${isActive ? ' active' : ''}`}>
            {({ isActive }) => (<><Icon size={19} strokeWidth={isActive ? 2.2 : 1.6} /><span className="dock-label">{label}</span></>)}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
