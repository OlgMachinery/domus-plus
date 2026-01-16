'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { DashboardIcon, BudgetIcon, TransactionIcon, XIcon } from '@/lib/icons'
import Logo from '@/components/Logo'

interface SheetData {
  name: string
  rows: number
  columns: number
  column_names: string[]
  data: any[]
  dtypes?: Record<string, string>
  statistics?: Record<string, any>
  error?: string
}

interface ExcelData {
  filename: string
  sheets: SheetData[]
  total_sheets: number
}

export default function ExcelPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [excelData, setExcelData] = useState<ExcelData | null>(null)
  const [error, setError] = useState<string>('')
  const [selectedSheet, setSelectedSheet] = useState<string>('')

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const validExtensions = ['.xlsx', '.xlsm', '.xls']
      const fileExt = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'))
      
      if (!validExtensions.includes(fileExt)) {
        setError('Por favor, selecciona un archivo Excel (.xlsx, .xlsm, .xls)')
        setFile(null)
        return
      }
      
      setFile(selectedFile)
      setError('')
      setExcelData(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Por favor, selecciona un archivo')
      return
    }

    setLoading(true)
    setError('')
    setExcelData(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      // TODO: Implementar lectura de Excel con Supabase
      alert('Funcionalidad de lectura de Excel en desarrollo.')
      setLoading(false)
    } catch (err: any) {
      console.error('Error al leer Excel:', err)
      const errorMsg = err.message || 'Error al leer el archivo Excel'
      setError(errorMsg)
      setLoading(false)
    }
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'number') {
      return value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    return String(value)
  }

  const currentSheet = excelData?.sheets.find(s => s.name === selectedSheet)

  return (
    <div className="min-h-screen bg-notion-bgSecondary">
      {/* Header */}
      <header className="bg-white border-b border-notion-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Logo />
              <h1 className="text-2xl font-bold text-notion-text">DOMUS+</h1>
            </div>
            <nav className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-notion-textSecondary hover:text-notion-text flex items-center space-x-1">
                <DashboardIcon className="w-5 h-5" />
                <span>Dashboard</span>
              </Link>
              <Link href="/budgets" className="text-notion-textSecondary hover:text-notion-text flex items-center space-x-1">
                <BudgetIcon className="w-5 h-5" />
                <span>Presupuestos</span>
              </Link>
              <Link href="/transactions" className="text-notion-textSecondary hover:text-notion-text flex items-center space-x-1">
                <TransactionIcon className="w-5 h-5" />
                <span>Transacciones</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-notion-border p-6">
          <h2 className="text-2xl font-bold text-notion-text mb-6">Leer Archivo Excel</h2>

          {/* File Upload Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-notion-text mb-2">
              Selecciona un archivo Excel (.xlsx, .xlsm, .xls)
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="file"
                accept=".xlsx,.xlsm,.xls"
                onChange={handleFileSelect}
                className="block w-full text-sm text-notion-textSecondary
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-notion-bgTertiary file:text-notion-text
                  hover:file:bg-notion-bgHover
                  cursor-pointer"
                disabled={loading}
              />
              {file && (
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className="px-4 py-2 bg-notion-blue text-white rounded-md hover:bg-notion-blueHover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Leyendo...' : 'Leer Archivo'}
                </button>
              )}
            </div>
            {file && (
              <p className="mt-2 text-sm text-notion-textSecondary">
                Archivo seleccionado: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Excel Data Display */}
          {excelData && (
            <div className="mt-8">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-notion-text mb-2">
                  Archivo: {excelData.filename}
                </h3>
                <p className="text-sm text-notion-textSecondary">
                  Total de hojas: {excelData.total_sheets}
                </p>
              </div>

              {/* Sheet Selector */}
              {excelData.sheets.length > 1 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-notion-text mb-2">
                    Seleccionar hoja:
                  </label>
                  <select
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                    className="block w-full px-3 py-2 border border-notion-border rounded-md bg-white text-notion-text"
                  >
                    {excelData.sheets.map((sheet) => (
                      <option key={sheet.name} value={sheet.name}>
                        {sheet.name} ({sheet.rows} filas, {sheet.columns} columnas)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sheet Data */}
              {currentSheet && (
                <div>
                  {currentSheet.error ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-yellow-800">{currentSheet.error}</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 p-4 bg-notion-bgTertiary rounded-md">
                        <h4 className="font-semibold text-notion-text mb-2">
                          Hoja: {currentSheet.name}
                        </h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-notion-textSecondary">Filas:</span>
                            <span className="ml-2 font-medium text-notion-text">{currentSheet.rows}</span>
                          </div>
                          <div>
                            <span className="text-notion-textSecondary">Columnas:</span>
                            <span className="ml-2 font-medium text-notion-text">{currentSheet.columns}</span>
                          </div>
                          <div>
                            <span className="text-notion-textSecondary">Datos mostrados:</span>
                            <span className="ml-2 font-medium text-notion-text">
                              {Math.min(currentSheet.data.length, 100)} de {currentSheet.rows}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Table */}
                      <div className="overflow-x-auto border border-notion-border rounded-md">
                        <table className="min-w-full divide-y divide-notion-border">
                          <thead className="bg-notion-bgTertiary">
                            <tr>
                              {currentSheet.column_names.map((col, idx) => (
                                <th
                                  key={idx}
                                  className="px-4 py-3 text-left text-xs font-medium text-notion-textSecondary uppercase tracking-wider"
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-notion-border">
                            {currentSheet.data.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={currentSheet.column_names.length}
                                  className="px-4 py-8 text-center text-notion-textSecondary"
                                >
                                  No hay datos en esta hoja
                                </td>
                              </tr>
                            ) : (
                              currentSheet.data.map((row, rowIdx) => (
                                <tr key={rowIdx} className="hover:bg-notion-bgTertiary">
                                  {currentSheet.column_names.map((col, colIdx) => (
                                    <td
                                      key={colIdx}
                                      className="px-4 py-3 whitespace-nowrap text-sm text-notion-text"
                                    >
                                      {formatValue(row[col])}
                                    </td>
                                  ))}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Statistics */}
                      {currentSheet.statistics && Object.keys(currentSheet.statistics).length > 0 && (
                        <div className="mt-6">
                          <h4 className="font-semibold text-notion-text mb-3">Estadísticas (columnas numéricas)</h4>
                          <div className="overflow-x-auto border border-notion-border rounded-md">
                            <table className="min-w-full divide-y divide-notion-border">
                              <thead className="bg-notion-bgTertiary">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-notion-textSecondary">Columna</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-notion-textSecondary">Conteo</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-notion-textSecondary">Media</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-notion-textSecondary">Min</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-notion-textSecondary">Max</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-notion-border">
                                {Object.entries(currentSheet.statistics).map(([col, stats]: [string, any]) => (
                                  <tr key={col}>
                                    <td className="px-4 py-2 text-sm font-medium text-notion-text">{col}</td>
                                    <td className="px-4 py-2 text-sm text-notion-text">{stats.count || ''}</td>
                                    <td className="px-4 py-2 text-sm text-notion-text">{formatValue(stats.mean)}</td>
                                    <td className="px-4 py-2 text-sm text-notion-text">{formatValue(stats.min)}</td>
                                    <td className="px-4 py-2 text-sm text-notion-text">{formatValue(stats.max)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
