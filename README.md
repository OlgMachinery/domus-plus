# DOMUS+

Repositorio del proyecto DOMUS+ (frontend).

Este README contiene instrucciones para que tu equipo pueda clonar, ejecutar y contribuir al proyecto localmente y desde GitHub.

## Contenido
- `frontend/` — Aplicación Next.js (App Router)
- `supabase/` — Scripts y SQL para configuración de la base de datos

## Requisitos locales
- Node.js 18+ (recomendado)
- npm o yarn
- Cuenta en Supabase con proyecto creado

## Configuración rápida (desarrolladores)
1. Clona el repositorio:

```bash
git clone git@github.com:<tu-org>/<tu-repo>.git
cd domus-plus/frontend
```

2. Instala dependencias:

```bash
npm install
```

3. Crea `.env.local` en `frontend/` con las variables necesarias:

```
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
OPENAI_API_KEY=<openai-key>   # si usas la parte de OCR/IA
```

4. Ejecuta la app en modo desarrollo:

```bash
npm run dev
```

5. Abre `http://localhost:3000`

## Base de datos (Supabase)
- Ejecuta los scripts SQL en `supabase/` para crear funciones, políticas RLS y sincronizar usuarios.
- Revisa `supabase/setup-completo-usuarios.sql` y `supabase/politicas-rls-receipts.sql`.

## Flujo de trabajo recomendado (GitHub)
- Trabajar en ramas feature: `feature/<descripcion>`
- Hacer pull requests hacia `main` o `develop`
- Revisar y aprobar PRs antes de merge
- Usar Issues para bugs/tareas

## CI / Código
- Se incluye un workflow de ejemplo en `.github/workflows/ci.yml` para ejecutar `npm install` y `npm run build`.

## Seguridad
- Nunca subir `service_role` key a GitHub.
- Usa *Secrets* en GitHub para `NEXT_PUBLIC_SUPABASE_ANON_KEY` (aunque es pública) y otros secretos como `OPENAI_API_KEY` y `SUPABASE_SERVICE_ROLE` (si se necesita solo en Actions).

## Contacto
Si necesitas ayuda, crea un Issue o escríbeme en el canal de tu equipo.

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

