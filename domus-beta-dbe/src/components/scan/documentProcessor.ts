/**
 * Procesamiento de documento tipo Genius Scan: detección de bordes y corrección de perspectiva.
 * Usa OpenCV.js cargado desde CDN (solo en cliente).
 */

const OPENCV_SCRIPT_URL = 'https://docs.opencv.org/4.8.0/opencv.js'

let opencvLoadPromise: Promise<void> | null = null

export function loadOpenCV(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (opencvLoadPromise) return opencvLoadPromise
  opencvLoadPromise = new Promise((resolve, reject) => {
    const w = typeof window !== 'undefined' ? window : null
    const cv = w ? (w as any).cv : null
    if (cv && typeof cv.imread === 'function') {
      if (typeof cv.then === 'function') {
        cv.then(() => resolve()).catch(reject)
      } else {
        resolve()
      }
      return
    }
    const script = document.createElement('script')
    script.async = true
    script.src = OPENCV_SCRIPT_URL
    script.onload = () => {
      const cv = (window as any).cv
      if (!cv) {
        reject(new Error('OpenCV no disponible'))
        return
      }
      if (typeof cv.then === 'function') {
        cv.then(() => resolve()).catch(reject)
      } else if (typeof cv.onRuntimeInitialized !== 'undefined') {
        cv.onRuntimeInitialized = () => resolve()
      } else {
        setTimeout(() => resolve(), 100)
      }
    }
    script.onerror = () => reject(new Error('No se pudo cargar OpenCV'))
    document.head.appendChild(script)
  })
  return opencvLoadPromise
}

export type ScanOutputMode = 'color' | 'grayscale' | 'bw'
export type IlluminationOption = 'B1' | 'B2'

export type ReceiptEnhanceOptions = {
  illumination?: IlluminationOption
  outputMode?: ScanOutputMode
  backgroundBlurScale?: number
  adaptiveBlockSize?: number
  adaptiveC?: number
  bilateralSigma?: number
  morphKernel?: number
  pepperRemoval?: boolean
  textReinforce?: boolean
  claheClipLimit?: number
  sauvolaWindowSize?: number
  sauvolaK?: number
  bwMethod?: 'adaptive' | 'sauvola' | 'best'
  /** Estirar contraste por percentiles p2/p98 en gris. */
  usePercentileStretch?: boolean
  /** B/N: morfología con texto=255 (BINARY_INV), luego invertir al final. */
  useBwInvertMorph?: boolean
}

const DEFAULT_OPTIONS: Required<ReceiptEnhanceOptions> = {
  illumination: 'B1',
  outputMode: 'grayscale',
  backgroundBlurScale: 0.08,
  adaptiveBlockSize: 31,
  adaptiveC: 10,
  bilateralSigma: 50,
  morphKernel: 2,
  pepperRemoval: true,
  textReinforce: true,
  claheClipLimit: 2.0,
  sauvolaWindowSize: 25,
  sauvolaK: 0.2,
  bwMethod: 'best',
  usePercentileStretch: true,
  useBwInvertMorph: true,
}

export type DebugFrames = {
  capturedRGB?: string
  perspectiveCorrected: string
  correctedIllumination: string
  afterCLAHE: string
  finalBW: string
}

function matToDataUrl(cv: any, mat: any, format: 'image/jpeg' | 'image/png' = 'image/jpeg'): string {
  const c = document.createElement('canvas')
  cv.imshow(c, mat)
  return c.toDataURL(format)
}

/** Estira contraste por percentiles: pLow/pHigh (0–100). Devuelve nuevo Mat 8UC1 o null. */
function percentileStretch(cv: any, src: any, pLow: number, pHigh: number): any {
  if (!src || src.rows * src.cols === 0) return null
  try {
    const data = src.data
    if (!data || data.length === 0) return null
    const arr = Array.from(data as Uint8Array)
    arr.sort((a, b) => a - b)
    const len = arr.length
    const iLow = Math.max(0, Math.floor((len * pLow) / 100))
    const iHigh = Math.min(len - 1, Math.floor((len * pHigh) / 100))
    const vLow = arr[iLow]
    const vHigh = arr[iHigh]
    const span = Math.max(1, vHigh - vLow)
    const out = new cv.Mat()
    src.convertTo(out, cv.CV_8UC1, 255 / span, -vLow * (255 / span))
    return out
  } catch {
    return null
  }
}

/** White ratio in [0,1]. Used to score B/W result (receipts often ~0.3–0.7). */
function whiteRatioScore(cv: any, binary: any): number {
  try {
    const nz = typeof cv.countNonZero === 'function' ? cv.countNonZero(binary) : 0
    const total = binary.rows * binary.cols
    if (total === 0) return 0
    const ratio = nz / total
    return 1 - Math.abs(ratio - 0.5) * 2
  } catch {
    return 0
  }
}

