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
