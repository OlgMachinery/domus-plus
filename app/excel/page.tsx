'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import SAPLayout from '@/components/SAPLayout'
import type { User } from '@/lib/types'
import type { ExcelBudget } from '@/lib/services/excel-parser'
import { safePushLogin } from '@/lib/receiptProcessing'

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

interface ParsedBudget extends ExcelBudget {
  id: string // ID único para identificar en la lista
  selected: boolean
}

export default function ExcelPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [excelData, setExcelData] = useState<ExcelData | null>(null)
  const [error, setError] = useState<string>('')
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [importType, setImportType] = useState<'budgets' | 'setup' | null>(null)
  const [parsedBudgets, setParsedBudgets] = useState<ParsedBudget[]>([])
  const [parsingBudgets, setParsingBudgets] = useState(false)
  const [showBudgetSelection, setShowBudgetSelection] = useState(false)

  // Cargar usuario
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
        if (authError || !authUser) {
          console.error('Error de autenticación:', authError)
          safePushLogin(router, 'excel: auth missing')
          return
        }
        
        // Intentar cargar datos del usuario
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        
        if (userError) {
          console.error('Error cargando datos del usuario:', userError)
          // Si hay error 500 o de RLS, intentar usar solo los datos de auth
          if (userError.code === 'PGRST116' || userError.message?.includes('permission') || userError.message?.includes('policy')) {
            console.warn('Error de permisos RLS. Usando datos básicos de auth.')
            // Crear un usuario básico con los datos de auth
            setUser({
              id: authUser.id,
              email: authUser.email || '',
              name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuario',
              phone: authUser.user_metadata?.phone || '',
              is_active: true,
              is_family_admin: false, // Por defecto, se validará en el backend
              family_id: null,
              created_at: (authUser as any).created_at || new Date().toISOString(),
            } as unknown as User)
          } else {
            // Otro tipo de error, redirigir a login
            safePushLogin(router, 'excel: user load error')
          }
        } else if (userData) {
          setUser(userData as User)
        }
      } catch (error) {
        console.error('Error inesperado cargando usuario:', error)
        // No redirigir inmediatamente, permitir que el usuario vea la página
        // El backend validará los permisos
      }
    }
    loadUser()
  }, [router])

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
      // Obtener token de Supabase
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      const response = await fetch('/api/excel/read', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: accessToken ? {
          'Authorization': `Bearer ${accessToken}`
        } : undefined,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Error al leer el archivo Excel')
      }

      const data = await response.json()
      setExcelData(data)
      
      // Seleccionar la primera hoja por defecto
      if (data.sheets && data.sheets.length > 0) {
        setSelectedSheet(data.sheets[0].name)
      }

      // Parsear presupuestos automáticamente
      await parseBudgetsFromFile()
    } catch (err: any) {
      console.error('Error al leer Excel:', err)
      const errorMsg = err.message || 'Error al leer el archivo Excel'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const parseBudgetsFromFile = async () => {
    if (!file) return

    setParsingBudgets(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      const response = await fetch('/api/excel-import/parse-budgets', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: accessToken ? {
          'Authorization': `Bearer ${accessToken}`
        } : undefined,
      })

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch {
          throw new Error(`Error ${response.status}: ${response.statusText}`)
        }
        const errorMsg = errorData.detail || errorData.message || 'Error al parsear presupuestos'
        const debugMsg = errorData.debug ? `\n\n${errorData.debug}` : ''
        throw new Error(errorMsg + debugMsg)
      }

      const result = await response.json()
      
      if (!result.budgets || result.budgets.length === 0) {
        throw new Error(result.detail || 'No se encontraron presupuestos en el Excel')
      }
      
      // Convertir a ParsedBudget con IDs únicos y seleccionados por defecto
      const budgets: ParsedBudget[] = result.budgets.map((budget: ExcelBudget, index: number) => ({
        ...budget,
        id: `budget-${index}-${budget.category}-${budget.subcategory}`,
        selected: true, // Por defecto todos seleccionados
      }))
      
      setParsedBudgets(budgets)
      setShowBudgetSelection(true)
      // Limpiar errores previos solo si no son críticos
      if (error && !error.includes('El usuario ya tiene una familia asignada')) {
        // Mantener el error si es crítico
      } else {
        setError('') // Limpiar errores no críticos
      }
    } catch (err: any) {
      console.error('Error al parsear presupuestos:', err)
      
      // Intentar extraer mensaje de error más detallado
      let errorMessage = err.message || 'Error al parsear presupuestos del Excel'
      
      // Si el error viene de la respuesta, usar ese mensaje
      if (err.response) {
        try {
          const errorData = await err.response.json()
          errorMessage = errorData.detail || errorData.message || errorMessage
          if (errorData.debug) {
            errorMessage += `\n\n${errorData.debug}`
          }
        } catch {
          // Si no se puede parsear, usar el mensaje original
        }
      }
      
      // Mostrar error de forma más visible
      setError(errorMessage)
      setParsedBudgets([])
      setShowBudgetSelection(false)
      
      // Scroll al error para que sea visible
      setTimeout(() => {
        const errorElement = document.querySelector('.bg-red-50')
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    } finally {
      setParsingBudgets(false)
    }
  }

  const toggleBudgetSelection = (budgetId: string) => {
    setParsedBudgets(prev => 
      prev.map(budget => 
        budget.id === budgetId 
          ? { ...budget, selected: !budget.selected }
          : budget
      )
    )
  }

  const selectAllBudgets = () => {
    setParsedBudgets(prev => prev.map(budget => ({ ...budget, selected: true })))
  }

  const deselectAllBudgets = () => {
    setParsedBudgets(prev => prev.map(budget => ({ ...budget, selected: false })))
  }

  const handleImportBudgets = async () => {
    if (!file) {
      setError('No hay archivo seleccionado')
      return
    }

    const selectedBudgets = parsedBudgets.filter(b => b.selected)
    
    if (selectedBudgets.length === 0) {
      setError('Por favor, selecciona al menos un presupuesto para importar')
      return
    }

    if (!confirm(`¿Importar ${selectedBudgets.length} presupuesto(s) seleccionado(s)?`)) {
      return
    }

    setImporting(true)
    setError('')
    setImportResult(null)
    setImportType('budgets')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      // Enviar solo los presupuestos seleccionados como JSON
      const response = await fetch('/api/excel-import/import-budgets', {
        method: 'POST',
        body: JSON.stringify({
          budgets: selectedBudgets.map(({ id, selected, ...budget }) => budget), // Remover id y selected
          year: new Date().getFullYear(),
        }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
      })

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch {
          throw new Error(`Error ${response.status}: ${response.statusText}`)
        }
        
        const errorMsg = errorData.detail || errorData.message || 'Error al importar presupuestos'
        const debugMsg = errorData.debug ? `\n\n💡 Información adicional: ${errorData.debug}` : ''
        const fullError = errorMsg + debugMsg
        
        console.error('Error al importar presupuestos:', {
          status: response.status,
          error: errorData,
          selectedCount: selectedBudgets.length
        })
        
        throw new Error(fullError)
      }

      const result = await response.json()
      console.log('Resultado de importación:', result)
      
      if (result.error_details && result.error_details.length > 0) {
        console.error('Errores durante la importación:', result.error_details)
      }
      
      setImportResult(result)
      setImporting(false)
      
      // Recargar la página después de 3 segundos para ver los cambios
      if (result.created > 0) {
        setTimeout(() => {
          window.location.href = '/budgets'
        }, 3000)
      }
    } catch (err: any) {
      console.error('Error al importar presupuestos:', err)
      setError(err.message || 'Error al importar presupuestos')
      setImporting(false)
      setImportType(null)
    }
  }

  const handleSetupFromExcel = async () => {
    if (!file) {
      setError('No hay archivo seleccionado')
      return
    }

    if (!confirm('¿Estás seguro? Esto creará presupuestos desde el Excel. ¿Continuar?')) {
      return
    }

    setImporting(true)
    setError('')
    setImportResult(null)
    setImportType('setup')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      const response = await fetch('/api/excel-import/setup-from-excel', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: accessToken ? {
          'Authorization': `Bearer ${accessToken}`
        } : undefined,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Error al hacer setup desde Excel')
      }

      const result = await response.json()
      console.log('Resultado de setup:', result)
      
      if (result.error_details && result.error_details.length > 0) {
        console.error('Errores durante el setup:', result.error_details)
      }
      
      setImportResult(result)
      setImporting(false)
      
      // Recargar la página después de 3 segundos
      if (result.created > 0) {
        setTimeout(() => {
          window.location.href = '/budgets'
        }, 3000)
      }
    } catch (err: any) {
      console.error('Error al hacer setup:', err)
      setError(err.message || 'Error al hacer setup desde Excel')
      setImporting(false)
      setImportType(null)
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
    <SAPLayout user={user} title="Importar Excel" subtitle="Cargar datos desde archivos Excel">
      <div className="sap-card p-6">
        <h2 className="text-2xl font-bold text-sap-text mb-6">Leer Archivo Excel</h2>

        {/* File Upload Section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-sap-text-secondary mb-2">
            Selecciona un archivo Excel (.xlsx, .xlsm, .xls)
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept=".xlsx,.xlsm,.xls"
              onChange={handleFileSelect}
              className="sap-input block w-full text-sm
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-sap-bg-secondary file:text-sap-text
                hover:file:bg-sap-bg-hover
                cursor-pointer"
              disabled={loading}
            />
            {file && (
              <button
                onClick={handleUpload}
                disabled={loading}
                className="sap-button-primary px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Leyendo...' : 'Leer Archivo'}
              </button>
            )}
          </div>
          {file && (
            <p className="mt-2 text-sm text-sap-text-secondary">
              Archivo seleccionado: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        {/* Error Message - Solo mostrar si no es un error de "ya tiene familia" cuando hay presupuestos */}
        {error && !(error.includes('El usuario ya tiene una familia asignada') && showBudgetSelection && parsedBudgets.length > 0) && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-red-800 font-semibold mb-1">Error al procesar el Excel</p>
                <p className="text-red-700 text-sm whitespace-pre-line">{error}</p>
                {error.includes('Header encontrado') && (
                  <p className="text-red-600 text-xs mt-2 italic">
                    💡 Tip: Verifica que la hoja &quot;Input Categories Budget&quot; tenga columnas con los meses (JANUARY, FEBRUARY, etc.) y una sección EXPENSES.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Mensaje informativo si hay error de "ya tiene familia" pero los presupuestos se muestran */}
        {error && error.includes('El usuario ya tiene una familia asignada') && showBudgetSelection && parsedBudgets.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-blue-800 text-sm">
                  ✅ Los presupuestos se encontraron correctamente. Puedes seleccionar cuáles importar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Parsing Budgets */}
        {parsingBudgets && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-blue-800">📊 Analizando presupuestos del Excel...</p>
          </div>
        )}

        {/* Budget Selection */}
        {showBudgetSelection && parsedBudgets.length > 0 && !importResult && (
          <div className="mb-6 p-4 bg-sap-bg-secondary border border-sap-border rounded-md">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-sap-text">
                  Presupuestos Encontrados ({parsedBudgets.length})
                </h3>
                <p className="text-sm text-sap-text-secondary mt-1">
                  Selecciona los presupuestos que deseas importar al sistema
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={selectAllBudgets}
                  className="sap-button-secondary text-sm px-3 py-1"
                >
                  Seleccionar Todos
                </button>
                <button
                  onClick={deselectAllBudgets}
                  className="sap-button-secondary text-sm px-3 py-1"
                >
                  Deseleccionar Todos
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto border border-sap-border rounded-md bg-white">
              <table className="sap-table min-w-full">
                <thead className="bg-sap-bg-secondary sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-sap-text-secondary uppercase w-12">
                      <input
                        type="checkbox"
                        checked={parsedBudgets.every(b => b.selected)}
                        onChange={(e) => e.target.checked ? selectAllBudgets() : deselectAllBudgets()}
                        className="rounded border-sap-border"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-sap-text-secondary uppercase">
                      Categoría
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-sap-text-secondary uppercase">
                      Subcategoría
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-sap-text-secondary uppercase">
                      Total Anual
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-sap-text-secondary uppercase">
                      Meses con Datos
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sap-border">
                  {parsedBudgets.map((budget) => (
                    <tr 
                      key={budget.id} 
                      className={`hover:bg-sap-bg-secondary ${budget.selected ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={budget.selected}
                          onChange={() => toggleBudgetSelection(budget.id)}
                          className="rounded border-sap-border"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-sap-text">
                        {budget.category}
                      </td>
                      <td className="px-4 py-3 text-sm text-sap-text">
                        {budget.subcategory}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-sap-text font-semibold">
                        ${budget.total_amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-sap-text-secondary">
                        {Object.keys(budget.monthly_amounts).length} meses
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <p className="text-sm text-sap-text-secondary">
                {parsedBudgets.filter(b => b.selected).length} de {parsedBudgets.length} presupuestos seleccionados
              </p>
              <button
                onClick={handleImportBudgets}
                disabled={importing || parsedBudgets.filter(b => b.selected).length === 0}
                className="sap-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing && importType === 'budgets' ? 'Importando...' : `Importar ${parsedBudgets.filter(b => b.selected).length} Presupuesto(s)`}
              </button>
            </div>
          </div>
        )}

        {/* Import Options (fallback si no hay presupuestos parseados) */}
        {excelData && !showBudgetSelection && !importResult && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="text-lg font-semibold text-sap-text mb-3">Importar Datos al Sistema</h3>
            <p className="text-sm text-sap-text-secondary mb-4">
              Usa los datos del Excel para rellenar el sistema con presupuestos.
            </p>
            <div className="flex gap-3">
              <button
                onClick={parseBudgetsFromFile}
                disabled={parsingBudgets}
                className="sap-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {parsingBudgets ? 'Analizando...' : 'Analizar Presupuestos del Excel'}
              </button>
              <button
                onClick={handleSetupFromExcel}
                disabled={importing}
                className="sap-button-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing && importType === 'setup' ? 'Configurando...' : 'Setup Completo desde Excel'}
              </button>
            </div>
            {user === null && (
              <p className="text-sm text-yellow-600 mt-2">
                ⚠️ Cargando información del usuario... Los permisos se validarán al importar.
              </p>
            )}
            {user && !user.is_family_admin && (
              <p className="text-sm text-yellow-600 mt-2">
                ⚠️ Solo los administradores de familia pueden importar datos. El backend validará tus permisos.
              </p>
            )}
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div className={`mb-6 p-4 border rounded-md ${
            importResult.created > 0 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            {importResult.created > 0 ? (
              <>
                <h3 className="text-lg font-semibold text-green-800 mb-2">✅ Importación Exitosa</h3>
                <p className="text-sm text-green-700 mb-2">
                  {importResult.message || `Importados ${importResult.created || 0} presupuestos exitosamente`}
                </p>
                {importResult.errors > 0 && (
                  <p className="text-sm text-yellow-700 mb-2">
                    ⚠️ {importResult.errors} errores durante la importación
                  </p>
                )}
                {importResult.error_details && importResult.error_details.length > 0 && (
                  <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
                    <strong className="text-yellow-800">Errores encontrados:</strong>
                    <ul className="list-disc list-inside mt-1 text-yellow-700 max-h-40 overflow-y-auto">
                      {importResult.error_details.map((err: string, idx: number) => (
                        <li key={idx} className="break-words">{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-sm text-green-600 mt-2">
                  Redirigiendo a Presupuestos en 3 segundos...
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-red-800 mb-2">❌ Error en la Importación</h3>
                <p className="text-sm text-red-700 mb-2">
                  No se pudieron importar presupuestos. Revisa los errores a continuación.
                </p>
                {importResult.error_details && importResult.error_details.length > 0 && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-xs">
                    <strong className="text-red-800">Errores:</strong>
                    <ul className="list-disc list-inside mt-1 text-red-700 max-h-60 overflow-y-auto">
                      {importResult.error_details.map((err: string, idx: number) => (
                        <li key={idx} className="break-words">{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  onClick={() => {
                    setImportResult(null)
                    setError('')
                  }}
                  className="mt-3 sap-button-secondary text-sm"
                >
                  Intentar de nuevo
                </button>
              </>
            )}
          </div>
        )}

        {/* Excel Data Display */}
        {excelData && (
          <div className="mt-8">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-sap-text mb-2">
                Archivo: {excelData.filename}
              </h3>
              <p className="text-sm text-sap-text-secondary">
                Total de hojas: {excelData.total_sheets}
              </p>
            </div>

            {/* Sheet Selector */}
            {excelData.sheets.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-sap-text-secondary mb-2">
                  Seleccionar hoja:
                </label>
                <select
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="sap-input block w-full"
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
                    <div className="mb-4 p-4 bg-sap-bg-secondary rounded-md">
                      <h4 className="font-semibold text-sap-text mb-2">
                        Hoja: {currentSheet.name}
                      </h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-sap-text-secondary">Filas:</span>
                          <span className="ml-2 font-medium text-sap-text">{currentSheet.rows}</span>
                        </div>
                        <div>
                          <span className="text-sap-text-secondary">Columnas:</span>
                          <span className="ml-2 font-medium text-sap-text">{currentSheet.columns}</span>
                        </div>
                        <div>
                          <span className="text-sap-text-secondary">Datos mostrados:</span>
                          <span className="ml-2 font-medium text-sap-text">
                            {Math.min(currentSheet.data.length, 100)} de {currentSheet.rows}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto border border-sap-border rounded-md">
                      <table className="sap-table min-w-full">
                        <thead className="bg-sap-bg-secondary">
                          <tr>
                            {currentSheet.column_names.map((col, idx) => (
                              <th
                                key={idx}
                                className="px-4 py-3 text-left text-xs font-medium text-sap-text-secondary uppercase tracking-wider"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-sap-border">
                          {currentSheet.data.length === 0 ? (
                            <tr>
                              <td
                                colSpan={currentSheet.column_names.length}
                                className="px-4 py-8 text-center text-sap-text-secondary"
                              >
                                No hay datos en esta hoja
                              </td>
                            </tr>
                          ) : (
                            currentSheet.data.map((row, rowIdx) => (
                              <tr key={rowIdx} className="hover:bg-sap-bg-secondary">
                                {currentSheet.column_names.map((col, colIdx) => (
                                  <td
                                    key={colIdx}
                                    className="px-4 py-3 whitespace-nowrap text-sm text-sap-text"
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
                        <h4 className="font-semibold text-sap-text mb-3">Estadísticas (columnas numéricas)</h4>
                        <div className="overflow-x-auto border border-sap-border rounded-md">
                          <table className="sap-table min-w-full">
                            <thead className="bg-sap-bg-secondary">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-sap-text-secondary">Columna</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-sap-text-secondary">Conteo</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-sap-text-secondary">Media</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-sap-text-secondary">Min</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-sap-text-secondary">Max</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-sap-border">
                              {Object.entries(currentSheet.statistics).map(([col, stats]: [string, any]) => (
                                <tr key={col}>
                                  <td className="px-4 py-2 text-sm font-medium text-sap-text">{col}</td>
                                  <td className="px-4 py-2 text-sm text-sap-text">{stats.count || ''}</td>
                                  <td className="px-4 py-2 text-sm text-sap-text">{formatValue(stats.mean)}</td>
                                  <td className="px-4 py-2 text-sm text-sap-text">{formatValue(stats.min)}</td>
                                  <td className="px-4 py-2 text-sm text-sap-text">{formatValue(stats.max)}</td>
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
    </SAPLayout>
  )
}
