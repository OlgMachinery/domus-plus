# 🌐 URLs Correctas - DOMUS+

## ⚠️ Importante: URLs Diferentes

El sistema tiene **dos servidores** corriendo en puertos diferentes:

### Backend (API)
- **URL**: http://localhost:8000
- **Health Check**: http://localhost:8000/health
- **Documentación API**: http://localhost:8000/docs
- **Qué es**: El servidor de la API (backend)

### Frontend (Interfaz Web)
- **URL**: http://localhost:3000
- **Página de Inicio**: http://localhost:3000
- **Login**: http://localhost:3000/login
- **Registro**: http://localhost:3000/register
- **Dashboard**: http://localhost:3000/dashboard
- **Qué es**: La interfaz web que ves en el navegador

## ✅ Para Usar la Aplicación

**Siempre usa**: http://localhost:3000

Esta es la URL del frontend donde puedes:
- Ver la página de inicio
- Registrarte
- Iniciar sesión
- Usar el dashboard

## 🔍 Verificar que Todo Funciona

### 1. Backend (API)
Abre: http://localhost:8000/health
- Deberías ver: `{"status":"ok"}`

### 2. Frontend (Interfaz)
Abre: http://localhost:3000
- Deberías ver la página de inicio de DOMUS+

### 3. Probar Registro
Abre: http://localhost:3000/register
- Llena el formulario
- Haz clic en "Registrarse"

## 📝 Nota

Si estás viendo la página de login en `localhost:8000`, estás en el backend. 
**Cambia a**: http://localhost:3000 para usar el frontend.

