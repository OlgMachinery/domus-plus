#!/usr/bin/env python3
"""
Script para extraer todos los datos de recibos y tickets de DOMUS+
Genera archivos JSON y CSV con información de transacciones que tienen recibos asociados
"""
import json
import csv
import os
from datetime import datetime
from app.database import SessionLocal
from app import models

def serialize_enum(obj):
    """Convierte enums a strings para JSON/CSV"""
    if hasattr(obj, 'value'):
        return obj.value
    return str(obj)

def extraer_recibos():
    db = SessionLocal()
    try:
        print("📄 Extrayendo datos de recibos y tickets...\n")
        
        # Extraer todas las transacciones que tienen recibos asociados
        # (tienen receipt_image_url o whatsapp_message_id)
        transactions_with_receipts = db.query(models.Transaction).filter(
            (models.Transaction.receipt_image_url.isnot(None)) |
            (models.Transaction.whatsapp_message_id.isnot(None))
        ).all()
        
        # También incluir todas las transacciones para contexto completo
        all_transactions = db.query(models.Transaction).all()
        
        # Obtener información de usuarios para enriquecer los datos
        users = {u.id: u for u in db.query(models.User).all()}
        
        # Obtener información de presupuestos
        budgets = {b.id: b for b in db.query(models.FamilyBudget).all()}
        
        recibos_data = []
        todas_las_transacciones = []
        
        for transaction in all_transactions:
            user = users.get(transaction.user_id)
            budget = budgets.get(transaction.family_budget_id) if transaction.family_budget_id else None
            
            transaccion_dict = {
                "id": transaction.id,
                "usuario": {
                    "id": transaction.user_id,
                    "name": user.name if user else "Usuario desconocido",
                    "email": user.email if user else None
                },
                "fecha": transaction.date.isoformat() if transaction.date else None,
                "monto": float(transaction.amount),
                "moneda": transaction.currency,
                "comercio": transaction.merchant_or_beneficiary,
                "categoria": serialize_enum(transaction.category),
                "subcategoria": serialize_enum(transaction.subcategory),
                "concepto": transaction.concept,
                "referencia": transaction.reference,
                "operation_id": transaction.operation_id,
                "tracking_key": transaction.tracking_key,
                "estado": serialize_enum(transaction.status),
                "notas": transaction.notes,
                "tiene_recibo": bool(transaction.receipt_image_url or transaction.whatsapp_message_id),
                "receipt_image_url": transaction.receipt_image_url,
                "whatsapp_message_id": transaction.whatsapp_message_id,
                "presupuesto": {
                    "id": transaction.family_budget_id,
                    "categoria": serialize_enum(budget.category) if budget else None,
                    "subcategoria": serialize_enum(budget.subcategory) if budget else None
                } if transaction.family_budget_id else None,
                "created_at": transaction.created_at.isoformat() if transaction.created_at else None
            }
            
            todas_las_transacciones.append(transaccion_dict)
            
            # Si tiene recibo, agregarlo a la lista de recibos
            if transaction.receipt_image_url or transaction.whatsapp_message_id:
                recibos_data.append(transaccion_dict)
        
        # Crear estructura completa
        datos_completos = {
            "fecha_extraccion": datetime.now().isoformat(),
            "resumen": {
                "total_transacciones": len(todas_las_transacciones),
                "transacciones_con_recibo": len(recibos_data),
                "transacciones_sin_recibo": len(todas_las_transacciones) - len(recibos_data)
            },
            "recibos": recibos_data,
            "todas_las_transacciones": todas_las_transacciones
        }
        
        # Guardar en archivo JSON
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        json_filename = f"domus_plus_recibos_{timestamp}.json"
        
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(datos_completos, f, indent=2, ensure_ascii=False)
        
        # Guardar en CSV para fácil análisis
        csv_filename = f"domus_plus_recibos_{timestamp}.csv"
        with open(csv_filename, 'w', newline='', encoding='utf-8') as f:
            if recibos_data:
                writer = csv.DictWriter(f, fieldnames=[
                    'id', 'fecha', 'usuario', 'monto', 'moneda', 'comercio', 
                    'categoria', 'subcategoria', 'concepto', 'referencia', 
                    'operation_id', 'tracking_key', 'estado', 'receipt_image_url', 
                    'whatsapp_message_id', 'presupuesto_categoria', 'presupuesto_subcategoria'
                ])
                writer.writeheader()
                
                for recibo in recibos_data:
                    writer.writerow({
                        'id': recibo['id'],
                        'fecha': recibo['fecha'],
                        'usuario': recibo['usuario']['name'],
                        'monto': recibo['monto'],
                        'moneda': recibo['moneda'],
                        'comercio': recibo['comercio'] or '',
                        'categoria': recibo['categoria'],
                        'subcategoria': recibo['subcategoria'],
                        'concepto': recibo['concepto'] or '',
                        'referencia': recibo['referencia'] or '',
                        'operation_id': recibo['operation_id'] or '',
                        'tracking_key': recibo['tracking_key'] or '',
                        'estado': recibo['estado'],
                        'receipt_image_url': recibo['receipt_image_url'] or '',
                        'whatsapp_message_id': recibo['whatsapp_message_id'] or '',
                        'presupuesto_categoria': recibo['presupuesto']['categoria'] if recibo['presupuesto'] else '',
                        'presupuesto_subcategoria': recibo['presupuesto']['subcategoria'] if recibo['presupuesto'] else ''
                    })
        
        # Crear reporte en texto
        reporte_filename = f"domus_plus_recibos_reporte_{timestamp}.txt"
        with open(reporte_filename, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write("REPORTE DE RECIBOS Y TICKETS - DOMUS+\n")
            f.write("=" * 80 + "\n\n")
            f.write(f"Fecha de extracción: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write(f"RESUMEN:\n")
            f.write("-" * 80 + "\n")
            f.write(f"Total de transacciones: {len(todas_las_transacciones)}\n")
            f.write(f"Transacciones con recibo: {len(recibos_data)}\n")
            f.write(f"Transacciones sin recibo: {len(todas_las_transacciones) - len(recibos_data)}\n\n")
            
            if recibos_data:
                f.write(f"DETALLE DE RECIBOS ({len(recibos_data)}):\n")
                f.write("=" * 80 + "\n\n")
                
                for i, recibo in enumerate(recibos_data, 1):
                    f.write(f"RECIBO #{i} (ID: {recibo['id']})\n")
                    f.write("-" * 80 + "\n")
                    f.write(f"Fecha: {recibo['fecha'][:10] if recibo['fecha'] else 'N/A'}\n")
                    f.write(f"Usuario: {recibo['usuario']['name']} ({recibo['usuario']['email']})\n")
                    f.write(f"Monto: ${recibo['monto']:,.2f} {recibo['moneda']}\n")
                    f.write(f"Comercio: {recibo['comercio'] or 'N/A'}\n")
                    f.write(f"Categoría: {recibo['categoria']} - {recibo['subcategoria']}\n")
                    f.write(f"Concepto: {recibo['concepto'] or 'N/A'}\n")
                    f.write(f"Referencia: {recibo['referencia'] or 'N/A'}\n")
                    if recibo['operation_id']:
                        f.write(f"Operation ID: {recibo['operation_id']}\n")
                    if recibo['tracking_key']:
                        f.write(f"Tracking Key: {recibo['tracking_key']}\n")
                    f.write(f"Estado: {recibo['estado']}\n")
                    if recibo['presupuesto']:
                        f.write(f"Presupuesto: {recibo['presupuesto']['categoria']} - {recibo['presupuesto']['subcategoria']}\n")
                    if recibo['receipt_image_url']:
                        f.write(f"URL Imagen: {recibo['receipt_image_url']}\n")
                    if recibo['whatsapp_message_id']:
                        f.write(f"WhatsApp Message ID: {recibo['whatsapp_message_id']}\n")
                    if recibo['notas']:
                        f.write(f"Notas: {recibo['notas']}\n")
                    f.write("\n")
            else:
                f.write("No hay recibos registrados en el sistema.\n")
            
            # Estadísticas por categoría
            f.write("\n" + "=" * 80 + "\n")
            f.write("ESTADÍSTICAS POR CATEGORÍA\n")
            f.write("=" * 80 + "\n\n")
            
            categorias_stats = {}
            for recibo in recibos_data:
                cat = recibo['categoria']
                if cat not in categorias_stats:
                    categorias_stats[cat] = {'count': 0, 'total': 0}
                categorias_stats[cat]['count'] += 1
                categorias_stats[cat]['total'] += recibo['monto']
            
            for cat, stats in sorted(categorias_stats.items()):
                f.write(f"{cat}:\n")
                f.write(f"  Cantidad: {stats['count']} recibos\n")
                f.write(f"  Total: ${stats['total']:,.2f}\n")
                f.write(f"  Promedio: ${stats['total']/stats['count']:,.2f}\n\n")
        
        print(f"✅ Extracción completada!")
        print(f"\n📁 Archivos generados:")
        print(f"   - JSON: {json_filename}")
        print(f"   - CSV: {csv_filename}")
        print(f"   - Reporte: {reporte_filename}")
        print(f"\n📊 Resumen:")
        print(f"   - Total de transacciones: {len(todas_las_transacciones)}")
        print(f"   - Transacciones con recibo: {len(recibos_data)}")
        print(f"   - Transacciones sin recibo: {len(todas_las_transacciones) - len(recibos_data)}")
        
        return json_filename, csv_filename, reporte_filename
        
    except Exception as e:
        print(f"❌ Error al extraer recibos: {str(e)}")
        import traceback
        traceback.print_exc()
        return None, None, None
    finally:
        db.close()

if __name__ == "__main__":
    extraer_recibos()
