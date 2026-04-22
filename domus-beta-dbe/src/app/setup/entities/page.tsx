'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import './entities-config.css'

type MeResponse =
  | {
      ok: true
      user: { id: string; email: string; name: string | null }
      activeFamily: { id: string; name: string } | null
      isFamilyAdmin: boolean
    }
  | { detail: string }

type ApiEntity = {
  id: string
  type: string
  subtype: string | null
  parentId: string | null
  ownerEntityId: string | null
  name: string
  isActive: boolean
  owners?: { userId: string; user: { name: string | null; email: string } }[]
}

type ServiceItem = {
  serviceId: string
  name: string
  categoryGroup: string | null
  enabled: boolean
}

function isMeOk(value: MeResponse | null): value is Extract<MeResponse, { ok: true }> {
  return !!value && typeof value === 'object' && 'ok' in value && (value as { ok?: boolean }).ok === true
}

const TYPE_LABEL: Record<string, string> = {
  FAMILY: 'Familia',
  PERSON: 'Persona',
  ASSET: 'Activo',
  PET: 'Mascota',
}

function buildChildrenMap(entities: ApiEntity[]) {
  const byParent = new Map<string | null, ApiEntity[]>()
  for (const e of entities) {
    const p = e.parentId
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p)!.push(e)
  }
  for (const [, list] of byParent) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
  }
  return byParent
}

function collectDescendantIds(entityId: string, byParent: Map<string | null, ApiEntity[]>, acc: Set<string>) {
  const kids = byParent.get(entityId) || []
  for (const c of kids) {
    acc.add(c.id)
    collectDescendantIds(c.id, byParent, acc)
  }
}

type TreeBranchProps = {
  node: ApiEntity
  depth: number
  selectedId: string | null
  byParent: Map<string | null, ApiEntity[]>
  expanded: Record<string, boolean>
  typeLabel: Record<string, string>
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
}

