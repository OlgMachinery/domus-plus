# Evaluación de tamaño y complejidad: DOMUS

Evaluación del proyecto DOMUS a partir del repositorio (código propio, sin dependencias).

---

## 1. Tamaño

### 1.1 Líneas de código (aprox.)

| Métrica | Valor |
|--------|--------|
| **Total repo** | ~114.000 líneas (TS, TSX, JS, CSS, PY, SQL, Prisma) |
| **domus-beta-dbe** (app principal) | ~33.700 líneas |
| **frontend** | ~30.500 |
| **app** (raíz) | ~22.600 |
| **backend** (Python) | ~13.500 |
| **supabase** | ~4.000 |
| **lib** | ~2.700 |
| **mobile** | ~900 |

### 1.2 Archivos

- **~266** archivos `.ts`, **~117** `.tsx` (sin node_modules/generated).
- **56** rutas API en domus-beta-dbe (`**/route.ts`).
- **21** modelos/enums en el schema Prisma (domus-beta-dbe).

### 1.3 Conclusión de tamaño

- **Tamaño: mediano-grande.** ~114k líneas y varias aplicaciones (tres frontends Next.js, backend Python, mobile, Supabase) indican un sistema con alcance amplio, no un prototipo pequeño.
- **Fragmentación:** Hay tres bloques front (domus-beta-dbe, frontend, app) con código parecido (p. ej. `budgets/page.tsx`, `transactions/page.tsx` duplicados en cada uno), lo que infla el total sin sumar capacidades distintas.

---

## 2. Complejidad

### 2.1 Concentración en un solo archivo (riesgo alto)

- **`domus-beta-dbe/src/app/ui/page.tsx`** ≈ **11.015 líneas**.
- Es la página principal de la UI: shell, navegación, y **todas** las vistas (dashboard, presupuesto, transacciones, calendario, usuarios, configuración, solicitudes, detalle de transacción) en un único componente.
- **Impacto:** Alta complejidad cognitiva, difícil de mantener y testear, cambios con riesgo de efectos secundarios, merges conflictivos.

### 2.2 Otros archivos grandes (riesgo medio)

| Archivo | Líneas | Rol |
|---------|--------|-----|
| `frontend/app/budgets/page.tsx` | ~2.800 | Presupuesto (frontend) |
| `app/budgets/page.tsx` | ~2.800 | Presupuesto (app raíz) |
| `system-architecture/page.tsx` (3 copias) | ~1.500 c/u | Diagrama |
| `extract.ts` (recibos) | ~1.364 | Extracción IA |
| `whatsapp/webhook/route.ts` | ~1.260 | Webhook WhatsApp |
| `documentProcessor.ts` (scan) | ~1.050 | Procesamiento documento |

Varios archivos por encima de 1.000 líneas indican **complejidad alta localizada** (lógica de negocio, integraciones, flujos largos).

### 2.3 Alcance funcional (complejidad por dominio)

- **Vistas principales:** dashboard, presupuesto, transacciones, calendario, usuarios, configuración, solicitudes, detalle tx (~8 vistas en un solo page).
- **Integraciones:** OpenAI (extracción + agente), WhatsApp (webhook), storage (DO Spaces), cron (reminders, alertas).
- **Modelo de datos:** 21 entidades (User, Family, Transaction, Receipt, Budget, MoneyRequest, etc.) con relaciones y reglas (corte, asignaciones, preferencias).
- **Flujos no triviales:** subir recibo → extraer → categorizar → transacción; solicitud efectivo → aprobar → entregar; calendario unificado (time-engine + eventos familiares).

### 2.4 Conclusión de complejidad

- **Complejidad: alta.** Motivos principales:
  1. **Monolito UI:** Una sola página de 11k líneas que concentra toda la app.
  2. **Muchos dominios:** Auth, familias, presupuesto, transacciones, recibos, calendario, solicitudes, reportes, WhatsApp.
  3. **Integraciones y reglas:** IA, webhook, storage, cron, detección duplicados, fechas, permisos.
  4. **Código repetido:** Tres frontends con páginas similares aumentan la superficie a mantener.

---

## 3. Resumen

| Dimensión | Valoración | Comentario |
|-----------|------------|------------|
| **Tamaño** | Mediano-grande | ~114k líneas, 56 APIs, 21 modelos; tres frontends similares. |
| **Complejidad estructural** | Alta | Un componente de 11k líneas; varios archivos >1k líneas. |
| **Complejidad de dominio** | Alta | Múltiples módulos, integraciones e IA, flujos con estado. |
| **Mantenibilidad** | Media-baja | Concentración en `page.tsx` y duplicación entre apps dificultan cambios y pruebas. |

### Recomendaciones breves

1. **Dividir `page.tsx`:** Extraer vistas a rutas o componentes por sección (Dashboard, Presupuesto, Transacciones, etc.) para bajar complejidad y facilitar pruebas.
2. **Unificar frontends:** Si solo domus-beta-dbe (domus-fam.com) es producción, valorar deprecar o consolidar frontend/app para reducir duplicación.
3. **Documentar flujos críticos:** Recibos, solicitudes, calendario y webhook ya tienen docs; mantenerlos y referenciarlos en el código.
4. **Tests:** Priorizar tests en módulos con más lógica (dedup, time-engine, extract, webhook) y en APIs críticas.

---

*Evaluación basada en el estado del repo (domus-plus) en marzo 2026.*