/** Sauvola binarization: T = mean * (1 + k * (std/128 - 1)). Returns 8UC1 binary. */
function sauvolaThreshold(cv: any, gray: any, winSize: number, k: number): any {
  const w = Math.max(3, (winSize | 1))
  const toDel: any[] = []
  const grayF = new cv.Mat()
  gray.convertTo(grayF, cv.CV_32F, 1 / 255, 0)
  toDel.push(grayF)
  const meanF = new cv.Mat()
  cv.blur(grayF, meanF, new cv.Size(w, w))
  toDel.push(meanF)
  const sqF = new cv.Mat()
  cv.multiply(grayF, grayF, sqF)
  toDel.push(sqF)
  const meanSqF = new cv.Mat()
  cv.blur(sqF, meanSqF, new cv.Size(w, w))
  toDel.push(meanSqF)
  const varF = new cv.Mat()
  const meanSq = new cv.Mat()
  cv.multiply(meanF, meanF, meanSq)
  cv.subtract(meanSqF, meanSq, varF)
  meanSq.delete()
  const zeros = new cv.Mat(gray.rows, gray.cols, cv.CV_32FC1)
  zeros.setTo(new cv.Scalar(0))
  const varClamp = new cv.Mat()
  cv.max(varF, zeros, varClamp)
  zeros.delete()
  varF.delete()
  toDel.push(varClamp)
  const stdF = new cv.Mat()
  try {
    if (typeof cv.sqrt === 'function') {
      cv.sqrt(varClamp, stdF)
    } else {
      cv.pow(varClamp, 0.5, stdF)
    }
  } catch {
    toDel.forEach((m) => { try { m.delete() } catch { } })
    return null
  }
  toDel.push(stdF)
  const stdScaled = new cv.Mat()
  stdF.convertTo(stdScaled, cv.CV_32F, 1 / 128, -1)
  toDel.push(stdScaled)
  const ones = new cv.Mat(gray.rows, gray.cols, cv.CV_32FC1)
  ones.setTo(new cv.Scalar(1))
  const factor = new cv.Mat()
  cv.addWeighted(ones, 1, stdScaled, k, 0, factor)
  ones.delete()
  toDel.push(factor)
  const T = new cv.Mat()
  cv.multiply(meanF, factor, T)
  toDel.push(T)
  const binary = new cv.Mat()
  cv.compare(grayF, T, binary, cv.CMP_GT)
  binary.convertTo(binary, cv.CV_8UC1, 255, 0)
  toDel.forEach((m) => { try { m.delete() } catch { } })
  return binary
}

/** Sauvola con texto=255 (para pipeline invert: morph luego invertir). */
function sauvolaThresholdInv(cv: any, gray: any, winSize: number, k: number): any {
  const normal = sauvolaThreshold(cv, gray, winSize, k)
  if (!normal) return null
  const inv = new cv.Mat()
  cv.bitwise_not(normal, inv)
  normal.delete()
  return inv
}

/**
 * Receipt-specific enhancement pipeline (no pepper noise, solid text).
 * B1: gray/background blur normalize. B2: morph open background. Then bilateral, CLAHE, adaptive, morph open+close, optional dilate, whitening.
 */
