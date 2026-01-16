#!/usr/bin/env node

/**
 * Script para verificar y confirmar emails de usuarios
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno
const envFile = path.join(__dirname, 'frontend', '.env.local');
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verificarYConfirmar() {
  console.log('🔍 Verificando y confirmando usuarios...');
  console.log('');

  try {
    // Obtener todos los usuarios
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error:', authError.message);
      return;
    }

    if (!authUsers || !authUsers.users) {
      console.log('⚠️  No se encontraron usuarios');
      return;
    }

    console.log(`📋 Total de usuarios: ${authUsers.users.length}`);
    console.log('');

    // Verificar y confirmar cada usuario
    for (const user of authUsers.users) {
      console.log(`👤 Usuario: ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email confirmado: ${user.email_confirmed_at ? '✅ Sí' : '❌ No'}`);
      
      // Confirmar email si no está confirmado
      if (!user.email_confirmed_at) {
        console.log('   🔧 Confirmando email...');
        
        const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
          user.id,
          { email_confirm: true }
        );

        if (updateError) {
          console.error(`   ❌ Error: ${updateError.message}`);
        } else {
          console.log('   ✅ Email confirmado');
        }
      }

      // Verificar en tabla users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userError || !userData) {
        console.log('   ⚠️  No existe en tabla users, creando...');
        
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || 'Usuario',
            phone: user.user_metadata?.phone || '',
            is_active: true,
            is_family_admin: false,
          });

        if (insertError) {
          console.error(`   ❌ Error al crear: ${insertError.message}`);
        } else {
          console.log('   ✅ Creado en tabla users');
        }
      } else {
        console.log(`   ✅ Existe en tabla users (${userData.name || 'Sin nombre'})`);
      }

      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Verificación completada');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('🧪 Ahora puedes intentar iniciar sesión:');
    console.log('   - gonzalomail@me.com');
    console.log('   - procentros@gmail.com');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verificarYConfirmar();
