const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lpmslitbvlihzucorenj.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwbXNsaXRidmxpaHp1Y29yZW5qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODUxNTM3NiwiZXhwIjoyMDg0MDkxMzc2fQ.ay2YSdJJDoT4U4U45GoB9DIFhckpAxCOMJn8ij-_oBmoA';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const email = 'gonzalomail@me.com';
const password = 'Domus+1956@1';

async function fixUser() {
  console.log(`🔧 Arreglando usuario: ${email}...`);

  // 1. Verificar si el usuario ya existe en Auth
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('Error listando usuarios:', listError);
    return;
  }

  const existingUser = users.find(u => u.email === email);
  let userId;

  if (existingUser) {
    console.log('👤 Usuario encontrado. Actualizando contraseña...');
    const { data, error } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      { password: password, email_confirm: true }
    );
    if (error) {
      console.error('Error actualizando password:', error);
      return;
    }
    userId = existingUser.id;
    console.log('✅ Contraseña actualizada.');
  } else {
    console.log('👤 Usuario no encontrado. Creando nuevo...');
    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });
    if (error) {
      console.error('Error creando usuario:', error);
      return;
    }
    userId = data.user.id;
    console.log('✅ Usuario creado.');
  }

  // 2. Asegurar que existe en la tabla public.users (necesario para la app)
  console.log('🗃 Verificando tabla public.users...');
  const { data: publicUser, error: publicError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (!publicUser) {
    console.log('Usuario no está en public.users. Insertando...');
    const { error: insertError } = await supabase
      .from('users')
      .insert([
        { 
          id: userId, 
          email: email, 
          name: 'Gonzalo',
          phone: '',
          is_active: true,
          is_family_admin: true 
        }
      ]);
    
    if (insertError) {
      console.error('Error insertando en public.users:', insertError);
    } else {
      console.log('✅ Insertado en public.users correctamente.');
    }
  } else {
    console.log('✅ El usuario ya existe en public.users.');
  }

  console.log('\n🎉 ¡LISTO! Intenta iniciar sesión ahora.');
}

fixUser();
