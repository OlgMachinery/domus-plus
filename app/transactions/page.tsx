'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import type { Transaction, User } from '@/lib/types'
import { XIcon, PlusIcon } from '@/lib/icons'
import AppLayout from "@/components/AppLayout"
import { useTranslation, getLanguage, setLanguage, type Language } from '@/lib/i18n'
import { formatCurrency } from '@/lib/currency'

export const dynamic = 'force-dynamic'

export default function TransactionsPage() {
  const router = useRouter()
  const [language, setLanguageState] = useState<Language>(getLanguage())
  const t = useTranslation(language)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [toast, setToast] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const [showAddOptionsModal, setShowAddOptionsModal] = useState(false)
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
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
        toastTimerRef.current = null
      }
    }
  }, [uploadAbortController])

  const showToast = (kind: 'success' | 'error' | 'info', text: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
    setToast({ kind, text })
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, 2400)
  }

  async function loadFamilyMembers(familyId: number) {
    try {
      const res = await fetch(`/api/families/${familyId}/members`, { method: 'GET', credentials: 'include' })
      const data = await res.json().catch(() => ([]))
      if (!res.ok) return
      setFamilyMembers(Array.isArray(data) ? (data as User[]) : [])
    } catch {
      // best-effort
    }
  }

  async function loadBudgetsForFamily(familyId: number) {
    try {
      const year = new Date().getFullYear()
      const { data, error } = await supabase
        .from('family_budgets')
        .select('id, category, subcategory, year, budget_type, target_user_id')
        .eq('family_id', familyId)
        .eq('year', year)
        .order('category')
        .limit(1000)
      if (error) return
      setBudgets(Array.isArray(data) ? data : [])
    } catch {
      // best-effort
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Verificar autenticación con Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
        return
      }
      loadUser()
      loadTransactions()
    })
  }, [router, filterType, filters])
  
  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      
      if (userData) {
        setUser(userData as User)
        const famId = Number((userData as any).family_id || 0) || null
        if (famId) {
          loadFamilyMembers(famId)
          loadBudgetsForFamily(famId)
        } else {
          setFamilyMembers([])
          setBudgets([])
        }
      }
    } catch (error) {
      console.error('Error cargando usuario:', error)
    }
  }

  const loadTransactions = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }

      const params = new URLSearchParams()
      params.set('limit', '2000')
      if (filterType !== 'all') params.set('transaction_type', filterType)
      if (filters.category) params.set('category', filters.category)
      if (filters.subcategory) params.set('subcategory', filters.subcategory)
      if (filters.dateFrom) params.set('start_date', filters.dateFrom)
      if (filters.dateTo) params.set('end_date', filters.dateTo)
      if (filters.amountMin) params.set('amount_min', filters.amountMin)
      if (filters.amountMax) params.set('amount_max', filters.amountMax)
      if (filters.merchant) params.set('merchant', filters.merchant)

      const res = await fetch(`/api/families/transactions?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.detail || (language === 'es' ? 'Error cargando transacciones' : 'Error loading transactions'))
      }
      setTransactions((data?.transactions || []) as Transaction[])
    } catch (error: any) {
      console.error('Error cargando transacciones:', error)
      setTransactions([])
    } finally {
      setLoading(false)
    }
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
      
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        showToast('error', language === 'es' ? 'No autenticado' : 'Not authenticated')
        router.push('/login')
        return
      }
      
      const { error: updateError } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', editingTransaction.id)
        .eq('user_id', authUser.id)
      
      if (updateError) {
        throw updateError
      }
      
      setShowEditModal(false)
      setEditingTransaction(null)
      loadTransactions()
      showToast('success', language === 'es' ? 'Transacción actualizada correctamente.' : 'Transaction updated successfully.')
    } catch (error: any) {
      console.error('Error actualizando transacción:', error)
      showToast('error', error.message || (language === 'es' ? 'Error al actualizar transacción' : 'Error updating transaction'))
    }
  }

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newTransaction.amount <= 0) {
      showToast('error', language === 'es' ? 'El monto debe ser mayor a cero.' : 'Amount must be greater than zero.')
      return
    }
    
    if (!newTransaction.category || !newTransaction.subcategory) {
      showToast('error', language === 'es' ? 'Selecciona una categoría y subcategoría.' : 'Please select a category and subcategory.')
      return
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        showToast('error', language === 'es' ? 'No autenticado' : 'Not authenticated')
        router.push('/login')
        return
      }
      
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          ...newTransaction,
          user_id: authUser.id,
          date: new Date(newTransaction.date).toISOString()
        })
      
      if (insertError) {
        throw insertError
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
      showToast('success', language === 'es' ? 'Gasto agregado.' : 'Transaction created.')
    } catch (error: any) {
      showToast('error', error.message || (language === 'es' ? 'Error al crear transacción' : 'Error creating transaction'))
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadFiles(files)
  }

  const handleFileUpload = async () => {
    if (!uploadFiles || uploadFiles.length === 0) {
      showToast('error', language === 'es' ? 'Selecciona al menos una imagen.' : 'Please select at least one image.')
      return
    }

    // Cancelar petición anterior si existe
    if (uploadAbortController) {
      uploadAbortController.abort()
    }

    // Crear nuevo AbortController para esta petición
    const abortController = new AbortController()
    setUploadAbortController(abortController)
    setUploading(true)
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

    try {
      // Obtener el token de acceso de Supabase para enviarlo como header
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      
      // Usar la API Route de Next.js en lugar del backend de FastAPI
      const response = await fetch('/api/receipts/process', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
        credentials: 'include', // IMPORTANTE: Incluir cookies en la petición
        headers: accessToken ? {
          'Authorization': `Bearer ${accessToken}`
        } : undefined,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Error al procesar recibo')
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
      
      const totalItems = Number(responseData.items_count || 0) || 0
      const hasTx = !!responseData.transaction?.id
      showToast(
        hasTx ? 'success' : 'info',
        language === 'es'
          ? hasTx
            ? `Listo: gasto agregado con comprobante. (${totalItems} conceptos)`
            : `Ticket procesado. (${totalItems} conceptos)`
          : hasTx
            ? `Done: expense added with receipt. (${totalItems} items)`
            : `Receipt processed. (${totalItems} items)`
      )
      
      // Cerrar modal y limpiar solo después de éxito
      setShowUploadModal(false)
      setSelectedUserForReceipt(null)
      setUploadFiles([])
      
      // Resetear el input de archivo
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) {
        fileInput.value = ''
      }
      
      // Limpiar AbortController
      setUploadAbortController(null)

      // Si se creó transacción, abrir edición para validar/ajustar cuenta
      if (responseData.transaction?.id) {
        setEditingTransaction(responseData.transaction as Transaction)
        setShowEditModal(true)
      }
    } catch (error: any) {
      clearAllIntervals()
      // Si fue cancelado, no mostrar error
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        console.log('Petición cancelada por el usuario')
        setUploading(false)
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
      
      showToast('error', errorMsg)
      // NO limpiar el archivo ni cerrar el modal si hay error, para que el usuario pueda intentar de nuevo
    } finally {
      // SIEMPRE resetear el estado de carga, incluso si hay error
      clearAllIntervals()
      setUploading(false)
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
    setShowUploadModal(false)
    setUploadFiles([])
    setSelectedUserForReceipt(null)
  }

  // Renderizar siempre SAPLayout para mantener consistencia de hooks
  if (loading) {
    return (
      <AppLayout user={user} title={t.nav.transactions} subtitle={t.nav.transactions}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{language === 'es' ? 'Cargando...' : 'Loading...'}</div>
        </div>
      </AppLayout>
    )
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

  // Obtener categorías únicas de las transacciones
  const allCategories = Array.from(new Set(transactions.map(t => t.category))).sort()
  const allSubcategories = Array.from(new Set(
    transactions
      .filter(t => !filters.category || t.category === filters.category)
      .map(t => t.subcategory)
      .filter(s => s)
  )).sort()

  // Categorías según tipo de transacción
  const incomeCategories = ['Salario', 'Bonos', 'Rentas', 'Reembolsos', 'Inversiones', 'Otros Ingresos']
  const expenseCategories = ['Servicios Basicos', 'Mercado', 'Vivienda', 'Transporte', 'Impuestos', 'Educacion', 'Salud', 'Vida Social']
  
  const incomeSubcategories: Record<string, string[]> = {
    'Salario': ['Salario Fijo', 'Salario Variable'],
    'Bonos': ['Bono Anual', 'Bono Quincenal', 'Bono Extra'],
    'Rentas': ['Renta Propiedades', 'Renta Inversiones'],
    'Reembolsos': ['Reembolso Gastos', 'Reembolso Impuestos'],
    'Inversiones': ['Dividendos', 'Intereses', 'Ganancias Capital'],
    'Otros Ingresos': ['Regalos', 'Premios', 'Otros']
  }

  const expenseSubcategories: Record<string, string[]> = {
    'Servicios Basicos': ['Electricidad CFE', 'Agua Potable', 'Gas LP', 'Internet', 'Entretenimiento', 'Garrafones Agua', 'Telcel'],
    'Mercado': ['Mercado General'],
    'Vivienda': ['Cuotas Olinala', 'Seguro Vivienda', 'Mejoras y Remodelaciones'],
    'Transporte': ['Gasolina', 'Mantenimiento coches', 'Seguros y Derechos', 'Lavado'],
    'Impuestos': ['Predial'],
    'Educacion': ['Colegiaturas'],
    'Salud': ['Consulta', 'Medicamentos', 'Seguro Medico', 'Prevencion'],
    'Vida Social': ['Salidas Personales', 'Salidas Familiares', 'Cumpleanos', 'Aniversarios', 'Regalos Navidad']
  }

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
        onClick={() => setShowAddOptionsModal(true)}
        className="sap-button-primary flex items-center gap-2"
      >
        <PlusIcon size={14} />
        {language === 'es' ? 'Agregar gasto' : 'Add expense'}
      </button>
    </div>
  )

  return (
    <AppLayout
      user={user}
      title={t.transactions.title}
      subtitle={t.transactions.subtitle}
      toolbar={loading ? null : toolbar}
    >
      {toast ? (
        <div
          className={`fixed top-[84px] left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full text-sm font-semibold shadow-elevation-1 ${
            toast.kind === 'success'
              ? 'bg-emerald-600 text-white'
              : toast.kind === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-sap-primary text-white'
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </div>
      ) : null}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{language === 'es' ? 'Cargando...' : 'Loading...'}</div>
        </div>
      ) : (
        <>
      {/* Filtros estilo SAP */}
      <div className="sap-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground">{t.transactions.filters}</h3>
            {hasActiveFilters && (
              <span className="sap-badge bg-primary/10 text-primary">
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
            className={`sap-button-ghost text-xs ${filterType === 'all' ? 'bg-primary text-white' : ''}`}
          >
            {t.common.all}
          </button>
          <button
            onClick={() => setFilterType('income')}
            className={`sap-button-ghost text-xs ${filterType === 'income' ? 'bg-primary text-white' : ''}`}
          >
            {t.transactions.income}
          </button>
          <button
            onClick={() => setFilterType('expense')}
            className={`sap-button-ghost text-xs ${filterType === 'expense' ? 'bg-primary text-white' : ''}`}
          >
            {t.transactions.expense}
          </button>
        </div>

        {/* Filtros avanzados */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-border">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">
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
          <div className="text-xs text-muted-foreground mb-1">Total Ingresos</div>
          <div className="text-xl font-bold text-sap-success">
            {formatCurrency(totalIncome, language, false)}
          </div>
        </div>
        <div className="sap-card p-5">
          <div className="text-xs text-muted-foreground mb-1">Total Egresos</div>
          <div className="text-xl font-bold text-sap-danger">
            {formatCurrency(totalExpense, language, false)}
          </div>
        </div>
        <div className="sap-card p-5">
          <div className="text-xs text-muted-foreground mb-1">Balance Neto</div>
          <div className={`text-xl font-bold ${balance >= 0 ? 'text-sap-success' : 'text-sap-danger'}`}>
            {formatCurrency(balance, language, false)}
          </div>
        </div>
        <div className="sap-card p-5">
          <div className="text-xs text-muted-foreground mb-1">Transacciones</div>
          <div className="text-xl font-bold text-foreground">
            {transactions.length}
          </div>
        </div>
      </div>

      {/* Lista de transacciones estilo SAP */}
      {transactions.length > 0 ? (
        <div className="sap-card overflow-hidden">
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          <table className="sap-table">
            <thead className="bg-card" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
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
                    <span className="text-sm font-medium text-foreground">
                      {transaction.concept || transaction.merchant_or_beneficiary || 'Sin descripción'}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs text-muted-foreground">{transaction.category}</span>
                  </td>
                  <td>
                    <span className="text-xs text-muted-foreground">{transaction.subcategory || '-'}</span>
                  </td>
                  <td>
                    <span className="text-xs text-muted-foreground">{transaction.merchant_or_beneficiary || '-'}</span>
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
              <p className="text-sm text-muted-foreground mb-4">
                No hay transacciones registradas aún
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setShowAddOptionsModal(true)}
                  className="sap-button-primary flex items-center gap-2"
                >
                  <PlusIcon size={14} />
                  {language === 'es' ? 'Agregar gasto' : 'Add expense'}
                </button>
              </div>
            </div>
          )}

      {/* Modal de crear transacción estilo SAP */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="sap-card max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  {language === 'es' ? 'Agregar gasto (sin comprobante)' : 'Add expense (no receipt)'}
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="sap-button-ghost p-2"
                >
                  <XIcon size={18} className="text-muted-foreground" />
                </button>
              </div>

              <form onSubmit={handleCreateTransaction} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
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
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
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
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
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
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
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
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
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
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
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
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
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

                <div className="flex gap-3 pt-4 border-t border-border">
                  <button
                    type="submit"
                    className="sap-button-primary flex-1"
                  >
                    {language === 'es' ? 'Agregar gasto' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
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

      {/* Modal de subida estilo SAP */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="sap-card max-w-md w-full mx-4 shadow-lg">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  {language === 'es' ? 'Agregar gasto con comprobante' : 'Add expense with receipt'}
                </h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="sap-button-ghost p-2"
                >
                  <XIcon size={18} className="text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
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
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
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
                    <p className="text-xs text-muted-foreground mt-2">
                      {uploadFiles.length === 1
                        ? (language === 'es'
                          ? `Archivo seleccionado: ${uploadFiles[0].name} (${(uploadFiles[0].size / 1024).toFixed(2)} KB)`
                          : `Selected file: ${uploadFiles[0].name} (${(uploadFiles[0].size / 1024).toFixed(2)} KB)`)
                        : (language === 'es'
                          ? `${uploadFiles.length} archivos seleccionados`
                          : `${uploadFiles.length} files selected`)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {language === 'es' 
                      ? 'El sistema procesará automáticamente la imagen y extraerá todos los conceptos del recibo'
                      : 'The system will automatically process the image and extract all receipt items'}
                  </p>
                </div>

                {uploading && (
                  <div className="p-4 bg-background rounded border border-border space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium text-foreground">
                        {language === 'es' ? 'Procesando recibo...' : 'Processing receipt...'}
                      </p>
                      <p className="text-sm font-semibold text-primary">
                        {uploadTime > 0 ? `${uploadTime}s` : '0s'}
                      </p>
                    </div>
                    
                    {/* Barra de progreso */}
                    <div className="w-full bg-backgroundSecondary rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>{Math.round(uploadProgress)}%</span>
                      <span>
                        {language === 'es' 
                          ? 'Extrayendo datos con IA...'
                          : 'Extracting data with AI...'}
                      </span>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      {language === 'es' 
                        ? 'Esto puede tardar entre 30 segundos y 2 minutos dependiendo del tamaño del recibo.'
                        : 'This may take between 30 seconds and 2 minutes depending on receipt size.'}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleFileUpload}
                      disabled={uploading || uploadFiles.length === 0}
                    className={`sap-button-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                      !uploading && uploadFiles.length > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    {uploading 
                      ? (language === 'es' ? 'Procesando...' : 'Processing...')
                      : (language === 'es' ? 'Procesar ticket y agregar gasto' : 'Process receipt and add expense')}
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
            </div>
          </div>
        </div>
      )}

      {/* Modal de editar transacción estilo SAP */}
      {showEditModal && editingTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="sap-card max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
                <h2 className="text-lg font-semibold text-foreground">{t.transactions.editTransaction}</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingTransaction(null)
                  }}
                  className="sap-button-ghost p-2"
                >
                  <XIcon size={18} className="text-muted-foreground" />
                </button>
              </div>

              <form onSubmit={handleEditTransaction} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
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
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
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
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
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
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
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
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
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

                <div className="flex gap-3 pt-4 border-t border-border">
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
    </AppLayout>
  )
}
