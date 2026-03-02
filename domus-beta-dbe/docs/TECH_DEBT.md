# TECH_DEBT (DOMUS+ Beta DBE)

Este archivo documenta deuda técnica detectada durante la fase de estabilización (S1).

## Next.js 16 — `middleware.ts` deprecado
- **Contexto**: Next 16 muestra warning indicando que la convención `middleware.ts` está deprecada y recomienda usar `proxy`.
- **Decisión S1**: se eliminó `src/middleware.ts` y se movió la configuración de headers a `next.config.ts` usando `headers()` para evitar caché en `/ui`.
- **Pendiente / investigación**: evaluar si vale la pena adoptar `proxy` (según documentación oficial) cuando se requieran reglas más complejas que `headers()`.

## Monorepo — múltiples lockfiles
- **Contexto**: existe más de un `package-lock.json` en el workspace (repo padre + `domus-beta-dbe`), lo cual puede confundir a Next/Turbopack al inferir el root.
- **Mitigación S1**: se fija `turbopack.root` en `next.config.ts` al directorio de `domus-beta-dbe`.
- **Pendiente**: definir estrategia definitiva:
  - mantener `domus-beta-dbe` como proyecto independiente, o
  - convertir a workspace con un lockfile único (si el repo lo necesita).

## Prisma/SQLite — migraciones
- **Contexto**: la evidencia actual apunta a uso de `prisma db push` (no hay `prisma/migrations` ni tabla `_prisma_migrations`).
- **Riesgo**: cambios de esquema sin historial controlado.
- **Pendiente**: cuando el beta estabilice, definir si se adopta `prisma migrate` para cambios futuros.