function enhanceReceipt(
  cv: any,
  warpedColor: any,
  opts: Required<ReceiptEnhanceOptions>,
  debug?: { frames: Partial<DebugFrames> }
): { out: any; debugFrames?: Partial<DebugFrames> } {
  const toDelete: any[] = []
  const W = warpedColor.cols
  const H = warpedColor.rows
  const minDim = Math.min(W, H)
  const kOdd = (x: number) => Math.max(3, (Math.round(x) | 1))
  const blockSize = kOdd(opts.adaptiveBlockSize)
  const morphK = Math.max(1, opts.morphKernel)

  let gray = new cv.Mat()
  cv.cvtColor(warpedColor, gray, cv.COLOR_RGBA2GRAY)
  toDelete.push(gray)

  let corrected: any
  if (opts.illumination === 'B1') {
    const k = kOdd(minDim * opts.backgroundBlurScale)
    const background = new cv.Mat()
    cv.GaussianBlur(gray, background, new cv.Size(k, k), 0)
    const grayF = new cv.Mat()
    const bgF = new cv.Mat()
    gray.convertTo(grayF, cv.CV_32F, 1 / 255, 0)
    background.convertTo(bgF, cv.CV_32F, 1 / 255, 0)
    background.delete()
    const ones = cv.Mat.ones(H, W, cv.CV_32FC1)
    const eps = new cv.Mat()
    ones.convertTo(eps, cv.CV_32F, 0.04, 0)
    ones.delete()
    const safe = new cv.Mat()
    cv.add(bgF, eps, safe)
    bgF.delete()
    eps.delete()
    corrected = new cv.Mat()
    cv.divide(grayF, safe, corrected)
    grayF.delete()
    safe.delete()
    corrected.convertTo(corrected, cv.CV_8UC1, 255 * 0.92, 0)
  } else {
    const kOpen = Math.max(3, Math.round(minDim * 0.06) | 1)
    const kernelOpen = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(kOpen, kOpen))
    const background = new cv.Mat()
    cv.morphologyEx(gray, background, cv.MORPH_OPEN, kernelOpen)
    kernelOpen.delete()
    corrected = new cv.Mat()
    cv.subtract(gray, background, corrected)
    background.delete()
    cv.normalize(corrected, corrected, 0, 255, cv.NORM_MINMAX)
  }
  toDelete.push(corrected)
  if (debug?.frames) (debug.frames as any).correctedIllumination = matToDataUrl(cv, corrected)

  const denoised = new cv.Mat()
  try {
    cv.bilateralFilter(corrected, denoised, 7, opts.bilateralSigma, opts.bilateralSigma)
  } catch {
    cv.GaussianBlur(corrected, denoised, new cv.Size(3, 3), 0)
  }
  toDelete.push(denoised)

  const clipLimit = typeof opts.claheClipLimit === 'number' ? opts.claheClipLimit : 2.0
  let afterCLAHE: any = new cv.Mat()
  try {
    const clahe = cv.createCLAHE(clipLimit, new cv.Size(8, 8))
    clahe.apply(denoised, afterCLAHE)
    toDelete.push(afterCLAHE)
  } catch {
    afterCLAHE.delete()
    afterCLAHE = denoised
  }
  let forUnsharp = afterCLAHE
  if (opts.usePercentileStretch) {
    const stretched = percentileStretch(cv, afterCLAHE, 2, 98)
    if (stretched) {
      toDelete.push(stretched)
      forUnsharp = stretched
    }
  }
  const unsharp = new cv.Mat()
  const blurU = new cv.Mat()
  cv.GaussianBlur(forUnsharp, blurU, new cv.Size(3, 3), 0)
  cv.addWeighted(forUnsharp, 1.2, blurU, -0.2, 0, unsharp)
  blurU.delete()
  toDelete.push(unsharp)
  if (debug?.frames) (debug.frames as any).afterCLAHE = matToDataUrl(cv, unsharp)

  if (opts.outputMode === 'color') {
    const rgb = new cv.Mat()
    cv.cvtColor(warpedColor, rgb, cv.COLOR_RGBA2RGB)
    const grayForNorm = new cv.Mat()
    cv.cvtColor(rgb, grayForNorm, cv.COLOR_RGB2GRAY)
    const k = kOdd(minDim * opts.backgroundBlurScale)
    const bg = new cv.Mat()
    cv.GaussianBlur(grayForNorm, bg, new cv.Size(k, k), 0)
    grayForNorm.delete()
    const bgF = new cv.Mat()
    bg.convertTo(bgF, cv.CV_32F, 1 / 255, 0)
    bg.delete()
    const eps = new cv.Mat(H, W, cv.CV_32FC1)
    eps.setTo(new cv.Scalar(0.04))
    const denom = new cv.Mat()
    cv.add(bgF, eps, denom)
    bgF.delete()
    eps.delete()
    const channels = new cv.MatVector()
    cv.split(rgb, channels)
    for (let i = 0; i < 3; i++) {
      const ch = channels.get(i)
      const chF = new cv.Mat()
      ch.convertTo(chF, cv.CV_32F, 1 / 255, 0)
      const corrected = new cv.Mat()
      cv.divide(chF, denom, corrected)
      chF.delete()
      corrected.convertTo(ch, cv.CV_8UC1, 255 * 0.92, 0)
      corrected.delete()
    }
    denom.delete()
    cv.merge(channels, rgb)
    const out = new cv.Mat()
    cv.convertScaleAbs(rgb, out, 1.12, 8)
    rgb.delete()
    const outRgba = new cv.Mat()
    cv.cvtColor(out, outRgba, cv.COLOR_RGB2RGBA)
    out.delete()
    toDelete.forEach((m) => m.delete())
    return { out: outRgba, debugFrames: debug?.frames }
  }
  if (opts.outputMode === 'grayscale') {
    const out = new cv.Mat()
    cv.cvtColor(unsharp, out, cv.COLOR_GRAY2RGBA)
    toDelete.forEach((m) => { if (m !== out) m.delete() })
    return { out, debugFrames: debug?.frames }
  }

  const bwMethod = opts.bwMethod ?? 'best'
  const sauvolaWin = Math.max(3, (opts.sauvolaWindowSize ?? 25) | 1)
  const sauvolaK = opts.sauvolaK ?? 0.2
  const useInv = opts.useBwInvertMorph === true
  const threshType = useInv ? (cv.THRESH_BINARY_INV ?? 1) : cv.THRESH_BINARY

  let binary: any
  if (bwMethod === 'sauvola') {
    binary = useInv ? sauvolaThresholdInv(cv, unsharp, sauvolaWin, sauvolaK) : sauvolaThreshold(cv, unsharp, sauvolaWin, sauvolaK)
    if (!binary) binary = sauvolaThreshold(cv, unsharp, sauvolaWin, sauvolaK)
    if (binary) toDelete.push(binary)
  } else if (bwMethod === 'best') {
    const adaptiveBin = new cv.Mat()
    cv.adaptiveThreshold(unsharp, adaptiveBin, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, threshType, blockSize, opts.adaptiveC)
    toDelete.push(adaptiveBin)
    let sauvolaBin: any
    try {
      sauvolaBin = useInv ? sauvolaThresholdInv(cv, unsharp, sauvolaWin, sauvolaK) : sauvolaThreshold(cv, unsharp, sauvolaWin, sauvolaK)
      if (sauvolaBin) toDelete.push(sauvolaBin)
    } catch {
      sauvolaBin = null
    }
    const scoreAdaptive = whiteRatioScore(cv, adaptiveBin)
    const scoreSauvola = sauvolaBin ? whiteRatioScore(cv, sauvolaBin) : -1
    if (scoreSauvola > scoreAdaptive && sauvolaBin) {
      adaptiveBin.delete()
      binary = sauvolaBin
    } else {
      if (sauvolaBin) sauvolaBin.delete()
      binary = adaptiveBin
    }
  } else {
    binary = new cv.Mat()
    cv.adaptiveThreshold(unsharp, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, threshType, blockSize, opts.adaptiveC)
    toDelete.push(binary)
  }

  if (opts.pepperRemoval) {
    const step1 = new cv.Mat()
    cv.medianBlur(binary, step1, 3)
    binary.delete()
    const kO = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(morphK, morphK))
    const kC = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(morphK, morphK))
    const step2 = new cv.Mat()
    cv.morphologyEx(step1, step2, cv.MORPH_OPEN, kO)
    step1.delete()
    kO.delete()
    const afterClose = new cv.Mat()
    cv.morphologyEx(step2, afterClose, cv.MORPH_CLOSE, kC)
    step2.delete()
    kC.delete()
    binary = afterClose
    toDelete.push(binary)
  }
  if (opts.textReinforce) {
    const kD = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2))
    cv.dilate(binary, binary, kD)
    kD.delete()
  }
  if (useInv) {
    const inverted = new cv.Mat()
    cv.bitwise_not(binary, inverted)
    binary.delete()
    binary = inverted
    toDelete.push(binary)
  }
  const finalBW = new cv.Mat()
  cv.threshold(binary, finalBW, 245, 255, cv.THRESH_BINARY)
  toDelete.push(finalBW)
  if (debug?.frames) (debug.frames as any).finalBW = matToDataUrl(cv, finalBW)
  const out = new cv.Mat()
  cv.cvtColor(finalBW, out, cv.COLOR_GRAY2RGBA)
  toDelete.forEach((m) => { if (m !== out) m.delete() })
  return { out, debugFrames: debug?.frames }
}

