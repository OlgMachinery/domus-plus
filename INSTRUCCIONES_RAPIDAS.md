# ⚡ Instrucciones Rápidas - Configurar Supabase

## ✅ Paso 1: Obtener API Keys (2 minutos)

1. En el dashboard de Supabase, clic en **Settings** (⚙️) en el menú lateral
2. Clic en **API** en el submenú
3. Copia estos 3 valores:

   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role** key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## ✅ Paso 2: Ejecutar Esquema SQL (3 minutos)

1. En el menú lateral, clic en **SQL Editor** (icono de base de datos)
2. Clic en **New Query**
3. Abre el archivo `supabase/schema.sql` de este proyecto
4. **Copia TODO** el contenido (Cmd+A, Cmd+C)
5. Pégalo en el editor SQL de Supabase
6. Clic en **Run** (botón verde) o presiona **Cmd+Enter**
7. Deberías ver: "Success. No rows returned"

## ✅ Paso 3: Configurar .env.local (2 minutos)

### Opción A: Script Interactivo

```bash
cd /Users/gonzalomontanofimbres/domus-plus
./crear-env-local.sh
```

El script te pedirá cada valor y creará el archivo automáticamente.

### Opción B: Manual

```bash
cd frontend
nano .env.local
```

Pega esto (reemplaza con tus valores reales):

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

Guarda con: `Ctrl+X`, luego `Y`, luego `Enter`

## ✅ Paso 4: Verificar y Probar

```bash
cd frontend
./verificar-instalacion.sh
npm run dev
```

Abre: http://localhost:3000

## 🎯 Checklist

- [ ] API Keys copiadas de Settings → API
- [ ] Esquema SQL ejecutado en SQL Editor
- [ ] Archivo `.env.local` creado con las keys
- [ ] Servidor iniciado con `npm run dev`
- [ ] Puedo registrarme en `/register`
- [ ] Puedo iniciar sesión en `/login`

## 💡 Tips

- Las keys son largas, cópialas completas
- El `service_role` key es secreto, no lo compartas
- Si el SQL falla, verifica que copiaste TODO el contenido
- El archivo `.env.local` debe estar en `frontend/`
