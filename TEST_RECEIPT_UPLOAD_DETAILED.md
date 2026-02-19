# 🧪 Test Detallado: Upload de Recibos - Verificar Redirect a /login

## 📋 Objetivo

Verificar si la aplicación redirige a `/login` durante el procesamiento de recibos, especialmente alrededor de los 15-20 segundos de procesamiento.

## 🎯 Archivos de Prueba

- **Archivo 1:** `/Users/gonzalomontanofimbres/domus-plus/backend/uploads/receipts/receipt_54.jpg` (197KB)
- **Archivo 2:** `/Users/gonzalomontanofimbres/domus-plus/backend/uploads/receipts/receipt_55.jpg` (197KB)

## 🔧 Preparación

### 1. Verificar que el servidor está corriendo

```bash
# Terminal 1 - Frontend
cd /Users/gonzalomontanofimbres/domus-plus/frontend
npm run dev

# Terminal 2 - Backend (opcional, si usas el backend de FastAPI)
cd /Users/gonzalomontanofimbres/domus-plus/backend
uvicorn app.main:app --reload --port 8000
```

### 2. Abrir DevTools con configuración específica

1. Abre Chrome o Firefox
2. Presiona `F12` o `Cmd+Option+I`
3. Configura las siguientes tabs:

#### Console Tab:
- ✅ Activa "Preserve log"
- ✅ Activa "Show timestamps"
- ✅ Filtra por nivel: All levels

#### Network Tab:
- ✅ Activa "Preserve log"
- ✅ Desactiva "Disable cache"
- ✅ Filtra por: All, XHR/Fetch
- ✅ Muestra columnas: Name, Status, Type, Size, Time

#### Application Tab (opcional):
- Ve a Storage → Cookies
- Ve a Local Storage
- Verifica que `domus_token` existe

## 📝 Procedimiento de Prueba

### PASO 1: Navegar a la Aplicación

```
http://localhost:3000
```

**Captura:**
- Screenshot inicial
- URL en la barra de direcciones

### PASO 2: Login (si es necesario)

Si estás en la página de login:

1. **Email:** `gonzalomail@me.com`
2. **Password:** `domus123`
3. Click en "Iniciar Sesión"

**Verificar en Console:**
```javascript
// Verificar token del backend
console.log('Backend token:', localStorage.getItem('domus_token'))

// Verificar sesión de Supabase
const { data: { session } } = await supabase.auth.getSession()
console.log('Supabase session:', {
  user: session?.user?.email,
  expiresAt: new Date(session?.expires_at * 1000),
  expiresIn: Math.round((session?.expires_at * 1000 - Date.now()) / 1000 / 60) + ' min'
})
```

**Resultado esperado:**
```
Backend token: eyJ... (o null si no hay)
Supabase session: {
  user: "gonzalomail@me.com",
  expiresAt: [fecha futura],
  expiresIn: "59 min" (o similar)
}
```

### PASO 3: Navegar a Transacciones

```
http://localhost:3000/transactions
```

**Verificar:**
- URL: `http://localhost:3000/transactions`
- Página cargada completamente
- Botón "Subir Recibo" visible

### PASO 4: Abrir Modal de Upload

1. Click en **"Subir Recibo"**
2. Modal aparece con título "Subir Recibo"

**Verificar en el modal:**
- Campo "Asignar a usuario"
- Input de archivo
- Botones: "Procesar Recibo", "Cerrar"

### PASO 5: Preparar Monitoreo

**ANTES de seleccionar el archivo:**

#### En Console, ejecuta este script de monitoreo:

