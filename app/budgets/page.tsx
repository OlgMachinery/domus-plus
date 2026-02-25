'use client'

// Forzar renderizado dinámico para esta página
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User, FamilyBudget, AnnualBudgetMatrix, GlobalBudgetSummary } from '@/lib/types'
import { PlusIcon, XIcon } from '@/lib/icons'
import AppLayout from "@/components/AppLayout"
import { useTranslation, getLanguage, setLanguage, type Language } from '@/lib/i18n'
import { formatCurrency } from '@/lib/currency'

export default function BudgetsPage() {
  const router = useRouter()
  const [language, setLanguageState] = useState<Language>(getLanguage())
  const t = useTranslation(language)
  const [budgets, setBudgets] = useState<FamilyBudget[]>([])
  const [allBudgets, setAllBudgets] = useState<FamilyBudget[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showMatrixModal, setShowMatrixModal] = useState(false)
  const [matrixData, setMatrixData] = useState<AnnualBudgetMatrix | null>(null)
  const [loadingMatrix, setLoadingMatrix] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [familyMembers, setFamilyMembers] = useState<User[]>([])
  const [customCategories, setCustomCategories] = useState<any[]>([])
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false)
  const [globalSummary, setGlobalSummary] = useState<GlobalBudgetSummary | null>(null)
  const [showGlobalSummary, setShowGlobalSummary] = useState(false)
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    category: '',
    subcategory: '',
    budgetType: 'all' as 'all' | 'shared' | 'individual',
    status: 'all' as 'all' | 'available' | 'spent' | 'over'
  })
  const [showFilters, setShowFilters] = useState(false)
  const [showBudgetDetailModal, setShowBudgetDetailModal] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState<FamilyBudget | null>(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingBudget, setEditingBudget] = useState<FamilyBudget | null>(null)
  const [budgetQuickPersonId, setBudgetQuickPersonId] = useState<string>('')
  const [budgetQuickTransportSub, setBudgetQuickTransportSub] = useState<string>('Gasolina')
  const [budgetDuplicateMode, setBudgetDuplicateMode] = useState<'individual' | 'shared'>('individual')
  const [budgetDuplicatePersonId, setBudgetDuplicatePersonId] = useState<string>('')
  const [newBudget, setNewBudget] = useState({
    step: 'account' as 'account' | 'contributors' | 'amounts', // Paso actual del formulario
    category: '',
    subcategory: '',
    year: new Date().getFullYear(),
    total_amount: 0,
    budget_type: 'shared' as 'shared' | 'individual', // Por defecto compartido
    distribution_method: 'equal' as 'equal' | 'percentage' | 'manual',
    auto_distribute: true,
    selected_members: [] as string[], // Integrantes que contribuyen a esta cuenta (user ids)
    member_amounts: {} as Record<string, number>, // Monto por integrante: {userId: amount}
    is_special_allocation: false, // Para partidas especiales/incrementos
    // Frecuencia de asignación
    frequency: 'mensual' as 'diario' | 'semanal' | 'quincenal' | 'mensual' | 'bimensual' | 'trimestral' | 'semestral' | 'anual',
    same_all_months: true, // Si es igual todos los meses
    selected_months: [] as number[], // Meses seleccionados si same_all_months es false (1-12) - INICIALIZADO
    daily_days: [] as number[], // Días del mes si frequency es 'diario' (1-31)
    variable_monthly_amounts: {} as Record<string, Record<number, number>>, // {userId: {month: amount}} para asignación variable por mes
    daily_month: 1, // Mes para asignación diaria (1-12)
    distribution_mode: 'total' as 'total' | 'percentage', // Modo de distribución: total igual o porcentajes
    total_budget_amount: 0, // Monto total del presupuesto (cuando se distribuye entre todos)
    manually_adjusted_percentages: {} as Record<string, boolean> // Rastrear qué porcentajes fueron ajustados manualmente
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    let mounted = true
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
        setLoading(false)
        return
      }
      
      // Cargar datos en paralelo
      Promise.all([
        loadUser().catch(err => {
          console.error('Error en loadUser:', err)
          return null
        }),
        loadBudgets().catch(err => {
          console.error('Error en loadBudgets:', err)
          return null
        })
      ]).finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })
    }).catch(err => {
      console.error('Error obteniendo sesión:', err)
      setLoading(false)
    })
    
    // Timeout de seguridad: si después de 10 segundos sigue cargando, desactivar loading
    const timeout = setTimeout(() => {
      if (mounted) {
        console.warn('Timeout de carga - desactivando loading')
        setLoading(false)
      }
    }, 10000)
    
    return () => {
      mounted = false
      clearTimeout(timeout)
    }
  }, [router])

  useEffect(() => {
    if (!familyMembers || familyMembers.length === 0) return
    if (!budgetQuickPersonId) setBudgetQuickPersonId(String(familyMembers[0]!.id))
    if (!budgetDuplicatePersonId) setBudgetDuplicatePersonId(String(familyMembers[0]!.id))
  }, [familyMembers, budgetQuickPersonId, budgetDuplicatePersonId])

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }
      
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      
      if (userData) {
        setUser(userData as User)
        if (userData.family_id) {
          loadFamilyMembers(userData.family_id)
          loadCustomCategories()
        }
      }
    } catch (error: any) {
      console.error('Error cargando usuario:', error)
      console.error('Detalles del error:', error.message, error)
      // Solo redirigir si es un error de autenticación
      if (error.message?.includes('JWT') || error.message?.includes('session')) {
        router.push('/login')
      }
    }
  }

  const loadCustomCategories = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      
      const { data: userData } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', authUser.id)
        .single()
      
      if (!userData?.family_id) return
      
      const { data: categories } = await supabase
        .from('custom_categories')
        .select('*')
        .eq('family_id', userData.family_id)
        .eq('is_active', true)
      
      setCustomCategories(categories || [])
    } catch (error) {
      console.error('Error cargando categorías personalizadas:', error)
      setCustomCategories([])
    }
  }

  const loadFamilyMembers = async (familyId: number) => {
    try {
      const { data: familyData } = await supabase
        .from('families')
        .select(`
          *,
          members:users(*)
        `)
        .eq('id', familyId)
        .single()
      
      if (familyData?.members) {
        setFamilyMembers(familyData.members as User[])
      }
    } catch (error: any) {
      console.error('Error cargando miembros:', error)
    }
  }

  const applyFilters = (budgetsList: FamilyBudget[] = allBudgets) => {
    let filtered = [...budgetsList]

    // Filtro por año
    if (filters.year) {
      filtered = filtered.filter(b => b.year === filters.year)
    }

    // Filtro por categoría
    if (filters.category) {
      filtered = filtered.filter(b => b.category === filters.category)
    }

    // Filtro por subcategoría
    if (filters.subcategory) {
      filtered = filtered.filter(b => b.subcategory === filters.subcategory)
    }

    // Filtro por tipo de presupuesto
    if (filters.budgetType !== 'all') {
      filtered = filtered.filter(b => b.budget_type === filters.budgetType)
    }

    // Filtro por estado
    if (filters.status !== 'all') {
      filtered = filtered.filter(b => {
        const totalAllocated = (b.user_allocations || []).reduce((sum, alloc) => sum + alloc.allocated_amount, 0)
        const totalSpent = (b.user_allocations || []).reduce((sum, alloc) => sum + alloc.spent_amount, 0)
        const available = b.total_amount - totalAllocated

        switch (filters.status) {
          case 'available':
            return available > 0
          case 'spent':
            return totalSpent > 0
          case 'over':
            return available < 0
          default:
            return true
        }
      })
    }

    setBudgets(filtered)
  }

  const loadBudgets = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', authUser.id)
        .single()
      
      if (userError) {
        console.error('Error obteniendo usuario:', userError)
        setAllBudgets([])
        applyFilters([])
        return
      }
      
      if (!userData?.family_id) {
        setAllBudgets([])
        applyFilters([])
        return
      }
      
      const { data: budgetsData, error: budgetsError } = await supabase
        .from('family_budgets')
        .select('*')
        .eq('family_id', userData.family_id)
      
      if (budgetsError) {
        console.error('Error obteniendo presupuestos:', budgetsError)
        setAllBudgets([])
        applyFilters([])
        return
      }
      
      setAllBudgets((budgetsData || []) as FamilyBudget[])
      applyFilters(budgetsData || [])
      loadGlobalSummary() // Cargar resumen global también
    } catch (error: any) {
      console.error('Error cargando presupuestos:', error)
      console.error('Detalles del error:', error.message, error)
      // No redirigir automáticamente, solo mostrar lista vacía
      setAllBudgets([])
      applyFilters([])
    }
  }

  const loadGlobalSummary = async () => {
    try {
      const year = filters.year || new Date().getFullYear()
      // TODO: Implementar resumen global con Supabase
      setGlobalSummary(null)
    } catch (error: any) {
      console.error('Error cargando resumen global:', error)
    }
  }

  useEffect(() => {
    if (allBudgets.length > 0) {
      applyFilters()
    }
    if (showGlobalSummary) {
      loadGlobalSummary()
    }
  }, [filters, showGlobalSummary])

  const loadAnnualMatrix = async () => {
    setLoadingMatrix(true)
    try {
      const year = new Date().getFullYear()
      // TODO: Implementar matriz anual con Supabase
      alert('Funcionalidad de matriz anual en desarrollo')
      setLoadingMatrix(false)
    } catch (error: any) {
      console.error('Error cargando matriz anual:', error)
      alert('Error al cargar la matriz anual')
      setLoadingMatrix(false)
    }
  }

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validar que estemos en el paso correcto
    if (newBudget.step !== 'amounts') {
      alert('Por favor, completa todos los pasos del formulario')
      return
    }
    
    if (!newBudget.category || !newBudget.subcategory) {
      alert('Por favor, selecciona una categoría y subcategoría')
      return
    }
    
    if (newBudget.selected_members.length === 0) {
      alert('Por favor, selecciona al menos un integrante que contribuye a esta cuenta')
      return
    }
    
    if (newBudget.total_amount <= 0) {
      alert('El monto total debe ser mayor a cero')
      return
    }

    // Determinar si es global/compartido o individual
    // Es compartido si: es categoría global, todos están seleccionados, o hay múltiples integrantes
    // Es individual solo si hay exactamente 1 integrante seleccionado y NO es categoría global
    const isGlobalCategory = globalCategories.includes(newBudget.category)
    const isAllMembers = newBudget.selected_members.length === familyMembers.length
    const isSingleMember = newBudget.selected_members.length === 1
    
    // Es compartido si: categoría global, todos seleccionados, o múltiples integrantes
    // Es individual solo si: 1 integrante Y no es categoría global
    const isShared = isGlobalCategory || isAllMembers || !isSingleMember
    const isIndividual = !isShared && isSingleMember
    
    try {
      // Calcular montos mensuales
      const monthlyAmounts = calculateMonthlyAmounts()
      
      // Determinar si es categoría personalizada o predefinida
      const isCustomCategory = customCategories.some(cat => cat.name === newBudget.category)
      const customCategory = isCustomCategory ? customCategories.find(cat => cat.name === newBudget.category) : null
      const customSubcategory = customCategory?.subcategories?.find((sub: any) => sub.name === newBudget.subcategory)

      // Crear el presupuesto familiar
      const budgetData: any = {
        year: newBudget.year,
        total_amount: newBudget.total_amount,
        monthly_amounts: monthlyAmounts, // Incluir montos mensuales calculados
        budget_type: isShared ? 'shared' : 'individual',
        distribution_method: isShared ? newBudget.distribution_method : 'manual',
        auto_distribute: isShared && newBudget.auto_distribute,
        target_user_id: isIndividual ? newBudget.selected_members[0] : null
      }

      // Agregar categoría (predefinida o personalizada)
      if (isCustomCategory && customCategory && customSubcategory) {
        budgetData.custom_category_id = customCategory.id
        budgetData.custom_subcategory_id = customSubcategory.id
      } else {
        budgetData.category = newBudget.category
        budgetData.subcategory = newBudget.subcategory
      }
      
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        alert('No autenticado')
        return
      }
      
      const { data: userData } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', authUser.id)
        .single()
      
      if (!userData?.family_id) {
        alert('Usuario no tiene familia asignada')
        return
      }
      
      budgetData.family_id = userData.family_id
      
      const { data: familyBudget, error: budgetError } = await supabase
        .from('family_budgets')
        .insert(budgetData)
        .select()
        .single()
      
      if (budgetError || !familyBudget) {
        throw new Error(budgetError?.message || 'Error al crear presupuesto')
      }
      
      const familyBudgetId = familyBudget.id

      // Si hay múltiples integrantes, crear UserBudget para cada uno
      if (newBudget.selected_members.length > 0) {
        const userBudgets = newBudget.selected_members
          .filter(memberId => (newBudget.member_amounts[memberId] || 0) > 0)
          .map(memberId => ({
            family_budget_id: familyBudgetId,
            user_id: memberId,
            allocated_amount: newBudget.member_amounts[memberId] || 0
          }))
        
        if (userBudgets.length > 0) {
          const { error: userBudgetError } = await supabase
            .from('user_budgets')
            .insert(userBudgets)
          
          if (userBudgetError) {
            console.error('Error creando presupuestos de usuario:', userBudgetError)
          }
        }
      }
      
      setShowCreateModal(false)
      setNewBudget({ 
        step: 'account',
        category: '', 
        subcategory: '', 
        year: new Date().getFullYear(), 
        total_amount: 0,
        budget_type: 'shared',
        distribution_method: 'equal',
        auto_distribute: true,
        selected_members: [],
        member_amounts: {},
        is_special_allocation: false,
        frequency: 'mensual',
        same_all_months: true,
        selected_months: [],
        daily_days: [],
        variable_monthly_amounts: {},
        daily_month: 1,
        distribution_mode: 'total',
        total_budget_amount: 0,
        manually_adjusted_percentages: {}
      })
      loadBudgets()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Error al crear presupuesto')
    }
  }

  const handlePasswordVerification = async () => {
    if (!adminPassword || !user) return
    
    try {
      // Verificar contraseña con Supabase
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        alert('No autenticado')
        return
      }
      
      // Intentar hacer sign in con la contraseña para verificar
      const { error } = await supabase.auth.signInWithPassword({
        email: authUser.email!,
        password: adminPassword
      })
      
      if (!error) {
        // Contraseña válida, cerrar modales y abrir modal de edición
        setShowPasswordModal(false)
        setShowBudgetDetailModal(false)
        setEditingBudget(selectedBudget)
        setShowEditModal(true)
        setAdminPassword('')
      } else {
        alert('Contraseña incorrecta')
        setAdminPassword('')
      }
    } catch (error: any) {
      console.error('Error verificando contraseña:', error)
      alert('Error al verificar contraseña')
      setAdminPassword('')
    }
  }

  const clearFilters = () => {
    setFilters({
      year: new Date().getFullYear(),
      category: '',
      subcategory: '',
      budgetType: 'all',
      status: 'all'
    })
  }

  const hasActiveFilters = filters.category !== '' || filters.subcategory !== '' || filters.budgetType !== 'all' || filters.status !== 'all'

  // Función para calcular montos mensuales basándose en la frecuencia
  const calculateMonthlyAmounts = (): Record<string, number> => {
    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
    const monthlyAmounts: Record<string, number> = {}
    
    // Inicializar todos los meses en 0
    months.forEach(month => {
      monthlyAmounts[month] = 0
    })

    // Si hay asignación variable por mes, usar esos valores
    if (Object.keys(newBudget.variable_monthly_amounts).length > 0) {
      // Sumar todos los montos de todos los integrantes por mes
      Object.values(newBudget.variable_monthly_amounts).forEach(userMonthlyAmounts => {
        months.forEach((month, index) => {
          const monthNum = index + 1
          monthlyAmounts[month] += (userMonthlyAmounts[monthNum] || 0)
        })
      })
      return monthlyAmounts
    }

    // Calcular basándose en frecuencia
    const totalAmount = newBudget.total_amount
    let monthlyAmount = 0

    switch (newBudget.frequency) {
      case 'diario':
        // Si es diario, calcular días en el mes seleccionado
        if (newBudget.daily_days.length > 0 && newBudget.daily_month) {
          const daysInMonth = new Date(newBudget.year, newBudget.daily_month, 0).getDate()
          const selectedDays = newBudget.daily_days.filter(d => d <= daysInMonth).length
          monthlyAmount = (totalAmount / selectedDays) * daysInMonth
          if (newBudget.same_all_months) {
            months.forEach(month => {
              monthlyAmounts[month] = monthlyAmount
            })
          } else {
            (newBudget.selected_months || []).forEach(monthNum => {
              if (monthNum >= 1 && monthNum <= 12) {
                monthlyAmounts[months[monthNum - 1]] = monthlyAmount
              }
            })
          }
        }
        break
      case 'semanal':
        monthlyAmount = totalAmount * 4.33 // Promedio de semanas por mes
        if (newBudget.same_all_months) {
          months.forEach(month => {
            monthlyAmounts[month] = monthlyAmount
          })
        } else {
          (newBudget.selected_months || []).forEach(monthNum => {
            if (monthNum >= 1 && monthNum <= 12) {
              monthlyAmounts[months[monthNum - 1]] = monthlyAmount
            }
          })
        }
        break
      case 'quincenal':
        monthlyAmount = totalAmount * 2
        if (newBudget.same_all_months) {
          months.forEach(month => {
            monthlyAmounts[month] = monthlyAmount
          })
        } else {
          (newBudget.selected_months || []).forEach(monthNum => {
            if (monthNum >= 1 && monthNum <= 12) {
              monthlyAmounts[months[monthNum - 1]] = monthlyAmount
            }
          })
        }
        break
      case 'mensual':
        monthlyAmount = totalAmount
        if (newBudget.same_all_months) {
          months.forEach(month => {
            monthlyAmounts[month] = monthlyAmount
          })
        } else {
          (newBudget.selected_months || []).forEach(monthNum => {
            if (monthNum >= 1 && monthNum <= 12) {
              monthlyAmounts[months[monthNum - 1]] = monthlyAmount
            }
          })
        }
        break
      case 'bimensual':
        monthlyAmount = totalAmount / 2
        if (newBudget.same_all_months) {
          months.forEach((month, index) => {
            if ((index + 1) % 2 === 1) { // Meses impares (enero, marzo, mayo, etc.)
              monthlyAmounts[month] = monthlyAmount
            }
          })
        } else {
          (newBudget.selected_months || []).forEach(monthNum => {
            if (monthNum >= 1 && monthNum <= 12) {
              monthlyAmounts[months[monthNum - 1]] = monthlyAmount
            }
          })
        }
        break
      case 'trimestral':
        monthlyAmount = totalAmount / 3
        if (newBudget.same_all_months) {
          months.forEach((month, index) => {
            if ((index + 1) % 3 === 1) { // Cada 3 meses
              monthlyAmounts[month] = monthlyAmount
            }
          })
        } else {
          (newBudget.selected_months || []).forEach(monthNum => {
            if (monthNum >= 1 && monthNum <= 12) {
              monthlyAmounts[months[monthNum - 1]] = monthlyAmount
            }
          })
        }
        break
      case 'semestral':
        monthlyAmount = totalAmount / 6
        if (newBudget.same_all_months) {
          months.forEach((month, index) => {
            if (index === 0 || index === 6) { // Enero y julio
              monthlyAmounts[month] = monthlyAmount
            }
          })
        } else {
          (newBudget.selected_months || []).forEach(monthNum => {
            if (monthNum >= 1 && monthNum <= 12) {
              monthlyAmounts[months[monthNum - 1]] = monthlyAmount
            }
          })
        }
        break
      case 'anual':
        monthlyAmount = totalAmount / 12
        months.forEach(month => {
          monthlyAmounts[month] = monthlyAmount
        })
        break
    }

    return monthlyAmounts
  }

  // Obtener categorías y años únicos de presupuestos existentes (para filtros)
  const existingCategories = Array.from(new Set(allBudgets.map(b => b.category))).sort()
  const allSubcategories = Array.from(new Set(
    allBudgets
      .filter(b => !filters.category || b.category === filters.category)
      .map(b => b.subcategory)
      .filter(s => s)
  )).sort()
  const allYears = Array.from(new Set(allBudgets.map(b => b.year))).sort((a, b) => b - a)

  // Categorías que siempre deben ser globales (todos los integrantes contribuyen)
  const globalCategories = ['Servicios Basicos', 'Mercado']

  // Todas las categorías disponibles (catálogo de cuentas)
  const predefinedCategories = [
    'Servicios Basicos', 'Mercado', 'Vivienda', 'Transporte',
    'Impuestos', 'Educacion', 'Salud', 'Salud Medicamentos', 'Vida Social'
  ]

  // Combinar categorías predefinidas con personalizadas
  const allCategories = [
    ...predefinedCategories,
    ...customCategories.map(cat => cat.name)
  ]

  const subcategories: Record<string, string[]> = {
    'Servicios Basicos': ['Electricidad CFE', 'Agua Potable', 'Gas LP', 'Internet', 'Entretenimiento', 'Garrafones Agua', 'Telcel'],
    'Mercado': ['Mercado General'],
    'Vivienda': ['Cuotas Olinala', 'Seguro Vivienda', 'Mejoras y Remodelaciones'],
    'Transporte': ['Gasolina', 'Mantenimiento coches', 'Seguros y Derechos', 'Lavado', 'LX600', 'BMW', 'HONDA CIVIC', 'LAND CRUISER'],
    'Impuestos': ['Predial'],
    'Educacion': ['Colegiaturas', 'Gonzalo', 'Sebastian', 'Emiliano', 'Isabela', 'Santiago', 'Enrique'],
    'Salud': ['Consulta', 'Medicamentos', 'Seguro Medico', 'Prevencion'],
    'Salud Medicamentos': [
      'Gonzalo Jr Vuminix, Medikinet',
      'Isabela Luvox, Risperdal',
      'Gonzalo MF, Lexapro, Concerta, Efexxor',
      'Sebastian MB, Concerta',
      'Emiliano MB, Concerta, Vuminix'
    ],
    'Vida Social': [
      'Salidas Personales', 
      'Salidas Familiares', 
      'Cumpleanos', 
      'Aniversarios', 
      'Regalos Navidad',
      'Salidas Gonzalo',
      'Salidas Emiliano',
      'Salidas Sebastian',
      'Semana Isabela',
      'Semana Santiago'
    ]
  }

  // Agregar subcategorías de categorías personalizadas
  customCategories.forEach(cat => {
    if (cat.subcategories && cat.subcategories.length > 0) {
      subcategories[cat.name] = cat.subcategories.map((sub: any) => sub.name)
    }
  })
  
  const startQuickPersonalVehicle = () => {
    if (!budgetQuickPersonId) {
      alert('Selecciona una persona')
      return
    }
    const transportSubs = subcategories['Transporte'] || []
    const safeSub = transportSubs.includes(budgetQuickTransportSub) ? budgetQuickTransportSub : (transportSubs[0] || 'Gasolina')
    setNewBudget((prev) => ({
      ...prev,
      step: 'amounts',
      category: 'Transporte',
      subcategory: safeSub,
      selected_members: [budgetQuickPersonId],
      member_amounts: { [budgetQuickPersonId]: 0 },
      distribution_mode: 'total',
      total_budget_amount: 0,
      total_amount: 0,
      manually_adjusted_percentages: {},
    }))
  }

  const startDuplicateFromSelectedBudget = () => {
    if (!selectedBudget) return
    const cat = String((selectedBudget as any)?.category || '')
    const sub = String((selectedBudget as any)?.subcategory || '')
    if (!cat || !sub) {
      alert('No se puede duplicar: falta categoría o subcategoría')
      return
    }

    const allIds = familyMembers.map((m) => String(m.id))
    const isGlobal = globalCategories.includes(cat)

    const mode: 'individual' | 'shared' = isGlobal ? 'shared' : budgetDuplicateMode
    const memberIds =
      mode === 'individual'
        ? budgetDuplicatePersonId
          ? [String(budgetDuplicatePersonId)]
          : []
        : allIds

    if (memberIds.length === 0) {
      alert('Selecciona una persona destino')
      return
    }

    const total = Number((selectedBudget as any)?.total_amount || 0) || 0
    const nextAmounts: Record<string, number> = {}
    if (mode === 'individual') {
      nextAmounts[memberIds[0]!] = total
    } else {
      const per = memberIds.length ? total / memberIds.length : 0
      memberIds.forEach((id) => (nextAmounts[id] = per))
    }

    setShowBudgetDetailModal(false)
    setSelectedBudget(null)
    setShowPasswordModal(false)
    setAdminPassword('')

    setNewBudget((prev) => ({
      ...prev,
      step: isGlobal ? 'amounts' : mode === 'shared' ? 'contributors' : 'amounts',
      year: selectedBudget.year,
      category: cat,
      subcategory: sub,
      selected_members: memberIds,
      member_amounts: nextAmounts,
      distribution_mode: 'total',
      total_budget_amount: total,
      total_amount: total,
      manually_adjusted_percentages: {},
      frequency: 'mensual',
      same_all_months: true,
      selected_months: [],
      daily_days: [],
      variable_monthly_amounts: {},
      daily_month: 1,
    }))
    setShowCreateModal(true)
  }


  if (loading) {
  return (
      <AppLayout user={user} title={t.budgets.title} toolbar={null}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{t.common.loading}</div>
            </div>
      </AppLayout>
    )
  }

  const toggleLanguage = () => {
    const newLang = language === 'es' ? 'en' : 'es'
    setLanguage(newLang)
    setLanguageState(newLang)
  }

  const toolbar = (
              <>
                <button
        onClick={toggleLanguage}
        className="sap-button-secondary text-sm px-3 py-1.5 min-w-[60px] h-[36px] flex items-center justify-center"
                >
        {language === 'es' ? '🇲🇽 ES' : '🇺🇸 EN'}
                </button>
                <button
        onClick={() => setShowGlobalSummary(!showGlobalSummary)}
        className="sap-button-secondary"
                >
        {showGlobalSummary ? t.budgets.hideFilters : t.budgets.showFilters} {t.budgets.globalSummary}
                </button>
      <button
        onClick={() => loadAnnualMatrix()}
        className="sap-button-secondary"
      >
        {t.budgets.annualMatrix}
      </button>
            <button
              onClick={() => setShowCreateModal(true)}
        className="sap-button-primary flex items-center gap-2"
            >
        <PlusIcon size={14} />
        {t.budgets.createBudget}
            </button>
    </>
  )

  return (
    <AppLayout
      user={user}
      title={t.budgets.title}
      subtitle={t.budgets.subtitle}
      toolbar={toolbar}
    >
      {/* Resumen Global */}
      {showGlobalSummary && globalSummary && (
        <div className="sap-card p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Resumen Global {globalSummary.year}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Presupuestos compartidos + individuales agrupados por categoría
              </p>
          </div>
        </div>

          {/* Totales */}
          <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-border">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Compartidos</div>
              <div className="text-lg font-semibold text-primary">
                {formatCurrency(globalSummary.totals.shared, language, false)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Individuales</div>
              <div className="text-lg font-semibold text-sap-warning">
                {formatCurrency(globalSummary.totals.individual, language, false)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Total Global</div>
              <div className="text-lg font-semibold text-foreground">
                {formatCurrency(globalSummary.totals.global, language, false)}
              </div>
            </div>
          </div>

          {/* Detalle por categoría */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {globalSummary.summary.map((item, idx) => (
              <div key={idx} className="border border-border rounded p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{item.category}</div>
                    <div className="text-xs text-muted-foreground">{item.subcategory}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground">
                      {formatCurrency(item.total_amount, language, false)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.shared_amount > 0 && (
                        <span className="text-primary">Global: {formatCurrency(item.shared_amount, language, false)}</span>
                      )}
                      {item.shared_amount > 0 && item.individual_total > 0 && ' + '}
                      {item.individual_total > 0 && (
                        <span className={globalCategories.includes(item.category) ? 'text-sap-warning font-medium' : 'text-sap-warning'}>
                          {globalCategories.includes(item.category) ? 'PE' : 'I'}: {formatCurrency(item.individual_total, language, false)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Desglose de presupuestos individuales */}
                {Object.keys(item.individual_amounts).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <div className="text-xs text-muted-foreground mb-1">
                      {globalCategories.includes(item.category) 
                        ? 'Partidas Especiales/Incrementos:' 
                        : 'Presupuestos individuales:'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(item.individual_amounts).map(([userId, userData]) => (
                        <div key={userId} className={`text-xs px-2 py-1 rounded ${
                          globalCategories.includes(item.category)
                            ? 'bg-sap-warning/20 text-sap-warning border border-sap-warning/30'
                            : 'bg-sap-warning/10 text-sap-warning'
                        }`}>
                          {userData.name}: {formatCurrency(userData.amount, language, false)}
                          {globalCategories.includes(item.category) && ' (PE)'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros estilo SAP */}
      <div className="sap-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground">Filtros</h3>
            {hasActiveFilters && (
              <span className="sap-badge bg-primary/10 text-primary">
                {Object.values(filters).filter((v, i) => i !== 0 && v !== '' && v !== 'all').length} activos
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="sap-button-ghost text-xs"
              >
                Limpiar
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="sap-button-secondary text-xs"
            >
              {showFilters ? 'Ocultar' : 'Mostrar'} Filtros
            </button>
          </div>
        </div>

        {/* Filtro rápido por año */}
        <div className="flex gap-2 mb-3">
          <label className="text-xs font-medium text-muted-foreground flex items-center">
            Año:
          </label>
          <select
            value={filters.year}
            onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
            className="sap-input text-xs w-32"
          >
            {allYears.length > 0 ? allYears.map(year => (
              <option key={year} value={year}>{year}</option>
            )) : (
              <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            )}
          </select>
        </div>

        {/* Filtros avanzados */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-border">
                  <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Categoría
              </label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value, subcategory: '' })}
                className="sap-input text-xs"
              >
                <option value="">Todas</option>
                {existingCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
                  </div>

                  <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Subcategoría
              </label>
              <select
                value={filters.subcategory}
                onChange={(e) => setFilters({ ...filters, subcategory: e.target.value })}
                className="sap-input text-xs"
                disabled={!filters.category}
              >
                <option value="">Todas</option>
                {allSubcategories.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
                  </div>

                  <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Tipo
              </label>
              <select
                value={filters.budgetType}
                onChange={(e) => setFilters({ ...filters, budgetType: e.target.value as 'all' | 'shared' | 'individual' })}
                className="sap-input text-xs"
              >
                <option value="all">Todos</option>
                <option value="shared">Común</option>
                <option value="individual">Individual</option>
              </select>
                </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Estado
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as 'all' | 'available' | 'spent' | 'over' })}
                className="sap-input text-xs"
              >
                <option value="all">Todos</option>
                <option value="available">Disponible</option>
                <option value="spent">Con gastos</option>
                <option value="over">Excedido</option>
              </select>
                          </div>
                        </div>
        )}
                    </div>

      {/* Tabla de presupuestos estilo SAP */}
          {budgets.length > 0 ? (
            <div className="sap-card overflow-hidden">
              <table className="sap-table">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Subcategoría</th>
                    <th className="text-right">Mensual</th>
                    <th className="text-right">Anual</th>
                    <th className="text-right">Asignado</th>
                    <th className="text-right">Gastado</th>
                    <th className="text-right">Disponible</th>
                    <th className="text-center">%</th>
                  </tr>
                </thead>
                <tbody>
                  {budgets.map((budget) => {
                    const totalAllocated = (budget.user_allocations || []).reduce((sum, alloc) => sum + alloc.allocated_amount, 0)
                    const totalSpent = (budget.user_allocations || []).reduce((sum, alloc) => sum + alloc.spent_amount, 0)
                    const available = budget.total_amount - totalAllocated
                    const percentage = budget.total_amount > 0 ? (totalSpent / budget.total_amount) * 100 : 0
                    const montoMensual = budget.total_amount / 12

                    return (
                      <tr 
                        key={budget.id}
                        onClick={() => {
                          setSelectedBudget(budget)
                          setShowBudgetDetailModal(true)
                        }}
                        className="cursor-pointer hover:bg-sap-hover transition-colors"
                      >
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{budget.category}</span>
                            {budget.budget_type === 'shared' && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">C</span>
                            )}
                            {budget.budget_type === 'individual' && budget.category != null && globalCategories.includes(budget.category) && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-sap-warning/10 text-sap-warning rounded font-medium" title="Partida Especial/Incremento">PE</span>
                            )}
                            {budget.budget_type === 'individual' && (budget.category == null || !globalCategories.includes(budget.category)) && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-sap-warning/10 text-sap-warning rounded font-medium">I</span>
                  )}
                </div>
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">{budget.subcategory}</span>
                            {budget.budget_type === 'individual' && budget.target_user && (
                              <span className={`text-[10px] mt-0.5 ${
                                budget.category != null && globalCategories.includes(budget.category) 
                                  ? 'text-sap-warning font-medium' 
                                  : 'text-sap-warning'
                              }`}>
                                {budget.target_user.name}
                                {budget.category != null && globalCategories.includes(budget.category) && ' (Partida Especial)'}
                              </span>
                            )}
              </div>
                        </td>
                        <td className="text-right">
                          <span className="text-sm font-medium text-foreground">
                            {formatCurrency(montoMensual, language, false)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className="text-sm font-semibold text-foreground">
                            {formatCurrency(budget.total_amount, language, false)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(totalAllocated, language, false)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={`text-xs font-medium ${
                            totalSpent > 0 ? 'text-sap-danger' : 'text-muted-foreground'
                          }`}>
                            {formatCurrency(totalSpent, language, false)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={`text-xs font-semibold ${
                            available > 0 ? 'text-sap-success' : available < 0 ? 'text-sap-danger' : 'text-muted-foreground'
                          }`}>
                            {formatCurrency(available, language, false)}
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-background rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  percentage > 80 ? 'bg-sap-danger' : 
                                  percentage > 50 ? 'bg-sap-warning' : 
                                  'bg-sap-success'
                                }`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground min-w-[35px]">
                              {percentage.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sap-card p-12 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                No hay presupuestos creados aún
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="sap-button-primary flex items-center gap-2 mx-auto"
              >
                <PlusIcon size={14} />
                Crear Presupuesto
              </button>
            </div>
          )}

      {/* Modal de creación estilo SAP */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="sap-card max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
              <div>
                  <h2 className="text-lg font-semibold text-foreground">Crear Presupuesto Anual</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {newBudget.step === 'account' && 'Paso 1: Selecciona la cuenta del catálogo'}
                    {newBudget.step === 'contributors' && 'Paso 2: Selecciona los integrantes que contribuyen'}
                    {newBudget.step === 'amounts' && 'Paso 3: Asigna montos a cada integrante'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewBudget({ 
                      step: 'account',
                      category: '', 
                      subcategory: '', 
                      year: new Date().getFullYear(), 
                      total_amount: 0,
                      budget_type: 'shared',
                      distribution_method: 'equal',
                      auto_distribute: true,
                      selected_members: [],
                      member_amounts: {},
                      is_special_allocation: false,
                      frequency: 'mensual',
                      same_all_months: true,
                      selected_months: [],
                      daily_days: [],
                      variable_monthly_amounts: {},
                      daily_month: 1,
                      distribution_mode: 'total',
                      total_budget_amount: 0,
                      manually_adjusted_percentages: {}
                    })
                  }}
                  className="sap-button-ghost p-2"
                >
                  <XIcon size={18} className="text-muted-foreground" />
                </button>
              </div>

              <form onSubmit={handleCreateBudget} className="space-y-5">
                {/* Paso 1: Seleccionar cuenta (categoría/subcategoría) */}
                {newBudget.step === 'account' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-3">
                        Selecciona la cuenta del catálogo
                      </label>
                      <p className="text-xs text-muted-foreground mb-3">
                        Primero selecciona la categoría y subcategoría. Luego definirás qué integrantes contribuyen a esta cuenta.
                      </p>

                      <div className="sap-card p-4 bg-primary/5 border border-sap-primary/20 mb-4">
                        <div className="text-sm font-semibold text-foreground">Asistente rápido: Auto personal</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Para casos como “Mamá tiene carro → Gasolina”. Esto prepara una cuenta <b>Individual</b> (1 integrante) dentro de <b>Transporte</b>.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1.5">Persona</div>
                            <select
                              value={budgetQuickPersonId}
                              onChange={(e) => setBudgetQuickPersonId(e.target.value)}
                              className="sap-input w-full"
                            >
                              <option value="">Selecciona…</option>
                              {familyMembers.map((m) => (
                                <option key={m.id} value={String(m.id)}>
                                  {m.name || m.email}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1.5">Subcuenta (Transporte)</div>
                            <select
                              value={budgetQuickTransportSub}
                              onChange={(e) => setBudgetQuickTransportSub(e.target.value)}
                              className="sap-input w-full"
                            >
                              {(subcategories['Transporte'] || []).map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-between items-center gap-3 mt-3 flex-wrap">
                          <div className="text-xs text-muted-foreground">
                            Tip: si también existe “Gasolina de Casa”, duplica la cuenta desde <b>Detalles → Dividir</b>.
                          </div>
                          <button type="button" onClick={startQuickPersonalVehicle} className="sap-button-secondary">
                            Usar plantilla
                          </button>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                          Categoría
                        </label>
                        <div className="flex gap-2">
                <select
                  value={newBudget.category}
                  onChange={(e) => {
                              setNewBudget({ 
                                ...newBudget, 
                                category: e.target.value, 
                                subcategory: ''
                              })
                  }}
                  required
                            className="sap-input flex-1"
                >
                  <option value="">Selecciona una categoría</option>
                            <optgroup label="Categorías Predefinidas">
                              {predefinedCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                            </optgroup>
                            {customCategories.length > 0 && (
                              <optgroup label="Categorías Personalizadas">
                                {customCategories.map(cat => (
                                  <option key={cat.id} value={cat.name}>
                                    {cat.icon && `${cat.icon} `}{cat.name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                </select>
                          <button
                            type="button"
                            onClick={() => setShowCreateCategoryModal(true)}
                            className="sap-button-secondary flex items-center gap-1 px-3"
                            title={language === 'es' ? 'Crear nueva categoría' : 'Create new category'}
                          >
                            <PlusIcon size={16} />
                            {language === 'es' ? 'Nueva' : 'New'}
                          </button>
                        </div>
                        {newBudget.category && globalCategories.includes(newBudget.category) && (
                          <p className="text-xs text-primary mt-1.5">
                            Esta categoría es siempre global (todos los integrantes contribuyen)
                          </p>
                        )}
              </div>

              {newBudget.category && (
                <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                            Subcategoría
                          </label>
                  <select
                    value={newBudget.subcategory}
                    onChange={(e) => setNewBudget({ ...newBudget, subcategory: e.target.value })}
                    required
                            className="sap-input"
                  >
                    <option value="">Selecciona una subcategoría</option>
                    {subcategories[newBudget.category]?.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              )}

                      {newBudget.category && newBudget.subcategory && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <button
                            type="button"
                            onClick={() => {
                              // Si es categoría global, seleccionar todos los miembros automáticamente
                              if (globalCategories.includes(newBudget.category)) {
                                setNewBudget({ 
                                  ...newBudget, 
                                  selected_members: familyMembers.map(m => m.id),
                                  step: 'amounts'
                                })
                              } else {
                                // Seleccionar todos los integrantes por defecto
                                const allMemberIds = familyMembers.map(m => m.id)
                                const initialAmounts: Record<string, number> = {}
                                allMemberIds.forEach(id => {
                                  initialAmounts[id] = 0
                                })
                                setNewBudget({ 
                                  ...newBudget, 
                                  selected_members: allMemberIds,
                                  member_amounts: initialAmounts,
                                  step: 'contributors' 
                                })
                              }
                            }}
                            className="sap-button-primary w-full"
                          >
                            Continuar → Seleccionar Integrantes
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Paso 2: Seleccionar integrantes que contribuyen */}
                {newBudget.step === 'contributors' && (
                  <div className="space-y-4">
              <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-3">
                        ¿Qué integrantes contribuyen a esta cuenta?
                      </label>
                      <p className="text-xs text-muted-foreground mb-3">
                        <strong>Todos los integrantes están seleccionados por defecto.</strong> Deselecciona los que no contribuyen a {newBudget.category} - {newBudget.subcategory}
                      </p>
                      
                      <div className="mb-3 p-2 bg-primary/10 border border-sap-primary/20 rounded">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">
                            {newBudget.selected_members.length} de {familyMembers.length} integrantes seleccionados
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const allMemberIds = familyMembers.map(m => m.id)
                                const initialAmounts: Record<string, number> = {}
                                allMemberIds.forEach(id => {
                                  initialAmounts[id] = newBudget.member_amounts[id] || 0
                                })
                                setNewBudget({
                                  ...newBudget,
                                  selected_members: allMemberIds,
                                  member_amounts: initialAmounts
                                })
                              }}
                              className="text-xs text-primary hover:underline"
                            >
                              Seleccionar todos
                            </button>
                            <span className="text-sap-border">|</span>
                            <button
                              type="button"
                              onClick={() => {
                                setNewBudget({
                                  ...newBudget,
                                  selected_members: [],
                                  member_amounts: {}
                                })
                              }}
                              className="text-xs text-muted-foreground hover:underline"
                            >
                              Deseleccionar todos
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-2 mb-4">
                        {familyMembers.map(member => (
                          <label
                            key={member.id}
                            className={`sap-card p-3 cursor-pointer hover:border-sap-primary transition-colors border-2 ${
                              newBudget.selected_members.includes(member.id) 
                                ? 'border-sap-primary bg-primary/5' 
                                : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={newBudget.selected_members.includes(member.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewBudget({
                                      ...newBudget,
                                      selected_members: [...newBudget.selected_members, member.id],
                                      member_amounts: { ...newBudget.member_amounts, [member.id]: 0 }
                                    })
                                  } else {
                                    const newMembers = newBudget.selected_members.filter(id => id !== member.id)
                                    const newAmounts = { ...newBudget.member_amounts }
                                    delete newAmounts[member.id]
                                    setNewBudget({
                                      ...newBudget,
                                      selected_members: newMembers,
                                      member_amounts: newAmounts
                                    })
                                  }
                                }}
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-foreground">
                                  {member.name} {member.id === user?.id && '(Tú)'}
                                </div>
                                <div className="text-xs text-muted-foreground">{member.email}</div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>

                      {newBudget.selected_members.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <button
                            type="button"
                            onClick={() => setNewBudget({ ...newBudget, step: 'amounts' })}
                            className="sap-button-primary w-full"
                            disabled={newBudget.selected_members.length === 0}
                          >
                            Continuar → Asignar Montos ({newBudget.selected_members.length} integrante{newBudget.selected_members.length > 1 ? 's' : ''})
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setNewBudget({ ...newBudget, step: 'account', selected_members: [], member_amounts: {} })}
                        className="sap-button-secondary text-sm mt-3"
                      >
                        ← Volver
                      </button>
                    </div>
                  </div>
                )}

                {/* Paso 3: Asignar montos */}
                {newBudget.step === 'amounts' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-3">
                        Asigna montos a cada integrante
                      </label>
                      <p className="text-xs text-muted-foreground mb-4">
                        Define cuánto contribuye cada integrante a {newBudget.category} - {newBudget.subcategory}
                        <br />
                        <strong className="text-primary">{newBudget.selected_members.length} integrante{newBudget.selected_members.length > 1 ? 's' : ''} seleccionado{newBudget.selected_members.length > 1 ? 's' : ''}</strong>
                      </p>

                      {/* Selección de frecuencia */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                          Frecuencia de asignación
                        </label>
                        <select
                          value={newBudget.frequency}
                          onChange={(e) => setNewBudget({ 
                            ...newBudget, 
                            frequency: e.target.value as any,
                            variable_monthly_amounts: {} // Limpiar asignación variable al cambiar frecuencia
                          })}
                          className="sap-input"
                        >
                          <option value="diario">Diario</option>
                          <option value="semanal">Semanal</option>
                          <option value="quincenal">Quincenal</option>
                          <option value="mensual">Mensual</option>
                          <option value="bimensual">Bimensual</option>
                          <option value="trimestral">Trimestral</option>
                          <option value="semestral">Semestral</option>
                          <option value="anual">Anual</option>
                        </select>
                      </div>

                      {/* Si es diario: seleccionar días del mes */}
                      {newBudget.frequency === 'diario' && (
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-muted-foreground mb-2">
                            Mes para asignación diaria
                          </label>
                          <select
                            value={newBudget.daily_month}
                            onChange={(e) => {
                              const month = parseInt(e.target.value)
                              const daysInMonth = new Date(newBudget.year, month, 0).getDate()
                              setNewBudget({ 
                                ...newBudget, 
                                daily_month: month,
                                daily_days: newBudget.daily_days.filter(d => d <= daysInMonth)
                              })
                            }}
                            className="sap-input mb-2"
                          >
                            {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((mes, index) => (
                              <option key={index + 1} value={index + 1}>{mes}</option>
                            ))}
                          </select>
                          <label className="block text-sm font-medium text-muted-foreground mb-2 mt-3">
                            Días del mes ({new Date(newBudget.year, newBudget.daily_month, 0).getDate()} días disponibles)
                          </label>
                          <div className="grid grid-cols-7 gap-2 max-h-48 overflow-y-auto p-2 border border-border rounded">
                            {Array.from({ length: new Date(newBudget.year, newBudget.daily_month, 0).getDate() }, (_, i) => i + 1).map(day => (
                              <label key={day} className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newBudget.daily_days.includes(day)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setNewBudget({
                                        ...newBudget,
                                        daily_days: [...newBudget.daily_days, day].sort((a, b) => a - b)
                                      })
                                    } else {
                                      setNewBudget({
                                        ...newBudget,
                                        daily_days: newBudget.daily_days.filter(d => d !== day)
                                      })
                                    }
                                  }}
                                  className="w-4 h-4 mr-1"
                                />
                                <span className="text-xs text-foreground">{day}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Preguntar si es igual todos los meses (excepto para anual) */}
                      {newBudget.frequency !== 'anual' && (
                        <div className="mb-4">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newBudget.same_all_months}
                              onChange={(e) => setNewBudget({ 
                                ...newBudget, 
                                same_all_months: e.target.checked,
                                selected_months: e.target.checked ? [] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                                variable_monthly_amounts: {} // Limpiar asignación variable
                              })}
                              className="w-4 h-4 mr-2"
                            />
                            <span className="text-sm text-foreground">¿Es igual todos los meses?</span>
                          </label>
                        </div>
                      )}

                      {/* Si no es igual todos los meses: seleccionar meses */}
                      {!newBudget.same_all_months && newBudget.frequency !== 'anual' && (
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-muted-foreground mb-2">
                            Selecciona los meses
                          </label>
                          <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto p-2 border border-border rounded">
                            {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((mes, index) => (
                              <label key={index + 1} className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={(newBudget.selected_months || []).includes(index + 1)}
                                  onChange={(e) => {
                                    const currentMonths = newBudget.selected_months || []
                                    if (e.target.checked) {
                                      setNewBudget({
                                        ...newBudget,
                                        selected_months: [...currentMonths, index + 1].sort((a, b) => a - b)
                                      })
                                    } else {
                                      setNewBudget({
                                        ...newBudget,
                                        selected_months: currentMonths.filter(m => m !== index + 1)
                                      })
                                    }
                                  }}
                                  className="w-4 h-4 mr-2"
                                />
                                <span className="text-xs text-foreground">{mes}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Opción de asignación variable por mes - Solo si hay monto total definido */}
                      {newBudget.total_budget_amount > 0 && (
                        <div className="mb-4">
                          <label className="flex items-center cursor-pointer mb-2">
                            <input
                              type="checkbox"
                              checked={Object.keys(newBudget.variable_monthly_amounts).length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  // Inicializar SOLO con los integrantes seleccionados
                                  const initialVariable: Record<string, Record<number, number>> = {}
                                  newBudget.selected_members.forEach(memberId => {
                                    const baseAmount = newBudget.member_amounts[memberId] || 0
                                    initialVariable[memberId] = {}
                                    for (let month = 1; month <= 12; month++) {
                                      initialVariable[memberId][month] = baseAmount / 12
                                    }
                                  })
                                  setNewBudget({
                                    ...newBudget,
                                    variable_monthly_amounts: initialVariable
                                  })
                                } else {
                                  setNewBudget({
                                    ...newBudget,
                                    variable_monthly_amounts: {}
                                  })
                                }
                              }}
                              className="w-4 h-4 mr-2"
                            />
                            <span className="text-sm text-foreground">Asignación variable por mes</span>
                          </label>
                          {Object.keys(newBudget.variable_monthly_amounts).length > 0 && (
                            <p className="text-xs text-muted-foreground mb-3">
                              Define montos específicos para cada mes del año ({newBudget.selected_members.length} integrante{newBudget.selected_members.length > 1 ? 's' : ''} seleccionado{newBudget.selected_members.length > 1 ? 's' : ''})
                            </p>
                          )}
                        </div>
                      )}

                      {/* Detectar si son todos los integrantes */}
                      {(() => {
                        const isAllMembers = newBudget.selected_members.length === familyMembers.length
                        
                        return (
                          <>
                            {/* Si son todos: mostrar solo monto total */}
                            {isAllMembers ? (
                              <div className="space-y-4 mb-4">
                                <div className="sap-card p-4">
                                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                                    Monto total del presupuesto
                                  </label>
                                  <p className="text-xs text-muted-foreground mb-3">
                                    Este monto se dividirá igual entre todos los integrantes ({newBudget.selected_members.length} personas)
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg text-muted-foreground">$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={newBudget.total_budget_amount || 0}
                                      onChange={(e) => {
                                        const totalAmount = parseFloat(e.target.value) || 0
                                        const amountPerMember = totalAmount / newBudget.selected_members.length
                                        const memberAmounts: Record<string, number> = {}
                                        newBudget.selected_members.forEach(memberId => {
                                          memberAmounts[memberId] = amountPerMember
                                        })
                                        setNewBudget({
                                          ...newBudget,
                                          total_budget_amount: totalAmount,
                                          total_amount: totalAmount,
                                          member_amounts: memberAmounts
                                        })
                                      }}
                                      className="sap-input text-lg font-semibold text-right flex-1"
                                      placeholder="0.00"
                                      min="0"
                                    />
                                  </div>
                                  {newBudget.total_budget_amount > 0 && (
                                    <div className="mt-3 pt-3 border-t border-border">
                                      <div className="text-xs text-muted-foreground">
                                        Monto por integrante: <strong className="text-primary">{formatCurrency(newBudget.total_budget_amount / newBudget.selected_members.length, language, true)}</strong>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              // Si son algunos: mostrar opción de monto total o porcentajes
                              <div className="space-y-4 mb-4">
                                {/* Selección de modo de distribución */}
                                <div className="mb-4">
                                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                                    Modo de distribución
                                  </label>
                                  <div className="flex gap-4">
                                    <label className="flex items-center cursor-pointer">
                                      <input
                                        type="radio"
                                        name="distribution_mode"
                                        checked={newBudget.distribution_mode === 'total'}
                                        onChange={() => setNewBudget({ 
                                          ...newBudget, 
                                          distribution_mode: 'total', 
                                          total_budget_amount: newBudget.total_amount,
                                          manually_adjusted_percentages: {} // Limpiar ajustes manuales al cambiar modo
                                        })}
                                        className="w-4 h-4 mr-2"
                                      />
                                      <span className="text-sm text-foreground">Monto total (dividir igual)</span>
                                    </label>
                                    <label className="flex items-center cursor-pointer">
                                      <input
                                        type="radio"
                                        name="distribution_mode"
                                        checked={newBudget.distribution_mode === 'percentage'}
                                        onChange={() => {
                                          // Inicializar porcentajes iguales y limpiar ajustes manuales
                                          const totalAmount = newBudget.total_budget_amount || newBudget.total_amount || 0
                                          const equalAmount = totalAmount / newBudget.selected_members.length
                                          const initialAmounts: Record<string, number> = {}
                                          newBudget.selected_members.forEach(memberId => {
                                            initialAmounts[memberId] = equalAmount
                                          })
                                          setNewBudget({ 
                                            ...newBudget, 
                                            distribution_mode: 'percentage',
                                            member_amounts: initialAmounts,
                                            manually_adjusted_percentages: {} // Limpiar ajustes manuales
                                          })
                                        }}
                                        className="w-4 h-4 mr-2"
                                      />
                                      <span className="text-sm text-foreground">Distribución por porcentajes</span>
                                    </label>
                                  </div>
                                  {newBudget.distribution_mode === 'percentage' && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                      💡 Al modificar un porcentaje, la diferencia se distribuye automáticamente entre los demás para mantener el 100%
                                    </p>
                                  )}
                                </div>

                                {newBudget.distribution_mode === 'total' ? (
                                  // Modo: Monto total
                                  <div className="sap-card p-4">
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                                      Monto total del presupuesto
                                    </label>
                                    <p className="text-xs text-muted-foreground mb-3">
                                      Este monto se dividirá igual entre los {newBudget.selected_members.length} integrantes seleccionados
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg text-muted-foreground">$</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={newBudget.total_budget_amount || 0}
                                        onChange={(e) => {
                                          const totalAmount = parseFloat(e.target.value) || 0
                                          const amountPerMember = totalAmount / newBudget.selected_members.length
                                          const memberAmounts: Record<string, number> = {}
                                          newBudget.selected_members.forEach(memberId => {
                                            memberAmounts[memberId] = amountPerMember
                                          })
                                          setNewBudget({
                                            ...newBudget,
                                            total_budget_amount: totalAmount,
                                            total_amount: totalAmount,
                                            member_amounts: memberAmounts
                                          })
                                        }}
                                        className="sap-input text-lg font-semibold text-right flex-1"
                                        placeholder="0.00"
                                        min="0"
                                      />
                                    </div>
                                    {newBudget.total_budget_amount > 0 && (
                                      <div className="mt-3 pt-3 border-t border-border">
                                        <div className="text-xs text-muted-foreground">
                                          Monto por integrante: <strong className="text-primary">{formatCurrency(newBudget.total_budget_amount / newBudget.selected_members.length, language, true)}</strong>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  // Modo: Porcentajes
                                  <div className="space-y-3">
                                    <div className="sap-card p-4 bg-primary/5 border border-sap-primary/20">
                                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                                        Monto total del presupuesto
                                      </label>
                                      <div className="flex items-center gap-2">
                                        <span className="text-lg text-muted-foreground">$</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={newBudget.total_budget_amount || 0}
                                          onChange={(e) => {
                                            const totalAmount = parseFloat(e.target.value) || 0
                                            // Recalcular montos individuales basándose en porcentajes actuales
                                            const memberAmounts: Record<string, number> = {}
                                            let totalPercentage = 0
                                            newBudget.selected_members.forEach(memberId => {
                                              const currentAmount = newBudget.member_amounts[memberId] || 0
                                              const currentTotal = newBudget.total_amount || 1
                                              const percentage = (currentAmount / currentTotal) * 100
                                              totalPercentage += percentage
                                              memberAmounts[memberId] = (totalAmount * percentage) / 100
                                            })
                                            // Si no hay porcentajes definidos, dividir igual
                                            if (totalPercentage === 0) {
                                              const equalAmount = totalAmount / newBudget.selected_members.length
                                              newBudget.selected_members.forEach(memberId => {
                                                memberAmounts[memberId] = equalAmount
                                              })
                                            }
                                            setNewBudget({
                                              ...newBudget,
                                              total_budget_amount: totalAmount,
                                              total_amount: totalAmount,
                                              member_amounts: memberAmounts
                                            })
                                          }}
                                          className="sap-input text-lg font-semibold text-right flex-1"
                                          placeholder="0.00"
                                          min="0"
                                        />
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      {newBudget.selected_members.map(memberId => {
                                        const member = familyMembers.find(m => m.id === memberId)
                                        if (!member) return null
                                        const currentAmount = newBudget.member_amounts[memberId] || 0
                                        const currentTotal = newBudget.total_budget_amount || 1
                                        const percentage = (currentAmount / currentTotal) * 100
                                        
                                        return (
                                          <div key={memberId} className="sap-card p-3">
                                            <div className="flex items-center justify-between gap-3">
                                              <div className="flex-1">
                                                <div className="font-medium text-foreground text-sm">
                                                  {member.name} {member.id === user?.id && '(Tú)'}
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 w-32">
                                                  <input
                                                    type="number"
                                                    step="0.01"
                                                    value={percentage.toFixed(2)}
                                                    onChange={(e) => {
                                                      const newPercentage = parseFloat(e.target.value) || 0
                                                      const totalAmount = newBudget.total_budget_amount || 0
                                                      const oldPercentage = percentage
                                                      const difference = newPercentage - oldPercentage
                                                      
                                                      // Marcar este porcentaje como ajustado manualmente
                                                      const adjustedPercentages = {
                                                        ...newBudget.manually_adjusted_percentages,
                                                        [memberId]: true
                                                      }
                                                      
                                                      // Obtener integrantes que NO han sido modificados manualmente (excepto el actual)
                                                      const unadjustedMembers = newBudget.selected_members.filter(
                                                        id => id !== memberId && !adjustedPercentages[id]
                                                      )
                                                      
                                                      // Calcular nuevos montos
                                                      const newMemberAmounts = { ...newBudget.member_amounts }
                                                      newMemberAmounts[memberId] = (totalAmount * newPercentage) / 100
                                                      
                                                      // Distribuir la diferencia entre los no modificados
                                                      if (unadjustedMembers.length > 0 && difference !== 0) {
                                                        const adjustmentPerMember = -difference / unadjustedMembers.length
                                                        unadjustedMembers.forEach(unadjustedId => {
                                                          const currentPct = (newMemberAmounts[unadjustedId] || 0) / totalAmount * 100
                                                          const newPct = Math.max(0, currentPct + adjustmentPerMember)
                                                          newMemberAmounts[unadjustedId] = (totalAmount * newPct) / 100
                                                        })
                                                      } else if (unadjustedMembers.length === 0 && difference !== 0) {
                                                        // Si todos han sido modificados, distribuir entre todos excepto el actual
                                                        const otherMembers = newBudget.selected_members.filter(id => id !== memberId)
                                                        const adjustmentPerMember = -difference / otherMembers.length
                                                        otherMembers.forEach(otherId => {
                                                          const currentPct = (newMemberAmounts[otherId] || 0) / totalAmount * 100
                                                          const newPct = Math.max(0, currentPct + adjustmentPerMember)
                                                          newMemberAmounts[otherId] = (totalAmount * newPct) / 100
                                                        })
                                                      }
                                                      
                                                      setNewBudget({
                                                        ...newBudget,
                                                        member_amounts: newMemberAmounts,
                                                        total_amount: newBudget.total_budget_amount,
                                                        manually_adjusted_percentages: adjustedPercentages
                                                      })
                                                    }}
                                                    className="sap-input w-20 text-right"
                                                    placeholder="0.00"
                                                    min="0"
                                                    max="100"
                                                  />
                                                  <span className="text-xs text-muted-foreground">%</span>
                                                </div>
                                                <div className="flex items-center gap-2 w-32">
                                                  <span className="text-xs text-muted-foreground">$</span>
                                                  <input
                                                    type="number"
                                                    step="0.01"
                                                    value={currentAmount.toFixed(2)}
                                                    onChange={(e) => {
                                                      const newAmount = parseFloat(e.target.value) || 0
                                                      const totalAmount = newBudget.total_budget_amount || 1
                                                      const oldAmount = currentAmount
                                                      const difference = newAmount - oldAmount
                                                      const differencePercentage = (difference / totalAmount) * 100
                                                      
                                                      // Marcar este porcentaje como ajustado manualmente
                                                      const adjustedPercentages = {
                                                        ...newBudget.manually_adjusted_percentages,
                                                        [memberId]: true
                                                      }
                                                      
                                                      // Obtener integrantes que NO han sido modificados manualmente (excepto el actual)
                                                      const unadjustedMembers = newBudget.selected_members.filter(
                                                        id => id !== memberId && !adjustedPercentages[id]
                                                      )
                                                      
                                                      // Calcular nuevos montos
                                                      const newMemberAmounts = { ...newBudget.member_amounts }
                                                      newMemberAmounts[memberId] = newAmount
                                                      
                                                      // Distribuir la diferencia entre los no modificados
                                                      if (unadjustedMembers.length > 0 && difference !== 0) {
                                                        const adjustmentPerMember = -difference / unadjustedMembers.length
                                                        unadjustedMembers.forEach(unadjustedId => {
                                                          const currentAmount = newMemberAmounts[unadjustedId] || 0
                                                          newMemberAmounts[unadjustedId] = Math.max(0, currentAmount + adjustmentPerMember)
                                                        })
                                                      } else if (unadjustedMembers.length === 0 && difference !== 0) {
                                                        // Si todos han sido modificados, distribuir entre todos excepto el actual
                                                        const otherMembers = newBudget.selected_members.filter(id => id !== memberId)
                                                        const adjustmentPerMember = -difference / otherMembers.length
                                                        otherMembers.forEach(otherId => {
                                                          const currentAmount = newMemberAmounts[otherId] || 0
                                                          newMemberAmounts[otherId] = Math.max(0, currentAmount + adjustmentPerMember)
                                                        })
                                                      }
                                                      
                                                      setNewBudget({
                                                        ...newBudget,
                                                        member_amounts: newMemberAmounts,
                                                        total_amount: newBudget.total_budget_amount,
                                                        manually_adjusted_percentages: adjustedPercentages
                                                      })
                                                    }}
                                                    className="sap-input w-28 text-right"
                                                    placeholder="0.00"
                                                    min="0"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                    
                                    {newBudget.total_budget_amount > 0 && (
                                      <div className="p-3 bg-sap-warning/10 border border-sap-warning/20 rounded">
                                        <div className="text-xs text-muted-foreground">
                                          Total porcentajes: <strong className={Math.abs(Object.values(newBudget.member_amounts).reduce((sum, amt) => sum + ((amt / (newBudget.total_budget_amount || 1)) * 100), 0) - 100) < 0.01 ? 'text-sap-success' : 'text-sap-error'}>
                                            {Object.values(newBudget.member_amounts).reduce((sum, amt) => sum + ((amt / (newBudget.total_budget_amount || 1)) * 100), 0).toFixed(2)}%
                                          </strong>
                                          {Math.abs(Object.values(newBudget.member_amounts).reduce((sum, amt) => sum + ((amt / (newBudget.total_budget_amount || 1)) * 100), 0) - 100) >= 0.01 && (
                                            <span className="text-sap-error ml-2">(debe sumar 100%)</span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )
                      })()}

                      <div className="p-3 bg-primary/10 border border-sap-primary/20 rounded mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-foreground">Total de la cuenta:</span>
                          <span className="text-lg font-bold text-primary">
                            {formatCurrency(newBudget.total_amount, language, true)}
                          </span>
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                          Año
                        </label>
                <input
                  type="number"
                  value={newBudget.year}
                  onChange={(e) => setNewBudget({ ...newBudget, year: parseInt(e.target.value) })}
                  required
                          className="sap-input"
                />
              </div>

                      <div className="flex gap-3 pt-4 border-t border-border">
                        <button
                          type="button"
                          onClick={() => {
                            if (globalCategories.includes(newBudget.category)) {
                              setNewBudget({ ...newBudget, step: 'account' })
                            } else {
                              setNewBudget({ ...newBudget, step: 'contributors' })
                            }
                          }}
                          className="sap-button-secondary"
                        >
                          ← Volver
                        </button>
                        <button
                          type="submit"
                          className="sap-button-primary flex-1"
                          disabled={newBudget.selected_members.length === 0 || newBudget.total_amount <= 0}
                        >
                          Crear Presupuesto
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Matriz Anual */}
      {showMatrixModal && matrixData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-[95vw] max-h-[90vh] overflow-auto w-full">
            <div className="sticky top-0 bg-white border-b border-notion-border p-4 flex justify-between items-center">
              <div>
                <h2 className="text-notion-2xl font-bold text-notion-text">
                  Presupuesto Anual {matrixData.year}
                </h2>
                <p className="text-notion-sm text-notion-textSecondary mt-1">
                  {matrixData.total_conceptos} conceptos
                </p>
              </div>
              <button
                onClick={() => setShowMatrixModal(false)}
                className="p-2 hover:bg-notion-bgTertiary rounded-notion transition-colors"
              >
                <XIcon size={20} className="text-notion-textSecondary" />
              </button>
            </div>

            <div className="p-4 overflow-x-auto">
              <table className="sap-table">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-sap-table-header z-10 min-w-[250px]">
                      Concepto
                    </th>
                    {matrixData.meses.map((mes) => (
                      <th key={mes} className="text-right min-w-[100px]">
                        {mes}
                      </th>
                    ))}
                    <th className="text-right bg-sap-table-header min-w-[120px]">
                      Total Anual
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrixData.matrix.map((row, idx) => {
                    const isTotal = row.concepto === 'TOTAL'
                    return (
                      <tr
                        key={idx}
                        className={isTotal ? 'bg-sap-table-header font-semibold' : ''}
                      >
                        <td
                          className={`sticky left-0 ${
                            isTotal ? 'bg-sap-table-header' : 'bg-white'
                          } z-10`}
                        >
                          {row.concepto}
                        </td>
                        {matrixData.meses.map((mes) => (
                          <td key={mes} className="text-right">
                            ${row.meses[mes].toLocaleString('es-MX', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        ))}
                        <td className="text-right font-semibold bg-sap-table-header">
                          {formatCurrency(row.total_anual, language, true).replace('$', '').replace(' MXN', '')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalles del Presupuesto */}
      {showBudgetDetailModal && selectedBudget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-border p-4 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Composición del Presupuesto
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedBudget.category} - {selectedBudget.subcategory} ({selectedBudget.year})
                </p>
              </div>
              <button
                onClick={() => {
                  setShowBudgetDetailModal(false)
                  setSelectedBudget(null)
                  setShowPasswordModal(false)
                  setAdminPassword('')
                }}
                className="p-2 hover:bg-sap-hover rounded transition-colors"
              >
                <XIcon size={20} className="text-muted-foreground" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Información general */}
              <div className="sap-card p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Monto Total Anual</div>
                    <div className="text-lg font-semibold text-primary">
                      {formatCurrency(selectedBudget.total_amount, language, true)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Monto Mensual</div>
                    <div className="text-lg font-semibold text-foreground">
                      {formatCurrency(selectedBudget.total_amount / 12, language, true)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Tipo</div>
                    <div className="text-sm font-medium text-foreground">
                      {selectedBudget.budget_type === 'shared' ? 'Compartido' : 'Individual'}
                      {selectedBudget.budget_type === 'individual' && selectedBudget.target_user && (
                        <span className="text-muted-foreground ml-2">
                          ({selectedBudget.target_user.name})
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Regla: <b>1 integrante</b> = Individual; <b>2+ integrantes</b> = Compartido. Algunas categorías son siempre globales (Compartidas).
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Método de Distribución</div>
                    <div className="text-sm font-medium text-foreground">
                      {selectedBudget.distribution_method === 'equal' ? 'Igual' : 
                       selectedBudget.distribution_method === 'percentage' ? 'Por Porcentaje' : 
                       'Manual'}
                    </div>
                  </div>
                </div>
              </div>

              {user?.is_family_admin && (
                <div className="sap-card p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Dividir / duplicar</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Útil para separar “Casa” vs “Personal” (ej. <b>Gasolina</b> de Casa y <b>Gasolina</b> de Mamá) sin mezclar.
                      </p>
                    </div>
                    <button type="button" onClick={startDuplicateFromSelectedBudget} className="sap-button-secondary">
                      Duplicar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    {(() => {
                      const cat = String((selectedBudget as any)?.category || '')
                      const isGlobal = !!cat && globalCategories.includes(cat)
                      return (
                        <>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1.5">Nuevo tipo</div>
                            <select
                              className="sap-input w-full"
                              value={isGlobal ? 'shared' : budgetDuplicateMode}
                              onChange={(e) => setBudgetDuplicateMode(e.target.value as any)}
                              disabled={isGlobal}
                            >
                              <option value="shared">Compartido (varios)</option>
                              <option value="individual">Individual (1 integrante)</option>
                            </select>
                            {isGlobal ? (
                              <div className="text-[11px] text-primary mt-1">
                                Categoría global: se duplica como <b>Compartido</b>.
                              </div>
                            ) : null}
                          </div>

                          <div>
                            <div className="text-xs text-muted-foreground mb-1.5">Persona (si es Individual)</div>
                            <select
                              className="sap-input w-full"
                              value={budgetDuplicatePersonId}
                              onChange={(e) => setBudgetDuplicatePersonId(e.target.value)}
                              disabled={isGlobal || budgetDuplicateMode !== 'individual'}
                            >
                              <option value="">Selecciona…</option>
                              {familyMembers.map((m) => (
                                <option key={m.id} value={String(m.id)}>
                                  {m.name || m.email}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      )
                    })()}
                  </div>

                  <div className="text-xs text-muted-foreground mt-3">
                    Se abrirá “Crear Presupuesto” con la misma cuenta y monto, para que ajustes integrantes si lo necesitas.
                  </div>
                </div>
              )}

              {/* Lista de integrantes que contribuyen */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Integrantes que Contribuyen
                </h3>
                {selectedBudget.user_allocations && selectedBudget.user_allocations.length > 0 ? (
                  <div className="space-y-2">
                    {selectedBudget.user_allocations.map((allocation) => {
                      const percentage = selectedBudget.total_amount > 0 
                        ? (allocation.allocated_amount / selectedBudget.total_amount) * 100 
                        : 0
                      return (
                        <div key={allocation.id} className="sap-card p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-foreground text-sm">
                                {allocation.user?.name || 'Usuario desconocido'}
                                {allocation.user?.id === user?.id && ' (Tú)'}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {allocation.user?.email || ''}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-foreground">
                                {formatCurrency(allocation.allocated_amount, language, true)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {percentage.toFixed(2)}%
                              </div>
                            </div>
                          </div>
                          {allocation.spent_amount > 0 && (
                            <div className="mt-2 pt-2 border-t border-border">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Gastado:</span>
                                <span className="text-sap-danger font-medium">
                                  ${allocation.spent_amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs mt-1">
                                <span className="text-muted-foreground">Disponible:</span>
                                <span className={`font-medium ${
(allocation.available_amount ?? 0) > 0 ? 'text-sap-success' : 'text-sap-danger'
                                }`}>
                                   ${(allocation.available_amount ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="sap-card p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No hay asignaciones de integrantes para este presupuesto
                    </p>
                  </div>
                )}
              </div>

              {/* Botón para modificar */}
              {user?.is_family_admin && (
                <div className="pt-4 border-t border-border">
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="sap-button-primary w-full"
                  >
                    Modificar Presupuesto
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Validación de Contraseña */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Verificación de Administrador
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Para modificar este presupuesto, ingresa tu contraseña de administrador
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handlePasswordVerification()
                    }
                  }}
                  className="sap-input w-full"
                  placeholder="Ingresa tu contraseña"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPasswordModal(false)
                    setAdminPassword('')
                  }}
                  className="sap-button-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePasswordVerification}
                  className="sap-button-primary flex-1"
                  disabled={!adminPassword}
                >
                  Verificar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición de Presupuesto */}
      {showEditModal && editingBudget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-border p-4 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Editar Presupuesto
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {editingBudget.category} - {editingBudget.subcategory} ({editingBudget.year})
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingBudget(null)
                }}
                className="p-2 hover:bg-sap-hover rounded transition-colors"
              >
                <XIcon size={20} className="text-muted-foreground" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                try {
                  const formData = new FormData(e.currentTarget)
                  const totalAmount = parseFloat(formData.get('total_amount') as string) || 0
                  const year = parseInt(formData.get('year') as string) || new Date().getFullYear()

                  if (totalAmount <= 0) {
                    alert('El monto debe ser mayor a cero')
                    return
                  }

                  // Calcular montos mensuales (por ahora, dividir igual entre 12 meses)
                  const monthlyAmounts: Record<string, number> = {}
                  const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
                  const monthlyAmount = totalAmount / 12
                  months.forEach(month => {
                    monthlyAmounts[month] = monthlyAmount
                  })

                  const updateData = {
                    category: editingBudget.category,
                    subcategory: editingBudget.subcategory,
                    year: year,
                    total_amount: totalAmount,
                    monthly_amounts: monthlyAmounts,
                    budget_type: editingBudget.budget_type,
                    distribution_method: editingBudget.distribution_method,
                    auto_distribute: editingBudget.auto_distribute || false,
                    target_user_id: editingBudget.target_user_id
                  }

                  const { error: updateError } = await supabase
                    .from('family_budgets')
                    .update(updateData)
                    .eq('id', editingBudget.id)
                  
                  if (updateError) throw updateError
                  
                  setShowEditModal(false)
                  setEditingBudget(null)
                  loadBudgets()
                  alert('Presupuesto actualizado correctamente')
                } catch (error: any) {
                  console.error('Error actualizando presupuesto:', error)
                  alert(error.response?.data?.detail || 'Error al actualizar presupuesto')
                }
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Monto Total Anual
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-muted-foreground">$</span>
                <input
                  type="number"
                      name="total_amount"
                  step="0.01"
                      defaultValue={editingBudget.total_amount}
                  required
                      className="sap-input text-lg font-semibold flex-1"
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Año
                  </label>
                  <input
                    type="number"
                    name="year"
                    defaultValue={editingBudget.year}
                    required
                    className="sap-input"
                    min={new Date().getFullYear() - 1}
                    max={new Date().getFullYear() + 1}
                  />
                </div>
              </div>

              <div className="sap-card p-4 bg-primary/5 border border-sap-primary/20">
                <div className="text-xs text-muted-foreground mb-2">
                  Información del Presupuesto
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Categoría:</span>
                    <span className="ml-2 font-medium text-foreground">{editingBudget.category}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Subcategoría:</span>
                    <span className="ml-2 font-medium text-foreground">{editingBudget.subcategory}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className="ml-2 font-medium text-foreground">
                      {editingBudget.budget_type === 'shared' ? 'Compartido' : 'Individual'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Método:</span>
                    <span className="ml-2 font-medium text-foreground">
                      {editingBudget.distribution_method === 'equal' ? 'Igual' : 
                       editingBudget.distribution_method === 'percentage' ? 'Por Porcentaje' : 
                       'Manual'}
                    </span>
                  </div>
                </div>
              </div>

              {editingBudget.user_allocations && editingBudget.user_allocations.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-foreground mb-2">
                    Asignaciones Actuales
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {editingBudget.user_allocations.map((allocation) => {
                      const percentage = editingBudget.total_amount > 0 
                        ? (allocation.allocated_amount / editingBudget.total_amount) * 100 
                        : 0
                      return (
                        <div key={allocation.id} className="sap-card p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-foreground text-sm">
                                {allocation.user?.name || 'Usuario desconocido'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-foreground">
                                {formatCurrency(allocation.allocated_amount, language, true)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {percentage.toFixed(2)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Nota: Las asignaciones individuales no se modifican automáticamente. 
                    Puedes redistribuir el presupuesto después de actualizar el monto total.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingBudget(null)
                  }}
                  className="sap-button-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="sap-button-primary flex-1"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loadingMatrix && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 border border-border">
            <div className="text-foreground">Cargando matriz...</div>
    </div>
        </div>
      )}

      {/* Modal para crear categoría rápida */}
      {showCreateCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                {language === 'es' ? 'Crear Nueva Categoría' : 'Create New Category'}
              </h3>
              <button
                onClick={() => setShowCreateCategoryModal(false)}
                className="sap-button-ghost p-2"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  {language === 'es' ? 'Nombre *' : 'Name *'}
                </label>
                <input
                  type="text"
                  id="newCategoryName"
                  className="sap-input w-full"
                  placeholder={language === 'es' ? 'Ej: Mascotas, Hobbies' : 'E.g: Pets, Hobbies'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  {language === 'es' ? 'Subcategoría (opcional)' : 'Subcategory (optional)'}
                </label>
                <input
                  type="text"
                  id="newSubcategoryName"
                  className="sap-input w-full"
                  placeholder={language === 'es' ? 'Nombre de la primera subcategoría' : 'First subcategory name'}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={async () => {
                    const nameInput = document.getElementById('newCategoryName') as HTMLInputElement
                    const subcatInput = document.getElementById('newSubcategoryName') as HTMLInputElement
                    
                    if (!nameInput?.value.trim()) {
                      alert(language === 'es' ? 'El nombre es requerido' : 'Name is required')
                      return
                    }

                    try {
                      const categoryData: any = {
                        name: nameInput.value.trim(),
                        description: '',
                        color: '#0070f2'
                      }

                      if (subcatInput?.value.trim()) {
                        categoryData.subcategories = [{
                          name: subcatInput.value.trim(),
                          description: ''
                        }]
                      }

                      const { data: { user: authUser } } = await supabase.auth.getUser()
                      if (!authUser) return
                      
                      const { data: userData } = await supabase
                        .from('users')
                        .select('family_id')
                        .eq('id', authUser.id)
                        .single()
                      
                      if (!userData?.family_id) return
                      
                      const { error: categoryError } = await supabase
                        .from('custom_categories')
                        .insert({
                          ...categoryData,
                          family_id: userData.family_id
                        })
                      
                      if (categoryError) throw categoryError
                      await loadCustomCategories()
                      setShowCreateCategoryModal(false)
                      
                      // Seleccionar la nueva categoría
                      setNewBudget({
                        ...newBudget,
                        category: nameInput.value.trim(),
                        subcategory: subcatInput?.value.trim() || ''
                      })
                      
                      alert(language === 'es' ? 'Categoría creada exitosamente' : 'Category created successfully')
                    } catch (error: any) {
                      console.error('Error creando categoría:', error)
                      alert(error.response?.data?.detail || (language === 'es' ? 'Error al crear categoría' : 'Error creating category'))
                    }
                  }}
                  className="sap-button-primary flex-1"
                >
                  {language === 'es' ? 'Crear y Usar' : 'Create and Use'}
                </button>
                <button
                  onClick={() => setShowCreateCategoryModal(false)}
                  className="sap-button-secondary flex-1"
                >
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
