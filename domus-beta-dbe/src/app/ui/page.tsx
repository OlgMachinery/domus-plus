'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type MeResponse =
  | {
      ok: true
      user: { id: string; email: string; name: string | null }
      activeFamily: { id: string; name: string } | null
      isFamilyAdmin: boolean
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
  skippedTransactions: boolean
  demoUsers?: { email: string; name: string | null; isFamilyAdmin: boolean; password: string }[]
  receipt?: { created: boolean; skipped: boolean; reason?: string; receiptId?: string }
}

type UiView = 'dashboard' | 'presupuesto' | 'transacciones' | 'usuarios' | 'configuracion' | 'tx'
type TxTab = 'Detalle' | 'Evidencias'

type EntityType = 'PERSON' | 'HOUSE' | 'PET' | 'VEHICLE' | 'PROJECT' | 'FUND' | 'GROUP' | 'OTHER'
type RangeKey = 'this_month' | 'prev_month' | 'last_90' | 'all'
type ReceiptFilter = 'all' | 'with' | 'without'

const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'PERSON', label: 'PERSON (Persona)' },
  { value: 'HOUSE', label: 'HOUSE (Casa)' },
  { value: 'PET', label: 'PET (Mascota)' },
  { value: 'VEHICLE', label: 'VEHICLE (Vehículo)' },
  { value: 'PROJECT', label: 'PROJECT (Proyecto)' },
  { value: 'FUND', label: 'FUND (Fondo)' },
  { value: 'GROUP', label: 'GROUP (Grupo)' },
  { value: 'OTHER', label: 'OTHER (Otro)' },
]

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

