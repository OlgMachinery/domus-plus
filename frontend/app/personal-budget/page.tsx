'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@/lib/types'
import { PlusIcon, XIcon, CameraIcon } from '@/lib/icons'
import SAPLayout from '@/components/SAPLayout'
import { formatCurrency } from '@/lib/currency'
import { getLanguage, setLanguage, useTranslation, type Language } from '@/lib/i18n'
import { safePushLogin, setReceiptProcessing } from '@/lib/receiptProcessing'
import { getAuthHeaders, getToken } from '@/lib/auth'
import { format } from 'date-fns'
import { es, enUS } from 'date-fns/locale'

interface PersonalBudget {
  id: number
  family_id: number
  category: string
  subcategory: string
  year: number
  total_amount: number
  monthly_amounts?: Record<string, number>
  budget_type: string
  target_user_id: number
  created_at: string
  updated_at?: string
  user_allocations?: any[]
}

interface CategoryOption {
  category: string
  subcategories: string[]
}

export default function PersonalBudgetPage() {
  const router = useRouter()
  const [language, setLanguageState] = useState<Language>('es')
  const [mounted, setMounted] = useState(false)
  const t = useTranslation(language)
  const backendUrl = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) || ''
  const apiBase = backendUrl.replace(/\/$/, '')
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [budgets, setBudgets] = useState<PersonalBudget[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedBudgetForUpload, setSelectedBudgetForUpload] = useState<PersonalBudget | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [receiptExtractMode, setReceiptExtractMode] = useState<'precise' | 'fast' | 'text'>('precise')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [newBudget, setNewBudget] = useState({
    category: '',
    subcategory: '',
    year: new Date().getFullYear(),
    total_amount: 0,
    monthly_amounts: {} as Record<string, number>
  })

  useEffect(() => {
    setMounted(true)
    setLanguageState(getLanguage())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    loadUser()
  }, [router])

  const loadUser = async () => {
    try {
      const headers = await getAuthHeaders()
      const hasAuth = typeof headers === 'object' && headers !== null && 'Authorization' in (headers as Record<string, string>)
      if (hasAuth) {
        const meRes = await fetch(`${apiBase}/api/users/me`, {
          headers: headers as Record<string, string>,
          credentials: 'include',
        })
        if (meRes.ok) {
          const me = (await meRes.json()) as User
          setUser(me)
          const token = getToken()
          if (token) {
            await Promise.all([
              loadCategories(token),
              loadBudgets(token),
            ])
          }
          return
        }
        if (meRes.status === 401) {
          localStorage.removeItem('domus_token')
        }
      }

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        safePushLogin(router, 'personal-budget: no supabase user')
        return
      }
      
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      
      if (userData) {
        setUser(userData as User)
        // Cargar categorías y presupuestos en paralelo
        await Promise.all([
          loadCategories().catch(err => {
            console.error('Error cargando categorías:', err)
            return null
          }),
          loadBudgets().catch(err => {
            console.error('Error cargando presupuestos:', err)
            return null
          })
        ])
      }
    } catch (error: any) {
      console.error('Error cargando usuario:', error)
      // Si hay token backend, NO expulsar al usuario por fallas temporales.
      const token = getToken()
      if (!token) safePushLogin(router, 'personal-budget: loadUser error')
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async (tokenOverride?: string) => {
    try {
      const token = tokenOverride || getToken()
      if (token) {
        const response = await fetch(`${apiBase}/api/personal-budgets/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error('Error al cargar categorías')
        const data = await response.json()
        const list = (data && (data.categories || data)) || []
        setCategories(list || [])
        return
      }

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      // Usar la API route de Next.js
      const response = await fetch('/api/personal-budgets/categories', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Error al cargar categorías')
      }

      const data = await response.json()
      setCategories(data || [])
    } catch (error: any) {
      console.error('Error cargando categorías:', error)
      setCategories([])
    }
  }

  const loadBudgets = async (tokenOverride?: string) => {
    try {
      const token = tokenOverride || getToken()
      if (token) {
        const response = await fetch(`${apiBase}/api/personal-budgets?year=${filterYear}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error('Error al cargar presupuestos')
        const budgetsData = await response.json()
        setBudgets((budgetsData || []) as PersonalBudget[])
        return
      }

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      // Usar la API route de Next.js
      const response = await fetch(`/api/personal-budgets?year=${filterYear}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Error al cargar presupuestos')
      }

      const budgetsData = await response.json()
      setBudgets((budgetsData || []) as PersonalBudget[])
    } catch (error: any) {
      console.error('Error cargando presupuestos personales:', error)
      setBudgets([])
    }
  }

  useEffect(() => {
    if (user && !loading) {
      loadBudgets()
    }
  }, [filterYear])

  const toggleLanguage = () => {
    const newLang = language === 'es' ? 'en' : 'es'
    setLanguage(newLang)
    setLanguageState(newLang)
  }

  const handleCreateBudget = async () => {
    if (!newBudget.category || !newBudget.subcategory || newBudget.total_amount <= 0) {
      alert(language === 'es' ? 'Por favor completa todos los campos' : 'Please complete all fields')
      return
    }

    try {
      const token = getToken()
      if (token) {
        const response = await fetch(`${apiBase}/api/personal-budgets`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: newBudget.category,
            subcategory: newBudget.subcategory,
            year: newBudget.year,
            total_amount: newBudget.total_amount,
            monthly_amounts: newBudget.monthly_amounts,
          }),
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.detail || 'Error al crear presupuesto')
        }
        await loadBudgets(token)
        setShowCreateModal(false)
        setNewBudget({
          category: '',
          subcategory: '',
          year: new Date().getFullYear(),
          total_amount: 0,
          monthly_amounts: {},
        })
        alert(language === 'es' ? 'Presupuesto creado exitosamente' : 'Budget created successfully')
        return
      }

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        alert(language === 'es' ? 'No autenticado' : 'Not authenticated')
        return
      }
      
      const { data: userData } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', authUser.id)
        .single()
      
      if (!userData?.family_id) {
        alert(language === 'es' ? 'Usuario sin familia asignada' : 'User has no family assigned')
        return
      }
      
      // Usar la API route de Next.js
      const response = await fetch('/api/personal-budgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          category: newBudget.category,
          subcategory: newBudget.subcategory,
          year: newBudget.year,
          total_amount: newBudget.total_amount,
          monthly_amounts: newBudget.monthly_amounts,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Error al crear presupuesto')
      }
      
      await loadBudgets()
      setShowCreateModal(false)
      setNewBudget({
        category: '',
        subcategory: '',
        year: new Date().getFullYear(),
        total_amount: 0,
        monthly_amounts: {}
      })
      alert(language === 'es' ? 'Presupuesto creado exitosamente' : 'Budget created successfully')
    } catch (error: any) {
      console.error('Error creando presupuesto:', error)
      alert(error.message || (language === 'es' ? 'Error al crear presupuesto' : 'Error creating budget'))
    }
  }

  const handleDeleteBudget = async (budgetId: number) => {
    if (!confirm(language === 'es' ? '¿Estás seguro de eliminar este presupuesto?' : 'Are you sure you want to delete this budget?')) {
      return
    }

    try {
      const token = getToken()
      const url = token ? `${apiBase}/api/personal-budgets/${budgetId}` : `/api/personal-budgets/${budgetId}`
      const response = await fetch(url, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: token ? undefined : 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Error al eliminar presupuesto')
      }
      
      await loadBudgets(token || undefined)
      alert(language === 'es' ? 'Presupuesto eliminado exitosamente' : 'Budget deleted successfully')
    } catch (error: any) {
      console.error('Error eliminando presupuesto:', error)
      alert(error.message || (language === 'es' ? 'Error al eliminar presupuesto' : 'Error deleting budget'))
    }
  }

  const handleUploadReceipt = async () => {
    if (!selectedBudgetForUpload || uploadFiles.length === 0) {
      alert(language === 'es' ? 'Por favor selecciona al menos un archivo' : 'Please select at least one file')
      return
    }

    setUploading(true)
    setReceiptProcessing(true)
    try {
      const token = getToken()
      const formData = new FormData()
      uploadFiles.forEach((f) => formData.append('files', f))
      formData.append('target_user_id', user?.id?.toString() || '')
      formData.append('mode', receiptExtractMode)

      const processUrl = token ? `${apiBase}/api/receipts/process` : '/api/receipts/process'
      const response = await fetch(processUrl, {
        method: 'POST',
        body: formData,
        credentials: token ? undefined : 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Error al procesar recibo')
      }

      const responseData = await response.json()
      const receipt = responseData.receipt
      
      if (receipt) {
        if (token) {
          // Asignar recibo al presupuesto (backend crea la transacción)
          await fetch(`${apiBase}/api/receipts/${receipt.id}/assign`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              family_budget_id: selectedBudgetForUpload.id,
              target_user_id: user?.id || null,
              percentage: 100,
            }),
          }).catch(() => {})
        }
      }

      await loadBudgets(token || undefined)
      setShowUploadModal(false)
      setUploadFiles([])
      setSelectedBudgetForUpload(null)
      alert(language === 'es' ? 'Recibos subidos y asignados exitosamente' : 'Receipts uploaded and assigned successfully')
    } catch (error: any) {
      console.error('Error subiendo recibo:', error)
      alert(error.message || (language === 'es' ? 'Error al subir recibo' : 'Error uploading receipt'))
    } finally {
      setUploading(false)
      setReceiptProcessing(false)
    }
  }

  const getAvailableSubcategories = () => {
    const selectedCategory = categories.find(c => c.category === newBudget.category)
    return selectedCategory?.subcategories || []
  }

  const toolbar = (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        onClick={toggleLanguage}
        className="sap-button-secondary text-sm px-3 py-1.5 min-w-[60px] h-[36px] flex items-center justify-center"
      >
        {language === 'es' ? '🇲🇽 ES' : '🇺🇸 EN'}
      </button>
    </div>
  )

  if (loading) {
    return (
      <SAPLayout user={user} title={language === 'es' ? 'Mi Presupuesto Personal' : 'My Personal Budget'} toolbar={null}>
        <div className="flex items-center justify-center py-12">
          <div className="text-sap-text-secondary">{language === 'es' ? 'Cargando...' : 'Loading...'}</div>
        </div>
      </SAPLayout>
    )
  }

  // Calcular resumen usando allocated_amount del usuario (no total_amount del presupuesto)
  const totalBudget = budgets.reduce((sum, b) => {
    const userBudget = b.user_allocations?.[0]
    return sum + (userBudget?.allocated_amount || 0)
  }, 0)
  const totalSpent = budgets.reduce((sum, b) => {
    const userBudget = b.user_allocations?.[0]
    return sum + (userBudget?.spent_amount || 0)
  }, 0)
  const totalAvailable = budgets.reduce((sum, b) => {
    const userBudget = b.user_allocations?.[0]
    return sum + (userBudget?.available_amount || 0)
  }, 0)

  return (
    <SAPLayout
      user={user}
      title={language === 'es' ? 'Mi Presupuesto Personal' : 'My Personal Budget'}
      subtitle={language === 'es' ? 'Gestiona tus presupuestos personales (colegiaturas, gasolina, reparaciones, vida social)' : 'Manage your personal budgets (tuition, gas, repairs, social life)'}
      toolbar={toolbar}
    >
      <div className="space-y-6">
        {/* Resumen */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="sap-card p-5">
            <div className="text-xs text-sap-text-secondary mb-1">
              {language === 'es' ? 'Presupuesto Total' : 'Total Budget'}
            </div>
            <div className="text-xl font-bold text-sap-text">
              {formatCurrency(totalBudget, language, false)}
            </div>
          </div>
          <div className="sap-card p-5">
            <div className="text-xs text-sap-text-secondary mb-1">
              {language === 'es' ? 'Gastado' : 'Spent'}
            </div>
            <div className="text-xl font-bold text-sap-danger">
              {formatCurrency(totalSpent, language, false)}
            </div>
          </div>
          <div className="sap-card p-5">
            <div className="text-xs text-sap-text-secondary mb-1">
              {language === 'es' ? 'Disponible' : 'Available'}
            </div>
            <div className="text-xl font-bold text-sap-success">
              {formatCurrency(totalAvailable, language, false)}
            </div>
          </div>
        </div>

        {/* Filtros y acciones */}
        <div className="sap-card p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-sap-text-secondary">
                {language === 'es' ? 'Año:' : 'Year:'}
              </label>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(parseInt(e.target.value))}
                className="sap-input"
              >
                {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="sap-button-primary flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              {language === 'es' ? 'Crear Presupuesto Personal' : 'Create Personal Budget'}
            </button>
          </div>
        </div>

        {/* Tabla de presupuestos */}
        <div className="sap-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-sap-bgSecondary sticky top-0 z-10">
                <tr>
                  <th className="sap-table-header">{language === 'es' ? 'Categoría' : 'Category'}</th>
                  <th className="sap-table-header">{language === 'es' ? 'Subcategoría' : 'Subcategory'}</th>
                  <th className="sap-table-header">{language === 'es' ? 'Año' : 'Year'}</th>
                  <th className="sap-table-header" style={{ textAlign: 'right' }}>
                    {language === 'es' ? 'Presupuesto' : 'Budget'}
                  </th>
                  <th className="sap-table-header" style={{ textAlign: 'right' }}>
                    {language === 'es' ? 'Gastado' : 'Spent'}
                  </th>
                  <th className="sap-table-header" style={{ textAlign: 'right' }}>
                    {language === 'es' ? 'Disponible' : 'Available'}
                  </th>
                  <th className="sap-table-header">{language === 'es' ? 'Acciones' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {budgets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="sap-table-cell text-center py-8 text-sap-text-secondary">
                      {language === 'es' ? 'No hay presupuestos personales' : 'No personal budgets'}
                    </td>
                  </tr>
                ) : (
                  budgets.map((budget) => {
                    const userBudget = budget.user_allocations?.[0]
                    const spent = userBudget?.spent_amount || 0
                    const available = budget.total_amount - spent
                    return (
                      <tr key={budget.id} className="border-b border-sap-border hover:bg-sap-bgHover">
                        <td className="sap-table-cell">{budget.category}</td>
                        <td className="sap-table-cell">{budget.subcategory}</td>
                        <td className="sap-table-cell">{budget.year}</td>
                        <td className="sap-table-cell" style={{ textAlign: 'right' }}>
                          {formatCurrency(budget.total_amount, language, false)}
                        </td>
                        <td className="sap-table-cell" style={{ textAlign: 'right' }}>
                          {formatCurrency(spent, language, false)}
                        </td>
                        <td className="sap-table-cell" style={{ textAlign: 'right' }}>
                          <span className={available < 0 ? 'text-sap-danger' : 'text-sap-success'}>
                            {formatCurrency(available, language, false)}
                          </span>
                        </td>
                        <td className="sap-table-cell">
                          <button
                            onClick={() => handleDeleteBudget(budget.id)}
                            className="sap-button-ghost text-xs text-sap-danger hover:bg-red-50"
                          >
                            {language === 'es' ? 'Eliminar' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de crear presupuesto */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-sap-text">
                  {language === 'es' ? 'Crear Presupuesto Personal' : 'Create Personal Budget'}
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-sap-text-secondary hover:text-sap-text"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1">
                    {language === 'es' ? 'Categoría:' : 'Category:'}
                  </label>
                  <select
                    value={newBudget.category}
                    onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value, subcategory: '' })}
                    className="sap-input w-full"
                  >
                    <option value="">{language === 'es' ? 'Selecciona categoría' : 'Select category'}</option>
                    {categories.map((cat) => (
                      <option key={cat.category} value={cat.category}>{cat.category}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1">
                    {language === 'es' ? 'Subcategoría:' : 'Subcategory:'}
                  </label>
                  <select
                    value={newBudget.subcategory}
                    onChange={(e) => setNewBudget({ ...newBudget, subcategory: e.target.value })}
                    className="sap-input w-full"
                    disabled={!newBudget.category}
                  >
                    <option value="">{language === 'es' ? 'Selecciona subcategoría' : 'Select subcategory'}</option>
                    {getAvailableSubcategories().map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1">
                    {language === 'es' ? 'Año:' : 'Year:'}
                  </label>
                  <select
                    value={newBudget.year}
                    onChange={(e) => setNewBudget({ ...newBudget, year: parseInt(e.target.value) })}
                    className="sap-input w-full"
                  >
                    {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1">
                    {language === 'es' ? 'Monto Total:' : 'Total Amount:'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newBudget.total_amount}
                    onChange={(e) => setNewBudget({ ...newBudget, total_amount: parseFloat(e.target.value) || 0 })}
                    className="sap-input w-full"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleCreateBudget}
                    className="sap-button-primary flex-1"
                  >
                    {language === 'es' ? 'Crear' : 'Create'}
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="sap-button-secondary flex-1"
                  >
                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de subir recibo */}
        {showUploadModal && selectedBudgetForUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-sap-text">
                  {language === 'es' ? 'Subir Recibo' : 'Upload Receipt'}
                </h3>
                <button
                  onClick={() => {
                    setShowUploadModal(false)
                    setUploadFiles([])
                    setSelectedBudgetForUpload(null)
                  }}
                  className="sap-button-ghost p-2"
                >
                  <XIcon size={18} className="text-sap-text-secondary" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-2">
                    {language === 'es' ? 'Presupuesto:' : 'Budget:'}
                  </label>
                  <div className="sap-input bg-sap-bgSecondary">
                    {selectedBudgetForUpload.category} - {selectedBudgetForUpload.subcategory}
                  </div>
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-2">
                    {language === 'es' ? 'Archivos del recibo:' : 'Receipt files:'}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                    className="sap-input"
                    disabled={uploading}
                  />
                  {uploadFiles.length > 0 && (
                    <p className="text-xs text-sap-text-tertiary mt-2">
                      {uploadFiles.length === 1
                        ? `${language === 'es' ? 'Archivo seleccionado' : 'Selected file'}: ${uploadFiles[0].name}`
                        : `${uploadFiles.length} ${language === 'es' ? 'archivos seleccionados' : 'files selected'}`}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleUploadReceipt}
                    disabled={uploading || uploadFiles.length === 0}
                    className="sap-button-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        {language === 'es' ? 'Subiendo...' : 'Uploading...'}
                      </>
                    ) : (
                      <>
                        <CameraIcon size={16} />
                        {language === 'es' ? 'Subir Recibo' : 'Upload Receipt'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowUploadModal(false)
                      setUploadFiles([])
                      setSelectedBudgetForUpload(null)
                    }}
                    className="sap-button-secondary flex-1"
                    disabled={uploading}
                  >
                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SAPLayout>
  )
}
