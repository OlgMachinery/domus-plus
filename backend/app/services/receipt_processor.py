import json
import os
from decimal import Decimal, InvalidOperation
from typing import Optional

try:
    from openai import OpenAI
    import httpx
except ImportError:
    OpenAI = None
    httpx = None

PROMPT_ITEMS = """MODO EXTRACCIÓN FISCAL UNIVERSAL (tickets, facturas, recibos) — ITEMS.

Devuelve EXCLUSIVAMENTE JSON válido (sin texto antes/después).

PRIORIDAD #1 (CRÍTICA): extraer el GRAN TOTAL (TOTAL A PAGAR / IMPORTE TOTAL / TOTAL).
- `amount_raw` debe ser SOLO el monto del GRAN TOTAL (ej. "1234.56" o "1,234.56"), copiado tal cual.
- Si en ESTA imagen/corte NO se ve claramente el renglón del TOTAL, devuelve `amount_raw` como "" (vacío).
- NO confundas el TOTAL con: folio/ticket, número de transacción, caja, autorización, IVA, subtotal, cambio, pago, puntos, etc.

Formato de salida:
{
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "amount_raw": "",
  "currency": "MXN",
  "merchant_or_beneficiary": "",
  "items": [
    {
      "line_number": 1,
      "raw_line": "renglón completo tal cual",
      "quantity_raw": "",
      "unit_price_raw": "",
      "total_raw": ""
    }
  ]
}

Reglas para ITEMS:
- Cada renglón impreso que represente un artículo/concepto = 1 item (MANTÉN el orden original).
- Usa `raw_line` con el texto completo del renglón. Si el renglón no se entiende, usa "no legible".
- `quantity_raw`, `unit_price_raw`, `total_raw`: copia EXACTO lo impreso. Si no es legible, usa "no legible". Si no aparece en ese renglón, deja "".
- No normalices ni deduzcas campos faltantes.
- No incluyas subtotales, impuestos, promociones/descuentos, pagos, cambio, propina ni el total como items."""

PROMPT_TOTALS = """MODO EXTRACCIÓN FISCAL UNIVERSAL (tickets, facturas, recibos) — TOTALES.

Devuelve EXCLUSIVAMENTE JSON válido (sin texto antes/después).

Objetivo: extraer el GRAN TOTAL con MÁXIMA precisión (copiar tal cual).
IMPORTANTE:
- NO adivines. Si no estás 100% seguro del monto, deja el campo vacío.
- Incluye el renglón completo donde aparece el total para verificación.
- Si aparece el conteo de artículos ("ARTICULOS COMPRADOS: 127"), extráelo también.

Formato de salida:
{
  "amount_raw": "",
  "total_line_raw": "",
  "currency": "MXN",
  "subtotal_raw": "",
  "taxes": [
    { "label": "IVA", "amount_raw": "" },
    { "label": "IEPS", "amount_raw": "" }
  ],
  "items_count": null,
  "items_count_line_raw": ""
}

Reglas:
- `amount_raw`: SOLO el monto del GRAN TOTAL (ej. "6345.00" o "6,345.00").
- `total_line_raw`: el renglón completo exacto donde aparece el GRAN TOTAL (ej. "Venta Total 6345.00").
- `items_count`: número entero si es legible; si no, null.
- Si un campo no se ve claramente, deja "" (o null para items_count)."""

PROMPT_TRANSCRIBE = """TRANSCRIPCIÓN EXACTA DE RECIBO (texto).

Devuelve SOLO TEXTO PLANO (sin JSON).

Reglas:
- Transcribe TODO el texto visible en la imagen respetando el orden.
- Conserva los saltos de línea (un renglón impreso = una línea de salida).
- NO inventes nada. Si un renglón no se entiende, escribe: no legible
- NO traduzcas, NO corrijas, NO completes.
"""

# Back-compat (scripts viejos / imports)
PROMPT_UNIVERSAL = PROMPT_ITEMS


def _extract_json(content: str) -> dict:
    text = content.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    if "{" in text and "}" in text:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            text = text[start:end + 1]
    return json.loads(text)


def _to_cents(value: str) -> int:
    if value is None:
        return 0
    try:
        v = str(value).replace(",", "").strip()
        if not v:
            return 0
        negative = False
        # Algunos recibos marcan negativos con "-" al final (ej. "0.57-")
        if v.endswith("-") and not v.startswith("-"):
            negative = True
            v = v[:-1].strip()
        # Soportar negativos con paréntesis "(123.45)"
        if v.startswith("(") and v.endswith(")"):
            negative = True
            v = v[1:-1].strip()
        cents = int((Decimal(v) * 100).to_integral_value())
        return -cents if negative else cents
    except (InvalidOperation, ValueError):
        return 0


def _to_float(value: str) -> float:
    return _to_cents(value) / 100.0


