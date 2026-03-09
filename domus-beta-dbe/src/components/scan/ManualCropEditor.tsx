'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { orderPoints } from './documentProcessor'

export type ManualCropEditorProps = {
  imageUrl: string
  imageWidth: number
  imageHeight: number
  /** Esquinas iniciales [tl, tr, br, bl]; si no se pasan, se usa rectángulo con margen. */
  initialCorners?: number[][]
  onApply: (corners: number[][]) => void
  onCancel?: () => void
}

const HANDLE_R = 14
const MARGIN = 0.08

function defaultCorners(w: number, h: number): number[][] {
  const mx = w * MARGIN
  const my = h * MARGIN
  return orderPoints([
    [mx, my],
    [w - mx, my],
    [w - mx, h - my],
    [mx, h - my],
  ])
}

export function ManualCropEditor({ imageUrl, imageWidth, imageHeight, initialCorners, onApply, onCancel }: ManualCropEditorProps) {
  const [corners, setCorners] = useState<number[][]>(() => {
    if (initialCorners && initialCorners.length === 4) return initialCorners.map((p) => [p[0], p[1]])
    if (imageWidth > 0 && imageHeight > 0) return defaultCorners(imageWidth, imageHeight)
    return []
  })
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    if (imageWidth > 0 && imageHeight > 0) {
      setCorners((prev) => {
        if (initialCorners && initialCorners.length === 4) return initialCorners.map((p) => [p[0], p[1]])
        if (prev.length === 4) return prev
        return defaultCorners(imageWidth, imageHeight)
      })
    }
  }, [imageWidth, imageHeight, initialCorners])
  const [imageRect, setImageRect] = useState<{
    left: number
    top: number
    scaleX: number
    scaleY: number
    containerLeft: number
    containerTop: number
  } | null>(null)
  const draggingRef = useRef<number | null>(null)

  const measureRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const container = measureRef.current
    if (!container || !imageWidth || !imageHeight) return
    const measure = () => {
      const r = container.getBoundingClientRect()
      const rw = r.width
      const rh = r.height
      if (rw <= 0 || rh <= 0) return
      const scale = Math.min(rw / imageWidth, rh / imageHeight, 1)
      const dw = imageWidth * scale
      const dh = imageHeight * scale
      setDisplaySize({ w: dw, h: dh })
      setImageRect({
        left: (rw - dw) / 2,
        top: (rh - dh) / 2,
        scaleX: dw / imageWidth,
        scaleY: dh / imageHeight,
        containerLeft: r.left,
        containerTop: r.top,
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    return () => ro.disconnect()
  }, [imageUrl, imageWidth, imageHeight])

  const toDisplay = useCallback(
    (px: number, py: number): [number, number] => {
      if (!imageRect) return [px, py]
      return [imageRect.left + px * imageRect.scaleX, imageRect.top + py * imageRect.scaleY]
    },
    [imageRect]
  )

  /** Convierte coordenadas cliente (evento) a coordenadas de imagen. */
  const toImageFromClient = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      if (!imageRect) return [0, 0]
      const dx = clientX - imageRect.containerLeft
      const dy = clientY - imageRect.containerTop
      return [
        Math.round((dx - imageRect.left) / imageRect.scaleX),
        Math.round((dy - imageRect.top) / imageRect.scaleY),
      ]
    },
    [imageRect]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, index: number) => {
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      draggingRef.current = index
    },
    []
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingRef.current === null || !imageRect) return
      const [ix, iy] = toImageFromClient(e.clientX, e.clientY)
      const w = imageWidth
      const h = imageHeight
      const x = Math.max(0, Math.min(w, ix))
      const y = Math.max(0, Math.min(h, iy))
      setCorners((prev) => {
        const next = prev.map((p, i) => (i === draggingRef.current! ? [x, y] : p))
        return next
      })
    },
    [imageRect, toImageFromClient, imageWidth, imageHeight]
  )

  const handlePointerUp = useCallback(() => {
    draggingRef.current = null
  }, [])

  const handleApply = useCallback(() => {
    const ordered = orderPoints(corners.map((p) => [p[0], p[1]]))
    onApply(ordered)
  }, [corners, onApply])

  return (
    <div
      className="manualCropEditorWrap"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: 0,
        background: '#e5e5ea',
      }}
    >
      <div
        ref={measureRef}
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          touchAction: 'none',
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {!displaySize || !imageRect ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6e6e73', fontSize: '0.9rem' }}>
            Cargando…
          </div>
        ) : (
          <>
        <img
          src={imageUrl}
          alt="Recorte"
          style={{
            position: 'absolute',
            left: imageRect.left,
            top: imageRect.top,
            width: displaySize.w,
            height: displaySize.h,
            pointerEvents: 'none',
          }}
        />
        <svg
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          <polygon
            points={corners.map((p) => toDisplay(p[0], p[1]).join(',')).join(' ')}
            fill="none"
            stroke="var(--primary, #0f3d91)"
            strokeWidth={2.5}
          />
        </svg>
        {corners.map((p, i) => {
          const [dx, dy] = toDisplay(p[0], p[1])
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              aria-label={`Esquina ${i + 1}`}
              onPointerDown={(e) => handlePointerDown(e, i)}
              style={{
                position: 'absolute',
                left: dx - HANDLE_R,
                top: dy - HANDLE_R,
                width: HANDLE_R * 2,
                height: HANDLE_R * 2,
                borderRadius: '50%',
                background: 'var(--primary, #0f3d91)',
                border: '2px solid #fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                cursor: 'grab',
                touchAction: 'none',
              }}
            />
          )
        })}
          </>
        )}
      </div>
      <div
        style={{
          flexShrink: 0,
          padding: '12px 16px',
          background: '#fff',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 10,
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button type="button" className="btn btnPrimary" onClick={handleApply}>
          Aplicar recorte
        </button>
        {onCancel && (
          <button type="button" className="btn btnGhost" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
