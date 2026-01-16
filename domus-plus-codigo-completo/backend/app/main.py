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

# CORS - Configuración mejorada
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Routers
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(families.router, prefix="/api/families", tags=["families"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["budgets"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])

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

