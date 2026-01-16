#!/usr/bin/env python3
"""
Script para resetear la contraseña de un usuario.
"""
import sqlite3
import sys
import os

# Agregar el directorio backend al path para importar auth
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app import auth

db_path = "backend/domus_plus.db"

if not os.path.exists(db_path):
    print("❌ Base de datos no encontrada")
    sys.exit(1)

# Obtener email del usuario
email = "gonzalomail@me.com"
new_password = "domus123"  # Contraseña temporal

print(f"\n🔐 RESETEANDO CONTRASEÑA PARA: {email}\n")
print("="*70)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Verificar que el usuario existe
cursor.execute("SELECT id, name, email, phone FROM users WHERE email = ?", (email,))
user = cursor.fetchone()

if not user:
    print(f"❌ Usuario no encontrado: {email}")
    conn.close()
    sys.exit(1)

user_id, name, user_email, phone = user
print(f"✅ Usuario encontrado:")
print(f"   ID: {user_id}")
print(f"   Nombre: {name}")
print(f"   Email: {user_email}")
print(f"   Teléfono: {phone}\n")

# Generar hash de la nueva contraseña
hashed_password = auth.get_password_hash(new_password)

# Actualizar la contraseña
cursor.execute(
    "UPDATE users SET hashed_password = ? WHERE id = ?",
    (hashed_password, user_id)
)

conn.commit()
conn.close()

print("="*70)
print(f"\n✅ CONTRASEÑA ACTUALIZADA EXITOSAMENTE\n")
print(f"📋 NUEVAS CREDENCIALES:")
print(f"   Email: {email}")
print(f"   Contraseña: {new_password}\n")
print("="*70)
print("\n💡 Ahora puedes iniciar sesión en DOMUS+ con estas credenciales.\n")