```javascript
// Script de monitoreo en tiempo real
console.clear()
console.log('🔍 INICIANDO MONITOREO DE UPLOAD')
console.log('================================')
console.log('Timestamp:', new Date().toISOString())
console.log('URL inicial:', window.location.href)
console.log('')

// Monitorear cambios de URL
let lastUrl = window.location.href
setInterval(() => {
  if (window.location.href !== lastUrl) {
    console.log('⚠️  URL CAMBIÓ:', {
      from: lastUrl,
      to: window.location.href,
      timestamp: new Date().toISOString(),
      elapsed: '(ver tiempo en timestamp)'
    })
    lastUrl = window.location.href
  }
}, 100)

// Monitorear sesión cada 5 segundos
let checkCount = 0
const sessionMonitor = setInterval(async () => {
  checkCount++
  const { data: { session } } = await supabase.auth.getSession()
  const status = session ? '✅ Valid' : '❌ Expired'
  const expiresIn = session ? Math.round((session.expires_at * 1000 - Date.now()) / 1000) : 0
  console.log(`📊 Check #${checkCount} (${new Date().toLocaleTimeString()}):`, {
    status,
    expiresIn: expiresIn + 's',
    url: window.location.pathname
  })
}, 5000)

// Detener después de 3 minutos
setTimeout(() => {
  clearInterval(sessionMonitor)
  console.log('⏹️  Monitoreo detenido después de 3 minutos')
}, 180000)

console.log('✅ Monitoreo activo. Ahora selecciona y procesa el recibo.')
```

#### En Network Tab:
- Limpia todos los requests (icono de basura)
- Asegúrate de que "Preserve log" está activo

### PASO 6: Seleccionar Archivo

1. Click en el input de archivo
2. Navega a: `/Users/gonzalomontanofimbres/domus-plus/backend/uploads/receipts/`
3. Selecciona: **`receipt_54.jpg`** (197KB)
4. Verifica que el nombre aparece en el modal

### PASO 7: Iniciar Procesamiento - MOMENTO CRÍTICO

**Preparación final:**
1. Mira el reloj o inicia un cronómetro
2. Asegúrate de que Console está visible
3. Asegúrate de que Network está visible
4. Observa la URL en la barra de direcciones

**Ahora click en: "Procesar Recibo"**

**Anota la hora exacta:** ___:___:___

### PASO 8: Observación Cronometrada

#### ⏱️ T = 0 segundos (inmediatamente después del click)

**Observar:**
- [ ] Modal muestra "Procesando recibo..."
- [ ] Barra de progreso aparece (0%)
- [ ] URL: `http://localhost:3000/transactions`
- [ ] Network: Request a `/api/receipts/process` iniciado (Pending)

**En Console:**
```
Debería aparecer:
📊 Check #1 (HH:MM:SS): { status: '✅ Valid', expiresIn: 'XXXXs', url: '/transactions' }
```

#### ⏱️ T = 5 segundos

**Observar:**
- [ ] Barra de progreso: ~10-20%
- [ ] URL: `http://localhost:3000/transactions`
- [ ] Network: Request sigue Pending

**En Console:**
```
📊 Check #2 (HH:MM:SS): { status: '✅ Valid', expiresIn: 'XXXXs', url: '/transactions' }
```

#### ⏱️ T = 10 segundos

**Observar:**
- [ ] Barra de progreso: ~30-40%
- [ ] URL: `http://localhost:3000/transactions`
- [ ] Network: Request sigue Pending

**En Console:**
```
📊 Check #3 (HH:MM:SS): { status: '✅ Valid', expiresIn: 'XXXXs', url: '/transactions' }
```

#### ⏱️ T = 15 segundos ⚠️ CRÍTICO

**Observar MUY CUIDADOSAMENTE:**
- [ ] Barra de progreso: ~50-60%
- [ ] URL: ¿Sigue siendo `/transactions`? ⚠️
- [ ] Network: ¿Request sigue Pending o cambió?
- [ ] ¿Apareció algún redirect?

**En Console:**
```
📊 Check #4 (HH:MM:SS): { status: '?', expiresIn: '?', url: '?' }

¿Apareció esto?
⚠️  URL CAMBIÓ: { from: '/transactions', to: '/login', ... }
```

**Si hay redirect a /login:**
- ✋ DETENTE AQUÍ
- 📸 Captura screenshot
- 📋 Copia TODO el contenido de Console
- 📋 Copia el request `/api/receipts/process` de Network (status, response, headers)
- 📝 Anota el tiempo exacto del redirect

