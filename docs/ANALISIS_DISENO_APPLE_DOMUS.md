# Análisis: diseño tipo Apple/iPhone en DOMUS (sin romper funcionalidad)

Objetivo: identificar colores pastel y elementos que no encajan con el gusto del usuario, y proponer cambios alineados a cómo trabajan los diseñadores de Apple, **solo como sugerencias** antes de implementar.

---

## 1. Cómo piensan los diseñadores de Apple (HIG)

- **Claridad**: el contenido es el protagonista; la UI no compite con él. Tipografía legible, contraste suficiente, jerarquía clara.
- **Deferencia**: el sistema se “retira”; fondos neutros, bordes y sombras sutiles. El color se usa con propósito (estado, acción, énfasis), no como decoración.
- **Profundidad**: capas sutiles (blur, sombras suaves, agrupación visual) para indicar jerarquía sin “pasteles” ni fondos chillones.

En la práctica suelen usar:

- **Fondos**: blanco puro `#FFFFFF` para contenido; grises neutros muy suaves para agrupación (`#F2F2F7` en iOS para grupos, `#E5E5EA` para separadores).
- **Color de sistema**: azul `#007AFF` (enlaces y acciones principales), verde `#34C759` (éxito/confirmar), naranja `#FF9500` (avisos), rojo `#FF3B30` (destructivo/alertas). Tonos sólidos y reconocibles, no pastel.
- **Tipografía**: SF Pro (o `-apple-system` en web): pesos 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold). Tamaños generosos en cuerpo (17px en móvil) y jerarquía por peso, no solo por tamaño.
- **Componentes**: listas agrupadas con fondos muy suaves; botones con relleno sólido o “filled” para primarios; bordes redondeados (10px–12px); sombras muy ligeras o ninguna en listas.
- **Estado y badges**: éxito/aviso/error con color sólido o con fondos muy suaves (p. ej. `rgba(52, 199, 89, 0.12)`) y texto en el color sólido correspondiente, no fondos pastel fuertes.

---

## 2. Dónde están los “pasteles” y tonos suaves en DOMUS

Revisando `tokens.css`, `components.css`, `layout.css`, `dashboard.css`, `reports.css`:

| Ubicación | Uso actual | Sensación “pastel” |
|-----------|------------|--------------------|
| **Fondo global** | `--sap-bg: #f5f6f9` | Gris azulado muy suave; no es pastel fuerte pero puede percibirse “lavado”. |
| **Pills éxito** | `.pillOk`: `#d1fae5` (fondo), `#34d399`, `#065f46` | Verde menta/pastel. |
| **Pills aviso** | `.pillWarn`: `#fef3c7` (fondo), `#f59e0b`, `#92400e` | Amarillo pastel. |
| **Banner “Ver como”** | `#fef3c7` + `#fcd34d` | Mismo amarillo pastel. |
| **Alert** | `rgba(255, 237, 213, 0.75)` + borde naranja suave | Naranja pastel. |
| **Cards pendientes** | `rgba(245, 158, 11, 0.06)` + borde `rgba(245, 158, 11, 0.35)` | Fondo muy suave, menos pastel pero en la misma familia. |
| **Banner “background done”** | `rgba(11, 169, 91, 0.1)` + borde verde | Verde muy suave. |
| **Barras de gráficas** | `rgba(47, 111, 237, 0.18)` + borde azul suave | Azul lavado. |
| **Donut** | `rgba(203, 213, 225, 0.7)` y gradientes suaves | Gris-azul pastel. |
| **Reportes** | Varios `#fafbfd`, `#f4f6fa`, `rgba(255,255,255,0.6)`, gradientes `#ffffff → #f4f6fa` | Fondos “lavados” que suman sensación pastel. |
| **Primary** | `#0f3d91`, `#2f6fed` | Azules más saturados; aquí no hay pastel, pero se pueden unificar al azul de sistema si se quiere estilo Apple estricto. |

Conclusión: lo que más aporta sensación pastel son **pills (Ok/Warn)**, **banner “Ver como”**, **alert** y, en menor medida, fondos de reportes y gráficas. El fondo global `#f5f6f9` es discreto; se puede acercar a un gris más neutro tipo iOS si se quiere.

---

## 3. Sugerencias concretas (sin romper funcionalidad)

