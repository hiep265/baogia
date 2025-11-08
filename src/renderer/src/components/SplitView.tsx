import { PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  initialLeft?: number
  minLeft?: number
  minRight?: number
  left: React.ReactNode
  right: React.ReactNode
}

export default function SplitView({ initialLeft = 360, minLeft = 240, minRight = 360, left, right }: PropsWithChildren<Props>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [leftWidth, setLeftWidth] = useState<number>(initialLeft)
  const draggingRef = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    draggingRef.current = true
    e.preventDefault()
  }, [])

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingRef.current) return
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let w = e.clientX - rect.left
    const maxLeft = rect.width - minRight
    if (w < minLeft) w = minLeft
    if (w > maxLeft) w = maxLeft
    setLeftWidth(w)
  }, [minLeft, minRight])

  const onMouseUp = useCallback(() => {
    draggingRef.current = false
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  return (
    <div className="splitview" ref={containerRef}>
      <div className="split-left" style={{ width: leftWidth }}>{left}</div>
      <div className="split-resizer" style={{ left: leftWidth }} onMouseDown={onMouseDown} />
      <div className="split-right" style={{ left: leftWidth + 6 }}>{right}</div>
    </div>
  )
}