#### ⏱️ T = 20 segundos ⚠️ CRÍTICO

**Observar:**
- [ ] Barra de progreso: ~70-80%
- [ ] URL: ¿Sigue siendo `/transactions`?
- [ ] Network: ¿Request sigue Pending?

**En Console:**
```
📊 Check #5 (HH:MM:SS): { status: '?', expiresIn: '?', url: '?' }
```

#### ⏱️ T = 30 segundos

**Observar:**
- [ ] Barra de progreso: ~90-95%
- [ ] URL: `http://localhost:3000/transactions`
- [ ] Network: Request puede estar completando

#### ⏱️ T = 30-120 segundos (hasta completar)

**Esperar hasta que:**
- Request en Network muestra status (200, 401, 500, etc.)
- O aparece un alert/mensaje
- O hay redirect

### PASO 9: Resultado Final

#### ✅ Si TODO salió bien:

**Deberías ver:**
1. Alert: "✅ Recibos procesados exitosamente"
2. Modal se cierra
3. URL permanece: `http://localhost:3000/transactions`
4. Network: `/api/receipts/process` → Status **200 OK**
5. Console: Sesión sigue válida

**En Console, verifica:**
```javascript
const { data: { session } } = await supabase.auth.getSession()
console.log('✅ RESULTADO FINAL:', {
  url: window.location.href,
  sessionValid: !!session,
  sessionUser: session?.user?.email
})
```

#### ❌ Si hubo el BUG:

**Deberías ver:**
1. URL cambió a: `http://localhost:3000/login`
2. Página de login aparece
3. Network: Posible status 401 o redirect
4. Console: Mensaje de URL cambió

**En Console, busca:**
```
⚠️  URL CAMBIÓ: {
  from: "http://localhost:3000/transactions",
  to: "http://localhost:3000/login",
  timestamp: "...",
  elapsed: "..."
}
```

### PASO 10: Capturar Evidencia

#### En Network Tab:

1. Busca el request: `/api/receipts/process`
2. Click derecho → Copy → Copy as cURL
3. Guarda en un archivo

4. Click en el request para ver detalles:
   - **General:** Request URL, Request Method, Status Code
   - **Response Headers:** Todos los headers
   - **Request Headers:** Authorization, Cookie, etc.
   - **Response:** Body completo (si hay)
   - **Timing:** Tiempo total, tiempo de espera, etc.

#### En Console Tab:

1. Click derecho en el área de logs
2. "Save as..." → Guarda como `console-log.txt`

O copia manualmente:
- Todos los logs de monitoreo
- Cualquier error en rojo
- El log final de verificación

#### Screenshots:

1. **Screenshot 1:** Página de transacciones ANTES del upload
2. **Screenshot 2:** Modal con archivo seleccionado
3. **Screenshot 3:** Durante el procesamiento (~15s)
4. **Screenshot 4:** Resultado final (éxito o redirect)

### PASO 11: Prueba con el Segundo Archivo (Opcional)

Si la primera prueba fue exitosa, repite con `receipt_55.jpg`:

1. Refresca la página: `http://localhost:3000/transactions`
2. Verifica sesión en Console
3. Repite pasos 4-10 con `receipt_55.jpg`
4. Compara resultados

## 📊 Reporte de Resultados

### Información del Sistema

- **Navegador:** _____________ (Chrome/Firefox/Safari)
- **Versión:** _____________
- **OS:** macOS 24.6.0
- **Fecha/Hora:** _____________

### Resultado de la Prueba

#### Archivo: receipt_54.jpg

1. **¿Upload completó exitosamente?**
   - [ ] Sí ✅
   - [ ] No ❌

2. **¿Hubo redirect a /login?**
   - [ ] No ✅ (correcto)
   - [ ] Sí ❌ (bug)
   - Si sí, ¿en qué momento? _____ segundos

3. **URL final después del procesamiento:**
   - `_______________________________`

