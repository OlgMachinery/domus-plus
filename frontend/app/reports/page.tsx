'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import type { User, Transaction, UserBudget } from '@/lib/types'
import AppLayout from "@/components/AppLayout"
import { formatCurrency } from '@/lib/currency'
import { getLanguage, setLanguage, useTranslation, type Language } from '@/lib/i18n'
import { safePushLogin } from '@/lib/receiptProcessing'
import { getAuthHeaders, getToken } from '@/lib/auth'

type ReportType = 'transactions' | 'budgets' | 'income_expense' | 'category' | 'annual_budget'
type ExportFormat = 'html' | 'pdf' | 'excel'

export default function ReportsPage() {
  const router = useRouter()
  const [language, setLanguageState] = useState<Language>('es')
  const [mounted, setMounted] = useState(false)
  const t = useTranslation(language)
  const backendUrl = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) || ''
  const apiBase = backendUrl.replace(/\/$/, '')
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [reportType, setReportType] = useState<ReportType>('transactions')
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [year, setYear] = useState(new Date().getFullYear())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<UserBudget[]>([])
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    setMounted(true)
    setLanguageState(getLanguage())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false
    const init = async () => {
      try {
        const headers = await getAuthHeaders()
        const hasAuth = typeof headers === 'object' && headers !== null && 'Authorization' in (headers as Record<string, string>)
        if (hasAuth) {
          const meRes = await fetch(`${apiBase}/api/users/me`, {
            headers: headers as Record<string, string>,
            credentials: 'include',
          })
          if (meRes.ok && !cancelled) {
            const me = await meRes.json()
            setUser(me as User)
            return
          }
          if (meRes.status === 401) {
            localStorage.removeItem('domus_token')
          }
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          safePushLogin(router, 'reports: no supabase session')
          return
        }
        loadUser()
      } catch (err) {
        console.error('Error inicializando reportes:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [router])

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        safePushLogin(router, 'reports: no supabase user')
        return
      }
      
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      
      if (userData) {
        setUser(userData as User)
      }
    } catch (error) {
      console.error('Error cargando usuario:', error)
      const token = getToken()
      if (!token) safePushLogin(router, 'reports: loadUser error')
    } finally {
      setLoading(false)
    }
  }

  const loadReportData = async () => {
    try {
      setGenerating(true)

      const token = getToken()
      if (token) {
        if (reportType === 'transactions' || reportType === 'income_expense' || reportType === 'category') {
          const params = new URLSearchParams()
          params.set('limit', '1000')
          params.set('start_date', `${dateFrom}T00:00:00`)
          params.set('end_date', `${dateTo}T23:59:59`)
          const res = await fetch(`${apiBase}/api/transactions/?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const data = res.ok ? await res.json() : []
          setTransactions((data || []) as Transaction[])
        }

        if (reportType === 'budgets' || reportType === 'annual_budget') {
          const res = await fetch(`${apiBase}/api/budgets/family?year=${year}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const familyBudgets = res.ok ? await res.json() : []
          const mapped = (familyBudgets || []).flatMap((b: any) => {
            const alloc = (b.user_allocations || []).find((a: any) => a.user_id === user?.id)
            if (!alloc) return []
            return [{
              ...alloc,
              family_budget: {
                id: b.id,
                family_id: b.family_id,
                category: b.category,
                subcategory: b.subcategory,
                year: b.year,
                total_amount: b.total_amount,
                budget_type: b.budget_type,
                distribution_method: b.distribution_method,
                auto_distribute: b.auto_distribute,
                target_user_id: b.target_user_id,
                created_at: b.created_at,
              }
            }]
          })
          setBudgets(mapped as any)
        }

        return
      }

      if (reportType === 'transactions' || reportType === 'income_expense' || reportType === 'category') {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const { data: transactionsData } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', authUser.id)
            .gte('date', dateFrom)
            .lte('date', dateTo)
            .order('date', { ascending: false })
          
          setTransactions(transactionsData || [])
        }
      }
      if (reportType === 'budgets' || reportType === 'annual_budget') {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          // Obtener familia del usuario
          const { data: userData } = await supabase
            .from('users')
            .select('family_id')
            .eq('id', authUser.id)
            .single()
          
          if (userData?.family_id) {
            const { data: budgetsData } = await supabase
              .from('family_budgets')
              .select('*')
              .eq('family_id', userData.family_id)
              .eq('year', year)
            
            setBudgets((budgetsData || []) as any[])
          } else {
            setBudgets([])
          }
        } else {
          setBudgets([])
        }
      }
    } catch (error) {
      console.error('Error cargando datos del reporte:', error)
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    if (user) {
      loadReportData()
    }
  }, [reportType, dateFrom, dateTo, year, user])

  const toggleLanguage = () => {
    const newLang = language === 'es' ? 'en' : 'es'
    setLanguage(newLang)
    setLanguageState(newLang)
  }

  const exportToHTML = () => {
    const reportContent = generateReportContent()
    const reportTitle = getReportTitle()
    const generatedDate = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: language === 'es' ? es : enUS })
    
    // Crear HTML completo con encoding correcto
    const html = `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body { 
      font-family: Arial, sans-serif; 
      margin: 20px; 
      background-color: #ffffff;
      color: #32363a;
      line-height: 1.6;
    }
    h1 { 
      color: #32363a; 
      border-bottom: 2px solid #0070f2; 
      padding-bottom: 10px; 
      margin-bottom: 20px;
    }
    h2 {
      color: #32363a;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 20px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    th, td { 
      border: 1px solid #ddd; 
      padding: 10px; 
      text-align: left; 
    }
    th { 
      background-color: #f5f6f7; 
      font-weight: bold;
      color: #32363a;
    }
    tr:nth-child(even) { 
      background-color: #f9f9f9; 
    }
    tr:hover {
      background-color: #f0f0f0;
    }
    .summary { 
      margin: 20px 0; 
      padding: 15px; 
      background-color: #f5f6f7; 
      border-radius: 4px;
      border-left: 4px solid #0070f2;
    }
    .summary p {
      margin: 8px 0;
    }
    .summary strong {
      color: #32363a;
    }
    .footer { 
      margin-top: 30px; 
      text-align: center; 
      color: #666; 
      font-size: 12px;
      border-top: 1px solid #ddd;
      padding-top: 15px;
    }
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  ${reportContent}
  <div class="footer">
    <p>${language === 'es' ? 'Generado el' : 'Generated on'} ${generatedDate}</p>
    <p>${language === 'es' ? 'Sistema Domus Fam' : 'Domus Fam System'}</p>
  </div>
</body>
</html>`
    
    // Crear blob con encoding UTF-8 explícito
    const blob = new Blob(['\ufeff' + html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportTitle.replace(/[^a-z0-9]/gi, '_')}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    // También mostrar mensaje de éxito
    alert(language === 'es' 
      ? `Reporte "${reportTitle}" descargado exitosamente. Abre el archivo desde tu carpeta de descargas.`
      : `Report "${reportTitle}" downloaded successfully. Open the file from your downloads folder.`)
  }

  const exportToPDF = async () => {
    try {
      // Usar window.print() para PDF ya que no tenemos jspdf instalado
      // En producción se podría usar jspdf o html2pdf
      const printWindow = window.open('', '_blank')
      if (!printWindow) return
      
      const reportContent = generateReportContent()
      const html = `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <title>${getReportTitle()}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #32363a; border-bottom: 2px solid #0070f2; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f5f6f7; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .summary { margin: 20px 0; padding: 15px; background-color: #f5f6f7; border-radius: 4px; }
    @media print {
      body { margin: 0; }
    }
  </style>
</head>
<body>
  ${reportContent}
  <div style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">
    <p>${language === 'es' ? 'Generado el' : 'Generated on'} ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: language === 'es' ? es : enUS })}</p>
  </div>
</body>
</html>
      `
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.print()
    } catch (error) {
      console.error('Error generando PDF:', error)
      alert(language === 'es' ? 'Error al generar PDF' : 'Error generating PDF')
    }
  }

  const exportToExcel = () => {
    try {
      // Crear CSV que se puede abrir en Excel
      let csv = ''
      const headers: string[] = []
      const rows: any[] = []

      if (reportType === 'transactions') {
        headers.push('Fecha', 'Concepto', 'Categoría', 'Subcategoría', 'Comercio', 'Monto', 'Tipo')
        transactions.forEach(t => {
          rows.push([
            format(new Date(t.date), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS }),
            t.concept || t.merchant_or_beneficiary || '',
            t.category,
            t.subcategory || '',
            t.merchant_or_beneficiary || '',
            t.amount,
            t.transaction_type === 'income' ? (language === 'es' ? 'Ingreso' : 'Income') : (language === 'es' ? 'Egreso' : 'Expense')
          ])
        })
      } else if (reportType === 'income_expense') {
        headers.push('Fecha', 'Tipo', 'Monto', 'Categoría', 'Concepto')
        transactions.forEach(t => {
          rows.push([
            format(new Date(t.date), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS }),
            t.transaction_type === 'income' ? (language === 'es' ? 'Ingreso' : 'Income') : (language === 'es' ? 'Egreso' : 'Expense'),
            t.amount,
            t.category,
            t.concept || t.merchant_or_beneficiary || ''
          ])
        })
      } else if (reportType === 'category') {
        const categoryMap = new Map<string, number>()
        transactions.forEach(t => {
          const key = `${t.category} - ${t.subcategory || ''}`
          categoryMap.set(key, (categoryMap.get(key) || 0) + t.amount)
        })
        headers.push('Categoría', 'Subcategoría', 'Total')
        categoryMap.forEach((total, key) => {
          const [cat, sub] = key.split(' - ')
          rows.push([cat, sub, total])
        })
      } else if (reportType === 'budgets') {
        headers.push('Categoría', 'Subcategoría', 'Asignado', 'Gastado', 'Disponible', 'Ingresos')
        budgets.forEach(b => {
          rows.push([
            b.family_budget?.category || '',
            b.family_budget?.subcategory || '',
            b.allocated_amount || 0,
            b.spent_amount || 0,
            b.available_amount || 0,
            b.income_amount || 0
          ])
        })
      }

      csv = headers.join(',') + '\n'
      rows.forEach(row => {
        csv += row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n'
      })

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${getReportTitle().replace(/\s+/g, '_')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error generando Excel:', error)
      alert(language === 'es' ? 'Error al generar Excel' : 'Error generating Excel')
    }
  }

  const generateReportContent = () => {
    let content = `<h1>${getReportTitle()}</h1>`
    
    if (reportType === 'transactions') {
      const totalIncome = transactions.filter(t => t.transaction_type === 'income').reduce((sum, t) => sum + t.amount, 0)
      const totalExpense = transactions.filter(t => t.transaction_type === 'expense').reduce((sum, t) => sum + t.amount, 0)
      
      content += `
        <div class="summary">
          <p><strong>${language === 'es' ? 'Período' : 'Period'}:</strong> ${format(new Date(dateFrom), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })} - ${format(new Date(dateTo), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })}</p>
          <p><strong>${language === 'es' ? 'Total Ingresos' : 'Total Income'}:</strong> ${formatCurrency(totalIncome, language, false)}</p>
          <p><strong>${language === 'es' ? 'Total Egresos' : 'Total Expenses'}:</strong> ${formatCurrency(totalExpense, language, false)}</p>
          <p><strong>${language === 'es' ? 'Balance' : 'Balance'}:</strong> ${formatCurrency(totalIncome - totalExpense, language, false)}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>${language === 'es' ? 'Fecha' : 'Date'}</th>
              <th>${language === 'es' ? 'Concepto' : 'Concept'}</th>
              <th>${language === 'es' ? 'Categoría' : 'Category'}</th>
              <th>${language === 'es' ? 'Subcategoría' : 'Subcategory'}</th>
              <th>${language === 'es' ? 'Comercio' : 'Merchant'}</th>
              <th style="text-align: right;">${language === 'es' ? 'Monto' : 'Amount'}</th>
              <th>${language === 'es' ? 'Tipo' : 'Type'}</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(t => `
              <tr>
                <td>${format(new Date(t.date), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })}</td>
                <td>${t.concept || t.merchant_or_beneficiary || ''}</td>
                <td>${t.category}</td>
                <td>${t.subcategory || ''}</td>
                <td>${t.merchant_or_beneficiary || ''}</td>
                <td style="text-align: right;">${formatCurrency(t.amount, language, false)}</td>
                <td>${t.transaction_type === 'income' ? (language === 'es' ? 'Ingreso' : 'Income') : (language === 'es' ? 'Egreso' : 'Expense')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
    } else if (reportType === 'income_expense') {
      const income = transactions.filter(t => t.transaction_type === 'income')
      const expense = transactions.filter(t => t.transaction_type === 'expense')
      const totalIncome = income.reduce((sum, t) => sum + t.amount, 0)
      const totalExpense = expense.reduce((sum, t) => sum + t.amount, 0)
      
      content += `
        <div class="summary">
          <p><strong>${language === 'es' ? 'Período' : 'Period'}:</strong> ${format(new Date(dateFrom), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })} - ${format(new Date(dateTo), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })}</p>
          <p><strong>${language === 'es' ? 'Total Ingresos' : 'Total Income'}:</strong> ${formatCurrency(totalIncome, language, false)}</p>
          <p><strong>${language === 'es' ? 'Total Egresos' : 'Total Expenses'}:</strong> ${formatCurrency(totalExpense, language, false)}</p>
          <p><strong>${language === 'es' ? 'Balance Neto' : 'Net Balance'}:</strong> ${formatCurrency(totalIncome - totalExpense, language, false)}</p>
        </div>
        <h2>${language === 'es' ? 'Ingresos' : 'Income'}</h2>
        <table>
          <thead>
            <tr>
              <th>${language === 'es' ? 'Fecha' : 'Date'}</th>
              <th>${language === 'es' ? 'Categoría' : 'Category'}</th>
              <th>${language === 'es' ? 'Concepto' : 'Concept'}</th>
              <th style="text-align: right;">${language === 'es' ? 'Monto' : 'Amount'}</th>
            </tr>
          </thead>
          <tbody>
            ${income.map(t => `
              <tr>
                <td>${format(new Date(t.date), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })}</td>
                <td>${t.category}</td>
                <td>${t.concept || t.merchant_or_beneficiary || ''}</td>
                <td style="text-align: right;">${formatCurrency(t.amount, language, false)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <h2>${language === 'es' ? 'Egresos' : 'Expenses'}</h2>
        <table>
          <thead>
            <tr>
              <th>${language === 'es' ? 'Fecha' : 'Date'}</th>
              <th>${language === 'es' ? 'Categoría' : 'Category'}</th>
              <th>${language === 'es' ? 'Concepto' : 'Concept'}</th>
              <th style="text-align: right;">${language === 'es' ? 'Monto' : 'Amount'}</th>
            </tr>
          </thead>
          <tbody>
            ${expense.map(t => `
              <tr>
                <td>${format(new Date(t.date), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })}</td>
                <td>${t.category}</td>
                <td>${t.concept || t.merchant_or_beneficiary || ''}</td>
                <td style="text-align: right;">${formatCurrency(t.amount, language, false)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
    } else if (reportType === 'category') {
      const categoryMap = new Map<string, { income: number; expense: number }>()
      transactions.forEach(t => {
        const key = `${t.category} - ${t.subcategory || ''}`
        const current = categoryMap.get(key) || { income: 0, expense: 0 }
        if (t.transaction_type === 'income') {
          current.income += t.amount
        } else {
          current.expense += t.amount
        }
        categoryMap.set(key, current)
      })
      
      content += `
        <div class="summary">
          <p><strong>${language === 'es' ? 'Período' : 'Period'}:</strong> ${format(new Date(dateFrom), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })} - ${format(new Date(dateTo), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>${language === 'es' ? 'Categoría' : 'Category'}</th>
              <th>${language === 'es' ? 'Subcategoría' : 'Subcategory'}</th>
              <th style="text-align: right;">${language === 'es' ? 'Ingresos' : 'Income'}</th>
              <th style="text-align: right;">${language === 'es' ? 'Egresos' : 'Expenses'}</th>
              <th style="text-align: right;">${language === 'es' ? 'Balance' : 'Balance'}</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from(categoryMap.entries()).map(([key, values]) => {
              const [cat, sub] = key.split(' - ')
              return `
                <tr>
                  <td>${cat}</td>
                  <td>${sub}</td>
                  <td style="text-align: right;">${formatCurrency(values.income, language, false)}</td>
                  <td style="text-align: right;">${formatCurrency(values.expense, language, false)}</td>
                  <td style="text-align: right;">${formatCurrency(values.income - values.expense, language, false)}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
      `
    } else if (reportType === 'budgets') {
      const totalAllocated = budgets.reduce((sum, b) => sum + (b.allocated_amount || 0), 0)
      const totalSpent = budgets.reduce((sum, b) => sum + (b.spent_amount || 0), 0)
      const totalAvailable = budgets.reduce((sum, b) => sum + (b.available_amount || 0), 0)
      
      content += `
        <div class="summary">
          <p><strong>${language === 'es' ? 'Total Asignado' : 'Total Allocated'}:</strong> ${formatCurrency(totalAllocated, language, false)}</p>
          <p><strong>${language === 'es' ? 'Total Gastado' : 'Total Spent'}:</strong> ${formatCurrency(totalSpent, language, false)}</p>
          <p><strong>${language === 'es' ? 'Total Disponible' : 'Total Available'}:</strong> ${formatCurrency(totalAvailable, language, false)}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>${language === 'es' ? 'Categoría' : 'Category'}</th>
              <th>${language === 'es' ? 'Subcategoría' : 'Subcategory'}</th>
              <th style="text-align: right;">${language === 'es' ? 'Asignado' : 'Allocated'}</th>
              <th style="text-align: right;">${language === 'es' ? 'Gastado' : 'Spent'}</th>
              <th style="text-align: right;">${language === 'es' ? 'Disponible' : 'Available'}</th>
              <th style="text-align: right;">${language === 'es' ? 'Ingresos' : 'Income'}</th>
            </tr>
          </thead>
          <tbody>
            ${budgets.map(b => `
              <tr>
                <td>${b.family_budget?.category || ''}</td>
                <td>${b.family_budget?.subcategory || ''}</td>
                <td style="text-align: right;">${formatCurrency(b.allocated_amount || 0, language, false)}</td>
                <td style="text-align: right;">${formatCurrency(b.spent_amount || 0, language, false)}</td>
                <td style="text-align: right;">${formatCurrency(b.available_amount || 0, language, false)}</td>
                <td style="text-align: right;">${formatCurrency(b.income_amount || 0, language, false)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
    } else if (reportType === 'annual_budget') {
      const totalBudget = budgets.reduce((sum, b) => sum + (b.allocated_amount || 0), 0)
      const totalSpent = budgets.reduce((sum, b) => sum + (b.spent_amount || 0), 0)
      
      content += `
        <div class="summary">
          <p><strong>${language === 'es' ? 'Año' : 'Year'}:</strong> ${year}</p>
          <p><strong>${language === 'es' ? 'Presupuesto Anual' : 'Annual Budget'}:</strong> ${formatCurrency(totalBudget, language, false)}</p>
          <p><strong>${language === 'es' ? 'Gastado' : 'Spent'}:</strong> ${formatCurrency(totalSpent, language, false)}</p>
          <p><strong>${language === 'es' ? 'Disponible' : 'Available'}:</strong> ${formatCurrency(totalBudget - totalSpent, language, false)}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>${language === 'es' ? 'Categoría' : 'Category'}</th>
              <th>${language === 'es' ? 'Subcategoría' : 'Subcategory'}</th>
              <th style="text-align: right;">${language === 'es' ? 'Presupuesto' : 'Budget'}</th>
              <th style="text-align: right;">${language === 'es' ? 'Gastado' : 'Spent'}</th>
              <th style="text-align: right;">${language === 'es' ? 'Disponible' : 'Available'}</th>
            </tr>
          </thead>
          <tbody>
            ${budgets.map(b => `
              <tr>
                <td>${b.family_budget?.category || ''}</td>
                <td>${b.family_budget?.subcategory || ''}</td>
                <td style="text-align: right;">${formatCurrency(b.allocated_amount || 0, language, false)}</td>
                <td style="text-align: right;">${formatCurrency(b.spent_amount || 0, language, false)}</td>
                <td style="text-align: right;">${formatCurrency(b.available_amount || 0, language, false)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
    }
    
    return content
  }

  const getReportTitle = () => {
    const titles: Record<ReportType, { es: string; en: string }> = {
      transactions: { es: 'Reporte de Transacciones', en: 'Transactions Report' },
      budgets: { es: 'Reporte de Presupuestos', en: 'Budgets Report' },
      income_expense: { es: 'Reporte de Ingresos y Egresos', en: 'Income and Expense Report' },
      category: { es: 'Reporte por Categoría', en: 'Category Report' },
      annual_budget: { es: 'Reporte Anual de Presupuestos', en: 'Annual Budget Report' }
    }
    return titles[reportType][language]
  }

  const toolbar = (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        onClick={toggleLanguage}
        className="sap-button-secondary text-sm px-3 py-1.5 min-w-[60px] h-[36px] flex items-center justify-center"
      >
        {language === 'es' ? '🇲🇽 ES' : '🇺🇸 EN'}
      </button>
    </div>
  )

  if (loading) {
    return (
      <AppLayout user={user} title={language === 'es' ? 'Reportes' : 'Reports'} toolbar={null}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{language === 'es' ? 'Cargando...' : 'Loading...'}</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      user={user}
      title={language === 'es' ? 'Reportes' : 'Reports'}
      subtitle={language === 'es' ? 'Genera y exporta reportes financieros' : 'Generate and export financial reports'}
      toolbar={toolbar}
    >
      <div className="space-y-6">
        {/* Selector de tipo de reporte */}
        <div className="sap-card p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">
            {language === 'es' ? 'Tipo de Reporte' : 'Report Type'}
          </h3>
          <div className="grid md:grid-cols-3 gap-3">
            <button
              onClick={() => setReportType('transactions')}
              className={`sap-button ${reportType === 'transactions' ? 'sap-button-primary' : 'sap-button-secondary'}`}
            >
              {language === 'es' ? 'Transacciones' : 'Transactions'}
            </button>
            <button
              onClick={() => setReportType('income_expense')}
              className={`sap-button ${reportType === 'income_expense' ? 'sap-button-primary' : 'sap-button-secondary'}`}
            >
              {language === 'es' ? 'Ingresos/Egresos' : 'Income/Expense'}
            </button>
            <button
              onClick={() => setReportType('category')}
              className={`sap-button ${reportType === 'category' ? 'sap-button-primary' : 'sap-button-secondary'}`}
            >
              {language === 'es' ? 'Por Categoría' : 'By Category'}
            </button>
            <button
              onClick={() => setReportType('budgets')}
              className={`sap-button ${reportType === 'budgets' ? 'sap-button-primary' : 'sap-button-secondary'}`}
            >
              {language === 'es' ? 'Presupuestos' : 'Budgets'}
            </button>
            <button
              onClick={() => setReportType('annual_budget')}
              className={`sap-button ${reportType === 'annual_budget' ? 'sap-button-primary' : 'sap-button-secondary'}`}
            >
              {language === 'es' ? 'Presupuesto Anual' : 'Annual Budget'}
            </button>
          </div>
        </div>

        {/* Filtros de fecha */}
        {(reportType === 'transactions' || reportType === 'income_expense' || reportType === 'category') && (
          <div className="sap-card p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">
              {language === 'es' ? 'Período' : 'Period'}
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  {language === 'es' ? 'Desde' : 'From'}
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="sap-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  {language === 'es' ? 'Hasta' : 'To'}
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="sap-input"
                />
              </div>
            </div>
          </div>
        )}

        {reportType === 'annual_budget' && (
          <div className="sap-card p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">
              {language === 'es' ? 'Año' : 'Year'}
            </h3>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                {language === 'es' ? 'Selecciona el año' : 'Select year'}
              </label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="sap-input"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Botones de exportación */}
        <div className="sap-card p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">
            {language === 'es' ? 'Exportar Reporte' : 'Export Report'}
          </h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportToHTML}
              disabled={generating}
              className="sap-button-primary"
            >
              {language === 'es' ? '📄 Exportar HTML' : '📄 Export HTML'}
            </button>
            <button
              onClick={exportToPDF}
              disabled={generating}
              className="sap-button-primary"
            >
              {language === 'es' ? '📑 Exportar PDF' : '📑 Export PDF'}
            </button>
            <button
              onClick={exportToExcel}
              disabled={generating}
              className="sap-button-primary"
            >
              {language === 'es' ? '📊 Exportar Excel' : '📊 Export Excel'}
            </button>
            <button
              onClick={() => window.print()}
              disabled={generating}
              className="sap-button-secondary"
            >
              {language === 'es' ? '🖨️ Imprimir' : '🖨️ Print'}
            </button>
          </div>
        </div>

        {/* Vista previa del reporte */}
        {generating ? (
          <div className="sap-card p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sap-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">
              {language === 'es' ? 'Generando reporte...' : 'Generating report...'}
            </p>
          </div>
        ) : (
          <div className="sap-card p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">
              {language === 'es' ? 'Vista Previa' : 'Preview'}
            </h3>
            <div 
              className="bg-white p-6 rounded border border-border"
              dangerouslySetInnerHTML={{ __html: generateReportContent() }}
            />
          </div>
        )}
      </div>
    </AppLayout>
  )
}
