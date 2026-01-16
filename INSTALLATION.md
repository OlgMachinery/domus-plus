# Guía de Instalación - DOMUS+

## Requisitos Previos

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Docker y Docker Compose (opcional)
- Cuenta de Twilio para WhatsApp
- API Key de OpenAI

## Instalación Paso a Paso

### 1. Clonar o Navegar al Proyecto

```bash
cd domus-plus
```

### 2. Configurar Base de Datos

#### Opción A: Usando Docker (Recomendado)

```bash
docker-compose up -d db
```

Esto iniciará PostgreSQL en el puerto 5432.

#### Opción B: PostgreSQL Local

Asegúrate de tener PostgreSQL instalado y crea una base de datos:

```sql
CREATE DATABASE domus_plus;
```

### 3. Configurar Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Copiar y configurar variables de entorno:

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:

```env
DATABASE_URL=postgresql://domus_user:domus_password@localhost:5432/domus_plus
SECRET_KEY=tu-clave-secreta-muy-segura-aqui
OPENAI_API_KEY=tu-openai-api-key
TWILIO_ACCOUNT_SID=tu-twilio-account-sid
TWILIO_AUTH_TOKEN=tu-twilio-auth-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### 4. Iniciar Backend

```bash
uvicorn app.main:app --reload
```

El API estará disponible en `http://localhost:8000`

### 5. Configurar Frontend

En una nueva terminal:

```bash
cd frontend
npm install
```

Crear archivo `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 6. Iniciar Frontend

```bash
npm run dev
```

El frontend estará disponible en `http://localhost:3000`

## Configuración de WhatsApp (Twilio)

1. Crea una cuenta en [Twilio](https://www.twilio.com/)
2. Obtén tu Account SID y Auth Token
3. Configura un número de WhatsApp en Twilio
4. Configura el webhook en Twilio apuntando a:
   `https://tu-dominio.com/api/whatsapp/webhook`

## Primeros Pasos

1. Accede a `http://localhost:3000`
2. Regístrate como usuario (serás el administrador de la familia)
3. Crea una familia
4. Agrega miembros a tu familia
5. Crea presupuestos anuales por partida
6. Asigna presupuestos a cada integrante
7. Envía recibos por WhatsApp o súbelos desde el dashboard

## Documentación de la API

Una vez que el backend esté corriendo, accede a:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Solución de Problemas

### Error de conexión a la base de datos
- Verifica que PostgreSQL esté corriendo
- Revisa la URL de conexión en `.env`
- Asegúrate de que la base de datos exista

### Error al procesar recibos
- Verifica que tu API key de OpenAI sea válida
- Asegúrate de tener créditos en tu cuenta de OpenAI

### Error con WhatsApp
- Verifica tus credenciales de Twilio
- Asegúrate de que el webhook esté configurado correctamente
- Verifica que el número de WhatsApp esté activo en Twilio

