# 🔑 Configurar API Keys de Supabase

## 📍 Dónde encontrar las Keys

1. En tu dashboard de Supabase, clic en **Settings** (⚙️) en el menú lateral
2. Clic en **API** en el submenú
3. Verás 3 secciones importantes:

### 1. Project URL
```
https://xxxxxxxxxxxxx.supabase.co
```
Copia esta URL completa.

### 2. Project API keys

#### anon public
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eHh4eHgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
Esta es la clave pública (segura para usar en el cliente).

#### service_role
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eHh4eHgiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjE2MjM5MDIyLCJleHAiOjE5MzE4MTUwMjJ9.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
⚠️ **IMPORTANTE**: Esta clave es SECRETA. No la compartas públicamente.

## 🔧 Configurar el archivo .env.local

Una vez que tengas las 3 keys, ejecuta:

```bash
cd /Users/gonzalomontanofimbres/domus-plus/frontend
nano .env.local
```

Y pega esto (reemplaza con tus valores reales):

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

Guarda con: `Ctrl+X`, luego `Y`, luego `Enter`

## ✅ Verificar

```bash
cd frontend
./verificar-instalacion.sh
```

Deberías ver que todas las variables están configuradas.
