'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraCapture, type CaptureMetrics } from './CameraCapture'
import {
  loadOpenCV,
  processDocumentWithOptions,
  processDocumentWithManualCorners,
  detectDocumentCorners,
  type ScanOutputMode,
  type CaptureLog,
  type ProcessDocumentResult,
} from './documentProcessor'
import { ScanDebugPanel } from './ScanDebugPanel'
import { ManualCropEditor } from './ManualCropEditor'
import { getPreferredCaptureMode, requestPhotoFromFileInput } from './captureProvider'

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development'

export type DocumentScannerProps = {
  onConfirm: (file: File) => void
  onClose: () => void
  maxFiles?: number
  currentCount?: number
}

type ScanMode = 'choose' | 'photo' | 'scan'
type Step = 'choose' | 'capture' | 'preview' | 'manual_crop' | 'processing'

export function DocumentScanner({ onConfirm, onClose, maxFiles = 8, currentCount = 0 }: DocumentScannerProps) {
  const [mode, setMode] = useState<ScanMode>('choose')
  const [step, setStep] = useState<Step>('choose')
  const [rawBlob, setRawBlob] = useState<Blob | null>(null)
  const [rawUrl, setRawUrl] = useState<string>('')
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [processing, setProcessing] = useState(false)
  const [noContourDetected, setNoContourDetected] = useState(false)
  const [outputMode, setOutputMode] = useState<ScanOutputMode>('grayscale')
  const [imageDimensions, setImageDimensions] = useState<{ w: number; h: number } | null>(null)
  const [debugOptions, setDebugOptions] = useState({
    focusSharpnessThreshold: 80,
    motionThreshold: 40,
    claheClipLimit: 2.0,
    stableFramesRequired: 4,
    bestShotFrames: 1,
    contourStableFramesRequired: 3,
    brightnessMinThreshold: 40,
  })
  const [lastCaptureLog, setLastCaptureLog] = useState<{
    sharpness?: number
    motion?: number
    brightness?: number
    contourScore?: number
    textLikenessScore?: number
  } | null>(null)
  const [lastCorners, setLastCorners] = useState<number[][] | null>(null)

  useEffect(() => {
    loadOpenCV().catch(() => {})
  }, [])

  useEffect(() => {
    if (!rawBlob) {
      setRawUrl('')
      return
    }
    const url = URL.createObjectURL(rawBlob)
    setRawUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [rawBlob])

  useEffect(() => {
    if (!capturedBlob) {
      setPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(capturedBlob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [capturedBlob])

  const canAddMore = currentCount < maxFiles
  const useFileCapture = getPreferredCaptureMode() === 'file'

  const runScanPipeline = useCallback(
    (blob: Blob, metrics?: CaptureMetrics): Promise<ProcessDocumentResult | Blob | null> => {
      const useDebug = isDev
      return processDocumentWithOptions(blob, { outputMode }, useDebug)
    },
    [outputMode]
  )

  const handlePhotoCaptured = useCallback(
    (blob: Blob) => {
      setRawBlob(blob)
      if (mode === 'photo') {
        setCapturedBlob(blob)
        setStep('preview')
      } else {
        setRawBlob(blob)
        setStep('processing')
        setProcessing(true)
        setNoContourDetected(false)
        runScanPipeline(blob)
          .then((result) => {
            const processed = result == null ? null : result instanceof Blob ? result : result.blob
            const captureLog = result && typeof result === 'object' && 'captureLog' in result ? (result as ProcessDocumentResult).captureLog : undefined
            const corners = result && typeof result === 'object' && 'corners' in result ? (result as ProcessDocumentResult).corners : undefined
            if (isDev) {
              if (captureLog) setLastCaptureLog({ contourScore: captureLog.contourScore, textLikenessScore: captureLog.textLikenessScore })
              setLastCorners(corners ?? null)
            }
            if (processed) {
              setCapturedBlob(processed)
              setStep('preview')
            } else {
              setNoContourDetected(true)
              const url = URL.createObjectURL(blob)
              const img = new Image()
              img.onload = () => {
                setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight })
                URL.revokeObjectURL(url)
              }
              img.onerror = () => URL.revokeObjectURL(url)
              img.src = url
              setStep('manual_crop')
            }
          })
          .catch(() => {
            setCapturedBlob(blob)
            setStep('preview')
          })
          .finally(() => setProcessing(false))
      }
    },
    [mode, runScanPipeline]
  )

  const handleRequestPhoto = useCallback(() => {
    if (useFileCapture) {
      requestPhotoFromFileInput().then((blob) => {
        if (blob) handlePhotoCaptured(blob)
      })
    } else {
      setStep('capture')
    }
  }, [useFileCapture, handlePhotoCaptured])

  const handleStreamCapture = useCallback(
    (blob: Blob, metrics?: CaptureMetrics) => {
      if (mode === 'photo') {
        setRawBlob(blob)
        setCapturedBlob(blob)
        setStep('preview')
      } else {
        setProcessing(true)
        setNoContourDetected(false)
        if (isDev) setRawBlob(blob)
        runScanPipeline(blob, metrics)
          .then((result) => {
            const processed = result == null ? null : result instanceof Blob ? result : result.blob
            const captureLog = result && typeof result === 'object' && 'captureLog' in result ? (result as ProcessDocumentResult).captureLog : undefined
            const corners = result && typeof result === 'object' && 'corners' in result ? (result as ProcessDocumentResult).corners : undefined
            if (isDev) {
              if (metrics || captureLog) {
                setLastCaptureLog({
                  sharpness: metrics?.sharpness,
                  motion: metrics?.motion,
                  brightness: metrics?.brightness,
                  contourScore: captureLog?.contourScore,
                  textLikenessScore: captureLog?.textLikenessScore,
                })
              }
              setLastCorners(corners ?? null)
            }
            if (processed) {
              setCapturedBlob(processed)
              setStep('preview')
            } else {
              setNoContourDetected(true)
              const img = new Image()
              img.onload = () => {
                setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight })
              }
              img.src = URL.createObjectURL(blob)
              setStep('manual_crop')
            }
          })
          .catch(() => {
            setCapturedBlob(blob)
            setStep('preview')
          })
          .finally(() => setProcessing(false))
      }
    },
    [mode, runScanPipeline]
  )

  const handleManualCropApply = useCallback(
    (corners: number[][]) => {
      if (!rawBlob) return
      setProcessing(true)
      processDocumentWithManualCorners(rawBlob, corners, { outputMode }, isDev)
        .then((result) => {
          const blob = result == null ? null : result instanceof Blob ? result : result.blob
          if (blob) {
            setCapturedBlob(blob)
            setStep('preview')
            setNoContourDetected(false)
          }
        })
        .finally(() => setProcessing(false))
    },
    [rawBlob, outputMode]
  )

  const handleManualCropCancel = useCallback(() => {
    setStep('choose')
    setMode('choose')
    setRawBlob(null)
    setNoContourDetected(false)
    setImageDimensions(null)
  }, [])

  const handleUseImage = useCallback(() => {
    if (!capturedBlob) return
    const file = new File([capturedBlob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' })
    onConfirm(file)
    setCapturedBlob(null)
    setStep('choose')
    setMode('choose')
    setRawBlob(null)
    if (currentCount + 1 >= maxFiles) onClose()
  }, [capturedBlob, onConfirm, onClose, currentCount, maxFiles])

  const handleTakeAnother = useCallback(() => {
    setCapturedBlob(null)
    setNoContourDetected(false)
    setStep('choose')
    setMode('choose')
    setRawBlob(null)
    setImageDimensions(null)
    if (isDev) setLastCorners(null)
  }, [])

  const handleConvertToScan = useCallback(() => {
    if (!rawBlob) return
    setMode('scan')
    setProcessing(true)
    setNoContourDetected(false)
    runScanPipeline(rawBlob)
      .then((result) => {
        const processed = result == null ? null : result instanceof Blob ? result : result.blob
        if (processed) {
          setCapturedBlob(processed)
        } else {
          setNoContourDetected(true)
          const img = new Image()
          img.onload = () => setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight })
          img.src = URL.createObjectURL(rawBlob)
          setStep('manual_crop')
        }
      })
      .catch(() => setCapturedBlob(rawBlob))
      .finally(() => setProcessing(false))
  }, [rawBlob, runScanPipeline])

  const handleDone = useCallback(() => onClose(), [onClose])

  if (step === 'choose') {
    return (
      <div className="scanOverlay" role="dialog" aria-modal="true" aria-labelledby="scan-title" onClick={onClose}>
        <div className="scanPanel scanPanelClean" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn btnGhost btnSm modalClose" aria-label="Cerrar" onClick={onClose}>
            Cerrar
          </button>
          <h2 id="scan-title" className="cardTitle" style={{ margin: 0, color: '#fff' }}>
            Escanear documento
          </h2>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>
            Centra el recibo y toma la foto.
          </p>
          <div className="scanModeButtons" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24, width: '100%', maxWidth: 280 }}>
            <button
              type="button"
              className="btn btnPrimary"
              style={{ minHeight: 52, fontSize: 17 }}
              onClick={() => {
                setMode('photo')
                handleRequestPhoto()
              }}
            >
              Tomar foto
            </button>
            <button
              type="button"
              className="btn btnGhost"
              style={{ minHeight: 52, fontSize: 17, border: '1px solid rgba(255,255,255,0.4)', color: '#fff' }}
              onClick={() => {
                setMode('scan')
                handleRequestPhoto()
              }}
            >
              Escanear
            </button>
          </div>
          {!canAddMore && (
            <p className="muted" style={{ fontSize: 12, marginTop: 16, color: 'rgba(255,255,255,0.7)' }}>
              Máximo {maxFiles} fotos.
            </p>
          )}
          <div className="scanFooter" style={{ marginTop: 'auto' }}>
            <button type="button" className="btn btnGhost btnSm" onClick={handleDone}>
              Listo
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'capture' && !useFileCapture) {
    return (
      <div className="scanOverlay" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="scanPanel" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn btnGhost btnSm modalClose" aria-label="Cerrar" onClick={() => { setStep('choose'); setMode('choose') }}>
            Cerrar
          </button>
          <p className="muted" style={{ margin: '0 0 8px', fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
            Centra el recibo y pulsa Capturar.
          </p>
          {!capturedBlob && (
            <div className="scanOutputMode" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 12 }}>Salida:</span>
              {(['grayscale', 'color', 'bw'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={outputMode === m ? 'btn btnSm btnPrimary' : 'btn btnSm btnGhost'}
                  onClick={() => setOutputMode(m)}
                >
                  {m === 'grayscale' ? 'Gris' : m === 'color' ? 'Color' : 'B/N'}
                </button>
              ))}
            </div>
          )}
          <div className="scanCameraWrap" style={{ position: 'relative' }}>
            {processing && (
              <div className="scanProcessing" aria-live="polite">
                Procesando…
              </div>
            )}
            <CameraCapture
              onCapture={(blob, metrics) => {
                handleStreamCapture(blob, metrics)
              }}
              onError={() => {}}
              disabled={!canAddMore || processing}
              onDetectCorners={detectDocumentCorners}
              focusSharpnessThreshold={isDev ? debugOptions.focusSharpnessThreshold : 80}
              motionThreshold={isDev ? debugOptions.motionThreshold : 40}
              stableFramesRequired={isDev ? debugOptions.stableFramesRequired : 4}
              bestShotFrames={isDev ? debugOptions.bestShotFrames : 1}
              contourStableFramesRequired={isDev ? debugOptions.contourStableFramesRequired : 3}
              brightnessMinThreshold={isDev ? debugOptions.brightnessMinThreshold : 0}
              autoCaptureMs={0}
            />
          </div>
          <div className="scanFooter">
            <button type="button" className="btn btnGhost btnSm" onClick={handleDone}>
              Listo
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'manual_crop' && rawUrl && imageDimensions) {
    return (
      <div className="scanOverlay" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="scanPanel" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn btnGhost btnSm modalClose" aria-label="Cerrar" onClick={handleManualCropCancel}>
            Cerrar
          </button>
          <p className="muted" style={{ margin: '0 0 8px', fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
            No se detectó el borde. Ajusta las esquinas y aplica el recorte.
          </p>
          {processing && (
            <div className="scanProcessing" style={{ marginBottom: 8 }} aria-live="polite">
              Procesando…
            </div>
          )}
          <ManualCropEditor
            imageUrl={rawUrl}
            imageWidth={imageDimensions.w}
            imageHeight={imageDimensions.h}
            onApply={handleManualCropApply}
            onCancel={handleManualCropCancel}
          />
          <div className="scanFooter" style={{ marginTop: 8 }}>
            <button type="button" className="btn btnGhost btnSm" onClick={() => { setStep('choose'); setMode('choose'); setRawBlob(null); setImageDimensions(null) }}>
              Reintentar (otra foto)
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'preview' && capturedBlob && previewUrl) {
    return (
      <div className="scanOverlay" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="scanPanel" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn btnGhost btnSm modalClose" aria-label="Cerrar" onClick={onClose}>
            Cerrar
          </button>
          <div className="scanPreviewWrap">
            <div className="scanPreviewBox">
              <img src={previewUrl} alt="Vista previa" className="scanPreviewImg" />
            </div>
            <div className="scanPreviewActions">
              <button type="button" className="btn btnPrimary" onClick={handleUseImage}>
                Usar esta imagen
              </button>
              <button type="button" className="btn btnGhost" onClick={handleTakeAnother}>
                Tomar otra
              </button>
              {mode === 'photo' && rawBlob && (
                <button type="button" className="btn btnGhost btnSm" onClick={handleConvertToScan}>
                  Convertir a scan
                </button>
              )}
            </div>
            {isDev && rawBlob && (
              <ScanDebugPanel
                rawBlob={rawBlob}
                debugOptions={debugOptions}
                corners={lastCorners}
                onDebugOptionsChange={(next) => setDebugOptions((prev) => ({ ...prev, ...next }))}
                lastCaptureLog={lastCaptureLog}
              />
            )}
          </div>
          {currentCount > 0 && (
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              {currentCount} de {maxFiles} fotos.
            </p>
          )}
          <div className="scanFooter">
            <button type="button" className="btn btnGhost btnSm" onClick={handleDone}>
              Listo
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'processing' && processing) {
    return (
      <div className="scanOverlay" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="scanPanel" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn btnGhost btnSm modalClose" aria-label="Cerrar" onClick={() => { setStep('choose'); setMode('choose') }}>
            Cerrar
          </button>
          <div className="scanProcessing" style={{ padding: 24 }}>
            Procesando documento…
          </div>
        </div>
      </div>
    )
  }

  return null
}
