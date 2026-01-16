# 🔧 Solución: Dashboard se Queda en "Cargando dashboard..."

## ❌ Problema

Después de iniciar sesión, el dashboard se queda mostrando "Cargando dashboard..." indefinidamente.

## 🔍 Causas Posibles

1. **La sesión no se está guardando correctamente** después del login
2. **`getSession()` está fallando silenciosamente** o tomando mucho tiempo
3. **Problema de conexión con Supabase** (API key incorrecta o red)
4. **La sesión expiró** antes de llegar al dashboard

## ✅ Solución Implementada

He mejorado el código para:

1. **Agregar timeout**: Si `getSession()` tarda más de 5 segundos, redirige al login
2. **Mejor manejo de errores**: Muestra errores en la consola para diagnosticar
3. **Verificación de sesión**: Después del login, verifica que la sesión se guardó
4. **Logging mejorado**: Muestra mensajes en la consola para seguir el flujo

## 🔍 Pasos para Diagnosticar

### 1. Abre la Consola del Navegador

1. Presiona `F12` o `Cmd + Option + I` (Mac)
2. Ve a la pestaña **Console**
3. Intenta iniciar sesión de nuevo
4. Observa los mensajes que aparecen

### 2. Busca estos Mensajes

**Durante el login:**
- `🔐 Intentando iniciar sesión con: [email]`
- `✅ Login exitoso`
- `✅ Sesión verificada, redirigiendo...`

**En el dashboard:**
- `🔍 Verificando sesión...`
- `✅ Sesión encontrada: [email]`

**Si hay errores:**
- `❌ Error de autenticación: [mensaje]`
- `⏱️ Timeout al obtener sesión`
- `⚠️ Sesión no se guardó correctamente`

### 3. Verifica la API Key

Asegúrate de que estás usando la `anon public` key:

```bash
cd /Users/gonzalomontanofimbres/domus-plus/frontend
./verificar-env.sh
```

Debería mostrar: `✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: anon public key (correcto)`

## 🔄 Reiniciar el Servidor

Después de los cambios, reinicia el servidor:

```bash
# Detén el servidor (Ctrl+C)
cd /Users/gonzalomontanofimbres/domus-plus/frontend
rm -rf .next
npm run dev
```

## 💡 Soluciones Adicionales

### Si la sesión no se guarda

1. **Limpia el localStorage del navegador:**
   - Abre la consola (F12)
   - Ve a la pestaña **Application** (o **Almacenamiento**)
   - Busca **Local Storage** → `http://localhost:3000`
   - Haz clic derecho → **Clear** (o elimina manualmente las entradas de Supabase)

2. **Intenta en modo incógnito:**
   - Abre una ventana de incógnito
   - Ve a `http://localhost:3000/login`
   - Intenta iniciar sesión

### Si el timeout se activa

Si ves el mensaje "⏱️ Timeout al obtener sesión", significa que:
- La conexión con Supabase es lenta
- Hay un problema de red
- La API key podría estar incorrecta

**Solución:**
1. Verifica tu conexión a internet
2. Verifica que la API key sea correcta
3. Intenta aumentar el timeout en el código (línea 20 de `dashboard/page.tsx`)

## 📋 Checklist

- [ ] Reinicié el servidor después de los cambios
- [ ] Abrí la consola del navegador
- [ ] Intenté iniciar sesión y observé los mensajes
- [ ] Verifiqué que la API key sea correcta
- [ ] Limpié el localStorage si es necesario
- [ ] El dashboard carga correctamente

## 🎯 Resumen

El problema de carga infinita generalmente se debe a:
1. ✅ Sesión no guardada correctamente → **Solucionado con verificación**
2. ✅ `getSession()` fallando silenciosamente → **Solucionado con timeout y errores**
3. ⚠️ API key incorrecta → **Verifica con `./verificar-env.sh`**
4. ⚠️ Problema de red → **Verifica tu conexión**
