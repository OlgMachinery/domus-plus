"""
Servicio de asistente inteligente con GPT para ayudar a los usuarios
con preguntas sobre el sistema, consejos financieros y análisis de datos.
"""
import os
from typing import Optional, Dict, Any, List
from datetime import datetime

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY")) if os.getenv("OPENAI_API_KEY") else None
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None
    client = None

# Contexto del sistema para el asistente
SYSTEM_CONTEXT = """Eres un asistente financiero inteligente para el sistema DOMUS+, un sistema de gestión de presupuesto familiar.

Tu función es ayudar a los usuarios con:
1. Preguntas sobre cómo usar el sistema (presupuestos, transacciones, recibos, etc.)
2. Consejos financieros y de presupuesto
3. Análisis de patrones de gastos
4. Sugerencias para mejorar el control financiero
5. Explicaciones sobre categorías y subcategorías del sistema

CATEGORÍAS Y SUBCATEGORÍAS DISPONIBLES:
- Servicios Basicos: Electricidad CFE, Agua Potable, Gas LP, Internet, Entretenimiento, Garrafones Agua, Telcel, Telcel Plan Familiar, Mantenimiento Hogar, Sueldo Limpieza Mari
- Mercado: Mercado General, Extras Diversos
- Vivienda: Cuotas Olinala, Seguro Vivienda, Mejoras y Remodelaciones
- Transporte: Gasolina, Mantenimiento coches, Seguros y Derechos, Lavado, LX600, BMW, HONDA CIVIC, LAND CRUISER
- Impuestos: Predial
- Educacion: Colegiaturas, Gonzalo, Sebastian, Emiliano, Isabela, Santiago, Enrique
- Salud: Consulta, Medicamentos, Seguro Medico, Prevencion
- Salud Medicamentos: Gonzalo Jr Vuminix Medikinet, Isabela Luvox Risperdal, Gonzalo MF Lexapro Concerta Efexxor, Sebastian MB Concerta, Emiliano MB Concerta Vuminix
- Vida Social: Salidas Personales, Salidas Familiares, Cumpleanos, Aniversarios, Regalos Navidad, Salidas Gonzalo, Salidas Emiliano, Salidas Sebastian, Semana Isabela, Semana Santiago
- Aguinaldo y Vacaciones: Mari de jesus

FUNCIONALIDADES DEL SISTEMA:
- Presupuestos familiares e individuales
- Gestión de transacciones (ingresos y egresos)
- Procesamiento automático de recibos con IA
- Asignación de presupuestos a miembros de la familia
- Reportes y análisis financieros
- Presupuestos personales para gastos individuales
- Análisis de consumo por producto/item (ej: "cuanto tomate consumimos en enero")

ANÁLISIS DE CONSUMO:
Puedes consultar los items extraídos de recibos para responder preguntas como:
- "¿Cuánto tomate consumimos en enero?"
- "¿Cuál es el precio promedio del pan?"
- "¿Qué productos compramos más frecuentemente?"
- "¿Cuánto gastamos en productos de limpieza este mes?"

Los items de recibos incluyen: descripción del producto, monto, categoría, subcategoría, fecha y comercio.
Usa esta información para responder preguntas sobre consumo específico de productos.

Responde siempre en español, de forma clara y concisa. Si no estás seguro de algo, admítelo y sugiere consultar la documentación."""

