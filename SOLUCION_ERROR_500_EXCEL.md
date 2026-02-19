# Solución: Error 500 al leer archivos Excel

## Problema
Estás viendo un error 500 cuando intentas leer un archivo Excel. Esto generalmente se debe a que la dependencia `xlsx` no está instalada o el servidor necesita reiniciarse.

## Solución Rápida

### Opción 1: Instalar xlsx (si no está instalado)

1. **Abre una nueva terminal** (mantén la terminal del servidor corriendo)

2. **Navega al directorio frontend:**
   ```bash
   cd ~/domus-plus/frontend
   ```

3. **Instala la dependencia:**
   ```bash
   npm install xlsx
   ```

4. **Reinicia el servidor de Next.js:**
   - Ve a la terminal donde está corriendo `npm run dev`
   - Presiona `Ctrl+C` para detenerlo
   - Ejecuta nuevamente: `npm run dev`

### Opción 2: Usar el script automático

```bash
cd ~/domus-plus/frontend
./instalar-xlsx.sh
```

Luego reinicia el servidor como se indica arriba.

## Verificar que xlsx está instalado

Puedes verificar si `xlsx` está en tu `package.json`:

```bash
cd ~/domus-plus/frontend
grep xlsx package.json
```

Deberías ver:
```json
"xlsx": "^0.18.5"
```

## Si el error persiste

1. **Verifica los logs del servidor:**
   - Revisa la terminal donde corre `npm run dev`
   - Busca mensajes de error específicos

2. **Limpia y reinstala:**
   ```bash
   cd ~/domus-plus/frontend
   rm -rf node_modules package-lock.json
   npm install
   npm run dev
   ```

3. **Verifica que el archivo Excel es válido:**
   - Asegúrate de que el archivo tiene extensión `.xlsx`, `.xlsm`, o `.xls`
   - Intenta con un archivo Excel más pequeño primero

## Mensajes de error mejorados

Ahora el sistema mostrará mensajes más claros si `xlsx` no está instalado:
- "Procesamiento de Excel requiere la dependencia xlsx. Por favor, ejecuta: cd frontend && npm install xlsx && reinicia el servidor"

## Nota importante

Después de instalar `xlsx`, **siempre debes reiniciar el servidor de Next.js** para que los cambios surtan efecto. Next.js carga los módulos al iniciar, por lo que las nuevas dependencias no se cargan automáticamente.