def _get_client_and_params(mode: str, *, for_totals: bool) -> tuple:
    mode_norm = (mode or "precise").strip().lower()
    if mode_norm == "fast":
        model = os.getenv("RECEIPT_OPENAI_MODEL_FAST") or os.getenv("RECEIPT_OPENAI_MODEL") or "gpt-4o-mini"
        timeout_total = float(os.getenv("RECEIPT_TIMEOUT_FAST", "120"))
        image_detail = os.getenv("RECEIPT_IMAGE_DETAIL_FAST") or os.getenv("RECEIPT_IMAGE_DETAIL") or "low"
    else:
        model = os.getenv("RECEIPT_OPENAI_MODEL_PRECISE") or os.getenv("RECEIPT_OPENAI_MODEL") or "gpt-4o"
        timeout_total = float(os.getenv("RECEIPT_TIMEOUT_PRECISE", "300"))
        # Con recibos largos procesados en varias partes, "high" mejora lectura y reduce errores de dígitos.
        image_detail = os.getenv("RECEIPT_IMAGE_DETAIL_PRECISE") or os.getenv("RECEIPT_IMAGE_DETAIL") or "high"

    # Para totales, usar "high" (imagen pequeña y vale la pena la precisión)
    if for_totals:
        image_detail = "high"
        # Totales suele ser más rápido; no bloquear tanto.
        timeout_total = min(timeout_total, float(os.getenv("RECEIPT_TOTAL_TIMEOUT", "120")))

    use_client = OpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        timeout=httpx.Timeout(timeout_total, connect=10.0),
        max_retries=0,
    )
    return use_client, model, image_detail, timeout_total


def process_receipt_items_image(image_base64: str, image_format: str = "jpeg", mode: str = "precise") -> Optional[dict]:
    if OpenAI is None or httpx is None:
        raise ValueError("OpenAI client no disponible (instala openai y httpx).")

    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OpenAI API key no configurada. Define OPENAI_API_KEY en el backend.")

        use_client, model, image_detail, _timeout_total = _get_client_and_params(mode, for_totals=False)
        image_url = {"url": f"data:image/{image_format};base64,{image_base64}"}
        if image_detail:
            image_url["detail"] = image_detail

        request_payload = dict(
            model=model,
            temperature=0,
            max_tokens=int(os.getenv("RECEIPT_MAX_TOKENS_ITEMS", "4096")),
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                PROMPT_ITEMS
                                + "\n\n"
                                + "CRÍTICO (anti-alucinación):\n"
                                + "- NO INVENTES items. Si no puedes leer un renglón, usa 'no legible'.\n"
                                + "- Si no puedes ver claramente TODO el recibo en este corte, está BIEN devolver menos items.\n"
                                + "- NUNCA rellenes con items plausibles (ej. 'tacos', 'menú', etc.).\n"
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": image_url,
                        },
                    ],
                }
            ],
        )

        # Forzar JSON válido cuando el modelo lo soporta. Si falla, hacer fallback.
        try:
            response = use_client.chat.completions.create(
                **request_payload,
                response_format={"type": "json_object"},
            )
        except Exception:
            response = use_client.chat.completions.create(**request_payload)

        content = response.choices[0].message.content or ""
        data = _extract_json(content)

        if "items" not in data or not isinstance(data["items"], list):
            data["items"] = []

        try:
            data["_meta"] = {
                "model": model,
                "image_detail": image_detail,
                "finish_reason": getattr(response.choices[0], "finish_reason", None),
            }
        except Exception:
            pass

        # Enriquecer con validación aritmética usando enteros (centavos)
        declared_total_cents = _to_cents(data.get("amount_raw"))
        sum_items_cents = 0
        for it in data["items"]:
            sum_items_cents += _to_cents(it.get("total_raw"))
        data["arith_total_cents"] = sum_items_cents
        data["declared_total_cents"] = declared_total_cents
        data["arith_diff_cents"] = declared_total_cents - sum_items_cents

        return data
    except Exception as e:
        msg = str(e)
        low = msg.lower()

        # Mensajes más útiles para el usuario (y evitar dumps largos).
        if "error code: 429" in low and ("quota" in low or "billing" in low):
            raise ValueError("OpenAI: se excedió la cuota/saldo de la API. Revisa Billing o agrega créditos a tu API key.")
        if "error code: 401" in low or "invalid api key" in low:
            raise ValueError("OpenAI: API key inválida (401). Revisa la variable OPENAI_API_KEY.")
        if "api key" in low and "not configured" in low:
            raise ValueError("OpenAI: API key no configurada. Define OPENAI_API_KEY en el backend.")
        if "request timed out" in low or "timed out" in low:
            raise ValueError("OpenAI: la solicitud excedió el tiempo máximo. Prueba modo Rápido o usa una foto más recortada/legible.")

        raise ValueError(f"Error procesando el recibo: {e}")


