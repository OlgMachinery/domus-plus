# Clasificación y "educación" de DOMUS (WhatsApp)

Documento de referencia: cómo clasifica el sistema y cómo ir afinando (educar) para que los gastos caigan bien y después se puedan poner límites.

---

## Comportamiento actual

### 1. Al registrar un recibo (foto/PDF)
- La **IA** sugiere categoría a partir del comercio y el texto del recibo, usando las categorías reales de la familia.
- Si ninguna encaja, la IA puede proponer una **categoría nueva** (ej. "Repostería y pasteles"); el admin recibe un mensaje y puede responder *sí* o *adhierela* para crearla.
- Además hay un **mapa fijo** (concepto → categoría): farmacia, medicina, medicinas → Salud; repostería, pastel, kuchon → Comida; CFE, luz → Servicios; etc. Ver `domus-beta-dbe/src/app/api/whatsapp/webhook/route.ts` (`CONCEPT_TO_CATEGORY`).

### 2. Al reasignar respondiendo al mensaje de confirmación
- **Solo cambias la persona** (ej. "Para Mateo"): se **mantiene la categoría actual** y solo se cambia la partida a la persona indicada. Ej.: recibo Farmacia → Mamá; respondes "Para Mateo" → queda Mateo / Farmacia (no Mateo / Colegiaturas).
- **Indicas categoría y persona** (ej. "medicina Mateo", "cumpleaños Sofía"): se buscan partida y categoría que encajen. "medicina" → Salud, "cumpleaños" → Eventos familiares.
- Por **clave** (ej. "E-OEBQ medicina Mateo"): mismo criterio de categoría + entidad.

### 3. Cómo "educar" hoy
- Escribir **conceptos que ya están en el mapa**: "medicina Mateo", "cine Sofía", "super Mamá". El mapa tiene medicina, cine, super, farmacia, etc.
- Si hace falta una **categoría nueva**, la IA puede sugerirla al procesar un recibo; el admin la aprueba por WhatsApp y queda disponible.
- El **asistente** (mensajes en lenguaje natural) explica que pueden responder "para [nombre]" (solo persona) o "medicina Mateo" / "cumpleaños Sofía" (categoría + persona).

---

## Próximos pasos posibles (mecanismo más fino)

1. **Preferencias por familia ("aprendizaje")**  
   Guardar, por familia, que "farmacia + Mateo" prefiere categoría Salud, o que cierto comercio suele ir a Comida. Al clasificar o reasignar, usar esas preferencias antes que el mapa global. Requeriría una tabla (ej. `family_category_preference`) y usarla en el webhook.

2. **Límites por partida**  
   En el esquema ya existe `monthlyLimit` en `EntityBudgetAllocation`. La app puede mostrar y editar esos límites; el sistema podría avisar por WhatsApp cuando una partida se acerque o supere el límite (cron o al registrar gasto).

3. **Sugerencias de la IA al reasignar**  
   Si el usuario responde "medicina para Mateo" en lugar de "medicina Mateo", la IA podría seguir interpretando categoría Salud + entidad Mateo (el mapa ya incluye "medicina" → Salud).

---

## Recomendaciones para ampliar la educación

Ordenadas por impacto y viabilidad. Cada una se puede implementar por separado.

### 1. Aprender del comercio (merchant → categoría por familia)
**Qué:** La primera vez que un recibo de "Farmacias del Ahorro" se asigna a Farmacia (o se reasigna así), guardar para esa familia: "Farmacias del Ahorro" (o nombre normalizado) → categoría Farmacia. En el siguiente recibo del mismo comercio, usar esa preferencia antes que el mapa global o la IA.  
**Dónde:** Tabla `family_merchant_category` (familyId, merchantNameNorm, categoryId, createdAt). En `processReceiptFromImageBytes` y en `findAllocationWithDetails`: si hay match por comercio en esa familia, priorizar esa categoría.  
**Beneficio:** Cada familia afina sin tocar código: Ahorro → Farmacia, Oxxo → Super/Comida, etc.

