# 🔧 Solución Completa: Procesamiento de Recibos

## ✅ Código Reescrito Profesionalmente

He reescrito completamente el código de procesamiento de recibos con:
- ✅ Logging estructurado y profesional
- ✅ Manejo robusto de errores
- ✅ Múltiples métodos de creación de usuario con fallbacks
- ✅ Reintentos automáticos con backoff exponencial
- ✅ Validaciones en cada paso
- ✅ Guardado completo en base de datos

## 📋 Pasos para Activar (EJECUTAR EN ORDEN)

### ⚡ OPCIÓN RÁPIDA: Setup Completo (RECOMENDADO)

**Un solo SQL que configura todo:**

1. Ve a: https://supabase.com/dashboard/project/lpmslitbvlihzucorenj/sql/new
2. Abre el archivo: `supabase/setup-completo-usuarios.sql`
3. Copia TODO el contenido
4. Pégalo en el SQL Editor
5. Ejecuta (Run o Cmd+Enter)
6. Deberías ver:
   - "Success"
   - Tabla con usuarios creados
   - Tabla con función verificada
   - Tabla con políticas RLS

**Este SQL hace:**
- ✅ Crea la función `ensure_user_exists`
- ✅ Configura políticas RLS para la tabla `users` (SELECT, INSERT, UPDATE)
- ✅ Crea automáticamente todos los usuarios existentes en `auth.users`
- ✅ Verifica que todo esté correcto

### Paso 2: Crear Políticas RLS para Recibos

1. En el mismo SQL Editor, crea una nueva query (New Query)
2. Abre el archivo: `supabase/politicas-rls-receipts.sql`
3. Copia TODO el contenido
4. Pégalo en el SQL Editor
5. Ejecuta (Run o Cmd+Enter)
6. Deberías ver: "Success" y una tabla con las políticas creadas

---

### 🔧 OPCIÓN MANUAL: Si prefieres ejecutar paso a paso

#### Paso 1: Crear Función SQL de Usuario

1. Ve a: https://supabase.com/dashboard/project/lpmslitbvlihzucorenj/sql/new
2. Abre el archivo: `supabase/crear-usuario-automatico.sql`
3. Copia TODO el contenido
4. Pégalo en el SQL Editor
5. Ejecuta (Run o Cmd+Enter)
6. Deberías ver: "Success" y un conteo de usuarios

### Paso 3: Reiniciar el Servidor

```bash
# Presiona Ctrl+C en la terminal donde corre npm run dev
cd /Users/gonzalomontanofimbres/domus-plus/frontend
rm -rf .next
npm run dev
```

### Paso 4: Probar

1. Abre `http://localhost:3000/transactions`
2. Haz clic en "Upload Receipt"
3. Selecciona una imagen de recibo (JPG, PNG, etc.)
4. Haz clic en "Upload" o "Processing..."
5. Debería funcionar correctamente

## 🔍 Qué Hace el Código Ahora

### Flujo Completo:

1. **Autenticación** (`[AUTH]`)
   - Intenta token en header Authorization
   - Si falla, usa cookies
   - Si falla, usa sesión
   - Logging detallado en cada paso

2. **Usuario** (`[USER]`)
   - Intenta obtener usuario de la tabla `users`
   - Si no existe, intenta crearlo con función SQL
   - Si falla, intenta insert directo
   - Reintenta obtener el usuario hasta 5 veces con backoff exponencial
   - Validación final de datos

3. **Procesamiento** (`[OPENAI]`)
   - Valida que OpenAI API Key esté configurada
   - Procesa cada imagen con GPT-4o Vision
   - Extrae: fecha, hora, moneda, comercio, monto, items
   - Maneja errores por archivo (continúa con el siguiente)

4. **Base de Datos** (`[DB]`)
   - Calcula monto total (declarado vs sumado de items)
   - Crea recibo en tabla `receipts`
   - Crea items en tabla `receipt_items`
   - Carga recibo completo con items
   - Retorna datos completos

## 📊 Logging en Terminal

Cuando funcione correctamente, verás en la terminal:

```
📥 [RECEIPT PROCESS] Iniciando procesamiento de recibo
🔑 [AUTH] Verificando token en header...
✅ [AUTH] Usuario autenticado vía token: [id]
👤 [USER] Verificando usuario en tabla users...
✅ [USER] Usuario encontrado: gonzalomail@me.com (ID: [id])
📋 [FORM] Parseando FormData...
📁 [FILES] 1 archivo(s) recibido(s)
🤖 [OPENAI] Iniciando procesamiento con IA...
🖼️ [IMAGE 1/1] Procesando: recibo.png
🤖 [OPENAI] Iniciando análisis de imagen: recibo.png
⏱️ [OPENAI] Respuesta recibida en 2345ms
✅ [OPENAI] JSON parseado: 15 items encontrados
✅ [IMAGE 1] Procesado exitosamente: 15 items
💾 [DB] Guardando recibo en Supabase...
   Items extraídos: 15
   Monto declarado: 1234.56
   Monto sumado de items: 1234.56
   Monto elegido: 1234.56
✅ [DB] Recibo creado con ID: 42
📦 [DB] Guardando 15 items...
✅ [DB] 15 items guardados exitosamente
✅ [SUCCESS] Procesamiento completado en 3456ms
   Recibo ID: 42
   Items: 15
   Monto: 1234.56 MXN
```

## 🐛 Si Aún Hay Problemas

### Error: "Usuario no encontrado"
- Ejecuta el SQL en `supabase/crear-usuario-automatico.sql`
- Verifica en Supabase Table Editor que el usuario existe

### Error: "RLS policy prevents..."
- Ejecuta el SQL en `supabase/politicas-rls-receipts.sql`
- Verifica que las políticas se crearon correctamente

### Error: "OPENAI_API_KEY no está configurada"
- Agrega `OPENAI_API_KEY=tu_key_aqui` en `frontend/.env.local`
- Reinicia el servidor

### Error: "No se pudieron extraer datos"
- Verifica que la imagen sea un recibo válido
- Asegúrate de que la imagen sea clara y legible
- Verifica que OpenAI API Key esté configurada correctamente

## 📁 Archivos Creados/Modificados

1. ✅ `frontend/app/api/receipts/process/route.ts` - Reescrito completamente
2. ✅ `frontend/app/api/users/sync/route.ts` - Mejorado
3. ✅ `supabase/crear-usuario-automatico.sql` - Función SQL automática
4. ✅ `supabase/politicas-rls-receipts.sql` - Políticas RLS para recibos

## 🎯 Resultado Final

Después de ejecutar los SQLs y reiniciar:
- ✅ Usuarios se crean automáticamente si no existen
- ✅ Recibos se procesan con OpenAI
- ✅ Datos se guardan correctamente en Supabase
- ✅ Items se guardan en `receipt_items`
- ✅ Todo funciona de forma robusta y profesional