function enhanceForDocument(cv: any, warpedColor: any): any {
  const opts = { ...DEFAULT_OPTIONS }
  const { out } = enhanceReceipt(cv, warpedColor, opts)
  return out
}

/** Ordena 4 puntos: [top-left, top-right, bottom-right, bottom-left]. Exportado para estabilización temporal. */
export function orderPoints(pts: number[][]): number[][] {
  const byY = pts.slice().sort((a, b) => a[1] - b[1])
  const top = byY.slice(0, 2).sort((a, b) => a[0] - b[0])
  const bottom = byY.slice(2, 4).sort((a, b) => a[0] - b[0])
  return [top[0], top[1], bottom[1], bottom[0]]
}

/** Distancia media entre esquinas correspondientes (ambos arrays ordenados con orderPoints). */
export function cornerDelta(ptsA: number[][], ptsB: number[][]): number {
  if (ptsA.length !== 4 || ptsB.length !== 4) return 1e9
  let sum = 0
  for (let i = 0; i < 4; i++)
    sum += Math.hypot(ptsA[i][0] - ptsB[i][0], ptsA[i][1] - ptsB[i][1])
  return sum / 4
}

const BORDER_K = 10
const AREA_MIN_RATIO = 0.05
const AREA_MAX_RATIO = 0.7
const ASPECT_MIN = 1.2
const ASPECT_MAX = 12
const BORDER_POINTS_RATIO_MAX = 0.25
const TEXT_LIKENESS_EDGE_DENSITY_MIN = 0.012
const WARP_TARGET_WIDTH_MIN = 1200
const WARP_TARGET_WIDTH_MAX = 2000
const WARP_PADDING_PX = 12
/** Detección de contorno en downscale para velocidad; corners se escalan a full-res. */
const DETECT_DOWNSCALE_MAX = 1024

/** Assert: pipeline must never export canny/edge map as final output. */
function assertNotEdgeMap(cv: any, mat: any) {
  if (!mat || mat.type?.() === undefined) return
  const t = mat.type()
  if (t === (cv as any).CV_8UC1) {
    const mean = new cv.Mat()
    cv.meanStdDev(mat, mean, new cv.Mat())
    const m = (mean.data64F && mean.data64F[0]) ?? 0
    mean.delete()
    if (m < 20 || m > 235) return
  }
}

/** Post-check: resultado parece edge-map (pocos tonos + alta densidad de bordes). Mat RGBA. */
function looksLikeEdgeMap(cv: any, rgba: any): boolean {
  if (!rgba || rgba.rows * rgba.cols < 100) return false
  try {
    const gray = new cv.Mat()
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY)
    const meanMat = new cv.Mat()
    const stdMat = new cv.Mat()
    cv.meanStdDev(gray, meanMat, stdMat)
    const m = (meanMat.data64F && meanMat.data64F[0]) ?? 0
    meanMat.delete()
    stdMat.delete()
    const edges = new cv.Mat()
    cv.Canny(gray, edges, 50, 150)
    const nz = typeof cv.countNonZero === 'function' ? cv.countNonZero(edges) : 0
    edges.delete()
    gray.delete()
    const density = nz / (rgba.rows * rgba.cols)
    return m >= 50 && m <= 200 && density > 0.25
  } catch {
    return false
  }
}

/** Post-check: borde externo mayormente blanco. Mat RGBA. */
function borderMostlyWhite(cv: any, rgba: any, borderPx: number = 3): boolean {
  if (!rgba || rgba.rows * rgba.cols < 100) return true
  try {
    const gray = new cv.Mat()
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY)
    const h = gray.rows
    const w = gray.cols
    const mask = new cv.Mat.zeros(h, w, cv.CV_8UC1)
    const white = new cv.Scalar(255)
    cv.rectangle(mask, { x: 0, y: 0 }, { x: w, y: borderPx }, white, -1)
    cv.rectangle(mask, { x: 0, y: h - borderPx }, { x: w, y: h }, white, -1)
    cv.rectangle(mask, { x: 0, y: 0 }, { x: borderPx, y: h }, white, -1)
    cv.rectangle(mask, { x: w - borderPx, y: 0 }, { x: w, y: h }, white, -1)
    const meanMat = new cv.Mat()
    const stdMat = new cv.Mat()
    cv.meanStdDev(gray, meanMat, stdMat, mask)
    const m = (meanMat.data64F && meanMat.data64F[0]) ?? 0
    gray.delete()
    mask.delete()
    meanMat.delete()
    stdMat.delete()
    return m >= 200
  } catch {
    return true
  }
}

