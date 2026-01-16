# 🔧 Solución: Error 404 en /login

## ❌ Problema

Al intentar acceder a `http://localhost:3000/login`, aparece un error 404 "This page could not be found".

## 🔍 Causas Posibles

1. **Caché corrupto de Next.js**: El servidor tiene archivos compilados antiguos
2. **Servidor no reiniciado**: Los cambios no se han aplicado
3. **Problema de compilación**: Next.js no compiló correctamente las rutas

## ✅ Solución

### Paso 1: Detener el Servidor

En la terminal donde corre `npm run dev`, presiona:
```
Ctrl + C
```

### Paso 2: Limpiar Caché y Reiniciar

**Opción A: Usar el script automático (Recomendado)**

```bash
cd /Users/gonzalomontanofimbres/domus-plus/frontend
./reiniciar-completo.sh
```

**Opción B: Manual**

```bash
cd /Users/gonzalomontanofimbres/domus-plus/frontend

# Detener servidor (si está corriendo)
lsof -ti :3000 | xargs kill -9 2>/dev/null

# Limpiar caché
rm -rf .next

# Reiniciar
npm run dev
```

### Paso 3: Esperar a que Compile

Espera a que veas en la terminal:
```
✓ Ready in X.Xs
```

**No uses la aplicación hasta que veas "Ready"**

### Paso 4: Probar

1. Abre `http://localhost:3000` en el navegador
2. Deberías ver la página de inicio
3. Haz clic en "Iniciar Sesión" o ve directamente a `http://localhost:3000/login`
4. **No deberías ver más el error 404**

## 🔍 Verificar que las Rutas Existen

Si el problema persiste, verifica:

```bash
cd /Users/gonzalomontanofimbres/domus-plus/frontend
ls -la app/login/page.tsx
```

Deberías ver el archivo. Si no existe, hay un problema con la estructura del proyecto.

## 💡 Si Aún No Funciona

1. **Verifica que el servidor esté corriendo:**
   ```bash
   lsof -ti :3000
   ```
   Debería mostrar un número (el PID del proceso)

2. **Revisa los errores en la terminal** donde corre `npm run dev`
   - Busca errores de compilación
   - Busca mensajes en rojo

3. **Verifica la consola del navegador** (F12)
   - Busca errores de JavaScript
   - Verifica que no haya errores de red

4. **Intenta acceder directamente a:**
   - `http://localhost:3000` (página principal)
   - `http://localhost:3000/register` (registro)

## 📋 Checklist

- [ ] Servidor detenido completamente
- [ ] Caché limpiado (`rm -rf .next`)
- [ ] Servidor reiniciado (`npm run dev`)
- [ ] Esperé a ver "Ready" en la terminal
- [ ] Puedo acceder a `http://localhost:3000`
- [ ] Puedo acceder a `http://localhost:3000/login`
- [ ] No veo más el error 404

## 🎯 Resumen

El error 404 generalmente se soluciona:
1. ✅ Deteniendo el servidor
2. ✅ Limpiando el caché (`.next`)
3. ✅ Reiniciando el servidor
4. ✅ Esperando a que compile completamente
