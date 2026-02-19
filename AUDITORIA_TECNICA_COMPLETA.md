# AUDITORÍA TÉCNICA COMPLETA - DOMUS+
## Next.js + Supabase

---

## 1. ESTRUCTURA DEL PROYECTO

```
domus-plus/
├── frontend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   └── register/route.ts
│   │   │   ├── budgets/
│   │   │   │   ├── annual-matrix/route.ts
│   │   │   │   ├── family/route.ts
│   │   │   │   └── global-summary/route.ts
│   │   │   ├── excel-import/
│   │   │   │   │   ├── import-budgets/route.ts
│   │   │   │   │   ├── parse-budgets/route.ts
│   │   │   │   │   └── setup-from-excel/route.ts
│   │   │   ├── families/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       └── members/route.ts
│   │   │   └── users/
│   │   │       ├── create/route.ts
│   │   │       └── me/route.ts
│   │   ├── budgets/page.tsx
│   │   ├── excel/page.tsx
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── users/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   ├── middleware.ts
│   │   │   └── helpers.ts
│   │   ├── api.ts
│   │   └── types.ts
│   ├── next.config.js
│   ├── package.json
│   └── tsconfig.json
└── supabase/
    ├── schema.sql
    ├── flujo-crear-familia-completo.sql
    ├── funcion-crear-familia-auto.sql
    ├── fix-rls-ver-miembros-familia.sql
    ├── fix-rls-presupuestos-completo.sql
    ├── fix-rls-infinite-recursion.sql
    ├── fix-rls-users-select.sql
    └── funciones-presupuestos.sql
```

---

## 2. NEXT.JS (APP ROUTER)

### 2.1 Layout Principal

**Archivo: `frontend/app/layout.tsx`**

```typescript
import './globals.css'
import type { Metadata } from 'next'
import { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'DOMUS+',
  description: 'Sistema de Gestión',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="es">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
```

### 2.2 Página Principal

**Archivo: `frontend/app/page.tsx`**

```typescript
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">DOMUS+</h1>
        <p className="text-gray-600 mb-8">Sistema de Gestión Familiar</p>
        
        <div className="space-y-4 flex flex-col">
          <Link 
            href="/login"
            className="w-full bg-blue-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors text-center"
          >
            Iniciar Sesión
          </Link>
          
          <Link 
            href="/dashboard"
            className="w-full bg-white text-gray-700 font-medium py-3 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-center"
          >
            Ir al Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
```

### 2.3 Autenticación - Login

**Archivo: `frontend/app/login/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    console.log('🔐 Intentando iniciar sesión con:', email)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('❌ Error de autenticación:', error)
        setError(error.message || 'Email o contraseña incorrectos')
      } else if (data?.user && data?.session) {
        console.log('✅ Login exitoso')
        console.log('   Usuario:', data.user.email)
        console.log('   Sesión:', data.session ? 'creada' : 'no creada')
        
        // Esperar un momento para que la sesión se persista
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Verificar que la sesión se guardó
        const { data: { session: verifySession } } = await supabase.auth.getSession()
        if (verifySession) {
          console.log('✅ Sesión verificada, redirigiendo...')
          try {
            await router.push('/dashboard')
            router.refresh()
          } catch (navError) {
            // Ignorar errores de navegación menores
            console.warn('Advertencia de navegación:', navError)
            window.location.href = '/dashboard'
          }
        } else {
          console.error('⚠️ Sesión no se guardó correctamente')
          setError('Error al guardar la sesión. Intenta de nuevo.')
        }
      } else {
        console.error('❌ No se recibió información del usuario o sesión')
        setError('Error al iniciar sesión. Intenta de nuevo.')
      }
    } catch (err: any) {
      console.error('❌ Error inesperado:', err)
      setError(err.message || 'Error al iniciar sesión. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">DOMUS+</h1>
          <p className="text-gray-500">Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            onClick={() => console.log('🖱️ Botón de login clickeado')}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Entrando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            ¿No tienes una cuenta?{' '}
            <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
```

### 2.4 Autenticación - Registro

**Archivo: `frontend/app/register/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Register() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validaciones
    if (!name || !email || !phone || !password || !confirmPassword) {
      setError('Todos los campos son requeridos')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      setLoading(false)
      return
    }

    if (phone.length < 10) {
      setError('El teléfono debe tener al menos 10 caracteres')
      setLoading(false)
      return
    }

    console.log('📝 Intentando registrar usuario:', email)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ Error en registro:', data)
        setError(data.detail || 'Error al registrar usuario')
        setLoading(false)
        return
      }

      console.log('✅ Registro exitoso:', data)
      
      // Redirigir al login con mensaje de éxito
      router.push('/login?registered=true')
    } catch (err: any) {
      console.error('❌ Error inesperado:', err)
      setError(err.message || 'Error al registrar usuario. Verifica tu conexión.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">DOMUS+</h1>
          <p className="text-gray-500">Crea tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tu nombre completo"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+526865690472"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              required
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Registrando...' : 'Registrarse'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
```

### 2.5 API Routes - Autenticación

