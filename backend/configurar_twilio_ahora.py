#!/usr/bin/env python3
"""
Script para configurar Twilio ahora mismo
Abre la consola y guía al usuario paso a paso
"""
import webbrowser
import os
import sys

def main():
    print("\n" + "="*70)
    print("🚀 CONFIGURACIÓN RÁPIDA DE TWILIO")
    print("="*70)
    print()
    
    # Abrir consola de Twilio
    print("🌐 Abriendo consola de Twilio en tu navegador...")
    try:
        webbrowser.open('https://console.twilio.com/')
        print("✅ Consola abierta")
    except:
        print("⚠️  No se pudo abrir automáticamente")
        print("   Abre manualmente: https://console.twilio.com/")
    
    print("\n" + "="*70)
    print("PASO 1: OBTENER CREDENCIALES")
    print("="*70)
    print()
    print("En la consola de Twilio que se abrió:")
    print()
    print("1. ACCOUNT SID:")
    print("   - Está visible en el dashboard principal")
    print("   - Formato: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
    print()
    print("2. AUTH TOKEN:")
    print("   - Haz clic en el botón 'Show' junto a 'Auth Token'")
    print("   - Copia el token completo")
    print()
    print("3. WHATSAPP NUMBER:")
    print("   - Ve a: Messaging → Settings → WhatsApp Sandbox")
    print("   - O: Messaging → Try it out → Send a WhatsApp message")
    print("   - Formato: whatsapp:+14155238886")
    print()
    
    input("Presiona Enter cuando hayas copiado las credenciales...")
    print()
    
    # Solicitar credenciales
    print("="*70)
    print("PASO 2: INGRESAR CREDENCIALES")
    print("="*70)
    print()
    
    account_sid = input("Pega tu TWILIO_ACCOUNT_SID: ").strip()
    auth_token = input("Pega tu TWILIO_AUTH_TOKEN: ").strip()
    whatsapp_number = input("Pega tu TWILIO_WHATSAPP_NUMBER (ej: whatsapp:+14155238886): ").strip()
    
    # Validar
    if not all([account_sid, auth_token, whatsapp_number]):
        print("\n❌ Error: Todas las credenciales son requeridas")
        return False
    
    # Normalizar número de WhatsApp
    if not whatsapp_number.startswith("whatsapp:"):
        whatsapp_number = f"whatsapp:{whatsapp_number}"
    
    # Actualizar .env
    env_file = ".env"
    print(f"\n📝 Guardando credenciales en {env_file}...")
    
    # Leer archivo existente
    lines = []
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            lines = f.readlines()
    
    # Actualizar o agregar variables
    updated = {'TWILIO_ACCOUNT_SID': False, 'TWILIO_AUTH_TOKEN': False, 'TWILIO_WHATSAPP_NUMBER': False}
    
    new_lines = []
    for line in lines:
        if line.startswith('TWILIO_ACCOUNT_SID='):
            new_lines.append(f'TWILIO_ACCOUNT_SID={account_sid}\n')
            updated['TWILIO_ACCOUNT_SID'] = True
        elif line.startswith('TWILIO_AUTH_TOKEN='):
            new_lines.append(f'TWILIO_AUTH_TOKEN={auth_token}\n')
            updated['TWILIO_AUTH_TOKEN'] = True
        elif line.startswith('TWILIO_WHATSAPP_NUMBER='):
            new_lines.append(f'TWILIO_WHATSAPP_NUMBER={whatsapp_number}\n')
            updated['TWILIO_WHATSAPP_NUMBER'] = True
        else:
            new_lines.append(line)
    
    # Agregar las que faltan
    if not updated['TWILIO_ACCOUNT_SID']:
        new_lines.append(f'\n# Twilio Configuration\nTWILIO_ACCOUNT_SID={account_sid}\n')
    if not updated['TWILIO_AUTH_TOKEN']:
        new_lines.append(f'TWILIO_AUTH_TOKEN={auth_token}\n')
    if not updated['TWILIO_WHATSAPP_NUMBER']:
        new_lines.append(f'TWILIO_WHATSAPP_NUMBER={whatsapp_number}\n')
    
    # Escribir archivo
    with open(env_file, 'w') as f:
        f.writelines(new_lines)
    
    print("✅ Credenciales guardadas")
    
    # Verificar
    print("\n" + "="*70)
    print("PASO 3: VERIFICACIÓN")
    print("="*70)
    print()
    
    try:
        import subprocess
        result = subprocess.run([sys.executable, "verificar_whatsapp.py"], 
                              capture_output=True, text=True)
        print(result.stdout)
        if result.stderr:
            print(result.stderr)
    except Exception as e:
        print(f"⚠️  Error al verificar: {e}")
        print("   Ejecuta manualmente: python3 verificar_whatsapp.py")
    
    print("\n" + "="*70)
    print("✅ CONFIGURACIÓN COMPLETADA")
    print("="*70)
    print()
    print("📋 PRÓXIMOS PASOS:")
    print()
    print("1. Configura el webhook en Twilio:")
    print("   - Ve a: Messaging → Settings → WhatsApp Sandbox")
    print("   - En 'A MESSAGE COMES IN':")
    print("     URL: https://tu-dominio.com/api/whatsapp/webhook")
    print("     Método: POST")
    print()
    print("2. Si estás en desarrollo local, usa ngrok:")
    print("   ngrok http 8000")
    print("   (Usa la URL HTTPS que ngrok te da)")
    print()
    print("3. Prueba enviando un recibo por WhatsApp")
    print()
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n❌ Configuración cancelada")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
