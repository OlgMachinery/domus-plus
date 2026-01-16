'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'

interface FamilyBudget {
  id: number
  category: string
  subcategory: string
  year: number
  total_amount: number
  user_allocations: UserBudget[]
}

interface UserBudget {
  id: number
  user_id: number
  allocated_amount: number
  spent_amount: number
  user: {
    name: string
    email: string
  }
}

export default function BudgetsPage() {
  const router = useRouter()
  const [budgets, setBudgets] = useState<FamilyBudget[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newBudget, setNewBudget] = useState({
    category: '',
    subcategory: '',
    year: new Date().getFullYear(),
    total_amount: 0
  })

  useEffect(() => {
    loadBudgets()
  }, [])

  const loadBudgets = async () => {
    try {
      const response = await api.get('/api/budgets/family')
      setBudgets(response.data)
    } catch (error) {
      console.error('Error cargando presupuestos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/api/budgets/family', newBudget)
      setShowCreateModal(false)
      setNewBudget({ category: '', subcategory: '', year: new Date().getFullYear(), total_amount: 0 })
      loadBudgets()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Error al crear presupuesto')
    }
  }

  const categories = [
    'Servicios Basicos', 'Mercado', 'Vivienda', 'Transporte',
    'Impuestos', 'Educacion', 'Salud', 'Vida Social'
  ]

  const subcategories: Record<string, string[]> = {
    'Servicios Basicos': ['Electricidad CFE', 'Agua Potable', 'Gas LP', 'Internet', 'Entretenimiento', 'Garrafones Agua', 'Telcel'],
    'Mercado': ['Mercado General'],
    'Vivienda': ['Cuotas Olinala', 'Seguro Vivienda', 'Mejoras y Remodelaciones'],
    'Transporte': ['Gasolina', 'Mantenimiento coches', 'Seguros y Derechos', 'Lavado'],
    'Impuestos': ['Predial'],
    'Educacion': ['Colegiaturas'],
    'Salud': ['Consulta', 'Medicamentos', 'Seguro Medico', 'Prevencion'],
    'Vida Social': ['Salidas Personales', 'Salidas Familiares', 'Cumpleanos', 'Aniversarios', 'Regalos Navidad']
  }

  if (loading) {
    return <div className="p-8">Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/dashboard" className="text-2xl font-bold text-primary-600">
              DOMUS<span className="text-primary-800">+</span>
            </Link>
            <div className="flex gap-4">
              <Link href="/dashboard" className="text-gray-700 hover:text-primary-600">Dashboard</Link>
              <Link href="/budgets" className="text-primary-600 font-semibold">Presupuestos</Link>
              <Link href="/transactions" className="text-gray-700 hover:text-primary-600">Transacciones</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Presupuestos Familiares</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
          >
            + Nuevo Presupuesto
          </button>
        </div>

        <div className="grid gap-6">
          {budgets.map((budget) => {
            const totalAllocated = budget.user_allocations.reduce((sum, alloc) => sum + alloc.allocated_amount, 0)
            const totalSpent = budget.user_allocations.reduce((sum, alloc) => sum + alloc.spent_amount, 0)
            const available = budget.total_amount - totalAllocated

            return (
              <div key={budget.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">{budget.category}</h3>
                    <p className="text-gray-600">{budget.subcategory} - {budget.year}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-600">${budget.total_amount.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">Total</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Asignado</p>
                    <p className="text-lg font-semibold">${totalAllocated.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Gastado</p>
                    <p className="text-lg font-semibold text-red-600">${totalSpent.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Disponible</p>
                    <p className="text-lg font-semibold text-green-600">${available.toLocaleString()}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Asignaciones por Usuario:</h4>
                  {budget.user_allocations.length > 0 ? (
                    <div className="space-y-2">
                      {budget.user_allocations.map((alloc) => (
                        <div key={alloc.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span>{alloc.user.name}</span>
                          <div className="flex gap-4">
                            <span className="text-sm">Asignado: ${alloc.allocated_amount.toLocaleString()}</span>
                            <span className="text-sm text-red-600">Gastado: ${alloc.spent_amount.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No hay asignaciones aún</p>
                  )}
                </div>
              </div>
            )
          })}

          {budgets.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 mb-4">No hay presupuestos creados aún</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
              >
                Crear Primer Presupuesto
              </button>
            </div>
          )}
        </div>
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Nuevo Presupuesto Familiar</h3>
            <form onSubmit={handleCreateBudget} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  value={newBudget.category}
                  onChange={(e) => {
                    setNewBudget({ ...newBudget, category: e.target.value, subcategory: '' })
                  }}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Selecciona una categoría</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {newBudget.category && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subcategoría</label>
                  <select
                    value={newBudget.subcategory}
                    onChange={(e) => setNewBudget({ ...newBudget, subcategory: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Selecciona una subcategoría</option>
                    {subcategories[newBudget.category]?.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                <input
                  type="number"
                  value={newBudget.year}
                  onChange={(e) => setNewBudget({ ...newBudget, year: parseInt(e.target.value) })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto Total</label>
                <input
                  type="number"
                  step="0.01"
                  value={newBudget.total_amount}
                  onChange={(e) => setNewBudget({ ...newBudget, total_amount: parseFloat(e.target.value) })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700"
                >
                  Crear
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

