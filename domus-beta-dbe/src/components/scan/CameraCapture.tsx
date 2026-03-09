'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { orderPoints, cornerDelta } from './documentProcessor'

export type CaptureMetrics = { sharpness: number; motion: number; brightness?: number }

export type CameraCaptureProps = {
  onCapture: (blob: Blob, metrics?: CaptureMetrics) => void
  onError?: (message: string) => void
  disabled?: boolean
  /** Detecta esquinas del documento en el frame para dibujar overlay en vivo (tipo Genius Scan) */
  onDetectCorners?: (canvas: HTMLCanvasElement) => Promise<number[][] | null>
  /** Si > 0, tras esta cantidad de ms con documento estable se auto-toma la foto (Genius Scan style). 0 = desactivado */
  autoCaptureMs?: number
  /** Umbral mínimo de nitidez (var Laplacian) para permitir captura. 0 = desactivado. */
  focusSharpnessThreshold?: number
  /** Umbral máximo de movimiento (meanAbsDiff) para considerar estable. 0 = desactivado. */
  motionThreshold?: number
  /** Brillo mínimo en ROI (media 0-255). Por debajo: "poca luz". 0 = desactivado. */
  brightnessMinThreshold?: number
  /** Número de frames consecutivos estables para habilitar captura (gating). */
  stableFramesRequired?: number
  /** Si > 1, captura N frames en ~300ms y usa el más nítido (best-shot). 1 = una sola toma. */
  bestShotFrames?: number
  /** Frames con contorno estable (IoU/corner delta) antes de mostrar overlay y permitir captura. */
  contourStableFramesRequired?: number
}

const AUTO_CAPTURE_COOLDOWN_MS = 3500
const STABLE_FRAMES_REQUIRED_DEFAULT = 4
const BRIGHTNESS_MIN_DEFAULT = 40
/** ~10–15 FPS para overlay estable (match Genius). */
const OVERLAY_FPS_INTERVAL_MS = 85
const FOCUS_SHARPNESS_DEFAULT = 80
const MOTION_THRESHOLD_DEFAULT = 40
const GATING_STEP = 4
const BEST_SHOT_INTERVAL_MS = 80
const TARGET_W = 1920
const TARGET_H = 1080
const CORNER_DELTA_MAX_PX = 15

function grayFromImageData(data: Uint8ClampedArray, w: number, h: number, step: number): Uint8Array {
  const n = Math.ceil(w / step) * Math.ceil(h / step)
  const out = new Uint8Array(n)
  let idx = 0
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4
      out[idx++] = (data[i] + data[i + 1] + data[i + 2]) / 3
    }
  }
  return out
}

function laplacianVariance(gray: Uint8Array, w: number, h: number, step: number): number {
  const cols = Math.ceil(w / step)
  const rows = Math.ceil(h / step)
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const i = y * cols + x
      const L =
        4 * gray[i] -
        gray[i - 1] -
        gray[i + 1] -
        gray[i - cols] -
        gray[i + cols]
      sum += L
      sumSq += L * L
      n++
    }
  }
  if (n === 0) return 0
  const mean = sum / n
  return sumSq / n - mean * mean
}

function meanAbsDiff(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) return 1e9
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i])
  return sum / a.length
}

function meanBrightness(gray: Uint8Array): number {
  if (gray.length === 0) return 0
  let sum = 0
  for (let i = 0; i < gray.length; i++) sum += gray[i]
  return sum / gray.length
}

function roiFromCorners(ordered: number[][]): { x: number; y: number; w: number; h: number } {
  const xs = ordered.map((p) => p[0])
  const ys = ordered.map((p) => p[1])
  const x = Math.max(0, Math.floor(Math.min(...xs)))
  const y = Math.max(0, Math.floor(Math.min(...ys)))
  const x2 = Math.ceil(Math.max(...xs))
  const y2 = Math.ceil(Math.max(...ys))
  return { x, y, w: Math.max(20, x2 - x), h: Math.max(20, y2 - y) }
}

function sharpnessFromCanvas(ctx: CanvasRenderingContext2D, w: number, h: number, step: number): number {
  const data = ctx.getImageData(0, 0, w, h).data
  const gray = grayFromImageData(data, w, h, step)
  return laplacianVariance(gray, w, h, step)
}

