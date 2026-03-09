'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type MeResponse =
  | {
      ok: true
      user: { id: string; email: string; name: string | null }
      activeFamily: { id: string; name: string } | null
      isFamilyAdmin: boolean
      families: { id: string; name: string; isFamilyAdmin: boolean }[]
    }
  | { detail: string }

function isMeOk(value: MeResponse | null): value is Extract<MeResponse, { ok: true }> {
  return !!value && typeof value === 'object' && 'ok' in value && (value as any).ok === true
}

type EntityType = 'PERSON' | 'HOUSE' | 'PET' | 'VEHICLE' | 'PROJECT' | 'FUND' | 'GROUP' | 'OTHER'

const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'PERSON', label: 'Persona' },
  { value: 'HOUSE', label: 'Casa' },
  { value: 'PET', label: 'Mascota' },
  { value: 'VEHICLE', label: 'Vehículo' },
  { value: 'PROJECT', label: 'Proyecto' },
  { value: 'FUND', label: 'Fondo' },
  { value: 'GROUP', label: 'Grupo' },
  { value: 'OTHER', label: 'Otro' },
]

export default function SetupObjectsPage() {
  const router = useRouter()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [entities, setEntities] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [seeding, setSeeding] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [demoUsers, setDemoUsers] = useState<any[] | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState<EntityType>('PERSON')
  const [participatesInBudget, setParticipatesInBudget] = useState(true)
  const [participatesInReports, setParticipatesInReports] = useState(true)

  const meOk = isMeOk(me) ? me : null
  const activeFamily = meOk?.activeFamily || null

  const activeCount = useMemo(() => {
    const list = Array.isArray(entities) ? entities : []
    return list.filter((e: any) => e?.isActive).length
  }, [entities])

  async function refreshMe() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      const data = (await res.json().catch(() => ({}))) as MeResponse
      setMe(data)
    } finally {
      setLoading(false)
    }
  }

  async function refreshEntities() {
    setMessage('')
    const res = await fetch('/api/budget/entities', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data.detail || 'No se pudieron cargar los objetos presupuestales')
      return
    }
    setEntities(data.entities || [])
  }

  useEffect(() => {
    refreshMe()
  }, [])

  useEffect(() => {
    if (!meOk?.activeFamily?.id) return
    refreshEntities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meOk?.activeFamily?.id])

  async function createObject() {
    setMessage('')
    try {
      if (!name.trim()) {
        setMessage('Nombre requerido')
        return
      }
      const res = await fetch('/api/budget/entities', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          participatesInBudget,
          participatesInReports,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo crear el objeto')
      setName('')
      setParticipatesInBudget(true)
      setParticipatesInReports(true)
      await refreshEntities()
      setMessage('Objeto creado.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo crear el objeto')
    }
  }

  async function patchObject(id: string, patch: any) {
    if (savingId) return
    setMessage('')
    try {
      if (!meOk?.isFamilyAdmin) {
        setMessage('Solo un Admin puede editar objetos.')
        return
      }
      setSavingId(id)
      const res = await fetch(`/api/budget/entities/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo actualizar el objeto')
      await refreshEntities()
      setMessage('Objeto actualizado.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo actualizar el objeto')
    } finally {
      setSavingId(null)
    }
  }

  async function loadFakeData() {
    if (seeding) return
    try {
      if (!meOk) {
        setMessage('Inicia sesión primero.')
        return
      }
      if (!meOk.activeFamily?.id) {
        setMessage('Selecciona una familia.')
        return
      }
      if (!meOk.isFamilyAdmin) {
        setMessage('Solo el administrador puede cargar datos ficticios.')
        return
      }

      setSeeding(true)
      setMessage('')
      const res = await fetch('/api/dev/fake-data', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudieron cargar datos ficticios')
      setDemoUsers(Array.isArray(data.demoUsers) ? data.demoUsers : null)
      await refreshEntities()
      const n12 = data.createdTransactions12M ?? 0
      const msg = n12 > 0
        ? `Datos ficticios cargados. Se añadieron ${data.createdTransactions} transacciones (${n12} del historial de 12 meses). En Transacciones/Reportes cambia el filtro de fechas a "Todo" o "Últimos 6 meses" para verlas.`
        : data.seedHint
          ? `Datos ficticios cargados. ${data.seedHint}`
          : 'Datos ficticios cargados. Ya puedes continuar.'
      setMessage(msg)
    } catch (e: any) {
      setMessage(e?.message || 'No se pudieron cargar datos ficticios')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <main className="sapRoot">
      <div className="sapHeader setupObjectsHeader">
        <button className="btn btnGhost btnSm" type="button" onClick={() => router.push('/ui')} aria-label="Menú" style={{ marginRight: 12 }}>
          Menú
        </button>
        <div className="sapBrand" style={{ cursor: 'pointer' }} onClick={() => router.push('/ui')}>
          DOMUS+
        </div>
        <div className="sapHeaderRight">
          <span className="pill">{activeFamily ? `Familia: ${activeFamily.name}` : 'Familia: —'}</span>
          <span className={`pill ${meOk ? 'pillOk' : 'pillBad'}`}>{meOk ? 'Sesión activa' : 'Sin sesión'}</span>
        </div>
      </div>

      <div className="sapBody">
        <aside className="sapSidebar">
          <div className="muted" style={{ fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 12 }}>
            Setup
          </div>
          <div className="spacer8" />
          <button className="sapNavItem sapNavItemActive" type="button">
            Objetos presupuestales
          </button>
          <div className="spacer16" />
          <div className="muted" style={{ fontSize: 13 }}>
            Debes crear al menos <b>1 objeto activo</b> para continuar.
          </div>
          <div className="spacer8" />
          <span className={`pill ${activeCount >= 1 ? 'pillOk' : 'pillWarn'}`}>Activos: {activeCount}</span>
          <div className="spacer16" />
          <button
            className="btn btnGhost btnSm"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={loadFakeData}
            disabled={seeding}
          >
            {seeding ? 'Cargando…' : 'Cargar datos ficticios'}
          </button>
        </aside>

        <section className="sapContent">
          <div className="pageHead">
            <div>
              <h1 className="pageTitle">Setup / Objetos presupuestales</h1>
              <p className="pageSubtitle">Crea el primer objeto (Persona, Casa, Mascota, Vehículo, etc.).</p>
            </div>
            <div className="sectionRow">
              <button className="btn btnPrimary btnSm" onClick={() => router.push('/ui')} disabled={activeCount < 1}>
                Continuar
              </button>
            </div>
          </div>

          {message ? <div className="alert">{message}</div> : null}

          {!meOk ? (
            <div className="chartBox">
              <h3 className="chartTitle">No autenticado</h3>
              <div className="spacer8" />
              <div className="muted">
                Inicia sesión primero en <b>/ui</b>.
              </div>
              <div className="spacer16" />
              <button className="btn btnPrimary" onClick={() => router.push('/ui')}>
                Ir a /ui
              </button>
            </div>
          ) : !activeFamily ? (
            <div className="chartBox">
              <h3 className="chartTitle">Sin familia activa</h3>
              <div className="spacer8" />
              <div className="muted">Crea/selecciona una familia en /ui.</div>
              <div className="spacer16" />
              <button className="btn btnPrimary" onClick={() => router.push('/ui')}>
                Ir a /ui
              </button>
            </div>
          ) : (
            <>
              <div className="chartBox">
                <h3 className="chartTitle">Crear objeto</h3>
                <div className="spacer8" />
                {!meOk.isFamilyAdmin ? (
                  <div className="muted">
                    Solo un <b>Admin</b> puede crear objetos. Cambia tu rol en “Usuarios” (en /ui).
                  </div>
                ) : (
                  <div className="fieldGrid">
                    <label>
                      Nombre
                      <input className="input" placeholder="Ej. Casa, Pelusa, Auto, Fondo Ahorro..." value={name} onChange={(e) => setName(e.target.value)} />
                    </label>
                    <label>
                      Tipo
                      <select className="select" value={type} onChange={(e) => setType(e.target.value as EntityType)}>
                        {ENTITY_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="checkboxRow">
                      <input type="checkbox" checked={participatesInBudget} onChange={(e) => setParticipatesInBudget(e.target.checked)} />
                      Participa en presupuesto
                    </label>
                    <label className="checkboxRow">
                      <input type="checkbox" checked={participatesInReports} onChange={(e) => setParticipatesInReports(e.target.checked)} />
                      Participa en reportes
                    </label>
                    <div className="sectionRow">
                      <button className="btn btnPrimary" onClick={createObject} disabled={loading || !name.trim()}>
                        Crear
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="spacer16" />

              <div className="chartBox">
                <h3 className="chartTitle">Objetos existentes</h3>
                <div className="spacer8" />
                {Array.isArray(entities) ? (
                  entities.length ? (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Nombre</th>
                          <th>Presupuesto</th>
                          <th>Reportes</th>
                          <th>Activo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entities.map((e: any) => (
                          <tr key={e.id}>
                            <td>{e.type}</td>
                            <td style={{ fontWeight: 900 }}>{e.name}</td>
                            <td className="muted">
                              {meOk.isFamilyAdmin ? (
                                <input
                                  type="checkbox"
                                  checked={e.participatesInBudget !== false}
                                  disabled={savingId === e.id}
                                  onChange={(ev) => patchObject(e.id, { participatesInBudget: ev.target.checked })}
                                />
                              ) : e.participatesInBudget ? (
                                'Sí'
                              ) : (
                                'No'
                              )}
                            </td>
                            <td className="muted">
                              {meOk.isFamilyAdmin ? (
                                <input
                                  type="checkbox"
                                  checked={e.participatesInReports !== false}
                                  disabled={savingId === e.id}
                                  onChange={(ev) => patchObject(e.id, { participatesInReports: ev.target.checked })}
                                />
                              ) : e.participatesInReports ? (
                                'Sí'
                              ) : (
                                'No'
                              )}
                            </td>
                            <td className="muted">
                              {meOk.isFamilyAdmin ? (
                                <input
                                  type="checkbox"
                                  checked={e.isActive !== false}
                                  disabled={savingId === e.id}
                                  onChange={(ev) => patchObject(e.id, { isActive: ev.target.checked })}
                                />
                              ) : e.isActive ? (
                                'Sí'
                              ) : (
                                'No'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="muted">Aún no hay objetos. Crea el primero para continuar.</div>
                  )
                ) : (
                  <div className="muted">Cargando objetos…</div>
                )}
              </div>

              {Array.isArray(demoUsers) && demoUsers.length ? (
                <>
                  <div className="spacer16" />
                  <div className="chartBox">
                    <h3 className="chartTitle">Usuarios demo</h3>
                    <div className="spacer8" />
                    <div className="muted">Inicia sesión con estos datos en otra pestaña (para probar roles).</div>
                    <div className="spacer8" />
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Email</th>
                          <th>Contraseña</th>
                          <th>Rol</th>
                        </tr>
                      </thead>
                      <tbody>
                        {demoUsers.map((u: any) => (
                          <tr key={String(u.email || u.name || Math.random())}>
                            <td style={{ fontWeight: 900 }}>{u.name || '—'}</td>
                            <td className="muted">{u.email || '—'}</td>
                            <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{u.password || '—'}</td>
                            <td className="muted">{u.isFamilyAdmin ? 'Admin' : 'Integrante'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  )
}

