'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@/lib/types'
import SAPLayout from '@/components/SAPLayout'
import { PlusIcon, XIcon } from '@/lib/icons'
import { safePushLogin } from '@/lib/receiptProcessing'

export default function UsersPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          safePushLogin(router, 'users: no supabase session')
          return
        }

        const { data: currentUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (!currentUser) {
          safePushLogin(router, 'users: no current user')
          return
        }

        // Verificar que sea administrador
        if (!currentUser.is_family_admin) {
          alert('Solo los administradores pueden acceder a esta página')
          router.push('/dashboard')
          return
        }

        setUser(currentUser)

        // Cargar usuarios de la familia
        if (currentUser.family_id) {
          const { data: familyUsers } = await supabase
            .from('users')
            .select('*')
            .eq('family_id', currentUser.family_id)
            .order('name')

          if (familyUsers) {
            setUsers(familyUsers)
          }
        }
      } catch (err: any) {
        console.error('Error cargando datos:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')

    if (!newUser.name || !newUser.email || !newUser.phone || !newUser.password) {
      setError('Todos los campos son requeridos')
      setCreating(false)
      return
    }

    if (newUser.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      setCreating(false)
      return
    }

    try {
      // Usar la API route de Next.js
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        setError('No autenticado')
        setCreating(false)
        return
      }

      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newUser.name.trim(),
          email: newUser.email.trim(),
          phone: newUser.phone.trim(),
          password: newUser.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Error al crear usuario')
      }

      // Recargar lista de usuarios
      if (user?.family_id) {
        const { data: familyUsers } = await supabase
          .from('users')
          .select('*')
          .eq('family_id', user.family_id)
          .order('name')

        if (familyUsers) {
          setUsers(familyUsers)
        }
      }

      // Limpiar formulario
      setNewUser({ name: '', email: '', phone: '', password: '' })
      setShowCreateModal(false)
      alert('Usuario creado exitosamente')
    } catch (err: any) {
      console.error('Error creando usuario:', err)
      setError(err.message || 'Error al crear usuario')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <SAPLayout user={user} title="Usuarios" subtitle="Gestión de Usuarios">
        <div className="p-6">
          <div className="text-center text-gray-500">Cargando...</div>
        </div>
      </SAPLayout>
    )
  }

  return (
    <SAPLayout user={user} title="Usuarios" subtitle="Gestión de Usuarios">
      <div className="p-6">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Usuarios de la Familia</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Crear Usuario
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Teléfono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {u.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {u.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {u.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {u.is_family_admin ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        Administrador
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        Usuario
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {u.is_active ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Activo
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        Inactivo
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Crear Nuevo Usuario</h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setError('')
                    setNewUser({ name: '', email: '', phone: '', password: '' })
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XIcon className="w-6 h-6" />
                </button>
              </div>

              {error && (
                <div className="mb-4 bg-red-50 text-red-600 p-3 rounded text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    El email no será validado. El usuario podrá iniciar sesión directamente.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      setError('')
                      setNewUser({ name: '', email: '', phone: '', password: '' })
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                    disabled={creating}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    disabled={creating}
                  >
                    {creating ? 'Creando...' : 'Crear Usuario'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SAPLayout>
  )
}
