"""
Router para gestionar los logs de actividad del sistema
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from app.database import get_db
from app import models, schemas, auth
from sqlalchemy.orm import joinedload
from sqlalchemy import func

router = APIRouter()

@router.get("", response_model=List[schemas.ActivityLogResponse])
def get_activity_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    action_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    user_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Obtiene los logs de actividad del sistema.
    Solo los administradores pueden ver todos los logs.
    Los usuarios regulares solo pueden ver sus propios logs.
    """
    try:
        # Verificar permisos
        if not current_user.is_family_admin:
            # Usuarios no admin solo ven sus propios logs
            user_id = current_user.id
        
        # Construir query
        query = db.query(models.ActivityLog).options(
            joinedload(models.ActivityLog.user)
        )
        
        # Filtros
        if user_id:
            query = query.filter(models.ActivityLog.user_id == user_id)
        elif not current_user.is_family_admin:
            # Si no es admin, solo sus propios logs
            query = query.filter(models.ActivityLog.user_id == current_user.id)
        
        if action_type:
            query = query.filter(models.ActivityLog.action_type == action_type)
        
        if entity_type:
            query = query.filter(models.ActivityLog.entity_type == entity_type)
        
        if start_date:
            query = query.filter(models.ActivityLog.created_at >= start_date)
        
        if end_date:
            query = query.filter(models.ActivityLog.created_at <= end_date)
        
        # Ordenar por fecha descendente (más recientes primero)
        query = query.order_by(models.ActivityLog.created_at.desc())
        
        # Paginación
        logs = query.offset(skip).limit(limit).all()
        
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener logs: {str(e)}")

@router.get("/stats")
def get_activity_stats(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Obtiene estadísticas de actividad del sistema.
    Solo los administradores pueden ver estadísticas.
    """
    if not current_user.is_family_admin:
        raise HTTPException(status_code=403, detail="Solo los administradores pueden ver estadísticas")
    
    try:
        start_date = datetime.now() - timedelta(days=days)
        
        # Total de logs
        total_logs = db.query(models.ActivityLog).filter(
            models.ActivityLog.created_at >= start_date
        ).count()
        
        # Logs por tipo de acción
        action_counts = db.query(
            models.ActivityLog.action_type,
            func.count(models.ActivityLog.id).label('count')
        ).filter(
            models.ActivityLog.created_at >= start_date
        ).group_by(models.ActivityLog.action_type).all()
        
        # Logs por tipo de entidad
        entity_counts = db.query(
            models.ActivityLog.entity_type,
            func.count(models.ActivityLog.id).label('count')
        ).filter(
            models.ActivityLog.created_at >= start_date
        ).group_by(models.ActivityLog.entity_type).all()
        
        # Logs por usuario
        user_counts = db.query(
            models.ActivityLog.user_id,
            func.count(models.ActivityLog.id).label('count')
        ).filter(
            models.ActivityLog.created_at >= start_date,
            models.ActivityLog.user_id.isnot(None)
        ).group_by(models.ActivityLog.user_id).all()
        
        return {
            "total_logs": total_logs,
            "period_days": days,
            "by_action_type": {action: count for action, count in action_counts},
            "by_entity_type": {entity: count for entity, count in entity_counts},
            "by_user": {user_id: count for user_id, count in user_counts}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener estadísticas: {str(e)}")
