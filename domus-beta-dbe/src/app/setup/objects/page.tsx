'use client'

import Link from 'next/link'
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
  const [clearingFakeData, setClearingFakeData] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [demoUsers, setDemoUsers] = useState<any[] | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState<EntityType>('PERSON')
  const [customTypeId, setCustomTypeId] = useState<string | null>(null)
  const [customTypes, setCustomTypes] = useState<{ id: string; name: string }[]>([])
  const [customTypeCreateOpen, setCustomTypeCreateOpen] = useState(false)
  const [customTypeNewName, setCustomTypeNewName] = useState('')
  const [customTypeCreating, setCustomTypeCreating] = useState(false)
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

  async function refreshCustomTypes() {
    const res = await fetch('/api/budget/custom-types', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    setCustomTypes(Array.isArray(data?.types) ? data.types : [])
  }

  async function createCustomType() {
    if (!customTypeNewName.trim() || customTypeCreating) return
    setCustomTypeCreating(true)
    setMessage('')
    try {
      const res = await fetch('/api/budget/custom-types', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: customTypeNewName.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo crear el tipo')
      const newType = data?.type
      if (newType?.id) {
        setCustomTypes((prev) => [...prev, { id: newType.id, name: newType.name }].sort((a, b) => a.name.localeCompare(b.name)))
        setType('OTHER')
        setCustomTypeId(newType.id)
        setCustomTypeNewName('')
        setCustomTypeCreateOpen(false)
        setMessage(`Tipo "${newType.name}" creado. Escribe el nombre del objeto y pulsa Crear.`)
      }
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo crear el tipo')
    } finally {
      setCustomTypeCreating(false)
    }
  }

  useEffect(() => {
    refreshMe()
  }, [])

  useEffect(() => {
    if (!meOk?.activeFamily?.id) return
    refreshEntities()
    refreshCustomTypes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meOk?.activeFamily?.id])

  async function createObject() {
    setMessage('')
    try {
      if (!name.trim()) {
        setMessage('Nombre requerido')
        return
      }
      const payload: { name: string; type: EntityType; participatesInBudget: boolean; participatesInReports: boolean; customTypeId?: string } = {
        name,
        type: customTypeId ? 'OTHER' : type,
        participatesInBudget,
        participatesInReports,
      }
      if (customTypeId) payload.customTypeId = customTypeId
      const res = await fetch('/api/budget/entities', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo crear el objeto')
      setName('')
      setCustomTypeId(null)
      setType('PERSON')
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

  async function clearFakeData() {
    if (clearingFakeData) return
    if (meOk?.user?.email !== 'gonzalomail@me.com') {
      setMessage('Solo el super administrador puede eliminar datos ficticios.')
      return
    }
    try {
      setClearingFakeData(true)
      setMessage('')
      const res = await fetch('/api/dev/clear-fake-data', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudieron eliminar los datos ficticios')
      setDemoUsers(null)
      await refreshEntities()
      const d = data.deleted || {}
      const msg = data.message || (d.users > 0
        ? `Eliminados ${d.users} usuarios demo, ${d.transactions ?? 0} transacciones, ${d.receipts ?? 0} recibos. Listo para producción.`
        : 'No había datos ficticios.')
      setMessage(msg)
    } catch (e: any) {
      setMessage(e?.message || 'No se pudieron eliminar los datos ficticios')
    } finally {
      setClearingFakeData(false)
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

      <div className="sapBody setupObjectsBody">
        <aside className="sapSidebar setupSidebar">
          <nav aria-label="Presupuesto">
            <div className="setupBreadcrumb muted" style={{ fontSize: 12, marginBottom: 12 }}>
              <Link href="/ui" className="setupBreadcrumbLink">Presupuesto</Link>
              <span aria-hidden> › </span>
              <span>Destinos</span>
            </div>
            <button className="sapNavItem sapNavItemActive" type="button">
              Destinos
            </button>
          </nav>
          <div className="spacer16" />
          <div className="muted" style={{ fontSize: 13 }}>
            La configuración principal está en <Link href="/ui" className="setupBreadcrumbLink">/ui → Presupuesto</Link>. Esta página es opcional: al menos <b>1 destino activo</b> para usar presupuesto.
          </div>
          <div className="spacer8" />
          <span className={`pill ${activeCount >= 1 ? 'pillOk' : 'pillWarn'}`}>Activos: {activeCount}</span>
          <div className="spacer24" />
            <div className="setupSidebarActions">
            <button
              className="btn btnPrimary"
              style={{ width: '100%', justifyContent: 'center', minHeight: 44 }}
              type="button"
              onClick={() => router.push('/setup/hogar')}
            >
              Configurar el hogar (recomendado)
            </button>
            <p className="muted" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
              Pasos sin montos: integrantes, destinos, cosas, servicios.
            </p>
            <div className="spacer8" />
            <button
              className="btn btnGhost"
              style={{ width: '100%', justifyContent: 'center', minHeight: 40 }}
              type="button"
              onClick={() => router.push('/setup/entities')}
            >
              Árbol y servicios (avanzado)
            </button>
            <div className="spacer8" />
            <button
              className="btn btnGhost"
              style={{ width: '100%', justifyContent: 'center', minHeight: 44 }}
              onClick={() => router.push('/onboarding')}
            >
              Asistente multimedia (onboarding)
            </button>
            <p className="muted" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
              Wizard: integrantes, mascotas, vehículos, electrodomésticos, categorías.
            </p>
          </div>
          <div className="spacer16" />
          <button
            className="btn btnGhost btnSm"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={loadFakeData}
            disabled={seeding}
          >
            {seeding ? 'Cargando…' : 'Cargar datos ficticios'}
          </button>
          {meOk?.user?.email === 'gonzalomail@me.com' && (
            <button
              className="btn btnGhost btnSm"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              onClick={clearFakeData}
              disabled={clearingFakeData}
            >
              {clearingFakeData ? 'Eliminando…' : 'Eliminar datos ficticios'}
            </button>
          )}
        </aside>

        <section className="sapContent">
          <div className="pageHead">
            <div>
              <p className="muted setupBreadcrumbInContent" style={{ fontSize: 12, marginBottom: 4 }}>
                <Link href="/ui" className="setupBreadcrumbLink">Presupuesto</Link>
                <span aria-hidden> › </span>
                <span>Destinos</span>
              </p>
              <h1 className="pageTitle">Destinos</h1>
              <p className="pageSubtitle">Crea y edita destinos presupuestales (Persona, Casa, Mascota, Vehículo, etc.). Lo habitual es hacerlo desde /ui → Presupuesto.</p>
            </div>
            <div className="sectionRow">
              <button className="btn btnGhost btnSm" onClick={() => router.push('/ui')}>
                Volver a inicio
              </button>
            </div>
          </div>

          <div className="chartBox" style={{ borderColor: '#b8d4f0', background: '#f7fbff' }}>
            <h3 className="chartTitle" style={{ fontSize: 15, marginBottom: 8 }}>
              ¿Varias pantallas para “lo mismo”?
            </h3>
            <p className="muted" style={{ marginBottom: 10, lineHeight: 1.5 }}>
              En el fondo es <strong>un solo modelo</strong>: destinos = <strong>entidades</strong> (Familia, personas, casa, auto…). Hay varias
              <em> entradas</em> según cómo prefieras trabajar; no hace falta usarlas todas.
            </p>
            <ol style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 14, lineHeight: 1.55 }}>
              <li>
                <strong>Recomendado:</strong>{' '}
                <Link href="/setup/hogar" className="setupBreadcrumbLink">
                  Configurar el hogar
                </Link>{' '}
                — orden guiado, sin montos.
              </li>
              <li>
                <strong>Árbol + servicios:</strong>{' '}
                <Link href="/setup/entities" className="setupBreadcrumbLink">
                  Entidades y cuentas
                </Link>{' '}
                — jerarquía y casillas del catálogo por destino.
              </li>
              <li>
                <strong>Esta página:</strong> formulario rápido con <em>tipo</em> (Persona, Vehículo…) y tipos personalizados. Es la misma API
                que el asistente; solo cambia la forma.
              </li>
            </ol>
            <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
              Los <strong>montos</strong> y ciclos se configuran siempre en{' '}
              <Link href="/ui" className="setupBreadcrumbLink">
                /ui → Presupuesto
              </Link>
              .
            </p>
          </div>
          <div className="spacer16" />

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
                      <input
                        className="input"
                        placeholder={type === 'OTHER' ? 'Ej. Electrodoméstico, Negocio, ...' : 'Ej. Casa, Pelusa, Auto, Fondo Ahorro...'}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <label>
                      Tipo
                      <select
                        className="select"
                        value={customTypeId ? `custom:${customTypeId}` : type}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v.startsWith('custom:')) {
                            setType('OTHER')
                            setCustomTypeId(v.slice(7))
                          } else {
                            setType(v as EntityType)
                            setCustomTypeId(null)
                          }
                        }}
                      >
                        {ENTITY_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                        {customTypes.length > 0 ? (
                          <>
                            <option disabled>—</option>
                            {customTypes.map((t) => (
                              <option key={t.id} value={`custom:${t.id}`}>
                                {t.name}
                              </option>
                            ))}
                          </>
                        ) : null}
                      </select>
                      {type === 'OTHER' && !customTypeId ? (
                        <p className="muted" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                          <strong>Otro</strong> es la excepción: escribe en <strong>Nombre</strong> el detalle o crea un tipo abajo.
                        </p>
                      ) : null}
                      {meOk?.isFamilyAdmin ? (
                        <div style={{ marginTop: 8 }}>
                          {!customTypeCreateOpen ? (
                            <button type="button" className="btn btnGhost btnSm" onClick={() => setCustomTypeCreateOpen(true)}>
                              + Crear tipo
                            </button>
                          ) : (
                            <div className="sectionRow" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                              <input
                                className="input"
                                placeholder="Nombre del tipo (ej. Electrodoméstico)"
                                value={customTypeNewName}
                                onChange={(e) => setCustomTypeNewName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), createCustomType())}
                                style={{ maxWidth: 220 }}
                              />
                              <button type="button" className="btn btnPrimary btnSm" onClick={createCustomType} disabled={!customTypeNewName.trim() || customTypeCreating}>
                                {customTypeCreating ? 'Creando…' : 'Crear tipo'}
                              </button>
                              <button type="button" className="btn btnGhost btnSm" onClick={() => { setCustomTypeCreateOpen(false); setCustomTypeNewName(''); setMessage(''); }}>
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      ) : null}
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
                            <td>{e.customType?.name || e.type}</td>
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

