#!/usr/bin/env python3
"""
Script de diagnóstico para verificar la integración de WhatsApp.
"""
import sqlite3
import os
import subprocess
import json
from datetime import datetime, timedelta

print("\n" + "="*70)
print("🔍 DIAGNÓSTICO DE INTEGRACIÓN WHATSAPP")
print("="*70 + "\n")

# 1. Verificar ngrok
print("1️⃣ VERIFICANDO NGROK:")
print("-" * 70)
try:
    result = subprocess.run(
        ["curl", "-s", "http://localhost:4040/api/tunnels"],
        capture_output=True,
        text=True,
        timeout=5
    )
    if result.returncode == 0:
        data = json.loads(result.stdout)
        if data.get("tunnels"):
            public_url = data["tunnels"][0].get("public_url", "")
            print(f"   ✅ ngrok está corriendo")
            print(f"   📍 URL pública: {public_url}")
            print(f"   🔗 Webhook debería ser: {public_url}/api/whatsapp/webhook")
        else:
            print("   ⚠️  ngrok está corriendo pero no hay túneles activos")
    else:
        print("   ❌ ngrok no está respondiendo en el puerto 4040")
        print("   💡 Ejecuta: ngrok http 8000")
except Exception as e:
    print(f"   ❌ Error al verificar ngrok: {e}")
    print("   💡 Asegúrate de que ngrok esté corriendo: ngrok http 8000")

print()

# 2. Verificar backend
print("2️⃣ VERIFICANDO BACKEND:")
print("-" * 70)
try:
    result = subprocess.run(
        ["curl", "-s", "http://localhost:8000/docs"],
        capture_output=True,
        text=True,
        timeout=5
    )
    if result.returncode == 0 and "FastAPI" in result.stdout:
        print("   ✅ Backend está corriendo en puerto 8000")
    else:
        print("   ❌ Backend no está respondiendo en puerto 8000")
        print("   💡 Ejecuta: cd backend && source venv/bin/activate && python3 -m uvicorn app.main:app --reload --port 8000")
except Exception as e:
    print(f"   ❌ Error al verificar backend: {e}")
    print("   💡 Asegúrate de que el backend esté corriendo")

print()

# 3. Verificar base de datos y usuarios
print("3️⃣ VERIFICANDO USUARIOS REGISTRADOS:")
print("-" * 70)
db_path = "backend/domus_plus.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, name, email, phone FROM users WHERE phone IS NOT NULL")
    users = cursor.fetchall()
    
    if users:
        print(f"   ✅ Encontrados {len(users)} usuario(s) con teléfono:")
        for user_id, name, email, phone in users:
            print(f"      👤 {name}")
            print(f"         Email: {email}")
            print(f"         Teléfono: {phone}")
            print(f"         ID: {user_id}")
            print()
    else:
        print("   ⚠️  No hay usuarios con teléfono registrado")
        print("   💡 Registra tu número en DOMUS+ con formato internacional (ej: +5218126333310)")
    
    # Verificar transacciones recientes
    print("4️⃣ VERIFICANDO TRANSACCIONES RECIENTES:")
    print("-" * 70)
    dos_horas_atras = (datetime.now() - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        SELECT id, user_id, amount, currency, whatsapp_message_id, created_at
        FROM transactions
        WHERE created_at >= ? OR whatsapp_message_id IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 5
    """, (dos_horas_atras,))
    
    transactions = cursor.fetchall()
    if transactions:
        print(f"   ✅ Encontradas {len(transactions)} transacción(es) reciente(s):")
        for txn in transactions:
            txn_id, user_id, amount, currency, whatsapp_id, created_at = txn
            print(f"      📄 ID: {txn_id}, Monto: ${amount} {currency}")
            if whatsapp_id:
                print(f"         ✅ De WhatsApp: {whatsapp_id}")
            print(f"         Fecha: {created_at}")
            print()
    else:
        print("   ⚠️  No se encontraron transacciones recientes de WhatsApp")
        print("   💡 Esto sugiere que el webhook no está recibiendo mensajes")
    
    conn.close()
else:
    print("   ❌ Base de datos no encontrada en:", db_path)

print()

# 5. Verificar configuración de Twilio
print("5️⃣ VERIFICANDO CONFIGURACIÓN:")
print("-" * 70)
print("   📋 Verifica manualmente en Twilio Console:")
print("      1. Ve a: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox")
print("      2. Verifica que el campo 'When a message comes in' tenga la URL correcta")
print("      3. La URL debe ser: [tu-url-ngrok]/api/whatsapp/webhook")
print("      4. El método debe ser: POST")
print()

# 6. Recomendaciones
print("6️⃣ RECOMENDACIONES:")
print("-" * 70)
print("   Si no recibiste mensaje de confirmación:")
print("   1. Verifica que ngrok esté corriendo y anota la URL actual")
print("   2. Verifica que la URL en Twilio coincida con la de ngrok")
print("   3. Verifica que tu número esté registrado en DOMUS+ con formato: +5218126333310")
print("   4. Revisa los logs del backend para ver si llegó el mensaje")
print("   5. Verifica que OPENAI_API_KEY esté configurada en el backend")
print()

print("="*70 + "\n")
