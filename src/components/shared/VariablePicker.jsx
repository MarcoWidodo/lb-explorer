import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, ChevronDown } from 'lucide-react'

export const TYPE_LABEL = { ordinal: 'scale', binary: 'two answers', continuous: 'numeric', nominal: 'categories' }

/**
 * Searchable, sectioned picker.
 * items: [{ id, q (question text), s (section), t (type), code (display id) }]
 * sections: section names in questionnaire order
 */
export default function VariablePicker({ items, sections, value, onChange, label = 'Variable', showType = true }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [section, setSection] = useState('_all')
  const ref = useRef(null)

  useEffect(() => {
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [])

  const secs = useMemo(() => (sections || [...new Set(items.map(i => i.s))]).filter(s => items.some(i => i.s === s)), [items, sections])
  const filtered = useMemo(() => {
    let list = section === '_all' ? items : items.filter(i => i.s === section)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(i => (i.code || i.id).toLowerCase().includes(q) || i.q.toLowerCase().includes(q))
    return list
  }, [items, section, search])

  const sel = items.find(i => i.id === value)

  return (
    <div className="picker-wrap" ref={ref}>
      <label className="picker-label">{label}</label>
      <button className="picker-trigger" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox">
        <span className="picker-trigger-text">
          {sel ? <>{sel.code !== null && <span className="picker-trigger-code">{sel.code || sel.id}</span>}{sel.q}</> : 'Select…'}
        </span>
        <ChevronDown size={15} className={`picker-chevron${open ? ' open' : ''}`} />
      </button>
      {open && (
        <div className="picker-dropdown">
          <div className="picker-search-wrap">
            <Search size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <input type="text" className="picker-search" placeholder="Search question text or number…" value={search}
                   onChange={e => setSearch(e.target.value)} autoFocus />
          </div>
          <div className="picker-categories">
            <button className={`picker-cat-btn${section === '_all' ? ' active' : ''}`} onClick={() => setSection('_all')}>All ({items.length})</button>
            {secs.map(s => (
              <button key={s} className={`picker-cat-btn${section === s ? ' active' : ''}`} onClick={() => setSection(s)}>{s}</button>
            ))}
          </div>
          <div className="picker-list" role="listbox">
            {filtered.length === 0 && <div className="picker-empty">No questions match.</div>}
            {filtered.map(i => (
              <button key={i.id} role="option" aria-selected={i.id === value}
                      className={`picker-option${i.id === value ? ' active' : ''}`}
                      onClick={() => { onChange(i.id); setOpen(false); setSearch('') }}>
                {i.code !== null && <span className="picker-option-name">{i.code || i.id}</span>}
                <span className="picker-option-label">{i.q}</span>
                {showType && i.t && <span className="picker-option-type">{TYPE_LABEL[i.t] || i.t}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