4. **Status del request `/api/receipts/process`:**
   - [ ] 200 OK ✅
   - [ ] 401 Unauthorized ❌
   - [ ] 500 Internal Server Error ❌
   - [ ] Otro: _______

5. **Tiempo total de procesamiento:**
   - _____ segundos

6. **¿La sesión permaneció válida?**
   - [ ] Sí ✅
   - [ ] No ❌

7. **¿Apareció algún mensaje de error?**
   - [ ] No ✅
   - [ ] Sí ❌ → Mensaje: _______________________________

#### Observaciones Específicas en Tiempos Críticos

**A los 15 segundos:**
- URL: _______________________________
- Status de sesión: _______________________________
- Barra de progreso: _______%
- ¿Algún cambio sospechoso?: _______________________________

**A los 20 segundos:**
- URL: _______________________________
- Status de sesión: _______________________________
- Barra de progreso: _______%
- ¿Algún cambio sospechoso?: _______________________________

#### Errores en Console

```
[Pega aquí cualquier error que aparezca en rojo]
```

#### Requests Sospechosos en Network

```
[Lista cualquier request con status 401, 403, 500, o redirects]

Ejemplo:
- GET /api/users/me → 401 Unauthorized
- POST /api/receipts/process → 401 Unauthorized
- GET /login → 200 OK (redirect)
```

#### Headers del Request Principal

```
[Pega los headers del request /api/receipts/process]

Request Headers:
- Authorization: Bearer ...
- Cookie: ...
- Content-Type: ...

Response Headers:
- Status: ...
- Location: ... (si hay redirect)
```

### Análisis del Fix

**¿El fix implementado funcionó?**
- [ ] Sí - No hubo redirect durante el upload ✅
- [ ] No - Hubo redirect a /login ❌
- [ ] Parcialmente - Hubo problemas pero no redirect

**Si NO funcionó, posibles causas:**
- [ ] Sesión expiró antes del upload
- [ ] Token del backend inválido
- [ ] Error en el API endpoint
- [ ] Problema de RLS en Supabase
- [ ] Otro: _______________________________

## 🔧 Troubleshooting

### Si el servidor no responde:

```bash
# Verifica que está corriendo
curl http://localhost:3000

# Reinicia el servidor
cd frontend
npm run dev
```

### Si hay error de OPENAI_API_KEY:

```bash
# Verifica que está configurada
grep OPENAI_API_KEY frontend/.env.local

# Si no está, agrégala:
echo "OPENAI_API_KEY=sk-..." >> frontend/.env.local
```

### Si la sesión expira inmediatamente:

```javascript
// En Console, refresca manualmente
const { data, error } = await supabase.auth.refreshSession()
console.log('Session refreshed:', data.session ? 'OK' : 'FAILED')
```

### Si no puedes seleccionar el archivo:

```bash
# Verifica que existe
ls -lh /Users/gonzalomontanofimbres/domus-plus/backend/uploads/receipts/receipt_54.jpg

# Usa un archivo alternativo
ls -lh /Users/gonzalomontanofimbres/domus-plus/frontend/public/test-receipt.png
```

## ✅ Checklist Final

Antes de reportar, asegúrate de tener:

- [ ] Screenshots de cada paso crítico
- [ ] Console log completo guardado
- [ ] Network tab con el request `/api/receipts/process` y sus detalles
- [ ] Tiempos exactos anotados (especialmente 15-20s)
- [ ] URL final después del procesamiento
- [ ] Status code del request
- [ ] Estado de la sesión antes y después
- [ ] Cualquier mensaje de error visible

## 📞 Siguiente Paso

Una vez completada la prueba, reporta:

1. **Resultado principal:** ¿Funcionó el fix? (Sí/No)
2. **Evidencia:** Screenshots + logs
3. **Detalles:** Qué pasó a los 15-20 segundos
4. **Requests sospechosos:** Status codes y headers

---

**¡Buena suerte con la prueba!** 🚀

**Nota:** Si encuentras el bug (redirect a /login), NO es tu culpa. Es exactamente lo que estamos investigando. Captura toda la evidencia y reporta.
