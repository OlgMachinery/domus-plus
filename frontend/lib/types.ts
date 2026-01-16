// Tipos compartidos para la aplicación

export interface User {
  id: number
  email: string
  phone: string
  name: string
  is_active: boolean
  is_family_admin: boolean
  family_id: number | null
  created_at: string
}

export interface FamilyBudget {
  id: number
  family_id: number
  category: string
  subcategory: string
  year: number
  total_amount: number
  budget_type: 'shared' | 'individual'  // Tipo de presupuesto
  distribution_method: 'equal' | 'percentage' | 'manual'  // Método de distribución
  auto_distribute: boolean  // Si se distribuye automáticamente
  target_user_id?: number | null  // Para presupuestos individuales
  created_at: string
  user_allocations?: UserBudget[]
  target_user?: User | null  // Usuario objetivo para presupuestos individuales
}

export interface UserBudget {
  id: number
  user_id: number
  family_budget_id: number
  allocated_amount: number
  spent_amount: number
  income_amount: number  // Ingresos adicionales asignados a este presupuesto
  available_amount: number  // Calculado: allocated + income - spent
  created_at: string
  user?: User
  family_budget?: FamilyBudget
}

export interface Transaction {
  id: number
  user_id: number
  family_budget_id: number | null
  date: string
  amount: number
  currency: string
  transaction_type: 'income' | 'expense'
  merchant_or_beneficiary: string | null
  category: string
  subcategory: string
  concept: string | null
  reference: string | null
  operation_id: string | null
  tracking_key: string | null
  notes: string | null
  status: string
  receipt_image_url: string | null
  whatsapp_message_id: string | null
  created_at: string
  user?: User
}

export interface Family {
  id: number
  name: string
  admin_id: number
  created_at: string
  members?: User[]
}

export interface AnnualBudgetMatrix {
  year: number
  meses: string[]
  matrix: BudgetMatrixRow[]
  total_conceptos: number
}

export interface BudgetMatrixRow {
  concepto: string
  categoria: string
  subcategoria: string
  meses: { [mes: string]: number }
  total_anual: number
}

export interface GlobalBudgetSummary {
  year: number
  summary: Array<{
    category: string
    subcategory: string
    shared_amount: number
    individual_amounts: { [userId: number]: { amount: number; name: string } }
    individual_total: number
    total_amount: number
  }>
  totals: {
    shared: number
    individual: number
    global: number
  }
}
