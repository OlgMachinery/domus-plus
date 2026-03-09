# Sugerencias de mejora para DOMUS

Resumen de mejoras priorizadas según lo visto en el código y la documentación. No están implementadas; son propuestas para decidir qué hacer después.

---

## Alta prioridad (impacto en uso diario)

### 1. Unirse a una familia con código o enlace
**Situación:** El registro siempre crea una familia nueva. Quien quiera entrar a una familia existente depende de que un admin lo agregue en Usuarios (y le pase email/contraseña).

**Sugerencia:** Añadir flujo “Unirse a familia”:
- El admin genera un **código o enlace de invitación** (con caducidad opcional).
- En registro (o pantalla dedicada), opción “Ya tengo un código” donde se ingresa el código o se abre el enlace.
- El backend valida el código y crea/actualiza `FamilyMember` sin necesidad de que el admin introduzca email/contraseña del invitado.

**Referencia:** `docs/USUARIOS_GENERACION_Y_ADMINISTRACION.md` (nota final).

---

### 2. Recuperar contraseña
**Situación:** No hay flujo de “Olvidé mi contraseña” (restablecer por email).

**Sugerencia:** Implementar reseteo por email (token en enlace, válido 1–24 h) y página “Nueva contraseña”. Requiere enviar correo (SMTP o servicio tipo Resend/SendGrid).

---

### 3. Avisar al invitado por email o WhatsApp
**Situación:** Al agregar un usuario desde Usuarios, el invitado no recibe notificación; debe enterarse por otro canal.

**Sugerencia:** Opcionalmente enviar un correo o mensaje por WhatsApp con texto tipo: “Te agregaron a la familia [nombre] en DOMUS. Entra en D+ [url] con tu correo y contraseña.” Reduce fricción y soporte.

---

## Media prioridad (experiencia y consistencia)

### 4. Onboarding tras el primer registro
**Situación:** Tras registrarse se redirige a setup/objects; no hay un recorrido guiado “qué es DOMUS, partidas, categorías, primer gasto”.

**Sugerencia:** Un flujo corto (3–5 pasos) o tooltips en la primera visita: “Crea tu primera partida”, “Sube un comprobante”, “Revisa Transacciones”. Opcional: marcar “onboarding completado” para no repetir.

---

### 5. Estados vacíos y mensajes claros
**Situación:** Algunas listas o filtros muestran “0 de N” o mensajes genéricos.

**Sugerencia:** Revisar vistas (Transacciones, Solicitudes, Presupuesto, Reportes) y definir textos y una acción concreta cuando no hay datos (ej. “Aún no hay transacciones. Registra tu primer gasto con comprobante.” + botón al wizard).

---

### 6. Calendario unificado
**Situación:** Existe `docs/CALENDARIO_UNIFICADO_PROPUESTA.md` con una propuesta de calendario.

**Sugerencia:** Priorizar si el calendario es parte del producto en corto plazo; si sí, seguir esa propuesta e integrar eventos con transacciones/solicitudes donde aplique.

---

## Mejoras técnicas y mantenimiento

### 7. Variables de entorno documentadas
**Sugerencia:** Un único `docs/ENV_VARS.md` (o sección en MANTENIMIENTO_SISTEMA) con todas las variables usadas en domus-beta-dbe: `DATABASE_URL`, `JWT_SECRET`, `TWILIO_*`, `DOMUS_APP_URL`, `DO_SPACES_*`, etc., indicando cuáles son obligatorias para producción y para desarrollo.

---

### 8. Tests críticos
**Situación:** El proyecto crece; cambios en auth, familias o transacciones pueden romper flujos sin detección automática.

**Sugerencia:** Añadir tests (p. ej. Jest + React Testing Library o Playwright) para: login/registro, agregar integrante (admin), crear transacción desde recibo, confirmar recibo. Aunque sean pocos, cubren los flujos más sensibles.

---

### 9. Accesibilidad (a11y)
**Sugerencia:** Revisar al menos: etiquetas en formularios (`label` + `id`), contraste de botones/avisos, orden de foco en modales y teclado (Enter para enviar, Escape para cerrar). Los modales ya usan `aria-modal` y `aria-label` en varios sitios; extender ese criterio al resto de pantallas.

---

### 10. Dividir la UI (page.tsx)
**Situación:** `domus-beta-dbe/src/app/ui/page.tsx` es muy grande (miles de líneas), lo que dificulta mantener y revisar flujos.

**Sugerencia:** Ir extrayendo vistas o bloques a componentes (p. ej. `TransactionDetailView`, `ReceiptWizard`, `UsersView`, `BudgetView`) y dejar en `page.tsx` sobre todo estado global, rutas de vista y composición. Se puede hacer por fases (una vista por iteración).

---

## Operación y despliegue

### 11. Health check y versión en producción
**Situación:** Existe `/api/build-info` para comprobar versión tras deploy.

**Sugerencia:** Mantener un health check (p. ej. `/api/health` que compruebe DB y opcionalmente Twilio/Storage) y, si usas monitoreo, alertar si falla o si la versión no coincide con la esperada tras un deploy.

---

### 12. Backup y recuperación
**Sugerencia:** Documentar en `MANTENIMIENTO_SISTEMA.md` (o doc dedicado) cómo hacer backup de la base de datos y cómo restaurar en caso de fallo, y con qué frecuencia se recomienda (diario/semanal según criticidad).

---

## Resumen por prioridad

| Prioridad | Mejora |
|-----------|--------|
| **Alta** | Invitación a familia (código/enlace), recuperar contraseña, notificar al invitado (email/WhatsApp) |
| **Media** | Onboarding, estados vacíos, calendario unificado |
| **Técnica** | ENV documentadas, tests críticos, a11y, dividir page.tsx |
| **Operación** | Health check, backup/restore documentado |

Si indicas por cuál quieres empezar (usuarios, auth, UI o operación), se puede bajar a tareas concretas y a cambios de código paso a paso.
