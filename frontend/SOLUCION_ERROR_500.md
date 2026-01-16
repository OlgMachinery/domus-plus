# 🔧 Solución: Error 500 en Archivos JavaScript

## 🔍 Problema

Los archivos JavaScript (`webpack.js`, `app.js`, `main.js`, etc.) están devolviendo error 500 (Internal Server Error), lo que impide que la aplicación cargue correctamente.

## ✅ Soluciones Aplicadas

### 1. **Mejorado el Middleware**
- Agregada verificación de variables de entorno
- Agregado manejo de errores con try-catch
- Agregado timeout para evitar bloqueos
- Si hay error, continúa sin bloquear la request

### 2. **Corregido el Layout**
- Agregado tipo `Metadata` de Next.js
- Mejorada la tipificación

## 🚀 Pasos para Resolver

### Paso 1: Limpiar Caché y Reiniciar

```bash
cd /Users/gonzalomontanofimbres/domus-plus/frontend
rm -rf .next
npm run dev
```

### Paso 2: Verificar Variables de Entorno

Asegúrate de que `.env.local` existe y tiene las variables correctas:

```bash
cat .env.local
```

Deberías ver:
```
NEXT_PUBLIC_SUPABASE_URL=https://lpmslitbvlihzucorenj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### Paso 3: Verificar Logs del Servidor

En la terminal donde corre `npm run dev`, busca errores como:
- `❌ Error:`
- `⚠️ Warning:`
- `Module not found:`

### Paso 4: Verificar Consola del Navegador

Abre la consola (F12) y busca:
- Errores de compilación
- Errores de módulos faltantes
- Errores de variables de entorno

## 🔍 Diagnóstico Adicional

### Si el Error Persiste:

1. **Verifica que el servidor esté corriendo:**
   ```bash
   # En otra terminal
   lsof -i :3000
   ```

2. **Revisa los logs completos del servidor:**
   - Busca errores de compilación
   - Busca errores de módulos faltantes
   - Busca errores de sintaxis

3. **Verifica las dependencias:**
   ```bash
   cd /Users/gonzalomontanofimbres/domus-plus/frontend
   npm install
   ```

4. **Intenta un build limpio:**
   ```bash
   rm -rf .next node_modules/.cache
   npm run build
   npm run dev
   ```

## 📋 Errores Comunes y Soluciones

### Error: "Module not found"
**Solución:** Ejecuta `npm install`

### Error: "Cannot find module"
**Solución:** Limpia `.next` y reinstala:
```bash
rm -rf .next
npm install
npm run dev
```

### Error: "NEXT_PUBLIC_SUPABASE_URL is not defined"
**Solución:** Crea/verifica `.env.local` con las variables correctas

### Error: "SyntaxError" o errores de compilación
**Solución:** Revisa los logs del servidor para ver el archivo específico con error

## ✅ Después de Aplicar las Soluciones

1. **Recarga la página** (F5 o Cmd+R)
2. **Abre la consola** (F12) y verifica que no haya más errores 500
3. **Los archivos JavaScript deberían cargar correctamente**

## 🆘 Si Nada Funciona

Comparte:
1. Los logs completos de la terminal donde corre `npm run dev`
2. Los errores específicos de la consola del navegador
3. El contenido de `.env.local` (sin mostrar las keys completas)
