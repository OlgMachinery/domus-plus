#!/usr/bin/env node

/**
 * Script para ejecutar el esquema SQL en Supabase usando la API REST
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno
require('dotenv').config({ path: path.join(__dirname, 'frontend', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Faltan variables de entorno');
  console.error('   Asegúrate de que .env.local existe en frontend/');
  process.exit(1);
}

// Leer el archivo SQL
const sqlPath = path.join(__dirname, 'supabase', 'schema.sql');
let sqlContent;

try {
  sqlContent = fs.readFileSync(sqlPath, 'utf8');
  console.log('✅ Archivo SQL leído:', sqlPath);
} catch (error) {
  console.error('❌ Error al leer el archivo SQL:', error.message);
  process.exit(1);
}

// Extraer el project reference de la URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('❌ Error: No se pudo extraer el project reference de la URL');
  process.exit(1);
}

// URL de la API de Supabase para ejecutar SQL
const apiUrl = `https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`;

console.log('🚀 Ejecutando SQL en Supabase...');
console.log('   Project:', projectRef);
console.log('   URL:', SUPABASE_URL);
console.log('');

// Hacer la petición
const url = new URL(apiUrl);
const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  },
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ SQL ejecutado exitosamente!');
      console.log('');
      console.log('📊 Respuesta:', data || 'Sin respuesta (normal para DDL)');
    } else {
      console.error('❌ Error al ejecutar SQL');
      console.error('   Status:', res.statusCode);
      console.error('   Respuesta:', data);
      
      // Intentar método alternativo
      console.log('');
      console.log('💡 Intentando método alternativo...');
      ejecutarSQLAlternativo();
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error de conexión:', error.message);
  console.log('');
  console.log('💡 Método alternativo: Ejecuta el SQL manualmente en el dashboard');
  ejecutarSQLAlternativo();
});

// Enviar el SQL
const body = JSON.stringify({ query: sqlContent });
req.write(body);
req.end();

function ejecutarSQLAlternativo() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('INSTRUCCIONES MANUALES:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('1. Ve a tu dashboard de Supabase');
  console.log('2. Clic en "SQL Editor" en el menú lateral');
  console.log('3. Clic en "New Query"');
  console.log('4. Abre el archivo: supabase/schema.sql');
  console.log('5. Copia TODO el contenido (Cmd+A, Cmd+C)');
  console.log('6. Pégalo en el editor SQL (Cmd+V)');
  console.log('7. Clic en "Run" (botón verde) o presiona Cmd+Enter');
  console.log('');
  console.log('El archivo SQL está en:', sqlPath);
  console.log('');
}
