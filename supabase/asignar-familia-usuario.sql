-- Solución: Asignar familia a un usuario o crear una familia nueva
-- Ejecuta esto en Supabase SQL Editor

-- ============================================
-- OPCIÓN 1: ASIGNAR USUARIO A UNA FAMILIA EXISTENTE
-- ============================================
-- Reemplaza 'TU_EMAIL@ejemplo.com' con el email del usuario
-- Reemplaza 1 con el ID de la familia existente

UPDATE users
SET family_id = 1  -- ID de la familia existente
WHERE email = 'gonzalomail@me.com';  -- Email del usuario

-- ============================================
-- OPCIÓN 2: CREAR UNA FAMILIA NUEVA Y ASIGNAR AL USUARIO COMO ADMIN
-- ============================================
-- Esta opción crea una familia nueva y asigna al usuario como administrador

DO $$
DECLARE
    v_user_id UUID;
    v_family_id INTEGER;
BEGIN
    -- Obtener el ID del usuario por email
    SELECT id INTO v_user_id
    FROM users
    WHERE email = 'gonzalomail@me.com';  -- Reemplaza con el email del usuario
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado con ese email';
    END IF;
    
    -- Crear una nueva familia
    INSERT INTO families (name, admin_id, created_at, updated_at)
    VALUES (
        'Familia de ' || (SELECT name FROM users WHERE id = v_user_id),
        v_user_id,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_family_id;
    
    -- Asignar la familia al usuario y hacerlo admin
    UPDATE users
    SET 
        family_id = v_family_id,
        is_family_admin = true,
        updated_at = NOW()
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Familia creada con ID: % y asignada al usuario: %', v_family_id, v_user_id;
END $$;

-- ============================================
-- OPCIÓN 3: VERIFICAR Y CORREGIR USUARIOS SIN FAMILIA
-- ============================================
-- Este script encuentra todos los usuarios sin familia y les crea una

DO $$
DECLARE
    v_user_id UUID;
    v_family_id INTEGER;
    v_user_name TEXT;
    v_user_email TEXT;
BEGIN
    -- Iterar sobre usuarios sin familia
    FOR v_user_id, v_user_name, v_user_email IN 
        SELECT id, name, email
        FROM users
        WHERE family_id IS NULL
    LOOP
        -- Crear familia para este usuario
        INSERT INTO families (name, admin_id, created_at, updated_at)
        VALUES (
            COALESCE(v_user_name, 'Familia de ' || SPLIT_PART(v_user_email, '@', 1)),
            v_user_id,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_family_id;
        
        -- Asignar familia y hacer admin
        UPDATE users
        SET 
            family_id = v_family_id,
            is_family_admin = true,
            updated_at = NOW()
        WHERE id = v_user_id;
        
        RAISE NOTICE 'Familia % creada para usuario % (%)', v_family_id, v_user_name, v_user_email;
    END LOOP;
END $$;

-- ============================================
-- VERIFICACIÓN: Ver usuarios y sus familias
-- ============================================
SELECT 
    u.id,
    u.email,
    u.name,
    u.family_id,
    u.is_family_admin,
    f.name as family_name,
    f.admin_id as family_admin_id
FROM users u
LEFT JOIN families f ON u.family_id = f.id
ORDER BY u.email;
