'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import type { Transaction, User } from '@/lib/types'
import { XIcon, PlusIcon } from '@/lib/icons'
import SAPLayout from '@/components/SAPLayout'
import { useTranslation, getLanguage, setLanguage, type Language } from '@/lib/i18n'
import { formatCurrency } from '@/lib/currency'
import { safePushLogin, setReceiptProcessing } from '@/lib/receiptProcessing'
import { getAuthHeaders, getToken } from '@/lib/auth'

// Constantes estáticas
const INCOME_CATEGORIES = ['Salario', 'Bonos', 'Rentas', 'Reembolsos', 'Inversiones', 'Otros Ingresos']
const EXPENSE_CATEGORIES = ['Servicios Basicos', 'Mercado', 'Vivienda', 'Transporte', 'Impuestos', 'Educacion', 'Salud', 'Vida Social']

const INCOME_SUBCATEGORIES: Record<string, string[]> = {
  'Salario': ['Salario Fijo', 'Salario Variable'],
  'Bonos': ['Bono Anual', 'Bono Quincenal', 'Bono Extra'],
  'Rentas': ['Renta Propiedades', 'Renta Inversiones'],
  'Reembolsos': ['Reembolso Gastos', 'Reembolso Impuestos'],
  'Inversiones': ['Dividendos', 'Intereses', 'Ganancias Capital'],
  'Otros Ingresos': ['Regalos', 'Premios', 'Otros']
}

const EXPENSE_SUBCATEGORIES: Record<string, string[]> = {
  'Servicios Basicos': ['Electricidad CFE', 'Agua Potable', 'Gas LP', 'Internet', 'Entretenimiento', 'Garrafones Agua', 'Telcel'],
  'Mercado': ['Mercado General'],
  'Vivienda': ['Cuotas Olinala', 'Seguro Vivienda', 'Mejoras y Remodelaciones'],
  'Transporte': ['Gasolina', 'Mantenimiento coches', 'Seguros y Derechos', 'Lavado'],
  'Impuestos': ['Predial'],
  'Educacion': ['Colegiaturas'],
  'Salud': ['Consulta', 'Medicamentos', 'Seguro Medico', 'Prevencion'],
  'Vida Social': ['Salidas Personales', 'Salidas Familiares', 'Cumpleanos', 'Aniversarios', 'Regalos Navidad']
}

