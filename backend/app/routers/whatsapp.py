from fastapi import APIRouter, Request, Form, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
import httpx
import base64
from datetime import datetime

# Imports opcionales para Twilio
try:
    from twilio.twiml.messaging_response import MessagingResponse
    from app.services import whatsapp_service, receipt_processor
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    MessagingResponse = None

router = APIRouter()

@router.post("/webhook")
async def whatsapp_webhook(
    request: Request,
    From: str = Form(...),
    Body: str = Form(None),
    MediaUrl0: str = Form(None),
    MediaUrl1: str = Form(None),
    MediaUrl2: str = Form(None),
    MediaUrl3: str = Form(None),
    MediaContentType0: str = Form(None),
    MessageSid: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Webhook para recibir mensajes de WhatsApp.
    Procesa imágenes de recibos automáticamente.
    """
    try:
        if not TWILIO_AVAILABLE or MessagingResponse is None:
            # Si Twilio no está disponible, retornar respuesta XML básica
            error_xml = '<?xml version="1.0" encoding="UTF-8"?><Response><Message>❌ Servicio de WhatsApp no disponible. Contacta al administrador.</Message></Response>'
            return Response(
                content=error_xml,
                media_type="text/xml",
                headers={"Content-Type": "text/xml; charset=utf-8"}
            )
        
        response = MessagingResponse()
        
        # Extraer y normalizar número de teléfono
        # Twilio puede enviar: "whatsapp:+525551234567" o "+525551234567"
        phone = From.replace("whatsapp:", "").strip()
        
        # Normalizar formato: asegurar que tenga el prefijo +
        if not phone.startswith("+"):
            # Si no tiene +, intentar agregarlo (asumiendo código de país de México)
            if phone.startswith("52"):
                phone = "+" + phone
            elif len(phone) == 10:
                # Número local de 10 dígitos, agregar código de país de México
                phone = "+52" + phone
        
        # CORREGIR: Twilio a veces agrega "1" extra después del código de país para México
        # Formato correcto: +52XXXXXXXXXX (12 dígitos después de +52)
        # Formato incorrecto de Twilio: +521XXXXXXXXXX (13 dígitos, con "1" extra)
        if phone.startswith("+521") and len(phone) >= 14:
            # Eliminar el "1" extra después de +52
            phone = "+52" + phone[4:]  # +521XXXXXXXXXX -> +52XXXXXXXXXX
            print(f"🔧 Número normalizado (eliminado '1' extra): {phone}")
        
        print(f"📱 Recibiendo mensaje de WhatsApp desde: {phone}")
        print(f"📨 MessageSid: {MessageSid}")
        
        # Verificar si este mensaje ya fue procesado (protección contra duplicados)
        existing_transaction = db.query(models.Transaction).filter(
            models.Transaction.whatsapp_message_id == MessageSid
        ).first()
        
        if existing_transaction:
            print(f"⚠️ Mensaje duplicado detectado (MessageSid: {MessageSid}). Ya fue procesado anteriormente.")
            # Para duplicados, retornar respuesta vacía para evitar que Twilio reenvíe la imagen
            # Twilio puede reenviar la imagen si respondemos con un mensaje
            empty_response = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
            return Response(
                content=empty_response,
                media_type="text/xml",
                headers={"Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-cache"}
            )
        
        # Buscar usuario por teléfono (intentar diferentes formatos)
        user = None
        
        # Intentar búsqueda exacta primero
        user = db.query(models.User).filter(models.User.phone == phone).first()
        
        # Si no se encuentra, intentar sin el prefijo +
        if not user and phone.startswith("+"):
            user = db.query(models.User).filter(models.User.phone == phone[1:]).first()
        
        # Si aún no se encuentra, intentar agregando el prefijo +
        if not user and not phone.startswith("+"):
            user = db.query(models.User).filter(models.User.phone == "+" + phone).first()
        
        # Normalizar números mexicanos: Twilio a veces agrega "1" después del código de país
        # Ejemplo: +5216865690472 (Twilio) vs +526865690472 (registrado)
        # Esta normalización ya se hizo arriba, pero intentar búsqueda con número normalizado si aún no se encontró
        if not user and phone.startswith("+521") and len(phone) >= 14:
            # El número ya fue normalizado arriba, pero intentar búsqueda directa con el número sin el "1"
            phone_without_one = "+52" + phone[4:]  # +5216865690472 -> +526865690472
            user = db.query(models.User).filter(models.User.phone == phone_without_one).first()
            if user:
                print(f"✅ Usuario encontrado con número normalizado: {phone} -> {phone_without_one}")
                phone = phone_without_one  # Actualizar phone para usar el número normalizado
        
        # Si aún no se encuentra, intentar búsqueda por últimos dígitos (últimos 7-10 dígitos)
        if not user:
            # Extraer los últimos dígitos del número (sin código de país)
            digits_only = ''.join(filter(str.isdigit, phone))
            if len(digits_only) >= 7:
                last_digits = digits_only[-10:]  # Últimos 10 dígitos
                # Buscar números que terminen igual
                user = db.query(models.User).filter(
                    models.User.phone.like(f"%{last_digits}")
                ).first()
                if user:
                    print(f"✅ Usuario encontrado por coincidencia parcial: {phone} -> ...{last_digits}")
        
        if not user:
            print(f"❌ Usuario no encontrado para el número: {phone}")
            error_msg = f"❌ No estás registrado en DOMUS+ con el número {phone}.\n\nPor favor, regístrate primero en la aplicación web o verifica que tu número de teléfono esté correctamente registrado."
            response.message(error_msg)
            response_xml = str(response)
            print(f"📤 Enviando respuesta (usuario no encontrado): {response_xml[:200]}...")
            return Response(
                content=response_xml,
                media_type="text/xml",
                headers={"Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-cache"}
            )
        
        print(f"✅ Usuario encontrado: {user.name} ({user.email})")
        print(f"📨 Mensaje recibido - Body: {Body}")
        print(f"📎 Media recibido - MediaUrl0: {MediaUrl0}, MediaUrl1: {MediaUrl1}, MediaUrl2: {MediaUrl2}, MediaUrl3: {MediaUrl3}")
        print(f"📋 Content-Type: {MediaContentType0}")
        
        # Variable para rastrear si se procesó algo
        mensaje_enviado = False
        
        # Determinar qué media usar (prioridad: MediaUrl0, MediaUrl1, MediaUrl2, MediaUrl3)
        media_url = None
        if MediaUrl0:
            media_url = MediaUrl0
        elif MediaUrl1:
            media_url = MediaUrl1
        elif MediaUrl2:
            media_url = MediaUrl2
        elif MediaUrl3:
            media_url = MediaUrl3
        
        # Si hay una imagen o archivo, procesarla
        if media_url:
            print(f"🖼️ Procesando archivo desde: {media_url}")
            print(f"   Tipo de contenido: {MediaContentType0}")
            
            # Verificar si es una imagen (solo procesamos imágenes)
            is_image = False
            if MediaContentType0:
                is_image = MediaContentType0.startswith('image/')
            else:
                # Si no hay Content-Type, asumir que es imagen si la URL contiene indicadores comunes
                is_image = any(ext in media_url.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '/image'])
            
            if not is_image:
                print(f"⚠️ Archivo no es una imagen (tipo: {MediaContentType0}), solo procesamos imágenes de recibos")
                response.message("❌ Solo puedo procesar imágenes de recibos. Por favor, envía una foto del recibo.")
                mensaje_enviado = True
            else:
                try:
                    # Descargar la imagen (Twilio puede requerir autenticación)
                    import os
                    twilio_account_sid = os.getenv("TWILIO_ACCOUNT_SID")
                    twilio_auth_token = os.getenv("TWILIO_AUTH_TOKEN")
                    
                    # Configurar autenticación básica si está disponible
                    auth = None
                    if twilio_account_sid and twilio_auth_token:
                        import base64 as b64
                        credentials = f"{twilio_account_sid}:{twilio_auth_token}"
                        auth_header = b64.b64encode(credentials.encode()).decode()
                        auth = ("Basic", auth_header)
                        print(f"🔐 Usando autenticación Twilio para descargar imagen")
                    
                    async with httpx.AsyncClient(follow_redirects=True) as client:
                        headers = {}
                        if auth:
                            headers["Authorization"] = f"Basic {auth[1]}"
                        
                        # Twilio puede devolver un redirect 307 a un CDN, httpx lo seguirá automáticamente
                        media_response = await client.get(media_url, headers=headers, timeout=30.0, follow_redirects=True)
                    
                    # Manejar errores específicos de Twilio
                    if media_response.status_code == 404:
                        raise ValueError("La imagen ya no está disponible en Twilio. Por favor, envía la foto nuevamente.")
                    
                    media_response.raise_for_status()  # Lanzar error si la respuesta no es exitosa
                    
                    image_data = media_response.content
                    print(f"📥 Imagen descargada: {len(image_data)} bytes")
                    
                    # Detectar el formato de la imagen
                    content_type = media_response.headers.get('content-type', '').lower()
                    print(f"📋 Content-Type recibido: {content_type}")
                    
                    image_format = 'jpeg'  # Por defecto
                    
                    if 'image/jpeg' in content_type or 'image/jpg' in content_type:
                        image_format = 'jpeg'
                    elif 'image/png' in content_type:
                        image_format = 'png'
                    elif 'image/gif' in content_type:
                        image_format = 'gif'
                    elif 'image/webp' in content_type:
                        image_format = 'webp'
                    else:
                        # Intentar detectar desde los bytes (magic numbers)
                        print(f"🔍 Detectando formato desde magic numbers...")
                        print(f"   Primeros bytes (hex): {image_data[:20].hex() if len(image_data) >= 20 else 'insuficientes'}")
                        
                        if image_data.startswith(b'\xff\xd8\xff'):
                            image_format = 'jpeg'
                            print(f"   ✅ Detectado: JPEG")
                        elif image_data.startswith(b'\x89PNG\r\n\x1a\n'):
                            image_format = 'png'
                            print(f"   ✅ Detectado: PNG")
                        elif image_data.startswith(b'GIF87a') or image_data.startswith(b'GIF89a'):
                            image_format = 'gif'
                            print(f"   ✅ Detectado: GIF")
                        elif image_data.startswith(b'RIFF') and b'WEBP' in image_data[:12]:
                            image_format = 'webp'
                            print(f"   ✅ Detectado: WebP")
                        else:
                            # Si no se puede detectar, intentar convertir a JPEG
                            print(f"   ⚠️  Formato no detectado, intentando convertir a JPEG...")
                            try:
                                from PIL import Image
                                import io
                                img = Image.open(io.BytesIO(image_data))
                                print(f"   📸 Imagen abierta: {img.format}, modo: {img.mode}, tamaño: {img.size}")
                                
                                # Convertir a RGB si es necesario (para PNG con transparencia, etc.)
                                if img.mode in ('RGBA', 'LA', 'P'):
                                    rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                                    if img.mode == 'P':
                                        img = img.convert('RGBA')
                                    rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                                    img = rgb_img
                                    print(f"   🔄 Convertido de {img.mode} a RGB")
                                elif img.mode != 'RGB':
                                    img = img.convert('RGB')
                                    print(f"   🔄 Convertido a RGB")
                                
                                # Guardar como JPEG en memoria
                                output = io.BytesIO()
                                img.save(output, format='JPEG', quality=95)
                                image_data = output.getvalue()
                                image_format = 'jpeg'
                                print(f"   ✅ Imagen convertida a JPEG: {len(image_data)} bytes")
                            except ImportError:
                                print(f"   ⚠️  PIL/Pillow no disponible, usando JPEG por defecto")
                            except Exception as conv_error:
                                print(f"   ❌ Error al convertir imagen: {conv_error}")
                                print(f"   ⚠️  Usando JPEG por defecto (puede fallar)")
                    
                    # SIEMPRE convertir a JPEG para asegurar compatibilidad con OpenAI
                    print(f"📸 Formato detectado: {image_format}, convirtiendo a JPEG para OpenAI...")
                    try:
                        from PIL import Image
                        import io
                        img = Image.open(io.BytesIO(image_data))
                        print(f"   📸 Imagen original: formato={img.format}, modo={img.mode}, tamaño={img.size}")
                        
                        # Convertir a RGB si es necesario
                        if img.mode in ('RGBA', 'LA', 'P'):
                            rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                            if img.mode == 'P':
                                img = img.convert('RGBA')
                            rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                            img = rgb_img
                        elif img.mode != 'RGB':
                            img = img.convert('RGB')
                        
                        # Guardar como JPEG en memoria
                        output = io.BytesIO()
                        img.save(output, format='JPEG', quality=95, optimize=True)
                        image_data = output.getvalue()
                        image_format = 'jpeg'
                        print(f"   ✅ Imagen convertida a JPEG: {len(image_data)} bytes")
                    except ImportError:
                        print(f"   ⚠️  PIL/Pillow no disponible, usando imagen original")
                        if image_format not in ['jpeg', 'png', 'gif', 'webp']:
                            image_format = 'jpeg'
                            print(f"   ⚠️  Formato no soportado, usando JPEG por defecto")
                    except Exception as conv_error:
                        print(f"   ⚠️  Error al convertir: {conv_error}, usando imagen original")
                        if image_format not in ['jpeg', 'png', 'gif', 'webp']:
                            image_format = 'jpeg'
                            print(f"   ⚠️  Formato no soportado, usando JPEG por defecto")
                    
                    print(f"📸 Formato final: {image_format}")
                    image_base64 = base64.b64encode(image_data).decode('utf-8')
                    print(f"📦 Imagen codificada: {len(image_base64)} caracteres")
                    
                    # Procesar el recibo
                    receipt_data = receipt_processor.process_receipt_image(image_base64, image_format=image_format)
                    
                    if receipt_data:
                        transaction_saved = False
                        try:
                            # Buscar el presupuesto correspondiente
                            family_budget = None
                            if user.family_id:
                                family_budget = db.query(models.FamilyBudget).filter(
                                    models.FamilyBudget.family_id == user.family_id,
                                    models.FamilyBudget.category == receipt_data.category,
                                    models.FamilyBudget.subcategory == receipt_data.subcategory
                                ).first()
                            
                            # Crear la transacción
                            date_str = f"{receipt_data.date} {receipt_data.time}"
                            try:
                                transaction_date = datetime.strptime(date_str, "%Y-%m-%d %H:%M")
                            except ValueError:
                                # Si falla el parseo, usar fecha actual
                                transaction_date = datetime.now()
                                print(f"⚠️ Error al parsear fecha '{date_str}', usando fecha actual")
                            
                            # Crear la transacción asociada al usuario que envió el mensaje
                            # Los recibos por WhatsApp son siempre egresos (gastos)
                            db_transaction = models.Transaction(
                                user_id=user.id,  # Asociado al usuario que envió el mensaje por WhatsApp
                                family_budget_id=family_budget.id if family_budget else None,
                                date=transaction_date,
                                amount=receipt_data.amount,
                                transaction_type=models.TransactionType.EXPENSE.value,  # Los recibos son siempre egresos
                                currency=receipt_data.currency,
                                merchant_or_beneficiary=receipt_data.merchant_or_beneficiary,
                                category=receipt_data.category,
                                subcategory=receipt_data.subcategory,
                                concept=receipt_data.concept,
                                reference=receipt_data.reference,
                                operation_id=receipt_data.operation_id,
                                tracking_key=receipt_data.tracking_key,
                                notes=receipt_data.notes,
                                receipt_image_url=media_url,
                                whatsapp_message_id=MessageSid,
                                whatsapp_phone=phone,  # Número de teléfono desde donde se envió el mensaje
                                status=models.TransactionStatus.PROCESSED
                            )
                            db.add(db_transaction)
                            
                            # Actualizar presupuesto si existe (solo para egresos)
                            if family_budget:
                                user_budget = db.query(models.UserBudget).filter(
                                    models.UserBudget.user_id == user.id,
                                    models.UserBudget.family_budget_id == family_budget.id
                                ).first()
                                
                                if user_budget:
                                    user_budget.spent_amount += receipt_data.amount
                                    db.add(user_budget)
                            
                            db.commit()
                            db.refresh(db_transaction)
                            transaction_saved = True
                            
                            print(f"✅ Transacción creada exitosamente para usuario {user.name} (ID: {user.id})")
                            print(f"   Monto: ${receipt_data.amount} {receipt_data.currency}")
                            print(f"   Categoría: {receipt_data.category} - {receipt_data.subcategory}")
                            print(f"   Teléfono origen (WhatsApp): {phone}")
                            print(f"   Timestamp de registro: {db_transaction.created_at}")
                            print(f"   Usuario: {user.name} ({user.email})")
                            
                        except Exception as db_error:
                            # Si hay un error al guardar, hacer rollback
                            db.rollback()
                            import traceback
                            print(f"❌ ERROR AL GUARDAR TRANSACCIÓN:")
                            print(f"   Tipo: {type(db_error).__name__}")
                            print(f"   Mensaje: {str(db_error)}")
                            print(traceback.format_exc())
                            raise  # Re-lanzar para que se capture en el except externo
                        
                        # Construir mensaje de confirmación (siempre, incluso si hay errores menores)
                        try:
                            confirmation_msg = f"✅ Recibo procesado exitosamente!\n\n"
                            confirmation_msg += f"💰 Monto: ${receipt_data.amount:,.2f} {receipt_data.currency}\n"
                            confirmation_msg += f"🏷️ Categoría: {receipt_data.category}\n"
                            confirmation_msg += f"📋 Subcategoría: {receipt_data.subcategory}\n"
                            if receipt_data.concept:
                                confirmation_msg += f"📝 Concepto: {receipt_data.concept}\n"
                            if receipt_data.merchant_or_beneficiary:
                                confirmation_msg += f"🏪 Comercio: {receipt_data.merchant_or_beneficiary}\n"
                            if family_budget:
                                confirmation_msg += f"📊 Presupuesto vinculado: {family_budget.category} - {family_budget.subcategory}\n"
                        except Exception as msg_error:
                            # Si hay error al construir el mensaje, usar uno simple
                            print(f"⚠️ Error al construir mensaje detallado: {str(msg_error)}, usando mensaje simple")
                            confirmation_msg = f"✅ Recibo procesado exitosamente!\n\n💰 Monto: ${receipt_data.amount:,.2f} {receipt_data.currency}\n🏷️ Categoría: {receipt_data.category}"
                        
                        # SIEMPRE enviar mensaje de confirmación si la transacción se guardó
                        if transaction_saved:
                            response.message(confirmation_msg)
                            mensaje_enviado = True
                            print(f"✅ Mensaje de confirmación preparado: {confirmation_msg[:50]}...")
                        else:
                            # Si no se guardó, el error ya se lanzó arriba
                            raise Exception("No se pudo guardar la transacción")
                    else:
                        error_msg = "❌ No pude procesar el recibo. Por favor, intenta con una imagen más clara."
                        response.message(error_msg)
                        mensaje_enviado = True
                        print(f"⚠️ {error_msg}")
                except Exception as download_error:
                    import traceback
                    error_detail = f"Error descargando imagen: {str(download_error)}"
                    print(f"❌ ERROR AL DESCARGAR IMAGEN:")
                    print(f"   Tipo: {type(download_error).__name__}")
                    print(f"   Mensaje: {error_detail}")
                    print(traceback.format_exc())
                    
                    error_str = str(download_error).lower()
                    if "404" in error_str or "not found" in error_str:
                        error_msg = "❌ La imagen ya no está disponible. Por favor, envía la foto nuevamente."
                    elif "timeout" in error_str or "connection" in error_str:
                        error_msg = "❌ Error de conexión al descargar la imagen. Por favor, intenta de nuevo."
                    else:
                        error_msg = "❌ Error al descargar la imagen. Por favor, intenta enviar la foto nuevamente."
                    
                    response.message(error_msg)
                    mensaje_enviado = True
        elif Body:
            # Procesar comandos de texto solo si no hay imagen
            command = Body.strip().lower()
            
            if command == "saldo" or command == "balance":
                # Obtener presupuestos del usuario
                user_budgets = db.query(models.UserBudget).filter(
                    models.UserBudget.user_id == user.id
                ).all()
                
                if user_budgets:
                    message = "📊 Tus Presupuestos:\n\n"
                    for budget in user_budgets:
                        # Calcular disponible: asignado + ingresos - gastado
                        income = getattr(budget, 'income_amount', 0) or 0
                        available = budget.allocated_amount + income - budget.spent_amount
                        message += f"• {budget.family_budget.category} - {budget.family_budget.subcategory}\n"
                        message += f"  Asignado: ${budget.allocated_amount:,.2f}\n"
                        if income > 0:
                            message += f"  Ingresos: ${income:,.2f}\n"
                        message += f"  Gastado: ${budget.spent_amount:,.2f}\n"
                        message += f"  Disponible: ${available:,.2f}\n\n"
                    response.message(message)
                    mensaje_enviado = True
                else:
                    response.message("No tienes presupuestos asignados.")
                    mensaje_enviado = True
            else:
                # Si hay texto pero no es un comando reconocido
                response.message("Envía una foto de tu recibo o transferencia para procesarla automáticamente.\n\n"
                               "Comandos disponibles:\n"
                               "• saldo - Ver tus presupuestos")
                mensaje_enviado = True
        else:
            # Si no hay imagen ni texto, enviar mensaje de ayuda
            print("⚠️ Mensaje recibido sin imagen ni texto")
            response.message("📸 Por favor, envía una foto de tu recibo o transferencia para procesarla automáticamente.")
            mensaje_enviado = True
        
        # Asegurar que SIEMPRE se envíe un mensaje de confirmación
        if not mensaje_enviado:
            default_msg = "✅ Mensaje recibido. Si enviaste una imagen, está siendo procesada."
            response.message(default_msg)
            mensaje_enviado = True
            print(f"📤 Enviando mensaje de confirmación por defecto: {default_msg}")
        
        # Verificar que el response tenga al menos un mensaje
        response_xml = str(response)
        if "<Message>" not in response_xml:
            print("⚠️ ADVERTENCIA: La respuesta no contiene ningún mensaje, agregando mensaje por defecto")
            response.message("✅ Mensaje recibido correctamente.")
            response_xml = str(response)
        
        # Asegurar que la respuesta solo contenga texto, no imágenes
        # Verificar que no haya referencias a MediaUrl en la respuesta
        if "MediaUrl" in response_xml or "<Media>" in response_xml:
            print("⚠️ ADVERTENCIA: La respuesta contiene referencias a media, limpiando...")
            # Reconstruir respuesta sin media
            response = MessagingResponse()
            if mensaje_enviado:
                # Si ya se había enviado un mensaje, extraerlo del XML anterior
                import re
                message_match = re.search(r'<Message>(.*?)</Message>', response_xml, re.DOTALL)
                if message_match:
                    response.message(message_match.group(1))
                else:
                    response.message("✅ Mensaje recibido correctamente.")
            else:
                response.message("✅ Mensaje recibido correctamente.")
            response_xml = str(response)
        
        print(f"📤 Enviando respuesta TwiML a Twilio:")
        print(f"   Longitud XML: {len(response_xml)} caracteres")
        print(f"   Contiene <Message>: {'<Message>' in response_xml}")
        print(f"   Contiene MediaUrl: {'MediaUrl' in response_xml}")
        print(f"   Primeros 200 caracteres: {response_xml[:200]}...")
        print(f"   Content-Type: text/xml")
        
        return Response(
            content=response_xml,
            media_type="text/xml",
            headers={
                "Content-Type": "text/xml; charset=utf-8",
                "Cache-Control": "no-cache"
            }
        )
    
    except Exception as e:
        import traceback
        error_detail = f"Error en webhook: {str(e)}"
        print(f"❌ ERROR CRÍTICO EN WEBHOOK: {error_detail}")
        print(traceback.format_exc())
        # Asegurar que siempre se retorne una respuesta, incluso en caso de error
        error_xml = '<?xml version="1.0" encoding="UTF-8"?><Response><Message>❌ Ocurrió un error al procesar tu mensaje. Por favor, intenta más tarde.</Message></Response>'
        if TWILIO_AVAILABLE and MessagingResponse is not None:
            try:
                response = MessagingResponse()
                response.message("❌ Ocurrió un error al procesar tu mensaje. Por favor, intenta más tarde.")
                error_xml = str(response)
            except:
                pass
        
        return Response(
            content=error_xml,
            media_type="text/xml",
            headers={"Content-Type": "text/xml; charset=utf-8"}
        )

