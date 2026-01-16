# 💰 Sistema de Control de Ingresos y Egresos - DOMUS+

## 🎯 Filosofía del Sistema

El sistema distingue claramente entre:
- **Ingresos (Income)**: Dinero que entra a la familia o a un miembro
- **Egresos (Expenses)**: Dinero que sale de la familia o de un miembro

## 📊 Tipos de Transacciones

### 1. Ingresos (Income)
**Características:**
- Aumentan el presupuesto disponible
- Pueden asignarse a:
  - Un presupuesto específico (aumenta el disponible)
  - Un miembro específico (ingreso personal)
  - La familia completa (ingreso familiar)
- Ejemplos:
  - Salario
  - Bonos
  - Reembolsos
  - Ingresos por renta
  - Transferencias recibidas

### 2. Egresos (Expenses)
**Características:**
- Disminuyen el presupuesto disponible
- Se restan del presupuesto asignado
- Ejemplos:
  - Compras
  - Servicios
  - Pagos
  - Transferencias enviadas

## 🔄 Flujo de Control

### Ingresos
1. **Registro de Ingreso**
   - Usuario registra un ingreso
   - Selecciona categoría de ingreso
   - Opcionalmente asigna a un presupuesto

2. **Asignación Automática**
   - Si se asigna a un presupuesto: aumenta el `available_amount`
   - Si es personal: se suma al total de ingresos del usuario
   - Si es familiar: se distribuye según reglas configuradas

3. **Actualización de Presupuestos**
   - El presupuesto disponible aumenta
   - Se puede usar para futuros gastos

### Egresos
1. **Registro de Egreso**
   - Usuario registra un gasto
   - Selecciona categoría y presupuesto asociado

2. **Deducción Automática**
   - Se resta del `spent_amount` del presupuesto
   - Se actualiza el `available_amount`

3. **Control de Límites**
   - Alertas cuando se acerca al límite
   - Bloqueo opcional cuando se excede

## 📋 Categorías de Ingresos

### Ingresos Familiares
- Salarios familiares
- Ingresos por renta
- Bonos familiares
- Reembolsos familiares

### Ingresos Personales
- Salario personal
- Bonos personales
- Ingresos por freelance
- Reembolsos personales

## 🎨 Visualización

### Dashboard
- **Total de Ingresos**: Suma de todos los ingresos
- **Total de Egresos**: Suma de todos los egresos
- **Balance Neto**: Ingresos - Egresos
- **Presupuesto Disponible**: Presupuesto asignado - Gastado + Ingresos adicionales

### Transacciones
- **Filtros**: Por tipo (Ingreso/Egreso), categoría, fecha
- **Colores**:
  - Verde: Ingresos
  - Rojo: Egresos
- **Agrupación**: Por mes, categoría, presupuesto

## 🔧 Implementación Técnica

### Modelo de Datos
```python
TransactionType:
  - INCOME = "income"  # Ingreso
  - EXPENSE = "expense"  # Egreso

Transaction:
  - transaction_type: TransactionType
  - amount: float (siempre positivo)
  - Para ingresos: aumenta available_amount
  - Para egresos: aumenta spent_amount
```

### Lógica de Actualización
- **Ingreso asignado a presupuesto**: 
  - `available_amount += amount`
  
- **Egreso asignado a presupuesto**:
  - `spent_amount += amount`
  - `available_amount -= amount`

## 📱 Interfaz de Usuario

### Crear Transacción
1. Seleccionar tipo: Ingreso o Egreso
2. Ingresar monto
3. Seleccionar categoría (diferentes según tipo)
4. Opcional: Asignar a presupuesto
5. Guardar

### Vista de Transacciones
- Lista unificada con indicadores visuales
- Filtros por tipo
- Resumen de ingresos vs egresos
