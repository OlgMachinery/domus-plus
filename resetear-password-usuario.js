#!/usr/bin/env node

/**
 * Script para resetear la contraseña de un usuario
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

async function resetearPassword() {
  console.log('🔐 Reseteando contraseña para gonzalomail@me.com');
  console.log('');

  try {
    // Obtener el usuario
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error al listar usuarios:', listError.message);
      return;
    }

    const user = users.find(u => u.email === 'gonzalomail@me.com');
    
    if (!user) {
      console.error('❌ Usuario no encontrado');
      return;
    }

    console.log(`✅ Usuario encontrado: ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log('');

    // Nueva contraseña
    const nuevaPassword = 'Domus+1956@1';

    console.log('🔧 Actualizando contraseña...');
    
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: nuevaPassword }
    );

    if (updateError) {
      console.error('❌ Error al actualizar contraseña:', updateError.message);
      return;
    }

    console.log('✅ Contraseña actualizada exitosamente');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 Credenciales de acceso:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Email: gonzalomail@me.com`);
    console.log(`   Contraseña: ${nuevaPassword}`);
    console.log('');
    console.log('🧪 Ahora puedes iniciar sesión con estas credenciales');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetearPassword();
