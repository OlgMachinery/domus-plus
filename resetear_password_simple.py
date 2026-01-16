#!/usr/bin/env python3
"""
Script simple para resetear la contraseña de un usuario.
"""
import sqlite3
import hashlib
import base64
import os

db_path = "backend/domus_plus.db"

if not os.path.exists(db_path):
    print("❌ Base de datos no encontrada")
    exit(1)

email = "gonzalomail@me.com"
new_password = "domus123"

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
    exit(1)

user_id, name, user_email, phone = user
print(f"✅ Usuario encontrado:")
print(f"   ID: {user_id}")
print(f"   Nombre: {name}")
print(f"   Email: {user_email}")
print(f"   Teléfono: {phone}\n")

# Generar hash usando pbkdf2_sha256 (mismo método que usa el sistema)
# Formato: pbkdf2_sha256$rounds$salt$hash
import secrets
salt = secrets.token_hex(16)
rounds = 260000  # Valor por defecto de passlib para pbkdf2_sha256

# Calcular hash usando pbkdf2
import hashlib
from hashlib import pbkdf2_hmac

password_bytes = new_password.encode('utf-8')
salt_bytes = bytes.fromhex(salt)
dk = pbkdf2_hmac('sha256', password_bytes, salt_bytes, rounds)
hash_hex = base64.b64encode(dk).decode('ascii')

# Formato: pbkdf2_sha256$rounds$salt$hash
hashed_password = f"$pbkdf2-sha256${rounds}${salt}${hash_hex}"

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
