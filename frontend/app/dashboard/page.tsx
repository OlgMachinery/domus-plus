'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import SAPLayout from '@/components/SAPLayout'
import { useTranslation, getLanguage } from '@/lib/i18n'
import type { Language } from '@/lib/i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Wallet, TrendingUp, Receipt, CreditCard } from 'lucide-react'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [language, setLanguage] = useState<Language>('es')
  const t = useTranslation(language)

  useEffect(() => {
    setLanguage(getLanguage())
  }, [])

  useEffect(() => {
    let mounted = true
    
    const init = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!mounted) return

        if (error || !session) {
          router.push('/login')
          return
        }

        const { data: userData } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', session.user.id)
          .single()

        if (mounted) {
          setUser(userData || { email: session.user.email })
          setLoading(false)
        }
      } catch {
        if (mounted) {
          router.push('/login')
        }
      }
    }
    
    init()
    return () => { mounted = false }
  }, [router])

  if (loading) {
    return (
      <SAPLayout user={null} title={t.dashboard.title} subtitle={t.dashboard.subtitle}>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </SAPLayout>
    )
  }

  return (
    <SAPLayout user={user} title={t.dashboard.title} subtitle={t.dashboard.subtitle}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.dashboard.title}</h1>
          <p className="text-muted-foreground">
            {language === 'es' ? 'Bienvenido, ' : 'Welcome back, '}{user?.name || user?.email}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.dashboard.allocatedBudget}</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$0.00</div>
              <p className="text-xs text-muted-foreground">{language === 'es' ? 'Este mes' : 'This month'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.dashboard.spent}</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$0.00</div>
              <p className="text-xs text-muted-foreground">{language === 'es' ? 'Este mes' : 'This month'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.dashboard.available}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$0.00</div>
              <p className="text-xs text-muted-foreground">{language === 'es' ? 'Disponible' : 'Available'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.nav.receipts}</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">{language === 'es' ? 'Pendientes de revisión' : 'Pending review'}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t.dashboard.recentTransactions}</CardTitle>
              <CardDescription>{language === 'es' ? 'Tu última actividad' : 'Your latest spending activity'}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t.dashboard.noTransactions}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{language === 'es' ? 'Resumen de presupuestos' : 'Budget Overview'}</CardTitle>
              <CardDescription>{language === 'es' ? 'Distribución mensual' : 'Monthly budget distribution'}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{language === 'es' ? 'Sin presupuestos configurados' : 'No budgets configured'}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </SAPLayout>
  )
}
