'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthHeaders } from '@/lib/auth'
import type { User } from '@/lib/types'
import SAPLayout from '@/components/SAPLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const CURRENCIES = ['MXN', 'USD', 'EUR']
const ENTITY_TYPES = ['PERSON', 'VEHICLE', 'PROPERTY', 'GROUP'] as const
const CATEGORY_TYPES = ['PERSONAL', 'ASSET', 'FAMILY', 'GLOBAL'] as const

type SetupStatus = {
  hasFamily: boolean
  setupComplete: boolean
  planStatus: string | null
  currentStep: number
  familyId: number | null
  isAdmin: boolean
}

type Family = {
  id: number
  name: string
  currency?: string
  cutoff_day?: number
  budget_start_date?: string
  members?: (User & { can_register_expenses?: boolean; can_upload_receipts?: boolean; can_create_events?: boolean; can_view_global_summary?: boolean })[]
}

type Entity = { id: string; name: string; type: string; is_active: boolean }
type Category = { id: string; name: string; type: string; is_active: boolean }
type Allocation = { id?: string; entity_id: string; category_id: string; monthly_limit: number; spent_amount?: number; is_active: boolean }

function compatibleCategory(entityType: string, categoryType: string): boolean {
  if (entityType === 'PERSON') return categoryType === 'PERSONAL' || categoryType === 'FAMILY' || categoryType === 'GLOBAL'
  if (entityType === 'VEHICLE' || entityType === 'PROPERTY') return categoryType === 'ASSET' || categoryType === 'GLOBAL'
  if (entityType === 'GROUP') return categoryType === 'FAMILY' || categoryType === 'GLOBAL'
  return false
}

