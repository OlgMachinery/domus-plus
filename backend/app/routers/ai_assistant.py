"""
Router para el asistente de IA con GPT
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.database import get_db
from app import models, auth
from app.services import ai_assistant

router = APIRouter()

class ChatMessage(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: str

class AnalysisRequest(BaseModel):
    budget_id: Optional[int] = None
    include_transactions: bool = True

@router.post("/chat", response_model=ChatResponse)
def chat_with_assistant(
    chat_message: ChatMessage,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Chatea con el asistente de IA.
    """
    if not ai_assistant.OPENAI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="El asistente de IA no está disponible. Verifica que OpenAI esté configurado."
        )
    
    # Obtener contexto del usuario
    user_context = {}
    
    # Obtener resumen de presupuesto
    try:
        user_budgets = db.query(models.UserBudget).filter(
            models.UserBudget.user_id == current_user.id
        ).all()
        
        total_budget = sum(ub.allocated_amount for ub in user_budgets)
        total_spent = sum(ub.spent_amount or 0 for ub in user_budgets)
        total_available = total_budget - total_spent
        
        user_context["budget_summary"] = {
            "total": total_budget,
            "spent": total_spent,
            "available": total_available
        }
    except Exception as e:
        print(f"Error obteniendo contexto de presupuesto: {e}")
    
    # Obtener transacciones recientes
    try:
        recent_transactions = db.query(models.Transaction).filter(
            models.Transaction.user_id == current_user.id
        ).order_by(models.Transaction.date.desc()).limit(5).all()
        
        user_context["recent_transactions"] = [
            {
                "description": t.description or "Sin descripción",
                "amount": float(t.amount),
                "category": t.category.value if t.category else "N/A",
                "date": t.date.isoformat() if t.date else None
            }
            for t in recent_transactions
        ]
    except Exception as e:
        print(f"Error obteniendo transacciones recientes: {e}")
        user_context["recent_transactions"] = []
    
    # Obtener items de recibos para análisis de consumo (ej: "cuanto tomate consumimos")
    try:
        # Obtener todos los items de recibos de la familia
        receipts = db.query(models.Receipt).join(models.User).filter(
            models.User.family_id == current_user.family_id
        ).all()
        
        receipt_items = []
        for receipt in receipts:
            items = db.query(models.ReceiptItem).filter(
                models.ReceiptItem.receipt_id == receipt.id
            ).all()
            for item in items:
                receipt_items.append({
                    "description": item.description,
                    "amount": float(item.amount),
                    "category": item.category.value if item.category else "N/A",
                    "subcategory": item.subcategory.value if item.subcategory else "N/A",
                    "date": receipt.date or receipt.created_at.isoformat() if receipt.created_at else None,
                    "merchant": receipt.merchant_or_beneficiary or "N/A"
                })
        
        user_context["receipt_items"] = receipt_items
        user_context["receipt_items_count"] = len(receipt_items)
    except Exception as e:
        print(f"Error obteniendo items de recibos: {e}")
        user_context["receipt_items"] = []
        user_context["receipt_items_count"] = 0
    
    # Obtener respuesta del asistente
    response_text = ai_assistant.get_ai_response(
        user_message=chat_message.message,
        user_context=user_context if user_context else None
    )
    
    # Generar ID de conversación si no existe
    import time
    conversation_id = chat_message.conversation_id or f"conv_{current_user.id}_{int(time.time())}"
    
    return ChatResponse(
        response=response_text,
        conversation_id=conversation_id
    )

