/**
 * Script de Monitoreo para Upload de Recibos
 * 
 * Copia y pega este script completo en la Console del navegador
 * ANTES de hacer click en "Procesar Recibo"
 * 
 * Este script monitoreará:
 * - Cambios de URL (redirects)
 * - Estado de la sesión cada 5 segundos
 * - Requests de red (especialmente /api/receipts/process)
 * - Tiempo transcurrido
 */

(function() {
  console.clear()
  console.log('%c🔍 MONITOR DE UPLOAD DE RECIBOS', 'font-size: 20px; font-weight: bold; color: #4CAF50')
  console.log('%c================================', 'font-size: 16px; color: #4CAF50')
  console.log('')
  console.log('📅 Timestamp:', new Date().toISOString())
  console.log('🌐 URL inicial:', window.location.href)
  console.log('👤 Usuario:', localStorage.getItem('domus_token') ? 'Con token backend' : 'Sin token backend')
  console.log('')
  console.log('%c⚠️  IMPORTANTE: Deja esta consola abierta durante todo el proceso', 'font-size: 14px; color: #FF9800')
  console.log('')

  // Estado global del monitor
  const monitor = {
    startTime: Date.now(),
    lastUrl: window.location.href,
    checkCount: 0,
    urlChanges: [],
    sessionChecks: [],
    networkRequests: [],
    uploadStarted: false,
    uploadCompleted: false
  }

  // Función para formatear tiempo transcurrido
  function getElapsedTime() {
    const elapsed = Date.now() - monitor.startTime
    const seconds = Math.floor(elapsed / 1000)
    const ms = elapsed % 1000
    return `${seconds}s ${ms}ms`
  }

  // Función para obtener timestamp formateado
  function getTimestamp() {
    const now = new Date()
    return now.toLocaleTimeString() + '.' + now.getMilliseconds().toString().padStart(3, '0')
  }

  // 1. MONITOREAR CAMBIOS DE URL (cada 100ms)
  const urlMonitor = setInterval(() => {
    if (window.location.href !== monitor.lastUrl) {
      const change = {
        from: monitor.lastUrl,
        to: window.location.href,
        timestamp: getTimestamp(),
        elapsed: getElapsedTime()
      }
      monitor.urlChanges.push(change)
      
      console.log('')
      console.log('%c⚠️  ⚠️  ⚠️  URL CAMBIÓ  ⚠️  ⚠️  ⚠️', 'font-size: 18px; font-weight: bold; color: #FF0000; background: #FFEB3B')
      console.log('%cDe:', 'font-weight: bold', monitor.lastUrl)
      console.log('%cA:', 'font-weight: bold', window.location.href)
      console.log('%cTiempo transcurrido:', 'font-weight: bold', change.elapsed)
      console.log('%cTimestamp:', 'font-weight: bold', change.timestamp)
      console.log('')
      
      // Si cambió a /login, es el bug
      if (window.location.pathname === '/login') {
        console.log('%c🐛 BUG DETECTADO: Redirect inesperado a /login', 'font-size: 16px; font-weight: bold; color: #FF0000; background: #FFEB3B')
        console.log('%cEsto NO debería pasar durante el upload', 'font-size: 14px; color: #FF0000')
      }
      
      monitor.lastUrl = window.location.href
    }
  }, 100)

  // 2. MONITOREAR SESIÓN (cada 5 segundos)
  const sessionMonitor = setInterval(async () => {
    monitor.checkCount++
    const elapsed = getElapsedTime()
    
    try {
      // Verificar sesión de Supabase
      const { data: { session } } = await window.supabase.auth.getSession()
      const status = session ? '✅ Valid' : '❌ Expired'
      const expiresIn = session ? Math.round((session.expires_at * 1000 - Date.now()) / 1000) : 0
      
      const check = {
        count: monitor.checkCount,
        timestamp: getTimestamp(),
        elapsed: elapsed,
        status: status,
        expiresIn: expiresIn + 's',
        url: window.location.pathname,
        user: session?.user?.email || 'N/A'
      }
      monitor.sessionChecks.push(check)
      
      // Log con color según el estado
      const color = session ? '#4CAF50' : '#FF0000'
      console.log(
        `%c📊 Check #${monitor.checkCount} (${getTimestamp()}) [${elapsed}]:`,
        `font-weight: bold; color: ${color}`,
        {
          status,
          expiresIn: check.expiresIn,
          url: check.url,
          user: check.user
        }
      )
      
      // Advertencia si la sesión está por expirar
      if (session && expiresIn < 300) { // Menos de 5 minutos
        console.log('%c⚠️  Advertencia: La sesión expira en menos de 5 minutos', 'color: #FF9800')
      }
      
      // Alerta si la sesión expiró durante el upload
      if (!session && monitor.uploadStarted && !monitor.uploadCompleted) {
        console.log('%c❌ SESIÓN EXPIRÓ DURANTE EL UPLOAD', 'font-size: 16px; font-weight: bold; color: #FF0000; background: #FFEB3B')
      }
    } catch (error) {
      console.error('Error verificando sesión:', error)
    }
  }, 5000)

  // 3. MONITOREAR REQUESTS DE RED
  // Interceptar fetch
  const originalFetch = window.fetch
  window.fetch = async function(...args) {
    const url = args[0]
    const options = args[1] || {}
    const method = options.method || 'GET'
    
    // Si es el request de procesamiento de recibos
    if (url.includes('/api/receipts/process')) {
      monitor.uploadStarted = true
      console.log('')
      console.log('%c🚀 UPLOAD INICIADO', 'font-size: 16px; font-weight: bold; color: #2196F3; background: #E3F2FD')
      console.log('%cURL:', 'font-weight: bold', url)
      console.log('%cMétodo:', 'font-weight: bold', method)
      console.log('%cTiempo transcurrido:', 'font-weight: bold', getElapsedTime())
      console.log('%cTimestamp:', 'font-weight: bold', getTimestamp())
      
      // Verificar headers
      const headers = options.headers || {}
      console.log('%cHeaders:', 'font-weight: bold', {
        Authorization: headers.Authorization ? 'Bearer [PRESENTE]' : '[AUSENTE]',
        'Content-Type': headers['Content-Type'] || 'N/A'
      })
      console.log('')
    }
    
    // Ejecutar el fetch original
    const startTime = Date.now()
    try {
      const response = await originalFetch.apply(this, args)
      const duration = Date.now() - startTime
      
      // Si es el request de procesamiento de recibos
      if (url.includes('/api/receipts/process')) {
        monitor.uploadCompleted = true
        
        const requestInfo = {
          url: url,
          method: method,
          status: response.status,
          statusText: response.statusText,
          duration: duration + 'ms',
          timestamp: getTimestamp(),
          elapsed: getElapsedTime()
        }
        monitor.networkRequests.push(requestInfo)
        
        console.log('')
        if (response.ok) {
          console.log('%c✅ UPLOAD COMPLETADO EXITOSAMENTE', 'font-size: 16px; font-weight: bold; color: #4CAF50; background: #E8F5E9')
        } else {
          console.log('%c❌ UPLOAD FALLÓ', 'font-size: 16px; font-weight: bold; color: #FF0000; background: #FFEBEE')
        }
        console.log('%cStatus:', 'font-weight: bold', response.status, response.statusText)
        console.log('%cDuración:', 'font-weight: bold', requestInfo.duration)
        console.log('%cTiempo total transcurrido:', 'font-weight: bold', requestInfo.elapsed)
        console.log('%cTimestamp:', 'font-weight: bold', requestInfo.timestamp)
        console.log('')
        
        // Si fue 401, es un problema de autenticación
        if (response.status === 401) {
          console.log('%c🔒 ERROR 401: No autorizado', 'font-size: 14px; font-weight: bold; color: #FF0000')
          console.log('%cEsto puede causar redirect a /login', 'color: #FF9800')
        }
      }
      
      return response
    } catch (error) {
      const duration = Date.now() - startTime
      
      if (url.includes('/api/receipts/process')) {
        monitor.uploadCompleted = true
        
        console.log('')
        console.log('%c❌ UPLOAD ERROR', 'font-size: 16px; font-weight: bold; color: #FF0000; background: #FFEBEE')
        console.log('%cError:', 'font-weight: bold', error.message)
        console.log('%cDuración:', 'font-weight: bold', duration + 'ms')
        console.log('%cTiempo total transcurrido:', 'font-weight: bold', getElapsedTime())
        console.log('')
      }
      
      throw error
    }
  }

  // 4. FUNCIÓN PARA DETENER EL MONITOR
  window.stopMonitor = function() {
    clearInterval(urlMonitor)
    clearInterval(sessionMonitor)
    window.fetch = originalFetch
    
    console.log('')
    console.log('%c⏹️  MONITOR DETENIDO', 'font-size: 16px; font-weight: bold; color: #FF9800')
    console.log('')
    console.log('%c📊 RESUMEN FINAL', 'font-size: 18px; font-weight: bold; color: #2196F3')
    console.log('%c==============', 'font-size: 16px; color: #2196F3')
    console.log('')
    console.log('⏱️  Tiempo total:', getElapsedTime())
    console.log('🔄 Cambios de URL:', monitor.urlChanges.length)
    console.log('📊 Checks de sesión:', monitor.sessionChecks.length)
    console.log('🌐 Requests monitoreados:', monitor.networkRequests.length)
    console.log('🚀 Upload iniciado:', monitor.uploadStarted ? 'Sí' : 'No')
    console.log('✅ Upload completado:', monitor.uploadCompleted ? 'Sí' : 'No')
    console.log('')
    
    if (monitor.urlChanges.length > 0) {
      console.log('%c🔄 Cambios de URL detectados:', 'font-weight: bold; color: #FF9800')
      monitor.urlChanges.forEach((change, i) => {
        console.log(`  ${i + 1}. [${change.elapsed}] ${change.from} → ${change.to}`)
      })
      console.log('')
    }
    
    if (monitor.networkRequests.length > 0) {
      console.log('%c🌐 Requests de upload:', 'font-weight: bold; color: #2196F3')
      monitor.networkRequests.forEach((req, i) => {
        console.log(`  ${i + 1}. [${req.elapsed}] ${req.method} ${req.url} → ${req.status} (${req.duration})`)
      })
      console.log('')
    }
    
    console.log('%c💾 Datos completos guardados en: window.monitorData', 'color: #4CAF50')
    window.monitorData = monitor
  }

  // 5. DETENER AUTOMÁTICAMENTE DESPUÉS DE 3 MINUTOS
  setTimeout(() => {
    console.log('')
    console.log('%c⏰ Tiempo límite alcanzado (3 minutos)', 'font-size: 14px; color: #FF9800')
    window.stopMonitor()
  }, 180000)

  // Mensaje final
  console.log('')
  console.log('%c✅ Monitor activo y listo', 'font-size: 16px; font-weight: bold; color: #4CAF50')
  console.log('')
  console.log('%cAhora puedes:', 'font-weight: bold')
  console.log('  1. Seleccionar el archivo de recibo')
  console.log('  2. Click en "Procesar Recibo"')
  console.log('  3. Observar los logs en tiempo real')
  console.log('')
  console.log('%cPara detener manualmente:', 'font-weight: bold')
  console.log('  stopMonitor()')
  console.log('')
  console.log('%cPara ver datos completos:', 'font-weight: bold')
  console.log('  window.monitorData')
  console.log('')
  console.log('%c⏳ El monitor se detendrá automáticamente en 3 minutos', 'color: #FF9800')
  console.log('')
})()
