# DOMUS+ Beta DBE — Architecture Status v0.1

## Stack
- **Runtime**: Node.js (Next.js)
- **Framework**: **Next.js 16** (App Router)
- **Auth**: JWT (`jose`) + hashing (`bcryptjs`)
- **DB/ORM**: SQLite + Prisma (Prisma Client generado en `src/generated/prisma`)
- **Storage (recibos)**: DigitalOcean Spaces (S3 compatible) vía AWS SDK

## Router & API
- **UI**: `src/app/ui/page.tsx`
- **API**: route handlers en `src/app/api/**/route.ts`
- **Health**: `GET /api/health` verifica conectividad Prisma/SQLite

## DB config (SQLite + Prisma)
- **Schema**: `prisma/schema.prisma`
- **DATABASE_URL**: `file:./prisma/dev.db` (local)
- **Archivos DB**:
  - `prisma/dev.db`
  - `prisma/dev.db-wal`
  - `prisma/dev.db-shm`

### Estrategia de concurrencia (Beta)
Se aplican PRAGMAs al iniciar la conexión (best-effort):
- `journal_mode=WAL` (mejor concurrencia para lecturas/escrituras)
- `busy_timeout=5000` (espera ante locks en vez de fallar de inmediato)
- `foreign_keys=ON`

**Dónde**: `src/lib/db/prisma.ts` (función `ensureSqlitePragmas()`).

## Limitaciones de SQLite (en producción/beta)
- **Concurrencia limitada** vs Postgres (aunque WAL ayuda).
- **Un solo archivo**: requiere backups y cuidado con I/O del disco.
- **Escalamiento**: funciona bien para beta pequeña, pero no para alta concurrencia.

## Decimal en SQLite (Prisma)
- Prisma expone `Decimal` como tipo de alta precisión.
- En endpoints/JSON se debe **serializar** a `string` (ej. `decimal.toString()`), ya que JSON no soporta `Decimal` nativo.
- En escrituras, Prisma acepta strings numéricas para campos `Decimal`.

## Postgres-ready (migración futura)
Para una migración ordenada a Postgres:
- Mantener el **scoping multi-tenant** por `familyId` en backend (ya existe).
- Adoptar estrategia de **migraciones** (`prisma migrate`) para historial controlado.
- Revisar índices y constraints para cargas reales.
- Revisar almacenamiento de recibos (Spaces) y URLs firmadas (ya es S3-compatible).