**Archivo: `frontend/app/api/auth/register/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, phone, name } = body

    // Validaciones
    if (!email || !password || !phone || !name) {
      return NextResponse.json(
        { detail: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { detail: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    if (phone.length < 10) {
      return NextResponse.json(
        { detail: 'Teléfono inválido' },
        { status: 400 }
      )
    }

    const supabase = await createClient(request)

    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        return NextResponse.json(
          { detail: 'Email ya registrado' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { detail: `Error al crear usuario: ${authError.message}` },
        { status: 500 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { detail: 'No se pudo crear el usuario' },
        { status: 500 }
      )
    }

    // Intentar crear registro en tabla users
    // Primero intentamos INSERT directo (más simple y confiable)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: email.trim(),
        phone: phone.trim(),
        name: name.trim(),
        is_active: true,
        is_family_admin: false,
      })
      .select()
      .single()

    if (userError) {
      console.error('Error al crear perfil de usuario:', userError)
      console.error('Usuario de auth creado pero perfil falló:', authData.user.id)
      
      // Mensaje más específico según el tipo de error
      let errorMessage = userError.message || 'Error desconocido'
      let errorDetail = ''
      
      if (errorMessage.includes('row-level security') || errorMessage.includes('RLS') || errorMessage.includes('policy')) {
        errorDetail = 'Error de permisos (RLS): Las políticas de seguridad están bloqueando el registro. Ejecuta el SQL de "supabase/verificar-y-fix-rls-registro.sql" en Supabase SQL Editor.'
      } else if (errorMessage.includes('duplicate') || errorMessage.includes('unique') || errorMessage.includes('already exists')) {
        errorDetail = 'El usuario ya existe en la base de datos.'
      } else if (errorMessage.includes('Database error')) {
        errorDetail = 'Error de base de datos. Verifica que las políticas RLS estén configuradas correctamente ejecutando "supabase/verificar-y-fix-rls-registro.sql" en Supabase.'
      } else {
        errorDetail = `Error técnico: ${errorMessage}`
      }
      
      return NextResponse.json(
        { 
          detail: `Error al crear perfil: ${errorDetail}. El usuario fue creado en auth.users pero no en public.users.`,
          error_code: userError.code,
          error_message: userError.message
        },
        { status: 500 }
      )
    }

    // Usuario creado exitosamente
    return NextResponse.json(userData, { status: 201 })
  } catch (error: any) {
    console.error('Error en registro:', error)
    return NextResponse.json(
      { detail: `Error al registrar usuario: ${error.message}` },
      { status: 500 }
    )
  }
}
```

**Archivo: `frontend/app/api/auth/login/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { detail: 'Email y contraseña son requeridos' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Autenticar con Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      return NextResponse.json(
        { detail: 'Email o contraseña incorrectos' },
        { status: 401 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { detail: 'No se pudo autenticar el usuario' },
        { status: 500 }
      )
    }

    // Verificar que el usuario esté activo en la tabla users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { detail: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    if (!userData.is_active) {
      return NextResponse.json(
        { detail: 'Usuario inactivo. Contacta al administrador.' },
        { status: 403 }
      )
    }

    // Obtener la sesión para devolver el token
    const { data: sessionData } = await supabase.auth.getSession()

    return NextResponse.json({
      access_token: sessionData?.session?.access_token,
      token_type: 'bearer',
      user: userData,
    })
  } catch (error: any) {
    console.error('Error en login:', error)
    return NextResponse.json(
      { detail: `Error al procesar el login: ${error.message}` },
      { status: 500 }
    )
  }
}
```

### 2.6 API Routes - Usuarios

**Archivo: `frontend/app/api/users/create/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, phone, name, family_id } = body

    // Validaciones básicas
    if (!email || !password || !phone || !name) {
      return NextResponse.json(
        { detail: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { detail: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    const supabase = await createClient(request)

    // Verificar que el usuario actual sea administrador
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('is_family_admin, family_id')
      .eq('id', authUser.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json(
        { detail: 'Error al verificar usuario' },
        { status: 500 }
      )
    }

    if (!currentUser.is_family_admin) {
      return NextResponse.json(
        { detail: 'Solo los administradores pueden crear usuarios' },
        { status: 403 }
      )
    }

    // Usar el family_id del administrador si no se proporciona
    const targetFamilyId = family_id || currentUser.family_id

    if (!targetFamilyId) {
      return NextResponse.json(
        { detail: 'El administrador no tiene familia asignada' },
        { status: 400 }
      )
    }

    // Usar la función SQL para crear el usuario (requiere que se ejecute el SQL primero)
    const { data: userData, error: dbError } = await supabase.rpc('create_user_by_admin', {
      p_email: email.trim(),
      p_password: password, // La función no usa esto directamente, pero lo guardamos para referencia
      p_name: name.trim(),
      p_phone: phone.trim(),
      p_family_id: targetFamilyId,
    })

    if (dbError) {
      console.error('Error al crear usuario:', dbError)
      return NextResponse.json(
        { detail: `Error al crear usuario: ${dbError.message}` },
        { status: 500 }
      )
    }

    // La función retorna un array, tomar el primer elemento
    const newUser = Array.isArray(userData) ? userData[0] : userData

    if (!newUser) {
      return NextResponse.json(
        { detail: 'No se pudo crear el usuario' },
        { status: 500 }
      )
    }

    // Nota: El usuario se crea en public.users pero NO en auth.users
    // El usuario necesitará usar "reset password" para crear su cuenta en auth.users
    // O puedes crear un endpoint en el backend que use service_role key para crear en auth.users

    return NextResponse.json(newUser, { status: 201 })
  } catch (error: any) {
    console.error('Error en creación de usuario:', error)
    return NextResponse.json(
      { detail: `Error al crear usuario: ${error.message}` },
      { status: 500 }
    )
  }
}
```

