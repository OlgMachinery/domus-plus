from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import users, families, budgets, transactions

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

# CORS - Configuración
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
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
app.include_router(families.router, prefix="/api/families", tags=["families"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["budgets"])
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

# Routers opcionales (requieren dependencias adicionales)
if WHATSAPP_AVAILABLE:
    app.include_router(whatsapp.router, prefix="/api/whatsapp", tags=["whatsapp"])
    app.include_router(receipts.router, prefix="/api/receipts", tags=["receipts"])

@app.get("/")
async def root():
    return {"message": "DOMUS+ API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "ok"}

