import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import Header from './components/layout/Header'
import Dock from './components/layout/Dock'
import { useData } from './context/DataProvider'

const Home = lazy(() => import('./views/Home'))
const SingleWaveExplorer = lazy(() => import('./views/SingleWaveExplorer'))
const TimeSeriesExplorer = lazy(() => import('./views/TimeSeriesExplorer'))
const MapExplorer = lazy(() => import('./views/MapExplorer'))
const CorrelationsExplorer = lazy(() => import('./views/CorrelationsExplorer'))
const About = lazy(() => import('./views/About'))

function Screen({ children }) {
  return <div className="loading-screen">{children}</div>
}

export default function App() {
  const { loading, error } = useData()
  if (loading) return <Screen><div className="spinner" /><p className="loading-text">Loading…</p></Screen>
  if (error) return (
    <Screen>
      <h2 className="error-title">Unable to load the survey data</h2>
      <p className="loading-text" style={{ maxWidth: 420, textAlign: 'center' }}>{error}</p>
    </Screen>
  )
  return (
    <>
      <Header />
      <main id="main">
        <Suspense fallback={<Screen><div className="spinner" /></Screen>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<SingleWaveExplorer />} />
            <Route path="/trends" element={<TimeSeriesExplorer />} />
            <Route path="/time-series" element={<Navigate to="/trends" replace />} />
            <Route path="/map" element={<MapExplorer />} />
            <Route path="/correlations" element={<CorrelationsExplorer />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <Dock />
    </>
  )
}
