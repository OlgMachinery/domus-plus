# Deploy a producción (domus-fam.com)

Pasos para subir los cambios a **domus-fam.com**. El sitio se sirve desde una **VPS**; el script hace rsync, build y reinicio del servicio.

---

## ¿Por qué ya no es “un link y la contraseña”?

Antes **domus-fam.com** (o la preview) se desplegaba con **Vercel**: abrías un link, ponías tu contraseña de Vercel y hacías **Redeploy**. Eso ya no se usa para domus-fam.com: el sitio está en una **VPS** y el deploy se hace desde tu Mac con el script (rsync + build en el servidor). Por eso ahora son comandos en la terminal y tu **llave SSH** (no la contraseña de Vercel).

Si en algún momento usas **Vercel** para otra URL (por ejemplo **domus-plus.vercel.app**), ahí sí sigue siendo: abrir **https://vercel.com** → tu proyecto → **Deployments** → ⋯ → **Redeploy** (y poner tu contraseña al entrar en Vercel).

---

## 1. Dejar el código listo

```bash
cd /Users/gonzalomontanofimbres/domus-plus
git add .
git status   # revisa qué vas a subir
git commit -m "Tu mensaje"
git push origin main   # opcional; el deploy no depende del push
```

---

## 2. Ejecutar el deploy a la VPS

Desde la **raíz del repo**:

```bash
cd domus-beta-dbe

export DOMUS_VPS_HOST=187.77.16.4
export DOMUS_DEPLOY_USER=deploy
SSH_OPTS="-i $HOME/.ssh/id_ed25519_domus" ./deploy/deploy-vps.sh --chown deploy
```

- **Importante:** el script debe ejecutarse **desde dentro de `domus-beta-dbe`** (hace rsync del directorio actual).
- Si ya tienes `DOMUS_VPS_HOST` y `DOMUS_DEPLOY_USER` en tu entorno, basta con:
  ```bash
  cd domus-beta-dbe
  SSH_OPTS="-i $HOME/.ssh/id_ed25519_domus" ./deploy/deploy-vps.sh --chown deploy
  ```
- Ajusta la ruta de la llave SSH si usas otra (`id_ed25519_domus` → tu clave).

---

## 3. Comprobar

1. **Versión desplegada**  
   Abre: **https://domus-fam.com/api/build-info**  
   El campo `version` debe coincidir con el del repo (p. ej. en `domus-beta-dbe/src/app/api/build-info/route.ts`).

2. **Página principal / UI**  
   Abre **https://domus-fam.com** (o la ruta que hayas cambiado) en una **ventana de incógnito** para evitar caché.

3. Si algo falla (503, login, etc.): ver `docs/MANTENIMIENTO_SISTEMA.md` (sección “Si algo falla tras el deploy”).

---

## Resumen rápido

| Paso | Comando / acción |
|------|-------------------|
| 1 | `cd domus-beta-dbe` |
| 2 | `export DOMUS_VPS_HOST=187.77.16.4` y `export DOMUS_DEPLOY_USER=deploy` |
| 3 | `SSH_OPTS="-i $HOME/.ssh/id_ed25519_domus" ./deploy/deploy-vps.sh --chown deploy` |
| 4 | Comprobar **https://domus-fam.com/api/build-info** y la web en incógnito |

---

## Referencias

- **Mantenimiento y problemas:** `docs/MANTENIMIENTO_SISTEMA.md`
- **Detalle del deploy y validación:** `docs/VERIFICAR_DEPLOY_DOMUS_FAM.md`
