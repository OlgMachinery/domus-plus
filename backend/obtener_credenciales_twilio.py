#!/usr/bin/env python3
"""
Script interactivo para obtener y configurar credenciales de Twilio
Guía paso a paso para obtener las credenciales desde la consola de Twilio
"""
import os
import webbrowser
import sys

def abrir_consola_twilio():
    """Abre la consola de Twilio en el navegador"""
    url = "https://console.twilio.com/"
    print(f"🌐 Abriendo consola de Twilio: {url}")
    try:
        webbrowser.open(url)
        return True
    except Exception as e:
        print(f"⚠️  No se pudo abrir el navegador automáticamente: {e}")
        print(f"   Por favor, abre manualmente: {url}")
        return False

def guia_obtener_credenciales():
    """Muestra una guía paso a paso para obtener credenciales"""
    print("="*70)
    print("GUÍA PARA OBTENER CREDENCIALES DE TWILIO")
    print("="*70)
    print()
    print("PASO 1: Account SID y Auth Token")
    print("-" * 70)
    print("1. Ve a: https://console.twilio.com/")
    print("2. En el dashboard principal, encontrarás:")
    print("   - Account SID: Visible en la parte superior")
    print("   - Auth Token: Haz clic en 'Show' para revelarlo")
    print("3. Copia ambos valores")
    print()
    print("PASO 2: Número de WhatsApp")
    print("-" * 70)
    print("1. En la consola de Twilio, ve a: Messaging → Try it out")
    print("2. O ve a: Messaging → Settings → WhatsApp Sandbox")
    print("3. Encontrarás tu número de WhatsApp (formato: whatsapp:+14155238886)")
    print("4. Si usas el Sandbox, también necesitarás autorizar números de prueba")
    print()
    print("PASO 3: Configurar Webhook")
    print("-" * 70)
    print("1. Ve a: Messaging → Settings → WhatsApp Sandbox")
    print("2. En 'A MESSAGE COMES IN', configura:")
    print("   - URL: https://tu-dominio.com/api/whatsapp/webhook")
    print("   - Método: POST")
    print("3. Guarda los cambios")
    print()
    print("="*70)

def configurar_credenciales():
    """Solicita y configura las credenciales"""
    print("\n📝 Configuración de Credenciales")
    print("-" * 70)
    
    # Cargar .env si existe
    env_file = ".env"
    env_vars = {}
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key] = value
    
    # Solicitar credenciales
    print("\nIngresa tus credenciales de Twilio:")
    print("(Presiona Enter para mantener el valor actual si existe)")
    print()
    
    account_sid = input(f"TWILIO_ACCOUNT_SID [{env_vars.get('TWILIO_ACCOUNT_SID', '')}]: ").strip()
    if not account_sid:
        account_sid = env_vars.get('TWILIO_ACCOUNT_SID', '')
    
    auth_token = input(f"TWILIO_AUTH_TOKEN [{'*' * len(env_vars.get('TWILIO_AUTH_TOKEN', '')) if env_vars.get('TWILIO_AUTH_TOKEN') else ''}]: ").strip()
    if not auth_token:
        auth_token = env_vars.get('TWILIO_AUTH_TOKEN', '')
    
    whatsapp_number = input(f"TWILIO_WHATSAPP_NUMBER [{env_vars.get('TWILIO_WHATSAPP_NUMBER', '')}]: ").strip()
    if not whatsapp_number:
        whatsapp_number = env_vars.get('TWILIO_WHATSAPP_NUMBER', '')
    
    # Validar
    if not all([account_sid, auth_token, whatsapp_number]):
        print("\n❌ Error: Todas las credenciales son requeridas")
        return False
    
    # Actualizar .env
    print("\n📝 Actualizando archivo .env...")
    
    # Leer archivo .env completo
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
        new_lines.append(f'TWILIO_ACCOUNT_SID={account_sid}\n')
    if not updated['TWILIO_AUTH_TOKEN']:
        new_lines.append(f'TWILIO_AUTH_TOKEN={auth_token}\n')
    if not updated['TWILIO_WHATSAPP_NUMBER']:
        new_lines.append(f'TWILIO_WHATSAPP_NUMBER={whatsapp_number}\n')
    
    # Escribir archivo
    with open(env_file, 'w') as f:
        f.writelines(new_lines)
    
    print("✅ Credenciales guardadas en .env")
    return True

if __name__ == "__main__":
    print("\n" + "="*70)
    print("CONFIGURACIÓN DE TWILIO PARA DOMUS+")
    print("="*70)
    
    # Mostrar guía
    guia_obtener_credenciales()
    
    # Preguntar si quiere abrir la consola
    respuesta = input("\n¿Quieres que abra la consola de Twilio en tu navegador? (s/n): ").strip().lower()
    if respuesta in ['s', 'si', 'sí', 'y', 'yes']:
        abrir_consola_twilio()
        print("\n⏳ Espera a que cargue la consola...")
        input("Presiona Enter cuando hayas copiado tus credenciales...")
    
    # Configurar credenciales
    if configurar_credenciales():
        print("\n✅ Configuración completada!")
        print("\n🔍 Verificando configuración...")
        print()
        
        # Ejecutar verificación
        try:
            import subprocess
            subprocess.run([sys.executable, "verificar_whatsapp.py"])
        except Exception as e:
            print(f"⚠️  No se pudo ejecutar la verificación automáticamente: {e}")
            print("   Ejecuta manualmente: python3 verificar_whatsapp.py")
    else:
        print("\n❌ Configuración cancelada o incompleta")
        sys.exit(1)