@router.post("/analyze-budget")
def analyze_budget(
    request: AnalysisRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Analiza la situación del presupuesto y proporciona insights.
    """
    if not ai_assistant.OPENAI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="El asistente de análisis no está disponible."
        )
    
    # Obtener datos del presupuesto
    if request.budget_id:
        # Presupuesto específico
        user_budget = db.query(models.UserBudget).filter(
            models.UserBudget.id == request.budget_id,
            models.UserBudget.user_id == current_user.id
        ).first()
        
        if not user_budget:
            raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
        
        budget_data = {
            "total": float(user_budget.allocated_amount),
            "spent": float(user_budget.spent_amount or 0),
            "available": float(user_budget.allocated_amount - (user_budget.spent_amount or 0))
        }
        
        transactions = []
        if request.include_transactions:
            transactions_query = db.query(models.Transaction).filter(
                models.Transaction.family_budget_id == user_budget.family_budget_id,
                models.Transaction.user_id == current_user.id
            ).order_by(models.Transaction.date.desc()).limit(10).all()
            
            transactions = [
                {
                    "description": t.description or "Sin descripción",
                    "amount": float(t.amount),
                    "category": t.category.value if t.category else "N/A"
                }
                for t in transactions_query
            ]
    else:
        # Todos los presupuestos del usuario
        user_budgets = db.query(models.UserBudget).filter(
            models.UserBudget.user_id == current_user.id
        ).all()
        
        total_budget = sum(ub.allocated_amount for ub in user_budgets)
        total_spent = sum(ub.spent_amount or 0 for ub in user_budgets)
        
        budget_data = {
            "total": total_budget,
            "spent": total_spent,
            "available": total_budget - total_spent
        }
        
        transactions = []
        if request.include_transactions:
            transactions_query = db.query(models.Transaction).filter(
                models.Transaction.user_id == current_user.id
            ).order_by(models.Transaction.date.desc()).limit(10).all()
            
            transactions = [
                {
                    "description": t.description or "Sin descripción",
                    "amount": float(t.amount),
                    "category": t.category.value if t.category else "N/A"
                }
                for t in transactions_query
            ]
    
    # Obtener análisis
    analysis = ai_assistant.analyze_budget_situation(budget_data, transactions)
    
    return {
        "analysis": analysis,
        "budget_data": budget_data,
        "transactions_count": len(transactions)
    }

@router.post("/suggest-category")
def suggest_category(
    description: str,
    amount: float,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Sugiere una categoría y subcategoría para una transacción.
    """
    if not ai_assistant.OPENAI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="El asistente de sugerencias no está disponible."
        )
    
    # Obtener categorías disponibles
    available_categories = [
        cat.value for cat in models.Category
    ]
    
    suggestion = ai_assistant.suggest_category(
        description=description,
        amount=amount,
        available_categories=available_categories
    )
    
    if not suggestion:
        raise HTTPException(
            status_code=500,
            detail="No se pudo generar una sugerencia."
        )
    
    return suggestion

@router.post("/detect-anomalies")
def detect_anomalies(
    budget_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Detecta anomalías en los gastos (gastos inusuales, patrones sospechosos).
    """
    if not ai_assistant.OPENAI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="El análisis de anomalías no está disponible."
        )
    
    # Obtener transacciones
    query = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.transaction_type == models.TransactionType.EXPENSE.value
    )
    
    if budget_id:
        user_budget = db.query(models.UserBudget).filter(
            models.UserBudget.id == budget_id,
            models.UserBudget.user_id == current_user.id
        ).first()
        if user_budget:
            query = query.filter(
                models.Transaction.family_budget_id == user_budget.family_budget_id
            )
    
    transactions_query = query.order_by(models.Transaction.date.desc()).limit(limit).all()
    
    transactions = [
        {
            "description": t.description or "Sin descripción",
            "amount": float(t.amount),
            "category": t.category.value if t.category else "N/A",
            "date": t.date.isoformat() if t.date else None
        }
        for t in transactions_query
    ]
    
    # Obtener datos de presupuesto si está disponible
    budget_data = None
    if budget_id:
        user_budget = db.query(models.UserBudget).filter(
            models.UserBudget.id == budget_id,
            models.UserBudget.user_id == current_user.id
        ).first()
        if user_budget:
            budget_data = {
                "total": float(user_budget.allocated_amount),
                "spent": float(user_budget.spent_amount or 0),
                "available": float(user_budget.allocated_amount - (user_budget.spent_amount or 0))
            }
    
    # Detectar anomalías
    result = ai_assistant.detect_anomalies(transactions, budget_data)
    
    return result

@router.post("/predict-expenses")
def predict_expenses(
    months_ahead: int = 3,
    budget_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Predice gastos futuros basado en patrones históricos.
    """
    if not ai_assistant.OPENAI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="La predicción de gastos no está disponible."
        )
    
    # Obtener transacciones históricas (últimos 12 meses)
    from datetime import datetime, timedelta
    from sqlalchemy import and_
    
    one_year_ago = datetime.now() - timedelta(days=365)
    
    query = db.query(models.Transaction).filter(
        and_(
            models.Transaction.user_id == current_user.id,
            models.Transaction.transaction_type == models.TransactionType.EXPENSE.value,
            models.Transaction.date >= one_year_ago
        )
    )
    
    if budget_id:
        user_budget = db.query(models.UserBudget).filter(
            models.UserBudget.id == budget_id,
            models.UserBudget.user_id == current_user.id
        ).first()
        if user_budget:
            query = query.filter(
                models.Transaction.family_budget_id == user_budget.family_budget_id
            )
    
    transactions_query = query.order_by(models.Transaction.date.desc()).all()
    
    transactions = [
        {
            "description": t.description or "Sin descripción",
            "amount": float(t.amount),
            "category": t.category.value if t.category else "N/A",
            "date": t.date.isoformat() if t.date else None
        }
        for t in transactions_query
    ]
    
    # Predecir gastos
    predictions = ai_assistant.predict_future_expenses(transactions, months_ahead)
    
    return predictions