def get_ai_response(
    user_message: str,
    user_context: Optional[Dict[str, Any]] = None,
    conversation_history: Optional[List[Dict[str, str]]] = None
) -> str:
    """
    Obtiene una respuesta del asistente GPT basada en el mensaje del usuario.
    
    Args:
        user_message: Mensaje del usuario
        user_context: Contexto adicional del usuario (presupuestos, gastos, etc.)
        conversation_history: Historial de conversación previo
    
    Returns:
        Respuesta del asistente
    """
    if not OPENAI_AVAILABLE:
        return "Lo siento, el asistente de IA no está disponible. Verifica que OpenAI esté configurado."
    
    if not client:
        return "Lo siento, la API de OpenAI no está configurada. Contacta al administrador."
    
    try:
        # Construir mensajes
        messages = [
            {"role": "system", "content": SYSTEM_CONTEXT}
        ]
        
        # Agregar contexto del usuario si está disponible
        if user_context:
            context_text = f"\n\nCONTEXTO DEL USUARIO:\n"
            if user_context.get("budget_summary"):
                context_text += f"- Presupuesto total: ${user_context['budget_summary'].get('total', 0):,.2f}\n"
                context_text += f"- Gastado: ${user_context['budget_summary'].get('spent', 0):,.2f}\n"
                context_text += f"- Disponible: ${user_context['budget_summary'].get('available', 0):,.2f}\n"
            if user_context.get("recent_transactions"):
                context_text += f"- Transacciones recientes: {len(user_context['recent_transactions'])}\n"
            if user_context.get("top_categories"):
                context_text += f"- Categorías más usadas: {', '.join(user_context['top_categories'][:3])}\n"
            if user_context.get("receipt_items"):
                items_count = user_context.get("receipt_items_count", 0)
                context_text += f"\nITEMS DE RECIBOS DISPONIBLES: {items_count} items extraídos de recibos procesados.\n"
                context_text += "Puedes analizar estos items para responder preguntas sobre consumo específico de productos.\n"
                # Incluir algunos ejemplos de items para contexto
                sample_items = user_context['receipt_items'][:10]  # Primeros 10 items como ejemplo
                if sample_items:
                    context_text += "\nEjemplos de items disponibles:\n"
                    for item in sample_items:
                        context_text += f"- {item.get('description', 'N/A')}: ${item.get('amount', 0):.2f} ({item.get('date', 'N/A')})\n"
            
            messages.append({"role": "system", "content": context_text})
        
        # Agregar historial de conversación
        if conversation_history:
            for msg in conversation_history[-5:]:  # Solo últimos 5 mensajes para contexto
                messages.append(msg)
        
        # Agregar mensaje actual del usuario
        messages.append({"role": "user", "content": user_message})
        
        # Llamar a GPT
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Modelo más económico para chat
            messages=messages,
            temperature=0.7,
            max_tokens=500
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        error_msg = f"Error al obtener respuesta del asistente: {str(e)}"
        print(error_msg)
        return f"Lo siento, ocurrió un error al procesar tu consulta. Por favor intenta de nuevo."

def analyze_budget_situation(
    budget_data: Dict[str, Any],
    transactions: List[Dict[str, Any]]
) -> str:
    """
    Analiza la situación del presupuesto y proporciona insights.
    
    Args:
        budget_data: Datos del presupuesto
        transactions: Lista de transacciones
    
    Returns:
        Análisis en texto
    """
    if not OPENAI_AVAILABLE or not client:
        return "El asistente de análisis no está disponible."
    
    try:
        analysis_prompt = f"""Analiza la siguiente situación financiera y proporciona insights útiles:

PRESUPUESTO:
- Total asignado: ${budget_data.get('total', 0):,.2f}
- Gastado: ${budget_data.get('spent', 0):,.2f}
- Disponible: ${budget_data.get('available', 0):,.2f}
- Porcentaje gastado: {(budget_data.get('spent', 0) / budget_data.get('total', 1)) * 100:.1f}%

TRANSACCIONES RECIENTES ({len(transactions)}):
{chr(10).join([f"- {t.get('description', 'Sin descripción')}: ${t.get('amount', 0):,.2f} ({t.get('category', 'N/A')})" for t in transactions[:10]])}

Proporciona:
1. Un análisis breve de la situación
2. Alertas si hay problemas (gastos excesivos, presupuesto agotado, etc.)
3. Recomendaciones prácticas para mejorar el control financiero

Responde en español, de forma clara y concisa."""
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_CONTEXT},
                {"role": "user", "content": analysis_prompt}
            ],
            temperature=0.7,
            max_tokens=400
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        return f"Error al analizar presupuesto: {str(e)}"