function TreeBranch({ node, depth, selectedId, byParent, expanded, typeLabel, onSelect, onToggleExpand }: TreeBranchProps) {
  const children = byParent.get(node.id) || []
  const hasKids = children.length > 0
  const isOpen = expanded[node.id] ?? true
  const sel = selectedId === node.id

  return (
    <li>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {hasKids ? (
          <button
            type="button"
            className="ecTwist"
            aria-expanded={isOpen}
            onClick={(ev) => {
              ev.stopPropagation()
              onToggleExpand(node.id)
            }}
            title={isOpen ? 'Contraer' : 'Expandir'}
          >
            {isOpen ? '▾' : '▸'}
          </button>
        ) : (
          <span className="ecTwistPlaceholder" />
        )}
        <button
          type="button"
          className={`ecTreeNodeBtn ${sel ? 'ecTreeNodeSelected' : ''}`}
          onClick={() => onSelect(node.id)}
          title={node.name}
        >
          <span className="ecTreeLabel">
            {node.name}
            <span className="ecMuted"> · {typeLabel[node.type] || node.type}</span>
          </span>
        </button>
      </div>
      {hasKids && isOpen ? (
        <ul>
          {children.map((ch) => (
            <TreeBranch
              key={ch.id}
              node={ch}
              depth={depth + 1}
              selectedId={selectedId}
              byParent={byParent}
              expanded={expanded}
              typeLabel={typeLabel}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export default function EntitiesConfigPage() {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [entities, setEntities] = useState<ApiEntity[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState<{
    name: string
    subtype: string
    parentId: string
    ownerEntityId: string
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [serviceItems, setServiceItems] = useState<ServiceItem[] | null>(null)
  const [servicesLoading, setServicesLoading] = useState(false)
  const [togglingServiceId, setTogglingServiceId] = useState<string | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)

  const meOk = isMeOk(me) ? me : null

  const refreshMe = useCallback(async () => {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    const data = (await res.json().catch(() => ({}))) as MeResponse
    setMe(data)
  }, [])

  const refreshEntities = useCallback(async () => {
    setMessage('')
    const res = await fetch('/api/budget/entities', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data.detail || 'No se pudieron cargar las entidades')
      setEntities([])
      return
    }
    setEntities(Array.isArray(data.entities) ? data.entities : [])
  }, [])

  const loadAssignments = useCallback(
    async (entityId: string) => {
      setServicesLoading(true)
      try {
        const res = await fetch(`/api/budget/entities/${entityId}/services`, { credentials: 'include' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setServiceItems([])
          setMessage(data.detail || 'No se pudieron cargar los servicios')
          return
        }
        const items = Array.isArray(data.items) ? data.items : []
        setServiceItems(
          items.map((r: { serviceId: string; name: string; categoryGroup: string | null; enabled: boolean }) => ({
            serviceId: r.serviceId,
            name: r.name,
            categoryGroup: r.categoryGroup,
            enabled: r.enabled,
          })),
        )
      } finally {
        setServicesLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await refreshMe()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [refreshMe])

  useEffect(() => {
    if (!meOk?.activeFamily?.id) return
    refreshEntities()
  }, [meOk?.activeFamily?.id, refreshEntities])

  const byId = useMemo(() => {
    const m = new Map<string, ApiEntity>()
    if (!entities) return m
    for (const e of entities) m.set(e.id, e)
    return m
  }, [entities])

  const byParent = useMemo(() => (entities ? buildChildrenMap(entities) : new Map<string | null, ApiEntity[]>()), [entities])

  const selected = selectedId ? byId.get(selectedId) : undefined

  useEffect(() => {
    if (!selectedId) {
      setServiceItems(null)
      return
    }
    loadAssignments(selectedId)
  }, [selectedId, loadAssignments])

  /** Expandir ancestros al seleccionar para que el nodo sea visible */
  useEffect(() => {
    if (!selectedId || !entities) return
    let id: string | null = selectedId
    const next: Record<string, boolean> = {}
    while (id) {
      const ent = byId.get(id)
      if (ent?.parentId) {
        next[ent.parentId] = true
        id = ent.parentId
      } else break
    }
    if (Object.keys(next).length) setExpanded((prev) => ({ ...prev, ...next }))
  }, [selectedId, entities, byId])

  const toggleExpand = useCallback((id: string) => {
    setExpanded((e) => {
      const cur = e[id] ?? true
      return { ...e, [id]: !cur }
    })
  }, [])

  async function loadDemoTree() {
    if (!meOk?.isFamilyAdmin) return
    setPreviewBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/dev/seed-entities-preview', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { detail?: string }).detail || 'No se pudo cargar la vista previa')
      setMessage(
        `Demo: ${(data as { createdEntities?: number }).createdEntities ?? 0} entidades nuevas, ` +
          `${(data as { skipped?: number }).skipped ?? 0} ya existían; ` +
          `${(data as { linkedServices?: number }).linkedServices ?? 0} enlaces servicio/cuenta (límite 0). Recarga el árbol abajo.`,
      )
      await refreshEntities()
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Error')
    } finally {
      setPreviewBusy(false)
    }
  }

  function startEdit() {
    if (!selected) return
    setEditDraft({
      name: selected.name,
      subtype: selected.subtype || '',
      parentId: selected.parentId || '',
      ownerEntityId: selected.ownerEntityId || '',
    })
    setEditing(true)
  }

  async function saveEdit() {
    if (!selected || !editDraft || !meOk?.isFamilyAdmin) return
    setSaving(true)
    setMessage('')
    try {
      const patch: Record<string, unknown> = {
        name: editDraft.name.trim(),
        subtype: editDraft.subtype.trim() || null,
      }
      if (selected.type !== 'FAMILY') {
        patch.parentId = editDraft.parentId === '' ? null : editDraft.parentId
      }
      if (selected.type === 'ASSET' || selected.type === 'PET') {
        patch.ownerEntityId = editDraft.ownerEntityId === '' ? null : editDraft.ownerEntityId
      }

      const res = await fetch(`/api/budget/entities/${selected.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo guardar')
      setEditing(false)
      setEditDraft(null)
      await refreshEntities()
      setMessage('Cambios guardados.')
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function toggleEntityActive() {
    if (!selected || !meOk?.isFamilyAdmin) return
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch(`/api/budget/entities/${selected.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !selected.isActive }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo actualizar')
      await refreshEntities()
      setMessage('Estado actualizado.')
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleService(svc: ServiceItem, on: boolean) {
    if (!selectedId || !meOk?.isFamilyAdmin || togglingServiceId) return
    setTogglingServiceId(svc.serviceId)
    setMessage('')
    try {
      const res = await fetch(`/api/budget/entities/${selectedId}/services`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ serviceId: svc.serviceId, enabled: on }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'No se pudo actualizar el servicio')
      setServiceItems((prev) =>
        prev
          ? prev.map((r) => (r.serviceId === svc.serviceId ? { ...r, enabled: on } : r))
          : prev,
      )
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Error')
    } finally {
      setTogglingServiceId(null)
    }
  }

  const parentOptions = useMemo(() => {
    if (!entities || !selected) return []
    const excluded = new Set<string>([selected.id])
    collectDescendantIds(selected.id, byParent, excluded)
    return entities
      .filter((e) => !excluded.has(e.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [entities, selected, byParent])

  const ownerEntityOptions = useMemo(() => {
    if (!entities) return []
    return entities.filter((e) => e.type === 'FAMILY' || e.type === 'PERSON').sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [entities])

  const ownerLabel = (e: ApiEntity | undefined) => {
    if (!e) return '—'
    if (e.ownerEntityId) {
      const oe = byId.get(e.ownerEntityId)
      return oe ? oe.name : e.ownerEntityId
    }
    if (e.owners && e.owners.length) {
      return e.owners.map((o) => o.user.name || o.user.email).join(', ')
    }
    return '—'
  }

  const roots = byParent.get(null) || []

  if (loading) {
    return (
      <div className="ecRoot">
        <div className="ecShell ecMuted">Cargando…</div>
      </div>
    )
  }

  if (!meOk?.activeFamily) {
    return (
      <div className="ecRoot">
        <div className="ecShell">
          <p className="ecMuted">Selecciona una familia en la aplicación para configurar entidades.</p>
          <Link href="/ui" className="ecBtn" style={{ marginTop: 12, display: 'inline-block' }}>
            Ir al panel
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="ecRoot">
      <div className="ecShell">
        <div className="ecTitleRow">
          <h1 className="ecTitle">Configuración de entidades</h1>
          <Link href="/setup/objects" className="ecMuted" style={{ fontSize: 12 }}>
            Partidas y objetos
          </Link>
        </div>

        <div className="ecHelpPanel" style={{ marginBottom: 14 }}>
          <p className="ecHelpText">
            <strong>Tres columnas:</strong> (1) árbol de destinos bajo <strong>Familia</strong> — (2) datos de la entidad elegida — (3){' '}
            <strong>servicios del catálogo</strong> (casillas; crean cuentas con límite 0 hasta que pongas montos en Presupuesto).             Para un
            recorrido guiado sin montos usa{' '}
            <Link href="/setup/hogar" className="ecLink">
              Configurar el hogar
            </Link>
            . Si solo quieres el formulario con tipos (Persona/Vehículo…):{' '}
            <Link href="/setup/objects" className="ecLink">
              Destinos (objetos)
            </Link>
            .
          </p>
          {meOk.isFamilyAdmin ? (
            <div className="ecHelpActions">
              <button type="button" className="ecBtn ecBtnPrimary" disabled={previewBusy} onClick={() => void loadDemoTree()}>
                {previewBusy ? 'Cargando…' : 'Cargar árbol demo (DOMUS-demo ·…)'}
              </button>
              <span className="ecMuted" style={{ fontSize: 12, alignSelf: 'center' }}>
                Añade personas, casa, supermercado, auto y mascota de ejemplo bajo Familia + servicios. No borra datos; nombres con prefijo
                «DOMUS-demo ·».
              </span>
            </div>
          ) : null}
        </div>

        {!meOk.isFamilyAdmin ? (
          <div className="ecBanner">Solo el administrador de la familia puede editar entidades y asignar servicios.</div>
        ) : null}

        {message ? (
          <div className="ecBanner" style={{ background: '#f0f7ff', borderColor: '#b8d4f0' }}>
            {message}
          </div>
        ) : null}

        <div className="ecGrid">
          <div className="ecPanel">
            <div className="ecPanelHd">Jerarquía</div>
            <div className="ecPanelBody" style={{ overflowX: 'hidden' }}>
              {entities === null ? (
                <div className="ecEmpty">Cargando…</div>
              ) : roots.length === 0 ? (
                <div className="ecEmpty">Sin entidades</div>
              ) : (
                <ul className="ecTree">
                  {roots.map((n) => (
                    <TreeBranch
                      key={n.id}
                      node={n}
                      depth={0}
                      selectedId={selectedId}
                      byParent={byParent}
                      expanded={expanded}
                      typeLabel={TYPE_LABEL}
                      onSelect={setSelectedId}
                      onToggleExpand={toggleExpand}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="ecPanel">
            <div className="ecPanelHd">Detalle</div>
            <div className="ecPanelBody">
              {!selected ? (
                <div className="ecEmpty">Selecciona una entidad en el árbol.</div>
              ) : editing && editDraft ? (
                <div>
                  <dl className="ecDl">
                    <dt>Tipo</dt>
                    <dd>{TYPE_LABEL[selected.type] || selected.type}</dd>
                  </dl>
                  <div className="ecEditGrid">
                    <label>
                      Nombre
                      <input
                        className="ecInput"
                        value={editDraft.name}
                        onChange={(e) => setEditDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                      />
                    </label>
                    <label>
                      Subtipo
                      <input
                        className="ecInput"
                        value={editDraft.subtype}
                        onChange={(e) => setEditDraft((d) => (d ? { ...d, subtype: e.target.value } : d))}
                        disabled={selected.type === 'FAMILY'}
                        placeholder="—"
                      />
                    </label>
                    {selected.type !== 'FAMILY' ? (
                      <label>
                        Entidad padre
                        <select
                          className="ecSelect"
                          value={editDraft.parentId}
                          onChange={(e) => setEditDraft((d) => (d ? { ...d, parentId: e.target.value } : d))}
                        >
                          <option value="">— Ninguna —</option>
                          {parentOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({TYPE_LABEL[p.type] || p.type})
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {selected.type === 'ASSET' || selected.type === 'PET' ? (
                      <label>
                        Propietario (entidad)
                        <select
                          className="ecSelect"
                          value={editDraft.ownerEntityId}
                          onChange={(e) => setEditDraft((d) => (d ? { ...d, ownerEntityId: e.target.value } : d))}
                        >
                          <option value="">—</option>
                          {ownerEntityOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  <div className="ecActions">
                    <button type="button" className="ecBtn ecBtnPrimary" disabled={saving} onClick={() => void saveEdit()}>
                      {saving ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button
                      type="button"
                      className="ecBtn"
                      disabled={saving}
                      onClick={() => {
                        setEditing(false)
                        setEditDraft(null)
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <dl className="ecDl">
                    <dt>Nombre</dt>
                    <dd>{selected.name}</dd>
                    <dt>Tipo</dt>
                    <dd>{TYPE_LABEL[selected.type] || selected.type}</dd>
                    <dt>Subtipo</dt>
                    <dd>{selected.subtype || '—'}</dd>
                    <dt>Padre</dt>
                    <dd>{selected.parentId ? byId.get(selected.parentId)?.name || '—' : '—'}</dd>
                    <dt>Propietario</dt>
                    <dd>{ownerLabel(selected)}</dd>
                    <dt>Activa</dt>
                    <dd>{selected.isActive ? 'Sí' : 'No'}</dd>
                  </dl>
                  {meOk.isFamilyAdmin ? (
                    <div className="ecActions">
                      <button type="button" className="ecBtn" onClick={startEdit} disabled={saving}>
                        Editar
                      </button>
                      {selected.type !== 'FAMILY' ? (
                        <button type="button" className="ecBtn" onClick={() => void toggleEntityActive()} disabled={saving}>
                          {selected.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="ecPanel">
            <div className="ecPanelHd">Servicios (catálogo)</div>
            <div className="ecPanelBody">
              {!selectedId ? (
                <div className="ecEmpty">Selecciona una entidad.</div>
              ) : servicesLoading || serviceItems === null ? (
                <div className="ecEmpty">Cargando…</div>
              ) : (
                serviceItems.map((row) => (
                  <div key={row.serviceId} className="ecServiceRow">
                    <label>
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        disabled={!meOk.isFamilyAdmin || togglingServiceId === row.serviceId}
                        onChange={(e) => void toggleService(row, e.target.checked)}
                      />
                      <span style={{ minWidth: 0 }}>
                        {row.name}
                        {row.categoryGroup ? (
                          <span className="ecServiceCat">{row.categoryGroup}</span>
                        ) : null}
                      </span>
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
