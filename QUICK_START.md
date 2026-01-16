# 🚀 Inicio Rápido - DOMUS+

## Ver la Aplicación en Vivo (Live View)

Para ver la aplicación funcionando, necesitas iniciar **dos servidores**:

### 1️⃣ Iniciar el Backend (API)

Abre una terminal y ejecuta:

```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend

# Crear entorno virtual (solo la primera vez)
python -m venv venv
source venv/bin/activate

# Instalar dependencias (solo la primera vez)
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Edita el archivo .env con tus credenciales

# Iniciar el servidor
uvicorn app.main:app --reload
```

✅ El backend estará disponible en: **http://localhost:8000**
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

### 2️⃣ Iniciar el Frontend (Interfaz Web)

Abre **otra terminal nueva** y ejecuta:

```bash
cd /Users/gonzalomontanofimbres/domus-plus/frontend

# Instalar dependencias (solo la primera vez)
npm install

# Iniciar el servidor de desarrollo
npm run dev
```

✅ El frontend estará disponible en: **http://localhost:3000**

## 📱 Acceder a la Aplicación

1. Abre tu navegador
2. Ve a: **http://localhost:3000**
3. Verás la página de inicio de DOMUS+
4. Puedes registrarte o iniciar sesión

## ⚠️ Requisitos Previos

Antes de iniciar, asegúrate de tener:

1. **Base de datos PostgreSQL corriendo**
   ```bash
   # Opción 1: Con Docker
   cd /Users/gonzalomontanofimbres/domus-plus
   docker-compose up -d db
   
   # Opción 2: PostgreSQL local instalado
   # Asegúrate de que PostgreSQL esté corriendo
   ```

2. **Archivo `.env` configurado en `backend/`**
   - Copia `.env.example` a `.env`
   - Completa las credenciales necesarias

3. **Node.js instalado** (para el frontend)
   - Verifica con: `node --version`
   - Debe ser versión 18 o superior

## 🔧 Comandos Útiles

### Backend
```bash
# Ver logs del servidor
uvicorn app.main:app --reload

# Ver documentación de la API
# Abre: http://localhost:8000/docs
```

### Frontend
```bash
# Modo desarrollo (con hot reload)
npm run dev

# Compilar para producción
npm run build

# Iniciar versión de producción
npm start
```

## 🐛 Solución de Problemas

### El backend no inicia
- Verifica que PostgreSQL esté corriendo
- Revisa el archivo `.env` en `backend/`
- Asegúrate de que el puerto 8000 no esté en uso

### El frontend no inicia
- Verifica que Node.js esté instalado: `node --version`
- Instala dependencias: `npm install`
- Asegúrate de que el puerto 3000 no esté en uso

### Error de conexión a la base de datos
- Verifica que PostgreSQL esté corriendo
- Revisa la URL en `.env`: `DATABASE_URL=postgresql://...`
- Asegúrate de que la base de datos exista

## 📝 Notas Importantes

- **Mantén ambas terminales abiertas** mientras uses la aplicación
- El backend debe estar corriendo antes de usar el frontend
- Los cambios en el código se reflejan automáticamente (hot reload)
- Para detener los servidores, presiona `Ctrl + C` en cada terminal

