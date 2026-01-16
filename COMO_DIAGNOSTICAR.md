# 🔍 Cómo Diagnosticar el Problema de Items Faltantes

## 📊 Problema Actual

El sistema extrae solo **28 items** cuando el recibo tiene **127 items** (22% del total).

## 🔧 Pasos para Diagnosticar

### 1. **Revisar Logs del Backend**

Ejecuta el script de diagnóstico:

```bash
cd backend
python3 diagnosticar_recibo.py
```

O si tienes la ruta del log:

```bash
python3 diagnosticar_recibo.py /ruta/al/log.txt
```

### 2. **Buscar Mensajes Clave en los Logs**

Si no tienes archivo de log, revisa la salida del backend directamente. Busca estos mensajes:

#### ✅ Mensajes de Éxito
- `📊 Datos extraídos: amount=..., items=28 items` ← **Aquí está el problema**
- `✅ Items procesados: 28/28` ← Indica cuántos se procesaron vs cuántos había

#### ⚠️ Mensajes de Advertencia Crítica
- `⚠️ ADVERTENCIA CRÍTICA: La respuesta fue truncada` ← **Problema: límite de tokens**
- `⚠️ ADVERTENCIA CRÍTICA: Se esperaban ~127 items pero solo se extrajeron 28` ← **Problema confirmado**

#### 📋 Información de OCR
- `📋 Número esperado de items detectado en OCR: 127` ← Confirma que OCR detectó 127

#### 🔄 Filtrado
- `⚠️ 5 items duplicados filtrados` ← Items eliminados por duplicados
- `⚠️ 3 items sin precio individual` ← Items eliminados por precio 0

### 3. **Interpretar los Resultados**

#### Escenario A: Respuesta Truncada
```
⚠️ ADVERTENCIA CRÍTICA: La respuesta fue truncada
📊 Datos extraídos: items=28 items
```

**Causa:** GPT alcanzó el límite de 16,384 tokens antes de terminar.

**Solución:**
- Procesar el recibo en partes más pequeñas
- O usar una estrategia diferente (dos pasadas)

#### Escenario B: GPT No Extrajo Todos
```
📊 Datos extraídos: items=28 items
📋 Número esperado de items detectado en OCR: 127
```

**Causa:** GPT no está siguiendo las instrucciones de extraer todos los items.

**Solución:**
- Mejorar las instrucciones (ya hecho)
- Verificar que GPT realmente vea toda la imagen
- Considerar procesar completo sin dividir (ya implementado)

#### Escenario C: Filtrado Excesivo
```
✅ Items procesados: 28/50
⚠️ 15 items duplicados filtrados
⚠️ 7 items sin precio individual
```

**Causa:** Los filtros están eliminando demasiados items válidos.

**Solución:**
- Ajustar la lógica de filtrado
- Ser menos estricto con duplicados

## 🎯 Soluciones Implementadas

### ✅ Cambios Recientes

1. **Estrategia de Procesamiento:**
   - Antes: Dividía recibos >1000px
   - Ahora: Solo divide si >3000px
   - **Resultado:** Recibos de 127 items se procesan completos

2. **Instrucciones Mejoradas:**
   - GPT ahora cuenta primero, luego extrae
   - Instrucciones más explícitas sobre NO agrupar

3. **Detección de Número Esperado:**
   - Detecta "ARTICULOS COMPRADOS: 127" desde OCR
   - Compara con items extraídos
   - Muestra advertencia si hay discrepancia

4. **Calidad de Imagen:**
   - Resolución: 1600px (antes 1200px)
   - Calidad JPEG: 85-95% (antes 80-90%)

## 📝 Próximos Pasos

1. **Procesa el recibo nuevamente** con los cambios aplicados
2. **Revisa los logs** usando el script de diagnóstico
3. **Comparte los resultados** para ajustar más si es necesario

## 🔍 Si el Problema Persiste

Si después de los cambios sigue extrayendo solo 28 items:

1. **Verifica que el backend esté usando el código actualizado:**
   ```bash
   # Reinicia el backend para cargar los cambios
   cd backend
   ./iniciar_backend.sh
   ```

2. **Revisa los logs en tiempo real:**
   ```bash
   # En otra terminal, observa los logs
   tail -f /tmp/domus_backend.log
   # O si el backend está en la terminal, observa su salida
   ```

3. **Comparte los logs completos** del procesamiento para análisis detallado

## 💡 Estrategias Alternativas (Si Sigue Fallando)

### Opción 1: Dos Pasadas
1. Primera pasada: Solo contar items (rápido, pocos tokens)
2. Segunda pasada: Extraer todos con el número conocido

### Opción 2: Procesamiento por Secciones
1. Dividir el recibo en secciones más pequeñas (50 items cada una)
2. Procesar cada sección por separado
3. Combinar resultados

### Opción 3: Usar GPT-4 Turbo con Más Tokens
- Cambiar a un modelo que soporte más tokens de salida
- O usar streaming para procesar en chunks
