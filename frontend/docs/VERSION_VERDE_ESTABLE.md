# Versión verde estable — checklist de verificación

Esta es la **única versión** sobre la que aplicar cambios: **Domus Fam (verde, español)**.

## Requisitos de despliegue

- **Root Directory en Vercel:** debe ser `frontend`. Si está vacío o en la raíz, se construye otra app y verás sidebar en inglés y tema distinto.
- **Variables de entorno (Production):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Después de cambiar variables o Root Directory:** hacer **Redeploy** (no solo guardar).

## Qué tiene esta versión

| Aspecto | Detalle |
|--------|---------|
| **Layout** | Una sola: **SAPLayout**. Todas las páginas internas lo usan. |
| **Idioma** | Español por defecto. Menú y textos desde `lib/i18n.ts`. Selector ES/EN en Presupuestos (y donde se añada) persiste en `localStorage`. |
| **Sidebar** | En español: Panel, Presupuestos, Familia, Mi Presupuesto Personal, Transacciones, Concentrado Presupuesto, Resumen por entidad, Recibos, Importar Excel, Registros de Usuario, Reportes, Categorías Personalizadas, Log de Actividad, (Usuarios si admin). |
| **Tema** | Verde Domus: `app/globals.css` — `--color-sap-primary`, `--color-sap-sidebar`, `.sap-sidebar`, etc. |
| **Modal Crear presupuesto** | Body con scroll bloqueado cuando está abierto; z-index 100; mensaje claro si no hay integrantes en la familia (enlace a Familia); categorías sin subcategorías usan la categoría como subcategoría para poder continuar. |

## Cómo comprobar que estás en esta versión

1. **Sidebar en español** — Si ves "Dashboard", "Budgets", "Summary", "Records", "Categories", "Activity" → **no** es esta versión (estás con build antiguo o Root Directory incorrecto).
2. **Sidebar verde** — Barra lateral verde (#0d7d4a). Si es gris/negro → tema o build antiguo.
3. **Barra "Domus Fam · Gestión familiar"** — Debajo del header; si no aparece, el layout no es el actual.
4. **Crear presupuesto** — Al abrir el modal, la página de fondo no hace scroll; si no hay integrantes en la familia, se muestra mensaje y enlace a Familia.

## Archivos clave

- `components/SAPLayout.tsx` — Layout único (sidebar + header + contenido).
- `lib/i18n.ts` — Traducciones ES/EN; nav en español incluye "Panel" para dashboard.
- `app/globals.css` — Paleta sap-* y tema verde.
- `app/budgets/page.tsx` — Modal crear presupuesto (scroll lock, mensaje sin integrantes, subcategoría por defecto).

## No usar

- **AppLayout** (`components/AppLayout.tsx`) — Menú en inglés fijo. Ninguna página debe importarlo; se dejó por referencia por si se quiere una variante “negro”/EN más adelante.

## Si algo sigue en inglés o tema distinto

1. Confirmar en Vercel que **Root Directory** = `frontend`.
2. Hacer **Redeploy** del último commit (Deployments → ⋮ → Redeploy).
3. Probar en ventana de incógnito o tras borrar caché para descartar caché del navegador.
