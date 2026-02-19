# ⚡ Guía Rápida de Prueba - Upload de Recibos

## 🎯 Objetivo
Verificar si hay redirect a `/login` durante el upload de recibos, especialmente a los 15-20 segundos.

## 🚀 Pasos Rápidos

### 1. Preparar Navegador
```
1. Abre Chrome/Firefox
2. Ve a: http://localhost:3000
3. Presiona F12 (DevTools)
4. Ve a la tab "Console"
5. Activa "Preserve log"
```

### 2. Copiar Script de Monitoreo
```bash
# Abre el archivo:
cat /Users/gonzalomontanofimbres/domus-plus/browser-monitor-script.js

# Copia TODO el contenido
# Pega en la Console del navegador
# Presiona Enter
```

Deberías ver:
```
🔍 MONITOR DE UPLOAD DE RECIBOS
================================
✅ Monitor activo y listo
```

### 3. Login
```
Email: gonzalomail@me.com
Password: domus123
```

### 4. Ir a Transacciones
```
http://localhost:3000/transactions
```

### 5. Subir Recibo
```
1. Click "Subir Recibo"
2. Selecciona: /Users/gonzalomontanofimbres/domus-plus/backend/uploads/receipts/receipt_54.jpg
3. Click "Procesar Recibo"
4. OBSERVA LA CONSOLE
```

### 6. Observar (15-20 segundos)

**✅ CORRECTO (sin bug):**
```
📊 Check #1: { status: '✅ Valid', url: '/transactions' }
📊 Check #2: { status: '✅ Valid', url: '/transactions' }
📊 Check #3: { status: '✅ Valid', url: '/transactions' }
📊 Check #4: { status: '✅ Valid', url: '/transactions' }
✅ UPLOAD COMPLETADO EXITOSAMENTE
```

**❌ INCORRECTO (con bug):**
```
📊 Check #1: { status: '✅ Valid', url: '/transactions' }
📊 Check #2: { status: '✅ Valid', url: '/transactions' }
⚠️  ⚠️  ⚠️  URL CAMBIÓ  ⚠️  ⚠️  ⚠️
De: http://localhost:3000/transactions
A: http://localhost:3000/login
🐛 BUG DETECTADO: Redirect inesperado a /login
```

### 7. Detener Monitor
```javascript
// En Console:
stopMonitor()
```

### 8. Ver Resumen
```javascript
// En Console:
window.monitorData
```

## 📊 Qué Reportar

### Si NO hubo redirect (✅ Fix funciona):
```
✅ URL permaneció en /transactions
✅ Upload completó exitosamente
✅ Status 200 OK
✅ Sesión válida durante todo el proceso
```

### Si hubo redirect (❌ Bug persiste):
```
❌ URL cambió a /login
❌ Tiempo del redirect: ____ segundos
❌ Status del request: ____
❌ Logs de Console (copiar todo)
```

## 🔍 Archivos de Prueba

- **Archivo 1:** `backend/uploads/receipts/receipt_54.jpg` (197KB)
- **Archivo 2:** `backend/uploads/receipts/receipt_55.jpg` (197KB)
- **Alternativo:** `frontend/public/test-receipt.png` (28KB)

## 📝 Documentación Completa

Para instrucciones detalladas, ver:
- `TEST_RECEIPT_UPLOAD_DETAILED.md` - Guía paso a paso completa
- `SOLUCION_REDIRECT_LOGIN_DURANTE_UPLOAD.md` - Documentación técnica del fix
- `RESUMEN_FIX_REDIRECT_LOGIN.md` - Resumen ejecutivo

## 🆘 Troubleshooting Rápido

**Servidor no corre:**
```bash
cd frontend && npm run dev
```

**Script no funciona:**
```javascript
// Verifica que supabase está disponible:
console.log('Supabase:', typeof window.supabase)
```

**Sesión expirada:**
```javascript
// Refresca sesión:
await supabase.auth.refreshSession()
```

## ⏱️ Tiempos Esperados

- **Inicio del upload:** 0s
- **Progreso visible:** 5-10s
- **⚠️ Zona crítica:** 15-20s (observar cuidadosamente)
- **Completar:** 30-120s (depende del tamaño)

## 🎯 Criterio de Éxito

**La prueba PASA si:**
- ✅ URL permanece en `/transactions` durante TODO el proceso
- ✅ No hay redirect a `/login`
- ✅ Upload completa con status 200
- ✅ Sesión válida al final

**La prueba FALLA si:**
- ❌ Redirect a `/login` en cualquier momento
- ❌ Status 401 en el request
- ❌ Sesión expira durante el upload

---

**¡Listo para probar!** 🚀

**Tiempo estimado:** 5-10 minutos por prueba
