# 🔧 Solución: Errores 404 en Archivos Estáticos de Next.js

## 🔍 Problema

Los archivos estáticos de Next.js están dando error 404:
- `layout.css:1` - 404 (Not Found)
- `main-app.js:1` - 404 (Not Found)
- `app-pages-internals.js:1` - 404 (Not Found)
- `page.js:1` - 404 (Not Found)
- `error.js:1` - 404 (Not Found)
- `global-error.js:1` - 404 (Not Found)

**Causa:** Next.js no está compilando correctamente o la carpeta `.next` está corrupta.

## ✅ Solución Rápida

### Opción 1: Usar el Script Automático

```bash
cd frontend
chmod +x fix-404-errors.sh
./fix-404-errors.sh
```

### Opción 2: Pasos Manuales

#### Paso 1: Detener el Servidor

Si el servidor está corriendo, deténlo con `Ctrl+C` en la terminal.

#### Paso 2: Limpiar Caché y Build

```bash
cd frontend
rm -rf .next
rm -rf node_modules/.cache
rm -rf .swc
```

#### Paso 3: Reconstruir

```bash
npm run build
```

Si el build es exitoso, verás:
```
✓ Compiled successfully
```

#### Paso 4: Iniciar Servidor de Desarrollo

```bash
npm run dev
```

#### Paso 5: Verificar en el Navegador

1. Abre `http://localhost:3000`
2. Presiona `Ctrl+Shift+R` (o `Cmd+Shift+R` en Mac) para limpiar caché
3. Abre la consola (F12) y verifica que no haya errores 404

## 🔍 Diagnóstico Adicional

### Si el Build Falla

Si `npm run build` falla, revisa los errores:

1. **Error: "Module not found"**
   ```bash
   npm install
   ```

2. **Error: "Cannot find module"**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Error de TypeScript**
   - Revisa los archivos mencionados en el error
   - Corrige los errores de tipos

### Si el Build es Exitoso pero Sigue el 404

1. **Verifica que el servidor esté corriendo:**
   ```bash
   # En otra terminal
   curl http://localhost:3000
   ```

2. **Limpia el caché del navegador:**
   - Presiona `Ctrl+Shift+Delete` (Windows/Linux) o `Cmd+Shift+Delete` (Mac)
   - Selecciona "Caché" o "Cache"
   - Haz clic en "Limpiar"
   - Recarga con `Ctrl+Shift+R` o `Cmd+Shift+R`

3. **Verifica que no haya otro proceso usando el puerto 3000:**
   ```bash
   lsof -i :3000
   # Si hay otro proceso, mátalo:
   kill -9 <PID>
   ```

## 🚨 Solución Completa (Si Nada Funciona)

```bash
cd frontend

# 1. Detener servidor
pkill -f "next dev" || true

# 2. Limpiar TODO
rm -rf .next
rm -rf node_modules
rm -rf package-lock.json
rm -rf node_modules/.cache
rm -rf .swc

# 3. Reinstalar
npm install

# 4. Reconstruir
npm run build

# 5. Iniciar
npm run dev
```

## 📋 Verificación Final

Después de aplicar la solución:

1. ✅ El servidor debe mostrar: `✓ Ready in X seconds`
2. ✅ En el navegador, la consola (F12) NO debe tener errores 404
3. ✅ La página debe cargar completamente
4. ✅ Los estilos CSS deben aplicarse correctamente

## 💡 Prevención

Para evitar este problema en el futuro:

1. **No edites archivos en `.next/` manualmente** - Esta carpeta es generada automáticamente
2. **Si cambias configuración de Next.js**, limpia `.next` y reconstruye
3. **Si cambias dependencias**, ejecuta `npm install` y reconstruye

## 🔗 Archivos Relacionados

- `frontend/fix-404-errors.sh` - Script automático para solucionar
- `frontend/next.config.js` - Configuración de Next.js
- `frontend/app/layout.tsx` - Layout principal
