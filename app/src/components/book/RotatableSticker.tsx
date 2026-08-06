import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import s from './RotatableSticker.module.css'

/**
 * Lightweight drag-to-tilt for sticker PNGs (feels 3D without a real mesh).
 * Short press without drag still fires onClick.
 */
export default function RotatableSticker({
  src,
  alt = '',
  className,
  onClick,
}: {
  src: string
  alt?: string
  className?: string
  onClick?: () => void
}) {
  const [rx, setRx] = useState(0)
  const [ry, setRy] = useState(0)
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null)
  const moved = useRef(false)

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, rx, ry }
    moved.current = false
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true
    setRy(Math.max(-38, Math.min(38, drag.current.ry + dx * 0.35)))
    setRx(Math.max(-28, Math.min(28, drag.current.rx - dy * 0.35)))
  }

  function onPointerUp() {
    const wasDrag = moved.current
    drag.current = null
    if (!wasDrag && onClick) onClick()
  }

  return (
    <div
      className={`${s.stage} ${className ?? ''}`}
      style={{ transform: `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      } : undefined}
    >
      <img src={src} alt={alt} className={s.img} draggable={false} />
    </div>
  )
}
