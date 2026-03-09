import * as SecureStore from 'expo-secure-store'
import {
  AllocationsResponse,
  CategoriesResponse,
  EntitiesResponse,
  FamilyActiveResponse,
  LoginResponse,
  MembersResponse,
  MoneyRequestsResponse,
} from './types'

const BASE_URL = 'https://domus-fam.com'
const TOKEN_KEY = 'domus_token'

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await jsonOrThrow<LoginResponse>(res)
  if (!data.token) throw new Error('No se recibió token')
  await SecureStore.setItemAsync(TOKEN_KEY, data.token)
  return data.token
}

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

export async function logout() {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}

async function authFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return jsonOrThrow<T>(res)
}

export async function fetchFamily(token: string) {
  return authFetch<FamilyActiveResponse>('/api/families/active', token)
}

export async function fetchMembers(token: string) {
  return authFetch<MembersResponse>('/api/families/members', token)
}

export async function fetchEntities(token: string) {
  return authFetch<EntitiesResponse>('/api/budget/entities', token)
}

export async function fetchAllocations(token: string) {
  return authFetch<AllocationsResponse>('/api/budget/allocations', token)
}

export async function fetchCategories(token: string) {
  return authFetch<CategoriesResponse>('/api/budget/categories', token)
}

export async function fetchMoneyRequests(token: string) {
  return authFetch<MoneyRequestsResponse>('/api/money-requests', token)
}
