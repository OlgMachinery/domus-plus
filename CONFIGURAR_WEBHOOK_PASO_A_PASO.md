# 📋 Configurar Webhook en Twilio - Paso a Paso Visual

## 🎯 Dónde Estás Ahora

Estás en: **Messaging → Try it out → Send a WhatsApp message**

## ✅ Dónde Necesitas Ir

Necesitas ir a: **Messaging → Settings → WhatsApp Sandbox**

## 📍 Pasos Exactos:

### Opción 1: Desde el Menú Lateral

1. **En el menú lateral izquierdo** (panel azul oscuro), busca la sección **"Messaging"**
2. **Haz clic en "Settings"** (está más abajo en la lista, puede estar colapsado con un `>`)
3. **Haz clic en "WhatsApp Sandbox"** (dentro de Settings)

### Opción 2: URL Directa

Haz clic en este enlace o cópialo en tu navegador:

```
https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox
```

### Opción 3: Desde la Página Actual

1. En la página donde estás, verás una pestaña que dice **"Sandbox settings"** (al lado de "Sandbox")
2. **Haz clic en "Sandbox settings"**
3. Ahí encontrarás la sección **"A MESSAGE COMES IN"**

## 🔧 Qué Hacer en "Sandbox settings"

Una vez que estés en "Sandbox settings":

1. **Busca la sección "A MESSAGE COMES IN"** (está en la parte superior de la página)
2. Verás un campo de texto para la **URL**
3. **Pega esta URL:**
   ```
   https://reproachably-extremer-laraine.ngrok-free.dev/api/whatsapp/webhook
   ```
4. **Selecciona el método:** `POST` (debería estar en un dropdown)
5. **Haz clic en "Save"** o el botón de guardar

## 📸 Qué Deberías Ver

En la sección "A MESSAGE COMES IN" verás algo como:

```
┌─────────────────────────────────────────────────┐
│ A MESSAGE COMES IN                              │
│                                                  │
│ URL: [___________________________]              │
│                                                  │
│ Method: [POST ▼]                                │
│                                                  │
│ [Save]                                          │
└─────────────────────────────────────────────────┘
```

## ✅ Después de Configurar

Una vez guardado, verás un mensaje de confirmación y la URL quedará guardada.

## 🧪 Prueba

Después de configurar, envía un mensaje de prueba por WhatsApp al número de Twilio y debería funcionar.
