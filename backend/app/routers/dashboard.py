"""Estadísticas del dashboard para usuario autenticado (backend)."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app import models, auth

router = APIRouter()


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Devuelve estadísticas para el dashboard: presupuesto mensual, gastado, restante, recibos pendientes, transacciones recientes."""
    now = datetime.now()
    year = now.year
    month = now.month
    first_day = datetime(year, month, 1).date()
    next_month = datetime(year, month, 1) + timedelta(days=32)
    last_day = (next_month.replace(day=1) - timedelta(days=1)).date()

    total_budget_month = 0.0
    if current_user.family_id:
        from sqlalchemy import and_
        budgets = db.query(models.FamilyBudget).filter(
            and_(
                models.FamilyBudget.family_id == current_user.family_id,
                models.FamilyBudget.year == year,
            )
        ).all()
        year_total = sum(b.total_amount or 0 for b in budgets)
        total_budget_month = year_total / 12.0

    # Gastado este mes (egresos del usuario)
    spent_result = db.query(func.coalesce(func.sum(models.Transaction.amount), 0)).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.transaction_type == models.TransactionType.EXPENSE.value,
        models.Transaction.date >= first_day,
        models.Transaction.date <= last_day,
    ).scalar()
    spent_month = float(spent_result or 0)

    remaining_month = max(0.0, total_budget_month - spent_month)

    # Recibos pendientes (pending, uploaded o sin procesar)
    try:
        from sqlalchemy import or_
        pending_receipts = db.query(models.Receipt).filter(
            models.Receipt.user_id == current_user.id,
        ).filter(
            or_(
                models.Receipt.status == None,
                models.Receipt.status == "pending",
                models.Receipt.status == "uploaded",
            )
        ).count()
    except Exception:
        pending_receipts = 0

    # Transacciones recientes (últimas 10)
    recent = (
        db.query(models.Transaction)
        .filter(models.Transaction.user_id == current_user.id)
        .order_by(models.Transaction.date.desc())
        .limit(10)
        .all()
    )
    recent_transactions = [
        {
            "id": t.id,
            "date": t.date.isoformat() if t.date else None,
            "amount": t.amount,
            "transaction_type": t.transaction_type or "expense",
            "merchant_or_beneficiary": t.merchant_or_beneficiary,
            "category": t.category or "",
            "concept": t.concept,
        }
        for t in recent
    ]

    return {
        "name": current_user.name or (current_user.email or "").split("@")[0] or "Usuario",
        "totalBudgetMonth": round(total_budget_month * 100) / 100,
        "spentMonth": round(spent_month * 100) / 100,
        "remainingMonth": round(remaining_month * 100) / 100,
        "receiptsPending": pending_receipts,
        "recentTransactions": recent_transactions,
    }
