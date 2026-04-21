'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'

const TicketCaptureModal = dynamic(
  () => import('@/components/scan/TicketCaptureModal').then((m) => m.TicketCaptureModal),
  { ssr: false }
)

const DomusCalendar = dynamic(
  () => import('@/components/calendar/DomusCalendar').then((m) => m.default),
  { ssr: false }
)

type MeResponse =
  | {
      ok: true
      user: { id: string; email: string; name: string | null; city?: string | null; avatarUrl?: string | null }
      activeFamily: { id: string; name: string } | null
      isFamilyAdmin: boolean
      ownedEntityIds?: string[]
      families: { id: string; name: string; isFamilyAdmin: boolean }[]
    }
  | { detail: string }

function isMeOk(value: MeResponse | null): value is Extract<MeResponse, { ok: true }> {
  return !!value && typeof value === 'object' && 'ok' in value && (value as any).ok === true
}

type FakeDataResponse = {
  ok: true
  createdEntities: number
  createdCategories: number
  createdAllocations: number
  createdTransactions: number
  createdTransactions12M?: number
  seedHint?: string
  skippedTransactions: boolean
  demoUsers?: { email: string; name: string | null; isFamilyAdmin: boolean; password: string }[]
  receipt?: { created: boolean; skipped: boolean; reason?: string; receiptId?: string }
}

type UiView = 'dashboard' | 'presupuesto' | 'transacciones' | 'calendario' | 'usuarios' | 'configuracion' | 'solicitudes' | 'documentos' | 'cosas' | 'tx'
type TxTab = 'Detalle' | 'Evidencias'

type EntityType = 'PERSON' | 'HOUSE' | 'PET' | 'VEHICLE' | 'PROJECT' | 'FUND' | 'GROUP' | 'OTHER'
type RangeKey = 'this_month' | 'prev_month' | 'last_90' | 'all'
type ReceiptFilter = 'all' | 'with' | 'without' | 'to_confirm'

const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'PERSON', label: 'Persona' },
  { value: 'HOUSE', label: 'Casa' },
  { value: 'PET', label: 'Mascota' },
  { value: 'VEHICLE', label: 'Vehículo' },
  { value: 'PROJECT', label: 'Proyecto' },
  { value: 'FUND', label: 'Fondo' },
  { value: 'GROUP', label: 'Grupo' },
  { value: 'OTHER', label: 'Otro' },
]

/** Solo UI: sugiere separar concepto (categoría) de destino/bien (BMW, Casa X). No bloquea guardar. */
function categoryNameCombinedWarning(name: string): string | null {
  const t = name.trim()
  if (t.length < 4) return null
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length < 2) return null
  const last = words[words.length - 1]
  // "Gasolina BMW", "Seguro BMW" — segundo término parece marca/modelo en MAYÚSCULAS
  if (/^[A-ZÁÉÍÓÚÑ]{2,12}$/.test(last) && last.length <= 8) {
    return 'Mejor: Destino = el bien (ej. tu BMW) y Categoría = solo el tipo de gasto (ej. «Gasolina»). Así no mezclas vehículo y concepto en el nombre de la categoría.'
  }
  if (/\b(Gasolina|Seguro|Mantenimiento|Supermercado|Luz|Agua|Comida)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/.test(t)) {
    return 'Si el segundo término es un modelo o nombre propio, define un Destino para eso y deja la categoría solo con el tipo de gasto.'
  }
  const brandLike = /^(bmw|audi|mercedes|toyota|honda|mazda|ford|kia|hyundai|vw|seat|volkswagen|tesla)$/i
  if (words.length >= 2 && brandLike.test(last.replace(/\.$/, ''))) {
    return '¿Incluiste marca o modelo en la categoría? Mejor: Destino = el auto/persona y Categoría = solo el tipo (ej. «Gasolina»).'
  }
  return null
}

/**
 * Solo UI: oculta categorías poco coherentes con el tipo de destino (ej. Colegiaturas en un Vehículo).
 * Si el usuario activa "Mostrar todas", no se usa. No altera datos ni API.
 */
function categoryLooksWrongForDestinationType(entityType: string | undefined, categoryName: string): boolean {
  if (!entityType || !categoryName.trim()) return false
  const raw = categoryName.trim()
  const n = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
  const test = (re: RegExp) => re.test(n) || re.test(raw)

  switch (entityType) {
    case 'VEHICLE':
      return (
        test(/mascota/) ||
        test(/veterinar/) ||
        test(/colegiatur/) ||
        test(/util(es)?\s*escolar/) ||
        test(/hipoteca/) ||
        test(/reparaciones?\s+de\s+casa/) ||
        test(/limpieza\s*\/\s*hogar/) ||
        test(/^limpieza\s*\/\s*hogar$/i) ||
        test(/mascotas\b/) ||
        test(/luz\s*\/\s*agua|agua\s*\/\s*internet|internet\s*\/\s*telefono/) ||
        test(/servicios\s*\(\s*luz/)
      )
    case 'PET':
      return (
        test(/\bgasolina\b/) ||
        test(/combustible/) ||
        test(/mantenimiento\s+auto/) ||
        test(/seguro\s*auto/) ||
        test(/verificaci[oó]n/) ||
        test(/\bpeaje\b/) ||
        test(/\bllanta/) ||
        test(/\btag\b/) ||
        test(/tenencia/) ||
        test(/colegiatur/) ||
        test(/util(es)?\s*escolar/)
      )
    case 'HOUSE':
      return (
        test(/\bgasolina\b/) ||
        test(/mantenimiento\s+auto/) ||
        test(/seguro\s*auto/) ||
        test(/veterinar/) ||
        test(/^mascotas?$/) ||
        test(/\bmascotas\b/)
      )
    case 'PERSON':
      return test(/reparaciones?\s+de\s+casa/) || test(/limpieza\s*\/\s*hogar/)
    default:
      return false
  }
}

function entityTypeLabel(value: unknown) {
  switch (value) {
    case 'PERSON':
      return 'Persona'
    case 'HOUSE':
      return 'Casa'
    case 'PET':
      return 'Mascota'
    case 'VEHICLE':
      return 'Vehículo'
    case 'PROJECT':
      return 'Proyecto'
    case 'FUND':
      return 'Fondo'
    case 'GROUP':
      return 'Grupo'
    case 'OTHER':
      return 'Otro'
    default:
      return String(value || '—')
  }
}

/** Agrupa destinos por tipo para `<optgroup>` (orden fijo, nombres en español). */
const ENTITY_OPTGROUP_ORDER: readonly { type: string; label: string }[] = [
  { type: 'PERSON', label: 'Personas' },
  { type: 'HOUSE', label: 'Casas y espacios' },
  { type: 'VEHICLE', label: 'Vehículos y transporte' },
  { type: 'PET', label: 'Mascotas' },
  { type: 'GROUP', label: 'Grupos' },
  { type: 'FUND', label: 'Fondos' },
  { type: 'PROJECT', label: 'Proyectos' },
  { type: 'OTHER', label: 'Otros' },
]

function groupBudgetEntitiesForOptgroups(entities: readonly unknown[]): { label: string; items: unknown[] }[] {
  const byType = new Map<string, unknown[]>()
  for (const row of ENTITY_OPTGROUP_ORDER) byType.set(row.type, [])
  for (const e of entities) {
    const t = String((e as { type?: string })?.type || 'OTHER')
    if (!byType.has(t)) byType.set(t, [])
    byType.get(t)!.push(e)
  }
  const sortByName = (a: unknown, b: unknown) =>
    String((a as { name?: string })?.name || '').localeCompare(String((b as { name?: string })?.name || ''), 'es', {
      sensitivity: 'base',
    })
  const out: { label: string; items: unknown[] }[] = []
  const known = new Set(ENTITY_OPTGROUP_ORDER.map((r) => r.type))
  for (const { type, label } of ENTITY_OPTGROUP_ORDER) {
    const items = (byType.get(type) || []).slice().sort(sortByName)
    if (items.length) out.push({ label, items })
  }
  for (const [type, items] of byType) {
    if (!known.has(type) && items.length) {
      out.push({ label: entityTypeLabel(type), items: items.slice().sort(sortByName) })
    }
  }
  return out
}

/** Misma regla que en API: moto/auto/mascota deben tener al menos un dueño. */
function entityTypeNeedsOwnerForCreate(type: string): boolean {
  return type === 'VEHICLE' || type === 'PET'
}

function entityOwnerNamesPreview(e: unknown, maxNames = 3): { text: string; truncated: boolean } {
  const owners = Array.isArray((e as { owners?: unknown })?.owners) ? (e as { owners: any[] }).owners : []
  const names = owners
    .map((o) => String(o?.user?.name || o?.user?.email || '').trim())
    .filter(Boolean)
  const truncated = names.length > maxNames
  const text = names.slice(0, maxNames).join(', ') + (truncated ? '…' : '')
  return { text, truncated }
}

function rangeDates(key: RangeKey) {
  const now = new Date()
  const thisStart = monthStart(now)
  if (key === 'this_month') return { from: thisStart, to: addMonths(thisStart, 1), label: 'Mes actual' }
  if (key === 'prev_month') return { from: addMonths(thisStart, -1), to: thisStart, label: 'Mes anterior' }
  if (key === 'last_90') return { from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), to: now, label: 'Últimos 90 días' }
  return { from: null as Date | null, to: null as Date | null, label: 'Todo' }
}

function inDateRange(iso: string, from: Date | null, to: Date | null) {
  const d = new Date(iso)
  const t = d.getTime()
  if (Number.isNaN(t)) return false
  if (from && d < from) return false
  if (to && d >= to) return false
  return true
}

function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1)
}

/** Copia texto al portapapeles; usa fallback execCommand si clipboard API falla (p. ej. Safari, iframe). */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // seguir al fallback
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'absolute'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

function formatMoney(value: number, currency = 'MXN') {
  const v = Number.isFinite(value) ? value : 0
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(v)
  } catch {
    return `$ ${Math.round(v).toLocaleString('es-MX')}`
  }
}

function formatPeriod(d = new Date()) {
  try {
    const s = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  } catch {
    return 'Mes actual'
  }
}

function normKey(value: unknown) {
  const s = String(value || '').trim().toLowerCase()
  if (!s) return ''
  try {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\bdemo\b/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .trim()
  } catch {
    return s.replace(/demo/g, '').replace(/[^a-z0-9]+/g, '').trim()
  }
}

function displayPersonName(value: unknown) {
  const s = String(value || '').trim()
  if (!s) return '—'
  return s.replace(/\s+Demo$/i, '').trim()
}

function initialsFromName(value: unknown) {
  const s = displayPersonName(value)
  const parts = s.split(/\s+/).filter(Boolean)
  const a = (parts[0]?.[0] || '').toUpperCase()
  const b = (parts[1]?.[0] || '').toUpperCase()
  return (a + b) || '—'
}

function normReceiptExtraction(raw: unknown): any | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  return {
    ...o,
    items: Array.isArray(o.items) ? o.items : [],
    merchantName: o.merchantName ?? '',
    date: typeof o.date === 'string' ? o.date : '',
    total: o.total !== null && o.total !== undefined ? Number(o.total) : null,
    tax: o.tax !== null && o.tax !== undefined ? Number(o.tax) : null,
    tip: o.tip !== null && o.tip !== undefined ? Number(o.tip) : null,
  }
}

function UiPageContent() {
  const router = useRouter()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const toastTimerRef = useRef<number | null>(null)
  const [toast, setToast] = useState<{ kind: 'ok' | 'warn' | 'error' | 'info'; text: string } | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<FakeDataResponse | null>(null)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [reportsTab, setReportsTab] = useState<'detalle' | 'resumen' | 'tablas' | 'consumo'>('detalle')
  const [reportsTableTab, setReportsTableTab] = useState<'categorias' | 'objetos' | 'usuarios'>('categorias')
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false)
  const reportsMenuBtnRef = useRef<HTMLButtonElement | null>(null)
  const reportsMenuRef = useRef<HTMLDivElement | null>(null)
  const [consumptionData, setConsumptionData] = useState<{
    utility: Array<{ receiptId: string; receiptDate: string | null; periodStart: string | null; periodEnd: string | null; unit: string; quantity: number; merchantName: string | null }>
    products: Array<{ description: string; unit: string; totalQuantity: number; count: number; receiptDates: string[] }>
    productsGrouped?: Array<{ displayName: string; unit: string; totalQuantity: number; count: number; receiptCount: number; receiptDates: string[] }>
    reposicion: Array<{ description: string; unit: string; betweenPurchasesDays: string[]; avgDays: number }>
  } | null>(null)
  const [consumptionView, setConsumptionView] = useState<'agrupado' | 'detalle'>('agrupado')
  const [consumptionLoading, setConsumptionLoading] = useState(false)
  const [consumptionSeeding, setConsumptionSeeding] = useState(false)
  const [familyMenuOpen, setFamilyMenuOpen] = useState(false)
  const familyMenuBtnRef = useRef<HTMLButtonElement | null>(null)
  const familyMenuRef = useRef<HTMLDivElement | null>(null)
  const [now, setNow] = useState(() => new Date())
  const searchParams = useSearchParams()
  const showBuildSignal = searchParams.get('signal') === '1'
  const [buildVersion, setBuildVersion] = useState<string | null>(null)
  const presupuestoCuentasRef = useRef<HTMLDivElement | null>(null)

  const [view, setView] = useState<UiView>('dashboard')

  useEffect(() => {
    const v = searchParams.get('view')
    if (v === 'presupuesto') setView('presupuesto')
  }, [searchParams])
  const [moneyRequests, setMoneyRequests] = useState<any[]>([])
  const [moneyRequestsLoading, setMoneyRequestsLoading] = useState(false)
  const [solicitudEfectivoOpen, setSolicitudEfectivoOpen] = useState(false)
  const [solicitudEfectivoReason, setSolicitudEfectivoReason] = useState('')
  const [solicitudEfectivoAmount, setSolicitudEfectivoAmount] = useState('')
  const [solicitudEfectivoAllocationId, setSolicitudEfectivoAllocationId] = useState('')
  const [solicitudEfectivoBusy, setSolicitudEfectivoBusy] = useState(false)
  const [solicitudEfectivoDone, setSolicitudEfectivoDone] = useState<{ at: string } | null>(null)
  const [selectedMoneyRequestId, setSelectedMoneyRequestId] = useState<string | null>(null)
  const [fltMoneyRequestStatus, setFltMoneyRequestStatus] = useState<string>('all')
  const [deliverAmountSent, setDeliverAmountSent] = useState('')
  const [deliverBusy, setDeliverBusy] = useState(false)
  const [deliverFilesCount, setDeliverFilesCount] = useState(0)
  const deliverFileInputRef = useRef<HTMLInputElement>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [txTab, setTxTab] = useState<TxTab>('Detalle')
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null)
  const [txDetailSplitPct, setTxDetailSplitPct] = useState<number>(50)
  const txSplitWrapRef = useRef<HTMLDivElement | null>(null)
  const txSplitDragRef = useRef<{ active: boolean; pointerId: number | null }>({ active: false, pointerId: null })
  const reportsPanelRef = useRef<HTMLDivElement | null>(null)

  const didAutoScrollBudgetRef = useRef(false)
  const messageRef = useRef('')
  const viewAsUserRef = useRef<{ userId: string; name: string } | null>(null)

  useEffect(() => {
    messageRef.current = message
  }, [message])

  function showToast(kind: 'ok' | 'warn' | 'error' | 'info', text: string) {
    try {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    } catch {
      // ignore
    }
    setToast({ kind, text })
    try {
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null)
        toastTimerRef.current = null
      }, 2200)
    } catch {
      // ignore
    }
  }

  // Register
  const [rName, setRName] = useState('')
  const [rEmail, setREmail] = useState('')
  const [rPhone, setRPhone] = useState('')
  const [rCity, setRCity] = useState('')
  const [rBelongsToFamily, setRBelongsToFamily] = useState<'yes' | 'no'>('no')
  const [rPass, setRPass] = useState('')
  const [rFamily, setRFamily] = useState('')

  // Login
  const [lEmail, setLEmail] = useState('')
  const [lPass, setLPass] = useState('')

  // Family
  const [newFamilyName, setNewFamilyName] = useState('')
  const [famName, setFamName] = useState('')
  const [famCurrency, setFamCurrency] = useState('MXN')
  const [famCutoffDay, setFamCutoffDay] = useState('1')
  const [famBudgetStartDate, setFamBudgetStartDate] = useState('')
  const [savingFamily, setSavingFamily] = useState(false)
  const [deleteFamilyOpen, setDeleteFamilyOpen] = useState(false)
  const [deleteFamilyEmail, setDeleteFamilyEmail] = useState('')
  const [deleteFamilyPassword, setDeleteFamilyPassword] = useState('')
  const [deleteFamilyBusy, setDeleteFamilyBusy] = useState(false)

  // Invite member
  const [mName, setMName] = useState('')
  const [mEmail, setMEmail] = useState('')
  const [mPass, setMPass] = useState('')
  const [mPhone, setMPhone] = useState('')
  const [mAdmin, setMAdmin] = useState(false)
  const [members, setMembers] = useState<any[] | null>(null)
  const [memberNameDraft, setMemberNameDraft] = useState<Record<string, string>>({})
  const [memberPhoneDraft, setMemberPhoneDraft] = useState<Record<string, string>>({})
  const [memberCityDraft, setMemberCityDraft] = useState<Record<string, string>>({})
  const [memberSavingId, setMemberSavingId] = useState<string | null>(null)
  const [twilioTestSendingId, setTwilioTestSendingId] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarFileInputRef = useRef<HTMLInputElement>(null)
  const [adminSavingId, setAdminSavingId] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null)
  const [usuariosSearchQuery, setUsuariosSearchQuery] = useState('')
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  const [viewingAsUser, setViewingAsUser] = useState<{ userId: string; name: string } | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = sessionStorage.getItem('domus_view_as')
      if (!raw) return null
      const parsed = JSON.parse(raw) as { userId?: string; name?: string }
      if (parsed?.userId && parsed?.name) return { userId: parsed.userId, name: parsed.name }
    } catch {
      // ignore
    }
    return null
  })

  useEffect(() => {
    viewAsUserRef.current = viewingAsUser
  }, [viewingAsUser])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!showBuildSignal) return
    fetch('/api/build-info')
      .then((r) => r.json())
      .then((data: { version?: string }) => setBuildVersion(data?.version ?? null))
      .catch(() => setBuildVersion(null))
  }, [showBuildSignal])

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  type CalendarEvent = { id: string; type: string; title: string; date: string; amount?: number; status?: string; source_table: string; source_id: string | null }
  const [calendarData, setCalendarData] = useState<{
    events: CalendarEvent[]
    familyName: string | null
    summary: { totalEvents: number; paymentsPending: number; paymentsCompleted: number; totalCommitted: number }
  } | null>(null)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0)
  const [calendarEventModalOpen, setCalendarEventModalOpen] = useState(false)
  const [newCalendarEventTitle, setNewCalendarEventTitle] = useState('')
  const [newCalendarEventDate, setNewCalendarEventDate] = useState('')
  const [newCalendarEventType, setNewCalendarEventType] = useState('custom')
  const [calendarEventSubmitBusy, setCalendarEventSubmitBusy] = useState(false)

  const [entityImageUploadingId, setEntityImageUploadingId] = useState<string | null>(null)
  const [entityNameDraft, setEntityNameDraft] = useState<Record<string, string>>({})
  const [categoryNameDraft, setCategoryNameDraft] = useState<Record<string, string>>({})
  const [allocationLimitDraft, setAllocationLimitDraft] = useState<Record<string, string>>({})
  const [allocationPaymentDraft, setAllocationPaymentDraft] = useState<Record<string, { defaultPaymentMethod: string; bankAccountLabel: string; providerClabe: string; providerReference: string }>>({})

  const isAuthed = useMemo(() => me && 'ok' in me && me.ok === true, [me])

  useEffect(() => {
    if (isAuthed) refreshMe()
  }, [viewingAsUser])

  const activeFamilyId = useMemo(() => {
    if (!me || !('ok' in me) || me.ok !== true) return null
    return me.activeFamily?.id ?? null
  }, [me])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setOnboardingDismissed(!!window.localStorage.getItem('domus_onboarding_done'))
  }, [])

  useEffect(() => {
    if (view !== 'calendario' || !activeFamilyId) return
    let cancelled = false
    setCalendarLoading(true)
    const [y, m] = calendarMonth.split('-').map(Number)
    const from = new Date(y, m - 1, 1)
    const to = new Date(y, m, 0, 23, 59, 59)
    const fromStr = from.toISOString().slice(0, 10)
    const toStr = to.toISOString().slice(0, 10)
    fetch(`/api/calendar/events?from=${fromStr}&to=${toStr}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.ok) setCalendarData({
          events: data.events ?? [],
          familyName: data.familyName ?? null,
          summary: data.summary ?? { totalEvents: 0, paymentsPending: 0, paymentsCompleted: 0, totalCommitted: 0 },
        })
        else if (!cancelled) setCalendarData(null)
      })
      .catch(() => { if (!cancelled) setCalendarData(null) })
      .finally(() => { if (!cancelled) setCalendarLoading(false) })
    return () => { cancelled = true }
  }, [view, calendarMonth, activeFamilyId, calendarRefreshTrigger])

  // Presupuesto (destinos / categorías / asignación presupuesto)
  const [familyDetails, setFamilyDetails] = useState<any | null>(null)
  const [entities, setEntities] = useState<any[] | null>(null)
  const [categories, setCategories] = useState<any[] | null>(null)
  const [allocations, setAllocations] = useState<any[] | null>(null)
  const [customEntityTypes, setCustomEntityTypes] = useState<{ id: string; name: string }[]>([])

  const [beType, setBeType] = useState<EntityType>('PERSON')
  const [beCustomTypeId, setBeCustomTypeId] = useState<string | null>(null)
  const [beName, setBeName] = useState('')
  const [customTypeCreateOpen, setCustomTypeCreateOpen] = useState(false)
  const [customTypeNewName, setCustomTypeNewName] = useState('')
  const [customTypeCreating, setCustomTypeCreating] = useState(false)
  const [beInBudget, setBeInBudget] = useState(true)
  const [beInReports, setBeInReports] = useState(true)
  /** Vehículo / Mascota: integrante dueño (obligatorio en API; encaja el «rompecabezas»). */
  const [beOwnerUserId, setBeOwnerUserId] = useState('')

  const [bcType, setBcType] = useState('EXPENSE')
  const [bcName, setBcName] = useState('')

  const [alEntityId, setAlEntityId] = useState('')
  const [alCategoryId, setAlCategoryId] = useState('')
  const [alLimit, setAlLimit] = useState('')
  /** En pestaña Presupuesto: lista corta de categorías según tipo de destino; el usuario puede ampliar. */
  const [allocationShowAllCategories, setAllocationShowAllCategories] = useState(false)
  const [budgetYear, setBudgetYear] = useState(() => String(new Date().getFullYear()))
  const [soloMisDestinos, setSoloMisDestinos] = useState(false)
  const [budgetWizardMemberId, setBudgetWizardMemberId] = useState<string>('')
  const [budgetWizardBusy, setBudgetWizardBusy] = useState(false)
  const [entityOwnersOpen, setEntityOwnersOpen] = useState(false)
  const [entityOwnersEntityId, setEntityOwnersEntityId] = useState<string>('')
  const [entityOwnersMode, setEntityOwnersMode] = useState<'equal' | 'percent'>('equal')
  const [entityOwnersSelected, setEntityOwnersSelected] = useState<string[]>([])
  const [entityOwnersPctDraft, setEntityOwnersPctDraft] = useState<Record<string, string>>({})
  const [entityOwnersSaving, setEntityOwnersSaving] = useState(false)
  const [peopleBudgetOpen, setPeopleBudgetOpen] = useState(false)
  const [peopleBudgetPivot, setPeopleBudgetPivot] = useState<'people' | 'objects'>('people')
  const [peopleBudgetTab, setPeopleBudgetTab] = useState<'vertical' | 'custom'>('vertical')
  const [peopleBudgetNamesOpen, setPeopleBudgetNamesOpen] = useState(false)
  const [peopleBudgetQuery, setPeopleBudgetQuery] = useState('')
  const [peopleBudgetEntityId, setPeopleBudgetEntityId] = useState<string>('')
  const [peopleBudgetCategoryFocusId, setPeopleBudgetCategoryFocusId] = useState<string>('all')
  const [peopleBudgetCoverage, setPeopleBudgetCoverage] = useState<'individual' | 'all'>('all')
  const [peopleBudgetMetric, setPeopleBudgetMetric] = useState<'budget' | 'spent' | 'available'>('spent')
  const [peopleBudgetCols, setPeopleBudgetCols] = useState<'all' | 'active'>('all')
  const [peopleBudgetRows, setPeopleBudgetRows] = useState<'categories' | 'objects' | 'accounts'>('categories')
  const [peopleBudgetTopN, setPeopleBudgetTopN] = useState<number>(12)
  const [peopleBudgetUserId, setPeopleBudgetUserId] = useState<string>('')
  const [budgetModalTab, setBudgetModalTab] = useState<'objetos' | 'categorias' | 'montos'>('montos')
  const [budgetModalAllocId, setBudgetModalAllocId] = useState<string | null>(null)
  const [budgetReturnToIntegranteUserId, setBudgetReturnToIntegranteUserId] = useState<string | null>(null)
  const [budgetModalSearch, setBudgetModalSearch] = useState('')
  const [budgetListQuery, setBudgetListQuery] = useState('')
  const [budgetListEntityId, setBudgetListEntityId] = useState<string>('all')
  const [budgetListCategoryId, setBudgetListCategoryId] = useState<string>('all')
  const [budgetListType, setBudgetListType] = useState<'all' | 'individual' | 'shared'>('all')
  const [seedMyPartidasBusy, setSeedMyPartidasBusy] = useState(false)
  const [userDocuments, setUserDocuments] = useState<any[]>([])
  const [documentsTab, setDocumentsTab] = useState<string>('IDENTIFICACIONES')
  const [documentsUploadBusy, setDocumentsUploadBusy] = useState(false)
  const [documentsDeleteId, setDocumentsDeleteId] = useState<string | null>(null)
  const [documentDetailId, setDocumentDetailId] = useState<string | null>(null)
  const [documentEditData, setDocumentEditData] = useState<{ extractedData: Record<string, string>; expiresAt: string }>({ extractedData: {}, expiresAt: '' })
  const [documentSaveBusy, setDocumentSaveBusy] = useState(false)
  const [documentExtractBusy, setDocumentExtractBusy] = useState(false)
  const documentsFileInputRef = useRef<HTMLInputElement | null>(null)
  const [documentNewFieldName, setDocumentNewFieldName] = useState('')
  const [documentCategoryEditing, setDocumentCategoryEditing] = useState<string | null>(null)
  const [documentCategoryEditName, setDocumentCategoryEditName] = useState('')
  const [customDocumentCategory, setCustomDocumentCategory] = useState('')
  const [userThings, setUserThings] = useState<any[]>([])
  const [cosasDetailId, setCosasDetailId] = useState<string | null>(null)
  const [cosasFormOpen, setCosasFormOpen] = useState(false)
  const [cosasFormThing, setCosasFormThing] = useState<any | null>(null)
  const [cosasSaveBusy, setCosasSaveBusy] = useState(false)
  const [budgetListSpenderId, setBudgetListSpenderId] = useState<string>('all')
  const [budgetViewMineOnly, setBudgetViewMineOnly] = useState(false)
  const [suggestionOpen, setSuggestionOpen] = useState(false)
  const [suggestionType, setSuggestionType] = useState<string>('OTHER')
  const [suggestionText, setSuggestionText] = useState('')
  const [suggestionSending, setSuggestionSending] = useState(false)
  const [suggestionsList, setSuggestionsList] = useState<any[] | null>(null)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [lastCreatedAllocationId, setLastCreatedAllocationId] = useState<string | null>(null)

  // Gastos (transacciones) + recibos
  const [transactions, setTransactions] = useState<any[] | null>(null)
  const [txAllocationId, setTxAllocationId] = useState('')
  const [txAmount, setTxAmount] = useState('')
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [txDesc, setTxDesc] = useState('')

  const [txAddMode, setTxAddMode] = useState<'with_receipt' | 'without_receipt'>('with_receipt')
  const [txNewReceiptFiles, setTxNewReceiptFiles] = useState<File[]>([])
  const [txNewReceiptAllocationId, setTxNewReceiptAllocationId] = useState<string>('')
  const [txNewReceiptBusy, setTxNewReceiptBusy] = useState(false)
  const [txNewReceiptUploadProgress, setTxNewReceiptUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [txReceiptWizardOpen, setTxReceiptWizardOpen] = useState(false)
  const [txReceiptWizardStep, setTxReceiptWizardStep] = useState<'capture' | 'assign'>('capture')
  const [txReceiptAssignTo, setTxReceiptAssignTo] = useState<'me' | 'others'>('me')
  const [txReceiptManualAmount, setTxReceiptManualAmount] = useState('')
  const [txReceiptAssignUserId, setTxReceiptAssignUserId] = useState('')
  const [txReceiptWizardFileInputKey, setTxReceiptWizardFileInputKey] = useState(0)
  const [txScanOpen, setTxScanOpen] = useState(false)
  const [lastBackgroundReceiptDone, setLastBackgroundReceiptDone] = useState<{ message: string; at: string } | null>(null)
  const [lastDuplicateWarning, setLastDuplicateWarning] = useState<{ transactionId: string; date: string; description: string | null; amount: string } | null>(null)
  const [duplicateConfirmPending, setDuplicateConfirmPending] = useState<{
    duplicateWarning: { transactionId: string; date: string; description: string | null; amount: string }
    allocationId: string
    assignToUserId: string
  } | null>(null)
  const duplicateConfirmFileRef = useRef<File | null>(null)

  const [txFltRange, setTxFltRange] = useState<RangeKey>('this_month')
  const [txFltFrom, setTxFltFrom] = useState<string>('')
  const [txFltTo, setTxFltTo] = useState<string>('')
  const [txFltCategoryId, setTxFltCategoryId] = useState<string>('all')
  const [txFltEntityId, setTxFltEntityId] = useState<string>('all')
  const [txFltMemberId, setTxFltMemberId] = useState<string>('all')
  const [txFltReceipt, setTxFltReceipt] = useState<ReceiptFilter>('all')
  const [globalSearch, setGlobalSearch] = useState<string>('')
  const [txDetailReceiptId, setTxDetailReceiptId] = useState<string | null>(null)
  const [txDetailReceiptLoading, setTxDetailReceiptLoading] = useState(false)

  const [receiptTxId, setReceiptTxId] = useState('')
  const [receiptFiles, setReceiptFiles] = useState<File[]>([])
  const [receiptExtractingId, setReceiptExtractingId] = useState<string | null>(null)
  const [receiptExtraction, setReceiptExtraction] = useState<any | null>(null)
  const [receiptExtractionForId, setReceiptExtractionForId] = useState<string | null>(null)
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null)
  const [receiptPreviewForId, setReceiptPreviewForId] = useState<string | null>(null)
  const [receiptPreviewImageId, setReceiptPreviewImageId] = useState<string | null>(null)
  const [receiptImages, setReceiptImages] = useState<Array<{ id: string; sortOrder: number; url: string }>>([])
  const [receiptImagesForId, setReceiptImagesForId] = useState<string | null>(null)
  const [receiptReorderOpen, setReceiptReorderOpen] = useState(false)
  const [receiptReorderDraft, setReceiptReorderDraft] = useState<Array<{ id: string; sortOrder: number; url: string }>>([])
  const [receiptReorderSaving, setReceiptReorderSaving] = useState(false)
  const [receiptDraftForId, setReceiptDraftForId] = useState<string | null>(null)
  const [receiptDateDraft, setReceiptDateDraft] = useState<string>('')
  const [receiptTaxDraft, setReceiptTaxDraft] = useState<string>('')
  const [receiptTipDraft, setReceiptTipDraft] = useState<string>('')
  const [receiptItemDraft, setReceiptItemDraft] = useState<Record<string, { description: string; quantity: string; unitPrice: string; amount: string }>>({})
  const [receiptSaving, setReceiptSaving] = useState(false)
  const [receiptConfirming, setReceiptConfirming] = useState(false)
  const [receiptEditConcepts, setReceiptEditConcepts] = useState(false)
  const [receiptConfirmAllocationId, setReceiptConfirmAllocationId] = useState<string>('')

  // Filtros (Presupuesto / Reportes)
  const [fltRange, setFltRange] = useState<RangeKey>('this_month')
  const [fltCategoryId, setFltCategoryId] = useState<string>('all')
  const [fltEntityId, setFltEntityId] = useState<string>('all')
  const [fltMemberId, setFltMemberId] = useState<string>('all')
  const [fltReceipt, setFltReceipt] = useState<ReceiptFilter>('all')

  function viewAsHeaders(skipViewAs: boolean): Record<string, string> {
    if (skipViewAs || !viewAsUserRef.current) return {}
    return { 'X-View-As-User': viewAsUserRef.current.userId }
  }

  async function refreshMe() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: viewAsHeaders(false),
      })
      const data = (await res.json().catch(() => ({}))) as MeResponse
      setMe(data)
    } finally {
      setLoading(false)
    }
  }

  async function refreshMembers(opts: { silent?: boolean } = {}) {
    if (!opts.silent) setMessage('')
    const res = await fetch('/api/families/members', {
      credentials: 'include',
      headers: viewAsHeaders(false),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (!opts.silent) setMessage(data.detail || 'No se pudo cargar usuarios')
      return
    }
    const list = Array.isArray(data.members) ? data.members : []
    setMembers(list)
    setMemberNameDraft((prev) => {
      const next: Record<string, string> = { ...prev }
      for (const m of list) {
        const id = String(m?.id || '')
        if (!id) continue
        if (next[id] === undefined) next[id] = String(m?.name || '')
      }
      return next
    })
    setMemberPhoneDraft((prev) => {
      const next: Record<string, string> = { ...prev }
      for (const m of list) {
        const id = String(m?.id || '')
        if (!id) continue
        if (next[id] === undefined) next[id] = String(m?.phone || '')
      }
      return next
    })
    setMemberCityDraft((prev) => {
      const next: Record<string, string> = { ...prev }
      for (const m of list) {
        const id = String(m?.id || '')
        if (!id) continue
        if (next[id] === undefined) next[id] = String(m?.city || '')
      }
      return next
    })
  }

  useEffect(() => {
    refreshMe()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (viewingAsUser) {
      sessionStorage.setItem('domus_view_as', JSON.stringify({ userId: viewingAsUser.userId, name: viewingAsUser.name }))
    } else {
      sessionStorage.removeItem('domus_view_as')
    }
  }, [viewingAsUser])

  useEffect(() => {
    const isAnyOverlayOpen = deleteFamilyOpen || reportsOpen || peopleBudgetOpen || mobileNavOpen || txReceiptWizardOpen
    if (!isAnyOverlayOpen) return
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.overflow = prevHtmlOverflow
    }
  }, [deleteFamilyOpen, reportsOpen, peopleBudgetOpen, mobileNavOpen, txReceiptWizardOpen])

  useEffect(() => {
    if (view !== 'transacciones') return
    const r = rangeDates('this_month')
    setTxFltRange('this_month')
    if (r.from) setTxFltFrom(r.from.toISOString().slice(0, 10))
    if (r.to) setTxFltTo(new Date(r.to.getTime() - 1).toISOString().slice(0, 10))
  }, [view])

  useEffect(() => {
    if (!reportsOpen) return
    // En Safari a veces queda la vista "bajada" al abrir; forzamos scroll arriba del panel.
    window.setTimeout(() => {
      try {
        reportsPanelRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      } catch {
        try {
          if (reportsPanelRef.current) reportsPanelRef.current.scrollTop = 0
        } catch {
          // ignore
        }
      }
    }, 0)
  }, [reportsOpen, reportsTab])

  useEffect(() => {
    if (!reportsOpen) setReportsMenuOpen(false)
  }, [reportsOpen])

  useEffect(() => {
    if (!reportsOpen || reportsTab !== 'consumo') return
    const { from, to } = rangeDates(fltRange)
    const params = new URLSearchParams()
    if (from) params.set('from', from.toISOString().slice(0, 10))
    if (to) params.set('to', to.toISOString().slice(0, 10))
    setConsumptionLoading(true)
    fetch(`/api/reports/consumption?${params.toString()}`, { credentials: 'include', headers: viewAsHeaders(false) })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) setConsumptionData({
          utility: data.utility || [],
          products: data.products || [],
          productsGrouped: data.productsGrouped || [],
          reposicion: data.reposicion || [],
        })
        else setConsumptionData({ utility: [], products: [], productsGrouped: [], reposicion: [] })
      })
      .catch(() => setConsumptionData({ utility: [], products: [], productsGrouped: [], reposicion: [] }))
      .finally(() => setConsumptionLoading(false))
  }, [reportsOpen, reportsTab, fltRange])

  async function loadConsumptionSeed() {
    if (consumptionSeeding) return
    setConsumptionSeeding(true)
    try {
      const res = await fetch('/api/dev/seed-consumption', { method: 'POST', credentials: 'include', headers: viewAsHeaders(false) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data?.detail || data?.message || 'No se pudieron crear datos de consumo')
        return
      }
      setMessage('Datos de consumo creados. Actualizando…')
      const { from, to } = rangeDates(fltRange)
      const params = new URLSearchParams()
      if (from) params.set('from', from.toISOString().slice(0, 10))
      if (to) params.set('to', to.toISOString().slice(0, 10))
      const r = await fetch(`/api/reports/consumption?${params.toString()}`, { credentials: 'include', headers: viewAsHeaders(false) })
      const consumption = await r.json().catch(() => ({}))
      if (consumption?.ok) setConsumptionData({
        utility: consumption.utility || [],
        products: consumption.products || [],
        productsGrouped: consumption.productsGrouped || [],
        reposicion: consumption.reposicion || [],
      })
      setMessage('')
    } catch (e: any) {
      setMessage(e?.message || 'Error al cargar datos de consumo')
    } finally {
      setConsumptionSeeding(false)
    }
  }

  useEffect(() => {
    if (!reportsMenuOpen) return
    const onDown = (ev: MouseEvent | TouchEvent) => {
      const t = ev.target as Node | null
      if (!t) return
      if (reportsMenuRef.current?.contains(t)) return
      if (reportsMenuBtnRef.current?.contains(t)) return
      setReportsMenuOpen(false)
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setReportsMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [reportsMenuOpen])

  useEffect(() => {
    if (!familyMenuOpen) return
    const onDown = (ev: MouseEvent | TouchEvent) => {
      const t = ev.target as Node | null
      if (!t) return
      if (familyMenuRef.current?.contains(t)) return
      if (familyMenuBtnRef.current?.contains(t)) return
      setFamilyMenuOpen(false)
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setFamilyMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [familyMenuOpen])

  useEffect(() => {
    // Al cambiar de familia, limpiamos el estado para evitar mostrar datos de otra familia.
    setMessage('')
    setMobileNavOpen(false)
    setSeedResult(null)
    setFamilyDetails(null)
    setEntities(null)
    setCategories(null)
    setAllocations(null)
    setTransactions(null)
    setMembers(null)

    setBudgetModalTab('montos')
    setBudgetModalAllocId(null)
    setBudgetReturnToIntegranteUserId(null)
    setBudgetModalSearch('')

    setTxAllocationId('')
    setTxAmount('')
    setTxDesc('')
    setReceiptTxId('')
    setReceiptFiles([])
    setTxAddMode('with_receipt')
    setTxNewReceiptFiles([])
    setTxNewReceiptAllocationId('')
    setTxNewReceiptBusy(false)
    setTxFltRange('all')
    setTxFltFrom('')
    setTxFltTo('')
    setTxFltCategoryId('all')
    setTxFltEntityId('all')
    setTxFltMemberId('all')
    setTxFltReceipt('all')
    setGlobalSearch('')
    setTxDetailReceiptId(null)
    setTxDetailReceiptLoading(false)

    setSelectedTxId(null)
    setTxTab('Detalle')
    setReceiptExtractingId(null)
    setReceiptExtraction(null)
    setReceiptExtractionForId(null)
    setReceiptPreviewUrl(null)
    setReceiptPreviewForId(null)
    setReceiptPreviewImageId(null)
    setReceiptImages([])
    setReceiptImagesForId(null)
    setReceiptReorderOpen(false)
    setReceiptReorderDraft([])
    setReceiptReorderSaving(false)
    setReceiptDraftForId(null)
    setReceiptDateDraft('')
    setReceiptTaxDraft('')
    setReceiptTipDraft('')
    setReceiptItemDraft({})
    setReceiptSaving(false)
    setReceiptConfirming(false)
    setReceiptEditConcepts(false)

    setMemberNameDraft({})
    setMemberPhoneDraft({})
    setMemberCityDraft({})
    setEntityNameDraft({})
    setCategoryNameDraft({})
    setAllocationLimitDraft({})
    setDeleteFamilyOpen(false)
    setDeleteFamilyEmail('')
    setDeleteFamilyPassword('')
    setDeleteFamilyBusy(false)

    setReportsOpen(false)
    setReportsTab('detalle')
    setReportsTableTab('categorias')

    setPeopleBudgetOpen(false)
    setPeopleBudgetNamesOpen(false)
    setPeopleBudgetQuery('')
    setPeopleBudgetPivot('people')
    setPeopleBudgetTab('vertical')
    setPeopleBudgetUserId('')
    setPeopleBudgetEntityId('')
    setPeopleBudgetCategoryFocusId('all')
    setPeopleBudgetCols('all')

    setBudgetWizardMemberId('')
    setBudgetWizardBusy(false)
    setEntityOwnersOpen(false)
    setEntityOwnersEntityId('')
    setEntityOwnersMode('equal')
    setEntityOwnersSelected([])
    setEntityOwnersPctDraft({})
    setEntityOwnersSaving(false)
    setEntityImageUploadingId(null)
    setBudgetListQuery('')
    setBudgetListEntityId('all')
    setBudgetListCategoryId('all')
    setBudgetListType('all')
    setBudgetListSpenderId('all')

    if (!activeFamilyId) return
    refreshBudget()
    refreshTransactions()
    refreshMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFamilyId])

  // Tras cargar sesión (roles), repetir presupuesto: sin esto el primer fetch podía usar ?mine=1 antes de saber si eres Admin.
  useEffect(() => {
    if (!activeFamilyId || !isMeOk(me)) return
    refreshBudget({ silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, activeFamilyId])

  useEffect(() => {
    if (view !== 'documentos') return
    setMessage('')
    getJson('/api/users/me/documents')
      .then((r: any) => setUserDocuments(Array.isArray(r?.documents) ? r.documents : []))
      .catch((e: any) => setMessage(e?.message || 'No se pudieron cargar los documentos'))
  }, [view])

  useEffect(() => {
    if (view !== 'cosas') return
    setMessage('')
    getJson('/api/users/me/things')
      .then((r: any) => setUserThings(Array.isArray(r?.things) ? r.things : []))
      .catch((e: any) => setMessage(e?.message || 'No se pudieron cargar tus cosas'))
  }, [view])

  const DEFAULT_DOCUMENT_CATEGORIES = ['IDENTIFICACIONES', 'ACTAS', 'VEHICULOS', 'RECETAS', 'PRESCRIPCIONES']
  const documentCategories = useMemo(() => {
    const fromDocs = Array.from(new Set((userDocuments as any[]).map((d: any) => d.category).filter(Boolean)))
    const combined = [...DEFAULT_DOCUMENT_CATEGORIES]
    for (const c of fromDocs) if (!combined.includes(c)) combined.push(c)
    if (documentsTab && !combined.includes(documentsTab)) combined.push(documentsTab)
    const custom = customDocumentCategory.trim()
    if (custom && !combined.includes(custom)) combined.push(custom)
    return combined
  }, [userDocuments, documentsTab, customDocumentCategory])

  function getDocumentCategoryLabel(cat: string) {
    if (cat === 'IDENTIFICACIONES') return 'Identificaciones'
    if (cat === 'ACTAS') return 'Actas'
    if (cat === 'VEHICULOS') return 'Vehículos'
    if (cat === 'RECETAS') return 'Recetas'
    if (cat === 'PRESCRIPCIONES') return 'Prescripciones'
    return cat
  }

  // Auto-sync suave (sin botones "Refrescar")
  useEffect(() => {
    if (!activeFamilyId) return
    const id = setInterval(() => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      } catch {
        // ignore
      }
      refreshBudget({ silent: true })
      refreshTransactions({ silent: true })
      refreshMembers({ silent: true })
    }, 20000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFamilyId])

  useEffect(() => {
    if (!Array.isArray(entities)) return
    setEntityNameDraft((prev) => {
      const next: Record<string, string> = { ...prev }
      for (const e of entities) {
        const id = String((e as any)?.id || '')
        if (!id) continue
        if (next[id] === undefined) next[id] = String((e as any)?.name || '')
      }
      return next
    })
  }, [entities])

  useEffect(() => {
    if (!Array.isArray(categories)) return
    setCategoryNameDraft((prev) => {
      const next: Record<string, string> = { ...prev }
      for (const c of categories) {
        const id = String((c as any)?.id || '')
        if (!id) continue
        if (next[id] === undefined) next[id] = String((c as any)?.name || '')
      }
      return next
    })
  }, [categories])

  useEffect(() => {
    if (!Array.isArray(allocations)) return
    setAllocationLimitDraft((prev) => {
      const next: Record<string, string> = { ...prev }
      for (const a of allocations) {
        const id = String((a as any)?.id || '')
        if (!id) continue
        if (next[id] === undefined) next[id] = String((a as any)?.monthlyLimit || '')
      }
      return next
    })
  }, [allocations])

  useEffect(() => {
    const f = familyDetails
    if (!f) return
    setFamName(typeof f.name === 'string' ? f.name : '')
    setFamCurrency(typeof f.currency === 'string' && f.currency ? String(f.currency).toUpperCase() : 'MXN')
    setFamCutoffDay(f.cutoffDay !== undefined && f.cutoffDay !== null ? String(f.cutoffDay) : '1')
    try {
      const iso = f.budgetStartDate ? new Date(f.budgetStartDate).toISOString().slice(0, 10) : ''
      setFamBudgetStartDate(iso)
    } catch {
      setFamBudgetStartDate('')
    }
  }, [familyDetails?.id])

  async function loadMoneyRequests() {
    if (!activeFamilyId) return
    setMoneyRequestsLoading(true)
    try {
      const r = await fetch('/api/money-requests', { credentials: 'include', headers: viewAsHeaders(false) })
      const data = await r.json()
      setMoneyRequests(Array.isArray(data?.moneyRequests) ? data.moneyRequests : [])
    } catch {
      setMoneyRequests([])
    } finally {
      setMoneyRequestsLoading(false)
    }
  }

  useEffect(() => {
    if (view !== 'solicitudes' || !activeFamilyId) return
    loadMoneyRequests()
  }, [view, activeFamilyId])

  // Sincronización entre dispositivos: refrescar lista cada 30s mientras se está en Solicitudes
  useEffect(() => {
    if (view !== 'solicitudes' || !activeFamilyId) return
    const interval = setInterval(loadMoneyRequests, 30_000)
    return () => clearInterval(interval)
  }, [view, activeFamilyId])

  useEffect(() => {
    setDeliverFilesCount(0)
    setDeliverAmountSent('')
    if (deliverFileInputRef.current) deliverFileInputRef.current.value = ''
  }, [selectedMoneyRequestId])

  async function postJson(url: string, body: any, opts?: { skipViewAs?: boolean }) {
    const skipViewAs = opts?.skipViewAs === true
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', ...viewAsHeaders(skipViewAs) },
        body: JSON.stringify(body),
      })
    } catch (e: any) {
      const raw = typeof e?.message === 'string' ? e.message : ''
      throw new Error(`Error de conexión con el servidor${raw ? ` (${raw})` : ''}. Recarga la página e intenta de nuevo.`)
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.detail || `Error HTTP ${res.status}`)
    return data
  }

  async function patchJson(url: string, body: any, opts?: { skipViewAs?: boolean }) {
    const skipViewAs = opts?.skipViewAs === true
    let res: Response
    try {
      res = await fetch(url, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json', ...viewAsHeaders(skipViewAs) },
        body: JSON.stringify(body),
      })
    } catch (e: any) {
      const raw = typeof e?.message === 'string' ? e.message : ''
      throw new Error(`Error de conexión con el servidor${raw ? ` (${raw})` : ''}. Recarga la página e intenta de nuevo.`)
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.detail || `Error HTTP ${res.status}`)
    return data
  }

  async function deleteReq(url: string, opts?: { skipViewAs?: boolean }) {
    const skipViewAs = opts?.skipViewAs === true
    let res: Response
    try {
      res = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
        headers: viewAsHeaders(skipViewAs),
      })
    } catch (e: any) {
      const raw = typeof e?.message === 'string' ? e.message : ''
      throw new Error(`Error de conexión con el servidor${raw ? ` (${raw})` : ''}. Recarga la página e intenta de nuevo.`)
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.detail || `Error HTTP ${res.status}`)
    return data
  }

  async function getJson(url: string, opts?: { skipViewAs?: boolean }) {
    const skipViewAs = opts?.skipViewAs === true
    let res: Response
    try {
      res = await fetch(url, {
        credentials: 'include',
        headers: viewAsHeaders(skipViewAs),
      })
    } catch (e: any) {
      const raw = typeof e?.message === 'string' ? e.message : ''
      throw new Error(`Error de conexión con el servidor${raw ? ` (${raw})` : ''}. Recarga la página e intenta de nuevo.`)
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.detail || `Error HTTP ${res.status}`)
    return data
  }

  async function refreshBudget(opts: { silent?: boolean; mine?: boolean } = {}) {
    if (!opts.silent) setMessage('')
    // Entidades/asignaciones: ?mine=1 = solo filas donde el usuario está en responsables (budget_entity_owner).
    // Por defecto eso dejaba al Admin con lista vacía (los POST de destino no añaden responsables) → Destinos: 0 y formularios rotos.
    // Admin: ver todos los destinos salvo "Solo mis destinos". No admin: solo los suyos.
    const useMineFilter =
      opts.mine !== undefined ? opts.mine : soloMisDestinos || !meOk?.isFamilyAdmin
    const mineQ = useMineFilter ? '?mine=1' : ''

    function isBudgetStructuralError(msg: unknown): boolean {
      const s = String(msg || '').toLowerCase()
      return s.includes('objeto presupuestal') || s.includes('partida presupuestal')
    }

    try {
      // Importante: si aún no hay ningún destino, GET /allocations devuelve 409 y antes rompía todo el Promise.all:
      // no se llegaban a aplicar entities ni categories → la UI quedaba incoherente (ej. categorías sin cargar).
      const [f, e, c, ct] = await Promise.all([
        getJson('/api/families/active'),
        getJson(`/api/budget/entities${mineQ}`),
        getJson('/api/budget/categories?mine=1'),
        getJson('/api/budget/custom-types').catch(() => ({ types: [] })),
      ])
      setFamilyDetails(f.family || null)
      setEntities(e.entities || [])
      setCategories(c.categories || [])
      setCustomEntityTypes(Array.isArray(ct?.types) ? ct.types : [])

      let allocationsList: any[] = []
      try {
        const a = await getJson(`/api/budget/allocations${mineQ}`)
        allocationsList = a.allocations || []
      } catch (allocErr: any) {
        if (!isBudgetStructuralError(allocErr?.message)) throw allocErr
        allocationsList = []
      }
      setAllocations(allocationsList)
    } catch (err: any) {
      const msg = err?.message || 'No se pudo cargar el presupuesto'
      const isStructural = isBudgetStructuralError(msg)
      if (isStructural) {
        if (!opts.silent) setMessage(msg)
        return
      }
      if (!opts.silent) setMessage(msg)
    }
  }

  async function refreshTransactions(opts: { silent?: boolean; mine?: boolean } = {}): Promise<any[] | undefined> {
    if (!opts.silent) setMessage('')
    const mine = opts.mine !== false
    try {
      const t = await getJson(mine ? '/api/transactions?mine=1' : '/api/transactions')
      const list = t.transactions || []
      setTransactions(list)
      if (messageRef.current.includes('DigitalOcean') || messageRef.current.includes('DO_SPACES')) setMessage('')
      return list
    } catch (err: any) {
      const msg = err?.message || 'No se pudieron cargar los gastos'
      const isStructural = typeof msg === 'string' && (msg.toLowerCase().includes('objeto presupuestal') || msg.toLowerCase().includes('partida presupuestal'))
      if (isStructural) {
        setTransactions([])
        if (!opts.silent) setMessage(msg)
        return undefined
      }
      if (!opts.silent) setMessage(msg)
      return undefined
    }
  }

  async function register() {
    setMessage('')
    const phone = (rPhone || '').replace(/\D/g, '')
    if (!rEmail?.trim()) {
      setMessage('Email es requerido.')
      return
    }
    if (!rPass || rPass.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (phone.length < 10) {
      setMessage('Teléfono requerido (mínimo 10 dígitos) para comprobantes por WhatsApp.')
      return
    }
    if (!(rCity || '').trim()) {
      setMessage('Ciudad es requerida.')
      return
    }
    try {
      await postJson('/api/auth/register', {
        name: rName.trim() || undefined,
        email: rEmail.trim(),
        phone: rPhone.trim(),
        city: rCity.trim() || undefined,
        belongs_to_family: rBelongsToFamily === 'yes',
        password: rPass,
        familyName: rFamily,
      })
      setMessage('Cuenta creada. Sesión iniciada.')
      await refreshMe()
      go('presupuesto')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo registrar')
    }
  }

  async function login() {
    setMessage('')
    try {
      await postJson('/api/auth/login', { email: lEmail, password: lPass })
      setMessage('Sesión iniciada.')
      await refreshMe()
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo iniciar sesión')
    }
  }

  async function logout() {
    setMessage('')
    try {
      await postJson('/api/auth/logout', {}, { skipViewAs: true })
      setMessage('Sesión cerrada.')
      setMe({ detail: 'No autenticado' })
      setMembers(null)
      setReportsOpen(false)
      setReportsTab('detalle')
      setReportsTableTab('categorias')
      setPeopleBudgetOpen(false)
      setPeopleBudgetNamesOpen(false)
      setPeopleBudgetQuery('')
      setPeopleBudgetPivot('people')
      setPeopleBudgetTab('vertical')
      setPeopleBudgetUserId('')
      setPeopleBudgetEntityId('')
      setPeopleBudgetCategoryFocusId('all')
      setPeopleBudgetCols('all')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo cerrar sesión')
    }
  }

  async function createFamily() {
    setMessage('')
    try {
      await postJson('/api/families', { name: newFamilyName })
      setMessage('Familia creada y seleccionada.')
      setNewFamilyName('')
      await refreshMe()
      await refreshMembers()
      await refreshBudget()
      go('presupuesto')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo crear familia')
    }
  }

  async function switchFamily(familyId: string) {
    setMessage('')
    try {
      await postJson('/api/auth/switch-family', { familyId }, { skipViewAs: true })
      setMessage('Familia seleccionada.')
      await refreshMe()
      await refreshMembers()
      await refreshBudget()
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo cambiar familia')
    }
  }

  async function loadFakeData() {
    if (seeding) return
    try {
      if (!meOk) {
        setMessage('Inicia sesión primero.')
        return
      }
      if (!meOk.activeFamily?.id) {
        setMessage('Selecciona una familia.')
        return
      }
      if (!meOk.isFamilyAdmin) {
        setMessage('Solo el administrador puede cargar datos ficticios.')
        return
      }

      setSeeding(true)
      setMessage('')
      const data = (await postJson('/api/dev/fake-data', {})) as FakeDataResponse
      setSeedResult(data)
      await refreshBudget()
      await refreshTransactions()
      await refreshMembers()
      const n12 = data.createdTransactions12M ?? 0
      const msg =
        n12 > 0
          ? `Datos ficticios cargados. Se añadieron ${data.createdTransactions} transacciones (${n12} del historial de 12 meses). Cambia el filtro de fechas a "Todo" o "Últimos 6 meses" en Transacciones/Reportes para verlas.`
          : data.seedHint
            ? `Datos ficticios cargados. ${data.seedHint}`
            : 'Datos ficticios cargados.'
      setMessage(msg)
    } catch (e: any) {
      setMessage(e?.message || 'No se pudieron cargar datos ficticios')
    } finally {
      setSeeding(false)
    }
  }

  function resetFilters() {
    setFltRange('this_month')
    setFltCategoryId('all')
    setFltEntityId('all')
    setFltMemberId('all')
    setFltReceipt('all')
  }

  function buildExportUrl(format: 'csv' | 'pdf' | 'html' | 'docx') {
    const params = new URLSearchParams()
    params.set('format', format)
    if (flt.from) params.set('from', flt.from.toISOString().slice(0, 10))
    if (flt.to) params.set('to', flt.to.toISOString().slice(0, 10))
    if (fltEntityId !== 'all') params.set('entityId', fltEntityId)
    if (fltCategoryId !== 'all') params.set('categoryId', fltCategoryId)
    if (fltMemberId !== 'all') params.set('userId', fltMemberId)
    if (fltReceipt !== 'all') params.set('receipt', fltReceipt)
    return `/api/reports/export?${params.toString()}`
  }

  function downloadReport(format: 'csv' | 'pdf' | 'html' | 'docx') {
    try {
      const url = buildExportUrl(format)
      window.open(url, '_blank')
    } catch {
      setMessage('No se pudo exportar el reporte')
    }
  }

  async function updateFamily() {
    if (savingFamily) return
    setMessage('')
    try {
      if (!meOk) {
        setMessage('Inicia sesión primero.')
        return
      }
      if (!meOk.activeFamily?.id) {
        setMessage('Selecciona una familia.')
        return
      }
      if (!meOk.isFamilyAdmin) {
        setMessage('Solo el administrador puede editar la familia.')
        return
      }

      setSavingFamily(true)
      const res = await fetch('/api/families/active', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json', ...viewAsHeaders(false) },
        body: JSON.stringify({
          name: famName,
          currency: famCurrency,
          cutoffDay: Number(famCutoffDay),
          budgetStartDate: famBudgetStartDate || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo actualizar la familia')

      await refreshBudget()
      await refreshMe()
      setMessage('Familia actualizada.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo actualizar la familia')
    } finally {
      setSavingFamily(false)
    }
  }

  function deleteActiveFamily() {
    setMessage('')
    if (!meOk) {
      setMessage('Inicia sesión primero.')
      return
    }
    if (!meOk.activeFamily?.id) {
      setMessage('Selecciona una familia.')
      return
    }
    if (!meOk.isFamilyAdmin) {
      setMessage('Solo el administrador puede eliminar la familia.')
      return
    }
    setDeleteFamilyEmail(meOk.user?.email || '')
    setDeleteFamilyPassword('')
    setDeleteFamilyOpen(true)
  }

  async function backupAndDeleteActiveFamily() {
    if (deleteFamilyBusy) return
    setMessage('')
    try {
      if (!meOk?.activeFamily?.id) throw new Error('Selecciona una familia.')
      if (!meOk.isFamilyAdmin) throw new Error('Solo el administrador puede eliminar la familia.')

      const email = String(deleteFamilyEmail || '').trim().toLowerCase()
      const password = String(deleteFamilyPassword || '')
      if (!email || !password) throw new Error('Usuario y contraseña son requeridos.')

      const famLabel = familyDetails?.name ? String(familyDetails.name) : meOk.activeFamily?.name || 'familia'

      setDeleteFamilyBusy(true)

      // 1) Respaldo (oculto) + descarga automática
      const backup = await postJson('/api/families/active/backup', { email, password })
      const archiveId = String(backup?.archiveId || '')
      const filename = String(backup?.filename || '')
      const backupJson = String(backup?.backupJson || '')
      if (!archiveId || !backupJson) throw new Error('No se pudo generar el respaldo. Reintenta.')

      try {
        const blob = new Blob([backupJson], { type: 'application/json;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename || `.domus_recovery_${famLabel}_${new Date().toISOString().slice(0, 10)}.json`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } catch {
        // best-effort
      }

      // 2) Eliminación (requiere credenciales + id de respaldo)
      let res: Response
      try {
        res = await fetch('/api/families/active', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'content-type': 'application/json', ...viewAsHeaders(false) },
          body: JSON.stringify({ email, password, archiveId }),
        })
      } catch (e: any) {
        const raw = typeof e?.message === 'string' ? e.message : ''
        throw new Error(`Error de conexión con el servidor${raw ? ` (${raw})` : ''}. Recarga la página e intenta de nuevo.`)
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo eliminar la familia')

      await refreshMe()
      setDeleteFamilyOpen(false)
      setDeleteFamilyPassword('')
      setMessage('Familia eliminada. Respaldo guardado.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo eliminar la familia')
    } finally {
      setDeleteFamilyBusy(false)
    }
  }

  async function inviteMember() {
    setMessage('')
    try {
      await postJson('/api/families/members', {
        name: mName,
        email: mEmail,
        password: mPass,
        phone: mPhone.trim() || undefined,
        isFamilyAdmin: mAdmin,
      })
      setMessage('Usuario agregado. Si ya no ves tu sesión, cierra sesión e inicia con tu correo.')
      setMName('')
      setMEmail('')
      setMPass('')
      setMPhone('')
      setMAdmin(false)
      await refreshMembers()
      await refreshMe()
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo agregar usuario')
    }
  }

  async function createInviteLink() {
    setMessage('')
    setInviteLoading(true)
    setLastInviteUrl(null)
    try {
      const data = await postJson('/api/families/invites', { expiresInDays: 7 })
      if (data.joinUrl) setLastInviteUrl(data.joinUrl)
      setMessage('Enlace generado. Compártelo por WhatsApp o correo. Caduca en 7 días.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo generar el enlace')
    } finally {
      setInviteLoading(false)
    }
  }

  async function saveUserProfile(targetUserId: string) {
    if (memberSavingId) return
    setMessage('')
    try {
      const nameDraft = (memberNameDraft[targetUserId] ?? '').trim()
      const phoneDraft = (memberPhoneDraft[targetUserId] ?? '').trim()
      const cityDraft = (memberCityDraft[targetUserId] ?? '').trim()
      const current = (Array.isArray(members) ? members : []).find((m: any) => m?.id === targetUserId)
      const same =
        nameDraft === String(current?.name || '') &&
        phoneDraft === String(current?.phone || '') &&
        cityDraft === String(current?.city || '')
      if (same) {
        setMessage('Sin cambios.')
        return
      }
      if (phoneDraft && phoneDraft.replace(/\D/g, '').length < 10) {
        setMessage('El teléfono debe tener al menos 10 dígitos.')
        return
      }
      setMemberSavingId(targetUserId)
      await patchJson(`/api/families/members/${targetUserId}`, {
        name: nameDraft || null,
        phone: phoneDraft || null,
        city: cityDraft || null,
      })
      await refreshMembers()
      await refreshMe()
      setMessage('Usuario actualizado.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo actualizar el usuario')
    } finally {
      setMemberSavingId(null)
    }
  }

  async function sendTwilioTest(targetUserId: string) {
    if (twilioTestSendingId) return
    setMessage('')
    try {
      setTwilioTestSendingId(targetUserId)
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...viewAsHeaders(false) },
        body: JSON.stringify({ userId: targetUserId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo enviar')
      setMessage('Mensaje de prueba enviado a tu WhatsApp. Revisa tu teléfono.')
    } catch (e: any) {
      setMessage(e?.message || 'Error al enviar prueba. Revisa que Twilio esté configurado y el teléfono tenga 10+ dígitos.')
    } finally {
      setTwilioTestSendingId(null)
    }
  }

  async function sendBudgetSuggestion() {
    if (suggestionSending || !suggestionText.trim()) return
    setMessage('')
    try {
      setSuggestionSending(true)
      await postJson('/api/budget/suggestions', {
        type: suggestionType,
        payload: { text: suggestionText.trim() },
      })
      showToast('ok', 'Sugerencia enviada. El admin la revisará.')
      setSuggestionOpen(false)
      setSuggestionText('')
      if (meOk?.isFamilyAdmin) loadSuggestions()
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo enviar')
    } finally {
      setSuggestionSending(false)
    }
  }

  async function loadSuggestions() {
    try {
      const data = await getJson('/api/budget/suggestions')
      setSuggestionsList(Array.isArray(data?.suggestions) ? data.suggestions : [])
    } catch {
      setSuggestionsList([])
    }
  }

  async function resolveSuggestion(id: string, status: 'APPROVED' | 'REJECTED') {
    try {
      await patchJson(`/api/budget/suggestions/${id}`, { status })
      showToast('ok', status === 'APPROVED' ? 'Sugerencia aprobada' : 'Sugerencia rechazada')
      loadSuggestions()
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo actualizar')
    }
  }

  async function uploadAvatar(file: File) {
    if (avatarUploading || !file?.size) return
    setMessage('')
    try {
      setAvatarUploading(true)
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/users/me/avatar', {
        method: 'POST',
        credentials: 'include',
        headers: viewAsHeaders(false),
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo subir')
      await refreshMe()
      await refreshMembers()
      setMessage('Avatar actualizado.')
      showToast('ok', 'Avatar actualizado.')
      if (avatarFileInputRef.current) avatarFileInputRef.current.value = ''
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo subir el avatar')
    } finally {
      setAvatarUploading(false)
    }
  }

  async function setUserAdmin(targetUserId: string, makeAdmin: boolean) {
    if (memberSavingId) return
    setMessage('')
    try {
      setMemberSavingId(targetUserId)
      await patchJson(`/api/families/members/${targetUserId}`, { isFamilyAdmin: makeAdmin })
      await refreshMembers()
      await refreshMe()
      setMessage('Rol actualizado.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo actualizar el rol')
    } finally {
      setMemberSavingId(null)
    }
  }

  async function removeUser(targetUserId: string) {
    if (memberSavingId) return
    setMessage('')
    try {
      if (!confirm('¿Eliminar a este usuario de la familia?')) return
      setMemberSavingId(targetUserId)
      const res = await fetch(`/api/families/members/${targetUserId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: viewAsHeaders(false),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo eliminar')
      await refreshMembers()
      await refreshMe()
      setMessage('Usuario eliminado de la familia.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo eliminar el usuario')
    } finally {
      setMemberSavingId(null)
    }
  }

  async function uploadAvatarUser(file: File) {
    if (avatarUploading || !meOk) return
    setMessage('')
    try {
      setAvatarUploading(true)
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/users/me/avatar', {
        method: 'POST',
        credentials: 'include',
        headers: viewAsHeaders(false),
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo subir la foto')
      await refreshMe()
      showToast('ok', 'Foto de perfil actualizada.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo subir la foto')
      showToast('error', e?.message || 'Error al subir')
    } finally {
      setAvatarUploading(false)
      if (avatarFileInputRef.current) avatarFileInputRef.current.value = ''
    }
  }

  async function createEntity() {
    setMessage('')
    try {
      const resolvedType: EntityType = beCustomTypeId ? 'OTHER' : beType
      if (entityTypeNeedsOwnerForCreate(resolvedType)) {
        if (!beOwnerUserId.trim()) {
          setMessage('Un vehículo o mascota debe tener al menos un dueño: elige el integrante que corresponde.')
          return
        }
      }
      const payload: {
        type: EntityType
        name: string
        participatesInBudget: boolean
        participatesInReports: boolean
        customTypeId?: string
        owners?: { userId: string }[]
      } = {
        type: resolvedType,
        name: beName,
        participatesInBudget: beInBudget,
        participatesInReports: beInReports,
      }
      if (beCustomTypeId) payload.customTypeId = beCustomTypeId
      if (entityTypeNeedsOwnerForCreate(resolvedType) && beOwnerUserId.trim()) {
        payload.owners = [{ userId: beOwnerUserId.trim() }]
      }
      await postJson('/api/budget/entities', payload)
      setBeName('')
      setBeInBudget(true)
      setBeInReports(true)
      setBeCustomTypeId(null)
      setBeType('PERSON')
      setBeOwnerUserId('')
      await refreshBudget()
      setMessage('Destino creado.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo crear el destino')
    }
  }

  async function createCustomEntityType() {
    if (!customTypeNewName.trim() || customTypeCreating) return
    setCustomTypeCreating(true)
    setMessage('')
    try {
      const res = await postJson('/api/budget/custom-types', { name: customTypeNewName.trim() })
      const newType = (res as any)?.type
      if (newType?.id) {
        setCustomEntityTypes((prev) => [...prev, { id: newType.id, name: newType.name }].sort((a, b) => a.name.localeCompare(b.name)))
        setBeType('OTHER')
        setBeCustomTypeId(newType.id)
        setCustomTypeNewName('')
        setCustomTypeCreateOpen(false)
        setMessage(`Tipo "${newType.name}" creado. Completa el nombre del destino y pulsa Crear destino.`)
      }
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo crear el tipo')
    } finally {
      setCustomTypeCreating(false)
    }
  }

  async function setupPersonalVehicle() {
    if (budgetWizardBusy) return
    setMessage('')
    try {
      const isAdmin = !!meOk?.isFamilyAdmin
      if (!isAdmin) throw new Error('Solo el administrador puede crear destinos / categorías')
      const member = memberItems.find((m: any) => String(m?.id || '') === String(budgetWizardMemberId || ''))
      const personName = displayPersonName(member?.name || member?.email || '')
      if (!personName) throw new Error('Selecciona una persona')

      const vehicleName = `Auto (${personName})`

      setBudgetWizardBusy(true)

      // 1) Asegura el objeto VEHICLE (Auto personal)
      const vehicleExisting = entityItems.find(
        (e: any) => String(e?.type || '') === 'VEHICLE' && normKey(e?.name) === normKey(vehicleName)
      )
      const vehicleId = vehicleExisting?.id
        ? String(vehicleExisting.id)
        : String(
            (await postJson('/api/budget/entities', {
              type: 'VEHICLE',
              name: vehicleName,
              participatesInBudget: true,
              participatesInReports: true,
              owners: [{ userId: String(budgetWizardMemberId) }],
            }))?.entity?.id || ''
          )

      if (!vehicleId) throw new Error('No se pudo crear el auto')

      // 2) Asegura categorías típicas (sin imponer montos)
      async function ensureCategoryId(name: string) {
        const existing = categoryItems.find((c: any) => normKey(c?.name) === normKey(name))
        if (existing?.id) return String(existing.id)
        const created = await postJson('/api/budget/categories', { type: 'EXPENSE', name })
        return String(created?.category?.id || '')
      }

      const gasolinaId = await ensureCategoryId('Gasolina')
      await ensureCategoryId('Mantenimiento auto')
      await ensureCategoryId('Seguro auto')

      await refreshBudget()

      setBudgetModalTab('montos')
      setAlEntityId(vehicleId)
      if (gasolinaId) setAlCategoryId(gasolinaId)
      setAlLimit('')
      setMessage(`Listo: ${vehicleName}. Ahora asigna el monto mensual (ej. Gasolina) en la pestaña Presupuesto y registra los gastos en ese destino.`)
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo preparar el auto personal')
    } finally {
      setBudgetWizardBusy(false)
    }
  }

  async function createCategory() {
    setMessage('')
    try {
      await postJson('/api/budget/categories', { type: bcType, name: bcName })
      setBcName('')
      await refreshBudget()
      setMessage('Categoría creada.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo crear la categoría')
    }
  }

  async function createCategoryWithName(name: string) {
    setMessage('')
    try {
      await postJson('/api/budget/categories', { type: 'EXPENSE', name })
      await refreshBudget()
      setMessage(`Categoría "${name}" creada.`)
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo crear la categoría')
    }
  }

  async function createAllocation() {
    setMessage('')
    const entityName = entityItems.find((e: any) => String(e.id) === String(alEntityId))?.name || 'Destino'
    const categoryName = categoryItems.find((c: any) => String(c.id) === String(alCategoryId))?.name || 'Categoría'
    try {
      const res = await postJson('/api/budget/allocations', {
        entityId: alEntityId,
        categoryId: alCategoryId,
        monthlyLimit: alLimit,
      })
      const newId = res?.id ? String(res.id) : null
      setAlLimit('')
      setAlEntityId('')
      setAlCategoryId('')
      await refreshBudget()
      if (newId) {
        setLastCreatedAllocationId(newId)
        setTimeout(() => setLastCreatedAllocationId(null), 3200)
      }
      setMessage(`Asignado: ${entityName} + ${categoryName}. Aparece en el Bloque 2 · Cuentas. Puedes crear otra combinación.`)
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo asignar el monto')
    }
  }

  async function confirmPlan() {
    setMessage('')
    try {
      await postJson('/api/setup/confirm', {})
      await refreshBudget()
      setMessage('Plan confirmado. La familia quedó lista.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo confirmar el plan')
    }
  }

  async function uploadBudgetEntityImage(entityId: string, file: File) {
    if (entityImageUploadingId) return
    setMessage('')
    try {
      if (!file) {
        setMessage('Selecciona una imagen.')
        return
      }
      setEntityImageUploadingId(entityId)
      const form = new FormData()
      form.append('file', file)

      let res: Response
      try {
        res = await fetch(`/api/budget/entities/${entityId}/image`, {
          method: 'POST',
          credentials: 'include',
          headers: viewAsHeaders(false),
          body: form,
        })
      } catch (e: any) {
        const raw = typeof e?.message === 'string' ? e.message : ''
        throw new Error(`No se pudo subir la foto (conexión)${raw ? `: ${raw}` : ''}.`)
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || `No se pudo subir la foto (HTTP ${res.status})`)

      await refreshBudget({ silent: true })
      showToast('ok', 'Foto actualizada.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo subir la foto')
    } finally {
      setEntityImageUploadingId(null)
    }
  }

  async function patchBudgetEntity(id: string, patch: any) {
    if (adminSavingId) return
    setMessage('')
    try {
      if (patch && typeof patch.name === 'string') {
        const nm = patch.name.trim()
        if (!nm) {
          setMessage('Nombre requerido.')
          return
        }
        patch = { ...patch, name: nm }
      }
      setAdminSavingId(id)
      await patchJson(`/api/budget/entities/${id}`, patch)
      await refreshBudget({ silent: true })
      setMessage('Destino actualizado.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo actualizar el destino')
    } finally {
      setAdminSavingId(null)
    }
  }

  async function deleteBudgetEntity(id: string) {
    if (adminSavingId) return
    setMessage('')
    try {
      if (!confirm('¿Eliminar este destino?')) return
      setAdminSavingId(id)
      await deleteReq(`/api/budget/entities/${id}`)
      await refreshBudget({ silent: true })
      await refreshTransactions({ silent: true })
      setMessage('Destino eliminado.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo eliminar el destino')
    } finally {
      setAdminSavingId(null)
    }
  }

  async function patchBudgetCategory(id: string, patch: any) {
    if (adminSavingId) return
    setMessage('')
    try {
      if (patch && typeof patch.name === 'string') {
        const nm = patch.name.trim()
        if (!nm) {
          setMessage('Nombre requerido.')
          return
        }
        patch = { ...patch, name: nm }
      }
      setAdminSavingId(id)
      await patchJson(`/api/budget/categories/${id}`, patch)
      await refreshBudget({ silent: true })
      setMessage('Categoría actualizada.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo actualizar la categoría')
    } finally {
      setAdminSavingId(null)
    }
  }

  async function deleteBudgetCategory(id: string) {
    if (adminSavingId) return
    setMessage('')
    try {
      if (!confirm('¿Eliminar esta categoría?')) return
      setAdminSavingId(id)
      await deleteReq(`/api/budget/categories/${id}`)
      await refreshBudget({ silent: true })
      await refreshTransactions({ silent: true })
      setMessage('Categoría eliminada.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo eliminar la categoría')
    } finally {
      setAdminSavingId(null)
    }
  }

  async function patchBudgetAllocation(id: string, patch: any) {
    if (adminSavingId) return
    setMessage('')
    try {
      setAdminSavingId(id)
      await patchJson(`/api/budget/allocations/${id}`, patch)
      await refreshBudget({ silent: true })
      setMessage('Monto actualizado.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo actualizar el monto')
    } finally {
      setAdminSavingId(null)
    }
  }

  async function deleteBudgetAllocation(id: string) {
    if (adminSavingId) return
    setMessage('')
    try {
      if (!confirm('¿Eliminar este monto/asignación?')) return
      setAdminSavingId(id)
      await deleteReq(`/api/budget/allocations/${id}`)
      await refreshBudget({ silent: true })
      await refreshTransactions({ silent: true })
      setMessage('Monto eliminado.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo eliminar el monto')
    } finally {
      setAdminSavingId(null)
    }
  }

  async function createTransaction() {
    setMessage('')
    try {
      const created = await postJson('/api/transactions', {
        allocationId: txAllocationId,
        amount: txAmount,
        date: txDate,
        description: txDesc,
      })
      setTxAmount('')
      setTxDesc('')
      await refreshTransactions({ silent: true })
      const regCode = created?.registrationCode ? ` Registro: ${created.registrationCode}.` : ''
      showToast('ok', created?.duplicateWarning ? `Gasto agregado.${regCode} Posible duplicado: revisa el aviso.` : `Gasto agregado.${regCode}`)
      if (created?.duplicateWarning) {
        setLastDuplicateWarning({
          transactionId: created.duplicateWarning.transactionId,
          date: created.duplicateWarning.date,
          description: created.duplicateWarning.description ?? null,
          amount: created.duplicateWarning.amount ?? '',
        })
      } else {
        setLastDuplicateWarning(null)
      }
      if (created?.id) setReceiptTxId(String(created.id))
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo crear el gasto')
    }
  }

  async function createTransactionFromReceipt(opts?: { openDetail?: boolean; awaitExtraction?: boolean }) {
    if (txNewReceiptBusy) return
    const openDetail = opts?.openDetail !== false
    const awaitExtraction = opts?.awaitExtraction !== false
    const files = [...txNewReceiptFiles]
    setMessage('')
    try {
      if (!files.length) {
        setMessage('Selecciona al menos 1 foto del ticket')
        return
      }
      setTxNewReceiptBusy(true)
      const total = files.length

      // Varias fotos = un gasto por foto (en fila). Cola en segundo plano: no bloquea el móvil.
      if (total > 1) {
        const allocationId = txNewReceiptAllocationId
        const assignToUserId = txReceiptAssignTo === 'others' && txReceiptAssignUserId ? txReceiptAssignUserId : ''
        setTxNewReceiptFiles([]) // vaciar ya para poder añadir más mientras suben
        setTxNewReceiptUploadProgress({ current: 0, total })
        showToast('info', `Subiendo ${total} tickets en segundo plano…`)
        ;(async () => {
          let lastTransactionId = ''
          let lastDuplicate: { transactionId: string; date: string; description: string | null; amount: string } | null = null
          try {
            for (let i = 0; i < files.length; i++) {
              setTxNewReceiptUploadProgress({ current: i + 1, total })
              duplicateConfirmFileRef.current = files[i] ?? null
              const form = new FormData()
              form.append('file', files[i]!)
              if (allocationId) form.append('allocationId', allocationId)
              if (assignToUserId) form.append('assignToUserId', assignToUserId)
              const res = await fetch('/api/transactions/from-receipt', {
                method: 'POST',
                credentials: 'include',
                headers: viewAsHeaders(false),
                body: form,
              })
              const data = await res.json().catch(() => ({}))
              if (res.status === 409 && data?.code === 'POSSIBLE_DUPLICATE') {
                setTxNewReceiptUploadProgress(null)
                setDuplicateConfirmPending({
                  duplicateWarning: {
                    transactionId: data.duplicateWarning.transactionId,
                    date: data.duplicateWarning.date,
                    description: data.duplicateWarning.description ?? null,
                    amount: data.duplicateWarning.amount ?? '',
                  },
                  allocationId,
                  assignToUserId,
                })
                showToast('info', `Gasto ${i + 1}: posible duplicado. Elige descartar o registrar de todos modos.`)
                return
              }
              if (!res.ok) throw new Error(data.detail || data.message || `Gasto ${i + 1} (HTTP ${res.status})`)
              lastTransactionId = String(data?.transactionId || '')
              if (data?.duplicateWarning) lastDuplicate = { transactionId: data.duplicateWarning.transactionId, date: data.duplicateWarning.date, description: data.duplicateWarning.description ?? null, amount: data.duplicateWarning.amount ?? '' }
              await new Promise((r) => setTimeout(r, 80))
            }
            setTxNewReceiptAllocationId('')
            setTxNewReceiptUploadProgress(null)
            if (lastDuplicate) setLastDuplicateWarning(lastDuplicate)
            else setLastDuplicateWarning(null)
            const doneAt = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
            setLastBackgroundReceiptDone({ message: `${total} gastos guardados`, at: doneAt })
            setTimeout(() => setLastBackgroundReceiptDone(null), 12000)
            showToast('ok', lastDuplicate ? `${total} gastos guardados. Revisa posible duplicado.` : `${total} gastos guardados. Ver en Transacciones.`)
            setTimeout(() => refreshTransactions({ silent: true }).catch(() => {}), 600)
            if (openDetail && lastTransactionId) {
              openTx(lastTransactionId)
              setTxTab('Evidencias')
            }
          } catch (e: any) {
            setMessage(e?.message || 'Error al subir uno de los tickets')
            showToast('error', e?.message || 'Error al subir')
          } finally {
            setTxNewReceiptBusy(false)
            setTxNewReceiptUploadProgress(null)
          }
        })()
        return // no esperar: el flujo sigue y el móvil no se congela
      }

      // Una sola foto: subir en segundo plano para no congelar la UI
      duplicateConfirmFileRef.current = files[0] ?? null
      const form = new FormData()
      form.append('file', files[0]!)
      if (txNewReceiptAllocationId) form.append('allocationId', txNewReceiptAllocationId)
      if (txReceiptAssignTo === 'others' && txReceiptAssignUserId) form.append('assignToUserId', txReceiptAssignUserId)

      showToast('info', 'Subiendo ticket en segundo plano…')
      setTxNewReceiptFiles([])
      setTxNewReceiptAllocationId('')
      setTxNewReceiptBusy(false)

      ;(async () => {
        try {
          const res = await fetch('/api/transactions/from-receipt', {
            method: 'POST',
            credentials: 'include',
            headers: viewAsHeaders(false),
            body: form,
          })
          const data = await res.json().catch(() => ({}))
          if (res.status === 409 && data?.code === 'POSSIBLE_DUPLICATE') {
            setDuplicateConfirmPending({
              duplicateWarning: {
                transactionId: data.duplicateWarning.transactionId,
                date: data.duplicateWarning.date,
                description: data.duplicateWarning.description ?? null,
                amount: data.duplicateWarning.amount ?? '',
              },
              allocationId: txNewReceiptAllocationId,
              assignToUserId: txReceiptAssignTo === 'others' && txReceiptAssignUserId ? txReceiptAssignUserId : '',
            })
            showToast('info', 'Posible duplicado. Elige descartar o registrar de todos modos.')
            return
          }
          if (!res.ok) {
            showToast('error', data.detail || data.message || `No se pudo agregar el gasto (HTTP ${res.status})`)
            return
          }
          const transactionId = String(data?.transactionId || '')
          const receiptId = String(data?.receiptId || '')
          const regCode = data?.registrationCode ? ` Registro: ${data.registrationCode}.` : ''
          showToast('ok', (data?.message || 'Gasto guardado. Ver en Transacciones.') + regCode)
          if (data?.duplicateWarning) {
            setLastDuplicateWarning({
              transactionId: data.duplicateWarning.transactionId,
              date: data.duplicateWarning.date,
              description: data.duplicateWarning.description ?? null,
              amount: data.duplicateWarning.amount ?? '',
            })
          } else {
            setLastDuplicateWarning(null)
          }
          setTimeout(() => refreshTransactions({ silent: true }).catch(() => {}), 600)
          if (receiptId) {
            setTimeout(() => extractReceipt(receiptId, { background: true }).catch(() => {}), 800)
          }
          if (openDetail && transactionId) {
            openTx(transactionId)
            setTxTab('Evidencias')
          }
        } catch (e: any) {
          showToast('error', e?.message || 'No se pudo subir el ticket')
        }
      })()
      return
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo agregar el gasto con comprobante')
      setTxNewReceiptUploadProgress(null)
    } finally {
      setTxNewReceiptBusy(false)
    }
  }

  async function confirmDuplicateAndRegister() {
    const file = duplicateConfirmFileRef.current
    const pending = duplicateConfirmPending
    if (!file || !pending) {
      setDuplicateConfirmPending(null)
      duplicateConfirmFileRef.current = null
      return
    }
    setTxNewReceiptBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      if (pending.allocationId) form.append('allocationId', pending.allocationId)
      if (pending.assignToUserId) form.append('assignToUserId', pending.assignToUserId)
      form.append('forceDuplicate', '1')
      const res = await fetch('/api/transactions/from-receipt', {
        method: 'POST',
        credentials: 'include',
        headers: viewAsHeaders(false),
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      setDuplicateConfirmPending(null)
      duplicateConfirmFileRef.current = null
      if (!res.ok) {
        showToast('error', data.message || data.detail || 'No se pudo registrar')
        return
      }
      showToast('ok', 'Gasto registrado de todos modos. Ver en Transacciones.')
      if (data?.duplicateWarning) setLastDuplicateWarning({ transactionId: data.duplicateWarning.transactionId, date: data.duplicateWarning.date, description: data.duplicateWarning.description ?? null, amount: data.duplicateWarning.amount ?? '' })
      setTimeout(() => refreshTransactions({ silent: true }).catch(() => {}), 600)
      if (data?.transactionId) {
        openTx(data.transactionId)
        setTxTab('Evidencias')
      }
    } catch (e: any) {
      showToast('error', e?.message || 'No se pudo registrar')
    } finally {
      setTxNewReceiptBusy(false)
    }
  }

  async function uploadReceipt() {
    setMessage('')
    try {
      if (!receiptTxId) {
        setMessage('Selecciona un gasto')
        return
      }
      if (!receiptFiles.length) {
        setMessage('Selecciona al menos 1 foto')
        return
      }
      const form = new FormData()
      for (const f of receiptFiles) form.append('file', f)
      let res: Response
      try {
        res = await fetch(`/api/transactions/${receiptTxId}/receipt`, {
          method: 'POST',
          credentials: 'include',
          headers: viewAsHeaders(false),
          body: form,
        })
      } catch (e: any) {
        const raw = typeof e?.message === 'string' ? e.message : ''
        throw new Error(`No se pudo subir el recibo (conexión)${raw ? `: ${raw}` : ''}.`)
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || `No se pudo subir el recibo (HTTP ${res.status})`)
      const newReceiptId = String(data?.receipt?.id || '')
      const filesCount = receiptFiles.length
      setReceiptFiles([])
      await refreshTransactions()
      if (newReceiptId) {
        setMessage(`Recibo subido (${filesCount} foto${filesCount === 1 ? '' : 's'}). Extrayendo ticket…`)
        openTx(receiptTxId)
        setTxTab('Evidencias')
        await extractReceipt(newReceiptId)
      } else {
        setMessage('Recibo subido.')
      }
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo subir el recibo')
    }
  }

  async function loadReceiptPreview(receiptId: string) {
    try {
      const data = await getJson(`/api/receipts/${receiptId}/images`)
      const imgs = Array.isArray(data?.images) ? data.images : []
      if (imgs.length) {
        setReceiptImages(imgs)
        setReceiptImagesForId(receiptId)
        setReceiptReorderOpen(false)
        setReceiptReorderDraft([])
        const last = imgs[imgs.length - 1]
        if (last?.url) {
          setReceiptPreviewUrl(String(last.url))
          setReceiptPreviewForId(receiptId)
          setReceiptPreviewImageId(String(last.id))
        }
        return
      }
    } catch {
      // best-effort
    }
    try {
      const data2 = await getJson(`/api/receipts/${receiptId}/url`)
      if (data2?.url) {
        setReceiptPreviewUrl(String(data2.url))
        setReceiptPreviewForId(receiptId)
        setReceiptPreviewImageId(null)
        setReceiptImages([])
        setReceiptImagesForId(null)
        setReceiptReorderOpen(false)
        setReceiptReorderDraft([])
      }
    } catch {
      // best-effort
    }
  }

  async function loadReceiptExtractionOnly(receiptId: string, opts: { silent?: boolean } = {}) {
    try {
      let res: Response
      try {
        res = await fetch(`/api/receipts/${receiptId}/extraction`, {
          credentials: 'include',
          headers: viewAsHeaders(false),
        })
      } catch (e: any) {
        const raw = typeof e?.message === 'string' ? e.message : ''
        throw new Error(`Error de conexión con el servidor${raw ? ` (${raw})` : ''}. Recarga la página e intenta de nuevo.`)
      }
      const data = await res.json().catch(() => ({}))

      if (res.status === 404) {
        setReceiptExtraction(null)
        setReceiptExtractionForId(null)
        setReceiptDraftForId(null)
        return null
      }
      if (!res.ok) throw new Error(data.detail || `Error HTTP ${res.status}`)

      const extraction = normReceiptExtraction(data.extraction)
      setReceiptExtraction(extraction)
      setReceiptExtractionForId(receiptId)
      setReceiptDraftForId(null)
      setReceiptEditConcepts(false)
      return extraction
    } catch (e: any) {
      if (!opts.silent) setMessage(e?.message || 'No se pudo cargar la extracción')
      return null
    }
  }

  async function selectTxDetailReceipt(receiptId: string, opts: { silent?: boolean } = {}) {
    const rid = String(receiptId || '')
    if (!rid) return
    setTxDetailReceiptId(rid)
    setTxDetailReceiptLoading(true)
    if (!opts.silent) setMessage('')
    try {
      await Promise.all([loadReceiptPreview(rid), loadReceiptExtractionOnly(rid, { silent: !!opts.silent })])
    } finally {
      setTxDetailReceiptLoading(false)
    }
  }

  async function openReceipt(receiptId: string) {
    setMessage('')
    try {
      if (receiptPreviewUrl && receiptPreviewForId === receiptId) {
        window.open(receiptPreviewUrl, '_blank', 'noopener,noreferrer')
        return
      }
      const data = await getJson(`/api/receipts/${receiptId}/url`)
      if (data?.url) window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo abrir el recibo')
    }
  }

  function startReceiptReorder() {
    const rid = receiptExtractionForId
    if (!rid) return
    if (receiptImagesForId !== rid) return
    if (!Array.isArray(receiptImages) || receiptImages.length < 2) return
    const sorted = receiptImages
      .slice()
      .sort((a, b) => Number((a as any)?.sortOrder || 0) - Number((b as any)?.sortOrder || 0))
      .map((x) => ({ id: String((x as any).id), sortOrder: Number((x as any).sortOrder || 0), url: String((x as any).url || '') }))
    setReceiptReorderDraft(sorted)
    setReceiptReorderOpen(true)
  }

  function moveReceiptReorder(from: number, dir: -1 | 1) {
    setReceiptReorderDraft((prev) => {
      const next = prev.slice()
      const to = from + dir
      if (to < 0 || to >= next.length) return prev
      const [it] = next.splice(from, 1)
      if (!it) return prev
      next.splice(to, 0, it)
      return next
    })
  }

  async function saveReceiptReorder() {
    const rid = receiptImagesForId
    if (!rid) return
    if (!receiptReorderDraft.length) return
    setMessage('')
    try {
      setReceiptReorderSaving(true)
      const order = receiptReorderDraft.map((x) => String(x.id))
      await patchJson(`/api/receipts/${rid}/images`, { order })
      showToast('ok', 'Orden de partes actualizado. Ahora puedes usar “Re-extraer” para mejorar la lectura.')
      setReceiptReorderOpen(false)
      await loadReceiptPreview(rid)
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo guardar el orden de las partes')
    } finally {
      setReceiptReorderSaving(false)
    }
  }

  async function extractReceipt(receiptId: string, opts?: { force?: boolean; background?: boolean }) {
    if (!opts?.background && receiptExtractingId) return
    if (!opts?.background) setMessage('')
    try {
      if (!opts?.background) setReceiptExtractingId(receiptId)
      let res: Response
      try {
        res = await fetch(`/api/receipts/${receiptId}/extract`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', ...viewAsHeaders(false) },
          body: JSON.stringify({ mode: 'precise', ...(opts?.force ? { force: true } : {}) }),
        })
      } catch (e: any) {
        const raw = typeof e?.message === 'string' ? e.message : ''
        throw new Error(`No se pudo extraer el ticket (conexión)${raw ? `: ${raw}` : ''}.`)
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || `No se pudo extraer el ticket (HTTP ${res.status})`)
      const extraction = normReceiptExtraction(data.extraction)
      if (opts?.background) {
        showToast('ok', 'Ticket extraído en segundo plano.')
        refreshTransactions({ silent: true }).catch(() => {})
      } else {
        setReceiptExtraction(extraction)
        setReceiptExtractionForId(receiptId)
        setReceiptDraftForId(null)
        setReceiptEditConcepts(false)
        showToast('ok', data.message || 'Ticket extraído correctamente.')
        await loadReceiptPreview(receiptId)
        await refreshTransactions({ silent: true })
      }
    } catch (e: any) {
      if (!opts?.background) setMessage(e?.message || 'No se pudo extraer el ticket')
      else showToast('error', 'La extracción falló. Puedes extraer después desde el ticket.')
    } finally {
      if (!opts?.background) setReceiptExtractingId(null)
    }
  }

  useEffect(() => {
    const rid = receiptExtractionForId
    if (!rid) return
    const ext = receiptExtraction
    if (!ext || typeof ext !== 'object') return
    if (receiptDraftForId === rid) return

    setReceiptDateDraft(typeof ext.date === 'string' ? ext.date : '')
    setReceiptTaxDraft(ext.tax !== null && ext.tax !== undefined ? String(ext.tax) : '')
    setReceiptTipDraft(ext.tip !== null && ext.tip !== undefined ? String(ext.tip) : '')

    const items = Array.isArray(ext.items) ? ext.items : []
    const next: Record<string, { description: string; quantity: string; unitPrice: string; amount: string }> = {}
    for (const it of items) {
      const id = String(it?.id || '')
      if (!id) continue
      next[id] = {
        description: String(it?.description || ''),
        quantity: it?.quantity !== null && it?.quantity !== undefined ? String(it.quantity) : '',
        unitPrice: it?.unitPrice !== null && it?.unitPrice !== undefined ? String(it.unitPrice) : '',
        amount: it?.amount !== null && it?.amount !== undefined ? String(it.amount) : '',
      }
    }
    setReceiptItemDraft(next)
    setReceiptDraftForId(rid)
  }, [receiptDraftForId, receiptExtraction, receiptExtractionForId])

  async function saveReceiptExtractionEdits() {
    if (receiptSaving) return
    if (!receiptExtractionForId || !receiptExtraction) return

    setMessage('')
    try {
      setReceiptSaving(true)
      const rid = receiptExtractionForId
      const items = Array.isArray(receiptExtraction.items) ? receiptExtraction.items : []

      const payload: any = {}
      if (receiptDateDraft.trim()) payload.date = receiptDateDraft.trim()
      payload.tax = receiptTaxDraft.trim() ? Number(receiptTaxDraft) : null
      payload.tip = receiptTipDraft.trim() ? Number(receiptTipDraft) : null
      if (receiptEditConcepts) {
        payload.items = items
          .filter((it: any) => it && typeof it === 'object' && typeof it.id === 'string')
          .filter((it: any) => !it.isAdjustment && !it.isPlaceholder)
          .map((it: any) => {
            const d = receiptItemDraft[String(it.id)] || { description: String(it.description || ''), quantity: '', unitPrice: '', amount: '' }
            return {
              id: String(it.id),
              description: String(d.description || '').trim(),
            }
          })
      }

      const res = await patchJson(`/api/receipts/${rid}/extraction`, payload)
      setReceiptExtraction(normReceiptExtraction(res.extraction))
      setReceiptExtractionForId(rid)
      setReceiptDraftForId(null)
      showToast('ok', res.message || 'Cambios guardados (opcional).')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo guardar el ticket')
    } finally {
      setReceiptSaving(false)
    }
  }

  async function confirmReceipt(receiptId: string) {
    if (receiptConfirming) return
    setMessage('')
    const currentTxId = selectedTxId
    try {
      setReceiptConfirming(true)
      const payload = receiptConfirmAllocationId ? { allocationId: receiptConfirmAllocationId } : {}
      const data = await postJson(`/api/receipts/${receiptId}/confirm`, payload)
      showToast('ok', data?.message || 'Ticket confirmado.')

      // Limpiar revisión antes de refrescar
      setReceiptExtraction(null)
      setReceiptExtractionForId(null)
      setReceiptPreviewUrl(null)
      setReceiptPreviewForId(null)
      setReceiptPreviewImageId(null)
      setReceiptImages([])
      setReceiptImagesForId(null)
      setReceiptReorderOpen(false)
      setReceiptReorderDraft([])
      setReceiptReorderSaving(false)
      setReceiptDraftForId(null)
      setReceiptEditConcepts(false)
      setReceiptConfirmAllocationId('')

      const list = await refreshTransactions({ silent: true })
      const hasPending = (tx: any) => {
        const receipts = Array.isArray(tx?.receipts) ? tx.receipts : []
        return receipts.some((r: any) => (r?.extraction && !r?.extraction?.confirmedAt) || !r?.extraction)
      }
      const pendingIds = list ? list.filter(hasPending).map((t: any) => t.id) : []
      const currentIdx = currentTxId ? pendingIds.indexOf(currentTxId) : -1
      const nextIdx = currentIdx >= 0 ? currentIdx + 1 : 0
      const nextId = pendingIds[nextIdx]
      if (nextId) {
        openTx(nextId)
        setTxTab('Evidencias')
      } else {
        setSelectedTxId(null)
        go('transacciones')
      }
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo confirmar el ticket')
    } finally {
      setReceiptConfirming(false)
    }
  }

  const allocationSummary = useMemo(() => {
    const items = Array.isArray(allocations) ? allocations : []
    const byEntity: Record<string, number> = {}
    let total = 0
    for (const a of items) {
      if (!a?.isActive) continue
      const entityName = a?.entity?.name || 'Sin entidad'
      const n = Number(a?.monthlyLimit)
      if (!Number.isFinite(n)) continue
      byEntity[entityName] = (byEntity[entityName] || 0) + n
      total += n
    }
    return { byEntity, total }
  }, [allocations])

  const meOk = isMeOk(me) ? me : null
  const activeFamilyName = meOk?.activeFamily?.name ?? null
  const periodLabel = useMemo(() => formatPeriod(new Date()), [])
  const currency = familyDetails?.currency || 'MXN'

  const entityItems = useMemo(() => (Array.isArray(entities) ? entities : []), [entities])
  const categoryItems = useMemo(() => (Array.isArray(categories) ? categories : []), [categories])
  const myPartidasCount = useMemo(
    () => categoryItems.filter((c: any) => c?.userId && c?.code).length,
    [categoryItems]
  )
  const allocationItems = useMemo(() => (Array.isArray(allocations) ? allocations : []), [allocations])
  const memberItems = useMemo(() => (Array.isArray(members) ? members : []), [members])

  const usuariosFilteredMembers = useMemo(() => {
    const q = usuariosSearchQuery.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    if (!q) return memberItems
    return memberItems.filter((m: any) => {
      const name = String(m?.name ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
      const email = String(m?.email ?? '').toLowerCase()
      const phone = String(m?.phone ?? '').replace(/\D/g, '')
      const qNorm = q.replace(/\D/g, '')
      return name.includes(q) || email.includes(q) || (qNorm.length >= 4 && phone.includes(qNorm))
    })
  }, [memberItems, usuariosSearchQuery])

  const myPersonEntityId = useMemo(() => {
    if (!meOk?.user) return null
    const name = String(meOk.user.name || '')
    const email = String(meOk.user.email || '')
    const key = normKey(name || (email ? email.split('@')[0] : ''))
    for (const e of entityItems) {
      if (e?.type !== 'PERSON' || e?.isActive === false) continue
      if (normKey(e?.name) === key) return String(e.id)
      const first = name ? String(name).split(' ')[0] : ''
      if (normKey(first) === normKey(e?.name)) return String(e.id)
    }
    return null
  }, [entityItems, meOk])

  const receiptWizardAllocationsForMe = useMemo(() => {
    if (!myPersonEntityId) return []
    return allocationItems.filter(
      (a: any) => a?.isActive !== false && String(a?.entity?.id || '') === myPersonEntityId
    )
  }, [allocationItems, myPersonEntityId])

  const receiptWizardAllocationsOthers = useMemo(() => {
    return allocationItems.filter(
      (a: any) => a?.isActive !== false && String(a?.entity?.id || '') !== myPersonEntityId
    )
  }, [allocationItems, myPersonEntityId])
  const orgUsers = useMemo(
    () =>
      memberItems.map((m: any) => ({
        id: String(m.id || m.userId || ''),
        name: displayPersonName(m.name || m.email || 'Usuario'),
        subtitle: String(m.email || '').toLowerCase(),
        isAdmin: !!m.isFamilyAdmin,
      })),
    [memberItems]
  )
  const receiptWizardOtherUsers = useMemo(() => {
    const meId = meOk?.user?.id ? String(meOk.user.id) : ''
    if (meOk?.isFamilyAdmin) return orgUsers
    return orgUsers.filter((u: any) => String(u.id) !== meId)
  }, [meOk?.isFamilyAdmin, meOk?.user?.id, orgUsers])
  const orgEntities = useMemo(
    () =>
      entityItems
        .filter((e: any) => e?.isActive !== false)
        .map((e: any) => ({
          id: String(e.id || ''),
          name: displayPersonName(e.name || 'Destino'),
          type: entityTypeLabel(e.type),
          inBudget: !!e.participatesInBudget,
          inReports: !!e.participatesInReports,
        })),
    [entityItems]
  )

  useEffect(() => {
    if (peopleBudgetUserId) return
    const meId = meOk?.user?.id ? String(meOk.user.id) : ''
    if (meId) {
      setPeopleBudgetUserId(meId)
      return
    }
    if (memberItems.length) setPeopleBudgetUserId(String(memberItems[0]?.id || ''))
  }, [meOk?.user?.id, memberItems, peopleBudgetUserId])

  useEffect(() => {
    if (budgetWizardMemberId) return
    const meId = meOk?.user?.id ? String(meOk.user.id) : ''
    if (meId) {
      setBudgetWizardMemberId(meId)
      return
    }
    if (memberItems.length) setBudgetWizardMemberId(String(memberItems[0]?.id || ''))
  }, [budgetWizardMemberId, meOk?.user?.id, memberItems])

  const familySummary = useMemo(() => {
    const activeObjects = entityItems.filter((e: any) => e?.isActive !== false)
    const budgetObjects = activeObjects.filter((e: any) => e?.participatesInBudget !== false)
    const reportObjects = activeObjects.filter((e: any) => e?.participatesInReports !== false)
    const activeCategories = categoryItems.filter((c: any) => c?.isActive !== false)
    const activeAllocations = allocationItems.filter((a: any) => a?.isActive !== false)
    const budgetTotal = activeAllocations.reduce((sum: number, a: any) => sum + (Number(a?.monthlyLimit) || 0), 0)
    const adminCount = memberItems.filter((m: any) => m?.isFamilyAdmin).length

    return {
      memberCount: memberItems.length,
      adminCount,
      objectCount: activeObjects.length,
      budgetObjectCount: budgetObjects.length,
      reportObjectCount: reportObjects.length,
      categoryCount: activeCategories.length,
      allocationCount: activeAllocations.length,
      budgetTotal,
      excludedFromReports: activeObjects.filter((e: any) => e?.participatesInReports === false),
    }
  }, [allocationItems, categoryItems, entityItems, memberItems])

  const setupChecklist = useMemo(() => {
    const activeEntities = entityItems.filter((e: any) => e?.isActive !== false)
    const objectCount = activeEntities.length

    const activeCategories = categoryItems.filter((c: any) => c?.isActive !== false)
    const categoryCount = activeCategories.length

    const activeAllocations = allocationItems.filter((a: any) => a?.isActive !== false)
    const allocationCount = activeAllocations.length
    const hasAllocation = activeAllocations.some((a: any) => Number(a?.monthlyLimit) > 0)

    const hasObject = objectCount > 0
    const hasCategory = categoryCount > 0
    const needsSetup = !(hasObject && hasCategory && hasAllocation)

    return {
      hasObject,
      hasCategory,
      hasAllocation,
      needsSetup,
      objectCount,
      categoryCount,
      allocationCount,
    }
  }, [allocationItems, categoryItems, entityItems])

  const txItems = useMemo(() => (Array.isArray(transactions) ? transactions : []), [transactions])

  const txPendingConfirm = useMemo(() => {
    const items = txItems
    const withToConfirm = items.filter((t: any) => {
      const receipts = Array.isArray(t.receipts) ? t.receipts : []
      return receipts.some((r: any) => r?.extraction && !r?.extraction?.confirmedAt)
    })
    const byUser: Record<string, number> = {}
    for (const t of withToConfirm) {
      const name = String(t.user?.name || t.user?.email || 'Sin usuario')
      byUser[name] = (byUser[name] || 0) + 1
    }
    return { count: withToConfirm.length, byUser, transactions: withToConfirm }
  }, [txItems])

  const txPendingCategoryUser = useMemo(() => {
    const items = txItems.filter((t: any) => t?.pendingReason)
    const byUser: Record<string, number> = {}
    for (const t of items) {
      const name = String(t.user?.name || t.user?.email || 'Sin usuario')
      byUser[name] = (byUser[name] || 0) + 1
    }
    return { count: items.length, byUser, transactions: items }
  }, [txItems])

  const flt = useMemo(() => rangeDates(fltRange), [fltRange])
  const txFlt = useMemo(() => rangeDates(txFltRange), [txFltRange])

  const txFilteredItems = useMemo(() => {
    const from = txFltFrom ? new Date(txFltFrom + 'T00:00:00.000Z') : txFlt.from
    const to = txFltTo ? new Date(txFltTo + 'T23:59:59.999Z') : txFlt.to
    const q = globalSearch.trim().toLowerCase()

    return txItems.filter((t: any) => {
      if ((from || to) && !inDateRange(String(t?.date || ''), from, to)) return false
      if (txFltCategoryId !== 'all' && String(t?.allocation?.category?.id || '') !== txFltCategoryId) return false
      if (txFltEntityId !== 'all' && String(t?.allocation?.entity?.id || '') !== txFltEntityId) return false
      if (txFltMemberId !== 'all' && String(t?.user?.id || '') !== txFltMemberId) return false

      const receipts = Array.isArray(t?.receipts) ? t.receipts : []
      const hasReceipt = receipts.length > 0
      const hasToConfirm = receipts.some((r: any) => r?.extraction && !r?.extraction?.confirmedAt)
      if (txFltReceipt === 'with' && !hasReceipt) return false
      if (txFltReceipt === 'without' && hasReceipt) return false
      if (txFltReceipt === 'to_confirm' && !hasToConfirm) return false

      if (q) {
        const hay = `${t?.description || ''} ${t?.allocation?.entity?.name || ''} ${t?.allocation?.category?.name || ''} ${t?.user?.name || ''} ${
          t?.user?.email || ''
        }`.toLowerCase()
        if (!hay.includes(q)) return false
      }

      return true
    })
  }, [txFlt.from, txFlt.to, txFltFrom, txFltTo, txFltCategoryId, txFltEntityId, txFltMemberId, txFltReceipt, txItems, globalSearch])

  useEffect(() => {
    didAutoScrollBudgetRef.current = false
  }, [activeFamilyId])

  useEffect(() => {
    resetFilters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFamilyId])

  useEffect(() => {
    if (view !== 'presupuesto') return
    if (!setupChecklist.needsSetup) return
    if (didAutoScrollBudgetRef.current) return
    didAutoScrollBudgetRef.current = true
    const id = setTimeout(() => {
      if (!meOk?.isFamilyAdmin) return
      if (!setupChecklist.hasObject) setBudgetModalTab('objetos')
      else if (!setupChecklist.hasCategory) setBudgetModalTab('categorias')
      else setBudgetModalTab('montos')
      try {
        document.getElementById('presupuesto-b1-config')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } catch {
        // ignore
      }
    }, 80)
    return () => clearTimeout(id)
  }, [meOk?.isFamilyAdmin, setupChecklist.needsSetup, setupChecklist.hasCategory, setupChecklist.hasAllocation, setupChecklist.hasObject, view])

  useEffect(() => {
    if (budgetModalTab !== 'montos') return
    const selectableEntities = meOk?.isFamilyAdmin
      ? entityItems.filter((e: any) => e?.isActive !== false && e?.participatesInBudget !== false)
      : entityItems.filter((e: any) => e?.isActive !== false && e?.participatesInBudget !== false && (meOk?.ownedEntityIds || []).includes(String(e.id)))
    const selectableCategories = categoryItems.filter((c: any) => c?.isActive !== false)
    if (selectableEntities.length === 1 && selectableCategories.length === 1) {
      setAlEntityId(String(selectableEntities[0]?.id || ''))
      setAlCategoryId(String(selectableCategories[0]?.id || ''))
    }
  }, [budgetModalTab, entityItems, categoryItems, meOk?.isFamilyAdmin, meOk?.ownedEntityIds])

  useEffect(() => {
    setAllocationShowAllCategories(false)
  }, [alEntityId])

  const selectedTx = useMemo(() => {
    if (!selectedTxId) return null
    return txItems.find((t: any) => t?.id === selectedTxId) ?? null
  }, [selectedTxId, txItems])

  const selectedTxReceipts = useMemo(() => {
    const r = (selectedTx as any)?.receipts
    return Array.isArray(r) ? r : []
  }, [selectedTx])

  const txFilteredIndex = useMemo(() => {
    if (!selectedTxId || !txFilteredItems.length) return -1
    const i = txFilteredItems.findIndex((t: any) => t?.id === selectedTxId)
    return i >= 0 ? i : -1
  }, [selectedTxId, txFilteredItems])
  const txPrevId = useMemo(() => {
    if (txFilteredIndex <= 0) return null
    return txFilteredItems[txFilteredIndex - 1]?.id ?? null
  }, [txFilteredIndex, txFilteredItems])
  const txNextId = useMemo(() => {
    if (txFilteredIndex < 0 || txFilteredIndex >= txFilteredItems.length - 1) return null
    return txFilteredItems[txFilteredIndex + 1]?.id ?? null
  }, [txFilteredIndex, txFilteredItems])

  const receiptStats = useMemo(() => {
    const all = selectedTxReceipts
    const pending = all.filter((r: any) => !r?.extraction)
    const toConfirm = all.filter((r: any) => r?.extraction && !r?.extraction?.confirmedAt)
    const confirmed = all.filter((r: any) => r?.extraction?.confirmedAt)
    const hideId = receiptExtractionForId
    const pendingVisible = pending.filter((r: any) => String(r?.id || '') !== String(hideId || ''))
    const toConfirmVisible = toConfirm.filter((r: any) => String(r?.id || '') !== String(hideId || ''))
    return { all, pending, pendingVisible, toConfirm, toConfirmVisible, confirmed }
  }, [receiptExtractionForId, selectedTxReceipts])

  useEffect(() => {
    setReceiptExtraction(null)
    setReceiptExtractionForId(null)
    setReceiptExtractingId(null)
    setReceiptPreviewUrl(null)
    setReceiptPreviewForId(null)
    setReceiptPreviewImageId(null)
    setReceiptImages([])
    setReceiptImagesForId(null)
    setReceiptReorderOpen(false)
    setReceiptReorderDraft([])
    setReceiptReorderSaving(false)
    setReceiptDraftForId(null)
    setReceiptDateDraft('')
    setReceiptTaxDraft('')
    setReceiptTipDraft('')
    setReceiptItemDraft({})
    setReceiptSaving(false)
    setReceiptConfirming(false)
    setReceiptEditConcepts(false)
    setReceiptConfirmAllocationId(String((selectedTx as any)?.allocation?.id || ''))

    setTxDetailReceiptId(null)
    setTxDetailReceiptLoading(false)

    const list = selectedTxReceipts
    if (Array.isArray(list) && list.length) {
      const pick =
        list.find((r: any) => r?.extraction && !r?.extraction?.confirmedAt) ||
        list.find((r: any) => r?.extraction?.confirmedAt) ||
        list[0]
      const rid = String((pick as any)?.id || '')
      if (rid) selectTxDetailReceipt(rid, { silent: true })
    }
  }, [selectedTxId])

  const dashboard = useMemo(() => {
    const allocs = Array.isArray(allocations) ? allocations : []
    const activeAllocs = allocs.filter((a: any) => a?.isActive)
    const budgetTotal = activeAllocs.reduce((sum: number, a: any) => sum + (Number(a?.monthlyLimit) || 0), 0)

    const now = new Date()
    const start = monthStart(now)
    const next = addMonths(start, 1)
    const prevStart = addMonths(start, -1)

    const inRange = (iso: string, from: Date, to: Date) => {
      const d = new Date(iso)
      const t = d.getTime()
      if (Number.isNaN(t)) return false
      return d >= from && d < to
    }

    const txThis = txItems.filter((t: any) => inRange(String(t?.date || ''), start, next))
    const txPrev = txItems.filter((t: any) => inRange(String(t?.date || ''), prevStart, start))

    const spentThis = txThis.reduce((sum: number, t: any) => sum + (Number(t?.amount) || 0), 0)
    const spentPrev = txPrev.reduce((sum: number, t: any) => sum + (Number(t?.amount) || 0), 0)

    const available = budgetTotal - spentThis
    const progress = budgetTotal > 0 ? spentThis / budgetTotal : 0

    const spentByAlloc: Record<string, number> = {}
    for (const t of txThis) {
      const allocId = t?.allocation?.id
      if (!allocId) continue
      spentByAlloc[allocId] = (spentByAlloc[allocId] || 0) + (Number(t?.amount) || 0)
    }
    let overspend = 0
    for (const a of activeAllocs) {
      const allocId = a?.id
      const limit = Number(a?.monthlyLimit) || 0
      const spent = spentByAlloc[allocId] || 0
      if (limit > 0 && spent > limit) overspend += 1
    }

    const deltaPct = spentPrev > 0 ? ((spentThis - spentPrev) / spentPrev) * 100 : spentThis > 0 ? 100 : 0

    // Bars: últimos 6 meses
    const months: { label: string; value: number }[] = []
    for (let i = 5; i >= 0; i -= 1) {
      const mStart = addMonths(start, -i)
      const mEnd = addMonths(mStart, 1)
      const total = txItems
        .filter((t: any) => inRange(String(t?.date || ''), mStart, mEnd))
        .reduce((sum: number, t: any) => sum + (Number(t?.amount) || 0), 0)
      const label = mStart.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')
      months.push({ label, value: total })
    }
    const maxMonth = Math.max(1, ...months.map((m) => m.value))

    // Donut: distribución por categoría del mes
    const byCat: Record<string, number> = {}
    for (const t of txThis) {
      const name = t?.allocation?.category?.name || 'Sin categoría'
      byCat[name] = (byCat[name] || 0) + (Number(t?.amount) || 0)
    }
    const dist = Object.entries(byCat)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
    const distTotal = dist.reduce((s, d) => s + d.value, 0) || 1
    const palette = ['#0F3D91', '#2F6FED', '#0BA95B', '#F59E0B', '#DC2626', '#64748b']
    let acc = 0
    const donutStops = dist
      .map((d, idx) => {
        const startDeg = acc * 360
        acc += d.value / distTotal
        const endDeg = acc * 360
        const color = palette[idx % palette.length]
        return `${color} ${startDeg}deg ${endDeg}deg`
      })
      .join(', ')
    const donutGradient = dist.length
      ? `conic-gradient(${donutStops})`
      : 'conic-gradient(rgba(203, 213, 225, 0.25) 0deg 360deg)'

    return {
      budgetTotal,
      spentThis,
      spentPrev,
      available,
      progress,
      overspend,
      deltaPct,
      months,
      maxMonth,
      dist,
      donutGradient,
    }
  }, [allocations, txItems])

  const reports = useMemo(() => {
    const activeEntities = entityItems.filter((e: any) => e?.isActive !== false)
    const includedEntities = activeEntities.filter((e: any) => e?.participatesInReports !== false)
    const excludedEntities = activeEntities.filter((e: any) => e?.participatesInReports === false)
    const includedIds = new Set(includedEntities.map((e: any) => String(e.id)))

    const from = flt.from
    const to = flt.to
    const periodMs = from && to ? Math.max(1, to.getTime() - from.getTime()) : null
    const prevFrom = from && periodMs ? new Date(from.getTime() - periodMs) : null
    const prevTo = from ? new Date(from.getTime()) : null

    const txMatches = (t: any, from: Date | null, to: Date | null) => {
      const entId = String(t?.allocation?.entity?.id || '')
      const catId = String(t?.allocation?.category?.id || '')
      const usrId = String(t?.user?.id || '')
      const iso = String(t?.date || '')
      const receiptsCount = Array.isArray(t?.receipts) ? t.receipts.length : 0

      if (!entId) return false
      if (!includedIds.has(entId)) return false
      if (!inDateRange(iso, from, to)) return false
      if (fltEntityId !== 'all' && entId !== fltEntityId) return false
      if (fltCategoryId !== 'all' && catId !== fltCategoryId) return false
      if (fltMemberId !== 'all' && usrId !== fltMemberId) return false
      if (fltReceipt === 'with' && receiptsCount < 1) return false
      if (fltReceipt === 'without' && receiptsCount > 0) return false
      return true
    }

    const reportTxThis = txItems.filter((t: any) => txMatches(t, from, to))
    const reportTxPrev = txItems.filter((t: any) => txMatches(t, prevFrom, prevTo))

    const spentThis = reportTxThis.reduce((sum: number, t: any) => sum + (Number(t?.amount) || 0), 0)
    const spentPrev = reportTxPrev.reduce((sum: number, t: any) => sum + (Number(t?.amount) || 0), 0)

    const activeAllocs = allocationItems.filter((a: any) => {
      if (!a?.isActive) return false
      const entId = String(a?.entity?.id || '')
      const catId = String(a?.category?.id || '')
      if (!entId) return false
      if (!includedIds.has(entId)) return false
      if (fltEntityId !== 'all' && entId !== fltEntityId) return false
      if (fltCategoryId !== 'all' && catId !== fltCategoryId) return false
      return true
    })
    const budgetTotal = activeAllocs.reduce((sum: number, a: any) => sum + (Number(a?.monthlyLimit) || 0), 0)
    const available = budgetTotal - spentThis
    const progress = budgetTotal > 0 ? spentThis / budgetTotal : 0
    const deltaPct = spentPrev > 0 ? ((spentThis - spentPrev) / spentPrev) * 100 : spentThis > 0 ? 100 : 0

    const spentByAlloc: Record<string, number> = {}
    for (const t of reportTxThis) {
      const allocId = t?.allocation?.id
      if (!allocId) continue
      spentByAlloc[String(allocId)] = (spentByAlloc[String(allocId)] || 0) + (Number(t?.amount) || 0)
    }
    let overspend = 0
    for (const a of activeAllocs) {
      const allocId = String(a?.id || '')
      if (!allocId) continue
      const limit = Number(a?.monthlyLimit) || 0
      const spent = spentByAlloc[allocId] || 0
      if (limit > 0 && spent > limit) overspend += 1
    }

    // Tabla por categoría
    const budgetByCat: Record<string, number> = {}
    for (const a of activeAllocs) {
      const catId = a?.category?.id
      if (!catId) continue
      budgetByCat[String(catId)] = (budgetByCat[String(catId)] || 0) + (Number(a?.monthlyLimit) || 0)
    }
    const spentByCat: Record<string, number> = {}
    for (const t of reportTxThis) {
      const catId = t?.allocation?.category?.id
      if (!catId) continue
      spentByCat[String(catId)] = (spentByCat[String(catId)] || 0) + (Number(t?.amount) || 0)
    }

    const byCategory = categoryItems
      .filter((c: any) => c?.isActive !== false)
      .map((c: any) => {
        const budget = budgetByCat[String(c.id)] || 0
        const spent = spentByCat[String(c.id)] || 0
        const available = budget - spent
        const progress = budget > 0 ? spent / budget : 0
        return { id: c.id, name: c.name, type: c.type, budget, spent, available, progress }
      })
      .sort((a: any, b: any) => b.spent - a.spent)

    // Tabla por objeto
    const budgetByEntity: Record<string, number> = {}
    for (const a of activeAllocs) {
      const entId = a?.entity?.id
      if (!entId) continue
      budgetByEntity[String(entId)] = (budgetByEntity[String(entId)] || 0) + (Number(a?.monthlyLimit) || 0)
    }
    const spentByEntity: Record<string, number> = {}
    for (const t of reportTxThis) {
      const entId = t?.allocation?.entity?.id
      if (!entId) continue
      spentByEntity[String(entId)] = (spentByEntity[String(entId)] || 0) + (Number(t?.amount) || 0)
    }

    const byObject = includedEntities
      .map((e: any) => {
        const id = String(e.id)
        const budget = budgetByEntity[id] || 0
        const spent = spentByEntity[id] || 0
        const available = budget - spent
        const progress = budget > 0 ? spent / budget : 0
        return { id, name: e.name, type: e.type, budget, spent, available, progress }
      })
      .sort((a: any, b: any) => b.spent - a.spent)

    // Tabla por integrante
    const spentByUser: Record<string, { id: string; name: string; email: string; spent: number; count: number }> = {}
    for (const t of reportTxThis) {
      const u = t?.user
      const id = String(u?.id || 'unknown')
      const email = String(u?.email || '')
      const name = String(u?.name || email || '—')
      if (!spentByUser[id]) spentByUser[id] = { id, name, email, spent: 0, count: 0 }
      spentByUser[id]!.spent += Number(t?.amount) || 0
      spentByUser[id]!.count += 1
    }
    const byMember = Object.values(spentByUser).sort((a, b) => b.spent - a.spent)

    // Barras 6 meses (solo objetos que participan en reportes)
    const anchor = from || new Date()
    const start = monthStart(anchor)
    const months: { label: string; value: number }[] = []
    for (let i = 5; i >= 0; i -= 1) {
      const mStart = addMonths(start, -i)
      const mEnd = addMonths(mStart, 1)
      const total = txItems
        .filter((t: any) => {
          const entId = t?.allocation?.entity?.id
          if (!entId) return false
          if (!includedIds.has(String(entId))) return false
          if (!inDateRange(String(t?.date || ''), mStart, mEnd)) return false
          if (fltEntityId !== 'all' && String(entId) !== fltEntityId) return false
          if (fltCategoryId !== 'all' && String(t?.allocation?.category?.id || '') !== fltCategoryId) return false
          if (fltMemberId !== 'all' && String(t?.user?.id || '') !== fltMemberId) return false
          const receiptsCount = Array.isArray(t?.receipts) ? t.receipts.length : 0
          if (fltReceipt === 'with' && receiptsCount < 1) return false
          if (fltReceipt === 'without' && receiptsCount > 0) return false
          return true
        })
        .reduce((sum: number, t: any) => sum + (Number(t?.amount) || 0), 0)
      const label = mStart.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')
      months.push({ label, value: total })
    }
    const maxMonth = Math.max(1, ...months.map((m) => m.value))

    // Donut: top categorías del mes (solo reportes)
    const byCatName: Record<string, number> = {}
    for (const t of reportTxThis) {
      const name = t?.allocation?.category?.name || 'Sin categoría'
      byCatName[name] = (byCatName[name] || 0) + (Number(t?.amount) || 0)
    }
    const dist = Object.entries(byCatName)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
    const distTotal = dist.reduce((s, d) => s + d.value, 0) || 1
    const palette = ['#0F3D91', '#2F6FED', '#0BA95B', '#F59E0B', '#DC2626', '#64748b']
    let acc = 0
    const donutStops = dist
      .map((d, idx) => {
        const startDeg = acc * 360
        acc += d.value / distTotal
        const endDeg = acc * 360
        const color = palette[idx % palette.length]
        return `${color} ${startDeg}deg ${endDeg}deg`
      })
      .join(', ')
    const donutGradient = dist.length
      ? `conic-gradient(${donutStops})`
      : 'conic-gradient(rgba(203, 213, 225, 0.25) 0deg 360deg)'

    return {
      includedCount: includedEntities.length,
      excludedCount: excludedEntities.length,
      excludedEntities: excludedEntities.map((e: any) => ({ id: String(e.id), name: e.name, type: e.type })),
      budgetTotal,
      spentThis,
      available,
      progress,
      overspend,
      deltaPct,
      months,
      maxMonth,
      dist,
      donutGradient,
      byCategory,
      byObject,
      byMember,
      txCountThis: reportTxThis.length,
    }
  }, [allocationItems, categoryItems, entityItems, flt.from, flt.to, fltCategoryId, fltEntityId, fltMemberId, fltReceipt, txItems])

  const reportsScope = useMemo(() => {
    const entity =
      fltEntityId !== 'all' ? (entityItems.find((e: any) => String(e?.id || '') === String(fltEntityId)) ?? null) : null
    const category =
      fltCategoryId !== 'all' ? (categoryItems.find((c: any) => String(c?.id || '') === String(fltCategoryId)) ?? null) : null
    const member =
      fltMemberId !== 'all' ? (memberItems.find((m: any) => String(m?.id || '') === String(fltMemberId)) ?? null) : null
    return { entity, category, member }
  }, [categoryItems, entityItems, fltCategoryId, fltEntityId, fltMemberId, memberItems])

  const reportsFocusedAllocation = useMemo(() => {
    if (fltEntityId === 'all' || fltCategoryId === 'all') return null
    return (
      allocationItems.find((a: any) => {
        if (a?.isActive === false) return false
        const entId = String(a?.entity?.id || '')
        const catId = String(a?.category?.id || '')
        return entId === fltEntityId && catId === fltCategoryId
      }) ?? null
    )
  }, [allocationItems, fltCategoryId, fltEntityId])

  const reportsHistory = useMemo(() => {
    const activeEntities = entityItems.filter((e: any) => e?.isActive !== false)
    const includedEntities = activeEntities.filter((e: any) => e?.participatesInReports !== false)
    const includedIds = new Set(includedEntities.map((e: any) => String(e.id)))

    const from = flt.from
    const to = flt.to

    const matches = (t: any) => {
      const entId = String(t?.allocation?.entity?.id || '')
      const catId = String(t?.allocation?.category?.id || '')
      const usrId = String(t?.user?.id || '')
      const iso = String(t?.date || '')
      const receiptsCount = Array.isArray(t?.receipts) ? t.receipts.length : 0

      if (!entId) return false
      if (!includedIds.has(entId)) return false
      if (!inDateRange(iso, from, to)) return false
      if (fltEntityId !== 'all' && entId !== fltEntityId) return false
      if (fltCategoryId !== 'all' && catId !== fltCategoryId) return false
      if (fltMemberId !== 'all' && usrId !== fltMemberId) return false
      if (fltReceipt === 'with' && receiptsCount < 1) return false
      if (fltReceipt === 'without' && receiptsCount > 0) return false
      return true
    }

    return txItems
      .filter((t: any) => matches(t))
      .slice()
      .sort((a: any, b: any) => {
        const ta = new Date(String(a?.date || '')).getTime() || 0
        const tb = new Date(String(b?.date || '')).getTime() || 0
        return tb - ta
      })
  }, [entityItems, flt.from, flt.to, fltCategoryId, fltEntityId, fltMemberId, fltReceipt, txItems])

  const categoryReport = useMemo(() => {
    const allocs = Array.isArray(allocations) ? allocations : []
    const cats = Array.isArray(categories) ? categories : []
    const now = new Date()
    const start = monthStart(now)
    const next = addMonths(start, 1)

    const inRange = (iso: string, from: Date, to: Date) => {
      const d = new Date(iso)
      const t = d.getTime()
      if (Number.isNaN(t)) return false
      return d >= from && d < to
    }

    const budgetByCat: Record<string, number> = {}
    for (const a of allocs) {
      if (!a?.isActive) continue
      const catId = a?.category?.id
      if (!catId) continue
      budgetByCat[catId] = (budgetByCat[catId] || 0) + (Number(a?.monthlyLimit) || 0)
    }

    const spentByCat: Record<string, number> = {}
    for (const t of txItems) {
      if (!inRange(String(t?.date || ''), start, next)) continue
      const catId = t?.allocation?.category?.id
      if (!catId) continue
      spentByCat[catId] = (spentByCat[catId] || 0) + (Number(t?.amount) || 0)
    }

    const rows = cats
      .filter((c: any) => c?.isActive !== false)
      .map((c: any) => {
        const budget = budgetByCat[c.id] || 0
        const spent = spentByCat[c.id] || 0
        const available = budget - spent
        const progress = budget > 0 ? spent / budget : 0
        return { id: c.id, name: c.name, type: c.type, budget, spent, available, progress }
      })
      .sort((a, b) => b.spent - a.spent)

    return rows
  }, [allocations, categories, txItems])

  const budgetConcentrado = useMemo(() => {
    const now = new Date()
    const yRaw = Number(budgetYear)
    const y = Number.isFinite(yRaw) ? Math.max(2000, Math.min(2100, Math.trunc(yRaw))) : now.getFullYear()
    const from = new Date(y, 0, 1)
    const to = new Date(y + 1, 0, 1)

    const activeAllocs = allocationItems.filter((a: any) => a?.isActive !== false)
    const monthlyTotal = activeAllocs.reduce((sum: number, a: any) => sum + (Number(a?.monthlyLimit) || 0), 0)
    const annualTotal = monthlyTotal * 12

    const spent = txItems
      .filter((t: any) => inDateRange(String(t?.date || ''), from, to))
      .reduce((sum: number, t: any) => sum + (Number(t?.amount) || 0), 0)

    return {
      year: y,
      from,
      to,
      accounts: activeAllocs.length,
      monthlyTotal,
      annualTotal,
      spent,
      remaining: annualTotal - spent,
    }
  }, [allocationItems, budgetYear, txItems])

  const budgetSpentByAllocUser = useMemo(() => {
    const from = budgetConcentrado.from
    const to = budgetConcentrado.to

    const byAllocUser: Record<string, Record<string, number>> = {}
    const byAllocTotal: Record<string, number> = {}

    for (const t of txItems) {
      if (!inDateRange(String((t as any)?.date || ''), from, to)) continue
      const allocId = String((t as any)?.allocation?.id || (t as any)?.allocationId || '')
      if (!allocId) continue
      const userId = String((t as any)?.user?.id || (t as any)?.userId || '')
      if (!userId) continue
      const amount = Number((t as any)?.amount) || 0
      if (!Number.isFinite(amount) || amount === 0) continue

      byAllocTotal[allocId] = (byAllocTotal[allocId] || 0) + amount
      if (!byAllocUser[allocId]) byAllocUser[allocId] = {}
      byAllocUser[allocId]![userId] = (byAllocUser[allocId]![userId] || 0) + amount
    }

    return { byAllocUser, byAllocTotal }
  }, [txItems, budgetConcentrado.from, budgetConcentrado.to])

  const budgetAccounts = useMemo(() => {
    const activeAllocs = allocationItems.filter((a: any) => a?.isActive !== false)
    const spentByAlloc = budgetSpentByAllocUser.byAllocTotal

    const memberById = new Map<string, any>()
    for (const m of memberItems) {
      const id = String((m as any)?.id || '')
      if (!id) continue
      memberById.set(id, m)
    }

    const entityImgById = new Map<string, string>()
    for (const e of entityItems) {
      const id = String((e as any)?.id || '')
      if (!id) continue
      const url = String((e as any)?.imageSignedUrl || (e as any)?.imageUrl || '').trim()
      if (url) entityImgById.set(id, url)
    }

    return activeAllocs
      .map((a: any) => {
        const monthly = Number(a?.monthlyLimit) || 0
        const budget = monthly * 12
        const spent = spentByAlloc[String(a.id)] || 0
        const remaining = budget - spent
        const progress = budget > 0 ? spent / budget : 0
        const type = String(a?.entity?.type || '') === 'PERSON' ? 'Individual' : 'Compartido'
        const status = spent <= 0 ? 'Pending' : remaining >= 0 ? 'OK' : 'Over'

        const rawUsers = budgetSpentByAllocUser.byAllocUser[String(a.id)] || {}
        const spenders = Object.entries(rawUsers)
          .map(([userId, amount]) => ({ userId, amount: Number(amount) || 0 }))
          .filter((x) => x.amount > 0)
          .sort((x, y) => y.amount - x.amount)
          .map((x) => {
            const m = memberById.get(String(x.userId))
            const name = displayPersonName((m as any)?.name || (m as any)?.email || '')
            return { userId: String(x.userId), name: name || '—', amount: x.amount }
          })

        return {
          id: String(a.id),
          entityId: String(a?.entity?.id || ''),
          categoryId: String(a?.category?.id || ''),
          entityName: String(a?.entity?.name || '—'),
          entityType: a?.entity?.type,
          entityImageUrl: entityImgById.get(String(a?.entity?.id || '')) || null,
          categoryName: String(a?.category?.name || '—'),
          budget,
          spent,
          remaining,
          progress,
          status,
          type,
          spenders,
        }
      })
      .sort((a, b) => b.spent - a.spent)
  }, [allocationItems, budgetSpentByAllocUser.byAllocTotal, budgetSpentByAllocUser.byAllocUser, entityItems, memberItems])

  const budgetListEntityOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; type: EntityType }>()
    for (const a of budgetAccounts as any[]) {
      const id = String((a as any)?.entityId || '')
      if (!id) continue
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          name: String((a as any)?.entityName || '—'),
          type: (String((a as any)?.entityType || 'OTHER') as EntityType) || 'OTHER',
        })
      }
    }
    const rows = Array.from(byId.values())
    rows.sort((x, y) => String(x.name).localeCompare(String(y.name)))
    return rows
  }, [budgetAccounts])

  const budgetListCategoryOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>()
    for (const a of budgetAccounts as any[]) {
      const id = String((a as any)?.categoryId || '')
      if (!id) continue
      if (!byId.has(id)) byId.set(id, { id, name: String((a as any)?.categoryName || '—') })
    }
    const rows = Array.from(byId.values())
    rows.sort((x, y) => String(x.name).localeCompare(String(y.name)))
    return rows
  }, [budgetAccounts])

  const budgetAccountsFiltered = useMemo(() => {
    const q = budgetListQuery.trim().toLowerCase()
    const wantType = budgetListType === 'individual' ? 'Individual' : budgetListType === 'shared' ? 'Compartido' : 'all'

    return (budgetAccounts as any[]).filter((a: any) => {
      if (budgetListEntityId !== 'all' && String(a?.entityId || '') !== String(budgetListEntityId)) return false
      if (budgetListCategoryId !== 'all' && String(a?.categoryId || '') !== String(budgetListCategoryId)) return false
      if (wantType !== 'all' && String(a?.type || '') !== wantType) return false

      if (budgetListSpenderId !== 'all') {
        const spenders = Array.isArray(a?.spenders) ? a.spenders : []
        const ok = spenders.some((s: any) => String(s?.userId || '') === String(budgetListSpenderId))
        if (!ok) return false
      }

      if (q) {
        const spendersNames = Array.isArray(a?.spenders) ? a.spenders.map((s: any) => String(s?.name || '')).join(' ') : ''
        const hay = `${a?.categoryName || ''} ${a?.entityName || ''} ${a?.type || ''} ${spendersNames}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [budgetAccounts, budgetListCategoryId, budgetListEntityId, budgetListQuery, budgetListSpenderId, budgetListType])

  const budgetAccountsFilteredSummary = useMemo(() => {
    let budget = 0
    let spent = 0
    let remaining = 0
    let overs = 0
    for (const a of budgetAccountsFiltered as any[]) {
      budget += Number(a?.budget) || 0
      spent += Number(a?.spent) || 0
      remaining += Number(a?.remaining) || 0
      if (String(a?.status || '') === 'Over') overs += 1
    }
    return { budget, spent, remaining, overs, count: budgetAccountsFiltered.length }
  }, [budgetAccountsFiltered])

  const budgetPeople = useMemo(() => {
    const from = budgetConcentrado.from
    const to = budgetConcentrado.to

    const yearTx = txItems.filter((t: any) => inDateRange(String(t?.date || ''), from, to))
    const spentByUserAlloc = new Map<string, number>()
    const touchedAllocByUser = new Map<string, Set<string>>()
    for (const t of yearTx) {
      const userId = String(t?.user?.id || t?.userId || '')
      const allocId = String(t?.allocation?.id || t?.allocationId || '')
      if (!userId || !allocId) continue
      const amount = Number(t?.amount) || 0
      const key = `${userId}::${allocId}`
      spentByUserAlloc.set(key, (spentByUserAlloc.get(key) || 0) + amount)
      if (!touchedAllocByUser.has(userId)) touchedAllocByUser.set(userId, new Set())
      touchedAllocByUser.get(userId)!.add(allocId)
    }

    const allocById = new Map<string, any>()
    const annualBudgetByAllocId = new Map<string, number>()
    for (const a of allocationItems) {
      const id = String(a?.id || '')
      if (!id) continue
      allocById.set(id, a)
      if (a?.isActive === false) continue
      const monthly = Number(a?.monthlyLimit) || 0
      annualBudgetByAllocId.set(id, monthly * 12)
    }

    const personByKey = new Map<string, any>()
    for (const e of entityItems) {
      if (e?.type !== 'PERSON') continue
      if (e?.isActive === false) continue
      if (e?.participatesInBudget === false) continue
      const k = normKey(e?.name)
      if (!k) continue
      if (!personByKey.has(k)) personByKey.set(k, e)
    }

    const findPersonEntity = (m: any) => {
      const baseName = String(m?.name || '')
      const email = String(m?.email || '')
      const key = normKey(baseName || (email ? email.split('@')[0] : ''))
      if (key && personByKey.has(key)) return personByKey.get(key)
      const first = baseName ? String(baseName.split(' ')[0] || '') : ''
      const k2 = normKey(first)
      if (k2 && personByKey.has(k2)) return personByKey.get(k2)
      return null
    }

    const members = memberItems
      .map((m: any) => {
        const userId = String(m?.id || '')
        if (!userId) return null

        const name = String(m?.name || m?.email || '—')
        const email = String(m?.email || '')
        const isFamilyAdmin = !!m?.isFamilyAdmin

        const person = findPersonEntity(m)
        const personEntityId = person ? String(person?.id || '') : null
        const personEntityName = person ? String(person?.name || '') : null
        const avatarUrl = person ? String((person as any)?.imageSignedUrl || (person as any)?.imageUrl || '') : ''

        const personalAllocIds = new Set<string>()
        if (personEntityId) {
          for (const a of allocationItems) {
            if (a?.isActive === false) continue
            if (String(a?.entity?.id || '') !== personEntityId) continue
            const id = String(a?.id || '')
            if (id) personalAllocIds.add(id)
          }
        }

        const touched = touchedAllocByUser.get(userId) || new Set<string>()
        const included = new Set<string>(personalAllocIds)
        if (peopleBudgetCoverage === 'all') {
          for (const id of touched) included.add(id)
        }

        const accounts: {
          allocationId: string
          entityId: string
          entityName: string
          entityType: EntityType
          categoryId: string
          categoryName: string
          budgetAnnual: number
          spent: number
          available: number
        }[] = []
        for (const allocId of included) {
          const a = allocById.get(allocId)
          if (!a || a?.isActive === false) continue
          const entityId = String(a?.entity?.id || '')
          const categoryId = String(a?.category?.id || '')
          const budgetAnnual = annualBudgetByAllocId.get(allocId) || 0
          const spent = spentByUserAlloc.get(`${userId}::${allocId}`) || 0
          accounts.push({
            allocationId: allocId,
            entityId,
            entityName: String(a?.entity?.name || '—'),
            entityType: a?.entity?.type,
            categoryId,
            categoryName: String(a?.category?.name || '—'),
            budgetAnnual,
            spent,
            available: budgetAnnual - spent,
          })
        }
        accounts.sort((a, b) => b.spent - a.spent || b.budgetAnnual - a.budgetAnnual)

        const budgetAnnual = accounts.reduce((s, r) => s + (Number(r.budgetAnnual) || 0), 0)
        const spent = accounts.reduce((s, r) => s + (Number(r.spent) || 0), 0)
        const available = budgetAnnual - spent

        return {
          userId,
          name,
          email,
          isFamilyAdmin,
          personEntityId,
          personEntityName,
          avatarUrl: avatarUrl || null,
          budgetAnnual,
          spent,
          available,
          accounts,
        }
      })
      .filter(Boolean) as any[]

    members.sort(
      (a: any, b: any) =>
        Number(b.isFamilyAdmin) - Number(a.isFamilyAdmin) || Number(b.spent) - Number(a.spent) || String(a.name).localeCompare(String(b.name))
    )

    return { members }
  }, [allocationItems, budgetConcentrado.from, budgetConcentrado.to, entityItems, memberItems, peopleBudgetCoverage, txItems])

  const budgetObjects = useMemo(() => {
    const from = budgetConcentrado.from
    const to = budgetConcentrado.to

    const yearTx = txItems.filter((t: any) => inDateRange(String(t?.date || ''), from, to))
    const spentByAlloc = new Map<string, number>()
    const spentByAllocUser = new Map<string, Map<string, number>>()
    for (const t of yearTx) {
      const allocId = String(t?.allocation?.id || t?.allocationId || '')
      if (!allocId) continue
      const amount = Number(t?.amount) || 0
      spentByAlloc.set(allocId, (spentByAlloc.get(allocId) || 0) + amount)

      const userId = String(t?.user?.id || t?.userId || '')
      if (userId) {
        if (!spentByAllocUser.has(allocId)) spentByAllocUser.set(allocId, new Map())
        const byUser = spentByAllocUser.get(allocId)!
        byUser.set(userId, (byUser.get(userId) || 0) + amount)
      }
    }

    const memberById = new Map<string, any>()
    for (const m of memberItems) {
      const id = String(m?.id || '')
      if (id) memberById.set(id, m)
    }

    const entityById = new Map<string, any>()
    for (const e of entityItems) {
      const id = String(e?.id || '')
      if (id) entityById.set(id, e)
    }

    const allocsByEntityId = new Map<string, any[]>()
    const annualBudgetByAllocId = new Map<string, number>()
    for (const a of allocationItems) {
      if (a?.isActive === false) continue
      const allocId = String(a?.id || '')
      const entityId = String(a?.entity?.id || '')
      if (!allocId || !entityId) continue

      const entity = entityById.get(entityId) || a?.entity
      if (!entity || entity?.isActive === false) continue
      if (entity?.participatesInBudget === false) continue
      if (String(entity?.type || '') === 'PERSON') continue

      const monthly = Number(a?.monthlyLimit) || 0
      annualBudgetByAllocId.set(allocId, monthly * 12)

      if (!allocsByEntityId.has(entityId)) allocsByEntityId.set(entityId, [])
      allocsByEntityId.get(entityId)!.push(a)
    }

    const eligibleEntityIds = entityItems
      .filter((e: any) => e?.isActive !== false && e?.participatesInBudget !== false && String(e?.type || '') !== 'PERSON')
      .map((e: any) => String(e?.id || ''))
      .filter(Boolean)

    const objects = Array.from(new Set(eligibleEntityIds))
      .map((entityId) => {
        const e = entityById.get(entityId)
        if (!e) return null

        const entityName = String(e?.name || '—')
        const entityType = e?.type as EntityType
        const imageUrl = String((e as any)?.imageSignedUrl || (e as any)?.imageUrl || '')
        const allocs = allocsByEntityId.get(entityId) || []

        const accounts: {
          allocationId: string
          entityId: string
          entityName: string
          entityType: EntityType
          categoryId: string
          categoryName: string
          budgetAnnual: number
          spent: number
          available: number
          spenders: { userId: string; name: string; amount: number }[]
        }[] = []

        const spenderSet = new Set<string>()
        for (const a of allocs) {
          const allocId = String(a?.id || '')
          if (!allocId) continue
          const categoryId = String(a?.category?.id || '')
          const categoryName = String(a?.category?.name || '—')
          const budgetAnnual = annualBudgetByAllocId.get(allocId) || 0
          const spent = spentByAlloc.get(allocId) || 0
          const byUser = spentByAllocUser.get(allocId)
          const spenders = byUser
            ? Array.from(byUser.entries())
                .map(([userId, amount]) => {
                  const m = memberById.get(userId)
                  const name = String(m?.name || m?.email || '—')
                  return { userId, name, amount: Number(amount) || 0 }
                })
                .sort((x, y) => Number(y.amount) - Number(x.amount))
            : []
          for (const s of spenders) spenderSet.add(String(s.userId))

          accounts.push({
            allocationId: allocId,
            entityId,
            entityName,
            entityType,
            categoryId,
            categoryName,
            budgetAnnual,
            spent,
            available: budgetAnnual - spent,
            spenders,
          })
        }

        accounts.sort((a, b) => b.spent - a.spent || b.budgetAnnual - a.budgetAnnual || String(a.categoryName).localeCompare(String(b.categoryName)))

        const budgetAnnual = accounts.reduce((s, r) => s + (Number(r.budgetAnnual) || 0), 0)
        const spent = accounts.reduce((s, r) => s + (Number(r.spent) || 0), 0)
        const available = budgetAnnual - spent

        const spendByUser = new Map<string, number>()
        for (const acc of accounts) {
          for (const s of Array.isArray((acc as any)?.spenders) ? (acc as any).spenders : []) {
            const uid = String((s as any)?.userId || '')
            if (!uid) continue
            const amt = Number((s as any)?.amount) || 0
            if (!Number.isFinite(amt) || amt === 0) continue
            spendByUser.set(uid, (spendByUser.get(uid) || 0) + amt)
          }
        }
        const spenders = Array.from(spendByUser.entries())
          .map(([userId, amount]) => {
            const m = memberById.get(userId)
            const name = String(m?.name || m?.email || '—')
            return { userId: String(userId), name, amount: Number(amount) || 0 }
          })
          .sort((a: any, b: any) => Number(b.amount) - Number(a.amount))

        const ownersRaw = Array.isArray((e as any)?.owners) ? (e as any).owners : []
        const owners = ownersRaw
          .map((o: any) => {
            const userId = String(o?.userId || o?.user?.id || '')
            if (!userId) return null
            const m = memberById.get(userId)
            const name = String(m?.name || m?.email || o?.user?.name || o?.user?.email || '—')
            const email = String(m?.email || o?.user?.email || '')
            const sharePct = o?.sharePct !== null && o?.sharePct !== undefined ? Number(o.sharePct) : null
            return { userId, name, email, sharePct: Number.isFinite(sharePct as any) ? Number(sharePct) : null }
          })
          .filter(Boolean) as any[]

        return {
          entityId,
          entityName,
          entityType,
          imageUrl: imageUrl || null,
          budgetAnnual,
          spent,
          available,
          accounts,
          spendersCount: spenderSet.size,
          spenders,
          owners,
        }
      })
      .filter(Boolean) as any[]

    objects.sort((a: any, b: any) => Number(b.spent) - Number(a.spent) || Number(b.budgetAnnual) - Number(a.budgetAnnual) || String(a.entityName).localeCompare(String(b.entityName)))

    return { objects }
  }, [allocationItems, budgetConcentrado.from, budgetConcentrado.to, entityItems, memberItems, txItems])

  const peopleBudgetMembersFiltered = useMemo(() => {
    const q = peopleBudgetQuery.trim().toLowerCase()
    if (!q) return budgetPeople.members
    return budgetPeople.members.filter((m: any) => {
      const hay = `${m?.name || ''} ${m?.email || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [budgetPeople.members, peopleBudgetQuery])

  const peopleBudgetObjectsFiltered = useMemo(() => {
    const q = peopleBudgetQuery.trim().toLowerCase()
    if (!q) return budgetObjects.objects
    return budgetObjects.objects.filter((o: any) => {
      const hay = `${o?.entityName || ''} ${entityTypeLabel(o?.entityType)}`.toLowerCase()
      return hay.includes(q)
    })
  }, [budgetObjects.objects, peopleBudgetQuery])

  const budgetPeopleSelected = useMemo(() => {
    const picked = budgetPeople.members.find((m: any) => String(m?.userId || '') === String(peopleBudgetUserId || ''))
    return picked || (budgetPeople.members[0] ?? null)
  }, [budgetPeople.members, peopleBudgetUserId])

  const budgetObjectsSelected = useMemo(() => {
    const picked = budgetObjects.objects.find((o: any) => String(o?.entityId || '') === String(peopleBudgetEntityId || ''))
    return picked || (budgetObjects.objects[0] ?? null)
  }, [budgetObjects.objects, peopleBudgetEntityId])

  const budgetObjectsSelectedView = useMemo(() => {
    if (!budgetObjectsSelected) return null
    const all = Array.isArray(budgetObjectsSelected.accounts) ? budgetObjectsSelected.accounts : []
    const accounts =
      peopleBudgetCategoryFocusId === 'all'
        ? all
        : all.filter((a: any) => String(a?.categoryId || '') === String(peopleBudgetCategoryFocusId || ''))
    const budgetAnnual = accounts.reduce((s: number, r: any) => s + (Number(r?.budgetAnnual) || 0), 0)
    const spent = accounts.reduce((s: number, r: any) => s + (Number(r?.spent) || 0), 0)
    const available = budgetAnnual - spent
    const spenderSet = new Set<string>()
    for (const acc of accounts) {
      for (const s of Array.isArray(acc?.spenders) ? acc.spenders : []) spenderSet.add(String(s?.userId || ''))
    }

    const spendByUser = new Map<string, number>()
    for (const acc of accounts) {
      for (const s of Array.isArray(acc?.spenders) ? acc.spenders : []) {
        const uid = String(s?.userId || '')
        if (!uid) continue
        const amt = Number(s?.amount) || 0
        if (!Number.isFinite(amt) || amt === 0) continue
        spendByUser.set(uid, (spendByUser.get(uid) || 0) + amt)
      }
    }
    const spenders = Array.from(spendByUser.entries())
      .map(([userId, amount]) => ({ userId: String(userId), amount: Number(amount) || 0 }))
      .sort((a, b) => Number(b.amount) - Number(a.amount))

    const ownersRaw = Array.isArray((budgetObjectsSelected as any)?.owners) ? (budgetObjectsSelected as any).owners : []
    const owners = ownersRaw
      .map((o: any) => {
        const userId = String(o?.userId || o?.user?.id || '')
        if (!userId) return null
        const name = displayPersonName(o?.name || o?.user?.name || o?.user?.email || '')
        const email = String(o?.email || o?.user?.email || '')
        const sharePct = o?.sharePct !== null && o?.sharePct !== undefined ? Number(o.sharePct) : null
        return { userId, name: name || '—', email, sharePct: Number.isFinite(sharePct as any) ? Number(sharePct) : null }
      })
      .filter(Boolean) as any[]

    const pctProvided = owners.length ? owners.filter((o: any) => o?.sharePct !== null && o?.sharePct !== undefined) : []
    const pctSum = pctProvided.reduce((s: number, o: any) => s + (Number(o?.sharePct) || 0), 0)
    const ownersModeView: 'percent' | 'equal' =
      owners.length && pctProvided.length === owners.length && pctSum === 100 ? 'percent' : 'equal'

    const ownersCompare = owners
      .map((o: any) => {
        const real = spendByUser.get(String(o.userId)) || 0
        const pct = ownersModeView === 'percent' ? Number(o?.sharePct) || 0 : owners.length ? Math.round((1 / owners.length) * 100) : 0
        const expected =
          ownersModeView === 'percent'
            ? (spent * (Number(o?.sharePct) || 0)) / 100
            : owners.length
              ? spent / owners.length
              : 0
        const delta = real - expected
        return {
          userId: String(o.userId),
          name: String(o.name || '—'),
          email: String(o.email || ''),
          pct,
          expected,
          real,
          delta,
        }
      })
      .sort((a: any, b: any) => Number(b.real) - Number(a.real) || Number(b.expected) - Number(a.expected))

    const catName =
      peopleBudgetCategoryFocusId === 'all'
        ? null
        : String(
            categoryItems.find((c: any) => String(c?.id || '') === String(peopleBudgetCategoryFocusId || ''))?.name || 'Categoría'
          )
    return {
      ...budgetObjectsSelected,
      accountsView: accounts,
      budgetAnnualView: budgetAnnual,
      spentView: spent,
      availableView: available,
      spendersCountView: spenderSet.size,
      categoryNameView: catName,
      spendersView: spenders,
      ownersView: owners,
      ownersModeView,
      ownersPctSumView: pctSum,
      ownersCompareView: ownersCompare,
    }
  }, [budgetObjectsSelected, categoryItems, peopleBudgetCategoryFocusId])

  const peopleBudgetObjectCategoryOptions = useMemo(() => {
    const o = budgetObjectsSelected
    const accounts = Array.isArray(o?.accounts) ? o.accounts : []
    const byId = new Map<string, string>()
    for (const acc of accounts) {
      const id = String(acc?.categoryId || '')
      if (!id) continue
      const name = String(acc?.categoryName || '')
      if (!byId.has(id)) byId.set(id, name)
    }
    const rows = Array.from(byId.entries()).map(([id, name]) => ({
      id,
      name: name || String(categoryItems.find((c: any) => String(c?.id || '') === id)?.name || '—'),
    }))
    rows.sort((a, b) => String(a.name).localeCompare(String(b.name)))
    return rows
  }, [budgetObjectsSelected, categoryItems])

  useEffect(() => {
    if (peopleBudgetPivot !== 'objects') return
    if (peopleBudgetCategoryFocusId === 'all') return
    const valid = new Set(peopleBudgetObjectCategoryOptions.map((c) => String(c.id)))
    if (!valid.has(String(peopleBudgetCategoryFocusId))) setPeopleBudgetCategoryFocusId('all')
  }, [peopleBudgetCategoryFocusId, peopleBudgetObjectCategoryOptions, peopleBudgetPivot])

  useEffect(() => {
    if (!peopleBudgetOpen) return
    if (peopleBudgetUserId) return
    if (budgetPeople.members.length) setPeopleBudgetUserId(String(budgetPeople.members[0]!.userId))
  }, [budgetPeople.members, peopleBudgetOpen, peopleBudgetUserId])

  useEffect(() => {
    if (!peopleBudgetOpen) return
    if (peopleBudgetPivot !== 'objects') return
    if (peopleBudgetEntityId) return
    if (budgetObjects.objects.length) setPeopleBudgetEntityId(String(budgetObjects.objects[0]!.entityId))
  }, [budgetObjects.objects, peopleBudgetEntityId, peopleBudgetOpen, peopleBudgetPivot])

  useEffect(() => {
    setPeopleBudgetNamesOpen(false)
    setPeopleBudgetQuery('')
    setPeopleBudgetCategoryFocusId('all')
    if (peopleBudgetPivot === 'objects') {
      setPeopleBudgetRows('categories')
    }
  }, [peopleBudgetPivot])

  const peopleBudgetMatrixMembers = useMemo(() => {
    const all = budgetPeople.members
    if (peopleBudgetCols !== 'active') return all
    const pick = (m: any) =>
      peopleBudgetMetric === 'budget'
        ? Number(m?.budgetAnnual) || 0
        : peopleBudgetMetric === 'available'
          ? Number(m?.available) || 0
          : Number(m?.spent) || 0
    const filtered = all.filter((m: any) => Math.abs(pick(m)) > 0.00001)
    return filtered.length ? filtered : all
  }, [budgetPeople.members, peopleBudgetCols, peopleBudgetMetric])

  const peopleBudgetMatrixObjects = useMemo(() => {
    const all = budgetObjects.objects
    if (peopleBudgetCols !== 'active') return all
    const pick = (o: any) =>
      peopleBudgetMetric === 'budget'
        ? Number(o?.budgetAnnual) || 0
        : peopleBudgetMetric === 'available'
          ? Number(o?.available) || 0
          : Number(o?.spent) || 0
    const filtered = all.filter((o: any) => Math.abs(pick(o)) > 0.00001)
    return filtered.length ? filtered : all
  }, [budgetObjects.objects, peopleBudgetCols, peopleBudgetMetric])

  const budgetObjectsMatrix = useMemo(() => {
    const objects = peopleBudgetMatrixObjects
    const topN = Math.max(4, Math.min(60, Math.trunc(Number(peopleBudgetTopN) || 12)))

    const metric = peopleBudgetMetric
    const pick = (acc: any) => (metric === 'budget' ? Number(acc.budgetAnnual) || 0 : metric === 'spent' ? Number(acc.spent) || 0 : Number(acc.available) || 0)

    const rowsById = new Map<string, { id: string; label: string; values: Record<string, number>; total: number }>()
    for (const o of objects) {
      const oid = String(o?.entityId || '')
      if (!oid) continue
      for (const acc of Array.isArray(o?.accounts) ? o.accounts : []) {
        const rowId = String(acc?.categoryId || acc?.categoryName || '')
        if (!rowId) continue
        const label = String(acc?.categoryName || '—')
        if (!rowsById.has(rowId)) rowsById.set(rowId, { id: rowId, label, values: {}, total: 0 })
        const row = rowsById.get(rowId)!
        const v = pick(acc)
        row.values[oid] = (row.values[oid] || 0) + v
        row.total += v
      }
    }

    const rows = Array.from(rowsById.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, topN)

    return { effectiveRows: 'categories' as const, rows }
  }, [peopleBudgetMatrixObjects, peopleBudgetMetric, peopleBudgetTopN])

  const budgetPeopleMatrix = useMemo(() => {
    const members = peopleBudgetMatrixMembers
    const effectiveRows = peopleBudgetRows
    const topN = Math.max(4, Math.min(60, Math.trunc(Number(peopleBudgetTopN) || 12)))

    const metric = peopleBudgetMetric
    const pick = (acc: any) => (metric === 'budget' ? Number(acc.budgetAnnual) || 0 : metric === 'spent' ? Number(acc.spent) || 0 : Number(acc.available) || 0)

    const rowsById = new Map<string, { id: string; label: string; values: Record<string, number>; total: number }>()
    for (const m of members) {
      const uid = String(m?.userId || '')
      if (!uid) continue
      for (const acc of Array.isArray(m?.accounts) ? m.accounts : []) {
        let rowId = ''
        let label = ''
        if (effectiveRows === 'categories') {
          rowId = String(acc?.categoryId || acc?.categoryName || '')
          label = String(acc?.categoryName || '—')
        } else if (effectiveRows === 'objects') {
          rowId = String(acc?.entityId || acc?.entityName || '')
          label = `${entityTypeLabel(acc?.entityType)}: ${String(acc?.entityName || '—')}`
        } else {
          rowId = String(acc?.allocationId || '')
          label = `${String(acc?.categoryName || '—')} • ${String(acc?.entityName || '—')}`
        }
        if (!rowId) continue
        if (!rowsById.has(rowId)) rowsById.set(rowId, { id: rowId, label, values: {}, total: 0 })
        const row = rowsById.get(rowId)!
        const v = pick(acc)
        row.values[uid] = (row.values[uid] || 0) + v
        row.total += v
      }
    }

    const rows = Array.from(rowsById.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, topN)

    return { effectiveRows, rows }
  }, [peopleBudgetMatrixMembers, peopleBudgetMetric, peopleBudgetRows, peopleBudgetTopN])

  const budgetModalAccounts = useMemo(() => {
    const q = budgetModalSearch.trim().toLowerCase()
    if (!q) return budgetAccounts
    return budgetAccounts.filter((a) => {
      const hay = `${a.categoryName || ''} ${a.entityName || ''} ${entityTypeLabel(a.entityType)} ${a.type || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [budgetAccounts, budgetModalSearch])

  const budgetModalSelectedAccount = useMemo(() => {
    if (!budgetModalAllocId) return null
    return budgetAccounts.find((a) => String(a.id) === String(budgetModalAllocId)) ?? null
  }, [budgetAccounts, budgetModalAllocId])

  const budgetModalSelectedAlloc = useMemo(() => {
    if (!budgetModalAllocId) return null
    return allocationItems.find((a: any) => String(a?.id || '') === String(budgetModalAllocId)) ?? null
  }, [allocationItems, budgetModalAllocId])

  useEffect(() => {
    if (view !== 'presupuesto') return
    if (budgetModalAllocId && budgetAccounts.some((a) => String(a.id) === String(budgetModalAllocId))) return
    if (budgetAccounts.length) setBudgetModalAllocId(String(budgetAccounts[0]!.id))
  }, [budgetAccounts, budgetModalAllocId, view])

  useEffect(() => {
    if (!lastCreatedAllocationId || !allocationItems.some((a: any) => String(a?.id) === String(lastCreatedAllocationId))) return
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-allocation-id="${lastCreatedAllocationId}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 120)
    return () => clearTimeout(t)
  }, [lastCreatedAllocationId, allocationItems])

  const pageInfo = useMemo(() => {
    switch (view) {
      case 'dashboard':
        return { title: 'Dashboard', subtitle: '' }
      case 'presupuesto':
        return { title: 'Presupuesto', subtitle: 'Destino → Categoría → Presupuesto, cuentas y análisis' }
      case 'transacciones':
        return { title: 'Transacciones', subtitle: 'Registro de gastos y recibos' }
      case 'calendario':
        return { title: 'Calendario de pagos', subtitle: 'Pagos realizados y esperados (motor IA)' }
      case 'usuarios':
        return { title: 'Usuarios', subtitle: 'Administración de usuarios de la familia' }
      case 'configuracion':
        return {
          title: 'Configuración',
          subtitle: 'Integrantes, destinos, cosas y reglas de familia — luego Presupuesto para montos y cuentas',
        }
      case 'solicitudes':
        return { title: 'Solicitudes de efectivo o pago', subtitle: 'Solicita efectivo o pago de servicios (colegiatura, cine, préstamo). Crear y gestionar aquí o por WhatsApp.' }
      case 'documentos':
        return { title: 'Mis documentos', subtitle: 'Identificaciones, actas, vehículos, recetas y prescripciones en digital' }
      case 'cosas':
        return { title: 'Mis cosas', subtitle: 'Dispositivos, auto, bicicleta, servicios: datos, mantenimiento y facturas' }
      case 'tx':
        return { title: 'Detalle de transacción', subtitle: '' }
      default:
        return { title: 'DOMUS+', subtitle: '' }
    }
  }, [view])

  function go(next: UiView) {
    setMessage('')
    setMobileNavOpen(false)
    setFamilyMenuOpen(false)
    setReportsMenuOpen(false)
    setView(next)
    if (next !== 'tx') setSelectedTxId(null)
    if (next !== 'tx') setTxTab('Detalle')
  }

  function openTx(id: string) {
    setMobileNavOpen(false)
    setFamilyMenuOpen(false)
    setReportsMenuOpen(false)
    setSelectedTxId(id)
    setTxTab('Detalle')
    setView('tx')
  }

  function openBudgetModal(pickAllocationId?: string, tab?: 'cuentas' | 'objetos' | 'categorias' | 'montos') {
    go('presupuesto')
    if (tab && tab !== 'cuentas') setBudgetModalTab(tab)
    else if (!pickAllocationId && !tab) setBudgetModalTab('montos')
    setBudgetModalSearch('')
    getJson('/api/budget/custom-types').then((r: any) => setCustomEntityTypes(Array.isArray(r?.types) ? r.types : [])).catch(() => {})
    if (pickAllocationId) {
      setBudgetModalAllocId(String(pickAllocationId))
      setTimeout(() => {
        try {
          presupuestoCuentasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } catch {
          document.getElementById('presupuesto-b2-cuentas')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 80)
      return
    }
    if (budgetAccounts.length) setBudgetModalAllocId(String(budgetAccounts[0]!.id))
    if (tab === 'cuentas') {
      setTimeout(() => {
        try {
          presupuestoCuentasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } catch {
          document.getElementById('presupuesto-b2-cuentas')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 80)
    }
  }

  function closeBudgetModal() {
    go('dashboard')
    setBudgetReturnToIntegranteUserId(null)
    setBudgetWizardBusy(false)
    setEntityOwnersOpen(false)
    setEntityOwnersEntityId('')
    setEntityOwnersSelected([])
    setEntityOwnersPctDraft({})
    setEntityOwnersMode('equal')
    setEntityOwnersSaving(false)
    setEntityImageUploadingId(null)
  }

  function autoPctSplit(ids: string[]) {
    const n = ids.length
    if (n <= 0) return {} as Record<string, string>
    const base = Math.floor(100 / n)
    let rem = 100 - base * n
    const out: Record<string, string> = {}
    for (let i = 0; i < ids.length; i++) {
      const id = String(ids[i] || '')
      if (!id) continue
      const pct = base + (rem > 0 ? 1 : 0)
      if (rem > 0) rem -= 1
      out[id] = String(pct)
    }
    return out
  }

  function closeEntityOwnersModal() {
    setEntityOwnersOpen(false)
    setEntityOwnersEntityId('')
    setEntityOwnersSelected([])
    setEntityOwnersPctDraft({})
    setEntityOwnersMode('equal')
    setEntityOwnersSaving(false)
  }

  function openEntityOwnersModal(entityId: string) {
    const id = String(entityId || '')
    const e = entityItems.find((x: any) => String(x?.id || '') === id)
    if (!e) return
    const owners = Array.isArray((e as any)?.owners) ? (e as any).owners : []
    const rawSelected = owners
      .map((o: any) => String(o?.userId || o?.user?.id || ''))
      .filter(Boolean)
    const order = new Map<string, number>()
    for (let i = 0; i < memberItems.length; i++) order.set(String((memberItems[i] as any)?.id || ''), i)
    const selected = Array.from(new Set(rawSelected))
      .map((x) => String(x))
      .sort((a, b) => (order.get(a) ?? 9999) - (order.get(b) ?? 9999))

    const hasPct = owners.some((o: any) => o?.sharePct !== null && o?.sharePct !== undefined)
    const mode: 'equal' | 'percent' = hasPct ? 'percent' : 'equal'
    const pctDraft: Record<string, string> = {}
    if (mode === 'percent' && selected.length) {
      for (const o of owners) {
        const uid = String(o?.userId || o?.user?.id || '')
        if (!uid) continue
        if (o?.sharePct !== null && o?.sharePct !== undefined) pctDraft[uid] = String(o.sharePct)
      }
      const sum = selected.reduce((s, uid) => s + (Number(pctDraft[uid]) || 0), 0)
      if (sum !== 100) Object.assign(pctDraft, autoPctSplit(selected))
    } else if (selected.length) {
      Object.assign(pctDraft, autoPctSplit(selected))
    }

    setEntityOwnersEntityId(id)
    setEntityOwnersSelected(selected)
    setEntityOwnersMode(mode)
    setEntityOwnersPctDraft(pctDraft)
    setEntityOwnersOpen(true)
  }

  async function saveEntityOwners() {
    if (entityOwnersSaving) return
    if (!meOk?.isFamilyAdmin) return
    const entityId = String(entityOwnersEntityId || '')
    if (!entityId) return
    setMessage('')
    try {
      setEntityOwnersSaving(true)

      const selected = entityOwnersSelected.map((x) => String(x || '')).filter(Boolean)
      const owners =
        entityOwnersMode === 'percent'
          ? selected.map((userId) => {
              const raw = String(entityOwnersPctDraft[userId] || '').trim()
              const n = Number(raw)
              if (!Number.isFinite(n) || n <= 0 || n > 100) throw new Error('Porcentaje inválido (1-100)')
              return { userId, sharePct: Math.round(n) }
            })
          : selected.map((userId) => ({ userId, sharePct: null }))

      if (entityOwnersMode === 'percent' && owners.length) {
        const sum = owners.reduce((s, o: any) => s + (Number(o?.sharePct) || 0), 0)
        if (sum !== 100) throw new Error('Los porcentajes deben sumar 100')
      }

      await patchJson(`/api/budget/entities/${entityId}`, { owners })
      await refreshBudget({ silent: true })
      setMessage('Responsables actualizados.')
      closeEntityOwnersModal()
    } catch (e: any) {
      setMessage(e?.message || 'No se pudieron guardar los responsables')
    } finally {
      setEntityOwnersSaving(false)
    }
  }

  function clampSplitPct(value: number) {
    const n = Number(value)
    if (!Number.isFinite(n)) return 50
    return Math.max(25, Math.min(75, Math.round(n)))
  }

  function setSplitFromClientX(clientX: number) {
    const wrap = txSplitWrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const w = rect.width || 0
    if (w <= 0) return
    const x = clientX - rect.left
    const pct = (x / w) * 100
    setTxDetailSplitPct(clampSplitPct(pct))
  }

  function startTxSplitDrag(e: any) {
    try {
      if (e?.button !== undefined && e.button !== 0) return
    } catch {
      // ignore
    }
    txSplitDragRef.current.active = true
    txSplitDragRef.current.pointerId = typeof e?.pointerId === 'number' ? e.pointerId : null
    try {
      if (typeof e?.currentTarget?.setPointerCapture === 'function' && typeof e?.pointerId === 'number') {
        e.currentTarget.setPointerCapture(e.pointerId)
      }
    } catch {
      // ignore
    }
    if (typeof e?.clientX === 'number') setSplitFromClientX(e.clientX)
  }

  function moveTxSplitDrag(e: any) {
    if (!txSplitDragRef.current.active) return
    if (typeof e?.clientX === 'number') setSplitFromClientX(e.clientX)
  }

  function endTxSplitDrag(e: any) {
    if (!txSplitDragRef.current.active) return
    txSplitDragRef.current.active = false
    const pid = txSplitDragRef.current.pointerId
    txSplitDragRef.current.pointerId = null
    try {
      if (pid !== null && typeof e?.currentTarget?.releasePointerCapture === 'function') {
        e.currentTarget.releasePointerCapture(pid)
      }
    } catch {
      // ignore
    }
  }

  function onTicketMagnifierMove(e: any) {
    const el = e?.currentTarget as HTMLElement | null
    if (!el) return
    const rect = el.getBoundingClientRect()
    const w = rect.width || 0
    const h = rect.height || 0
    if (w <= 0 || h <= 0) return
    const xPxRaw = Number(e?.clientX) - rect.left
    const yPxRaw = Number(e?.clientY) - rect.top
    if (!Number.isFinite(xPxRaw) || !Number.isFinite(yPxRaw)) return

    const x = xPxRaw / w
    const y = yPxRaw / h
    const xPct = Math.max(0, Math.min(100, x * 100))
    const yPct = Math.max(0, Math.min(100, y * 100))
    el.style.setProperty('--mag-x', `${xPct}%`)
    el.style.setProperty('--mag-y', `${yPct}%`)

    const lensEl = el.querySelector('.ticketMagnifier') as HTMLElement | null
    const lensW = lensEl?.offsetWidth || 220
    const lensH = lensEl?.offsetHeight || 220
    const pad = 10
    const marginX = Math.min(lensW / 2 + pad, w / 2)
    const marginY = Math.min(lensH / 2 + pad, h / 2)
    const xPx = Math.max(marginX, Math.min(w - marginX, xPxRaw))
    const yPx = Math.max(marginY, Math.min(h - marginY, yPxRaw))
    el.style.setProperty('--mag-left', `${xPx}px`)
    el.style.setProperty('--mag-top', `${yPx}px`)
  }

  return (
    <main className="sapRoot">
      {toast ? (
        <div className={`toast ${toast.kind === 'ok' ? 'toastOk' : toast.kind === 'error' ? 'toastError' : toast.kind === 'warn' ? 'toastWarn' : 'toastInfo'}`}>
          {toast.text}
        </div>
      ) : null}
      <div className="sapHeader">
        <div className="sapHeaderLeft">
          <button
            className="btn btnGhost btnSm sapMenuBtn"
            type="button"
            onClick={() => setMobileNavOpen(true)}
            disabled={!meOk}
            aria-label="Abrir menú"
            title={!meOk ? 'Inicia sesión para navegar' : 'Menú'}
          >
            Menú
          </button>
          <div className="sapBrand" onClick={() => go('dashboard')} style={{ cursor: 'pointer' }}>
            DOMUS+
          </div>
        </div>
        <div className="sapHeaderRight">
          <div className="sapHeaderDateTimeCity" aria-label="Fecha, hora y ciudad">
            <span className="sapHeaderDate">{now.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span className="sapHeaderTime">{now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <span className="sapHeaderCity">{meOk?.user?.city?.trim() || '—'}</span>
          </div>
          <div className="reportsMenuAnchor">
            <button
              ref={familyMenuBtnRef}
              className="pill pillBtn pillTrunc sapPillFamily"
              type="button"
              aria-haspopup="menu"
              aria-expanded={familyMenuOpen}
              onClick={() => setFamilyMenuOpen((v) => !v)}
              title={activeFamilyName ? `Familia activa: ${activeFamilyName} (clic para cambiar)` : 'Familia: —'}
              disabled={!meOk || !meOk.families?.length}
            >
              {activeFamilyName ? `Familia: ${activeFamilyName}` : 'Familia: —'}
            </button>
            {familyMenuOpen ? (
              <div ref={familyMenuRef} className="reportsMenu" role="menu" aria-label="Familias">
                <div className="reportsMenuSectionTitle">Cambiar familia</div>
                {meOk?.families?.length ? (
                  meOk.families.map((f) => (
                    <button
                      key={f.id}
                      className="reportsMenuItem"
                      role="menuitem"
                      type="button"
                      disabled={loading || f.id === activeFamilyId}
                      title={f.isFamilyAdmin ? 'Eres admin en esta familia' : 'Eres usuario en esta familia'}
                      onClick={() => {
                        setFamilyMenuOpen(false)
                        switchFamily(f.id)
                      }}
                    >
                      {f.name}
                      {f.id === activeFamilyId ? ' (activa)' : ''}
                      {f.isFamilyAdmin ? ' • Admin' : ''}
                    </button>
                  ))
                ) : (
                  <div className="muted" style={{ padding: '8px 10px' }}>
                    No hay familias.
                  </div>
                )}
                <div className="reportsMenuSep" role="separator" />
                <button
                  className="reportsMenuItem"
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setFamilyMenuOpen(false)
                    go('configuracion')
                  }}
                >
                  Configuración
                </button>
              </div>
            ) : null}
          </div>
          {meOk ? (
            <span className={`pill sapPillRole ${meOk.isFamilyAdmin ? 'pillOk' : 'pillWarn'}`}>{meOk.isFamilyAdmin ? 'Admin' : 'Usuario'}</span>
          ) : null}
          {meOk && activeFamilyId ? (
              <span
                className={`pill sapPillSetup ${setupChecklist.needsSetup ? 'pillWarn' : 'pillOk'}`}
                title={`Destinos: ${setupChecklist.objectCount} • Categorías: ${setupChecklist.categoryCount} • Cuentas: ${setupChecklist.allocationCount}`}
              >
                Setup: {setupChecklist.needsSetup ? 'Pendiente' : 'Listo'}
              </span>
          ) : null}
          {showBuildSignal && buildVersion ? (
            <span className="pill pillOk" title="Versión del deploy (añade ?signal=1 a la URL para verla)">
              Build: {buildVersion}
            </span>
          ) : null}
          {meOk && activeFamilyId ? (
            <label className="sapHeaderSearchWrap" style={{ margin: 0, minWidth: 140, maxWidth: 220 }}>
              <input
                type="search"
                className="input inputSm"
                placeholder="Buscar…"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') go('transacciones') }}
                style={{ width: '100%', padding: '4px 8px' }}
                aria-label="Buscar (transacciones)"
              />
            </label>
          ) : null}
          <span className="pill pillTrunc sapPillProfile" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {meOk?.user?.avatarUrl ? (
              <img src={meOk.user.avatarUrl} alt="" width={24} height={24} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : null}
            {meOk ? (meOk.user.name || 'Perfil') : 'Perfil'}
          </span>
          {meOk ? (
            <button type="button" className="btn btnGhost btnSm sapHeaderLogout" onClick={logout}>
              Cerrar sesión
            </button>
          ) : null}
        </div>
      </div>

      {viewingAsUser ? (
        <div className="sapViewAsBanner" role="status" aria-live="polite">
          <span>Viendo sesión como: <strong>{viewingAsUser.name}</strong></span>
          <button
            type="button"
            className="btn btnSm"
            onClick={() => setViewingAsUser(null)}
            style={{ marginLeft: 12, background: 'rgba(0,0,0,0.12)', color: 'inherit' }}
          >
            Salir de ver como
          </button>
        </div>
      ) : null}

      {mobileNavOpen ? (
        <div className="mobileNavOverlay" onClick={() => setMobileNavOpen(false)}>
          <div className="mobileNavSheet mobileNavSheetIphone" onClick={(e) => e.stopPropagation()}>
            <div className="mobileNavSheetHeader">
              <span className="mobileNavSheetTitle">Menú</span>
              <button className="btn btnGhost btnSm" type="button" onClick={() => setMobileNavOpen(false)} aria-label="Cerrar">
                Cerrar
              </button>
            </div>
            <nav className="mobileNavGroups" aria-label="DOMUS navegación móvil">
              <div className="mobileNavGroup">
                <div className="mobileNavGroupTitle">Principal</div>
                <div className="mobileNavGroupItems">
                  <button className={`mobileNavItem ${view === 'dashboard' ? 'mobileNavItemActive' : ''}`} onClick={() => go('dashboard')}>
                    Dashboard
                  </button>
                  <button className={`mobileNavItem ${view === 'transacciones' ? 'mobileNavItemActive' : ''}`} onClick={() => go('transacciones')}>
                    Transacciones
                  </button>
                  <button className={`mobileNavItem ${view === 'calendario' ? 'mobileNavItemActive' : ''}`} onClick={() => go('calendario')}>
                    Calendario
                  </button>
                  <button
                    className={`mobileNavItem ${reportsOpen ? 'mobileNavItemActive' : ''}`}
                    onClick={() => {
                      setMobileNavOpen(false)
                      setReportsTab('detalle')
                      setReportsTableTab('categorias')
                      setReportsOpen(true)
                    }}
                  >
                    Reportes
                  </button>
                  <button className={`mobileNavItem ${view === 'documentos' ? 'mobileNavItemActive' : ''}`} onClick={() => go('documentos')}>
                    Mis documentos
                  </button>
                  <button className={`mobileNavItem ${view === 'cosas' ? 'mobileNavItemActive' : ''}`} onClick={() => go('cosas')}>
                    Mis cosas
                  </button>
                </div>
              </div>
              <div className="mobileNavGroup">
                <div className="mobileNavGroupTitle">Configuración</div>
                <div className="mobileNavGroupItems">
                  <button
                    className="mobileNavItem"
                    onClick={() => {
                      setMobileNavOpen(false)
                      router.push('/setup/objects')
                    }}
                  >
                    Entidades
                  </button>
                </div>
              </div>
              <div className="mobileNavGroup">
                <div className="mobileNavGroupTitle">Familia</div>
                <div className="mobileNavGroupItems">
                  <button className={`mobileNavItem ${view === 'usuarios' ? 'mobileNavItemActive' : ''}`} onClick={() => go('usuarios')}>
                    Usuarios
                  </button>
                  <button className={`mobileNavItem ${view === 'configuracion' ? 'mobileNavItemActive' : ''}`} onClick={() => go('configuracion')}>
                    Configuración
                  </button>
                </div>
              </div>
              <div className="mobileNavGroup">
                <div className="mobileNavGroupTitle">Más</div>
                <div className="mobileNavGroupItems">
                  <button
                    className="mobileNavItem"
                    onClick={() => {
                      setMobileNavOpen(false)
                      router.push('/ui/system-architecture')
                    }}
                  >
                    Arquitectura
                  </button>
                </div>
              </div>
            </nav>
          </div>
        </div>
      ) : null}

      {deleteFamilyOpen ? (
        <div
          className="modalOverlay"
          onClick={() => {
            if (deleteFamilyBusy) return
            setDeleteFamilyOpen(false)
          }}
        >
          <div
            className="modalPanel modalPanelSm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-delete-family-title"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(560px, 96vw)', maxHeight: 'min(86vh, 720px)' }}
          >
            <button
              className="btn btnGhost btnSm modalClose"
              onClick={() => {
                if (deleteFamilyBusy) return
                setDeleteFamilyOpen(false)
              }}
              type="button"
              aria-label="Cerrar"
            >
              Cerrar
            </button>
            <div className="modalToolbar">
                <div className="sectionRow" style={{ justifyContent: 'space-between' }}>
                <div>
                  <h2 id="modal-delete-family-title" className="cardTitle" style={{ margin: 0 }}>
                    Eliminar familia
                  </h2>
                  <div className="muted">Por seguridad pedimos usuario y contraseña.</div>
                </div>
              </div>
            </div>

            <div className="note">
              Antes de eliminar, DOMUS descargará automáticamente un respaldo <b>oculto</b> (archivo que inicia con punto). Además, se guarda un respaldo
              oculto en el servidor para recuperación interna.
            </div>

            <div className="spacer8" />

            <div className="fieldGrid" style={{ gridTemplateColumns: '1fr' }}>
              <label>
                Usuario (email)
                <input
                  className="input"
                  value={deleteFamilyEmail}
                  onChange={(e) => setDeleteFamilyEmail(e.target.value)}
                  disabled={deleteFamilyBusy}
                  inputMode="email"
                  autoComplete="username"
                  placeholder="tu@email.com"
                />
              </label>
              <label>
                Contraseña
                <input
                  className="input"
                  type="password"
                  value={deleteFamilyPassword}
                  onChange={(e) => setDeleteFamilyPassword(e.target.value)}
                  disabled={deleteFamilyBusy}
                  autoComplete="current-password"
                  placeholder="Contraseña de la cuenta"
                />
              </label>
            </div>

            <div className="spacer8" />

            <div className="sectionRow" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                className="btn btnGhost btnSm"
                type="button"
                onClick={() => {
                  if (deleteFamilyBusy) return
                  setDeleteFamilyOpen(false)
                }}
                disabled={deleteFamilyBusy}
              >
                Cancelar
              </button>
              <button className="btn btnDanger btnSm" type="button" onClick={backupAndDeleteActiveFamily} disabled={deleteFamilyBusy}>
                {deleteFamilyBusy ? 'Eliminando…' : 'Descargar respaldo y eliminar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {calendarEventModalOpen ? (
        <div
          className="modalOverlay"
          onClick={() => {
            if (!calendarEventSubmitBusy) setCalendarEventModalOpen(false)
          }}
        >
          <div
            className="modalPanel modalPanelSm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-calendar-event-title"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(400px, 96vw)' }}
          >
            <button
              className="btn btnGhost btnSm modalClose"
              type="button"
              aria-label="Cerrar"
              disabled={calendarEventSubmitBusy}
              onClick={() => { if (!calendarEventSubmitBusy) setCalendarEventModalOpen(false) }}
            >
              Cerrar
            </button>
            <h2 id="modal-calendar-event-title" className="cardTitle" style={{ margin: 0, marginBottom: 12 }}>
              Añadir evento (no financiero)
            </h2>
            <p className="muted" style={{ marginBottom: 16 }}>Cumpleaños, citas, recordatorios, vacaciones, etc.</p>
            <div className="fieldGrid" style={{ gridTemplateColumns: '1fr' }}>
              <label>
                Título
                <input
                  className="input"
                  value={newCalendarEventTitle}
                  onChange={(e) => setNewCalendarEventTitle(e.target.value)}
                  disabled={calendarEventSubmitBusy}
                  placeholder="Ej. Cumpleaños de María"
                />
              </label>
              <label>
                Fecha
                <input
                  className="input"
                  type="date"
                  value={newCalendarEventDate}
                  onChange={(e) => setNewCalendarEventDate(e.target.value)}
                  disabled={calendarEventSubmitBusy}
                />
              </label>
              <label>
                Tipo
                <select
                  className="input"
                  value={newCalendarEventType}
                  onChange={(e) => setNewCalendarEventType(e.target.value)}
                  disabled={calendarEventSubmitBusy}
                >
                  <option value="custom">Otro</option>
                  <option value="birthday">Cumpleaños</option>
                  <option value="appointment">Cita</option>
                  <option value="reminder">Recordatorio</option>
                  <option value="vacation">Vacaciones</option>
                </select>
              </label>
            </div>
            <div className="sectionRow" style={{ justifyContent: 'flex-end', marginTop: 20, gap: 8 }}>
              <button
                className="btn btnGhost btnSm"
                type="button"
                onClick={() => { if (!calendarEventSubmitBusy) setCalendarEventModalOpen(false) }}
                disabled={calendarEventSubmitBusy}
              >
                Cancelar
              </button>
              <button
                className="btn btnPrimary btnSm"
                type="button"
                disabled={calendarEventSubmitBusy || !newCalendarEventTitle.trim() || !newCalendarEventDate}
                onClick={async () => {
                  if (!newCalendarEventTitle.trim() || !newCalendarEventDate) return
                  setCalendarEventSubmitBusy(true)
                  try {
                    const res = await fetch('/api/calendar/family-events', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({
                        title: newCalendarEventTitle.trim(),
                        eventDate: newCalendarEventDate,
                        type: newCalendarEventType,
                      }),
                    })
                    const data = await res.json()
                    if (data?.ok) {
                      setCalendarRefreshTrigger((t) => t + 1)
                      setCalendarEventModalOpen(false)
                      setNewCalendarEventTitle('')
                      setNewCalendarEventDate(calendarMonth + '-01')
                      setNewCalendarEventType('custom')
                    } else {
                      alert(data?.error || 'Error al crear el evento')
                    }
                  } catch {
                    alert('Error de conexión')
                  } finally {
                    setCalendarEventSubmitBusy(false)
                  }
                }}
              >
                {calendarEventSubmitBusy ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {solicitudEfectivoOpen ? (
        <div
          className="modalOverlay"
          onClick={() => {
            if (!solicitudEfectivoBusy) {
              setSolicitudEfectivoOpen(false)
              setSolicitudEfectivoDone(null)
            }
          }}
        >
          <div
            className="modalPanel modalPanelSm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-solicitud-efectivo-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="btn btnGhost btnSm modalClose"
              type="button"
              aria-label="Cerrar"
              disabled={solicitudEfectivoBusy}
              onClick={() => {
                if (!solicitudEfectivoBusy) {
                  setSolicitudEfectivoOpen(false)
                  setSolicitudEfectivoDone(null)
                }
              }}
            >
              Cerrar
            </button>
            <div className="modalToolbar">
              <h2 id="modal-solicitud-efectivo-title" className="cardTitle" style={{ margin: 0 }}>
                Solicitud de efectivo
              </h2>
              <p className="cardDesc muted" style={{ marginTop: 4 }}>Motivo, monto y destino. Revisa en Solicitudes o por WhatsApp.</p>
            </div>
            <div className="cardBody">
              {solicitudEfectivoDone ? (
                <div className="note" style={{ marginTop: 0 }}>
                  <strong>Solicitud enviada.</strong> {new Date(solicitudEfectivoDone.at).toLocaleString('es-MX')}
                </div>
              ) : (
                <>
                  <div className="fieldGrid" style={{ gap: 12 }}>
                    <label>
                      Motivo
                      <input
                        className="input"
                        placeholder="Ej. Gastos escuela"
                        value={solicitudEfectivoReason}
                        onChange={(e) => setSolicitudEfectivoReason(e.target.value)}
                        disabled={solicitudEfectivoBusy}
                        style={{ minHeight: 44 }}
                      />
                    </label>
                    <label>
                      Monto
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step="any"
                        placeholder="0"
                        value={solicitudEfectivoAmount}
                        onChange={(e) => setSolicitudEfectivoAmount(e.target.value)}
                        disabled={solicitudEfectivoBusy}
                        style={{ minHeight: 44 }}
                      />
                    </label>
                    <label>
                      Cuenta (destino + categoría)
                      <select
                        className="input"
                        value={solicitudEfectivoAllocationId}
                        onChange={(e) => setSolicitudEfectivoAllocationId(e.target.value)}
                        disabled={solicitudEfectivoBusy}
                        style={{ minHeight: 44 }}
                      >
                        <option value="">— Seleccionar —</option>
                        {(receiptWizardAllocationsForMe?.length ? receiptWizardAllocationsForMe : allocationItems).map((a: any) => (
                          <option key={a.id} value={a.id}>
                            {a.entity?.name} → {a.category?.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="sectionRow" style={{ justifyContent: 'flex-end', marginTop: 16, gap: 10 }}>
                    <button
                      className="btn btnPrimary"
                      type="button"
                      style={{ minHeight: 44 }}
                      disabled={solicitudEfectivoBusy || !solicitudEfectivoReason.trim() || !solicitudEfectivoAmount.trim()}
                      onClick={async () => {
                        const amount = Number(solicitudEfectivoAmount.replace(',', '.'))
                        if (!Number.isFinite(amount) || amount <= 0) {
                          setMessage('Monto inválido')
                          return
                        }
                        setSolicitudEfectivoBusy(true)
                        try {
                          await postJson('/api/money-requests', {
                            reason: solicitudEfectivoReason.trim(),
                            amount,
                            allocationId: solicitudEfectivoAllocationId || undefined,
                            date: new Date().toISOString().slice(0, 10),
                            currency: familyDetails?.currency || 'MXN',
                          })
                          setSolicitudEfectivoDone({ at: new Date().toISOString() })
                          loadMoneyRequests()
                        } catch (e: any) {
                          setMessage(e?.message || 'Error al crear solicitud')
                        } finally {
                          setSolicitudEfectivoBusy(false)
                        }
                      }}
                    >
                      {solicitudEfectivoBusy ? 'Enviando…' : 'Enviar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="sapBody">
        <aside className="sapSidebar">
          <div className="muted" style={{ fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 12 }}>
            Navegación
          </div>
          <nav className="sapNav" aria-label="DOMUS navegación">
            <button className={`sapNavItem ${view === 'dashboard' ? 'sapNavItemActive' : ''}`} onClick={() => go('dashboard')}>
              Dashboard
            </button>
            <button className={`sapNavItem ${view === 'presupuesto' ? 'sapNavItemActive' : ''}`} onClick={() => go('presupuesto')}>
              Presupuesto
            </button>
            <button
              className={`sapNavItem ${view === 'transacciones' ? 'sapNavItemActive' : ''}`}
              onClick={() => go('transacciones')}
            >
              Transacciones
            </button>
            <button className={`sapNavItem ${view === 'calendario' ? 'sapNavItemActive' : ''}`} onClick={() => go('calendario')}>
              Calendario
            </button>
            <button className={`sapNavItem ${view === 'usuarios' ? 'sapNavItemActive' : ''}`} onClick={() => go('usuarios')}>
              Usuarios
            </button>
            <button
              className={`sapNavItem ${reportsOpen ? 'sapNavItemActive' : ''}`}
              onClick={() => {
                setReportsTab('detalle')
                setReportsTableTab('categorias')
                setReportsOpen(true)
              }}
            >
              Reportes
            </button>
            <button
              className={`sapNavItem ${view === 'configuracion' ? 'sapNavItemActive' : ''}`}
              onClick={() => go('configuracion')}
            >
              Configuración
            </button>
            <button className={`sapNavItem ${view === 'solicitudes' ? 'sapNavItemActive' : ''}`} onClick={() => go('solicitudes')}>
              Solicitudes
            </button>
            <button className={`sapNavItem ${view === 'documentos' ? 'sapNavItemActive' : ''}`} onClick={() => go('documentos')}>
              Mis documentos
            </button>
            <button className={`sapNavItem ${view === 'cosas' ? 'sapNavItemActive' : ''}`} onClick={() => go('cosas')}>
              Mis cosas
            </button>
            <div className="muted" style={{ fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 12, marginTop: 'var(--space-12)' }}>
              Configuración
            </div>
            <button className="sapNavItem" onClick={() => router.push('/setup/objects')}>
              Entidades
            </button>
            <button className="sapNavItem" onClick={() => router.push('/ui/system-architecture')}>
              Arquitectura
            </button>
          </nav>
        </aside>

        <section className={`sapContent ${view === 'usuarios' ? 'viewUsuarios' : ''} ${view === 'calendario' ? 'viewCalendario' : ''} ${view === 'presupuesto' ? 'viewPresupuesto' : ''}`}>
          <div className="pageHead">
            <div>
              <h1 className="pageTitle">{pageInfo.title}</h1>
              {pageInfo.subtitle ? <p className="pageSubtitle">{pageInfo.subtitle}</p> : null}
            </div>
            <div className="sectionRow">
              {loading ? <span className="pill pillWarn">Cargando…</span> : null}
            </div>
          </div>

          {message ? (
            <div className="alert alertMessage" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ flex: 1, minWidth: 0 }}>{message}</span>
              {(message.includes('DigitalOcean') || message.includes('DO_SPACES')) ? (
                <button type="button" className="btn btnGhost btnSm" onClick={() => setMessage('')} aria-label="Cerrar aviso">
                  Cerrar
                </button>
              ) : null}
            </div>
          ) : null}

          {!meOk ? (
            <section className="grid grid2">
              <section className="card">
                <div className="cardHeader">
                  <div>
                    <h2 className="cardTitle">Crear cuenta</h2>
                    <p className="cardDesc">Crea un usuario y su primera familia. Teléfono y ciudad son necesarios para comprobantes por WhatsApp.</p>
                  </div>
                </div>
                <div className="cardBody">
                  <div className="fieldGrid">
                    <label>
                      Nombre
                      <input className="input" placeholder="Nombre" value={rName} onChange={(e) => setRName(e.target.value)} />
                    </label>
                    <label>
                      Email
                      <input className="input" type="email" placeholder="Email" value={rEmail} onChange={(e) => setREmail(e.target.value)} />
                    </label>
                    <label>
                      Teléfono <span className="muted">(requerido)</span>
                      <input
                        className="input"
                        type="tel"
                        placeholder="+52 686 569 0472"
                        value={rPhone}
                        onChange={(e) => setRPhone(e.target.value)}
                      />
                      <span className="muted" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>Mín. 10 dígitos. Para identificar tu cuenta y enviar comprobantes por WhatsApp.</span>
                    </label>
                    <label>
                      Ciudad <span className="muted">(requerido)</span>
                      <input
                        className="input"
                        placeholder="Ej. Hermosillo, CDMX"
                        value={rCity}
                        onChange={(e) => setRCity(e.target.value)}
                      />
                    </label>
                    <label>
                      ¿Perteneces a una familia?
                      <div className="sectionRow" style={{ gap: 16, marginTop: 6 }}>
                        <label className="sectionRow" style={{ cursor: 'pointer', gap: 6 }}>
                          <input
                            type="radio"
                            name="rBelongsToFamily"
                            checked={rBelongsToFamily === 'yes'}
                            onChange={() => setRBelongsToFamily('yes')}
                          />
                          <span>Sí</span>
                        </label>
                        <label className="sectionRow" style={{ cursor: 'pointer', gap: 6 }}>
                          <input
                            type="radio"
                            name="rBelongsToFamily"
                            checked={rBelongsToFamily === 'no'}
                            onChange={() => setRBelongsToFamily('no')}
                          />
                          <span>No</span>
                        </label>
                      </div>
                      <span className="muted" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>Sí = ya tienes o crearás una familia. No = solo tú.</span>
                    </label>
                    <label>
                      Contraseña (mín. 6)
                      <input
                        className="input"
                        placeholder="Contraseña"
                        type="password"
                        value={rPass}
                        onChange={(e) => setRPass(e.target.value)}
                      />
                    </label>
                    <label>
                      Nombre de familia (opcional)
                      <input
                        className="input"
                        placeholder="Ej. Familia Pérez"
                        value={rFamily}
                        onChange={(e) => setRFamily(e.target.value)}
                      />
                    </label>
                    <div className="sectionRow">
                      <button className="btn btnPrimary" onClick={register} disabled={loading}>
                        Registrar
                      </button>
                    </div>
                    <p style={{ marginTop: 12, fontSize: 14 }}>
                      <a href="/join">Unirse con código de invitación</a>
                    </p>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="cardHeader">
                  <div>
                    <h2 className="cardTitle">Iniciar sesión</h2>
                    <p className="cardDesc">Entra con tu correo y contraseña.</p>
                  </div>
                </div>
                <div className="cardBody">
                  <div className="fieldGrid">
                    <label>
                      Email
                      <input className="input" placeholder="Email" value={lEmail} onChange={(e) => setLEmail(e.target.value)} />
                    </label>
                    <label>
                      Contraseña
                      <input
                        className="input"
                        placeholder="Contraseña"
                        type="password"
                        value={lPass}
                        onChange={(e) => setLPass(e.target.value)}
                      />
                    </label>
                    <div className="sectionRow">
                      <button className="btn btnPrimary" onClick={login} disabled={loading}>
                        Entrar
                      </button>
                    </div>
                    <p style={{ marginTop: 8, fontSize: 14 }}>
                      <a href="/forgot-password">Olvidé mi contraseña</a>
                    </p>
                  </div>
                </div>
              </section>
            </section>
          ) : (
            <>
              {view === 'calendario' ? (
                <section id="calendar-print-area" className="card calendarPrintArea" style={{ maxWidth: 'none', width: '100%' }}>
                  <div className="cardHeader" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                    <h2 className="cardTitle" style={{ margin: 0 }}>Calendario</h2>
                    <div className="sectionRow" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btnGhost btnSm"
                        onClick={() => {
                          const [y, m] = calendarMonth.split('-').map(Number)
                          setCalendarMonth(m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`)
                        }}
                      >
                        ← Anterior
                      </button>
                      <span className="pill" style={{ minWidth: 120, textAlign: 'center' }}>
                        {new Date(calendarMonth + '-01').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        className="btn btnGhost btnSm"
                        onClick={() => {
                          const [y, m] = calendarMonth.split('-').map(Number)
                          setCalendarMonth(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`)
                        }}
                      >
                        Siguiente →
                      </button>
                      <button type="button" className="btn btnPrimary btnSm no-print" onClick={() => window.print()} aria-label="Imprimir calendario">
                        Imprimir
                      </button>
                      <button
                        type="button"
                        className="btn btnSecondary btnSm no-print"
                        onClick={() => {
                          setNewCalendarEventDate(calendarMonth + '-01')
                          setNewCalendarEventTitle('')
                          setNewCalendarEventType('custom')
                          setCalendarEventModalOpen(true)
                        }}
                      >
                        Añadir evento
                      </button>
                    </div>
                  </div>
                  <div className="cardBody">
                    {calendarData?.familyName != null || calendarMonth ? (
                      <p className="print-only" style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
                        Calendario DOMUS — {calendarData?.familyName || 'Familia'} — {new Date(calendarMonth + '-01').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                      </p>
                    ) : null}
                    {calendarData?.summary ? (
                      <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                        <span className="pill">Eventos: {calendarData.summary.totalEvents}</span>
                        <span className="pill pillWarn">Pendientes: {calendarData.summary.paymentsPending}</span>
                        <span className="pill pillOk">Completados: {calendarData.summary.paymentsCompleted}</span>
                        <span className="pill">Comprometido: {formatMoney(calendarData.summary.totalCommitted)}</span>
                      </div>
                    ) : null}
                    {calendarLoading ? (
                      <p className="muted">Cargando…</p>
                    ) : calendarData ? (
                      <DomusCalendar
                        key={calendarMonth}
                        events={calendarData.events}
                        initialDate={`${calendarMonth}-01`}
                        onEventClick={async (sourceTable, sourceId) => {
                          if (sourceTable === 'transaction' && sourceId) openTx(sourceId)
                          if (sourceTable === 'money_request' && sourceId) {
                            setSelectedMoneyRequestId(sourceId)
                            go('solicitudes')
                          }
                          if (sourceTable === 'family_calendar_event' && sourceId && window.confirm('¿Eliminar este evento del calendario?')) {
                            try {
                              const res = await fetch(`/api/calendar/family-events/${sourceId}`, { method: 'DELETE', credentials: 'include' })
                              const data = await res.json()
                              if (data?.ok) setCalendarRefreshTrigger((t) => t + 1)
                            } catch { /* ignore */ }
                          }
                        }}
                        onDatesSet={(start) => {
                          setCalendarMonth(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`)
                        }}
                      />
                    ) : (
                      <p className="muted">No se pudo cargar el calendario. Revisa tu conexión.</p>
                    )}
                  </div>
                </section>
              ) : view === 'dashboard' ? (
                <>
                  {meOk && !onboardingDismissed ? (
                    <div className="chartBox" style={{ background: 'var(--color-primary-bg, rgba(15, 61, 145, 0.08))', borderColor: 'var(--color-primary, #0f3d91)' }}>
                      <div className="sectionRow" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <h3 className="chartTitle" style={{ margin: 0 }}>Bienvenido a DOMUS</h3>
                          <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
                            Aquí puedes registrar gastos, subir comprobantes, ver transacciones y gestionar el presupuesto de tu familia. Usa el menú para navegar. Si eres admin, configura destinos y categorías en Presupuesto.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btnPrimary btnSm"
                          onClick={() => {
                            if (typeof window !== 'undefined') window.localStorage.setItem('domus_onboarding_done', '1')
                            setOnboardingDismissed(true)
                          }}
                        >
                          Entendido
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div className="dashboardQuickActionsMobile">
                    <button type="button" className="dashboardQuickBtn dashboardQuickBtnPrimary" onClick={() => { go('transacciones'); setTxReceiptWizardOpen(true); }}>
                      Subir comprobante
                    </button>
                    <button type="button" className="dashboardQuickBtn dashboardQuickBtnSecondary" onClick={() => go('solicitudes')}>
                      Solicitudes
                    </button>
                    {meOk?.isFamilyAdmin ? (
                      <button type="button" className="dashboardQuickBtn dashboardQuickBtnApprovals" onClick={() => go('solicitudes')}>
                        Aprobaciones de solicitudes
                      </button>
                    ) : null}
                  </div>
                  {seedResult?.demoUsers?.length ? (
                    <>
                      <div className="chartBox">
                        <div className="sectionRow" style={{ justifyContent: 'space-between' }}>
                          <h3 className="chartTitle" style={{ margin: 0 }}>
                            Usuarios demo (para probar roles)
                          </h3>
                          <button className="btn btnGhost btnSm" onClick={() => setSeedResult(null)}>
                            Ocultar
                          </button>
                        </div>
                        <div className="spacer8" />
                        <div className="muted">
                          Puedes iniciar sesión con estos datos para probar permisos (Admin vs Usuario). Se recomienda usarlos solo para pruebas.
                        </div>
                        <div className="spacer8" />
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Nombre</th>
                              <th>Email</th>
                              <th>Contraseña</th>
                              <th>Rol</th>
                            </tr>
                          </thead>
                          <tbody>
                            {seedResult.demoUsers.map((u) => (
                              <tr key={u.email}>
                                <td style={{ fontWeight: 900 }}>{u.name || '—'}</td>
                                <td className="muted">{u.email}</td>
                                <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{u.password}</td>
                                <td className="muted">{u.isFamilyAdmin ? 'Admin' : 'Usuario'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {seedResult.receipt ? (
                          <>
                            <div className="spacer8" />
                            <div className="muted">
                              Recibo demo:{' '}
                              {seedResult.receipt.created
                                ? `creado (${seedResult.receipt.receiptId?.slice(0, 6)}…)`
                                : `no creado (${seedResult.receipt.reason || 'omitido'})`}
                            </div>
                          </>
                        ) : null}
                        {(seedResult.createdTransactions12M ?? 0) > 0 ? (
                          <div className="spacer8">
                            <div className="muted">
                              Se añadieron <strong>{seedResult.createdTransactions12M}</strong> transacciones del historial de 12 meses. En <strong>Transacciones</strong> o <strong>Reportes</strong>, cambia el filtro de fechas a &quot;Todo&quot; o &quot;Últimos 6 meses&quot; para verlas.
                            </div>
                          </div>
                        ) : seedResult.seedHint ? (
                          <div className="spacer8">
                            <div className="muted" style={{ color: 'var(--color-warning, #b8860b)' }}>
                              {seedResult.seedHint}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="spacer16" />
                    </>
                  ) : null}

                  {setupChecklist.needsSetup ? (
                    <>
                      <div className="chartBox">
                        <div className="sectionRow" style={{ justifyContent: 'space-between' }}>
                          <h3 className="chartTitle" style={{ margin: 0 }}>
                            Para empezar (flujo)
                          </h3>
                          <div className="sectionRow">
                            <span className={`pill ${setupChecklist.hasObject ? 'pillOk' : 'pillWarn'}`}>Destinos: {setupChecklist.objectCount}</span>
                            <span className={`pill ${setupChecklist.hasCategory ? 'pillOk' : 'pillWarn'}`}>Categorías: {setupChecklist.categoryCount}</span>
                            <span className={`pill ${setupChecklist.hasAllocation ? 'pillOk' : 'pillWarn'}`}>Cuentas: {setupChecklist.allocationCount}</span>
                          </div>
                        </div>
                        <div className="spacer8" />
                        <div className="muted">
                          1) Al menos 1 <b>destino</b> • 2) <b>Categorías</b> • 3) Asigna <b>presupuesto</b> (pestaña Presupuesto) • 4) Confirma el plan.
                        </div>
                        <div className="spacer8" />
                        <div className="sectionRow">
                          <button className="btn btnPrimary btnSm" onClick={() => go('configuracion')}>
                            Ir a Configuración
                          </button>
                          <button className="btn btnGhost btnSm" onClick={() => go('presupuesto')}>
                            Ir a Presupuesto
                          </button>
                        </div>
                      </div>
                      <div className="spacer16" />
                    </>
                  ) : null}

                  <div className="kpiStrip kpiStripFive">
                    <div className="kpiCard">
                      <div className="kpiTitle">Presupuesto total</div>
                      <div className="kpiValue">{formatMoney(dashboard.budgetTotal, currency)}</div>
                      <div className="kpiDelta">vs mes anterior: {dashboard.deltaPct >= 0 ? '+' : ''}{dashboard.deltaPct.toFixed(1)}%</div>
                    </div>
                    <div className="kpiCard kpiWarn">
                      <div className="kpiTitle">Gastado</div>
                      <div className="kpiValue">{formatMoney(dashboard.spentThis, currency)}</div>
                      <div className="kpiDelta">progreso: {(dashboard.progress * 100).toFixed(1)}%</div>
                    </div>
                    <div className="kpiCard kpiSuccess">
                      <div className="kpiTitle">Disponible</div>
                      <div className="kpiValue">{formatMoney(dashboard.available, currency)}</div>
                      <div className="kpiDelta">estado: {dashboard.available >= 0 ? 'saludable' : 'en rojo'}</div>
                    </div>
                    <div className="kpiCard kpiDanger">
                      <div className="kpiTitle">Alertas</div>
                      <div className="kpiValue">{dashboard.overspend}</div>
                      <div className="kpiDelta">sobregasto</div>
                    </div>
                    <div
                      className={`kpiCard ${txPendingConfirm.count > 0 ? 'kpiCardAction kpiWarn' : ''}`}
                      role={txPendingConfirm.count > 0 ? 'button' : undefined}
                      tabIndex={txPendingConfirm.count > 0 ? 0 : undefined}
                      onClick={txPendingConfirm.count > 0 ? () => { setTxFltReceipt('to_confirm'); go('transacciones') } : undefined}
                      onKeyDown={txPendingConfirm.count > 0 ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTxFltReceipt('to_confirm'); go('transacciones') } } : undefined}
                      aria-label={txPendingConfirm.count > 0 ? `${txPendingConfirm.count} gastos por confirmar. Ir a Transacciones` : 'Nada por confirmar'}
                    >
                      <div className="kpiTitle">Por confirmar</div>
                      <div className="kpiValue">{txPendingConfirm.count}</div>
                      <div className="kpiDelta">{txPendingConfirm.count > 0 ? 'asignar y confirmar recibos' : 'Todo al día'}</div>
                    </div>
                  </div>

                  {txPendingConfirm.count > 0 ? (
                    <>
                      <div className="spacer16" />
                      <div className="chartBox dashboardPendingCard" role="alert">
                        <div className="dashboardPendingCardHeader">
                          <div>
                            <h3 className="chartTitle" style={{ margin: 0 }}>Pendientes de asignar</h3>
                            <p className="muted" style={{ marginTop: 4, marginBottom: 0, fontSize: 13 }}>
                              {txPendingConfirm.count} gasto{txPendingConfirm.count !== 1 ? 's' : ''} con recibo listo para asignar categoría y confirmar.
                            </p>
                          </div>
                          <div className="dashboardPendingCardActions">
                            <button type="button" className="btn btnPrimary btnSm" onClick={() => { setTxFltReceipt('to_confirm'); go('transacciones') }}>
                              Asignar y confirmar
                            </button>
                            <button type="button" className="btn btnGhost btnSm" onClick={() => { setTxFltReceipt('to_confirm'); go('transacciones') }}>
                              Ver lista de pendientes
                            </button>
                          </div>
                        </div>
                        {Object.keys(txPendingConfirm.byUser).length > 0 ? (
                          <>
                            <div className="spacer8" />
                            <div className="dashboardPendingPills">
                              <span className="muted" style={{ fontSize: 12 }}>Por usuario:</span>
                              {Object.entries(txPendingConfirm.byUser).map(([name, n]) => (
                                <span key={name} className="pill pillWarn">{name}: {n}</span>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </div>
                    </>
                  ) : null}

                  {txPendingCategoryUser.count > 0 ? (
                    <>
                      <div className="spacer16" />
                      <div className="chartBox dashboardPendingCard" role="alert">
                        <div className="dashboardPendingCardHeader">
                          <div>
                            <h3 className="chartTitle" style={{ margin: 0 }}>Pendientes de categoría / usuario</h3>
                            <p className="muted" style={{ marginTop: 4, marginBottom: 0, fontSize: 13 }}>
                              {txPendingCategoryUser.count} gasto{txPendingCategoryUser.count !== 1 ? 's' : ''} sin asignación clara. Reasigna en Transacciones o por WhatsApp con la clave (ej. E-XXXX cumpleaños Sofía).
                            </p>
                          </div>
                          <div className="dashboardPendingCardActions">
                            <button type="button" className="btn btnPrimary btnSm" onClick={() => go('transacciones')}>
                              Ver y reasignar
                            </button>
                          </div>
                        </div>
                        <div className="spacer8" />
                        <div className="dashboardPendingPills">
                          <span className="muted" style={{ fontSize: 12 }}>Quién registró:</span>
                          {Object.entries(txPendingCategoryUser.byUser).map(([name, n]) => (
                            <span key={name} className="pill pillWarn">{name}: {n}</span>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}

                  <div className="spacer16" />

                  <div className="analyticsRow">
                    <div className="chartBox">
                      <h3 className="chartTitle">Gasto mensual (últimos 6 meses)</h3>
                      <div className="bars">
                        {dashboard.months.map((m) => (
                          <div
                            key={m.label}
                            className="bar"
                            style={{ height: `${Math.max(8, Math.round((m.value / dashboard.maxMonth) * 120))}px` }}
                            title={`${m.label}: ${formatMoney(m.value, currency)}`}
                          />
                        ))}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginTop: 8 }}>
                        {dashboard.months.map((m) => (
                          <div key={m.label} className="barLabel">
                            {m.label}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="chartBox">
                      <h3 className="chartTitle">Distribución por categorías (mes)</h3>
                      <div className="donutWrap">
                        <div className="donut" style={{ background: dashboard.donutGradient }} />
                        <div className="legend">
                          {dashboard.dist.length ? (
                            dashboard.dist.map((d, idx) => {
                              const palette = ['#0F3D91', '#2F6FED', '#0BA95B', '#F59E0B', '#DC2626', '#64748b']
                              const pct = ((d.value / (dashboard.dist.reduce((s, x) => s + x.value, 0) || 1)) * 100).toFixed(0)
                              return (
                                <div key={d.name} className="legendItem">
                                  <span className="legendDot" style={{ background: palette[idx % palette.length] }} />
                                  <span>{d.name}</span>
                                  <span className="muted">{pct}%</span>
                                </div>
                              )
                            })
                          ) : (
                            <div className="muted">Sin datos aún.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="spacer16" />

                  <div className="chartBox">
                    <div className="sectionRow" style={{ justifyContent: 'space-between' }}>
                      <h3 className="chartTitle" style={{ margin: 0 }}>
                        Transacciones recientes
                      </h3>
                      <div className="sectionRow">
                        <button className="btn btnPrimary btnSm" onClick={() => go('transacciones')}>
                          Ir a Transacciones
                        </button>
                      </div>
                    </div>
                    <div className="spacer8" />
                    {txItems.length ? (
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Entidad</th>
                            <th>Categoría</th>
                            <th>Usuario</th>
                            <th>Monto</th>
                            <th>Registro</th>
                            <th>Recibos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {txItems.slice(0, 8).map((t: any) => (
                            <tr key={t.id} onClick={() => openTx(t.id)} style={{ cursor: 'pointer' }}>
                              <td>{new Date(t.date).toLocaleDateString('es-MX')}</td>
                              <td>{t.allocation?.entity?.name || '—'}</td>
                              <td>{t.allocation?.category?.name || '—'}</td>
                              <td>{t.user?.name || t.user?.email || '—'}</td>
                              <td style={{ fontWeight: 900 }}>{formatMoney(Number(t.amount), currency)}</td>
                              <td className="muted" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{t.registrationCode || '—'}</td>
                              <td className="muted">{Array.isArray(t.receipts) ? t.receipts.length : 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div>
                        <p className="muted" style={{ marginBottom: 8 }}>Aún no hay transacciones. Registra tu primer gasto con comprobante o desde Transacciones.</p>
                        <button type="button" className="btn btnPrimary btnSm" onClick={() => { go('transacciones'); setTxReceiptWizardOpen(true); }}>
                          Subir comprobante
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              {reportsOpen && typeof document !== 'undefined' && createPortal(
                <div className="modalOverlay modalOverlayFull modalOverlayOpaque reportsOverlay" onClick={() => setReportsOpen(false)} role="dialog" aria-modal="true" aria-label="Reportes">
                  <div className="modalPanel reportsStudioPanel" onClick={(e) => e.stopPropagation()}>
                    <div className="reportsStudioHeader">
                      <button type="button" className="btn btnGhost btnSm" onClick={() => { setReportsOpen(false); setMobileNavOpen(true); }} aria-label="Menú">
                        Menú
                      </button>
                      <span className="reportsStudioBrand">DOMUS+</span>
                      <button type="button" className="btn btnGhost btnSm reportsStudioHeaderClose" onClick={() => setReportsOpen(false)} aria-label="Cerrar reportes">
                        Cerrar
                      </button>
                    </div>
                    <div className="modalToolbar reportsStudioToolbar">
                      <div className="reportsToolbarRow">
                        <div className="reportsToolbarLeft">
                          <div className="reportsToolbarTitle">Reportes</div>
                          <div className="tabRow" role="tablist" aria-label="Tabs de reportes">
                            <button
                              className={`tabBtn ${reportsTab === 'detalle' ? 'tabBtnActive' : ''}`}
                              onClick={() => setReportsTab('detalle')}
                              type="button"
                              role="tab"
                              aria-selected={reportsTab === 'detalle'}
                            >
                              Detalle
                            </button>
                            <button
                              className={`tabBtn ${reportsTab === 'resumen' ? 'tabBtnActive' : ''}`}
                              onClick={() => setReportsTab('resumen')}
                              type="button"
                              role="tab"
                              aria-selected={reportsTab === 'resumen'}
                            >
                              Resumen
                            </button>
                            <button
                              className={`tabBtn ${reportsTab === 'tablas' ? 'tabBtnActive' : ''}`}
                              onClick={() => setReportsTab('tablas')}
                              type="button"
                              role="tab"
                              aria-selected={reportsTab === 'tablas'}
                            >
                              Tablas
                            </button>
                            <button
                              className={`tabBtn ${reportsTab === 'consumo' ? 'tabBtnActive' : ''}`}
                              onClick={() => setReportsTab('consumo')}
                              type="button"
                              role="tab"
                              aria-selected={reportsTab === 'consumo'}
                            >
                              Consumo
                            </button>
                          </div>
                        </div>

                        <div className="reportsToolbarFilters" role="group" aria-label="Filtros">
                          <div className="reportsFilterItem" title="Cuenta (persona o destino)">
                            <span>Cuenta</span>
                            <select className="select selectXs" value={fltEntityId} onChange={(e) => setFltEntityId(e.target.value)}>
                              <option value="all">Todas</option>
                              {(() => {
                                const active = entityItems.filter((o: any) => o?.isActive !== false)
                                const people = active
                                  .filter((o: any) => String(o?.type || '') === 'PERSON')
                                  .sort((a: any, b: any) => String(a?.name || '').localeCompare(String(b?.name || ''), 'es'))
                                const other = active
                                  .filter((o: any) => String(o?.type || '') !== 'PERSON')
                                  .sort((a: any, b: any) => {
                                    const ta = String(a?.type || '')
                                    const tb = String(b?.type || '')
                                    if (ta !== tb) return ta.localeCompare(tb, 'es')
                                    return String(a?.name || '').localeCompare(String(b?.name || ''), 'es')
                                  })
                                return (
                                  <>
                                    {people.length ? (
                                      <optgroup label="Personas">
                                        {people.map((o: any) => (
                                          <option key={o.id} value={o.id}>
                                            {o.name}
                                          </option>
                                        ))}
                                      </optgroup>
                                    ) : null}
                                    {other.length ? (
                                      <optgroup label="Destinos">
                                        {other.map((o: any) => (
                                          <option key={o.id} value={o.id}>
                                            {entityTypeLabel(o.type)}: {o.name}
                                            {o?.participatesInReports === false ? ' (excl.)' : ''}
                                          </option>
                                        ))}
                                      </optgroup>
                                    ) : null}
                                  </>
                                )
                              })()}
                            </select>
                          </div>
                          <div className="reportsFilterItem" title="Categoría">
                            <span>Categoría</span>
                            <select className="select selectXs" value={fltCategoryId} onChange={(e) => setFltCategoryId(e.target.value)}>
                              <option value="all">Todas</option>
                              {categoryItems
                                .filter((c: any) => c?.isActive !== false)
                                .map((c: any) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div className="reportsFilterItem" title="Persona (quién gastó)">
                            <span>Persona</span>
                            <select className="select selectXs" value={fltMemberId} onChange={(e) => setFltMemberId(e.target.value)}>
                              <option value="all">Todos</option>
                              {(Array.isArray(members) ? members : []).map((m: any) => (
                                <option key={m.id} value={m.id}>
                                  {m.name || m.email}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="reportsFilterItem" title="Rango">
                            <span>Rango</span>
                            <select className="select selectXs" value={fltRange} onChange={(e) => setFltRange(e.target.value as RangeKey)}>
                              <option value="this_month">Mes</option>
                              <option value="prev_month">Anterior</option>
                              <option value="last_90">90 días</option>
                              <option value="all">Todo</option>
                            </select>
                          </div>
                          <div className="reportsFilterItem" title="Recibos">
                            <span>Recibos</span>
                            <select className="select selectXs" value={fltReceipt} onChange={(e) => setFltReceipt(e.target.value as ReceiptFilter)}>
                              <option value="all">Todos</option>
                              <option value="with">Con</option>
                              <option value="without">Sin</option>
                            </select>
                          </div>
                        </div>

                        <div className="reportsToolbarActions">
                          <button
                            className="btn btnGhost btnSm"
                            type="button"
                            disabled={loading}
                            onClick={() => {
                              setReportsMenuOpen(false)
                              resetFilters()
                            }}
                            title="Limpiar filtros"
                          >
                            Limpiar
                          </button>
                          <div className="reportsMenuAnchor">
                            <button
                              ref={reportsMenuBtnRef}
                              className="btn btnGhost btnSm"
                              type="button"
                              aria-haspopup="menu"
                              aria-expanded={reportsMenuOpen}
                              onClick={() => setReportsMenuOpen((v) => !v)}
                            >
                              Exportar
                            </button>
                            {reportsMenuOpen ? (
                              <div ref={reportsMenuRef} className="reportsMenu" role="menu" aria-label="Menú de reportes">
                                <div className="reportsMenuSectionTitle">Exportar como…</div>
                                <button
                                  className="reportsMenuItem"
                                  role="menuitem"
                                  type="button"
                                  disabled={loading}
                                  onClick={() => {
                                    setReportsMenuOpen(false)
                                    downloadReport('csv')
                                  }}
                                >
                                  Excel
                                </button>
                                <button
                                  className="reportsMenuItem"
                                  role="menuitem"
                                  type="button"
                                  disabled={loading}
                                  onClick={() => {
                                    setReportsMenuOpen(false)
                                    downloadReport('pdf')
                                  }}
                                >
                                  PDF
                                </button>
                                <button
                                  className="reportsMenuItem"
                                  role="menuitem"
                                  type="button"
                                  disabled={loading}
                                  onClick={() => {
                                    setReportsMenuOpen(false)
                                    downloadReport('html')
                                  }}
                                >
                                  HTML
                                </button>
                                <button
                                  className="reportsMenuItem"
                                  role="menuitem"
                                  type="button"
                                  disabled={loading}
                                  onClick={() => {
                                    setReportsMenuOpen(false)
                                    downloadReport('docx')
                                  }}
                                >
                                  Word
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div ref={reportsPanelRef} className="reportsStudioBody">
                      <div className="reportsStudioSidebar">
                        <div className="chartBox">
                          <h3 className="chartTitle" style={{ margin: 0 }}>
                            Filtros
                          </h3>
                          <div className="muted" style={{ marginTop: 6 }}>
                            Ajusta y la vista <b>Detalle</b> se actualiza al instante.
                          </div>
                          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                            Incluidos: <b>{reports.includedCount}</b> • Excluidos: <b>{reports.excludedCount}</b> • Rango: <b>{flt.label}</b> • Tx:{' '}
                            <b>{reports.txCountThis}</b>
                          </div>
                          {reports.excludedEntities.length ? (
                            <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                              Excluidos (no participan en reportes):{' '}
                              {reports.excludedEntities
                                .slice(0, 6)
                                .map((e: any) => `${entityTypeLabel(e.type)}: ${e.name}`)
                                .join(' • ')}
                              {reports.excludedEntities.length > 6 ? ' • …' : ''}
                            </div>
                          ) : null}
                          <div className="spacer12" />
                          <div className="fieldRow">
                            <label>
                              Rango
                              <select className="select" value={fltRange} onChange={(e) => setFltRange(e.target.value as RangeKey)}>
                                <option value="this_month">Mes actual</option>
                                <option value="prev_month">Mes anterior</option>
                                <option value="last_90">Últimos 90 días</option>
                                <option value="all">Todo</option>
                              </select>
                            </label>
                            <label>
                              Recibos
                              <select className="select" value={fltReceipt} onChange={(e) => setFltReceipt(e.target.value as ReceiptFilter)}>
                                <option value="all">Todos</option>
                                <option value="with">Con recibo</option>
                                <option value="without">Sin recibo</option>
                              </select>
                            </label>
                          </div>
                          <div className="spacer8" />
                          <div className="fieldRow">
                            <label>
                              Categoría
                              <select className="select" value={fltCategoryId} onChange={(e) => setFltCategoryId(e.target.value)}>
                                <option value="all">Todas</option>
                                {categoryItems
                                  .filter((c: any) => c?.isActive !== false)
                                  .map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <label>
                              Destino
                              <select className="select" value={fltEntityId} onChange={(e) => setFltEntityId(e.target.value)}>
                                <option value="all">Todos</option>
                                {entityItems
                                  .filter((o: any) => o?.isActive !== false)
                                  .map((o: any) => (
                                    <option key={o.id} value={o.id}>
                                      {entityTypeLabel(o.type)}: {o.name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          </div>
                          <div className="spacer8" />
                          <label>
                            Usuario
                            <select className="select" value={fltMemberId} onChange={(e) => setFltMemberId(e.target.value)}>
                              <option value="all">Todos</option>
                              {(Array.isArray(members) ? members : []).map((m: any) => (
                                <option key={m.id} value={m.id}>
                                  {m.name || m.email}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        {reportsScope.entity && reportsScope.entity.participatesInReports === false ? (
                          <div
                            className="cardSub"
                            style={{
                              padding: 12,
                              borderColor: 'rgba(245, 158, 11, 0.35)',
                              background: 'rgba(245, 158, 11, 0.08)',
                            }}
                          >
                            <div className="subTitle">Destino excluido de reportes</div>
                            <div className="muted" style={{ marginTop: 6 }}>
                              Este destino está marcado como “no participa en reportes”. Inclúyelo para verlo aquí.
                            </div>
                            <div className="spacer8" />
                            <button
                              className="btn btnPrimary btnSm"
                              disabled={!meOk?.isFamilyAdmin || adminSavingId === String(reportsScope.entity?.id || '')}
                              onClick={() => {
                                const id = String(reportsScope.entity?.id || '')
                                if (!id) return
                                patchBudgetEntity(id, { participatesInReports: true })
                              }}
                              type="button"
                            >
                              Incluir en reportes
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <div className={`reportsStudioMain ${reportsTab === 'detalle' ? 'reportsStudioMainFixed' : 'reportsStudioMainScroll'}`}>
                        {reportsScope.entity && reportsScope.entity.participatesInReports === false ? (
                          <div
                            className="cardSub"
                            style={{
                              padding: 12,
                              borderColor: 'rgba(245, 158, 11, 0.35)',
                              background: 'rgba(245, 158, 11, 0.08)',
                            }}
                          >
                            <div className="subTitle">Destino excluido de reportes</div>
                            <div className="muted" style={{ marginTop: 6 }}>
                              Este destino está marcado como “no participa en reportes”. Inclúyelo para verlo aquí.
                            </div>
                            <div className="spacer8" />
                            <button
                              className="btn btnPrimary btnSm"
                              disabled={!meOk?.isFamilyAdmin || adminSavingId === String(reportsScope.entity?.id || '')}
                              onClick={() => {
                                const id = String(reportsScope.entity?.id || '')
                                if (!id) return
                                patchBudgetEntity(id, { participatesInReports: true })
                              }}
                              type="button"
                            >
                              Incluir en reportes
                            </button>
                          </div>
                        ) : null}
                        {reportsTab === 'detalle' ? (
                          <div className="reportsDetailGrid">
                            <div className="chartBox">
                              <div className="sectionRow" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div>
                                  <h3 className="chartTitle" style={{ margin: 0 }}>
                                    Presupuesto (según filtros)
                                  </h3>
                                  <div className="muted" style={{ marginTop: 6 }}>
                                    Presupuesto = límite configurado del destino/categoría. Gastado = transacciones filtradas (usuario/recibos/rango).
                                  </div>
                                </div>
                              </div>

                              <div className="spacer12" />

                              <div className="kpiStrip">
                                <div className="kpiCard">
                                  <div className="kpiTitle">Presupuesto</div>
                                  <div className="kpiValue">{formatMoney(reports.budgetTotal, currency)}</div>
                                  <div className="kpiDelta">Rango: {flt.label}</div>
                                </div>
                                <div className="kpiCard kpiWarn">
                                  <div className="kpiTitle">Gastado</div>
                                  <div className="kpiValue">{formatMoney(reports.spentThis, currency)}</div>
                                  <div className="kpiDelta">Progreso: {(reports.progress * 100).toFixed(1)}%</div>
                                </div>
                                <div className="kpiCard kpiSuccess">
                                  <div className="kpiTitle">Disponible</div>
                                  <div className="kpiValue">{formatMoney(reports.available, currency)}</div>
                                  <div className="kpiDelta">Transacciones: {reports.txCountThis}</div>
                                </div>
                                <div className="kpiCard kpiDanger">
                                  <div className="kpiTitle">Alertas</div>
                                  <div className="kpiValue">{reports.overspend}</div>
                                  <div className="kpiDelta">cuentas en rojo</div>
                                </div>
                              </div>

                              {reportsFocusedAllocation ? (
                                <>
                                  <div className="spacer12" />
                                  <div className="cardSub" style={{ padding: 12 }}>
                                    {(() => {
                                      const alloc = reportsFocusedAllocation as any
                                      const id = String(alloc?.id || '')
                                      const draft = allocationLimitDraft[id] ?? String(alloc?.monthlyLimit || '')
                                      const changed = draft.trim() !== String(alloc?.monthlyLimit || '')
                                      const label = `${String(alloc?.entity?.name || '—')} → ${String(alloc?.category?.name || '—')}`
                                      return (
                                        <>
                                          <div className="subTitle">Edición rápida: {label}</div>
                                          <div className="spacer8" />
                                          <div className="sectionRow" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                            <label style={{ minWidth: 240, flex: 1 }}>
                                              Monto mensual
                                              <span className="budgetAmountInputWrap">
                                                <span className="budgetAmountPrefix" aria-hidden="true">{currency === 'MXN' ? '$' : currency} </span>
                                                <input
                                                  className="input"
                                                  inputMode="decimal"
                                                  value={draft}
                                                  disabled={!meOk?.isFamilyAdmin || adminSavingId === id}
                                                  onChange={(ev) =>
                                                    setAllocationLimitDraft((prev) => ({
                                                      ...prev,
                                                      [id]: ev.target.value,
                                                    }))
                                                  }
                                                />
                                              </span>
                                            </label>
                                            <button
                                              className="btn btnPrimary btnSm"
                                              disabled={!meOk?.isFamilyAdmin || adminSavingId === id || !changed}
                                              onClick={() => patchBudgetAllocation(id, { monthlyLimit: draft.trim() })}
                                              type="button"
                                            >
                                              Guardar
                                            </button>
                                            <button
                                              className="btn btnGhost btnSm"
                                              onClick={() => {
                                                openBudgetModal(id)
                                                const search = String(reportsScope.entity?.name || reportsScope.category?.name || '').trim()
                                                if (search) setBudgetModalSearch(search)
                                              }}
                                              type="button"
                                            >
                                              Configuración completa
                                            </button>
                                          </div>
                                        </>
                                      )
                                    })()}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="spacer8" />
                                  <div className="muted">
                                    Tip: para editar aquí, selecciona un <b>destino</b> y una <b>categoría</b> concretos.
                                  </div>
                                </>
                              )}
                            </div>

                            <div className="chartBox reportsHistoryCard">
                              <div className="sectionRow" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div>
                                  <h3 className="chartTitle" style={{ margin: 0 }}>
                                    Historial
                                  </h3>
                                  <div className="muted" style={{ marginTop: 6 }}>
                                    Mostrando {reportsHistory.length} transacciones según filtros.
                                  </div>
                                </div>
                              </div>

                              <div className="spacer8" />

                              {reportsHistory.length ? (
                                <div className="reportsHistoryScroll">
                                  {(() => {
                                    const showEntity = fltEntityId === 'all'
                                    const showCategory = fltCategoryId === 'all'
                                    const showUser = fltMemberId === 'all'

                                    return (
                                      <table className="table tableSticky reportsHistoryTable">
                                        <thead>
                                          <tr>
                                            <th className="reportsColDate">Fecha</th>
                                            {showEntity ? <th className="reportsColEntity">Cuenta</th> : null}
                                            {showCategory ? <th className="reportsColCategory">Categoría</th> : null}
                                            {showUser ? <th className="reportsColUser">Persona</th> : null}
                                            <th className="reportsColConcept">Concepto</th>
                                            <th className="reportsColAmount" style={{ textAlign: 'right' }}>
                                              Monto
                                            </th>
                                            <th className="reportsColRegistro">Registro</th>
                                            <th className="reportsColReceipts" style={{ textAlign: 'right' }}>
                                              Recibos
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {reportsHistory.map((t: any) => {
                                            const receiptsCount = Array.isArray(t?.receipts) ? t.receipts.length : 0
                                            const onOpen = () => {
                                              setReportsOpen(false)
                                              openTx(String(t?.id || ''))
                                            }
                                            return (
                                              <tr
                                                key={String(t?.id || `${t?.date}-${t?.amount}`)}
                                                onClick={onOpen}
                                                style={{ cursor: 'pointer' }}
                                                title="Abrir transacción"
                                              >
                                                <td className="muted reportsColDate">{new Date(String(t?.date || '')).toLocaleDateString('es-MX')}</td>
                                                {showEntity ? (
                                                  <td className="muted reportsColEntity">
                                                    {entityTypeLabel(String(t?.allocation?.entity?.type || '') as any)}: {t?.allocation?.entity?.name || '—'}
                                                  </td>
                                                ) : null}
                                                {showCategory ? (
                                                  <td className="muted reportsColCategory">{t?.allocation?.category?.name || '—'}</td>
                                                ) : null}
                                                {showUser ? <td className="muted reportsColUser">{t?.user?.name || t?.user?.email || '—'}</td> : null}
                                                <td className="reportsColConcept" style={{ fontWeight: 900 }} title={String(t?.description || '')}>
                                                  {t?.description || '—'}
                                                </td>
                                                <td className="reportsColAmount" style={{ textAlign: 'right', fontWeight: 900 }}>
                                                  {formatMoney(Number(t?.amount || 0), currency)}
                                                </td>
                                                <td className="muted reportsColRegistro" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{t?.registrationCode || '—'}</td>
                                                <td className="muted reportsColReceipts" style={{ textAlign: 'right' }}>
                                                  {receiptsCount}
                                                </td>
                                              </tr>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    )
                                  })()}
                                </div>
                              ) : (
                                <div className="muted">No hay transacciones para estos filtros.</div>
                              )}
                            </div>
                          </div>
                        ) : null}

                        {reportsTab === 'resumen' ? (
                          <>
                            <div className="kpiStrip">
                              <div className="kpiCard">
                                <div className="kpiTitle">Presupuesto total (reportes)</div>
                                <div className="kpiValue">{formatMoney(reports.budgetTotal, currency)}</div>
                                <div className="kpiDelta">
                                  vs mes anterior: {reports.deltaPct >= 0 ? '+' : ''}
                                  {reports.deltaPct.toFixed(1)}%
                                </div>
                              </div>
                              <div className="kpiCard kpiWarn">
                                <div className="kpiTitle">Gastado (reportes)</div>
                                <div className="kpiValue">{formatMoney(reports.spentThis, currency)}</div>
                                <div className="kpiDelta">progreso: {(reports.progress * 100).toFixed(1)}%</div>
                              </div>
                              <div className="kpiCard kpiSuccess">
                                <div className="kpiTitle">Disponible (reportes)</div>
                                <div className="kpiValue">{formatMoney(reports.available, currency)}</div>
                                <div className="kpiDelta">estado: {reports.available >= 0 ? 'saludable' : 'en rojo'}</div>
                              </div>
                              <div className="kpiCard kpiDanger">
                                <div className="kpiTitle">Alertas (reportes)</div>
                                <div className="kpiValue">{reports.overspend}</div>
                                <div className="kpiDelta">sobregasto</div>
                              </div>
                            </div>

                            <div className="spacer16" />

                            <div className="analyticsRow">
                              <div className="chartBox">
                                <h3 className="chartTitle">Gasto mensual (últimos 6 meses)</h3>
                                <div className="bars">
                                  {reports.months.map((m) => (
                                    <div
                                      key={m.label}
                                      className="bar"
                                      style={{ height: `${Math.max(8, Math.round((m.value / reports.maxMonth) * 120))}px` }}
                                      title={`${m.label}: ${formatMoney(m.value, currency)}`}
                                    />
                                  ))}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginTop: 8 }}>
                                  {reports.months.map((m) => (
                                    <div key={m.label} className="barLabel">
                                      {m.label}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="chartBox">
                                <h3 className="chartTitle">Distribución por categorías (mes)</h3>
                                <div className="donutWrap">
                                  <div className="donut" style={{ background: reports.donutGradient }} />
                                  <div className="legend">
                                    {reports.dist.length ? (
                                      reports.dist.map((d, idx) => {
                                        const palette = ['#0F3D91', '#2F6FED', '#0BA95B', '#F59E0B', '#DC2626', '#64748b']
                                        const pct = ((d.value / (reports.dist.reduce((s, x) => s + x.value, 0) || 1)) * 100).toFixed(0)
                                        return (
                                          <div key={d.name} className="legendItem">
                                            <span className="legendDot" style={{ background: palette[idx % palette.length] }} />
                                            <span>{d.name}</span>
                                            <span className="muted">{pct}%</span>
                                          </div>
                                        )
                                      })
                                    ) : (
                                      <div className="muted">Sin datos aún.</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : null}

                        {reportsTab === 'consumo' ? (
                          <div className="chartBox">
                            <h3 className="chartTitle" style={{ margin: 0 }}>Reportes de consumo</h3>
                            <p className="muted" style={{ marginTop: 8 }}>
                              Basado en la <strong>extracción de datos del recibo (IA)</strong>: luz (kWh), agua (m³), productos con cantidad/unidad. El rango de fechas aplica a la fecha del comprobante.
                            </p>
                            <div className="spacer8" />
                            <button
                              type="button"
                              className="btn btnGhost btnSm"
                              disabled={consumptionSeeding}
                              onClick={() => loadConsumptionSeed()}
                              title="Crea 3 recibos de ejemplo (super, luz, agua) con extracciones para ver este reporte"
                            >
                              {consumptionSeeding ? 'Cargando…' : 'Cargar datos de consumo de ejemplo'}
                            </button>
                            <div className="spacer12" />
                            {consumptionLoading ? (
                              <p className="muted">Cargando consumo…</p>
                            ) : consumptionData ? (
                              <>
                                {(() => {
                                  const kwh = (consumptionData.utility || []).filter((u) => u.unit === 'kWh')
                                  const m3 = (consumptionData.utility || []).filter((u) => u.unit === 'm3')
                                  const sumKwh = kwh.reduce((a, u) => a + u.quantity, 0)
                                  const sumM3 = m3.reduce((a, u) => a + u.quantity, 0)
                                  return (sumKwh > 0 || sumM3 > 0) ? (
                                    <div className="consumoReportBlock" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                                      {sumKwh > 0 && (
                                        <div className="kpiCard" style={{ minWidth: 120 }}>
                                          <div className="kpiValue">{sumKwh.toFixed(1)}</div>
                                          <div className="kpiDelta">kWh (luz)</div>
                                        </div>
                                      )}
                                      {sumM3 > 0 && (
                                        <div className="kpiCard" style={{ minWidth: 120 }}>
                                          <div className="kpiValue">{sumM3.toFixed(2)}</div>
                                          <div className="kpiDelta">m³ (agua)</div>
                                        </div>
                                      )}
                                    </div>
                                  ) : null
                                })()}
                                {consumptionData.utility.length > 0 && (
                                  <div className="consumoReportBlock" style={{ marginBottom: 12 }}>
                                    <details className="consumoSectionDetails">
                                      <summary className="chartTitle" style={{ fontSize: 14, margin: 0, cursor: 'pointer' }}>Luz y agua por recibo ({consumptionData.utility.length})</summary>
                                      <div className="spacer8" />
                                      <div style={{ maxHeight: 220, overflow: 'auto' }}>
                                        <table className="table tableSm" style={{ width: '100%' }}>
                                          <thead>
                                            <tr>
                                              <th>Fecha</th>
                                              <th>Periodo</th>
                                              <th>Unidad</th>
                                              <th>Cantidad</th>
                                              <th>Comercio</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {consumptionData.utility.map((u, i) => (
                                              <tr key={`${u.receiptId}-${i}`}>
                                                <td>{u.receiptDate || '—'}</td>
                                                <td>{u.periodStart && u.periodEnd ? `${u.periodStart} – ${u.periodEnd}` : '—'}</td>
                                                <td>{u.unit}</td>
                                                <td>{u.quantity}</td>
                                                <td>{u.merchantName || '—'}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </details>
                                  </div>
                                )}
                                {((consumptionView === 'agrupado' && (consumptionData.productsGrouped?.length ?? 0) > 0) || (consumptionView === 'detalle' && consumptionData.products.length > 0)) && (
                                  <div className="consumoReportBlock" style={{ marginBottom: 12 }}>
                                    <details className="consumoSectionDetails">
                                      <summary className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, cursor: 'pointer', listStyle: 'none' }}>
                                        <span className="chartTitle" style={{ fontSize: 14, margin: 0 }}>
                                          {consumptionView === 'agrupado' ? 'Productos (agrupado)' : 'Productos (detalle)'} — {(consumptionView === 'agrupado' ? consumptionData.productsGrouped?.length : consumptionData.products.length) ?? 0} filas
                                        </span>
                                        <button
                                          type="button"
                                          className="btn btnGhost btnSm"
                                          onClick={(e) => { e.preventDefault(); setConsumptionView((v) => (v === 'agrupado' ? 'detalle' : 'agrupado')) }}
                                        >
                                          {consumptionView === 'agrupado' ? 'Ver detalle' : 'Ver agrupado'}
                                        </button>
                                      </summary>
                                      <p className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                                        {consumptionView === 'agrupado' ? 'Mismo producto de varios tickets sumado.' : 'Cada línea del ticket con cantidad/unidad.'}
                                      </p>
                                      <div className="spacer8" />
                                      <div style={{ maxHeight: 280, overflow: 'auto' }}>
                                        {consumptionView === 'agrupado' ? (
                                          <table className="table tableSm" style={{ width: '100%' }}>
                                            <thead>
                                              <tr>
                                                <th>Producto</th>
                                                <th>Unidad</th>
                                                <th>Cantidad total</th>
                                                <th>Veces</th>
                                                <th>Recibos</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {(consumptionData.productsGrouped || []).slice(0, 80).map((p, i) => (
                                                <tr key={`${p.displayName}-${p.unit}-${i}`}>
                                                  <td>{p.displayName}</td>
                                                  <td>{p.unit}</td>
                                                  <td>{p.totalQuantity}</td>
                                                  <td>{p.count}</td>
                                                  <td>{p.receiptCount}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        ) : (
                                          <table className="table tableSm" style={{ width: '100%' }}>
                                            <thead>
                                              <tr>
                                                <th>Producto</th>
                                                <th>Unidad</th>
                                                <th>Cantidad total</th>
                                                <th>Veces</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {consumptionData.products.slice(0, 50).map((p, i) => (
                                                <tr key={`${p.description}-${p.unit}-${i}`}>
                                                  <td>{p.description}</td>
                                                  <td>{p.unit}</td>
                                                  <td>{p.totalQuantity}</td>
                                                  <td>{p.count}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        )}
                                      </div>
                                      {((consumptionView === 'agrupado' && (consumptionData.productsGrouped?.length ?? 0) > 80) || (consumptionView === 'detalle' && consumptionData.products.length > 50)) && (
                                        <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                                          Mostrando {consumptionView === 'agrupado' ? 80 : 50} de {consumptionView === 'agrupado' ? consumptionData.productsGrouped?.length : consumptionData.products.length}. Scroll en la tabla para ver más.
                                        </p>
                                      )}
                                    </details>
                                  </div>
                                )}
                                {consumptionData.reposicion.length > 0 && (
                                  <div className="consumoReportBlock">
                                    <details className="consumoSectionDetails">
                                      <summary className="chartTitle" style={{ fontSize: 14, margin: 0, cursor: 'pointer' }}>Reposición — días entre compras ({consumptionData.reposicion.length})</summary>
                                      <p className="muted" style={{ marginTop: 4, fontSize: 12 }}>Productos en más de un recibo: intervalo entre compras.</p>
                                      <div className="spacer8" />
                                      <div style={{ maxHeight: 200, overflow: 'auto' }}>
                                        <table className="table tableSm" style={{ width: '100%' }}>
                                          <thead>
                                            <tr>
                                              <th>Producto</th>
                                              <th>Unidad</th>
                                              <th>Intervalos</th>
                                              <th>Promedio días</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {consumptionData.reposicion.slice(0, 30).map((r, i) => (
                                              <tr key={`${r.description}-${r.unit}-${i}`}>
                                                <td>{r.description}</td>
                                                <td>{r.unit}</td>
                                                <td>{r.betweenPurchasesDays.join(', ')}</td>
                                                <td>{r.avgDays}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </details>
                                  </div>
                                )}
                                {consumptionData.utility.length === 0 && consumptionData.products.length === 0 && (consumptionData.productsGrouped?.length ?? 0) === 0 && consumptionData.reposicion.length === 0 && (
                                  <div>
                                    <p className="muted">No hay datos de consumo en el rango seleccionado. Sube recibos de luz, agua o tickets con cantidades (ej. 500 g, 1 L) para que la IA los extraiga.</p>
                                    <p className="muted" style={{ marginTop: 8 }}>O pulsa <strong>&quot;Cargar datos de consumo de ejemplo&quot;</strong> arriba para generar datos ficticios (super, luz, agua).</p>
                                  </div>
                                )}
                              </>
                            ) : null}
                          </div>
                        ) : reportsTab === 'tablas' ? (
                          <div className="chartBox">
                            <div className="sectionRow" style={{ justifyContent: 'space-between' }}>
                              <h3 className="chartTitle" style={{ margin: 0 }}>
                                Tablas
                              </h3>
                              <div className="tabRow" role="tablist" aria-label="Tabs de tablas de reportes">
                                <button
                                  className={`tabBtn ${reportsTableTab === 'categorias' ? 'tabBtnActive' : ''}`}
                                  onClick={() => setReportsTableTab('categorias')}
                                  type="button"
                                  role="tab"
                                  aria-selected={reportsTableTab === 'categorias'}
                                >
                                  Categorías
                                </button>
                                <button
                                  className={`tabBtn ${reportsTableTab === 'objetos' ? 'tabBtnActive' : ''}`}
                                  onClick={() => setReportsTableTab('objetos')}
                                  type="button"
                                  role="tab"
                                  aria-selected={reportsTableTab === 'objetos'}
                                >
                                  Destinos
                                </button>
                                <button
                                  className={`tabBtn ${reportsTableTab === 'usuarios' ? 'tabBtnActive' : ''}`}
                                  onClick={() => setReportsTableTab('usuarios')}
                                  type="button"
                                  role="tab"
                                  aria-selected={reportsTableTab === 'usuarios'}
                                >
                                  Personas
                                </button>
                              </div>
                            </div>
                            <div className="spacer8" />

                            {reportsTableTab === 'categorias' ? (
                              reports.byCategory.length ? (
                                <table className="table">
                                  <thead>
                                    <tr>
                                      <th>Categoría</th>
                                      <th>Presup.</th>
                                      <th>Gastado</th>
                                      <th>Disp.</th>
                                      <th>Progreso</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {reports.byCategory.map((r: any) => {
                                      const pct = Math.min(1, Math.max(0, r.progress))
                                      return (
                                        <tr key={r.id}>
                                          <td>{r.name}</td>
                                          <td>{formatMoney(r.budget, currency)}</td>
                                          <td>{formatMoney(r.spent, currency)}</td>
                                          <td style={{ fontWeight: 900 }}>{formatMoney(r.available, currency)}</td>
                                          <td className="muted">{(pct * 100).toFixed(0)}%</td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              ) : (
                                <div className="muted">Sin datos aún.</div>
                              )
                            ) : reportsTableTab === 'objetos' ? (
                              reports.byObject.length ? (
                                <table className="table">
                                  <thead>
                                    <tr>
                                      <th>Destino</th>
                                      <th>Presup.</th>
                                      <th>Gastado</th>
                                      <th>Disp.</th>
                                      <th>Progreso</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {reports.byObject.map((r: any) => {
                                      const pct = Math.min(1, Math.max(0, r.progress))
                                      return (
                                        <tr key={r.id}>
                                          <td>
                                            <span className="muted">{entityTypeLabel(r.type)}:</span> {r.name}
                                          </td>
                                          <td>{formatMoney(r.budget, currency)}</td>
                                          <td>{formatMoney(r.spent, currency)}</td>
                                          <td style={{ fontWeight: 900 }}>{formatMoney(r.available, currency)}</td>
                                          <td className="muted">{(pct * 100).toFixed(0)}%</td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              ) : (
                                <div className="muted">Sin datos aún.</div>
                              )
                            ) : reports.byMember.length ? (
                              <table className="table">
                                <thead>
                                  <tr>
                                    <th>Persona</th>
                                    <th>Transacciones</th>
                                    <th>Gastado</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {reports.byMember.map((m: any) => (
                                    <tr key={m.id}>
                                      <td style={{ fontWeight: 900 }}>{m.name}</td>
                                      <td className="muted">{m.count}</td>
                                      <td style={{ fontWeight: 900 }}>{formatMoney(m.spent, currency)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div className="muted">Sin datos aún.</div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>,
                document.body
              )}

              {view === 'presupuesto' ? (
                <>
                  {meOk ? (
                    <div className="budgetStudioPageRoot" role="region" aria-label="Presupuesto">
                      <div className="modalPanel budgetStudioPanel budgetStudioPanelInline">
                        <div className="budgetStudioTopBar">
                          <button className="btn btnGhost btnSm modalMenuBtn" type="button" onClick={() => setMobileNavOpen(true)} title="Abrir menú">
                            Menú
                          </button>
                          {!entityOwnersOpen ? (
                            <button className="btn btnGhost btnSm modalClose" onClick={() => go('dashboard')} type="button" aria-label="Volver al inicio">
                              Inicio
                            </button>
                          ) : null}
                        </div>
                        <div className="modalToolbar budgetStudioToolbar" id="presupuesto-b1-config">
                          <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <div style={{ maxWidth: 560 }}>
                              <p className="muted" style={{ margin: '0 0 4px 0', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 800 }}>
                                Bloque 1 · Configuración
                              </p>
                              <h2 className="cardTitle" style={{ margin: 0 }}>
                                Presupuesto familiar
                              </h2>
                              <p className="muted" style={{ margin: '6px 0 0 0', lineHeight: 1.45 }}>
                                Flujo único: <b>Destino</b> → <b>Categoría</b> → <b>Presupuesto</b> (aquí defines el tope y <b>creas</b> la cuenta). Más abajo, <b>Cuentas</b> sirve solo para ver y ajustar límites ya creados.
                              </p>
                              <p className="muted" style={{ margin: '10px 0 0 0', fontSize: 13, lineHeight: 1.45, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                                <span>Orden sugerido: integrantes y destinos (y Mis cosas) desde</span>
                                <button type="button" className="btn btnGhost btnSm" onClick={() => go('configuracion')}>
                                  Configuración
                                </button>
                                <span className="muted">; aquí solo montos y cuentas.</span>
                              </p>
                              <details className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>¿Qué es qué?</summary>
                                <ul style={{ margin: '8px 0 0 0', paddingLeft: 18 }}>
                                  <li><b>Destinos:</b> a quién o a qué asignas dinero (personas, casa, auto…).</li>
                                  <li><b>Categorías:</b> tipos de gasto (supermercado, luz, gasolina…).</li>
                                  <li><b>Asignar presupuesto:</b> destino + categoría + monto mensual = nueva <b>cuenta</b> (único lugar donde se crea vía el formulario).</li>
                                  <li><b>Cuentas (bloque 2):</b> listado de cuentas ya existentes; edita límites, no crees nuevas aquí.</li>
                                </ul>
                                <div className="budgetExampleInstructivo">
                                  <div className="budgetExampleTitle">Ejemplo</div>
                                  <div className="budgetExampleFlow">
                                    <div className="budgetExampleBlock">
                                      <div className="budgetExampleBlockLabel">Destino</div>
                                      <div className="budgetExampleBlockValue">Diego (Persona)</div>
                                      <div className="budgetExampleArrow" aria-hidden="true">↓</div>
                                      <div className="budgetExampleDesc">A qué o a quién asignas (persona, casa, auto…).</div>
                                    </div>
                                    <div className="budgetExampleArrowRight" aria-hidden="true">→</div>
                                    <div className="budgetExampleBlock">
                                      <div className="budgetExampleBlockLabel">Categoría</div>
                                      <div className="budgetExampleBlockValue">Supermercado</div>
                                      <div className="budgetExampleArrow" aria-hidden="true">↓</div>
                                      <div className="budgetExampleDesc">Tipo de gasto (super, luz, gasolina…).</div>
                                    </div>
                                    <div className="budgetExampleArrowRight" aria-hidden="true">→</div>
                                    <div className="budgetExampleBlock">
                                    <div className="budgetExampleBlockLabel">Presupuesto</div>
                                    <div className="budgetExampleBlockValue">{formatMoney(5000, currency)}/mes</div>
                                    <div className="budgetExampleArrow" aria-hidden="true">↓</div>
                                    <div className="budgetExampleDesc">Tope mensual (en la pestaña Presupuesto).</div>
                                    </div>
                                    <div className="budgetExampleArrowRight" aria-hidden="true">→</div>
                                    <div className="budgetExampleBlock budgetExampleBlockResult">
                                      <div className="budgetExampleBlockLabel">Cuenta</div>
                                      <div className="budgetExampleBlockValue">Diego + Super → {formatMoney(5000, currency)}</div>
                                      <div className="budgetExampleArrow" aria-hidden="true">↓</div>
                                      <div className="budgetExampleDesc">Donde ves gastado y disponible.</div>
                                    </div>
                                  </div>
                                  <div className="budgetExampleShare">
                                    <a href="/presupuesto-instructivo" target="_blank" rel="noopener noreferrer" className="budgetExampleShareLink">
                                      Compartir instructivo (enlace para WhatsApp)
                                    </a>
                                  </div>
                                </div>
                              </details>
                            </div>
                          </div>

                          <div className="spacer8" />

                          <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <div className="budgetTabsByFrequency" role="tablist" aria-label="Pasos de configuración">
                              <div className="tabRow tabRowConfig" role="group" aria-label="Destino categoría y presupuesto">
                                <button
                                  className={`tabBtn ${budgetModalTab === 'objetos' ? 'tabBtnActive' : ''}`}
                                  onClick={() => setBudgetModalTab('objetos')}
                                  type="button"
                                  role="tab"
                                  aria-selected={budgetModalTab === 'objetos'}
                                >
                                  Destinos
                                </button>
                                <button
                                  className={`tabBtn ${budgetModalTab === 'categorias' ? 'tabBtnActive' : ''}`}
                                  onClick={() => setBudgetModalTab('categorias')}
                                  type="button"
                                  role="tab"
                                  aria-selected={budgetModalTab === 'categorias'}
                                >
                                  Categorías
                                </button>
                                <button
                                  className={`tabBtn ${budgetModalTab === 'montos' ? 'tabBtnActive' : ''}`}
                                  onClick={() => setBudgetModalTab('montos')}
                                  type="button"
                                  role="tab"
                                  aria-selected={budgetModalTab === 'montos'}
                                >
                                  Presupuesto
                                </button>
                              </div>
                            </div>

                            <div className="sectionRow" style={{ flexWrap: 'wrap' }}>
                              <span className="pill">Año: {budgetConcentrado.year}</span>
                              <span className={`pill ${setupChecklist.hasObject ? 'pillOk' : 'pillWarn'}`}>Destinos: {setupChecklist.objectCount}</span>
                              <span className={`pill ${setupChecklist.hasCategory ? 'pillOk' : 'pillWarn'}`}>Categorías: {setupChecklist.categoryCount}</span>
                              <span className={`pill ${setupChecklist.hasAllocation ? 'pillOk' : 'pillWarn'}`}>Cuentas: {setupChecklist.allocationCount}</span>
                            </div>
                          </div>
                        </div>

                        <div className="budgetStudioBody">
                          {!meOk.isFamilyAdmin ? (
                            <div className="sectionRow" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                              <div className="muted">
                                No eres <b>Admin</b>. Puedes ver el presupuesto y crear o ajustar límites en tus destinos (los que te asignaron como responsable en Destinos → Responsables). Pide al Admin que te cambie el rol en “Usuarios”.
                              </div>
                              <label className="sectionRow" style={{ alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={soloMisDestinos}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                    setSoloMisDestinos(next)
                                    refreshBudget({ mine: next, silent: true })
                                  }}
                                />
                                <span style={{ fontSize: 13 }}>Solo mis destinos</span>
                              </label>
                              {!suggestionOpen ? (
                                <button type="button" className="btn btnGhost btnSm" onClick={() => setSuggestionOpen(true)}>
                                  Sugerir ajuste al presupuesto
                                </button>
                              ) : (
                                <div className="sectionRow" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8, width: '100%', maxWidth: 360 }}>
                                  <select className="input inputSm" value={suggestionType} onChange={(e) => setSuggestionType(e.target.value)}>
                                    <option value="SUBDIVIDE_CATEGORY">Subdividir categoría</option>
                                    <option value="CHANGE_LIMIT">Cambiar límite</option>
                                    <option value="NEW_CATEGORY">Nueva categoría</option>
                                    <option value="OTHER">Otro</option>
                                  </select>
                                  <textarea className="input" rows={2} placeholder="Describe tu sugerencia…" value={suggestionText} onChange={(e) => setSuggestionText(e.target.value)} style={{ width: '100%' }} />
                                  <div className="sectionRow" style={{ gap: 8 }}>
                                    <button type="button" className="btn btnPrimary btnSm" onClick={sendBudgetSuggestion} disabled={suggestionSending || !suggestionText.trim()}>
                                      {suggestionSending ? 'Enviando…' : 'Enviar'}
                                    </button>
                                    <button type="button" className="btn btnGhost btnSm" onClick={() => { setSuggestionOpen(false); setSuggestionText('') }}>
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : null}
                          {meOk?.isFamilyAdmin ? (
                            <div className="sectionRow" style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                              <button type="button" className="btn btnGhost btnSm" onClick={() => { setSuggestionsOpen(!suggestionsOpen); if (!suggestionsOpen) loadSuggestions() }}>
                                {suggestionsOpen ? 'Ocultar sugerencias' : 'Ver sugerencias'}
                              </button>
                              {suggestionsOpen && Array.isArray(suggestionsList) ? (
                                <div style={{ width: '100%', marginTop: 8 }}>
                                  {suggestionsList.length === 0 ? (
                                    <p className="muted" style={{ fontSize: 13 }}>No hay sugerencias.</p>
                                  ) : (
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                      {suggestionsList.map((s: any) => (
                                        <li key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                          <span style={{ fontSize: 13 }}><strong>{s.type}</strong>: {typeof s.payload?.text === 'string' ? s.payload.text : JSON.stringify(s.payload)}</span>
                                          {s.status === 'PENDING' ? (
                                            <div className="sectionRow" style={{ gap: 6 }}>
                                              <button type="button" className="btn btnSm" style={{ background: 'var(--success)', color: '#fff' }} onClick={() => resolveSuggestion(s.id, 'APPROVED')}>Aprobar</button>
                                              <button type="button" className="btn btnDanger btnSm" onClick={() => resolveSuggestion(s.id, 'REJECTED')}>Rechazar</button>
                                            </div>
                                          ) : (
                                            <span className="muted" style={{ fontSize: 12 }}>{s.status}</span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                        {entityOwnersOpen ? (
                          <div className="modalOverlay" onClick={closeEntityOwnersModal} style={{ zIndex: 80 }}>
                            <div className="modalPanel" onClick={(e) => e.stopPropagation()} style={{ width: 'min(860px, 100%)' }}>
                              <button
                                className="btn btnGhost btnSm modalClose"
                                onClick={closeEntityOwnersModal}
                                type="button"
                                aria-label="Cerrar"
                                disabled={entityOwnersSaving}
                              >
                                Cerrar
                              </button>
                              <div className="modalToolbar">
                                <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                  <div>
                                    <h2 className="cardTitle" style={{ margin: 0 }}>
                                      Responsables
                                    </h2>
                                    <div className="muted">
                                      Asigna dueños/responsables para comparar <b>Esperado vs Real</b> sin duplicar cuentas.
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="spacer12" />

                              {(() => {
                                const ent = entityItems.find((x: any) => String(x?.id || '') === String(entityOwnersEntityId || ''))
                                if (!ent) return <div className="muted">Destino no encontrado.</div>

                                const pctSum =
                                  entityOwnersMode === 'percent'
                                    ? entityOwnersSelected.reduce((s, uid) => s + (Number(entityOwnersPctDraft[String(uid)] || 0) || 0), 0)
                                    : 100

                                const canSave =
                                  !!meOk?.isFamilyAdmin &&
                                  !entityOwnersSaving &&
                                  (entityOwnersMode !== 'percent' || entityOwnersSelected.length === 0 || pctSum === 100)

                                const selectedSet = new Set(entityOwnersSelected.map((x) => String(x)))

                                return (
                                  <>
                                    <div className="cardSub" style={{ padding: 12 }}>
                                      <div style={{ fontWeight: 950 }}>{String(ent?.name || '—')}</div>
                                      <div className="muted" style={{ marginTop: 4 }}>
                                        {entityTypeLabel(ent?.type)}
                                      </div>
                                    </div>

                                    <div className="spacer12" />

                                    <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                      <div>
                                        <div className="muted" style={{ fontWeight: 900 }}>
                                          Modo
                                        </div>
                                        <div className="sectionRow" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                                          <label className="muted" style={{ fontWeight: 900 }}>
                                            <input
                                              type="radio"
                                              checked={entityOwnersMode === 'equal'}
                                              onChange={() => setEntityOwnersMode('equal')}
                                              disabled={entityOwnersSaving}
                                              style={{ marginRight: 8 }}
                                            />
                                            Reparto igual
                                          </label>
                                          <label className="muted" style={{ fontWeight: 900 }}>
                                            <input
                                              type="radio"
                                              checked={entityOwnersMode === 'percent'}
                                              onChange={() => {
                                                setEntityOwnersMode('percent')
                                                setEntityOwnersPctDraft(autoPctSplit(entityOwnersSelected))
                                              }}
                                              disabled={entityOwnersSaving}
                                              style={{ marginRight: 8 }}
                                            />
                                            Porcentajes (suma 100)
                                          </label>
                                        </div>

                                        {entityOwnersMode === 'percent' && entityOwnersSelected.length ? (
                                          <div className="sectionRow" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                                            <span className={`pill ${pctSum === 100 ? 'pillOk' : 'pillWarn'}`}>Suma: {pctSum}%</span>
                                            <button
                                              className="btn btnGhost btnSm"
                                              type="button"
                                              onClick={() => setEntityOwnersPctDraft(autoPctSplit(entityOwnersSelected))}
                                              disabled={entityOwnersSaving}
                                              title="Reparte en partes iguales"
                                            >
                                              Repartir igual
                                            </button>
                                          </div>
                                        ) : null}
                                      </div>

                                      <div className="sectionRow" style={{ flexWrap: 'wrap' }}>
                                        <button className="btn btnGhost btnSm" type="button" onClick={closeEntityOwnersModal} disabled={entityOwnersSaving}>
                                          Cancelar
                                        </button>
                                        <button className="btn btnPrimary btnSm" type="button" onClick={saveEntityOwners} disabled={!canSave}>
                                          {entityOwnersSaving ? 'Guardando…' : 'Guardar'}
                                        </button>
                                      </div>
                                    </div>

                                    <div className="spacer12" />

                                    <div className="cardSub" style={{ padding: 12 }}>
                                      <div className="subTitle">Selecciona responsables</div>
                                      <div className="spacer8" />
                                      <div className="peopleList" style={{ maxHeight: 360 }}>
                                        {memberItems.map((m: any) => {
                                          const uid = String(m?.id || '')
                                          const checked = selectedSet.has(uid)
                                          const label = displayPersonName(m?.name || m?.email || 'Integrante')
                                          return (
                                            <div key={uid} className={`peopleListItem ${checked ? 'peopleListItemActive' : ''}`} style={{ alignItems: 'center' }}>
                                              <div className="sectionRow" style={{ justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                                <label className="sectionRow" style={{ gap: 10, cursor: 'pointer', alignItems: 'center' }}>
                                                  <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    disabled={entityOwnersSaving}
                                                    onChange={(ev) => {
                                                      const on = ev.target.checked
                                                      setEntityOwnersSelected((prev) => {
                                                        const set = new Set(prev.map((x) => String(x)))
                                                        if (on) set.add(uid)
                                                        else set.delete(uid)
                                                        const ordered = memberItems
                                                          .map((mm: any) => String(mm?.id || ''))
                                                          .filter((id) => id && set.has(id))
                                                        if (entityOwnersMode === 'percent') setEntityOwnersPctDraft(autoPctSplit(ordered))
                                                        return ordered
                                                      })
                                                    }}
                                                    style={{ marginRight: 2 }}
                                                  />
                                                  <div>
                                                    <div className="peopleListName">{label}</div>
                                                    <div className="peopleListSub">{String(m?.email || '')}</div>
                                                  </div>
                                                </label>

                                                {entityOwnersMode === 'percent' && checked ? (
                                                  <label className="sectionRow" style={{ gap: 6 }}>
                                                    <span className="muted">%</span>
                                                    <input
                                                      className="input inputSm"
                                                      style={{ width: 90, textAlign: 'right' }}
                                                      inputMode="numeric"
                                                      disabled={entityOwnersSaving}
                                                      value={entityOwnersPctDraft[uid] ?? ''}
                                                      onChange={(ev) =>
                                                        setEntityOwnersPctDraft((prev) => ({
                                                          ...prev,
                                                          [uid]: ev.target.value,
                                                        }))
                                                      }
                                                    />
                                                  </label>
                                                ) : null}
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                      <div className="spacer8" />
                                      <div className="muted">
                                        Se usa para “Esperado vs Real”. Si no defines responsables, igual podrás ver “A quién” (real) por gasto.
                                      </div>
                                    </div>
                                  </>
                                )
                              })()}
                            </div>
                          </div>
                        ) : null}


                        {budgetModalTab === 'objetos' ? (
                          <div className="chartBox">
                            <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                              <div>
                                <h3 className="chartTitle" style={{ margin: 0 }}>
                                  Destinos
                                </h3>
                                <div className="muted" style={{ marginTop: 6 }}>
                                  <strong>Para qué sirve:</strong> definir a quién o a qué asignas dinero (persona, casa, mascota, vehículo…). Un bien (bici, auto) no tiene “dueño” en el nombre: usa la columna <b>Responsables</b> o el botón homónimo. Luego <b>Categorías</b> y en <b>Presupuesto</b> el tope por destino + categoría.
                                </div>
                              </div>
                              <p className="muted" style={{ margin: 0, maxWidth: 420, fontSize: 13 }}>
                                Los destinos se gestionan aquí; no necesitas otra pantalla.
                              </p>
                            </div>

                            <div className="spacer12" />

                            <div className="cardSub">
                              <div className="subTitle">Destinos existentes ({entityItems.length})</div>
                              <div className="muted" style={{ marginTop: 4, marginBottom: 8 }}>
                                Todos los destinos de la familia. Para crear uno nuevo, usa el formulario de abajo.
                              </div>
                              {entityItems.length ? (
                              <div className="budgetListScroll">
                                <table className="table">
                                  <thead>
                                    <tr>
                                      <th>Nombre</th>
                                      <th>Tipo</th>
                                      <th className="budgetDestOwnersCol">Responsables</th>
                                      <th>Presupuesto</th>
                                      <th>Reportes</th>
                                      <th>Activo</th>
                                      <th>Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {entityItems.slice(0, 120).map((e: any) => {
                                      const draft = entityNameDraft[e.id] ?? String(e.name || '')
                                      const changed = draft.trim() !== String(e.name || '')
                                      const avatarSrc = String(e?.imageSignedUrl || e?.imageUrl || '')
                                      return (
                                        <tr key={e.id}>
                                          <td style={{ minWidth: 280 }}>
                                            <div className="sectionRow" style={{ flexWrap: 'nowrap', gap: 10 }}>
                                              <div
                                                className="peopleAvatarSm"
                                                aria-hidden="true"
                                                style={avatarSrc ? { overflow: 'hidden', padding: 0, background: '#fff' } : undefined}
                                              >
                                                {avatarSrc ? (
                                                  // eslint-disable-next-line @next/next/no-img-element
                                                  <img
                                                    src={avatarSrc}
                                                    alt=""
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                  />
                                                ) : (
                                                  initialsFromName(draft || e.name)
                                                )}
                                              </div>
                                              <input
                                                className="input"
                                                value={draft}
                                                style={{ flex: 1, minWidth: 160 }}
                                                disabled={!meOk.isFamilyAdmin || adminSavingId === e.id}
                                                onChange={(ev) =>
                                                  setEntityNameDraft((prev) => ({
                                                    ...prev,
                                                    [e.id]: ev.target.value,
                                                  }))
                                                }
                                              />
                                            </div>
                                            <input
                                              id={`entityImg-${String(e.id)}`}
                                              type="file"
                                              accept="image/*"
                                              style={{ display: 'none' }}
                                              onChange={(ev) => {
                                                const f = (ev.target as any)?.files?.[0] as File | undefined
                                                try {
                                                  ;(ev.target as any).value = ''
                                                } catch {
                                                  // ignore
                                                }
                                                if (!f) return
                                                uploadBudgetEntityImage(String(e.id), f)
                                              }}
                                            />
                                          </td>
                                          <td className="muted">{e.customType?.name || entityTypeLabel(e.type)}</td>
                                          <td className="budgetDestOwnersCell muted">
                                            {String(e?.type || '') === 'PERSON' ? (
                                              <span title="La persona es el destino; no aplica «dueño»">—</span>
                                            ) : (() => {
                                              const { text } = entityOwnerNamesPreview(e, 3)
                                              if (text) {
                                                return <span title="Responsables / dueños del bien (Esperado vs real)">{text}</span>
                                              }
                                              if (meOk.isFamilyAdmin) {
                                                return (
                                                  <button
                                                    type="button"
                                                    className="budgetDestOwnersMissing"
                                                    onClick={() => openEntityOwnersModal(String(e.id))}
                                                    title="Asigna al menos un responsable"
                                                  >
                                                    Sin responsables
                                                  </button>
                                                )
                                              }
                                              return (
                                                <span className="muted" title="Pide al administrador que asigne responsables en este destino">
                                                  Sin responsables
                                                </span>
                                              )
                                            })()}
                                          </td>
                                          <td className="muted">
                                            <input
                                              type="checkbox"
                                              checked={!!e.participatesInBudget}
                                              disabled={!meOk.isFamilyAdmin || adminSavingId === e.id}
                                              onChange={(ev) => patchBudgetEntity(e.id, { participatesInBudget: ev.target.checked })}
                                            />
                                          </td>
                                          <td className="muted">
                                            <input
                                              type="checkbox"
                                              checked={!!e.participatesInReports}
                                              disabled={!meOk.isFamilyAdmin || adminSavingId === e.id}
                                              onChange={(ev) => patchBudgetEntity(e.id, { participatesInReports: ev.target.checked })}
                                            />
                                          </td>
                                          <td className="muted">
                                            <input
                                              type="checkbox"
                                              checked={!!e.isActive}
                                              disabled={!meOk.isFamilyAdmin || adminSavingId === e.id}
                                              onChange={(ev) => patchBudgetEntity(e.id, { isActive: ev.target.checked })}
                                            />
                                          </td>
                                          <td>
                                            <div className="sectionRow">
                                              <button
                                                className="btn btnGhost btnSm"
                                                disabled={!meOk.isFamilyAdmin || adminSavingId === e.id || !changed}
                                                onClick={() => patchBudgetEntity(e.id, { name: draft.trim() })}
                                                type="button"
                                              >
                                                Guardar
                                              </button>
                                              {(meOk?.isFamilyAdmin || (Array.isArray((e as any)?.owners) && (e as any).owners.some((o: any) => String(o?.userId || o?.user?.id) === meOk?.user?.id))) ? (
                                                <>
                                              <button
                                                className="btn btnGhost btnSm"
                                                disabled={adminSavingId === e.id || entityImageUploadingId === e.id}
                                                onClick={() => {
                                                  try {
                                                    const el = document.getElementById(`entityImg-${String(e.id)}`) as any
                                                    el?.click?.()
                                                  } catch {
                                                    // ignore
                                                  }
                                                }}
                                                type="button"
                                              >
                                                {entityImageUploadingId === e.id ? 'Subiendo…' : e?.imageUrl ? 'Cambiar foto' : 'Subir foto'}
                                              </button>
                                              {e?.imageUrl ? (
                                                <button
                                                  className="btn btnGhost btnSm"
                                                  disabled={adminSavingId === e.id || entityImageUploadingId === e.id}
                                                  onClick={() => patchBudgetEntity(e.id, { imageUrl: null })}
                                                  type="button"
                                                >
                                                  Quitar foto
                                                </button>
                                              ) : null}
                                                </>
                                              ) : null}
                                              {String(e?.type || '') !== 'PERSON' ? (
                                                <button
                                                  className="btn btnGhost btnSm"
                                                  disabled={!meOk.isFamilyAdmin || adminSavingId === e.id}
                                                  onClick={() => openEntityOwnersModal(String(e.id))}
                                                  type="button"
                                                  title="Asigna dueños/responsables para Esperado vs Real"
                                                >
                                                  Responsables
                                                  {Array.isArray((e as any)?.owners) && (e as any).owners.length ? ` (${(e as any).owners.length})` : ''}
                                                </button>
                                              ) : null}
                                              <button
                                                className="btn btnDanger btnSm"
                                                disabled={!meOk.isFamilyAdmin || adminSavingId === e.id}
                                                onClick={() => deleteBudgetEntity(e.id)}
                                                type="button"
                                              >
                                                Eliminar
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="muted">Aún no hay destinos.</div>
                            )}
                            </div>

                            <div className="spacer12" />

                            <div className="cardSub">
                              <div className="subTitle">Agregar destino</div>
                              <div className="spacer8" />
                              <div className="grid grid2">
                                <label>
                                  Tipo
                                  <select
                                    className="select"
                                    value={beCustomTypeId ? `custom:${beCustomTypeId}` : beType}
                                    onChange={(e) => {
                                      const v = e.target.value
                                      if (v.startsWith('custom:')) {
                                        setBeType('OTHER')
                                        setBeCustomTypeId(v.slice(7))
                                        setBeOwnerUserId('')
                                      } else {
                                        setBeType(v as EntityType)
                                        setBeCustomTypeId(null)
                                        if (v !== 'VEHICLE' && v !== 'PET') setBeOwnerUserId('')
                                      }
                                    }}
                                    disabled={!meOk.isFamilyAdmin || loading}
                                  >
                                    <option value="PERSON">Persona</option>
                                    <option value="HOUSE">Casa</option>
                                    <option value="PET">Mascota</option>
                                    <option value="VEHICLE">Vehículo</option>
                                    <option value="PROJECT">Proyecto</option>
                                    <option value="FUND">Fondo</option>
                                    <option value="GROUP">Grupo</option>
                                    <option value="OTHER">Otro</option>
                                    {customEntityTypes.length > 0 ? (
                                      <>
                                        <option disabled>—</option>
                                        {customEntityTypes.map((t) => (
                                          <option key={t.id} value={`custom:${t.id}`}>
                                            {t.name}
                                          </option>
                                        ))}
                                      </>
                                    ) : null}
                                  </select>
                                  {beType === 'OTHER' && !beCustomTypeId ? (
                                    <p className="muted" style={{ fontSize: 11, marginTop: 6, marginBottom: 0 }}>
                                      <strong>Otro</strong> es la excepción: escribe en <strong>Nombre</strong> el detalle o crea un tipo abajo.
                                    </p>
                                  ) : null}
                                  {meOk.isFamilyAdmin ? (
                                    <div style={{ marginTop: 8 }}>
                                      {!customTypeCreateOpen ? (
                                        <button type="button" className="btn btnGhost btnSm" onClick={() => setCustomTypeCreateOpen(true)}>
                                          + Crear tipo
                                        </button>
                                      ) : (
                                        <div className="sectionRow" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                                          <input
                                            className="input"
                                            placeholder="Nombre del tipo (ej. Electrodoméstico)"
                                            value={customTypeNewName}
                                            onChange={(e) => setCustomTypeNewName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), createCustomEntityType())}
                                            style={{ maxWidth: 220 }}
                                          />
                                          <button type="button" className="btn btnPrimary btnSm" onClick={createCustomEntityType} disabled={!customTypeNewName.trim() || customTypeCreating}>
                                            {customTypeCreating ? 'Creando…' : 'Crear tipo'}
                                          </button>
                                          <button type="button" className="btn btnGhost btnSm" onClick={() => { setCustomTypeCreateOpen(false); setCustomTypeNewName(''); setMessage(''); }}>
                                            Cancelar
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </label>
                                <label>
                                  Nombre
                                  <input
                                    className="input"
                                    value={beName}
                                    onChange={(e) => setBeName(e.target.value)}
                                    disabled={!meOk.isFamilyAdmin || loading}
                                    placeholder={beType === 'OTHER' ? 'Ej. Electrodoméstico, Negocio, ...' : 'Ej. Sofía / Casa / Moto familiar'}
                                  />
                                </label>
                              </div>
                              {entityTypeNeedsOwnerForCreate(beCustomTypeId ? 'OTHER' : beType) && !beCustomTypeId ? (
                                <div className="cardSub budgetOwnerPuzzle" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                                  <p className="muted" style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.45 }}>
                                    <strong>Dueño (integrante)</strong> — obligatorio: un vehículo o mascota encaja en el presupuesto cuando ya sabes de quién es (como un rompecabezas).
                                  </p>
                                  <label>
                                    ¿De quién es?
                                    <select
                                      className="select"
                                      value={beOwnerUserId}
                                      onChange={(e) => setBeOwnerUserId(e.target.value)}
                                      disabled={!meOk.isFamilyAdmin || loading}
                                      aria-required
                                    >
                                      <option value="">Selecciona un integrante…</option>
                                      {memberItems.map((m: any) => (
                                        <option key={String(m.id)} value={String(m.id)}>
                                          {displayPersonName(m.name || m.email || 'Integrante')}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              ) : null}
                              <div className="spacer8" />
                              <div className="sectionRow" style={{ flexWrap: 'wrap' }}>
                                <label className="muted" style={{ fontWeight: 900 }}>
                                  <input type="checkbox" checked={beInBudget} onChange={(e) => setBeInBudget(e.target.checked)} disabled={!meOk.isFamilyAdmin || loading} style={{ marginRight: 8 }} />
                                  Participa en presupuesto
                                </label>
                                <label className="muted" style={{ fontWeight: 900 }}>
                                  <input type="checkbox" checked={beInReports} onChange={(e) => setBeInReports(e.target.checked)} disabled={!meOk.isFamilyAdmin || loading} style={{ marginRight: 8 }} />
                                  Participa en reportes
                                </label>
                                <button
                                  className="btn btnPrimary btnSm"
                                  onClick={createEntity}
                                  disabled={
                                    !meOk.isFamilyAdmin ||
                                    loading ||
                                    (entityTypeNeedsOwnerForCreate(beCustomTypeId ? 'OTHER' : beType) &&
                                      !beCustomTypeId &&
                                      !beOwnerUserId.trim())
                                  }
                                  type="button"
                                >
                                  Crear destino
                                </button>
                              </div>
                            </div>

                            <div className="spacer12" />

                            <div className="cardSub">
                              <div className="subTitle">Asistente: Auto personal</div>
                              <div className="muted" style={{ marginTop: 6 }}>
                                Recomendado para modelar un auto “de alguien” sin confusión. Crea <b>Vehículo</b> con nombre tipo <b>Auto (Mamá)</b> y deja lista
                                la asignación (pestaña <b>Presupuesto</b>) para capturar <b>Gasolina</b> (y categorías típicas si no existen).
                              </div>
                              <div className="spacer8" />
                              <div className="grid grid2">
                                <label>
                                  Persona
                                  <select
                                    className="select"
                                    value={budgetWizardMemberId}
                                    onChange={(e) => setBudgetWizardMemberId(e.target.value)}
                                    disabled={!meOk.isFamilyAdmin || budgetWizardBusy || loading}
                                  >
                                    <option value="">Selecciona…</option>
                                    {memberItems.map((m: any) => (
                                      <option key={String(m.id)} value={String(m.id)}>
                                        {displayPersonName(m.name || m.email || 'Integrante')}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label>
                                  Nombre sugerido
                                  <input
                                    className="input"
                                    value={(() => {
                                      const member = memberItems.find((m: any) => String(m?.id || '') === String(budgetWizardMemberId || ''))
                                      const personName = displayPersonName(member?.name || member?.email || '')
                                      return personName ? `Auto (${personName})` : 'Auto (…)'
                                    })()}
                                    disabled
                                  />
                                </label>
                              </div>
                              <div className="spacer8" />
                              <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div className="muted">
                                  Al terminar, abrimos la pestaña <b>Presupuesto</b> para que pongas el monto mensual.
                                </div>
                                <button
                                  className="btn btnPrimary btnSm"
                                  onClick={setupPersonalVehicle}
                                  disabled={!meOk.isFamilyAdmin || budgetWizardBusy || loading || !budgetWizardMemberId}
                                  type="button"
                                >
                                  {budgetWizardBusy ? 'Preparando…' : 'Crear auto personal'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {budgetModalTab === 'categorias' ? (
                          <div className="chartBox">
                            <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                              <div>
                                <h3 className="chartTitle" style={{ margin: 0 }}>
                                  Categorías
                                </h3>
                                <div className="muted" style={{ marginTop: 6 }}>
                                  Crea, edita o elimina categorías presupuestales.
                                </div>
                              </div>
                            </div>

                            <div className="spacer12" />

                            <div className="cardSub">
                              <div className="subTitle">Agregar categoría</div>
                              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Añadir en un clic:</div>
                              <div className="sectionRow" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                {['Supermercado', 'Servicios', 'Gasolina', 'Salud', 'Otros'].map((suggestedName) => {
                                  const exists = categoryItems.some((c: any) => String(c?.name || '').trim().toLowerCase() === suggestedName.trim().toLowerCase())
                                  return (
                                    <button
                                      key={suggestedName}
                                      type="button"
                                      className="btn btnGhost btnSm"
                                      onClick={() => !exists && createCategoryWithName(suggestedName)}
                                      disabled={!meOk.isFamilyAdmin || loading || exists}
                                      title={exists ? `"${suggestedName}" ya existe` : `Crear categoría "${suggestedName}"`}
                                    >
                                      {exists ? `${suggestedName} ✓` : `+ ${suggestedName}`}
                                    </button>
                                  )
                                })}
                              </div>
                              <div className="spacer8" />
                              <div className="grid grid2">
                                <label>
                                  Tipo
                                  <select className="select" value={bcType} onChange={(e) => setBcType(e.target.value)} disabled={!meOk.isFamilyAdmin || loading}>
                                    <option value="EXPENSE">Gasto</option>
                                    <option value="INCOME">Ingreso</option>
                                  </select>
                                </label>
                                <label>
                                  Nombre
                                  <input className="input" value={bcName} onChange={(e) => setBcName(e.target.value)} disabled={!meOk.isFamilyAdmin || loading} placeholder="Ej. Supermercado / Colegiaturas" />
                                </label>
                              </div>
                              {categoryNameCombinedWarning(bcName) ? (
                                <div className="muted" role="status" style={{ fontSize: 12, marginTop: 8, padding: 10, borderRadius: 8, border: '1px dashed var(--border)' }}>
                                  {categoryNameCombinedWarning(bcName)}
                                </div>
                              ) : null}
                              <div className="spacer8" />
                              <button className="btn btnPrimary btnSm" onClick={createCategory} disabled={!meOk.isFamilyAdmin || loading} type="button">
                                Crear categoría
                              </button>
                            </div>

                            <div className="spacer12" />

                            {categoryItems.length ? (
                              <div className="budgetListScroll">
                                <table className="table">
                                  <thead>
                                    <tr>
                                      <th>Nombre</th>
                                      <th>Tipo</th>
                                      <th>Activo</th>
                                      <th>Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {categoryItems.slice(0, 160).map((c: any) => {
                                      const draft = categoryNameDraft[c.id] ?? String(c.name || '')
                                      const changed = draft.trim() !== String(c.name || '')
                                      const catWarn = categoryNameCombinedWarning(draft)
                                      return (
                                        <tr key={c.id}>
                                          <td style={{ minWidth: 240 }}>
                                            <input
                                              className="input"
                                              value={draft}
                                              disabled={!meOk.isFamilyAdmin || adminSavingId === c.id}
                                              onChange={(ev) =>
                                                setCategoryNameDraft((prev) => ({
                                                  ...prev,
                                                  [c.id]: ev.target.value,
                                                }))
                                              }
                                            />
                                            {catWarn ? (
                                              <div className="muted" role="status" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.35 }}>
                                                {catWarn}
                                              </div>
                                            ) : null}
                                          </td>
                                          <td className="muted">{c.type || '—'}</td>
                                          <td className="muted">
                                            <input
                                              type="checkbox"
                                              checked={!!c.isActive}
                                              disabled={!meOk.isFamilyAdmin || adminSavingId === c.id}
                                              onChange={(ev) => patchBudgetCategory(c.id, { isActive: ev.target.checked })}
                                            />
                                          </td>
                                          <td>
                                            <div className="sectionRow">
                                              <button
                                                className="btn btnGhost btnSm"
                                                disabled={!meOk.isFamilyAdmin || adminSavingId === c.id || !changed}
                                                onClick={() => patchBudgetCategory(c.id, { name: draft.trim() })}
                                                type="button"
                                              >
                                                Guardar
                                              </button>
                                              <button
                                                className="btn btnDanger btnSm"
                                                disabled={!meOk.isFamilyAdmin || adminSavingId === c.id}
                                                onClick={() => deleteBudgetCategory(c.id)}
                                                type="button"
                                              >
                                                Eliminar
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="muted">Aún no hay categorías.</div>
                            )}
                          </div>
                        ) : null}

                        {budgetModalTab === 'montos' ? (
                          <div className="chartBox">
                            <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                              <div>
                                <h3 className="chartTitle" style={{ margin: 0 }}>
                                  Asignar presupuesto (crear cuenta)
                                </h3>
                                <div className="muted" style={{ marginTop: 6 }}>
                                  <strong>Aquí se crea el presupuesto en el sentido práctico:</strong> eliges destino y categoría y un tope mensual. Eso genera la fila en la base de datos (una <b>cuenta</b>) mediante el mismo guardado de siempre.
                                </div>
                                <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>
                                  1. Destino → 2. Categoría → 3. Tope mensual (presupuesto)
                                </p>
                              </div>
                            </div>

                            <div className="spacer12" />

                            {(!setupChecklist.hasObject || !setupChecklist.hasCategory) ? (
                              <div className="cardSub" style={{ padding: 12, marginBottom: 12, background: 'var(--surface-warn, rgba(220,160,0,0.08))', border: '1px solid var(--border)' }}>
                                <div className="subTitle" style={{ marginBottom: 8 }}>Falta configuración previa</div>
                                {!setupChecklist.hasObject ? (
                                  <p className="muted" style={{ margin: '0 0 8px 0', fontSize: 13 }}>Necesitas al menos un destino (persona, casa, auto…).</p>
                                ) : null}
                                {!setupChecklist.hasCategory ? (
                                  <p className="muted" style={{ margin: '0 0 8px 0', fontSize: 13 }}>Necesitas al menos una categoría de gasto (supermercado, servicios…).</p>
                                ) : null}
                                <div className="sectionRow" style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                                  {!setupChecklist.hasObject ? (
                                    <button type="button" className="btn btnGhost btnSm" onClick={() => setBudgetModalTab('objetos')}>
                                      Ir a Destinos
                                    </button>
                                  ) : null}
                                  {!setupChecklist.hasCategory ? (
                                    <button type="button" className="btn btnGhost btnSm" onClick={() => setBudgetModalTab('categorias')}>
                                      Ir a Categorías
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}

                            <div className="cardSub">
                              <div className="subTitle">Nueva asignación</div>
                              <p className="muted budgetNuevaAsignHint" style={{ fontSize: 12, marginTop: 4, marginBottom: 8 }}>
                                Elige destino y categoría; la otra lista evita duplicar la misma combinación. El desplegable de destinos va <b>agrupado por tipo</b> (personas, vehículos…).
                                {alEntityId
                                  ? ` Para este tipo (${entityTypeLabel(entityItems.find((e: any) => String(e?.id) === String(alEntityId))?.type)}) puedes ocultar categorías poco habituales con la casilla de abajo.`
                                  : ''}
                              </p>
                              {!meOk.isFamilyAdmin && (meOk.ownedEntityIds || []).length === 0 ? (
                                <p className="muted" style={{ marginTop: 8 }}>Solo puedes asignar presupuesto a destinos que son tuyos. Pide al Admin que te asigne un destino (ej. tu persona) en Destinos → Responsables.</p>
                              ) : null}
                              <div className="spacer8" />
                              <div className="grid grid2">
                                <label>
                                  Destino
                                  <select
                                    className="select budgetEntitySelect"
                                    value={alEntityId}
                                    onChange={(e) => setAlEntityId(e.target.value)}
                                    disabled={!!loading}
                                  >
                                    <option value="">Selecciona…</option>
                                    {(() => {
                                      const base = meOk.isFamilyAdmin
                                        ? entityItems.filter((e: any) => e?.isActive !== false && e?.participatesInBudget !== false)
                                        : entityItems.filter(
                                            (e: any) =>
                                              e?.isActive !== false &&
                                              e?.participatesInBudget !== false &&
                                              (meOk.ownedEntityIds || []).includes(String(e.id))
                                          )
                                      const filtered = base.filter((e: any) => {
                                        if (!alCategoryId) return true
                                        if (String(e.id) === String(alEntityId)) return true
                                        const yaTiene = allocationItems.some(
                                          (a: any) => String(a.entity?.id) === String(e.id) && String(a.category?.id) === String(alCategoryId)
                                        )
                                        return !yaTiene
                                      })
                                      const groups = groupBudgetEntitiesForOptgroups(filtered)
                                      return groups.map((g) => (
                                        <optgroup key={g.label} label={g.label}>
                                          {g.items.map((raw: any) => (
                                            <option key={raw.id} value={raw.id}>
                                              {raw.name} ({raw?.customType?.name || entityTypeLabel(raw.type)})
                                            </option>
                                          ))}
                                        </optgroup>
                                      ))
                                    })()}
                                  </select>
                                </label>
                                <label>
                                  Categoría
                                  <select className="select" value={alCategoryId} onChange={(e) => setAlCategoryId(e.target.value)} disabled={!!loading}>
                                    <option value="">Selecciona…</option>
                                    {categoryItems
                                    .filter((c: any) => c?.isActive !== false)
                                    .filter((c: any) => {
                                      if (!alEntityId) return true
                                      if (String(c.id) === String(alCategoryId)) return true
                                      const yaTiene = allocationItems.some((a: any) => String(a.entity?.id) === String(alEntityId) && String(a.category?.id) === String(c.id))
                                      if (yaTiene) return false
                                      if (allocationShowAllCategories) return true
                                      const ent = entityItems.find((e: any) => String(e?.id) === String(alEntityId))
                                      const et = String(ent?.type || '')
                                      const nm = String(c?.name || '')
                                      if (categoryLooksWrongForDestinationType(et, nm)) return false
                                      return true
                                    })
                                    .map((c: any) => (
                                      <option key={c.id} value={c.id}>
                                        {c.code ? `${c.code} ${c.name}` : c.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                {alEntityId ? (() => {
                                  const catsWithMonto = allocationItems.filter((a: any) => String(a.entity?.id) === String(alEntityId)).map((a: any) => a.category?.name).filter(Boolean)
                                  return catsWithMonto.length > 0 ? <p className="muted" style={{ fontSize: 12, marginTop: 4, gridColumn: '1 / -1' }}>En este destino ya tienen monto: {catsWithMonto.join(', ')}</p> : null
                                })() : null}
                                {alCategoryId ? (() => {
                                  const destinosConMonto = allocationItems.filter((a: any) => String(a.category?.id) === String(alCategoryId)).map((a: any) => entityItems.find((e: any) => String(e.id) === String(a.entity?.id))).filter(Boolean)
                                  const names = destinosConMonto.map((e: any) => `${e?.name} (${(e as any)?.customType?.name || entityTypeLabel(e?.type)})`)
                                  return names.length > 0 ? <p className="muted" style={{ fontSize: 12, marginTop: 4, gridColumn: '1 / -1' }}>En esta categoría ya tienen asignación: {names.join(', ')}</p> : null
                                })() : null}
                              </div>
                              {alEntityId ? (
                                <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={allocationShowAllCategories}
                                    onChange={(e) => setAllocationShowAllCategories(e.target.checked)}
                                  />
                                  Mostrar todas las categorías (incluye las poco habituales para este tipo de destino)
                                </label>
                              ) : null}
                              <div className="spacer8" />
                              <div className="sectionRow" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <label style={{ minWidth: 240, flex: 1 }}>
                                  Tope mensual (presupuesto)
                                  <span className="budgetAmountInputWrap">
                                    <span className="budgetAmountPrefix" aria-hidden="true">{currency === 'MXN' ? '$' : currency} </span>
                                    <input
                                      className="input"
                                      value={alLimit}
                                      onChange={(e) => setAlLimit(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (alEntityId && alCategoryId && alLimit.trim()) createAllocation(); } }}
                                      inputMode="decimal"
                                      disabled={!!loading}
                                      placeholder="5,000"
                                      aria-label="Tope mensual de presupuesto para esta cuenta"
                                    />
                                  </span>
                                </label>
                                <button
                                  className="btn btnPrimary btnSm"
                                  onClick={createAllocation}
                                  disabled={!!loading || !alEntityId || !alCategoryId || !alLimit.trim() || (!meOk.isFamilyAdmin && !(meOk.ownedEntityIds || []).includes(alEntityId))}
                                  type="button"
                                >
                                  Crear cuenta de presupuesto
                                </button>
                                <button
                                  className="btn btnGhost btnSm"
                                  type="button"
                                  onClick={() => { setAlEntityId(''); setAlCategoryId(''); setAlLimit(''); setMessage(''); }}
                                  disabled={!!loading}
                                  title="Limpiar el formulario para otra combinación destino + categoría"
                                >
                                  Limpiar formulario
                                </button>
                              </div>
                            </div>

                            <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>
                              Las cuentas que crees aparecen en el <b>Bloque 2 · Cuentas</b> (más abajo). Ahí puedes ver y ajustar límites; en esta pestaña solo creas nuevas cuentas (nuevo par destino + categoría + tope).
                            </div>
                          </div>
                        ) : null}

                        <div ref={presupuestoCuentasRef} id="presupuesto-b2-cuentas" className="presupuestoOuterBlock">
                          <p className="muted" style={{ margin: '0 0 8px 0', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 800 }}>
                            Bloque 2 · Cuentas
                          </p>
                          <div className="budgetManageGrid">
                            <div className="chartBox">
                              <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div>
                                  <h3 className="chartTitle" style={{ margin: 0 }}>
                                    Cuentas del presupuesto
                                  </h3>
                                  <div className="muted" style={{ marginTop: 6 }}>
                                    Cada fila es un destino + categoría con tope mensual. Haz clic para ver y editar el monto (no se crean cuentas nuevas aquí; usa el Bloque 1 → pestaña Presupuesto).
                                  </div>
                                </div>
                                <label style={{ maxWidth: 260 }}>
                                  Buscar por categoría o destino
                                  <input
                                    className="input inputSm"
                                    placeholder="Ej. supermercado, Casa, Gonzalo…"
                                    value={budgetModalSearch}
                                    onChange={(e) => setBudgetModalSearch(e.target.value)}
                                  />
                                </label>
                              </div>

                              <div className="spacer8" />

                              {budgetModalAccounts.length ? (
                                <div className="budgetListScroll">
                                  <table className="table">
                                    <thead>
                                      <tr>
                                        <th>Cuenta</th>
                                        <th style={{ textAlign: 'right' }}>Presupuesto</th>
                                        <th style={{ textAlign: 'right' }}>Gastado</th>
                                        <th style={{ textAlign: 'right' }}>Disponible</th>
                                        <th style={{ textAlign: 'center' }}>Estado</th>
                                        <th title="Se define por el tipo de destino (Persona = Individual; otros = Compartido)">Tipo (auto)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {budgetModalAccounts.map((a: any) => {
                                        const selected = String(budgetModalAllocId || '') === String(a.id)
                                        return (
                                          <tr
                                            key={a.id}
                                            className={selected ? 'budgetAccountRowSelected' : ''}
                                            onClick={() => setBudgetModalAllocId(String(a.id))}
                                            style={{ cursor: 'pointer' }}
                                          >
                                            <td style={{ fontWeight: 950 }}>
                                              {a.categoryName}
                                              <div className="muted" style={{ fontWeight: 800, marginTop: 2 }}>
                                                {a.entityName} ({entityTypeLabel(a.entityType)})
                                              </div>
                                            </td>
                                            <td style={{ fontWeight: 900, textAlign: 'right' }}>{formatMoney(Number(a.budget), currency)}</td>
                                            <td className="muted" style={{ textAlign: 'right' }}>
                                              {formatMoney(Number(a.spent), currency)}
                                            </td>
                                            <td style={{ fontWeight: 900, textAlign: 'right' }}>{formatMoney(Number(a.remaining), currency)}</td>
                                            <td style={{ textAlign: 'center' }}>
                                              <span className={`pill ${a.status === 'OK' ? 'pillOk' : a.status === 'Over' ? 'pillBad' : 'pillWarn'}`}>
                                                {a.status === 'OK' ? 'OK' : a.status === 'Over' ? 'En rojo' : 'Pendiente'}
                                              </span>
                                            </td>
                                            <td className="muted">{a.type}</td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="muted" style={{ padding: 'var(--space-16) 0' }}>
                                  {!budgetAccounts.length
                                    ? 'Aún no hay cuentas. Ve al Bloque 1 → pestaña Presupuesto y crea destino + categoría + monto (ej. Casa + CFE).'
                                    : budgetModalSearch.trim()
                                      ? `Ninguna cuenta coincide con «${budgetModalSearch.trim()}». Borra la búsqueda o prueba otro término (categoría o destino).`
                                      : 'No hay resultados.'}
                                </div>
                              )}
                            </div>

                            <div className="chartBox">
                              <h3 className="chartTitle" style={{ margin: 0 }}>
                                Editar cuenta
                              </h3>
                              <div className="muted" style={{ marginTop: 6, marginBottom: 0 }}>Cambia el monto mensual o desactiva esta cuenta.</div>
                              <div className="spacer8" />
                              {(() => {
                                const acc = budgetModalSelectedAccount as any
                                const alloc = budgetModalSelectedAlloc as any
                                if (!acc || !alloc) return <div className="muted" style={{ padding: 'var(--space-12) 0' }}>Selecciona una cuenta en la lista de la izquierda para ver y editar su monto.</div>

                                const draft = allocationLimitDraft[String(alloc.id)] ?? String(alloc.monthlyLimit || '')
                                const changed = draft.trim() !== String(alloc.monthlyLimit || '')
                                const nMonthly = Number(draft)
                                const annual = (Number.isFinite(nMonthly) ? nMonthly : 0) * 12
                                const ownedIds = meOk.ownedEntityIds || []
                                const canEditThisAccount = meOk.isFamilyAdmin || (acc && ownedIds.includes(String((acc as any).entityId)))
                                return (
                                  <>
                                    <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                      <div>
                                        <div style={{ fontWeight: 950, fontSize: 16 }}>{acc.categoryName}</div>
                                        <div className="muted" style={{ fontWeight: 850, marginTop: 4 }}>
                                          {acc.entityName} ({entityTypeLabel(acc.entityType)}) • {acc.type}
                                        </div>
                                      </div>
                                      <span className={`pill ${acc.status === 'OK' ? 'pillOk' : acc.status === 'Over' ? 'pillBad' : 'pillWarn'}`}>
                                        {acc.status === 'OK' ? 'OK' : acc.status === 'Over' ? 'En rojo' : 'Pendiente'}
                                      </span>
                                    </div>

                                    <div className="spacer12" />

                                    <div className="cardSub" style={{ padding: 12 }}>
                                      <div className="subTitle">Ajuste de presupuesto</div>
                                      <div className="spacer8" />
                                      <div className="sectionRow" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                        <label style={{ minWidth: 220, flex: 1 }}>
                                          Monto mensual (obligatorio)
                                          <span className="budgetAmountInputWrap">
                                            <span className="budgetAmountPrefix" aria-hidden="true">{currency === 'MXN' ? '$' : currency} </span>
                                            <input
                                              className="input"
                                              inputMode="decimal"
                                              value={draft}
                                              disabled={!canEditThisAccount || adminSavingId === String(alloc.id)}
                                              onChange={(ev) =>
                                                setAllocationLimitDraft((prev) => ({
                                                  ...prev,
                                                  [String(alloc.id)]: ev.target.value,
                                                }))
                                              }
                                            />
                                          </span>
                                        </label>
                                        <button
                                          className="btn btnPrimary btnSm"
                                          disabled={!canEditThisAccount || adminSavingId === String(alloc.id) || !changed}
                                          onClick={() => patchBudgetAllocation(String(alloc.id), { monthlyLimit: draft.trim() })}
                                          type="button"
                                        >
                                          Guardar
                                        </button>
                                        {budgetReturnToIntegranteUserId ? (
                                          <button
                                            className="btn btnGhost btnSm"
                                            type="button"
                                            onClick={() => {
                                              const userId = budgetReturnToIntegranteUserId
                                              setBudgetReturnToIntegranteUserId(null)
                                              go('dashboard')
                                              setPeopleBudgetUserId(userId)
                                              setPeopleBudgetOpen(true)
                                            }}
                                            title={`Volver a ${displayPersonName(budgetPeople.members.find((m: any) => String(m?.userId) === String(budgetReturnToIntegranteUserId))?.name ?? 'integrante')}`}
                                          >
                                            Regresar al mismo lugar
                                          </button>
                                        ) : null}
                                        <button
                                          className="btn btnDanger btnSm"
                                          disabled={!canEditThisAccount || adminSavingId === String(alloc.id)}
                                          onClick={() => deleteBudgetAllocation(String(alloc.id))}
                                          type="button"
                                        >
                                          Eliminar
                                        </button>
                                      </div>

                                      <div className="spacer8" />

                                      <div className="sectionRow" style={{ flexWrap: 'wrap' }}>
                                        <span className="pill">Anual: {formatMoney(annual, currency)}</span>
                                        <span className="pill">Gastado: {formatMoney(Number(acc.spent), currency)}</span>
                                        <span className="pill">Disponible: {formatMoney(Number(acc.remaining), currency)}</span>
                                      </div>

                                      <div className="spacer8" />

                                      <label className="muted" style={{ fontWeight: 900 }}>
                                        <input
                                          type="checkbox"
                                          checked={!!alloc.isActive}
                                          disabled={!canEditThisAccount || adminSavingId === String(alloc.id)}
                                          onChange={(ev) => patchBudgetAllocation(String(alloc.id), { isActive: ev.target.checked })}
                                          style={{ marginRight: 8 }}
                                        />
                                        Activa (participa en el presupuesto)
                                      </label>
                                    </div>

                                    <div className="spacer12" />

                                    <div className="cardSub" style={{ padding: 12 }}>
                                      <div className="subTitle">Pago a proveedor (cómo y con qué se paga)</div>
                                      <div className="muted" style={{ marginBottom: 10 }}>
                                        Indica el medio de pago y la cuenta con la que se paga esta cuenta (destino + categoría); opcionalmente CLABE y referencia del proveedor para generar pagos.
                                      </div>
                                      {(() => {
                                        const aid = String(alloc.id)
                                        const base = { defaultPaymentMethod: String(alloc?.defaultPaymentMethod ?? ''), bankAccountLabel: String(alloc?.bankAccountLabel ?? ''), providerClabe: String(alloc?.providerClabe ?? ''), providerReference: String(alloc?.providerReference ?? '') }
                                        const draft = allocationPaymentDraft[aid] ?? base
                                        const changed = draft.defaultPaymentMethod !== base.defaultPaymentMethod || draft.bankAccountLabel !== base.bankAccountLabel || draft.providerClabe !== base.providerClabe || draft.providerReference !== base.providerReference
                                        return (
                                          <>
                                            <div className="fieldGrid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                              <label>
                                                Medio de pago
                                                <select
                                                  className="select"
                                                  value={draft.defaultPaymentMethod}
                                                  disabled={!canEditThisAccount || adminSavingId === aid}
                                                  onChange={(e) => setAllocationPaymentDraft((prev) => ({ ...prev, [aid]: { ...(prev[aid] ?? base), defaultPaymentMethod: e.target.value } }))}
                                                >
                                                  <option value="">—</option>
                                                  <option value="efectivo">Efectivo</option>
                                                  <option value="transferencia">Transferencia</option>
                                                  <option value="tarjeta">Tarjeta</option>
                                                  <option value="deposito">Depósito</option>
                                                  <option value="otro">Otro</option>
                                                </select>
                                              </label>
                                              <label>
                                                Cuenta con la que se paga
                                                <input
                                                  type="text"
                                                  className="input"
                                                  placeholder="Ej. Cuenta principal, Tarjeta débito"
                                                  value={draft.bankAccountLabel}
                                                  disabled={!canEditThisAccount || adminSavingId === aid}
                                                  onChange={(e) => setAllocationPaymentDraft((prev) => ({ ...prev, [aid]: { ...(prev[aid] ?? base), bankAccountLabel: e.target.value } }))}
                                                />
                                              </label>
                                              <label>
                                                CLABE del proveedor (transferencias)
                                                <input
                                                  type="text"
                                                  className="input"
                                                  placeholder="18 dígitos"
                                                  value={draft.providerClabe}
                                                  disabled={!canEditThisAccount || adminSavingId === aid}
                                                  onChange={(e) => setAllocationPaymentDraft((prev) => ({ ...prev, [aid]: { ...(prev[aid] ?? base), providerClabe: e.target.value.replace(/\s/g, '').slice(0, 18) } }))}
                                                />
                                              </label>
                                              <label>
                                                Referencia del proveedor
                                                <input
                                                  type="text"
                                                  className="input"
                                                  placeholder="Referencia o convenio"
                                                  value={draft.providerReference}
                                                  disabled={!canEditThisAccount || adminSavingId === aid}
                                                  onChange={(e) => setAllocationPaymentDraft((prev) => ({ ...prev, [aid]: { ...(prev[aid] ?? base), providerReference: e.target.value } }))}
                                                />
                                              </label>
                                            </div>
                                            <div className="spacer8" />
                                            <button
                                              className="btn btnPrimary btnSm"
                                              disabled={!canEditThisAccount || adminSavingId === aid || !changed}
                                              onClick={async () => {
                                                await patchBudgetAllocation(aid, { defaultPaymentMethod: draft.defaultPaymentMethod || undefined, bankAccountLabel: draft.bankAccountLabel || undefined, providerClabe: draft.providerClabe || undefined, providerReference: draft.providerReference || undefined })
                                                setAllocationPaymentDraft((prev) => { const next = { ...prev }; delete next[aid]; return next })
                                              }}
                                              type="button"
                                            >
                                              Guardar pago / cuenta
                                            </button>
                                          </>
                                        )
                                      })()}
                                    </div>

                                    <div className="spacer12" />

                                    {acc.type === 'Compartido' && Number(acc.spent) > 0 && Array.isArray((acc as any).spenders) && (acc as any).spenders.length ? (
                                      <>
                                        <div className="cardSub" style={{ padding: 12 }}>
                                          <div className="subTitle">División por integrante (quién gastó)</div>
                                          <div className="spacer8" />
                                          <div className="muted" style={{ marginBottom: 10 }}>
                                            Se calcula automáticamente por quién registró los gastos de esta cuenta.
                                          </div>
                                          <div className="peopleBreakdown">
                                            {(acc as any).spenders.slice(0, 6).map((s: any) => {
                                              const full = String(s?.name || '—')
                                              const amt = Number(s?.amount) || 0
                                              return (
                                                <span key={String(s?.userId || full)} className="peopleChip" title={`${full}: ${formatMoney(amt, currency)}`}>
                                                  {full}: {formatMoney(amt, currency)}
                                                </span>
                                              )
                                            })}
                                            {(acc as any).spenders.length > 6 ? (
                                              <span className="peopleChip peopleChipMuted">+{(acc as any).spenders.length - 6} más</span>
                                            ) : null}
                                          </div>
                                        </div>

                                        <div className="spacer12" />
                                      </>
                                    ) : null}

                                    <div className="muted" style={{ marginBottom: 10, fontSize: 12 }}>
                                      ¿Nueva cuenta (nuevo par destino + categoría)? Solo en <button type="button" className="btn btnLinkInline" onClick={() => { setBudgetModalTab('montos'); document.getElementById('presupuesto-b1-config')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>Bloque 1 → pestaña Presupuesto</button>. Aquí solo ajustas límites de cuentas ya creadas.
                                    </div>
                                  </>
                                )
                              })()}
                            </div>
                          </div>
                        </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="chartBox presupuestoAccionesCard">
                    <h2 className="chartTitle presupuestoAccionesTitle">
                      Resumen y análisis
                    </h2>
                    <p className="muted presupuestoAccionesLead">
                      El flujo de creación está arriba (<strong>Bloque 1</strong>: Destino → Categoría → pestaña Presupuesto). Aquí solo ves estado, KPIs y herramientas de análisis.
                    </p>
                    <div className="presupuestoStatusRow sectionRow" aria-label="Estado del presupuesto">
                        <span className={`pill ${setupChecklist.hasObject ? 'pillOk' : 'pillWarn'}`}>Destinos: {setupChecklist.objectCount}</span>
                        <span className={`pill ${setupChecklist.hasCategory ? 'pillOk' : 'pillWarn'}`}>Categorías: {setupChecklist.categoryCount}</span>
                        <span className={`pill ${setupChecklist.hasAllocation ? 'pillOk' : 'pillWarn'}`}>Cuentas: {setupChecklist.allocationCount}</span>
                        {myPartidasCount > 0 ? (
                          <span className="pill pillOk" title="Códigos 6xxx–9xxx en categorías (plantilla contable); compatible con seed-my-partidas">
                            Tu entorno: {myPartidasCount} categorías (códigos)
                          </span>
                        ) : null}
                    </div>

                    <div className="spacer16" />

                    <p className="muted" id="presupuesto-b3-resumen" style={{ margin: '0 0 8px 0', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 800 }}>
                      Bloque 3 · Resumen
                    </p>
                    {setupChecklist.hasAllocation ? (
                      <>
                        <h3 className="chartTitle" style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                          Concentrado del presupuesto
                        </h3>
                        <div className="muted" style={{ marginTop: 4, marginBottom: 8 }}>
                          Año {budgetConcentrado.year} • Cuentas: {budgetConcentrado.accounts}
                        </div>
                        <div className="sectionRow" style={{ marginBottom: 12 }}>
                          <label style={{ maxWidth: 140 }}>
                            Año
                            <select className="select" value={String(budgetConcentrado.year)} onChange={(e) => setBudgetYear(e.target.value)} disabled={loading}>
                              {(() => {
                                const nowY = new Date().getFullYear()
                                const years = [nowY - 2, nowY - 1, nowY, nowY + 1]
                                return years.map((y) => (
                                  <option key={y} value={String(y)}>
                                    {y}
                                  </option>
                                ))
                              })()}
                            </select>
                          </label>
                        </div>
                        <div className="kpiStrip">
                          <div className="kpiCard">
                            <div className="kpiTitle">Presupuesto anual</div>
                            <div className="kpiValue">{formatMoney(budgetConcentrado.annualTotal, currency)}</div>
                            <div className="kpiDelta">promedio mensual: {formatMoney(budgetConcentrado.monthlyTotal, currency)}</div>
                          </div>
                          <div className="kpiCard kpiWarn">
                            <div className="kpiTitle">Gastado (año)</div>
                            <div className="kpiValue">{formatMoney(budgetConcentrado.spent, currency)}</div>
                            <div className="kpiDelta">rango: {budgetConcentrado.year}-01-01 a {budgetConcentrado.year}-12-31</div>
                          </div>
                          <div className="kpiCard kpiSuccess">
                            <div className="kpiTitle">Disponible (año)</div>
                            <div className="kpiValue">{formatMoney(Math.max(0, budgetConcentrado.remaining), currency)}</div>
                            <div className="kpiDelta">saldo</div>
                          </div>
                          <div className={`kpiCard ${budgetConcentrado.remaining >= 0 ? 'kpiSuccess' : 'kpiDanger'}`}>
                            <div className="kpiTitle">{budgetConcentrado.remaining >= 0 ? 'Ahorro / margen' : 'En rojo'}</div>
                            <div className="kpiValue">{formatMoney(budgetConcentrado.remaining, currency)}</div>
                            <div className="kpiDelta">diferencia anual</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="muted" style={{ padding: '12px 0' }}>
                        Sin cuentas no hay concentrado. En el <strong>Bloque 1</strong> crea destino + categoría y asigna presupuesto (pestaña Presupuesto) para ver KPIs aquí.
                      </div>
                    )}

                    <div className="spacer16" />

                    <div className="presupuestoConcentradoActions" role="toolbar" aria-label="Acciones de presupuesto">
                      {meOk.isFamilyAdmin ? (
                        <div className="presupuestoActionsRow presupuestoActionsRowPrimary" style={{ marginBottom: 12 }}>
                          <button
                            className={`btn btnPrimary btnSm presupuestoCtaSecondary ${
                              !setupChecklist.needsSetup && familyDetails && !familyDetails.setupComplete ? 'pulseAction' : ''
                            }`}
                            onClick={confirmPlan}
                            disabled={loading || setupChecklist.needsSetup}
                            type="button"
                            title={setupChecklist.needsSetup ? 'Completa destino, categoría y al menos una cuenta antes de confirmar' : 'Confirma el plan'}
                          >
                            Confirmar plan
                          </button>
                        </div>
                      ) : null}
                      <p className="muted" id="presupuesto-b4-analisis" style={{ margin: '0 0 8px 0', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 800 }}>
                        Bloque 4 · Análisis
                      </p>
                      <div className="presupuestoActionsRow presupuestoActionsRowSecondary">
                        <button
                          className="btn btnGhost btnSm"
                          onClick={() => setPeopleBudgetOpen(true)}
                          disabled={loading}
                          type="button"
                          title="Análisis por integrante (presupuesto individual)"
                        >
                          Integrantes
                        </button>
                        <button
                          className="btn btnGhost btnSm"
                          onClick={async () => {
                            setSeedMyPartidasBusy(true)
                            setMessage('')
                            try {
                              const r = await postJson('/api/budget/seed-my-partidas', {})
                              setMessage((r as any)?.message || 'Categorías con código creadas.')
                              await refreshBudget()
                            } catch (e: any) {
                              setMessage(e?.message || 'No se pudo completar el seed de categorías')
                            } finally {
                              setSeedMyPartidasBusy(false)
                            }
                          }}
                          disabled={loading || seedMyPartidasBusy}
                          type="button"
                          title="Crea categorías jerárquicas 6xxx–9xxx (tu plantilla); no reemplaza destinos ni asignaciones"
                        >
                          {seedMyPartidasBusy ? 'Creando…' : 'Plantilla de categorías (códigos)'}
                        </button>
                      </div>
                    </div>

                    {!meOk.isFamilyAdmin ? (
                      <>
                        <div className="spacer8" />
                        <div className="muted">
                          Tu usuario no es <b>Admin</b>. Solo Admin puede crear destinos/categorías/presupuesto (cuentas). Pide al Admin que te cambie a Admin en “Usuarios”.
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className="spacer16" />

                  {peopleBudgetOpen ? (
                    <div
                      className="modalOverlay modalOverlayFull"
                      onClick={() => {
                        setPeopleBudgetOpen(false)
                        setPeopleBudgetNamesOpen(false)
                        setPeopleBudgetQuery('')
                        setPeopleBudgetCategoryFocusId('all')
                      }}
                    >
                      <div className="modalPanel peopleStudioPanel" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btnGhost btnSm modalClose" aria-label="Cerrar"
                        onClick={() => {
                          setPeopleBudgetOpen(false)
                          setPeopleBudgetNamesOpen(false)
                          setPeopleBudgetQuery('')
                          setPeopleBudgetCategoryFocusId('all')
                        }}
                        type="button"
                      >
                        Cerrar
                      </button>
                        <div className="modalToolbar peopleStudioToolbar">
                          <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div>
                              <h2 className="cardTitle" style={{ margin: 0, fontSize: 16 }}>
                                Integrantes (presupuesto individual)
                              </h2>
                              <div className="muted">Análisis + modificación con layout tipo “studio”.</div>
                            </div>
                          </div>
                        </div>

                        <div className="peopleStudioBody">
                          <aside className="peopleStudioSidebar">
                            <div className="card">
                              <div className="cardHeader">
                                <div>
                                  <h3 className="cardTitle">Controles</h3>
                                  <div className="cardDesc">Personas ↔ Destinos • Detalle ↔ Matriz • filtros rápidos</div>
                                </div>
                              </div>
                              <div className="cardBody peopleControls">
                                <div className="tabRow peoplePivotRow" role="tablist" aria-label="Enfoque de análisis">
                                  <button
                                    className={`tabBtn ${peopleBudgetPivot === 'people' ? 'tabBtnActive' : ''}`}
                                    onClick={() => setPeopleBudgetPivot('people')}
                                    type="button"
                                    role="tab"
                                    aria-selected={peopleBudgetPivot === 'people'}
                                  >
                                    Personas
                                  </button>
                                  <button
                                    className={`tabBtn ${peopleBudgetPivot === 'objects' ? 'tabBtnActive' : ''}`}
                                    onClick={() => setPeopleBudgetPivot('objects')}
                                    type="button"
                                    role="tab"
                                    aria-selected={peopleBudgetPivot === 'objects'}
                                  >
                                    Destinos
                                  </button>
                                </div>

                                <div className="spacer12" />

                                <div className="tabRow peoplePivotRow" role="tablist" aria-label="Vista de análisis">
                                  <button
                                    className={`tabBtn ${peopleBudgetTab === 'vertical' ? 'tabBtnActive' : ''}`}
                                    onClick={() => setPeopleBudgetTab('vertical')}
                                    type="button"
                                    role="tab"
                                    aria-selected={peopleBudgetTab === 'vertical'}
                                  >
                                    Detalle
                                  </button>
                                  <button
                                    className={`tabBtn ${peopleBudgetTab === 'custom' ? 'tabBtnActive' : ''}`}
                                    onClick={() => {
                                      setPeopleBudgetTab('custom')
                                      setPeopleBudgetNamesOpen(false)
                                      setPeopleBudgetQuery('')
                                    }}
                                    type="button"
                                    role="tab"
                                    aria-selected={peopleBudgetTab === 'custom'}
                                  >
                                    Matriz
                                  </button>
                                </div>

                                <div className="spacer12" />

                                {peopleBudgetPivot === 'people' ? (
                                  <label>
                                    Cobertura
                                    <select
                                      className="select"
                                      value={peopleBudgetCoverage}
                                      onChange={(e) => setPeopleBudgetCoverage(e.target.value as any)}
                                      disabled={loading}
                                    >
                                      <option value="individual">Solo individual</option>
                                      <option value="all">Todo (según historial)</option>
                                    </select>
                                  </label>
                                ) : null}

                                {peopleBudgetTab === 'vertical' ? (
                                  peopleBudgetPivot === 'people' ? (
                                  <>
                                    <div className="spacer12" />
                                    <label>
                                      Integrante
                                      <select
                                        className="select"
                                        value={peopleBudgetUserId}
                                        onChange={(e) => setPeopleBudgetUserId(e.target.value)}
                                        disabled={loading || !budgetPeople.members.length}
                                      >
                                        {budgetPeople.members.map((m: any) => (
                                          <option key={m.userId} value={m.userId}>
                                            {displayPersonName(m.name)}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <div className="spacer8" />

                                    <button
                                      className="btn btnGhost btnSm"
                                      onClick={() => setPeopleBudgetNamesOpen((v) => !v)}
                                      disabled={loading || !budgetPeople.members.length}
                                      type="button"
                                      title="Abrir lista rápida de integrantes"
                                    >
                                      {peopleBudgetNamesOpen ? 'Ocultar lista' : 'Ver lista'}
                                    </button>

                                    {peopleBudgetNamesOpen ? (
                                      <>
                                        <div className="spacer12" />
                                        <input
                                          className="input inputSm"
                                          value={peopleBudgetQuery}
                                          onChange={(e) => setPeopleBudgetQuery(e.target.value)}
                                          placeholder="Buscar integrante…"
                                        />
                                        <div className="spacer8" />
                                        <div className="peopleList" role="listbox" aria-label="Lista de integrantes">
                                          {peopleBudgetMembersFiltered.length ? (
                                            peopleBudgetMembersFiltered.map((m: any) => {
                                              const active = String(peopleBudgetUserId || '') === String(m.userId)
                                              const name = displayPersonName(m.name)
                                              const isNeg = Number(m.available) < 0
                                              return (
                                                <button
                                                  key={m.userId}
                                                  className={`peopleListItem ${active ? 'peopleListItemActive' : ''}`}
                                                  onClick={() => {
                                                    setPeopleBudgetUserId(String(m.userId))
                                                    setPeopleBudgetNamesOpen(false)
                                                  }}
                                                  type="button"
                                                  role="option"
                                                  aria-selected={active}
                                                  title={`${name} • Presupuesto ${formatMoney(Number(m.budgetAnnual) || 0, currency)} • Gastado ${formatMoney(
                                                    Number(m.spent) || 0,
                                                    currency
                                                  )}`}
                                                >
                                                  <div
                                                    className="peopleAvatarSm"
                                                    aria-hidden="true"
                                                    style={m?.avatarUrl ? { overflow: 'hidden', padding: 0, background: '#fff' } : undefined}
                                                  >
                                                    {m?.avatarUrl ? (
                                                      // eslint-disable-next-line @next/next/no-img-element
                                                      <img
                                                        src={String(m.avatarUrl)}
                                                        alt=""
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                      />
                                                    ) : (
                                                      initialsFromName(name)
                                                    )}
                                                  </div>
                                                  <div className="peopleListMeta">
                                                    <div className="peopleListName">
                                                      {name}
                                                      {m.isFamilyAdmin ? <span className="peopleInlinePill">Admin</span> : null}
                                                    </div>
                                                    <div className="peopleListSub">
                                                      Presupuesto {formatMoney(Number(m.budgetAnnual) || 0, currency)} • Gastado{' '}
                                                      {formatMoney(Number(m.spent) || 0, currency)}
                                                    </div>
                                                  </div>
                                                  <div className={`peopleListRight ${isNeg ? 'peopleListRightNeg' : ''}`}>
                                                    {formatMoney(Number(m.available) || 0, currency)}
                                                  </div>
                                                </button>
                                              )
                                            })
                                          ) : (
                                            <div className="muted">Sin resultados.</div>
                                          )}
                                        </div>
                                      </>
                                    ) : null}
                                  </>
                                  ) : (
                                  <>
                                    <div className="spacer12" />
                                    <label>
                                      Destino
                                      <select
                                        className="select"
                                        value={peopleBudgetEntityId}
                                        onChange={(e) => setPeopleBudgetEntityId(e.target.value)}
                                        disabled={loading || !budgetObjects.objects.length}
                                      >
                                        {budgetObjects.objects.map((o: any) => (
                                          <option key={o.entityId} value={o.entityId}>
                                            {entityTypeLabel(o.entityType)}: {o.entityName}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <label>
                                      Categoría (en este destino)
                                      <select
                                        className="select"
                                        value={peopleBudgetCategoryFocusId}
                                        onChange={(e) => setPeopleBudgetCategoryFocusId(e.target.value)}
                                        disabled={loading || !peopleBudgetObjectCategoryOptions.length}
                                      >
                                        {peopleBudgetObjectCategoryOptions.length ? (
                                          <option value="all">Todas</option>
                                        ) : (
                                          <option value="all">Sin categorías</option>
                                        )}
                                        {peopleBudgetObjectCategoryOptions.map((c: any) => (
                                          <option key={c.id} value={String(c.id)}>
                                            {String(c.name || '—')}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <button
                                      className="btn btnGhost btnSm"
                                      onClick={() => setPeopleBudgetNamesOpen((v) => !v)}
                                      disabled={loading || !budgetObjects.objects.length}
                                      type="button"
                                      title="Abrir lista rápida de destinos"
                                    >
                                      {peopleBudgetNamesOpen ? 'Ocultar lista' : 'Ver lista'}
                                    </button>

                                    {peopleBudgetNamesOpen ? (
                                      <>
                                        <div className="spacer12" />
                                        <input
                                          className="input inputSm"
                                          value={peopleBudgetQuery}
                                          onChange={(e) => setPeopleBudgetQuery(e.target.value)}
                                          placeholder="Buscar destino…"
                                        />
                                        <div className="spacer8" />
                                        <div className="peopleList" role="listbox" aria-label="Lista de destinos">
                                          {peopleBudgetObjectsFiltered.length ? (
                                            peopleBudgetObjectsFiltered.map((o: any) => {
                                              const active = String(peopleBudgetEntityId || '') === String(o.entityId)
                                              const name = String(o.entityName || '—')
                                              const isNeg = Number(o.available) < 0
                                              return (
                                                <button
                                                  key={o.entityId}
                                                  className={`peopleListItem ${active ? 'peopleListItemActive' : ''}`}
                                                  onClick={() => {
                                                    setPeopleBudgetEntityId(String(o.entityId))
                                                    setPeopleBudgetNamesOpen(false)
                                                  }}
                                                  type="button"
                                                  role="option"
                                                  aria-selected={active}
                                                  title={`${entityTypeLabel(o.entityType)}: ${name} • Presupuesto ${formatMoney(Number(o.budgetAnnual) || 0, currency)} • Gastado ${formatMoney(
                                                    Number(o.spent) || 0,
                                                    currency
                                                  )}`}
                                                >
                                                  <div
                                                    className="peopleAvatarSm"
                                                    aria-hidden="true"
                                                    style={o?.imageUrl ? { overflow: 'hidden', padding: 0, background: '#fff' } : undefined}
                                                  >
                                                    {o?.imageUrl ? (
                                                      // eslint-disable-next-line @next/next/no-img-element
                                                      <img
                                                        src={String(o.imageUrl)}
                                                        alt=""
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                      />
                                                    ) : (
                                                      initialsFromName(name)
                                                    )}
                                                  </div>
                                                  <div className="peopleListMeta">
                                                    <div className="peopleListName">
                                                      {name}
                                                      <span className="peopleInlinePill">{entityTypeLabel(o.entityType)}</span>
                                                    </div>
                                                    <div className="peopleListSub">
                                                      Presupuesto {formatMoney(Number(o.budgetAnnual) || 0, currency)} • Gastado{' '}
                                                      {formatMoney(Number(o.spent) || 0, currency)}
                                                    </div>
                                                  </div>
                                                  <div className={`peopleListRight ${isNeg ? 'peopleListRightNeg' : ''}`}>
                                                    {formatMoney(Number(o.available) || 0, currency)}
                                                  </div>
                                                </button>
                                              )
                                            })
                                          ) : (
                                            <div className="muted">Sin resultados.</div>
                                          )}
                                        </div>
                                      </>
                                    ) : null}
                                  </>
                                  )
                                ) : (
                                  <>
                                    <label>
                                      Métrica
                                      <select
                                        className="select"
                                        value={peopleBudgetMetric}
                                        onChange={(e) => setPeopleBudgetMetric(e.target.value as any)}
                                        disabled={loading}
                                      >
                                        <option value="spent">Gastado</option>
                                        <option value="budget">Presupuesto</option>
                                        <option value="available">Disponible</option>
                                      </select>
                                    </label>

                                    <label>
                                      Columnas
                                      <select
                                        className="select"
                                        value={peopleBudgetCols}
                                        onChange={(e) => setPeopleBudgetCols(e.target.value as any)}
                                        disabled={loading}
                                      >
                                        <option value="all">Todas</option>
                                        <option value="active">Solo con actividad</option>
                                      </select>
                                    </label>

                                    <div className="spacer12" />

                                    <div className="fieldRow">
                                      <label>
                                        Filas
                                        <select
                                          className="select"
                                          value={peopleBudgetPivot === 'objects' ? 'categories' : peopleBudgetRows}
                                          onChange={(e) => setPeopleBudgetRows(e.target.value as any)}
                                          disabled={loading || peopleBudgetPivot === 'objects'}
                                        >
                                          <option value="categories">Categorías</option>
                                          {peopleBudgetPivot === 'people' ? (
                                            <>
                                              <option value="objects">Destinos</option>
                                              <option value="accounts">Cuentas</option>
                                            </>
                                          ) : null}
                                        </select>
                                      </label>
                                      <label>
                                        Top filas
                                        <input
                                          className="input"
                                          inputMode="numeric"
                                          value={String(peopleBudgetTopN)}
                                          onChange={(e) => setPeopleBudgetTopN(Math.max(4, Math.min(60, Number(e.target.value) || 12)))}
                                        />
                                      </label>
                                    </div>
                                  </>
                                )}

                                <div className="spacer12" />
                                <div className="peopleHint">
                                  {peopleBudgetPivot === 'people'
                                    ? 'Tip: “Todo (según historial)” agrega cuentas compartidas (Casa/Auto) si el integrante las usó.'
                                    : 'Tip: en “Detalle” verás “A quién” por cuenta (ej. Gasolina/Supermercado). En “Matriz” verás Consumo → destino.'}
                                </div>
                              </div>
                            </div>
                          </aside>

                          <main className="peopleStudioMain">
                            {peopleBudgetPivot === 'people' ? (
                              budgetPeople.members.length ? (
                                peopleBudgetTab === 'vertical' ? (
                                  budgetPeopleSelected ? (
                                    <>
                                      <div className="card">
                                        <div className="cardHeader">
                                          <div className="peopleHero">
                                            <div
                                              className="peopleAvatar"
                                              aria-hidden="true"
                                              style={(budgetPeopleSelected as any)?.avatarUrl ? { overflow: 'hidden', padding: 0, background: '#fff' } : undefined}
                                            >
                                              {(budgetPeopleSelected as any)?.avatarUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                  src={String((budgetPeopleSelected as any).avatarUrl)}
                                                  alt=""
                                                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                />
                                              ) : (
                                                initialsFromName(budgetPeopleSelected.name)
                                              )}
                                            </div>
                                            <div>
                                              <h3 className="cardTitle" style={{ margin: 0 }}>
                                                {displayPersonName(budgetPeopleSelected.name)}
                                              </h3>
                                              <div className="cardDesc">
                                                {budgetPeopleSelected.isFamilyAdmin ? 'Admin' : 'Integrante'} •{' '}
                                                {peopleBudgetCoverage === 'all' ? 'Incluye compartidos (según historial)' : 'Solo individual'}
                                              </div>
                                            </div>
                                          </div>
                                          <span className={`pill ${Number(budgetPeopleSelected.available) >= 0 ? 'pillOk' : 'pillBad'}`}>
                                            {Number(budgetPeopleSelected.available) >= 0 ? 'Saludable' : 'En rojo'}
                                          </span>
                                        </div>
                                        <div className="cardBody">
                                          <div className="kpiStrip peopleKpiStrip">
                                            <div className="kpiCard">
                                              <div className="kpiTitle">Presupuesto (año)</div>
                                              <div className="kpiValue">
                                                {formatMoney(Number(budgetPeopleSelected.budgetAnnual) || 0, currency)}
                                              </div>
                                              <div className="kpiDelta">Asignado al integrante</div>
                                            </div>
                                            <div className="kpiCard kpiWarn">
                                              <div className="kpiTitle">Gastado</div>
                                              <div className="kpiValue">{formatMoney(Number(budgetPeopleSelected.spent) || 0, currency)}</div>
                                              <div className="kpiDelta">Según historial</div>
                                            </div>
                                            <div
                                              className={`kpiCard ${Number(budgetPeopleSelected.available) >= 0 ? 'kpiSuccess' : 'kpiDanger'}`}
                                            >
                                              <div className="kpiTitle">Disponible</div>
                                              <div className="kpiValue">
                                                {formatMoney(Number(budgetPeopleSelected.available) || 0, currency)}
                                              </div>
                                              <div className="kpiDelta">Saldo anual</div>
                                            </div>
                                            <div className="kpiCard">
                                              <div className="kpiTitle">Cuentas</div>
                                              <div className="kpiValue">
                                                {Array.isArray(budgetPeopleSelected.accounts) ? budgetPeopleSelected.accounts.length : 0}
                                              </div>
                                              <div className="kpiDelta">Incluidas por cobertura</div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="card">
                                        <div className="cardHeader">
                                          <div>
                                            <h3 className="cardTitle">Cuentas</h3>
                                            <div className="cardDesc">Presupuesto vs Gastado vs Disponible (por cuenta).</div>
                                          </div>
                                          <span className="pill">Editar abre configuración</span>
                                        </div>
                                        <div className="cardBody peopleCardBodyTight">
                                          {Array.isArray(budgetPeopleSelected.accounts) && budgetPeopleSelected.accounts.length ? (
                                            <div className="peopleAccountsWrap">
                                              <table className="table tableSticky">
                                                <thead>
                                                  <tr>
                                                    <th>Cuenta</th>
                                                    <th style={{ textAlign: 'right' }}>Presupuesto</th>
                                                    <th style={{ textAlign: 'right' }}>Gastado</th>
                                                    <th style={{ textAlign: 'right' }}>Disponible</th>
                                                    <th />
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {budgetPeopleSelected.accounts.map((r: any) => {
                                                    const over = Number(r.available) < 0
                                                    return (
                                                      <tr key={r.allocationId}>
                                                        <td>
                                                          <div style={{ fontWeight: 900 }}>{r.categoryName}</div>
                                                          <div className="muted" style={{ marginTop: 2 }}>
                                                            {r.entityName} <span className="muted">({entityTypeLabel(r.entityType)})</span>
                                                          </div>
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 900 }}>
                                                          {formatMoney(Number(r.budgetAnnual) || 0, currency)}
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>{formatMoney(Number(r.spent) || 0, currency)}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: 900 }}>
                                                          <span className={over ? 'pill pillBad' : 'pill pillOk'}>
                                                            {formatMoney(Number(r.available) || 0, currency)}
                                                          </span>
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                          <button
                                                            className="btn btnGhost btnSm"
                                                            type="button"
                                                            disabled={!meOk?.isFamilyAdmin}
                                                            onClick={() => {
                                                              setBudgetReturnToIntegranteUserId(peopleBudgetUserId || null)
                                                              setPeopleBudgetOpen(false)
                                                              setPeopleBudgetNamesOpen(false)
                                                              setPeopleBudgetQuery('')
                                                              setPeopleBudgetCategoryFocusId('all')
                                                              openBudgetModal(String(r.allocationId))
                                                            }}
                                                            title={!meOk?.isFamilyAdmin ? 'Solo admin puede editar presupuestos' : 'Editar cuenta'}
                                                          >
                                                            Editar
                                                          </button>
                                                        </td>
                                                      </tr>
                                                    )
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>
                                          ) : (
                                            <div className="peopleEmpty">
                                              <div className="muted">
                                                Sin cuentas para este integrante con la cobertura actual. Tip: crea un destino <b>Persona</b> con su nombre y
                                                asigna categorías (ej. Colegiaturas, Gasolina, etc.).
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="card">
                                      <div className="cardBody muted">Selecciona un integrante.</div>
                                    </div>
                                  )
                                ) : (
                                  <div className="card">
                                    <div className="cardHeader">
                                      <div>
                                        <h3 className="cardTitle">Matriz (comparación)</h3>
                                        <div className="cardDesc">
                                        {peopleBudgetRows === 'objects'
                                          ? 'Destinos → Personas'
                                          : peopleBudgetRows === 'accounts'
                                            ? 'Cuentas → Personas'
                                            : 'Categorías → Personas'}{' '}
                                        •{' '}
                                          {peopleBudgetMetric === 'budget'
                                            ? 'Presupuesto'
                                            : peopleBudgetMetric === 'available'
                                              ? 'Disponible'
                                              : 'Gastado'}
                                        </div>
                                      </div>
                                      <span className="pill">Scroll horizontal</span>
                                    </div>
                                    <div className="cardBody peopleCardBodyTight">
                                      <div className="peopleMatrixWrap">
                                        <table className="table tableSticky peopleMatrixTable">
                                          <thead>
                                            <tr>
                                              <th>
                                                {budgetPeopleMatrix.effectiveRows === 'objects'
                                                  ? 'De qué (destino)'
                                                  : budgetPeopleMatrix.effectiveRows === 'accounts'
                                                    ? 'De qué (Cuenta)'
                                                    : 'De qué (Categoría)'}
                                              </th>
                                              {peopleBudgetMatrixMembers.map((m: any) => (
                                                <th key={m.userId}>
                                                  <div className="peopleMatrixHeadLabel" title={displayPersonName(m.name)}>
                                                    {displayPersonName(m.name)}
                                                  </div>
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {peopleBudgetMatrixMembers.length ? (
                                              <tr className="peopleMatrixTotalsRow">
                                                <td className="peopleMatrixTotalsLabel">TOTAL</td>
                                                {peopleBudgetMatrixMembers.map((m: any) => {
                                                  const v =
                                                    peopleBudgetMetric === 'budget'
                                                      ? Number(m?.budgetAnnual) || 0
                                                      : peopleBudgetMetric === 'available'
                                                        ? Number(m?.available) || 0
                                                        : Number(m?.spent) || 0
                                                  const isNeg = peopleBudgetMetric === 'available' && v < 0
                                                  return (
                                                    <td
                                                      key={m.userId}
                                                      className={`peopleMatrixCell peopleMatrixTotalCell ${isNeg ? 'peopleMatrixCellNeg' : ''}`}
                                                    >
                                                      {formatMoney(v, currency)}
                                                    </td>
                                                  )
                                                })}
                                              </tr>
                                            ) : null}
                                            {budgetPeopleMatrix.rows.length ? (
                                              budgetPeopleMatrix.rows.map((row: any) => (
                                                <tr key={row.id}>
                                                  <td>
                                                    <div className="peopleMatrixLabel" title={row.label}>
                                                      {row.label}
                                                    </div>
                                                  </td>
                                                  {peopleBudgetMatrixMembers.map((m: any) => {
                                                    const v = Number(row.values[String(m.userId)] || 0)
                                                    const isNeg = peopleBudgetMetric === 'available' && v < 0
                                                    return (
                                                      <td key={m.userId} className={`peopleMatrixCell ${isNeg ? 'peopleMatrixCellNeg' : ''}`}>
                                                        {formatMoney(v, currency)}
                                                      </td>
                                                    )
                                                  })}
                                                </tr>
                                              ))
                                            ) : (
                                              <tr>
                                                <td className="muted" colSpan={1 + peopleBudgetMatrixMembers.length}>
                                                  Sin datos para la matriz con la cobertura actual.
                                                </td>
                                              </tr>
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </div>
                                )
                              ) : (
                                <div className="card">
                                  <div className="cardBody muted">Aún no hay integrantes en esta familia.</div>
                                </div>
                              )
                            ) : budgetObjects.objects.length ? (
                              peopleBudgetTab === 'vertical' ? (
                                budgetObjectsSelectedView ? (
                                  <>
                                    <div className="card">
                                      <div className="cardHeader">
                                        <div className="peopleHero">
                                          <div
                                            className="peopleAvatar"
                                            aria-hidden="true"
                                            style={(budgetObjectsSelectedView as any)?.imageUrl ? { overflow: 'hidden', padding: 0, background: '#fff' } : undefined}
                                          >
                                            {(budgetObjectsSelectedView as any)?.imageUrl ? (
                                              // eslint-disable-next-line @next/next/no-img-element
                                              <img
                                                src={String((budgetObjectsSelectedView as any).imageUrl)}
                                                alt=""
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                              />
                                            ) : (
                                              initialsFromName(budgetObjectsSelectedView.entityName)
                                            )}
                                          </div>
                                          <div>
                                            <h3 className="cardTitle" style={{ margin: 0 }}>
                                              {String(budgetObjectsSelectedView.entityName || '—')}
                                            </h3>
                                            <div className="cardDesc">
                                              {entityTypeLabel(budgetObjectsSelectedView.entityType)}
                                              {budgetObjectsSelectedView.categoryNameView ? ` • ${budgetObjectsSelectedView.categoryNameView}` : ' • Todas las categorías'}
                                            </div>
                                          </div>
                                        </div>
                                        <span className={`pill ${Number(budgetObjectsSelectedView.availableView) >= 0 ? 'pillOk' : 'pillBad'}`}>
                                          {Number(budgetObjectsSelectedView.availableView) >= 0 ? 'Saludable' : 'En rojo'}
                                        </span>
                                      </div>
                                      <div className="cardBody">
                                        <div className="kpiStrip peopleKpiStrip">
                                          <div className="kpiCard">
                                            <div className="kpiTitle">Presupuesto (año)</div>
                                            <div className="kpiValue">
                                              {formatMoney(Number(budgetObjectsSelectedView.budgetAnnualView) || 0, currency)}
                                            </div>
                                            <div className="kpiDelta">Asignado al destino</div>
                                          </div>
                                          <div className="kpiCard kpiWarn">
                                            <div className="kpiTitle">Gastado</div>
                                            <div className="kpiValue">{formatMoney(Number(budgetObjectsSelectedView.spentView) || 0, currency)}</div>
                                            <div className="kpiDelta">Según historial</div>
                                          </div>
                                          <div
                                            className={`kpiCard ${Number(budgetObjectsSelectedView.availableView) >= 0 ? 'kpiSuccess' : 'kpiDanger'}`}
                                          >
                                            <div className="kpiTitle">Disponible</div>
                                            <div className="kpiValue">
                                              {formatMoney(Number(budgetObjectsSelectedView.availableView) || 0, currency)}
                                            </div>
                                            <div className="kpiDelta">Saldo anual</div>
                                          </div>
                                          <div className="kpiCard">
                                            <div className="kpiTitle">A quién</div>
                                            <div className="kpiValue">{Number(budgetObjectsSelectedView.spendersCountView) || 0}</div>
                                            <div className="kpiDelta">personas con consumo</div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="card">
                                      <div className="cardHeader">
                                        <div>
                                          <h3 className="cardTitle">Responsables (Esperado vs Real)</h3>
                                          <div className="cardDesc">Esperado = según responsables. Real = según quién registró los gastos.</div>
                                        </div>
                                        {Array.isArray((budgetObjectsSelectedView as any)?.ownersView) && (budgetObjectsSelectedView as any).ownersView.length ? (
                                          <span className={`pill ${(budgetObjectsSelectedView as any).ownersModeView === 'percent' ? 'pillOk' : ''}`}>
                                            {(budgetObjectsSelectedView as any).ownersModeView === 'percent' ? 'Porcentajes' : 'Reparto igual'}
                                          </span>
                                        ) : (
                                          <span className="pill pillWarn">Sin responsables</span>
                                        )}
                                      </div>
                                      <div className="cardBody peopleCardBodyTight">
                                        {Array.isArray((budgetObjectsSelectedView as any)?.ownersCompareView) && (budgetObjectsSelectedView as any).ownersCompareView.length ? (
                                          <>
                                            <div className="peopleBreakdown" style={{ marginBottom: 10 }}>
                                              <span className="peopleChip peopleChipMuted">Responsables</span>
                                              {(budgetObjectsSelectedView as any).ownersCompareView.slice(0, 6).map((o: any) => (
                                                <span key={String(o.userId)} className="peopleChip" title={String(o.email || '')}>
                                                  {displayPersonName(o.name)}
                                                  {(budgetObjectsSelectedView as any).ownersModeView === 'percent' ? ` (${Number(o.pct) || 0}%)` : ''}
                                                </span>
                                              ))}
                                              {(budgetObjectsSelectedView as any).ownersCompareView.length > 6 ? (
                                                <span className="peopleChip peopleChipMuted">+{(budgetObjectsSelectedView as any).ownersCompareView.length - 6} más</span>
                                              ) : null}
                                            </div>

                                            <div className="peopleAccountsWrap">
                                              <table className="table tableSticky">
                                                <thead>
                                                  <tr>
                                                    <th>Responsable</th>
                                                    <th style={{ textAlign: 'right' }}>Esperado</th>
                                                    <th style={{ textAlign: 'right' }}>Real</th>
                                                    <th style={{ textAlign: 'right' }}>Diferencia</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {(budgetObjectsSelectedView as any).ownersCompareView.map((r: any) => {
                                                    const delta = Number(r?.delta) || 0
                                                    const near = Math.abs(delta) < 0.01
                                                    const pillClass = near ? 'pill pillOk' : 'pill pillWarn'
                                                    const sign = delta > 0 ? '+' : ''
                                                    return (
                                                      <tr key={String(r.userId)}>
                                                        <td>
                                                          <div style={{ fontWeight: 900 }}>
                                                            {displayPersonName(r.name)}
                                                            {(budgetObjectsSelectedView as any).ownersModeView === 'percent' ? (
                                                              <span className="muted" style={{ marginLeft: 8 }}>
                                                                {Number(r.pct) || 0}%
                                                              </span>
                                                            ) : null}
                                                          </div>
                                                          {String(r.email || '') ? (
                                                            <div className="muted" style={{ marginTop: 2 }}>
                                                              {String(r.email)}
                                                            </div>
                                                          ) : null}
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 900 }}>
                                                          {formatMoney(Number(r.expected) || 0, currency)}
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>{formatMoney(Number(r.real) || 0, currency)}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: 900 }}>
                                                          <span className={pillClass} title="Real - Esperado">
                                                            {sign}
                                                            {formatMoney(delta, currency)}
                                                          </span>
                                                        </td>
                                                      </tr>
                                                    )
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>

                                            {(() => {
                                              const ownersSet = new Set(((budgetObjectsSelectedView as any).ownersCompareView || []).map((o: any) => String(o?.userId || '')))
                                              const others = ((budgetObjectsSelectedView as any).spendersView || []).filter((s: any) => !ownersSet.has(String(s?.userId || '')))
                                              if (!others.length) return null
                                              return (
                                                <>
                                                  <div className="spacer8" />
                                                  <div className="peopleBreakdown">
                                                    <span className="peopleChip peopleChipMuted">Otros (no responsables)</span>
                                                    {others.slice(0, 4).map((s: any) => {
                                                      const uid = String(s?.userId || '')
                                                      const m = memberItems.find((mm: any) => String(mm?.id || '') === uid)
                                                      const nm = displayPersonName(m?.name || m?.email || '—')
                                                      return (
                                                        <span
                                                          key={uid}
                                                          className="peopleChip"
                                                          title="Gastó en este destino, pero no está marcado como responsable"
                                                        >
                                                          {nm}: {formatMoney(Number(s?.amount) || 0, currency)}
                                                        </span>
                                                      )
                                                    })}
                                                    {others.length > 4 ? (
                                                      <span className="peopleChip peopleChipMuted">+{others.length - 4} más</span>
                                                    ) : null}
                                                  </div>
                                                </>
                                              )
                                            })()}
                                          </>
                                        ) : (
                                          <div className="muted">
                                            Opcional: define responsables en <b>Presupuesto → Destinos → Responsables</b>.
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="card">
                                      <div className="cardHeader">
                                        <div>
                                          <h3 className="cardTitle">Cuentas del destino</h3>
                                          <div className="cardDesc">Presupuesto vs Gastado vs Disponible + “A quién”.</div>
                                        </div>
                                        <span className="pill">Editar abre configuración</span>
                                      </div>
                                      <div className="cardBody peopleCardBodyTight">
                                        {Array.isArray(budgetObjectsSelectedView.accountsView) && budgetObjectsSelectedView.accountsView.length ? (
                                          <div className="peopleAccountsWrap">
                                            <table className="table tableSticky">
                                              <thead>
                                                <tr>
                                                  <th>Consumo</th>
                                                  <th style={{ textAlign: 'right' }}>Presupuesto</th>
                                                  <th style={{ textAlign: 'right' }}>Gastado</th>
                                                  <th style={{ textAlign: 'right' }}>Disponible</th>
                                                  <th>A quién</th>
                                                  <th />
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {budgetObjectsSelectedView.accountsView.map((r: any) => {
                                                  const over = Number(r.available) < 0
                                                  const spenders = Array.isArray(r?.spenders) ? r.spenders : []
                                                  return (
                                                    <tr key={r.allocationId}>
                                                      <td>
                                                        <div style={{ fontWeight: 900 }}>{r.categoryName}</div>
                                                        <div className="muted" style={{ marginTop: 2 }}>
                                                          {String(budgetObjectsSelectedView.entityName || '—')}{' '}
                                                          <span className="muted">({entityTypeLabel(budgetObjectsSelectedView.entityType)})</span>
                                                        </div>
                                                      </td>
                                                      <td style={{ textAlign: 'right', fontWeight: 900 }}>
                                                        {formatMoney(Number(r.budgetAnnual) || 0, currency)}
                                                      </td>
                                                      <td style={{ textAlign: 'right' }}>{formatMoney(Number(r.spent) || 0, currency)}</td>
                                                      <td style={{ textAlign: 'right', fontWeight: 900 }}>
                                                        <span className={over ? 'pill pillBad' : 'pill pillOk'}>
                                                          {formatMoney(Number(r.available) || 0, currency)}
                                                        </span>
                                                      </td>
                                                      <td>
                                                        {spenders.length ? (
                                                          <div className="peopleBreakdown" title="Según transacciones del año">
                                                            {spenders.slice(0, 3).map((s: any) => (
                                                              <span key={s.userId} className="peopleChip">
                                                                {displayPersonName(s.name)} {formatMoney(Number(s.amount) || 0, currency)}
                                                              </span>
                                                            ))}
                                                            {spenders.length > 3 ? (
                                                              <span className="peopleChip peopleChipMuted">+{spenders.length - 3} más</span>
                                                            ) : null}
                                                          </div>
                                                        ) : (
                                                          <span className="muted">—</span>
                                                        )}
                                                      </td>
                                                      <td style={{ textAlign: 'right' }}>
                                                        <button
                                                          className="btn btnGhost btnSm"
                                                          type="button"
                                                          disabled={!meOk?.isFamilyAdmin}
                                                          onClick={() => {
                                                            setBudgetReturnToIntegranteUserId(null)
                                                            setPeopleBudgetOpen(false)
                                                            setPeopleBudgetNamesOpen(false)
                                                            setPeopleBudgetQuery('')
                                                            setPeopleBudgetCategoryFocusId('all')
                                                            openBudgetModal(String(r.allocationId))
                                                          }}
                                                          title={!meOk?.isFamilyAdmin ? 'Solo admin puede editar presupuestos' : 'Editar cuenta'}
                                                        >
                                                          Editar
                                                        </button>
                                                      </td>
                                                    </tr>
                                                  )
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        ) : (
                                          <div className="peopleEmpty">
                                            <div className="muted">
                                              {budgetObjectsSelectedView.categoryNameView
                                                ? `Sin cuentas para ${budgetObjectsSelectedView.categoryNameView} en este destino.`
                                                : 'Sin cuentas para este destino.'}{' '}
                                              Tip: crea la cuenta en Presupuesto (Bloque 1, pestaña Presupuesto).
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="card">
                                    <div className="cardBody muted">Selecciona un destino.</div>
                                  </div>
                                )
                              ) : (
                                <div className="card">
                                  <div className="cardHeader">
                                    <div>
                                      <h3 className="cardTitle">Matriz (comparación)</h3>
                                      <div className="cardDesc">
                                        Por categoría •{' '}
                                        {peopleBudgetMetric === 'budget'
                                          ? 'Presupuesto'
                                          : peopleBudgetMetric === 'available'
                                            ? 'Disponible'
                                            : 'Gastado'}{' '}
                                        • Columnas: Destinos
                                      </div>
                                    </div>
                                    <span className="pill">Scroll horizontal</span>
                                  </div>
                                  <div className="cardBody peopleCardBodyTight">
                                    <div className="peopleMatrixWrap">
                                      <table className="table tableSticky peopleMatrixTable">
                                        <thead>
                                          <tr>
                                            <th>De qué (Categoría)</th>
                                            {peopleBudgetMatrixObjects.map((o: any) => (
                                              <th key={o.entityId}>
                                                <div className="peopleMatrixHeadLabel" title={`${entityTypeLabel(o.entityType)}: ${String(o.entityName || '—')}`}>
                                                  {String(o.entityName || '—')}
                                                </div>
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {peopleBudgetMatrixObjects.length ? (
                                            <tr className="peopleMatrixTotalsRow">
                                              <td className="peopleMatrixTotalsLabel">TOTAL</td>
                                              {peopleBudgetMatrixObjects.map((o: any) => {
                                                const v =
                                                  peopleBudgetMetric === 'budget'
                                                    ? Number(o?.budgetAnnual) || 0
                                                    : peopleBudgetMetric === 'available'
                                                      ? Number(o?.available) || 0
                                                      : Number(o?.spent) || 0
                                                const isNeg = peopleBudgetMetric === 'available' && v < 0
                                                return (
                                                  <td
                                                    key={o.entityId}
                                                    className={`peopleMatrixCell peopleMatrixTotalCell ${isNeg ? 'peopleMatrixCellNeg' : ''}`}
                                                  >
                                                    {formatMoney(v, currency)}
                                                  </td>
                                                )
                                              })}
                                            </tr>
                                          ) : null}
                                          {budgetObjectsMatrix.rows.length ? (
                                            budgetObjectsMatrix.rows.map((row: any) => (
                                              <tr key={row.id}>
                                                <td>
                                                  <div className="peopleMatrixLabel" title={row.label}>
                                                    {row.label}
                                                  </div>
                                                </td>
                                                {peopleBudgetMatrixObjects.map((o: any) => {
                                                  const v = Number(row.values[String(o.entityId)] || 0)
                                                  const isNeg = peopleBudgetMetric === 'available' && v < 0
                                                  return (
                                                    <td key={o.entityId} className={`peopleMatrixCell ${isNeg ? 'peopleMatrixCellNeg' : ''}`}>
                                                      {formatMoney(v, currency)}
                                                    </td>
                                                  )
                                                })}
                                              </tr>
                                            ))
                                          ) : (
                                            <tr>
                                              <td className="muted" colSpan={1 + peopleBudgetMatrixObjects.length}>
                                                Sin datos para la matriz con el filtro actual.
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              )
                            ) : (
                              <div className="card">
                                <div className="cardBody muted">Aún no hay destinos con presupuesto asignado en esta familia.</div>
                              </div>
                            )}
                          </main>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="chartBox">
                    <div className="sectionRow" style={{ justifyContent: 'space-between' }}>
                      <h3 className="chartTitle" style={{ margin: 0 }}>
                        Cuentas del presupuesto (anual)
                      </h3>
                      <span className="muted">Presupuesto vs Gastado vs Disponible</span>
                    </div>
                    <div className="spacer8" />
                    <div
                      className="fieldGrid"
                      style={{
                        gridTemplateColumns: 'minmax(240px, 1.2fr) repeat(4, minmax(160px, 1fr)) auto',
                        alignItems: 'end',
                      }}
                    >
                      <label>
                        Buscar
                        <input
                          className="input inputSm"
                          placeholder="Ej. Mateo, hipoteca, gasolina…"
                          value={budgetListQuery}
                          onChange={(e) => setBudgetListQuery(e.target.value)}
                        />
                      </label>
                      <label>
                        Destino
                        <select className="select" value={budgetListEntityId} onChange={(e) => setBudgetListEntityId(e.target.value)}>
                          <option value="all">Todos</option>
                          {budgetListEntityOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {entityTypeLabel(o.type)}: {o.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Categoría
                        <select className="select" value={budgetListCategoryId} onChange={(e) => setBudgetListCategoryId(e.target.value)}>
                          <option value="all">Todas</option>
                          {budgetListCategoryOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {(c as any).code ? `${(c as any).code} ${c.name}` : c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Tipo
                        <select className="select" value={budgetListType} onChange={(e) => setBudgetListType(e.target.value as any)}>
                          <option value="all">Todos</option>
                          <option value="individual">Individual</option>
                          <option value="shared">Compartido</option>
                        </select>
                      </label>
                      <label>
                        A quién (quién gastó)
                        <select className="select" value={budgetListSpenderId} onChange={(e) => setBudgetListSpenderId(e.target.value)}>
                          <option value="all">Todos</option>
                          {memberItems.map((m: any) => (
                            <option key={m.id} value={m.id}>
                              {displayPersonName(m.name || m.email || '—')}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="btn btnGhost btnSm"
                        type="button"
                        onClick={() => {
                          setBudgetListQuery('')
                          setBudgetListEntityId('all')
                          setBudgetListCategoryId('all')
                          setBudgetListType('all')
                          setBudgetListSpenderId('all')
                        }}
                      >
                        Limpiar
                      </button>
                    </div>
                    <div className="spacer8" />
                    <div className="sectionRow">
                      <span className="pill">Resultados: {budgetAccountsFilteredSummary.count}</span>
                      <span className="pill">Presupuesto: {formatMoney(budgetAccountsFilteredSummary.budget, currency)}</span>
                      <span className="pill">Gastado: {formatMoney(budgetAccountsFilteredSummary.spent, currency)}</span>
                      <span className={`pill ${budgetAccountsFilteredSummary.remaining >= 0 ? 'pillOk' : 'pillBad'}`}>
                        Disponible: {formatMoney(budgetAccountsFilteredSummary.remaining, currency)}
                      </span>
                      <span className={`pill ${budgetAccountsFilteredSummary.overs === 0 ? 'pillOk' : 'pillWarn'}`}>
                        En rojo: {budgetAccountsFilteredSummary.overs}
                      </span>
                    </div>
                    <div className="spacer8" />
                    {budgetAccounts.length ? (
                      <div className="budgetAccountsTableWrap" role="region" aria-label="Tabla de cuentas">
                        <table className="table">
                        <thead>
                          <tr>
                            <th>Cuenta</th>
                            <th style={{ textAlign: 'right' }}>Presupuesto</th>
                            <th style={{ textAlign: 'right' }}>Gastado</th>
                            <th style={{ textAlign: 'right' }}>Disponible</th>
                            <th style={{ textAlign: 'center' }}>Estado</th>
                            <th title="Se define por el tipo de destino (Persona = Individual; otros = Compartido)">Tipo (auto)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {budgetAccountsFiltered.map((a: any) => {
                            const status =
                              a.status === 'Over'
                                ? { cls: 'pill pillBad', label: 'En rojo' }
                                : a.status === 'Pending'
                                  ? { cls: 'pill', label: 'Pendiente' }
                                  : { cls: 'pill pillOk', label: 'OK' }
                            return (
                              <tr key={a.id} onClick={() => openBudgetModal(String(a.id))} style={{ cursor: 'pointer' }} title="Abrir / editar">
                                <td>
                                  <div style={{ fontWeight: 900 }}>{a.categoryName}</div>
                                  <div className="sectionRow" style={{ marginTop: 2, flexWrap: 'nowrap', gap: 8 }}>
                                    <span
                                      className={`avatarTiny ${String(a?.entityType || '') === 'PERSON' ? 'avatarTinyRound' : ''}`}
                                      aria-hidden="true"
                                      style={a?.entityImageUrl ? { background: '#fff', padding: 0 } : undefined}
                                    >
                                      {a?.entityImageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={String(a.entityImageUrl)} alt="" />
                                      ) : (
                                        initialsFromName(String(a.entityName || '—'))
                                      )}
                                    </span>
                                    <div className="muted">
                                      {a.entityName} <span className="muted">({entityTypeLabel(a.entityType)})</span>
                                    </div>
                                  </div>
                                  {a.type === 'Compartido' && Array.isArray((a as any).spenders) && (a as any).spenders.length ? (
                                    <div className="peopleBreakdown" style={{ marginTop: 6 }}>
                                      <span className="peopleChip peopleChipMuted">A quién</span>
                                      {(a as any).spenders.slice(0, 2).map((s: any) => {
                                        const full = String(s?.name || '—')
                                        const first = String(full.split(' ')[0] || full || '—')
                                        const amt = Number(s?.amount) || 0
                                        return (
                                          <span
                                            key={String(s?.userId || first)}
                                            className="peopleChip"
                                            title={`${full}: ${formatMoney(amt, currency)}`}
                                          >
                                            {first}: {formatMoney(amt, currency)}
                                          </span>
                                        )
                                      })}
                                      {(a as any).spenders.length > 2 ? (
                                        <span className="peopleChip peopleChipMuted">+{(a as any).spenders.length - 2} más</span>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </td>
                                <td style={{ fontWeight: 900, textAlign: 'right' }}>{formatMoney(a.budget, currency)}</td>
                                <td className="muted" style={{ textAlign: 'right' }}>
                                  {formatMoney(a.spent, currency)}
                                </td>
                                <td style={{ fontWeight: 900, textAlign: 'right' }}>{formatMoney(a.remaining, currency)}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className={status.cls}>{status.label}</span>
                                </td>
                                <td className="muted">{a.type}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      </div>
                    ) : (
                      <div className="muted">Aún no hay cuentas con presupuesto asignado. Ve a Presupuesto (Bloque 1 → pestaña Presupuesto).</div>
                    )}
                  </div>

                  <div className="spacer16" />

                  <details className="details">
                    <summary>Resumen del mes (categorías + estado) (opcional)</summary>
                    <div className="spacer16" />
                    <div className="analyticsRow">
                      <div className="chartBox">
                        <h3 className="chartTitle">Categorías (mes actual)</h3>
                        <div className="spacer8" />
                        {categoryReport.length ? (
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Categoría</th>
                                <th>Presup.</th>
                                <th>Gastado</th>
                                <th>Disp.</th>
                                <th>Progreso</th>
                              </tr>
                            </thead>
                            <tbody>
                              {categoryReport.map((r) => {
                                const pct = Math.min(1, Math.max(0, r.progress))
                                return (
                                  <tr key={r.id}>
                                    <td>{r.name}</td>
                                    <td>{formatMoney(r.budget, currency)}</td>
                                    <td>{formatMoney(r.spent, currency)}</td>
                                    <td style={{ fontWeight: 900 }}>{formatMoney(r.available, currency)}</td>
                                    <td className="muted">{(pct * 100).toFixed(0)}%</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        ) : (
                          <div className="muted">Aún no hay categorías con presupuesto asignado en el mes.</div>
                        )}
                      </div>

                      <div className="chartBox">
                        <h3 className="chartTitle">Estado del mes</h3>
                        <div className="spacer8" />
                        <div className="sectionRow">
                          <span className="pill pillOk">Estado: {dashboard.available >= 0 ? 'Saludable' : 'En rojo'}</span>
                          <span className="pill pillWarn">Alertas: {dashboard.overspend}</span>
                          <span className="pill">Reglas activas: 0</span>
                        </div>
                        <div className="spacer16" />
                        <div className="muted">Resumen</div>
                        <div className="spacer8" />
                        <div className="sectionRow">
                          <span className="pill">Total: {formatMoney(dashboard.budgetTotal, currency)}</span>
                          <span className="pill">Gastado: {formatMoney(dashboard.spentThis, currency)}</span>
                          <span className="pill">Disponible: {formatMoney(dashboard.available, currency)}</span>
                        </div>
                      </div>
                    </div>
                  </details>

                  <div className="spacer16" />

                  <details className="details">
                    <summary>Transacciones recientes (opcional)</summary>
                    <div className="spacer16" />
                    {txItems.length ? (
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Destino</th>
                            <th>Categoría</th>
                            <th>Usuario</th>
                            <th>Monto</th>
                            <th>Registro</th>
                            <th>Comprobante</th>
                          </tr>
                        </thead>
                        <tbody>
                          {txItems.slice(0, 12).map((t: any) => (
                            <tr key={t.id} onClick={() => openTx(t.id)} style={{ cursor: 'pointer' }}>
                              <td>{new Date(t.date).toLocaleDateString('es-MX')}</td>
                              <td>
                                <span className="muted">{entityTypeLabel(t.allocation?.entity?.type)}:</span> {t.allocation?.entity?.name || '—'}
                              </td>
                              <td>{t.allocation?.category?.name || '—'}</td>
                              <td>{t.user?.name || t.user?.email || '—'}</td>
                              <td style={{ fontWeight: 900 }}>{formatMoney(Number(t.amount), currency)}</td>
                              <td className="muted" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{t.registrationCode || '—'}</td>
                              <td className="muted">{Array.isArray(t.receipts) ? t.receipts.length : 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="muted">Sin transacciones aún.</div>
                    )}
                  </details>

                </>
              ) : null}

              {view === 'documentos' ? (
                <div className="chartBox">
                  <div className="sectionRow" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                    {documentCategories.map((cat) => {
                      const isDefault = DEFAULT_DOCUMENT_CATEGORIES.includes(cat)
                      const isEditing = documentCategoryEditing === cat
                      if (isEditing) {
                        return (
                          <div key={cat} className="sectionRow" style={{ gap: 6, alignItems: 'center' }}>
                            <input
                              type="text"
                              value={documentCategoryEditName}
                              onChange={(e) => setDocumentCategoryEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  const v = documentCategoryEditName.trim()
                                  if (v && v !== cat) {
                                    fetch('/api/users/me/documents/rename-category', {
                                      method: 'POST',
                                      credentials: 'include',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ oldCategory: cat, newCategory: v }),
                                    })
                                      .then((r) => r.json())
                                      .then((data) => {
                                        if (data?.ok) {
                                          return getJson('/api/users/me/documents')
                                        }
                                        throw new Error(data?.detail || 'Error')
                                      })
                                      .then((r: any) => {
                                        setUserDocuments(Array.isArray(r?.documents) ? r.documents : [])
                                        if (documentsTab === cat) setDocumentsTab(v)
                                        setDocumentCategoryEditing(null)
                                        setDocumentCategoryEditName('')
                                        setMessage('Categoría renombrada.')
                                      })
                                      .catch((err: any) => setMessage(err?.message || 'No se pudo renombrar'))
                                  }
                                }
                                if (e.key === 'Escape') { setDocumentCategoryEditing(null); setDocumentCategoryEditName('') }
                              }}
                              autoFocus
                              style={{ width: 140, padding: '6px 8px', fontSize: 14 }}
                            />
                            <button
                              type="button"
                              className="btn btnSm btnPrimary"
                              onClick={() => {
                                const v = documentCategoryEditName.trim()
                                if (!v || v === cat) { setDocumentCategoryEditing(null); return }
                                fetch('/api/users/me/documents/rename-category', {
                                  method: 'POST',
                                  credentials: 'include',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ oldCategory: cat, newCategory: v }),
                                })
                                  .then((r) => r.json())
                                  .then((data) => {
                                    if (data?.ok) return getJson('/api/users/me/documents')
                                    throw new Error(data?.detail || 'Error')
                                  })
                                  .then((r: any) => {
                                    setUserDocuments(Array.isArray(r?.documents) ? r.documents : [])
                                    if (documentsTab === cat) setDocumentsTab(v)
                                    setDocumentCategoryEditing(null)
                                    setDocumentCategoryEditName('')
                                    setMessage('Categoría renombrada.')
                                  })
                                  .catch((err: any) => setMessage(err?.message || 'No se pudo renombrar'))
                              }}
                            >
                              Guardar
                            </button>
                            <button type="button" className="btn btnSm btnGhost" onClick={() => { setDocumentCategoryEditing(null); setDocumentCategoryEditName('') }}>Cancelar</button>
                          </div>
                        )
                      }
                      return (
                        <div key={cat} className="sectionRow" style={{ gap: 4, alignItems: 'center' }}>
                          <button
                            type="button"
                            className={`btn btnSm ${documentsTab === cat ? 'btnPrimary' : 'btnGhost'}`}
                            onClick={() => setDocumentsTab(cat)}
                          >
                            {getDocumentCategoryLabel(cat)}
                          </button>
                          {!isDefault ? (
                            <button
                              type="button"
                              className="btn btnGhost btnSm"
                              style={{ padding: '2px 6px', minWidth: 0 }}
                              title="Editar nombre de categoría"
                              onClick={(e) => { e.stopPropagation(); setDocumentCategoryEditing(cat); setDocumentCategoryEditName(cat) }}
                              aria-label="Editar categoría"
                            >
                              ✎
                            </button>
                          ) : null}
                        </div>
                      )
                    })}
                    <div className="sectionRow" style={{ alignItems: 'center', gap: 6 }}>
                      <input
                        type="text"
                        placeholder="Nueva categoría (ej. Motocicletas)"
                        value={customDocumentCategory}
                        onChange={(e) => setCustomDocumentCategory(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { const v = customDocumentCategory.trim(); if (v) setDocumentsTab(v); setCustomDocumentCategory(''); } }}
                        style={{ width: 180, padding: '6px 8px', fontSize: 14 }}
                      />
                      <button
                        type="button"
                        className="btn btnSm btnGhost"
                        onClick={() => { const v = customDocumentCategory.trim(); if (v) { setDocumentsTab(v); setCustomDocumentCategory(''); } }}
                      >
                        Ir
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const inSixMonths = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
                    const expiring = userDocuments.filter((d: any) => d.expiresAt && new Date(d.expiresAt) <= inSixMonths && new Date(d.expiresAt) >= new Date()).length
                    const expired = userDocuments.filter((d: any) => d.expiresAt && new Date(d.expiresAt) < new Date()).length
                    const warnCount = expiring + expired
                    if (warnCount === 0) return null
                    return (
                      <div className="alert" style={{ marginBottom: 12, background: 'var(--color-warning-bg, #fff8e1)', borderColor: 'var(--color-warning, #f59e0b)', color: '#92400e' }} role="alert">
                        <span>
                          {expired > 0
                            ? `Tienes ${expired} documento(s) vencido(s) y ${expiring} por vencer en 6 meses. Sube la nueva versión en Mis documentos.`
                            : `Tienes ${expiring} documento(s) por vencer en los próximos 6 meses. Te avisaremos por WhatsApp; sube la nueva versión cuando la tengas.`}
                        </span>
                      </div>
                    )
                  })()}
                  <div className="sectionRow" style={{ alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                    <span className="muted" style={{ width: '100%', marginBottom: 4 }}>Cargar documento (cualquier archivo o imagen, máx 15 MB):</span>
                    <input
                      ref={documentsFileInputRef}
                      type="file"
                      accept="*"
                      style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                      disabled={documentsUploadBusy}
                      onChange={async (e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        const categoryToUse = documentsTab || customDocumentCategory.trim() || 'IDENTIFICACIONES'
                        setDocumentsUploadBusy(true)
                        setMessage('')
                        try {
                          const fd = new FormData()
                          fd.set('file', f)
                          fd.set('category', categoryToUse)
                          const res = await fetch('/api/users/me/documents', {
                            method: 'POST',
                            credentials: 'include',
                            body: fd,
                          })
                          const data = await res.json().catch(() => ({}))
                          if (!res.ok) throw new Error(data.detail || `Error ${res.status}`)
                          const r = await getJson('/api/users/me/documents')
                          setUserDocuments(Array.isArray(r?.documents) ? r.documents : [])
                          setMessage('Listo, documento guardado.')
                          e.target.value = ''
                        } catch (err: any) {
                          setMessage(err?.message || 'Error al subir')
                        } finally {
                          setDocumentsUploadBusy(false)
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btnPrimary"
                      style={{ padding: '10px 20px', fontSize: 15 }}
                      disabled={documentsUploadBusy}
                      onClick={() => documentsFileInputRef.current?.click()}
                    >
                      {documentsUploadBusy ? 'Subiendo…' : 'Subir archivo'}
                    </button>
                    {documentsUploadBusy ? <span className="muted">Subiendo…</span> : null}
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {userDocuments
                      .filter((d: any) => d.category === documentsTab)
                      .map((d: any) => (
                        <li key={d.id} className="sectionRow" style={{ alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ width: 96, height: 96, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: 'var(--border)' }}>
                            {d.thumbnailSignedUrl ? (
                              <img src={d.thumbnailSignedUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 24 }}>📄</div>
                            )}
                          </div>
                          <span style={{ flex: 1, minWidth: 0 }}>{d.name || d.fileName}</span>
                          {d.expiresAt ? <span className="muted" style={{ fontSize: 12 }}>Vence: {new Date(d.expiresAt).toLocaleDateString('es-MX')}</span> : null}
                          <span className="muted" style={{ fontSize: 12 }}>{new Date(d.createdAt).toLocaleDateString('es-MX')}</span>
                          <button
                            type="button"
                            className="btn btnGhost btnSm"
                            onClick={() => {
                              setDocumentDetailId(d.id)
                              setDocumentNewFieldName('')
                              setDocumentEditData({
                                extractedData: (typeof d.extractedData === 'object' && d.extractedData && !Array.isArray(d.extractedData)) ? { ...d.extractedData } : {},
                                expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString().slice(0, 10) : '',
                              })
                            }}
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            className="btn btnGhost btnSm"
                            disabled={documentsDeleteId === d.id}
                            onClick={async () => {
                              if (!confirm('¿Eliminar este documento?')) return
                              setDocumentsDeleteId(d.id)
                              try {
                                await fetch(`/api/users/me/documents/${d.id}`, { method: 'DELETE', credentials: 'include' })
                                setUserDocuments((prev) => prev.filter((x: any) => x.id !== d.id))
                                if (documentDetailId === d.id) { setDocumentDetailId(null); setDocumentNewFieldName('') }
                              } catch (err: any) {
                                setMessage(err?.message || 'Error al eliminar')
                              } finally {
                                setDocumentsDeleteId(null)
                              }
                            }}
                          >
                            {documentsDeleteId === d.id ? '…' : 'Eliminar'}
                          </button>
                        </li>
                      ))}
                  </ul>
                  {userDocuments.filter((d: any) => d.category === documentsTab).length === 0 ? (
                    <p className="muted" style={{ padding: '12px 0' }}>Aún no hay documentos en esta categoría. Puedes crear una nueva categoría arriba (ej. Motocicletas) y subir cualquier archivo.</p>
                  ) : null}
                  {documentDetailId ? (() => {
                    const doc = userDocuments.find((d: any) => d.id === documentDetailId)
                    if (!doc) return null
                    return (
                      <div role="dialog" aria-modal="true" aria-label="Detalle del documento" style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                        <div style={{ background: 'var(--bg)', borderRadius: 12, maxWidth: 520, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                          <div className="sectionRow" style={{ justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                            <h3 style={{ margin: 0, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name || doc.fileName}</h3>
                            <button type="button" className="btn btnGhost btnSm" onClick={() => { setDocumentDetailId(null); setDocumentNewFieldName('') }} aria-label="Cerrar">×</button>
                          </div>
                          <div style={{ padding: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
                            <div style={{ flexShrink: 0 }}>
                              <p className="muted" style={{ margin: '0 0 4px', fontSize: 12 }}>Documento</p>
                              <button
                                type="button"
                                className="btn btnSm btnPrimary"
                                onClick={async () => {
                                  try {
                                    const urlRes = await getJson(`/api/users/me/documents/${doc.id}/download`)
                                    const url = (urlRes as any)?.url
                                    if (!url) {
                                      setMessage('No se pudo obtener el enlace del archivo.')
                                      return
                                    }
                                    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`
                                    const a = document.createElement('a')
                                    a.href = fullUrl
                                    a.target = '_blank'
                                    a.rel = 'noopener noreferrer'
                                    a.click()
                                  } catch {
                                    setMessage('No se pudo abrir el archivo. Revisa tu conexión.')
                                  }
                                }}
                              >
                                Abrir archivo
                              </button>
                            </div>
                            <div style={{ flexShrink: 0 }}>
                              <p className="muted" style={{ margin: '0 0 4px', fontSize: 12 }}>Fecha de vencimiento</p>
                              <input
                                type="date"
                                value={documentEditData.expiresAt}
                                onChange={(e) => setDocumentEditData((prev) => ({ ...prev, expiresAt: e.target.value }))}
                                style={{ padding: '5px 8px', fontSize: 13 }}
                              />
                            </div>
                            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                              <p className="muted" style={{ margin: '0 0 4px', fontSize: 12, flexShrink: 0 }}>Datos extraídos (nombre, número, etc.)</p>
                              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {Object.entries(documentEditData.extractedData).map(([k]) => (
                                  <div key={k} className="sectionRow" style={{ gap: 6, alignItems: 'center', flexShrink: 0 }}>
                                    <input
                                      type="text"
                                      value={documentEditData.extractedData[k] ?? ''}
                                      onChange={(e) => setDocumentEditData((prev) => ({
                                        ...prev,
                                        extractedData: { ...prev.extractedData, [k]: e.target.value },
                                      }))}
                                      placeholder={k}
                                      style={{ flex: 1, padding: '5px 8px', fontSize: 13 }}
                                    />
                                    <button
                                      type="button"
                                      className="btn btnGhost btnSm"
                                      onClick={() => setDocumentEditData((prev) => {
                                        const next = { ...prev.extractedData }; delete next[k]; return { ...prev, extractedData: next }
                                      })}
                                    >
                                      Quitar
                                    </button>
                                  </div>
                                ))}
                                <div className="sectionRow" style={{ gap: 6, flexShrink: 0, alignItems: 'center' }}>
                                  <input
                                    type="text"
                                    placeholder="Nombre del campo (ej. Notas, Referencia)"
                                    value={documentNewFieldName}
                                    onChange={(e) => setDocumentNewFieldName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        const key = documentNewFieldName.trim()
                                        if (key) {
                                          setDocumentEditData((prev) => ({ ...prev, extractedData: { ...prev.extractedData, [key]: '' } }))
                                          setDocumentNewFieldName('')
                                        }
                                      }
                                    }}
                                    style={{ flex: 1, minWidth: 120, padding: '5px 8px', fontSize: 13 }}
                                  />
                                  <button
                                    type="button"
                                    className="btn btnSm btnGhost"
                                    onClick={() => {
                                      const key = documentNewFieldName.trim()
                                      if (key) {
                                        setDocumentEditData((prev) => ({ ...prev, extractedData: { ...prev.extractedData, [key]: '' } }))
                                        setDocumentNewFieldName('')
                                      }
                                    }}
                                  >
                                    Añadir campo
                                  </button>
                                </div>
                              </div>
                              {(() => {
                                const docExpires = doc.expiresAt ? new Date(doc.expiresAt).toISOString().slice(0, 10) : ''
                                const editExpires = (documentEditData.expiresAt || '').slice(0, 10)
                                const docData = (typeof doc.extractedData === 'object' && doc.extractedData && !Array.isArray(doc.extractedData)) ? doc.extractedData : {}
                                const editData = documentEditData.extractedData || {}
                                const sameKeys = Object.keys(docData).length === Object.keys(editData).length && Object.keys(docData).every((k) => editData[k] !== undefined)
                                const sameValues = Object.keys(editData).every((k) => String(editData[k] ?? '') === String(docData[k] ?? ''))
                                const noChanges = editExpires === docExpires && sameKeys && sameValues
                                return (
                                  <button
                                    type="button"
                                    className="btn btnSm btnPrimary"
                                    style={{ marginTop: 8 }}
                                    disabled={documentSaveBusy || noChanges}
                                    onClick={async () => {
                                      setDocumentSaveBusy(true)
                                      try {
                                        await fetch(`/api/users/me/documents/${doc.id}`, {
                                          method: 'PATCH',
                                          credentials: 'include',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            extractedData: documentEditData.extractedData,
                                            expiresAt: documentEditData.expiresAt || null,
                                          }),
                                        })
                                        const r = await getJson('/api/users/me/documents')
                                        setUserDocuments(Array.isArray(r?.documents) ? r.documents : [])
                                        setMessage('Datos y vencimiento guardados.')
                                      } catch (err: any) {
                                        setMessage(err?.message || 'Error al guardar')
                                      } finally {
                                        setDocumentSaveBusy(false)
                                      }
                                    }}
                                  >
                                    {documentSaveBusy ? '…' : 'Guardar datos y vencimiento'}
                                  </button>
                                )
                              })()}
                              {(doc.category === 'IDENTIFICACIONES' || doc.category === 'ACTAS') && (doc.contentType === 'application/pdf' || (doc.contentType && doc.contentType.startsWith('image/'))) ? (
                                <button
                                  type="button"
                                  className="btn btnSm btnGhost"
                                  style={{ marginLeft: 8 }}
                                  disabled={documentExtractBusy}
                                  onClick={async () => {
                                    setDocumentExtractBusy(true)
                                    setMessage('')
                                    try {
                                      const res = await fetch(`/api/users/me/documents/${doc.id}/extract`, { method: 'POST', credentials: 'include' })
                                      const data = await res.json().catch(() => ({}))
                                      if (data.ok) {
                                        const r = await getJson('/api/users/me/documents')
                                        setUserDocuments(Array.isArray(r?.documents) ? r.documents : [])
                                        setDocumentEditData({ extractedData: (data.document?.extractedData && typeof data.document.extractedData === 'object') ? data.document.extractedData : {}, expiresAt: data.document?.expiresAt ? new Date(data.document.expiresAt).toISOString().slice(0, 10) : '' })
                                        setMessage('Datos extraídos correctamente')
                                      } else {
                                        setMessage(data.message || 'No se pudieron extraer datos')
                                      }
                                    } catch (err: any) {
                                      setMessage(err?.message || 'Error')
                                    } finally {
                                      setDocumentExtractBusy(false)
                                    }
                                  }}
                                >
                                  {documentExtractBusy ? '…' : 'Intentar extraer datos de nuevo'}
                                </button>
                              ) : null}
                            </div>
                            <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                              <div className="sectionRow" style={{ flexWrap: 'wrap', gap: 8 }}>
                                <span className="muted" style={{ width: '100%', marginBottom: 4, fontSize: 12 }}>Compartir</span>
                              <button
                                type="button"
                                className="btn btnSm btnGhost"
                                onClick={async () => {
                                  try {
                                    const urlRes = await getJson(`/api/users/me/documents/${doc.id}/download`)
                                    const url = (urlRes as any)?.url
                                    if (!url) {
                                      setMessage('No se pudo generar el enlace. Revisa la configuración del almacenamiento.')
                                      return
                                    }
                                    const copied = await copyToClipboard(url)
                                    setMessage(copied ? 'Enlace copiado al portapapeles' : 'No se pudo copiar. Se abrió el enlace en una nueva pestaña.')
                                    if (!copied) {
                                      try {
                                        const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`
                                        const a = document.createElement('a')
                                        a.href = fullUrl
                                        a.target = '_blank'
                                        a.rel = 'noopener noreferrer'
                                        a.click()
                                      } catch { /* solo informar */ }
                                    }
                                  } catch {
                                    setMessage('No se pudo obtener el enlace. Revisa tu conexión.')
                                  }
                                }}
                              >
                                Compartir documento (enlace)
                              </button>
                              <button
                                type="button"
                                className="btn btnSm btnGhost"
                                onClick={async () => {
                                  if (doc.extractedData && typeof doc.extractedData === 'object') {
                                    const text = Object.entries(doc.extractedData).map(([k, v]) => `${k}: ${v}`).join('\n')
                                    const copied = await copyToClipboard(text)
                                    setMessage(copied ? 'Datos copiados' : 'No se pudo copiar. Selecciona el texto y cópialo manualmente.')
                                  } else setMessage('No hay datos extraídos')
                                }}
                              >
                                Compartir datos
                              </button>
                              <button
                                type="button"
                                className="btn btnSm btnGhost"
                                onClick={async () => {
                                  try {
                                    const urlRes = await getJson(`/api/users/me/documents/${doc.id}/download`)
                                    const url = (urlRes as any)?.url || ''
                                    const text = (doc.extractedData && typeof doc.extractedData === 'object')
                                      ? Object.entries(doc.extractedData).map(([k, v]) => `${k}: ${v}`).join('\n')
                                      : ''
                                    const toCopy = url ? (text ? `${text}\n\nEnlace: ${url}` : url) : text
                                    if (!toCopy) {
                                      setMessage('No hay enlace ni datos para copiar.')
                                      return
                                    }
                                    const copied = await copyToClipboard(toCopy)
                                    setMessage(copied ? 'Copiado (datos y enlace)' : 'No se pudo copiar. Cópialo manualmente.')
                                  } catch {
                                    setMessage('No se pudo obtener el enlace. Revisa tu conexión.')
                                  }
                                }}
                              >
                                Compartir ambos
                              </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })() : null}
                </div>
              ) : null}

              {view === 'cosas' ? (
                <div className="chartBox">
                  <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                    <p className="muted" style={{ margin: 0 }}>Dispositivos, auto, bicicleta, servicios: marca, modelo, serie, fecha de adquisición, factura, garantía, contacto del proveedor y registros de mantenimiento. Pregunta por WhatsApp: &quot;¿qué serie es mi computadora?&quot;, &quot;¿cuánto le falta al servicio?&quot;, &quot;¿qué placas tiene mi carro?&quot;</p>
                    <button type="button" className="btn btnPrimary btnSm" onClick={() => { setCosasFormThing(null); setCosasFormOpen(true) }}>
                      Añadir cosa
                    </button>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {userThings.map((t: any) => (
                      <li key={t.id} style={{ borderBottom: '1px solid var(--border)', padding: '12px 0' }}>
                        <div className="sectionRow" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                          <span className="pill" style={{ fontSize: 11 }}>{t.type}</span>
                          <strong>{t.name}</strong>
                          {t.brand || t.model ? <span className="muted">{[t.brand, t.model].filter(Boolean).join(' ')}</span> : null}
                          {t.serialNumber ? <span className="muted" style={{ fontSize: 12 }}>Serie: {t.serialNumber}</span> : null}
                          <button type="button" className="btn btnGhost btnSm" onClick={() => { setCosasDetailId(cosasDetailId === t.id ? null : t.id) }}>{cosasDetailId === t.id ? 'Ocultar' : 'Ver'}</button>
                          <button type="button" className="btn btnGhost btnSm" onClick={() => { setCosasFormThing(t); setCosasFormOpen(true) }}>Editar</button>
                          <button type="button" className="btn btnGhost btnSm" onClick={async () => { if (!confirm('¿Eliminar esta cosa y sus registros?')) return; try { await fetch(`/api/users/me/things/${t.id}`, { method: 'DELETE', credentials: 'include' }); setUserThings((prev: any[]) => prev.filter((x: any) => x.id !== t.id)); if (cosasDetailId === t.id) setCosasDetailId(null); } catch (e: any) { setMessage(e?.message || 'Error') } }}>Eliminar</button>
                        </div>
                        {cosasDetailId === t.id ? (
                          <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-subtle)', borderRadius: 8 }}>
                            <p style={{ margin: '0 0 8px' }}><strong>Marca:</strong> {t.brand || '—'} <strong>Modelo:</strong> {t.model || '—'} <strong>Serie:</strong> {t.serialNumber || '—'}</p>
                            <p style={{ margin: '0 0 8px' }}><strong>Fecha adquisición:</strong> {t.acquisitionDate ? new Date(t.acquisitionDate).toLocaleDateString('es-MX') : '—'} <strong>Garantía:</strong> {t.warrantyInfo || '—'}</p>
                            <p style={{ margin: '0 0 8px' }}><strong>Contacto proveedor/servicio:</strong> {t.serviceProviderContact || '—'}</p>
                            {t.notes ? <p style={{ margin: '0 0 8px' }}><strong>Notas:</strong> {t.notes}</p> : null}
                            {t.extraJson && typeof t.extraJson === 'object' ? <p style={{ margin: '0 0 8px' }}><strong>Datos extra (placas, llantas, etc.):</strong> {JSON.stringify(t.extraJson)}</p> : null}
                            {t.invoiceUrl ? <p style={{ margin: '0 0 8px' }}><a href={t.invoiceUrl} target="_blank" rel="noopener noreferrer">Ver factura</a></p> : null}
                            <p style={{ margin: '0 0 8px' }}>
                              <input type="file" accept=".pdf,image/*,.heic,.HEIC,image/heic" style={{ fontSize: 12 }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.set('file', f); try { await fetch(`/api/users/me/things/${t.id}/invoice`, { method: 'POST', credentials: 'include', body: fd }); const res = await getJson('/api/users/me/things'); setUserThings(Array.isArray(res?.things) ? res.things : []); setMessage('Factura subida'); } catch (err: any) { setMessage(err?.message || 'Error'); } e.target.value = ''; }} />
                              Subir factura (PDF o imagen)
                            </p>
                            <p style={{ margin: '8px 0 4px' }}><strong>Registros de mantenimiento</strong></p>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                              {(t.records || []).map((r: any) => (
                                <li key={r.id} className="sectionRow" style={{ gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                                  <span>{r.recordType}</span>
                                  <span>{new Date(r.date).toLocaleDateString('es-MX')}</span>
                                  {r.nextDueDate ? <span>Próximo: {new Date(r.nextDueDate).toLocaleDateString('es-MX')}</span> : null}
                                  {r.amount ? <span>${r.amount}</span> : null}
                                  {r.description ? <span>{r.description}</span> : null}
                                  <button type="button" className="btn btnGhost btnSm" onClick={async () => { if (!confirm('¿Eliminar este registro?')) return; try { await fetch(`/api/users/me/things/${t.id}/records/${r.id}`, { method: 'DELETE', credentials: 'include' }); const res = await getJson(`/api/users/me/things`); setUserThings(Array.isArray(res?.things) ? res.things : []); } catch (e: any) { setMessage(e?.message || 'Error') } }}>Eliminar</button>
                                </li>
                              ))}
                            </ul>
                            <button type="button" className="btn btnSm btnGhost" style={{ marginTop: 8 }} onClick={async () => {
                              const recordType = prompt('Tipo de registro (ej. SERVICIO, CAMBIO_LLANTAS, VISITA_MEDICA, PAGO)', 'SERVICIO') || 'SERVICIO'
                              const date = prompt('Fecha (YYYY-MM-DD)', new Date().toISOString().slice(0, 10)) || new Date().toISOString().slice(0, 10)
                              const nextDue = prompt('Próximo servicio (YYYY-MM-DD o vacío)', '') || undefined
                              const amount = prompt('Monto (opcional)', '') || undefined
                              const desc = prompt('Descripción', '') || undefined
                              try {
                                await fetch(`/api/users/me/things/${t.id}/records`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordType, date, nextDueDate: nextDue || undefined, amount, description: desc }) })
                                const res = await getJson('/api/users/me/things')
                                setUserThings(Array.isArray(res?.things) ? res.things : [])
                              } catch (e: any) { setMessage(e?.message || 'Error') }
                            }}>+ Añadir registro</button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {userThings.length === 0 ? <p className="muted" style={{ padding: '12px 0' }}>Aún no tienes nada registrado. Añade dispositivos, tu auto, bicicleta o servicios (Internet, médico) para llevar datos y mantenimiento.</p> : null}
                  {cosasFormOpen ? (
                    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                      <div style={{ background: 'var(--bg)', borderRadius: 12, maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
                        <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
                          <h3 style={{ margin: 0 }}>{cosasFormThing ? 'Editar cosa' : 'Nueva cosa'}</h3>
                        </div>
                        <form style={{ padding: 16 }} onSubmit={async (e) => {
                          e.preventDefault()
                          const form = e.currentTarget
                          const type = (form as any).type?.value || 'OTRO'
                          const name = (form as any).name?.value?.trim()
                          if (!name) return setMessage('Nombre requerido')
                          setCosasSaveBusy(true)
                          try {
                            let extraJson: Record<string, string> | undefined
                            try { const ex = (form as any).extraJson?.value?.trim(); extraJson = ex ? JSON.parse(ex) : undefined } catch { setMessage('Datos extra: escribe JSON válido (ej. {"placas": "ABC-123"})'); setCosasSaveBusy(false); return }
                            if (cosasFormThing) {
                              await fetch(`/api/users/me/things/${cosasFormThing.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, name, brand: (form as any).brand?.value?.trim(), model: (form as any).model?.value?.trim(), serialNumber: (form as any).serialNumber?.value?.trim(), acquisitionDate: (form as any).acquisitionDate?.value || null, warrantyInfo: (form as any).warrantyInfo?.value?.trim(), serviceProviderContact: (form as any).serviceProviderContact?.value?.trim(), notes: (form as any).notes?.value?.trim(), extraJson }) })
                            } else {
                              await fetch('/api/users/me/things', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, name, brand: (form as any).brand?.value?.trim(), model: (form as any).model?.value?.trim(), serialNumber: (form as any).serialNumber?.value?.trim(), acquisitionDate: (form as any).acquisitionDate?.value || null, warrantyInfo: (form as any).warrantyInfo?.value?.trim(), serviceProviderContact: (form as any).serviceProviderContact?.value?.trim(), notes: (form as any).notes?.value?.trim(), extraJson }) })
                            }
                            const res = await getJson('/api/users/me/things')
                            setUserThings(Array.isArray(res?.things) ? res.things : [])
                            setCosasFormOpen(false)
                            setCosasFormThing(null)
                          } catch (err: any) { setMessage(err?.message || 'Error') }
                          finally { setCosasSaveBusy(false) }
                        }}>
                          <label className="sectionRow" style={{ marginBottom: 8 }}><span style={{ width: 140 }}>Tipo</span>
                            <select name="type" defaultValue={cosasFormThing?.type || 'DISPOSITIVO'} style={{ padding: 6 }}>
                              <option value="DISPOSITIVO">Dispositivo</option>
                              <option value="AUTO">Auto</option>
                              <option value="BICICLETA">Bicicleta</option>
                              <option value="SERVICIO_INTERNET">Servicio Internet</option>
                              <option value="VISITA_MEDICA">Visita médica / Doctor</option>
                              <option value="OTRO">Otro</option>
                            </select>
                          </label>
                          <label className="sectionRow" style={{ marginBottom: 8 }}><span style={{ width: 140 }}>Nombre *</span><input name="name" type="text" defaultValue={cosasFormThing?.name} required style={{ flex: 1, padding: 6 }} placeholder="Ej. Mi laptop, Carro, Internet casa" /></label>
                          <label className="sectionRow" style={{ marginBottom: 8 }}><span style={{ width: 140 }}>Marca</span><input name="brand" type="text" defaultValue={cosasFormThing?.brand} style={{ flex: 1, padding: 6 }} /></label>
                          <label className="sectionRow" style={{ marginBottom: 8 }}><span style={{ width: 140 }}>Modelo</span><input name="model" type="text" defaultValue={cosasFormThing?.model} style={{ flex: 1, padding: 6 }} /></label>
                          <label className="sectionRow" style={{ marginBottom: 8 }}><span style={{ width: 140 }}>Número de serie</span><input name="serialNumber" type="text" defaultValue={cosasFormThing?.serialNumber} style={{ flex: 1, padding: 6 }} /></label>
                          <label className="sectionRow" style={{ marginBottom: 8 }}><span style={{ width: 140 }}>Fecha adquisición</span><input name="acquisitionDate" type="date" defaultValue={cosasFormThing?.acquisitionDate ? new Date(cosasFormThing.acquisitionDate).toISOString().slice(0, 10) : ''} style={{ flex: 1, padding: 6 }} /></label>
                          <label className="sectionRow" style={{ marginBottom: 8 }}><span style={{ width: 140 }}>Garantía</span><input name="warrantyInfo" type="text" defaultValue={cosasFormThing?.warrantyInfo} style={{ flex: 1, padding: 6 }} placeholder="Ej. 2 años, hasta 2026" /></label>
                          <label className="sectionRow" style={{ marginBottom: 8 }}><span style={{ width: 140 }}>Contacto proveedor/servicio</span><input name="serviceProviderContact" type="text" defaultValue={cosasFormThing?.serviceProviderContact} style={{ flex: 1, padding: 6 }} placeholder="Teléfono o nombre del taller, médico, etc." /></label>
                          <label className="sectionRow" style={{ marginBottom: 12 }}><span style={{ width: 140 }}>Notas</span><textarea name="notes" defaultValue={cosasFormThing?.notes} rows={2} style={{ flex: 1, padding: 6 }} /></label>
                          {cosasFormThing ? <label className="sectionRow" style={{ marginBottom: 12 }}><span style={{ width: 140 }}>Datos extra (placas, llantas…)</span><textarea name="extraJson" rows={2} style={{ flex: 1, padding: 6, fontFamily: 'monospace' }} placeholder='{"placas": "ABC-123", "llantasMarca": "Michelin"}' defaultValue={cosasFormThing?.extraJson ? JSON.stringify(cosasFormThing.extraJson, null, 0) : ''} /></label> : null}
                          <div className="sectionRow" style={{ gap: 8 }}>
                            <button type="submit" className="btn btnPrimary" disabled={cosasSaveBusy}>{cosasSaveBusy ? '…' : 'Guardar'}</button>
                            <button type="button" className="btn btnGhost" onClick={() => { setCosasFormOpen(false); setCosasFormThing(null) }}>Cancelar</button>
                          </div>
                        </form>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {view === 'transacciones' ? (
                <>
                  {lastDuplicateWarning && (
                    <div className="backgroundDoneBanner sectionRow" role="alert" style={{ marginBottom: 12, background: 'var(--color-warning-bg, #fff8e1)', borderColor: 'var(--color-warning, #f59e0b)' }}>
                      <span className="backgroundDoneText">Posible duplicado: ya existe un gasto del {lastDuplicateWarning.date} por {formatMoney(Number(lastDuplicateWarning.amount))}{lastDuplicateWarning.description ? ` — ${lastDuplicateWarning.description.slice(0, 35)}${lastDuplicateWarning.description.length > 35 ? '…' : ''}` : ''}.</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button type="button" className="btn btnGhost btnSm" onClick={() => { openTx(lastDuplicateWarning.transactionId); setLastDuplicateWarning(null) }}>Ver gasto existente</button>
                        <button type="button" className="btn btnGhost btnSm" aria-label="Cerrar" onClick={() => setLastDuplicateWarning(null)}>×</button>
                      </div>
                    </div>
                  )}
                  <div className="chartBox txBoxTight txCompact txAddBlock">
                    <div className="txAddHeader">
                      <h3 className="txAddTitle">Registrar gasto</h3>
                      <p className="txAddSubtitle">Con o sin comprobante (ticket).</p>
                      <div className="txAddSegmented" role="tablist" aria-label="Modo para registrar gasto">
                        <button
                          className={`txAddSegment ${txAddMode === 'with_receipt' ? 'txAddSegmentActive' : ''}`}
                          type="button"
                          role="tab"
                          aria-selected={txAddMode === 'with_receipt'}
                          onClick={() => setTxAddMode('with_receipt')}
                        >
                          Con comprobante
                        </button>
                        <button
                          className={`txAddSegment ${txAddMode === 'without_receipt' ? 'txAddSegmentActive' : ''}`}
                          type="button"
                          role="tab"
                          aria-selected={txAddMode === 'without_receipt'}
                          onClick={() => setTxAddMode('without_receipt')}
                        >
                          Sin comprobante
                        </button>
                      </div>
                    </div>

                    {txAddMode === 'with_receipt' ? (
                      <div className="txAddReceiptIntro">
                        <p className="txAddReceiptText">
                          Sube la foto del ticket; puedes asignar categoría y cuenta después. La extracción sigue en segundo plano.
                        </p>
                        <button
                          className="txAddReceiptBtn"
                          type="button"
                          onClick={() => {
                            setTxReceiptWizardOpen(true)
                            setTxReceiptWizardStep('capture')
                            setTxReceiptAssignTo('me')
                            setTxNewReceiptAllocationId('')
                            setTxReceiptManualAmount('')
                            setTxReceiptAssignUserId('')
                          }}
                        >
                          Registrar gasto con comprobante
                        </button>
                      </div>
                    ) : (
                      <div className="txAddManualGrid">
                        <label>
                          Cuenta / asignación
                          <select className="select" value={txAllocationId} onChange={(e) => setTxAllocationId(e.target.value)} disabled={loading}>
                            <option value="">Cuenta…</option>
                            {(allocations || []).map((a: any) => (
                              <option key={a.id} value={a.id}>
                                {a.entity?.name} → {a.category?.name} (límite {formatMoney(Number(a.monthlyLimit), currency)})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Monto
                          <input
                            className="input"
                            placeholder="Ej. 1299"
                            value={txAmount}
                            onChange={(e) => setTxAmount(e.target.value)}
                            inputMode="decimal"
                            disabled={loading}
                          />
                        </label>
                        <label>
                          Fecha
                          <input type="date" className="input" value={txDate} onChange={(e) => setTxDate(e.target.value)} disabled={loading} />
                        </label>
                        <label className="txSpanAll">
                          Descripción (opcional)
                          <input
                            className="input"
                            placeholder="Ej. Compra rápida"
                            value={txDesc}
                            onChange={(e) => setTxDesc(e.target.value)}
                            disabled={loading}
                          />
                        </label>
                        <div className="txAddActions txSpanAll">
                          <button
                            className="txAddManualSubmit btn btnPrimary"
                            onClick={createTransaction}
                            disabled={loading || !txAllocationId || !txAmount.trim()}
                            type="button"
                          >
                            Registrar gasto
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {txReceiptWizardOpen ? (
                    <div
                      className="modalOverlay txReceiptWizardOverlay modalOverlayOpaque"
                      onClick={() => {
                        if (!txNewReceiptBusy) {
                          setTxReceiptWizardOpen(false)
                          setTxReceiptWizardStep('capture')
                        }
                      }}
                    >
                      <div
                        className="modalPanel receiptWizardPanel"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="receipt-wizard-title"
                      >
                        <button
                          type="button"
                          className="btn btnGhost btnSm modalMenuBtn"
                          title="Abrir menú"
                          onClick={() => {
                            if (!txNewReceiptBusy) {
                              setTxReceiptWizardOpen(false)
                              setTxReceiptWizardStep('capture')
                              setMobileNavOpen(true)
                            }
                          }}
                        >
                          Menú
                        </button>
                        <button
                          type="button"
                          className="btn btnDanger btnSm modalClose"
                          aria-label="Cerrar"
                          onClick={() => {
                            if (!txNewReceiptBusy) {
                              setTxReceiptWizardOpen(false)
                              setTxReceiptWizardStep('capture')
                            }
                          }}
                        >
                          Cerrar
                        </button>
                        <div className="modalToolbar">
                          <h2 id="receipt-wizard-title" className="cardTitle" style={{ margin: 0 }}>
                            {txReceiptWizardStep === 'capture' ? 'Nuevo gasto con comprobante' : 'Asignar a quién'}
                          </h2>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {txReceiptWizardStep === 'capture'
                              ? '1) Añade fotos (Cámara o Seleccionar). 2) "Registrar otro gasto" guarda en Transacciones y puedes repetir. 3) "Asignar" → eliges categoría → Guardar. La extracción del texto es en segundo plano.'
                              : 'Elige categoría y pulsa Guardar. El gasto queda en Transacciones.'}
                          </div>
                        </div>

                        {lastBackgroundReceiptDone && (
                          <div className="backgroundDoneBanner" role="status">
                            <span className="backgroundDoneText">✓ {lastBackgroundReceiptDone.message} · {lastBackgroundReceiptDone.at}</span>
                            <button type="button" className="btn btnGhost btnSm" aria-label="Cerrar aviso" onClick={() => setLastBackgroundReceiptDone(null)}>×</button>
                          </div>
                        )}

                        {lastDuplicateWarning && (
                          <div className="backgroundDoneBanner" role="alert" style={{ background: 'var(--color-warning-bg, #fff8e1)', borderColor: 'var(--color-warning, #f59e0b)' }}>
                            <span className="backgroundDoneText">
                              Posible duplicado: ya existe un gasto del {lastDuplicateWarning.date} por {formatMoney(Number(lastDuplicateWarning.amount))}{lastDuplicateWarning.description ? ` — ${lastDuplicateWarning.description.slice(0, 40)}${lastDuplicateWarning.description.length > 40 ? '…' : ''}` : ''}.
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button type="button" className="btn btnGhost btnSm" onClick={() => { openTx(lastDuplicateWarning.transactionId); setLastDuplicateWarning(null) }}>
                                Ver gasto existente
                              </button>
                              <button type="button" className="btn btnGhost btnSm" aria-label="Cerrar aviso" onClick={() => setLastDuplicateWarning(null)}>×</button>
                            </div>
                          </div>
                        )}

                        {duplicateConfirmPending ? (
                          <div className="chartBox" style={{ borderColor: 'var(--color-danger, #c62828)', background: 'rgba(198, 40, 40, 0.06)' }}>
                            <div className="sectionRow" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                              <span className="muted">
                                Posible duplicado. Ya existe un gasto similar: ${duplicateConfirmPending.duplicateWarning.amount}, {duplicateConfirmPending.duplicateWarning.date}. ¿Descartar o registrar de todos modos?
                              </span>
                              <button type="button" className="btn btnGhost btnSm" onClick={() => { setDuplicateConfirmPending(null); duplicateConfirmFileRef.current = null }}>Descartar</button>
                              <button type="button" className="btn btnPrimary btnSm" disabled={txNewReceiptBusy} onClick={() => confirmDuplicateAndRegister()}>Registrar de todos modos</button>
                              <button type="button" className="btn btnGhost btnSm" aria-label="Cerrar" onClick={() => { setDuplicateConfirmPending(null); duplicateConfirmFileRef.current = null }}>×</button>
                            </div>
                          </div>
                        ) : null}

                        {txReceiptWizardStep === 'capture' ? (
                          <div className="receiptWizardCapture">
                            <label>
                              A. Monto (opcional)
                              <input
                                className="input"
                                type="text"
                                inputMode="decimal"
                                placeholder="Ej. 1000"
                                value={txReceiptManualAmount}
                                onChange={(e) => setTxReceiptManualAmount(e.target.value)}
                                disabled={txNewReceiptBusy}
                              />
                            </label>
                            <label>
                              B. Categoría (opcional)
                              <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>
                                La categoría puede sugerirse cuando termine la extracción del ticket.
                              </span>
                              <select
                                className="select"
                                value={txNewReceiptAllocationId}
                                onChange={(e) => setTxNewReceiptAllocationId(e.target.value)}
                                disabled={txNewReceiptBusy}
                              >
                                <option value="">Asignar después</option>
                                {(allocations || []).map((a: any) => (
                                  <option key={a.id} value={a.id}>
                                    {a.entity?.name} → {a.category?.name} (límite {formatMoney(Number(a.monthlyLimit), currency)})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="txFileField">
                              <div className="txFieldLabel">C. Fotos (1–8) *</div>
                              <div className="txFileRow">
                                <input
                                  key={txReceiptWizardFileInputKey}
                                  id="txReceiptWizardFiles"
                                  className="txFileInput"
                                  type="file"
                                  multiple
                                  accept="image/*"
                                  onChange={(e) => {
                                    const added = Array.from(e.target.files || [])
                                    setTxNewReceiptFiles((p) => [...p, ...added].slice(0, 8))
                                    e.target.value = ''
                                    if (added.length > 0) {
                                      if (added.length === 1) {
                                        showToast('info', 'Se añadió 1 foto. Para más recibos, pulsa otra vez "Seleccionar" o "Cámara" (en móvil suele añadirse de una en una).')
                                      } else {
                                        showToast('info', `Se añadieron ${added.length} fotos.`)
                                      }
                                    }
                                  }}
                                  disabled={loading || txNewReceiptBusy}
                                />
                                <label htmlFor="txReceiptWizardFiles" className="btn receiptWizardPhotoBtn">
                                  <span className="receiptWizardPhotoIcon" aria-hidden>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="2" y="2" width="12" height="12" rx="2" />
                                      <rect x="10" y="10" width="12" height="12" rx="2" />
                                    </svg>
                                  </span>
                                  Seleccionar
                                </label>
                                <button
                                  type="button"
                                  className="btn receiptWizardPhotoBtn"
                                  disabled={loading || txNewReceiptBusy || txNewReceiptFiles.length >= 8}
                                  onClick={() => setTxScanOpen(true)}
                                  aria-label="Abrir cámara para escanear"
                                >
                                  <span className="receiptWizardPhotoIcon" aria-hidden>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                                      <circle cx="12" cy="13" r="4" />
                                    </svg>
                                  </span>
                                  Cámara
                                </button>
                                <span className="muted txFileStatus">
                                  {txNewReceiptFiles.length
                                    ? `${txNewReceiptFiles.length} foto${txNewReceiptFiles.length === 1 ? '' : 's'}`
                                    : 'Ninguna seleccionada'}
                                </span>
                              </div>
                              <div className="muted txHelper">Tip: ticket largo → 20–30% de traslape.</div>
                            </div>
                            {txScanOpen ? (
                              <TicketCaptureModal
                                onConfirm={(file, _bwFile) => {
                                  setTxNewReceiptFiles((prev) => [...prev, file].slice(0, 8))
                                }}
                                onClose={() => setTxScanOpen(false)}
                                maxFiles={8}
                                currentCount={txNewReceiptFiles.length}
                              />
                            ) : null}
                            <p className="muted receiptWizardHelper" style={{ fontSize: 12 }}>
                              Cada foto = un gasto. En muchos móviles al elegir &quot;varias&quot; solo se añade 1: pulsa <strong>Seleccionar</strong> o <strong>Cámara</strong> varias veces (una por recibo). Revisa el número al lado: &quot;3 fotos&quot; = 3 gastos. Luego &quot;Registrar otro gasto&quot; o &quot;Asignar → Guardar&quot;.
                            </p>
                            <div className="receiptWizardActions">
                              <button
                                className="btn btnPrimary"
                                type="button"
                                disabled={txNewReceiptBusy || !txNewReceiptFiles.length}
                                onClick={async () => {
                                  await createTransactionFromReceipt({ openDetail: false, awaitExtraction: false })
                                  setTxReceiptManualAmount('')
                                  setTxNewReceiptAllocationId('')
                                  setTxReceiptWizardFileInputKey((k) => k + 1)
                                }}
                              >
                                {txNewReceiptUploadProgress
                                  ? `Subiendo ${txNewReceiptUploadProgress.current}/${txNewReceiptUploadProgress.total}…`
                                  : txNewReceiptBusy
                                    ? 'Registrando…'
                                    : 'Registrar otro gasto'}
                              </button>
                              <button
                                className="btn btnGhost"
                                type="button"
                                disabled={txNewReceiptBusy || !txNewReceiptFiles.length}
                                onClick={() => setTxReceiptWizardStep('assign')}
                              >
                                Asignar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="receiptWizardAssign">
                            <div className="tabRow" role="tablist" aria-label="A quién">
                              <button
                                type="button"
                                role="tab"
                                aria-selected={txReceiptAssignTo === 'me'}
                                className={`tabBtn ${txReceiptAssignTo === 'me' ? 'tabBtnActive' : ''}`}
                                onClick={() => setTxReceiptAssignTo('me')}
                              >
                                Yo
                              </button>
                              <button
                                type="button"
                                role="tab"
                                aria-selected={txReceiptAssignTo === 'others'}
                                className={`tabBtn ${txReceiptAssignTo === 'others' ? 'tabBtnActive' : ''}`}
                                onClick={() => setTxReceiptAssignTo('others')}
                              >
                                Otros usuarios
                              </button>
                            </div>
                            <div className="spacer8" />
                            {txReceiptAssignTo === 'me' ? (
                              <>
                                <label>
                                  {receiptWizardAllocationsForMe.length === 0 ? 'Cuenta / categoría' : 'Mi cuenta / categoría'}
                                  <select
                                    className="select"
                                    value={txNewReceiptAllocationId}
                                    onChange={(e) => setTxNewReceiptAllocationId(e.target.value)}
                                    disabled={txNewReceiptBusy}
                                  >
                                    <option value="">Elige…</option>
                                    {(receiptWizardAllocationsForMe.length > 0 ? receiptWizardAllocationsForMe : allocationItems.filter((a: any) => a?.isActive !== false)).map((a: any) => (
                                      <option key={a.id} value={a.id}>
                                        {a.entity?.name} → {a.category?.name} (límite {formatMoney(Number(a.monthlyLimit), currency)})
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                {receiptWizardAllocationsForMe.length === 0 ? (
                                  <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                                    No hay destino «tuyo»; aquí puedes asignar a Casa, Auto, etc. Para crear destinos y presupuesto:{' '}
                                    <button
                                      type="button"
                                      className="btn btnGhost btnSm"
                                      style={{ padding: 0, minHeight: 0, fontWeight: 700, textDecoration: 'underline' }}
                                      onClick={() => {
                                        setTxReceiptWizardOpen(false)
                                        setTxReceiptWizardStep('capture')
                                        go('presupuesto')
                                      }}
                                    >
                                      Ir a Presupuesto
                                    </button>
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <>
                                <label>
                                  Asignar gasto a (niño, enfermo, etc.)
                                  <select
                                    className="select"
                                    value={txReceiptAssignUserId}
                                    onChange={(e) => setTxReceiptAssignUserId(e.target.value)}
                                    disabled={txNewReceiptBusy}
                                  >
                                    <option value="">Selecciona usuario…</option>
                                    {receiptWizardOtherUsers.map((u: any) => (
                                      <option key={u.id} value={u.id}>
                                        {u.name}{u.isAdmin ? ' (Admin)' : ''}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                                  Para gastos que no son tuyos (ej. medicina para otro familiar). El gasto se registra en la cuenta de esa persona.
                                </p>
                              </>
                            )}
                            <div className="spacer12" />
                            <div className="sectionRow" style={{ gap: 8, flexWrap: 'wrap' }}>
                              <button
                                className="btn btnGhost"
                                type="button"
                                disabled={txNewReceiptBusy}
                                onClick={() => setTxReceiptWizardStep('capture')}
                              >
                                Atrás
                              </button>
                              <button
                                className="btn btnPrimary"
                                type="button"
                                disabled={txNewReceiptBusy || !txNewReceiptFiles.length || (txReceiptAssignTo === 'me' && !txNewReceiptAllocationId && (receiptWizardAllocationsForMe.length > 0 || allocationItems.filter((a: any) => a?.isActive !== false).length > 0)) || (txReceiptAssignTo === 'others' && !txReceiptAssignUserId)}
                                onClick={async () => {
                                  await createTransactionFromReceipt({ openDetail: false, awaitExtraction: false })
                                  setTxReceiptWizardOpen(false)
                                  setTxReceiptWizardStep('capture')
                                  setTxReceiptManualAmount('')
                                  setTxNewReceiptAllocationId('')
                                }}
                              >
                                {txNewReceiptUploadProgress
                                  ? `Subiendo ${txNewReceiptUploadProgress.current}/${txNewReceiptUploadProgress.total}…`
                                  : txNewReceiptBusy
                                    ? 'Guardando…'
                                    : 'Guardar'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="spacer8" />

                  <details className="details">
                    <summary>Adjuntar comprobante a un gasto existente (opcional)</summary>
                    <div className="spacer8" />
                    <div className="chartBox">
                      <h3 className="chartTitle">Adjuntar comprobante</h3>
                      <div className="spacer8" />
                      <div className="fieldRow">
                        <label>
                          Gasto existente
                          <select className="select" value={receiptTxId} onChange={(e) => setReceiptTxId(e.target.value)} disabled={loading}>
                            <option value="">Selecciona…</option>
                            {txItems.slice(0, 200).map((t: any) => (
                              <option key={t.id} value={t.id}>
                                {formatMoney(Number(t.amount), currency)} — {new Date(t.date).toLocaleDateString('es-MX')} — {t.allocation?.entity?.name} /{' '}
                                {t.allocation?.category?.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Fotos del ticket (1–8)
                          <input
                            className="file"
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => setReceiptFiles(Array.from(e.target.files || []))}
                            disabled={loading}
                          />
                          <div className="muted" style={{ marginTop: 6 }}>
                            {receiptFiles.length
                              ? `${receiptFiles.length} foto${receiptFiles.length === 1 ? '' : 's'} seleccionada${receiptFiles.length === 1 ? '' : 's'}.`
                              : 'Tip: si el ticket es largo, toma varias fotos con 20–30% de traslape.'}
                          </div>
                        </label>
                      </div>
                      <div className="spacer8" />
                      <div className="sectionRow">
                        <button className="btn btnGhost" onClick={uploadReceipt} disabled={loading} type="button">
                          Subir comprobante
                        </button>
                        <span className="muted">Úsalo solo si el gasto ya estaba creado.</span>
                      </div>
                    </div>
                  </details>

                  <div className="spacer8" />

                  <div className="chartBox txBoxTight txCompact">
                    {lastBackgroundReceiptDone && (
                      <div className="backgroundDoneBanner sectionRow" role="status">
                        <span className="backgroundDoneText">✓ {lastBackgroundReceiptDone.message} · {lastBackgroundReceiptDone.at}</span>
                        <button type="button" className="btn btnGhost btnSm" aria-label="Cerrar aviso" onClick={() => setLastBackgroundReceiptDone(null)}>×</button>
                      </div>
                    )}
                    {lastDuplicateWarning && (
                      <div className="backgroundDoneBanner sectionRow" role="alert" style={{ background: 'var(--color-warning-bg, #fff8e1)', borderColor: 'var(--color-warning, #f59e0b)' }}>
                        <span className="backgroundDoneText">Posible duplicado: gasto del {lastDuplicateWarning.date} por {formatMoney(Number(lastDuplicateWarning.amount))}.</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="btn btnGhost btnSm" onClick={() => { openTx(lastDuplicateWarning.transactionId); setLastDuplicateWarning(null) }}>Ver</button>
                          <button type="button" className="btn btnGhost btnSm" aria-label="Cerrar" onClick={() => setLastDuplicateWarning(null)}>×</button>
                        </div>
                      </div>
                    )}
                    <div className="sectionRow" style={{ justifyContent: 'space-between' }}>
                      <h3 className="chartTitle" style={{ margin: 0 }}>
                        Transacciones
                      </h3>
                      <span className="muted">
                        Mostrando {txFilteredItems.length} de {txItems.length} • click en una fila para ver detalle
                      </span>
                    </div>
                    <div className="spacer8" />
                    <div className="txFilterBar txFilterBarIphone">
                      <label>
                        Rango
                        <select className="select" value={txFltRange} onChange={(e) => setTxFltRange(e.target.value as RangeKey)}>
                          <option value="this_month">Mes actual</option>
                          <option value="prev_month">Mes anterior</option>
                          <option value="last_90">Últimos 90 días</option>
                          <option value="all">Todo</option>
                        </select>
                      </label>
                      <label>
                        Desde
                        <input type="date" className="input" value={txFltFrom} onChange={(e) => setTxFltFrom(e.target.value)} />
                      </label>
                      <label>
                        Hasta
                        <input type="date" className="input" value={txFltTo} onChange={(e) => setTxFltTo(e.target.value)} />
                      </label>
                      <label>
                        Comprobante
                        <select className="select" value={txFltReceipt} onChange={(e) => setTxFltReceipt(e.target.value as ReceiptFilter)}>
                          <option value="all">Todos</option>
                          <option value="to_confirm">Por confirmar</option>
                          <option value="with">Con comprobante</option>
                          <option value="without">Sin comprobante</option>
                        </select>
                      </label>
                      <label>
                        Categoría
                        <select className="select" value={txFltCategoryId} onChange={(e) => setTxFltCategoryId(e.target.value)}>
                          <option value="all">Todas</option>
                          {categoryItems
                            .filter((c: any) => c?.isActive !== false)
                            .map((c: any) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Destino
                        <select className="select" value={txFltEntityId} onChange={(e) => setTxFltEntityId(e.target.value)}>
                          <option value="all">Todos</option>
                          {entityItems
                            .filter((o: any) => o?.isActive !== false)
                            .map((o: any) => (
                              <option key={o.id} value={o.id}>
                                {entityTypeLabel(o.type)}: {o.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Usuario
                        <select className="select" value={txFltMemberId} onChange={(e) => setTxFltMemberId(e.target.value)}>
                          <option value="all">Todos</option>
                          {(Array.isArray(members) ? members : []).map((m: any) => (
                            <option key={m.id} value={m.id}>
                              {m.name || m.email}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="txFilterSpan2">
                        Buscar
                        <input className="input" placeholder="Ej. HEB, gasolina, renta…" value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} />
                      </label>
                    </div>

                    <div className="spacer8" />

                    {txFilteredItems.length ? (
                      <table className="table">
                        <thead>
                          <tr>
                            <th style={{ minWidth: 72 }}>Clave</th>
                            <th>Monto</th>
                            <th>Fecha</th>
                            <th>Asignación</th>
                            <th>Usuario</th>
                            <th>Notas</th>
                            <th>Comprobante</th>
                          </tr>
                        </thead>
                        <tbody>
                          {txFilteredItems.map((t: any) => {
                            const receipts = Array.isArray(t.receipts) ? t.receipts : []
                            const pending = receipts.filter((r: any) => !r?.extraction).length
                            const toConfirm = receipts.filter((r: any) => r?.extraction && !r?.extraction?.confirmedAt).length
                            const confirmed = receipts.filter((r: any) => r?.extraction?.confirmedAt).length
                            const hasReceipt = receipts.length > 0
                            const needsAction = toConfirm > 0 || pending > 0
                            const status =
                              !hasReceipt
                                ? { cls: 'pill', label: 'Sin' }
                                : toConfirm > 0
                                  ? { cls: 'pill pillWarn pillPendientePulse', label: `Por confirmar (${toConfirm})` }
                                  : pending > 0
                                    ? { cls: 'pill pillWarn pillPendientePulse', label: `Pendiente (${pending})` }
                                    : confirmed > 0
                                      ? { cls: 'pill pillOk', label: `Confirmado (${confirmed})` }
                                      : { cls: 'pill', label: `Con (${receipts.length})` }
                            return (
                            <tr key={t.id} onClick={() => openTx(t.id)} style={{ cursor: 'pointer' }}>
                              <td className="muted" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 600 }} title="Clave de registro">{t.registrationCode || '—'}</td>
                              <td style={{ fontWeight: 900 }}>{formatMoney(Number(t.amount), currency)}</td>
                              <td>{new Date(t.date).toLocaleDateString('es-MX')}</td>
                              <td>
                                {t.allocation?.entity?.name} / {t.allocation?.category?.name}
                              </td>
                              <td className="muted">{t.user?.name || t.user?.email || '—'}</td>
                              <td className="muted">
                                {t.description || '—'}
                                {(t.description || '').startsWith('Solicitud efectivo') ? <span className="pill pillOk" style={{ marginLeft: 6 }} title="Movimiento por entrega de solicitud de efectivo">Solicitud efectivo</span> : null}
                                {t.pendingReason ? <span className="pill pillWarn" style={{ marginLeft: 6 }} title="Pendiente de categoría/usuario">Pend.</span> : null}
                              </td>
                              <td>
                                <span className={status.cls} title={needsAction ? 'Pendiente por asignar o confirmar' : ''}>{status.label}</span>
                              </td>
                            </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="muted">
                        <p style={{ margin: 0 }}>No hay transacciones con este filtro.</p>
                        {txFltReceipt === 'to_confirm' ? (
                          <p style={{ marginTop: 8, marginBottom: 0 }}>Si buscabas gastos por confirmar, están al día. Cambia el filtro «Comprobante» a «Todos» para ver todas las transacciones.</p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              {view === 'usuarios' ? (
                <section className="card usuariosCardCompact">
                    <div className="cardHeader" style={{ padding: '12px 16px' }}>
                      <div>
                        <h2 className="cardTitle" style={{ margin: 0, fontSize: 18 }}>Usuarios (familia activa)</h2>
                        <p className="cardDesc muted" style={{ marginTop: 4, fontSize: 12 }}>
                          Solo Admin ve «Agregar / invitar». Para crear un usuario con tu autorización: genera un <b>enlace de invitación</b> y compártelo; la persona abre el enlace, se registra y se une. O agrega usuario directo (email + contraseña). «Ver como» (solo Admin) abre la app como ese usuario. La lista muestra solo miembros de la <b>familia activa</b>; si no aparece alguien, invítalo con el enlace o agrégalo abajo. Si <b>Probar Twilio</b> no entrega el mensaje: en modo sandbox de Twilio el contacto debe enviar primero el código de activación al número de WhatsApp de Twilio (consola Twilio → WhatsApp → Sandbox).
                        </p>
                      </div>
                    </div>
                  <div className="cardBody" style={{ padding: '12px 16px' }}>
                    <div className="sectionRow" style={{ marginBottom: 12, alignItems: 'center', gap: 8 }}>
                      <label className="muted" style={{ fontSize: 12 }}>Buscar en la lista</label>
                      <input
                        type="search"
                        className="input"
                        placeholder="Nombre, email o teléfono (sin acentos)"
                        value={usuariosSearchQuery}
                        onChange={(e) => setUsuariosSearchQuery(e.target.value)}
                        style={{ maxWidth: 280 }}
                      />
                      {usuariosSearchQuery.trim() ? (
                        <span className="muted" style={{ fontSize: 12 }}>
                          {usuariosFilteredMembers.length} de {memberItems.length}
                        </span>
                      ) : null}
                    </div>
                    <div className="grid grid2" style={{ gap: 16 }}>
                      {meOk.isFamilyAdmin ? (
                      <div className="cardSub usuariosAddCard">
                        <div className="subTitle" style={{ fontSize: 13, marginBottom: 10, fontWeight: 700 }}>Agregar / invitar</div>
                        <div className="usuariosAddForm">
                          <label>
                            <span className="muted" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Nombre (opcional)</span>
                            <input className="input" placeholder="Ej. Juan Pérez" value={mName} onChange={(e) => setMName(e.target.value)} style={{ width: '100%', minHeight: 40 }} />
                          </label>
                          <label>
                            <span className="muted" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Email</span>
                            <input className="input" type="email" placeholder="correo@ejemplo.com" value={mEmail} onChange={(e) => setMEmail(e.target.value)} style={{ width: '100%', minHeight: 40 }} />
                          </label>
                          <label>
                            <span className="muted" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Teléfono (opcional; para avisar por WhatsApp)</span>
                            <input className="input" type="tel" placeholder="+52 686 123 4567" value={mPhone} onChange={(e) => setMPhone(e.target.value)} style={{ width: '100%', minHeight: 40 }} />
                          </label>
                          <label>
                            <span className="muted" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Contraseña (nuevo usuario)</span>
                            <input className="input" placeholder="Mín. 6 caracteres" type="password" value={mPass} onChange={(e) => setMPass(e.target.value)} style={{ width: '100%', minHeight: 40 }} />
                          </label>
                          <label className="checkboxRow" style={{ alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <input type="checkbox" checked={mAdmin} onChange={(e) => setMAdmin(e.target.checked)} />
                            <span style={{ fontSize: 13 }}>Hacer admin</span>
                          </label>
                          <div className="sectionRow" style={{ marginTop: 12, gap: 8, alignItems: 'center' }}>
                            <button className="btn btnPrimary" onClick={inviteMember} disabled={loading || memberSavingId !== null}>
                              Agregar usuario
                            </button>
                            <span className="muted" style={{ fontSize: 11 }}>Solo Admin.</span>
                          </div>
                        </div>
                        <div className="subTitle" style={{ fontSize: 13, marginTop: 16, marginBottom: 8, fontWeight: 700 }}>Enlace de invitación (recomendado)</div>
                        <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Genera un enlace y compártelo (WhatsApp, correo). La persona abre el enlace, crea su usuario (email y contraseña) y se une a la familia. El enlace es tu autorización; caduca en 7 días.</p>
                        <div className="sectionRow" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <button type="button" className="btn btnGhost btnSm" onClick={createInviteLink} disabled={inviteLoading}>
                            {inviteLoading ? 'Generando…' : 'Generar enlace'}
                          </button>
                          {lastInviteUrl ? (
                            <div style={{ flex: '1', minWidth: 200 }}>
                              <input readOnly className="input" value={lastInviteUrl} style={{ fontSize: 12 }} onClick={(e) => (e.target as HTMLInputElement).select()} />
                              <span className="muted" style={{ fontSize: 11 }}> Caduca en 7 días.</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      ) : null}

                      <div className="cardSub usuariosListaCard" style={{ padding: 12, gridColumn: meOk.isFamilyAdmin ? undefined : '1 / -1' }}>
                        <div className="subTitle" style={{ fontSize: 13, marginBottom: 8 }}>Lista</div>
                        {Array.isArray(members) ? (
                          members.length ? (
                            usuariosFilteredMembers.length === 0 ? (
                              <p className="muted" style={{ margin: 0 }}>Ningún usuario coincide con la búsqueda. Prueba con otro texto o borra el filtro. La lista solo incluye miembros de la familia activa.</p>
                            ) : (
                            <div className="usuariosTableWrap">
                            <input
                              ref={avatarFileInputRef}
                              type="file"
                              accept="image/*"
                              style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) uploadAvatar(f)
                              }}
                              aria-label="Subir avatar"
                            />
                            <table className="table tableSm usuariosTable">
                              <thead>
                                <tr>
                                  <th style={{ width: 52 }}>Avatar</th>
                                  <th style={{ minWidth: 120 }}>Nombre</th>
                                  <th style={{ minWidth: 160 }}>Email</th>
                                  <th style={{ minWidth: 150 }}>Teléfono</th>
                                  <th style={{ minWidth: 100 }}>Ciudad</th>
                                  <th style={{ width: 56 }}>Admin</th>
                                  <th className="thAcciones">Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {usuariosFilteredMembers.map((m: any) => {
                                  const isSelf = m.id === meOk.user.id
                                  const canEdit = meOk.isFamilyAdmin || isSelf
                                  const nameD = memberNameDraft[m.id] ?? String(m.name || '')
                                  const phoneD = memberPhoneDraft[m.id] ?? String(m.phone || '')
                                  const cityD = memberCityDraft[m.id] ?? String(m.city || '')
                                  const changed =
                                    nameD.trim() !== String(m.name || '') ||
                                    phoneD.trim() !== String(m.phone || '') ||
                                    cityD.trim() !== String(m.city || '')
                                  const hasPhone = (phoneD || m.phone || '').replace(/\D/g, '').length >= 10
                                  return (
                                    <tr key={m.id}>
                                      <td style={{ verticalAlign: 'middle' }}>
                                        {m.avatarUrl ? (
                                          <img src={m.avatarUrl} alt="" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--muted)' }}>?</div>
                                        )}
                                        {isSelf ? (
                                          <button
                                            type="button"
                                            className="btn btnGhost btnSm"
                                            style={{ display: 'block', marginTop: 4, fontSize: 11 }}
                                            onClick={() => avatarFileInputRef.current?.click()}
                                            disabled={avatarUploading}
                                          >
                                            {avatarUploading ? 'Subiendo…' : 'Subir avatar'}
                                          </button>
                                        ) : null}
                                      </td>
                                      <td style={{ minWidth: 140 }}>
                                        {canEdit ? (
                                          <input
                                            className="input"
                                            value={nameD}
                                            placeholder="Nombre"
                                            disabled={memberSavingId === m.id}
                                            onChange={(e) =>
                                              setMemberNameDraft((prev) => ({ ...prev, [m.id]: e.target.value }))
                                            }
                                          />
                                        ) : (
                                          <span style={{ fontWeight: 900 }}>{m.name || '—'}</span>
                                        )}
                                      </td>
                                      <td className="muted">{m.email}</td>
                                      <td style={{ minWidth: 150 }}>
                                        {canEdit ? (
                                          <input
                                            className="input"
                                            type="tel"
                                            value={phoneD}
                                            placeholder="+52 686 569 0472"
                                            disabled={memberSavingId === m.id}
                                            onChange={(e) =>
                                              setMemberPhoneDraft((prev) => ({ ...prev, [m.id]: e.target.value }))
                                            }
                                            style={{ minWidth: 130 }}
                                          />
                                        ) : (
                                          <span className="muted">{m.phone || '—'}</span>
                                        )}
                                      </td>
                                      <td style={{ minWidth: 100 }}>
                                        {canEdit ? (
                                          <input
                                            className="input"
                                            value={cityD}
                                            placeholder="Ciudad"
                                            disabled={memberSavingId === m.id}
                                            onChange={(e) =>
                                              setMemberCityDraft((prev) => ({ ...prev, [m.id]: e.target.value }))
                                            }
                                          />
                                        ) : (
                                          <span className="muted">{m.city || '—'}</span>
                                        )}
                                      </td>
                                      <td className="muted">
                                        {meOk.isFamilyAdmin ? (
                                          <input
                                            type="checkbox"
                                            checked={!!m.isFamilyAdmin}
                                            disabled={memberSavingId === m.id}
                                            onChange={(e) => setUserAdmin(m.id, e.target.checked)}
                                          />
                                        ) : m.isFamilyAdmin ? (
                                          'Sí'
                                        ) : (
                                          'No'
                                        )}
                                      </td>
                                      <td className="tdAcciones">
                                        <div className="usuariosAccionesRow">
                                          {canEdit ? (
                                            <button
                                              className="btn btnGhost btnSm"
                                              onClick={() => saveUserProfile(m.id)}
                                              disabled={memberSavingId === m.id || !changed}
                                            >
                                              Guardar
                                            </button>
                                          ) : null}
                                          {isSelf ? (
                                            <button
                                              className="btn btnGhost btnSm"
                                              onClick={() => sendTwilioTest(m.id)}
                                              disabled={twilioTestSendingId !== null || !hasPhone}
                                              title={hasPhone ? 'Envía un mensaje de prueba a tu WhatsApp' : 'Añade y guarda tu teléfono (mín. 10 dígitos) para probar'}
                                            >
                                              {twilioTestSendingId === m.id ? 'Enviando…' : hasPhone ? 'Probar Twilio' : 'Probar Twilio (añade teléfono)'}
                                            </button>
                                          ) : null}
                                          {meOk.isFamilyAdmin ? (
                                            <button
                                              className="btn btnGhost btnSm"
                                              onClick={() => setViewingAsUser({ userId: m.id, name: String(m.name || m.email || 'Usuario') })}
                                              title={isSelf ? 'Ver la app con tu propia vista (modo usuario)' : `Ver la app como ${m.name || m.email || 'este usuario'}`}
                                            >
                                              Ver como {isSelf ? 'yo' : (m.name || m.email || 'usuario')}
                                            </button>
                                          ) : null}
                                          {meOk.isFamilyAdmin ? (
                                            <button
                                              className="btn btnDanger btnSm"
                                              onClick={() => removeUser(m.id)}
                                              disabled={memberSavingId === m.id}
                                            >
                                              {isSelf ? 'Salir' : 'Eliminar'}
                                            </button>
                                          ) : null}
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                            </div>
                            )
                          ) : (
                            <div className="muted">Aún no hay usuarios.</div>
                          )
                        ) : (
                          <div className="muted">Cargando usuarios…</div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {view === 'configuracion' ? (
                <>
                <section className="card configCardPrimary">
                  <div className="cardHeader configCardHeaderWithIcon">
                    <span className="configCardIcon" aria-hidden>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    </span>
                    <div>
                      <h2 className="cardTitle">Configuración de familia</h2>
                      <p className="cardDesc">
                        Aquí defines <strong>quién es la familia</strong> (integrantes, mascotas, vehículos, casa, inventario). Eso forma los <strong>destinos</strong> a los que luego asignas dinero en <strong>Presupuesto</strong>.
                        Usa el asistente para el alta guiada o los accesos de abajo.
                      </p>
                    </div>
                  </div>
                  <div className="cardBody" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="configActionRow">
                      <button
                        type="button"
                        className="btn btnPrimary"
                        onClick={() => router.push('/onboarding')}
                        style={{ minHeight: 48, paddingLeft: 20, paddingRight: 20 }}
                      >
                        Abrir asistente de configuración
                      </button>
                      <span className="muted" style={{ fontSize: 13 }}>Wizard: integrantes, mascotas, vehículos, casa, electrodomésticos (fotos/videos), fondos y categorías.</span>
                    </div>
                    </div>
                </section>

                <section className="card configHubSection">
                  <div className="cardHeader">
                    <div>
                      <h2 className="cardTitle">Todo lo que alimenta tu presupuesto</h2>
                      <p className="cardDesc">
                        Flujo sugerido: <strong>integrantes</strong> → <strong>destinos</strong> (personas, casa, auto, mascotas) → <strong>categorías</strong> de gasto → <strong>Mis cosas</strong> si quieres inventario. Después, en <strong>Presupuesto</strong> solo asignas montos, ciclos y revisas cuentas.
                      </p>
                    </div>
                  </div>
                  <div className="cardBody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div className="configActionRow">
                      <button type="button" className="btn btnPrimary" onClick={() => go('usuarios')}>
                        Usuarios e integrantes
                      </button>
                      <span className="muted" style={{ fontSize: 13 }}>
                        Altas, roles y quién puede administrar. Base para responsables y dueños de bienes.
                      </span>
                    </div>
                    <div className="configActionRow">
                      <button type="button" className="btn btnPrimary" onClick={() => openBudgetModal(undefined, 'objetos')}>
                        Destinos del presupuesto
                      </button>
                      <span className="muted" style={{ fontSize: 13 }}>
                        Personas, casa, vehículos, mascotas y fondos: a qué o a quién asignas dinero (pestaña Destinos en Presupuesto).
                      </span>
                    </div>
                    <div className="configActionRow">
                      <button type="button" className="btn btnPrimary" onClick={() => openBudgetModal(undefined, 'categorias')}>
                        Categorías (partidas globales)
                      </button>
                      <span className="muted" style={{ fontSize: 13 }}>
                        Tipos de gasto que cruzan la familia (supermercado, gasolina, salud…). Luego las combinas con cada destino.
                      </span>
                    </div>
                    <div className="configActionRow">
                      <button type="button" className="btn btnPrimary" onClick={() => go('cosas')}>
                        Mis cosas
                      </button>
                      <span className="muted" style={{ fontSize: 13 }}>
                        Bicis, autos, dispositivos: datos, mantenimiento y facturas. Complementa a los destinos de presupuesto.
                      </span>
                    </div>
                    <div className="configActionRow">
                      <button type="button" className="btn btnGhost" style={{ borderWidth: 2 }} onClick={() => openBudgetModal(undefined, 'montos')}>
                        Ir a montos y asignaciones
                      </button>
                      <span className="muted" style={{ fontSize: 13 }}>
                        Abre <strong>Presupuesto</strong> en la pestaña donde creas tope mensual por destino + categoría (cuentas).
                      </span>
                    </div>
                  </div>
                </section>

                <section className="card">
                  <div className="cardHeader">
                    <div>
                      <h2 className="cardTitle">Editar familia</h2>
                      <p className="cardDesc">Nombre, moneda, día de corte y fechas. Solo el Admin puede cambiar estos datos.</p>
                    </div>
                  </div>
                  <div className="cardBody">
                    <p className="muted">Para cambiar de familia activa o cerrar sesión, usa el menú superior (Familia, Cerrar sesión).</p>
                    {familyDetails && meOk?.isFamilyAdmin ? (
                      <>
                        <div className="spacer16" />
                        <div className="fieldGrid">
                          <label>
                            Nombre de la familia
                            <input
                              className="input"
                              value={famName}
                              onChange={(e) => setFamName(e.target.value)}
                              disabled={savingFamily}
                              placeholder="Ej. Familia Pérez"
                            />
                          </label>
                          <label>
                            Moneda
                            <input
                              className="input"
                              value={famCurrency}
                              onChange={(e) => setFamCurrency((e.target.value || 'MXN').toUpperCase().slice(0, 6))}
                              disabled={savingFamily}
                              placeholder="MXN"
                            />
                          </label>
                          <label>
                            Día de corte (1–28)
                            <input
                              className="input"
                              type="number"
                              min={1}
                              max={28}
                              value={famCutoffDay}
                              onChange={(e) => setFamCutoffDay(e.target.value)}
                              disabled={savingFamily}
                            />
                          </label>
                          <label>
                            Fecha inicio presupuesto (opcional)
                            <input
                              className="input"
                              type="date"
                              value={famBudgetStartDate}
                              onChange={(e) => setFamBudgetStartDate(e.target.value)}
                              disabled={savingFamily}
                            />
                          </label>
                        </div>
                        <div className="spacer8" />
                        <div className="sectionRow" style={{ flexWrap: 'wrap', gap: 8 }}>
                          <button className="btn btnPrimary btnSm" onClick={updateFamily} disabled={savingFamily} type="button">
                            {savingFamily ? 'Guardando…' : 'Guardar cambios'}
                          </button>
                          <button className="btn btnDanger btnSm" onClick={deleteActiveFamily} type="button">
                            Eliminar familia
                          </button>
                        </div>
                      </>
                    ) : familyDetails && !meOk?.isFamilyAdmin ? (
                      <div className="muted" style={{ marginTop: 8 }}>Solo el administrador puede editar nombre, moneda y día de corte.</div>
                    ) : null}
                  </div>
                </section>
                </>
              ) : null}

              {view === 'solicitudes' ? (
                <section className="card">
                  <div className="cardHeader" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <h2 className="cardTitle">Solicitudes de efectivo o pago</h2>
                      <p className="cardDesc">Solicita efectivo o pago de servicios (colegiatura, cine, préstamo). Crear aquí o por WhatsApp. Flujo: crear → Pendiente → Admin aprueba → Registrar entrega (comprobante) → Entregada (operación cerrada).</p>
                    </div>
                    <button
                      type="button"
                      className="btn btnPrimary"
                      onClick={() => {
                        setSolicitudEfectivoDone(null)
                        setSolicitudEfectivoReason('')
                        setSolicitudEfectivoAmount('')
                        const def = receiptWizardAllocationsForMe?.[0] ?? allocationItems?.[0]
                        setSolicitudEfectivoAllocationId(def?.id ?? '')
                        setSolicitudEfectivoOpen(true)
                      }}
                      aria-label="Nueva solicitud de efectivo"
                    >
                      Nueva solicitud de efectivo
                    </button>
                  </div>
                  <div className="cardBody">
                    <div className="sectionRow" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                      <label className="sectionRow" style={{ gap: 6, alignItems: 'center' }}>
                        Estado
                        <select
                          className="input"
                          style={{ width: 'auto' }}
                          value={fltMoneyRequestStatus}
                          onChange={(e) => setFltMoneyRequestStatus(e.target.value)}
                        >
                          <option value="all">Todos</option>
                          <option value="PENDING">Pendiente</option>
                          <option value="APPROVED">Aprobada</option>
                          <option value="REJECTED">Rechazada</option>
                          <option value="DELIVERED">Entregada</option>
                        </select>
                      </label>
                    </div>
                    {moneyRequestsLoading ? (
                      <div className="muted">Cargando solicitudes…</div>
                    ) : (
                      <>
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Código</th>
                              <th>Motivo</th>
                              <th>Monto</th>
                              <th>Solicitante</th>
                              <th>Fecha</th>
                              <th>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(fltMoneyRequestStatus === 'all'
                              ? moneyRequests
                              : moneyRequests.filter((r: any) => r.status === fltMoneyRequestStatus)
                            ).map((r: any) => (
                              <tr
                                key={r.id}
                                style={{ cursor: 'pointer', background: selectedMoneyRequestId === r.id ? 'var(--color-bg-elevated, #f5f5f5)' : undefined }}
                                onClick={() => setSelectedMoneyRequestId(selectedMoneyRequestId === r.id ? null : r.id)}
                              >
                                <td style={{ fontWeight: 700 }}>{r.registrationCode ?? '—'}</td>
                                <td>{r.reason ?? '—'}</td>
                                <td style={{ fontWeight: 900 }}>{formatMoney(Number(r.amount), r.currency || currency)}</td>
                                <td>{r.createdBy?.name ?? r.createdBy?.email ?? '—'}</td>
                                <td>{r.date ? new Date(r.date).toLocaleDateString('es-MX') : '—'}</td>
                                <td>
                                  <span className={`pill ${r.status === 'PENDING' ? 'pillWarn' : r.status === 'APPROVED' ? 'pillOk' : r.status === 'DELIVERED' ? 'pillOk' : ''}`}>
                                    {r.status === 'PENDING' ? 'Pendiente' : r.status === 'APPROVED' ? 'Aprobada' : r.status === 'REJECTED' ? 'Rechazada' : 'Entregada'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {moneyRequests.length === 0 && !moneyRequestsLoading ? (
                          <div className="muted" style={{ marginTop: 12 }}>No hay solicitudes.</div>
                        ) : null}
                        {selectedMoneyRequestId ? (() => {
                          const mr = moneyRequests.find((r: any) => r.id === selectedMoneyRequestId)
                          if (!mr) return null
                          return (
                            <div className="chartBox" style={{ marginTop: 24 }}>
                              <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                <h3 className="chartTitle" style={{ margin: 0 }}>{mr.registrationCode} — {mr.reason}</h3>
                                <button className="btn btnGhost btnSm" type="button" onClick={() => setSelectedMoneyRequestId(null)}>Cerrar detalle</button>
                              </div>
                              <div className="spacer8" />
                              <p className="muted">Solicitante: {mr.createdBy?.name ?? mr.createdBy?.email} • Monto: {formatMoney(Number(mr.amount), mr.currency || currency)} • Fecha: {mr.date ? new Date(mr.date).toLocaleDateString('es-MX') : '—'}</p>
                              {mr.allocation ? <p className="muted">Cuenta: {mr.allocation.entity?.name} → {mr.allocation.category?.name}</p> : null}
                              <div className="spacer12" />
                              {meOk?.isFamilyAdmin && mr.status === 'PENDING' ? (
                                <div className="sectionRow" style={{ gap: 8 }}>
                                  <button
                                    className="btn btnPrimary btnSm"
                                    type="button"
                                    disabled={deliverBusy}
                                    onClick={async () => {
                                      try {
                                        await patchJson(`/api/money-requests/${mr.id}`, { action: 'approve' })
                                        setMessage('Solicitud aprobada.')
                                        loadMoneyRequests()
                                        setSelectedMoneyRequestId(null)
                                      } catch (e: any) {
                                        setMessage(e?.message || 'Error al aprobar')
                                      }
                                    }}
                                  >
                                    Aprobar
                                  </button>
                                  <button
                                    className="btn btnDanger btnSm"
                                    type="button"
                                    disabled={deliverBusy}
                                    onClick={async () => {
                                      try {
                                        await patchJson(`/api/money-requests/${mr.id}`, { action: 'reject' })
                                        setMessage('Solicitud rechazada.')
                                        loadMoneyRequests()
                                        setSelectedMoneyRequestId(null)
                                      } catch (e: any) {
                                        setMessage(e?.message || 'Error al rechazar')
                                      }
                                    }}
                                  >
                                    Rechazar
                                  </button>
                                </div>
                              ) : null}
                              {meOk?.isFamilyAdmin && mr.status === 'APPROVED' ? (
                                <div style={{ marginTop: 16 }}>
                                  <h4 className="chartTitle" style={{ fontSize: 14, margin: 0 }}>Registrar entrega</h4>
                                  <p className="muted" style={{ marginTop: 4 }}>Sube la imagen del comprobante de la transferencia. Opcional: monto realmente enviado.</p>
                                  <div className="sectionRow" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
                                    <input
                                      ref={deliverFileInputRef}
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      className="input"
                                      onChange={(e) => setDeliverFilesCount(e.target.files?.length ?? 0)}
                                    />
                                    <label className="sectionRow" style={{ gap: 6, alignItems: 'center' }}>
                                      Monto enviado (opcional)
                                      <input
                                        className="input"
                                        style={{ width: 100 }}
                                        placeholder={String(mr.amount)}
                                        value={deliverAmountSent}
                                        onChange={(e) => setDeliverAmountSent(e.target.value)}
                                        disabled={deliverBusy}
                                      />
                                    </label>
                                    <button
                                      className="btn btnPrimary btnSm"
                                      type="button"
                                      disabled={deliverBusy || deliverFilesCount === 0}
                                      onClick={async () => {
                                        const files = deliverFileInputRef.current?.files
                                        if (!files?.length) return
                                        setDeliverBusy(true)
                                        try {
                                          const form = new FormData()
                                          for (let i = 0; i < files.length; i++) form.append('file', files[i])
                                          if (deliverAmountSent.trim()) form.set('amountSent', deliverAmountSent.trim())
                                          if (mr.allocationId) form.set('allocationId', mr.allocationId)
                                          const res = await fetch(`/api/money-requests/${mr.id}/deliver`, {
                                            method: 'POST',
                                            credentials: 'include',
                                            headers: viewAsHeaders(false),
                                            body: form,
                                          })
                                          const data = await res.json().catch(() => ({}))
                                          if (!res.ok) throw new Error(data.detail || `Error ${res.status}`)
                                          setMessage('Entrega registrada.')
                                          setDeliverAmountSent('')
                                          setDeliverFilesCount(0)
                                          if (deliverFileInputRef.current) deliverFileInputRef.current.value = ''
                                          loadMoneyRequests()
                                          setSelectedMoneyRequestId(null)
                                        } catch (e: any) {
                                          setMessage(e?.message || 'Error al registrar entrega')
                                        } finally {
                                          setDeliverBusy(false)
                                        }
                                      }}
                                    >
                                      {deliverBusy ? 'Enviando…' : 'Registrar entrega'}
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )
                        })() : null}
                      </>
                    )}
                  </div>
                </section>
              ) : null}

              {view === 'tx' ? (
                <div className="txDetailView">
                  <div className="txDetailHeader">
                    <button
                      type="button"
                      className="btn btnGhost btnSm txDetailBack"
                      onClick={() => { setSelectedTxId(null); go('transacciones') }}
                      aria-label="Volver a lista de transacciones"
                    >
                      ← Volver
                    </button>
                    <div className="txDetailNav">
                      <button
                        type="button"
                        className="btn btnGhost btnSm"
                        disabled={!txPrevId}
                        onClick={() => txPrevId && openTx(txPrevId)}
                        aria-label="Transacción anterior"
                      >
                        ← Anterior
                      </button>
                      <button
                        type="button"
                        className="btn btnGhost btnSm"
                        disabled={!txNextId}
                        onClick={() => txNextId && openTx(txNextId)}
                        aria-label="Siguiente transacción"
                      >
                        Siguiente →
                      </button>
                    </div>
                  </div>
                  <div className="chartBox">
                  <div className="sectionRow" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <h3 className="chartTitle" style={{ margin: 0 }}>
                        {selectedTx?.allocation?.entity?.name || 'Transacción'} — {selectedTx?.allocation?.category?.name || ''}
                      </h3>
                      <div className="muted" style={{ marginTop: 6 }}>
                        {selectedTx ? new Date(selectedTx.date).toLocaleDateString('es-MX') : 'Selecciona una transacción'}
                      </div>
                    </div>
                  </div>

                  <div className="spacer16" />

                  <div className="sectionRow" style={{ gap: 8 }}>
                    {(['Detalle', 'Evidencias'] as TxTab[]).map((t) => (
                      <button
                        key={t}
                        className={`btn ${txTab === t ? 'btnPrimary' : 'btnGhost'} btnSm`}
                        onClick={() => setTxTab(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="spacer16" />

                  {!selectedTx ? (
                    <div className="muted">Abre una transacción desde “Transacciones” o desde el dashboard.</div>
                  ) : (
                    <>
                      {txTab === 'Detalle' ? (
                        <div ref={txSplitWrapRef} className="txSplitGrid" style={{ ['--split-left' as any]: `${txDetailSplitPct}%` }}>
                          <div
                            className="sectionRow txDetailAdjust"
                            style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center', gridColumn: '1 / -1' }}
                          >
                            <div className="muted" style={{ fontWeight: 950 }}>
                              Ajustar vista
                            </div>
                            <div className="txSplitToolbar">
                              <input
                                className="txSplitRange"
                                type="range"
                                min={25}
                                max={75}
                                step={1}
                                value={txDetailSplitPct}
                                onChange={(e) => {
                                  const n = Number(e.target.value)
                                  if (Number.isFinite(n)) setTxDetailSplitPct(Math.max(25, Math.min(75, Math.trunc(n))))
                                }}
                                aria-label="Ajustar ancho de paneles"
                              />
                            </div>
                          </div>

                          <div className="grid" style={{ gap: 12 }}>
                                <div className="chartBox">
                                  <h3 className="chartTitle">Detalle (campos financieros)</h3>
                                  <div className="spacer8" />
                                  <div className="fieldGrid">
                                    <label>
                                      Clave de registro
                                      <input className="input" value={selectedTx.registrationCode || '—'} readOnly style={{ fontFamily: 'ui-monospace, monospace' }} />
                                    </label>
                                    <label>
                                      Fecha
                                      <input className="input" value={new Date(selectedTx.date).toISOString().slice(0, 10)} readOnly />
                                    </label>
                                    <label>
                                      Entidad
                                      <input className="input" value={selectedTx.allocation?.entity?.name || ''} readOnly />
                                    </label>
                                    <label>
                                      Categoría
                                      <input className="input" value={selectedTx.allocation?.category?.name || ''} readOnly />
                                    </label>
                                    <label>
                                      Usuario
                                      <input className="input" value={selectedTx.user?.name || selectedTx.user?.email || ''} readOnly />
                                    </label>
                                    <label>
                                      Monto
                                      <input className="input" value={formatMoney(Number(selectedTx.amount), currency)} readOnly />
                                    </label>
                                    <label>
                                      Notas
                                      <input className="input" value={selectedTx.description || ''} readOnly />
                                    </label>
                                  </div>
                                </div>

                                {(() => {
                                  const toConfirmReceipts = selectedTxReceipts.filter((r: any) => r?.extraction && !r?.extraction?.confirmedAt)
                                  const firstToConfirm = toConfirmReceipts[0]
                                  const hasToConfirm = !!firstToConfirm
                                  const activeAllocations = allocationItems.filter((a: any) => a?.isActive !== false)
                                  const hasBudgetAccount = activeAllocations.length > 0
                                  return hasToConfirm ? (
                                    <div className="chartBox txAssignConfirmBox">
                                      <h3 className="chartTitle">Asignar este gasto a quién / a qué categoría</h3>
                                      <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                        Elige la cuenta (entidad y categoría) y confirma. Así queda asignado el gasto.
                                      </p>
                                      <div className="spacer8" />
                                      {hasBudgetAccount ? (
                                        <label className="txAssignSelectLabel">
                                          Cuenta / categoría
                                          <select
                                            className="select selectAssignCategory"
                                            value={receiptConfirmAllocationId || String((selectedTx as any)?.allocation?.id || '')}
                                            onChange={(e) => setReceiptConfirmAllocationId(e.target.value)}
                                            disabled={receiptConfirming}
                                          >
                                            {activeAllocations.map((a: any) => (
                                              <option key={a.id} value={a.id}>
                                                {a.entity?.name} → {a.category?.name} (límite {formatMoney(Number(a.monthlyLimit), currency)})
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                      ) : (
                                        <div className="muted" style={{ fontSize: 13 }}>
                                          No hay cuentas configuradas. Puedes confirmar el ticket igual (queda sin asignar) o crear destino + categoría + presupuesto en Presupuesto y volver a asignar después.
                                          <div className="spacer8" />
                                          <button
                                            type="button"
                                            className="btn btnGhost btnSm"
                                            style={{ fontWeight: 700 }}
                                            onClick={() => go('presupuesto')}
                                          >
                                            Ir a Presupuesto
                                          </button>
                                        </div>
                                      )}
                                      <div className="spacer12" />
                                      <button
                                        type="button"
                                        className="btn btnAssignConfirm"
                                        onClick={() => confirmReceipt(String(firstToConfirm.id))}
                                        disabled={receiptConfirming}
                                        aria-label={hasBudgetAccount ? 'Asignar y confirmar recibo' : 'Confirmar recibo sin asignar'}
                                      >
                                        {receiptConfirming ? 'Confirmando…' : hasBudgetAccount ? 'Asignar y confirmar' : 'Confirmar (sin asignar)'}
                                      </button>
                                    </div>
                                  ) : null
                                })()}

                                <div className="chartBox">
                                  <h3 className="chartTitle">Auditoría</h3>
                                  <div className="spacer8" />
                                  <div className="muted">
                                    Creado: {selectedTx.createdAt ? new Date(selectedTx.createdAt).toLocaleString('es-MX') : '—'}
                                  </div>
                                  {selectedTxReceipts.some((r: any) => r?.extraction?.confirmedAt) ? (
                                    <div className="muted" style={{ marginTop: 6 }}>
                                      Recibo confirmado: {(() => {
                                        const r = selectedTxReceipts.find((x: any) => x?.extraction?.confirmedAt)
                                        const at = r?.extraction?.confirmedAt
                                        return at ? new Date(at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—'
                                      })()}
                                    </div>
                                  ) : null}
                                  <div className="muted">ID: {selectedTx.id}</div>
                                </div>
                              </div>

                            <div
                              className="txSplitHandle"
                              role="separator"
                              aria-label="Ajustar tamaño de paneles"
                              onPointerDown={startTxSplitDrag}
                              onPointerMove={moveTxSplitDrag}
                              onPointerUp={endTxSplitDrag}
                              onPointerCancel={endTxSplitDrag}
                              title="Arrastra para ajustar el ancho"
                            />

                              <div className="chartBox">
                                <div className="sectionRow" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                  <div>
                                    <h3 className="chartTitle" style={{ margin: 0 }}>
                                      Ticket y tabla extraída
                                    </h3>
                                    <div className="muted" style={{ marginTop: 6 }}>
                                      Comparación profesional: imagen del ticket vs conceptos extraídos.
                                    </div>
                                  </div>
                                  <button className="btn btnGhost btnSm" onClick={() => setTxTab('Evidencias')} type="button">
                                    Ir a Evidencias
                                  </button>
                                </div>

                                <div className="spacer8" />

                                {selectedTxReceipts.length ? (
                                  <>
                                    <div className="receiptPills">
                                      {selectedTxReceipts.map((r: any) => {
                                        const rid = String(r?.id || '')
                                        const confirmedAt = r?.extraction?.confirmedAt ? String(r.extraction.confirmedAt) : ''
                                        const hasExtraction = !!r?.extraction
                                        const isConfirmed = !!confirmedAt
                                        const isActive = rid && rid === txDetailReceiptId
                                        const cls = isConfirmed ? 'pill pillOk pillBtn' : hasExtraction ? 'pill pillWarn pillBtn' : 'pill pillBtn'
                                        const confirmedAtStr = r?.extraction?.confirmedAt
                                          ? new Date(r.extraction.confirmedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
                                          : ''
                                        const label = isConfirmed ? `Confirmado ${confirmedAtStr ? `· ${confirmedAtStr}` : ''}` : hasExtraction ? 'Por confirmar' : 'Pendiente'
                                        return (
                                          <button
                                            key={rid}
                                            className={`${cls} ${isActive ? 'pillActive' : ''}`}
                                            onClick={() => selectTxDetailReceipt(rid)}
                                            type="button"
                                            title={isConfirmed && confirmedAtStr ? `Recibo confirmado el ${confirmedAtStr}` : `Recibo ${rid.slice(0, 6)}… • ${label}`}
                                          >
                                            Recibo {rid.slice(0, 6)}… • {label}
                                          </button>
                                        )
                                      })}
                                    </div>

                                    <div className="spacer8" />

                                    {txDetailReceiptId ? (
                                      <div className={`receiptCompareGrid ${txDetailSplitPct >= 60 ? 'receiptCompareGridNarrow' : ''}`}>
                                        <div className="receiptPanel">
                                          <div className="receiptPanelHeader">
                                            <div className="receiptPanelTitle">Ticket (imagen)</div>
                                            <div className="sectionRow" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                              <span
                                                className="muted"
                                                style={{ fontSize: 12, fontWeight: 800 }}
                                                title="Pasa el cursor sobre el ticket para ampliar"
                                              >
                                                Zoom: pasa el cursor
                                              </span>
                                              {receiptImagesForId === txDetailReceiptId && receiptImages.length > 1 ? (
                                                <div className="sectionRow" style={{ gap: 6 }}>
                                                  <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                                                    Partes
                                                  </span>
                                                  {receiptImages.map((img, idx) => (
                                                    <button
                                                      key={img.id}
                                                      className={`btn ${receiptPreviewImageId === img.id ? 'btnPrimary' : 'btnGhost'} btnSm`}
                                                      onClick={() => {
                                                        setReceiptPreviewUrl(String(img.url))
                                                        setReceiptPreviewForId(txDetailReceiptId)
                                                        setReceiptPreviewImageId(String(img.id))
                                                      }}
                                                      type="button"
                                                      title={`Parte ${idx + 1}`}
                                                    >
                                                      {idx + 1}
                                                    </button>
                                                  ))}
                                                </div>
                                              ) : null}
                                              <button className="btn btnGhost btnSm" onClick={() => openReceipt(txDetailReceiptId)} type="button">
                                                Abrir
                                              </button>
                                            </div>
                                          </div>
                                          <div className="receiptImageBox">
                                            {txDetailReceiptLoading ? (
                                              <div className="muted">Cargando ticket…</div>
                                            ) : receiptPreviewUrl && receiptPreviewForId === txDetailReceiptId ? (
                                              <div
                                                className="ticketMagnifyWrap"
                                                onPointerEnter={onTicketMagnifierMove}
                                                onPointerMove={onTicketMagnifierMove}
                                              >
                                                <img className="receiptImage" src={receiptPreviewUrl} alt="Ticket" />
                                                <div className="ticketMagnifier" style={{ backgroundImage: `url(${receiptPreviewUrl})` }} />
                                              </div>
                                            ) : receiptImagesForId === txDetailReceiptId && receiptImages.some((i) => !i.url) ? (
                                              <div className="muted">
                                                Comprobante por WhatsApp; imagen no guardada. Configura DO_SPACES en el servidor para que las próximas fotos se guarden.
                                              </div>
                                            ) : (
                                              <div className="muted">No hay imagen disponible.</div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="receiptPanel">
                                          <div className="receiptPanelHeader">
                                            <div>
                                              <div className="receiptPanelTitle">Tabla extraída (comparación)</div>
                                              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                                                Se muestra lo extraído para comparar contra el ticket.
                                              </div>
                                            </div>
                                            <div className="sectionRow">
                                              <button className="btn btnGhost btnSm" onClick={() => setTxTab('Evidencias')} type="button">
                                                Revisar / confirmar
                                              </button>
                                            </div>
                                          </div>

                                          {txDetailReceiptLoading ? (
                                            <div className="muted">Cargando extracción…</div>
                                          ) : receiptExtraction && receiptExtractionForId === txDetailReceiptId ? (
                                            <>
                                              <div className="receiptPills">
                                                <span className="pill">Comercio: {receiptExtraction.merchantName || '—'}</span>
                                                <span className="pill">
                                                  Total:{' '}
                                                  {receiptExtraction.total !== null && receiptExtraction.total !== undefined
                                                    ? formatMoney(Number(receiptExtraction.total), currency)
                                                    : '—'}
                                                </span>
                                                <span className="pill">Fecha: {receiptExtraction.date || '—'}</span>
                                              </div>

                                              <div className="spacer8" />

                                              {Array.isArray(receiptExtraction.items) && receiptExtraction.items.length ? (
                                                <div className="receiptItemsWrap">
                                                  <div className="receiptTicket">
                                                    <div className="receiptTicketHeader">
                                                      <span>Descripción</span>
                                                      <span>Total</span>
                                                    </div>
                                                    <div className="receiptTicketList">
                                                      {(Array.isArray(receiptExtraction.items) ? receiptExtraction.items : []).map((it: any, idx: number) => {
                                                        const id = String(it?.id ?? '')
                                                        const locked = !!it?.isAdjustment || !!it?.isPlaceholder
                                                        const lineNo = it?.lineNumber ?? '—'
                                                        const desc = String(it?.description ?? '—')

                                                        const hasQty = it?.quantity !== null && it?.quantity !== undefined && String(it.quantity) !== ''
                                                        const qty = hasQty
                                                          ? Number(it.quantity).toLocaleString('es-MX', { maximumFractionDigits: 3 })
                                                          : ''
                                                        const hasUnit =
                                                          it?.unitPrice !== null && it?.unitPrice !== undefined && String(it.unitPrice) !== ''
                                                        const unit = hasUnit ? formatMoney(Number(it.unitPrice), currency) : ''
                                                        const calcLine = qty && unit ? `${qty} × ${unit}` : qty ? `Cant: ${qty}` : unit ? `P.Unit: ${unit}` : ''

                                                        const hasAmt = it?.amount !== null && it?.amount !== undefined && String(it.amount) !== ''
                                                        const amt = hasAmt ? formatMoney(Number(it.amount), currency) : '—'

                                                        const rawLine = it?.rawLine && it.rawLine !== it.description ? String(it.rawLine) : ''

                                                        return (
                                                          <div
                                                            key={id || String(it?.lineNumber ?? '') || `item-${idx}`}
                                                            className={`receiptTicketRow ${locked ? 'receiptTicketRowLocked' : ''}`}
                                                          >
                                                            <div className="receiptTicketMain">
                                                              <div className="receiptTicketLeft">
                                                                <div className="receiptTicketLineNo">{lineNo}</div>
                                                                <div style={{ minWidth: 0 }}>
                                                                  <div className="receiptTicketDesc" title={desc}>
                                                                    {desc}
                                                                  </div>
                                                                  {calcLine ? (
                                                                    <div className="receiptTicketSub">
                                                                      <span>{calcLine}</span>
                                                                    </div>
                                                                  ) : null}
                                                                  {rawLine ? <div className="receiptTicketOcr">OCR: {rawLine}</div> : null}
                                                                </div>
                                                              </div>

                                                              <div className="receiptTicketAmount">{amt}</div>
                                                            </div>
                                                          </div>
                                                        )
                                                      })}
                                                    </div>
                                                  </div>
                                                </div>
                                              ) : (
                                                <div className="muted">Sin items.</div>
                                              )}
                                            </>
                                          ) : (
                                            <>
                                              <div className="muted">
                                                Este ticket aún no tiene extracción. Puedes extraerlo y luego comparar aquí.
                                              </div>
                                              <div className="spacer8" />
                                              <div className="sectionRow">
                                                <button
                                                  className="btn btnPrimary btnSm"
                                                  onClick={() => extractReceipt(txDetailReceiptId)}
                                                  disabled={receiptExtractingId === txDetailReceiptId}
                                                  type="button"
                                                >
                                                  {receiptExtractingId === txDetailReceiptId ? 'Extrayendo…' : 'Extraer ticket'}
                                                </button>
                                                <button className="btn btnGhost btnSm" onClick={() => setTxTab('Evidencias')} type="button">
                                                  Ver Evidencias
                                                </button>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="muted">Selecciona un recibo.</div>
                                    )}
                                  </>
                                ) : (
                                  <div className="muted">Esta transacción no tiene tickets. Sube un recibo desde “Transacciones”.</div>
                                )}
                              </div>
                            </div>
                      ) : null}

                      {txTab === 'Evidencias' ? (
                        <div className="chartBox">
                          <div className="sectionRow" style={{ justifyContent: 'space-between' }}>
                            <div>
                              <h3 className="chartTitle" style={{ margin: 0 }}>
                                Evidencias (recibos) + Revisión de ticket
                              </h3>
                              <div className="muted" style={{ marginTop: 6 }}>
                                La revisión está optimizada para pantalla ancha (imagen + datos + tabla).
                              </div>
                            </div>
                          </div>

                          <div className="spacer8" />

                          {receiptStats.all.length ? (
                            <>
                              <div className="receiptPills">
                                <span className="pill">Pendientes: {receiptStats.pending.length}</span>
                                <span className="pill">Por confirmar: {receiptStats.toConfirm.length}</span>
                                <span className="pill">Confirmados: {receiptStats.confirmed.length}</span>
                              </div>

                              <div className="spacer8" />

                              {receiptStats.pendingVisible.length ? (
                                <div className="receiptChipRow">
                                  {receiptStats.pendingVisible.map((r: any) => (
                                    <div key={r.id} className="receiptChip">
                                      <div className="receiptChipId">Recibo {String(r.id).slice(0, 6)}…</div>
                                      <div className="receiptChipActions">
                                        <button className="btn btnGhost btnSm" onClick={() => openReceipt(r.id)} type="button">
                                          Abrir
                                        </button>
                                        <button
                                          className="btn btnGhost btnSm"
                                          onClick={() => extractReceipt(r.id)}
                                          disabled={receiptExtractingId === r.id}
                                          type="button"
                                        >
                                          {receiptExtractingId === r.id ? 'Extrayendo…' : 'Extraer'}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : receiptStats.toConfirmVisible.length ? (
                                <div className="muted">No hay tickets nuevos. Confirma los pendientes o sube el siguiente.</div>
                              ) : (
                                <div className="muted">Sin tickets pendientes. Sube un recibo en “Transacciones”.</div>
                              )}

                              {receiptStats.toConfirmVisible.length ? (
                                <>
                                  <div className="spacer8" />
                                  <details className="details">
                                    <summary>Tickets por confirmar ({receiptStats.toConfirmVisible.length})</summary>
                                    <div className="spacer8" />
                                    <div className="receiptChipRow">
                                      {receiptStats.toConfirmVisible.map((r: any) => (
                                        <div key={r.id} className="receiptChip">
                                          <div className="receiptChipId">Recibo {String(r.id).slice(0, 6)}…</div>
                                          <div className="receiptChipActions">
                                            <button className="btn btnGhost btnSm" onClick={() => openReceipt(r.id)} type="button">
                                              Abrir
                                            </button>
                                            <button className="btn btnGhost btnSm" onClick={() => extractReceipt(r.id)} type="button">
                                              Revisar
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                </>
                              ) : null}
                            </>
                          ) : (
                            <div className="muted">Sin recibos. Sube un recibo en “Transacciones”.</div>
                          )}

                          <div className="spacer8" />

                          {receiptExtraction ? (
                            <>
                              <div className="receiptPills">
                                <span className="pill pillOk">Ticket extraído</span>
                                {receiptExtractionForId ? (
                                  <button
                                    className={`pill pillBtn btnConfirmApple ${
                                      !receiptConfirming &&
                                      !!receiptExtractionForId &&
                                      !!receiptExtraction?.merchantName &&
                                      receiptExtraction.total !== null &&
                                      receiptExtraction.total !== undefined
                                        ? 'pulseAction'
                                        : ''
                                    }`}
                                    onClick={() => confirmReceipt(receiptExtractionForId)}
                                    disabled={
                                      receiptConfirming ||
                                      !receiptExtractionForId ||
                                      !receiptExtraction?.merchantName ||
                                      receiptExtraction.total === null ||
                                      receiptExtraction.total === undefined
                                    }
                                    type="button"
                                    title="Confirma que Proveedor y Total coinciden con la imagen"
                                  >
                                    {receiptConfirming ? 'Confirmando…' : 'Confirmar'}
                                  </button>
                                ) : null}
                                {receiptExtractionForId ? (
                                  <button
                                    className="pill pillWarn pillBtn"
                                    onClick={() => extractReceipt(receiptExtractionForId, { force: true })}
                                    disabled={receiptExtractingId === receiptExtractionForId || receiptConfirming}
                                    type="button"
                                    title="Reintenta la extracción (útil si está borroso)"
                                  >
                                    {receiptExtractingId === receiptExtractionForId ? 'Re-extrayendo…' : 'Re-extraer'}
                                  </button>
                                ) : null}
                                <span className="pill">
                                  Total:{' '}
                                  {receiptExtraction.total !== null && receiptExtraction.total !== undefined
                                    ? formatMoney(Number(receiptExtraction.total), currency)
                                    : '—'}
                                </span>
                                <span className="pill">Fecha: {receiptExtraction.date || '—'}</span>
                                <span className="pill">Comercio: {receiptExtraction.merchantName || '—'}</span>
                                {receiptExtractionForId ? <span className="pill">Recibo: {receiptExtractionForId.slice(0, 6)}…</span> : null}
                              </div>

                              <div className="spacer8" />

                              <div className="receiptReviewGrid">
                                <div className="receiptPanel receiptPanelImage">
                                  <div className="receiptPanelHeader">
                                    <div className="receiptPanelTitle">Ticket (imagen)</div>
                                    {receiptExtractionForId ? (
                                      <div className="sectionRow" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        <span
                                          className="muted"
                                          style={{ fontSize: 12, fontWeight: 800 }}
                                          title="Pasa el cursor sobre el ticket para ampliar"
                                        >
                                          Zoom: pasa el cursor
                                        </span>
                                        {receiptImagesForId === receiptExtractionForId && receiptImages.length > 1 ? (
                                          <div className="sectionRow" style={{ gap: 6 }}>
                                            <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                                              Partes
                                            </span>
                                            {receiptImages
                                              .slice()
                                              .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
                                              .map((img: any, i: number) => {
                                                const isActive = receiptPreviewImageId === String(img?.id || '')
                                                return (
                                                  <button
                                                    key={String(img?.id || i)}
                                                    className="btn btnGhost btnSm"
                                                    type="button"
                                                    onClick={() => {
                                                      if (!img?.url) return
                                                      setReceiptPreviewUrl(String(img.url))
                                                      setReceiptPreviewForId(receiptExtractionForId)
                                                      setReceiptPreviewImageId(String(img.id))
                                                    }}
                                                    style={
                                                      isActive
                                                        ? {
                                                            borderColor: 'rgba(11, 169, 91, 0.35)',
                                                            background: 'rgba(11, 169, 91, 0.10)',
                                                            color: '#14532d',
                                                          }
                                                        : undefined
                                                    }
                                                    title={`Parte ${Number(img?.sortOrder || i + 1)}`}
                                                  >
                                                    {Number(img?.sortOrder || i + 1)}
                                                  </button>
                                                )
                                              })}
                                          </div>
                                        ) : null}
                                        {receiptImagesForId === receiptExtractionForId && receiptImages.length > 1 ? (
                                          <button
                                            className="btn btnGhost btnSm"
                                            type="button"
                                            onClick={() => {
                                              if (receiptReorderOpen) {
                                                setReceiptReorderOpen(false)
                                              } else {
                                                startReceiptReorder()
                                              }
                                            }}
                                            disabled={loading || receiptReorderSaving}
                                            title="Reordena las fotos para que la IA lea en secuencia (1→2→3→4)"
                                          >
                                            {receiptReorderOpen ? 'Cerrar orden' : 'Reordenar'}
                                          </button>
                                        ) : null}
                                        <button
                                          className="btn btnGhost btnSm"
                                          onClick={() => loadReceiptPreview(receiptExtractionForId)}
                                          type="button"
                                          disabled={loading}
                                        >
                                          {receiptPreviewUrl && receiptPreviewForId === receiptExtractionForId ? 'Actualizar' : 'Cargar'}
                                        </button>
                                        <button className="btn btnGhost btnSm" onClick={() => openReceipt(receiptExtractionForId)} type="button">
                                          Abrir
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                  {receiptReorderOpen && receiptImagesForId === receiptExtractionForId ? (
                                    <div
                                      style={{
                                        marginTop: 10,
                                        padding: 12,
                                        borderRadius: 12,
                                        border: '1px solid rgba(0,0,0,0.08)',
                                        background: 'rgba(0,0,0,0.02)',
                                      }}
                                    >
                                      <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                        <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                                          Orden de partes
                                        </div>
                                        <button
                                          className="btn btnPrimary btnSm"
                                          type="button"
                                          onClick={saveReceiptReorder}
                                          disabled={receiptReorderSaving || !receiptReorderDraft.length}
                                        >
                                          {receiptReorderSaving ? 'Guardando…' : 'Guardar orden'}
                                        </button>
                                      </div>
                                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                                        Tip: Parte 1 debe iniciar el ticket; la última parte suele contener Subtotal/Impuestos/Total.
                                      </div>
                                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                                        {receiptReorderDraft.map((img: any, idx: number) => (
                                          <div
                                            key={String(img?.id || idx)}
                                            className="sectionRow"
                                            style={{ justifyContent: 'space-between', gap: 10, alignItems: 'center' }}
                                          >
                                            <span className="pill">Parte {idx + 1}</span>
                                            <div className="sectionRow" style={{ gap: 6 }}>
                                              <button
                                                className="btn btnGhost btnSm"
                                                type="button"
                                                disabled={receiptReorderSaving || idx === 0}
                                                onClick={() => moveReceiptReorder(idx, -1)}
                                              >
                                                Subir
                                              </button>
                                              <button
                                                className="btn btnGhost btnSm"
                                                type="button"
                                                disabled={receiptReorderSaving || idx === receiptReorderDraft.length - 1}
                                                onClick={() => moveReceiptReorder(idx, 1)}
                                              >
                                                Bajar
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                  <div className="receiptImageBox">
                                    {receiptPreviewUrl && receiptPreviewForId === receiptExtractionForId ? (
                                      <div
                                        className="ticketMagnifyWrap"
                                        onPointerEnter={onTicketMagnifierMove}
                                        onPointerMove={onTicketMagnifierMove}
                                      >
                                        <img className="receiptImage" src={receiptPreviewUrl} alt="Ticket" />
                                        <div className="ticketMagnifier" style={{ backgroundImage: `url(${receiptPreviewUrl})` }} />
                                      </div>
                                    ) : (
                                      <div className="muted">Carga la imagen para vista previa.</div>
                                    )}
                                  </div>
                                </div>

                                <div className="receiptPanel receiptPanelFields">
                                  <div className="receiptPanelHeader" style={{ flexWrap: 'wrap', gap: 8 }}>
                                    <div>
                                      <div className="receiptPanelTitle">Datos extraídos</div>
                                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                                        Proveedor y total no se editan por seguridad.
                                      </div>
                                    </div>
                                    {receiptExtractionForId && receiptExtraction?.merchantName != null && receiptExtraction.total != null ? (
                                      <button
                                        className="btn btnConfirmApple btnSm"
                                        onClick={() => confirmReceipt(receiptExtractionForId)}
                                        disabled={receiptConfirming}
                                        type="button"
                                        title="Confirma y pasa al siguiente"
                                      >
                                        {receiptConfirming ? 'Confirmando…' : 'Confirmar'}
                                      </button>
                                    ) : null}
                                  </div>

                                  <div className="fieldGrid">
                                    <label>
                                      Proveedor (bloqueado)
                                      <input className="input" value={receiptExtraction.merchantName || ''} readOnly />
                                    </label>
                                    <label>
                                      Total (bloqueado)
                                      <input
                                        className="input"
                                        value={
                                          receiptExtraction.total !== null && receiptExtraction.total !== undefined
                                            ? formatMoney(Number(receiptExtraction.total), currency)
                                            : ''
                                        }
                                        readOnly
                                      />
                                    </label>
                                    <label>
                                      Fecha
                                      <input type="date" className="input" value={receiptDateDraft} onChange={(e) => setReceiptDateDraft(e.target.value)} />
                                    </label>
                                    {allocationItems.length ? (
                                      <label>
                                        Cuenta / asignación
                                        <select
                                          className="select"
                                          value={receiptConfirmAllocationId || String((selectedTx as any)?.allocation?.id || '')}
                                          onChange={(e) => setReceiptConfirmAllocationId(e.target.value)}
                                          disabled={receiptConfirming || !receiptExtractionForId}
                                        >
                                          {allocationItems
                                            .filter((a: any) => a?.isActive !== false)
                                            .map((a: any) => (
                                              <option key={a.id} value={a.id}>
                                                {a.entity?.name} → {a.category?.name} (límite {formatMoney(Number(a.monthlyLimit), currency)})
                                              </option>
                                            ))}
                                        </select>
                                        <div className="muted" style={{ marginTop: 6 }}>
                                          Si el sistema se equivoca, cambia la cuenta aquí antes de confirmar.
                                        </div>
                                      </label>
                                    ) : null}
                                    <div className="fieldRow">
                                      <label>
                                        Tax
                                        <input className="input" value={receiptTaxDraft} onChange={(e) => setReceiptTaxDraft(e.target.value)} />
                                      </label>
                                      <label>
                                        Tip
                                        <input className="input" value={receiptTipDraft} onChange={(e) => setReceiptTipDraft(e.target.value)} />
                                      </label>
                                    </div>
                                  </div>

                                  <div className="spacer8" />
                                  <div className="sectionRow" style={{ justifyContent: 'flex-end' }}>
                                    <button
                                      className="btn btnPrimary btnSm"
                                      onClick={saveReceiptExtractionEdits}
                                      disabled={receiptSaving || !receiptExtractionForId}
                                      type="button"
                                    >
                                      {receiptSaving ? 'Guardando…' : 'Guardar ajustes (opcional)'}
                                    </button>
                                  </div>
                                </div>

                                <div className="receiptPanel receiptPanelItems">
                                  <div className="receiptPanelHeader">
                                    <div>
                                      <div className="receiptPanelTitle">
                                        Items{' '}
                                        {Array.isArray(receiptExtraction.items) ? (
                                          <span className="muted" style={{ fontWeight: 800 }}>
                                            ({receiptExtraction.items.length})
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                                        Edición de conceptos (opcional). Importes bloqueados.
                                      </div>
                                    </div>
                                    <div className="sectionRow">
                                      <button
                                        className="btn btnGhost btnSm"
                                        onClick={() => setReceiptEditConcepts((v) => !v)}
                                        type="button"
                                      >
                                        {receiptEditConcepts ? 'Cerrar edición' : 'Editar conceptos (opcional)'}
                                      </button>
                                    </div>
                                  </div>

                                  <div className="receiptItemsWrap">
                                    {Array.isArray(receiptExtraction.items) && receiptExtraction.items.length ? (
                                      <table className="table tableSticky">
                                        <thead>
                                          <tr>
                                            <th>#</th>
                                            <th>Descripción</th>
                                            <th>Cant.</th>
                                            <th>P.Unit</th>
                                            <th>Total</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {receiptExtraction.items.map((it: any) => {
                                            const id = String(it?.id || '')
                                            const d =
                                              (id && receiptItemDraft[id]) || {
                                                description: String(it?.description || ''),
                                                quantity: it?.quantity !== null && it?.quantity !== undefined ? String(it.quantity) : '',
                                                unitPrice: it?.unitPrice !== null && it?.unitPrice !== undefined ? String(it.unitPrice) : '',
                                                amount: it?.amount !== null && it?.amount !== undefined ? String(it.amount) : '',
                                              }
                                            const locked = !!it?.isAdjustment || !!it?.isPlaceholder
                                            return (
                                              <tr key={id || it.lineNumber} style={locked ? { opacity: 0.75 } : undefined}>
                                                <td className="muted">{it.lineNumber || '—'}</td>
                                                <td>
                                                  {locked || !receiptEditConcepts ? (
                                                    <div style={{ fontWeight: 900 }}>{d.description || '—'}</div>
                                                  ) : (
                                                    <input
                                                      className="input inputSm"
                                                      value={d.description}
                                                      onChange={(e) =>
                                                        setReceiptItemDraft((prev) => ({
                                                          ...prev,
                                                          [id]: { ...(prev[id] || d), description: e.target.value },
                                                        }))
                                                      }
                                                    />
                                                  )}
                                                  {it.rawLine && it.rawLine !== d.description ? (
                                                    <div className="muted" style={{ marginTop: 4 }}>
                                                      OCR: {it.rawLine}
                                                    </div>
                                                  ) : null}
                                                </td>
                                                <td className="muted" style={{ width: 90, textAlign: 'right' }}>
                                                  {it?.quantity !== null && it?.quantity !== undefined && String(it.quantity) !== ''
                                                    ? Number(it.quantity).toLocaleString('es-MX', { maximumFractionDigits: 3 })
                                                    : '—'}
                                                </td>
                                                <td className="muted" style={{ width: 110, textAlign: 'right' }}>
                                                  {it?.unitPrice !== null && it?.unitPrice !== undefined && String(it.unitPrice) !== ''
                                                    ? formatMoney(Number(it.unitPrice), currency)
                                                    : '—'}
                                                </td>
                                                <td style={{ width: 110, textAlign: 'right', fontWeight: 900 }}>
                                                  {it?.amount !== null && it?.amount !== undefined && String(it.amount) !== ''
                                                    ? formatMoney(Number(it.amount), currency)
                                                    : '—'}
                                                </td>
                                              </tr>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    ) : (
                                      <div className="muted">Sin items.</div>
                                    )}
                                  </div>
                                </div>

                                <details className="details receiptPanelJson">
                                  <summary>Ver extracción (JSON)</summary>
                                  <div className="spacer8" />
                                  <pre className="code">{JSON.stringify(receiptExtraction, null, 2)}</pre>
                                </details>
                              </div>
                            </>
                          ) : receiptStats.pending.length ? (
                            <div className="muted">Presiona “Extraer” en un recibo pendiente para procesarlo.</div>
                          ) : receiptStats.toConfirm.length ? (
                            <div className="muted">Abre un ticket en “Tickets por confirmar” y presiona “Revisar”.</div>
                          ) : null}
                        </div>
                      ) : null}

                    </>
                  )}
                </div>
                </div>
              ) : null}

            </>
          )}
        </section>
      </div>
    </main>
  )
}

export default function UiPage() {
  return (
    <Suspense fallback={<div className="sapLayout" style={{ padding: 24, textAlign: 'center' }}>Cargando…</div>}>
      <UiPageContent />
    </Suspense>
  )
}

