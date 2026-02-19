# 🔧 Solución: Error 500 en Chunks de JavaScript

## 🔍 Problema

Estás viendo errores 500 en la consola del navegador para recursos JavaScript (chunks) de Next.js:
```
Failed to load resource: the server responded with a status of 500 ()
lpmslitbvlihzucorenj...87a7-76002d64099e:1
```

Esto indica que Next.js está fallando al compilar o servir los chunks de JavaScript.

## ✅ Solución Rápida

### Opción 1: Script Automático (Recomendado)

```bash
cd ~/domus-plus/frontend
./fix-500-chunks.sh
```

Este script:
1. ✅ Detiene todos los procesos de Next.js
2. ✅ Limpia completamente la caché y builds
3. ✅ Verifica dependencias
4. ✅ Compila el proyecto
5. ✅ Inicia el servidor

### Opción 2: Solución Manual

#### Paso 1: Detener el Servidor

En la terminal donde corre `npm run dev`:
- Presiona `Ctrl+C` para detenerlo

#### Paso 2: Limpiar Todo

```bash
cd ~/domus-plus/frontend
rm -rf .next
rm -rf node_modules/.cache
rm -rf .swc
rm -rf .turbo
```

#### Paso 3: Verificar Dependencias

```bash
npm install
```

#### Paso 4: Compilar

```bash
npm run build
```

**Si hay errores de compilación**, revísalos y corrígelos antes de continuar.

#### Paso 5: Reiniciar el Servidor

```bash
npm run dev
```

#### Paso 6: Probar en el Navegador

1. Espera a ver "Ready" en la terminal
2. Abre `http://localhost:3000`
3. Recarga la página con `Ctrl+Shift+R` (Windows/Linux) o `Cmd+Shift+R` (Mac)
4. Revisa la consola (F12) - los errores 500 deberían desaparecer

## 🔍 Diagnóstico

### Si el Build Falla

Revisa los errores en la terminal. Errores comunes:

#### Error: "Module not found"
```bash
npm install
```

#### Error: "Cannot find module 'xlsx'"
```bash
npm install xlsx
```

#### Error: "SyntaxError" o errores de TypeScript
- Revisa el archivo mencionado en el error
- Corrige el error de sintaxis
- Vuelve a compilar

### Si el Build es Exitoso pero Siguen los Errores 500

1. **Revisa los logs del servidor:**
   - En la terminal donde corre `npm run dev`
   - Busca mensajes de error en rojo

2. **Revisa la consola del navegador:**
   - Abre F12 → Console
   - Busca errores específicos (no solo los 500)
   - Los errores reales suelen estar antes de los 500

3. **Verifica variables de entorno:**
   ```bash
   cat .env.local
   ```
   Debe tener:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

## 🚨 Errores Comunes

### Error: "Cannot read property 'X' of undefined"
**Causa:** Código intentando acceder a propiedades de objetos undefined
**Solución:** Revisa la consola para ver qué variable está undefined

### Error: "Hydration error"
**Causa:** Diferencia entre HTML del servidor y del cliente
**Solución:** Limpia caché del navegador y recarga

### Error: "Failed to fetch"
**Causa:** El servidor no está corriendo o hay un problema de red
**Solución:** Verifica que `npm run dev` esté corriendo

## 📋 Checklist de Verificación

Después de aplicar la solución, verifica:

- [ ] El servidor muestra "Ready" en la terminal
- [ ] No hay errores de compilación en la terminal
- [ ] La página carga en el navegador
- [ ] No hay errores 500 en la consola del navegador
- [ ] Los chunks de JavaScript se cargan correctamente (ver Network tab)

## 🆘 Si Nada Funciona

Comparte:
1. Los logs completos de la terminal donde corre `npm run dev`
2. Los errores específicos de la consola del navegador (F12 → Console)
3. El resultado de `npm run build` (si falla)

## 💡 Prevención

Para evitar este problema en el futuro:
- Siempre detén el servidor correctamente (Ctrl+C)
- No edites archivos mientras el servidor está compilando
- Si ves errores de compilación, corrígelos antes de continuar
- Limpia `.next` periódicamente si experimentas problemas
