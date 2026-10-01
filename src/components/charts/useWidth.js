import { useState, useLayoutEffect, useRef } from 'react'

/** Width of a container element, updated on resize. */
export function useWidth(initial = 720) {
  const ref = useRef(null)
  const [width, setWidth] = useState(initial)
  useLayoutEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const update = () => setWidth(Math.max(280, Math.floor(el.getBoundingClientRect().width)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

let uidCounter = 0
export function useUid(prefix = 'c') {
  const ref = useRef(null)
  if (ref.current == null) ref.current = `${prefix}${++uidCounter}`
  return ref.current
}
