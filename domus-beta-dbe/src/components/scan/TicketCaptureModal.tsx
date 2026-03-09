'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { requestPhotoFromFileInput, requestPhotoFromStream, getPreferredCaptureMode } from './captureProvider'
import { detectDocumentCorners, warpAndCrop, defaultCropCorners } from './cropEngine'
import { generateBWForOCR } from './enhanceEngine'
import { ManualCropEditor } from './ManualCropEditor'
import { loadOpenCV } from './documentProcessor'

export type TicketCaptureModalProps = {
  onConfirm: (file: File, bwFile?: File) => void
  onClose: () => void
  maxFiles?: number
  currentCount?: number
}

type Step = 'idle' | 'captured' | 'crop' | 'ready'

export function TicketCaptureModal({
  onConfirm,
  onClose,
  maxFiles = 8,
  currentCount = 0,
}: TicketCaptureModalProps) {
  const [step, setStep] = useState<Step>('idle')
  const [rawBlob, setRawBlob] = useState<Blob | null>(null)
  const [rawUrl, setRawUrl] = useState<string>('')
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null)
  const [cropCorners, setCropCorners] = useState<number[][] | null>(null)
  const [finalBlob, setFinalBlob] = useState<Blob | null>(null)
  const [finalUrl, setFinalUrl] = useState<string>('')
  const [bwBlob, setBwBlob] = useState<Blob | null>(null)
  const [processing, setProcessing] = useState(false)
  const [statusLine, setStatusLine] = useState<string>('Listo')
  const [enhanceForOCR, setEnhanceForOCR] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const useFileCapture = getPreferredCaptureMode() === 'file'
  const canAddMore = (currentCount ?? 0) < (maxFiles ?? 8)

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
    if (!finalBlob) {
      setFinalUrl('')
      return
    }
    const url = URL.createObjectURL(finalBlob)
    setFinalUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [finalBlob])

  useEffect(() => {
    if (!useFileCapture || step !== 'idle') return
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const track = stream.getVideoTracks()[0]
        const caps = track?.getCapabilities?.()
        if (caps && (caps as any).torch) setTorchAvailable(true)
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          video.play().catch(() => {})
        }
      })
      .catch(() => setStatusLine('Sin cámara'))
    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [useFileCapture, step])

  const handleCapture = useCallback(() => {
    if (useFileCapture) {
      requestPhotoFromFileInput().then((blob) => {
        if (blob) handlePhotoReceived(blob)
      })
    } else {
      const stream = streamRef.current
      if (!stream) return
      setStatusLine('Capturando…')
      requestPhotoFromStream(stream).then((res) => {
        setStatusLine('Listo')
        if (res?.blob) handlePhotoReceived(res.blob)
      })
    }
  }, [useFileCapture])

  const handlePhotoReceived = useCallback((blob: Blob) => {
    setRawBlob(blob)
    setStep('captured')
    setProcessing(true)
    setStatusLine('Detectando recorte…')
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      setImageSize({ w, h })
      URL.revokeObjectURL(url)
      detectDocumentCorners(blob).then((corners) => {
        setProcessing(false)
        setStatusLine('Listo')
        if (corners && corners.length === 4) {
          setCropCorners(corners)
        } else {
          setCropCorners(defaultCropCorners(w, h))
        }
        setStep('crop')
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setProcessing(false)
      setStatusLine('Listo')
      setImageSize({ w: 1920, h: 1080 })
      setCropCorners(defaultCropCorners(1920, 1080))
      setStep('crop')
    }
    img.src = url
  }, [])

  const handleApplyCrop = useCallback(
    (corners: number[][]) => {
      if (!rawBlob) return
      setProcessing(true)
      setStatusLine('Recortando…')
      warpAndCrop(rawBlob, corners, { outputMode: 'color' }).then((blob) => {
        setProcessing(false)
        setStatusLine('Listo')
        if (blob) {
          setFinalBlob(blob)
          setStep('ready')
          if (enhanceForOCR) {
            generateBWForOCR(blob).then(setBwBlob)
          }
        }
      })
    },
    [rawBlob, enhanceForOCR]
  )

  const handleRepetir = useCallback(() => {
    setStep('idle')
    setRawBlob(null)
    setFinalBlob(null)
    setBwBlob(null)
    setCropCorners(null)
    setImageSize(null)
  }, [])

  const handleSend = useCallback(() => {
    if (!finalBlob) return
    const colorFile = new File([finalBlob], `ticket-${Date.now()}.jpg`, { type: 'image/jpeg' })
    const bwFile = bwBlob ? new File([bwBlob], `ticket-${Date.now()}-bw.png`, { type: 'image/png' }) : undefined
    onConfirm(colorFile, bwFile)
    handleRepetir()
    if ((currentCount ?? 0) + 1 >= (maxFiles ?? 8)) onClose()
  }, [finalBlob, bwBlob, onConfirm, onClose, currentCount, maxFiles, handleRepetir])

  const toggleTorch = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()?.[0]
    if (!track) return
    const next = !torchOn
    track.applyConstraints?.({ advanced: [{ torch: next }] as unknown as MediaTrackConstraintSet[] }).then(() => setTorchOn(next)).catch(() => {})
  }, [torchOn])

  return (
    <div
      className="ticketCaptureOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-capture-title"
      onClick={onClose}
    >
      <div className="ticketCapturePanel" onClick={(e) => e.stopPropagation()}>
        <header className="ticketCaptureHeader">
          <h2 id="ticket-capture-title" className="ticketCaptureTitle">
            Capturar ticket
          </h2>
          <p className="ticketCaptureSubtitle">
            {step === 'idle' && (currentCount ?? 0) > 0
              ? `Ya añadidas: ${currentCount}. Toma otra foto o cierra la pantalla cuando termines.`
              : 'Centra el ticket y toma la foto.'}
          </p>
          <button type="button" className="ticketCaptureClose" aria-label="Cerrar pantalla" onClick={onClose}>
            <span className="ticketCaptureCloseIcon" aria-hidden>×</span>
            <span className="ticketCaptureCloseText">Cerrar</span>
          </button>
        </header>

        <div className="ticketCaptureBody">
          {step === 'idle' && (
            <>
              {useFileCapture ? (
                <div className="ticketCapturePlaceholder">
                  <p className="muted">Pulsa Capturar para abrir la cámara.</p>
                </div>
              ) : (
                <div className="ticketCaptureVideoWrap">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="ticketCaptureVideo"
                    style={{ display: streamRef.current ? 'block' : 'none' }}
                  />
                  {!streamRef.current && <div className="ticketCapturePlaceholder">Activando cámara…</div>}
                </div>
              )}
            </>
          )}

          {step === 'captured' && processing && (
            <div className="ticketCaptureCropWrap">
              <div className="ticketCaptureProcessing">Detectando recorte…</div>
            </div>
          )}

          {step === 'crop' && rawUrl && imageSize && (
            <div className="ticketCaptureCropWrap">
              <ManualCropEditor
                imageUrl={rawUrl}
                imageWidth={imageSize.w}
                imageHeight={imageSize.h}
                initialCorners={cropCorners ?? undefined}
                onApply={handleApplyCrop}
                onCancel={handleRepetir}
              />
            </div>
          )}

          {step === 'ready' && finalUrl && (
            <div className="ticketCapturePreviewWrap">
              <img src={finalUrl} alt="Ticket recortado" className="ticketCapturePreviewImg" />
              <p className="ticketCaptureConfirmHint">
                Pulsa el botón verde para añadir esta foto. Luego puedes tomar otra y repetir; cuando termines, cierra la pantalla y envía todas.
              </p>
            </div>
          )}
        </div>

        <footer className="ticketCaptureFooter">
          <span className="ticketCaptureStatus" aria-live="polite">
            {processing ? 'Procesando…' : statusLine}
          </span>
          {step === 'ready' && (
            <div className="ticketCaptureConfirmBlock">
              <button
                type="button"
                className="btn btnConfirmTicket"
                disabled={!!processing}
                onClick={handleSend}
                aria-label="Añadir esta foto al gasto"
              >
                <span className="btnConfirmTicketIcon" aria-hidden>✓</span>
                Añadir esta foto
              </button>
              <button type="button" className="btn btnGhost btnSm" onClick={handleRepetir}>
                Repetir
              </button>
            </div>
          )}
          {step !== 'ready' && (
            <>
              <div className="ticketCaptureFooterActions">
                <button type="button" className="btn btnGhost btnSm" onClick={handleRepetir}>
                  Repetir
                </button>
                {step === 'crop' ? (
                  <span className="ticketCapturePrimaryHint">Ajusta las esquinas si hace falta.</span>
                ) : (
                  <button
                    type="button"
                    className="btn btnPrimary"
                    disabled={processing || (step === 'idle' && !canAddMore)}
                    onClick={step === 'idle' ? handleCapture : undefined}
                  >
                    {step === 'idle' ? 'Capturar' : 'Capturar'}
                  </button>
                )}
                {step === 'idle' && torchAvailable && (
                  <button
                    type="button"
                    className={torchOn ? 'btn btnPrimary btnSm' : 'btn btnGhost btnSm'}
                    onClick={toggleTorch}
                    aria-label={torchOn ? 'Apagar flash' : 'Encender flash'}
                  >
                    Flash
                  </button>
                )}
              </div>
              {step === 'idle' && (
                <label className="ticketCaptureToggle">
                  <input
                    type="checkbox"
                    checked={enhanceForOCR}
                    onChange={(e) => setEnhanceForOCR(e.target.checked)}
                  />
                  <span>Mejorar legibilidad (B/N) para OCR</span>
                </label>
              )}
              {step === 'idle' && (
                <p className="ticketCaptureBwNote">
                  La foto se envía siempre en color. El B/N solo ayuda a leer mejor el texto.
                </p>
              )}
            </>
          )}
        </footer>
      </div>
    </div>
  )
}
