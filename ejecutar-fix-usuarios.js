#!/usr/bin/env node

/**
 * Script para crear usuarios faltantes en la tabla users
 * Ejecuta el SQL automáticamente usando la API de Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno
const envFile = path.join(__dirname, 'frontend', '.env.local');
if (!fs.existsSync(envFile)) {
  console.error('❌ Error: No se encontró frontend/.env.local');
  process.exit(1);
}

const envVars = {};
fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#') && line.includes('=')) {
    const [key, ...valueParts] = line.split('=');
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Faltan variables de entorno');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!SUPABASE_URL);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_KEY);
  process.exit(1);
}

console.log('🚀 Creando usuarios faltantes en tabla users...');
console.log('');

// Crear cliente de Supabase con service_role para tener permisos completos
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function ejecutarSQL() {
  try {
    // SQL para crear usuarios faltantes
    const sql = `
      INSERT INTO public.users (id, email, name, phone, is_active, is_family_admin)
      SELECT 
          au.id,
          au.email,
          COALESCE(au.raw_user_meta_data->>'name', 'Usuario'),
          COALESCE(au.raw_user_meta_data->>'phone', ''),
          true,
          false
      FROM auth.users au
      LEFT JOIN public.users u ON au.id = u.id
      WHERE u.id IS NULL
      ON CONFLICT (id) DO NOTHING;
    `;

    // Ejecutar usando RPC (si existe) o directamente
    // Nota: Supabase no tiene un endpoint público para ejecutar SQL arbitrario
    // Necesitamos usar el cliente de PostgreSQL directamente
    
    console.log('📋 Usuarios en auth.users:');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error al obtener usuarios:', authError.message);
      console.log('');
      console.log('💡 Usando método alternativo...');
      return ejecutarSQLAlternativo();
    }

    if (!authUsers || !authUsers.users) {
      console.log('⚠️  No se encontraron usuarios en auth.users');
      return;
    }

    console.log(`   Total: ${authUsers.users.length} usuarios`);
    console.log('');

    // Verificar cuáles faltan en users
    const { data: existingUsers, error: usersError } = await supabase
      .from('users')
      .select('id');

    if (usersError) {
      console.error('❌ Error al obtener usuarios de tabla users:', usersError.message);
      return ejecutarSQLAlternativo();
    }

    const existingIds = new Set((existingUsers || []).map(u => u.id));
    const missingUsers = authUsers.users.filter(u => !existingIds.has(u.id));

    console.log(`📊 Usuarios faltantes en tabla users: ${missingUsers.length}`);
    console.log('');

    if (missingUsers.length === 0) {
      console.log('✅ Todos los usuarios ya existen en la tabla users');
      return;
    }

    // Crear usuarios faltantes uno por uno
    let created = 0;
    let errors = 0;

    for (const authUser of missingUsers) {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.name || 'Usuario',
          phone: authUser.user_metadata?.phone || '',
          is_active: true,
          is_family_admin: false,
        });

      if (insertError) {
        console.error(`   ❌ Error al crear ${authUser.email}:`, insertError.message);
        errors++;
      } else {
        console.log(`   ✅ Creado: ${authUser.email}`);
        created++;
      }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Usuarios creados: ${created}`);
    if (errors > 0) {
      console.log(`⚠️  Errores: ${errors}`);
    }
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('🎉 ¡Completado! Ahora puedes intentar iniciar sesión.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    ejecutarSQLAlternativo();
  }
}

function ejecutarSQLAlternativo() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('INSTRUCCIONES MANUALES:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('Ejecuta este SQL en Supabase SQL Editor:');
  console.log('');
  console.log('```sql');
  console.log('INSERT INTO public.users (id, email, name, phone, is_active, is_family_admin)');
  console.log('SELECT ');
  console.log('    au.id,');
  console.log('    au.email,');
  console.log('    COALESCE(au.raw_user_meta_data->>\'name\', \'Usuario\'),');
  console.log('    COALESCE(au.raw_user_meta_data->>\'phone\', \'\'),');
  console.log('    true,');
  console.log('    false');
  console.log('FROM auth.users au');
  console.log('LEFT JOIN public.users u ON au.id = u.id');
  console.log('WHERE u.id IS NULL');
  console.log('ON CONFLICT (id) DO NOTHING;');
  console.log('```');
  console.log('');
}

ejecutarSQL();