**Archivo: `frontend/app/api/users/me/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request)

    // Obtener usuario autenticado
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener datos del usuario desde la tabla users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { detail: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(userData)
  } catch (error: any) {
    console.error('Error al obtener usuario:', error)
    return NextResponse.json(
      { detail: `Error: ${error.message}` },
      { status: 500 }
    )
  }
}
```

### 2.7 API Routes - Familias

**Archivo: `frontend/app/api/families/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request)
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener familia del usuario
    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single()

    if (!userData?.family_id) {
      return NextResponse.json([])
    }

    // Obtener familia con miembros
    const { data: familyData, error: familyError } = await supabase
      .from('families')
      .select(`
        *,
        members:users(*)
      `)
      .eq('id', userData.family_id)
      .single()

    if (familyError) {
      return NextResponse.json(
        { detail: familyError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(familyData)
  } catch (error: any) {
    console.error('Error al obtener familia:', error)
    return NextResponse.json(
      { detail: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name } = body

    if (!name) {
      return NextResponse.json(
        { detail: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    const supabase = await createClient(request)
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Crear familia
    const { data: familyData, error: familyError } = await supabase
      .from('families')
      .insert({
        name,
        admin_id: authUser.id,
      })
      .select()
      .single()

    if (familyError) {
      return NextResponse.json(
        { detail: familyError.message },
        { status: 500 }
      )
    }

    // Actualizar usuario para asignarlo a la familia
    await supabase
      .from('users')
      .update({ family_id: familyData.id })
      .eq('id', authUser.id)

    return NextResponse.json(familyData, { status: 201 })
  } catch (error: any) {
    console.error('Error al crear familia:', error)
    return NextResponse.json(
      { detail: error.message },
      { status: 500 }
    )
  }
}
```