/** Post-check B/N: demasiados componentes pequeños (puntitos). Mat RGBA (salida B/N). */
function hasTooManySmallComponents(cv: any, rgba: any, areaMax: number = 40, countMax: number = 100): boolean {
  if (!rgba || rgba.rows * rgba.cols < 100) return false
  try {
    const gray = new cv.Mat()
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY)
    const bin = new cv.Mat()
    cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
    gray.delete()
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    cv.findContours(bin, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)
    bin.delete()
    let smallCount = 0
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i)
      const area = cv.contourArea(c)
      if (area > 0 && area < areaMax) smallCount++
    }
    hierarchy.delete()
    contours.delete()
    return smallCount > countMax
  } catch {
    return false
  }
}

/** Text-likeness: edge density in low-res ROI. Returns 0..1; candidates below threshold are rejected. */
function textLikenessScore(cv: any, gray: any, hull: any, W: number, H: number): number {
  try {
    const mask = new cv.Mat(H, W, cv.CV_8UC1)
    mask.setTo(new cv.Scalar(0))
    cv.fillConvexPoly(mask, hull, new cv.Scalar(255))
    const roi = new cv.Mat()
    gray.copyTo(roi, mask)
    mask.delete()
    const lowW = 160
    const lowH = 100
    const small = new cv.Mat()
    cv.resize(roi, small, new cv.Size(lowW, lowH), 0, 0, cv.INTER_AREA)
    roi.delete()
    const edges = new cv.Mat()
    cv.Canny(small, edges, 40, 120)
    const total = lowW * lowH
    let nonZero = 0
    try {
      if (typeof cv.countNonZero === 'function') nonZero = cv.countNonZero(edges)
      else {
        const d = edges.data
        if (d && d.length >= total) for (let i = 0; i < total; i++) if (d[i] > 0) nonZero++
      }
    } catch {
      const d = (edges as any).data
      if (d) for (let i = 0; i < total; i++) if (d[i] > 0) nonZero++
    }
    edges.delete()
    small.delete()
    return total > 0 ? nonZero / total : 0
  } catch {
    return 0
  }
}

function borderPointsRatio(cv: any, hull: any, W: number, H: number): number {
  let near = 0
  const n = hull.rows
  for (let i = 0; i < n; i++) {
    const x = hull.data32S[i * 2]
    const y = hull.data32S[i * 2 + 1]
    if (x <= BORDER_K || x >= W - BORDER_K || y <= BORDER_K || y >= H - BORDER_K) near++
  }
  return n > 0 ? near / n : 0
}

/** paperContrast = meanInside - meanOutside; texturePenalty from stdInside (mesa = high std). */
function paperContrastAndTexture(cv: any, gray: any, hull: any, W: number, H: number): { paperContrast: number; stdInside: number } {
  try {
    const mask = new cv.Mat(H, W, cv.CV_8UC1)
    mask.setTo(new cv.Scalar(0))
    cv.fillConvexPoly(mask, hull, new cv.Scalar(255))
    const meanMat = new cv.Mat()
    const stdMat = new cv.Mat()
    cv.meanStdDev(gray, meanMat, stdMat, mask)
    const meanInside = (meanMat.data64F && meanMat.data64F[0]) ?? 0
    const stdInside = (stdMat.data64F && stdMat.data64F[0]) ?? 0
    meanMat.delete()
    stdMat.delete()
    const maskInv = new cv.Mat()
    cv.bitwise_not(mask, maskInv)
    const meanOutMat = new cv.Mat()
    const stdOutMat = new cv.Mat()
    cv.meanStdDev(gray, meanOutMat, stdOutMat, maskInv)
    maskInv.delete()
    const meanOutside = (meanOutMat.data64F && meanOutMat.data64F[0]) ?? 0
    meanOutMat.delete()
    stdOutMat.delete()
    mask.delete()
    return { paperContrast: meanInside - meanOutside, stdInside }
  } catch {
    return { paperContrast: 0, stdInside: 999 }
  }
}

export type ContourResult = { pts: number[][]; contourScore: number; textLikenessScore: number }

/**
 * Receipt contour selection: score by rectness, area, aspect; reject >25% points near border;
 * text-likeness validation (edge density in ROI). Returns best candidate with scores or null.
 */
