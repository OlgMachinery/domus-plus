# Las dos versiones de DOMUS en el mismo código

En el repo existen **dos UIs** distintas que convivían en la misma app:

## 1. Versión "verde" (Domus Fam)

- **Layout:** `SAPLayout` (`components/SAPLayout.tsx`)
- **Idioma:** i18n con español por defecto (`lib/i18n.ts`), selector ES/EN
- **Estilo:** Tema verde (sidebar verde, botones verdes, clases `sap-*`, "Domus Fam")
- **Páginas que la usaban:** Familia, Usuarios, Importar Excel, Resumen por entidad (budget-overview)

## 2. Versión "negro" / DOMUS+

- **Layout:** `AppLayout` (`components/AppLayout.tsx`)
- **Idioma:** Menú y textos **solo en inglés** (labels fijos: Dashboard, Budgets, Transactions, etc.)
- **Estilo:** Tema neutro/oscuro (D+, DOMUS+, componentes shadcn genéricos)
- **Páginas que la usaban:** Dashboard, Presupuestos, Transacciones, Recibos, Mi Presupuesto Personal, Concentrado Presupuesto, Reportes, Categorías, Log de Actividad, Registros de Usuario

## Por qué se veía en inglés

Las páginas principales (presupuestos, dashboard, transacciones, etc.) usaban **AppLayout**, que tiene el menú lateral en inglés fijo. Aunque el selector decía "ES", el layout no usa el sistema de traducciones.

## Unificación (versión verde en español) — hecha

- **Todas** las páginas internas usan **SAPLayout** (dashboard, presupuestos, transacciones, recibos, mi presupuesto personal, concentrado presupuesto, reportes, categorías personalizadas, log de actividad, registros de usuario, familia, usuarios, importar excel, resumen por entidad).
- El idioma por defecto es **español** (`getLanguage()` en `lib/i18n.ts` devuelve `'es'` si no hay valor en `localStorage`). Al cambiar con el selector (p. ej. en Presupuestos), se guarda en `localStorage` y el menú y textos siguen en el idioma elegido.
- La paleta "Domus verde" está en `app/globals.css` (`--color-sap-primary`, `.sap-sidebar`, etc.).

`AppLayout` sigue en el repo por si se quiere un segundo tema (negro/EN); ya no se usa en ninguna página.
