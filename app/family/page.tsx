 'use client'
 
import { useEffect, useMemo, useState } from 'react'
 import { useRouter } from 'next/navigation'
 import SAPLayout from '@/components/SAPLayout'
 import type { User } from '@/lib/types'
import { supabase } from '@/lib/supabase/client'
import { getAuthHeaders } from '@/lib/auth'

 type Family = {
   id: number
   name: string
   admin_id?: string
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
   members?: User[]
 }

 export const dynamic = 'force-dynamic'

 export default function FamilyPage() {
   const router = useRouter()
   const [user, setUser] = useState<User | null>(null)
   const [family, setFamily] = useState<Family | null>(null)
   const [loading, setLoading] = useState(true)
   const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
   const [familyName, setFamilyName] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('')
  const [editName, setEditName] = useState('')
  const [editAddressLine1, setEditAddressLine1] = useState('')
  const [editAddressLine2, setEditAddressLine2] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editState, setEditState] = useState('')
  const [editPostalCode, setEditPostalCode] = useState('')
  const [editCountry, setEditCountry] = useState('')
   const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
   const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberPhone, setMemberPhone] = useState('')
  const [memberPassword, setMemberPassword] = useState('')
  const [memberError, setMemberError] = useState('')
  const [memberSuccess, setMemberSuccess] = useState('')
  const [creatingMember, setCreatingMember] = useState(false)
  const [showEditMember, setShowEditMember] = useState(false)
  const [selectedMember, setSelectedMember] = useState<User | null>(null)
  const [memberEditName, setMemberEditName] = useState('')
  const [memberEditPhone, setMemberEditPhone] = useState('')
  const [memberEditIsActive, setMemberEditIsActive] = useState(true)
  const [memberEditIsAdmin, setMemberEditIsAdmin] = useState(false)
  const [memberEditError, setMemberEditError] = useState('')
  const [memberEditSaving, setMemberEditSaving] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [showDeleteMember, setShowDeleteMember] = useState(false)
  const [memberDeleteError, setMemberDeleteError] = useState('')
  const [memberDeleteSaving, setMemberDeleteSaving] = useState(false)
 
   const title = 'Familia'
   const subtitle = 'Configura tu familia y sus integrantes'
 
   const defaultFamilyName = useMemo(() => {
     if (!user) return 'Mi Familia'
     const base = user.name || user.email?.split('@')[0] || 'Usuario'
     return `Familia de ${base}`
   }, [user])

  const members = family?.members ?? []
  const totalMembers = members.length
  const adminCount = members.filter((member) => member.is_family_admin).length
  const activeCount = members.filter((member) => member.is_active).length
  const inactiveCount = totalMembers - activeCount
  const filteredMembers = members.filter((member) => {
    const query = memberSearch.trim().toLowerCase()
    if (!query) return true
    const name = (member.name || '').toLowerCase()
    const email = (member.email || '').toLowerCase()
    const phone = (member.phone || '').toLowerCase()
    return name.includes(query) || email.includes(query) || phone.includes(query)
  })
 
   const loadUser = async () => {
    const headers = await getAuthHeaders()
    const res = await fetch('/api/users/me', {
      credentials: 'include',
      headers: headers as Record<string, string>,
    })
     if (!res.ok) {
      if (res.status === 401) {
        setError('Sesión expirada. Inicia sesión de nuevo.')
      }
       setUser(null)
       setFamily(null)
       setLoading(false)
       return
     }
     const data = await res.json()
     setUser(data)
     return data as User
   }
 
   const loadFamily = async () => {
    const headers = await getAuthHeaders()
    const res = await fetch('/api/families', {
      credentials: 'include',
      headers,
    })
     if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.detail || 'No se pudo cargar la familia')
       setFamily(null)
       return
     }
     const data = await res.json().catch(() => null)
     setFamily(data && data.id ? data : null)
   }
 
   useEffect(() => {
     let isMounted = true
     ;(async () => {
       try {
         const currentUser = await loadUser()
         if (!isMounted) return
         if (currentUser?.family_id) {
           await loadFamily()
         } else {
           setFamily(null)
         }
       } finally {
         if (isMounted) setLoading(false)
       }
     })()
     return () => {
       isMounted = false
     }
   }, [])
 
   const handleCreateFamily = async () => {
     if (creating) return
     setCreating(true)
     setError('')
    setSuccess('')
     try {
       const name = familyName.trim() || defaultFamilyName
       const authHeaders = await getAuthHeaders()
       const res = await fetch('/api/families', {
         method: 'POST',
         credentials: 'include',
         headers: {
           'Content-Type': 'application/json',
           ...(authHeaders || {}),
         },
        body: JSON.stringify({
          name,
          address_line1: addressLine1.trim(),
          address_line2: addressLine2.trim(),
          city: city.trim(),
          state: state.trim(),
          postal_code: postalCode.trim(),
          country: country.trim(),
        }),
       })
       const data = await res.json().catch(() => ({}))
       if (!res.ok) {
         setError(data.detail || 'No se pudo crear la familia')
         return
       }
       setShowCreate(false)
       setFamilyName('')
      setAddressLine1('')
      setAddressLine2('')
      setCity('')
      setState('')
      setPostalCode('')
      setCountry('')
      setSuccess('Familia creada correctamente.')
       await loadUser()
       await loadFamily()
       router.refresh()
     } catch (err: unknown) {
       const msg = err instanceof Error ? err.message : 'Error al crear familia'
       setError(msg)
     } finally {
       setCreating(false)
     }
   }

  const handleOpenEdit = () => {
    if (!family) return
    setEditName(family.name)
    setEditAddressLine1(family.address_line1 || '')
    setEditAddressLine2(family.address_line2 || '')
    setEditCity(family.city || '')
    setEditState(family.state || '')
    setEditPostalCode(family.postal_code || '')
    setEditCountry(family.country || '')
    setError('')
    setSuccess('')
    setShowEdit(true)
  }

  const handleUpdateFamily = async () => {
    if (!family || saving) return
    const name = editName.trim()
    if (!name) {
      setError('El nombre es requerido')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(`/api/families/${family.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeaders || {}),
        },
        body: JSON.stringify({
          name,
          address_line1: editAddressLine1.trim(),
          address_line2: editAddressLine2.trim(),
          city: editCity.trim(),
          state: editState.trim(),
          postal_code: editPostalCode.trim(),
          country: editCountry.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.detail || 'No se pudo actualizar la familia')
        return
      }
      setShowEdit(false)
      setSuccess('Familia actualizada.')
      await loadFamily()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar familia'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteFamily = async () => {
    if (!family || deleting) return
    setDeleting(true)
    setError('')
    setSuccess('')
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(`/api/families/${family.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.detail || 'No se pudo eliminar la familia')
        return
      }
      setShowDelete(false)
      setFamily(null)
      setSuccess('Familia eliminada.')
      await loadUser()
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar familia'
      setError(msg)
    } finally {
      setDeleting(false)
    }
  }

  const handleCreateMember = async () => {
    if (!family || creatingMember) return
    setMemberError('')
    setMemberSuccess('')
    setError('')
    setSuccess('')
    if (!memberName.trim() || !memberEmail.trim() || !memberPhone.trim() || !memberPassword.trim()) {
      setMemberError('Completa nombre, email, teléfono y contraseña.')
      return
    }
    setCreatingMember(true)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch('/api/users/create', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeaders || {}),
        },
        body: JSON.stringify({
          name: memberName.trim(),
          email: memberEmail.trim(),
          phone: memberPhone.trim(),
          password: memberPassword,
          family_id: family.id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMemberError(data.detail || 'No se pudo crear el integrante')
        return
      }
      setMemberName('')
      setMemberEmail('')
      setMemberPhone('')
      setMemberPassword('')
      setMemberSuccess('Integrante creado. Podrá activar su cuenta con reset password.')
      await loadFamily()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear integrante'
      setMemberError(msg)
    } finally {
      setCreatingMember(false)
    }
  }

  const handleOpenEditMember = (member: User) => {
    setSelectedMember(member)
    setMemberEditName(member.name || '')
    setMemberEditPhone(member.phone || '')
    setMemberEditIsActive(!!member.is_active)
    setMemberEditIsAdmin(!!member.is_family_admin)
    setMemberEditError('')
    setShowEditMember(true)
  }

  const handleUpdateMember = async () => {
    if (!family || !selectedMember || memberEditSaving) return
    const name = memberEditName.trim()
    if (!name) {
      setMemberEditError('El nombre es requerido')
      return
    }
    setMemberEditSaving(true)
    setMemberEditError('')
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(`/api/users/${selectedMember.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeaders || {}),
        },
        body: JSON.stringify({
          name,
          phone: memberEditPhone.trim(),
          is_active: memberEditIsActive,
          is_family_admin: memberEditIsAdmin,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMemberEditError(data.detail || 'No se pudo actualizar el integrante')
        return
      }
      setShowEditMember(false)
      setSelectedMember(null)
      await loadFamily()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar integrante'
      setMemberEditError(msg)
    } finally {
      setMemberEditSaving(false)
    }
  }

  const handleOpenDeleteMember = (member: User) => {
    setSelectedMember(member)
    setMemberDeleteError('')
    setShowDeleteMember(true)
  }

  const handleDeleteMember = async () => {
    if (!family || !selectedMember || memberDeleteSaving) return
    setMemberDeleteSaving(true)
    setMemberDeleteError('')
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(`/api/users/${selectedMember.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMemberDeleteError(data.detail || 'No se pudo eliminar el integrante')
        return
      }
      setShowDeleteMember(false)
      setSelectedMember(null)
      await loadFamily()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar integrante'
      setMemberDeleteError(msg)
    } finally {
      setMemberDeleteSaving(false)
    }
  }
 
   return (
     <SAPLayout title={title} subtitle={subtitle} user={user}>
      {loading ? (
         <div className="sap-card p-6">Cargando...</div>
       ) : (
         <>
          {error && (
            <div className="sap-alert-error text-center mb-4" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="sap-alert-success text-center mb-4" role="status">
              {success}
            </div>
          )}
           {!user?.family_id && (
             <div className="sap-card p-4 mb-4 border border-sap-warning/30 bg-sap-warning/10">
               <div className="flex flex-wrap items-center justify-between gap-3">
                 <div>
                   <p className="text-body text-sap-text font-semibold">Primero crea tu familia</p>
                   <p className="text-caption text-sap-text-secondary">
                     Este es el primer paso para crear categorías, integrantes y presupuestos.
                   </p>
                 </div>
                 <button
                   type="button"
                   className="sap-button-primary"
                   onClick={() => setShowCreate(true)}
                 >
                   Crear familia
                 </button>
               </div>
             </div>
           )}
 
           {family && (
            <div className="sap-card p-6 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <h3 className="text-title text-sap-text">{family.name}</h3>
                {user?.is_family_admin && (
                  <div className="flex gap-2">
                    <button type="button" className="sap-button-secondary" onClick={handleOpenEdit}>
                      Editar
                    </button>
                    <button type="button" className="sap-button-secondary" onClick={() => setShowDelete(true)}>
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
              {(family.address_line1 || family.city || family.state || family.postal_code || family.country) && (
                <p className="text-body text-sap-text-secondary">
                  {[family.address_line1, family.address_line2, family.city, family.state, family.postal_code, family.country]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
              <p className="text-body text-sap-text-secondary">
                Integrantes: {family.members?.length ?? 1}
              </p>
              {!user?.is_family_admin && (
                <p className="text-caption text-sap-text-tertiary mt-2">
                  Solo el administrador puede editar o eliminar la familia.
                </p>
              )}
            </div>
           )}

          {family && (
            <div className="sap-card p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-title text-sap-text">Dashboard de integrantes</h3>
                <span className="text-caption text-sap-text-secondary">{totalMembers}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-domus border border-sap-border/70 p-3">
                  <p className="text-caption text-sap-text-secondary">Total</p>
                  <p className="text-title text-sap-text">{totalMembers}</p>
                </div>
                <div className="rounded-domus border border-sap-border/70 p-3">
                  <p className="text-caption text-sap-text-secondary">Administradores</p>
                  <p className="text-title text-sap-text">{adminCount}</p>
                </div>
                <div className="rounded-domus border border-sap-border/70 p-3">
                  <p className="text-caption text-sap-text-secondary">Activos</p>
                  <p className="text-title text-sap-text">{activeCount}</p>
                </div>
                <div className="rounded-domus border border-sap-border/70 p-3">
                  <p className="text-caption text-sap-text-secondary">Inactivos</p>
                  <p className="text-title text-sap-text">{inactiveCount}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-body text-sap-text font-semibold">Gestionar integrantes</h4>
                <input
                  type="text"
                  className="sap-input w-full sm:w-64"
                  placeholder="Buscar por nombre, email o teléfono"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </div>
              <div className="mt-4 space-y-3">
                {filteredMembers.length > 0 ? (
                  filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-sap-border/60 pb-3 last:border-b-0 last:pb-0"
                    >
                      <div>
                        <p className="text-body text-sap-text font-medium">
                          {member.name || member.email}
                        </p>
                        <p className="text-caption text-sap-text-secondary">{member.email}</p>
                        {member.phone && (
                          <p className="text-caption text-sap-text-secondary">{member.phone}</p>
                        )}
                        <p className="text-caption text-sap-text-tertiary">
                          {member.is_family_admin ? 'Administrador' : 'Integrante'} ·{' '}
                          {member.is_active ? 'Activo' : 'Inactivo'}
                        </p>
                      </div>
                      {user?.is_family_admin && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="sap-button-secondary"
                            onClick={() => handleOpenEditMember(member)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="sap-button-secondary"
                            onClick={() => handleOpenDeleteMember(member)}
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-caption text-sap-text-secondary">
                    No hay integrantes que coincidan con la búsqueda.
                  </p>
                )}
              </div>
            </div>
          )}

          {family && user?.is_family_admin && (
            <div className="sap-card p-6 mb-4">
              <h3 className="text-title text-sap-text mb-4">Agregar integrante</h3>
              {memberError && (
                <div className="sap-alert-error text-center mb-3" role="alert">
                  {memberError}
                </div>
              )}
              {memberSuccess && (
                <div className="sap-alert-success text-center mb-3" role="status">
                  {memberSuccess}
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="text"
                  className="sap-input"
                  placeholder="Nombre"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                />
                <input
                  type="email"
                  className="sap-input"
                  placeholder="Email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                />
                <input
                  type="tel"
                  className="sap-input"
                  placeholder="Teléfono"
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                />
                <input
                  type="password"
                  className="sap-input"
                  placeholder="Contraseña temporal"
                  value={memberPassword}
                  onChange={(e) => setMemberPassword(e.target.value)}
                />
              </div>
              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  className="sap-button-primary"
                  onClick={handleCreateMember}
                  disabled={creatingMember}
                >
                  {creatingMember ? 'Creando...' : 'Crear integrante'}
                </button>
              </div>
            </div>
          )}
         </>
       )}
 
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-sap-text">Crear familia</h3>
              <button onClick={() => setShowCreate(false)} className="sap-button-ghost p-2">
                ×
              </button>
            </div>

            {error && (
              <div className="sap-alert-error text-center mb-3" role="alert">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-sap-text-secondary mb-1">
                  Nombre de la familia
                </label>
                <input
                  type="text"
                  className="sap-input w-full"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder={defaultFamilyName}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="text"
                  className="sap-input"
                  placeholder="Dirección"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                />
                <input
                  type="text"
                  className="sap-input"
                  placeholder="Dirección (2)"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                />
                <input
                  type="text"
                  className="sap-input"
                  placeholder="Ciudad"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <input
                  type="text"
                  className="sap-input"
                  placeholder="Estado"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
                <input
                  type="text"
                  className="sap-input"
                  placeholder="Código postal"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
                <input
                  type="text"
                  className="sap-input"
                  placeholder="País"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="sap-button-secondary flex-1"
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateFamily}
                  className="sap-button-primary flex-1"
                  disabled={creating}
                >
                  {creating ? 'Creando...' : 'Crear familia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-sap-text">Editar familia</h3>
              <button onClick={() => setShowEdit(false)} className="sap-button-ghost p-2">
                ×
              </button>
            </div>

            {error && (
              <div className="sap-alert-error text-center mb-3" role="alert">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-sap-text-secondary mb-1">
                  Nombre de la familia
                </label>
                <input
                  type="text"
                  className="sap-input w-full"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={defaultFamilyName}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="text"
                  className="sap-input"
                  placeholder="Dirección"
                  value={editAddressLine1}
                  onChange={(e) => setEditAddressLine1(e.target.value)}
                />
                <input
                  type="text"
                  className="sap-input"
                  placeholder="Dirección (2)"
                  value={editAddressLine2}
                  onChange={(e) => setEditAddressLine2(e.target.value)}
                />
                <input
                  type="text"
                  className="sap-input"
                  placeholder="Ciudad"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                />
                <input
                  type="text"
                  className="sap-input"
                  placeholder="Estado"
                  value={editState}
                  onChange={(e) => setEditState(e.target.value)}
                />
                <input
                  type="text"
                  className="sap-input"
                  placeholder="Código postal"
                  value={editPostalCode}
                  onChange={(e) => setEditPostalCode(e.target.value)}
                />
                <input
                  type="text"
                  className="sap-input"
                  placeholder="País"
                  value={editCountry}
                  onChange={(e) => setEditCountry(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="sap-button-secondary flex-1"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUpdateFamily}
                  className="sap-button-primary flex-1"
                  disabled={saving}
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditMember && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-sap-text">Editar integrante</h3>
              <button onClick={() => setShowEditMember(false)} className="sap-button-ghost p-2">
                ×
              </button>
            </div>

            {memberEditError && (
              <div className="sap-alert-error text-center mb-3" role="alert">
                {memberEditError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-sap-text-secondary mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  className="sap-input w-full"
                  value={memberEditName}
                  onChange={(e) => setMemberEditName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sap-text-secondary mb-1">
                  Email
                </label>
                <input
                  type="email"
                  className="sap-input w-full"
                  value={selectedMember.email}
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sap-text-secondary mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  className="sap-input w-full"
                  value={memberEditPhone}
                  onChange={(e) => setMemberEditPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-sap-text-secondary">
                  <input
                    type="checkbox"
                    checked={memberEditIsActive}
                    onChange={(e) => setMemberEditIsActive(e.target.checked)}
                  />
                  Activo
                </label>
                <label className="flex items-center gap-2 text-sm text-sap-text-secondary">
                  <input
                    type="checkbox"
                    checked={memberEditIsAdmin}
                    onChange={(e) => setMemberEditIsAdmin(e.target.checked)}
                  />
                  Administrador
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditMember(false)}
                  className="sap-button-secondary flex-1"
                  disabled={memberEditSaving}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUpdateMember}
                  className="sap-button-primary flex-1"
                  disabled={memberEditSaving}
                >
                  {memberEditSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteMember && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-sap-text">Eliminar integrante</h3>
              <button onClick={() => setShowDeleteMember(false)} className="sap-button-ghost p-2">
                ×
              </button>
            </div>

            {memberDeleteError && (
              <div className="sap-alert-error text-center mb-3" role="alert">
                {memberDeleteError}
              </div>
            )}

            <p className="text-body text-sap-text-secondary">
              Se eliminar&aacute; a <strong>{selectedMember.name || selectedMember.email}</strong> de la
              familia. El usuario seguir&aacute; existiendo, pero sin familia asignada.
            </p>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowDeleteMember(false)}
                className="sap-button-secondary flex-1"
                disabled={memberDeleteSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteMember}
                className="sap-button-primary flex-1"
                disabled={memberDeleteSaving}
              >
                {memberDeleteSaving ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-sap-text">Eliminar familia</h3>
              <button onClick={() => setShowDelete(false)} className="sap-button-ghost p-2">
                ×
              </button>
            </div>

            {error && (
              <div className="sap-alert-error text-center mb-3" role="alert">
                {error}
              </div>
            )}

            <p className="text-body text-sap-text-secondary">
              Esta acci&oacute;n eliminar&aacute; la familia y sus datos asociados. &iquest;Deseas continuar?
            </p>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowDelete(false)}
                className="sap-button-secondary flex-1"
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteFamily}
                className="sap-button-primary flex-1"
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
     </SAPLayout>
   )
 }