Solo cambios de **tokens y CSS** (colores, bordes, sombras, tipografía). Sin tocar lógica ni estructura de componentes.

### 3.1 Tokens globales (`tokens.css`)

- **Fondo de app**: de `#f5f6f9` a un gris neutro tipo iOS, p. ej. `#F2F2F7` o `#EBEBF0`. Reduce sensación “azulada” y acerca a Settings/Apple.
- **Primary**: opcional usar azul de sistema `#007AFF` para acciones principales y enlaces (ya se usa en botones rápidos); si se quiere mantener identidad “azul oscuro”, dejar `#0f3d91` pero evitar mezclar muchos azules.
- **Muted**: mantener `#64748b` o acercar a `#8E8E93` (gris secundario iOS) para textos secundarios.

### 3.2 Pills y badges (`components.css`)

- **`.pillOk`**: sustituir fondo pastel `#d1fae5` por un verde muy sutil tipo Apple, p. ej. `rgba(52, 199, 89, 0.12)`; texto `#0a7c47` o `#1B5E20`; borde sutil `rgba(52, 199, 89, 0.3)`. Se mantiene “éxito” sin sensación menta.
- **`.pillWarn`**: sustituir `#fef3c7` por algo como `rgba(255, 149, 0, 0.12)`; texto `#c93400` o similar; borde `rgba(255, 149, 0, 0.35)`. Mismo rol, menos pastel.
- **`.pillBad`**: ya usa rojo suave; se puede alinear a `rgba(255, 59, 48, 0.12)` y texto `#d32f2f` para consistencia con sistema.

### 3.3 Banner “Ver como” (`layout.css`)

- Sustituir `#fef3c7` / `#fcd34d` por un fondo neutro tipo `#F2F2F7` y texto/borde en un naranja o gris más sobrio (p. ej. texto `#8E8E93` y borde `#E5E5EA`), o mantener aviso con `rgba(255, 149, 0, 0.12)` y texto naranja sólido.

### 3.4 Alertas y cards de aviso (`components.css`, `dashboard.css`)

- **`.alert`**: fondo menos pastel; p. ej. `rgba(255, 149, 0, 0.08)` y borde `rgba(255, 149, 0, 0.25)`; texto en naranja oscuro.
- **`.dashboardPendingCard`**: mismo criterio; fondos con alpha bajo del color de sistema en lugar de tonos pastel puros.
- **`.backgroundDoneBanner`**: mantener verde suave pero con `rgba(52, 199, 89, 0.12)` y texto `#0a7c47` para alinearlo a pillOk.

### 3.5 Gráficas y reportes (`dashboard.css`, `reports.css`)

- **Barras**: de `rgba(47, 111, 237, 0.18)` a algo como `rgba(0, 122, 255, 0.15)` (azul sistema) o mantener azul pero un poco más neutro.
- **Donut**: sustituir `rgba(203, 213, 225, 0.7)` por un gris más neutro `#E5E5EA` o `rgba(0,0,0,0.08)` para el tramo “vacío”.
- **Fondos de reportes**: simplificar gradientes; usar un solo fondo `#FFFFFF` para contenido y `#F2F2F7` para zonas secundarias, evitando `#fafbfd` / `#f4f6fa` que suman sensación lavada.

### 3.6 Tipografía (opcional)

- Asegurar `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif` en `body` y en bloques ya “tipo iPhone” (menú móvil, registrar gasto, filtros).
- En móvil, considerar tamaños de fuente un poco mayores (p. ej. cuerpo 15–17px) donde ahora sea 14px para acercarse a HIG.

### 3.7 Sombras y bordes

- Apple usa sombras muy sutiles. Revisar `--sap-shadow-sm` / `--sap-shadow` y, si se quiere más “planitud”, reducir blur y opacidad.
- Bordes: mantener `#E5E5EA` o `rgba(0,0,0,0.08)` para separadores; evita bordes de color pastel.

---

## 4. Orden sugerido de implementación

1. **Tokens**: cambiar `--sap-bg` a gris neutro; opcionalmente `--primary` a `#007AFF` si se quiere estilo sistema.
2. **Pills**: `.pillOk`, `.pillWarn`, `.pillBad` con fondos alpha + color sólido.
3. **Banner “Ver como”** y **`.alert`**: mismos criterios (menos pastel, más neutro o color de sistema).
4. **Cards y banners** del dashboard (pendientes, background done): fondos con alpha del color de sistema.
5. **Reportes y gráficas**: fondos y barras/donut con los ajustes anteriores.
6. **Tipografía**: revisar `body` y bloques clave para SF Pro y tamaños.