def suggest_category(
    description: str,
    amount: float,
    available_categories: List[str]
) -> Optional[Dict[str, str]]:
    """
    Sugiere una categoría y subcategoría basada en la descripción de una transacción.
    
    Args:
        description: Descripción de la transacción
        amount: Monto de la transacción
        available_categories: Lista de categorías disponibles
    
    Returns:
        Diccionario con 'category' y 'subcategory' sugeridas, o None si no se puede determinar
    """
    if not OPENAI_AVAILABLE or not client:
        return None
    
    try:
        prompt = f"""Basándote en esta transacción, sugiere la categoría y subcategoría más apropiada:

Descripción: "{description}"
Monto: ${amount:,.2f}

Categorías disponibles:
{chr(10).join([f"- {cat}" for cat in available_categories])}

Responde SOLO con un JSON válido en este formato:
{{
    "category": "nombre de la categoría",
    "subcategory": "nombre de la subcategoría",
    "confidence": "alta|media|baja",
    "reason": "breve explicación"
}}"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un asistente que ayuda a categorizar transacciones financieras. Responde SOLO con JSON válido."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=200,
            response_format={"type": "json_object"}
        )
        
        import json
        suggestion = json.loads(response.choices[0].message.content)
        return suggestion
        
    except Exception as e:
        print(f"Error al sugerir categoría: {str(e)}")
        return None

def detect_anomalies(
    transactions: List[Dict[str, Any]],
    budget_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Detecta anomalías en los gastos (gastos inusuales, patrones sospechosos, etc.)
    
    Args:
        transactions: Lista de transacciones
        budget_data: Datos del presupuesto (opcional)
    
    Returns:
        Diccionario con anomalías detectadas y recomendaciones
    """
    if not OPENAI_AVAILABLE or not client:
        return {"anomalies": [], "message": "Análisis no disponible"}
    
    try:
        # Preparar datos para análisis
        transactions_summary = []
        total_amount = 0
        category_totals = {}
        
        for t in transactions[:50]:  # Analizar hasta 50 transacciones
            amount = float(t.get('amount', 0))
            total_amount += amount
            category = t.get('category', 'Desconocida')
            category_totals[category] = category_totals.get(category, 0) + amount
            transactions_summary.append({
                "description": t.get('description', 'Sin descripción')[:50],
                "amount": amount,
                "category": category,
                "date": t.get('date', 'N/A')
            })
        
        prompt = f"""Analiza estas transacciones y detecta anomalías o patrones inusuales:

RESUMEN:
- Total de transacciones analizadas: {len(transactions_summary)}
- Monto total: ${total_amount:,.2f}
- Categorías más usadas: {', '.join(sorted(category_totals.items(), key=lambda x: x[1], reverse=True)[:5])}

TRANSACCIONES:
{chr(10).join([f"- {t['date']}: ${t['amount']:,.2f} - {t['description']} ({t['category']})" for t in transactions_summary[:20]])}

{'PRESUPUESTO:' if budget_data else ''}
{f"- Asignado: ${budget_data.get('total', 0):,.2f}" if budget_data else ''}
{f"- Gastado: ${budget_data.get('spent', 0):,.2f}" if budget_data else ''}
{f"- Disponible: ${budget_data.get('available', 0):,.2f}" if budget_data else ''}

Detecta:
1. Gastos inusuales (montos muy altos o muy bajos comparados con el promedio)
2. Patrones sospechosos (múltiples transacciones similares, gastos repetitivos)
3. Categorías con gastos desproporcionados
4. Alertas sobre presupuesto (si se proporciona)
5. Recomendaciones específicas

Responde SOLO con un JSON válido:
{{
    "anomalies": [
        {{
            "type": "gasto_inusual|patron_sospechoso|presupuesto_excedido|categoria_desproporcionada",
            "severity": "alta|media|baja",
            "description": "descripción del problema",
            "transaction": "descripción de la transacción relacionada (si aplica)",
            "recommendation": "recomendación específica"
        }}
    ],
    "summary": "resumen general del análisis",
    "recommendations": ["recomendación 1", "recomendación 2"]
}}"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un analista financiero experto que detecta anomalías y patrones en gastos. Responde SOLO con JSON válido."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=800,
            response_format={"type": "json_object"}
        )
        
        import json
        analysis = json.loads(response.choices[0].message.content)
        return analysis
        
    except Exception as e:
        print(f"Error al detectar anomalías: {str(e)}")
        return {"anomalies": [], "message": f"Error: {str(e)}"}

def predict_future_expenses(
    transactions: List[Dict[str, Any]],
    months_ahead: int = 3
) -> Dict[str, Any]:
    """
    Predice gastos futuros basado en patrones históricos.
    
    Args:
        transactions: Lista de transacciones históricas
        months_ahead: Meses hacia adelante para predecir
    
    Returns:
        Predicciones por categoría y recomendaciones
    """
    if not OPENAI_AVAILABLE or not client:
        return {"predictions": [], "message": "Predicción no disponible"}
    
    try:
        # Agrupar por categoría y calcular promedios
        category_data = {}
        for t in transactions:
            category = t.get('category', 'Desconocida')
            amount = float(t.get('amount', 0))
            if category not in category_data:
                category_data[category] = {"amounts": [], "count": 0}
            category_data[category]["amounts"].append(amount)
            category_data[category]["count"] += 1
        
        category_summary = []
        for cat, data in category_data.items():
            amounts = data["amounts"]
            avg = sum(amounts) / len(amounts) if amounts else 0
            total = sum(amounts)
            category_summary.append({
                "category": cat,
                "average": avg,
                "total": total,
                "count": data["count"],
                "monthly_estimate": avg * (data["count"] / max(1, len(transactions) / 12))  # Estimación mensual
            })
        
        prompt = f"""Basándote en estos datos históricos, predice los gastos para los próximos {months_ahead} meses:

