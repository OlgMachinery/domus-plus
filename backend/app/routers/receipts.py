from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from app.services import receipt_processor
from datetime import datetime
import base64
from typing import List, Optional, Tuple, Dict, Any
import io
import re
from difflib import SequenceMatcher
from pathlib import Path
import os

router = APIRouter()

def _parse_float_safe(value) -> float:
    try:
        if value is None:
            return 0.0
        import re
        s = str(value).strip()
        if not s:
            return 0.0
        negative = False
        # Algunos tickets marcan negativos con signo al final (ej. "0.57-")
        if s.endswith("-") and not s.startswith("-"):
            negative = True
            s = s[:-1].strip()
        # También soportar negativos con paréntesis "(123.45)"
        if s.startswith("(") and s.endswith(")"):
            negative = True
            s = s[1:-1].strip()
        # Extraer el último número del string (maneja "518.00 MXN", "$3,185.00", etc.)
        matches = re.findall(r"-?\d+(?:[.,]\d+)?", s)
        if not matches:
            return 0.0
        num = matches[-1]
        if num.startswith("-"):
            negative = True
            num = num[1:]
        # Normalizar separadores:
        # - Si hay punto y coma, la coma suele ser separador de miles
        if "," in num and "." in num:
            num = num.replace(",", "")
        # - Si solo hay coma, decidir si es decimal (1-2 dígitos) o miles (3 dígitos)
        elif "," in num and "." not in num:
            parts = num.split(",")
            if len(parts) == 2 and len(parts[1]) in (1, 2):
                num = f"{parts[0]}.{parts[1]}"
            else:
                num = "".join(parts)
        val = float(num)
        return -val if negative else val
    except Exception:
        return 0.0


def _normalize_for_match(text: str) -> str:
    s = (text or "").upper().strip()
    s = re.sub(r"\s+", " ", s)
    # mantener letras/números/espacios para similitud
    s = re.sub(r"[^A-Z0-9 ]+", "", s)
    return s


def _similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def _is_probable_boundary_duplicate(item: Dict[str, Any], tail_item: Dict[str, Any]) -> bool:
    a_line = _normalize_for_match(str(item.get("raw_line") or ""))
    b_line = _normalize_for_match(str(tail_item.get("raw_line") or ""))
    if not a_line or not b_line:
        return False

    a_total = _parse_float_safe(item.get("total_raw"))
    b_total = _parse_float_safe(tail_item.get("total_raw"))
    if a_total > 0 and b_total > 0:
        diff = abs(a_total - b_total)
        # En el solapamiento, OCR puede variar algunos pesos/centavos.
        # Tolerar hasta 1.00 MXN o 3% del monto mayor.
        tol = max(1.0, max(a_total, b_total) * 0.03)
        if diff > tol:
            return False

    # Igualdad fuerte por texto normalizado
    if a_line.replace(" ", "") == b_line.replace(" ", ""):
        return True

    # Fuzzy para pequeñas variaciones OCR (solo en borde de partes)
    sim = _similarity(a_line, b_line)
    return sim >= 0.90


