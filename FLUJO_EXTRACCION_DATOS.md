# 📊 Flujo de Extracción y Normalización de Datos de Recibos

## 🔄 Flujo Completo: De Imagen a Base de Datos

### **FASE 1: Recepción y Preprocesamiento de Imagen**
**Archivo:** `backend/app/routers/receipts.py` (líneas 12-155)

1. **Recepción del archivo**
   - Usuario sube imagen del recibo
   - Validación: debe ser formato de imagen válido
   - Lectura de bytes de la imagen

2. **Optimización de imagen**
   - Comprimir si es muy grande (>1MB)
   - Convertir formatos (RGBA → RGB)
   - Redimensionar si es necesario (máx 800px ancho)

3. **Detección de recibo largo**
   - Si altura > 1200px y es vertical → **Dividir en partes**
   - Guardar imagen completa para fallback
   - Cada parte: ~1500px con solapamiento de 200px

---

### **FASE 2: Extracción con IA (OCR + GPT Vision)**
**Archivo:** `backend/app/services/receipt_processor.py` (líneas 76-638)

#### **2.1 Extracción de Texto con OCR (Opcional)**
```python
extract_text_with_ocr(image_base64, image_format)
```
- **Si OCR disponible:** Extrae texto rápidamente (~1-2 seg)
- **Resultado:** Texto plano del recibo
- **Límite:** 5000 caracteres (truncado si es más largo)

#### **2.2 Procesamiento con GPT Vision**
```python
process_receipt_image(image_base64, image_format)
```

**Prompt a GPT:**
- **Sistema:** Instrucciones detalladas para extraer TODOS los items
- **Usuario:** 
  - Imagen del recibo (base64)
  - Texto OCR (si disponible) como contexto
  - Instrucciones específicas sobre columnas (ARTICULO, CANT., PRE.UNIT, TOTAL)

**Respuesta de GPT:**
- JSON estructurado con:
  - Datos principales del recibo
  - Array de items (cada item con: description, amount, quantity, unit_price, etc.)

**Configuración:**
- Modelos: `gpt-4o-mini` (intento 1), `gpt-4o` (fallback)
- `max_tokens`: 32,768 (para recibos grandes)
- `temperature`: 0 (determinístico)
- `response_format`: JSON object

---

### **FASE 3: Normalización y Validación de Datos**
**Archivo:** `backend/app/services/receipt_processor.py` (líneas 360-620)

#### **3.1 Validación del JSON**
- Parsear JSON de respuesta
- Reparar JSON si tiene errores comunes
- Validar estructura básica

#### **3.2 Normalización de Items** (Por cada item)

**a) Descripción (description)**
```python
clean_description(description)
```
- Remover paréntesis: `"(PESO MANUAL)"` → eliminado
- Limpiar repeticiones: `"CHILE EN SALSA DE CHILE EN SALSA..."` → `"CHILE EN SALSA VERDE"`
- Validar que no esté vacía (usar placeholder si falta)

**b) Monto (amount)**
```python
amount = float(item.get("amount", 0))
```
- Convertir a float
- Si es 0 o negativo:
  - Intentar calcular: `amount = quantity * unit_price`
  - Si no se puede calcular → usar 0.0
- Validar que sea >= 0

**c) Cantidad (quantity)**
```python
quantity = float(qty_val) if qty_val is not None else None
```
- Convertir a float si existe
- Si no existe → `None` (NO usar 1 por defecto)
- Preservar decimales exactos: `2.020`, `4.234`, etc.

**d) Precio Unitario (unit_price)**
```python
if unit_price viene:
    unit_price = float(unit_price)
elif quantity y amount existen:
    unit_price = amount / quantity  # Calcular
else:
    unit_price = None
```
- Validar que no sea igual a amount (a menos que quantity=1)
- Recalcular si hay inconsistencia

**e) Unidad de Medida (unit_of_measure)**
```python
unit_of_measure = str(unit_of_measure).strip() if unit_of_measure else None
```
- Normalizar string
- Si es "null" o vacío → `None`

**f) Categorías (category/subcategory)**
```python
safe_category(cat_str, default="Mercado")
safe_subcategory(sub_str, default="Mercado General")
```
- Validar contra enum `Category` y `Subcategory`
- Si inválida → usar default
- Si item no tiene categoría → usar categoría del recibo

#### **3.3 Creación de ReceiptItemData**
```python
ReceiptItemData(
    description=description,      # Normalizado
    amount=amount,                 # Validado y calculado
    quantity=quantity,             # Float o None
    unit_price=unit_price,        # Float o None
    unit_of_measure=unit_of_measure,  # String o None
    category=category,             # Enum validado
    subcategory=subcategory       # Enum validado
)
```

#### **3.4 Normalización de Datos Principales**

**Fecha y Hora:**
- `date`: String formato `YYYY-MM-DD`
- `time`: String formato `HH:MM`
- Si no existe → usar valores por defecto

**Monto Total:**
```python
main_amount = float(data.get("amount", 0))
if main_amount < 0:
    main_amount = 0.0
```

**Moneda:**
```python
currency = data.get("currency", "MXN") or "MXN"
```

**Categorías:**
- Validar contra enums
- Default: "Mercado" / "Mercado General"