function selectReceiptContour(cv: any, contours: any, W: number, H: number, gray: any): ContourResult | null {
  const frameArea = W * H
  let bestScore = -1e9
  let bestPts: number[][] | null = null
  let bestTextLikeness = 0

  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i)
    const hull = new cv.Mat()
    cv.convexHull(cnt, hull)
    const area = cv.contourArea(hull)
    const areaRatio = area / frameArea
    if (areaRatio < AREA_MIN_RATIO || areaRatio > AREA_MAX_RATIO) {
      hull.delete()
      continue
    }

    let rect: any
    try {
      rect = cv.minAreaRect(hull)
    } catch {
      hull.delete()
      continue
    }
    const w = rect.size.width || 1
    const h = rect.size.height || 1
    const aspect = Math.max(w, h) / Math.min(w, h)
    if (aspect < ASPECT_MIN || aspect > ASPECT_MAX) {
      hull.delete()
      continue
    }

    const borderRatio = borderPointsRatio(cv, hull, W, H)
    if (borderRatio > BORDER_POINTS_RATIO_MAX) {
      hull.delete()
      continue
    }

    if (gray) {
      const textScore = textLikenessScore(cv, gray, hull, W, H)
      if (textScore < TEXT_LIKENESS_EDGE_DENSITY_MIN) {
        hull.delete()
        continue
      }
    }

    const approx = new cv.Mat()
    const eps = 0.02 * cv.arcLength(hull, true)
    cv.approxPolyDP(hull, approx, eps, true)
    const isRect = approx.rows === 4
    approx.delete()

    let paperContrastNorm = 0
    let texturePenalty = 0
    if (gray) {
      const { paperContrast, stdInside } = paperContrastAndTexture(cv, gray, hull, W, H)
      if (paperContrast < 5) {
        hull.delete()
        continue
      }
      paperContrastNorm = Math.min(1, paperContrast / 60)
      texturePenalty = Math.min(1.5, stdInside / 55)
    }
    const rectnessScore = isRect ? 1 : 0.6
    const areaNorm = Math.max(0, Math.min(1, areaRatio / 0.35))
    const aspectNorm = Math.max(0, Math.min(1, (aspect - 1.2) / (8.0 - 1.2)))
    const borderPenalty = borderRatio * 4
    const angleDeg = Math.abs(rect.angle ?? 0)
    const skewPenalty = angleDeg > 45 && areaRatio > 0.35 ? 1 : 0
    const score =
      3.0 * rectnessScore +
      2.0 * areaNorm +
      2.0 * aspectNorm +
      1.5 * paperContrastNorm -
      3.0 * borderPenalty -
      2.0 * skewPenalty -
      1.5 * texturePenalty

    if (score > bestScore) {
      bestScore = score
      bestTextLikeness = gray ? textLikenessScore(cv, gray, hull, W, H) : 0
      let pts: number[][]
      if (isRect) {
        const approx2 = new cv.Mat()
        const eps2 = 0.02 * cv.arcLength(hull, true)
        cv.approxPolyDP(hull, approx2, eps2, true)
        pts = []
        for (let j = 0; j < 4; j++) {
          pts.push([approx2.data32S[j * 2], approx2.data32S[j * 2 + 1]])
        }
        approx2.delete()
      } else {
        const boxMat = new cv.Mat()
        cv.boxPoints(rect, boxMat)
        pts = []
        for (let j = 0; j < 4; j++) {
          pts.push([Math.round(boxMat.data32F[j * 2]), Math.round(boxMat.data32F[j * 2 + 1])])
        }
        boxMat.delete()
      }
      bestPts = orderPoints(pts)
    }
    hull.delete()
  }
  return bestPts ? { pts: bestPts, contourScore: bestScore, textLikenessScore: bestTextLikeness } : null
}

function findReceiptCorners(cv: any, src: any): ContourResult | null {
  const W = src.cols
  const H = src.rows
  const gray = new cv.Mat()
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
  const bilateral = new cv.Mat()
  try {
    cv.bilateralFilter(gray, bilateral, 7, 50, 50)
  } catch {
    cv.GaussianBlur(gray, bilateral, new cv.Size(5, 5), 0)
  }
  const edges = new cv.Mat()
  cv.Canny(bilateral, edges, 50, 150)
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(2, 2))
  cv.dilate(edges, edges, kernel)
  kernel.delete()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)
  let result = selectReceiptContour(cv, contours, W, H, bilateral)
  if (!result && contours.size() > 0) {
    const thresh = new cv.Mat()
    cv.threshold(bilateral, thresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
    cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
    result = selectReceiptContour(cv, contours, W, H, bilateral)
    thresh.delete()
  }
  gray.delete()
  bilateral.delete()
  edges.delete()
  hierarchy.delete()
  contours.delete()
  return result
}

/**
 * Detecta las 4 esquinas del recibo en el canvas (overlay en vivo).
 */
export async function detectDocumentCorners(canvas: HTMLCanvasElement): Promise<number[][] | null> {
  if (typeof window === 'undefined') return null
  await loadOpenCV()
  const cv = (typeof window !== 'undefined' && (window as any).cv) as any
  if (!cv || typeof cv.imread !== 'function') return null
  try {
    const src = cv.imread(canvas)
    const result = findReceiptCorners(cv, src)
    src.delete()
    return result ? result.pts : null
  } catch {
    return null
  }
}

export type CaptureLog = { contourScore: number; textLikenessScore: number }
export type ProcessDocumentResult = {
  blob: Blob | null
  debugFrames?: Partial<DebugFrames>
  captureLog?: CaptureLog
  /** Esquinas ordenadas [tl, tr, br, bl] en coordenadas de imagen original. */
  corners?: number[][]
}

/**
 * Procesa documento con opciones y opcionalmente devuelve frames de debug.
 */
