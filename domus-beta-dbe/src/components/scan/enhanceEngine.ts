/**
 * Motor de mejora para OCR: gris mejorado y B/N a partir de imagen ya recortada (color).
 * No cambia la vista principal; solo genera derivados para extracción.
 */

import { processDocumentWithManualCorners, type ReceiptEnhanceOptions } from './documentProcessor'

function fullImageCorners(width: number, height: number): number[][] {
  return [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ]
}

/**
 * Genera versión gris mejorada (iluminación + CLAHE) de una imagen ya recortada.
 * Útil para visualización alternativa o preprocesado.
 */
export async function generateGrayEnhanced(blob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      URL.revokeObjectURL(url)
      const w = img.naturalWidth
      const h = img.naturalHeight
      const corners = fullImageCorners(w, h)
      processDocumentWithManualCorners(blob, corners, { outputMode: 'grayscale' }, false).then((result) => {
        const b = result instanceof Blob ? result : (result as { blob?: Blob | null })?.blob ?? null
        resolve(b)
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

/**
 * Genera versión B/N para OCR (iluminación + CLAHE + umbral adaptativo).
 * Solo para uso en extracción; la UI sigue mostrando color.
 */
export async function generateBWForOCR(blob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      URL.revokeObjectURL(url)
      const w = img.naturalWidth
      const h = img.naturalHeight
      const corners = fullImageCorners(w, h)
      const opts: ReceiptEnhanceOptions = {
        outputMode: 'bw',
        pepperRemoval: true,
        claheClipLimit: 2.0,
      }
      processDocumentWithManualCorners(blob, corners, opts, false).then((result) => {
        const b = result instanceof Blob ? result : (result as { blob?: Blob | null })?.blob ?? null
        resolve(b)
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}