#### **3.5 Creación de ReceiptData**
```python
ReceiptData(
    date=date,                     # String YYYY-MM-DD
    time=time,                     # String HH:MM
    amount=main_amount,            # Float >= 0
    currency=currency,             # String (default: "MXN")
    merchant_or_beneficiary=merchant,  # String o None
    category=category,             # Enum Category
    subcategory=subcategory,       # Enum Subcategory
    concept=concept,              # String o None
    reference=reference,          # String o None
    operation_id=operation_id,    # String o None
    tracking_key=tracking_key,    # String o None
    status="processed",           # String
    notes=notes,                  # String o None
    items=receipt_items           # List[ReceiptItemData] o None
)
```

---

### **FASE 4: Guardado en Base de Datos**
**Archivo:** `backend/app/routers/receipts.py` (líneas 322-399)

#### **4.1 Validaciones de Usuario**
- Verificar usuario asignado
- Validar que pertenezca a la misma familia

#### **4.2 Creación de Receipt (Tabla Principal)**
```python
db_receipt = models.Receipt(
    user_id=assigned_user_id,
    date=receipt_data.date,              # String → Date/DateTime
    time=receipt_data.time,              # String → Time
    amount=receipt_data.amount,          # Float
    currency=receipt_data.currency,      # String
    merchant_or_beneficiary=receipt_data.merchant_or_beneficiary,
    category=receipt_data.category,      # Enum → String
    subcategory=receipt_data.subcategory, # Enum → String
    concept=receipt_data.concept,
    reference=receipt_data.reference,
    operation_id=receipt_data.operation_id,
    tracking_key=receipt_data.tracking_key,
    notes=receipt_data.notes,
    status="pending"  # Pendiente de asignación
)
db.add(db_receipt)
db.flush()  # Obtener ID
```

#### **4.3 Creación de ReceiptItem (Items Individuales)**
```python
for item_data in receipt_data.items:
    receipt_item = models.ReceiptItem(
        receipt_id=db_receipt.id,        # Foreign Key
        description=item_data.description, # String
        amount=item_data.amount,          # Float
        quantity=item_data.quantity,      # Float o None
        unit_price=item_data.unit_price, # Float o None
        unit_of_measure=item_data.unit_of_measure,  # String o None
        category=item_data.category or receipt_data.category,  # Enum
        subcategory=item_data.subcategory or receipt_data.subcategory,  # Enum
        notes=receipt_data.notes
    )
    db.add(receipt_item)
```

#### **4.4 Commit a Base de Datos**
```python
db.commit()
db.refresh(db_receipt)
```

---

## 📋 Resumen del Flujo

```
1. IMAGEN → [Optimización] → [División si es necesario]
                    ↓
2. OCR (opcional) → Texto plano
                    ↓
3. GPT Vision → JSON crudo
                    ↓
4. NORMALIZACIÓN:
   - Parsear JSON
   - Validar tipos
   - Limpiar descripciones
   - Calcular valores faltantes
   - Validar categorías
   - Crear ReceiptData + ReceiptItemData[]
                    ↓
5. BASE DE DATOS:
   - Crear Receipt
   - Crear ReceiptItem[] (uno por cada item)
   - Commit
                    ↓
6. RESPUESTA → JSON con recibo completo
```

---

## 🔍 Puntos Clave de Normalización

### **Valores por Defecto:**
- `currency`: "MXN"
- `category`: "Mercado"
- `subcategory`: "Mercado General"
- `time`: "00:00"
- `status`: "processed" (luego "pending" en BD)

### **Validaciones Críticas:**
1. **Amount nunca negativo** → convertir a 0.0
2. **Quantity NO se inventa** → usar `None` si no existe
3. **Unit_price se calcula** si falta pero hay quantity y amount
4. **Descripciones se limpian** de repeticiones y paréntesis
5. **Categorías se validan** contra enums, default si inválida

### **Manejo de Errores:**
- Items con errores se omiten (no detienen el proceso)
- Se registran warnings para items problemáticos
- Si no hay items, se crea un item con el concepto principal
- Si todo falla, se intenta fallback con imagen completa

---

## 📊 Estructura de Datos

### **ReceiptData (Schema Pydantic)**
```python
{
    "date": "2024-01-15",
    "time": "14:30",
    "amount": 1500.50,
    "currency": "MXN",
    "merchant_or_beneficiary": "HEB",
    "category": Category.Mercado,
    "subcategory": Subcategory.Mercado_General,
    "concept": "Compra en HEB",
    "reference": null,
    "operation_id": null,
    "tracking_key": null,
    "status": "processed",
    "notes": null,
    "items": [
        {
            "description": "HEB CUETE MA",
            "amount": 301.00,
            "quantity": 2.02,
            "unit_price": 149.00,
            "unit_of_measure": "kg",
            "category": Category.Mercado,
            "subcategory": Subcategory.Mercado_General
        },
        ...
    ]
}
```

### **Receipt (Modelo SQLAlchemy)**
- Misma estructura pero con tipos de BD
- `date` → Date/DateTime
- `category` → String (enum convertido)
- Relación 1:N con `ReceiptItem`

### **ReceiptItem (Modelo SQLAlchemy)**
- Cada item del recibo
- Foreign Key a `Receipt`
- Campos opcionales: `quantity`, `unit_price`, `unit_of_measure`

---

## ✅ Garantías del Sistema

1. **Todos los items se procesan** (o se intenta)
2. **Datos normalizados** antes de guardar
3. **Valores por defecto** para campos requeridos
4. **Validación de tipos** en cada paso
5. **Manejo robusto de errores** (no se cae si un item falla)
6. **Logging detallado** para debugging