export async function processDocumentWithOptions(
  imageBlob: Blob,
  options?: ReceiptEnhanceOptions,
  returnDebug?: boolean
): Promise<ProcessDocumentResult | Blob | null> {
  if (typeof window === 'undefined') return imageBlob
  await loadOpenCV()
  const cv = (typeof window !== 'undefined' && (window as any).cv) as any
  if (!cv || typeof cv.imread !== 'function') return imageBlob
  const opts = { ...DEFAULT_OPTIONS, ...options }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(imageBlob)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvasIn = document.createElement('canvas')
      canvasIn.width = img.naturalWidth
      canvasIn.height = img.naturalHeight
      const ctxIn = canvasIn.getContext('2d')
      if (!ctxIn) {
        resolve(imageBlob)
        return
      }
      ctxIn.drawImage(img, 0, 0)
      try {
        const fullW = canvasIn.width
        const fullH = canvasIn.height
        const maxSide = Math.max(fullW, fullH)
        let ordered: number[][]
        let contourResult: ContourResult | null = null

        if (maxSide > DETECT_DOWNSCALE_MAX) {
          const smallScale = DETECT_DOWNSCALE_MAX / maxSide
          const smallW = Math.round(fullW * smallScale)
          const smallH = Math.round(fullH * smallScale)
          const smallCanvas = document.createElement('canvas')
          smallCanvas.width = smallW
          smallCanvas.height = smallH
          const sctx = smallCanvas.getContext('2d')
          if (sctx) {
            sctx.drawImage(canvasIn, 0, 0, fullW, fullH, 0, 0, smallW, smallH)
            const srcSmall = (cv as any).imread(smallCanvas)
            contourResult = findReceiptCorners(cv, srcSmall)
            srcSmall.delete()
          }
          if (!contourResult || contourResult.pts.length !== 4) {
            if (returnDebug) resolve({ blob: null as any, debugFrames: {} })
            else resolve(null)
            return
          }
          const orderedSmall = orderPoints(contourResult.pts)
          ordered = orderedSmall.map(([x, y]) => [x / smallScale, y / smallScale])
        } else {
          const src = (cv as any).imread(canvasIn)
          contourResult = findReceiptCorners(cv, src)
          src.delete()
          if (!contourResult || contourResult.pts.length !== 4) {
            if (returnDebug) resolve({ blob: null as any, debugFrames: {} })
            else resolve(null)
            return
          }
          ordered = orderPoints(contourResult.pts)
        }
        const w1 = Math.hypot(ordered[1][0] - ordered[0][0], ordered[1][1] - ordered[0][1])
        const w2 = Math.hypot(ordered[2][0] - ordered[3][0], ordered[2][1] - ordered[3][1])
        const h1 = Math.hypot(ordered[3][0] - ordered[0][0], ordered[3][1] - ordered[0][1])
        const h2 = Math.hypot(ordered[2][0] - ordered[1][0], ordered[2][1] - ordered[1][1])
        let docW = Math.max(Math.round(w1), Math.round(w2), 100)
        let docH = Math.max(Math.round(h1), Math.round(h2), 100)
        const docMaxSide = Math.max(docW, docH)
        const targetWidth = Math.min(WARP_TARGET_WIDTH_MAX, Math.max(WARP_TARGET_WIDTH_MIN, docMaxSide))
        const scale = targetWidth / docMaxSide
        docW = Math.round(docW * scale)
        docH = Math.round(docH * scale)
        const pad = WARP_PADDING_PX
        const w = docW + 2 * pad
        const h = docH + 2 * pad
        const srcPts = (cv as any).matFromArray(4, 1, (cv as any).CV_32FC2, ordered.flat())
        const dstPts = (cv as any).matFromArray(4, 1, (cv as any).CV_32FC2, [pad, pad, docW + pad, pad, docW + pad, docH + pad, pad, docH + pad])
        const M = (cv as any).getPerspectiveTransform(srcPts, dstPts)
        const src2 = (cv as any).imread(canvasIn)
        const dst = new (cv as any).Mat()
        const interp = (cv as any).INTER_CUBIC !== undefined ? (cv as any).INTER_CUBIC : (cv as any).INTER_LINEAR
        ;(cv as any).warpPerspective(src2, dst, M, new (cv as any).Size(w, h), interp)
        srcPts.delete()
        dstPts.delete()
        M.delete()
        src2.delete()
        assertNotEdgeMap(cv, dst)
        const debugFrames: Partial<DebugFrames> = returnDebug ? { perspectiveCorrected: matToDataUrl(cv, dst) } : {}
        let { out: enhanced, debugFrames: df } = enhanceReceipt(cv, dst, opts, returnDebug ? { frames: debugFrames } : undefined)
        assertNotEdgeMap(cv, enhanced)
        if (opts.outputMode === 'color' || opts.outputMode === 'grayscale') {
          if (looksLikeEdgeMap(cv, enhanced)) {
            enhanced.delete()
            dst.delete()
            if (returnDebug) resolve({ blob: null as any, debugFrames, captureLog: undefined })
            else resolve(null)
            return
          }
          if (!borderMostlyWhite(cv, enhanced)) {
            enhanced.delete()
            dst.delete()
            if (returnDebug) resolve({ blob: null as any, debugFrames, captureLog: undefined })
            else resolve(null)
            return
          }
        }
        if (opts.outputMode === 'bw' && hasTooManySmallComponents(cv, enhanced)) {
          enhanced.delete()
          const grayOpts = { ...opts, outputMode: 'grayscale' as const }
          const res = enhanceReceipt(cv, dst, grayOpts, returnDebug ? { frames: debugFrames } : undefined)
          enhanced = res.out
          if (returnDebug && res.debugFrames) Object.assign(debugFrames, res.debugFrames)
        }
        dst.delete()
        if (returnDebug && df) Object.assign(debugFrames, df)
        const canvasOut = document.createElement('canvas')
        canvasOut.width = w
        canvasOut.height = h
        ;(cv as any).imshow(canvasOut, enhanced)
        enhanced.delete()
        const captureLog: CaptureLog | undefined = returnDebug
          ? { contourScore: contourResult.contourScore, textLikenessScore: contourResult.textLikenessScore }
          : undefined
        canvasOut.toBlob(
          (b: Blob | null) => {
            if (!b) { resolve(returnDebug ? { blob: imageBlob, debugFrames, captureLog, corners: ordered } : imageBlob); return }
            if (returnDebug) resolve({ blob: b, debugFrames, captureLog, corners: ordered })
            else resolve(b)
          },
          'image/jpeg',
          0.92
        )
      } catch {
        resolve(imageBlob)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(returnDebug ? { blob: imageBlob } : imageBlob)
    }
    img.src = url
  })
}

