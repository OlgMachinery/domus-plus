# Tests en domus-beta-dbe

El proyecto no incluye aún una suite de tests automatizada. Para añadir tests críticos se recomienda:

1. **Instalar dependencias:** `npm i -D jest @types/jest ts-node` (y opcionalmente `@testing-library/react` para componentes).
2. **Configurar Jest** en `jest.config.js` o `package.json` (moduleNameMapper para alias `@/`, testEnvironment `node` para API routes).
3. **Tests sugeridos:**
   - **API:** `GET /api/health` devuelve 200 y `db: 'connected'`.
   - **API:** `POST /api/auth/register` con body válido crea usuario y familia (y falla con email duplicado).
   - **API:** `POST /api/auth/login` con credenciales correctas devuelve ok.
   - **API:** `GET /api/families/invites/validate?code=XXX` con código inexistente devuelve 404.
4. **Ejecución:** `npm test` tras añadir el script en `package.json`: `"test": "jest"`.

Para comprobar el health sin Jest: con la app en marcha, `curl -s http://localhost:3000/api/health | jq`.