export function CameraCapture({
  onCapture,
  onError,
  disabled,
  onDetectCorners,
  autoCaptureMs = 1200,
  focusSharpnessThreshold = FOCUS_SHARPNESS_DEFAULT,
  motionThreshold = MOTION_THRESHOLD_DEFAULT,
  stableFramesRequired = STABLE_FRAMES_REQUIRED_DEFAULT,
  bestShotFrames = 1,
  contourStableFramesRequired = 3,
  brightnessMinThreshold = BRIGHTNESS_MIN_DEFAULT,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stableSinceRef = useRef<number>(0)
  const lastAutoCaptureRef = useRef<number>(0)
  const perimeterStartRef = useRef<number>(0)
  const prevGrayRef = useRef<Uint8Array | null>(null)
  const prevRoiGrayRef = useRef<Uint8Array | null>(null)
  const stableCountRef = useRef<number>(0)
  const lastCornersRef = useRef<number[][] | null>(null)
  const smoothedCornersRef = useRef<number[][] | null>(null)
  const contourStableCountRef = useRef<number>(0)
  const lastSharpnessRef = useRef<number>(0)
  const lastMotionRef = useRef<number>(0)
  const lastBrightnessRef = useRef<number>(0)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [canCapture, setCanCapture] = useState(true)
  const [lowLight, setLowLight] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const PERIMETER_DURATION_MS = Math.max(800, autoCaptureMs - 200)
  const gatingEnabled = focusSharpnessThreshold > 0 && motionThreshold > 0
  const useBestShot = bestShotFrames > 1
  const brightnessEnabled = brightnessMinThreshold > 0
  const interval = OVERLAY_FPS_INTERVAL_MS

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (disabled) return
    let cancelled = false
    setStatus('loading')
    setErrorMessage('')
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: TARGET_W, min: 1280 },
          height: { ideal: TARGET_H, min: 720 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const track = stream.getVideoTracks()[0]
        const caps = track?.getCapabilities?.()
        if (caps) {
          if ((caps as any).torch) setTorchAvailable(true)
          const advanced: Array<{ focusMode?: string; exposureMode?: string }> = []
          if (typeof (caps as any).focusMode !== 'undefined' && (caps as any).focusMode?.includes?.('continuous')) {
            advanced.push({ focusMode: 'continuous' })
          }
          if (typeof (caps as any).exposureMode !== 'undefined' && (caps as any).exposureMode?.includes?.('continuous')) {
            advanced.push({ exposureMode: 'continuous' })
          }
          if (advanced.length) {
            track.applyConstraints?.({ advanced: advanced as MediaTrackConstraintSet[] }).catch(() => {})
          }
        }
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          video.play().then(() => setStatus('ready')).catch(() => setStatus('error'))
        } else {
          setStatus('ready')
        }
      })
      .catch((err) => {
        if (cancelled) return
        const msg = err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
          ? 'Se necesita permiso para usar la cámara.'
          : err?.message || 'No se pudo acceder a la cámara.'
        setStatus('error')
        setErrorMessage(msg)
        onError?.(msg)
      })
    return () => {
      cancelled = true
      stopStream()
    }
  }, [disabled, onError, stopStream])

  const capture = useCallback(() => {
    const video = videoRef.current
    if (!video || !streamRef.current || status !== 'ready') return
    if (gatingEnabled && !canCapture) return
    const w = video.videoWidth
    const h = video.videoHeight
    if (w === 0 || h === 0) return

    const getMetrics = (): CaptureMetrics => ({
      sharpness: lastSharpnessRef.current,
      motion: lastMotionRef.current,
      brightness: lastBrightnessRef.current,
    })
    const doCapture = (done: (blob: Blob, m?: CaptureMetrics) => void) => {
      const track = streamRef.current?.getVideoTracks()?.[0]
      const ImageCaptureCtor = typeof (window as any).ImageCapture !== 'undefined' ? (window as any).ImageCapture : null
      const onDone = (b: Blob) => done(b, getMetrics())
      if (ImageCaptureCtor && track) {
        try {
          const cap = new ImageCaptureCtor(track)
          cap.takePhoto().then((blob: Blob) => onDone(blob)).catch(() => fallbackCanvas(onDone))
        } catch {
          fallbackCanvas(onDone)
        }
      } else {
        fallbackCanvas(onDone)
      }
    }

    const fallbackCanvas = (done: (blob: Blob, m?: CaptureMetrics) => void) => {
      let canvas = canvasRef.current
      if (!canvas) {
        canvas = document.createElement('canvas')
        canvasRef.current = canvas
      }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, w, h)
      canvas.toBlob((blob) => { if (blob) done(blob, getMetrics()) }, 'image/jpeg', 0.92)
    }

    if (useBestShot && bestShotFrames > 1) {
      const count = Math.min(5, Math.max(2, bestShotFrames))
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = w
      tempCanvas.height = h
      const tctx = tempCanvas.getContext('2d')
      if (!tctx) {
        doCapture(onCapture)
        return
      }
      const step = GATING_STEP
      const frames: { data: ImageData; sharpness: number }[] = []
      let captured = 0
      const schedule = (i: number) => {
        setTimeout(() => {
          tctx.drawImage(video, 0, 0, w, h)
          const data = tctx.getImageData(0, 0, w, h)
          const gray = grayFromImageData(data.data, w, h, step)
          const sh = laplacianVariance(gray, w, h, step)
          frames.push({ data, sharpness: sh })
          captured++
          if (captured < count) schedule(captured)
          else {
            const best = frames.reduce((a, b) => (a.sharpness >= b.sharpness ? a : b))
            const c = document.createElement('canvas')
            c.width = w
            c.height = h
            const cx = c.getContext('2d')
            if (cx) {
              cx.putImageData(best.data, 0, 0)
              c.toBlob((blob) => { if (blob) onCapture(blob, { sharpness: lastSharpnessRef.current, motion: lastMotionRef.current }) }, 'image/jpeg', 0.92)
            }
          }
        }, i * BEST_SHOT_INTERVAL_MS)
      }
      schedule(0)
    } else {
      doCapture((b, m) => onCapture(b, m))
    }
  }, [status, onCapture, gatingEnabled, canCapture, useBestShot, bestShotFrames])

  useEffect(() => {
    if (status !== 'ready' || !onDetectCorners || !videoRef.current || !containerRef.current || !overlayCanvasRef.current) return
    const video = videoRef.current
    const container = containerRef.current
    const overlay = overlayCanvasRef.current
    let rafId = 0
    let lastRun = 0
    /** Smoothing temporal: alpha 0.2–0.35 (más bajo = más lento, match Genius). */
    const CORNER_EMA_ALPHA = 0.25

    const run = () => {
      rafId = requestAnimationFrame(run)
      const now = Date.now()
      if (now - lastRun < interval) return
      lastRun = now
      if (video.videoWidth === 0 || video.videoHeight === 0) return
      const vw = video.videoWidth
      const vh = video.videoHeight
      const cw = container.clientWidth
      const ch = container.clientHeight
      if (cw === 0 || ch === 0) return
      const temp = document.createElement('canvas')
      temp.width = vw
      temp.height = vh
      const tctx = temp.getContext('2d')
      if (!tctx) return
      tctx.drawImage(video, 0, 0, vw, vh)
      onDetectCorners(temp).then((pts) => {
        if (!pts || pts.length !== 4) {
          lastCornersRef.current = null
          smoothedCornersRef.current = null
          contourStableCountRef.current = 0
          prevRoiGrayRef.current = null
          stableSinceRef.current = 0
          perimeterStartRef.current = 0
          setCanCapture(false)
          setLowLight(false)
          overlay.width = cw
          overlay.height = ch
          const ctx = overlay.getContext('2d')
          if (ctx) ctx.clearRect(0, 0, cw, ch)
          return
        }
        const ordered = orderPoints(pts)
        if (lastCornersRef.current) {
          const delta = cornerDelta(lastCornersRef.current, ordered)
          if (delta < CORNER_DELTA_MAX_PX) contourStableCountRef.current++
          else contourStableCountRef.current = 0
        } else {
          contourStableCountRef.current = 0
        }
        lastCornersRef.current = ordered
        const contourStable = contourStableCountRef.current >= contourStableFramesRequired
        if (!contourStable) {
          prevRoiGrayRef.current = null
          setCanCapture(false)
          overlay.width = cw
          overlay.height = ch
          const ctx = overlay.getContext('2d')
          if (ctx) ctx.clearRect(0, 0, cw, ch)
          return
        }
        const prevSmoothed = smoothedCornersRef.current
        const smoothed: number[][] = prevSmoothed
          ? ordered.map((p, i) => [
              CORNER_EMA_ALPHA * p[0] + (1 - CORNER_EMA_ALPHA) * prevSmoothed[i][0],
              CORNER_EMA_ALPHA * p[1] + (1 - CORNER_EMA_ALPHA) * prevSmoothed[i][1],
            ])
          : ordered.map((p) => [p[0], p[1]])
        smoothedCornersRef.current = smoothed
        if (gatingEnabled) {
          try {
            const roi = roiFromCorners(smoothed)
            const rx = Math.min(roi.x, vw - roi.w)
            const ry = Math.min(roi.y, vh - roi.h)
            const rw = Math.min(roi.w, vw - rx)
            const rh = Math.min(roi.h, vh - ry)
            if (rw >= 20 && rh >= 20) {
              const roiData = tctx.getImageData(rx, ry, rw, rh)
              const roiGray = grayFromImageData(roiData.data, rw, rh, GATING_STEP)
              const sharpness = laplacianVariance(roiGray, rw, rh, GATING_STEP)
              const motion = prevRoiGrayRef.current ? meanAbsDiff(prevRoiGrayRef.current, roiGray) : 0
              const brightness = meanBrightness(roiGray)
              prevRoiGrayRef.current = roiGray
              lastSharpnessRef.current = sharpness
              lastMotionRef.current = motion
              lastBrightnessRef.current = brightness
              const brightOk = !brightnessEnabled || brightness >= brightnessMinThreshold
              if (!brightOk) setLowLight(true)
              else setLowLight(false)
              const ok =
                brightOk &&
                sharpness >= focusSharpnessThreshold &&
                motion <= motionThreshold
              if (ok) stableCountRef.current++
              else stableCountRef.current = 0
              const newCanCapture = stableCountRef.current >= stableFramesRequired && brightOk
              setCanCapture((prev) => (prev !== newCanCapture ? newCanCapture : prev))
            } else {
              setCanCapture(false)
            }
          } catch {
            setCanCapture(true)
          }
        } else {
          setCanCapture(true)
        }
        if (perimeterStartRef.current === 0) perimeterStartRef.current = now
        const allowAuto = !gatingEnabled || stableCountRef.current >= stableFramesRequired
        if (autoCaptureMs > 0 && !disabled && allowAuto) {
          const t = stableSinceRef.current
          if (t === 0) stableSinceRef.current = now
          else if (now - t >= autoCaptureMs && now - lastAutoCaptureRef.current >= AUTO_CAPTURE_COOLDOWN_MS) {
            lastAutoCaptureRef.current = now
            stableSinceRef.current = 0
            if (useBestShot && bestShotFrames > 1) {
              const count = Math.min(5, Math.max(2, bestShotFrames))
              const tempCanvas = document.createElement('canvas')
              tempCanvas.width = vw
              tempCanvas.height = vh
              const tctx = tempCanvas.getContext('2d')
              if (tctx) {
                const frames: { data: ImageData; sharpness: number }[] = []
                let idx = 0
                const schedule = () => {
                  setTimeout(() => {
                    tctx.drawImage(video, 0, 0, vw, vh)
                    const data = tctx.getImageData(0, 0, vw, vh)
                    const gray = grayFromImageData(data.data, vw, vh, GATING_STEP)
                    frames.push({ data, sharpness: laplacianVariance(gray, vw, vh, GATING_STEP) })
                    idx++
                    if (idx < count) schedule()
                    else {
                      const best = frames.reduce((a, b) => (a.sharpness >= b.sharpness ? a : b))
                      const c = document.createElement('canvas')
                      c.width = vw
                      c.height = vh
                      const cx = c.getContext('2d')
                      if (cx) {
                        cx.putImageData(best.data, 0, 0)
                        c.toBlob((blob) => { if (blob) onCapture(blob, { sharpness: lastSharpnessRef.current, motion: lastMotionRef.current }) }, 'image/jpeg', 0.92)
                      }
                    }
                  }, idx * BEST_SHOT_INTERVAL_MS)
                }
                schedule()
              }
            } else {
              const c = document.createElement('canvas')
              c.width = vw
              c.height = vh
              const cx = c.getContext('2d')
              if (cx) {
                cx.drawImage(video, 0, 0, vw, vh)
                c.toBlob((blob) => { if (blob) onCapture(blob, { sharpness: lastSharpnessRef.current, motion: lastMotionRef.current }) }, 'image/jpeg', 0.92)
              }
            }
          }
        }
        const scale = Math.max(cw / vw, ch / vh)
        const offsetX = (cw - vw * scale) / 2
        const offsetY = (ch - vh * scale) / 2
        const transform = (x: number, y: number) => [x * scale + offsetX, y * scale + offsetY]
        overlay.width = cw
        overlay.height = ch
        const ctx = overlay.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, cw, ch)
        const [p0, p1, p2, p3] = smoothed.map((p) => transform(p[0], p[1]))
        ctx.fillStyle = 'rgba(0, 0, 0, 0.78)'
        ctx.fillRect(0, 0, cw, ch)
        ctx.globalCompositeOperation = 'destination-out'
        ctx.fillStyle = 'rgba(255, 255, 255, 1)'
        ctx.beginPath()
        ctx.moveTo(p0[0], p0[1])
        ctx.lineTo(p1[0], p1[1])
        ctx.lineTo(p2[0], p2[1])
        ctx.lineTo(p3[0], p3[1])
        ctx.closePath()
        ctx.fill()
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = 'rgba(255, 140, 0, 0.9)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(p0[0], p0[1])
        ctx.lineTo(p1[0], p1[1])
        ctx.lineTo(p2[0], p2[1])
        ctx.lineTo(p3[0], p3[1])
        ctx.closePath()
        ctx.stroke()
        const elapsed = now - perimeterStartRef.current
        const progress = Math.min(1, elapsed / PERIMETER_DURATION_MS)
        const dist = (a: number[], b: number[]) => Math.hypot(b[0] - a[0], b[1] - a[1])
        const segs = [p0, p1, p2, p3]
        const totalLen = segs.reduce((acc, p, i) => acc + dist(p, segs[(i + 1) % 4]), 0)
        let run = progress * totalLen
        let ix = 0
        while (ix < 4 && run > 0) {
          const d = dist(segs[ix], segs[(ix + 1) % 4])
          if (run <= d) {
            const t = run / d
            const q = [segs[ix][0] + t * (segs[(ix + 1) % 4][0] - segs[ix][0]), segs[ix][1] + t * (segs[(ix + 1) % 4][1] - segs[ix][1])]
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
            ctx.lineWidth = 3
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.beginPath()
            ctx.moveTo(p0[0], p0[1])
            for (let j = 0; j < ix; j++) ctx.lineTo(segs[j + 1][0], segs[j + 1][1])
            ctx.lineTo(q[0], q[1])
            ctx.stroke()
            break
          }
          run -= d
          ix++
        }
        if (progress >= 1) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(p0[0], p0[1])
          ctx.lineTo(p1[0], p1[1])
          ctx.lineTo(p2[0], p2[1])
          ctx.lineTo(p3[0], p3[1])
          ctx.closePath()
          ctx.stroke()
        }
      })
    }
    run()
    return () => cancelAnimationFrame(rafId)
  }, [status, onDetectCorners, autoCaptureMs, disabled, onCapture, gatingEnabled, stableFramesRequired, focusSharpnessThreshold, motionThreshold, useBestShot, bestShotFrames, contourStableFramesRequired])

  return (
    <div className="scanCameraWrap">
      <div ref={containerRef} className="scanVideoContainer">
        <video
          ref={videoRef}
          className="scanVideo"
          playsInline
          muted
          style={{ display: status === 'ready' ? 'block' : 'none' }}
        />
        {status === 'ready' && (
          <canvas
            ref={overlayCanvasRef}
            className="scanDocumentOverlayCanvas"
            aria-hidden="true"
          />
        )}
        {status === 'loading' && <div className="scanCameraPlaceholder">Activando cámara…</div>}
        {status === 'error' && (
          <div className="scanCameraPlaceholder scanCameraError">
            {errorMessage || 'Error de cámara'}
          </div>
        )}
      </div>
      {gatingEnabled && status === 'ready' && !canCapture && (
        <p className="muted" style={{ margin: 8, fontSize: 12, textAlign: 'center' }}>
          {lowLight ? 'Poca luz. Acerca más o activa el flash.' : 'Mantén el teléfono quieto'}
        </p>
      )}
      <div className="scanCameraActions" style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {torchAvailable && status === 'ready' && (
          <button
            type="button"
            className={torchOn ? 'btn btnPrimary btnSm' : 'btn btnGhost btnSm'}
            onClick={() => {
              const track = streamRef.current?.getVideoTracks()?.[0]
              if (!track) return
              const next = !torchOn
              track.applyConstraints?.({ advanced: [{ torch: next }] as unknown as MediaTrackConstraintSet[] }).then(() => setTorchOn(next)).catch(() => {})
            }}
            aria-label={torchOn ? 'Apagar flash' : 'Encender flash'}
          >
            {torchOn ? 'Flash on' : 'Flash'}
          </button>
        )}
        <button
          type="button"
          className="btn btnPrimary scanCaptureBtn"
          disabled={status !== 'ready' || disabled || (gatingEnabled && !canCapture)}
          onClick={capture}
          aria-label="Capturar foto"
        >
          Capturar
        </button>
      </div>
    </div>
  )
}
