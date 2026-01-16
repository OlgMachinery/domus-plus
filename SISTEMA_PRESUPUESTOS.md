# 📊 Sistema de Presupuestos DOMUS+ - Diseño y Mejores Prácticas

## 🎯 Filosofía del Sistema

Basado en las mejores prácticas de sistemas de presupuestos familiares a nivel mundial (YNAB, Mint, PocketGuard), DOMUS+ implementa un sistema híbrido que distingue entre:

1. **Presupuestos Comunes (Shared Budgets)**: Gastos compartidos por toda la familia
2. **Presupuestos Individuales (Personal Budgets)**: Gastos personales de cada miembro

## 📋 Estructura del Sistema

### 1. Presupuesto Anual Familiar
- **Año fiscal**: Define el período presupuestario (típicamente enero-diciembre)
- **Total familiar**: Suma de todos los presupuestos (comunes + individuales)
- **Distribución automática**: Sistema inteligente de asignación

### 2. Presupuestos Comunes (Shared)
**Características:**
- Se crean a nivel familiar
- Se distribuyen automáticamente entre todos los miembros
- Todos los miembros pueden ver y rastrear estos gastos
- Ejemplos:
  - Servicios Básicos (CFE, Agua, Internet)
  - Mercado General
  - Vivienda (hipoteca, mantenimiento)
  - Impuestos familiares
  - Seguros familiares

**Distribución:**
- **Equitativa**: Se divide igual entre todos los miembros
- **Por porcentaje**: Cada miembro aporta un % definido
- **Por ingreso**: Se distribuye según los ingresos de cada miembro

### 3. Presupuestos Individuales (Personal)
**Características:**
- Se asignan directamente a un miembro específico
- Solo ese miembro puede ver y gestionar su presupuesto
- No se comparten con otros miembros
- Ejemplos:
  - Transporte personal (gasolina, mantenimiento de auto propio)
  - Salidas personales
  - Gastos médicos personales
  - Educación personal (cursos, libros)

## 🔄 Flujo de Trabajo

### Creación del Presupuesto Anual

1. **Admin crea presupuestos familiares comunes**
   - Define categorías y montos totales
   - El sistema distribuye automáticamente entre miembros

2. **Admin asigna presupuestos individuales**
   - Selecciona miembro
   - Define categorías y montos personales

3. **Seguimiento mensual**
   - Cada miembro registra sus gastos
   - El sistema actualiza automáticamente los presupuestos
   - Alertas cuando se acerca al límite

## 💡 Mejores Prácticas Implementadas

1. **Regla 50/30/20** (opcional):
   - 50% necesidades (comunes)
   - 30% deseos (individuales)
   - 20% ahorros

2. **Presupuesto Base Cero**:
   - Cada categoría se justifica desde cero cada año
   - No se basa en años anteriores automáticamente

3. **Flexibilidad**:
   - Ajustes mensuales permitidos
   - Reasignación de fondos entre categorías

4. **Transparencia**:
   - Todos ven gastos comunes
   - Privacidad en gastos individuales

5. **Alertas Proactivas**:
   - Notificaciones al 80% del presupuesto
   - Alertas al 100% (presupuesto agotado)

## 📊 Categorías por Tipo

### Comunes (Shared)
- Servicios Básicos
- Mercado
- Vivienda
- Impuestos
- Seguros familiares
- Vida Social Familiar

### Individuales (Personal)
- Transporte personal
- Salidas personales
- Educación personal
- Salud personal
- Gastos personales varios

## 🔧 Implementación Técnica

### Modelo de Datos
```python
FamilyBudget:
  - budget_type: "shared" | "individual"
  - distribution_method: "equal" | "percentage" | "income_based"
  - auto_distribute: boolean
```

### Lógica de Distribución
- **Equal**: total_amount / num_members
- **Percentage**: total_amount * user_percentage
- **Income Based**: total_amount * (user_income / total_income)