def process_receipt_totals_image(image_base64: str, image_format: str = "jpeg", mode: str = "precise") -> Optional[dict]:
    if OpenAI is None or httpx is None:
        raise ValueError("OpenAI client no disponible (instala openai y httpx).")

    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OpenAI API key no configurada. Define OPENAI_API_KEY en el backend.")

        use_client, model, image_detail, _timeout_total = _get_client_and_params(mode, for_totals=True)
        image_url = {"url": f"data:image/{image_format};base64,{image_base64}"}
        if image_detail:
            image_url["detail"] = image_detail

        request_payload = dict(
            model=model,
            temperature=0,
            max_tokens=int(os.getenv("RECEIPT_MAX_TOKENS_TOTALS", "900")),
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PROMPT_TOTALS},
                        {"type": "image_url", "image_url": image_url},
                    ],
                }
            ],
        )

        try:
            response = use_client.chat.completions.create(
                **request_payload,
                response_format={"type": "json_object"},
            )
        except Exception:
            response = use_client.chat.completions.create(**request_payload)

        content = response.choices[0].message.content or ""
        data = _extract_json(content)

        # Normalizar estructura mínima
        if "taxes" not in data or not isinstance(data.get("taxes"), list):
            data["taxes"] = []

        declared_total_cents = _to_cents(data.get("amount_raw"))
        data["declared_total_cents"] = declared_total_cents

        try:
            data["_meta"] = {
                "model": model,
                "image_detail": image_detail,
                "finish_reason": getattr(response.choices[0], "finish_reason", None),
            }
        except Exception:
            pass

        return data
    except Exception as e:
        msg = str(e)
        low = msg.lower()
        if "error code: 429" in low and ("quota" in low or "billing" in low):
            raise ValueError("OpenAI: se excedió la cuota/saldo de la API. Revisa Billing o agrega créditos a tu API key.")
        if "error code: 401" in low or "invalid api key" in low:
            raise ValueError("OpenAI: API key inválida (401). Revisa la variable OPENAI_API_KEY.")
        if "request timed out" in low or "timed out" in low:
            raise ValueError("OpenAI: la solicitud excedió el tiempo máximo al leer totales. Prueba con una foto más recortada del pie del recibo.")
        raise ValueError(f"Error procesando totales del recibo: {e}")


def transcribe_receipt_image(image_base64: str, image_format: str = "jpeg", mode: str = "precise") -> Optional[dict]:
    """
    Transcribe el texto del recibo como texto plano (sin JSON).
    Útil como fallback cuando el JSON estructurado falla o cuando se requiere máxima fidelidad de texto.
    """
    if OpenAI is None or httpx is None:
        raise ValueError("OpenAI client no disponible (instala openai y httpx).")

    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OpenAI API key no configurada. Define OPENAI_API_KEY en el backend.")

        # Reutilizar selección de modelo por modo, pero forzar detalle alto para OCR visual.
        use_client, model, _image_detail, _timeout_total = _get_client_and_params(mode, for_totals=False)
        image_detail = os.getenv("RECEIPT_IMAGE_DETAIL_TRANSCRIBE") or "high"

        image_url = {"url": f"data:image/{image_format};base64,{image_base64}"}
        if image_detail:
            image_url["detail"] = image_detail

        response = use_client.chat.completions.create(
            model=os.getenv("RECEIPT_OPENAI_MODEL_TRANSCRIBE") or model,
            temperature=0,
            max_tokens=int(os.getenv("RECEIPT_MAX_TOKENS_TRANSCRIBE", "4096")),
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PROMPT_TRANSCRIBE},
                        {"type": "image_url", "image_url": image_url},
                    ],
                }
            ],
        )

        text = (response.choices[0].message.content or "").strip()
        data = {"text": text}
        try:
            data["_meta"] = {
                "model": os.getenv("RECEIPT_OPENAI_MODEL_TRANSCRIBE") or model,
                "image_detail": image_detail,
                "finish_reason": getattr(response.choices[0], "finish_reason", None),
            }
        except Exception:
            pass
        return data
    except Exception as e:
        msg = str(e)
        low = msg.lower()
        if "error code: 429" in low and ("quota" in low or "billing" in low):
            raise ValueError("OpenAI: se excedió la cuota/saldo de la API. Revisa Billing o agrega créditos a tu API key.")
        if "error code: 401" in low or "invalid api key" in low:
            raise ValueError("OpenAI: API key inválida (401). Revisa la variable OPENAI_API_KEY.")
        if "request timed out" in low or "timed out" in low:
            raise ValueError("OpenAI: la solicitud excedió el tiempo máximo al transcribir. Intenta con una foto más recortada/legible.")
        raise ValueError(f"Error transcribiendo el recibo: {e}")


# Alias anterior (para no romper imports existentes)
def process_receipt_image(image_base64: str, image_format: str = "jpeg", mode: str = "precise") -> Optional[dict]:
    return process_receipt_items_image(image_base64=image_base64, image_format=image_format, mode=mode)
