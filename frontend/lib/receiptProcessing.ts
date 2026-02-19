/**
 * Global guard for long-running receipt extraction.
 *
 * Problem: some pages still auto-redirect to `/login` when Supabase session is missing
 * or when backend is temporarily unstable. During receipt extraction (which can take
 * minutes), those redirects can kick the user out mid-process.
 *
 * Solution: mark "receipt processing" globally (window + localStorage with expiry)
 * and use `safePushLogin` instead of `router.push('/login')`.
 */
const LS_KEY = 'domus_receipt_processing_started_at'
const MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes safety TTL

export function setReceiptProcessing(active: boolean) {
  if (typeof window === 'undefined') return
  ;(window as any).__domus_receipt_processing = !!active
  try {
    if (active) localStorage.setItem(LS_KEY, String(Date.now()))
    else localStorage.removeItem(LS_KEY)
  } catch {
    // ignore
  }
}

export function isReceiptProcessing(): boolean {
  if (typeof window === 'undefined') return false
  if ((window as any).__domus_receipt_processing) return true

  try {
    const v = localStorage.getItem(LS_KEY)
    if (!v) return false
    const startedAt = Number.parseInt(v, 10)
    if (!Number.isFinite(startedAt) || startedAt <= 0) {
      localStorage.removeItem(LS_KEY)
      return false
    }
    if (Date.now() - startedAt > MAX_AGE_MS) {
      localStorage.removeItem(LS_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

export type LoginRouterLike = {
  push: (href: string) => void
  replace?: (href: string) => void
}

export function safePushLogin(router: LoginRouterLike, reason?: string) {
  if (isReceiptProcessing()) {
    // Do not kick the user out in the middle of a long operation.
    if (typeof window !== 'undefined') {
      console.warn('⏳ Skip redirect to /login (receipt processing).', reason || '')
    }
    return
  }
  router.push('/login')
}

