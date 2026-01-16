from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from app.services import receipt_processor
import base64
from typing import List, Optional
import io

router = APIRouter()

def _parse_float_safe(value) -> float:
    try:
        if value is None:
            return 0.0
        return float(str(value).replace(",", "").strip())
    except Exception:
        return 0.0


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


def _split_image_parts(image_bytes: bytes) -> List[bytes]:
    try:
        from PIL import Image
    except ImportError:
        return [image_bytes]
    try:
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size
        # Determinar número de partes según altura
        if height > 4000:
            num_parts = 4
        elif height > 2500:
            num_parts = 3
        elif height > 1600:
            num_parts = 2
        else:
            return [image_bytes]

        # Redimensionar ancho máximo a 1200 para acelerar
        if width > 1200:
            ratio = 1200 / width
            img = img.resize((1200, int(height * ratio)), Image.Resampling.LANCZOS)
            width, height = img.size

        parts = []
        step = height // num_parts
        overlap = 200  # solapamiento para no perder renglones
        for i in range(num_parts):
            top = max(0, i * step - overlap if i > 0 else 0)
            bottom = height if i == num_parts - 1 else min(height, (i + 1) * step + overlap)
            crop = img.crop((0, top, width, bottom))
            buf = io.BytesIO()
            crop.save(buf, format="JPEG", quality=90, optimize=True)
            parts.append(buf.getvalue())
        return parts
    except Exception:
        return [image_bytes]


@router.post("/process")
async def process_receipt(
    files: List[UploadFile] = File(...),
    target_user_id: Optional[int] = Form(None),
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
    combined_items: List[dict] = []
    receipt_raws: List[dict] = []
    first_date = None
    first_time = None
    first_currency = None
    first_merchant = None
    first_amount_raw = None
    parts_status: List[dict] = []

    for file in files:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"El archivo {file.filename} debe ser una imagen")

        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail=f"El archivo {file.filename} está vacío")

        image_format = _detect_image_format(file, image_bytes)
        parts_bytes = _split_image_parts(image_bytes)

        for idx_part, part_bytes in enumerate(parts_bytes, start=1):
            part_base64 = base64.b64encode(part_bytes).decode("utf-8")
            try:
                receipt_raw = await loop.run_in_executor(
                    None, receipt_processor.process_receipt_image, part_base64, image_format
                )
                if not receipt_raw or "items" not in receipt_raw:
                    parts_status.append({"part": idx_part, "ok": False, "items": 0})
                    continue
                parts_status.append({"part": idx_part, "ok": True, "items": len(receipt_raw.get("items") or [])})
                receipt_raws.append(receipt_raw)

                if first_date is None and receipt_raw.get("date"):
                    first_date = receipt_raw.get("date")
                if first_time is None and receipt_raw.get("time"):
                    first_time = receipt_raw.get("time")
                if first_currency is None and receipt_raw.get("currency"):
                    first_currency = receipt_raw.get("currency")
                if first_merchant is None and receipt_raw.get("merchant_or_beneficiary"):
                    first_merchant = receipt_raw.get("merchant_or_beneficiary")
                if first_amount_raw is None and receipt_raw.get("amount_raw"):
                    first_amount_raw = receipt_raw.get("amount_raw")

                items = receipt_raw.get("items") or []
                for item in items:
                    combined_items.append({
                        "raw_line": item.get("raw_line", ""),
                        "quantity_raw": item.get("quantity_raw", ""),
                        "unit_price_raw": item.get("unit_price_raw", ""),
                        "total_raw": item.get("total_raw", "")
                    })
            except ValueError as e:
                parts_status.append({"part": idx_part, "ok": False, "items": 0, "error": str(e)})
            except Exception as e:
                parts_status.append({"part": idx_part, "ok": False, "items": 0, "error": str(e)})

    # Crear un solo recibo combinando todos los renglones
    declared_total = _parse_float_safe(first_amount_raw)
    sum_items = sum(_parse_float_safe(it.get("total_raw")) for it in combined_items)
    chosen_amount = declared_total if declared_total > 0 else sum_items

    db_receipt = models.Receipt(
        user_id=assigned_user_id,
        date=first_date,
        time=first_time,
        amount=chosen_amount,
        currency=first_currency or "MXN",
        merchant_or_beneficiary=first_merchant,
        status="pending",
        notes=json.dumps({"raw_receipts": receipt_raws}),
    )
    db.add(db_receipt)
    db.flush()

    # Guardar los renglones combinados
    for idx, item in enumerate(combined_items, start=1):
        receipt_item = models.ReceiptItem(
            receipt_id=db_receipt.id,
            description=item.get("raw_line", ""),
            amount=_parse_float_safe(item.get("total_raw")),
            quantity=_parse_float_safe(item.get("quantity_raw")) if item.get("quantity_raw") else None,
            unit_price=_parse_float_safe(item.get("unit_price_raw")) if item.get("unit_price_raw") else None,
            unit_of_measure=None,
            category=None,
            subcategory=None,
            notes=f"line_number: {idx}",
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
        "parts_status": parts_status
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
        if assign_request.assign_to_all or not assign_request.target_user_id:
            # Asignar a todos los usuarios de la familia
            family_users = db.query(models.User).filter(
                models.User.family_id == current_user.family_id,
                models.User.is_active == True
            ).all()
            users_to_assign = family_users
        else:
            # Asignar a un usuario específico
            target_user = db.query(models.User).filter(
                models.User.id == assign_request.target_user_id,
                models.User.family_id == current_user.family_id
            ).first()
            if not target_user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            users_to_assign = [target_user]
        
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
                    category=receipt.category,
                    subcategory=receipt.subcategory,
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
