# 🚀 Instrucciones para Iniciar el Servidor de Domus

## ⚠️ Problema Actual

El servidor está respondiendo con error 500 debido a un problema de permisos al leer archivos de Next.js. Esto puede ser un problema del sistema operativo o del entorno de ejecución.

## ✅ Solución: Ejecutar el Servidor Manualmente

### Opción 1: Usar el Script de Solución (Recomendado)

1. **Abre una nueva terminal** (nueva pestaña o ventana)
2. **Navega al directorio frontend:**
   ```bash
   cd ~/domus-plus/frontend
   ```

3. **Ejecuta el script de solución:**
   ```bash
   ./solucionar-permisos-nextjs.sh
   ```

4. **Espera a ver "Ready" en la terminal**

5. **Abre el navegador en:** `http://localhost:3000`

### Opción 2: Iniciar Manualmente (Paso a Paso)

1. **Abre una nueva terminal** (nueva pestaña o ventana)

2. **Detén cualquier proceso en el puerto 3000:**
   ```bash
   lsof -ti:3000 | xargs kill -9 2>/dev/null
   ```

3. **Navega al directorio frontend:**
   ```bash
   cd ~/domus-plus/frontend
   ```

4. **Limpia la caché:**
   ```bash
   rm -rf .next
   ```

5. **Inicia el servidor:**
   ```bash
   npm run dev
   ```

6. **Espera a ver este mensaje:**
   ```
   ▲ Next.js 14.0.3
   - Local:        http://localhost:3000
   ✓ Ready in X seconds
   ```

7. **Abre el navegador en:** `http://localhost:3000`

## 🔍 Si el Error 500 Persiste

### Verificar Permisos del Sistema

El error "Operation not permitted" puede ser causado por:

1. **Protección de integridad del sistema (SIP) en macOS**
   - Verifica si tienes restricciones de seguridad activas
   - Ve a: Sistema > Seguridad y Privacidad > Privacidad > Acceso completo al disco

2. **Antivirus o software de seguridad**
   - Algunos antivirus bloquean el acceso a node_modules
   - Agrega una excepción para el directorio `domus-plus`

3. **Permisos del directorio**
   - Verifica que tengas permisos de lectura/escritura:
     ```bash
     ls -la ~/domus-plus/frontend/node_modules/next/dist/client/components/router-reducer/
     ```

### Solución Alternativa: Usar Docker

Si el problema persiste, puedes usar Docker:

```bash
cd ~/domus-plus
docker-compose up frontend
```

## 📋 Verificar que el Servidor Está Funcionando

Una vez que el servidor esté corriendo:

1. **Verifica en la terminal:**
   - Debe mostrar "Ready"
   - No debe haber errores de compilación

2. **Verifica en el navegador:**
   - Abre `http://localhost:3000`
   - Deberías ver la página de inicio de Domus
   - Si ves un error, revisa la consola del navegador (F12)

## 🆘 Si Nada Funciona

Comparte:
1. El mensaje completo de error de la terminal
2. El mensaje de error de la consola del navegador (F12)
3. La versión de Node.js: `node --version`
4. La versión de npm: `npm --version`
