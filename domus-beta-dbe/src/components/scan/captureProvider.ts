/**
 * CaptureProvider: 3 backends para captura tipo Genius Scan.
 * 1) iOS: <input type="file" capture="environment"> → foto nativa (mejor calidad).
 * 2) ImageCapture.takePhoto() si hay stream disponible.
 * 3) VideoFrameFallback: snapshot del canvas (último recurso).
 */

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export type CaptureBackend = 'file' | 'takePhoto' | 'videoFrame'

/**
 * Pide una foto usando el backend nativo de archivo (input file).
 * En iOS abre la cámara nativa y devuelve una foto de alta calidad.
 * En desktop abre el selector de archivos.
 */
export function requestPhotoFromFileInput(): Promise<Blob | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    input.style.top = '0'
    document.body.appendChild(input)

    const cleanup = () => {
      input.removeEventListener('change', onChange)
      document.body.removeChild(input)
    }

    const onChange = () => {
      cleanup()
      const file = input.files?.[0]
      if (file && file.type.startsWith('image/')) {
        resolve(file as Blob)
      } else {
        resolve(null)
      }
    }

    input.addEventListener('change', onChange)
    input.click()
  })
}

/**
 * Captura un still desde el stream: ImageCapture.takePhoto() o fallback a canvas.
 */
export function requestPhotoFromStream(stream: MediaStream): Promise<{ blob: Blob; backend: CaptureBackend } | null> {
  const track = stream.getVideoTracks()[0]
  if (!track) return Promise.resolve(null)

  const ImageCaptureCtor = typeof (window as any).ImageCapture !== 'undefined' ? (window as any).ImageCapture : null

  if (ImageCaptureCtor) {
    try {
      const cap = new ImageCaptureCtor(track)
      return cap.takePhoto().then((blob: Blob) => ({ blob, backend: 'takePhoto' as CaptureBackend })).catch(() => null)
    } catch {
      // fall through to canvas
    }
  }

  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      video.play().then(() => {
        const w = video.videoWidth
        const h = video.videoHeight
        if (w === 0 || h === 0) {
          resolve(null)
          return
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(video, 0, 0, w, h)
        canvas.toBlob((blob) => {
          resolve(blob ? { blob, backend: 'videoFrame' as CaptureBackend } : null)
        }, 'image/jpeg', 0.92)
      }).catch(() => resolve(null))
    }
    video.onerror = () => resolve(null)
  })
}

/**
 * Decide el método preferido para este dispositivo.
 * En iOS: file input (foto nativa). En el resto: stream (takePhoto o videoFrame) si ya tenemos stream.
 */
export function getPreferredCaptureMode(): 'file' | 'stream' {
  return isIOS() ? 'file' : 'stream'
}
