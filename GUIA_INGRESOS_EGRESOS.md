# 💰 Guía: Sistema de Ingresos y Egresos - DOMUS+

## 🎯 Cómo Funciona el Control de Ingresos y Egresos

### 1. Identificación Automática

El sistema identifica automáticamente el tipo de transacción:

#### **Egresos (Gastos)**
- **Recibos por WhatsApp**: Siempre se registran como egresos
- **Recibos subidos**: Siempre se registran como egresos
- **Transacciones manuales**: Puedes seleccionar "Egreso"

**Efecto en presupuestos:**
- Se resta del `spent_amount`
- Disminuye el `available_amount`

#### **Ingresos**
- **Transacciones manuales**: Selecciona "Ingreso" al crear

**Efecto en presupuestos:**
- Se suma al `income_amount`
- Aumenta el `available_amount`

### 2. Asignación a Presupuestos

#### **Egresos con Presupuesto**
1. Al crear un egreso, puedes asignarlo a un presupuesto específico
2. El sistema automáticamente:
   - Resta el monto del `spent_amount` del presupuesto
   - Actualiza el `available_amount`

#### **Ingresos con Presupuesto**
1. Al crear un ingreso, puedes asignarlo a un presupuesto específico
2. El sistema automáticamente:
   - Suma el monto al `income_amount` del presupuesto
   - Aumenta el `available_amount`

#### **Transacciones sin Presupuesto**
- Se registran pero no afectan ningún presupuesto
- Útiles para ingresos/egresos personales no presupuestados

### 3. Cálculo de Disponible

**Fórmula:**
```
Disponible = Presupuesto Asignado + Ingresos Adicionales - Gastos
```

**Ejemplo:**
- Presupuesto asignado: $10,000
- Ingresos adicionales: $2,000
- Gastos: $7,000
- **Disponible: $5,000**

### 4. Categorías

#### **Categorías de Ingresos**
- Salario (Fijo, Variable)
- Bonos (Anual, Quincenal, Extra)
- Rentas (Propiedades, Inversiones)
- Reembolsos (Gastos, Impuestos)
- Inversiones (Dividendos, Intereses, Ganancias)
- Otros Ingresos (Regalos, Premios, Otros)

#### **Categorías de Egresos**
- Servicios Básicos
- Mercado
- Vivienda
- Transporte
- Impuestos
- Educación
- Salud
- Vida Social

### 5. Flujo de Trabajo

#### **Registrar un Egreso**
1. Ve a "Transacciones"
2. Haz clic en "Nueva Transacción"
3. Selecciona "Egreso (Gasto)"
4. Completa: categoría, monto, fecha, concepto
5. Opcional: Asigna a un presupuesto
6. Guarda

#### **Registrar un Ingreso**
1. Ve a "Transacciones"
2. Haz clic en "Nueva Transacción"
3. Selecciona "Ingreso"
4. Completa: categoría de ingreso, monto, fecha, origen
5. Opcional: Asigna a un presupuesto (aumenta el disponible)
6. Guarda

#### **Subir Recibo (Siempre Egreso)**
1. Ve a "Transacciones"
2. Haz clic en "Subir Recibo"
3. Selecciona imagen del recibo
4. El sistema procesa automáticamente
5. Se registra como egreso y se asigna al presupuesto correspondiente

### 6. Visualización

#### **Dashboard**
- **Presupuesto Asignado**: Monto inicial del presupuesto
- **Ingresos Adicionales**: Suma de todos los ingresos asignados
- **Gastado**: Suma de todos los egresos
- **Disponible**: Calculado automáticamente

#### **Página de Transacciones**
- **Filtros**: Todas, Ingresos, Egresos
- **Resumen**:
  - Total Ingresos (verde)
  - Total Egresos (rojo)
  - Balance Neto (verde si positivo, rojo si negativo)
- **Lista**: 
  - Ingresos en verde con signo `+`
  - Egresos en rojo con signo `-`
  - Badge indicando el tipo

### 7. Asignación a Miembros

#### **Ingresos Personales**
- Puedes crear un ingreso sin asignar a presupuesto
- Se registra como ingreso personal del usuario
- No afecta presupuestos familiares

#### **Ingresos Familiares**
- Asigna el ingreso a un presupuesto familiar
- Aumenta el disponible de ese presupuesto
- Todos los miembros pueden ver el aumento

### 8. Control y Seguimiento

#### **Alertas Automáticas**
- Cuando un presupuesto se acerca al límite (80%)
- Cuando un presupuesto se agota (100%)
- Cuando hay desviaciones significativas

#### **Reportes**
- Balance mensual: Ingresos vs Egresos
- Por categoría: Ver qué categorías generan más ingresos/gastos
- Por miembro: Ver ingresos y gastos individuales

## 📋 Ejemplos Prácticos

### Ejemplo 1: Salario Mensual
1. Crear transacción tipo "Ingreso"
2. Categoría: "Salario" → "Salario Fijo"
3. Monto: $50,000
4. Asignar a presupuesto "Mercado" (opcional)
5. Resultado: El presupuesto disponible aumenta en $50,000

### Ejemplo 2: Compra de Supermercado
1. Subir recibo del supermercado
2. Sistema detecta: Egreso automático
3. Asigna a presupuesto "Mercado"
4. Resultado: El presupuesto disponible disminuye

### Ejemplo 3: Bono Extra
1. Crear transacción tipo "Ingreso"
2. Categoría: "Bonos" → "Bono Extra"
3. Monto: $5,000
4. No asignar a presupuesto (ingreso personal)
5. Resultado: Se registra como ingreso personal, no afecta presupuestos

## 🔧 Migración de Base de Datos

Antes de usar esta funcionalidad, ejecuta:

```bash
cd backend
python3 migrate_add_transaction_type.py
```

Esto agregará:
- Campo `transaction_type` a la tabla `transactions`
- Campo `income_amount` a la tabla `user_budgets`

## ✅ Ventajas del Sistema

1. **Control Total**: Separa claramente ingresos y egresos
2. **Flexibilidad**: Ingresos pueden asignarse o no a presupuestos
3. **Automatización**: Recibos siempre se registran como egresos
4. **Transparencia**: Todos ven el balance real de presupuestos
5. **Trazabilidad**: Historial completo de ingresos y egresos
