'use client'
// Updated: Export buttons changed to Excel, PDF, HTML - Spacing improved

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import type { User } from '@/lib/types'
import AppLayout from "@/components/AppLayout"
import { formatCurrency } from '@/lib/currency'
import { getLanguage, setLanguage, useTranslation, type Language } from '@/lib/i18n'
import { XIcon, PlusIcon } from '@/lib/icons'

interface ReceiptItem {
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

interface Receipt {
  id: number
  user_id: number
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
  items: ReceiptItem[]
}

export default function ReceiptsPage() {
  const router = useRouter()
  const [language, setLanguageState] = useState<Language>('es')
  const [mounted, setMounted] = useState(false)
  const t = useTranslation(language)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [familyMembers, setFamilyMembers] = useState<User[]>([])
  const [budgets, setBudgets] = useState<any[]>([])
  const [assignForm, setAssignForm] = useState({
    family_budget_id: null as number | null,
    target_user_id: null as number | null,
    percentage: 100,
    user_percentages: {} as Record<number, number>,
    assignment_mode: 'percentage' as 'percentage' | 'by_item' // Modo de asignación
  })

  useEffect(() => {
    setMounted(true)
    setLanguageState(getLanguage())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
        return
      }
      loadUser()
    })
  }, [router])

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }
      
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      
      if (userData) {
        setUser(userData as User)
        // Cargar datos en paralelo
        await Promise.all([
          loadReceipts().catch(err => {
            console.error('Error cargando recibos:', err)
            return null
          }),
          loadTransactions().catch(err => {
            console.error('Error cargando transacciones:', err)
            return null
          }),
          loadFamilyMembers().catch(err => {
            console.error('Error cargando miembros:', err)
            return null
          }),
          loadBudgets().catch(err => {
            console.error('Error cargando presupuestos:', err)
            return null
          })
        ])
      }
    } catch (error: any) {
      console.error('Error cargando usuario:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const loadReceipts = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      
      let query = supabase
        .from('receipts')
        .select('*, items:receipt_items(*)')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
      
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }
      
      const { data: receiptsData } = await query
      setReceipts((receiptsData || []) as Receipt[])
    } catch (error) {
      console.error('Error cargando recibos:', error)
    }
  }

  const loadTransactions = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', authUser.id)
        .order('date', { ascending: false })
      
      setTransactions(transactionsData || [])
    } catch (error) {
      console.error('Error cargando transacciones:', error)
    }
  }

  const loadFamilyMembers = async () => {
    try {
      if (user?.family_id) {
        const { data: familyData } = await supabase
          .from('families')
          .select(`
            *,
            members:users(*)
          `)
          .eq('id', user.family_id)
          .single()
        
        if (familyData?.members) {
          setFamilyMembers(familyData.members as User[])
        }
      }
    } catch (error: any) {
      console.error('Error cargando miembros de familia:', error)
      setFamilyMembers([])
    }
  }

  const loadBudgets = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      
      const { data: userData } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', authUser.id)
        .single()
      
      if (!userData?.family_id) {
        setBudgets([])
        return
      }
      
      const { data: budgetsData } = await supabase
        .from('family_budgets')
        .select('*')
        .eq('family_id', userData.family_id)
      
      setBudgets(budgetsData || [])
    } catch (error: any) {
      console.error('Error cargando presupuestos:', error)
      setBudgets([])
    }
  }

  useEffect(() => {
    if (user) {
      loadReceipts()
      loadFamilyMembers()
    }
  }, [filterStatus, user])

  const toggleLanguage = () => {
    const newLang = language === 'es' ? 'en' : 'es'
    setLanguage(newLang)
    setLanguageState(newLang)
  }

  const handleAssignReceipt = (receipt: Receipt) => {
    setSelectedReceipt(receipt)
    setShowAssignModal(true)
  }

  const handleAssignItem = async (itemId: number, budgetId: number) => {
    if (!selectedReceipt) return

    try {
      // Asignar item a un presupuesto creando una nueva transacción
      const item = selectedReceipt.items?.find(i => i.id === itemId)
      if (!item) {
        alert(language === 'es' ? 'Item no encontrado' : 'Item not found')
        return
      }

      // Crear una transacción para este item específico
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        alert('No autenticado')
        return
      }
      
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: authUser.id,
          amount: item.amount,
          date: selectedReceipt.date || new Date().toISOString().split('T')[0],
          transaction_type: 'expense',
          family_budget_id: budgetId,
          merchant_or_beneficiary: selectedReceipt.merchant_or_beneficiary || item.description,
          category: item.category || selectedReceipt.category,
          subcategory: item.subcategory || selectedReceipt.subcategory,
          concept: item.description,
          currency: selectedReceipt.currency || 'MXN'
        })
        .select()
        .single()
      
      if (transactionError || !transactionData) {
        throw transactionError || new Error('Error al crear transacción')
      }

      // Asignar el item a esa transacción
      const { error: itemError } = await supabase
        .from('receipt_items')
        .update({ assigned_transaction_id: transactionData.id })
        .eq('id', itemId)
      
      if (itemError) {
        console.error('Error asignando item:', itemError)
      }
      
      await loadReceipts()
      await loadTransactions() // Recargar transacciones
      
      // Recargar el recibo seleccionado
      const { data: updatedReceipt } = await supabase
        .from('receipts')
        .select('*, items:receipt_items(*)')
        .eq('id', selectedReceipt.id)
        .single()
      
      if (updatedReceipt) {
        setSelectedReceipt(updatedReceipt as Receipt)
      }
      
      alert(language === 'es' ? 'Item asignado exitosamente' : 'Item assigned successfully')
    } catch (error: any) {
      console.error('Error asignando item:', error)
      alert(error.message || (language === 'es' ? 'Error al asignar item' : 'Error assigning item'))
    }
  }

  const handleAssignReceiptToTransaction = async (transactionId: number | null) => {
    if (!selectedReceipt) return

    // Validar que se haya seleccionado una cuenta del presupuesto
    if (!assignForm.family_budget_id) {
      alert(language === 'es' ? 'Debes seleccionar una cuenta del presupuesto primero' : 'You must select a budget account first')
      return
    }

    try {
      // Si el modo es "by_item", asignar cada item individualmente
      if (assignForm.assignment_mode === 'by_item') {
        const itemsToAssign = selectedReceipt.items?.filter(item => !item.assigned_transaction_id) || []
        if (itemsToAssign.length === 0) {
          alert(language === 'es' ? 'Todos los items ya están asignados' : 'All items are already assigned')
          return
        }
        
        // Asignar cada item individualmente
        for (const item of itemsToAssign) {
          await handleAssignItem(item.id, assignForm.family_budget_id)
        }
        
        await loadReceipts()
        setShowAssignModal(false)
        setAssignForm({
          family_budget_id: null,
          target_user_id: null,
          percentage: 100,
          user_percentages: {},
          assignment_mode: 'percentage'
        })
        alert(language === 'es' ? `Recibo asignado: ${itemsToAssign.length} items asignados individualmente` : `Receipt assigned: ${itemsToAssign.length} items assigned individually`)
        return
      }

      // Modo porcentaje: asignación normal del recibo completo
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        alert('No autenticado')
        return
      }
      
      // Crear transacción para el recibo completo
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: assignForm.target_user_id && assignForm.target_user_id !== -1 
            ? assignForm.target_user_id 
            : authUser.id,
          amount: selectedReceipt.amount * (assignForm.percentage / 100),
          date: selectedReceipt.date || new Date().toISOString().split('T')[0],
          transaction_type: 'expense',
          family_budget_id: assignForm.family_budget_id,
          merchant_or_beneficiary: selectedReceipt.merchant_or_beneficiary,
          category: selectedReceipt.category,
          subcategory: selectedReceipt.subcategory,
          concept: `Recibo #${selectedReceipt.id}`,
          currency: selectedReceipt.currency || 'MXN'
        })
        .select()
        .single()
      
      if (transactionError || !transactionData) {
        throw transactionError || new Error('Error al crear transacción')
      }
      
      // Actualizar el recibo para asignarlo a la transacción
      const { error: receiptError } = await supabase
        .from('receipts')
        .update({ assigned_transaction_id: transactionData.id })
        .eq('id', selectedReceipt.id)
      
      if (receiptError) {
        console.error('Error asignando recibo:', receiptError)
      }
      await loadReceipts()
      setShowAssignModal(false)
      setAssignForm({
        family_budget_id: null,
        target_user_id: null,
        percentage: 100,
        user_percentages: {},
        assignment_mode: 'percentage'
      })
      alert(language === 'es' ? 'Recibo asignado exitosamente. Se creó una nueva transacción.' : 'Receipt assigned successfully. A new transaction was created.')
    } catch (error: any) {
      console.error('Error asignando recibo:', error)
      alert(error.message || (language === 'es' ? 'Error al asignar recibo' : 'Error assigning receipt'))
    }
  }

  const handleAddItem = async (receiptId: number, description: string, amount: number) => {
    try {
      const { error: insertError } = await supabase
        .from('receipt_items')
        .insert({
          receipt_id: receiptId,
          description,
          amount,
          category: null,
          subcategory: null,
          notes: null
        })
      
      if (insertError) {
        throw insertError
      }
      
      await loadReceipts()
      alert(language === 'es' ? 'Item agregado exitosamente' : 'Item added successfully')
    } catch (error: any) {
      console.error('Error agregando item:', error)
      alert(error.message || (language === 'es' ? 'Error al agregar item' : 'Error adding item'))
    }
  }

  const exportReceiptToExcel = () => {
    if (!selectedReceipt) return
    try {
      const headers = ['#', 'Descripción', 'Cantidad', 'Precio Unitario', 'Monto Total']
      const rows = (selectedReceipt.items || []).map((item, idx) => [
        (idx + 1).toString(),
        item.description.replace(/"/g, '""'),
        item.quantity ?? '',
        item.unit_price ?? '',
        item.amount ?? 0,
      ])

      let csv = headers.join(',') + '\n'
      rows.forEach(row => {
        csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n'
      })

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `recibo_${selectedReceipt.id}_items_${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error('Error generando Excel:', error)
      alert(language === 'es' ? 'Error al generar Excel' : 'Error generating Excel')
    }
  }

  const exportReceiptToPDF = async () => {
    if (!selectedReceipt) return
    try {
      const printWindow = window.open('', '_blank')
      if (!printWindow) return

      const itemsHtml = (selectedReceipt.items || []).map((item, idx) => `
        <tr>
          <td style="text-align: right;">${idx + 1}</td>
          <td>${item.description}</td>
          <td style="text-align: right;">${item.quantity ?? '-'}</td>
          <td style="text-align: right;">${item.unit_price != null ? formatCurrency(item.unit_price, language, false) : '-'}</td>
          <td style="text-align: right;">${formatCurrency(item.amount || 0, language, false)}</td>
        </tr>
      `).join('')

      const html = `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <title>${language === 'es' ? 'Recibo' : 'Receipt'} #${selectedReceipt.id}</title>
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
  <h1>${language === 'es' ? 'Recibo Procesado' : 'Processed Receipt'} #${selectedReceipt.id}</h1>
  <div class="summary">
    <p><strong>${language === 'es' ? 'Fecha' : 'Date'}:</strong> ${selectedReceipt.date 
      ? format(new Date(selectedReceipt.date + 'T' + (selectedReceipt.time || '00:00')), 'dd/MM/yyyy HH:mm', { locale: language === 'es' ? es : enUS })
      : format(new Date(selectedReceipt.created_at), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })}</p>
    <p><strong>${language === 'es' ? 'Comercio' : 'Merchant'}:</strong> ${selectedReceipt.merchant_or_beneficiary || '-'}</p>
    <p><strong>${language === 'es' ? 'Monto Total' : 'Total Amount'}:</strong> ${formatCurrency(selectedReceipt.amount, language, false)}</p>
  </div>
  <h2>${language === 'es' ? 'Items del Recibo' : 'Receipt Items'}</h2>
  <table>
    <thead>
      <tr>
        <th style="text-align: right;">#</th>
        <th>${language === 'es' ? 'Descripción' : 'Description'}</th>
        <th style="text-align: right;">${language === 'es' ? 'Cantidad' : 'Quantity'}</th>
        <th style="text-align: right;">${language === 'es' ? 'Precio Unitario' : 'Unit Price'}</th>
        <th style="text-align: right;">${language === 'es' ? 'Monto Total' : 'Total Amount'}</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>
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

  const exportReceiptToHTML = () => {
    if (!selectedReceipt) return
    try {
      const itemsHtml = (selectedReceipt.items || []).map((item, idx) => `
        <tr>
          <td style="text-align: right;">${idx + 1}</td>
          <td>${item.description}</td>
          <td style="text-align: right;">${item.quantity ?? '-'}</td>
          <td style="text-align: right;">${item.unit_price != null ? formatCurrency(item.unit_price, language, false) : '-'}</td>
          <td style="text-align: right;">${formatCurrency(item.amount || 0, language, false)}</td>
        </tr>
      `).join('')

      const html = `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <title>${language === 'es' ? 'Recibo' : 'Receipt'} #${selectedReceipt.id}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #32363a; border-bottom: 2px solid #0070f2; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f5f6f7; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .summary { margin: 20px 0; padding: 15px; background-color: #f5f6f7; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>${language === 'es' ? 'Recibo Procesado' : 'Processed Receipt'} #${selectedReceipt.id}</h1>
  <div class="summary">
    <p><strong>${language === 'es' ? 'Fecha' : 'Date'}:</strong> ${selectedReceipt.date 
      ? format(new Date(selectedReceipt.date + 'T' + (selectedReceipt.time || '00:00')), 'dd/MM/yyyy HH:mm', { locale: language === 'es' ? es : enUS })
      : format(new Date(selectedReceipt.created_at), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })}</p>
    <p><strong>${language === 'es' ? 'Comercio' : 'Merchant'}:</strong> ${selectedReceipt.merchant_or_beneficiary || '-'}</p>
    <p><strong>${language === 'es' ? 'Monto Total' : 'Total Amount'}:</strong> ${formatCurrency(selectedReceipt.amount, language, false)}</p>
  </div>
  <h2>${language === 'es' ? 'Items del Recibo' : 'Receipt Items'}</h2>
  <table>
    <thead>
      <tr>
        <th style="text-align: right;">#</th>
        <th>${language === 'es' ? 'Descripción' : 'Description'}</th>
        <th style="text-align: right;">${language === 'es' ? 'Cantidad' : 'Quantity'}</th>
        <th style="text-align: right;">${language === 'es' ? 'Precio Unitario' : 'Unit Price'}</th>
        <th style="text-align: right;">${language === 'es' ? 'Monto Total' : 'Total Amount'}</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>
  <div style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">
    <p>${language === 'es' ? 'Generado el' : 'Generated on'} ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: language === 'es' ? es : enUS })}</p>
  </div>
</body>
</html>
      `
      
      const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `recibo_${selectedReceipt.id}_items_${new Date().toISOString().split('T')[0]}.html`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error('Error generando HTML:', error)
      alert(language === 'es' ? 'Error al generar HTML' : 'Error generating HTML')
    }
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
      <AppLayout user={user} title={language === 'es' ? 'Recibos' : 'Receipts'} toolbar={null}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{language === 'es' ? 'Cargando...' : 'Loading...'}</div>
        </div>
      </AppLayout>
    )
  }

  const filteredReceipts = filterStatus === 'all' 
    ? receipts 
    : receipts.filter(r => r.status === filterStatus)

  const rawExtractionPreview = (selectedReceipt?.items || [])
    .map((item, idx) => `#${idx + 1} ${item.description || ''}`.trim())
    .join('\n')

  return (
    <AppLayout
      user={user}
      title={language === 'es' ? 'Recibos Procesados' : 'Processed Receipts'}
      subtitle={language === 'es' ? 'Gestiona y asigna conceptos de recibos a transacciones' : 'Manage and assign receipt items to transactions'}
      toolbar={toolbar}
    >
      <div className="space-y-6">
        {/* Filtros */}
        <div className="sap-card p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-muted-foreground">
              {language === 'es' ? 'Estado:' : 'Status:'}
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="sap-input"
            >
              <option value="all">{language === 'es' ? 'Todos' : 'All'}</option>
              <option value="pending">{language === 'es' ? 'Pendiente' : 'Pending'}</option>
              <option value="assigned">{language === 'es' ? 'Asignado' : 'Assigned'}</option>
              <option value="processed">{language === 'es' ? 'Procesado' : 'Processed'}</option>
            </select>
          </div>
        </div>

        {/* Tabla de recibos */}
        <div className="sap-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-backgroundSecondary sticky top-0 z-10">
                <tr>
                  <th className="sap-table-header">{language === 'es' ? 'Fecha' : 'Date'}</th>
                  <th className="sap-table-header">{language === 'es' ? 'Comercio' : 'Merchant'}</th>
                  <th className="sap-table-header">{language === 'es' ? 'Monto' : 'Amount'}</th>
                  <th className="sap-table-header">{language === 'es' ? 'Categoría' : 'Category'}</th>
                  <th className="sap-table-header">{language === 'es' ? 'Concepto' : 'Concept'}</th>
                  <th className="sap-table-header">{language === 'es' ? 'Items' : 'Items'}</th>
                  <th className="sap-table-header">{language === 'es' ? 'Estado' : 'Status'}</th>
                  <th className="sap-table-header">{language === 'es' ? 'Acciones' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="sap-table-cell text-center py-8 text-muted-foreground">
                      {language === 'es' ? 'No hay recibos' : 'No receipts'}
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((receipt) => (
                    <tr key={receipt.id} className="border-b border-border hover:bg-backgroundHover">
                      <td className="sap-table-cell">
                        {receipt.date 
                          ? format(new Date(receipt.date + 'T' + (receipt.time || '00:00')), 'dd/MM/yyyy HH:mm', { locale: language === 'es' ? es : enUS })
                          : format(new Date(receipt.created_at), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })
                        }
                      </td>
                      <td className="sap-table-cell">{receipt.merchant_or_beneficiary || '-'}</td>
                      <td className="sap-table-cell">{formatCurrency(receipt.amount, language, false)}</td>
                      <td className="sap-table-cell">
                        {receipt.category ? `${receipt.category}${receipt.subcategory ? ` - ${receipt.subcategory}` : ''}` : '-'}
                      </td>
                      <td className="sap-table-cell">{receipt.concept || '-'}</td>
                      <td className="sap-table-cell">
                        {receipt.items?.length || 0} {language === 'es' ? 'items' : 'items'}
                      </td>
                      <td className="sap-table-cell">
                        <span className={`px-2 py-1 rounded text-xs ${
                          receipt.status === 'assigned' ? 'bg-green-100 text-green-800' :
                          receipt.status === 'processed' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {receipt.status === 'assigned' ? (language === 'es' ? 'Asignado' : 'Assigned') :
                           receipt.status === 'processed' ? (language === 'es' ? 'Procesado' : 'Processed') :
                           (language === 'es' ? 'Pendiente' : 'Pending')}
                        </span>
                      </td>
                      <td className="sap-table-cell">
                        <button
                          onClick={() => handleAssignReceipt(receipt)}
                          className="sap-button-secondary text-xs"
                        >
                          {language === 'es' ? 'Asignar' : 'Assign'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de asignación */}
        {showAssignModal && selectedReceipt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {language === 'es' ? 'Asignar Recibo' : 'Assign Receipt'}
                </h3>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Información del recibo */}
              <div className="mb-8 p-6 bg-backgroundSecondary rounded">
                <h4 className="font-semibold text-foreground mb-4">
                  {language === 'es' ? 'Información del Recibo' : 'Receipt Information'}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-muted-foreground block">{language === 'es' ? 'Fecha:' : 'Date:'}</span>
                    <span className="text-foreground">
                      {selectedReceipt.date 
                        ? format(new Date(selectedReceipt.date + 'T' + (selectedReceipt.time || '00:00')), 'dd/MM/yyyy HH:mm', { locale: language === 'es' ? es : enUS })
                        : format(new Date(selectedReceipt.created_at), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })
                      }
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground block">{language === 'es' ? 'Comercio:' : 'Merchant:'}</span>
                    <span className="text-foreground">{selectedReceipt.merchant_or_beneficiary || '-'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground block">{language === 'es' ? 'Monto Total:' : 'Total Amount:'}</span>
                    <span className="text-foreground font-semibold">{formatCurrency(selectedReceipt.amount, language, false)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground block">{language === 'es' ? 'Categoría:' : 'Category:'}</span>
                    <span className="text-foreground">{selectedReceipt.category || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Asignar recibo completo */}
              <div className="mb-8 space-y-6">
                <h4 className="font-semibold text-foreground mb-4">
                  {language === 'es' ? 'Asignar Recibo' : 'Assign Receipt'}
                </h4>
                
                {/* Paso 1: Cuenta del Presupuesto (OBLIGATORIO) */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted-foreground">
                    <span className="text-red-500">*</span> {language === 'es' ? 'Cuenta del Presupuesto:' : 'Budget Account:'}
                  </label>
                  <select
                    value={assignForm.family_budget_id ? String(assignForm.family_budget_id) : ''}
                    onChange={(e) => {
                      const value = e.target.value
                      console.log('Budget seleccionado:', value)
                      setAssignForm({ ...assignForm, family_budget_id: value ? parseInt(value) : null })
                    }}
                    className="sap-input w-full"
                    required
                  >
                    <option value="">{language === 'es' ? 'Selecciona una cuenta del presupuesto' : 'Select a budget account'}</option>
                    {budgets.length === 0 ? (
                      <option value="" disabled>{language === 'es' ? 'No hay presupuestos disponibles' : 'No budgets available'}</option>
                    ) : (
                      budgets.map((b) => {
                        // FamilyBudget tiene id, category, subcategory directamente
                        // UserBudget tiene family_budget_id y family_budget relación
                        const budgetId = b.id || b.family_budget_id || b.family_budget?.id
                        const category = b.category || b.family_budget?.category || 'N/A'
                        const subcategory = b.subcategory || b.family_budget?.subcategory || 'N/A'
                        return (
                          <option key={b.id} value={budgetId}>
                            {category} - {subcategory}
                          </option>
                        )
                      })
                    )}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {language === 'es' ? 'Primero debes seleccionar una cuenta del presupuesto' : 'You must first select a budget account'}
                  </p>
                </div>

                {/* Paso 2: Usuario o Todos */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted-foreground">
                    {language === 'es' ? 'Asignar a:' : 'Assign to:'}
                  </label>
                  <select
                    value={assignForm.target_user_id === -1 ? 'all' : (assignForm.target_user_id ? String(assignForm.target_user_id) : '')}
                    onChange={(e) => {
                      const value = e.target.value
                      console.log('Usuario seleccionado:', value)
                      if (value === 'all') {
                        setAssignForm({ ...assignForm, target_user_id: -1 }) // -1 significa "todos"
                      } else {
                        setAssignForm({ ...assignForm, target_user_id: value ? parseInt(value) : null })
                      }
                    }}
                    className="sap-input w-full"
                    disabled={!assignForm.family_budget_id}
                  >
                    <option value="">{language === 'es' ? 'Selecciona usuario o todos' : 'Select user or all'}</option>
                    <option value="all">{language === 'es' ? 'Todos los usuarios' : 'All users'}</option>
                    {familyMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {language === 'es' ? 'Selecciona un usuario específico o "Todos" para distribuir entre todos' : 'Select a specific user or "All" to distribute among all'}
                  </p>
                </div>

                {/* Modo de asignación */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted-foreground">
                    {language === 'es' ? 'Modo de Asignación:' : 'Assignment Mode:'}
                  </label>
                  <select
                    value={assignForm.assignment_mode}
                    onChange={(e) => setAssignForm({ ...assignForm, assignment_mode: e.target.value as 'percentage' | 'by_item' })}
                    className="sap-input w-full"
                    disabled={!assignForm.family_budget_id}
                  >
                    <option value="percentage">{language === 'es' ? 'Por Porcentaje (del monto total)' : 'By Percentage (of total amount)'}</option>
                    <option value="by_item">{language === 'es' ? 'Por Item (cada item individualmente)' : 'By Item (each item individually)'}</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {assignForm.assignment_mode === 'percentage' 
                      ? (language === 'es' ? 'Asigna el monto total del recibo según el porcentaje seleccionado' : 'Assigns the total receipt amount according to the selected percentage')
                      : (language === 'es' ? 'Cada item se asignará individualmente a transacciones separadas' : 'Each item will be assigned individually to separate transactions')}
                  </p>
                </div>

                {/* Porcentaje (solo si modo es porcentaje y se selecciona un usuario específico) */}
                {assignForm.assignment_mode === 'percentage' && assignForm.target_user_id && assignForm.target_user_id !== -1 && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-muted-foreground">
                      {language === 'es' ? 'Porcentaje (100% = completo):' : 'Percentage (100% = full):'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={assignForm.percentage}
                      onChange={(e) => setAssignForm({ ...assignForm, percentage: parseFloat(e.target.value) || 100 })}
                      className="sap-input w-full"
                    />
                  </div>
                )}

                {/* Botón de asignar */}
                <div className="pt-2">
                  <button
                    onClick={() => {
                      if (!assignForm.family_budget_id) {
                        alert(language === 'es' ? 'Debes seleccionar una cuenta del presupuesto primero' : 'You must select a budget account first')
                        return
                      }
                      handleAssignReceiptToTransaction(null) // null significa crear nueva transacción
                    }}
                    disabled={!assignForm.family_budget_id}
                    className="sap-button-primary w-full"
                  >
                    {language === 'es' ? 'Asignar Recibo y Crear Transacción' : 'Assign Receipt and Create Transaction'}
                  </button>
                </div>
              </div>

              {/* Items del recibo */}
              <div className="mt-6">
                <div className="sap-card p-4 mb-4">
                  <h4 className="font-semibold text-foreground mb-2">
                    {language === 'es' ? 'Prueba de extracción de datos con IA' : 'AI extraction test'}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    {language === 'es'
                      ? 'Texto plano extraído (raw_line) para validar rapidez y contenido.'
                      : 'Plain extracted text (raw_line) to validate speed and content.'}
                  </p>
                  <textarea
                    readOnly
                    value={rawExtractionPreview}
                    placeholder={language === 'es' ? 'Sube un recibo para ver la extracción...' : 'Upload a receipt to see extraction...'}
                    className="w-full h-40 sap-input font-mono text-xs resize-none"
                  />
                </div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-foreground">
                    {language === 'es' ? 'Items del Recibo' : 'Receipt Items'} ({selectedReceipt.items?.length || 0})
                  </h4>
                  <div className="flex gap-2">
                    <button
                      onClick={exportReceiptToExcel}
                      className="sap-button-secondary text-xs px-3 py-1.5"
                    >
                      📊 {language === 'es' ? 'Exportar Excel' : 'Export Excel'}
                    </button>
                    <button
                      onClick={exportReceiptToPDF}
                      className="sap-button-secondary text-xs px-3 py-1.5"
                    >
                      📑 {language === 'es' ? 'Exportar PDF' : 'Export PDF'}
                    </button>
                    <button
                      onClick={exportReceiptToHTML}
                      className="sap-button-secondary text-xs px-3 py-1.5"
                    >
                      📄 {language === 'es' ? 'Exportar HTML' : 'Export HTML'}
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="sap-button-secondary text-xs px-3 py-1.5"
                    >
                      🖨️ {language === 'es' ? 'Imprimir' : 'Print'}
                    </button>
                  </div>
                </div>
                <div className="border border-border rounded max-h-[400px] overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-backgroundSecondary sticky top-0">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-3 py-2 text-right" style={{width: '50px'}}>#</th>
                        <th className="px-3 py-2">{language === 'es' ? 'Descripción' : 'Description'}</th>
                        <th className="px-3 py-2 text-right" style={{width: '100px'}}>{language === 'es' ? 'Cantidad' : 'Quantity'}</th>
                        <th className="px-3 py-2 text-right" style={{width: '120px'}}>{language === 'es' ? 'Precio Unitario' : 'Unit Price'}</th>
                        <th className="px-3 py-2 text-right" style={{width: '120px'}}>{language === 'es' ? 'Monto Total' : 'Total Amount'}</th>
                        <th className="px-3 py-2 text-right" style={{width: '150px'}}>{language === 'es' ? 'Asignar' : 'Assign'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sap-border">
                      {selectedReceipt.items?.map((item, idx) => (
                        <tr key={item.id ?? idx} className="hover:bg-backgroundHover">
                          <td className="px-3 py-2 text-right text-muted-foreground">#{idx + 1}</td>
                          <td className="px-3 py-2 text-foreground break-words">{item.description}</td>
                          <td className="px-3 py-2 text-right text-foreground">{item.quantity ?? '-'}</td>
                          <td className="px-3 py-2 text-right text-foreground">
                            {item.unit_price != null ? formatCurrency(item.unit_price, language, false) : '-'}
                          </td>
                          <td className="px-3 py-2 text-right text-foreground font-semibold">
                            {formatCurrency(item.amount || 0, language, false)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {assignForm.assignment_mode === 'by_item' && !item.assigned_transaction_id ? (
                              <select
                                className="sap-input text-xs min-w-[150px]"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAssignItem(item.id, parseInt(e.target.value))
                                  }
                                }}
                              >
                                <option value="">{language === 'es' ? 'Asignar...' : 'Assign...'}</option>
                                {budgets.length > 0 ? (
                                  budgets.map((b) => {
                                    const budgetId = b.id || b.family_budget_id || b.family_budget?.id
                                    const category = b.category || b.family_budget?.category || 'N/A'
                                    const subcategory = b.subcategory || b.family_budget?.subcategory || 'N/A'
                                    return (
                                      <option key={b.id} value={budgetId}>
                                        {category} - {subcategory}
                                      </option>
                                    )
                                  })
                                ) : (
                                  <option value="" disabled>{language === 'es' ? 'No hay presupuestos disponibles' : 'No budgets available'}</option>
                                )}
                              </select>
                            ) : (
                              item.assigned_transaction_id && (
                                <span className="text-xs text-green-600">
                                  {language === 'es' ? 'Asignado a #' : 'Assigned to #'}{item.assigned_transaction_id}
                                </span>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
