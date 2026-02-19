import axios from 'axios'

// Usar las rutas API de Next.js (relativas, sin baseURL)
// Las rutas de Next.js están en /api/* y se ejecutan en el mismo servidor
const API_URL = '' // Rutas relativas para Next.js API routes

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
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

// Interceptor: usar token del backend (domus_token) o, si no hay, sesión de Supabase
api.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    const backendToken = localStorage.getItem('domus_token')
    if (backendToken) {
      config.headers.Authorization = `Bearer ${backendToken}`
      return config
    }
    try {
      const { supabase } = await import('./supabase/client')
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
      }
    } catch {
      // Sin Supabase o sin sesión
    }
  }
  return config
})

// Interceptor para manejar errores de respuesta
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si es error 401 (no autorizado), NO redirigir automáticamente.
    // En esta app hay modo híbrido (token backend + Supabase). Un 401 en una ruta
    // de Next/Supabase no debe sacar al usuario que está autenticado con `domus_token`.
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        const hasBackendToken = !!localStorage.getItem('domus_token')
        // Solo limpiar el token legacy (si existe). Mantener `domus_token`.
        // El guardado/expiración del backend se maneja por página.
        localStorage.removeItem('token')
        if (!hasBackendToken) {
          // Si no hay token backend, dejar que la UI decida (no forzar redirect).
          // Esto evita “saltos” inesperados durante procesos largos (ej. escaneo de recibos).
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
        console.error('❌ Error de autenticación (401):', errorDetails)
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

