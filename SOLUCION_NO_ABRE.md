# 🔧 Solución: La Aplicación No Abre Correctamente

## 🔍 Diagnóstico Rápido

### 1. Verificar que el Servidor Esté Corriendo

Abre una terminal y ejecuta:

```bash
cd frontend
npm run dev
```

**Debe mostrar:**
```
  ▲ Next.js 14.0.3
  - Local:        http://localhost:3000
  ✓ Ready in X seconds
```

**Si NO muestra esto:**
- Hay un error de compilación
- Revisa los mensajes de error en la terminal

### 2. Verificar Errores en el Navegador

1. Abre `http://localhost:3000` en el navegador
2. Presiona **F12** para abrir las herramientas de desarrollador
3. Ve a la pestaña **"Console"**
4. Busca errores en **rojo**

### 3. Errores Comunes y Soluciones

#### Error: "Failed to fetch" o "Connection refused"
**Causa:** El servidor de Next.js no está corriendo
**Solución:** Ejecuta `npm run dev` en la carpeta `frontend`

#### Error: "Module not found" o "Cannot find module"
**Causa:** Dependencias faltantes
**Solución:**
```bash
cd frontend
npm install
```

#### Error: "Hydration error" o "Mismatch"
**Causa:** Problema de renderizado entre servidor y cliente
**Solución:** Limpia el caché y recarga:
- Presiona `Ctrl+Shift+R` (Windows/Linux) o `Cmd+Shift+R` (Mac)

#### Error: "Supabase client not initialized"
**Causa:** Variables de entorno faltantes
**Solución:** Verifica que `frontend/.env.local` tenga:
```
NEXT_PUBLIC_SUPABASE_URL=tu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key
```

#### Error: "Cannot read property 'X' of undefined"
**Causa:** Variable o estado no inicializado
**Solución:** Revisa la consola para ver qué variable está undefined

## 🛠️ Pasos de Solución

### Paso 1: Detener y Reiniciar el Servidor

```bash
# Detener el servidor (Ctrl+C en la terminal donde corre)
# Luego reiniciar:
cd frontend
npm run dev
```

### Paso 2: Limpiar Caché del Navegador

1. Presiona `Ctrl+Shift+Delete` (Windows/Linux) o `Cmd+Shift+Delete` (Mac)
2. Selecciona "Caché" o "Cache"
3. Haz clic en "Limpiar"
4. Recarga la página con `Ctrl+Shift+R` o `Cmd+Shift+R`

### Paso 3: Verificar Variables de Entorno

Asegúrate de que `frontend/.env.local` existe y tiene:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

### Paso 4: Reinstalar Dependencias

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Paso 5: Verificar Errores de Compilación

Si el servidor no inicia, revisa los errores en la terminal. Errores comunes:

- **"Cannot find module 'X'"**: Falta instalar una dependencia
- **"Syntax error"**: Error de sintaxis en algún archivo
- **"Type error"**: Error de tipos en TypeScript

## 🔍 Verificación Paso a Paso

### 1. ¿El servidor está corriendo?
```bash
# En otra terminal, verifica:
curl http://localhost:3000
# Debe devolver HTML (no "Connection refused")
```

### 2. ¿Hay errores en la consola del navegador?
- Abre F12 → Console
- Busca errores en rojo
- Copia el mensaje de error completo

### 3. ¿Las rutas API funcionan?
- Abre F12 → Network
- Recarga la página
- Busca peticiones a `/api/*`
- Verifica que tengan status 200 o 404 (no 500)

### 4. ¿Supabase está configurado?
- Verifica que `.env.local` tenga las variables correctas
- Verifica que las credenciales sean válidas

## 🚨 Si Nada Funciona

### Opción 1: Reconstruir Todo

```bash
cd frontend
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

### Opción 2: Verificar Logs

1. Abre la terminal donde corre `npm run dev`
2. Copia cualquier error que aparezca
3. Busca en Google el mensaje de error

### Opción 3: Revertir Cambios

Si los cambios recientes causaron el problema:

```bash
cd frontend
git status
git diff lib/api.ts
# Si necesitas revertir:
git checkout lib/api.ts
```

## 📝 Información para Diagnosticar

Si el problema persiste, proporciona:

1. **Mensaje de error completo** de la consola del navegador (F12 → Console)
2. **Mensaje de error** de la terminal donde corre `npm run dev`
3. **URL** donde ocurre el problema (ej: `http://localhost:3000/dashboard`)
4. **Qué acción** estabas haciendo cuando falló

## ✅ Checklist de Verificación

- [ ] Servidor de Next.js corriendo (`npm run dev`)
- [ ] No hay errores en la terminal
- [ ] No hay errores en la consola del navegador (F12)
- [ ] Variables de entorno configuradas (`.env.local`)
- [ ] Caché del navegador limpiado
- [ ] Dependencias instaladas (`npm install`)
- [ ] Puerto 3000 no está ocupado por otro proceso
