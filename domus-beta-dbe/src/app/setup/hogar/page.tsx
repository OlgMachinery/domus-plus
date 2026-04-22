'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import './hogar-setup.css'

type MeOk = {
  ok: true
  user: { id: string; email: string; name: string | null }
  activeFamily: { id: string; name: string } | null
  isFamilyAdmin: boolean
}

type ApiEntity = {
  id: string
  type: string
  name: string
  parentId: string | null
}

type MemberRow = {
  id: string
  email: string
  name: string | null
  isFamilyAdmin: boolean
}

type ThingRow = {
  id: string
  name: string
  type: string
}

type ServiceItem = {
  serviceId: string
  name: string
  categoryGroup: string | null
  enabled: boolean
}

const STEPS = [
  { id: 0, label: 'Inicio' },
  { id: 1, label: 'Integrantes' },
  { id: 2, label: 'Destinos' },
  { id: 3, label: 'Cosas' },
  { id: 4, label: 'Servicios' },
  { id: 5, label: 'Listo' },
] as const

const THING_TYPES: { value: string; label: string }[] = [
  { value: 'DISPOSITIVO', label: 'Dispositivo' },
  { value: 'AUTO', label: 'Auto' },
  { value: 'BICICLETA', label: 'Bicicleta' },
  { value: 'OTRO', label: 'Otro' },
]

function isMeOk(x: unknown): x is MeOk {
  return !!x && typeof x === 'object' && (x as { ok?: boolean }).ok === true
}

function findFamilyRoot(entities: ApiEntity[]): ApiEntity | undefined {
  const fam = entities.filter((e) => e.type === 'FAMILY')
  const named = fam.find((e) => e.name === 'Familia')
  return named || fam[0]
}

