# Unificación y forma profesional de trabajar

## ¿Se debe unificar?

**Sí, en el sentido de “una fuente de verdad y un flujo claro”.** No hace falta borrar carpetas si aún usas `frontend/` o `app/` para algo; sí hace falta que quede definido qué es producción y dónde se edita.

## Forma profesional recomendada

### 1. Una app = producción (domus-fam.com)

- **App de producción:** `domus-beta-dbe/`
- **Dominio:** domus-fam.com se sirve desde la **VPS**, desplegando esta app con `domus-beta-dbe/deploy/deploy-vps.sh`.
- Todo lo que deba verse en domus-fam.com se **edita solo en domus-beta-dbe/**.

### 2. Página del diagrama: una sola fuente

- **Fuente canónica:** `domus-beta-dbe/src/app/ui/system-architecture/page.tsx`
- **No** editar la misma página en `app/` ni en `frontend/` a mano.
- Si quieres que `app/` y `frontend/` tengan la misma página (por ejemplo para otros entornos), **después** de editar en domus-beta-dbe ejecuta desde la raíz del repo:
  ```bash
  npm run sync:diagram
  ```
  Eso copia el contenido canónico a `app/ui/system-architecture/page.tsx` y `frontend/app/ui/system-architecture/page.tsx`.

### 3. Flujo de trabajo

| Qué quieres hacer | Dónde | Siguiente paso |
|-------------------|--------|----------------|
| Cambios que se vean en **domus-fam.com** | Editar en **domus-beta-dbe/** | Hacer deploy a la VPS con `./deploy/deploy-vps.sh` (desde `domus-beta-dbe/`) |
| Mantener app/ y frontend/ con la misma página del diagrama | Editar en **domus-beta-dbe/** | Luego `npm run sync:diagram` desde la raíz |
| Solo probar en local | Editar en domus-beta-dbe | `npm run dev` dentro de `domus-beta-dbe/` |

### 4. ¿Eliminar app/ y frontend/?

- **No hace falta** si los usas (otro dominio, pruebas, etc.). En ese caso: editar siempre en domus-beta-dbe y usar `sync:diagram` cuando quieras que tengan la misma página.
- **Sí tiene sentido** si **no** desplegáis ni usáis `app/` ni `frontend/` para nada: podrías dejar de sincronizar la página del diagrama ahí (o borrar esas copias de la página) para no tener código duplicado. La “unificación” sería: una sola app de producción (domus-beta-dbe) y cero confusión sobre dónde tocar.

### 5. Resumen

- **Unificar** = una fuente de verdad (domus-beta-dbe para domus-fam.com) y un proceso claro (editar ahí → deploy VPS; opcional: `sync:diagram` si siguen existiendo app/ y frontend/).
- **Forma profesional:** editar solo en domus-beta-dbe para lo que va a producción; documentar que el deploy es por VPS; usar el script de sincronización solo si mantienes varias apps con la misma página.

Ver también:
- **`docs/VERIFICAR_DEPLOY_DOMUS_FAM.md`** — Cómo desplegar y comprobar en la VPS.
- **`docs/MANTENIMIENTO_SISTEMA.md`** — Cómo mantener el sistema sin repetir errores ya resueltos.