### 2. Aprender de las reasignaciones (correcciones = regla)
**Qué:** Cuando el usuario **cambia la categoría** al reasignar (no solo la persona), interpretar que "así es como quieren este tipo de gasto". Ej.: recibo clasificado como Casa, usuario reasigna a "medicina Mateo" → guardar para la familia que "este comercio/concepto" debe poder mapear a Salud + Mateo, o al menos que Salud es preferido para ese tipo.  
**Dónde:** En `handleReplyToReceiptConfirmation`, si `prevCategory !== allocation.categoryName`, opcionalmente guardar (familyId, merchantOrConcept, categoryId o categoryName) en una tabla de preferencias. Luego, al clasificar un recibo nuevo, consultar esas preferencias.  
**Beneficio:** El sistema se corrige solo con el uso: cada corrección refuerza la regla para el futuro.

### 3. Comando explícito "enseñar" por WhatsApp
**Qué:** El admin puede escribir algo como: *"aprende: farmacia del ahorro es salud"* o *"cuando diga medicina para Mateo usa categoría Farmacia"*. El webhook detecta el patrón, guarda la regla en la tabla de preferencias y responde "Listo, lo tendré en cuenta."  
**Dónde:** Nuevo flujo en el webhook (antes del agente): si el mensaje coincide con "aprende: X es Y" o similar, parsear X e Y, guardar en `family_merchant_category` o en una tabla de frases → categoría, y responder confirmación.  
**Beneficio:** Educación explícita sin depender de un recibo; útil para comercios que aún no han aparecido.

### 4. Sinónimos por familia
**Qué:** Permitir a la familia añadir sus propios "conceptos" que mapean a una categoría existente. Ej.: "ahorro" → Farmacia, "soriana" → Supermercado, "netflix" → Suscripciones. El mapa global sigue; además se consulta un mapa por familia.  
**Dónde:** Tabla `family_concept_category` (familyId, conceptNorm, categoryName o categoryId). En `resolveCategoryHint` (o una versión por familia), fusionar el mapa global con el de la familia (la familia puede sobreescribir o sumar).  
**Beneficio:** Vocabulario de la casa (marcas, apodos, nombres de tiendas) sin tocar código.

### 5. Confirmar cuando hay historial ("¿Igual que la vez pasada?")
**Qué:** Si ya existe preferencia guardada para ese comercio o concepto, antes de asignar automáticamente enviar: "Sueles asignar [Farmacias del Ahorro] a Farmacia. ¿Lo asigno igual? Responde sí o indica otra categoría/persona." Opcional y se puede activar solo para admin o para todos.  
**Dónde:** Tras obtener la sugerencia de categoría (IA o mapa), si hay una preferencia guardada para ese merchant en la familia, enviar ese mensaje de confirmación y esperar respuesta (o timeout y aplicar la preferencia).  
**Beneficio:** Menos errores y sensación de control; refuerza el aprendizaje si confirman.

### 6. Resumen de uso para el admin
**Qué:** Mensaje periódico o bajo demanda: "Esta semana asignaste X veces Farmacia a Mateo, Y veces Comida a Casa… ¿Quieres que guarde estas como reglas por defecto?" con botones o "sí / no".  
**Dónde:** Cron o comando "resumen reglas" que analice transacciones recientes por familia, agrupe (entidad + categoría) y ofrezca guardar las más frecuentes como preferencias.  
**Beneficio:** Aprendizaje por patrones sin que el usuario tenga que "enseñar" cada caso.

---

**Orden sugerido de implementación:** 1 (merchant → categoría) y 2 (aprender de reasignaciones) dan el mayor retorno con una sola tabla de preferencias. Luego 3 (comando "aprende") y 4 (sinónimos por familia). 5 y 6 son refinamientos.

---

## Archivos relevantes

| Qué | Dónde |
|-----|--------|
| Mapa concepto → categoría | `domus-beta-dbe/src/app/api/whatsapp/webhook/route.ts` → `CONCEPT_TO_CATEGORY` |
| Lógica "mantener categoría si solo persona" | `handleReplyToReceiptConfirmation` en el mismo webhook |
| IA que sugiere categoría o nueva | `domus-beta-dbe/src/lib/agent/domus-agent.ts` → `suggestCategoryForReceipt` |
| Sugerencias de categoría nueva y aprobación admin | Webhook: `CategorySuggestion`, `handleReplyToCategorySuggestion` |