Todo esto se puede hacer por fases; cada paso es reversible y no afecta la lógica ni el comportamiento de la app.

---

## 5. Resumen

- **Problema**: colores pastel (verde menta, amarillo crema, fondos lavados) en pills, banners, alertas, reportes y gráficas.
- **Enfoque Apple**: fondos neutros (blanco, gris muy suave), color con propósito (azul/verde/naranja/rojo de sistema), badges con relleno suave (alpha bajo) y texto en color sólido, tipografía SF y jerarquía clara.
- **Cambios propuestos**: sustituir fondos pastel por versiones con alpha del color de sistema, unificar fondo de app a gris neutro, suavizar gradientes en reportes y, opcionalmente, alinear primary y tipografía a Human Interface Guidelines.

Si quieres, el siguiente paso puede ser aplicar solo la sección 3.1 y 3.2 (tokens + pills) como primera iteración y dejar el resto para una segunda pasada.

---

## 6. Segunda analizada: pulida del diseño y colores

Objetivo: una **paleta unificada** y **detalles de pulida** (bordes, sombras, espaciado, tipografía) para que toda la app se sienta coherente y tipo Apple, sin pasteles.

### 6.1 Paleta propuesta (valores concretos)

| Token / uso | Actual | Propuesto (pulida) | Notas |
|-------------|--------|--------------------|--------|
| **Fondo app** | `#f5f6f9` | `#F2F2F7` | Gris iOS Settings; más neutro. |
| **Card / contenido** | `#ffffff` | `#FFFFFF` | Sin cambio. |
| **Texto principal** | `#0f172a` | `#1D1D1F` | Negro suave Apple. |
| **Texto secundario** | `#64748b` | `#8E8E93` | Gris secundario iOS. |
| **Borde / separador** | `#e2e8f0` | `#E5E5EA` o `#C6C6C8` | Separadores iOS. |
| **Primary (acción)** | `#0f3d91` | `#007AFF` | Azul sistema; opcional mantener azul oscuro para marca. |
| **Primary hover** | `#1d4ed8` | `#0051D5` | Oscuro al hover. |
| **Éxito** | `#0ba95b` | `#34C759` | Verde sistema. |
| **Aviso** | `#f59e0b` | `#FF9500` | Naranja sistema. |
| **Peligro** | `#dc2626` | `#FF3B30` | Rojo sistema (o mantener `#dc2626`). |
| **Fondo éxito suave** | — | `rgba(52, 199, 89, 0.12)` | Para pills/badges éxito. |
| **Fondo aviso suave** | — | `rgba(255, 149, 0, 0.12)` | Para pills/badges aviso. |
| **Fondo error suave** | `rgba(220, 38, 38, 0.12)` | `rgba(255, 59, 48, 0.12)` | Alineado a rojo sistema. |

### 6.2 Pulida de componentes (detalles tipo Apple)

- **Botones**
  - Primarios: relleno sólido, `border-radius: 12px`, sin borde o borde del mismo color; hover con `opacity: 0.9` o tono un poco más oscuro.
  - Ghost: fondo transparente, borde `#E5E5EA`, texto `#8E8E93`; hover `background: rgba(0,0,0,0.04)`.
  - Tamaño mínimo táctil: 44px de altura en móvil (ya lo tienes con `--touch-min`).

- **Inputs y selects**
  - Fondo `#FFFFFF`, borde `#C6C6C8` o `#E5E5EA`, `border-radius: 10px`.
  - Focus: borde azul sistema `#007AFF` o ring sutil `0 0 0 2px rgba(0, 122, 255, 0.3)`.
  - Placeholder: color `#8E8E93`.

- **Cards y contenedores**
  - Fondo blanco; borde muy sutil `1px solid #E5E5EA` o sin borde y sombra mínima: `0 1px 3px rgba(0,0,0,0.06)`.
  - `border-radius: 12px` (ya en tokens).
  - Evitar fondos “lavados” en cards; si hace falta jerarquía, usar **agrupación** (agrupar en un bloque con fondo `#F2F2F7`) en lugar de card por card pastel.

