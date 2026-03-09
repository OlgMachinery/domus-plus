# Entorno de usuario y permisos — DOMUS+

Especificación del **entorno de usuario** (no admin): qué puede hacer, qué puede personalizar y qué queda solo para el admin. Sirve como referencia para producto, diseño e implementación.

**Relacionado:** `docs/QUE_VE_CADA_USUARIO.md` (estado actual por vista).

---

## 1. Principio

- **Usuario (no admin):** máxima personalización **en su espacio** sin cambiar la estructura ni la configuración de la familia.
- **Admin:** define partidas, categorías, montos y miembros; el usuario **ve** y **usa** su parte y puede **sugerir** y **organizar en su entorno**.

---

## 2. Qué puede hacer el usuario (lista de acceso)

### 2.1 Dashboard y reportes
| Acción | Detalle |
|--------|--------|
| Ver dashboard | Resumen, gastado, disponible, alertas, KPIs, gráficas. |
| Obtener reportes | Reportes de consumo, resúmenes, tablas; filtros por cuenta, categoría, persona, rango. Solo lectura. |

### 2.2 Presupuesto (solo “su” parte)
| Acción | Detalle |
|--------|--------|
| Ver presupuesto | Ver **sus cuentas** (partidas/montos donde él es titular o asignado). Ver límites y gastado. |
| No modificar estructura | No crear/editar/eliminar partidas, categorías ni montos a nivel familia. |
| Sugerir ajustes | Enviar sugerencias al admin (subdividir categoría, cambiar límite, nueva categoría). Solo el admin aplica. |
| Subdividir en su entorno | Dentro de **sus** partidas/categorías, crear sub-cuentas o etiquetas **personales** (ej. Comida → Super, Restaurantes, Delivery). Solo para su vista y sus reportes; no cambia la estructura familiar. |

### 2.3 Transacciones y recibos
| Acción | Detalle |
|--------|--------|
| Ver transacciones | Lista de gastos de la familia (o filtrada a sus cuentas, según reglas). |
| Registrar sus gastos | Crear gastos (monto, descripción, evidencia); asignar a partida/categoría según reglas. |
| Subir recibos | Subir fotos de comprobantes y asociarlos a gastos (propios o según asignación). |
| No editar/eliminar ajenos | No modificar ni borrar gastos de otros (solo los propios o según política). |

### 2.4 Solicitudes
| Acción | Detalle |
|--------|--------|
| Crear solicitudes | Solicitudes de efectivo. |
| Ver sus solicitudes | Ver estado de las suyas. |

### 2.5 Perfil y avatar
| Acción | Detalle |
|--------|--------|
| Editar su perfil | Nombre, teléfono, ciudad. |
| Subir su avatar | Foto de perfil (solo su cuenta). |
| Probar Twilio | Enviar prueba a su WhatsApp (si tiene teléfono guardado). |
| Cerrar sesión | Siempre disponible. |

### 2.6 Usuarios y configuración
| Acción | Detalle |
|--------|--------|
| Ver usuarios | Ver lista de miembros (nombre, email, teléfono si aplica). |
| No gestionar miembros | No agregar, eliminar ni cambiar roles. No usar «Ver como». |
| Ver configuración | Ver nombre de familia, moneda. No editar familia ni eliminar cuenta familiar. |

---

## 3. Solo admin (no usuario)

| Acción | Motivo |
|--------|--------|
| Agregar / eliminar usuarios | Gestión de miembros. |
| Cambiar rol (hacer admin) | Evitar escalada de privilegios. |
| Crear/editar/eliminar partidas, categorías, montos | Estructura del presupuesto. |
| Editar/eliminar gastos de otros (según política) | Control y corrección. |
| Editar familia (nombre, moneda, etc.) | Configuración de la familia. |
| Eliminar la familia | Acción irreversible. |
| Ver como otro usuario | Herramienta de soporte. |
| Aprobar sugerencias de ajuste | Las aplica en el presupuesto real. |
| Aprobar categorías sugeridas por IA (ej. WhatsApp) | Decisión sobre estructura. |

---

## 4. Entorno personal del usuario (personalización)