DATOS HISTÓRICOS POR CATEGORÍA:
{chr(10).join([f"- {c['category']}: Promedio ${c['average']:,.2f}, Total ${c['total']:,.2f}, {c['count']} transacciones, Estimación mensual: ${c['monthly_estimate']:,.2f}" for c in sorted(category_summary, key=lambda x: x['total'], reverse=True)])}

Proporciona:
1. Predicción de gastos por categoría para los próximos {months_ahead} meses
2. Tendencias identificadas (aumento, disminución, estabilidad)
3. Factores estacionales detectados
4. Recomendaciones de presupuesto

Responde SOLO con un JSON válido:
{{
    "predictions": [
        {{
            "category": "nombre de categoría",
            "monthly_estimate": 1234.56,
            "trend": "aumentando|disminuyendo|estable",
            "confidence": "alta|media|baja",
            "factors": ["factor 1", "factor 2"]
        }}
    ],
    "total_monthly_prediction": 12345.67,
    "trends": "resumen de tendencias generales",
    "recommendations": ["recomendación 1", "recomendación 2"],
    "seasonal_factors": ["factor estacional 1", "factor estacional 2"]
}}"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un analista financiero que predice gastos futuros basado en patrones históricos. Responde SOLO con JSON válido."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.6,
            max_tokens=1000,
            response_format={"type": "json_object"}
        )
        
        import json
        predictions = json.loads(response.choices[0].message.content)
        return predictions
        
    except Exception as e:
        print(f"Error al predecir gastos: {str(e)}")
        return {"predictions": [], "message": f"Error: {str(e)}"}