export default function UiPage() {
  const router = useRouter()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const toastTimerRef = useRef<number | null>(null)
  const [toast, setToast] = useState<{ kind: 'ok' | 'warn' | 'error' | 'info'; text: string } | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<FakeDataResponse | null>(null)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [reportsTab, setReportsTab] = useState<'detalle' | 'resumen' | 'tablas'>('detalle')
  const [reportsTableTab, setReportsTableTab] = useState<'categorias' | 'objetos' | 'usuarios'>('categorias')
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false)
  const reportsMenuBtnRef = useRef<HTMLButtonElement | null>(null)
  const reportsMenuRef = useRef<HTMLDivElement | null>(null)
  const [familyMenuOpen, setFamilyMenuOpen] = useState(false)
  const familyMenuBtnRef = useRef<HTMLButtonElement | null>(null)
  const familyMenuRef = useRef<HTMLDivElement | null>(null)

  const [view, setView] = useState<UiView>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [txTab, setTxTab] = useState<TxTab>('Detalle')
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null)
  const [txDetailSplitPct, setTxDetailSplitPct] = useState<number>(50)
  const txSplitWrapRef = useRef<HTMLDivElement | null>(null)
  const txSplitDragRef = useRef<{ active: boolean; pointerId: number | null }>({ active: false, pointerId: null })
  const reportsPanelRef = useRef<HTMLDivElement | null>(null)

  const didAutoScrollBudgetRef = useRef(false)

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
  const [mAdmin, setMAdmin] = useState(false)
  const [members, setMembers] = useState<any[] | null>(null)
  const [memberNameDraft, setMemberNameDraft] = useState<Record<string, string>>({})
  const [memberSavingId, setMemberSavingId] = useState<string | null>(null)
  const [adminSavingId, setAdminSavingId] = useState<string | null>(null)
  const [entityImageUploadingId, setEntityImageUploadingId] = useState<string | null>(null)
  const [entityNameDraft, setEntityNameDraft] = useState<Record<string, string>>({})
  const [categoryNameDraft, setCategoryNameDraft] = useState<Record<string, string>>({})
  const [allocationLimitDraft, setAllocationLimitDraft] = useState<Record<string, string>>({})

  const isAuthed = useMemo(() => me && 'ok' in me && me.ok === true, [me])
  const activeFamilyId = useMemo(() => {
    if (!me || !('ok' in me) || me.ok !== true) return null
    return me.activeFamily?.id ?? null
  }, [me])

  // Presupuesto (partidas / categorías / montos)
  const [familyDetails, setFamilyDetails] = useState<any | null>(null)
  const [entities, setEntities] = useState<any[] | null>(null)
  const [categories, setCategories] = useState<any[] | null>(null)
  const [allocations, setAllocations] = useState<any[] | null>(null)

  const [beType, setBeType] = useState<EntityType>('PERSON')
  const [beName, setBeName] = useState('')
  const [beInBudget, setBeInBudget] = useState(true)
  const [beInReports, setBeInReports] = useState(true)

  const [bcType, setBcType] = useState('EXPENSE')
  const [bcName, setBcName] = useState('')

  const [alEntityId, setAlEntityId] = useState('')
  const [alCategoryId, setAlCategoryId] = useState('')
  const [alLimit, setAlLimit] = useState('')
  const [budgetYear, setBudgetYear] = useState(() => String(new Date().getFullYear()))
  const [budgetWizardMemberId, setBudgetWizardMemberId] = useState<string>('')
  const [budgetWizardBusy, setBudgetWizardBusy] = useState(false)
  const [budgetDupEntityId, setBudgetDupEntityId] = useState<string>('')
  const [budgetDupBusy, setBudgetDupBusy] = useState(false)
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
  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [budgetModalTab, setBudgetModalTab] = useState<'cuentas' | 'objetos' | 'categorias' | 'montos'>('cuentas')
  const [budgetModalAllocId, setBudgetModalAllocId] = useState<string | null>(null)
  const [budgetModalSearch, setBudgetModalSearch] = useState('')
  const [budgetListQuery, setBudgetListQuery] = useState('')
  const [budgetListEntityId, setBudgetListEntityId] = useState<string>('all')
  const [budgetListCategoryId, setBudgetListCategoryId] = useState<string>('all')
  const [budgetListType, setBudgetListType] = useState<'all' | 'individual' | 'shared'>('all')
  const [budgetListSpenderId, setBudgetListSpenderId] = useState<string>('all')

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

  const [txFltRange, setTxFltRange] = useState<RangeKey>('all')
  const [txFltCategoryId, setTxFltCategoryId] = useState<string>('all')
  const [txFltEntityId, setTxFltEntityId] = useState<string>('all')
  const [txFltMemberId, setTxFltMemberId] = useState<string>('all')
  const [txFltReceipt, setTxFltReceipt] = useState<ReceiptFilter>('all')
  const [txSearch, setTxSearch] = useState<string>('')
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

  async function refreshMe() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      const data = (await res.json().catch(() => ({}))) as MeResponse
      setMe(data)
    } finally {
      setLoading(false)
    }
  }

  async function refreshMembers(opts: { silent?: boolean } = {}) {
    if (!opts.silent) setMessage('')
    const res = await fetch('/api/families/members', { credentials: 'include' })
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
        // Si no existe borrador, lo inicializamos con el nombre actual
        if (next[id] === undefined) next[id] = String(m?.name || '')
      }
      return next
    })
  }

  useEffect(() => {
    refreshMe()
  }, [])

  useEffect(() => {
    const isAnyOverlayOpen = deleteFamilyOpen || reportsOpen || budgetModalOpen || peopleBudgetOpen || mobileNavOpen
    if (!isAnyOverlayOpen) return
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.overflow = prevHtmlOverflow
    }
  }, [deleteFamilyOpen, reportsOpen, budgetModalOpen, peopleBudgetOpen, mobileNavOpen])

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

    setBudgetModalOpen(false)
    setBudgetModalTab('cuentas')
    setBudgetModalAllocId(null)
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
    setTxFltCategoryId('all')
    setTxFltEntityId('all')
    setTxFltMemberId('all')
    setTxFltReceipt('all')
    setTxSearch('')
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
    setBudgetDupEntityId('')
    setBudgetDupBusy(false)
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

  async function postJson(url: string, body: any) {
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
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

  async function patchJson(url: string, body: any) {
    let res: Response
    try {
      res = await fetch(url, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
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

  async function deleteReq(url: string) {
    let res: Response
    try {
      res = await fetch(url, { method: 'DELETE', credentials: 'include' })
    } catch (e: any) {
      const raw = typeof e?.message === 'string' ? e.message : ''
      throw new Error(`Error de conexión con el servidor${raw ? ` (${raw})` : ''}. Recarga la página e intenta de nuevo.`)
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.detail || `Error HTTP ${res.status}`)
    return data
  }

  async function getJson(url: string) {
    let res: Response
    try {
      res = await fetch(url, { credentials: 'include' })
    } catch (e: any) {
      const raw = typeof e?.message === 'string' ? e.message : ''
      throw new Error(`Error de conexión con el servidor${raw ? ` (${raw})` : ''}. Recarga la página e intenta de nuevo.`)
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.detail || `Error HTTP ${res.status}`)
    return data
  }

  async function refreshBudget(opts: { silent?: boolean } = {}) {
    if (!opts.silent) setMessage('')
    try {
      const [f, e, c, a] = await Promise.all([
        getJson('/api/families/active'),
        getJson('/api/budget/entities'),
        getJson('/api/budget/categories'),
        getJson('/api/budget/allocations'),
      ])
      setFamilyDetails(f.family || null)
      setEntities(e.entities || [])
      setCategories(c.categories || [])
      setAllocations(a.allocations || [])
    } catch (err: any) {
      const msg = err?.message || 'No se pudo cargar el presupuesto'
      if (typeof msg === 'string' && msg.toLowerCase().includes('objeto presupuestal')) {
        router.push('/setup/objects')
        return
      }
      if (!opts.silent) setMessage(msg)
    }
  }

  async function refreshTransactions(opts: { silent?: boolean } = {}) {
    if (!opts.silent) setMessage('')
    try {
      const t = await getJson('/api/transactions')
      setTransactions(t.transactions || [])
    } catch (err: any) {
      const msg = err?.message || 'No se pudieron cargar los gastos'
      if (typeof msg === 'string' && msg.toLowerCase().includes('objeto presupuestal')) {
        router.push('/setup/objects')
        return
      }
      if (!opts.silent) setMessage(msg)
    }
  }

  async function register() {
    setMessage('')
    try {
      await postJson('/api/auth/register', {
        name: rName,
        email: rEmail,
        password: rPass,
        familyName: rFamily,
      })
      setMessage('Cuenta creada. Sesión iniciada.')
      await refreshMe()
      router.push('/setup/objects')
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
      await postJson('/api/auth/logout', {})
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
      router.push('/setup/objects')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo crear familia')
    }
  }

  async function switchFamily(familyId: string) {
    setMessage('')
    try {
      await postJson('/api/auth/switch-family', { familyId })
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
      setMessage('Datos ficticios cargados.')
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
        headers: { 'content-type': 'application/json' },
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
          headers: { 'content-type': 'application/json' },
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
        isFamilyAdmin: mAdmin,
      })
      setMessage('Usuario agregado.')
      setMName('')
      setMEmail('')
      setMPass('')
      setMAdmin(false)
      await refreshMembers()
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo agregar usuario')
    }
  }

  async function saveUserName(targetUserId: string) {
    if (memberSavingId) return
    setMessage('')
    try {
      const draft = (memberNameDraft[targetUserId] ?? '').trim()
      const current = (Array.isArray(members) ? members : []).find((m: any) => m?.id === targetUserId)
      const currentName = typeof current?.name === 'string' ? current.name : ''
      if (draft === currentName) {
        setMessage('Sin cambios.')
        return
      }
      setMemberSavingId(targetUserId)
      await patchJson(`/api/families/members/${targetUserId}`, { name: draft })
      await refreshMembers()
      await refreshMe()
      setMessage('Usuario actualizado.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo actualizar el usuario')
    } finally {
      setMemberSavingId(null)
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
      const res = await fetch(`/api/families/members/${targetUserId}`, { method: 'DELETE', credentials: 'include' })
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

  async function createEntity() {
    setMessage('')
    try {
      await postJson('/api/budget/entities', {
        type: beType,
        name: beName,
        participatesInBudget: beInBudget,
        participatesInReports: beInReports,
      })
      setBeName('')
      setBeInBudget(true)
      setBeInReports(true)
      await refreshBudget()
      setMessage('Objeto creado.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo crear el objeto')
    }
  }

  async function setupPersonalVehicle() {
    if (budgetWizardBusy) return
    setMessage('')
    try {
      const isAdmin = !!meOk?.isFamilyAdmin
      if (!isAdmin) throw new Error('Solo el administrador puede crear partidas / categorías')
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
      setMessage(`Listo: ${vehicleName}. Ahora asigna el monto mensual (ej. Gasolina) y registra los gastos en ese objeto.`)
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

  async function createAllocation() {
    setMessage('')
    try {
      await postJson('/api/budget/allocations', {
        entityId: alEntityId,
        categoryId: alCategoryId,
        monthlyLimit: alLimit,
      })
      setAlLimit('')
      await refreshBudget()
      setMessage('Monto asignado.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo asignar el monto')
    }
  }

  async function duplicateAllocation(fromAllocId: string, toEntityId: string, monthlyLimit: string) {
    if (budgetDupBusy) return
    setMessage('')
    try {
      const from = allocationItems.find((a: any) => String(a?.id || '') === String(fromAllocId || ''))
      const fromEntityId = String(from?.entity?.id || '')
      const fromCategoryId = String(from?.category?.id || '')
      if (!from || !fromEntityId || !fromCategoryId) throw new Error('Cuenta origen inválida')
      if (!toEntityId) throw new Error('Selecciona un objeto destino')
      if (String(toEntityId) === String(fromEntityId)) throw new Error('El objeto destino debe ser diferente')

      const clean = String(monthlyLimit || '').trim().replace(/,/g, '')
      const n = Number(clean)
      if (!Number.isFinite(n) || n <= 0) throw new Error('Monto mensual inválido')

      const existing = allocationItems.find(
        (a: any) => String(a?.entity?.id || '') === String(toEntityId) && String(a?.category?.id || '') === String(fromCategoryId)
      )
      if (existing) {
        setBudgetModalTab('cuentas')
        setBudgetModalAllocId(String(existing.id))
        setMessage('Ya existía la cuenta destino. Se abrió para editar.')
        return
      }

      setBudgetDupBusy(true)
      const res = await postJson('/api/budget/allocations', {
        entityId: toEntityId,
        categoryId: fromCategoryId,
        monthlyLimit: clean,
      })
      await refreshBudget()
      setBudgetModalTab('cuentas')
      setBudgetModalAllocId(String(res?.id || ''))
      setBudgetDupEntityId('')
      setMessage('Cuenta duplicada.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo duplicar la cuenta')
    } finally {
      setBudgetDupBusy(false)
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
      if (!meOk?.isFamilyAdmin) {
        setMessage('Solo el administrador puede subir fotos.')
        return
      }
      if (!file) {
        setMessage('Selecciona una imagen.')
        return
      }
      setEntityImageUploadingId(entityId)
      const form = new FormData()
      form.append('file', file)

      let res: Response
      try {
        res = await fetch(`/api/budget/entities/${entityId}/image`, { method: 'POST', credentials: 'include', body: form })
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
      setMessage('Objeto actualizado.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo actualizar el objeto')
    } finally {
      setAdminSavingId(null)
    }
  }

  async function deleteBudgetEntity(id: string) {
    if (adminSavingId) return
    setMessage('')
    try {
      if (!confirm('¿Eliminar este objeto?')) return
      setAdminSavingId(id)
      await deleteReq(`/api/budget/entities/${id}`)
      await refreshBudget({ silent: true })
      await refreshTransactions({ silent: true })
      setMessage('Objeto eliminado.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo eliminar el objeto')
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
      showToast('ok', 'Gasto agregado.')
      if (created?.id) setReceiptTxId(String(created.id))
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo crear el gasto')
    }
  }

  async function createTransactionFromReceipt() {
    if (txNewReceiptBusy) return
    setMessage('')
    try {
      if (!txNewReceiptFiles.length) {
        setMessage('Selecciona al menos 1 foto del ticket')
        return
      }
      setTxNewReceiptBusy(true)

      const form = new FormData()
      for (const f of txNewReceiptFiles) form.append('file', f)
      if (txNewReceiptAllocationId) form.append('allocationId', txNewReceiptAllocationId)

      let res: Response
      try {
        res = await fetch('/api/transactions/from-receipt', {
          method: 'POST',
          credentials: 'include',
          body: form,
        })
      } catch (e: any) {
        const raw = typeof e?.message === 'string' ? e.message : ''
        throw new Error(`No se pudo subir el ticket (conexión)${raw ? `: ${raw}` : ''}.`)
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || `No se pudo agregar el gasto (HTTP ${res.status})`)

      const transactionId = String(data?.transactionId || '')
      const receiptId = String(data?.receiptId || '')

      setTxNewReceiptFiles([])
      setTxNewReceiptAllocationId('')
      showToast('ok', data?.message || 'Gasto agregado con comprobante.')

      await refreshTransactions({ silent: true })

      if (transactionId) {
        openTx(transactionId)
        setTxTab('Evidencias')
      }
      if (receiptId) {
        // Carga la extracción ya guardada y abre la revisión.
        await extractReceipt(receiptId)
      }
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo agregar el gasto con comprobante')
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
        res = await fetch(`/api/receipts/${receiptId}/extraction`, { credentials: 'include' })
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

      setReceiptExtraction(data.extraction || null)
      setReceiptExtractionForId(receiptId)
      setReceiptDraftForId(null)
      setReceiptEditConcepts(false)
      return data.extraction || null
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

  async function extractReceipt(receiptId: string, opts?: { force?: boolean }) {
    if (receiptExtractingId) return
    setMessage('')
    try {
      setReceiptExtractingId(receiptId)
      let res: Response
      try {
        res = await fetch(`/api/receipts/${receiptId}/extract`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: 'precise', ...(opts?.force ? { force: true } : {}) }),
        })
      } catch (e: any) {
        const raw = typeof e?.message === 'string' ? e.message : ''
        throw new Error(`No se pudo extraer el ticket (conexión)${raw ? `: ${raw}` : ''}.`)
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || `No se pudo extraer el ticket (HTTP ${res.status})`)
      setReceiptExtraction(data.extraction || null)
      setReceiptExtractionForId(receiptId)
      setReceiptDraftForId(null)
      setReceiptEditConcepts(false)
      showToast('ok', data.message || 'Ticket extraído correctamente.')
      await loadReceiptPreview(receiptId)
      await refreshTransactions({ silent: true })
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo extraer el ticket')
    } finally {
      setReceiptExtractingId(null)
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
      setReceiptExtraction(res.extraction || null)
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
    try {
      setReceiptConfirming(true)
      const payload = receiptConfirmAllocationId ? { allocationId: receiptConfirmAllocationId } : {}
      const data = await postJson(`/api/receipts/${receiptId}/confirm`, payload)
      showToast('ok', data?.message || 'Ticket confirmado.')
      await refreshTransactions({ silent: true })

      // Limpiar revisión para seguir con el siguiente ticket
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
  const allocationItems = useMemo(() => (Array.isArray(allocations) ? allocations : []), [allocations])
  const memberItems = useMemo(() => (Array.isArray(members) ? members : []), [members])
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
  const orgEntities = useMemo(
    () =>
      entityItems
        .filter((e: any) => e?.isActive !== false)
        .map((e: any) => ({
          id: String(e.id || ''),
          name: displayPersonName(e.name || 'Objeto'),
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

  const flt = useMemo(() => rangeDates(fltRange), [fltRange])
  const txFlt = useMemo(() => rangeDates(txFltRange), [txFltRange])

  const txFilteredItems = useMemo(() => {
    const from = txFlt.from
    const to = txFlt.to
    const q = txSearch.trim().toLowerCase()

    return txItems.filter((t: any) => {
      if ((from || to) && !inDateRange(String(t?.date || ''), from, to)) return false
      if (txFltCategoryId !== 'all' && String(t?.allocation?.category?.id || '') !== txFltCategoryId) return false
      if (txFltEntityId !== 'all' && String(t?.allocation?.entity?.id || '') !== txFltEntityId) return false
      if (txFltMemberId !== 'all' && String(t?.user?.id || '') !== txFltMemberId) return false

      const receipts = Array.isArray(t?.receipts) ? t.receipts : []
      const hasReceipt = receipts.length > 0
      if (txFltReceipt === 'with' && !hasReceipt) return false
      if (txFltReceipt === 'without' && hasReceipt) return false

      if (q) {
        const hay = `${t?.description || ''} ${t?.allocation?.entity?.name || ''} ${t?.allocation?.category?.name || ''} ${t?.user?.name || ''} ${
          t?.user?.email || ''
        }`.toLowerCase()
        if (!hay.includes(q)) return false
      }

      return true
    })
  }, [txFlt.from, txFlt.to, txFltCategoryId, txFltEntityId, txFltMemberId, txFltReceipt, txItems, txSearch])

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
      setBudgetModalOpen(true)
      setBudgetModalTab('objetos')
    }, 80)
    return () => clearTimeout(id)
  }, [meOk?.isFamilyAdmin, setupChecklist.needsSetup, view])

  const selectedTx = useMemo(() => {
    if (!selectedTxId) return null
    return txItems.find((t: any) => t?.id === selectedTxId) ?? null
  }, [selectedTxId, txItems])

  const selectedTxReceipts = useMemo(() => {
    const r = (selectedTx as any)?.receipts
    return Array.isArray(r) ? r : []
  }, [selectedTx])

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
    if (!budgetModalOpen) return
    if (budgetModalAllocId && budgetAccounts.some((a) => String(a.id) === String(budgetModalAllocId))) return
    if (budgetAccounts.length) setBudgetModalAllocId(String(budgetAccounts[0]!.id))
  }, [budgetAccounts, budgetModalAllocId, budgetModalOpen])

  const pageInfo = useMemo(() => {
    switch (view) {
      case 'dashboard':
        return { title: 'Dashboard', subtitle: 'Overview financiero (estilo SAP-Family)' }
      case 'presupuesto':
        return { title: 'Presupuesto', subtitle: 'List Report: filtros + tabla + panel de estado' }
      case 'transacciones':
        return { title: 'Transacciones', subtitle: 'Registro de gastos y recibos' }
      case 'usuarios':
        return { title: 'Usuarios', subtitle: 'Administración de usuarios de la familia' }
      case 'configuracion':
        return { title: 'Configuración', subtitle: 'Familias, sesión y estado del plan' }
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
    setBudgetModalOpen(true)
    setBudgetModalTab(tab ?? (pickAllocationId ? 'montos' : 'cuentas'))
    setBudgetModalSearch('')
    if (pickAllocationId) {
      setBudgetModalAllocId(String(pickAllocationId))
      return
    }
    if (budgetAccounts.length) setBudgetModalAllocId(String(budgetAccounts[0]!.id))
  }

  function closeBudgetModal() {
    setBudgetModalOpen(false)
    setBudgetWizardBusy(false)
    setBudgetDupBusy(false)
    setBudgetDupEntityId('')
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
                title={`Partidas: ${setupChecklist.objectCount} • Categorías: ${setupChecklist.categoryCount} • Montos: ${setupChecklist.allocationCount}`}
              >
                Setup: {setupChecklist.needsSetup ? 'Pendiente' : 'Listo'}
              </span>
          ) : null}
          <span className="pill pillTrunc sapPillProfile">{meOk ? (meOk.user.name || 'Perfil') : 'Perfil'}</span>
          {meOk ? (
            <button className="btn btnDanger btnSm" onClick={logout}>
              Cerrar sesión
            </button>
          ) : null}
        </div>
      </div>

      {mobileNavOpen ? (
        <div className="mobileNavOverlay" onClick={() => setMobileNavOpen(false)}>
          <div className="mobileNavSheet" onClick={(e) => e.stopPropagation()}>
            <div className="sectionRow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 950 }}>Menú</div>
              <button className="btn btnGhost btnSm" type="button" onClick={() => setMobileNavOpen(false)}>
                Cerrar
              </button>
            </div>
            <div className="spacer8" />
            <div className="muted" style={{ fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 12 }}>
              Navegación
            </div>
            <div className="spacer6" />
            <nav className="sapNav" aria-label="DOMUS navegación móvil">
              <button className={`sapNavItem ${view === 'dashboard' ? 'sapNavItemActive' : ''}`} onClick={() => go('dashboard')}>
                Dashboard
              </button>
              <button className={`sapNavItem ${view === 'presupuesto' ? 'sapNavItemActive' : ''}`} onClick={() => go('presupuesto')}>
                Presupuesto
              </button>
              <button className={`sapNavItem ${view === 'transacciones' ? 'sapNavItemActive' : ''}`} onClick={() => go('transacciones')}>
                Transacciones
              </button>
              <button className={`sapNavItem ${view === 'usuarios' ? 'sapNavItemActive' : ''}`} onClick={() => go('usuarios')}>
                Usuarios
              </button>
              <button
                className={`sapNavItem ${reportsOpen ? 'sapNavItemActive' : ''}`}
                onClick={() => {
                  setMobileNavOpen(false)
                  setReportsTab('detalle')
                  setReportsTableTab('categorias')
                  setReportsOpen(true)
                }}
              >
                Reportes
              </button>
              <button className={`sapNavItem ${view === 'configuracion' ? 'sapNavItemActive' : ''}`} onClick={() => go('configuracion')}>
                Configuración
              </button>
              <button
                className="sapNavItem"
                onClick={() => {
                  setMobileNavOpen(false)
                  router.push('/setup/objects')
                }}
              >
                Partidas
              </button>
            <button
              className="sapNavItem"
              onClick={() => {
                setMobileNavOpen(false)
                router.push('/ui/system-architecture')
              }}
            >
              Arquitectura
            </button>
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
            className="modalPanel"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(640px, 100%)', maxHeight: 'min(86vh, 720px)' }}
          >
            <button
              className="btn btnGhost btnSm modalClose"
              onClick={() => {
                if (deleteFamilyBusy) return
                setDeleteFamilyOpen(false)
              }}
              type="button"
            >
              Cerrar
            </button>
            <div className="modalToolbar">
                <div className="sectionRow" style={{ justifyContent: 'space-between' }}>
                <div>
                  <h2 className="cardTitle" style={{ margin: 0 }}>
                    Eliminar familia
                  </h2>
                  <div className="muted">Por seguridad pedimos usuario y contraseña.</div>
                </div>
                <button
                  className="btn btnGhost btnSm modalClose"
                  onClick={() => {
                    if (deleteFamilyBusy) return
                    setDeleteFamilyOpen(false)
                  }}
                  type="button"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="note">
              Antes de eliminar, DOMUS descargará automáticamente un respaldo <b>oculto</b> (archivo que inicia con punto). Además, se guarda un respaldo
              oculto en el servidor para recuperación interna.
            </div>

            <div className="spacer8" />

            <div className="fieldGrid">
              <label>
                Usuario (email)
                <input
                  className="input"
                  value={deleteFamilyEmail}
                  onChange={(e) => setDeleteFamilyEmail(e.target.value)}
                  disabled={deleteFamilyBusy}
                  inputMode="email"
                  autoComplete="username"
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
            <button className="sapNavItem" onClick={() => router.push('/setup/objects')}>
              Partidas
            </button>
            <button className="sapNavItem" onClick={() => router.push('/ui/system-architecture')}>
              Arquitectura
            </button>
          </nav>
        </aside>

        <section className="sapContent">
          <div className="pageHead">
            <div>
              <h1 className="pageTitle">{pageInfo.title}</h1>
              <p className="pageSubtitle">{pageInfo.subtitle}</p>
            </div>
            <div className="sectionRow">
              {loading ? <span className="pill pillWarn">Cargando…</span> : null}
            </div>
          </div>

          {message ? <div className="alert">{message}</div> : null}

          {!meOk ? (
            <section className="grid grid2">
              <section className="card">
                <div className="cardHeader">
                  <div>
                    <h2 className="cardTitle">Crear cuenta</h2>
                    <p className="cardDesc">Crea un usuario y su primera familia.</p>
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
                      <input className="input" placeholder="Email" value={rEmail} onChange={(e) => setREmail(e.target.value)} />
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
                  </div>
                </div>
              </section>
            </section>
          ) : (
            <>
              {view === 'dashboard' ? (
                <>
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
                            <span className={`pill ${setupChecklist.hasObject ? 'pillOk' : 'pillWarn'}`}>Partidas: {setupChecklist.objectCount}</span>
                            <span className={`pill ${setupChecklist.hasCategory ? 'pillOk' : 'pillWarn'}`}>Categorías: {setupChecklist.categoryCount}</span>
                            <span className={`pill ${setupChecklist.hasAllocation ? 'pillOk' : 'pillWarn'}`}>Montos: {setupChecklist.allocationCount}</span>
                          </div>
                        </div>
                        <div className="spacer8" />
                        <div className="muted">
                          1) Crea al menos 1 <b>objeto</b> • 2) Crea <b>categorías</b> • 3) Asigna <b>montos</b> • 4) Confirma el plan.
                        </div>
                        <div className="spacer8" />
                        <div className="sectionRow">
                          <button className="btn btnPrimary btnSm" onClick={() => router.push('/setup/objects')}>
                            Ir a Partidas
                          </button>
                          <button className="btn btnGhost btnSm" onClick={() => go('presupuesto')}>
                            Ir a Presupuesto
                          </button>
                        </div>
                      </div>
                      <div className="spacer16" />
                    </>
                  ) : null}

                  <div className="kpiStrip">
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
                  </div>

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
                              <td className="muted">{Array.isArray(t.receipts) ? t.receipts.length : 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="muted">Aún no hay transacciones.</div>
                    )}
                  </div>
                </>
              ) : null}

              {reportsOpen ? (
                <div className="modalOverlay modalOverlayFull" onClick={() => setReportsOpen(false)}>
                  <div className="modalPanel reportsStudioPanel" onClick={(e) => e.stopPropagation()}>
            <button
              className="btn btnDanger btnSm modalClose"
              onClick={() => {
                setReportsMenuOpen(false)
                setReportsOpen(false)
              }}
              type="button"
            >
              Cerrar
            </button>
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
                          </div>
                        </div>

                        <div className="reportsToolbarFilters" role="group" aria-label="Filtros">
                          <div className="reportsFilterItem" title="Cuenta (persona u objeto)">
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
                                      <optgroup label="Partidas">
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
                          <button
                            className="btn btnGhost btnSm modalClose"
                            onClick={() => {
                              setReportsMenuOpen(false)
                              setReportsOpen(false)
                            }}
                            type="button"
                          >
                            Cerrar
                          </button>
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
                              Objeto
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
                            <div className="subTitle">Objeto excluido de reportes</div>
                            <div className="muted" style={{ marginTop: 6 }}>
                              Este objeto está marcado como “no participa en reportes”. Inclúyelo para verlo aquí.
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
                            <div className="subTitle">Objeto excluido de reportes</div>
                            <div className="muted" style={{ marginTop: 6 }}>
                              Este objeto está marcado como “no participa en reportes”. Inclúyelo para verlo aquí.
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
                                    Presupuesto = límite configurado del objeto/categoría. Gastado = transacciones filtradas (usuario/recibos/rango).
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
                                    Tip: para editar aquí, selecciona un <b>Objeto</b> y una <b>Categoría</b> específicos.
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

                        {reportsTab === 'tablas' ? (
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
                                  Partidas
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
                                      <th>Objeto</th>
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
                </div>
              ) : null}

              {view === 'presupuesto' ? (
                <>
                  {budgetModalOpen ? (
                    <div className="modalOverlay modalOverlayFull" onClick={closeBudgetModal}>
                      <div className="modalPanel budgetStudioPanel" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btnDanger btnSm modalClose" onClick={closeBudgetModal} type="button">
                          Cerrar
                        </button>
                        <div className="modalToolbar budgetStudioToolbar">
                          <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <div>
                              <h2 className="cardTitle" style={{ margin: 0 }}>
                                Presupuesto
                              </h2>
                              <div className="muted">Editar cuentas, partidas, categorías y montos desde un solo lugar</div>
                            </div>
                            <button className="btn btnDanger btnSm modalClose" onClick={closeBudgetModal} type="button">
                              Cerrar
                            </button>
                          </div>

                          <div className="spacer8" />

                          <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <div className="tabRow" role="tablist" aria-label="Tabs de presupuesto">
                              <button
                                className={`tabBtn ${budgetModalTab === 'cuentas' ? 'tabBtnActive' : ''}`}
                                onClick={() => setBudgetModalTab('cuentas')}
                                type="button"
                                role="tab"
                                aria-selected={budgetModalTab === 'cuentas'}
                              >
                                Cuentas
                              </button>
                              <button
                                  className={`tabBtn ${budgetModalTab === 'objetos' ? 'tabBtnActive' : ''}`}
                                  onClick={() => setBudgetModalTab('objetos')}
                                type="button"
                                role="tab"
                                aria-selected={budgetModalTab === 'objetos'}
                              >
                                  Partidas
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
                                Montos
                              </button>
                            </div>

                            <div className="sectionRow" style={{ flexWrap: 'wrap' }}>
                              <span className="pill">Año: {budgetConcentrado.year}</span>
                              <span className={`pill ${setupChecklist.hasObject ? 'pillOk' : 'pillWarn'}`}>Partidas: {setupChecklist.objectCount}</span>
                              <span className={`pill ${setupChecklist.hasCategory ? 'pillOk' : 'pillWarn'}`}>Categorías: {setupChecklist.categoryCount}</span>
                              <span className={`pill ${setupChecklist.hasAllocation ? 'pillOk' : 'pillWarn'}`}>Montos: {setupChecklist.allocationCount}</span>
                            </div>
                          </div>
                        </div>

                        <div className="budgetStudioBody">
                          {!meOk.isFamilyAdmin ? (
                            <div className="muted">
                              Tu usuario no es <b>Admin</b>. Puedes ver el presupuesto, pero no editarlo. Pide al Admin que te cambie el rol en “Usuarios”.
                            </div>
                          ) : null}

                        {entityOwnersOpen ? (
                          <div className="modalOverlay" onClick={closeEntityOwnersModal} style={{ zIndex: 80 }}>
                            <div className="modalPanel" onClick={(e) => e.stopPropagation()} style={{ width: 'min(860px, 100%)' }}>
                              <button
                                className="btn btnDanger btnSm modalClose"
                                onClick={closeEntityOwnersModal}
                                type="button"
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
                                  <button
                                    className="btn btnGhost btnSm modalClose"
                                    onClick={closeEntityOwnersModal}
                                    type="button"
                                    disabled={entityOwnersSaving}
                                  >
                                    Cerrar
                                  </button>
                                </div>
                              </div>

                              <div className="spacer12" />

                              {(() => {
                                const ent = entityItems.find((x: any) => String(x?.id || '') === String(entityOwnersEntityId || ''))
                                if (!ent) return <div className="muted">Objeto no encontrado.</div>

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

                        {budgetModalTab === 'cuentas' ? (
                          <div className="budgetManageGrid">
                            <div className="chartBox">
                              <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div>
                                  <h3 className="chartTitle" style={{ margin: 0 }}>
                                    Cuentas del presupuesto
                                  </h3>
                                  <div className="muted" style={{ marginTop: 6 }}>
                                    Haz clic en un renglón para abrirlo y editarlo.
                                  </div>
                                </div>
                                <label style={{ maxWidth: 260 }}>
                                  Buscar
                                  <input
                                    className="input inputSm"
                                    placeholder="Ej. supermercado, colegiaturas, casa…"
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
                                        <th title="Se define por el tipo de objeto (Persona = Individual; otros = Compartido)">Tipo (auto)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {budgetModalAccounts.map((a: any) => {
                                        const selected = String(budgetModalAllocId || '') === String(a.id)
                                        return (
                                          <tr
                                            key={a.id}
                                            onClick={() => setBudgetModalAllocId(String(a.id))}
                                            style={{
                                              cursor: 'pointer',
                                              background: selected ? 'rgba(15, 61, 145, 0.06)' : undefined,
                                            }}
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
                                <div className="muted">No hay resultados.</div>
                              )}
                            </div>

                            <div className="chartBox">
                              <h3 className="chartTitle" style={{ margin: 0 }}>
                                Editar cuenta
                              </h3>
                              <div className="spacer8" />
                              {(() => {
                                const acc = budgetModalSelectedAccount as any
                                const alloc = budgetModalSelectedAlloc as any
                                if (!acc || !alloc) return <div className="muted">Selecciona una cuenta del listado.</div>

                                const draft = allocationLimitDraft[String(alloc.id)] ?? String(alloc.monthlyLimit || '')
                                const changed = draft.trim() !== String(alloc.monthlyLimit || '')
                                const nMonthly = Number(draft)
                                const annual = (Number.isFinite(nMonthly) ? nMonthly : 0) * 12
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
                                          <input
                                            className="input"
                                            inputMode="decimal"
                                            value={draft}
                                            disabled={!meOk.isFamilyAdmin || adminSavingId === String(alloc.id)}
                                            onChange={(ev) =>
                                              setAllocationLimitDraft((prev) => ({
                                                ...prev,
                                                [String(alloc.id)]: ev.target.value,
                                              }))
                                            }
                                          />
                                        </label>
                                        <button
                                          className="btn btnPrimary btnSm"
                                          disabled={!meOk.isFamilyAdmin || adminSavingId === String(alloc.id) || !changed}
                                          onClick={() => patchBudgetAllocation(String(alloc.id), { monthlyLimit: draft.trim() })}
                                          type="button"
                                        >
                                          Guardar
                                        </button>
                                        <button
                                          className="btn btnDanger btnSm"
                                          disabled={!meOk.isFamilyAdmin || adminSavingId === String(alloc.id)}
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
                                          disabled={!meOk.isFamilyAdmin || adminSavingId === String(alloc.id)}
                                          onChange={(ev) => patchBudgetAllocation(String(alloc.id), { isActive: ev.target.checked })}
                                          style={{ marginRight: 8 }}
                                        />
                                        Activa (participa en el presupuesto)
                                      </label>
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

                                    <div className="cardSub" style={{ padding: 12 }}>
                                      <div className="subTitle">Dividir (personal vs compartido)</div>
                                      <div className="spacer8" />
                                      <div className="muted" style={{ marginBottom: 10 }}>
                                        “Individual / Compartido” se define por el <b>Objeto</b>. Para separar (ej. Gasolina personal vs Casa), duplica la
                                        cuenta a otro objeto.
                                      </div>
                                      <div className="fieldGrid">
                                        <label>
                                          Duplicar esta cuenta a otro objeto
                                          <select
                                            className="select"
                                            value={budgetDupEntityId}
                                            onChange={(e) => setBudgetDupEntityId(e.target.value)}
                                            disabled={!meOk.isFamilyAdmin || budgetDupBusy || loading}
                                          >
                                            <option value="">Selecciona…</option>
                                            {entityItems
                                              .filter((e: any) => e?.isActive !== false && e?.participatesInBudget !== false)
                                              .filter((e: any) => String(e?.id || '') !== String(alloc?.entity?.id || ''))
                                              .map((e: any) => (
                                                <option key={e.id} value={e.id}>
                                                  {e.name} ({entityTypeLabel(e.type)})
                                                </option>
                                              ))}
                                          </select>
                                        </label>
                                        <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
                                          <span className="muted">Copia la misma categoría y el monto mensual actual.</span>
                                          <button
                                            className="btn btnGhost btnSm"
                                            disabled={!meOk.isFamilyAdmin || budgetDupBusy || !budgetDupEntityId || !draft.trim()}
                                            onClick={() => duplicateAllocation(String(alloc.id), String(budgetDupEntityId), draft.trim())}
                                            type="button"
                                          >
                                            {budgetDupBusy ? 'Duplicando…' : 'Duplicar cuenta'}
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="spacer12" />

                                    <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                      <button className="btn btnGhost btnSm" onClick={() => setBudgetModalTab('montos')} type="button">
                                        Agregar otra cuenta
                                      </button>
                                      <button className="btn btnGhost btnSm" onClick={() => setBudgetModalTab('objetos')} type="button">
                                        Agregar / editar partidas
                                      </button>
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
                                  Partidas
                                </h3>
                                <div className="muted" style={{ marginTop: 6 }}>
                                  Crea, edita o elimina partidas (personas, casa, auto, etc.).
                                </div>
                              </div>
                            </div>

                            <div className="spacer12" />

                            <div className="cardSub">
                              <div className="subTitle">Agregar objeto</div>
                              <div className="spacer8" />
                              <div className="grid grid2">
                                <label>
                                  Tipo
                                  <select className="select" value={beType} onChange={(e) => setBeType(e.target.value as any)} disabled={!meOk.isFamilyAdmin || loading}>
                                    <option value="PERSON">Persona</option>
                                    <option value="HOUSE">Casa</option>
                                    <option value="PET">Mascota</option>
                                    <option value="VEHICLE">Vehículo</option>
                                    <option value="PROJECT">Proyecto</option>
                                    <option value="FUND">Fondo</option>
                                    <option value="GROUP">Grupo</option>
                                    <option value="OTHER">Otro</option>
                                  </select>
                                </label>
                                <label>
                                  Nombre
                                  <input className="input" value={beName} onChange={(e) => setBeName(e.target.value)} disabled={!meOk.isFamilyAdmin || loading} placeholder="Ej. Sofía / Casa / Auto" />
                                </label>
                              </div>
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
                                <button className="btn btnPrimary btnSm" onClick={createEntity} disabled={!meOk.isFamilyAdmin || loading} type="button">
                                  Crear objeto
                                </button>
                              </div>
                            </div>

                            <div className="spacer12" />

                            <div className="cardSub">
                              <div className="subTitle">Asistente: Auto personal</div>
                              <div className="muted" style={{ marginTop: 6 }}>
                                Recomendado para modelar un auto “de alguien” sin confusión. Crea <b>Vehículo</b> con nombre tipo <b>Auto (Mamá)</b> y deja lista
                                la asignación (en “Montos”) para capturar <b>Gasolina</b> (y categorías típicas si no existen).
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
                                  Al terminar, te llevo a <b>Montos</b> para que solo pongas el monto mensual y listes.
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

                            <div className="spacer12" />

                            {entityItems.length ? (
                              <div className="budgetListScroll">
                                <table className="table">
                                  <thead>
                                    <tr>
                                      <th>Nombre</th>
                                      <th>Tipo</th>
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
                                          <td className="muted">{entityTypeLabel(e.type)}</td>
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
                                              <button
                                                className="btn btnGhost btnSm"
                                                disabled={!meOk.isFamilyAdmin || adminSavingId === e.id || entityImageUploadingId === e.id}
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
                                                  disabled={!meOk.isFamilyAdmin || adminSavingId === e.id || entityImageUploadingId === e.id}
                                                  onClick={() => patchBudgetEntity(e.id, { imageUrl: null })}
                                                  type="button"
                                                >
                                                  Quitar foto
                                                </button>
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
                              <div className="muted">Aún no hay partidas.</div>
                            )}
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
                                  Montos / asignaciones
                                </h3>
                                <div className="muted" style={{ marginTop: 6 }}>
                                  Asigna un monto mensual por objeto + categoría. Aquí creas las “cuentas” del presupuesto.
                                </div>
                              </div>
                            </div>

                            <div className="spacer12" />

                            <div className="cardSub">
                              <div className="subTitle">Agregar monto</div>
                              <div className="spacer8" />
                              <div className="grid grid2">
                                <label>
                                  Objeto
                                  <select className="select" value={alEntityId} onChange={(e) => setAlEntityId(e.target.value)} disabled={!meOk.isFamilyAdmin || loading}>
                                    <option value="">Selecciona…</option>
                                    {entityItems
                                      .filter((e: any) => e?.isActive !== false && e?.participatesInBudget !== false)
                                      .map((e: any) => (
                                        <option key={e.id} value={e.id}>
                                          {e.name} ({entityTypeLabel(e.type)})
                                        </option>
                                      ))}
                                  </select>
                                </label>
                                <label>
                                  Categoría
                                  <select className="select" value={alCategoryId} onChange={(e) => setAlCategoryId(e.target.value)} disabled={!meOk.isFamilyAdmin || loading}>
                                    <option value="">Selecciona…</option>
                                    {categoryItems.filter((c: any) => c?.isActive !== false).map((c: any) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <div className="spacer8" />
                              <div className="sectionRow" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <label style={{ minWidth: 240, flex: 1 }}>
                                  Monto mensual
                                  <input className="input" value={alLimit} onChange={(e) => setAlLimit(e.target.value)} inputMode="decimal" disabled={!meOk.isFamilyAdmin || loading} placeholder="Ej. 5000" />
                                </label>
                                <button className="btn btnPrimary btnSm" onClick={createAllocation} disabled={!meOk.isFamilyAdmin || loading} type="button">
                                  Asignar monto
                                </button>
                              </div>
                            </div>

                            <div className="spacer12" />

                            {allocationItems.length ? (
                              <div className="budgetListScroll">
                                <table className="table">
                                  <thead>
                                    <tr>
                                      <th>Objeto</th>
                                      <th>Categoría</th>
                                      <th>Monto mensual</th>
                                      <th>Activo</th>
                                      <th>Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {allocationItems.slice(0, 180).map((a: any) => {
                                      const draft = allocationLimitDraft[a.id] ?? String(a.monthlyLimit || '')
                                      const changed = draft.trim() !== String(a.monthlyLimit || '')
                                      return (
                                        <tr key={a.id}>
                                          <td style={{ fontWeight: 950 }}>
                                            {a.entity?.name || '—'} <span className="muted">({entityTypeLabel(a.entity?.type)})</span>
                                          </td>
                                          <td className="muted">{a.category?.name || '—'}</td>
                                          <td style={{ minWidth: 160 }}>
                                            <input
                                              className="input"
                                              value={draft}
                                              inputMode="decimal"
                                              disabled={!meOk.isFamilyAdmin || adminSavingId === a.id}
                                              onChange={(ev) =>
                                                setAllocationLimitDraft((prev) => ({
                                                  ...prev,
                                                  [a.id]: ev.target.value,
                                                }))
                                              }
                                            />
                                          </td>
                                          <td className="muted">
                                            <input
                                              type="checkbox"
                                              checked={!!a.isActive}
                                              disabled={!meOk.isFamilyAdmin || adminSavingId === a.id}
                                              onChange={(ev) => patchBudgetAllocation(a.id, { isActive: ev.target.checked })}
                                            />
                                          </td>
                                          <td>
                                            <div className="sectionRow">
                                              <button
                                                className="btn btnGhost btnSm"
                                                disabled={!meOk.isFamilyAdmin || adminSavingId === a.id || !changed}
                                                onClick={() => patchBudgetAllocation(a.id, { monthlyLimit: draft.trim() })}
                                                type="button"
                                              >
                                                Guardar
                                              </button>
                                              <button
                                                className="btn btnDanger btnSm"
                                                disabled={!meOk.isFamilyAdmin || adminSavingId === a.id}
                                                onClick={() => deleteBudgetAllocation(a.id)}
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
                              <div className="muted">Aún no hay montos.</div>
                            )}
                          </div>
                        ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="chartBox">
                    <div className="sectionRow" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div>
                        <h3 className="chartTitle" style={{ margin: 0 }}>
                          Concentrado del presupuesto
                        </h3>
                        <div className="muted" style={{ marginTop: 6 }}>
                          Año {budgetConcentrado.year} • Cuentas: {budgetConcentrado.accounts}
                        </div>
                      </div>

                      <div className="sectionRow" style={{ flexWrap: 'wrap' }}>
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
                        <span className={`pill ${setupChecklist.hasObject ? 'pillOk' : 'pillWarn'}`}>Partidas: {setupChecklist.objectCount}</span>
                        <span className={`pill ${setupChecklist.hasCategory ? 'pillOk' : 'pillWarn'}`}>Categorías: {setupChecklist.categoryCount}</span>
                        <span className={`pill ${setupChecklist.hasAllocation ? 'pillOk' : 'pillWarn'}`}>Montos: {setupChecklist.allocationCount}</span>
                        <button
                          className="btn btnGhost btnSm"
                          onClick={() => setPeopleBudgetOpen(true)}
                          disabled={loading}
                          type="button"
                          title="Análisis por integrante (presupuesto individual)"
                        >
                          Integrantes
                        </button>
                        {meOk.isFamilyAdmin ? (
                          <>
                            <button
                              className="btn btnGhost btnSm"
                              onClick={() => openBudgetModal(undefined, 'montos')}
                              type="button"
                              title="Crea/edita los montos del presupuesto (por cuenta y categoría)"
                            >
                              {setupChecklist.needsSetup ? 'Crear presupuesto' : 'Editar presupuesto'}
                            </button>
                            <button
                              className={`btn btnPrimary btnSm ${
                                !setupChecklist.needsSetup && familyDetails && !familyDetails.setupComplete ? 'pulseAction' : ''
                              }`}
                              onClick={confirmPlan}
                              disabled={loading || setupChecklist.needsSetup}
                              type="button"
                              title={setupChecklist.needsSetup ? 'Completa partidas/categorías/montos antes de confirmar' : 'Confirma el plan'}
                            >
                              Confirmar plan
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {!meOk.isFamilyAdmin ? (
                      <>
                        <div className="spacer8" />
                        <div className="muted">
                          Tu usuario no es <b>Admin</b>. Solo Admin puede crear partidas/categorías/montos. Pide al Admin que te cambie a Admin en “Usuarios”.
                        </div>
                      </>
                    ) : null}

                    <div className="spacer16" />

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
                        className="btn btnDanger btnSm modalClose"
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
                            <button
                              className="btn btnDanger btnSm modalClose"
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
                          </div>
                        </div>

                        <div className="peopleStudioBody">
                          <aside className="peopleStudioSidebar">
                            <div className="card">
                              <div className="cardHeader">
                                <div>
                                  <h3 className="cardTitle">Controles</h3>
                                  <div className="cardDesc">Personas ↔ Partidas • Detalle ↔ Matriz • filtros rápidos</div>
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
                                    Partidas
                                  </button>
                                </div>

                                <div className="spacer12" />

                                <div className="tabRow" role="tablist" aria-label="Vista de análisis">
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
                                      Objeto
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
                                      Categoría (en este objeto)
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
                                      title="Abrir lista rápida de partidas"
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
                                          placeholder="Buscar objeto…"
                                        />
                                        <div className="spacer8" />
                                        <div className="peopleList" role="listbox" aria-label="Lista de partidas">
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
                                              <option value="objects">Partidas</option>
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
                                    : 'Tip: en “Detalle” verás “A quién” por cuenta (ej. Gasolina/Supermercado). En “Matriz” verás Consumo → Objeto.'}
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
                                                Sin cuentas para este integrante con la cobertura actual. Tip: crea un objeto <b>PERSON</b> con su nombre y
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
                                          ? 'Partidas → Personas'
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
                                                  ? 'De qué (Objeto)'
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
                                            <div className="kpiDelta">Asignado al objeto</div>
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
                                                          title="Gastó en este objeto, pero no está marcado como responsable"
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
                                            Opcional: define responsables en <b>Presupuesto → Partidas → Responsables</b>.
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="card">
                                      <div className="cardHeader">
                                        <div>
                                          <h3 className="cardTitle">Cuentas del objeto</h3>
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
                                                ? `Sin cuentas para ${budgetObjectsSelectedView.categoryNameView} en este objeto.`
                                                : 'Sin cuentas para este objeto.'}{' '}
                                              Tip: asigna montos en “Configurar presupuesto”.
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="card">
                                    <div className="cardBody muted">Selecciona un objeto.</div>
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
                                        • Columnas: Partidas
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
                                <div className="cardBody muted">Aún no hay partidas con presupuesto en esta familia.</div>
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
                        Objeto
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
                              {c.name}
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
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Cuenta</th>
                            <th style={{ textAlign: 'right' }}>Presupuesto</th>
                            <th style={{ textAlign: 'right' }}>Gastado</th>
                            <th style={{ textAlign: 'right' }}>Disponible</th>
                            <th style={{ textAlign: 'center' }}>Estado</th>
                            <th title="Se define por el tipo de objeto (Persona = Individual; otros = Compartido)">Tipo (auto)</th>
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
                    ) : (
                      <div className="muted">Aún no hay cuentas/montos asignados. Ve a “Configurar presupuesto”.</div>
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
                          <div className="muted">Aún no hay categorías o montos asignados.</div>
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
                            <th>Objeto</th>
                            <th>Categoría</th>
                            <th>Usuario</th>
                            <th>Monto</th>
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
                              <td className="muted">{Array.isArray(t.receipts) ? t.receipts.length : 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="muted">Sin transacciones aún.</div>
                    )}
                  </details>

                  {/*
                  <div className="spacer16" />

                  <details ref={budgetAdminRef} className="details">
                    <summary>Configurar presupuesto (Partidas, Categorías y Montos)</summary>
                    <div className="spacer16" />
                    <div className="sectionRow" style={{ justifyContent: 'space-between' }}>
                      <div className="tabRow" role="tablist" aria-label="Tabs de configuración de presupuesto">
                        <button
                          className={`tabBtn ${budgetAdminTab === 'objetos' ? 'tabBtnActive' : ''}`}
                          onClick={() => setBudgetAdminTab('objetos')}
                          type="button"
                          role="tab"
                          aria-selected={budgetAdminTab === 'objetos'}
                        >
                          Partidas
                        </button>
                        <button
                          className={`tabBtn ${budgetAdminTab === 'categorias' ? 'tabBtnActive' : ''}`}
                          onClick={() => setBudgetAdminTab('categorias')}
                          type="button"
                          role="tab"
                          aria-selected={budgetAdminTab === 'categorias'}
                        >
                          Categorías
                        </button>
                        <button
                          className={`tabBtn ${budgetAdminTab === 'montos' ? 'tabBtnActive' : ''}`}
                          onClick={() => setBudgetAdminTab('montos')}
                          type="button"
                          role="tab"
                          aria-selected={budgetAdminTab === 'montos'}
                        >
                          Montos
                        </button>
                      </div>
                    </div>

                    <div className="spacer16" />

                    {budgetAdminTab === 'objetos' ? (
                      <section className="card">
                        <div className="cardHeader">
                          <div>
                            <h2 className="cardTitle">Partidas presupuestales</h2>
                            <p className="cardDesc">Ej. Persona, Casa, Mascota, Vehículo, Fondo</p>
                          </div>
                        </div>
                        <div className="cardBody">
                          <div className="fieldGrid">
                            <label>
                              Tipo
                              <select className="select" value={beType} onChange={(e) => setBeType(e.target.value as EntityType)}>
                                {ENTITY_TYPE_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Nombre
                              <input className="input" placeholder="Nombre" value={beName} onChange={(e) => setBeName(e.target.value)} />
                            </label>
                            <label className="checkboxRow">
                              <input type="checkbox" checked={beInBudget} onChange={(e) => setBeInBudget(e.target.checked)} />
                              Participa en presupuesto
                            </label>
                            <label className="checkboxRow">
                              <input type="checkbox" checked={beInReports} onChange={(e) => setBeInReports(e.target.checked)} />
                              Participa en reportes
                            </label>
                            <div className="sectionRow">
                              <button
                                className="btn btnPrimary"
                                onClick={createEntity}
                                disabled={loading || !meOk.isFamilyAdmin || !beName.trim()}
                              >
                                Crear objeto
                              </button>
                            </div>
                          </div>
                          <div className="spacer16" />
                          <div
                            className="muted"
                            style={{ fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 12 }}
                          >
                            Existentes
                          </div>
                          <div className="spacer8" />
                          {entityItems.length ? (
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>Tipo</th>
                                  <th>Nombre</th>
                                  <th>Presupuesto</th>
                                  <th>Reportes</th>
                                  <th>Activo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entityItems.map((e: any) => (
                                  <tr key={e.id}>
                                    <td>{entityTypeLabel(e.type)}</td>
                                    <td>{e.name}</td>
                                    <td className="muted">{e.participatesInBudget ? 'Sí' : 'No'}</td>
                                    <td className="muted">{e.participatesInReports ? 'Sí' : 'No'}</td>
                                    <td className="muted">{e.isActive ? 'Sí' : 'No'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="muted">Aún no hay partidas. Crea al menos 1 partida.</div>
                          )}
                        </div>
                      </section>
                    ) : null}

                    {budgetAdminTab === 'categorias' ? (
                      <section className="card">
                        <div className="cardHeader">
                          <div>
                            <h2 className="cardTitle">Categorías</h2>
                            <p className="cardDesc">Ej. EXPENSE</p>
                          </div>
                        </div>
                        <div className="cardBody">
                          <div className="fieldGrid">
                            <label>
                              Tipo
                              <input className="input" placeholder="EXPENSE" value={bcType} onChange={(e) => setBcType(e.target.value)} />
                            </label>
                            <label>
                              Nombre
                              <input className="input" placeholder="Nombre" value={bcName} onChange={(e) => setBcName(e.target.value)} />
                            </label>
                            <div className="sectionRow">
                              <button className="btn btnPrimary" onClick={createCategory} disabled={loading || !meOk.isFamilyAdmin || !bcName.trim()}>
                                Crear categoría
                              </button>
                            </div>
                          </div>
                          <div className="spacer16" />
                          <div
                            className="muted"
                            style={{ fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 12 }}
                          >
                            Existentes
                          </div>
                          <div className="spacer8" />
                          {categoryItems.length ? (
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>Tipo</th>
                                  <th>Nombre</th>
                                  <th>Activo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {categoryItems.map((c: any) => (
                                  <tr key={c.id}>
                                    <td>{c.type}</td>
                                    <td>{c.name}</td>
                                    <td className="muted">{c.isActive ? 'Sí' : 'No'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="muted">Aún no hay categorías. Crea al menos 1 categoría.</div>
                          )}
                        </div>
                      </section>
                    ) : null}

                    {budgetAdminTab === 'montos' ? (
                      <section className="card">
                      <div className="cardHeader">
                        <div>
                          <h2 className="cardTitle">Asignar montos</h2>
                          <p className="cardDesc">Objeto + Categoría + Monto mensual</p>
                        </div>
                      </div>
                      <div className="cardBody">
                        <div className="fieldRow">
                          <label>
                            Objeto
                            <select className="select" value={alEntityId} onChange={(e) => setAlEntityId(e.target.value)}>
                              <option value="">Objeto…</option>
                              {entityItems.map((e: any) => (
                                <option key={e.id} value={e.id}>
                                  {entityTypeLabel(e.type)}: {e.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Categoría
                            <select className="select" value={alCategoryId} onChange={(e) => setAlCategoryId(e.target.value)}>
                              <option value="">Categoría…</option>
                              {categoryItems.map((c: any) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="spacer8" />
                        <label>
                          Monto mensual
                          <input className="input" placeholder="Ej. 1000" value={alLimit} onChange={(e) => setAlLimit(e.target.value)} />
                        </label>
                        <div className="spacer8" />
                        <div className="sectionRow">
                          <button
                            className="btn btnPrimary"
                            onClick={createAllocation}
                            disabled={loading || !meOk.isFamilyAdmin || !alEntityId || !alCategoryId || !alLimit.trim()}
                          >
                            Guardar monto
                          </button>
                        </div>
                        <div className="spacer16" />
                        <div
                          className="muted"
                          style={{ fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 12 }}
                        >
                          Asignaciones existentes
                        </div>
                        <div className="spacer8" />
                        {allocationItems.length ? (
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Objeto</th>
                                <th>Categoría</th>
                                <th>Monto</th>
                                <th>Activo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {allocationItems.map((a: any) => (
                                <tr key={a.id}>
                                  <td>
                                    <span className="muted">{entityTypeLabel(a.entity?.type)}:</span> {a.entity?.name || '—'}
                                  </td>
                                  <td>{a.category?.name || '—'}</td>
                                  <td style={{ fontWeight: 900 }}>{formatMoney(Number(a.monthlyLimit), currency)}</td>
                                  <td className="muted">{a.isActive ? 'Sí' : 'No'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="muted">Aún no has asignado montos.</div>
                        )}
                      </div>
                    </section>
                    ) : null}
                  </details>
                  */}
                </>
              ) : null}

              {view === 'transacciones' ? (
                <>
                  <div className="chartBox txBoxTight txCompact">
                    <div
                      className="sectionRow txAddHeader"
                      style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-end' }}
                    >
                      <div>
                        <h3 className="chartTitle" style={{ margin: 0 }}>
                          Registrar gasto
                        </h3>
                        <div className="muted">Con o sin comprobante (ticket).</div>
                      </div>

                      <div className="tabRow" role="tablist" aria-label="Modo para registrar gasto">
                        <button
                          className={`tabBtn ${txAddMode === 'with_receipt' ? 'tabBtnActive' : ''}`}
                          type="button"
                          role="tab"
                          aria-selected={txAddMode === 'with_receipt'}
                          onClick={() => setTxAddMode('with_receipt')}
                        >
                          Con comprobante
                        </button>
                        <button
                          className={`tabBtn ${txAddMode === 'without_receipt' ? 'tabBtnActive' : ''}`}
                          type="button"
                          role="tab"
                          aria-selected={txAddMode === 'without_receipt'}
                          onClick={() => setTxAddMode('without_receipt')}
                        >
                          Sin comprobante
                        </button>
                      </div>
                    </div>

                    <div className="spacer8" />

                    {txAddMode === 'with_receipt' ? (
                      <div className="txAddReceiptGrid">
                        <div className="txFileField">
                          <div className="txFieldLabel">Fotos (1–8)</div>
                          <div className="txFileRow">
                            <input
                              id="txReceiptFiles"
                              className="txFileInput"
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) => setTxNewReceiptFiles(Array.from(e.target.files || []))}
                              disabled={loading || txNewReceiptBusy}
                            />
                            <label htmlFor="txReceiptFiles" className="btn btnGhost btnSm">
                              Seleccionar
                            </label>
                            <span className="muted txFileStatus">
                              {txNewReceiptFiles.length
                                ? `${txNewReceiptFiles.length} foto${txNewReceiptFiles.length === 1 ? '' : 's'}`
                                : 'Ninguna seleccionada'}
                            </span>
                          </div>
                          <div className="muted txHelper">Tip: ticket largo → 20–30% de traslape.</div>
                        </div>

                        <label>
                          Cuenta (opcional)
                          <select
                            className="select"
                            value={txNewReceiptAllocationId}
                            onChange={(e) => setTxNewReceiptAllocationId(e.target.value)}
                            disabled={loading || txNewReceiptBusy}
                          >
                            <option value="">Auto (recomendado)</option>
                            {(allocations || []).map((a: any) => (
                              <option key={a.id} value={a.id}>
                                {a.entity?.name} → {a.category?.name} (límite {formatMoney(Number(a.monthlyLimit), currency)})
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="txAddActions">
                          <button
                            className={`btn btnPrimary btnSm ${txNewReceiptFiles.length && !txNewReceiptBusy ? 'pulseAction' : ''}`}
                            onClick={createTransactionFromReceipt}
                            disabled={loading || txNewReceiptBusy || !txNewReceiptFiles.length}
                            type="button"
                          >
                            {txNewReceiptBusy ? 'Registrando…' : 'Registrar gasto con comprobante'}
                          </button>
                          <span className="muted">DOMUS extrae proveedor/total y te lleva a revisar.</span>
                        </div>
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
                            className="btn btnPrimary btnSm"
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
                    <div className="sectionRow" style={{ justifyContent: 'space-between' }}>
                      <h3 className="chartTitle" style={{ margin: 0 }}>
                        Transacciones
                      </h3>
                      <span className="muted">
                        Mostrando {txFilteredItems.length} de {txItems.length} • click en una fila para ver detalle
                      </span>
                    </div>
                    <div className="spacer8" />
                    <div className="txFilterBar">
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
                        Comprobante
                        <select className="select" value={txFltReceipt} onChange={(e) => setTxFltReceipt(e.target.value as ReceiptFilter)}>
                          <option value="all">Todos</option>
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
                        Objeto
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
                        <input className="input" placeholder="Ej. HEB, gasolina, renta…" value={txSearch} onChange={(e) => setTxSearch(e.target.value)} />
                      </label>
                    </div>

                    <div className="spacer8" />

                    {txFilteredItems.length ? (
                      <table className="table">
                        <thead>
                          <tr>
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
                            const status =
                              !hasReceipt
                                ? { cls: 'pill', label: 'Sin' }
                                : toConfirm > 0
                                  ? { cls: 'pill pillWarn', label: `Por confirmar (${toConfirm})` }
                                  : pending > 0
                                    ? { cls: 'pill pillWarn', label: `Pendiente (${pending})` }
                                    : confirmed > 0
                                      ? { cls: 'pill pillOk', label: `Confirmado (${confirmed})` }
                                      : { cls: 'pill', label: `Con (${receipts.length})` }
                            return (
                            <tr key={t.id} onClick={() => openTx(t.id)} style={{ cursor: 'pointer' }}>
                              <td style={{ fontWeight: 900 }}>{formatMoney(Number(t.amount), currency)}</td>
                              <td>{new Date(t.date).toLocaleDateString('es-MX')}</td>
                              <td>
                                {t.allocation?.entity?.name} / {t.allocation?.category?.name}
                              </td>
                              <td className="muted">{t.user?.name || t.user?.email || '—'}</td>
                              <td className="muted">{t.description || '—'}</td>
                              <td>
                                <span className={status.cls}>{status.label}</span>
                              </td>
                            </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="muted">No hay transacciones con este filtro.</div>
                    )}
                  </div>
                </>
              ) : null}

              {view === 'usuarios' ? (
                <section className="card">
                  <div className="cardHeader">
                    <div>
                      <h2 className="cardTitle">Usuarios (familia activa)</h2>
                      <p className="cardDesc">Agrega usuarios, edita nombres, cambia roles y elimina accesos.</p>
                    </div>
                  </div>
                  <div className="cardBody">
                    <div className="grid grid2">
                      <div className="cardSub">
                        <div className="subTitle">Agregar / invitar</div>
                        <div className="spacer8" />
                        <div className="fieldGrid">
                          <label>
                            Nombre (opcional)
                            <input className="input" placeholder="Nombre" value={mName} onChange={(e) => setMName(e.target.value)} />
                          </label>
                          <label>
                            Email
                            <input className="input" placeholder="Email" value={mEmail} onChange={(e) => setMEmail(e.target.value)} />
                          </label>
                          <label>
                            Contraseña (si es usuario nuevo)
                            <input
                              className="input"
                              placeholder="Contraseña"
                              type="password"
                              value={mPass}
                              onChange={(e) => setMPass(e.target.value)}
                            />
                          </label>
                          <label className="checkboxRow">
                            <input type="checkbox" checked={mAdmin} onChange={(e) => setMAdmin(e.target.checked)} />
                            Hacer admin
                          </label>
                          <div className="sectionRow">
                            <button className="btn btnPrimary" onClick={inviteMember} disabled={loading || memberSavingId !== null}>
                              Agregar usuario
                            </button>
                          </div>
                          <div className="note">Solo Admin puede agregar o cambiar roles.</div>
                        </div>
                      </div>

                      <div className="cardSub">
                        <div className="subTitle">Lista</div>
                        <div className="spacer8" />
                        {Array.isArray(members) ? (
                          members.length ? (
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>Nombre</th>
                                  <th>Email</th>
                                  <th>Admin</th>
                                  <th>Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {members.map((m: any) => {
                                  const isSelf = m.id === meOk.user.id
                                  const canEditName = meOk.isFamilyAdmin || isSelf
                                  const draft = memberNameDraft[m.id] ?? String(m.name || '')
                                  const changed = draft.trim() !== String(m.name || '')
                                  return (
                                    <tr key={m.id}>
                                      <td style={{ minWidth: 220 }}>
                                        {canEditName ? (
                                          <input
                                            className="input"
                                            value={draft}
                                            placeholder="Nombre"
                                            disabled={memberSavingId === m.id}
                                            onChange={(e) =>
                                              setMemberNameDraft((prev) => ({
                                                ...prev,
                                                [m.id]: e.target.value,
                                              }))
                                            }
                                          />
                                        ) : (
                                          <span style={{ fontWeight: 900 }}>{m.name || '—'}</span>
                                        )}
                                      </td>
                                      <td className="muted">{m.email}</td>
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
                                      <td>
                                        <div className="sectionRow">
                                          {canEditName ? (
                                            <button
                                              className="btn btnGhost btnSm"
                                              onClick={() => saveUserName(m.id)}
                                              disabled={memberSavingId === m.id || !changed}
                                            >
                                              Guardar
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
                <section className="card">
                  <div className="cardHeader">
                    <div>
                      <h2 className="cardTitle">Tu sesión</h2>
                      <p className="cardDesc">Familias, rol y datos básicos.</p>
                    </div>
                  </div>
                  <div className="cardBody">
                    <div className="grid">
                      <div className="fieldRow">
                        <div>
                          <div className="muted" style={{ fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 12 }}>
                            Usuario
                          </div>
                          <div style={{ fontWeight: 900, marginTop: 6 }}>{meOk.user.name || '(Sin nombre)'}</div>
                          <div className="muted">{meOk.user.email}</div>
                        </div>
                        <div>
                          <div className="muted" style={{ fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 12 }}>
                            Familia activa
                          </div>
                          <div style={{ fontWeight: 900, marginTop: 6 }}>{meOk.activeFamily?.name || '(Ninguna)'}</div>
                          <div className="muted">Rol: {meOk.isFamilyAdmin ? 'Administrador' : 'Usuario'}</div>
                        </div>
                      </div>

                      <div className="hr" />

                      <div className="grid grid2">
                        <div className="cardSub">
                          <div className="subTitle">Seleccionar familia</div>
                          <div className="spacer8" />
                          <div className="sectionRow">
                            {meOk.families?.length ? (
                              meOk.families.map((f) => (
                                <button
                                  key={f.id}
                                  className={`btn ${f.id === activeFamilyId ? 'btnPrimary' : 'btnGhost'} btnSm`}
                                  onClick={() => switchFamily(f.id)}
                                  disabled={loading || f.id === activeFamilyId}
                                >
                                  {f.name}
                                </button>
                              ))
                            ) : (
                              <span className="muted">No hay familias.</span>
                            )}
                          </div>
                        </div>

                        <div className="cardSub">
                          <div className="subTitle">Crear nueva familia</div>
                          <div className="spacer8" />
                          <label>
                            Nombre
                            <input
                              className="input"
                              placeholder="Nombre de la familia"
                              value={newFamilyName}
                              onChange={(e) => setNewFamilyName(e.target.value)}
                            />
                          </label>
                          <div className="spacer8" />
                          <div className="sectionRow">
                            <button className="btn btnPrimary btnSm" onClick={createFamily} disabled={loading || !newFamilyName.trim()}>
                              Crear y seleccionar
                            </button>
                            <button className="btn btnGhost btnSm" onClick={() => go('usuarios')} disabled={loading}>
                              Ver usuarios
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="hr" />

                      <div className="grid grid2">
                        <div className="cardSub">
                          <div className="subTitle">Editar familia activa</div>
                          <div className="spacer8" />
                          {!familyDetails ? (
                            <div className="muted">Cargando familia…</div>
                          ) : (
                            <div className="fieldGrid">
                              <label>
                                Nombre
                                <input className="input" value={famName} onChange={(e) => setFamName(e.target.value)} />
                              </label>
                              <div className="fieldRow">
                                <label>
                                  Moneda
                                  <input className="input" value={famCurrency} onChange={(e) => setFamCurrency(e.target.value)} />
                                </label>
                                <label>
                                  Día de corte (1–28)
                                  <input
                                    className="input"
                                    inputMode="numeric"
                                    value={famCutoffDay}
                                    onChange={(e) => setFamCutoffDay(e.target.value)}
                                  />
                                </label>
                              </div>
                              <label>
                                Inicio de presupuesto
                                <input
                                  className="input"
                                  type="date"
                                  value={famBudgetStartDate}
                                  onChange={(e) => setFamBudgetStartDate(e.target.value)}
                                />
                              </label>
                              <div className="sectionRow">
                                <button className="btn btnPrimary btnSm" onClick={updateFamily} disabled={savingFamily || loading || !famName.trim()}>
                                  {savingFamily ? 'Guardando…' : 'Guardar cambios'}
                                </button>
                                <button className="btn btnDanger btnSm" onClick={deleteActiveFamily} disabled={savingFamily || loading || !meOk.isFamilyAdmin}>
                                  Eliminar familia
                                </button>
                              </div>
                              <div className="note">
                                Solo <b>Admin</b> puede editar. Cambios aplican a la familia activa.
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="cardSub">
                          <div className="subTitle">Resumen de organización</div>
                          <div className="spacer8" />
                          <div className="sectionRow" style={{ flexWrap: 'wrap', gap: 8 }}>
                            <span className="pill">Usuarios: {familySummary.memberCount}</span>
                            <span className="pill">Admins: {familySummary.adminCount}</span>
                            <span className="pill">Partidas activas: {familySummary.objectCount}</span>
                            <span className="pill">En presupuesto: {familySummary.budgetObjectCount}</span>
                            <span className="pill">En reportes: {familySummary.reportObjectCount}</span>
                            <span className="pill">Categorías: {familySummary.categoryCount}</span>
                            <span className="pill">Montos: {familySummary.allocationCount}</span>
                            <span className="pill">Presupuesto total: {formatMoney(familySummary.budgetTotal, currency)}</span>
                          </div>
                          <div className="spacer8" />
                          <div className="orgCard">
                            <div className="orgTree">
                              <div className="orgRowCenter">
                                <div className="orgNode orgNodeMain">
                                  <div className="orgNodeSquare">{(familyDetails?.name || activeFamilyName || 'F')[0] || 'F'}</div>
                                  <div className="orgLabel">
                                    <span className="name">{familyDetails?.name || activeFamilyName || 'Familia'}</span>
                                    <span className="muted">Familia</span>
                                  </div>
                                </div>
                              </div>
                              <div className="orgBridge" aria-hidden="true">
                                <span className="orgBridgeTap" style={{ left: '33.33%' }} />
                                <span className="orgBridgeTap" style={{ left: '66.66%' }} />
                              </div>
                              <div className="orgBranches">
                                <div className="orgBranch">
                                  <div className="orgBranchTitle">Usuarios</div>
                                  <div className="orgRowWrap">
                                    {orgUsers.length ? (
                                      orgUsers.map((u) => (
                                        <div key={u.id} className="orgNode">
                                          <div className="orgNodeCircle">{initialsFromName(u.name)}</div>
                                          <div className="orgLabel">
                                            <span className="name">{u.name}</span>
                                            <span className="muted">{u.subtitle || (u.isAdmin ? 'Admin' : 'Usuario')}</span>
                                          </div>
                                          {u.isAdmin ? <span className="orgTag">Admin</span> : null}
                                        </div>
                                      ))
                                    ) : (
                                      <div className="muted">Sin usuarios.</div>
                                    )}
                                  </div>
                                </div>
                                <div className="orgBranch">
                                  <div className="orgBranchTitle">Partidas</div>
                                  <div className="orgRowWrap">
                                    {orgEntities.length ? (
                                      orgEntities.map((o) => (
                                        <div key={o.id} className="orgNode">
                                          <div className="orgNodeSquare">{initialsFromName(o.name)}</div>
                                          <div className="orgLabel">
                                            <span className="name">{o.name}</span>
                                            <span className="muted">{o.type}</span>
                                          </div>
                                          <span className="orgTag">{o.inBudget ? 'Presupuesto' : 'Sin presupuesto'}</span>
                                          <span className="orgTag">{o.inReports ? 'Reportes' : 'Sin reportes'}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="muted">Sin partidas.</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="spacer8" />
                          {entityItems.length ? (
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>Objeto</th>
                                  <th>Presupuesto</th>
                                  <th>Reportes</th>
                                  <th>Activo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entityItems
                                  .filter((e: any) => e?.isActive !== false)
                                  .slice(0, 12)
                                  .map((e: any) => (
                                    <tr key={e.id}>
                                      <td>
                                        <span className="muted">{entityTypeLabel(e.type)}:</span> {e.name}
                                      </td>
                                      <td className="muted">{e.participatesInBudget ? 'Sí' : 'No'}</td>
                                      <td className="muted">{e.participatesInReports ? 'Sí' : 'No'}</td>
                                      <td className="muted">{e.isActive ? 'Sí' : 'No'}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="muted">Aún no hay partidas.</div>
                          )}
                          {familySummary.excludedFromReports?.length ? (
                            <>
                              <div className="spacer8" />
                              <div className="muted">
                                Excluidos de reportes:{' '}
                                {familySummary.excludedFromReports
                                  .slice(0, 6)
                                  .map((e: any) => `${entityTypeLabel(e.type)}: ${e.name}`)
                                  .join(' • ')}
                                {familySummary.excludedFromReports.length > 6 ? ' • …' : ''}
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="hr" />

                      <div className="cardSub">
                        <div className="subTitle">Administración (Admin)</div>
                        <div className="spacer8" />
                        {!meOk.isFamilyAdmin ? (
                          <div className="muted">Solo Admin puede administrar usuarios y presupuesto.</div>
                        ) : (
                          <>
                            <div className="muted">Accesos rápidos (sin tablas aquí).</div>
                            <div className="spacer8" />
                            <div className="sectionRow">
                              <button className="btn btnGhost btnSm" onClick={() => go('usuarios')} disabled={loading} type="button">
                                Usuarios
                              </button>
                              <button
                                className="btn btnGhost btnSm"
                                onClick={() => {
                                  go('presupuesto')
                                  setTimeout(() => openBudgetModal(), 50)
                                }}
                                disabled={loading}
                                type="button"
                              >
                                Presupuesto
                              </button>
                              <button
                                className="btn btnGhost btnSm"
                                onClick={() => {
                                  setReportsTab('detalle')
                                  setReportsTableTab('categorias')
                                  setReportsOpen(true)
                                }}
                                disabled={loading}
                                type="button"
                              >
                                Reportes
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {view === 'tx' ? (
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
                            className="sectionRow"
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

                                <div className="chartBox">
                                  <h3 className="chartTitle">Auditoría</h3>
                                  <div className="spacer8" />
                                  <div className="muted">
                                    Creado: {selectedTx.createdAt ? new Date(selectedTx.createdAt).toLocaleString('es-MX') : '—'}
                                  </div>
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
                                        const label = isConfirmed ? 'Confirmado' : hasExtraction ? 'Por confirmar' : 'Pendiente'
                                        return (
                                          <button
                                            key={rid}
                                            className={`${cls} ${isActive ? 'pillActive' : ''}`}
                                            onClick={() => selectTxDetailReceipt(rid)}
                                            type="button"
                                            title={`Recibo ${rid.slice(0, 6)}… • ${label}`}
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
                                                      {receiptExtraction.items.map((it: any) => {
                                                        const id = String(it?.id || '')
                                                        const locked = !!it?.isAdjustment || !!it?.isPlaceholder
                                                        const lineNo = it.lineNumber || '—'
                                                        const desc = String(it?.description || '—')

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
                                                            key={id || it.lineNumber}
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
                                    className={`pill pillOk pillBtn ${
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
                                  <div className="receiptPanelHeader">
                                    <div>
                                      <div className="receiptPanelTitle">Datos extraídos</div>
                                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                                        Proveedor y total no se editan por seguridad.
                                      </div>
                                    </div>
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
              ) : null}

            </>
          )}
        </section>
      </div>
    </main>
  )
}

