'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Transaction {
  id: number
  date: string
  amount: number
  currency: string
  category: string
  subcategory: string
  concept: string | null
  merchant_or_beneficiary: string | null
  status: string
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadTransactions()
  }, [])

  const loadTransactions = async () => {
    try {
      const response = await api.get('/api/transactions/')
      setTransactions(response.data)
    } catch (error) {
      console.error('Error cargando transacciones:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      await api.post('/api/receipts/process', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      setShowUploadModal(false)
      loadTransactions()
      alert('Recibo procesado exitosamente')
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Error al procesar recibo')
    } finally {
      setUploading(false)
    }
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
              <Link href="/budgets" className="text-gray-700 hover:text-primary-600">Presupuestos</Link>
              <Link href="/transactions" className="text-primary-600 font-semibold">Transacciones</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Transacciones</h2>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
          >
            + Subir Recibo
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Concepto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoría
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(transaction.date), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {transaction.concept || transaction.merchant_or_beneficiary || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div>
                      <div className="font-medium">{transaction.category}</div>
                      <div className="text-xs">{transaction.subcategory}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">
                    ${transaction.amount.toLocaleString()} {transaction.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      transaction.status === 'processed' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {transaction.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {transactions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No hay transacciones registradas</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
              >
                Subir Primer Recibo
              </button>
            </div>
          )}
        </div>
      </main>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Subir Recibo</h3>
            <p className="text-gray-600 mb-4 text-sm">
              Sube una foto de tu recibo o transferencia. El sistema lo procesará automáticamente.
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="w-full mb-4"
            />
            {uploading && (
              <p className="text-primary-600">Procesando recibo...</p>
            )}
            <button
              onClick={() => setShowUploadModal(false)}
              className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

