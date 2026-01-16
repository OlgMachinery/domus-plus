import json
import os
from decimal import Decimal, InvalidOperation
from typing import Optional

try:
    from openai import OpenAI
    import httpx
    api_key = os.getenv("OPENAI_API_KEY")
    client = OpenAI(
        api_key=api_key,
        timeout=httpx.Timeout(120.0, connect=10.0),
        max_retries=0,
    ) if api_key else None
except ImportError:
    client = None
    OpenAI = None
    httpx = None

PROMPT_UNIVERSAL = """MODO EXTRACCIÓN FISCAL UNIVERSAL (tickets, facturas, recibos).

Devuelve EXCLUSIVAMENTE JSON válido.
No incluyas texto antes ni después del JSON.
No calcules ni deduzcas; copia EXACTO lo impreso.

Formato de salida:
{
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "amount_raw": "texto tal cual del total impreso",
  "currency": "MXN",
  "merchant_or_beneficiary": "texto impreso",
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

Reglas:
- Cada renglón impreso que represente un concepto = 1 item.
- Usa raw_line con el texto completo del renglón.
- No normalices, no completes campos faltantes. Si no aparece cantidad/precio/total, deja "".
- No incluyas subtotales, impuestos, promociones ni totales como items.
- Usa el total impreso del documento en amount_raw (sin calcular)."""


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
        return int((Decimal(v) * 100).to_integral_value())
    except (InvalidOperation, ValueError):
        return 0


def _to_float(value: str) -> float:
    return _to_cents(value) / 100.0


def process_receipt_image(image_base64: str, image_format: str = "jpeg") -> Optional[dict]:
    if client is None:
        raise ValueError("OpenAI API key no configurada o cliente no disponible.")

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            temperature=0,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PROMPT_UNIVERSAL},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/{image_format};base64,{image_base64}"},
                        },
                    ],
                }
            ],
        )

        content = response.choices[0].message.content or ""
        data = _extract_json(content)

        if "items" not in data or not isinstance(data["items"], list):
            data["items"] = []

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
        raise ValueError(f"Error procesando el recibo: {e}")
