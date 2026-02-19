"""
Cliente de Supabase para el backend
Usa service_role key para operaciones administrativas
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError(
        "Faltan variables de entorno de Supabase. "
        "Asegúrate de tener SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en tu .env"
    )

# Cliente con service_role key para operaciones administrativas
# ⚠️ NUNCA exponer esta key en el frontend
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
