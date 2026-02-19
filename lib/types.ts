// Types for DOMUS+ application

export type TransactionStatus = 'pending' | 'processed' | 'rejected'
export type TransactionType = 'income' | 'expense'
export type BudgetType = 'shared' | 'individual'
export type DistributionMethod = 'equal' | 'percentage' | 'manual'

export interface User {
  id: string // UUID from Supabase Auth
  email: string
  phone: string
  name: string
  is_active: boolean
  is_family_admin: boolean
  family_id: number | null
  created_at: string
  updated_at?: string
}

export interface Family {
  id: number
  name: string
  admin_id: string // UUID
  created_at: string
  updated_at?: string
  members?: User[]
}

export interface CustomCategory {
  id: number
  family_id: number
  name: string
  description?: string
  icon?: string
  color?: string
  is_active: boolean
  created_at: string
  updated_at?: string
  subcategories?: CustomSubcategory[]
}

export interface CustomSubcategory {
  id: number
  custom_category_id: number
  name: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface FamilyBudget {
  id: number
  family_id: number
  category?: string
  subcategory?: string
  custom_category_id?: number
  custom_subcategory_id?: number
  year: number
  total_amount: number
  monthly_amounts?: Record<string, number>
  display_names?: Record<string, string>
  due_date?: string
  payment_status?: string
  notes?: string
  budget_type: BudgetType
  distribution_method: DistributionMethod
  auto_distribute: boolean
  target_user_id?: string | null // UUID
  created_at: string
  updated_at?: string
  user_allocations?: UserBudget[]
  target_user?: User | null
  custom_category?: CustomCategory
  custom_subcategory?: CustomSubcategory
}

export interface UserBudget {
  id: number
  user_id: string // UUID
  family_budget_id: number
  allocated_amount: number
  spent_amount: number
  income_amount?: number
  available_amount?: number // Calculated: allocated + income - spent
  created_at: string
  updated_at?: string
  user?: User
  family_budget?: FamilyBudget
}

export interface Transaction {
  id: number
  user_id: string // UUID
  family_budget_id?: number | null
  date: string
  amount: number
  transaction_type: TransactionType
  currency: string
  merchant_or_beneficiary?: string
  category?: string
  subcategory?: string
  custom_category_id?: number
  custom_subcategory_id?: number
  concept?: string
  reference?: string
  operation_id?: string
  tracking_key?: string
  status: TransactionStatus
  notes?: string
  receipt_image_url?: string
  whatsapp_message_id?: string
  whatsapp_phone?: string
  created_at: string
  updated_at?: string
  user?: User
}

export interface Receipt {
  id: number
  user_id: string // UUID
  image_url?: string
  whatsapp_message_id?: string
  whatsapp_phone?: string
  date?: string
  time?: string
  amount: number
  currency: string
  merchant_or_beneficiary?: string
  category?: string
  subcategory?: string
  concept?: string
  reference?: string
  operation_id?: string
  tracking_key?: string
  notes?: string
  status: string
  assigned_transaction_id?: number
  created_at: string
  updated_at?: string
  items?: ReceiptItem[]
  user?: User
}

export interface ReceiptItem {
  id: number
  receipt_id: number
  description: string
  amount: number
  quantity?: number
  unit_price?: number
  unit_of_measure?: string
  category?: string
  subcategory?: string
  assigned_transaction_id?: number
  notes?: string
  created_at: string
}

export interface ActivityLog {
  id: number
  user_id?: string // UUID
  action_type: string
  entity_type: string
  entity_id?: number
  description: string
  details?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  created_at: string
  user?: User
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
  meses: Record<string, number>
  total_anual: number
}

export interface GlobalBudgetSummary {
  year: number
  summary: Array<{
    category: string
    subcategory: string
    shared_amount: number
    individual_amounts: Record<string, { amount: number; name: string }>
    individual_total: number
    total_amount: number
  }>
  totals: {
    shared: number
    individual: number
    global: number
  }
}

// API Request/Response types
export interface CreateFamilyBudgetRequest {
  category?: string
  subcategory?: string
  custom_category_id?: number
  custom_subcategory_id?: number
  year: number
  total_amount: number
  monthly_amounts?: Record<string, number>
  budget_type?: BudgetType
  distribution_method?: DistributionMethod
  auto_distribute?: boolean
  target_user_id?: string
}

export interface CreateTransactionRequest {
  date: string
  amount: number
  transaction_type: TransactionType
  currency?: string
  merchant_or_beneficiary?: string
  category?: string
  subcategory?: string
  concept?: string
  reference?: string
  operation_id?: string
  tracking_key?: string
  notes?: string
  family_budget_id?: number
}

export interface ReceiptAssignRequest {
  family_budget_id: number
  transaction_id?: number
  target_user_id?: string
  percentage?: number
  assign_to_all?: boolean
  items?: Array<{ item_id: number; transaction_id: number }>
}
