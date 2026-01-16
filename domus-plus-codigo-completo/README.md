# DOMUS+ - Sistema de Presupuesto Anual Doméstico

Sistema completo para la gestión de presupuesto familiar con integración de WhatsApp para procesamiento automático de recibos y transferencias.

## Características

- 📊 Presupuesto anual por partidas (categorías)
- 👥 Gestión por integrantes de la familia
- 📱 Integración con WhatsApp para envío de recibos
- 🤖 Procesamiento automático de recibos con IA
- 💰 Seguimiento de gastos por usuario y partida
- 📈 Dashboard de visualización y análisis

## Estructura del Proyecto

```
domus-plus/
├── backend/          # API FastAPI
├── frontend/         # Dashboard React/Next.js
├── whatsapp/         # Servicio de integración WhatsApp
└── shared/           # Código compartido
```

## Tecnologías

- **Backend**: FastAPI, SQLAlchemy, PostgreSQL
- **Frontend**: Next.js, React, TailwindCSS
- **WhatsApp**: Twilio API / WhatsApp Business API
- **IA**: OpenAI GPT-4 Vision para procesamiento de recibos
- **Autenticación**: JWT

## Instalación

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Editar .env con tus credenciales
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Base de Datos

```bash
docker-compose up -d db
```

## Configuración

1. Crear archivo `.env` en `backend/` con tus credenciales
2. Configurar Twilio para WhatsApp
3. Configurar OpenAI API key
4. Ejecutar migraciones de base de datos

## Uso

1. Registra usuarios en el sistema
2. Crea una familia y agrega miembros
3. Define presupuestos anuales por partida
4. Asigna presupuestos a cada integrante
5. Envía recibos por WhatsApp o súbelos desde el dashboard
6. El sistema procesa automáticamente los recibos y actualiza los presupuestos

