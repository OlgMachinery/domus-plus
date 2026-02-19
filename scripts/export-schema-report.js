#!/usr/bin/env node
/**
 * Exporta un reporte del esquema real de Supabase (PostgreSQL).
 * Uso: DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" node scripts/export-schema-report.js
 * La connection string está en: Supabase Dashboard → Project Settings → Database → Connection string (URI)
 */

const { Client } = require('pg')

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!DATABASE_URL) {
  console.error('Falta DATABASE_URL o SUPABASE_DB_URL. Uso:')
  console.error('  DATABASE_URL="postgresql://postgres:XXX@db.XXX.supabase.co:5432/postgres" node scripts/export-schema-report.js')
  process.exit(1)
}

const queries = [
  {
    title: '1) TABLAS (schema public)',
    sql: `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;`,
  },
  {
    title: '2) RUTINAS (schema public)',
    sql: `SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_schema='public' ORDER BY routine_name;`,
  },
  {
    title: '3) TRIGGERS (schema public)',
    sql: `SELECT event_object_table, trigger_name, action_timing, event_manipulation FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY event_object_table, trigger_name;`,
  },
  {
    title: '4) FUNCIONES (pg_proc, schema public)',
    sql: `SELECT n.nspname AS schema, p.proname AS function_name FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' ORDER BY p.proname;`,
  },
  {
    title: '5) COLUMNAS de user_budgets (confirmar income_amount)',
    sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='user_budgets' ORDER BY ordinal_position;`,
  },
  {
    title: '6) ENUMS',
    sql: `SELECT t.typname AS enum_name, e.enumlabel AS enum_value FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typtype='e' ORDER BY t.typname, e.enumsortorder;`,
  },
]

function formatRows(rows, columns) {
  if (!rows.length) return '(ningún registro)'
  const widths = columns.map((col) => Math.max(col.length, ...rows.map((r) => String(r[col] || '').length)))
  const line = columns.map((c, i) => c.padEnd(widths[i])).join(' | ')
  const sep = columns.map((_, i) => '-'.repeat(widths[i])).join('-+-')
  const data = rows.map((r) => columns.map((c, i) => String(r[c] ?? '').padEnd(widths[i])).join(' | '))
  return [line, sep, ...data].join('\n')
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
  } catch (e) {
    console.error('Error conectando a la base de datos:', e.message)
    process.exit(1)
  }

  const out = []
  out.push('=============================================================================')
  out.push('REPORTE ESQUEMA REAL - SUPABASE (PostgreSQL)')
  out.push('Generado: ' + new Date().toISOString())
  out.push('=============================================================================\n')

  for (const q of queries) {
    out.push('--- ' + q.title + ' ---')
    try {
      const res = await client.query(q.sql)
      const cols = res.fields.map((f) => f.name)
      out.push(formatRows(res.rows, cols))
    } catch (e) {
      out.push('Error: ' + e.message)
    }
    out.push('')
  }

  await client.end()
  console.log(out.join('\n'))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
