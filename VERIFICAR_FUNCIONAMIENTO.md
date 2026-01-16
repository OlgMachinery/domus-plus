# ✅ Cómo Verificar que DOMUS+ Está Funcionando

## 1. Verificar que el Backend Está Corriendo

### Opción A: En el Navegador
Abre en tu navegador:
- **http://localhost:8000/health**
- Deberías ver: `{"status":"ok"}`

### Opción B: En la Terminal
Abre una nueva terminal y ejecuta:
```bash
curl http://localhost:8000/health
```
Deberías ver: `{"status":"ok"}`

### Opción C: Ver la Documentación de la API
Abre en tu navegador:
- **http://localhost:8000/docs**
- Deberías ver la documentación interactiva de Swagger UI

## 2. Verificar que el Frontend Está Corriendo

Abre en tu navegador:
- **http://localhost:3000**
- Deberías ver la página de inicio de DOMUS+

## 3. Probar el Registro de Usuario

1. Ve a **http://localhost:3000/register**
2. Llena el formulario:
   - Nombre completo
   - Email
   - Teléfono (WhatsApp)
   - Contraseña
   - Confirmar contraseña
3. Haz clic en "Registrarse"
4. **Si funciona correctamente:**
   - Te redirigirá a la página de login
   - O verás un mensaje de éxito
5. **Si hay un error:**
   - Revisa el mensaje de error en la página
   - Revisa la terminal del backend para ver los logs

## 4. Verificar en la Terminal del Backend

Cuando intentas registrarte, deberías ver en la terminal del backend algo como:
```
INFO:     127.0.0.1:xxxxx - "POST /api/users/register HTTP/1.1" 200 OK
```

Si ves un error, aparecerá ahí con detalles.

## 5. Verificar la Base de Datos

En la terminal del backend, ejecuta:
```bash
ls -lh domus_plus.db
```

Deberías ver algo como:
```
-rw-r--r--  1 usuario  staff  53K Jan 10 20:50 domus_plus.db
```

El tamaño debería ser mayor a 0 bytes (53K en este caso).

## 6. Verificar que el Usuario se Creó

Después de registrarte, puedes verificar en la base de datos:
```bash
python3 -c "import sqlite3; conn = sqlite3.connect('domus_plus.db'); cursor = conn.cursor(); cursor.execute('SELECT id, email, name FROM users'); print('Usuarios:', cursor.fetchall()); conn.close()"
```

Deberías ver tu usuario listado.

## ✅ Checklist de Funcionamiento

- [ ] Backend responde en http://localhost:8000/health
- [ ] Frontend carga en http://localhost:3000
- [ ] Puedes ver la página de registro
- [ ] Puedes registrarte sin errores
- [ ] El backend muestra logs cuando haces una petición
- [ ] La base de datos existe y tiene tamaño > 0

## 🐛 Si Algo No Funciona

### El backend no responde
- Verifica que esté corriendo: deberías ver logs en la terminal
- Verifica el puerto: `lsof -i :8000`

### El frontend no carga
- Verifica que esté corriendo: deberías ver logs en la terminal
- Verifica el puerto: `lsof -i :3000`

### Error al registrarse
- Revisa la consola del navegador (F12)
- Revisa los logs del backend
- Verifica que la base de datos exista