export default function TransactionsPage() {
  const router = useRouter()
  const [language, setLanguageState] = useState<Language>(getLanguage())
  const t = useTranslation(language)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [familyMembers, setFamilyMembers] = useState<User[]>([])
  const [budgets, setBudgets] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadTime, setUploadTime] = useState(0)
  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [selectedUserForReceipt, setSelectedUserForReceipt] = useState<number | null>(null)
  const [uploadAbortController, setUploadAbortController] = useState<AbortController | null>(null)
  const isProcessingReceiptRef = useRef(false)
  const [receiptExtractMode, setReceiptExtractMode] = useState<'precise' | 'fast' | 'text'>('precise')
  const [postScanResult, setPostScanResult] = useState<{
    receipt: any
    responseData: any
  } | null>(null)
  const postScanProductsRef = useRef<HTMLDivElement | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filters, setFilters] = useState({
    category: '',
    subcategory: '',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    merchant: ''
  })
  const [showFilters, setShowFilters] = useState(false)
  const [newTransaction, setNewTransaction] = useState({
    transaction_type: 'expense' as 'income' | 'expense',
    amount: 0,
    category: '',
    subcategory: '',
    concept: '',
    date: new Date().toISOString().split('T')[0],
    merchant_or_beneficiary: '',
    family_budget_id: null as number | null
  })

  // Cleanup: cancelar peticiones pendientes al desmontar
  useEffect(() => {
    return () => {
      if (uploadAbortController) {
        uploadAbortController.abort()
      }
    }
  }, [uploadAbortController])

  const backendUrl = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) || ''
  const apiBase = backendUrl.replace(/\/$/, '')

  const parseNotesSafe = (notes?: string) => {
    if (!notes) return null as any
    try {
      return JSON.parse(notes)
    } catch {
      return null as any
    }
  }

  const cleanItemName = (description: string) => {
    const s = String(description || '').trim()
    if (!s) return ''
    const tokens = s.split(/\s+/)
    let numericCount = 0
    let hasDecimal = false
    for (let i = tokens.length - 1; i >= 0 && numericCount < 5; i--) {
      const tok = tokens[i]
      const normalized = tok.replace(/[()]/g, '')
      if (/^-?\d+(?:[.,]\d+)?-?$/.test(normalized)) {
        numericCount += 1
        if (/[.,]\d+/.test(normalized)) hasDecimal = true
        continue
      }
      break
    }
    if (numericCount >= 2 && (hasDecimal || numericCount >= 3)) {
      return tokens.slice(0, Math.max(1, tokens.length - numericCount)).join(' ')
    }
    return s
  }

  const formatQty = (q: number) => Number(q).toFixed(3).replace(/\.?0+$/, '')

  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false

    const loadWithBackend = async (): Promise<boolean> => {
      const headers = await getAuthHeaders()
      const hasAuth = typeof headers === 'object' && headers !== null && 'Authorization' in (headers as Record<string, string>)
      if (!hasAuth) return false
      const token = getToken()
      if (!token) return false
      try {
        const meRes = await fetch(`${apiBase}/api/users/me`, {
          headers: headers as Record<string, string>,
          credentials: 'include',
        })
        if (cancelled) return true
        if (meRes.status === 401) {
          // Token inválido/expirado: limpiar y permitir fallback
          localStorage.removeItem('domus_token')
          return false
        }
        if (!meRes.ok) {
          // Si el backend está temporalmente inestable, NO mandar al usuario a login.
          console.error('Backend /api/users/me falló:', meRes.status, meRes.statusText)
          return true
        }
        const meData = await meRes.json()
        setUser(meData as User)
        const typeParam = filterType !== 'all' ? `&transaction_type=${filterType}` : ''
        const recRes = await fetch(`${apiBase}/api/transactions/?limit=1000${typeParam}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (cancelled) return true
        if (recRes.ok) {
          const list = await recRes.json()
          setTransactions((list || []) as Transaction[])
        } else {
          setTransactions([])
        }
        return true
      } catch {
        // Si el backend falla (red/timeout), mantener la pantalla sin forzar login.
        console.error('Error conectando con backend (transactions):', apiBase)
        return true
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const loadWithSupabase = async () => {
      const { data: { session } } = await Promise.race([
        supabase.auth.getSession(),
        new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 3000)
        ),
      ])
      if (cancelled) return
      if (!session) {
        // Evitar redirecciones durante escaneo de recibos (procesos largos).
        if (!isProcessingReceiptRef.current) {
          safePushLogin(router, 'transactions: no supabase session')
        }
        setLoading(false)
        return
      }
      await loadUserSupabase()
      await loadTransactionsSupabase()
    }

    const loadUserSupabase = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) return
        const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single()
        if (userData) setUser(userData as User)
      } catch (e) {
        console.error('Error cargando usuario:', e)
      }
    }

    const loadTransactionsSupabase = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
          // Evitar redirecciones durante escaneo de recibos (procesos largos).
          if (!isProcessingReceiptRef.current) {
            safePushLogin(router, 'transactions: no supabase user')
          }
          return
        }
        let query = supabase.from('transactions').select('*').eq('user_id', authUser.id).order('date', { ascending: false })
        if (filterType !== 'all') query = query.eq('transaction_type', filterType)
        const { data: transactionsData, error } = await query
        if (error) setTransactions([])
        else setTransactions((transactionsData || []) as Transaction[])
      } catch {
        setTransactions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    ;(async () => {
      const done = await loadWithBackend()
      if (cancelled) return
      if (!done) await loadWithSupabase()
    })()

    return () => { cancelled = true }
  }, [router, filterType, filters])

  const getAuthHeaders = (): HeadersInit => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('domus_token') : null
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    return headers
  }

  const loadTransactions = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('domus_token') : null
    if (token) {
      const typeParam = filterType !== 'all' ? `&transaction_type=${filterType}` : ''
      fetch(`${apiBase}/api/transactions/?limit=1000${typeParam}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : [])
        .then((list) => setTransactions(list || []))
        .catch(() => setTransactions([]))
      return
    }
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) return
      let q = supabase.from('transactions').select('*').eq('user_id', authUser.id).order('date', { ascending: false })
      if (filterType !== 'all') q = q.eq('transaction_type', filterType)
      q.then(({ data, error }) => {
        if (!error) setTransactions(data || [])
      })
    })
  }

  const handleEditStart = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setShowEditModal(true)
  }

  const handleEditTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTransaction) return
    
    try {
      const updates: any = {}
      
      const form = e.target as HTMLFormElement
      const formData = new FormData(form)
      
      const amount = parseFloat(formData.get('amount') as string)
      if (amount && amount > 0) {
        updates.amount = amount
      }
      
      const date = formData.get('date') as string
      if (date) {
        updates.date = date
      }
      
      const concept = formData.get('concept') as string
      if (concept !== undefined) {
        updates.concept = concept
      }
      
      const userId = formData.get('user_id') as string
      if (userId) {
        updates.user_id = parseInt(userId)
      }
      
      const budgetId = formData.get('family_budget_id') as string
      if (budgetId) {
        updates.family_budget_id = budgetId === 'none' ? null : parseInt(budgetId)
      }
      
      const token = typeof window !== 'undefined' ? localStorage.getItem('domus_token') : null
      if (token) {
        const res = await fetch(`${apiBase}/api/transactions/${editingTransaction.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(updates),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || 'Error al actualizar')
        }
      } else {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
          alert('No autenticado')
          return
        }
        const { error: updateError } = await supabase
          .from('transactions')
          .update(updates)
          .eq('id', editingTransaction.id)
          .eq('user_id', authUser.id)
        if (updateError) throw updateError
      }
      setShowEditModal(false)
      setEditingTransaction(null)
      loadTransactions()
      alert(t.transactions.editTransaction + ' ' + (language === 'es' ? 'exitosamente' : 'successfully'))
    } catch (error: any) {
      console.error('Error actualizando transacción:', error)
      alert(error.message || (language === 'es' ? 'Error al actualizar transacción' : 'Error updating transaction'))
    }
  }

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newTransaction.amount <= 0) {
      alert('El monto debe ser mayor a cero')
      return
    }
    
    if (!newTransaction.category || !newTransaction.subcategory) {
      alert('Por favor, selecciona una categoría y subcategoría')
      return
    }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('domus_token') : null
      if (token) {
        const body = {
          amount: newTransaction.amount,
          transaction_type: newTransaction.transaction_type,
          category: newTransaction.category,
          subcategory: newTransaction.subcategory,
          concept: newTransaction.concept || null,
          date: newTransaction.date,
          merchant_or_beneficiary: newTransaction.merchant_or_beneficiary || null,
          family_budget_id: newTransaction.family_budget_id,
        }
        const res = await fetch(`${apiBase}/api/transactions/`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || 'Error al crear')
        }
      } else {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
          alert('No autenticado')
          return
        }
        const { error: insertError } = await supabase
          .from('transactions')
          .insert({
            ...newTransaction,
            user_id: authUser.id,
            date: new Date(newTransaction.date).toISOString()
          })
        if (insertError) throw insertError
      }
      setShowCreateModal(false)
      setNewTransaction({
        transaction_type: 'expense',
        amount: 0,
        category: '',
        subcategory: '',
        concept: '',
        date: new Date().toISOString().split('T')[0],
        merchant_or_beneficiary: '',
        family_budget_id: null
      })
      loadTransactions()
    } catch (error: any) {
      alert(error.message || 'Error al crear transacción')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadFiles(files)
  }

  const handleFileUpload = async () => {
    if (!uploadFiles || uploadFiles.length === 0) {
      alert(language === 'es' ? 'Por favor selecciona un archivo' : 'Please select a file')
      return
    }

    // Limpiar estado de post-escaneo anterior (si existía)
    setPostScanResult(null)

    // Cancelar petición anterior si existe
    if (uploadAbortController) {
      uploadAbortController.abort()
    }

    // Crear nuevo AbortController para esta petición
    const abortController = new AbortController()
    setUploadAbortController(abortController)
    setUploading(true)
    isProcessingReceiptRef.current = true
    setReceiptProcessing(true)
    setUploadProgress(0)
    setUploadTime(0)
    const startTime = Date.now()
    setUploadStartTime(startTime)

    // Iniciar temporizador
    const timerInterval = setInterval(() => {
      setUploadTime(Math.floor((Date.now() - startTime) / 1000))
    }, 100)

    // Simular progreso (ya que no tenemos eventos de progreso reales del servidor)
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        // Incrementar progreso gradualmente hasta 95% (el último 5% se completa cuando termine)
        // Usar una función logarítmica para que sea más lento al final
        if (prev < 95) {
          // Incremento más lento cuando se acerca al 95%
          const increment = prev > 80 ? 0.3 : (prev > 50 ? 0.8 : 1.5)
          return Math.min(prev + increment, 95)
        }
        return prev
      })
    }, 500)
    
    // Guardar referencias para limpiar en catch
    let intervalsCleared = false
    const clearAllIntervals = () => {
      if (!intervalsCleared) {
        clearInterval(timerInterval)
        clearInterval(progressInterval)
        intervalsCleared = true
      }
    }

    const formData = new FormData()
    uploadFiles.forEach((f) => formData.append('files', f))
    if (selectedUserForReceipt) {
      formData.append('target_user_id', selectedUserForReceipt.toString())
    }
    formData.append('mode', receiptExtractMode)

    try {
      // Prioridad: si hay backend real configurado, procesar recibos en FastAPI
      const backendToken = typeof window !== 'undefined' ? localStorage.getItem('domus_token') : null
      const isLocalhost =
        typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
      const hasBackendEnv = typeof process !== 'undefined' && !!process.env?.NEXT_PUBLIC_API_URL
      const shouldUseBackend = !!backendToken && (hasBackendEnv || isLocalhost)

      const processViaSupabase = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token
        return await fetch('/api/receipts/process', {
          method: 'POST',
          body: formData,
          signal: abortController.signal,
          credentials: 'include',
          headers: accessToken
            ? {
                Authorization: `Bearer ${accessToken}`,
              }
            : undefined,
        })
      }

      let response: Response
      if (shouldUseBackend) {
        try {
          response = await fetch(`${apiBase}/api/receipts/process`, {
            method: 'POST',
            body: formData,
            signal: abortController.signal,
            headers: {
              Authorization: `Bearer ${backendToken}`,
            },
          })
        } catch (err) {
          console.warn('Backend receipts failed, fallback to Next.js API:', err)
          response = await processViaSupabase()
        }
      } else {
        response = await processViaSupabase()
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const detail =
          typeof (errorData as any)?.detail === 'string'
            ? (errorData as any).detail
            : Array.isArray((errorData as any)?.detail)
              ? (errorData as any).detail?.[0]?.msg || 'Error al procesar recibo'
              : 'Error al procesar recibo'
        throw new Error(detail)
      }

      const responseData = await response.json()
      
      // Completar progreso
      clearAllIntervals()
      // Asegurar que llegue al 100%
      setUploadProgress(100)
      // Pequeño delay para que se vea el 100%
      await new Promise(resolve => setTimeout(resolve, 300))
      const finalTime = Math.floor((Date.now() - startTime) / 1000)
      setUploadTime(finalTime)
      
      await loadTransactions()
      
      const receipt = responseData.receipt
      if (receipt) {
        setPostScanResult({ receipt, responseData })
      } else {
        alert(language === 'es' ? 'No se recibió el recibo procesado.' : 'Processed receipt was not returned.')
      }
    } catch (error: any) {
      clearAllIntervals()
      // Si fue cancelado, no mostrar error
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        console.log('Petición cancelada por el usuario')
        setUploading(false)
        isProcessingReceiptRef.current = false
        setUploadAbortController(null)
        setUploadProgress(0)
        setUploadTime(0)
        setUploadStartTime(null)
        return
      }

      console.error('Error completo al procesar recibo:', error)
      const errorMsg = error.message || 'Error al procesar recibo'
      
      let fullErrorMsg = errorMsg
      
      if (errorMsg.includes('API key') || errorMsg.includes('OPENAI_API_KEY')) {
        fullErrorMsg += '\n\nConfigura OPENAI_API_KEY en .env.local para procesar recibos.'
      } else if (errorMsg.includes('archivo')) {
        fullErrorMsg += '\n\nAsegúrate de seleccionar una imagen válida.'
      } else if (errorMsg.includes('No se pudo conectar') || error.name === 'TypeError') {
        fullErrorMsg += '\n\nError de conexión. Verifica tu conexión a internet.'
      } else if (error.name === 'AbortError') {
        // Ya manejado arriba
        return
      } else if (errorMsg.includes('timeout')) {
        fullErrorMsg += '\n\nEl procesamiento está tardando mucho. El recibo puede tener muchos items. Intenta de nuevo o usa una imagen más pequeña.'
      } else if (errorMsg.includes('max_tokens') || errorMsg.includes('too large')) {
        fullErrorMsg += '\n\nEl recibo tiene demasiados items. El sistema está configurado para extraer hasta ~200 items. Intenta con una imagen más clara.'
      }
      
      alert(fullErrorMsg)
      // NO limpiar el archivo ni cerrar el modal si hay error, para que el usuario pueda intentar de nuevo
    } finally {
      // SIEMPRE resetear el estado de carga, incluso si hay error
      clearAllIntervals()
      setUploading(false)
      isProcessingReceiptRef.current = false
      setReceiptProcessing(false)
      setUploadAbortController(null)
      if (!uploading) {
        setUploadProgress(0)
        setUploadTime(0)
        setUploadStartTime(null)
      }
    }
  }

  // Función para cancelar la subida si el usuario cierra el modal
  const handleCancelUpload = () => {
    if (uploadAbortController) {
      uploadAbortController.abort()
      setUploadAbortController(null)
    }
    setUploading(false)
    isProcessingReceiptRef.current = false
    setReceiptProcessing(false)
    setShowUploadModal(false)
    setUploadFiles([])
    setSelectedUserForReceipt(null)
    setPostScanResult(null)
  }

  const handleConfirmAndSave = () => {
    // El recibo ya fue guardado por el backend; aquí solo confirmamos y cerramos el flujo.
    setUploading(false)
    isProcessingReceiptRef.current = false
    setReceiptProcessing(false)
    setUploadAbortController(null)
    setUploadProgress(0)
    setUploadTime(0)
    setUploadStartTime(null)
    setUploadFiles([])
    setSelectedUserForReceipt(null)
    setPostScanResult(null)
    setShowUploadModal(false)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) fileInput.value = ''
  }

  const totalIncome = transactions.filter(t => t.transaction_type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = transactions.filter(t => t.transaction_type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const balance = totalIncome - totalExpense

  const clearFilters = () => {
    setFilters({
      category: '',
      subcategory: '',
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
      merchant: ''
    })
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  // Obtener categorías únicas de las transacciones - MEMOIZED
  const { allCategories, allSubcategories } = useMemo(() => {
    const cats = Array.from(new Set(transactions.map(t => t.category))).sort()
    const subcats = Array.from(new Set(
      transactions
        .filter(t => !filters.category || t.category === filters.category)
        .map(t => t.subcategory)
        .filter(s => s)
    )).sort()
    return { allCategories: cats, allSubcategories: subcats }
  }, [transactions, filters.category])

  // Categorías según tipo de transacción - Referencias a constantes
  const incomeCategories = INCOME_CATEGORIES
  const expenseCategories = EXPENSE_CATEGORIES
  const incomeSubcategories = INCOME_SUBCATEGORIES
  const expenseSubcategories = EXPENSE_SUBCATEGORIES

  const currentCategories = newTransaction.transaction_type === 'income' ? incomeCategories : expenseCategories
  const currentSubcategories = newTransaction.transaction_type === 'income' 
    ? incomeSubcategories[newTransaction.category] || []
    : expenseSubcategories[newTransaction.category] || []

  const toggleLanguage = () => {
    const newLang = language === 'es' ? 'en' : 'es'
    setLanguage(newLang)
    setLanguageState(newLang)
  }

  const toolbar = (
    <div className="flex gap-2">
      <button
        onClick={toggleLanguage}
        className="sap-button-secondary text-sm px-3 py-1.5 min-w-[60px] h-[36px] flex items-center justify-center"
      >
        {language === 'es' ? '🇲🇽 ES' : '🇺🇸 EN'}
      </button>
      <button
        onClick={() => setShowCreateModal(true)}
        className="sap-button-primary flex items-center gap-2"
      >
        <PlusIcon size={14} />
        {t.transactions.newTransaction}
      </button>
      <button
        onClick={() => {
          setPostScanResult(null)
          setShowUploadModal(true)
        }}
        className="sap-button-secondary"
      >
        {t.transactions.uploadReceipt}
      </button>
    </div>
  )

  return (
    <SAPLayout
      user={user}
      title={t.transactions.title}
      subtitle={t.transactions.subtitle}
      toolbar={loading ? null : toolbar}
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-sap-text-secondary">{language === 'es' ? 'Cargando...' : 'Loading...'}</div>
        </div>
      ) : (
        <>
      {/* Filtros estilo SAP */}
      <div className="sap-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-sap-text">{t.transactions.filters}</h3>
            {hasActiveFilters && (
              <span className="sap-badge bg-sap-primary/10 text-sap-primary">
                {Object.values(filters).filter(v => v !== '').length} activos
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="sap-button-ghost text-xs"
              >
                {t.common.clear}
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="sap-button-secondary text-xs"
            >
              {showFilters ? t.common.hide : t.common.show} {t.transactions.filters}
            </button>
          </div>
        </div>

        {/* Filtros rápidos por tipo */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setFilterType('all')}
            className={`sap-button-ghost text-xs ${filterType === 'all' ? 'bg-sap-primary text-white' : ''}`}
          >
            {t.common.all}
          </button>
          <button
            onClick={() => setFilterType('income')}
            className={`sap-button-ghost text-xs ${filterType === 'income' ? 'bg-sap-primary text-white' : ''}`}
          >
            {t.transactions.income}
          </button>
          <button
            onClick={() => setFilterType('expense')}
            className={`sap-button-ghost text-xs ${filterType === 'expense' ? 'bg-sap-primary text-white' : ''}`}
          >
            {t.transactions.expense}
          </button>
        </div>

        {/* Filtros avanzados */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-sap-border">
            <div>
              <label className="block text-xs font-medium text-sap-text-secondary mb-1">
                {t.common.category}
              </label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value, subcategory: '' })}
                className="sap-input text-xs"
              >
                <option value="">{t.common.all}</option>
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-sap-text-secondary mb-1">
                {t.common.subcategory}
              </label>
              <select
                value={filters.subcategory}
                onChange={(e) => setFilters({ ...filters, subcategory: e.target.value })}
                className="sap-input text-xs"
                disabled={!filters.category}
              >
                <option value="">{t.common.all}</option>
                {allSubcategories.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-sap-text-secondary mb-1">
                {t.common.date} {t.common.from}
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="sap-input text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-sap-text-secondary mb-1">
                {t.common.date} {t.common.to}
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="sap-input text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-sap-text-secondary mb-1">
                {t.common.amount} {t.common.min}
              </label>
              <input
                type="number"
                step="0.01"
                value={filters.amountMin}
                onChange={(e) => setFilters({ ...filters, amountMin: e.target.value })}
                className="sap-input text-xs"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-sap-text-secondary mb-1">
                {t.common.amount} {t.common.max}
              </label>
              <input
                type="number"
                step="0.01"
                value={filters.amountMax}
                onChange={(e) => setFilters({ ...filters, amountMax: e.target.value })}
                className="sap-input text-xs"
                placeholder="0.00"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-sap-text-secondary mb-1">
                {t.common.merchant} / {t.transactions.beneficiary}
              </label>
              <input
                type="text"
                value={filters.merchant}
                onChange={(e) => setFilters({ ...filters, merchant: e.target.value })}
                className="sap-input text-xs"
                placeholder="Buscar por nombre..."
              />
            </div>
          </div>
        )}
      </div>

      {/* Resumen estilo SAP */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="sap-card p-5">
          <div className="text-xs text-sap-text-secondary mb-1">Total Ingresos</div>
          <div className="text-xl font-bold text-sap-success">
            {formatCurrency(totalIncome, language, false)}
          </div>
        </div>
        <div className="sap-card p-5">
          <div className="text-xs text-sap-text-secondary mb-1">Total Egresos</div>
          <div className="text-xl font-bold text-sap-danger">
            {formatCurrency(totalExpense, language, false)}
          </div>
        </div>
        <div className="sap-card p-5">
          <div className="text-xs text-sap-text-secondary mb-1">Balance Neto</div>
          <div className={`text-xl font-bold ${balance >= 0 ? 'text-sap-success' : 'text-sap-danger'}`}>
            {formatCurrency(balance, language, false)}
          </div>
        </div>
        <div className="sap-card p-5">
          <div className="text-xs text-sap-text-secondary mb-1">Transacciones</div>
          <div className="text-xl font-bold text-sap-text">
            {transactions.length}
          </div>
        </div>
      </div>

      {/* Lista de transacciones estilo SAP */}
      {transactions.length > 0 ? (
        <div className="sap-card overflow-hidden">
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          <table className="sap-table">
            <thead className="bg-sap-bg-secondary" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th>{t.transactions.date}</th>
                <th>{t.transactions.concept}</th>
                <th>{t.common.category}</th>
                <th>{t.common.subcategory}</th>
                <th>{t.transactions.merchant}</th>
                <th className="text-right">{t.transactions.amount}</th>
                <th>{t.transactions.type}</th>
                <th>{t.common.edit}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="text-xs">
                    {format(new Date(transaction.date), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })}
                  </td>
                  <td>
                    <span className="text-sm font-medium text-sap-text">
                      {transaction.concept || transaction.merchant_or_beneficiary || 'Sin descripción'}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs text-sap-text-secondary">{transaction.category}</span>
                  </td>
                  <td>
                    <span className="text-xs text-sap-text-tertiary">{transaction.subcategory || '-'}</span>
                  </td>
                  <td>
                    <span className="text-xs text-sap-text-secondary">{transaction.merchant_or_beneficiary || '-'}</span>
                  </td>
                  <td className="text-right">
                    <span className={`text-sm font-semibold ${
                      transaction.transaction_type === 'income' 
                        ? 'text-sap-success' 
                        : 'text-sap-danger'
                    }`}>
                      {transaction.transaction_type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount, language, false).replace('$', '').replace(' MXN', '')}
                    </span>
                  </td>
                  <td>
                    <span className={`sap-badge ${
                      transaction.transaction_type === 'income'
                        ? 'bg-sap-success/10 text-sap-success'
                        : 'bg-sap-danger/10 text-sap-danger'
                    }`}>
                      {transaction.transaction_type === 'income' ? t.transactions.income : t.transactions.expense}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleEditStart(transaction)}
                      className="sap-button-secondary text-xs px-2 py-1"
                      title={t.transactions.editTransaction}
                    >
                      {t.common.edit}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
            <div className="sap-card p-12 text-center">
              <p className="text-sm text-sap-text-secondary mb-4">
                No hay transacciones registradas aún
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="sap-button-primary flex items-center gap-2"
                >
                  <PlusIcon size={14} />
                  Crear Transacción
                </button>
                <button
                  onClick={() => {
                    setPostScanResult(null)
                    setShowUploadModal(true)
                  }}
                  className="sap-button-secondary"
                >
                  Subir Recibo
                </button>
              </div>
            </div>
          )}

      {/* Modal de crear transacción estilo SAP */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="sap-card max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 border-b border-sap-border pb-4">
                <h2 className="text-lg font-semibold text-sap-text">Nueva Transacción</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="sap-button-ghost p-2"
                >
                  <XIcon size={18} className="text-sap-text-secondary" />
                </button>
              </div>

              <form onSubmit={handleCreateTransaction} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1.5">
                    Tipo de Transacción
                  </label>
                  <select
                    value={newTransaction.transaction_type}
                    onChange={(e) => setNewTransaction({ 
                      ...newTransaction, 
                      transaction_type: e.target.value as 'income' | 'expense',
                      category: '',
                      subcategory: ''
                    })}
                    required
                    className="sap-input"
                  >
                    <option value="expense">Egreso (Gasto)</option>
                    <option value="income">Ingreso</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1.5">
                    Categoría
                  </label>
                  <select
                    value={newTransaction.category}
                    onChange={(e) => setNewTransaction({ 
                      ...newTransaction, 
                      category: e.target.value, 
                      subcategory: '' 
                    })}
                    required
                    className="sap-input"
                  >
                    <option value="">Selecciona una categoría</option>
                    {currentCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {newTransaction.category && (
                  <div>
                    <label className="block text-sm font-medium text-sap-text-secondary mb-1.5">
                      Subcategoría
                    </label>
                    <select
                      value={newTransaction.subcategory}
                      onChange={(e) => setNewTransaction({ ...newTransaction, subcategory: e.target.value })}
                      required
                      className="sap-input"
                    >
                      <option value="">Selecciona una subcategoría</option>
                      {currentSubcategories.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1.5">
                    Monto
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newTransaction.amount}
                    onChange={(e) => setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) })}
                    required
                    className="sap-input"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1.5">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={newTransaction.date}
                    onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                    required
                    className="sap-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1.5">
                    Concepto / Descripción
                  </label>
                  <input
                    type="text"
                    value={newTransaction.concept}
                    onChange={(e) => setNewTransaction({ ...newTransaction, concept: e.target.value })}
                    className="sap-input"
                    placeholder="Descripción de la transacción"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1.5">
                    {newTransaction.transaction_type === 'income' ? 'Origen' : 'Comercio / Beneficiario'}
                  </label>
                  <input
                    type="text"
                    value={newTransaction.merchant_or_beneficiary}
                    onChange={(e) => setNewTransaction({ ...newTransaction, merchant_or_beneficiary: e.target.value })}
                    className="sap-input"
                    placeholder={newTransaction.transaction_type === 'income' ? 'Origen del ingreso' : 'Nombre del comercio'}
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-sap-border">
                  <button
                    type="submit"
                    className="sap-button-primary flex-1"
                  >
                    Crear Transacción
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="sap-button-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de subida estilo SAP */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className={`sap-card w-full mx-4 shadow-lg ${
              postScanResult ? 'max-w-4xl max-h-[90vh] overflow-y-auto' : 'max-w-md'
            }`}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 border-b border-sap-border pb-4">
                <h2 className="text-lg font-semibold text-sap-text">
                  {postScanResult
                    ? (language === 'es' ? 'Ticket procesado' : 'Receipt processed')
                    : (language === 'es' ? 'Subir Recibo' : 'Upload receipt')}
                </h2>
                <button
                  onClick={handleCancelUpload}
                  className="sap-button-ghost p-2"
                >
                  <XIcon size={18} className="text-sap-text-secondary" />
                </button>
              </div>

              {postScanResult ? (
                (() => {
                  const receipt = postScanResult.receipt
                  const itemsAll: any[] = receipt?.items || []
                  const isAdmin = Boolean((user as any)?.is_family_admin)
                  const totalsStatus: any[] = postScanResult.responseData?.totals_status || []
                  const partsStatus: any[] = postScanResult.responseData?.parts_status || []

                  const products = itemsAll
                    .map((it) => ({ ...it, _n: parseNotesSafe(it?.notes) }))
                    .filter((it) => {
                      const n = it._n
                      const isAdjustment = n?.is_adjustment === true || n?.line_type === 'adjustment'
                      const lineType = String(n?.line_type || '')
                      const isNonProduct = ['discount', 'cancellation', 'price_change', 'adjustment'].includes(lineType)
                      return !isAdjustment && !isNonProduct
                    })

                  const hasIllegible = products.some((it) => it._n?.amount_legible === false)
                  const sumProducts = products.reduce((sum, it) => {
                    if (it._n?.amount_legible === false) return sum
                    return sum + (Number(it.amount) || 0)
                  }, 0)
                  const diff = (Number(receipt?.amount) || 0) - sumProducts
                  const diffAbs = Math.abs(diff)

                  const totalMissing = !(Number(receipt?.amount) > 0)
                  const totalsError = totalsStatus.some((t: any) => t && t.ok === false)
                  const partsError = partsStatus.some((p: any) => p && p.ok === false)

                  const status =
                    totalMissing || totalsError || partsError
                      ? 'error'
                      : (diffAbs < 0.01 && !hasIllegible)
                        ? 'ok'
                        : 'review'

                  const statusLabel =
                    status === 'ok'
                      ? (language === 'es' ? 'Todo correcto' : 'All good')
                      : status === 'review'
                        ? (language === 'es' ? 'Revisar algunos productos' : 'Review some items')
                        : (language === 'es' ? 'Error en el total' : 'Total error')

                  const humanMsg =
                    status === 'ok' && diffAbs < 0.01
                      ? (language === 'es' ? 'El total coincide con los productos.' : 'The total matches the items.')
                      : status === 'review'
                        ? (language === 'es' ? 'Revisa algunos productos antes de guardar.' : 'Review a few items before saving.')
                        : (language === 'es' ? 'No pudimos confirmar el total. Revisa el ticket o intenta de nuevo.' : 'We could not confirm the total. Please review or try again.')

                  const dateLabel = (() => {
                    try {
                      if (receipt?.date) {
                        const dt = new Date(`${receipt.date}T${receipt.time || '00:00'}:00`)
                        return format(dt, 'dd/MM/yyyy HH:mm', { locale: language === 'es' ? es : enUS })
                      }
                      return format(new Date(receipt?.created_at || Date.now()), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })
                    } catch {
                      return receipt?.date || ''
                    }
                  })()

                  return (
                    <div className="space-y-6">
                      {/* Resumen superior */}
                      <div className="sap-card p-5 bg-sap-bgSecondary">
                        <div className="flex items-start justify-between gap-6">
                          <div className="min-w-0">
                            <div className="text-sm text-sap-text-secondary">{language === 'es' ? 'Comercio' : 'Merchant'}</div>
                            <div className="text-xl font-semibold text-sap-text truncate">
                              {receipt?.merchant_or_beneficiary || (language === 'es' ? 'Recibo' : 'Receipt')}
                            </div>
                            <div className="text-sm text-sap-text-tertiary mt-1">{dateLabel}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm text-sap-text-secondary">{language === 'es' ? 'Total' : 'Total'}</div>
                            <div className="text-3xl font-bold text-sap-text">
                              {formatCurrency(Number(receipt?.amount) || 0, language, false)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-start gap-3">
                          <span
                            className={`px-2.5 py-1 rounded-domus text-xs font-semibold ${
                              status === 'ok'
                                ? 'bg-green-100 text-green-800'
                                : status === 'review'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {statusLabel}
                          </span>
                          <p className="text-sm text-sap-text-secondary">{humanMsg}</p>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={handleConfirmAndSave}
                          className="sap-button-primary w-full sm:flex-1 text-base py-3"
                        >
                          {language === 'es' ? 'Confirmar y Guardar' : 'Confirm & Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => postScanProductsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                          className="sap-button-secondary w-full sm:flex-1 text-base py-3"
                        >
                          {language === 'es' ? 'Revisar productos' : 'Review items'}
                        </button>
                      </div>

                      {/* Productos */}
                      <div ref={postScanProductsRef} className="sap-card overflow-hidden">
                        <div className="px-4 py-3 border-b border-sap-border bg-white">
                          <h3 className="text-sm font-semibold text-sap-text">
                            {language === 'es' ? 'Productos' : 'Items'}
                          </h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-sap-bgSecondary">
                              <tr>
                                <th className="sap-table-header">{language === 'es' ? 'Nombre' : 'Name'}</th>
                                <th className="sap-table-header text-right">{language === 'es' ? 'Cantidad × Precio = Total' : 'Qty × Price = Total'}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {products.length === 0 ? (
                                <tr>
                                  <td colSpan={2} className="sap-table-cell text-center text-sap-text-secondary py-6">
                                    {language === 'es' ? 'No se encontraron productos.' : 'No items found.'}
                                  </td>
                                </tr>
                              ) : (
                                products.map((it, idx) => {
                                  const amountLegible = it._n?.amount_legible !== false
                                  const q = typeof it.quantity === 'number' ? it.quantity : null
                                  const up = typeof it.unit_price === 'number' ? it.unit_price : null
                                  const total = typeof it.amount === 'number' ? it.amount : Number(it.amount) || 0

                                  const name = amountLegible
                                    ? cleanItemName(it.description || '')
                                    : (language === 'es' ? 'No legible' : 'Illegible')

                                  const formula = !amountLegible
                                    ? (language === 'es' ? 'No legible' : 'Illegible')
                                    : (q != null && up != null)
                                      ? `${formatQty(q)} × ${formatCurrency(up, language, false)} = ${formatCurrency(total, language, false)}`
                                      : formatCurrency(total, language, false)

                                  return (
                                    <tr key={it.id ?? idx} className="border-b border-sap-border">
                                      <td className="sap-table-cell">
                                        <span className="text-sap-text">{name || (language === 'es' ? 'No legible' : 'Illegible')}</span>
                                      </td>
                                      <td className="sap-table-cell text-right font-medium text-sap-text">{formula}</td>
                                    </tr>
                                  )
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Detalles técnicos (solo Admin) */}
                      {isAdmin && (
                        <details className="sap-card p-4">
                          <summary className="cursor-pointer text-sm font-semibold text-sap-text">
                            {language === 'es' ? 'Ver detalles técnicos' : 'View technical details'}
                          </summary>
                          <div className="mt-3 space-y-3">
                            <pre className="sap-input font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-[360px]">
                              {JSON.stringify(postScanResult.responseData, null, 2)}
                            </pre>
                          </div>
                        </details>
                      )}
                    </div>
                  )
                })()
              ) : (
                <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-2">
                    {language === 'es' ? 'Asignar a usuario:' : 'Assign to user:'}
                  </label>
                  <select
                    value={selectedUserForReceipt || ''}
                    onChange={(e) => setSelectedUserForReceipt(e.target.value ? parseInt(e.target.value) : null)}
                    className="sap-input"
                    disabled={uploading}
                  >
                    <option value="">{language === 'es' ? 'Yo mismo' : 'Myself'}</option>
                    {familyMembers.map(member => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-2">
                    {language === 'es' ? 'Modo de extracción:' : 'Extraction mode:'}
                  </label>
                  <select
                    value={receiptExtractMode}
                    onChange={(e) => setReceiptExtractMode(e.target.value as 'precise' | 'fast' | 'text')}
                    className="sap-input"
                    disabled={uploading}
                  >
                    <option value="precise">
                      {language === 'es' ? 'Preciso (más lento, mejor total)' : 'Precise (slower, better total)'}
                    </option>
                    <option value="fast">
                      {language === 'es' ? 'Rápido (puede requerir correcciones)' : 'Fast (may need corrections)'}
                    </option>
                    <option value="text">
                      {language === 'es' ? 'Texto (transcribir completo, más estable)' : 'Text (full transcription, more stable)'}
                    </option>
                  </select>
                  <p className="text-xs text-sap-text-tertiary mt-2">
                    {language === 'es'
                      ? 'Tip: usa “Preciso” para tickets largos (HEB), “Rápido” para recibos pequeños, o “Texto” si se cae la extracción/da error.'
                      : 'Tip: use “Precise” for long receipts (HEB), “Fast” for small receipts, or “Text” if extraction fails/errors.'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-2">
                    {language === 'es' ? 'Selecciona una imagen de recibo' : 'Select receipt image'}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    disabled={uploading}
                    className="sap-input"
                  />
                  {uploadFiles.length > 0 && (
                    <p className="text-xs text-sap-text-tertiary mt-2">
                      {uploadFiles.length === 1
                        ? (language === 'es'
                          ? `Archivo seleccionado: ${uploadFiles[0].name} (${(uploadFiles[0].size / 1024).toFixed(2)} KB)`
                          : `Selected file: ${uploadFiles[0].name} (${(uploadFiles[0].size / 1024).toFixed(2)} KB)`)
                        : (language === 'es'
                          ? `${uploadFiles.length} archivos seleccionados`
                          : `${uploadFiles.length} files selected`)}
                    </p>
                  )}
                  <p className="text-xs text-sap-text-tertiary mt-2">
                    {language === 'es' 
                      ? 'El sistema procesará automáticamente la imagen y extraerá todos los conceptos del recibo'
                      : 'The system will automatically process the image and extract all receipt items'}
                  </p>
                </div>

                {uploading && (
                  <div className="p-4 bg-sap-bg rounded border border-sap-border space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium text-sap-text">
                        {language === 'es' ? 'Procesando recibo...' : 'Processing receipt...'}
                      </p>
                      <p className="text-sm font-semibold text-sap-primary">
                        {uploadTime > 0 ? `${uploadTime}s` : '0s'}
                      </p>
                    </div>
                    
                    {/* Barra de progreso */}
                    <div className="w-full bg-sap-bgSecondary rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-sap-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center text-xs text-sap-text-secondary">
                      <span>{Math.round(uploadProgress)}%</span>
                      <span>
                        {language === 'es' 
                          ? 'Extrayendo datos con IA...'
                          : 'Extracting data with AI...'}
                      </span>
                    </div>
                    
                    <p className="text-xs text-sap-text-tertiary">
                      {language === 'es' 
                        ? 'Esto puede tardar entre 30 segundos y 4 minutos dependiendo del tamaño del recibo (tickets muy largos pueden tardar más).'
                        : 'This may take between 30 seconds and 4 minutes depending on receipt size (very long receipts may take longer).'}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleFileUpload}
                      disabled={uploading || uploadFiles.length === 0}
                    className="sap-button-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading 
                      ? (language === 'es' ? 'Procesando...' : 'Processing...')
                      : (language === 'es' ? 'Procesar Recibo' : 'Process Receipt')}
                  </button>
                  <button
                    onClick={handleCancelUpload}
                    disabled={false}
                    className="sap-button-secondary flex-1"
                  >
                    {uploading 
                      ? (language === 'es' ? 'Cancelar' : 'Cancel')
                      : (language === 'es' ? 'Cerrar' : 'Close')}
                  </button>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de editar transacción estilo SAP */}
      {showEditModal && editingTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="sap-card max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 border-b border-sap-border pb-4">
                <h2 className="text-lg font-semibold text-sap-text">{t.transactions.editTransaction}</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingTransaction(null)
                  }}
                  className="sap-button-ghost p-2"
                >
                  <XIcon size={18} className="text-sap-text-secondary" />
                </button>
              </div>

              <form onSubmit={handleEditTransaction} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1.5">
                    {t.transactions.amount}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    defaultValue={editingTransaction.amount}
                    required
                    className="sap-input"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1.5">
                    {t.transactions.date}
                  </label>
                  <input
                    type="date"
                    name="date"
                    defaultValue={new Date(editingTransaction.date).toISOString().split('T')[0]}
                    required
                    className="sap-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1.5">
                    {t.transactions.concept}
                  </label>
                  <input
                    type="text"
                    name="concept"
                    defaultValue={editingTransaction.concept || ''}
                    className="sap-input"
                    placeholder={language === 'es' ? 'Descripción de la transacción' : 'Transaction description'}
                  />
                </div>

                {familyMembers.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-sap-text-secondary mb-1.5">
                      {language === 'es' ? 'Usuario (Beneficiario)' : 'User (Beneficiary)'}
                    </label>
                    <select
                      name="user_id"
                      defaultValue={editingTransaction.user_id}
                      className="sap-input"
                    >
                      <option value="">{language === 'es' ? 'Selecciona un usuario' : 'Select a user'}</option>
                      {familyMembers.map(member => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {budgets.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-sap-text-secondary mb-1.5">
                      {language === 'es' ? 'Cuenta (Presupuesto)' : 'Account (Budget)'}
                    </label>
                    <select
                      name="family_budget_id"
                      defaultValue={editingTransaction.family_budget_id || 'none'}
                      className="sap-input"
                    >
                      <option value="none">{language === 'es' ? 'Sin cuenta asignada' : 'No account assigned'}</option>
                      {budgets.map(budget => (
                        <option key={budget.family_budget?.id || budget.id} value={budget.family_budget?.id || budget.id}>
                          {budget.family_budget?.category || 'N/A'} - {budget.family_budget?.subcategory || 'N/A'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-sap-border">
                  <button
                    type="submit"
                    className="sap-button-primary flex-1"
                  >
                    {t.common.save}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingTransaction(null)
                    }}
                    className="sap-button-secondary"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </SAPLayout>
  )
}
