# Propuesta: Agente de IA para DOMUS

## ¿Se puede integrar?

Sí. Un agente de IA puede convivir con el flujo actual de WhatsApp (recibos, solicitudes, reasignaciones) y ampliarlo sin sustituirlo.

## Dónde encaja

1. **Webhook WhatsApp**  
   Si el mensaje no es ayuda, no es imagen/PDF, no es reasignación por código ni reply a confirmación, se podría enviar el texto (y opcionalmente el último contexto) a un módulo “agente” que decida:
   - si es una pregunta y responde en lenguaje natural,
   - si es una orden (“registra 500 cine para Sofía”) y la ejecuta,
   - o si no entiende y sugiere escribir *ayuda*.

2. **App web**  
   Un chat o panel “Pregunta a DOMUS” que use la misma API del agente con contexto de la familia (presupuesto, gastos recientes, solicitudes).

## En qué puede ayudar el agente

| Área | Ejemplos |
|------|----------|
| **Consultas** | “¿Cuánto hemos gastado en super este mes?”, “¿Qué solicitudes están pendientes?” |
| **Registro en lenguaje natural** | “Registra 500 pesos de cine para Sofía”, “Anota 1200 de farmacia” |
| **Sugerencias** | “Este recibo parece de supermercado, ¿lo asigno a Comida?” |
| **Recordatorios** | “Recuérdame aprobar la solicitud de Juan” (complementa el recordatorio automático por tiempo) |
| **Resúmenes** | “Resumen de la semana” por WhatsApp o en la app |

## Cómo implementarlo (resumen)

1. **Modelo y contexto**  
   - Usar un LLM (OpenAI, Claude, etc.) con un *system prompt* que describa DOMUS: familias, partidas, categorías, transacciones, solicitudes de efectivo.  
   - Inyectar en cada turno: familia activa, presupuesto resumido, últimas transacciones/solicitudes (o solo lo necesario para la pregunta).

2. **Acciones**  
   - El agente devuelve “solo texto” o “acción + parámetros” (por ejemplo `register_expense`, `list_pending_requests`).  
   - El backend ejecuta la acción (crear transacción, listar solicitudes) y opcionalmente devuelve un resumen para que el agente lo formule en lenguaje natural.

3. **WhatsApp**  
   - En el webhook, después de descartar imagen/PDF/código/ayuda/reply, llamar al servicio del agente con el cuerpo del mensaje y el `familyId` (y si se guarda contexto, el thread o userId).  
   - Enviar la respuesta del agente por Twilio (o devolverla en TwiML).

4. **Límites**  
   - No exponer datos de otras familias.  
   - Validar y acotar las acciones (solo lectura o solo las que el rol permita).  
   - Límite de tokens/coste por usuario o por familia para evitar abusos.

## Siguiente paso

- **Fase mínima:** Un endpoint `POST /api/chat/agent` que reciba `{ message, familyId, userId }`, construya contexto reducido (por ejemplo: totales del mes, últimas 5 transacciones), llame al LLM y devuelva `{ reply }`.  
- Luego en el webhook de WhatsApp, cuando el mensaje no coincida con ningún flujo existente, llamar a ese endpoint y responder con la `reply` del agente.

Referencia: flujos actuales en `docs/PROPUESTA_SOLICITUD_DINERO_DOMUS.md` y `domus-beta-dbe/src/app/api/whatsapp/webhook/route.ts`.
