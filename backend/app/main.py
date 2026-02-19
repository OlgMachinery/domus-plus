from fastapi import FastAPI
import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.database import engine, Base
from app.routers import users, families, transactions

# Presupuestos (budgets) - puede fallar por ForwardRef en schemas
try:
    from app.routers import budgets
    BUDGETS_AVAILABLE = True
except ImportError as e:
    budgets = None
    BUDGETS_AVAILABLE = False
    print(f"⚠️  Router 'budgets' no disponible: {e}")

# Importar routers opcionales (requieren dependencias adicionales)
try:
    from app.routers import whatsapp, receipts
    WHATSAPP_AVAILABLE = True
except ImportError:
    WHATSAPP_AVAILABLE = False
    print("⚠️  WhatsApp y Receipts routers no disponibles (instala: pip install twilio openai)")

# Crear tablas
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DOMUS+ API",
    description="Sistema de Presupuesto Anual Doméstico",
    version="1.0.0"
)

# Static files: uploads (imágenes de recibos, etc.)
try:
    backend_dir = Path(__file__).resolve().parent.parent  # .../backend
    uploads_dir = backend_dir / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")
except Exception as e:
    print(f"⚠️  No se pudo montar /uploads: {e}")

# CORS - Orígenes permitidos (frontend en distintos puertos)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3004",
    "http://127.0.0.1:3004",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "http://localhost:3003",
    "http://127.0.0.1:3003",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(users.router, prefix="/api/users", tags=["users"])
try:
    from app.routers import dashboard
    app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
except ImportError:
    pass
app.include_router(families.router, prefix="/api/families", tags=["families"])
if BUDGETS_AVAILABLE and budgets is not None:
    app.include_router(budgets.router, prefix="/api/budgets", tags=["budgets"])
else:
    print("⚠️  Router 'budgets' no incluido (import falló). Revisa schemas.py para ForwardRefs.")
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])

# Router de presupuestos personales
try:
    from app.routers import personal_budgets
    app.include_router(personal_budgets.router, prefix="/api/personal-budgets", tags=["personal-budgets"])
except ImportError as e:
    print(f"⚠️  Personal budgets router no disponible: {e}")

# Router de logs de actividad
try:
    from app.routers import activity_logs
    app.include_router(activity_logs.router, prefix="/api/activity-logs", tags=["activity-logs"])
except ImportError as e:
    print(f"⚠️  Activity logs router no disponible: {e}")

# Router de Excel
try:
    from app.routers import excel
    app.include_router(excel.router, prefix="/api/excel", tags=["excel"])
except ImportError as e:
    print(f"⚠️  Excel router no disponible: {e}")

# Router de importación de Excel
try:
    from app.routers import excel_import
    app.include_router(excel_import.router, prefix="/api/excel-import", tags=["excel-import"])
except ImportError as e:
    print(f"⚠️  Excel import router no disponible: {e}")

# Router de desarrollo/testing
try:
    from app.routers import dev
    app.include_router(dev.router, prefix="/api/dev", tags=["dev"])
except ImportError:
    pass

# Router de configuración de familia
try:
    from app.routers import family_setup
    app.include_router(family_setup.router, prefix="/api/family-setup", tags=["family-setup"])
except ImportError as e:
    print(f"⚠️  Family setup router no disponible: {e}")

# Router de asistente de IA
try:
    from app.routers import ai_assistant
    app.include_router(ai_assistant.router, prefix="/api/ai-assistant", tags=["ai-assistant"])
except ImportError as e:
    print(f"⚠️  AI Assistant router no disponible: {e}")

# Router de categorías personalizadas
try:
    from app.routers import custom_categories
    app.include_router(custom_categories.router, prefix="/api/custom-categories", tags=["custom-categories"])
except ImportError as e:
    print(f"⚠️  Custom Categories router no disponible: {e}")

# Control para habilitar/deshabilitar temporalmente el router de WhatsApp desde entorno
DISABLE_WHATSAPP = os.getenv("DISABLE_WHATSAPP", "0").lower() in ("1", "true", "yes")

# Routers opcionales (requieren dependencias adicionales)
if WHATSAPP_AVAILABLE and not DISABLE_WHATSAPP:
    app.include_router(whatsapp.router, prefix="/api/whatsapp", tags=["whatsapp"])
    app.include_router(receipts.router, prefix="/api/receipts", tags=["receipts"])
else:
    if DISABLE_WHATSAPP:
        print("⚠️  WhatsApp router DESHABILITADO por DISABLE_WHATSAPP en entorno")
    else:
        print("⚠️  WhatsApp y Receipts routers no disponibles (instala: pip install twilio openai)")

@app.get("/")
async def root():
    return {"message": "DOMUS+ API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "ok"}

