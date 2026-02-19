# 📋 Análisis Completo: Migración Backend → Next.js/Supabase

## 🔍 Endpoints del Backend que Faltan Migrar

### ✅ Ya Migrados (Parcialmente)
- `/api/auth/register` - Registro de usuarios
- `/api/auth/login` - Login
- `/api/users/create` - Crear usuario (admin)
- `/api/users/me` - Obtener usuario actual
- `/api/families` - Crear familia (básico)
- `/api/receipts/process` - Procesar recibos

### ❌ Faltan Migrar

#### 1. USERS (`/api/users`)
- ✅ `POST /register` - Ya migrado
- ✅ `POST /login` - Ya migrado  
- ✅ `GET /me` - Ya migrado
- ✅ `POST /create` - Ya migrado (admin)
- ❌ `POST /verify-password` - Verificar contraseña
- ❌ `GET /{user_id}` - Obtener usuario específico

#### 2. FAMILIES (`/api/families`)
- ✅ `POST /` - Crear familia (básico)
- ❌ `GET /{family_id}` - Obtener familia
- ❌ `GET /{family_id}/members` - Obtener miembros
- ❌ `POST /{family_id}/members/{user_id}` - Agregar miembro

#### 3. BUDGETS (`/api/budgets`)
- ❌ `POST /family` - Crear presupuesto familiar
- ❌ `GET /family` - Obtener presupuestos familiares
- ❌ `POST /user` - Crear presupuesto de usuario
- ❌ `GET /user` - Obtener presupuestos de usuario
- ❌ `POST /family/{budget_id}/distribute` - Distribuir presupuesto
- ❌ `PUT /family/{budget_id}` - Actualizar presupuesto
- ❌ `GET /global-summary` - Resumen global
- ❌ `GET /annual-matrix` - Matriz anual
- ❌ `GET /summary` - Resumen completo
- ❌ `PUT /account/{account_id}/display-names` - Actualizar nombres
- ❌ `PUT /account/{account_id}` - Actualizar cuenta

#### 4. TRANSACTIONS (`/api/transactions`)
- ❌ `POST /` - Crear transacción
- ❌ `GET /` - Obtener transacciones (con filtros)
- ❌ `GET /{transaction_id}` - Obtener transacción
- ❌ `PUT /{transaction_id}` - Actualizar transacción

#### 5. CUSTOM CATEGORIES (`/api/custom-categories`)
- ❌ `POST /` - Crear categoría personalizada
- ❌ `GET /` - Obtener categorías
- ❌ `GET /{category_id}` - Obtener categoría
- ❌ `PUT /{category_id}` - Actualizar categoría
- ❌ `DELETE /{category_id}` - Eliminar categoría
- ❌ `POST /{category_id}/subcategories` - Crear subcategoría
- ❌ `PUT /subcategories/{subcategory_id}` - Actualizar subcategoría
- ❌ `DELETE /subcategories/{subcategory_id}` - Eliminar subcategoría

#### 6. RECEIPTS (`/api/receipts`)
- ✅ `POST /process` - Procesar recibos (básico)
- ❌ `GET /` - Obtener recibos
- ❌ `GET /{receipt_id}` - Obtener recibo
- ❌ `POST /{receipt_id}/assign` - Asignar recibo
- ❌ `POST /{receipt_id}/items` - Agregar item
- ❌ `PUT /items/{item_id}/assign` - Asignar item

#### 7. PERSONAL BUDGETS (`/api/personal-budgets`)
- ❌ `GET /categories` - Obtener categorías individuales
- ❌ `POST /` - Crear presupuesto personal
- ❌ `GET /` - Obtener presupuestos personales
- ❌ `GET /{budget_id}` - Obtener presupuesto personal
- ❌ `PUT /{budget_id}` - Actualizar presupuesto personal
- ❌ `DELETE /{budget_id}` - Eliminar presupuesto personal

#### 8. ACTIVITY LOGS (`/api/activity-logs`)
- ❌ `GET /` - Obtener logs
- ❌ `GET /stats` - Estadísticas de logs

#### 9. AI ASSISTANT (`/api/ai-assistant`)
- ❌ `POST /chat` - Chat con asistente
- ❌ `POST /analyze-budget` - Analizar presupuesto
- ❌ `POST /suggest-category` - Sugerir categoría
- ❌ `POST /detect-anomalies` - Detectar anomalías
- ❌ `POST /predict-expenses` - Predecir gastos
- ❌ `POST /generate-report` - Generar reporte
- ❌ `POST /optimize-budget` - Optimizar presupuesto

#### 10. EXCEL (`/api/excel`)
- ❌ `POST /read` - Leer archivo Excel
- ❌ `POST /preview` - Vista previa Excel

#### 11. EXCEL IMPORT (`/api/excel-import`)
- ❌ `POST /import-budgets` - Importar presupuestos
- ❌ `POST /setup-from-excel` - Setup desde Excel

#### 12. WHATSAPP (`/api/whatsapp`)
- ❌ `POST /webhook` - Webhook de WhatsApp

#### 13. FAMILY SETUP (`/api/family-setup`)
- ❌ `POST /create-family-members` - Crear miembros desde Excel
- ❌ `POST /delete-test-users` - Eliminar usuarios de prueba
- ❌ `POST /clear-all-data` - Limpiar todos los datos

## 📊 Resumen

- **Total de endpoints en backend:** ~65
- **Ya migrados:** ~8
- **Faltan migrar:** ~57

## 🎯 Plan de Migración

### Fase 1: Endpoints Críticos (Prioridad Alta)
1. **Budgets** - Completar todas las funciones
2. **Transactions** - CRUD completo
3. **Custom Categories** - CRUD completo
4. **Families** - Completar funciones

### Fase 2: Funcionalidades Importantes (Prioridad Media)
5. **Receipts** - Completar funciones
6. **Personal Budgets** - CRUD completo
7. **Activity Logs** - Visualización

### Fase 3: Funcionalidades Avanzadas (Prioridad Baja)
8. **AI Assistant** - Funciones de IA
9. **Excel Import** - Importación masiva
10. **WhatsApp** - Webhook
11. **Dev Tools** - Herramientas de desarrollo

## 🔧 Estrategia de Migración

### Opción 1: Rutas API de Next.js (Recomendado)
- Crear `/app/api/[endpoint]/route.ts` para cada endpoint
- Usar Supabase directamente desde las rutas
- Mantener la misma estructura de respuesta

### Opción 2: Funciones SQL en Supabase
- Para lógica compleja, crear funciones SQL con `SECURITY DEFINER`
- Llamar desde Next.js usando `supabase.rpc()`

### Opción 3: Híbrido
- Rutas simples → Next.js API routes
- Lógica compleja → Funciones SQL en Supabase
- Operaciones administrativas → Backend (si es necesario)

## 📝 Próximos Pasos

1. Crear todas las rutas API de Next.js faltantes
2. Migrar la lógica de negocio a Supabase o Next.js
3. Actualizar el frontend para usar las nuevas rutas
4. Probar cada funcionalidad
5. Documentar cambios
