import axios from 'axios'

// El frontend corre en puerto 3000, el backend en puerto 8000
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

console.log('🔧 API URL configurada:', API_URL)

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 180000, // 3 minutos de timeout por defecto (para recibos grandes)
})

// Interceptor para agregar token de autenticación
api.interceptors.request.use((config) => {
  // Verificar que estamos en el cliente antes de acceder a localStorage
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
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
        console.error('💡 Verifica que el backend esté corriendo en http://localhost:8000')
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

