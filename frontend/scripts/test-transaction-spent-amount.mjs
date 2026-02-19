/**
 * Prueba que el trigger de BD actualice spent_amount en user_budgets
 * al crear y editar transacciones (la API ya no toca user_budgets).
 *
 * Uso:
 *   1. Inicia el frontend: npm run dev
 *   2. Inicia sesión en http://localhost:3000 y abre DevTools → Application → Local Storage
 *   3. Copia el valor de domus_token
 *   4. Ejecuta: AUTH_TOKEN=<tu_token> node scripts/test-transaction-spent-amount.mjs
 *
 * Requiere: al menos un presupuesto asignado al usuario (user_budgets con family_budget_id).
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const token = process.env.AUTH_TOKEN

function authHeaders() {
  if (!token) {
    console.error('Falta AUTH_TOKEN. Inicia sesión, copia domus_token de localStorage y ejecuta:')
    console.error('  AUTH_TOKEN=<token> node scripts/test-transaction-spent-amount.mjs')
    process.exit(1)
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...options.headers } })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text}`)
  return text ? JSON.parse(text) : null
}

async function main() {
  console.log('Base URL:', BASE_URL)
  console.log('')

  // 1) Obtener presupuestos del usuario (incluye spent_amount por user_budget)
  let budgets
  try {
    budgets = await fetchJSON(`${BASE_URL}/api/budgets/user`)
  } catch (e) {
    console.error('Error obteniendo presupuestos (¿token válido?):', e.message)
    process.exit(1)
  }

  if (!Array.isArray(budgets) || budgets.length === 0) {
    console.error('No hay presupuestos asignados. Crea al menos uno en la app y vuelve a ejecutar.')
    process.exit(1)
  }

  const first = budgets[0]
  const familyBudgetId = first.family_budget_id
  const initialSpent = Number(first.spent_amount) || 0

  console.log('Presupuesto de prueba: family_budget_id =', familyBudgetId, '| spent_amount inicial =', initialSpent)

  // 2) Crear transacción
  const amount1 = 99.01
  let transaction
  try {
    transaction = await fetchJSON(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        amount: amount1,
        family_budget_id: familyBudgetId,
        transaction_type: 'expense',
        date: new Date().toISOString(),
      }),
    })
  } catch (e) {
    console.error('Error creando transacción:', e.message)
    process.exit(1)
  }

  const txId = transaction?.id
  if (!txId) {
    console.error('La API no devolvió id de transacción:', transaction)
    process.exit(1)
  }
  console.log('Transacción creada: id =', txId, '| amount =', amount1)

  // 3) Verificar spent_amount subió (trigger)
  const budgetsAfterCreate = await fetchJSON(`${BASE_URL}/api/budgets/user`)
  const afterCreate = budgetsAfterCreate.find((b) => b.family_budget_id === familyBudgetId)
  const spentAfterCreate = Number(afterCreate?.spent_amount) ?? null

  const expectedAfterCreate = initialSpent + amount1
  const epsilon = 0.02
  if (spentAfterCreate == null || Math.abs(spentAfterCreate - expectedAfterCreate) > epsilon) {
    console.error(
      'FAIL: spent_amount después de crear debería ser',
      expectedAfterCreate,
      ', obtuvo',
      spentAfterCreate
    )
    process.exit(1)
  }
  console.log('OK: spent_amount después de crear =', spentAfterCreate, '(esperado', expectedAfterCreate + ')')

  // 4) Editar transacción (cambiar monto)
  const amount2 = 150.02
  try {
    await fetchJSON(`${BASE_URL}/api/transactions/${txId}`, {
      method: 'PUT',
      body: JSON.stringify({ amount: amount2 }),
    })
  } catch (e) {
    console.error('Error editando transacción:', e.message)
    process.exit(1)
  }
  console.log('Transacción editada: amount =', amount2)

  // 5) Verificar spent_amount se actualizó (trigger)
  const budgetsAfterUpdate = await fetchJSON(`${BASE_URL}/api/budgets/user`)
  const afterUpdate = budgetsAfterUpdate.find((b) => b.family_budget_id === familyBudgetId)
  const spentAfterUpdate = Number(afterUpdate?.spent_amount) ?? null

  const expectedAfterUpdate = initialSpent + amount2
  if (spentAfterUpdate == null || Math.abs(spentAfterUpdate - expectedAfterUpdate) > epsilon) {
    console.error(
      'FAIL: spent_amount después de editar debería ser',
      expectedAfterUpdate,
      ', obtuvo',
      spentAfterUpdate
    )
    process.exit(1)
  }
  console.log('OK: spent_amount después de editar =', spentAfterUpdate, '(esperado', expectedAfterUpdate + ')')

  console.log('')
  console.log('Todas las comprobaciones pasaron. El trigger actualiza correctamente user_budgets.spent_amount.')
  console.log('(La transacción de prueba sigue en la app; puedes borrarla desde la UI si quieres.)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
