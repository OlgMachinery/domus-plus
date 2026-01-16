#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'lpmslitbvlihzucorenj';
const DB_PASSWORD = 'Domus+1956@1';

const sqlFile = path.join(__dirname, 'supabase', 'schema.sql');
const sqlContent = fs.readFileSync(sqlFile, 'utf8');

console.log('🚀 Ejecutando SQL en Supabase...');
console.log(`   Project: ${PROJECT_REF}`);
console.log('');

const connectionString = `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false },
  connect_timeout: 10
});

client.connect()
  .then(() => {
    console.log('✅ Conectado a la base de datos!');
    console.log('📤 Ejecutando SQL...');
    console.log('');
    return client.query(sqlContent);
  })
  .then(() => {
    console.log('✅ SQL ejecutado exitosamente!');
    return client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
  })
  .then((result) => {
    const tables = result.rows;
    console.log('');
    console.log(`📊 ${tables.length} tablas creadas:`);
    tables.forEach(table => {
      console.log(`   ✅ ${table.table_name}`);
    });
    client.end();
    console.log('');
    console.log('🎉 ¡Base de datos configurada exitosamente!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
    console.error('');
    console.error('💡 Si la conexión falla, ejecuta el SQL manualmente:');
    console.error(`   1. Ve a: https://supabase.com/dashboard/project/${PROJECT_REF}`);
    console.error('   2. SQL Editor → New Query');
    console.error('   3. Copia el contenido de: supabase/schema.sql');
    client.end();
    process.exit(1);
  });