/**
 * Procesa documento con esquinas manuales (recorte manual). No detecta contorno; hace warp + enhancement.
 * corners: [tl, tr, br, bl] en coordenadas de imagen (mismo orden que orderPoints).
 */
export async function processDocumentWithManualCorners(
  imageBlob: Blob,
  corners: number[][],
  options?: ReceiptEnhanceOptions,
  returnDebug?: boolean
): Promise<ProcessDocumentResult | Blob | null> {
  if (typeof window === 'undefined' || !corners || corners.length !== 4) return imageBlob
  await loadOpenCV()
  const cv = (typeof window !== 'undefined' && (window as any).cv) as any
  if (!cv || typeof cv.imread !== 'function') return imageBlob
  const opts = { ...DEFAULT_OPTIONS, ...options }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(imageBlob)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvasIn = document.createElement('canvas')
      canvasIn.width = img.naturalWidth
      canvasIn.height = img.naturalHeight
      const ctxIn = canvasIn.getContext('2d')
      if (!ctxIn) {
        resolve(returnDebug ? { blob: null as any, debugFrames: {} } : null)
        return
      }
      ctxIn.drawImage(img, 0, 0)
      try {
        const ordered = orderPoints(corners.map((p) => [p[0], p[1]]))
        const w1 = Math.hypot(ordered[1][0] - ordered[0][0], ordered[1][1] - ordered[0][1])
        const w2 = Math.hypot(ordered[2][0] - ordered[3][0], ordered[2][1] - ordered[3][1])
        const h1 = Math.hypot(ordered[3][0] - ordered[0][0], ordered[3][1] - ordered[0][1])
        const h2 = Math.hypot(ordered[2][0] - ordered[1][0], ordered[2][1] - ordered[1][1])
        let docW = Math.max(Math.round(w1), Math.round(w2), 100)
        let docH = Math.max(Math.round(h1), Math.round(h2), 100)
        const maxSide = Math.max(docW, docH)
        const targetWidth = Math.min(WARP_TARGET_WIDTH_MAX, Math.max(WARP_TARGET_WIDTH_MIN, maxSide))
        const scale = targetWidth / maxSide
        docW = Math.round(docW * scale)
        docH = Math.round(docH * scale)
        const pad = WARP_PADDING_PX
        const w = docW + 2 * pad
        const h = docH + 2 * pad
        const srcPts = (cv as any).matFromArray(4, 1, (cv as any).CV_32FC2, ordered.flat())
        const dstPts = (cv as any).matFromArray(4, 1, (cv as any).CV_32FC2, [pad, pad, docW + pad, pad, docW + pad, docH + pad, pad, docH + pad])
        const M = (cv as any).getPerspectiveTransform(srcPts, dstPts)
        const src2 = (cv as any).imread(canvasIn)
        const dst = new (cv as any).Mat()
        const interp = (cv as any).INTER_CUBIC !== undefined ? (cv as any).INTER_CUBIC : (cv as any).INTER_LINEAR
        ;(cv as any).warpPerspective(src2, dst, M, new (cv as any).Size(w, h), interp)
        srcPts.delete()
        dstPts.delete()
        M.delete()
        src2.delete()
        const debugFrames: Partial<DebugFrames> = returnDebug ? { perspectiveCorrected: matToDataUrl(cv, dst) } : {}
        let { out: enhanced, debugFrames: df } = enhanceReceipt(cv, dst, opts, returnDebug ? { frames: debugFrames } : undefined)
        dst.delete()
        if (returnDebug && df) Object.assign(debugFrames, df)
        const canvasOut = document.createElement('canvas')
        canvasOut.width = w
        canvasOut.height = h
        ;(cv as any).imshow(canvasOut, enhanced)
        enhanced.delete()
        canvasOut.toBlob(
          (b: Blob | null) => {
            if (!b) {
              resolve(returnDebug ? { blob: imageBlob, debugFrames, corners: ordered } : imageBlob)
              return
            }
            resolve(returnDebug ? { blob: b, debugFrames, corners: ordered } : b)
          },
          'image/jpeg',
          0.92
        )
      } catch {
        resolve(returnDebug ? { blob: imageBlob, debugFrames: {} } : imageBlob)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(returnDebug ? { blob: imageBlob } : imageBlob)
    }
    img.src = url
  })
}

/**
 * Procesa documento (recibo): detección por scoring, corrección de perspectiva, pipeline recibo.
 * Compatible con la UX actual.
 */
export async function processDocument(imageBlob: Blob): Promise<Blob | null> {
  const result = await processDocumentWithOptions(imageBlob, undefined, false)
  return result instanceof Blob ? result : (result as ProcessDocumentResult).blob
}
