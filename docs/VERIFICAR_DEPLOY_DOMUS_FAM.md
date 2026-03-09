# Verificar deploy en domus-fam.com (domus-beta-dbe)

**domus-fam.com** es el **único** lugar donde se quiere ver la app/diagrama en producción. Se despliega en una **VPS** con el script `domus-beta-dbe/deploy/deploy-vps.sh` (rsync + build + restart). No se usa Vercel. Para aplicar cualquier cambio en domus-fam.com hay que ejecutar ese deploy.

---

## Qué haremos para subir cambios a producción

1. **Código en tu Mac**  
   Los cambios ya están en el repo (commit + push a `main` si quieres tenerlos en GitHub).

2. **Desplegar a la VPS**  
   Desde tu Mac, en la terminal:

   ```bash
   cd /Users/gonzalomontanofimbres/domus-plus/domus-beta-dbe
   export DOMUS_VPS_HOST=187.77.16.4
   export DOMUS_DEPLOY_USER=deploy
   SSH_OPTS="-i $HOME/.ssh/id_ed25519_domus" ./deploy/deploy-vps.sh --chown deploy
   ```

   (Ajusta `DOMUS_VPS_HOST`, `DOMUS_DEPLOY_USER` y la ruta de la llave SSH si usas otros valores. Si ya tienes `DOMUS_VPS_HOST` y la llave configurados, basta con `./deploy/deploy-vps.sh --chown deploy`.)

3. **Comprobar**  
   Cuando termine el script:
   - **https://domus-fam.com/api/build-info** → debe mostrar `"version":"2026-02-26-reticula-teal"` (o la versión actual del repo).
   - **https://domus-fam.com/ui/system-architecture** (en incógnito) → marco teal y retícula.

---

## Para que no vuelva a pasar: checklist

1. **Desplegar desde la carpeta correcta**  
   Ejecuta siempre el script **desde dentro de `domus-beta-dbe`** (el script hace rsync de `.` al servidor).

2. **Protección con “señal”**  
   Tras cada deploy, comprueba **/api/build-info** y, si usas la barra, **?signal=1** en la página del diagrama.

3. **Revisar que el código local es el que quieres**  
   Antes de correr el script, asegúrate de que en `domus-beta-dbe` tienes los últimos cambios (los que quieres ver en producción).

4. **Cachés**  
   Después del deploy, prueba en **incógnito** para evitar caché del navegador.

5. **Documentar**  
   Este doc es la referencia: deploy = script VPS; verificación = build-info + opcional ?signal=1.

---

## Cómo validar que producción = código del repo

### 1. Versión en el repo (tu código actual)

En tu máquina:

```bash
grep -n "BUILD_VERSION" domus-beta-dbe/src/app/api/build-info/route.ts
```

Ese valor (ej. `2026-02-26-reticula-teal`) es la “fuente de verdad”.

### 2. Versión en producción (lo que sirve domus-fam.com)

```bash
curl -s https://domus-fam.com/api/build-info | jq -r '.version'
```

O abre en el navegador: **https://domus-fam.com/api/build-info** y mira el campo `"version"`.

### 3. Comparar

| Situación | Conclusión |
|-----------|------------|
| Producción `version` **=** valor en el repo | Deploy al día. Si la UI no cambia, prueba incógnito (caché). |
| Producción `version` **≠** valor en el repo | Producción tiene un build antiguo. Vuelve a ejecutar el script de deploy desde `domus-beta-dbe`. |

### 4. Comprobar código de la UI en el repo (opcional)

```bash
grep -n "0f766e\|Retícula con letras" domus-beta-dbe/src/app/ui/system-architecture/page.tsx
```

Si ves líneas, el código de marco teal y retícula está en el repo.

---

## Resumen

- **Subir cambios a domus-fam.com:** ejecutar `domus-beta-dbe/deploy/deploy-vps.sh` desde `domus-beta-dbe` (con host, usuario y opcionalmente `--chown deploy`).
- **Verificar:** `/api/build-info` debe devolver la misma `version` que en el repo; la página del diagrama en incógnito debe mostrar la UI nueva (marco teal, retícula).
- Si la versión en producción es antigua, el deploy no se ha hecho o se hizo desde otra carpeta; vuelve a correr el script desde `domus-beta-dbe`.
