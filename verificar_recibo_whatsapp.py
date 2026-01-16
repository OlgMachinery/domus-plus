#!/usr/bin/env python3
"""
Script para verificar si el recibo de WhatsApp fue procesado correctamente.
"""
import sqlite3
import os
from datetime import datetime, timedelta

db_path = "backend/domus_plus.db"

if not os.path.exists(db_path):
    print("❌ Base de datos no encontrada en:", db_path)
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("\n" + "="*60)
print("🔍 VERIFICANDO PROCESAMIENTO DE RECIBO DE WHATSAPP")
print("="*60 + "\n")

# Buscar transacciones creadas en las últimas 2 horas
dos_horas_atras = (datetime.now() - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S")

cursor.execute("""
    SELECT id, user_id, amount, currency, category, subcategory, 
           merchant_or_beneficiary, concept, whatsapp_message_id, 
           receipt_image_url, created_at
    FROM transactions
    WHERE created_at >= ? OR whatsapp_message_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 10
""", (dos_horas_atras,))

transactions = cursor.fetchall()

if transactions:
    print("✅ TRANSACCIONES ENCONTRADAS:\n")
    for txn in transactions:
        txn_id, user_id, amount, currency, category, subcategory, merchant, concept, whatsapp_id, receipt_url, created_at = txn
        print(f"  📄 Transacción ID: {txn_id}")
        print(f"     Usuario ID: {user_id}")
        print(f"     Monto: ${amount} {currency}")
        print(f"     Categoría: {category} - {subcategory}")
        print(f"     Comercio: {merchant or 'N/A'}")
        print(f"     Concepto: {concept or 'N/A'}")
        if whatsapp_id:
            print(f"     ✅ WhatsApp Message ID: {whatsapp_id}")
        if receipt_url:
            print(f"     ✅ Recibo URL: {receipt_url[:80]}...")
        print(f"     Fecha: {created_at}\n")
    
    # Obtener información del usuario
    if transactions:
        user_id = transactions[0][1]
        cursor.execute("SELECT name, phone FROM users WHERE id = ?", (user_id,))
        user_info = cursor.fetchone()
        if user_info:
            print(f"  👤 Usuario: {user_info[0]}")
            print(f"     Teléfono: {user_info[1]}\n")
else:
    print("  ⚠️  No se encontraron transacciones recientes de WhatsApp\n")
    print("  Esto puede significar:")
    print("    1. El mensaje aún no ha sido procesado")
    print("    2. El número de teléfono no está registrado en DOMUS+")
    print("    3. Hubo un error al procesar el recibo\n")

# Verificar usuarios con números de teléfono
print("\n" + "="*60)
print("📱 USUARIOS REGISTRADOS CON TELÉFONO:")
print("="*60 + "\n")

cursor.execute("SELECT id, name, phone FROM users WHERE phone IS NOT NULL")
users = cursor.fetchall()

if users:
    for user_id, name, phone in users:
        print(f"  👤 {name}")
        print(f"     Teléfono: {phone}")
        print(f"     ID: {user_id}\n")
else:
    print("  ⚠️  No hay usuarios con teléfono registrado\n")
    print("  Para que funcione WhatsApp, necesitas:")
    print("    1. Registrarte en DOMUS+ con tu número de teléfono")
    print("    2. Usar el formato internacional (ej: +5218126333310)\n")

conn.close()

print("="*60 + "\n")
