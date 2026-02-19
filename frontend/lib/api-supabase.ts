/**
 * API helper using Supabase
 * Provides typed functions for all API operations
 */

import { supabase } from './supabase/client'
import type {
  User,
  Family,
  FamilyBudget,
  Transaction,
  Receipt,
  CreateFamilyBudgetRequest,
  CreateTransactionRequest,
  ReceiptAssignRequest,
} from './types'

function handleError(error: unknown): never {
  const err = error as { code?: string; message?: string }
  if (err?.code === 'PGRST116') {
    throw { status: 404, message: 'Resource not found' }
  }
  if (err?.code === '23505') {
    throw { status: 400, message: 'Resource already exists' }
  }
  throw { status: 500, message: err?.message || 'Unknown error' }
}

export const usersApi = {
  async getMe(): Promise<User> {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) throw { status: 401, message: 'Unauthorized' }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (error) handleError(error)
    return data as User
  },

  async updateMe(updates: Partial<Pick<User, 'name' | 'phone'>>): Promise<User> {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) throw { status: 401, message: 'Unauthorized' }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', authUser.id)
      .select()
      .single()

    if (error) handleError(error)
    return data as User
  },
}

export const familiesApi = {
  async getFamily(familyId: number): Promise<Family> {
    const { data, error } = await supabase
      .from('families')
      .select('*, members:users(*)')
      .eq('id', familyId)
      .single()

    if (error) handleError(error)
    return data as Family
  },

  async createFamily(name: string): Promise<Family> {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) throw { status: 401, message: 'Unauthorized' }

    const { data, error } = await supabase
      .from('families')
      .insert({ name, admin_id: authUser.id })
      .select()
      .single()

    if (error) handleError(error)
    return data as Family
  },
}

export const budgetsApi = {
  async getBudgets(year?: number): Promise<FamilyBudget[]> {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) throw { status: 401, message: 'Unauthorized' }

    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single()

    if (!userData?.family_id) return []

    let query = supabase
      .from('family_budgets')
      .select(`
        *,
        user_allocations:user_budgets(*, user:users(id, name, email)),
        target_user:users!family_budgets_target_user_id_fkey(id, name, email)
      `)
      .eq('family_id', userData.family_id)

    if (year) query = query.eq('year', year)

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) handleError(error)
    return (data || []) as FamilyBudget[]
  },

  async createBudget(budget: CreateFamilyBudgetRequest): Promise<FamilyBudget> {
    const response = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(budget),
    })
    if (!response.ok) {
      const err = await response.json()
      throw { status: response.status, message: err.error }
    }
    return response.json()
  },

  async updateBudget(id: number, updates: Partial<CreateFamilyBudgetRequest>): Promise<FamilyBudget> {
    const response = await fetch(`/api/budgets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!response.ok) {
      const err = await response.json()
      throw { status: response.status, message: err.error }
    }
    return response.json()
  },

  async deleteBudget(id: number): Promise<void> {
    const response = await fetch(`/api/budgets/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const err = await response.json()
      throw { status: response.status, message: err.error }
    }
  },

  async getSummary(year?: number) {
    const params = year ? `?year=${year}` : ''
    const response = await fetch(`/api/budgets/summary${params}`)
    if (!response.ok) {
      const err = await response.json()
      throw { status: response.status, message: err.error }
    }
    return response.json()
  },
}

export const transactionsApi = {
  async getTransactions(filters?: {
    limit?: number
    offset?: number
    category?: string
    transaction_type?: string
    start_date?: string
    end_date?: string
  }): Promise<Transaction[]> {
    const params = new URLSearchParams()
    if (filters?.limit) params.set('limit', filters.limit.toString())
    if (filters?.offset) params.set('offset', filters.offset.toString())
    if (filters?.category) params.set('category', filters.category)
    if (filters?.transaction_type) params.set('transaction_type', filters.transaction_type)
    if (filters?.start_date) params.set('start_date', filters.start_date)
    if (filters?.end_date) params.set('end_date', filters.end_date)

    const response = await fetch(`/api/transactions?${params}`)
    if (!response.ok) {
      const err = await response.json()
      throw { status: response.status, message: err.error }
    }
    return response.json()
  },

  async createTransaction(transaction: CreateTransactionRequest): Promise<Transaction> {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    })
    if (!response.ok) {
      const err = await response.json()
      throw { status: response.status, message: err.error }
    }
    return response.json()
  },

  async updateTransaction(id: number, updates: Partial<CreateTransactionRequest>): Promise<Transaction> {
    const response = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!response.ok) {
      const err = await response.json()
      throw { status: response.status, message: err.error }
    }
    return response.json()
  },

  async deleteTransaction(id: number): Promise<void> {
    const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const err = await response.json()
      throw { status: response.status, message: err.error }
    }
  },
}

export const receiptsApi = {
  async getReceipts(filters?: {
    limit?: number
    offset?: number
    status?: string
  }): Promise<Receipt[]> {
    const params = new URLSearchParams()
    if (filters?.limit) params.set('limit', filters.limit.toString())
    if (filters?.offset) params.set('offset', filters.offset.toString())
    if (filters?.status) params.set('status', filters.status)

    const response = await fetch(`/api/receipts?${params}`)
    if (!response.ok) {
      const err = await response.json()
      throw { status: response.status, message: err.error }
    }
    return response.json()
  },

  async processReceipt(files: File[], targetUserId?: string) {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    if (targetUserId) formData.append('target_user_id', targetUserId)

    const response = await fetch('/api/receipts/process', {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      const err = await response.json()
      throw { status: response.status, message: err.detail || err.error }
    }
    return response.json()
  },

  async assignReceipt(receiptId: number, data: ReceiptAssignRequest) {
    const response = await fetch(`/api/receipts/${receiptId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const err = await response.json()
      throw { status: response.status, message: err.error }
    }
    return response.json()
  },

  async deleteReceipt(id: number): Promise<void> {
    const response = await fetch(`/api/receipts/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const err = await response.json()
      throw { status: response.status, message: err.error }
    }
  },
}
