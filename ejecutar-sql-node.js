#!/usr/bin/env node

/**
 * Script para ejecutar SQL en Supabase usando Node.js y pg
 * Requiere: npm install pg
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

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
if (!SUPABASE_URL) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL no encontrado');
  process.exit(1);
}

// Extraer project reference
const match = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
if (!match) {
  console.error('❌ Error: URL de Supabase inválida');
  process.exit(1);
}

const PROJECT_REF = match[1];

console.log('🚀 Ejecutando SQL en Supabase...');
console.log(`   Project: ${PROJECT_REF}`);
console.log('');

// Leer el SQL
const sqlFile = path.join(__dirname, 'supabase', 'schema.sql');
if (!fs.existsSync(sqlFile)) {
  console.error(`❌ Error: No se encontró ${sqlFile}`);
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlFile, 'utf8');
console.log(`📄 SQL leído: ${sqlContent.split('\n').length} líneas`);
console.log('');

// Intentar importar pg
let pg;
try {
  pg = require('pg');
} catch (e) {
  console.error('❌ Error: pg no está instalado');
  console.error('   Instala con: npm install pg');
  console.error('');
  console.error('💡 Alternativa: Ejecuta el SQL manualmente');
  console.error(`   1. Ve a: https://supabase.com/dashboard/project/${PROJECT_REF}`);
  console.error('   2. SQL Editor → New Query');
  console.error('   3. Copia el contenido de: supabase/schema.sql');
  process.exit(1);
}

// Pedir la contraseña de la base de datos
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('🔐 Database Password (la que configuraste al crear el proyecto): ', (dbPassword) => {
  rl.close();

  if (!dbPassword.trim()) {
    console.error('❌ Error: Password requerido');
    process.exit(1);
  }

  // Construir connection string - Usar conexión directa
  // El formato correcto es: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
  const connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword.trim())}@db.${PROJECT_REF}.supabase.co:5432/postgres`;

  console.log('🔌 Conectando a la base de datos...');

  const client = new pg.Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  client.connect()
    .then(() => {
      console.log('✅ Conectado!');
      console.log('📤 Ejecutando SQL...');
      console.log('');

      // Ejecutar el SQL
      return client.query(sqlContent);
    })
    .then(() => {
      console.log('✅ SQL ejecutado exitosamente!');
      console.log('');

      // Verificar tablas creadas
      return client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);
    })
    .then((result) => {
      const tables = result.rows;
      if (tables.length > 0) {
        console.log(`📊 ${tables.length} tablas encontradas:`);
        tables.slice(0, 10).forEach(table => {
          console.log(`   ✅ ${table.table_name}`);
        });
        if (tables.length > 10) {
          console.log(`   ... y ${tables.length - 10} más`);
        }
      } else {
        console.log('⚠️  No se encontraron tablas');
      }

      client.end();
      console.log('');
      console.log('🎉 ¡Base de datos configurada exitosamente!');
    })
    .catch((err) => {
      console.error('❌ Error:', err.message);
      console.error('');
      console.error('💡 Verifica:');
      console.error('   - Que la contraseña sea correcta');
      console.error('   - Que el proyecto esté activo en Supabase');
      client.end();
      process.exit(1);
    });
});
