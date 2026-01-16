# 🔧 Solución de Problemas - DOMUS+

## Error: "Error al registrar usuario"

Si ves este error al intentar registrarte, sigue estos pasos:

### 1. Verificar que el Backend esté corriendo

Abre una terminal y verifica:

```bash
# Verificar que el backend esté corriendo
curl http://localhost:8000/health

# Debería responder: {"status":"ok"}
```

Si no responde, inicia el backend:

```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend
source venv/bin/activate
uvicorn app.main:app --reload
```

### 2. Verificar la Base de Datos

El backend necesita conectarse a PostgreSQL. Verifica:

```bash
# Si usas Docker
docker-compose up -d db

# Verificar que PostgreSQL esté corriendo
docker ps | grep postgres
```

### 3. Verificar el archivo .env

Asegúrate de que el archivo `backend/.env` exista y tenga la configuración correcta:

```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend
cat .env
```

Debe contener al menos:
```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/domus_plus
SECRET_KEY=tu-clave-secreta
```

### 4. Verificar los Logs del Backend

Cuando intentas registrarte, revisa la terminal donde corre el backend. Deberías ver:
- La petición POST a `/api/users/register`
- Cualquier error de base de datos o validación

### 5. Formato del Teléfono

El sistema ahora normaliza automáticamente el teléfono:
- Si ingresas `6865690472`, se convertirá a `+526865690472`
- Si ingresas `+526865690472`, se mantendrá igual

### 6. Errores Comunes

#### "Email ya registrado"
- El email que intentas usar ya existe en la base de datos
- Usa otro email o inicia sesión con ese email

#### "Teléfono ya registrado"
- El número de teléfono ya está en uso
- Usa otro número de teléfono

#### "No se pudo conectar con el servidor"
- El backend no está corriendo
- Verifica que esté en `http://localhost:8000`
- Revisa la consola del navegador (F12) para más detalles

#### Error de base de datos
- PostgreSQL no está corriendo
- La URL de conexión en `.env` es incorrecta
- La base de datos no existe

### 7. Verificar en el Navegador

Abre las herramientas de desarrollador (F12 o Cmd+Option+I) y revisa:
- **Console**: Para ver errores de JavaScript
- **Network**: Para ver las peticiones HTTP y sus respuestas

### 8. Crear la Base de Datos

Si la base de datos no existe, créala:

```bash
# Conectarse a PostgreSQL
psql -U postgres

# Crear la base de datos
CREATE DATABASE domus_plus;

# Crear el usuario (si es necesario)
CREATE USER domus_user WITH PASSWORD 'domus_password';
GRANT ALL PRIVILEGES ON DATABASE domus_plus TO domus_user;
```

### 9. Reiniciar Todo

Si nada funciona, reinicia todo:

```bash
# 1. Detener el backend (Ctrl+C en la terminal)
# 2. Detener el frontend (Ctrl+C en la terminal)
# 3. Reiniciar la base de datos
docker-compose restart db

# 4. Reiniciar el backend
cd /Users/gonzalomontanofimbres/domus-plus/backend
source venv/bin/activate
uvicorn app.main:app --reload

# 5. En otra terminal, reiniciar el frontend
cd /Users/gonzalomontanofimbres/domus-plus/frontend
npm run dev
```

## Verificar que Todo Esté Funcionando

### Backend
```bash
# Debe responder con {"status":"ok"}
curl http://localhost:8000/health

# Debe mostrar la documentación de la API
# Abre en el navegador: http://localhost:8000/docs
```

### Frontend
```bash
# Debe estar accesible en:
# http://localhost:3000
```

### Base de Datos
```bash
# Verificar conexión
psql -U domus_user -d domus_plus -h localhost -c "SELECT 1;"
```

## Obtener Ayuda Adicional

Si el problema persiste:

1. Revisa los logs del backend en la terminal
2. Revisa la consola del navegador (F12)
3. Verifica que todas las dependencias estén instaladas
4. Asegúrate de que los puertos 3000 y 8000 no estén en uso por otros programas