**Archivo: `frontend/app/api/families/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient(request)
    const familyId = parseInt(params.id)

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Verificar que el usuario pertenezca a esta familia
    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single()

    if (userData?.family_id !== familyId) {
      return NextResponse.json(
        { detail: 'No tienes acceso a esta familia' },
        { status: 403 }
      )
    }

    const { data: family, error } = await supabase
      .from('families')
      .select(`
        *,
        members:users(*)
      `)
      .eq('id', familyId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { detail: 'Familia no encontrada' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { detail: `Error al obtener familia: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(family, { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/families/[id]:', error)
    return NextResponse.json(
      { detail: `Error al obtener familia: ${error.message}` },
      { status: 500 }
    )
  }
}
```

**Archivo: `frontend/app/api/families/[id]/members/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient(request)
    const familyId = parseInt(params.id)

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Verificar que el usuario pertenezca a esta familia
    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single()

    if (userData?.family_id !== familyId) {
      return NextResponse.json(
        { detail: 'No tienes acceso a esta familia' },
        { status: 403 }
      )
    }

    const { data: members, error } = await supabase
      .from('users')
      .select('*')
      .eq('family_id', familyId)
      .order('name')

    if (error) {
      console.error('Error obteniendo miembros:', error)
      return NextResponse.json(
        { detail: `Error al obtener miembros: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(members || [], { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/families/[id]/members:', error)
    return NextResponse.json(
      { detail: `Error al obtener miembros: ${error.message}` },
      { status: 500 }
    )
  }
}
```

### 2.8 API Routes - Presupuestos

**Archivo: `frontend/app/api/budgets/family/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request)
    
    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener familia del usuario
    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single()

    if (!userData?.family_id) {
      return NextResponse.json(
        { detail: 'Usuario no pertenece a una familia' },
        { status: 400 }
      )
    }

    // Obtener parámetros
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : new Date().getFullYear()

    // Usar función SQL si existe, sino usar query directo
    try {
      const { data: budgets, error: rpcError } = await supabase.rpc(
        'get_family_budgets_with_calculations',
        {
          p_family_id: userData.family_id,
          p_year: year,
        }
      )

      if (!rpcError && budgets) {
        return NextResponse.json(budgets, { status: 200 })
      }
    } catch (rpcError) {
      console.log('Función RPC no disponible, usando query directo')
    }

    // Fallback: query directo
    const { data: budgets, error } = await supabase
      .from('family_budgets')
      .select(`
        *,
        user_allocations:user_budgets(
          *,
          user:users(id, name, email)
        )
      `)
      .eq('family_id', userData.family_id)
      .eq('year', year)
      .order('category')
      .order('subcategory')

    if (error) {
      console.error('Error obteniendo presupuestos:', error)
      return NextResponse.json(
        { detail: `Error al obtener presupuestos: ${error.message}` },
        { status: 500 }
      )
    }

    // Calcular income_amount y available_amount para cada user_budget
    if (budgets) {
      for (const budget of budgets) {
        if (budget.user_allocations) {
          for (const allocation of budget.user_allocations) {
            // Obtener income_amount desde transacciones
            const { data: incomeTransactions } = await supabase
              .from('transactions')
              .select('amount')
              .eq('family_budget_id', budget.id)
              .eq('user_id', allocation.user_id)
              .eq('transaction_type', 'income')

            const incomeAmount = incomeTransactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0

            // Calcular available_amount
            allocation.income_amount = incomeAmount
            allocation.available_amount = 
              (allocation.allocated_amount || 0) + 
              incomeAmount - 
              (allocation.spent_amount || 0)
          }
        }
      }
    }

    return NextResponse.json(budgets || [], { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/budgets/family:', error)
    return NextResponse.json(
      { detail: `Error al obtener presupuestos: ${error.message}` },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(request)
    const body = await request.json()

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener usuario completo
    const { data: userData } = await supabase
      .from('users')
      .select('family_id, is_family_admin')
      .eq('id', authUser.id)
      .single()

    if (!userData?.family_id) {
      return NextResponse.json(
        { detail: 'Usuario no pertenece a una familia' },
        { status: 400 }
      )
    }

    // Verificar que sea admin para presupuestos compartidos
    const isShared = body.budget_type === 'shared'
    if (isShared && !userData.is_family_admin) {
      return NextResponse.json(
        { detail: 'Solo los administradores pueden crear presupuestos compartidos' },
        { status: 403 }
      )
    }

    // Validaciones
    if (!body.total_amount || body.total_amount <= 0) {
      return NextResponse.json(
        { detail: 'El monto debe ser mayor a cero' },
        { status: 400 }
      )
    }

    if (body.total_amount > 1000000000) {
      return NextResponse.json(
        { detail: 'El monto excede el límite permitido' },
        { status: 400 }
      )
    }

    const currentYear = new Date().getFullYear()
    if (body.year < currentYear - 1 || body.year > currentYear + 1) {
      return NextResponse.json(
        { detail: 'El año debe ser el actual, anterior o siguiente' },
        { status: 400 }
      )
    }

    // Crear presupuesto
    const budgetData: any = {
      family_id: userData.family_id,
      category: body.category || null,
      subcategory: body.subcategory || null,
      custom_category_id: body.custom_category_id || null,
      custom_subcategory_id: body.custom_subcategory_id || null,
      year: body.year,
      total_amount: body.total_amount,
      monthly_amounts: body.monthly_amounts || null,
      display_names: body.display_names || null,
      due_date: body.due_date || null,
      payment_status: body.payment_status || 'pending',
      notes: body.notes || null,
      budget_type: body.budget_type || 'shared',
      distribution_method: body.distribution_method || 'equal',
      auto_distribute: body.auto_distribute !== undefined ? body.auto_distribute : true,
      target_user_id: body.target_user_id || null,
    }

    const { data: budget, error: budgetError } = await supabase
      .from('family_budgets')
      .insert(budgetData)
      .select()
      .single()

    if (budgetError) {
      console.error('Error creando presupuesto:', budgetError)
      return NextResponse.json(
        { detail: `Error al crear presupuesto: ${budgetError.message}` },
        { status: 500 }
      )
    }

    // Distribución automática si está habilitada
    if (body.auto_distribute && body.budget_type === 'shared') {
      const { data: familyMembers } = await supabase
        .from('users')
        .select('id')
        .eq('family_id', userData.family_id)
        .eq('is_active', true)

      if (familyMembers && familyMembers.length > 0) {
        if (body.distribution_method === 'equal') {
          const amountPerUser = body.total_amount / familyMembers.length
          const userBudgets = familyMembers.map((member: any) => ({
            user_id: member.id,
            family_budget_id: budget.id,
            allocated_amount: Math.round(amountPerUser * 100) / 100,
          }))

          await supabase
            .from('user_budgets')
            .insert(userBudgets)
        }
      }
    } else if (body.budget_type === 'individual' && body.target_user_id) {
      // Presupuesto individual: asignar directamente
      await supabase
        .from('user_budgets')
        .insert({
          user_id: body.target_user_id,
          family_budget_id: budget.id,
          allocated_amount: body.total_amount,
        })
    }

    // Crear log de actividad
    try {
      await supabase.from('activity_logs').insert({
        user_id: authUser.id,
        action_type: 'budget_created',
        entity_type: 'budget',
        description: `Presupuesto creado: ${body.category} - ${body.subcategory} ($${body.total_amount})`,
        entity_id: budget.id,
        details: {
          category: body.category,
          subcategory: body.subcategory,
          year: body.year,
          total_amount: body.total_amount,
          budget_type: body.budget_type,
        },
      })
    } catch (logError) {
      console.error('Error creando log:', logError)
    }

    return NextResponse.json(budget, { status: 201 })
  } catch (error: any) {
    console.error('Error en POST /api/budgets/family:', error)
    return NextResponse.json(
      { detail: `Error al crear presupuesto: ${error.message}` },
      { status: 500 }
    )
  }
}
```

**Archivo: `frontend/app/api/budgets/annual-matrix/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request)
    
    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener familia del usuario
    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single()

    if (!userData?.family_id) {
      return NextResponse.json(
        { detail: 'Usuario no pertenece a una familia' },
        { status: 400 }
      )
    }

    // Obtener parámetros
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : new Date().getFullYear()

    // Obtener todos los presupuestos del año
    const { data: budgets, error: budgetsError } = await supabase
      .from('family_budgets')
      .select('*')
      .eq('family_id', userData.family_id)
      .eq('year', year)
      .order('category')
      .order('subcategory')

    if (budgetsError) {
      console.error('Error obteniendo presupuestos:', budgetsError)
      return NextResponse.json(
        { detail: `Error al obtener presupuestos: ${budgetsError.message}` },
        { status: 500 }
      )
    }

    // Meses en español
    const mesesEs = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]

    // Mapeo de meses en inglés (del Excel) a español
    const mesesEn = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ]
    const mesMapping: Record<string, string> = {}
    mesesEn.forEach((en, idx) => {
      mesMapping[en] = mesesEs[idx]
    })

    // Construir la matriz
    const matrix: any[] = []
    let totalAnual = 0.0
    const totalesMensuales: Record<string, number> = {}
    mesesEs.forEach(mes => {
      totalesMensuales[mes] = 0.0
    })

    for (const budget of budgets || []) {
      const row: any = {
        concepto: `${budget.category} - ${budget.subcategory}`,
        categoria: budget.category,
        subcategoria: budget.subcategory,
        meses: {},
      }

      // Usar montos mensuales reales si están disponibles
      let monthlyAmountsDict: Record<string, number> | null = null
      if (budget.monthly_amounts) {
        if (typeof budget.monthly_amounts === 'string') {
          try {
            monthlyAmountsDict = JSON.parse(budget.monthly_amounts)
          } catch {
            monthlyAmountsDict = null
          }
        } else if (typeof budget.monthly_amounts === 'object') {
          monthlyAmountsDict = budget.monthly_amounts as Record<string, number>
        }
      }

      if (monthlyAmountsDict && Object.keys(monthlyAmountsDict).length > 0) {
        // Hay montos mensuales reales del Excel
        for (const mesEn in monthlyAmountsDict) {
          const mesEs = mesMapping[mesEn.toUpperCase()]
          if (mesEs) {
            const monto = parseFloat(String(monthlyAmountsDict[mesEn])) || 0
            row.meses[mesEs] = Math.round(monto * 100) / 100
            totalesMensuales[mesEs] += monto
          }
        }
        // Rellenar meses faltantes con 0
        mesesEs.forEach(mesEs => {
          if (!row.meses[mesEs]) {
            row.meses[mesEs] = 0.0
          }
        })
      } else {
        // No hay montos mensuales, dividir el total entre 12
        const montoMensual = (budget.total_amount || 0) / 12.0
        mesesEs.forEach(mesEs => {
          row.meses[mesEs] = Math.round(montoMensual * 100) / 100
          totalesMensuales[mesEs] += montoMensual
        })
      }

      // Total anual para este concepto
      row.total_anual = Math.round((budget.total_amount || 0) * 100) / 100
      totalAnual += budget.total_amount || 0

      matrix.push(row)
    }

    // Agregar fila de totales
    const totalesRow: any = {
      concepto: 'TOTAL',
      categoria: '',
      subcategoria: '',
      meses: {},
      total_anual: Math.round(totalAnual * 100) / 100,
    }

    mesesEs.forEach(mes => {
      totalesRow.meses[mes] = Math.round(totalesMensuales[mes] * 100) / 100
    })

    matrix.push(totalesRow)

    return NextResponse.json({
      year,
      meses: mesesEs,
      matrix,
      total_conceptos: budgets?.length || 0,
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/budgets/annual-matrix:', error)
    return NextResponse.json(
      { detail: `Error al obtener matriz de presupuesto: ${error.message}` },
      { status: 500 }
    )
  }
}
```

**Archivo: `frontend/app/api/budgets/global-summary/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request)
    
    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener familia del usuario
    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single()

    if (!userData?.family_id) {
      return NextResponse.json(
        { detail: 'Usuario no pertenece a una familia' },
        { status: 400 }
      )
    }

    // Obtener parámetros
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : new Date().getFullYear()

    // Obtener todos los presupuestos del año
    const { data: budgets, error: budgetsError } = await supabase
      .from('family_budgets')
      .select(`
        *,
        target_user:users!target_user_id(id, name)
      `)
      .eq('family_id', userData.family_id)
      .eq('year', year)

    if (budgetsError) {
      console.error('Error obteniendo presupuestos:', budgetsError)
      return NextResponse.json(
        { detail: `Error al obtener presupuestos: ${budgetsError.message}` },
        { status: 500 }
      )
    }

    // Agrupar por categoría y subcategoría
    const summary: Record<string, any> = {}

    for (const budget of budgets || []) {
      const key = `${budget.category}|${budget.subcategory}`
      
      if (!summary[key]) {
        summary[key] = {
          category: budget.category,
          subcategory: budget.subcategory,
          shared_amount: 0.0,
          individual_amounts: {},
          total_amount: 0.0,
        }
      }

      if (budget.budget_type === 'shared') {
        summary[key].shared_amount += budget.total_amount || 0
      } else if (budget.budget_type === 'individual' && budget.target_user) {
        const userId = budget.target_user.id
        const userName = budget.target_user.name
        
        if (!summary[key].individual_amounts[userId]) {
          summary[key].individual_amounts[userId] = {
            amount: 0.0,
            name: userName,
          }
        }
        summary[key].individual_amounts[userId].amount += budget.total_amount || 0
      }

      summary[key].total_amount += budget.total_amount || 0
    }

    // Convertir a lista y calcular totales
    const summaryList = []
    let totalShared = 0.0
    let totalIndividual = 0.0
    let totalGlobal = 0.0

    for (const key in summary) {
      const data = summary[key]
      const individualTotal = Object.values(data.individual_amounts).reduce(
        (sum: number, userData: any) => sum + (userData.amount || 0),
        0
      ) as number

      totalShared += data.shared_amount
      totalIndividual += individualTotal
      totalGlobal += data.total_amount

      summaryList.push({
        ...data,
        individual_total: Math.round(individualTotal * 100) / 100,
      })
    }

    return NextResponse.json({
      year,
      summary: summaryList,
      totals: {
        shared: Math.round(totalShared * 100) / 100,
        individual: Math.round(totalIndividual * 100) / 100,
        global: Math.round(totalGlobal * 100) / 100,
      },
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/budgets/global-summary:', error)
    return NextResponse.json(
      { detail: `Error al obtener resumen global: ${error.message}` },
      { status: 500 }
    )
  }
}
```

### 2.9 API Routes - Excel Import

**Archivo: `frontend/app/api/excel-import/parse-budgets/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseExcelBudgets } from '@/lib/services/excel-parser'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(request)

    // Verificar autenticación
    let authUser = null
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '')
    
    if (accessToken) {
      const { data: { user }, error: tokenError } = await supabase.auth.getUser(accessToken)
      if (user && !tokenError) {
        authUser = user
      }
    }
    
    if (!authUser) {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (user && !userError) {
        authUser = user
      } else {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (session?.user && !sessionError) {
          authUser = session.user
        }
      }
    }
    
    if (!authUser) {
      return NextResponse.json(
        { detail: 'No autenticado. Por favor, inicia sesión de nuevo.' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { detail: 'No se proporcionó un archivo' },
        { status: 400 }
      )
    }

    const validExtensions = ['.xlsx', '.xlsm', '.xls']
    const fileName = file.name.toLowerCase()
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext))

    if (!hasValidExtension) {
      return NextResponse.json(
        { detail: 'El archivo debe ser Excel (.xlsx, .xlsm, .xls)' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length === 0) {
      return NextResponse.json(
        { detail: 'El archivo está vacío' },
        { status: 400 }
      )
    }

    // Parsear presupuestos del Excel
    let excelBudgets
    try {
      excelBudgets = parseExcelBudgets(buffer, 'Input Categories Budget')
    } catch (parseError: any) {
      return NextResponse.json(
        { detail: `Error al parsear presupuestos del Excel: ${parseError.message}` },
        { status: 400 }
      )
    }

    if (!excelBudgets || excelBudgets.length === 0) {
      return NextResponse.json(
        { 
          detail: 'No se encontraron presupuestos en el Excel. Verifica que la hoja "Input Categories Budget" tenga datos de presupuestos.',
          debug: 'El parser no encontró presupuestos válidos. Verifica que el Excel tenga la estructura correcta con columnas Type, Category, Subcategory y meses (JANUARY, FEBRUARY, etc.).'
        },
        { status: 400 }
      )
    }

    // Retornar los presupuestos parseados para que el usuario los seleccione
    return NextResponse.json({
      budgets: excelBudgets,
      total: excelBudgets.length,
      message: `Se encontraron ${excelBudgets.length} presupuestos en el Excel`,
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error en POST /api/excel-import/parse-budgets:', error)
    return NextResponse.json(
      { detail: `Error al parsear presupuestos: ${error.message}` },
      { status: 500 }
    )
  }
}
```

**Archivo: `frontend/app/api/excel-import/import-budgets/route.ts`**

[CONTENIDO COMPLETO - Ver archivo original en el proyecto, tiene 461 líneas]

**Archivo: `frontend/app/api/excel-import/setup-from-excel/route.ts`**

[CONTENIDO COMPLETO - Ver archivo original en el proyecto, tiene 255 líneas]

---

## 3. SUPABASE CLIENT

**Archivo: `frontend/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

// Usar variables de entorno - IMPORTANTE: Usa la ANON key, NO la service_role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Validación y diagnóstico
if (typeof window !== 'undefined') {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Faltan las variables de entorno de Supabase')
    console.error('   Crea un archivo .env.local en frontend/ con:')
    console.error('   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co')
    console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui')
    console.error('')
    console.error('   ⚠️  IMPORTANTE: Usa la clave "anon public", NO la "service_role"')
  } else {
    // Verificar si está usando service_role key (incorrecto)
    try {
      const decoded = JSON.parse(atob(supabaseAnonKey.split('.')[1]))
      if (decoded.role === 'service_role') {
        console.error('❌ ERROR CRÍTICO: Estás usando una service_role key en el cliente')
        console.error('   Esto es INCORRECTO y peligroso.')
        console.error('   Ve a Supabase Dashboard → Settings → API')
        console.error('   Copia la clave "anon public" (NO la service_role)')
        console.error('   Actualiza NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local')
      } else if (decoded.role === 'anon') {
        console.log('✅ Usando anon public key (correcto)')
      }
    } catch (e) {
      // Si no se puede decodificar, podría ser un formato incorrecto
      console.warn('⚠️  No se pudo validar el formato de la API key')
    }
  }
}

// Usar createBrowserClient de @supabase/ssr para sincronizar cookies correctamente
// createBrowserClient maneja las cookies automáticamente
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
```

**Archivo: `frontend/lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

export async function createClient(request?: NextRequest) {
  // Si hay un request (API route), usar sus cookies directamente
  if (request) {
    // Obtener todas las cookies del request
    const requestCookies = request.cookies.getAll()
    
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            // Retornar cookies del request
            return requestCookies
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            // En API routes, no podemos establecer cookies directamente
            // El middleware se encarga de esto
            // Pero podemos loggear para diagnóstico
            if (cookiesToSet.length > 0) {
              console.log('🔧 Supabase intentó establecer cookies:', cookiesToSet.map(c => c.name).join(', '))
            }
          },
        },
      }
    )
  }

  // Para Server Components, usar cookies() de next/headers
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Las cookies pueden no estar disponibles en algunos contextos
          }
        },
      },
    }
  )
}
```

**Archivo: `frontend/lib/supabase/middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refrescar la sesión si es necesario
  await supabase.auth.getUser()

  return supabaseResponse
}
```

**Archivo: `frontend/lib/supabase/helpers.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'

/**
 * Obtiene el usuario actual autenticado
 */
export async function getCurrentUser() {
  const supabase = await createClient()
  
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !authUser) {
    return null
  }

  // Obtener datos del usuario desde la tabla users
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (userError || !userData) {
    return null
  }

  return userData
}

/**
 * Verifica si el usuario está autenticado
 */
export async function isAuthenticated() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return !!user
}
```

**Archivo: `frontend/lib/api.ts`**

```typescript
import axios from 'axios'

// Usar las rutas API de Next.js (relativas, sin baseURL)
// Las rutas de Next.js están en /api/* y se ejecutan en el mismo servidor
const API_URL = '' // Rutas relativas para Next.js API routes

if (typeof window !== 'undefined') {
  console.log('🔧 API URL configurada: Rutas de Next.js (/api/*)')
}

const api = axios.create({
  baseURL: API_URL, // Vacío para usar rutas relativas
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 180000, // 3 minutos de timeout por defecto (para recibos grandes)
  withCredentials: true, // Incluir cookies para autenticación de Supabase
})

// Interceptor para agregar token de autenticación de Supabase
api.interceptors.request.use(async (config) => {
  // Verificar que estamos en el cliente
  if (typeof window !== 'undefined') {
    // Obtener token de Supabase en lugar de localStorage
    try {
      // Importación dinámica para evitar problemas de SSR
      const { supabase } = await import('./supabase/client')
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
      }
    } catch (error) {
      // Silenciar errores en el interceptor para no bloquear peticiones
      if (process.env.NODE_ENV === 'development') {
        console.warn('No se pudo obtener token de Supabase:', error)
      }
    }
  }
  return config
})

// Interceptor para manejar errores de respuesta
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si es error 401 (no autorizado), limpiar token y redirigir al login
    if (error.response?.status === 401) {
      // Limpiar token del localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
        // Redirigir al login solo si no estamos ya en la página de login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
    }
    
    // Log del error solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      const errorDetails = {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        code: error.code
      }
      
      // Mostrar mensaje más claro según el tipo de error
      if (!error.response) {
        console.error('❌ Error de conexión - No se recibió respuesta del servidor:', errorDetails)
        console.error('💡 Verifica que el servidor de Next.js esté corriendo')
      } else if (error.response.status === 401) {
        console.error('❌ Error de autenticación (401): Token expirado o inválido. Redirigiendo al login...')
      } else if (error.response.status === 404) {
        console.error('❌ Endpoint no encontrado (404):', errorDetails)
      } else {
        console.error('❌ API Error:', errorDetails)
      }
    }
    
    return Promise.reject(error)
  }
)

export default api
```

**Archivo: `frontend/lib/types.ts`**

```typescript
// Tipos compartidos para la aplicación

export interface User {
  id: number
  email: string
  phone: string
  name: string
  is_active: boolean
  is_family_admin: boolean
  family_id: number | null
  created_at: string
}

export interface FamilyBudget {
  id: number
  family_id: number
  category: string
  subcategory: string
  year: number
  total_amount: number
  budget_type: 'shared' | 'individual'  // Tipo de presupuesto
  distribution_method: 'equal' | 'percentage' | 'manual'  // Método de distribución
  auto_distribute: boolean  // Si se distribuye automáticamente
  target_user_id?: number | null  // Para presupuestos individuales
  created_at: string
  user_allocations?: UserBudget[]
  target_user?: User | null  // Usuario objetivo para presupuestos individuales
}

export interface UserBudget {
  id: number
  user_id: number
  family_budget_id: number
  allocated_amount: number
  spent_amount: number
  income_amount: number  // Ingresos adicionales asignados a este presupuesto
  available_amount: number  // Calculado: allocated + income - spent
  created_at: string
  user?: User
  family_budget?: FamilyBudget
}

export interface Transaction {
  id: number
  user_id: number
  family_budget_id: number | null
  date: string
  amount: number
  currency: string
  transaction_type: 'income' | 'expense'
  merchant_or_beneficiary: string | null
  category: string
  subcategory: string
  concept: string | null
  reference: string | null
  operation_id: string | null
  tracking_key: string | null
  notes: string | null
  status: string
  receipt_image_url: string | null
  whatsapp_message_id: string | null
  created_at: string
  user?: User
}

export interface Family {
  id: number
  name: string
  admin_id: number
  created_at: string
  members?: User[]
}

export interface AnnualBudgetMatrix {
  year: number
  meses: string[]
  matrix: BudgetMatrixRow[]
  total_conceptos: number
}

export interface BudgetMatrixRow {
  concepto: string
  categoria: string
  subcategoria: string
  meses: { [mes: string]: number }
  total_anual: number
}

export interface GlobalBudgetSummary {
  year: number
  summary: Array<{
    category: string
    subcategory: string
    shared_amount: number
    individual_amounts: { [userId: number]: { amount: number; name: string } }
    individual_total: number
    total_amount: number
  }>
  totals: {
    shared: number
    individual: number
    global: number
  }
}
```

---

## 4. SQL SUPABASE (COMPLETO)

### 4.1 Schema Principal

**Archivo: `supabase/schema.sql`**

[CONTENIDO COMPLETO - Ver archivo original, tiene 292 líneas]

### 4.2 Flujo Crear Familia

**Archivo: `supabase/flujo-crear-familia-completo.sql`**

[CONTENIDO COMPLETO - Ver archivo original, tiene 284 líneas]

### 4.3 Función Crear Familia Auto

**Archivo: `supabase/funcion-crear-familia-auto.sql`**

[CONTENIDO COMPLETO - Ver archivo original, tiene 85 líneas]

### 4.4 RLS - Ver Miembros de Familia

**Archivo: `supabase/fix-rls-ver-miembros-familia.sql`**

[CONTENIDO COMPLETO - Ver archivo original, tiene 139 líneas]

### 4.5 RLS - Presupuestos Completo

**Archivo: `supabase/fix-rls-presupuestos-completo.sql`**

[CONTENIDO COMPLETO - Ver archivo original, tiene 216 líneas]

### 4.6 RLS - Infinite Recursion Fix

**Archivo: `supabase/fix-rls-infinite-recursion.sql`**

[CONTENIDO COMPLETO - Ver archivo original, tiene 154 líneas]

### 4.7 RLS - Users Select

**Archivo: `supabase/fix-rls-users-select.sql`**

[CONTENIDO COMPLETO - Ver archivo original, tiene 55 líneas]

### 4.8 Funciones Presupuestos

**Archivo: `supabase/funciones-presupuestos.sql`**

[CONTENIDO COMPLETO - Ver archivo original, tiene 202 líneas]

---

## 5. RLS (ROW LEVEL SECURITY)

### 5.1 Políticas para Users

Ver archivos:
- `supabase/fix-rls-ver-miembros-familia.sql`
- `supabase/fix-rls-infinite-recursion.sql`
- `supabase/fix-rls-users-select.sql`

### 5.2 Políticas para Presupuestos

Ver archivo:
- `supabase/fix-rls-presupuestos-completo.sql`

---

## 6. RPC / FUNCTIONS

### 6.1 Funciones de Familia

- `create_family(p_family_name TEXT, p_admin_user_id UUID)`
- `assign_family_admin(p_user_id UUID, p_family_id INTEGER)`
- `add_family_member(p_user_id UUID, p_family_id INTEGER, p_is_admin BOOLEAN)`
- `create_family_for_user(p_user_id UUID, p_family_name TEXT)`

Ver: `supabase/flujo-crear-familia-completo.sql`

### 6.2 Funciones Helper RLS

- `get_user_family_id(p_user_id UUID)`
- `is_family_admin(p_user_id UUID)`

Ver: `supabase/fix-rls-ver-miembros-familia.sql`

### 6.3 Funciones de Presupuestos

- `get_family_budgets_with_calculations(p_family_id INTEGER, p_year INTEGER)`
- `update_user_budget_amounts()` (Trigger function)

Ver: `supabase/funciones-presupuestos.sql`

---

## 7. VARIABLES Y CONFIGURACIÓN

### 7.1 Next.js Config

**Archivo: `frontend/next.config.js`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
}

module.exports = nextConfig
```

### 7.2 TypeScript Config

**Archivo: `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 7.3 Package.json

**Archivo: `frontend/package.json`**

```json
{
  "name": "domus-plus-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@supabase/ssr": "^0.1.0",
    "@supabase/supabase-js": "^2.39.0",
    "autoprefixer": "^10.4.16",
    "axios": "^1.6.2",
    "date-fns": "^2.30.0",
    "next": "^14.0.3",
    "openai": "^4.20.0",
    "postcss": "^8.4.32",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.49.2",
    "recharts": "^2.10.3",
    "tailwindcss": "^3.3.6",
    "xlsx": "^0.18.5",
    "zustand": "^4.4.7"
  },
  "devDependencies": {
    "@types/node": "^20.10.5",
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "eslint": "^8.56.0",
    "eslint-config-next": "14.0.3",
    "typescript": "^5.3.3"
  }
}
```

### 7.4 Variables de Entorno (Ejemplo)

**Archivo: `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

---

## NOTAS IMPORTANTES

1. **RLS**: Todas las tablas tienen RLS habilitado. Las políticas usan funciones `SECURITY DEFINER` para evitar recursión infinita.

2. **Autenticación**: Se usa Supabase Auth con cookies para manejo de sesiones.

3. **API Routes**: Todas las rutas API están en `/api/*` y usan `createClient` de `@/lib/supabase/server`.

4. **Excel Import**: El sistema permite importar presupuestos desde Excel con selección de datos.

5. **Familia**: Los usuarios pueden crear familias automáticamente si no tienen una asignada.

---

**FIN DEL DOCUMENTO DE AUDITORÍA**
