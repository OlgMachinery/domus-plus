# 🔍 Diagnóstico del Problema: Solo 28 items de 127

## 📊 Problema Identificado

**Síntoma:** Recibo de 127 items, pero solo se extrajeron 28 items (22% del total)

**Posibles Causas:**

### 1. **División de Imagen Incorrecta**
- El recibo se divide en partes
- Algunas partes no se procesan correctamente
- Items se pierden en los bordes entre partes

### 2. **GPT No Extrae Todos los Items**
- GPT puede estar agrupando o resumiendo items
- Puede estar saltando items que considera similares
- Puede estar truncando la respuesta antes de terminar

### 3. **Filtrado Demasiado Agresivo**
- Los filtros de normalización pueden estar eliminando items válidos
- Items con precio 0 pueden ser válidos (promociones)
- Duplicados pueden ser válidos (mismo producto comprado múltiples veces)

## ✅ Mejoras Implementadas

### 1. **Instrucciones Mejoradas para GPT**
- Ahora instruye a GPT a **CONTAR primero** todos los items
- Luego extraer **EXACTAMENTE** ese número
- Instrucciones más explícitas sobre NO agrupar, NO resumir

### 2. **Detección del Número Esperado**
- Detecta "ARTICULOS COMPRADOS: 127" desde OCR
- Compara con items extraídos
- Muestra advertencia si hay discrepancia

### 3. **Mejor Logging**
- Muestra cuántos items se extrajeron por parte
- Advertencias si una parte tiene muy pocos items
- Logging detallado de cada paso

### 4. **Filtrado Mejorado**
- Solo filtra items claramente inválidos
- No filtra duplicados automáticamente (pueden ser válidos)
- Mejor validación de precios

## 🎯 Estrategia Alternativa Recomendada

Si el problema persiste, considera:

### **Opción 1: Procesar Imagen Completa (Sin Dividir)**
- Para recibos de 127 items, puede ser mejor procesar la imagen completa
- Aunque sea más lento, puede extraer todos los items
- Cambiar umbral de división a 2000px en lugar de 1000px

### **Opción 2: Dos Pasadas**
1. Primera pasada: Solo contar items (rápido)
2. Segunda pasada: Extraer todos los items con el número conocido

### **Opción 3: Procesamiento Secuencial con Verificación**
- Procesar partes secuencialmente
- Verificar que cada parte extraiga items
- Si una parte falla, reintentar con más solapamiento

## 📝 Próximos Pasos

1. **Probar con los cambios actuales**
2. **Revisar logs** para ver:
   - Cuántas partes se crearon
   - Cuántos items por parte
   - Si hay partes fallidas
3. **Si sigue fallando**, implementar Opción 1 (procesar completo)

## 🔧 Cambios Técnicos Aplicados

1. ✅ Instrucciones mejoradas (contar primero, luego extraer)
2. ✅ Detección de número esperado desde OCR
3. ✅ Validación mejorada de items extraídos
4. ✅ Mejor logging de cada parte
5. ✅ Filtrado menos agresivo