def _merge_items_with_overlap_dedup(
    parts_items: List[List[Dict[str, Any]]],
    tail_window: int = 60,
    boundary_window: int = 45,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Une items de múltiples partes con solapamiento.
    Remueve duplicados en la "zona de borde" de cada parte (caso típico por overlap).
    Nota: GPT/OCR a veces reordena ligeramente las primeras líneas; por eso no dependemos
    de que los duplicados estén estrictamente al inicio.
    """
    merged: List[Dict[str, Any]] = []
    removed = 0

    for idx_part, part_items in enumerate(parts_items, start=1):
        if not part_items:
            continue
        if not merged:
            merged.extend(part_items)
            continue

        tail = merged[-tail_window:] if len(merged) > tail_window else merged

        for idx_item, it in enumerate(part_items):
            # Solo dedupeamos dentro de una ventana inicial (zona de solapamiento)
            if idx_item < boundary_window and any(_is_probable_boundary_duplicate(it, t) for t in tail):
                removed += 1
                continue
            merged.append(it)

    return merged, removed


def _interleave_placeholders_evenly(
    items: List[Dict[str, Any]],
    placeholders: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Inserta placeholders de manera uniforme dentro de `items` sin reordenar los items existentes.
    Esto es un "best effort" para mantener el orden cuando sabemos que faltan renglones
    pero no sabemos exactamente sus posiciones.
    """
    if not placeholders:
        return items
    if not items:
        return list(placeholders)

    m = len(items)
    n = len(placeholders)
    # Cantidad de items originales que deben ir antes de cada placeholder (0..m)
    insert_after = [int(i * m / (n + 1)) for i in range(1, n + 1)]

    out: List[Dict[str, Any]] = []
    p = 0
    count = 0  # items originales ya agregados

    while p < n and insert_after[p] == 0:
        out.append(placeholders[p])
        p += 1

    for it in items:
        out.append(it)
        count += 1
        while p < n and insert_after[p] == count:
            out.append(placeholders[p])
            p += 1

    while p < n:
        out.append(placeholders[p])
        p += 1

    return out


def _extract_number_candidates(text: str) -> List[float]:
    """
    Extrae TODOS los números del texto (incluye separadores de miles/decimales).
    Ej: "TOTAL 1,234.56" -> [1234.56]
    """
    if not text:
        return []
    tokens = re.findall(r"-?\d[\d.,]*\d", str(text))
    out: List[float] = []
    for tok in tokens:
        try:
            s = tok.strip()
            if "," in s and "." in s:
                s = s.replace(",", "")
            elif "," in s and "." not in s:
                parts = s.split(",")
                if len(parts) == 2 and len(parts[1]) in (1, 2):
                    s = f"{parts[0]}.{parts[1]}"
                else:
                    s = "".join(parts)
            out.append(float(s))
        except Exception:
            continue
    # unique (mantener orden)
    seen = set()
    uniq: List[float] = []
    for v in out:
        key = round(v, 4)
        if key in seen:
            continue
        seen.add(key)
        uniq.append(v)
    return uniq


_CURRENCY_AMOUNT_RE = re.compile(r"-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})(?!\d)")
_NON_ITEM_LINE_KWS = (
    "SUBTOTAL",
    "TOTAL",
    "IVA",
    "IEPS",
    "CAMBIO",
    "PAGO",
    "EFECTIVO",
    "TARJ",
    "TARJETA",
    "AUTORIZ",
    "APROB",
    "ARTICUL",
    "CUENTA",
    "CLIENTE",
    "RFC",
    "FOLIO",
    "TICKET",
    "CAJA",
    "TRANSACC",
    "FECHA",
    "HORA",
    "PROMOC",
    "DESCU",
    "CANCEL",
    "GRACIAS",
    "BIENVEN",
    "VENTA ",
    "A PAGAR",
    "IMPORTE",
    "AHORRO",
    "PUNTOS",
)


def _has_trailing_negative_marker(text: str) -> bool:
    if not text:
        return False
    s = str(text).strip()
    # e.g. "... 85.90-" or "(85.90)"
    if s.endswith("-"):
        return True
    if s.startswith("(") and s.endswith(")"):
        return True
    return False


def _apply_negative_marker_if_needed(raw_line: str, value_raw: str) -> str:
    """
    Si el renglón parece marcar negativo con '-' al final, pero value_raw no lo trae,
    lo aplicamos (ej. raw_line "... 85.90-" + total_raw "85.90" => "85.90-").
    """
    if not raw_line or not value_raw:
        return value_raw
    rl = str(raw_line).strip()
    vr = str(value_raw).strip()
    if not vr or vr.lower() == "no legible":
        return value_raw
    if _has_trailing_negative_marker(rl) and not _has_trailing_negative_marker(vr) and not vr.startswith("-"):
        # Solo si el número aparece cerca del final para evitar falsos positivos.
        pos = rl.rfind(vr)
        if pos != -1 and pos >= max(0, len(rl) - len(vr) - 6):
            return vr + "-"
    return value_raw


def _structured_line_type(raw_line: str) -> str:
    up = (raw_line or "").upper()
    if "CANCEL" in up or "CANCELADA" in up:
        return "cancellation"
    if "CAMB. PRECIO" in up or "CAMBIO PRECIO" in up or up.startswith("PRECIO:") or "PRECIO:" in up:
        return "price_change"
    if "DESCU" in up or "PROMOC" in up or "AHORRO" in up:
        return "discount"
    return "item"


def _ensure_negative_if_adjustment_line(line_type: str, value_raw: str) -> str:
    """
    Para renglones que típicamente son ajustes (descuentos/cancelaciones/cambio de precio),
    forzar signo negativo si no viene explícito (sin afectar 'no legible').
    """
    if line_type not in ("cancellation", "price_change", "discount"):
        return value_raw
    if not value_raw:
        return value_raw
    vr = str(value_raw).strip()
    if not vr or vr.lower() == "no legible":
        return value_raw
    if vr.startswith("-") or _has_trailing_negative_marker(vr):
        return value_raw
    return vr + "-"


def _extract_last_currency_amount_raw(line: str) -> str:
    if not line:
        return ""
    matches = _CURRENCY_AMOUNT_RE.findall(str(line))
    if not matches:
        return ""
    raw = matches[-1]
    s = str(line).strip()
    # Preservar signo negativo al final (ej. "0.57-")
    if s.endswith("-") and not raw.endswith("-"):
        # Si el número aparece cerca del final, asumir que el "-" aplica al monto.
        pos = s.rfind(raw)
        if pos != -1 and pos >= len(s) - len(raw) - 3:
            raw = raw + "-"
    return raw


def _should_skip_transcribed_line(line: str) -> bool:
    up = (line or "").upper().strip()
    if not up:
        return True
    if up == "NO LEGIBLE":
        return False
    if re.fullmatch(r"[*\-_=\s]+", up or ""):
        return True
    # Si el renglón tiene un monto tipo moneda, normalmente es un item (excepto totales/subtotales/impuestos).
    has_amount = bool(_CURRENCY_AMOUNT_RE.findall(str(line)))
    for kw in _NON_ITEM_LINE_KWS:
        if kw in up:
            # No descartar cancelaciones si traen monto (impactan el total).
            if has_amount and ("CANCEL" in kw):
                return False
            return True
    return False


def _pick_declared_total(receipt_raws: List[Dict[str, Any]], sum_items: float, max_item: float) -> Tuple[float, Optional[str]]:
    """
    Selecciona el total declarado más probable usando todos los `amount_raw` disponibles.
    Preferencia:
    - `amount_raw` con keywords de TOTAL (si viniera con etiqueta)
    - valores que no sean menores que el item más caro
    - valores más cercanos a la suma de items (dedupeado)
    """
    best_total = 0.0
    best_score: Optional[float] = None
    best_source: Optional[str] = None

    for idx, raw in enumerate(receipt_raws, start=1):
        amount_text = str(raw.get("amount_raw") or "").strip()
        declared_cents = raw.get("declared_total_cents")
        has_kw = False
        if amount_text:
            up = amount_text.upper()
            has_kw = any(k in up for k in ("TOTAL", "A PAGAR", "IMPORTE"))

        candidates: List[float] = []
        if isinstance(declared_cents, int) and declared_cents > 0:
            candidates.append(declared_cents / 100.0)
        if amount_text:
            candidates.extend(_extract_number_candidates(amount_text))

        for c in candidates:
            if c <= 0:
                continue
            if max_item > 0 and c + 0.01 < max_item:
                continue

            diff = abs(c - sum_items) if sum_items > 0 else 0.0
            score = diff

            # Bonus si venía etiquetado como TOTAL
            if has_kw:
                score *= 0.6

            # Penalizar enteros puros (a veces son folios/tickets)
            if abs(c - round(c)) < 1e-9:
                score *= 1.1

            if best_score is None or score < best_score:
                best_score = score
                best_total = c
                best_source = f"part_{idx}"

    return best_total, best_source


def _pick_declared_total_v2(
    receipt_raws: List[Dict[str, Any]],
    totals_raws: List[Dict[str, Any]],
    sum_items: float,
    max_item: float,
) -> Tuple[float, Optional[str], Optional[Dict[str, Any]]]:
    """
    Selección de total con preferencia por extracción dedicada del PIE (totales_raws).
    - Prioriza total_line_raw con keyword "TOTAL".
    - Usa consistencia subtotal+impuestos como verificación secundaria (si está disponible).
    - Solo usa cercanía a suma de items como tie-breaker de baja importancia.
    """
    best_total = 0.0
    best_score: Optional[float] = None
    best_source: Optional[str] = None
    best_raw: Optional[Dict[str, Any]] = None

    # 1) Preferir el extractor dedicado de totales
    for idx, raw in enumerate(totals_raws or [], start=1):
        amount_text = str(raw.get("amount_raw") or "").strip()
        total_line = str(raw.get("total_line_raw") or "")
        up = total_line.upper()
        has_kw = any(k in up for k in ("TOTAL", "A PAGAR", "IMPORTE"))

        candidates: List[float] = []
        declared_cents = raw.get("declared_total_cents")
        if isinstance(declared_cents, int) and declared_cents > 0:
            candidates.append(declared_cents / 100.0)
        if amount_text:
            candidates.extend(_extract_number_candidates(amount_text))

        subtotal = _parse_float_safe(raw.get("subtotal_raw"))
        tax_total = 0.0
        try:
            for t in (raw.get("taxes") or []):
                tax_total += _parse_float_safe(t.get("amount_raw"))
        except Exception:
            tax_total = 0.0
        expected = (subtotal + tax_total) if (subtotal > 0 and tax_total > 0) else None

        for c in candidates:
            if c <= 0:
                continue
            if max_item > 0 and c + 0.01 < max_item:
                continue

            # Scoring: menor = mejor
            score = 0.0
            if has_kw:
                score -= 100.0
            if expected is not None and expected > 0:
                score += abs(c - expected)

            # Penalizar enteros puros (a veces son folios/tickets)
            if abs(c - round(c)) < 1e-9:
                score += 1.0

            # Tie-breaker leve por cercanía a suma de items
            if sum_items > 0:
                score += abs(c - sum_items) * 0.01

            if best_score is None or score < best_score:
                best_score = score
                best_total = c
                best_source = f"totals_part_{idx}"
                best_raw = raw

    if best_total > 0:
        return best_total, best_source, best_raw

    # 2) Fallback al método anterior (por partes de items)
    fallback_total, fallback_source = _pick_declared_total(receipt_raws, sum_items=sum_items, max_item=max_item)
    return fallback_total, fallback_source, None


def _detect_image_format(file: UploadFile, image_bytes: bytes) -> str:
    image_format = "jpeg"
    if file.content_type:
        ct = file.content_type.lower()
        if "png" in ct:
            image_format = "png"
        elif "gif" in ct:
            image_format = "gif"
        elif "webp" in ct:
            image_format = "webp"
        elif "jpg" in ct or "jpeg" in ct:
            image_format = "jpeg"
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        image_format = "png"
    elif image_bytes.startswith(b"\xff\xd8\xff"):
        image_format = "jpeg"
    elif image_bytes.startswith(b"GIF87a") or image_bytes.startswith(b"GIF89a"):
        image_format = "gif"
    elif image_bytes.startswith(b"RIFF") and b"WEBP" in image_bytes[:12]:
        image_format = "webp"
    return image_format


def _crop_image_bottom(image_bytes: bytes, crop_height: int = 1700, max_width: int = 1700) -> bytes:
    """
    Devuelve un recorte del PIE del recibo (donde suele estar el TOTAL).
    Siempre devuelve JPEG (bytes). Si Pillow no está disponible, regresa el original.
    """
    try:
        from PIL import Image
    except ImportError:
        return image_bytes

    try:
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size

        if max_width and width > max_width:
            ratio = max_width / width
            img = img.resize((int(width * ratio), int(height * ratio)), Image.Resampling.LANCZOS)
            width, height = img.size

        h = min(crop_height, height)
        top = max(0, height - h)
        crop = img.crop((0, top, width, height))
        buf = io.BytesIO()
        crop.save(buf, format="JPEG", quality=95, optimize=True)
        return buf.getvalue()
    except Exception:
        return image_bytes


def _split_image_parts(image_bytes: bytes, aggressive: bool = False) -> List[bytes]:
    try:
        from PIL import Image
    except ImportError:
        return [image_bytes]
    try:
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size
        # Determinar número de partes según altura (más partes = menos alucinación/menos truncamiento)
        if aggressive:
            if height > 9000:
                num_parts = 8
            elif height > 7000:
                num_parts = 7
            elif height > 5500:
                num_parts = 6
            elif height > 4200:
                num_parts = 5
            elif height > 3000:
                num_parts = 4
            elif height > 2000:
                num_parts = 3
            elif height > 1200:
                num_parts = 2
            else:
                return [image_bytes]
            max_width = 1700
        else:
            if height > 9000:
                num_parts = 7
            elif height > 7000:
                num_parts = 6
            elif height > 5200:
                num_parts = 5
            elif height > 3600:
                num_parts = 4
            elif height > 2500:
                num_parts = 3
            elif height > 1700:
                num_parts = 2
            else:
                return [image_bytes]
            max_width = 1400

        # Redimensionar ancho máximo (evitar bajar demasiado resolución en recibos medianos)
        if max_width and width > max_width:
            ratio = max_width / width
            img = img.resize((int(width * ratio), int(height * ratio)), Image.Resampling.LANCZOS)
            width, height = img.size

        parts = []
        step = height // num_parts
        overlap = 260  # solapamiento para no perder renglones
        for i in range(num_parts):
            top = max(0, i * step - overlap if i > 0 else 0)
            bottom = height if i == num_parts - 1 else min(height, (i + 1) * step + overlap)
            crop = img.crop((0, top, width, bottom))
            buf = io.BytesIO()
            crop.save(buf, format="JPEG", quality=92, optimize=True)
            parts.append(buf.getvalue())
        return parts
    except Exception:
        return [image_bytes]


@router.post("/process")
async def process_receipt(
    request: Request,
    files: List[UploadFile] = File(...),
    target_user_id: Optional[int] = Form(None),
    mode: Optional[str] = Form("precise"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Procesa uno o varios recibos en modo RAW (una llamada por imagen a gpt-4o, sin OCR ni conteo previo).
    Si se suben varias imágenes, se combinan en un solo recibo concatenando los renglones.
    """
    import asyncio
    import json

    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="Debes subir al menos un archivo")

    # Determinar el usuario asignado (común para todos los archivos)
    assigned_user_id = target_user_id if target_user_id else current_user.id
    if target_user_id and target_user_id != current_user.id:
        assigned_user = db.query(models.User).filter(models.User.id == target_user_id).first()
        if not assigned_user or assigned_user.family_id != current_user.family_id:
            raise HTTPException(status_code=400, detail="El usuario asignado debe pertenecer a la misma familia")

    loop = asyncio.get_event_loop()
    receipt_raws: List[dict] = []
    totals_raws: List[dict] = []
    first_date = None
    first_time = None
    first_currency = None
    first_merchant = None
    parts_status: List[dict] = []
    totals_status: List[dict] = []
    all_parts_items: List[List[Dict[str, Any]]] = []
    items_before_dedup = 0

    # Guardar la imagen original (primera) para visualizar en "Registros de Usuario"
    saved_image_bytes: Optional[bytes] = None
    saved_image_ext: Optional[str] = None

    for file in files:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"El archivo {file.filename} debe ser una imagen")

        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail=f"El archivo {file.filename} está vacío")

        mode_norm = (mode or "precise").strip().lower()
        image_format = _detect_image_format(file, image_bytes)
        parts_bytes = _split_image_parts(image_bytes, aggressive=(mode_norm in ("precise", "text", "transcribe", "texto")))
        # Si se dividió con PIL, las partes se guardan como JPEG.
        part_image_format = "jpeg" if len(parts_bytes) > 1 else image_format

        # Recorte del PIE del recibo para extraer el TOTAL con mayor precisión
        totals_crop_bytes = _crop_image_bottom(
            image_bytes,
            crop_height=1900 if mode_norm in ("precise", "text", "transcribe", "texto") else 1500,
            max_width=1700,
        )
        totals_image_format = _detect_image_format(file, totals_crop_bytes)
        totals_base64 = base64.b64encode(totals_crop_bytes).decode("utf-8")

        # Guardar bytes/ext de la primera imagen subida
        if saved_image_bytes is None:
            saved_image_bytes = image_bytes
            saved_image_ext = "jpg" if image_format == "jpeg" else image_format

        # Procesar partes EN PARALELO para reducir tiempo total (wall-clock).
        part_jobs: List[Tuple[int, str]] = []
        for idx_part, part_bytes in enumerate(parts_bytes, start=1):
            part_jobs.append((idx_part, base64.b64encode(part_bytes).decode("utf-8")))

        part_timeout = float(os.getenv(
            "RECEIPT_PART_TIMEOUT_FAST" if mode_norm == "fast" else "RECEIPT_PART_TIMEOUT_PRECISE",
            "120" if mode_norm == "fast" else "300"
        ))

        totals_timeout = float(os.getenv(
            "RECEIPT_TOTAL_TIMEOUT_FAST" if mode_norm == "fast" else "RECEIPT_TOTAL_TIMEOUT_PRECISE",
            "60" if mode_norm == "fast" else "120"
        ))

        use_transcribe_mode = mode_norm in ("text", "transcribe", "texto")
        fallback_transcribe = str(os.getenv("RECEIPT_FALLBACK_TRANSCRIBE_ON_ERROR", "1")).strip().lower() not in ("0", "false", "no")

        # Evitar rate limits/errores por demasiadas llamadas concurrentes (especialmente en modo Preciso).
        part_concurrency = int(os.getenv(
            "RECEIPT_PART_CONCURRENCY_FAST" if mode_norm == "fast" else "RECEIPT_PART_CONCURRENCY_PRECISE",
            "4" if mode_norm == "fast" else "2",
        ))
        part_concurrency = max(1, min(8, part_concurrency))
        sem = asyncio.Semaphore(part_concurrency)

        async def _call_part(fn, *args, timeout: float):
            async with sem:
                return await asyncio.wait_for(loop.run_in_executor(None, fn, *args), timeout=timeout)

        async def _run_totals():
            try:
                res = await _call_part(
                    receipt_processor.process_receipt_totals_image,
                    totals_base64,
                    totals_image_format,
                    mode,
                    timeout=totals_timeout,
                )
                return {"ok": True, "result": res}
            except Exception as e:
                if isinstance(e, asyncio.TimeoutError):
                    return {"ok": False, "error": "Totals request timed out."}
                return {"ok": False, "error": str(e)}

        transcribe_timeout = float(os.getenv("RECEIPT_TRANSCRIBE_TIMEOUT", "180"))

        async def _run_part(idx: int, b64: str):
            attempts = 0
            method = "transcribe" if use_transcribe_mode else "structured"
            primary_fn = receipt_processor.transcribe_receipt_image if use_transcribe_mode else receipt_processor.process_receipt_items_image
            last_err: Optional[BaseException] = None

            try:
                attempts += 1
                res = await _call_part(primary_fn, b64, part_image_format, mode, timeout=part_timeout)
                return {"part": idx, "ok": True, "method": method, "attempts": attempts, "result": res}
            except BaseException as e:
                last_err = e

            # Fallback automático: si el JSON estructurado falla, intentar transcripción de texto para NO perder la parte.
            if (not use_transcribe_mode) and fallback_transcribe:
                try:
                    attempts += 1
                    res = await _call_part(
                        receipt_processor.transcribe_receipt_image,
                        b64,
                        part_image_format,
                        mode,
                        timeout=min(part_timeout, transcribe_timeout),
                    )
                    return {
                        "part": idx,
                        "ok": True,
                        "method": "transcribe_fallback",
                        "attempts": attempts,
                        "fallback_error": (str(last_err)[:220] if last_err else None),
                        "result": res,
                    }
                except BaseException as e2:
                    last_err = e2

            if isinstance(last_err, asyncio.TimeoutError):
                err = "Request timed out."
            else:
                err = str(last_err) if last_err else "Unknown error"

            return {"part": idx, "ok": False, "method": method, "attempts": attempts, "error": err}

        totals_task = asyncio.create_task(_run_totals())
        part_tasks = [asyncio.create_task(_run_part(idx_part, part_base64)) for idx_part, part_base64 in part_jobs]
        part_results = await asyncio.gather(*part_tasks)
        totals_out = await totals_task

        # Procesar resultado de totales
        if not totals_out.get("ok"):
            totals_status.append({"ok": False, "error": totals_out.get("error")})
        else:
            totals_raw = totals_out.get("result")
            if totals_raw and isinstance(totals_raw, dict):
                totals_status.append({"ok": True, "amount_raw": totals_raw.get("amount_raw")})
                totals_raws.append(totals_raw)
                # Completar currency si llega aquí
                if first_currency is None and totals_raw.get("currency"):
                    first_currency = totals_raw.get("currency")
            else:
                totals_status.append({"ok": False, "error": "Empty totals result"})

        allow_placeholder = bool(totals_out.get("ok")) or any(bool(p.get("ok")) for p in (part_results or []))

        for pr in (part_results or []):
            idx_part = int(pr.get("part") or 0)
            ok = bool(pr.get("ok"))
            method = str(pr.get("method") or "")
            attempts = pr.get("attempts")

            if not ok:
                err = pr.get("error") or "Unknown error"
                parts_status.append({"part": idx_part, "ok": False, "items": 0, "error": err, "method": method, "attempts": attempts})

                # Mantener el orden: insertar placeholder para partes fallidas si al menos hubo señal útil (totales u otra parte OK)
                if allow_placeholder:
                    placeholder = {
                        "raw_line": f"no legible (parte {idx_part} no se pudo extraer)",
                        "quantity_raw": "",
                        "unit_price_raw": "",
                        "total_raw": "no legible",
                        "_system_placeholder": True,
                    }
                    items_before_dedup += 1
                    all_parts_items.append([placeholder])
                continue

            result = pr.get("result")

            # Si el resultado viene de transcripción (modo texto o fallback), convertir texto a items.
            if method.startswith("transcribe"):
                payload = result if isinstance(result, dict) else {}
                text = str(payload.get("text") or "").strip()
                if not text:
                    parts_status.append({"part": idx_part, "ok": False, "items": 0, "error": "Empty transcription", "method": method, "attempts": attempts})
                    if allow_placeholder:
                        placeholder = {
                            "raw_line": f"no legible (parte {idx_part} sin texto)",
                            "quantity_raw": "",
                            "unit_price_raw": "",
                            "total_raw": "no legible",
                            "_system_placeholder": True,
                        }
                        items_before_dedup += 1
                        all_parts_items.append([placeholder])
                    continue

                lines = [ln.strip() for ln in text.splitlines() if ln and ln.strip()]
                part_items: List[Dict[str, Any]] = []
                for ln in lines:
                    if _should_skip_transcribed_line(ln):
                        continue
                    up = ln.upper().strip()
                    total_raw = _extract_last_currency_amount_raw(ln)
                    if not total_raw:
                        # Mantener orden: si parece item pero no tiene monto, marcar monto como no legible.
                        has_letter = bool(re.search(r"[A-Z]", up))
                        has_digit = bool(re.search(r"\d", up))
                        if up == "NO LEGIBLE":
                            total_raw = "no legible"
                        elif has_letter and has_digit:
                            total_raw = "no legible"
                        else:
                            continue
                    line_type = _structured_line_type(ln)
                    cleaned_total = _apply_negative_marker_if_needed(ln, total_raw)
                    cleaned_total = _ensure_negative_if_adjustment_line(line_type, cleaned_total)
                    part_items.append({
                        "raw_line": ln,
                        "quantity_raw": "",
                        "unit_price_raw": "",
                        "total_raw": cleaned_total,
                        "_line_type": line_type,
                    })

                parts_status.append({"part": idx_part, "ok": True, "items": len(part_items), "method": method, "attempts": attempts, "fallback_error": pr.get("fallback_error")})
                receipt_raws.append({
                    "mode": "transcribe",
                    "method": method,
                    "attempts": attempts,
                    "fallback_error": pr.get("fallback_error"),
                    "part": idx_part,
                    "text": text[:20000],
                    "_meta": payload.get("_meta"),
                })
                items_before_dedup += len(part_items)
                all_parts_items.append(part_items)
                continue

            # Structured JSON normal
            receipt_raw = result
            if not receipt_raw or "items" not in receipt_raw:
                parts_status.append({"part": idx_part, "ok": False, "items": 0, "error": "Empty items result", "method": method or "structured", "attempts": attempts})
                if allow_placeholder:
                    placeholder = {
                        "raw_line": f"no legible (parte {idx_part} sin items)",
                        "quantity_raw": "",
                        "unit_price_raw": "",
                        "total_raw": "no legible",
                        "_system_placeholder": True,
                    }
                    items_before_dedup += 1
                    all_parts_items.append([placeholder])
                continue

            parts_status.append({"part": idx_part, "ok": True, "items": len(receipt_raw.get("items") or []), "method": method or "structured", "attempts": attempts})
            receipt_raws.append(receipt_raw)

            if first_date is None and receipt_raw.get("date"):
                first_date = receipt_raw.get("date")
            if first_time is None and receipt_raw.get("time"):
                first_time = receipt_raw.get("time")
            if first_currency is None and receipt_raw.get("currency"):
                first_currency = receipt_raw.get("currency")
            if first_merchant is None and receipt_raw.get("merchant_or_beneficiary"):
                first_merchant = receipt_raw.get("merchant_or_beneficiary")

            items = receipt_raw.get("items") or []
            part_items: List[Dict[str, Any]] = []
            for item in items:
                raw_line = str(item.get("raw_line", "") or "")
                quantity_raw = str(item.get("quantity_raw", "") or "")
                unit_price_raw = str(item.get("unit_price_raw", "") or "")
                total_raw = str(item.get("total_raw", "") or "")

                line_type = _structured_line_type(raw_line)

                # Preservar negativos marcados al final del renglón (ej. "85.90-")
                total_raw = _apply_negative_marker_if_needed(raw_line, total_raw)
                unit_price_raw = _apply_negative_marker_if_needed(raw_line, unit_price_raw)
                quantity_raw = _apply_negative_marker_if_needed(raw_line, quantity_raw)

                # Si el modelo omitió total_raw, intentar extraerlo del raw_line (sin inventar).
                if not total_raw and raw_line:
                    extracted = _extract_last_currency_amount_raw(raw_line)
                    if extracted:
                        total_raw = _apply_negative_marker_if_needed(raw_line, extracted)

                total_raw = _ensure_negative_if_adjustment_line(line_type, total_raw)

                part_items.append({
                    "raw_line": raw_line,
                    "quantity_raw": quantity_raw,
                    "unit_price_raw": unit_price_raw,
                    "total_raw": total_raw,
                    "_line_type": line_type,
                })
            items_before_dedup += len(part_items)
            all_parts_items.append(part_items)

    if not receipt_raws and items_before_dedup == 0:
        # Incluir una pista del motivo real (timeout, rate limit, imagen inválida, JSON, etc.)
        try:
            errors = [ps.get("error") for ps in parts_status if ps.get("error")]
            # Tomar el primer error no vacío (y truncarlo).
            hint = ""
            for e in errors:
                if not e:
                    continue
                hint = re.sub(r"\s+", " ", str(e)).strip()
                break
            if hint:
                hint = hint[:240]
                print(f"❌ Receipt extraction failed. Hint: {hint}")
            else:
                print("❌ Receipt extraction failed. No hint available.")
        except Exception:
            hint = ""

        # Si el error ya es explícito (ej. OpenAI cuota), no confundir con “foto más clara”.
        if hint.startswith("OpenAI:"):
            raise HTTPException(status_code=500, detail=f"No se pudo extraer información. {hint}")

        # Si al menos pudimos leer el TOTAL desde el pie, crear recibo con placeholder para corrección manual.
        has_totals = any(
            isinstance(t, dict) and isinstance(t.get("declared_total_cents"), int) and (t.get("declared_total_cents") or 0) > 0
            for t in (totals_raws or [])
        )
        if has_totals:
            print("⚠️ No se pudieron extraer items, pero sí se detectaron totales. Se creará recibo con placeholder.")
        else:
            raise HTTPException(
                status_code=500,
                detail=(
                    "No se pudo extraer información del recibo. Intenta una foto más clara o cambia el modo (Rápido/Preciso)."
                    + (f" Detalle: {hint}" if hint else "")
                )
            )

        # Nota: se continúa para crear el recibo con ajuste (abajo).

    # Crear un solo recibo combinando todos los renglones
    combined_items, dedup_removed = _merge_items_with_overlap_dedup(all_parts_items)
    sum_items_before = sum(_parse_float_safe(it.get("total_raw")) for it in combined_items)
    max_item = max((_parse_float_safe(it.get("total_raw")) for it in combined_items), default=0.0)
    declared_total, total_source, chosen_totals_raw = _pick_declared_total_v2(
        receipt_raws=receipt_raws,
        totals_raws=totals_raws,
        sum_items=sum_items_before,
        max_item=max_item,
    )
    chosen_amount = declared_total if declared_total > 0 else sum_items_before

    expected_items_count: Optional[int] = None
    try:
        if isinstance(chosen_totals_raw, dict) and isinstance(chosen_totals_raw.get("items_count"), int):
            expected_items_count = int(chosen_totals_raw.get("items_count"))
    except Exception:
        expected_items_count = None

    extracted_items_count = len(combined_items)
    missing_items_count = (expected_items_count - extracted_items_count) if isinstance(expected_items_count, int) else None

    diff_before = (declared_total - sum_items_before) if declared_total > 0 else None
    reconcile_threshold = float(os.getenv("RECEIPT_RECONCILE_THRESHOLD", "0.5"))
    combined_items_final: List[Dict[str, Any]] = list(combined_items)
    placeholders_added: int = 0
    adjustment_added: Optional[float] = None
    sum_items_after = sum_items_before

    # Si el recibo declara un # de artículos, insertar placeholders para conservar el conteo (sin inventar montos).
    if isinstance(missing_items_count, int) and missing_items_count > 0:
        placeholders_added = missing_items_count
        placeholders: List[Dict[str, Any]] = []
        for i in range(missing_items_count):
            placeholders.append({
                "raw_line": "no legible",
                "quantity_raw": "",
                "unit_price_raw": "",
                "total_raw": "no legible",
                "_system_placeholder": True,
                "_line_type": "placeholder",
                "_placeholder_idx": i + 1,
                "_placeholder_total": missing_items_count,
            })
        combined_items_final = _interleave_placeholders_evenly(combined_items_final, placeholders)

    # Reconciliar para que el total "cuadre" sin inventar items.
    # - Si falta monto (diff > 0): es muy probable que haya renglones no legibles/omitidos.
    # - Si sobra monto (diff < 0): normalmente hay promociones/descuentos/cancelaciones no desglosadas como items.
    if declared_total > 0 and diff_before is not None and abs(diff_before) >= reconcile_threshold:
        adjustment_added = round(diff_before, 2)
        if diff_before > 0:
            if isinstance(missing_items_count, int) and missing_items_count > 0:
                label = f"NO LEGIBLE (FALTAN {missing_items_count} RENGLONES) — DIFERENCIA PARA CUADRAR TOTAL"
            else:
                label = "NO LEGIBLE (DIFERENCIA PARA CUADRAR TOTAL)"
        else:
            label = "PROMOCIONES/DESCUENTOS/CANCELACIONES (NO DESGLOSADOS) — AJUSTE PARA CUADRAR TOTAL"
        combined_items_final.append({
            "raw_line": label,
            "quantity_raw": "",
            "unit_price_raw": "",
            "total_raw": f"{diff_before:.2f}",
            "_system_adjustment": True,
        })
        sum_items_after = sum_items_before + diff_before

    merge_meta = {
        "parts": len(all_parts_items),
        "items_before_dedup": items_before_dedup,
        "items_after_dedup": len(combined_items),
        "items_after_adjustment": len(combined_items_final),
        "dedup_removed": dedup_removed,
        "mode": (mode or "precise"),
        "placeholders_added": placeholders_added,
    }
    arith_meta = {
        "declared_total": declared_total,
        "sum_items": sum_items_before,
        "diff_total_minus_items": diff_before,
        "adjustment_added": adjustment_added,
        "sum_items_after_adjustment": sum_items_after,
        "max_item": max_item,
        "total_source": total_source,
        "expected_items_count": expected_items_count,
        "extracted_items_count": extracted_items_count,
        "missing_items_count": missing_items_count,
        "placeholders_added": placeholders_added,
    }

    db_receipt = models.Receipt(
        user_id=assigned_user_id,
        date=first_date,
        time=first_time,
        amount=chosen_amount,
        currency=first_currency or "MXN",
        merchant_or_beneficiary=first_merchant,
        status="pending",
        notes=json.dumps(
            {
                "raw_receipts": receipt_raws,
                "totals": chosen_totals_raw,
                "totals_candidates": totals_raws,
                "parts_status": parts_status,
                "totals_status": totals_status,
                "merge": merge_meta,
                "arith": arith_meta,
            },
            ensure_ascii=False,
        ),
    )
    db.add(db_receipt)
    db.flush()

    # Persistir imagen del recibo y exponer URL
    try:
        if saved_image_bytes and saved_image_ext:
            backend_dir = Path(__file__).resolve().parents[2]  # .../backend
            upload_dir = backend_dir / "uploads" / "receipts"
            upload_dir.mkdir(parents=True, exist_ok=True)
            filename = f"receipt_{db_receipt.id}.{saved_image_ext}"
            file_path = upload_dir / filename
            file_path.write_bytes(saved_image_bytes)
            base_url = str(request.base_url).rstrip("/")
            db_receipt.image_url = f"{base_url}/uploads/receipts/{filename}"
            db.add(db_receipt)
    except Exception:
        # Si falla guardar imagen, no bloquear el flujo de extracción.
        pass

    # Guardar los renglones combinados
    for idx, item in enumerate(combined_items_final, start=1):
        raw_line = str(item.get("raw_line") or "").strip()
        if not raw_line:
            raw_line = "no legible"
        quantity_raw = str(item.get("quantity_raw") or "").strip()
        unit_price_raw = str(item.get("unit_price_raw") or "").strip()
        total_raw = str(item.get("total_raw") or "").strip()

        is_adjustment = bool(item.get("_system_adjustment"))
        is_placeholder = bool(item.get("_system_placeholder"))
        amount_val = _parse_float_safe(total_raw)
        quantity_val = _parse_float_safe(quantity_raw) if quantity_raw and quantity_raw.lower() != "no legible" else None
        unit_price_val = _parse_float_safe(unit_price_raw) if unit_price_raw and unit_price_raw.lower() != "no legible" else None

        item_notes = {
            "line_number": idx,
            "raw_line": raw_line,
            "quantity_raw": quantity_raw,
            "unit_price_raw": unit_price_raw,
            "total_raw": total_raw,
            # Considerar legible si hay dígitos (incluye "0.00"); "no legible" no trae números.
            "amount_legible": bool(re.search(r"\d", total_raw)) if total_raw else False,
            "is_adjustment": is_adjustment,
            "derived_amount": is_adjustment,
            "is_placeholder": is_placeholder,
            "line_type": str(item.get("_line_type") or "").strip()
            or ("adjustment" if is_adjustment else ("placeholder" if is_placeholder else "item")),
            "placeholder_idx": int(item.get("_placeholder_idx")) if is_placeholder and item.get("_placeholder_idx") else None,
            "placeholder_total": int(item.get("_placeholder_total")) if is_placeholder and item.get("_placeholder_total") else None,
        }
        receipt_item = models.ReceiptItem(
            receipt_id=db_receipt.id,
            description=raw_line,
            amount=amount_val,
            quantity=quantity_val,
            unit_price=unit_price_val,
            unit_of_measure=None,
            category=None,
            subcategory=None,
            notes=json.dumps(item_notes, ensure_ascii=False),
        )
        db.add(receipt_item)

    db.commit()
    db.refresh(db_receipt)
    db_receipt.items = db.query(models.ReceiptItem).filter(
        models.ReceiptItem.receipt_id == db_receipt.id
    ).all()

    return {
        "message": "Recibo combinado procesado y guardado exitosamente (RAW)",
        "receipt": schemas.ReceiptResponse.model_validate(db_receipt),
        "receipt_id": db_receipt.id,
        "parts_status": parts_status,
        "totals_status": totals_status,
    }

@router.get("/", response_model=List[schemas.ReceiptResponse])
def get_receipts(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Obtiene todos los recibos del usuario actual.
    """
    query = db.query(models.Receipt).filter(models.Receipt.user_id == current_user.id)
    
    if status:
        query = query.filter(models.Receipt.status == status)
    
    receipts = query.order_by(models.Receipt.created_at.desc()).offset(skip).limit(limit).all()
    
    # Cargar items para cada recibo
    for receipt in receipts:
        receipt.items = db.query(models.ReceiptItem).filter(
            models.ReceiptItem.receipt_id == receipt.id
        ).all()
    
    return receipts

@router.get("/{receipt_id}", response_model=schemas.ReceiptResponse)
def get_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Obtiene un recibo específico por ID.
    """
    receipt = db.query(models.Receipt).filter(
        models.Receipt.id == receipt_id,
        models.Receipt.user_id == current_user.id
    ).first()
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Recibo no encontrado")
    
    # Cargar items
    receipt.items = db.query(models.ReceiptItem).filter(
        models.ReceiptItem.receipt_id == receipt.id
    ).all()
    
    return receipt

@router.post("/{receipt_id}/assign")
def assign_receipt(
    receipt_id: int,
    assign_request: schemas.ReceiptAssignRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Asigna un recibo a una cuenta del presupuesto y crea una transacción.
    Flujo:
    1. Se asigna a una cuenta del presupuesto (OBLIGATORIO)
    2. Se asigna a un usuario específico o a todos los usuarios
    3. Se crea una transacción automáticamente si no se proporciona transaction_id
    """
    receipt = db.query(models.Receipt).filter(
        models.Receipt.id == receipt_id,
        models.Receipt.user_id == current_user.id
    ).first()
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Recibo no encontrado")
    
    # Validar que se haya proporcionado family_budget_id
    if not assign_request.family_budget_id:
        raise HTTPException(status_code=400, detail="Debes seleccionar una cuenta del presupuesto")
    
    # Verificar que el presupuesto exista y pertenezca a la familia
    family_budget = db.query(models.FamilyBudget).filter(
        models.FamilyBudget.id == assign_request.family_budget_id,
        models.FamilyBudget.family_id == current_user.family_id
    ).first()
    
    if not family_budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado o no pertenece a tu familia")
    
    try:
        # Determinar usuarios a los que se asignará
        users_to_assign = []
        if assign_request.assign_to_all:
            # Asignar a todos los usuarios de la familia (explícito)
            family_users = db.query(models.User).filter(
                models.User.family_id == current_user.family_id,
                models.User.is_active == True
            ).all()
            users_to_assign = family_users
        elif assign_request.target_user_id:
            # Asignar a un usuario específico
            target_user = db.query(models.User).filter(
                models.User.id == assign_request.target_user_id,
                models.User.family_id == current_user.family_id
            ).first()
            if not target_user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            users_to_assign = [target_user]
        else:
            # Default sensato: si no se selecciona usuario, asignar al usuario actual (NO a todos)
            users_to_assign = [current_user]
        
        # Si se proporciona transaction_id, usar esa transacción existente
        if assign_request.transaction_id:
            # Verificar que la transacción pertenezca al usuario
            transaction = db.query(models.Transaction).filter(
                models.Transaction.id == assign_request.transaction_id,
                models.Transaction.user_id == current_user.id
            ).first()
            
            if not transaction:
                raise HTTPException(status_code=404, detail="Transacción no encontrada")
            
            receipt.assigned_transaction_id = assign_request.transaction_id
            receipt.status = "assigned"
            
            # Asignar todos los items del recibo a la misma transacción
            items = db.query(models.ReceiptItem).filter(
                models.ReceiptItem.receipt_id == receipt.id
            ).all()
            
            for item in items:
                item.assigned_transaction_id = assign_request.transaction_id
        else:
            # Crear nueva transacción automáticamente
            # Si hay múltiples usuarios, crear una transacción por usuario
            created_transactions = []
            percentage = assign_request.percentage or 100.0
            amount_per_user = (receipt.amount * percentage / 100.0) / len(users_to_assign) if users_to_assign else receipt.amount
            
            for user in users_to_assign:
                # Usar categoría/subcategoría del recibo si existe; si no, usar la cuenta (presupuesto) seleccionada.
                tx_category = receipt.category or family_budget.category
                tx_subcategory = receipt.subcategory or family_budget.subcategory
                if not tx_category or not tx_subcategory:
                    raise HTTPException(
                        status_code=400,
                        detail="No se pudo determinar categoría/subcategoría para la transacción. Selecciona una cuenta del presupuesto válida."
                    )

                # Convertir fecha del recibo a datetime
                transaction_date = datetime.now()
                if receipt.date:
                    if isinstance(receipt.date, str):
                        try:
                            # Intentar parsear como fecha (YYYY-MM-DD) o datetime
                            if receipt.time:
                                date_str = f"{receipt.date} {receipt.time}"
                                transaction_date = datetime.strptime(date_str, "%Y-%m-%d %H:%M")
                            else:
                                # Si solo hay fecha, usar medianoche
                                transaction_date = datetime.strptime(receipt.date, "%Y-%m-%d")
                        except (ValueError, TypeError) as e:
                            # Si falla, usar fecha/hora actual
                            transaction_date = datetime.now()
                            print(f"⚠️ Error al parsear fecha '{receipt.date}': {e}, usando fecha actual")
                    elif isinstance(receipt.date, datetime):
                        transaction_date = receipt.date
                    elif hasattr(receipt.date, 'date'):
                        # Si es un objeto date, convertirlo a datetime
                        transaction_date = datetime.combine(receipt.date.date() if hasattr(receipt.date, 'date') else receipt.date, datetime.min.time())
                    else:
                        transaction_date = datetime.now()
                
                # Crear transacción para este usuario
                db_transaction = models.Transaction(
                    user_id=user.id,
                    family_budget_id=assign_request.family_budget_id,
                    date=transaction_date,
                    amount=amount_per_user,
                    transaction_type=models.TransactionType.EXPENSE.value,  # Los recibos son siempre egresos
                    currency=receipt.currency or "MXN",
                    merchant_or_beneficiary=receipt.merchant_or_beneficiary,
                    category=tx_category,
                    subcategory=tx_subcategory,
                    custom_category_id=family_budget.custom_category_id,
                    custom_subcategory_id=family_budget.custom_subcategory_id,
                    concept=receipt.concept or f"Recibo {receipt.merchant_or_beneficiary or 'sin comercio'}",
                    reference=receipt.reference,
                    operation_id=receipt.operation_id,
                    tracking_key=receipt.tracking_key,
                    notes=receipt.notes,
                    status=models.TransactionStatus.PROCESSED
                )
                db.add(db_transaction)
                db.flush()  # Para obtener el ID
                created_transactions.append(db_transaction)
                
                # Actualizar el presupuesto del usuario
                user_budget = db.query(models.UserBudget).filter(
                    models.UserBudget.user_id == user.id,
                    models.UserBudget.family_budget_id == assign_request.family_budget_id
                ).first()
                
                if user_budget:
                    user_budget.spent_amount = (user_budget.spent_amount or 0.0) + amount_per_user
                    db.add(user_budget)
            
            # Asignar el recibo a la primera transacción creada (o la única)
            if created_transactions:
                receipt.assigned_transaction_id = created_transactions[0].id
                receipt.status = "assigned"
                
                # Asignar todos los items del recibo a las transacciones creadas
                items = db.query(models.ReceiptItem).filter(
                    models.ReceiptItem.receipt_id == receipt.id
                ).all()
                
                # Distribuir items entre las transacciones
                items_per_transaction = len(items) // len(created_transactions) if created_transactions else 0
                for idx, item in enumerate(items):
                    transaction_idx = min(idx // (items_per_transaction + 1), len(created_transactions) - 1) if items_per_transaction > 0 else 0
                    item.assigned_transaction_id = created_transactions[transaction_idx].id
        
        # Si se asignan items individuales
        if assign_request.items:
            for item_data in assign_request.items:
                item_id = item_data.get("item_id")
                transaction_id = item_data.get("transaction_id")
                
                if item_id and transaction_id:
                    item = db.query(models.ReceiptItem).filter(
                        models.ReceiptItem.id == item_id,
                        models.ReceiptItem.receipt_id == receipt.id
                    ).first()
                    
                    if item:
                        # Verificar que la transacción pertenezca al usuario
                        transaction = db.query(models.Transaction).filter(
                            models.Transaction.id == transaction_id,
                            models.Transaction.user_id == current_user.id
                        ).first()
                        
                        if not transaction:
                            continue
                        
                        item.assigned_transaction_id = transaction_id
            
            # Actualizar estado del recibo si todos los items están asignados
            items = db.query(models.ReceiptItem).filter(
                models.ReceiptItem.receipt_id == receipt.id
            ).all()
            
            if all(item.assigned_transaction_id for item in items):
                receipt.status = "assigned"
        
        db.commit()
        db.refresh(receipt)
        
        # Cargar items actualizados
        receipt.items = db.query(models.ReceiptItem).filter(
            models.ReceiptItem.receipt_id == receipt.id
        ).all()
        
        return {
            "message": "Recibo asignado exitosamente",
            "receipt": schemas.ReceiptResponse.model_validate(receipt)
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        error_detail = f"Error al asignar recibo: {str(e)}"
        print(error_detail)
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_detail)

@router.post("/{receipt_id}/items")
def add_receipt_item(
    receipt_id: int,
    item: schemas.ReceiptItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Agrega un item (concepto) a un recibo.
    """
    receipt = db.query(models.Receipt).filter(
        models.Receipt.id == receipt_id,
        models.Receipt.user_id == current_user.id
    ).first()
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Recibo no encontrado")
    
    try:
        db_item = models.ReceiptItem(
            receipt_id=receipt.id,
            description=item.description,
            amount=item.amount,
            category=item.category,
            subcategory=item.subcategory,
            notes=item.notes
        )
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        
        return schemas.ReceiptItemResponse.model_validate(db_item)
    except Exception as e:
        db.rollback()
        import traceback
        error_detail = f"Error al agregar item: {str(e)}"
        print(error_detail)
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_detail)

@router.put("/items/{item_id}/assign")
def assign_receipt_item(
    item_id: int,
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Asigna un item específico del recibo a una transacción.
    """
    item = db.query(models.ReceiptItem).join(models.Receipt).filter(
        models.ReceiptItem.id == item_id,
        models.Receipt.user_id == current_user.id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    
    # Verificar que la transacción pertenezca al usuario
    transaction = db.query(models.Transaction).filter(
        models.Transaction.id == transaction_id,
        models.Transaction.user_id == current_user.id
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    
    try:
        item.assigned_transaction_id = transaction_id
        db.commit()
        db.refresh(item)
        
        return {
            "message": "Item asignado exitosamente",
            "item": schemas.ReceiptItemResponse.model_validate(item)
        }
    except Exception as e:
        db.rollback()
        import traceback
        error_detail = f"Error al asignar item: {str(e)}"
        print(error_detail)
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_detail)