- **KPI / barras de estado**
  - La franja de color superior (::before) puede seguir con el color sólido (verde/naranja/rojo sistema); evitar tonos pastel en el fondo de la card.
  - Números: peso 600, color `#1D1D1F`; etiquetas en `#8E8E93`.

- **Listas y menús**
  - Grupos con fondo `#F2F2F7`, ítems con fondo blanco o `rgba(255,255,255,0.6)`; separadores `#E5E5EA`.
  - Ítem activo: fondo `rgba(0, 122, 255, 0.1)` y texto `#007AFF` (ya aplicado en menú móvil).

### 6.3 Sombras (menos = más pulido)

- **Cards**: `0 1px 3px rgba(0, 0, 0, 0.06)` (muy sutil).
- **Modales**: `0 4px 12px rgba(0, 0, 0, 0.08)` o similar; evitar sombras muy grandes.
- **Botones**: sin sombra por defecto; hover opcional con sombra mínima.

Sustituir en tokens:

- `--sap-shadow-sm`: `0 1px 3px rgba(0, 0, 0, 0.06)`.
- `--sap-shadow`: `0 2px 8px rgba(0, 0, 0, 0.06)`.
- `--sap-shadow-md`: `0 4px 12px rgba(0, 0, 0, 0.08)`.

### 6.4 Tipografía (pulida)

- **Stack global**: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif` como primer valor en `body`.
- **Tamaños**: cuerpo 15px en móvil (media query `max-width: 920px`), 14px en escritorio; títulos de sección 17px semibold; página 20–22px bold.
- **Pesos**: Regular 400, Medium 500, Semibold 600, Bold 700; evitar 800/900 salvo en títulos muy concretos.
- **Color texto**: principal `#1D1D1F`, secundario `#8E8E93`, placeholders y hints `#8E8E93`.

### 6.5 Reportes y gráficas (pulida)

- **Fondo del panel**: `#F2F2F7` en lugar de `#f5f6f9`; contenido en blanco.
- **Gradientes**: eliminar gradientes tipo `#ffffff → #f4f6fa`; usar bloques planos (blanco o `#F2F2F7`).
- **Barras**: relleno `rgba(0, 122, 255, 0.2)` y borde `rgba(0, 122, 255, 0.35)`; o mismo azul primary si se mantiene.
- **Donut**: segmento vacío `#E5E5EA`; segmentos de datos con colores sólidos (azul, verde, naranja, rojo sistema).
- **Tablas**: cabecera `background: rgba(0,0,0,0.03)`; bordes `#E5E5EA`; texto como arriba.

### 6.6 Checklist de pulida (orden sugerido)

| # | Área | Acción |
|---|------|--------|
| 1 | **Tokens** | Aplicar paleta 6.1 (bg, text, muted, border, primary, success, warning, danger + fondos suaves). |
| 2 | **Sombras** | Sustituir sombras por las de 6.3. |
| 3 | **Pills** | pillOk, pillWarn, pillBad con fondos alpha y texto color sólido (6.1). |
| 4 | **Banner “Ver como” y .alert** | Fondo neutro o alpha naranja; sin amarillo pastel. |
| 5 | **Botones** | Revisar bordes y radius; ghost con borde #E5E5EA. |
| 6 | **Inputs** | Bordes #E5E5EA / #C6C6C8; focus ring azul. |
| 7 | **Cards / chartBox** | Borde sutil, sombra 6.3; sin fondos pastel. |
| 8 | **Dashboard** | Pendientes, background done, barras, donut con valores 6.1 y 6.5. |
| 9 | **Reportes** | Fondos 6.5; tablas y KPIs con colores y bordes unificados. |
| 10 | **Tipografía** | Font stack y tamaños 6.4. |

### 6.7 Resumen de la pulida

- **Colores**: un solo sistema (grises neutros + azul/verde/naranja/rojo sistema); nada de menta, crema ni lavados fuertes.
- **Pulida**: bordes `#E5E5EA`, sombras mínimas, radius 10–12px, tipografía SF y jerarquía clara.
- **Sin romper**: solo CSS y tokens; misma estructura y clases; cambios reversibles por fases.

Recomendación: hacer **Fase A** (tokens + pills + banner + alert + sombras) y **Fase B** (resto de componentes, reportes, tipografía) en dos pasadas para poder revisar el resultado.
