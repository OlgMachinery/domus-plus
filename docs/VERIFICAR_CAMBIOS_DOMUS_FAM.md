# Cómo verificar que los cambios están aplicados en domus-fam.com

## 1. Desplegar de nuevo

Siempre desde la **raíz** del repo (**domus-plus**), no desde `domus-beta-dbe`:

```bash
cd /Users/gonzalomontanofimbres/domus-plus
SSH_OPTS="-i $HOME/.ssh/id_ed25519_domus" ./deploy-domus-fam.sh --host 187.77.16.4 --chown deploy
```

- **Sin SSH key:** si pide contraseña y luego sale `Permission denied (publickey,gssapi-keyex,...)`, usa la clave: `SSH_OPTS="-i $HOME/.ssh/id_ed25519_domus"` (o la ruta de tu clave privada).
- Si al final del deploy el script dice **HTTP 503** en build-info: es normal justo después del restart. Espera **30–60 segundos** y abre https://domus-fam.com/api/build-info en el navegador; debería devolver 200.
- Si quieres desplegar **desde dentro de domus-beta-dbe**, el comando es `./deploy/deploy-vps.sh --host 187.77.16.4 --chown deploy` (y conviene exportar `SSH_OPTS` igual si usas clave). Desde raíz es preferible `./deploy-domus-fam.sh` para no equivocarse de carpeta.

---

## 2. Confirmar que el deploy es el correcto

1. Abre en el navegador: **https://domus-fam.com/api/build-info**
2. Debe devolver JSON con algo como:
   - `"version": "2026-03-06-entorno-usuario"`
   - `"project": "domus-beta-dbe"`

Si ves otra `version` (por ejemplo `2026-02-26-reticula-teal`), el sitio sigue con el build anterior: hay que desplegar de nuevo o revisar que el deploy se hizo desde **domus-plus** (y que el código en tu máquina es el actual).

---

## 3. Ver la app sin caché

- Abre **https://domus-fam.com** (o **https://domus-fam.com/ui** si es tu ruta de entrada) en una **ventana de incógnito** (o Ctrl+Shift+R para recarga forzada).
- Inicia sesión si hace falta.

---

## 4. Dónde ver cada cambio

| Cambio | Dónde verlo |
|--------|-------------|
| **Ver como [usuario]** | Menú **Usuarios** → en cada fila de la tabla hay un botón **"Ver como [nombre]"** o **"Ver como yo"**. Solo si eres **Admin**. Al hacer clic, aparece la barra amarilla arriba: "Viendo sesión como: …" y "Salir de ver como". |
| **Avatar** | **Usuarios** → columna **Avatar** (foto o círculo "?"). En **tu** fila, botón **"Subir avatar"**. En el header de la app, al lado de "Perfil", puede salir tu foto si ya subiste avatar. |
| **Solo mis partidas** | Menú **Presupuesto** → abre el panel/modal de Presupuesto. Si **no** eres Admin, debes ver el texto "Tu usuario no es Admin…" y un **checkbox "Solo mis partidas"**. Al marcarlo se recargan solo las partidas donde eres responsable. |
| **Sugerir ajuste** | Mismo bloque de Presupuesto (no admin): botón **"Sugerir ajuste al presupuesto"**. Al hacer clic, formulario (tipo + texto) y **Enviar**. Si eres Admin: botón **"Ver sugerencias"** y lista con Aprobar/Rechazar. |

---

## 5. Si sigue sin verse

- **build-info** muestra ya `2026-03-06-entorno-usuario` pero en la app no ves los botones:
  - Prueba en **incógnito** (caché del navegador).
  - Confirma que entras por **https://domus-fam.com** (no otro dominio o localhost).
- **build-info** sigue con una versión antigua:
  - El deploy no está llegando al servidor que sirve domus-fam.com. Ejecuta el comando de deploy desde **domus-plus** con `SSH_OPTS` y revisa que no haya errores en la salida.
  - En la VPS, el código está en `/srv/domus/app` y el servicio es `domus-beta`. Si tienes SSH: `systemctl status domus-beta` y que el **WorkingDirectory** sea ese path.

---

## 6. Cómo hacer el deploy (resumen)

Siempre desde la **raíz del repo** (`domus-plus`):

```bash
cd /Users/gonzalomontanofimbres/domus-plus
SSH_OPTS="-i $HOME/.ssh/id_ed25519_domus" ./deploy-domus-fam.sh --host 187.77.16.4 --chown deploy
```

- **Host:** si usas otro IP/host, cambia `187.77.16.4` o define `export DOMUS_VPS_HOST=tu_ip` y ejecuta `./deploy-domus-fam.sh --chown deploy`.
- **Clave SSH:** si no usas `id_ed25519_domus`, pon la ruta de tu clave privada en `SSH_OPTS`.
- Al terminar, el script comprueba `https://domus-fam.com/api/build-info`. Si sale 503, espera ~1 minuto y vuelve a abrir esa URL; cuando dé 200, el sitio ya está actualizado.