Todo lo siguiente es **solo para su vista y sus datos**; no cambia lo que ve el resto de la familia.

### 4.1 Avatar
- Subir y cambiar su **foto de perfil** (avatar).
- Solo afecta su cuenta; visible donde se muestre el perfil del usuario.

### 4.2 “Mis cuentas”
- **Definición:** partidas y montos (allocations) donde el usuario es el **titular** o está asignado (su entidad en el presupuesto).
- El usuario **solo ve y organiza** su parte; no puede cambiar límites ni estructura global.

### 4.3 Sugerir ajustes (sin cambiar nada)
- El usuario puede **enviar sugerencias** al admin, por ejemplo:
  - “Subdividir categoría X en A y B.”
  - “Aumentar o disminuir el límite de Y.”
  - “Crear categoría Z.”
- **Nada se aplica** en el presupuesto hasta que el **admin** lo apruebe y lo haga.
- Flujo sugerido: botón “Sugerir ajuste” → formulario o mensaje → notificación al admin → admin aplica (o no) en Presupuesto.

### 4.4 Subdividir en su entorno
- Dentro de **sus** partidas/categorías, el usuario puede crear **sub-cuentas** o **etiquetas personales**.
- Ejemplo: bajo “Comida” crea “Super”, “Restaurantes”, “Delivery”.
- Uso:
  - Filtrar **sus** gastos por sub-cuenta.
  - Ver reportes **suyos** por sub-cuenta.
  - (Opcional) Al registrar un gasto, asignar a una sub-cuenta personal; la categoría real de la familia no cambia.
- **No** se crean categorías nuevas en la familia; es organización **solo en su entorno**.

### 4.5 Otras personalizaciones (solo su vista)
- **Apodos** para categorías o partidas (ej. “Comida” → “Mandado”). Solo en su interfaz.
- **Orden preferido** de partidas/categorías en “Mi presupuesto”.
- **Metas o notas** personales por partida (ej. “No pasarme de X este mes”). Solo visibles para él.
- (Opcional) Tema o preferencias de visualización (si se implementan).

---

## 5. Resumen en una frase

**Usuario:** puede obtener reportes, subir su avatar, ver solo “sus cuentas”, sugerir ajustes al presupuesto (que solo aplica el admin), subdividir y organizar en su entorno (sub-cuentas, etiquetas, apodos, orden, metas) y registrar sus gastos y recibos, **sin cambiar** el presupuesto ni la configuración de la familia.

**Admin:** todo lo anterior más estructura (partidas, categorías, montos), miembros, configuración de la familia y “Ver como”.

---

## 6. Implementación sugerida (orden)

Para bajar esto a código y UX:

1. **Permisos en backend**  
   Revisar APIs (presupuesto, familias, usuarios) y asegurar que las acciones “solo admin” rechacen con 403 si el usuario no es admin.

2. **Avatar de usuario**  
   Campo o almacenamiento de foto de perfil por usuario; subida solo para el usuario actual; mostrarla en header/perfil y en Usuarios (su fila).

3. **Vista “Mi presupuesto”**  
   Filtro o vista que muestre solo las partidas/allocations donde el usuario es titular (su entidad). Sin botones de crear/editar/eliminar estructura.

4. **Sugerencias de ajuste**  
   Modelo (ej. `BudgetSuggestion`: usuario, texto o tipo, estado, familia); UI “Sugerir ajuste”; notificación al admin; pantalla o lista para que el admin apruebe o rechace y aplique en Presupuesto.

5. **Sub-cuentas / etiquetas personales**  
   Modelo (ej. `UserBudgetSubdivision`: userId, familyId, categoryId o allocationId, nombre, orden); UI para crear/editar/eliminar solo las propias; usar en filtros y reportes del usuario.

6. **Apodos y orden**  
   Preferencias por usuario (ej. `UserCategoryNickname`, `UserBudgetOrder`); aplicar solo en la vista del usuario.

7. **Metas o notas personales**  
   Modelo (ej. `UserBudgetGoal`: userId, allocationId, meta o nota); solo visibles para el usuario.

---

*Documento de especificación. Actualizar cuando se implementen o cambien funcionalidades.*
