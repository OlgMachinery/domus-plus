'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  processDocumentWithOptions,
  type ReceiptEnhanceOptions,
  type DebugFrames,
  type ScanOutputMode,
} from './documentProcessor'

export type ScanDebugOptions = {
  focusSharpnessThreshold: number
  motionThreshold: number
  claheClipLimit: number
  stableFramesRequired: number
  bestShotFrames: number
  contourStableFramesRequired: number
  brightnessMinThreshold: number
}

export type LastCaptureLog = {
  sharpness?: number
  motion?: number
  brightness?: number
  contourScore?: number
  textLikenessScore?: number
}

export type ScanDebugPanelProps = {
  rawBlob: Blob
  debugOptions?: ScanDebugOptions
  onDebugOptionsChange?: (next: Partial<ScanDebugOptions>) => void
  lastCaptureLog?: LastCaptureLog | null
  /** Esquinas del contorno (ordenadas), si están disponibles. */
  corners?: number[][] | null
}

const defaultOptions: ReceiptEnhanceOptions = {
  outputMode: 'bw',
  backgroundBlurScale: 0.08,
  adaptiveBlockSize: 31,
  adaptiveC: 10,
  bilateralSigma: 50,
  morphKernel: 2,
  pepperRemoval: true,
  claheClipLimit: 2.0,
  sauvolaWindowSize: 25,
  sauvolaK: 0.2,
  bwMethod: 'best',
  usePercentileStretch: true,
  useBwInvertMorph: true,
}

const defaultDebugOptions: ScanDebugOptions = {
  focusSharpnessThreshold: 80,
  motionThreshold: 40,
  claheClipLimit: 2.0,
  stableFramesRequired: 4,
  bestShotFrames: 1,
  contourStableFramesRequired: 3,
  brightnessMinThreshold: 40,
}