export default function SetupHogarPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [me, setMe] = useState<MeOk | null>(null)
  const [loadingMe, setLoadingMe] = useState(true)
  const [message, setMessage] = useState('')

  const [members, setMembers] = useState<MemberRow[] | null>(null)
  const [entities, setEntities] = useState<ApiEntity[] | null>(null)
  const [things, setThings] = useState<ThingRow[] | null>(null)

  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberPass, setNewMemberPass] = useState('')
  const [newMemberName, setNewMemberName] = useState('')
  const [addingMember, setAddingMember] = useState(false)

  const [newDestName, setNewDestName] = useState('')
  const [newDestKind, setNewDestKind] = useState<'PERSON' | 'ASSET' | 'PET'>('PERSON')
  const [petOwnerId, setPetOwnerId] = useState('')
  const [addingDest, setAddingDest] = useState(false)

  const [newThingType, setNewThingType] = useState('DISPOSITIVO')
  const [newThingName, setNewThingName] = useState('')
  const [addingThing, setAddingThing] = useState(false)

  const [svcEntityId, setSvcEntityId] = useState<string | null>(null)
  const [serviceItems, setServiceItems] = useState<ServiceItem[] | null>(null)
  const [svcLoading, setSvcLoading] = useState(false)
  const [togglingSvc, setTogglingSvc] = useState<string | null>(null)

  const refreshMe = useCallback(async () => {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    setMe(isMeOk(data) ? data : null)
  }, [])

  const refreshMembers = useCallback(async () => {
    const res = await fetch('/api/families/members', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMembers([])
      return
    }
    const rows = Array.isArray(data.members) ? data.members : []
    setMembers(
      rows.map((m: { id: string; email: string; name: string | null; isFamilyAdmin: boolean }) => ({
        id: m.id,
        email: m.email,
        name: m.name,
        isFamilyAdmin: m.isFamilyAdmin,
      })),
    )
  }, [])

  const refreshEntities = useCallback(async () => {
    const res = await fetch('/api/budget/entities', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setEntities([])
      return
    }
    setEntities(Array.isArray(data.entities) ? data.entities : [])
  }, [])

  const refreshThings = useCallback(async () => {
    const res = await fetch('/api/users/me/things', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setThings([])
      return
    }
    const list = Array.isArray(data.things) ? data.things : []
    setThings(
      list.map((t: { id: string; name: string; type: string }) => ({
        id: t.id,
        name: t.name,
        type: t.type,
      })),
    )
  }, [])

  useEffect(() => {
    let c = false
    ;(async () => {
      setLoadingMe(true)
      await refreshMe()
      if (!c) setLoadingMe(false)
    })()
    return () => {
      c = true
    }
  }, [refreshMe])

  useEffect(() => {
    if (!me?.activeFamily) return
    void refreshMembers()
    void refreshEntities()
    void refreshThings()
  }, [me?.activeFamily?.id, refreshMembers, refreshEntities, refreshThings])

  const familyRoot = useMemo(() => (entities && entities.length ? findFamilyRoot(entities) : undefined), [entities])

  useEffect(() => {
    if (!familyRoot?.id) return
    if (!svcEntityId) setSvcEntityId(familyRoot.id)
  }, [familyRoot?.id, svcEntityId])

  const loadServices = useCallback(async (entityId: string) => {
    setSvcLoading(true)
    setMessage('')
    try {
      const res = await fetch(`/api/budget/entities/${entityId}/services`, { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudieron cargar los servicios')
      const items = Array.isArray(data.items) ? data.items : []
      setServiceItems(
        items.map((r: { serviceId: string; name: string; categoryGroup: string | null; enabled: boolean }) => ({
          serviceId: r.serviceId,
          name: r.name,
          categoryGroup: r.categoryGroup,
          enabled: !!r.enabled,
        })),
      )
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Error')
      setServiceItems([])
    } finally {
      setSvcLoading(false)
    }
  }, [])

  useEffect(() => {
    if (step !== 4 || !svcEntityId) return
    void loadServices(svcEntityId)
  }, [step, svcEntityId, loadServices])

  async function handleAddMember() {
    if (!me?.isFamilyAdmin) return
    const email = newMemberEmail.trim()
    if (!email || !email.includes('@')) {
      setMessage('Email válido requerido')
      return
    }
    setAddingMember(true)
    setMessage('')
    try {
      const res = await fetch('/api/families/members', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password: newMemberPass || undefined,
          name: newMemberName.trim() || null,
          isFamilyAdmin: false,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo añadir')
      setNewMemberEmail('')
      setNewMemberPass('')
      setNewMemberName('')
      await refreshMembers()
      setMessage('Integrante añadido.')
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Error')
    } finally {
      setAddingMember(false)
    }
  }

  async function handleAddDestination() {
    if (!me?.isFamilyAdmin || !familyRoot) return
    const name = newDestName.trim()
    if (!name) {
      setMessage('Escribe un nombre para el destino')
      return
    }
    if (newDestKind === 'PET' && !petOwnerId) {
      setMessage('Las mascotas necesitan un dueño (elige un integrante).')
      return
    }
    setAddingDest(true)
    setMessage('')
    try {
      const owners =
        newDestKind === 'PET' && petOwnerId ? [{ userId: petOwnerId }] : ([] as { userId: string }[])
      const res = await fetch('/api/budget/entities', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          type: newDestKind,
          parentId: familyRoot.id,
          owners,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo crear el destino')
      setNewDestName('')
      await refreshEntities()
      setMessage('Destino creado bajo «Familia».')
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Error')
    } finally {
      setAddingDest(false)
    }
  }

  function applyQuickTemplate(label: string) {
    const map: Record<string, string> = {
      Supermercado: 'Supermercado fam.',
      'Eventos familiares': 'Eventos familiares',
      Hogar: 'Hogar compartido',
    }
    setNewDestName(map[label] || label)
    setNewDestKind('ASSET')
  }

  async function handleAddThing() {
    const name = newThingName.trim()
    if (!name) {
      setMessage('Nombre de la cosa requerido')
      return
    }
    setAddingThing(true)
    setMessage('')
    try {
      const res = await fetch('/api/users/me/things', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: newThingType, name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo crear')
      setNewThingName('')
      await refreshThings()
      setMessage('Cosas actualizadas.')
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Error')
    } finally {
      setAddingThing(false)
    }
  }

  async function toggleService(item: ServiceItem, enabled: boolean) {
    if (!me?.isFamilyAdmin || !svcEntityId) return
    setTogglingSvc(item.serviceId)
    setMessage('')
    try {
      const res = await fetch(`/api/budget/entities/${svcEntityId}/services`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ serviceId: item.serviceId, enabled }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo actualizar')
      setServiceItems((prev) =>
        prev ? prev.map((r) => (r.serviceId === item.serviceId ? { ...r, enabled } : r)) : prev,
      )
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Error')
    } finally {
      setTogglingSvc(null)
    }
  }

  const servicesByGroup = useMemo(() => {
    if (!serviceItems) return new Map<string | null, ServiceItem[]>()
    const m = new Map<string | null, ServiceItem[]>()
    for (const it of serviceItems) {
      const g = it.categoryGroup
      if (!m.has(g)) m.set(g, [])
      m.get(g)!.push(it)
    }
    return m
  }, [serviceItems])

  if (loadingMe) {
    return (
      <div className="hsRoot">
        <div className="hsMain">
          <p className="hsMuted">Cargando…</p>
        </div>
      </div>
    )
  }

  if (!me?.activeFamily) {
    return (
      <div className="hsRoot">
        <div className="hsMain">
          <div className="hsCard">
            <p className="hsLead">Selecciona una familia en el panel para usar este asistente.</p>
            <Link href="/ui" className="hsBtn hsBtnPrimary">
              Ir al panel DOMUS
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="hsRoot">
      <header className="hsTop">
        <div className="hsTopInner">
          <Link href="/ui" className="hsBack">
            ← Volver al panel
          </Link>
          <div className="hsSteps" aria-hidden>
            {STEPS.map((s) => (
              <span key={s.id} className={`hsStepDot ${step >= s.id ? 'on' : ''}`} title={s.label} />
            ))}
          </div>
        </div>
      </header>

      <main className="hsMain">
        {message ? <div className="hsBanner">{message}</div> : null}

        {!me.isFamilyAdmin ? (
          <div className="hsBanner warn">
            Solo el administrador puede crear integrantes, destinos y activar servicios. Puedes revisar este recorrido; pide al admin los
            cambios si hace falta.
          </div>
        ) : null}

        {step === 0 ? (
          <div className="hsCard">
            <h1 className="hsH1">Configurar el hogar</h1>
            <p className="hsLead">
              En este recorrido das de alta <strong>quién vive en el hogar</strong>, <strong>destinos</strong> para el presupuesto (personas,
              mascotas, gastos compartidos como supermercado…), <strong>tus cosas</strong> (inventario) y <strong>servicios</strong> por
              destino. <strong>Aquí no se asignan montos ni frecuencias</strong>: eso lo harás después en Presupuesto.
            </p>
            <p className="hsMuted">
              La entidad raíz <strong>Familia</strong> agrupa lo que es del hogar (ej. supermercado, eventos comunes). Cada persona puede ser
              su propio destino.
            </p>
            <p className="hsMuted" style={{ marginTop: 10 }}>
              Otras entradas al mismo modelo:{' '}
              <Link href="/setup/entities" style={{ color: '#0d6efd', fontWeight: 700 }}>
                Entidades (árbol)
              </Link>
              {' · '}
              <Link href="/setup/objects" style={{ color: '#0d6efd', fontWeight: 700 }}>
                Destinos (formulario)
              </Link>
              . No hace falta usarlas si completas este asistente.
            </p>
            <div className="hsRow">
              <button type="button" className="hsBtn hsBtnPrimary" onClick={() => setStep(1)}>
                Siguiente: integrantes
              </button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="hsCard">
            <h1 className="hsH1">1 · Integrantes</h1>
            <p className="hsLead">Usuarios que pertenecen a esta familia (acceso y roles).</p>
            {members === null ? (
              <p className="hsMuted">Cargando…</p>
            ) : (
              <ul className="hsList">
                {members.map((m) => (
                  <li key={m.id}>
                    <div>
                      <strong>{m.name || m.email}</strong>
                      <div className="hsMuted">{m.email}</div>
                    </div>
                    <span className="hsMuted">{m.isFamilyAdmin ? 'Admin' : '—'}</span>
                  </li>
                ))}
              </ul>
            )}
            {me.isFamilyAdmin ? (
              <>
                <h2 className="hsH1" style={{ fontSize: '1rem', marginTop: 20 }}>
                  Añadir integrante
                </h2>
                <div className="hsFieldGrid two" style={{ marginTop: 10 }}>
                  <label className="hsLabel">
                    Email
                    <input className="hsInput" value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} type="email" />
                  </label>
                  <label className="hsLabel">
                    Nombre (opcional)
                    <input className="hsInput" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} />
                  </label>
                  <label className="hsLabel" style={{ gridColumn: '1 / -1' }}>
                    Contraseña (solo si el usuario es nuevo)
                    <input
                      className="hsInput"
                      type="password"
                      value={newMemberPass}
                      onChange={(e) => setNewMemberPass(e.target.value)}
                      placeholder="Mín. 6 caracteres si creas cuenta nueva"
                    />
                  </label>
                </div>
                <div className="hsRow">
                  <button type="button" className="hsBtn hsBtnPrimary" disabled={addingMember} onClick={() => void handleAddMember()}>
                    {addingMember ? 'Añadiendo…' : 'Añadir integrante'}
                  </button>
                </div>
              </>
            ) : null}
            <div className="hsRow">
              <button type="button" className="hsBtn" onClick={() => setStep(0)}>
                Atrás
              </button>
              <button type="button" className="hsBtn hsBtnPrimary" onClick={() => setStep(2)}>
                Siguiente: destinos
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="hsCard">
            <h1 className="hsH1">2 · Hogar y destinos</h1>
            <p className="hsLead">
              El nodo <strong>Familia</strong> representa el hogar. Debajo puedes crear personas, mascotas y <strong>activos compartidos</strong>{' '}
              (supermercado, eventos, etc.). Esto alimenta el presupuesto más adelante.
            </p>
            {familyRoot ? (
              <div className="hsBanner" style={{ background: '#f0fdf4', borderColor: '#86efad' }}>
                Raíz presupuestal: <strong>{familyRoot.name}</strong> · tipo {familyRoot.type}
              </div>
            ) : (
              <div className="hsBanner warn">Aún no aparece la entidad «Familia». Guarda o recarga; el sistema la crea al crear el primer destino.</div>
            )}
            <p className="hsMuted">Ideas rápidas (rellenan el nombre y dejan tipo «Activo»):</p>
            <div className="hsChipRow">
              {['Supermercado', 'Eventos familiares', 'Hogar'].map((lbl) => (
                <button key={lbl} type="button" className="hsChip" onClick={() => applyQuickTemplate(lbl)}>
                  + {lbl}
                </button>
              ))}
            </div>
            {me.isFamilyAdmin ? (
              <>
                <div className="hsFieldGrid two" style={{ marginTop: 14 }}>
                  <label className="hsLabel">
                    Nombre del destino
                    <input className="hsInput" value={newDestName} onChange={(e) => setNewDestName(e.target.value)} placeholder="Ej. Sofía, Supermercado fam." />
                  </label>
                  <label className="hsLabel">
                    Tipo
                    <select className="hsSelect" value={newDestKind} onChange={(e) => setNewDestKind(e.target.value as typeof newDestKind)}>
                      <option value="PERSON">Persona</option>
                      <option value="ASSET">Activo / compartido</option>
                      <option value="PET">Mascota</option>
                    </select>
                  </label>
                  {newDestKind === 'PET' ? (
                    <label className="hsLabel" style={{ gridColumn: '1 / -1' }}>
                      Dueño (integrante)
                      <select className="hsSelect" value={petOwnerId} onChange={(e) => setPetOwnerId(e.target.value)}>
                        <option value="">— Elige —</option>
                        {(members || []).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name || m.email}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
                <div className="hsRow">
                  <button type="button" className="hsBtn hsBtnPrimary" disabled={addingDest || !familyRoot} onClick={() => void handleAddDestination()}>
                    {addingDest ? 'Creando…' : 'Crear destino bajo Familia'}
                  </button>
                </div>
              </>
            ) : null}
            {entities && entities.length > 0 ? (
              <>
                <h2 className="hsH1" style={{ fontSize: '1rem', marginTop: 18 }}>
                  Destinos actuales ({entities.length})
                </h2>
                <ul className="hsList">
                  {entities.slice(0, 40).map((e) => (
                    <li key={e.id}>
                      <span>
                        <strong>{e.name}</strong> · {e.type}
                      </span>
                    </li>
                  ))}
                </ul>
                {entities.length > 40 ? <p className="hsMuted">Mostrando 40; el árbol completo está en Entidades y cuentas.</p> : null}
              </>
            ) : (
              <p className="hsMuted">Aún no hay destinos.</p>
            )}
            <div className="hsRow">
              <button type="button" className="hsBtn" onClick={() => setStep(1)}>
                Atrás
              </button>
              <button type="button" className="hsBtn hsBtnPrimary" onClick={() => setStep(3)}>
                Siguiente: cosas
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="hsCard">
            <h1 className="hsH1">3 · Mis cosas</h1>
            <p className="hsLead">Inventario personal (dispositivos, vehículos, bicis). Complementa a los destinos de presupuesto.</p>
            {things === null ? (
              <p className="hsMuted">Cargando…</p>
            ) : things.length ? (
              <ul className="hsList">
                {things.map((t) => (
                  <li key={t.id}>
                    <span>
                      <strong>{t.name}</strong> · {t.type}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hsMuted">Aún no registras cosas.</p>
            )}
            <div className="hsFieldGrid two" style={{ marginTop: 12 }}>
              <label className="hsLabel">
                Tipo
                <select className="hsSelect" value={newThingType} onChange={(e) => setNewThingType(e.target.value)}>
                  {THING_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="hsLabel">
                Nombre
                <input className="hsInput" value={newThingName} onChange={(e) => setNewThingName(e.target.value)} placeholder="Ej. Laptop, Jetta" />
              </label>
            </div>
            <div className="hsRow">
              <button type="button" className="hsBtn hsBtnPrimary" disabled={addingThing} onClick={() => void handleAddThing()}>
                {addingThing ? 'Guardando…' : 'Añadir cosa'}
              </button>
            </div>
            <div className="hsRow">
              <button type="button" className="hsBtn" onClick={() => setStep(2)}>
                Atrás
              </button>
              <button type="button" className="hsBtn hsBtnPrimary" onClick={() => setStep(4)}>
                Siguiente: servicios
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="hsCard">
            <h1 className="hsH1">4 · Servicios por destino</h1>
            <p className="hsLead">
              Activa o desactiva <strong>casillas de servicio</strong> (crean cuentas con límite 0 hasta que pongas montos en Presupuesto). Elige
              primero el destino.
            </p>
            <label className="hsLabel" style={{ maxWidth: 420 }}>
              Destino
              <select
                className="hsSelect"
                value={svcEntityId || ''}
                onChange={(e) => {
                  setSvcEntityId(e.target.value)
                  setServiceItems(null)
                }}
              >
                {(entities || []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.type})
                  </option>
                ))}
              </select>
            </label>
            {svcLoading ? (
              <p className="hsMuted" style={{ marginTop: 12 }}>
                Cargando catálogo…
              </p>
            ) : serviceItems && serviceItems.length ? (
              <div style={{ marginTop: 16 }}>
                {Array.from(servicesByGroup.entries()).map(([group, items]) => (
                  <div key={String(group)}>
                    <div className="hsSvcGroup">{group || 'Otros'}</div>
                    {items.map((it) => (
                      <div key={it.serviceId} className="hsToggle">
                        <span>{it.name}</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={it.enabled}
                            disabled={!me.isFamilyAdmin || togglingSvc === it.serviceId}
                            onChange={(e) => void toggleService(it, e.target.checked)}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="hsMuted">Sin servicios o no hay entidad seleccionada.</p>
            )}
            <div className="hsRow">
              <button type="button" className="hsBtn" onClick={() => setStep(3)}>
                Atrás
              </button>
              <button type="button" className="hsBtn hsBtnPrimary" onClick={() => setStep(5)}>
                Siguiente: resumen
              </button>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="hsCard">
            <h1 className="hsH1">Listo</h1>
            <p className="hsLead">Resumen rápido de lo que hay ahora en tu hogar (sin montos).</p>
            <ul className="hsList">
              <li>
                <span>Integrantes</span>
                <strong>{members?.length ?? '—'}</strong>
              </li>
              <li>
                <span>Destinos (entidades)</span>
                <strong>{entities?.length ?? '—'}</strong>
              </li>
              <li>
                <span>Mis cosas</span>
                <strong>{things?.length ?? '—'}</strong>
              </li>
            </ul>
            <p className="hsMuted">
              Las <strong>categorías globales</strong> (supermercado, salud…) y los <strong>topes mensuales</strong> se configuran en{' '}
              <strong>Presupuesto</strong> cuando quieras.
            </p>
            <div className="hsRow">
              <button type="button" className="hsBtn" onClick={() => setStep(0)}>
                Volver al inicio del asistente
              </button>
              <Link href="/ui" className="hsBtn hsBtnPrimary" style={{ textDecoration: 'none' }}>
                Ir al panel
              </Link>
              <button type="button" className="hsBtn" onClick={() => router.push('/setup/entities')}>
                Abrir Entidades y cuentas (detalle)
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
