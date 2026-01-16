# 🚀 Inicio Rápido - DOMUS+

## Estado Actual

✅ **Frontend**: Corriendo en http://localhost:3000  
❌ **Backend**: No está corriendo  
❓ **Base de Datos**: Necesita verificación

## Pasos para Iniciar el Backend

### Opción 1: Usar el Script Automático (Recomendado)

Abre una **nueva terminal** y ejecuta:

```bash
cd /Users/gonzalomontanofimbres/domus-plus
./start-backend.sh
```

### Opción 2: Manual

Abre una **nueva terminal** y ejecuta estos comandos uno por uno:

```bash
# 1. Ir al directorio del backend
cd /Users/gonzalomontanofimbres/domus-plus/backend

# 2. Activar el entorno virtual
source venv/bin/activate

# 3. Si es la primera vez, instalar dependencias:
# pip install -r requirements.txt

# 4. Iniciar el servidor
uvicorn app.main:app --reload
```

## Verificar que Todo Funciona

### 1. Backend
Abre en tu navegador:
- **Health Check**: http://localhost:8000/health
- **API Docs**: http://localhost:8000/docs

Deberías ver `{"status":"ok"}` en el health check.

### 2. Frontend
Ya está corriendo en: http://localhost:3000

### 3. Probar el Registro

1. Ve a http://localhost:3000/register
2. Llena el formulario
3. Si hay errores, revisa:
   - La terminal del backend (verás los errores ahí)
   - La consola del navegador (F12)

## Configuración de Base de Datos

### Si tienes PostgreSQL instalado localmente:

```bash
# Crear la base de datos
createdb domus_plus

# O con psql:
psql -U postgres
CREATE DATABASE domus_plus;
```

Luego edita `backend/.env` y configura:
```env
DATABASE_URL=postgresql://tu_usuario:tu_password@localhost:5432/domus_plus
```

### Si quieres usar Docker:

```bash
cd /Users/gonzalomontanofimbres/domus-plus
docker-compose up -d db
```

## Solución de Problemas Comunes

### Error: "No module named 'app'"
```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend
source venv/bin/activate
pip install -r requirements.txt
```

### Error: "Could not connect to database"
1. Verifica que PostgreSQL esté corriendo
2. Revisa la URL en `backend/.env`
3. Asegúrate de que la base de datos exista

### Error: "Port 8000 already in use"
```bash
# Encontrar qué proceso usa el puerto 8000
lsof -i :8000

# Matar el proceso (reemplaza PID con el número que aparezca)
kill -9 PID
```

## Comandos Útiles

### Ver logs del backend
Los logs aparecen en la terminal donde ejecutaste `uvicorn`

### Detener el backend
Presiona `Ctrl + C` en la terminal donde está corriendo

### Reiniciar el backend
1. Detén con `Ctrl + C`
2. Ejecuta de nuevo: `uvicorn app.main:app --reload`

## Próximos Pasos

Una vez que el backend esté corriendo:

1. ✅ Backend corriendo en http://localhost:8000
2. ✅ Frontend corriendo en http://localhost:3000
3. ✅ Base de datos configurada
4. 🎉 Intenta registrarte de nuevo en http://localhost:3000/register