export function ScanDebugPanel({ rawBlob, debugOptions = defaultDebugOptions, onDebugOptionsChange, lastCaptureLog, corners }: ScanDebugPanelProps) {
  const [opts, setOpts] = useState<ReceiptEnhanceOptions>(defaultOptions)
  const [frames, setFrames] = useState<Partial<DebugFrames> | null>(null)
  const [loading, setLoading] = useState(false)
  const [capturedUrl, setCapturedUrl] = useState<string>('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(rawBlob)
    setCapturedUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [rawBlob])

  const runPipeline = useCallback(() => {
    setLoading(true)
    setFrames(null)
    const pipelineOpts = { ...opts, claheClipLimit: debugOptions.claheClipLimit }
    processDocumentWithOptions(rawBlob, pipelineOpts, true)
      .then((result) => {
        if (result && typeof result === 'object' && 'debugFrames' in result && result.debugFrames) {
          setFrames(result.debugFrames)
        }
      })
      .finally(() => setLoading(false))
  }, [rawBlob, opts, debugOptions.claheClipLimit])

  const exportDebugBundle = useCallback(async () => {
    setExporting(true)
    try {
      const capturedDataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result))
        fr.onerror = () => reject(fr.error)
        fr.readAsDataURL(rawBlob)
      })
      const bundle = {
        exportedAt: new Date().toISOString(),
        params: {
          opts: { ...opts, claheClipLimit: debugOptions.claheClipLimit },
          debugOptions: { ...debugOptions },
        },
        metrics: lastCaptureLog ?? undefined,
        corners: corners ?? undefined,
        images: {
          capturedRGB: capturedDataUrl,
          warpedRGB: frames?.perspectiveCorrected ?? null,
          correctedIllumination: frames?.correctedIllumination ?? null,
          enhancedGray: frames?.afterCLAHE ?? null,
          final: frames?.finalBW ?? null,
        },
      }
      const json = JSON.stringify(bundle, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `domus-scan-debug-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }, [rawBlob, opts, debugOptions, lastCaptureLog, corners, frames])

  return (
    <div style={{ marginTop: 16, padding: 12, background: '#1a1a1a', borderRadius: 8, fontSize: 12 }}>
      <div style={{ color: '#fff', marginBottom: 8, fontWeight: 600 }}>Debug pipeline (solo dev)</div>
            {lastCaptureLog && (
        <div style={{ marginBottom: 8, padding: 8, background: '#222', borderRadius: 6, fontSize: 11 }}>
          <div style={{ color: '#aaa', marginBottom: 4 }}>Última captura</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {lastCaptureLog.sharpness != null && <span>sharpness: {lastCaptureLog.sharpness.toFixed(1)}</span>}
            {lastCaptureLog.motion != null && <span>motion: {lastCaptureLog.motion.toFixed(1)}</span>}
            {lastCaptureLog.brightness != null && <span>brightness: {lastCaptureLog.brightness.toFixed(0)}</span>}
            {lastCaptureLog.contourScore != null && <span>contourScore: {lastCaptureLog.contourScore.toFixed(2)}</span>}
            {lastCaptureLog.textLikenessScore != null && <span>textLikeness: {lastCaptureLog.textLikenessScore.toFixed(4)}</span>}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        {onDebugOptionsChange && (
          <>
            <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
              focusSharpnessThreshold
              <input
                type="range"
                min={20}
                max={200}
                value={debugOptions.focusSharpnessThreshold}
                onChange={(e) =>
                  onDebugOptionsChange({ focusSharpnessThreshold: Number(e.target.value) })
                }
              />
              <span>{debugOptions.focusSharpnessThreshold}</span>
            </label>
            <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
              motionThreshold
              <input
                type="range"
                min={5}
                max={100}
                value={debugOptions.motionThreshold}
                onChange={(e) =>
                  onDebugOptionsChange({ motionThreshold: Number(e.target.value) })
                }
              />
              <span>{debugOptions.motionThreshold}</span>
            </label>
            <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
              claheClipLimit
              <input
                type="range"
                min={1}
                max={4}
                step={0.5}
                value={debugOptions.claheClipLimit}
                onChange={(e) =>
                  onDebugOptionsChange({ claheClipLimit: Number(e.target.value) })
                }
              />
              <span>{debugOptions.claheClipLimit}</span>
            </label>
            <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
              stableFramesRequired
              <input
                type="range"
                min={1}
                max={6}
                value={debugOptions.stableFramesRequired}
                onChange={(e) =>
                  onDebugOptionsChange({ stableFramesRequired: Number(e.target.value) })
                }
              />
              <span>{debugOptions.stableFramesRequired}</span>
            </label>
            <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
              bestShotFrames
              <input
                type="range"
                min={1}
                max={5}
                value={debugOptions.bestShotFrames}
                onChange={(e) =>
                  onDebugOptionsChange({ bestShotFrames: Number(e.target.value) })
                }
              />
              <span>{debugOptions.bestShotFrames}</span>
            </label>
            <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
              contourStableFrames
              <input
                type="range"
                min={1}
                max={6}
                value={debugOptions.contourStableFramesRequired}
                onChange={(e) =>
                  onDebugOptionsChange({ contourStableFramesRequired: Number(e.target.value) })
                }
              />
              <span>{debugOptions.contourStableFramesRequired}</span>
            </label>
            <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
              brightnessMinThreshold
              <input
                type="range"
                min={0}
                max={80}
                value={debugOptions.brightnessMinThreshold}
                onChange={(e) =>
                  onDebugOptionsChange({ brightnessMinThreshold: Number(e.target.value) })
                }
              />
              <span>{debugOptions.brightnessMinThreshold}</span>
            </label>
          </>
        )}
        <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
          backgroundBlurScale
          <input
            type="range"
            min={0.02}
            max={0.2}
            step={0.01}
            value={opts.backgroundBlurScale ?? 0.08}
            onChange={(e) =>
              setOpts((o) => ({ ...o, backgroundBlurScale: Number(e.target.value) }))
            }
          />
          <span>{opts.backgroundBlurScale ?? 0.08}</span>
        </label>
        <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
          adaptiveBlockSize
          <input
            type="range"
            min={15}
            max={51}
            step={2}
            value={opts.adaptiveBlockSize ?? 31}
            onChange={(e) =>
              setOpts((o) => ({ ...o, adaptiveBlockSize: Number(e.target.value) }))
            }
          />
          <span>{opts.adaptiveBlockSize ?? 31}</span>
        </label>
        <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
          adaptiveC
          <input
            type="range"
            min={0}
            max={20}
            value={opts.adaptiveC ?? 10}
            onChange={(e) => setOpts((o) => ({ ...o, adaptiveC: Number(e.target.value) }))}
          />
          <span>{opts.adaptiveC ?? 10}</span>
        </label>
        <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
          bilateralSigma
          <input
            type="range"
            min={20}
            max={150}
            value={opts.bilateralSigma ?? 50}
            onChange={(e) =>
              setOpts((o) => ({ ...o, bilateralSigma: Number(e.target.value) }))
            }
          />
          <span>{opts.bilateralSigma ?? 50}</span>
        </label>
        <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
          morphKernel
          <input
            type="range"
            min={1}
            max={5}
            value={opts.morphKernel ?? 2}
            onChange={(e) =>
              setOpts((o) => ({ ...o, morphKernel: Number(e.target.value) }))
            }
          />
          <span>{opts.morphKernel ?? 2}</span>
        </label>
        <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
          pepperRemoval
          <input
            type="checkbox"
            checked={opts.pepperRemoval ?? true}
            onChange={(e) => setOpts((o) => ({ ...o, pepperRemoval: e.target.checked }))}
          />
        </label>
        <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
          B/W method
          <select
            value={opts.bwMethod ?? 'best'}
            onChange={(e) => setOpts((o) => ({ ...o, bwMethod: e.target.value as 'adaptive' | 'sauvola' | 'best' }))}
            style={{ background: '#333', color: '#fff', padding: 4 }}
          >
            <option value="adaptive">Adaptive</option>
            <option value="sauvola">Sauvola</option>
            <option value="best">Best (score)</option>
          </select>
        </label>
        <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
          sauvolaWindowSize
          <input
            type="range"
            min={11}
            max={51}
            step={2}
            value={opts.sauvolaWindowSize ?? 25}
            onChange={(e) => setOpts((o) => ({ ...o, sauvolaWindowSize: Number(e.target.value) }))}
          />
          <span>{opts.sauvolaWindowSize ?? 25}</span>
        </label>
        <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
          sauvolaK
          <input
            type="range"
            min={0.1}
            max={0.5}
            step={0.05}
            value={opts.sauvolaK ?? 0.2}
            onChange={(e) => setOpts((o) => ({ ...o, sauvolaK: Number(e.target.value) }))}
          />
          <span>{opts.sauvolaK ?? 0.2}</span>
        </label>
        <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
          Modo
          <select
            value={opts.outputMode ?? 'bw'}
            onChange={(e) => setOpts((o) => ({ ...o, outputMode: e.target.value as ScanOutputMode }))}
            style={{ background: '#333', color: '#fff', padding: 4 }}
          >
            <option value="color">Color</option>
            <option value="grayscale">Grayscale</option>
            <option value="bw">B/W</option>
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={runPipeline}
          disabled={loading}
          style={{
            padding: '6px 12px',
            background: '#333',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: 6,
          }}
        >
          {loading ? 'Generando…' : 'Generar vistas debug'}
        </button>
        <button
          type="button"
          onClick={exportDebugBundle}
          disabled={exporting}
          style={{
            padding: '6px 12px',
            background: '#333',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: 6,
          }}
        >
          {exporting ? 'Exportando…' : 'Export debug bundle'}
        </button>
      </div>
      {(capturedUrl || frames) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 12 }}>
          {capturedUrl && (
            <div>
              <div style={{ color: '#888', marginBottom: 4 }}>1. Captured RGB</div>
              <img src={capturedUrl} alt="Captured" style={{ maxWidth: '100%', height: 'auto', maxHeight: 160 }} />
            </div>
          )}
          {frames?.perspectiveCorrected && (
            <div>
              <div style={{ color: '#888', marginBottom: 4 }}>2. Warped (perspective)</div>
              <img src={frames.perspectiveCorrected} alt="Perspective" style={{ maxWidth: '100%', height: 'auto', maxHeight: 160 }} />
            </div>
          )}
          {frames?.correctedIllumination && (
            <div>
              <div style={{ color: '#888', marginBottom: 4 }}>3. Corrected illumination</div>
              <img src={frames.correctedIllumination} alt="Illumination" style={{ maxWidth: '100%', height: 'auto', maxHeight: 160 }} />
            </div>
          )}
          {frames?.afterCLAHE && (
            <div>
              <div style={{ color: '#888', marginBottom: 4 }}>4. Enhanced gray (after CLAHE)</div>
              <img src={frames.afterCLAHE} alt="CLAHE" style={{ maxWidth: '100%', height: 'auto', maxHeight: 160 }} />
            </div>
          )}
          {frames?.finalBW && (
            <div>
              <div style={{ color: '#888', marginBottom: 4 }}>5. Final B/W</div>
              <img src={frames.finalBW} alt="Final" style={{ maxWidth: '100%', height: 'auto', maxHeight: 160 }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
