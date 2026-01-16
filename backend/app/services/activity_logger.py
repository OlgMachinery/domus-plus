"""
Servicio para registrar logs de actividad en el sistema
"""
from sqlalchemy.orm import Session
from app import models
from typing import Optional, Dict, Any, Tuple
from datetime import datetime

def log_activity(
    db: Session,
    action_type: str,
    entity_type: str,
    description: str,
    user_id: Optional[int] = None,
    entity_id: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """
    Registra una actividad en el log del sistema
    
    Args:
        db: Sesión de base de datos
        action_type: Tipo de acción (budget_created, budget_updated, transaction_created, etc.)
        entity_type: Tipo de entidad (budget, transaction, user, etc.)
        description: Descripción de la acción
        user_id: ID del usuario que realizó la acción
        entity_id: ID de la entidad afectada
        details: Diccionario con detalles adicionales
        ip_address: Dirección IP del usuario
        user_agent: User agent del navegador
    """
    try:
        log_entry = models.ActivityLog(
            user_id=user_id,
            action_type=action_type,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry
    except Exception as e:
        db.rollback()
        print(f"Error al registrar actividad en log: {str(e)}")
        # No lanzar excepción para no interrumpir el flujo principal
        return None

def get_client_info(request) -> tuple[Optional[str], Optional[str]]:
    """
    Extrae la IP y User-Agent de una request de FastAPI
    
    Returns:
        Tuple con (ip_address, user_agent)
    """
    try:
        # Intentar obtener IP real (puede estar detrás de un proxy)
        ip_address = request.client.host if request.client else None
        if hasattr(request, 'headers'):
            # Verificar headers comunes de proxy
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                ip_address = forwarded_for.split(",")[0].strip()
            real_ip = request.headers.get("X-Real-IP")
            if real_ip:
                ip_address = real_ip
        
        user_agent = request.headers.get("User-Agent") if hasattr(request, 'headers') else None
        
        return ip_address, user_agent
    except Exception:
        return None, None
