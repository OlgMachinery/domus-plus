/**
 * Motor de recorte para tickets: detección de documento y warp+crop en color.
 * Siempre produce imagen recortada en color; el B/N es opcional (enhanceEngine).
 */

import {
  loadOpenCV,
  detectDocumentCorners as detectCornersOnCanvas,
  processDocumentWithManualCorners,
  orderPoints,
  type ReceiptEnhanceOptions,
} from './documentProcessor'

/** Detecta las 4 esquinas del documento en la imagen (blob). Devuelve [tl, tr, br, bl] o null. */
export async function detectDocumentCorners(blob: Blob): Promise<number[][] | null> {
  if (typeof window === 'undefined') return null
  await loadOpenCV()
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0)
      detectCornersOnCanvas(canvas).then(resolve)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

/** Esquinas por defecto (rectángulo centrado con margen). */
export function defaultCropCorners(width: number, height: number, marginRatio: number = 0.08): number[][] {
  const mx = width * marginRatio
  const my = height * marginRatio
  return orderPoints([
    [mx, my],
    [width - mx, my],
    [width - mx, height - my],
    [mx, height - my],
  ])
}

export type WarpAndCropOptions = {
  outputMode?: 'color' | 'grayscale' | 'bw'
} & Partial<ReceiptEnhanceOptions>

/**
 * Recorta y corrige perspectiva; devuelve imagen en color por defecto.
 * corners: [tl, tr, br, bl] en coordenadas de imagen.
 */
export async function warpAndCrop(
  blob: Blob,
  corners: number[][],
  options: WarpAndCropOptions = {}
): Promise<Blob | null> {
  const opts: ReceiptEnhanceOptions = {
    ...options,
    outputMode: options.outputMode ?? 'color',
  }
  const result = await processDocumentWithManualCorners(blob, corners, opts, false)
  return result instanceof Blob ? result : (result?.blob ?? null)
}
