#!/usr/bin/env python3
"""
Verificar si un número está registrado y si hay transacciones asociadas.
"""
import sqlite3
import os
from datetime import datetime, timedelta

db_path = "backend/domus_plus.db"

if not os.path.exists(db_path):
    print("❌ Base de datos no encontrada")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

numero_buscado = "5690472"
print(f"\n🔍 BUSCANDO NÚMERO: {numero_buscado}\n")
print("="*70)

# Buscar en diferentes formatos
formatos = [
    numero_buscado,  # 5690472
    f"+52{numero_buscado}",  # +525690472
    f"+521{numero_buscado}",  # +5215690472
    f"52{numero_buscado}",  # 525690472
    f"521{numero_buscado}",  # 5215690472
    f"+521686{numero_buscado}",  # +5216865690472 (formato completo)
]

print("\n📱 BUSCANDO USUARIO CON ESTE NÚMERO:\n")
usuario_encontrado = False

for formato in formatos:
    cursor.execute("SELECT id, name, email, phone FROM users WHERE phone LIKE ?", (f"%{numero_buscado}%",))
    usuarios = cursor.fetchall()
    
    if usuarios:
        for user_id, name, email, phone in usuarios:
            print(f"  ✅ USUARIO ENCONTRADO:")
            print(f"     Nombre: {name}")
            print(f"     Email: {email}")
            print(f"     Teléfono registrado: {phone}")
            print(f"     ID: {user_id}\n")
            usuario_encontrado = True
            break
    
    if usuario_encontrado:
        break

if not usuario_encontrado:
    print(f"  ❌ NO se encontró usuario con número que contenga: {numero_buscado}\n")
    print("  📋 NÚMEROS REGISTRADOS EN DOMUS+:\n")
    cursor.execute("SELECT id, name, phone FROM users WHERE phone IS NOT NULL")
    todos_usuarios = cursor.fetchall()
    
    if todos_usuarios:
        for user_id, name, phone in todos_usuarios:
            print(f"     👤 {name}: {phone}")
    else:
        print("     ⚠️  No hay usuarios con teléfono registrado\n")

# Buscar transacciones recientes
print("\n" + "="*70)
print("📄 TRANSACCIONES RECIENTES (últimas 2 horas):\n")

dos_horas_atras = (datetime.now() - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S")
cursor.execute("""
    SELECT t.id, t.user_id, t.amount, t.currency, t.whatsapp_message_id, 
           t.receipt_image_url, t.created_at, u.name, u.phone
    FROM transactions t
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.created_at >= ? OR t.whatsapp_message_id IS NOT NULL
    ORDER BY t.created_at DESC
    LIMIT 10
""", (dos_horas_atras,))

transacciones = cursor.fetchall()

if transacciones:
    print(f"  ✅ Encontradas {len(transacciones)} transacción(es):\n")
    for txn in transacciones:
        txn_id, user_id, amount, currency, whatsapp_id, receipt_url, created_at, user_name, user_phone = txn
        print(f"     📄 Transacción ID: {txn_id}")
        print(f"        Usuario: {user_name} ({user_phone})")
        print(f"        Monto: ${amount} {currency}")
        if whatsapp_id:
            print(f"        ✅ De WhatsApp: {whatsapp_id}")
        if receipt_url:
            print(f"        ✅ Recibo: {receipt_url[:60]}...")
        print(f"        Fecha: {created_at}\n")
else:
    print("  ⚠️  No se encontraron transacciones recientes\n")
    print("  Esto significa que:")
    print("     - El webhook no recibió el mensaje")
    print("     - O el número no está registrado en DOMUS+")
    print("     - O hubo un error al procesar\n")

# Verificar números en el sandbox
print("="*70)
print("\n📱 NÚMEROS EN EL SANDBOX DE TWILIO:\n")
print("     whatsapp:+5218126333310")
print("     whatsapp:+5216865690472  ← Este parece ser tu número\n")

if not usuario_encontrado:
    print("="*70)
    print("\n💡 SOLUCIÓN:\n")
    print("  Para que funcione, necesitas:")
    print("  1. Registrarte en DOMUS+ con el número: +5216865690472")
    print("  2. O actualizar tu perfil para incluir este número")
    print("  3. El formato debe ser EXACTO: +5216865690472\n")

conn.close()
print("="*70 + "\n")
