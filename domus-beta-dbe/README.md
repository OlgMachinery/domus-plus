# DOMUS+ Beta DBE

Proyecto nuevo (reconstrucción limpia) de DOMUS sin Supabase.

## Ver avances rápido

En desarrollo, abre:
- `http://localhost:3001/ui`

Ahí puedes:
- Crear cuenta / iniciar sesión
- Gestionar familias e integrantes
- Configurar presupuesto (entidades, categorías, montos) y confirmar plan
- Registrar gastos y subir recibos (requiere configurar DigitalOcean Spaces)

## Correr en local

1) Copia `.env.example` a `.env` y ajusta valores.
2) Instala dependencias:

```bash
npm install
```

3) Crea tablas y cliente de Prisma:

```bash
npx prisma generate
npx prisma db push
```

4) Levanta el servidor:

```bash
npm run dev -- -p 3001
```

## Subir a VPS

Lee:
- `docs/FASE6_VPS.txt`

