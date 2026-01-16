/**
 * API helper usando Supabase
 * Esta es la nueva implementación que reemplaza api.ts
 */

import { supabase } from './supabase/client'

// Helper para manejar errores de Supabase
function handleSupabaseError(error: any) {
  if (error?.code === 'PGRST116') {
    // No encontrado
    return { status: 404, detail: 'Recurso no encontrado' }
  }
  if (error?.code === '23505') {
    // Violación de constraint único
    return { status: 400, detail: 'El recurso ya existe' }
  }
  return { status: 500, detail: error?.message || 'Error desconocido' }
}

// API para usuarios
export const usersApi = {
  async getMe() {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      throw { response: { status: 401, data: { detail: 'No autenticado' } } }
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (error) {
      throw { response: handleSupabaseError(error) }
    }

    return { data }
  },

  async getUser(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      throw { response: handleSupabaseError(error) }
    }

    return { data }
  },
}

// API para familias
export const familiesApi = {
  async getFamily(familyId: number) {
    const { data, error } = await supabase
      .from('families')
      .select(`
        *,
        members:users(*)
      `)
      .eq('id', familyId)
      .single()

    if (error) {
      throw { response: handleSupabaseError(error) }
    }

    return { data }
  },

  async createFamily(name: string) {
    // Obtener usuario actual
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      throw { response: { status: 401, data: { detail: 'No autenticado' } } }
    }

    const { data, error } = await supabase
      .from('families')
      .insert({
        name,
        admin_id: authUser.id,
      })
      .select()
      .single()

    if (error) {
      throw { response: handleSupabaseError(error) }
    }

    return { data }
  },
}

// API para presupuestos
export const budgetsApi = {
  async getUserBudgets() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      throw { response: { status: 401, data: { detail: 'No autenticado' } } }
    }

    // Obtener presupuestos del usuario
    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single()

    if (!userData?.family_id) {
      return { data: [] }
    }

    const { data, error } = await supabase
      .from('family_budgets')
      .select(`
        *,
        user_allocations:user_budgets(*)
      `)
      .eq('family_id', userData.family_id)

    if (error) {
      throw { response: handleSupabaseError(error) }
    }

    return { data: data || [] }
  },

  async getFamilyBudgets(familyId: number) {
    const { data, error } = await supabase
      .from('family_budgets')
      .select(`
        *,
        user_allocations:user_budgets(*)
      `)
      .eq('family_id', familyId)

    if (error) {
      throw { response: handleSupabaseError(error) }
    }

    return { data: data || [] }
  },
}

// API para transacciones
export const transactionsApi = {
  async getTransactions(filters?: {
    skip?: number
    limit?: number
    status?: string
  }) {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      throw { response: { status: 401, data: { detail: 'No autenticado' } } }
    }

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', authUser.id)
      .order('date', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.skip) {
      query = query.range(filters.skip, filters.skip + (filters.limit || 100) - 1)
    }

    const { data, error } = await query

    if (error) {
      throw { response: handleSupabaseError(error) }
    }

    return { data: data || [] }
  },

  async createTransaction(transaction: any) {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      throw { response: { status: 401, data: { detail: 'No autenticado' } } }
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        ...transaction,
        user_id: authUser.id,
      })
      .select()
      .single()

    if (error) {
      throw { response: handleSupabaseError(error) }
    }

    return { data }
  },
}

// API para recibos
export const receiptsApi = {
  async getReceipts(filters?: {
    skip?: number
    limit?: number
    status?: string
  }) {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      throw { response: { status: 401, data: { detail: 'No autenticado' } } }
    }

    let query = supabase
      .from('receipts')
      .select(`
        *,
        items:receipt_items(*)
      `)
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.skip) {
      query = query.range(filters.skip, filters.skip + (filters.limit || 100) - 1)
    }

    const { data, error } = await query

    if (error) {
      throw { response: handleSupabaseError(error) }
    }

    return { data: data || [] }
  },
}

// Exportar un objeto similar a axios para compatibilidad
export default {
  get: async (url: string) => {
    // Implementar según la URL
    if (url === '/api/users/me') {
      return usersApi.getMe()
    }
    throw new Error(`GET ${url} no implementado`)
  },
  post: async (url: string, data?: any) => {
    // Implementar según la URL
    throw new Error(`POST ${url} no implementado`)
  },
}
