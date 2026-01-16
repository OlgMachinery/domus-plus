-- 🔍 VERIFICACIÓN COMPLETA: Configuración de Usuarios y Recibos
-- Ejecuta esto en Supabase SQL Editor para verificar que todo esté correcto

-- ============================================
-- 1. VERIFICAR FUNCIÓN ensure_user_exists
-- ============================================
SELECT 
  'Función ensure_user_exists' as verificacion,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Función existe'
    ELSE '❌ Función NO existe - Ejecuta setup-completo-usuarios.sql'
  END as estado,
  proname as nombre_funcion,
  prosecdef as security_definer
FROM pg_proc
WHERE proname = 'ensure_user_exists'
GROUP BY proname, prosecdef;

-- ============================================
-- 2. VERIFICAR POLÍTICAS RLS EN TABLA users
-- ============================================
SELECT 
  'Políticas RLS en users' as verificacion,
  COUNT(*) as total_politicas,
  STRING_AGG(cmd::text, ', ') as operaciones_permitidas,
  CASE 
    WHEN COUNT(*) >= 3 THEN '✅ Todas las políticas configuradas'
    WHEN COUNT(*) > 0 THEN '⚠️ Faltan algunas políticas'
    ELSE '❌ No hay políticas - Ejecuta setup-completo-usuarios.sql'
  END as estado
FROM pg_policies
WHERE tablename = 'users';

-- Listar políticas específicas
SELECT 
  'Políticas detalladas' as verificacion,
  policyname,
  cmd as operacion,
  CASE 
    WHEN cmd = 'SELECT' THEN '✅ Ver perfil'
    WHEN cmd = 'INSERT' THEN '✅ Crear perfil'
    WHEN cmd = 'UPDATE' THEN '✅ Actualizar perfil'
    ELSE cmd::text
  END as descripcion
FROM pg_policies
WHERE tablename = 'users'
ORDER BY cmd;

-- ============================================
-- 3. VERIFICAR POLÍTICAS RLS EN TABLA receipts
-- ============================================
SELECT 
  'Políticas RLS en receipts' as verificacion,
  COUNT(*) as total_politicas,
  STRING_AGG(cmd::text, ', ') as operaciones_permitidas,
  CASE 
    WHEN COUNT(*) >= 3 THEN '✅ Todas las políticas configuradas'
    WHEN COUNT(*) > 0 THEN '⚠️ Faltan algunas políticas'
    ELSE '❌ No hay políticas - Ejecuta politicas-rls-receipts.sql'
  END as estado
FROM pg_policies
WHERE tablename = 'receipts';

-- ============================================
-- 4. VERIFICAR POLÍTICAS RLS EN TABLA receipt_items
-- ============================================
SELECT 
  'Políticas RLS en receipt_items' as verificacion,
  COUNT(*) as total_politicas,
  STRING_AGG(cmd::text, ', ') as operaciones_permitidas,
  CASE 
    WHEN COUNT(*) >= 3 THEN '✅ Todas las políticas configuradas'
    WHEN COUNT(*) > 0 THEN '⚠️ Faltan algunas políticas'
    ELSE '❌ No hay políticas - Ejecuta politicas-rls-receipts.sql'
  END as estado
FROM pg_policies
WHERE tablename = 'receipt_items';

-- ============================================
-- 5. VERIFICAR USUARIOS
-- ============================================
SELECT 
  'Usuarios en auth.users' as verificacion,
  COUNT(*) as total,
  COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as con_email
FROM auth.users;

SELECT 
  'Usuarios en public.users' as verificacion,
  COUNT(*) as total,
  COUNT(CASE WHEN is_active THEN 1 END) as activos,
  COUNT(CASE WHEN NOT is_active THEN 1 END) as inactivos
FROM public.users;

-- Usuarios que están en auth.users pero NO en public.users
SELECT 
  'Usuarios faltantes en public.users' as verificacion,
  au.id,
  au.email,
  au.created_at,
  CASE 
    WHEN au.id IS NOT NULL THEN '❌ Falta crear en public.users'
    ELSE '✅ Existe'
  END as estado
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
  AND au.email IS NOT NULL;

-- ============================================
-- 6. VERIFICAR RLS HABILITADO
-- ============================================
SELECT 
  'RLS habilitado' as verificacion,
  tablename,
  rowsecurity as rls_habilitado,
  CASE 
    WHEN rowsecurity THEN '✅ RLS activo'
    ELSE '❌ RLS desactivado'
  END as estado
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'receipts', 'receipt_items')
ORDER BY tablename;

-- ============================================
-- 7. RESUMEN FINAL
-- ============================================
SELECT 
  'RESUMEN' as verificacion,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_proc WHERE proname = 'ensure_user_exists') > 0 
         AND (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'users') >= 3
         AND (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'receipts') >= 3
         AND (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'receipt_items') >= 3
    THEN '✅ TODO CONFIGURADO CORRECTAMENTE'
    ELSE '⚠️ FALTAN CONFIGURACIONES - Revisa los resultados arriba'
  END as estado_final;