@router.post("/generate-report")
def generate_report(
    period: str = "mensual",
    budget_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Genera un reporte narrativo inteligente sobre la situación financiera.
    """
    if not ai_assistant.OPENAI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="La generación de reportes no está disponible."
        )
    
    # Obtener datos del presupuesto
    if budget_id:
        user_budget = db.query(models.UserBudget).filter(
            models.UserBudget.id == budget_id,
            models.UserBudget.user_id == current_user.id
        ).first()
        
        if not user_budget:
            raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
        
        budget_data = {
            "total": float(user_budget.allocated_amount),
            "spent": float(user_budget.spent_amount or 0),
            "available": float(user_budget.allocated_amount - (user_budget.spent_amount or 0))
        }
        
        transactions_query = db.query(models.Transaction).filter(
            models.Transaction.family_budget_id == user_budget.family_budget_id,
            models.Transaction.user_id == current_user.id
        ).order_by(models.Transaction.date.desc()).all()
    else:
        # Todos los presupuestos del usuario
        user_budgets = db.query(models.UserBudget).filter(
            models.UserBudget.user_id == current_user.id
        ).all()
        
        total_budget = sum(ub.allocated_amount for ub in user_budgets)
        total_spent = sum(ub.spent_amount or 0 for ub in user_budgets)
        
        budget_data = {
            "total": total_budget,
            "spent": total_spent,
            "available": total_budget - total_spent
        }
        
        transactions_query = db.query(models.Transaction).filter(
            models.Transaction.user_id == current_user.id
        ).order_by(models.Transaction.date.desc()).all()
    
    transactions = [
        {
            "description": t.description or "Sin descripción",
            "amount": float(t.amount),
            "category": t.category.value if t.category else "N/A",
            "date": t.date.isoformat() if t.date else None
        }
        for t in transactions_query
    ]
    
    # Generar reporte
    report = ai_assistant.generate_smart_report(budget_data, transactions, period)
    
    return {
        "report": report,
        "period": period,
        "budget_data": budget_data,
        "transactions_count": len(transactions)
    }

@router.post("/optimize-budget")
def optimize_budget(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Sugiere optimizaciones en la asignación de presupuesto basado en gastos reales.
    """
    if not ai_assistant.OPENAI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="La optimización de presupuesto no está disponible."
        )
    
    # Obtener presupuestos actuales
    user_budgets = db.query(models.UserBudget).filter(
        models.UserBudget.user_id == current_user.id
    ).all()
    
    current_budgets = []
    total_budget = 0
    
    for ub in user_budgets:
        if ub.family_budget:
            current_budgets.append({
                "category": ub.family_budget.category.value if ub.family_budget.category else "N/A",
                "allocated": float(ub.allocated_amount)
            })
            total_budget += float(ub.allocated_amount)
    
    # Obtener gastos reales por categoría
    transactions = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.transaction_type == models.TransactionType.EXPENSE.value
    ).all()
    
    category_spending = {}
    for t in transactions:
        cat = t.category.value if t.category else "Desconocida"
        category_spending[cat] = category_spending.get(cat, 0) + float(t.amount)
    
    actual_spending = [
        {"category": cat, "spent": amount}
        for cat, amount in category_spending.items()
    ]
    
    # Optimizar
    optimizations = ai_assistant.optimize_budget_allocation(
        current_budgets,
        actual_spending,
        total_budget
    )
    
    return optimizations
