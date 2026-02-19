# 🔧 Solución: Error 404 - Página No Encontrada

## 🔍 Problema

Al acceder a `http://localhost:3000`, aparece:
- **Error 404: This page could not be found.**
- En la consola: `GET http://localhost:3000/ 404 (Not Found)`

**Causa:** El servidor de Next.js no está corriendo o no está sirviendo la página correctamente.

## ✅ Solución Rápida

### Opción 1: Usar el Script Automático (Recomendado)

```bash
cd ~/domus-plus/frontend
./iniciar-correctamente.sh
```

### Opción 2: Pasos Manuales

#### Paso 1: Ir al Directorio Correcto

```bash
cd ~/domus-plus/frontend
```

**Verifica que estás en el lugar correcto:**
```bash
pwd
# Debe mostrar: /Users/gonzalomontanofimbres/domus-plus/frontend

ls package.json
# Debe mostrar: package.json
```

#### Paso 2: Verificar que el Servidor NO Está Corriendo

Si hay otro proceso usando el puerto 3000, deténlo primero:

```bash
# Verificar si hay algo corriendo en el puerto 3000
lsof -i :3000

# Si hay un proceso, deténlo:
kill -9 <PID>
```

O simplemente presiona `Ctrl+C` en cualquier terminal donde esté corriendo `npm run dev`.

#### Paso 3: Limpiar y Reconstruir

```bash
# Limpiar build anterior
rm -rf .next

# Reconstruir (opcional, pero recomendado)
npm run build
```

#### Paso 4: Iniciar el Servidor

```bash
npm run dev
```

**Debe mostrar:**
```
  ▲ Next.js 14.0.3
  - Local:        http://localhost:3000
  ✓ Ready in X seconds
```

#### Paso 5: Abrir en el Navegador

1. Abre `http://localhost:3000` en tu navegador
2. Debe mostrar la página de inicio de DOMUS+
3. Si ves 404, espera unos segundos y recarga (`Ctrl+R` o `Cmd+R`)

## 🔍 Diagnóstico

### Verificar que el Servidor Está Corriendo

En la terminal donde ejecutaste `npm run dev`, debe aparecer:

```
✓ Ready in X seconds
```

Si NO aparece esto, hay un error. Revisa los mensajes de error en la terminal.

### Verificar que el Puerto 3000 Está Libre

```bash
lsof -i :3000
```

Si muestra un proceso, ese proceso está usando el puerto. Deténlo primero.

### Verificar Errores de Compilación

Si el servidor no inicia, revisa los errores en la terminal. Errores comunes:

1. **"Module not found"**
   ```bash
   npm install
   ```

2. **"Cannot find module"**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Error de variables de entorno**
   - Crea `.env.local` con las variables de Supabase

## 🚨 Si Nada Funciona

### Solución Completa (Reinstalar Todo)

```bash
cd ~/domus-plus/frontend

# 1. Detener cualquier proceso
pkill -f "next dev" || true

# 2. Limpiar TODO
rm -rf .next
rm -rf node_modules
rm -rf package-lock.json
rm -rf node_modules/.cache

# 3. Reinstalar
npm install

# 4. Verificar variables de entorno
cat .env.local
# Si no existe, créalo con las variables de Supabase

# 5. Reconstruir
npm run build

# 6. Iniciar
npm run dev
```

## 📋 Checklist de Verificación

Antes de reportar un problema, verifica:

- [ ] Estás en el directorio correcto: `~/domus-plus/frontend`
- [ ] El archivo `package.json` existe
- [ ] Ejecutaste `npm install` (si no tienes `node_modules`)
- [ ] El servidor muestra `✓ Ready` en la terminal
- [ ] No hay otro proceso usando el puerto 3000
- [ ] El archivo `.env.local` existe con las variables de Supabase
- [ ] No hay errores en la terminal donde corre `npm run dev`

## 💡 Prevención

Para evitar este problema:

1. **Siempre inicia el servidor desde el directorio `frontend/`**
2. **Verifica que el servidor muestre "Ready" antes de abrir el navegador**
3. **No cierres la terminal donde corre `npm run dev`**
4. **Si cambias algo, reinicia el servidor (Ctrl+C y luego `npm run dev`)**

## 🔗 Archivos Relacionados

- `frontend/iniciar-correctamente.sh` - Script para iniciar el servidor correctamente
- `frontend/package.json` - Configuración del proyecto
- `frontend/app/page.tsx` - Página principal
