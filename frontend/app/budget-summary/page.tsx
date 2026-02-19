'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import AppLayout from '@/components/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Wallet, TrendingDown, TrendingUp, DollarSign, AlertCircle, CheckCircle } from 'lucide-react'

interface BudgetAccount {
  id: number
  category: string
  subcategory: string
  total_amount: number
  paid_amount: number
  remaining_amount: number
  payment_status: string
  budget_type: string
}

interface User {
  name?: string
  email?: string
}

export default function BudgetSummaryPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [accounts, setAccounts] = useState<BudgetAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    loadData()
  }, [year])

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('name, email, family_id')
        .eq('id', session.user.id)
        .single()

      if (userData) {
        setUser({ name: userData.name, email: userData.email })

        if (userData.family_id) {
          const { data: budgets } = await supabase
            .from('family_budgets')
            .select('*')
            .eq('family_id', userData.family_id)
            .eq('year', year)

          if (budgets) {
            const processedAccounts = budgets.map(b => ({
              id: b.id,
              category: b.category || 'Uncategorized',
              subcategory: b.subcategory || '',
              total_amount: b.total_amount || 0,
              paid_amount: 0,
              remaining_amount: b.total_amount || 0,
              payment_status: b.payment_status || 'pending',
              budget_type: b.budget_type || 'shared'
            }))
            setAccounts(processedAccounts)
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const totalBudget = accounts.reduce((sum, acc) => sum + acc.total_amount, 0)
  const totalPaid = accounts.reduce((sum, acc) => sum + acc.paid_amount, 0)
  const totalRemaining = accounts.reduce((sum, acc) => sum + acc.remaining_amount, 0)
  const monthlyBudget = totalBudget / 12

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-700">Paid</Badge>
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-700">Partial</Badge>
      default:
        return <Badge variant="secondary">Pending</Badge>
    }
  }

  const toolbar = (
    <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
      <SelectTrigger className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
          <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  if (loading) {
    return (
      <AppLayout user={null} title="Budget Summary" toolbar={toolbar}>
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout user={user} title="Budget Summary" toolbar={toolbar}>
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Annual Budget</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
              <p className="text-xs text-muted-foreground">{accounts.length} accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Average</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(monthlyBudget)}</div>
              <p className="text-xs text-muted-foreground">Per month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Spent</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
              <p className="text-xs text-muted-foreground">
                {totalBudget > 0 ? `${Math.round((totalPaid / totalBudget) * 100)}%` : '0%'} utilized
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remaining</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalRemaining)}</div>
              <p className="text-xs text-muted-foreground">Available</p>
            </CardContent>
          </Card>
        </div>

        {/* Budget Table */}
        <Card>
          <CardHeader>
            <CardTitle>Budget Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {accounts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Spent</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{account.category}</div>
                          {account.subcategory && (
                            <div className="text-sm text-muted-foreground">{account.subcategory}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(account.total_amount)}</TableCell>
                      <TableCell className="text-green-600">{formatCurrency(account.paid_amount)}</TableCell>
                      <TableCell className="text-orange-600">{formatCurrency(account.remaining_amount)}</TableCell>
                      <TableCell>{getStatusBadge(account.payment_status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{account.budget_type}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">No budget accounts found for {year}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
