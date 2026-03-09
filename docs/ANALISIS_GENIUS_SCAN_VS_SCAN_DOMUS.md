# Análisis: Genius Scan vs Scan Domus

## Qué hace Genius Scan para lograr resultados de “escáner profesional”

### 1. **Detección y encuadre**
- Detecta bordes del documento en tiempo real (overlay naranja).
- Encuadra solo el documento: recorte + corrección de perspectiva (elimina ángulo y deformación).
- Resultado: imagen rectangular, solo el papel, sin mesa ni manos.

### 2. **Post-procesado de imagen (clave de la “calidad”)**
- **Escala de grises o blanco y negro:** Reduce ruido de color y acerca el aspecto a escáner. El texto gana legibilidad.
- **Umbral adaptativo (adaptive threshold):** Convierte a negro sobre blanco adaptándose a la iluminación de cada zona. Da el aspecto “documento escaneado” y mejora texto en sombras.
- **Contraste:** Aumenta la diferencia entre texto y fondo (normalización, estiramiento de histograma o CLAHE).
- **Nitidez (sharpening):** Máscara de enfoque para acentuar bordes del texto y compensar fotos algo blandas.
- **Reducción de sombras:** Suaviza variaciones de luz (morphology, normalización por bloques) para que el papel se vea uniforme.

### 3. **Captura**
- Resolución suficiente (no subir solo miniaturas).
- Enfoque estable: indicaciones de “mantener quieto” y, en apps nativas, posible uso de AF o disparo cuando la escena es estable.

---

## Dónde mejorar Scan Domus

| Aspecto | Problema actual | Acción |
|--------|------------------|--------|
| **Calidad de imagen** | Foto tal cual, sin post-proceso | Añadir pipeline: perspectiva → gris/B&W (umbral adaptativo) → contraste → nitidez. |
| **“Salida de escáner”** | Color, poco contraste | Incluir modo “documento” (blanco y negro / alto contraste) como Genius Scan. |
| **Enfoque lento** | Limitado por la cámara en el navegador | Pedir resolución más alta en `getUserMedia`; reforzar mensaje “mantén estable”; la mejora principal seguirá siendo el post-procesado. |
| **Calidad de encuadre** | Detección a veces falla o tarda | Ajustar parámetros de detección (área mínima, Canny); asegurar que el recorte final sea solo el documento. |

---

## Resumen

Genius Scan combina **detección + perspectiva + post-procesado (B&W, contraste, nitidez)**. Para acercar Scan Domus a ese resultado hay que **añadir ese pipeline de mejora de imagen** después de la corrección de perspectiva y, si hace falta, afinar la detección de bordes y la resolución de captura.