def generate_smart_report(
    budget_data: Dict[str, Any],
    transactions: List[Dict[str, Any]],
    period: str = "mensual"
) -> str:
    """
    Genera un reporte narrativo inteligente sobre la situación financiera.
    
    Args:
        budget_data: Datos del presupuesto
        transactions: Lista de transacciones
        period: Período del reporte (mensual, trimestral, anual)
    
    Returns:
        Reporte narrativo en texto
    """
    if not OPENAI_AVAILABLE or not client:
        return "Generación de reporte no disponible"
    
    try:
        # Calcular estadísticas
        total_spent = sum(float(t.get('amount', 0)) for t in transactions)
        category_breakdown = {}
        for t in transactions:
            cat = t.get('category', 'Desconocida')
            category_breakdown[cat] = category_breakdown.get(cat, 0) + float(t.get('amount', 0))
        
        top_categories = sorted(category_breakdown.items(), key=lambda x: x[1], reverse=True)[:5]
        
        prompt = f"""Genera un reporte financiero narrativo profesional para el período {period}:

SITUACIÓN DEL PRESUPUESTO:
- Presupuesto asignado: ${budget_data.get('total', 0):,.2f}
- Total gastado: ${budget_data.get('spent', 0):,.2f}
- Disponible: ${budget_data.get('available', 0):,.2f}
- Porcentaje utilizado: {(budget_data.get('spent', 0) / max(budget_data.get('total', 1), 1)) * 100:.1f}%

GASTOS POR CATEGORÍA (Top 5):
{chr(10).join([f"- {cat}: ${amount:,.2f} ({(amount/total_spent*100) if total_spent > 0 else 0:.1f}%)" for cat, amount in top_categories])}

NÚMERO DE TRANSACCIONES: {len(transactions)}

Genera un reporte narrativo que incluya:
1. Resumen ejecutivo de la situación financiera
2. Análisis de las categorías principales
3. Comparación con el presupuesto
4. Puntos destacados (positivos y negativos)
5. Recomendaciones específicas y accionables
6. Proyección para el próximo período

El reporte debe ser profesional, claro y útil para la toma de decisiones."""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_CONTEXT + "\n\nEres un analista financiero profesional que genera reportes narrativos claros y accionables."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1200
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        print(f"Error al generar reporte: {str(e)}")
        return f"Error al generar reporte: {str(e)}"

def optimize_budget_allocation(
    current_budgets: List[Dict[str, Any]],
    actual_spending: List[Dict[str, Any]],
    total_budget: float
) -> Dict[str, Any]:
    """
    Sugiere optimizaciones en la asignación de presupuesto basado en gastos reales.
    
    Args:
        current_budgets: Presupuestos actuales por categoría
        actual_spending: Gastos reales por categoría
        total_budget: Presupuesto total disponible
    
    Returns:
        Sugerencias de optimización
    """
    if not OPENAI_AVAILABLE or not client:
        return {"suggestions": [], "message": "Optimización no disponible"}
    
    try:
        prompt = f"""Analiza la asignación actual de presupuesto y sugiere optimizaciones:

PRESUPUESTO ACTUAL:
{chr(10).join([f"- {b['category']}: ${b['allocated']:,.2f} ({(b['allocated']/total_budget*100):.1f}%)" for b in current_budgets])}

GASTOS REALES:
{chr(10).join([f"- {s['category']}: ${s['spent']:,.2f} ({(s['spent']/sum(sp['spent'] for sp in actual_spending)*100) if sum(sp['spent'] for sp in actual_spending) > 0 else 0:.1f}%)" for s in actual_spending])}

PRESUPUESTO TOTAL DISPONIBLE: ${total_budget:,.2f}

Analiza:
1. Categorías con presupuesto insuficiente (gastos > presupuesto)
2. Categorías con presupuesto excesivo (gastos << presupuesto)
3. Oportunidades de redistribución
4. Categorías que necesitan más/menos presupuesto

Responde SOLO con un JSON válido:
{{
    "optimizations": [
        {{
            "category": "nombre de categoría",
            "current_allocation": 1234.56,
            "suggested_allocation": 1500.00,
            "change_percentage": 21.5,
            "reason": "explicación de la sugerencia",
            "priority": "alta|media|baja"
        }}
    ],
    "summary": "resumen de las optimizaciones sugeridas",
    "expected_benefits": ["beneficio 1", "beneficio 2"],
    "total_redistribution": 0.00
}}"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un consultor financiero experto en optimización de presupuestos. Responde SOLO con JSON válido."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.6,
            max_tokens=1000,
            response_format={"type": "json_object"}
        )
        
        import json
        optimizations = json.loads(response.choices[0].message.content)
        return optimizations
        
    except Exception as e:
        print(f"Error al optimizar presupuesto: {str(e)}")
        return {"suggestions": [], "message": f"Error: {str(e)}"}
