'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import type { User } from '@/lib/types'
import AppLayout from "@/components/AppLayout"
import { formatCurrency } from '@/lib/currency'
import { getLanguage, setLanguage, useTranslation, type Language } from '@/lib/i18n'

interface ReceiptItem {
  id: number
  receipt_id: number
  description: string
  amount: number
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
  user?: User
}

export default function UserRecordsPage() {
  const router = useRouter()
  const [language, setLanguageState] = useState<Language>('es')
  const [mounted, setMounted] = useState(false)
  const t = useTranslation(language)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)

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
        await loadReceipts()
      }
    } catch (error) {
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
      
      const { data: receiptsData } = await supabase
        .from('receipts')
        .select('*, items:receipt_items(*)')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
      
      setReceipts((receiptsData || []) as Receipt[])
    } catch (error) {
      console.error('Error cargando recibos:', error)
    }
  }

  const toggleLanguage = () => {
    const newLang = language === 'es' ? 'en' : 'es'
    setLanguage(newLang)
    setLanguageState(newLang)
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
      <AppLayout user={user} title={language === 'es' ? 'Registros de Usuario' : 'User Records'} toolbar={null}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{language === 'es' ? 'Cargando...' : 'Loading...'}</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      user={user}
      title={language === 'es' ? 'Registros de Usuario' : 'User Records'}
      subtitle={language === 'es' ? 'Visualiza todos tus tickets y recibos procesados' : 'View all your processed tickets and receipts'}
      toolbar={toolbar}
    >
      <div className="space-y-6">
        {/* Lista de recibos */}
        <div className="grid gap-4">
          {receipts.length === 0 ? (
            <div className="sap-card p-12 text-center">
              <p className="text-muted-foreground">
                {language === 'es' ? 'No hay recibos procesados' : 'No processed receipts'}
              </p>
            </div>
          ) : (
            receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="sap-card p-6 cursor-pointer hover:bg-backgroundHover transition-colors"
                onClick={() => setSelectedReceipt(receipt)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        {receipt.merchant_or_beneficiary || (language === 'es' ? 'Recibo sin comercio' : 'Receipt without merchant')}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs ${
                        receipt.status === 'assigned' ? 'bg-green-100 text-green-800' :
                        receipt.status === 'processed' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {receipt.status === 'assigned' ? (language === 'es' ? 'Asignado' : 'Assigned') :
                         receipt.status === 'processed' ? (language === 'es' ? 'Procesado' : 'Processed') :
                         (language === 'es' ? 'Pendiente' : 'Pending')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">{language === 'es' ? 'Fecha:' : 'Date:'}</span>{' '}
                        {receipt.date 
                          ? format(new Date(receipt.date + 'T' + (receipt.time || '00:00')), 'dd/MM/yyyy HH:mm', { locale: language === 'es' ? es : enUS })
                          : format(new Date(receipt.created_at), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })
                        }
                      </div>
                      <div>
                        <span className="text-muted-foreground">{language === 'es' ? 'Monto:' : 'Amount:'}</span>{' '}
                        {formatCurrency(receipt.amount, language, false)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{language === 'es' ? 'Categoría:' : 'Category:'}</span>{' '}
                        {receipt.category || '-'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{language === 'es' ? 'Items:' : 'Items:'}</span>{' '}
                        {receipt.items?.length || 0}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal de detalle del recibo */}
        {selectedReceipt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
                  <h2 className="text-xl font-semibold text-foreground">
                    {language === 'es' ? 'Detalle del Recibo' : 'Receipt Details'}
                  </h2>
                  <button
                    onClick={() => setSelectedReceipt(null)}
                    className="sap-button-ghost p-2"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Imagen del recibo */}
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                      {language === 'es' ? 'Imagen del Ticket' : 'Ticket Image'}
                    </h3>
                    {selectedReceipt.image_url ? (
                      <img
                        src={selectedReceipt.image_url}
                        alt={language === 'es' ? 'Recibo' : 'Receipt'}
                        className="w-full rounded border border-border"
                      />
                    ) : (
                      <div className="w-full h-64 bg-backgroundSecondary rounded border border-border flex items-center justify-center">
                        <p className="text-muted-foreground">
                          {language === 'es' ? 'No hay imagen disponible' : 'No image available'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Tabla de datos */}
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                      {language === 'es' ? 'Datos Extraídos' : 'Extracted Data'}
                    </h3>
                    <div className="sap-card overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-backgroundSecondary">
                          <tr>
                            <th className="sap-table-header">{language === 'es' ? 'Campo' : 'Field'}</th>
                            <th className="sap-table-header">{language === 'es' ? 'Valor' : 'Value'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-border">
                            <td className="sap-table-cell font-medium">{language === 'es' ? 'Fecha' : 'Date'}</td>
                            <td className="sap-table-cell">
                              {selectedReceipt.date 
                                ? format(new Date(selectedReceipt.date + 'T' + (selectedReceipt.time || '00:00')), 'dd/MM/yyyy HH:mm', { locale: language === 'es' ? es : enUS })
                                : format(new Date(selectedReceipt.created_at), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })
                              }
                            </td>
                          </tr>
                          <tr className="border-b border-border">
                            <td className="sap-table-cell font-medium">{language === 'es' ? 'Comercio' : 'Merchant'}</td>
                            <td className="sap-table-cell">{selectedReceipt.merchant_or_beneficiary || '-'}</td>
                          </tr>
                          <tr className="border-b border-border">
                            <td className="sap-table-cell font-medium">{language === 'es' ? 'Monto Total' : 'Total Amount'}</td>
                            <td className="sap-table-cell">{formatCurrency(selectedReceipt.amount, language, false)}</td>
                          </tr>
                          <tr className="border-b border-border">
                            <td className="sap-table-cell font-medium">{language === 'es' ? 'Categoría' : 'Category'}</td>
                            <td className="sap-table-cell">{selectedReceipt.category || '-'}</td>
                          </tr>
                          <tr className="border-b border-border">
                            <td className="sap-table-cell font-medium">{language === 'es' ? 'Subcategoría' : 'Subcategory'}</td>
                            <td className="sap-table-cell">{selectedReceipt.subcategory || '-'}</td>
                          </tr>
                          <tr className="border-b border-border">
                            <td className="sap-table-cell font-medium">{language === 'es' ? 'Concepto' : 'Concept'}</td>
                            <td className="sap-table-cell">{selectedReceipt.concept || '-'}</td>
                          </tr>
                          <tr className="border-b border-border">
                            <td className="sap-table-cell font-medium">{language === 'es' ? 'Referencia' : 'Reference'}</td>
                            <td className="sap-table-cell">{selectedReceipt.reference || '-'}</td>
                          </tr>
                          <tr className="border-b border-border">
                            <td className="sap-table-cell font-medium">{language === 'es' ? 'Operación ID' : 'Operation ID'}</td>
                            <td className="sap-table-cell">{selectedReceipt.operation_id || '-'}</td>
                          </tr>
                          <tr className="border-b border-border">
                            <td className="sap-table-cell font-medium">{language === 'es' ? 'Tracking Key' : 'Tracking Key'}</td>
                            <td className="sap-table-cell">{selectedReceipt.tracking_key || '-'}</td>
                          </tr>
                          <tr className="border-b border-border">
                            <td className="sap-table-cell font-medium">{language === 'es' ? 'Estado' : 'Status'}</td>
                            <td className="sap-table-cell">
                              <span className={`px-2 py-1 rounded text-xs ${
                                selectedReceipt.status === 'assigned' ? 'bg-green-100 text-green-800' :
                                selectedReceipt.status === 'processed' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {selectedReceipt.status === 'assigned' ? (language === 'es' ? 'Asignado' : 'Assigned') :
                                 selectedReceipt.status === 'processed' ? (language === 'es' ? 'Procesado' : 'Processed') :
                                 (language === 'es' ? 'Pendiente' : 'Pending')}
                              </span>
                            </td>
                          </tr>
                          {selectedReceipt.notes && (
                            <tr>
                              <td className="sap-table-cell font-medium">{language === 'es' ? 'Notas' : 'Notes'}</td>
                              <td className="sap-table-cell">{selectedReceipt.notes}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Items del recibo */}
                {selectedReceipt.items && selectedReceipt.items.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                      {language === 'es' ? 'Conceptos Extraídos' : 'Extracted Items'}
                    </h3>
                    <div className="sap-card overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-backgroundSecondary">
                          <tr>
                            <th className="sap-table-header">{language === 'es' ? 'Descripción' : 'Description'}</th>
                            <th className="sap-table-header">{language === 'es' ? 'Monto' : 'Amount'}</th>
                            <th className="sap-table-header">{language === 'es' ? 'Categoría' : 'Category'}</th>
                            <th className="sap-table-header">{language === 'es' ? 'Subcategoría' : 'Subcategory'}</th>
                            <th className="sap-table-header">{language === 'es' ? 'Estado' : 'Status'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReceipt.items.map((item) => (
                            <tr key={item.id} className="border-b border-border">
                              <td className="sap-table-cell">{item.description}</td>
                              <td className="sap-table-cell">{formatCurrency(item.amount, language, false)}</td>
                              <td className="sap-table-cell">{item.category || '-'}</td>
                              <td className="sap-table-cell">{item.subcategory || '-'}</td>
                              <td className="sap-table-cell">
                                {item.assigned_transaction_id ? (
                                  <span className="text-green-600 text-xs">
                                    {language === 'es' ? `Asignado a #${item.assigned_transaction_id}` : `Assigned to #${item.assigned_transaction_id}`}
                                  </span>
                                ) : (
                                  <span className="text-yellow-600 text-xs">
                                    {language === 'es' ? 'Pendiente' : 'Pending'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
