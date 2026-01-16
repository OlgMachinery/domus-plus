# 🔧 Solución: Error "Invalid API key" en Supabase

## ❌ Problema
El error "Invalid API key" aparece porque:
1. El código estaba usando una `service_role` key en el cliente (incorrecto)
2. La key podría haber expirado o ser inválida
3. Faltan las variables de entorno configuradas

## ✅ Solución: Configurar Variables de Entorno

### Paso 1: Obtener las API Keys de Supabase

1. Ve a tu dashboard de Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** (⚙️) → **API**
4. Copia estos 3 valores:

   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` 
     ⚠️ **IMPORTANTE**: Esta es la clave que necesitas para el cliente
   - **service_role** key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
     ⚠️ **SECRETO**: Solo para el backend, nunca en el cliente

### Paso 2: Crear el archivo .env.local

```bash
cd /Users/gonzalomontanofimbres/domus-plus/frontend
nano .env.local
```

Pega esto (reemplaza con tus valores reales):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_public_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

**⚠️ IMPORTANTE:**
- Usa la clave **"anon public"** para `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **NO** uses la clave "service_role" en el cliente
- La clave "service_role" solo va en el backend (si es necesario)

Guarda el archivo:
- Presiona `Ctrl + X`
- Luego `Y` para confirmar
- Luego `Enter` para guardar

### Paso 3: Reiniciar el servidor

```bash
# Detener el servidor actual (Ctrl+C en la terminal donde corre)
# Luego:
cd /Users/gonzalomontanofimbres/domus-plus/frontend
rm -rf .next
npm run dev
```

### Paso 4: Verificar

1. Abre `http://localhost:3000` en el navegador
2. Abre la consola del navegador (F12 o Cmd+Option+I)
3. No deberías ver más el error "Invalid API key"
4. Intenta iniciar sesión

## 🔍 Verificar que las Variables Están Configuradas

```bash
cd /Users/gonzalomontanofimbres/domus-plus/frontend
cat .env.local
```

Deberías ver tus keys (no las compartas públicamente).

## ❓ ¿Cómo sé cuál es la anon key?

En el dashboard de Supabase, en Settings → API, verás dos keys:

1. **anon public** - Esta dice "public" o "anon" en la descripción
   - Es segura para usar en el cliente (frontend)
   - Esta es la que necesitas para `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. **service_role** - Esta dice "service_role" o "secret"
   - Es SECRETA, solo para el backend
   - Tiene permisos completos, nunca la uses en el cliente

## 🎯 Checklist

- [ ] Obtuve las API keys de Settings → API en Supabase
- [ ] Creé el archivo `.env.local` en `frontend/`
- [ ] Usé la clave **"anon public"** (no la service_role)
- [ ] Reinicié el servidor con `npm run dev`
- [ ] El error "Invalid API key" desapareció
- [ ] Puedo iniciar sesión correctamente

## 💡 Si Aún No Funciona

1. Verifica que el archivo `.env.local` esté en `frontend/` (no en la raíz)
2. Verifica que las variables empiecen con `NEXT_PUBLIC_` (necesario para Next.js)
3. Reinicia el servidor completamente (detén y vuelve a iniciar)
4. Limpia el caché del navegador (Cmd+Shift+R)
