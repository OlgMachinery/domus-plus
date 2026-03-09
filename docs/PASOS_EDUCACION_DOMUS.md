# Pasos para tener “educación” de DOMUS en producción

Los cambios de código (aprender del comercio y de las reasignaciones) ya están en el repo. Para que funcionen en **domus-fam.com** solo hace falta desplegar y comprobar.

---

## Lo que tú tienes que hacer

### 1. Desplegar a la VPS

Desde la **raíz del repo** (`domus-plus`):

```bash
SSH_OPTS="-i $HOME/.ssh/id_ed25519_domus" ./deploy-domus-fam.sh --host 187.77.16.4 --chown deploy
```

(Sustituye `id_ed25519_domus` por el nombre de tu clave SSH si usas otra.)

- El script sube el código, hace `npm ci`, `npm run build`, **`prisma db push`** (crea la tabla `family_category_preferences` en la DB de la VPS) y reinicia el servicio.
- No hace falta que ejecutes `prisma` a mano en el servidor.

### 2. Comprobar que llegó el deploy

- **Versión:** abre **https://domus-fam.com/api/build-info** y revisa que el `version` coincida con el de tu repo (o con la fecha del último commit).
- **Página:** abre **https://domus-fam.com** en **incógnito** por si hubiera caché.

### 3. Probar la educación (opcional)

- Envía un recibo por WhatsApp y clasifícalo (o reasigna uno cambiando categoría).
- En el siguiente recibo del **mismo comercio**, DOMUS debería usar la categoría aprendida sin preguntar de nuevo.

---

## ¿El sistema va aprendiendo? ¿Cómo lo sabremos?

**Sí, va aprendiendo solo:**

- Cada vez que se **clasifica un recibo** (por IA o reglas), se guarda: comercio → categoría.
- Cada vez que **reasignas** un recibo y **cambias la categoría**, se guarda: comercio → nueva categoría.

**Cómo te enteras:**

- Cuando DOMUS aprende una **preferencia nueva** (un comercio que no tenía guardado), el **admin** recibe un mensaje por WhatsApp, por ejemplo:
  - *"DOMUS aprendió: "farmacia del ahorro" → Salud. Los próximos recibos de ese comercio irán ahí."*
- Si ese comercio ya estaba aprendido y solo se actualiza, no se envía mensaje (para no saturar).
- En la práctica: el primer recibo de "Farmacia X" puede pedir confirmación; cuando lo clasificas (o reasignas), recibes el mensaje de que aprendió; el siguiente recibo de "Farmacia X" ya irá directo a esa categoría.

---

## Resumen

| Qué | Dónde / Cómo |
|-----|----------------|
| Código de educación | Ya está en `domus-beta-dbe` (webhook, preferencias, reasignación). |
| Tabla en producción | Se crea sola al hacer deploy (el script ejecuta `prisma db push` en la VPS). |
| Tu acción | **Solo desplegar** con el comando de arriba y, si quieres, comprobar build-info y probar un recibo. |

Si el deploy falla por SSH, revisa la sección “Si algo falla tras el deploy” en **docs/MANTENIMIENTO_SISTEMA.md**.
