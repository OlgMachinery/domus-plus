# 📋 Flujo para Crear Familia y Asignar Usuarios

## 🎯 Enfoque Correcto

El flujo correcto es:
1. **Crear la familia** primero
2. **Asignar al usuario como administrador** de esa familia
3. **Agregar miembros** a la familia

## ✅ Funciones SQL Creadas

### 1. `create_family(p_family_name, p_admin_user_id)`
Crea una nueva familia en la base de datos.

**Parámetros:**
- `p_family_name`: Nombre de la familia
- `p_admin_user_id`: (Opcional) ID del usuario que será administrador

**Retorna:**
- `family_id`: ID de la familia creada
- `family_name`: Nombre de la familia
- `success`: true si fue exitoso
- `message`: Mensaje descriptivo

### 2. `assign_family_admin(p_user_id, p_family_id)`
Asigna un usuario como administrador de una familia existente.

**Parámetros:**
- `p_user_id`: ID del usuario
- `p_family_id`: ID de la familia

**Retorna:**
- `success`: true si fue exitoso
- `message`: Mensaje descriptivo

### 3. `add_family_member(p_user_id, p_family_id, p_is_admin)`
Agrega un miembro a una familia existente.

**Parámetros:**
- `p_user_id`: ID del usuario
- `p_family_id`: ID de la familia
- `p_is_admin`: (Opcional, default: false) Si el usuario será administrador

**Retorna:**
- `success`: true si fue exitoso
- `message`: Mensaje descriptivo

### 4. `create_family_for_user(p_user_id, p_family_name)` (Compatibilidad)
Función que hace todo en una transacción (para compatibilidad con código existente).

## 📝 Ejemplo de Uso (Paso a Paso)

### Opción 1: Pasos Separados (Recomendado)

```sql
-- Paso 1: Crear la familia
SELECT * FROM create_family('Mi Familia', 'TU-USER-ID-AQUI'::UUID);
-- Guarda el family_id que retorna (ej: 1)

-- Paso 2: Asignar usuario como administrador (si no se pasó en paso 1)
SELECT * FROM assign_family_admin('TU-USER-ID-AQUI'::UUID, 1);

-- Paso 3: Agregar miembros adicionales
SELECT * FROM add_family_member('OTRO-USER-ID'::UUID, 1, false);
```

### Opción 2: Todo en Uno (Para compatibilidad)

```sql
SELECT * FROM create_family_for_user('TU-USER-ID-AQUI'::UUID, 'Mi Familia');
```

## 🔧 Cómo Obtener tu User ID

Ejecuta en Supabase SQL Editor:

```sql
SELECT id, email, name 
FROM users 
WHERE email = 'tu-email@ejemplo.com';
```

Copia el `id` (UUID) y úsalo en las funciones.

## ✅ Verificar que Funcionó

```sql
-- Verificar familia creada
SELECT id, name, admin_id, created_at 
FROM families 
ORDER BY created_at DESC 
LIMIT 5;

-- Verificar usuario asignado
SELECT id, email, name, family_id, is_family_admin 
FROM users 
WHERE email = 'tu-email@ejemplo.com';
```

## 🚨 Errores Comunes

### Error: "Usuario no encontrado"
**Solución:** Verifica que el user_id sea correcto usando la consulta de arriba.

### Error: "El usuario ya tiene una familia asignada"
**Solución:** El usuario ya está en una familia. Si quieres cambiarlo, primero actualiza:
```sql
UPDATE users SET family_id = NULL WHERE id = 'TU-USER-ID'::UUID;
```

### Error: "Familia no encontrada"
**Solución:** Verifica que el family_id sea correcto usando la consulta de verificación.

## 📋 Checklist

Antes de crear presupuestos, verifica:

- [ ] Familia creada (existe en tabla `families`)
- [ ] Usuario tiene `family_id` asignado
- [ ] Usuario tiene `is_family_admin = true`
- [ ] Políticas RLS configuradas (ejecuta `fix-rls-presupuestos-completo.sql`)