export default function SetupPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Paso 1
  const [familyName, setFamilyName] = useState('')
  const [currency, setCurrency] = useState('MXN')
  const [cutoffDay, setCutoffDay] = useState(1)
  const [budgetStartDate, setBudgetStartDate] = useState('')
  const [savingFamily, setSavingFamily] = useState(false)

  // Paso 2
  const [family, setFamily] = useState<Family | null>(null)
  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberPassword, setMemberPassword] = useState('')
  const [memberCanRegister, setMemberCanRegister] = useState(true)
  const [memberCanUpload, setMemberCanUpload] = useState(true)
  const [memberCanEvents, setMemberCanEvents] = useState(false)
  const [memberCanGlobal, setMemberCanGlobal] = useState(false)
  const [creatingMember, setCreatingMember] = useState(false)

  // Paso 3
  const [entities, setEntities] = useState<Entity[]>([])
  const [entityName, setEntityName] = useState('')
  const [entityType, setEntityType] = useState<string>('PERSON')
  const [savingEntity, setSavingEntity] = useState(false)

  // Paso 4
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryName, setCategoryName] = useState('')
  const [categoryType, setCategoryType] = useState<string>('PERSONAL')
  const [savingCategory, setSavingCategory] = useState(false)

  // Paso 5
  const [planEntities, setPlanEntities] = useState<Entity[]>([])
  const [planCategories, setPlanCategories] = useState<Category[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const fetchStatus = useCallback(async () => {
    const headers = await getAuthHeaders()
    const res = await fetch('/api/setup/status', { credentials: 'include', headers: headers as HeadersInit })
    if (!res.ok) return
    const data = await res.json()
    setStatus(data)
    setStep(Math.min(data.currentStep || 1, 5))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const headers = await getAuthHeaders()
      const meRes = await fetch('/api/users/me', { credentials: 'include', headers: headers as HeadersInit })
      if (!meRes.ok) {
        router.push('/login')
        return
      }
      const me = await meRes.json()
      if (!cancelled) setUser(me)
      await fetchStatus()
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [router, fetchStatus])

  const validFamilyId =
    status?.familyId != null &&
    (typeof status.familyId === 'number' ? Number.isInteger(status.familyId) : !isNaN(Number(status.familyId)))

  useEffect(() => {
    if (!status?.hasFamily || !validFamilyId) return
    const id = Number(status.familyId)
    if (!Number.isInteger(id) || id < 1) return
    setError('')
    ;(async () => {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/families/${id}`, { credentials: 'include', headers: headers as HeadersInit })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setFamily(data)
        if (step === 1 && data.name) {
          setFamilyName(data.name)
          setCurrency(data.currency || 'MXN')
          setCutoffDay(data.cutoff_day ?? 1)
          setBudgetStartDate(data.budget_start_date ? data.budget_start_date.slice(0, 10) : '')
        }
      } else {
        setError(data.detail || 'No se pudo cargar la familia')
      }
    })()
  }, [status?.hasFamily, status?.familyId, step, validFamilyId])

  useEffect(() => {
    if (step !== 3 || !status?.familyId) return
    ;(async () => {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/setup/entities', { credentials: 'include', headers: headers as HeadersInit })
      if (res.ok) setEntities(await res.json())
    })()
  }, [step, status?.familyId])

  useEffect(() => {
    if (step !== 4 || !status?.familyId) return
    ;(async () => {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/setup/categories', { credentials: 'include', headers: headers as HeadersInit })
      if (res.ok) setCategories(await res.json())
    })()
  }, [step, status?.familyId])

  useEffect(() => {
    if (step !== 5 || !status?.familyId) return
    ;(async () => {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/setup/plan', { credentials: 'include', headers: headers as HeadersInit })
      if (res.ok) {
        const data = await res.json()
        setPlanEntities(data.entities || [])
        setPlanCategories(data.categories || [])
        setAllocations(data.allocations || [])
        if (data.entities?.length && !selectedEntityId) setSelectedEntityId(data.entities[0]?.id)
      }
    })()
  }, [step, status?.familyId])

  if (loading || !status) {
    return (
      <SAPLayout user={user ?? undefined} title="Configuración" subtitle="Cargando...">
        <div className="p-6 flex justify-center">Cargando...</div>
      </SAPLayout>
    )
  }

  if (!status.isAdmin && status.hasFamily && !status.setupComplete) {
    return (
      <SAPLayout user={user ?? undefined} title="Configuración" subtitle="Configuración pendiente">
        <Card className="max-w-xl mx-auto mt-8">
          <CardHeader>
            <CardTitle>Configuración pendiente por el administrador</CardTitle>
            <CardDescription className="sr-only">El administrador debe completar el wizard de configuración.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              El administrador de tu familia aún no ha completado la configuración del presupuesto. Podrás usar la aplicación con normalidad cuando el setup esté completo.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => router.push('/dashboard')}>
              Ir al dashboard
            </Button>
          </CardContent>
        </Card>
      </SAPLayout>
    )
  }

  if (status.setupComplete) {
    return (
      <SAPLayout user={user ?? undefined} title="Configuración" subtitle="Completa">
        <Card className="max-w-xl mx-auto mt-8">
          <CardHeader>
            <CardTitle>Configuración completa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">El presupuesto ya está configurado. Puedes editarlo desde aquí o ir al resumen.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(5)}>Ver plan</Button>
              <Button onClick={() => router.push('/budget-overview')}>Ir a resumen por entidad</Button>
            </div>
          </CardContent>
        </Card>
      </SAPLayout>
    )
  }

  const steps = [
    { n: 1, label: 'Familia' },
    { n: 2, label: 'Integrantes' },
    { n: 3, label: 'Entidades' },
    { n: 4, label: 'Categorías' },
    { n: 5, label: 'Plan del periodo' },
  ]

  const handleStep1 = async () => {
    setError('')
    setSuccess('')
    if (!familyName.trim()) {
      setError('Nombre de familia es obligatorio')
      return
    }
    if (cutoffDay < 1 || cutoffDay > 31) {
      setError('Día de corte debe ser entre 1 y 31')
      return
    }
    setSavingFamily(true)
    try {
      const headers = await getAuthHeaders()
      if (!status?.hasFamily || !status.familyId) {
        const createRes = await fetch('/api/families', {
          method: 'POST',
          headers: headers as HeadersInit,
          credentials: 'include',
          body: JSON.stringify({ name: familyName.trim() }),
        })
        const createData = await createRes.json().catch(() => ({}))
        if (!createRes.ok) {
          setError(createData.detail || 'Error al crear familia')
          return
        }
        const fid = createData.family_id
        if (fid) {
          await fetch(`/api/families/${fid}`, {
            method: 'PATCH',
            headers: headers as HeadersInit,
            credentials: 'include',
            body: JSON.stringify({
              name: familyName.trim(),
              currency,
              cutoff_day: cutoffDay,
              budget_start_date: budgetStartDate || undefined,
            }),
          })
        }
        setSuccess('Familia creada')
        await fetchStatus()
        setStep(2)
      } else {
        const fid = Number(status.familyId)
        if (!Number.isInteger(fid) || fid < 1) {
          setError('Configuración incompleta. Recarga la página.')
          return
        }
        const patchRes = await fetch(`/api/families/${fid}`, {
          method: 'PATCH',
          headers: headers as HeadersInit,
          credentials: 'include',
          body: JSON.stringify({
            name: familyName.trim(),
            currency,
            cutoff_day: cutoffDay,
            budget_start_date: budgetStartDate || undefined,
          }),
        })
        if (!patchRes.ok) {
          const d = await patchRes.json().catch(() => ({}))
          setError(d.detail || 'Error al guardar')
          return
        }
        setSuccess('Guardado')
        setStep(2)
      }
    } finally {
      setSavingFamily(false)
    }
  }

  const handleStep2AddMember = async () => {
    if (!memberName.trim() || !memberEmail.trim()) {
      setError('Nombre y email son obligatorios')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(memberEmail.trim())) {
      setError('Email no válido')
      return
    }
    const password = memberPassword.trim() || undefined
    if (!password || password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setCreatingMember(true)
    setError('')
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: headers as HeadersInit,
        credentials: 'include',
        body: JSON.stringify({
          name: memberName.trim(),
          email: memberEmail.trim(),
          password,
          phone: memberEmail.trim(),
          family_id: status?.familyId,
          can_register_expenses: memberCanRegister,
          can_upload_receipts: memberCanUpload,
          can_create_events: memberCanEvents,
          can_view_global_summary: memberCanGlobal,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.detail || 'Error al crear integrante')
        return
      }
      setSuccess('Integrante agregado')
      setMemberName('')
      setMemberEmail('')
      setMemberPassword('')
      const fid = status?.familyId != null ? Number(status.familyId) : NaN
      if (Number.isInteger(fid) && fid >= 1) {
        const fRes = await fetch(`/api/families/${fid}`, { credentials: 'include', headers: headers as HeadersInit })
        if (fRes.ok) setFamily(await fRes.json())
      }
    } finally {
      setCreatingMember(false)
    }
  }

  const handleStep3AddEntity = async () => {
    if (!entityName.trim()) {
      setError('Nombre de entidad es obligatorio')
      return
    }
    setSavingEntity(true)
    setError('')
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/setup/entities', {
        method: 'POST',
        headers: headers as HeadersInit,
        credentials: 'include',
        body: JSON.stringify({ name: entityName.trim(), type: entityType, is_active: true }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.detail || 'Error al crear')
        return
      }
      const newEntity = await res.json()
      setEntities((prev) => [...prev, newEntity])
      setEntityName('')
      setSuccess('Entidad creada')
    } finally {
      setSavingEntity(false)
    }
  }

  const handleStep4AddCategory = async () => {
    if (!categoryName.trim()) {
      setError('Nombre de categoría es obligatorio')
      return
    }
    setSavingCategory(true)
    setError('')
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/setup/categories', {
        method: 'POST',
        headers: headers as HeadersInit,
        credentials: 'include',
        body: JSON.stringify({ name: categoryName.trim(), type: categoryType, is_active: true }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.detail || 'Error al crear')
        return
      }
      const newCategory = await res.json()
      setCategories((prev) => [...prev, newCategory])
      setCategoryName('')
      setSuccess('Categoría creada')
    } finally {
      setSavingCategory(false)
    }
  }

  const getOrCreateAllocation = (entityId: string, categoryId: string): Allocation => {
    const found = allocations.find((a) => a.entity_id === entityId && a.category_id === categoryId)
    if (found) return { ...found }
    return { entity_id: entityId, category_id: categoryId, monthly_limit: 0, is_active: false }
  }

  const setAllocation = (entityId: string, categoryId: string, patch: Partial<Allocation>) => {
    setAllocations((prev) => {
      const idx = prev.findIndex((a) => a.entity_id === entityId && a.category_id === categoryId)
      const next = { ...getOrCreateAllocation(entityId, categoryId), ...patch }
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = next
        return copy
      }
      return [...prev, next]
    })
  }

  const handleSaveDraft = async () => {
    setSavingDraft(true)
    setError('')
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/setup/plan', {
        method: 'POST',
        headers: headers as HeadersInit,
        credentials: 'include',
        body: JSON.stringify({ allocations }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.detail || 'Error al guardar borrador')
        return
      }
      setSuccess('Borrador guardado')
    } finally {
      setSavingDraft(false)
    }
  }

  const handleConfirmPlan = async () => {
    setConfirming(true)
    setError('')
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/setup/plan/confirm', {
        method: 'POST',
        headers: headers as HeadersInit,
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.detail || 'No se pudo confirmar')
        return
      }
      setConfirmModalOpen(false)
      setSuccess('Plan confirmado. Configuración completa.')
      await fetchStatus()
      setStep(6)
    } finally {
      setConfirming(false)
    }
  }

  const selectedEntity = planEntities.find((e) => e.id === selectedEntityId)
  const compatibleCats = selectedEntity
    ? planCategories.filter((c) => c.is_active && compatibleCategory(selectedEntity.type, c.type))
    : []
  const totalByEntity = planEntities.reduce((acc, e) => {
    const sum = allocations
      .filter((a) => a.entity_id === e.id && a.is_active)
      .reduce((s, a) => s + (a.monthly_limit || 0), 0)
    acc[e.id] = sum
    return acc
  }, {} as Record<string, number>)
  const totalGlobal = Object.values(totalByEntity).reduce((a, b) => a + b, 0)
  const hasPerson = entities.some((e) => e.type === 'PERSON' && e.is_active)
  const hasGroup = entities.some((e) => e.type === 'GROUP' && e.is_active)
  const hasAllocationPositive = allocations.some((a) => a.is_active && (a.monthly_limit || 0) > 0)
  const canConfirm = hasPerson && hasGroup && categories.some((c) => c.is_active) && hasAllocationPositive

  return (
    <SAPLayout user={user ?? undefined} title="Configuración de presupuesto" subtitle={`Paso ${step} de 5`}>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded">{error}</div>}
        {success && <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded">{success}</div>}

        <div className="flex gap-2 flex-wrap">
          {steps.map((s) => (
            <Button
              key={s.n}
              variant={step === s.n ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStep(s.n)}
            >
              {s.n}. {s.label}
            </Button>
          ))}
        </div>

        {/* Paso 1 */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Paso 1 — Crear familia (Gobierno familiar)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nombre de familia</Label>
                <Input value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="Ej. Familia Pérez" />
              </div>
              <div>
                <Label>Moneda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Día de corte mensual (1-31)</Label>
                <Input type="number" min={1} max={31} value={cutoffDay} onChange={(e) => setCutoffDay(Number(e.target.value) || 1)} />
              </div>
              <div>
                <Label>Fecha de inicio de presupuesto</Label>
                <Input type="date" value={budgetStartDate} onChange={(e) => setBudgetStartDate(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleStep1} disabled={savingFamily}>
                  {status?.hasFamily ? 'Guardar y continuar' : 'Crear familia y continuar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Paso 2 */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Paso 2 — Integrantes y roles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>Nombre</Label>
                  <Input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Nombre" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="email@ejemplo.com" />
                </div>
                <div>
                  <Label>Contraseña (mín. 6)</Label>
                  <Input type="password" value={memberPassword} onChange={(e) => setMemberPassword(e.target.value)} placeholder="••••••••" />
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={memberCanRegister} onChange={(e) => setMemberCanRegister(e.target.checked)} />
                  Puede registrar gastos
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={memberCanUpload} onChange={(e) => setMemberCanUpload(e.target.checked)} />
                  Puede subir tickets
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={memberCanEvents} onChange={(e) => setMemberCanEvents(e.target.checked)} />
                  Puede crear eventos
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={memberCanGlobal} onChange={(e) => setMemberCanGlobal(e.target.checked)} />
                  Puede ver resumen global
                </label>
              </div>
              <Button onClick={handleStep2AddMember} disabled={creatingMember}>Guardar integrante</Button>
              <div className="border-t pt-4">
                <p className="font-medium mb-2">Integrantes agregados</p>
                <ul className="list-disc pl-5 space-y-1">
                  {(family?.members ?? []).map((m) => (
                    <li key={m.id}>{m.name} ({m.email})</li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Atrás</Button>
                <Button onClick={() => setStep(3)}>Continuar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Paso 3 */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Paso 3 — Entidades</CardTitle>
              <p className="text-sm text-muted-foreground">Al menos una PERSON y una GROUP (ej. Hogar).</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input className="max-w-xs" value={entityName} onChange={(e) => setEntityName(e.target.value)} placeholder="Nombre entidad" />
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleStep3AddEntity} disabled={savingEntity}>Agregar entidad</Button>
              </div>
              <ul className="list-disc pl-5">
                {entities.map((e) => (
                  <li key={e.id}>{e.name} ({e.type})</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>Atrás</Button>
                <Button onClick={() => setStep(4)}>Continuar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Paso 4 */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Paso 4 — Categorías</CardTitle>
              <p className="text-sm text-muted-foreground">PERSONAL (persona), ASSET (activo), FAMILY (grupo).</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input className="max-w-xs" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Nombre categoría" />
                <Select value={categoryType} onValueChange={setCategoryType}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleStep4AddCategory} disabled={savingCategory}>Agregar categoría</Button>
              </div>
              <ul className="list-disc pl-5">
                {categories.map((c) => (
                  <li key={c.id}>{c.name} ({c.type})</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)}>Atrás</Button>
                <Button onClick={() => setStep(5)}>Continuar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Paso 5 */}
        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>Paso 5 — Plan del periodo</CardTitle>
              <p className="text-sm text-muted-foreground">Activa categorías por entidad y asigna montos. Consolidación en vivo abajo.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {planEntities.map((e) => (
                  <Button
                    key={e.id}
                    variant={selectedEntityId === e.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedEntityId(e.id)}
                  >
                    {e.name}
                  </Button>
                ))}
              </div>
              {selectedEntity && (
                <div className="border rounded p-4 space-y-2">
                  <p className="font-medium">Montos para {selectedEntity.name}</p>
                  {compatibleCats.map((cat) => {
                    const alloc = getOrCreateAllocation(selectedEntity.id, cat.id)
                    return (
                      <div key={cat.id} className="flex items-center gap-4 flex-wrap">
                        <span className="w-32">{cat.name}</span>
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={alloc.is_active}
                            onChange={(e) => setAllocation(selectedEntity.id, cat.id, { is_active: e.target.checked })}
                          />
                          Activa
                        </label>
                        <Input
                          type="number"
                          min={0}
                          className="w-28"
                          value={alloc.monthly_limit || ''}
                          onChange={(e) => setAllocation(selectedEntity.id, cat.id, { monthly_limit: Number(e.target.value) || 0 })}
                        />
                        <span className="text-muted-foreground text-sm">mensual</span>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="border-t pt-4 grid gap-2">
                <p className="font-medium">Consolidación</p>
                <p>Total por entidad: {planEntities.map((e) => `${e.name}: ${totalByEntity[e.id] ?? 0}`).join(' | ')}</p>
                <p className="text-lg font-semibold">Total global del mes: {totalGlobal}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={handleSaveDraft} disabled={savingDraft}>Guardar plan (borrador)</Button>
                <Button onClick={() => setConfirmModalOpen(true)} disabled={!canConfirm}>
                  Confirmar y comenzar a operar
                </Button>
                <Button variant="outline" onClick={() => setStep(4)}>Atrás</Button>
              </div>
              {!canConfirm && (
                <p className="text-sm text-amber-600">
                  Para confirmar necesitas: al menos 1 PERSON activa, 1 GROUP activa, categorías activas y al menos una asignación con monto &gt; 0.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar plan</DialogTitle>
              <DialogDescription>
                Al confirmar, el setup quedará completo y el sistema podrá operar con este plan. ¿Continuar?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleConfirmPlan} disabled={confirming}>Confirmar y comenzar a operar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SAPLayout>
  )
}
