# 📋 Endpoints Pendientes - Dependencias Requeridas

## ⚠️ Endpoints que Requieren Dependencias Adicionales

Los siguientes endpoints están creados pero requieren dependencias adicionales para funcionar completamente:

### 1. **Excel** (2 endpoints)
- ✅ `POST /api/excel/read` - Creado (requiere xlsx)
- ✅ `POST /api/excel/preview` - Creado (requiere xlsx)

**Dependencias necesarias:**
```bash
npm install xlsx
```

**Implementación:**
Ver `backend/app/routers/excel.py` para la lógica completa.

### 2. **Excel Import** (2 endpoints)
- ❌ `POST /api/excel-import/import-budgets` - No creado
- ❌ `POST /api/excel-import/setup-from-excel` - No creado

**Dependencias necesarias:**
```bash
npm install xlsx
```

**Implementación:**
Ver `backend/app/routers/excel_import.py` para la lógica completa.

### 3. **AI Assistant** (7 endpoints)
- ✅ `POST /api/ai-assistant/chat` - Creado (requiere openai)
- ❌ `POST /api/ai-assistant/analyze-budget` - No creado
- ❌ `POST /api/ai-assistant/suggest-category` - No creado
- ❌ `POST /api/ai-assistant/detect-anomalies` - No creado
- ❌ `POST /api/ai-assistant/predict-expenses` - No creado
- ❌ `POST /api/ai-assistant/generate-report` - No creado
- ❌ `POST /api/ai-assistant/optimize-budget` - No creado

**Dependencias necesarias:**
```bash
npm install openai
```

**Variables de entorno:**
```
OPENAI_API_KEY=tu_api_key
```

**Implementación:**
Ver `backend/app/routers/ai_assistant.py` y `backend/app/services/ai_assistant.py` para la lógica completa.

### 4. **WhatsApp** (1 endpoint)
- ✅ `POST /api/whatsapp/webhook` - Creado (requiere twilio)

**Dependencias necesarias:**
```bash
npm install twilio
```

**Variables de entorno:**
```
TWILIO_ACCOUNT_SID=tu_account_sid
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_WHATSAPP_NUMBER=tu_numero_whatsapp
```

**Implementación:**
Ver `backend/app/routers/whatsapp.py` y `backend/app/services/whatsapp_service.py` para la lógica completa.

### 5. **Dev Tools** (3 endpoints)
- ✅ `POST /api/dev/load-test-data` - Creado (placeholder)
- ✅ `POST /api/dev/clear-test-data` - Creado (placeholder)
- ✅ `POST /api/dev/delete-all-transactions` - Creado (placeholder)

**Nota:** Estos endpoints son para desarrollo/testing. Implementar según necesidad.

**Implementación:**
Ver `backend/app/routers/dev.py` para la lógica completa.

## 📝 Notas

1. **Endpoints creados pero no implementados completamente:**
   - Los endpoints están creados con estructura básica
   - Retornan código 501 (Not Implemented) con mensaje explicativo
   - Incluyen notas sobre dependencias necesarias

2. **Para implementar completamente:**
   - Instalar las dependencias necesarias
   - Configurar variables de entorno
   - Copiar la lógica del backend correspondiente
   - Adaptar a Next.js/Supabase

3. **Recomendación:**
   - Si no necesitas estas funcionalidades inmediatamente, puedes dejarlas como están
   - El sistema principal está 100% funcional sin estos endpoints
   - Implementar solo cuando sea necesario

## 🚀 Instalación Rápida de Dependencias

Si quieres implementar todas las funcionalidades:

```bash
# En el directorio frontend/
npm install xlsx openai twilio
```

Luego configurar las variables de entorno en `.env.local`:

```env
OPENAI_API_KEY=tu_api_key
TWILIO_ACCOUNT_SID=tu_account_sid
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_WHATSAPP_NUMBER=tu_numero_whatsapp
```
