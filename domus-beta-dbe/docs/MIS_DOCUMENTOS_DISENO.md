# Mis documentos — diseño (carga digital por usuario)

## Qué quieres

Cada usuario pueda **subir y ver sus documentos en digital**, organizados por tipo:

- **Identificaciones** (INE, pasaporte, licencia, etc.)
- **Actas** (nacimiento, matrimonio, etc.)
- **Vehículos** (tarjeta de circulación, factura, póliza, etc.)
- **Recetas** (médicas o de farmacia)
- **Prescripciones**
- **Categorías propias** (ej. Motocicletas): el usuario puede crear la categoría que quiera.

Además:

- **Miniaturas** del contenido (~1×1 pulgada) en la lista.
- **Datos extraídos** (nombre, número, fecha de vencimiento, etc.) editables y ordenados; al abrir un documento se pueden compartir **solo el documento**, **solo los datos** o **ambos**.
- **Fecha de vencimiento** visible y editable (p. ej. para INE o licencia).
- **Cualquier tipo de archivo** (imágenes, PDF, Office, etc.), no solo PDF e imágenes.
- **WhatsApp**: si piden por WhatsApp “mándame mi INE” o “envía mi identificación”, el bot envía el documento (y opcionalmente los datos extraídos).

---

## Qué ya existe en el proyecto (para no duplicar)

| Uso | Dónde | Alcance |
|-----|--------|---------|
| **Recibos / comprobantes** | `Receipt` + `ReceiptImage`, vinculados a transacciones | Por gasto; no son “documentos personales” por categoría |
| **Avatar del usuario** | `User.avatarUrl`, API `POST /api/users/me/avatar` | Una sola imagen por usuario |
| **Fotos/videos de activos** | `FamilyAssetMedia`, API `setup/upload-asset-media` | Por familia, para inventario (electrodomésticos, vehículos del hogar) |
| **Storage** | DigitalOcean Spaces (`uploadToSpaces`, URLs firmadas) | Ya se usa para recibos, avatar y medios de activos |

No existe hoy un “cofre de documentos personales” por usuario con categorías (identificaciones, actas, vehículos, recetas, prescripciones). Esto se añade como **nueva funcionalidad**, reutilizando el mismo storage (Spaces) y el mismo patrón de subida/URL firmada.

---

## Qué se va a hacer

### 1. Modelo de datos (Prisma)

Nueva tabla **`UserDocument`** (o similar), por ejemplo:

- `id`, `userId` (dueño)
- `category`: una de `IDENTIFICACIONES` | `ACTAS` | `VEHICULOS` | `RECETAS` | `PRESCRIPCIONES`
- `name` (opcional): etiqueta que pone el usuario (ej. “INE”, “Acta de nacimiento”)
- `fileUrl`: URL en Spaces donde está el archivo
- `fileName`: nombre original del archivo
- `contentType` (opcional): MIME (PDF, image/…)
- `createdAt` (y opcionalmente `updatedAt`)

Solo el usuario dueño puede ver/borrar sus documentos. Si más adelante quieres compartir con la familia, se puede añadir `familyId` y lógica de permisos.

### 2. Almacenamiento (Spaces)

- Ruta sugerida: `users/{userId}/documents/{category}/{id}-{nombreSeguro}.{ext}`
- Mismo bucket y configuración DO_SPACES que recibos y avatar.
- Acceso mediante **URL firmada** (como en recibos) para descargar/ver, sin hacer los archivos públicos.

### 3. API

- **GET /api/users/me/documents**  
  Listar documentos del usuario. Query opcional: `?category=IDENTIFICACIONES` (etc.) para filtrar por categoría. Respuesta incluye metadatos; para ver/descargar se usa una URL firmada (endpoint aparte si hace falta).
- **POST /api/users/me/documents**  
  Subir un documento: `multipart/form-data` con `file` + `category` (+ `name` opcional). Validar tipo (PDF, imágenes) y tamaño. Crear registro en DB y subir el archivo a Spaces con la ruta anterior.
- **DELETE /api/users/me/documents/[id]**  
  Borrar el documento del usuario: borrar registro y, si se desea, el objeto en Spaces (opcional pero recomendado).

Opcional: **GET /api/users/me/documents/[id]/download** que devuelva una URL firmada de descarga para ese documento.

### 4. UI

- **Entrada en la app**  
  Un botón o ítem de menú tipo **“Mis documentos”** (o “Documentos”) que solo muestre esta funcionalidad al usuario actual.
- **Vista principal**  
  Una pantalla con **pestañas o secciones** por categoría:
  - Identificaciones  
  - Actas  
  - Vehículos  
  - Recetas  
  - Prescripciones  
- En cada sección:
  - Lista de documentos ya subidos (nombre/etiqueta, fecha, tipo de archivo) con opción de **ver/descargar** (usando URL firmada) y **eliminar**.
  - Botón **“Cargar documento”** / “Subir” que abra un selector de archivo y, al elegir, envíe `POST /api/users/me/documents` con la categoría de esa pestaña y el archivo.
- Restricciones en cliente (y en API): por ejemplo solo PDF e imágenes, y tamaño máximo (ej. 10–15 MB por archivo).

---

## Resumen

- **No** se reutiliza el modelo de Receipts (son para gastos/transacciones).
- **Sí** se reutiliza: Spaces, patrón de subida (multipart + `uploadToSpaces`), y patrón de URL firmada para lectura.
- **Nuevo**: modelo `UserDocument`, rutas API bajo `/api/users/me/documents`, y una vista “Mis documentos” con categorías fijas (Identificaciones, Actas, Vehículos, Recetas, Prescripciones) y carga/lista/borrado por categoría.

Si esto coincide con lo que quieres, el siguiente paso es implementar modelo, API y UI según este diseño.

---

## Implementado (ampliación)

- **Schema**: `UserDocument` con `thumbnailUrl`, `extractedData` (JSON), `expiresAt`; `category` es string (permite categorías custom).
- **API**:
  - GET devuelve `thumbnailSignedUrl`, `extractedData`, `expiresAt`.
  - POST acepta cualquier categoría (incl. custom), genera miniatura al subir (imagen o primera página PDF), acepta más tipos de archivo (imagen, PDF, Office, texto, vídeo, audio, etc.).
  - PATCH `[id]`: actualizar `extractedData` y/o `expiresAt`.
- **UI**: pestañas por categoría (fijas + las que tenga el usuario); input “Nueva categoría” (ej. Motocicletas); lista con miniatura 96×96 px; al “Ver” se abre modal con fecha de vencimiento y datos extraídos editables (añadir/quitar campos y guardar), y botones Compartir documento / Compartir datos / Compartir ambos.
- **WhatsApp**: si el usuario escribe “mándame mi INE”, “envía mi identificación”, “dame acta”, etc., el webhook detecta la intención, busca el documento en Mis documentos y envía el archivo (y los datos extraídos en el pie de mensaje).
- **Extracción automática**: solo en Identificaciones y Actas (documentos oficiales). Al subir imagen o PDF de máximo 2 páginas se extraen datos con visión/IA de forma automática y silenciosa. PDF de más de 2 páginas en esas categorías se rechazan.
