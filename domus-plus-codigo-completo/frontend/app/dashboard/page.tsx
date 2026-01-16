'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [budgets, setBudgets] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    loadData()
  }, [router])

  const loadData = async () => {
    try {
      const [userRes, budgetsRes, transactionsRes] = await Promise.all([
        api.get('/api/users/me'),
        api.get('/api/budgets/user'),
        api.get('/api/transactions/')
      ])
      setUser(userRes.data)
      setBudgets(budgetsRes.data)
      setTransactions(transactionsRes.data.slice(0, 10)) // Últimas 10
    } catch (error) {
      console.error('Error cargando datos:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  const totalAllocated = budgets.reduce((sum, b) => sum + b.allocated_amount, 0)
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent_amount, 0)
  const totalAvailable = totalAllocated - totalSpent

  if (loading) {
    return <div className="p-8">Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-primary-600">
              DOMUS<span className="text-primary-800">+</span>
            </h1>
            <div className="flex gap-4">
              <Link href="/dashboard" className="text-gray-700 hover:text-primary-600">
                Dashboard
              </Link>
              <Link href="/budgets" className="text-gray-700 hover:text-primary-600">
                Presupuestos
              </Link>
              <Link href="/transactions" className="text-gray-700 hover:text-primary-600">
                Transacciones
              </Link>
              <button onClick={handleLogout} className="text-gray-700 hover:text-primary-600">
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6">Dashboard</h2>
        
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Presupuesto Total</h3>
            <p className="text-3xl font-bold text-primary-600">${totalAllocated.toLocaleString()}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Gastado</h3>
            <p className="text-3xl font-bold text-red-600">${totalSpent.toLocaleString()}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Disponible</h3>
            <p className="text-3xl font-bold text-green-600">${totalAvailable.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-4">Mis Presupuestos</h3>
            {budgets.length > 0 ? (
              <div className="space-y-3">
                {budgets.map((budget) => {
                  const remaining = budget.allocated_amount - budget.spent_amount
                  const percentage = (budget.spent_amount / budget.allocated_amount) * 100
                  return (
                    <div key={budget.id} className="border-l-4 border-primary-500 pl-4">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <p className="font-semibold">{budget.family_budget?.category || 'N/A'}</p>
                          <p className="text-sm text-gray-600">{budget.family_budget?.subcategory || 'N/A'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${budget.spent_amount.toLocaleString()} / ${budget.allocated_amount.toLocaleString()}</p>
                          <p className="text-sm text-gray-600">Disponible: ${remaining.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          className={`h-2 rounded-full ${percentage > 80 ? 'bg-red-500' : percentage > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-500">No tienes presupuestos asignados</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-4">Transacciones Recientes</h3>
            {transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">{transaction.concept || transaction.merchant_or_beneficiary || 'N/A'}</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(transaction.date), 'dd/MM/yyyy', { locale: es })} - {transaction.category}
                      </p>
                    </div>
                    <p className="font-semibold text-red-600">${transaction.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No hay transacciones aún</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

