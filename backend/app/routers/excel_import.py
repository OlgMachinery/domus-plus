from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from app.models import Category, Subcategory, BudgetType, DistributionMethod
from datetime import datetime
import pandas as pd
import io

router = APIRouter()

def parse_excel_budgets(excel_file, sheet_name='Input Categories Budget'):
    """
    Extrae los presupuestos del Excel basándose en la estructura del Personal Finance Tracker.
    La estructura es: Level 1 (Type) -> Level 2 (Category) -> Level 3 (Subcategory) -> Montos mensuales
    Solo procesa EXPENSES (no INCOME, SAVINGS/INVESTMENTS, ni DEBTS).
    """
    try:
        df = pd.read_excel(excel_file, sheet_name=sheet_name, header=None)
        
        # Buscar la fila con los meses (puede tener símbolos de moneda)
        meses = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
                 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
        
        header_row = None
        type_col_idx = None  # Level 1: Type (INCOME, EXPENSES, etc.)
        category_col_idx = None  # Level 2: Category
        subcategory_col_idx = None  # Level 3: Subcategory
        month_cols = {}
        
        # Buscar la fila con los meses (header row)
        for idx, row in df.iterrows():
            row_values = [str(x).upper() if pd.notna(x) else '' for x in row.values]
            row_str = ' '.join(row_values)
            
            # Buscar si contiene meses
            if any(mes in row_str for mes in meses):
                header_row = idx
                
                # Buscar columnas: Type, Category, Subcategory, y meses
                for col_idx, val in enumerate(row.values):
                    if pd.isna(val):
                        continue
                    
                    val_str = str(val).upper().strip()
                    
                    # Buscar columna de Type (Level 1)
                    if 'TYPE' in val_str or val_str in ['INCOME', 'EXPENSES', 'EXPENSE', 'SAVINGS', 'INVESTMENTS', 'DEBTS', 'DEBT']:
                        if type_col_idx is None:
                            type_col_idx = col_idx
                    
                    # Buscar columna de Category (Level 2)
                    # Puede ser "Category", "Categories", "Budget", etc.
                    if 'CATEGOR' in val_str or 'BUDGET' in val_str or val_str == 'CATEGORIES':
                        if category_col_idx is None:
                            category_col_idx = col_idx
                    
                    # Buscar columna de Subcategory (Level 3)
                    if 'SUBCATEGOR' in val_str or 'SUB-CATEGOR' in val_str:
                        if subcategory_col_idx is None:
                            subcategory_col_idx = col_idx
                    
                    # Buscar columnas de meses
                    # Estructura del Excel:
                    # Fila header: JANUARY (col 4), FEBRUARY (col 6), MARCH (col 8), etc.
                    # Fila datos: $ (col 4), valor (col 5), $ (col 6), valor (col 7), etc.
                    # Entonces: mes en col N -> valor en col N+1
                    for mes in meses:
                        if mes in val_str:
                            # El mes está en esta columna, el valor está en la siguiente
                            month_cols[mes] = col_idx + 1
                            break  # Evitar matches parciales
                
                break
        
        if header_row is None:
            raise ValueError("No se encontró la fila con los meses (JANUARY, FEBRUARY, etc.) en el Excel")
        
        if not month_cols:
            raise ValueError("No se encontraron columnas de meses en el Excel")
        
        # Si no encontramos las columnas de categoría, buscar en las primeras filas antes del header
        if type_col_idx is None or category_col_idx is None:
            # Buscar en las filas anteriores al header
            for idx in range(max(0, header_row - 5), header_row):
                row = df.iloc[idx]
                for col_idx, val in enumerate(row.values):
                    if pd.isna(val):
                        continue
                    val_str = str(val).upper().strip()
                    
                    if val_str in ['INCOME', 'EXPENSES', 'EXPENSE'] and type_col_idx is None:
                        type_col_idx = col_idx
                    elif ('CATEGOR' in val_str or 'BUDGET' in val_str or val_str == 'CATEGORIES') and category_col_idx is None:
                        category_col_idx = col_idx
                    elif 'SUBCATEGOR' in val_str and subcategory_col_idx is None:
                        subcategory_col_idx = col_idx
        
        # Determinar índices de columnas si no se encontraron explícitamente
        # Basándose en la estructura del Excel: Type (col 1) | Category (col 2) | Subcategory (col 3) | meses/valores (cols 4+)
        if type_col_idx is None:
            type_col_idx = 1  # Segunda columna (0-indexed sería 1)
        if category_col_idx is None:
            category_col_idx = 2  # Tercera columna
        if subcategory_col_idx is None:
            subcategory_col_idx = 3  # Cuarta columna
        
        # Leer datos desde la fila siguiente al header
        budgets = []
        current_type = None
        current_category = None
        found_expenses_section = False
        
        # Primero, buscar si hay una sección EXPENSES en el Excel
        for idx in range(header_row + 1, min(header_row + 500, len(df))):
            row = df.iloc[idx]
            if type_col_idx is not None and type_col_idx < len(row):
                type_val = str(row.iloc[type_col_idx]).strip() if pd.notna(row.iloc[type_col_idx]) else None
                if type_val and type_val.upper() in ['EXPENSES', 'EXPENSE']:
                    found_expenses_section = True
                    break
        
        # Si no encontramos EXPENSES explícitamente, procesar todas las filas con montos
        # (puede que el Excel no tenga la columna Type o esté en otro formato)
        process_all = not found_expenses_section
        
        print(f"🔍 Debug: found_expenses_section={found_expenses_section}, process_all={process_all}")
        print(f"🔍 Debug: type_col_idx={type_col_idx}, category_col_idx={category_col_idx}, subcategory_col_idx={subcategory_col_idx}")
        print(f"🔍 Debug: month_cols={month_cols}")
        
        for idx in range(header_row + 1, min(header_row + 500, len(df))):  # Buscar más filas
            row = df.iloc[idx]
            
            # Obtener Type (Level 1) - solo procesar EXPENSES si está explícito
            type_val = None
            if type_col_idx is not None and type_col_idx < len(row):
                type_val = str(row.iloc[type_col_idx]).strip() if pd.notna(row.iloc[type_col_idx]) else None
                if type_val and type_val.upper() in ['INCOME', 'EXPENSES', 'EXPENSE', 'SAVINGS', 'INVESTMENTS', 'DEBTS', 'DEBT']:
                    current_type = type_val.upper()
                    # Si encontramos INCOME u otro tipo que no sea EXPENSES, resetear
                    if current_type in ['INCOME', 'SAVINGS', 'INVESTMENTS', 'DEBTS', 'DEBT']:
                        current_type = None
                        current_category = None
                        continue
                    elif current_type in ['EXPENSES', 'EXPENSE']:
                        found_expenses_section = True
                        # Esta fila es solo el total de EXPENSES, no tiene categoría/subcategoría
                        # Saltar esta fila y continuar
                        continue
            
            # Si process_all es True, procesar todas las filas con montos (asumir que son EXPENSES)
            # Si process_all es False, solo procesar si current_type es EXPENSES
            if not process_all and current_type not in ['EXPENSES', 'EXPENSE']:
                continue
            
            # Obtener Category (Level 2) - está en la columna 2 (índice 2)
            category = None
            if category_col_idx is not None and category_col_idx < len(row):
                category_val = row.iloc[category_col_idx]
                if pd.notna(category_val):
                    category = str(category_val).strip()
                    # Ignorar si es un tipo (INCOME, EXPENSES, etc.) o está vacío
                    category_upper = category.upper() if category else ''
                    if category and category_upper not in ['INCOME', 'EXPENSES', 'EXPENSE', 'SAVINGS', 'INVESTMENTS', 'DEBTS', 'DEBT', 'nan', 'NaN', '', '0', None]:
                        # Esta es una nueva categoría, actualizar current_category
                        current_category = category
            
            # Si no hay categoría en esta fila, usar la última encontrada (jerarquía)
            if not category and current_category:
                category = current_category
            
            # Si aún no hay categoría, buscar en la columna 2 (donde normalmente está)
            if not category or category in ['nan', 'NaN', '', '0', None]:
                # Buscar en la columna 2 (índice 2)
                if 2 < len(row):
                    val = row.iloc[2]
                    if pd.notna(val):
                        potential_cat = str(val).strip()
                        potential_cat_upper = potential_cat.upper() if potential_cat else ''
                        # Verificar que no sea un número, un mes, o un tipo
                        if potential_cat and potential_cat not in ['nan', 'NaN', '', '0', None]:
                            if potential_cat_upper not in ['INCOME', 'EXPENSES', 'EXPENSE', 'SAVINGS', 'INVESTMENTS', 'DEBTS', 'DEBT'] + meses:
                                try:
                                    float(potential_cat)
                                except:
                                    category = potential_cat
                                    current_category = category
            
            # Verificar que la categoría no sea un tipo
            if category and category.upper() in ['INCOME', 'EXPENSES', 'EXPENSE', 'SAVINGS', 'INVESTMENTS', 'DEBTS', 'DEBT']:
                continue
            
            # Si no hay categoría, no podemos procesar esta fila
            if not category or category in ['nan', 'NaN', '', '0', None]:
                continue
            
            # Obtener Subcategory (Level 3) - está en la columna 3 (índice 3)
            subcategory = None
            if subcategory_col_idx is not None and subcategory_col_idx < len(row):
                subcategory_val = row.iloc[subcategory_col_idx]
                if pd.notna(subcategory_val):
                    subcategory = str(subcategory_val).strip()
                    # Ignorar símbolos de moneda y valores vacíos
                    if subcategory in ['nan', 'NaN', '', '0', None, '$', '$$', '$$$']:
                        subcategory = None
            
            # Si no hay subcategoría, buscar en la columna 3 (donde normalmente está)
            if not subcategory:
                # Primero buscar en la columna 3 (índice 3)
                if 3 < len(row):
                    val = row.iloc[3]
                    if pd.notna(val):
                        potential_subcat = str(val).strip()
                        # Ignorar símbolos de moneda y valores vacíos
                        if potential_subcat and potential_subcat not in ['nan', 'NaN', '', '0', None, '$', '$$', '$$$']:
                            if potential_subcat.upper() not in ['INCOME', 'EXPENSES', 'EXPENSE', 'SAVINGS', 'INVESTMENTS', 'DEBTS', 'DEBT'] + meses:
                                try:
                                    float(potential_subcat)
                                except:
                                    if potential_subcat != category:
                                        subcategory = potential_subcat
                
                # Si aún no hay subcategoría, buscar en columnas cercanas
                if not subcategory:
                    for col_idx in range(max(0, 2), min(6, len(row))):
                        if col_idx == 2:  # Saltar columna de categoría
                            continue
                        val = row.iloc[col_idx]
                        if pd.notna(val):
                            potential_subcat = str(val).strip()
                            # Verificar que no sea un número (monto) ni vacío
                            if potential_subcat and potential_subcat not in ['nan', 'NaN', '', '0', None]:
                                if potential_subcat.upper() not in ['INCOME', 'EXPENSES', 'EXPENSE', 'SAVINGS', 'INVESTMENTS', 'DEBTS', 'DEBT'] + meses:
                                    try:
                                        float(potential_subcat)
                                        continue  # Es un número, no una subcategoría
                                    except:
                                        if potential_subcat != category:
                                            subcategory = potential_subcat
                                            break
            
            # Obtener montos mensuales (pueden tener formato de moneda)
            monthly_amounts = {}
            total_amount = 0.0
            
            for mes, col_idx in month_cols.items():
                try:
                    if col_idx >= len(row):
                        continue
                    val = row.iloc[col_idx]
                    if pd.notna(val):
                        # Intentar convertir a número (puede venir como string con símbolos)
                        if isinstance(val, str):
                            # Remover símbolos de moneda y espacios
                            val = val.replace('$', '').replace(',', '').replace(' ', '').strip()
                        amount = float(val)
                        # Guardar todos los montos, incluso si son 0
                        monthly_amounts[mes] = amount
                        if amount > 0:
                            total_amount += amount
                except (ValueError, IndexError, TypeError):
                    continue
            
            # Si solo hay un mes con datos y los demás son 0, asumir que es un monto mensual
            # y multiplicar por 12 para obtener el total anual
            meses_con_datos = [m for m, v in monthly_amounts.items() if v > 0]
            if len(meses_con_datos) == 1 and len(monthly_amounts) > 0:
                # Solo hay un mes con datos, asumir que es mensual y multiplicar por 12
                monto_mensual = monthly_amounts[meses_con_datos[0]]
                total_amount = monto_mensual * 12
                # Distribuir el monto mensual en todos los meses
                for mes in month_cols.keys():
                    monthly_amounts[mes] = monto_mensual
                print(f"📅 Solo hay un mes con datos ({meses_con_datos[0]}: ${monto_mensual:,.2f}), multiplicando por 12 para obtener total anual: ${total_amount:,.2f}")
            
            # Solo agregar si hay al menos un monto
            # Si process_all es True, asumir que son EXPENSES
            # Si process_all es False, verificar que current_type sea EXPENSES
            should_add = False
            if process_all:
                # Si no hay columna Type o no encontramos EXPENSES explícitamente, procesar todo
                should_add = total_amount > 0 and category
            else:
                # Solo agregar si es explícitamente EXPENSES
                should_add = total_amount > 0 and category and current_type in ['EXPENSES', 'EXPENSE']
            
            if should_add:
                # Los montos del Excel son mensuales, el total anual es la suma de los 12 meses
                # Si hay montos mensuales, el total_amount ya es la suma correcta
                # Si no hay montos mensuales pero hay total_amount, mantenerlo
                total_anual_calculado = total_amount  # Ya es la suma de los meses
                
                budgets.append({
                    'category': category,
                    'subcategory': subcategory or category,  # Si no hay subcategoría, usar la categoría
                    'total_amount': total_anual_calculado,  # Total anual = suma de montos mensuales
                    'monthly_amounts': monthly_amounts  # Montos mensuales del Excel
                })
                print(f"✅ Presupuesto encontrado: {category} - {subcategory or category}: Total anual ${total_anual_calculado:,.2f} (suma de {len(monthly_amounts)} meses)")
        
        print(f"📊 Total de presupuestos encontrados: {len(budgets)}")
        
        if not budgets:
            # Dar más información sobre qué se encontró
            error_msg = "No se encontraron presupuestos en el Excel.\n\n"
            error_msg += f"Verifica que:\n"
            error_msg += f"- La hoja 'Input Categories Budget' tenga datos\n"
            error_msg += f"- Los presupuestos tengan montos mayores a cero\n"
            error_msg += f"- Los meses estén en inglés (JANUARY, FEBRUARY, etc.)\n"
            if not found_expenses_section and type_col_idx is not None:
                error_msg += f"\nNota: No se encontró una sección 'EXPENSES' explícita. "
                error_msg += f"El parser intentó procesar todas las filas con montos."
            raise ValueError(error_msg)
        
        return budgets
    
    except Exception as e:
        raise ValueError(f"Error al parsear presupuestos del Excel: {str(e)}")

def parse_excel_transactions(excel_file, sheet_name='Input Transactions'):
    """
    Extrae las transacciones del Excel.
    Retorna una lista de diccionarios con las transacciones.
    """
    try:
        df = pd.read_excel(excel_file, sheet_name=sheet_name, header=None)
        
        # Buscar la fila con los headers
        header_row = None
        date_col_idx = None
        amount_col_idx = None
        type_col_idx = None
        category_col_idx = None
        subcategory_col_idx = None
        description_col_idx = None
        
        for idx, row in df.iterrows():
            row_values = [str(x).upper() if pd.notna(x) else '' for x in row.values]
            row_str = ' '.join(row_values)
            
            # Buscar fila con headers
            if 'DATE' in row_str and 'AMOUNT' in row_str:
                header_row = idx
                
                # Buscar columnas
                for col_idx, val in enumerate(row.values):
                    if pd.isna(val):
                        continue
                    val_str = str(val).upper().strip()
                    
                    if val_str == 'DATE':
                        date_col_idx = col_idx
                    elif val_str == 'AMOUNT':
                        amount_col_idx = col_idx
                    elif 'MAIN TYPE' in val_str or 'TYPE' in val_str:
                        type_col_idx = col_idx
                    elif val_str == 'CATEGORY':
                        category_col_idx = col_idx
                    elif val_str == 'SUBCATEGORY':
                        subcategory_col_idx = col_idx
                    elif 'DESCRIPTION' in val_str:
                        description_col_idx = col_idx
                
                break
        
        if header_row is None:
            raise ValueError("No se encontró la fila con headers (DATE, AMOUNT, etc.) en Input Transactions")
        
        if date_col_idx is None or amount_col_idx is None:
            raise ValueError("No se encontraron las columnas DATE o AMOUNT en Input Transactions")
        
        # Leer transacciones
        transactions = []
        for idx in range(header_row + 1, len(df)):
            row = df.iloc[idx]
            
            # Obtener fecha
            date_val = row.iloc[date_col_idx] if date_col_idx < len(row) else None
            if pd.isna(date_val):
                continue
            
            # Convertir fecha
            try:
                if isinstance(date_val, str):
                    transaction_date = pd.to_datetime(date_val)
                else:
                    transaction_date = pd.to_datetime(date_val)
            except:
                continue
            
            # Obtener monto
            amount_val = row.iloc[amount_col_idx] if amount_col_idx < len(row) else None
            if pd.isna(amount_val):
                continue
            
            try:
                if isinstance(amount_val, str):
                    amount_val = amount_val.replace('$', '').replace(',', '').strip()
                amount = float(amount_val)
                if amount <= 0:
                    continue
            except:
                continue
            
            # Obtener tipo (MAIN TYPE)
            type_val = None
            if type_col_idx is not None and type_col_idx < len(row):
                type_val = str(row.iloc[type_col_idx]).strip() if pd.notna(row.iloc[type_col_idx]) else None
            
            # Solo procesar EXPENSES e INCOME
            if type_val and type_val.upper() not in ['EXPENSES', 'EXPENSE', 'INCOME']:
                continue
            
            # Obtener categoría y subcategoría
            category = None
            if category_col_idx is not None and category_col_idx < len(row):
                category_val = row.iloc[category_col_idx]
                if pd.notna(category_val):
                    category = str(category_val).strip()
            
            subcategory = None
            if subcategory_col_idx is not None and subcategory_col_idx < len(row):
                subcategory_val = row.iloc[subcategory_col_idx]
                if pd.notna(subcategory_val):
                    subcategory = str(subcategory_val).strip()
            
            # Obtener descripción
            description = None
            if description_col_idx is not None and description_col_idx < len(row):
                desc_val = row.iloc[description_col_idx]
                if pd.notna(desc_val):
                    description = str(desc_val).strip()
            
            if not category:
                continue
            
            transactions.append({
                'date': transaction_date,
                'amount': amount,
                'type': type_val.upper() if type_val else 'EXPENSES',
                'category': category,
                'subcategory': subcategory,
                'description': description or f"{category} - {subcategory or ''}"
            })
        
        return transactions
    
    except Exception as e:
        raise ValueError(f"Error al parsear transacciones del Excel: {str(e)}")

def map_excel_category_to_system(excel_category, excel_subcategory=None):
    """
    Mapea las categorías del Excel a las categorías del sistema.
    """
    # Normalizar
    excel_category = str(excel_category).strip().upper()
    excel_subcategory = str(excel_subcategory).strip() if excel_subcategory else None
    
    # Mapeo de categorías (case-insensitive, normalizar a mayúsculas)
    category_mapping = {
        'SERVICIOS BASICOS': Category.SERVICIOS_BASICOS,
        'SERVICIOS BÁSICOS': Category.SERVICIOS_BASICOS,
        'ALIMENTOS': Category.MERCADO,
        'MERCADO': Category.MERCADO,
        'VIVIENDA': Category.VIVIENDA,
        'COMBUSTIBLE': Category.TRANSPORTE,
        'TRANSPORTE': Category.TRANSPORTE,
        'IMPUESTOS': Category.IMPUESTOS,
        'EDUCACION': Category.EDUCACION,
        'EDUCACIÓN': Category.EDUCACION,
        'EDUCACION*': Category.EDUCACION,
        'SALUD': Category.SALUD,
        'SALUD MEDICAMENTOS': Category.SALUD_MEDICAMENTOS,
        'SALUD MEDICAMENTOS': Category.SALUD_MEDICAMENTOS,
        'VIDA SOCIAL': Category.VIDA_SOCIAL,
        'AGUINALDO Y VACACIONES': Category.AGUINALDO_VACACIONES,
    }
    
    # Mapeo de subcategorías
    subcategory_mapping = {
        # Servicios Basicos
        'ELECTRICIDAD CFE': Subcategory.ELECTRICIDAD_CFE,
        'AGUA POTABLE': Subcategory.AGUA_POTABLE,
        'GAS LP': Subcategory.GAS_LP,
        'INTERNET': Subcategory.INTERNET,
        'ENTRETENIMIENTO': Subcategory.ENTRETENIMIENTO,
        'ENTRENIMIENTO': Subcategory.ENTRETENIMIENTO,  # Variante con typo
        'GARRAFONES AGUA': Subcategory.GARRAFONES_AGUA,
        'TELCEL': Subcategory.TELCEL,
        'TELCEL PLAN FAMILIAR': Subcategory.TELCEL_PLAN_FAMILIAR,
        'MANTENIMIENTO HOGAR': Subcategory.MANTENIMIENTO_HOGAR,
        'SUELDO LIMPIEZA MARI': Subcategory.SUELDO_LIMPIEZA_MARI,
        # Mercado
        'MERCADO GENERAL': Subcategory.MERCADO_GENERAL,
        'EXTRAS DIVERSOS': Subcategory.EXTRAS_DIVERSOS,
        # Vivienda
        'CUOTAS OLINALA': Subcategory.CUOTAS_OLINALA,
        'SEGURO VIVIENDA': Subcategory.SEGURO_VIVIENDA,
        # Transporte
        'GASOLINA': Subcategory.GASOLINA,
        'LX600': Subcategory.LX600,
        'BMW': Subcategory.BMW,
        'HONDA CIVIC': Subcategory.HONDA_CIVIC,
        'LAND CRUISER': Subcategory.LAND_CRUISER,
        # Impuestos
        'PREDIAL': Subcategory.PREDIAL,
        # Educación
        'COLEGIATURAS': Subcategory.COLEGIATURAS,
        'GONZALO': Subcategory.GONZALO,
        'SEBASTIAN': Subcategory.SEBASTIAN,
        'EMILIANO': Subcategory.EMILIANO,
        'ISABELA': Subcategory.ISABELA,
        'SANTIAGO': Subcategory.SANTIAGO,
        'ENRIQUE': Subcategory.ENRIQUE,
        # Salud
        'SEGURO MEDICO': Subcategory.SEGURO_MEDICO,
        # Salud Medicamentos
        'GONZALO JR VUMINIX, MEDIKINET': Subcategory.GONZALO_JR_VUMINIX_MEDIKINET,
        'ISABELA LUVOX, RISPERDAL': Subcategory.ISABELA_LUVOX_RISPERDAL,
        'GONZALO MF, LEXAPRO, CONCERTA, EFEXXOR': Subcategory.GONZALO_MF_LEXAPRO_CONCERTA_EFEXXOR,
        'SEBASTIAN MB, CONCERTA': Subcategory.SEBASTIAN_MB_CONCERTA,
        'EMILIANO MB, CONCERTA, VUMINIX': Subcategory.EMILIANO_MB_CONCERTA_VUMINIX,
        # Vida Social
        'SALIDAS GONZALO': Subcategory.SALIDAS_GONZALO,
        'SALIDAS EMILIANO': Subcategory.SALIDAS_EMILIANO,
        'SALIDAS SEBASTIAN': Subcategory.SALIDAS_SEBASTIAN,
        'SEMANA ISABELA': Subcategory.SEMANA_ISABELA,
        'SEMANA SANTIAGO': Subcategory.SEMANA_SANTIAGO,
        'SALIDAS FAMILIARES': Subcategory.SALIDAS_FAMILIARES,
        'SALIDAS PERSONALES': Subcategory.SALIDAS_FAMILIARES,  # Mapear a salidas familiares
        'SALIDAS': Subcategory.SALIDAS_FAMILIARES,
        'CUMPLEANOS': Subcategory.CUMPLEANOS,
        'CUMPLEAÑOS': Subcategory.CUMPLEANOS,
        # Vivienda
        'MEJORAS Y REMODELACIONES': Subcategory.OTROS,  # Si no existe, usar OTROS
        'ANIVERSARIOS': Subcategory.ANIVERSARIOS,
        'REGALOS NAVIDAD': Subcategory.REGALOS_NAVIDAD,
        # Aguinaldo
        'MARI DE JESUS': Subcategory.MARI_DE_JESUS,
    }
    
    # Buscar categoría (usar versión en mayúsculas)
    excel_category_upper = excel_category.upper() if excel_category else ''
    system_category = category_mapping.get(excel_category_upper)
    if not system_category:
        # Intentar buscar por coincidencia parcial (case-insensitive)
        for key, value in category_mapping.items():
            key_upper = key.upper()
            if key_upper in excel_category_upper or excel_category_upper in key_upper:
                system_category = value
                break
        # Si aún no se encuentra, buscar variaciones comunes
        if not system_category:
            if 'SERVICIO' in excel_category_upper and 'BASICO' in excel_category_upper:
                system_category = Category.SERVICIOS_BASICOS
            elif 'VIDA' in excel_category_upper and 'SOCIAL' in excel_category_upper:
                system_category = Category.VIDA_SOCIAL
            elif 'EDUCACION' in excel_category_upper or 'EDUCACIÓN' in excel_category_upper:
                system_category = Category.EDUCACION
            elif 'SALUD' in excel_category_upper and 'MEDICAMENTO' in excel_category_upper:
                system_category = Category.SALUD_MEDICAMENTOS
    
    # Buscar subcategoría
    system_subcategory = None
    if excel_subcategory:
        excel_subcategory_upper = excel_subcategory.upper()
        system_subcategory = subcategory_mapping.get(excel_subcategory_upper)
        if not system_subcategory:
            # Intentar buscar por coincidencia parcial
            for key, value in subcategory_mapping.items():
                if key in excel_subcategory_upper or excel_subcategory_upper in key:
                    system_subcategory = value
                    break
    
    return system_category, system_subcategory

@router.post("/import-budgets")
async def import_budgets_from_excel(
    file: UploadFile = File(...),
    year: int = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Importa presupuestos desde un archivo Excel.
    Lee la hoja 'Input Categories Budget' y crea los presupuestos familiares.
    """
    try:
        # Verificar permisos
        if not current_user.family_id:
            raise HTTPException(
                status_code=400,
                detail="El usuario actual no tiene una familia asignada."
            )
        
        if not current_user.is_family_admin:
            raise HTTPException(
                status_code=403,
                detail="Solo el administrador de la familia puede importar presupuestos."
            )
        
        family = db.query(models.Family).filter(models.Family.id == current_user.family_id).first()
        if not family:
            raise HTTPException(status_code=404, detail="Familia no encontrada")
        
        # Año para los presupuestos
        if not year:
            year = datetime.now().year
        
        # Validar archivo Excel
        if not file.filename:
            raise HTTPException(status_code=400, detail="No se proporcionó un archivo")
        
        valid_extensions = ['.xlsx', '.xlsm', '.xls']
        file_ext = None
        for ext in valid_extensions:
            if file.filename.lower().endswith(ext):
                file_ext = ext
                break
        
        if not file_ext:
            raise HTTPException(
                status_code=400,
                detail=f"El archivo debe ser Excel (.xlsx, .xlsm, .xls)"
            )
        
        # Leer el archivo
        contents = await file.read()
        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="El archivo está vacío")
        
        engine = 'openpyxl' if file_ext in ['.xlsx', '.xlsm'] else 'xlrd'
        
        try:
            excel_file = pd.ExcelFile(io.BytesIO(contents), engine=engine)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error al abrir el archivo Excel: {str(e)}. Verifica que el archivo no esté corrupto o protegido con contraseña."
            )
        
        # Verificar que existe la hoja
        if 'Input Categories Budget' not in excel_file.sheet_names:
            available_sheets = ', '.join(excel_file.sheet_names[:5])
            raise HTTPException(
                status_code=400,
                detail=f"No se encontró la hoja 'Input Categories Budget' en el Excel. Hojas disponibles: {available_sheets}{'...' if len(excel_file.sheet_names) > 5 else ''}"
            )
        
        # Parsear presupuestos
        try:
            excel_budgets = parse_excel_budgets(excel_file)
        except ValueError as ve:
            raise HTTPException(
                status_code=400,
                detail=f"Error al parsear presupuestos del Excel: {str(ve)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error inesperado al leer presupuestos: {str(e)}"
            )
        
        if not excel_budgets:
            raise HTTPException(
                status_code=400,
                detail="No se encontraron presupuestos en el Excel. Verifica que la hoja 'Input Categories Budget' tenga datos de presupuestos."
            )
        
        # Eliminar presupuestos existentes del año
        existing_budgets = db.query(models.FamilyBudget).filter(
            models.FamilyBudget.family_id == family.id,
            models.FamilyBudget.year == year
        ).all()
        
        for existing_budget in existing_budgets:
            user_budgets = db.query(models.UserBudget).filter(
                models.UserBudget.family_budget_id == existing_budget.id
            ).all()
            for user_budget in user_budgets:
                db.delete(user_budget)
            db.delete(existing_budget)
        db.flush()
        
        # Obtener todos los usuarios de la familia
        family_users = db.query(models.User).filter(
            models.User.family_id == family.id
        ).all()
        
        if not family_users:
            raise HTTPException(
                status_code=400,
                detail="No hay usuarios en la familia. Crea los usuarios primero con /api/family-setup/create-family-members"
            )
        
        # Crear presupuestos
        created_budgets = []
        skipped_budgets = []
        errors = []
        
        for excel_budget in excel_budgets:
            try:
                # Mapear categorías
                system_category, system_subcategory = map_excel_category_to_system(
                    excel_budget['category'],
                    excel_budget.get('subcategory')
                )
                
                if not system_category:
                    skipped_budgets.append({
                        'excel_category': excel_budget['category'],
                        'excel_subcategory': excel_budget.get('subcategory'),
                        'reason': 'Categoría no reconocida'
                    })
                    continue
                
                if not system_subcategory:
                    # Si no hay subcategoría, usar la categoría como subcategoría
                    # Si no hay subcategoría, usar una subcategoría por defecto según la categoría
                    try:
                        if system_category == Category.SERVICIOS_BASICOS:
                            system_subcategory = Subcategory.ELECTRICIDAD_CFE
                        elif system_category == Category.MERCADO:
                            system_subcategory = Subcategory.MERCADO_GENERAL
                        elif system_category == Category.TRANSPORTE:
                            system_subcategory = Subcategory.GASOLINA
                        elif system_category == Category.EDUCACION:
                            system_subcategory = Subcategory.COLEGIATURAS
                        elif system_category == Category.SALUD:
                            system_subcategory = Subcategory.SEGURO_MEDICO
                        elif system_category == Category.VIDA_SOCIAL:
                            system_subcategory = Subcategory.SALIDAS_FAMILIARES
                        else:
                            system_subcategory = Subcategory.OTROS
                    except:
                        system_subcategory = Subcategory.OTROS
                
                # Convertir subcategoría a string
                subcategory_str = system_subcategory.value if isinstance(system_subcategory, Subcategory) else str(system_subcategory)
                
                # Convertir montos mensuales del Excel a formato JSON
                monthly_amounts_json = None
                if 'monthly_amounts' in excel_budget and excel_budget['monthly_amounts']:
                    monthly_amounts_json = excel_budget['monthly_amounts']
                
                # Crear presupuesto familiar
                family_budget = models.FamilyBudget(
                    family_id=family.id,
                    category=system_category.value,
                    subcategory=subcategory_str,
                    year=year,
                    total_amount=excel_budget['total_amount'],
                    monthly_amounts=monthly_amounts_json,  # Guardar montos mensuales
                    budget_type=BudgetType.SHARED.value,  # Por defecto compartido
                    distribution_method=DistributionMethod.EQUAL.value,  # Distribución equitativa
                    auto_distribute=True
                )
                db.add(family_budget)
                db.flush()
                
                # Distribuir entre usuarios
                amount_per_user = excel_budget['total_amount'] / len(family_users)
                
                for user in family_users:
                    user_budget = models.UserBudget(
                        user_id=user.id,
                        family_budget_id=family_budget.id,
                        allocated_amount=round(amount_per_user, 2),
                        spent_amount=0.0,
                        income_amount=0.0
                    )
                    db.add(user_budget)
                
                created_budgets.append({
                    'category': system_category.value,
                    'subcategory': subcategory_str,
                    'total_amount': excel_budget['total_amount'],
                    'users_assigned': len(family_users)
                })
            
            except Exception as e:
                errors.append({
                    'excel_category': excel_budget.get('category'),
                    'excel_subcategory': excel_budget.get('subcategory'),
                    'error': str(e)
                })
                continue
        
        db.commit()
        
        return {
            "message": "Presupuestos importados exitosamente",
            "summary": {
                "created": len(created_budgets),
                "skipped": len(skipped_budgets),
                "errors": len(errors),
                "year": year,
                "budgets": created_budgets,
                "skipped": skipped_budgets,
                "errors": errors
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error al importar presupuestos: {str(e)}"
        )

@router.post("/setup-from-excel")
async def setup_from_excel(
    file: UploadFile = File(...),
    year: int = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Configuración completa desde Excel:
    1. Elimina TODOS los datos existentes (transacciones, presupuestos, usuarios)
    2. Crea usuarios de la familia
    3. Importa presupuestos del Excel
    
    Solo deja los datos del Excel en el sistema.
    """
    try:
        # Verificar permisos
        if not current_user.family_id:
            raise HTTPException(
                status_code=400,
                detail="El usuario actual no tiene una familia asignada."
            )
        
        if not current_user.is_family_admin:
            raise HTTPException(
                status_code=403,
                detail="Solo el administrador de la familia puede configurar desde Excel."
            )
        
        family = db.query(models.Family).filter(models.Family.id == current_user.family_id).first()
        if not family:
            raise HTTPException(status_code=404, detail="Familia no encontrada")
        
        # Año para los presupuestos
        if not year:
            year = datetime.now().year
        
        results = {
            "cleared": {},
            "users_created": {},
            "budgets_imported": {}
        }
        
        # PASO 1: Limpiar TODOS los datos
        # Eliminar ABSOLUTAMENTE TODAS las transacciones (método más agresivo)
        try:
            # Obtener todos los usuarios de la familia primero
            all_family_users = db.query(models.User).filter(
                models.User.family_id == family.id
            ).all()
            all_family_user_ids = [u.id for u in all_family_users]
            
            # Contar antes
            total_transactions_before = db.query(models.Transaction).count()
            
            # Eliminar TODAS las transacciones sin importar a qué usuario pertenezcan
            deleted_transactions = db.query(models.Transaction).delete(synchronize_session=False)
            
            print(f"✅ Eliminadas {deleted_transactions} transacciones de un total de {total_transactions_before}")
            
            # Eliminar TODOS los user_budgets de la familia
            if all_family_user_ids:
                deleted_user_budgets = db.query(models.UserBudget).filter(
                    models.UserBudget.user_id.in_(all_family_user_ids)
                ).delete(synchronize_session=False)
            else:
                deleted_user_budgets = 0
            
            # Eliminar TODOS los presupuestos familiares
            deleted_family_budgets = db.query(models.FamilyBudget).filter(
                models.FamilyBudget.family_id == family.id
            ).delete(synchronize_session=False)
            
            # Eliminar usuarios (excepto el actual)
            users_to_delete = [u for u in all_family_users if u.id != current_user.id]
            for user in users_to_delete:
                user.family_id = None
                db.delete(user)
            
            db.flush()
            
            results["cleared"] = {
                "transactions": deleted_transactions,
                "user_budgets": deleted_user_budgets,
                "family_budgets": deleted_family_budgets,
                "users": len(users_to_delete)
            }
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Error al limpiar datos: {str(e)}")
        
        # PASO 2: Crear usuarios de la familia
        from app.routers.family_setup import FAMILY_MEMBERS
        from app import auth
        
        DEFAULT_PASSWORD = "domus123"
        created_users = []
        
        for member_data in FAMILY_MEMBERS:
            existing_user = db.query(models.User).filter(
                models.User.email == member_data["email"]
            ).first()
            
            if not existing_user:
                password_to_hash = DEFAULT_PASSWORD
                if len(password_to_hash.encode('utf-8')) > 72:
                    password_to_hash = password_to_hash.encode('utf-8')[:72].decode('utf-8', errors='ignore')
                
                hashed_password = auth.get_password_hash(password_to_hash)
                
                # Asignar teléfono por defecto si no se proporciona (el campo es NOT NULL y UNIQUE)
                # Generar un teléfono único basado en el email
                if member_data.get("phone"):
                    phone_value = member_data["phone"]
                else:
                    # Generar teléfono único: usar hash del email para asegurar unicidad
                    import hashlib
                    email_hash = hashlib.md5(member_data["email"].encode()).hexdigest()[:8]
                    phone_value = f"+52555{email_hash}"
                
                new_user = models.User(
                    name=member_data["name"],
                    email=member_data["email"],
                    phone=phone_value,
                    hashed_password=hashed_password,
                    family_id=family.id,
                    is_active=True,
                    is_family_admin=False
                )
                db.add(new_user)
                created_users.append(new_user)
        
        db.flush()
        results["users_created"] = {
            "created": len(created_users),
            "password": DEFAULT_PASSWORD
        }
        
        # PASO 3: Importar presupuestos del Excel
        valid_extensions = ['.xlsx', '.xlsm', '.xls']
        file_ext = None
        for ext in valid_extensions:
            if file.filename.lower().endswith(ext):
                file_ext = ext
                break
        
        if not file_ext:
            raise HTTPException(
                status_code=400,
                detail=f"El archivo debe ser Excel (.xlsx, .xlsm, .xls)"
            )
        
        contents = await file.read()
        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="El archivo está vacío")
        
        engine = 'openpyxl' if file_ext in ['.xlsx', '.xlsm'] else 'xlrd'
        
        try:
            excel_file = pd.ExcelFile(io.BytesIO(contents), engine=engine)
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            raise HTTPException(
                status_code=400,
                detail=f"Error al abrir el archivo Excel: {str(e)}\n\nDetalles técnicos: {error_details[:500]}\n\nVerifica que:\n- El archivo no esté corrupto\n- El archivo no esté protegido con contraseña\n- El archivo sea un Excel válido (.xlsx, .xlsm, .xls)"
            )
        
        if 'Input Categories Budget' not in excel_file.sheet_names:
            available_sheets = ', '.join(excel_file.sheet_names[:5])
            raise HTTPException(
                status_code=400,
                detail=f"No se encontró la hoja 'Input Categories Budget' en el Excel.\n\nHojas disponibles: {available_sheets}{'...' if len(excel_file.sheet_names) > 5 else ''}\n\nTotal de hojas: {len(excel_file.sheet_names)}"
            )
        
        try:
            excel_budgets = parse_excel_budgets(excel_file)
        except ValueError as ve:
            raise HTTPException(
                status_code=400,
                detail=f"Error al parsear presupuestos del Excel: {str(ve)}\n\nVerifica que la hoja 'Input Categories Budget' tenga el formato correcto con meses (JANUARY, FEBRUARY, etc.) y categorías."
            )
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            raise HTTPException(
                status_code=400,
                detail=f"Error inesperado al leer presupuestos: {str(e)}\n\nDetalles: {error_details[:500]}"
            )
        
        if not excel_budgets:
            raise HTTPException(
                status_code=400,
                detail="No se encontraron presupuestos en el Excel.\n\nVerifica que:\n- La hoja 'Input Categories Budget' tenga datos\n- Los presupuestos tengan montos mayores a cero\n- Los meses estén en inglés (JANUARY, FEBRUARY, etc.)"
            )
        
        # Obtener todos los usuarios de la familia (incluyendo los recién creados)
        family_users = db.query(models.User).filter(
            models.User.family_id == family.id
        ).all()
        
        created_budgets = []
        skipped_budgets = []
        
        for excel_budget in excel_budgets:
            try:
                # Ignorar presupuestos donde la categoría es "EXPENSES" (es el Type, no la categoría)
                if excel_budget['category'] and excel_budget['category'].upper() in ['EXPENSES', 'EXPENSE', 'INCOME']:
                    print(f"⚠️ Ignorando presupuesto con Type como categoría: '{excel_budget['category']}'")
                    skipped_budgets.append({
                        'excel_category': excel_budget['category'],
                        'excel_subcategory': excel_budget.get('subcategory'),
                        'reason': 'Type (EXPENSES/INCOME) usado como categoría'
                    })
                    continue
                
                system_category, system_subcategory = map_excel_category_to_system(
                    excel_budget['category'],
                    excel_budget.get('subcategory')
                )
                
                print(f"🔍 Mapeo: Excel '{excel_budget['category']}' -> Sistema: {system_category.value if system_category else 'None'}, Subcat: {system_subcategory.value if system_subcategory else 'None'}")
                
                if not system_category:
                    print(f"⚠️ Categoría no reconocida: '{excel_budget['category']}' (subcategoría: '{excel_budget.get('subcategory')}')")
                    skipped_budgets.append({
                        'excel_category': excel_budget['category'],
                        'excel_subcategory': excel_budget.get('subcategory'),
                        'reason': 'Categoría no reconocida'
                    })
                    continue
                
                if not system_subcategory:
                    # Si no hay subcategoría, usar una subcategoría por defecto según la categoría
                    try:
                        if system_category == Category.SERVICIOS_BASICOS:
                            system_subcategory = Subcategory.ELECTRICIDAD_CFE
                        elif system_category == Category.MERCADO:
                            system_subcategory = Subcategory.MERCADO_GENERAL
                        elif system_category == Category.TRANSPORTE:
                            system_subcategory = Subcategory.GASOLINA
                        elif system_category == Category.EDUCACION:
                            system_subcategory = Subcategory.COLEGIATURAS
                        elif system_category == Category.SALUD:
                            system_subcategory = Subcategory.SEGURO_MEDICO
                        elif system_category == Category.VIDA_SOCIAL:
                            system_subcategory = Subcategory.SALIDAS_FAMILIARES
                        else:
                            system_subcategory = Subcategory.OTROS
                    except:
                        system_subcategory = Subcategory.OTROS
                
                # Asegurar que system_subcategory sea un enum Subcategory válido
                if not isinstance(system_subcategory, Subcategory):
                    try:
                        system_subcategory = Subcategory(system_subcategory)
                    except:
                        system_subcategory = Subcategory.OTROS
                
                subcategory_str = system_subcategory.value
                
                try:
                    # Convertir montos mensuales del Excel a formato JSON
                    # El Excel tiene meses en inglés (JANUARY, FEBRUARY, etc.)
                    monthly_amounts_json = None
                    if 'monthly_amounts' in excel_budget and excel_budget['monthly_amounts']:
                        monthly_amounts_json = excel_budget['monthly_amounts']
                    
                    family_budget = models.FamilyBudget(
                        family_id=family.id,
                        category=system_category.value,
                        subcategory=subcategory_str,
                        year=year,
                        total_amount=excel_budget['total_amount'],
                        monthly_amounts=monthly_amounts_json,  # Guardar montos mensuales
                        budget_type=BudgetType.SHARED.value,
                        distribution_method=DistributionMethod.EQUAL.value,
                        auto_distribute=True
                    )
                    db.add(family_budget)
                    db.flush()
                    print(f"✅ Presupuesto creado: {system_category.value} - {subcategory_str}: ${excel_budget['total_amount']:,.2f}")
                except Exception as e:
                    print(f"❌ Error al crear presupuesto {excel_budget['category']} - {excel_budget.get('subcategory')}: {str(e)}")
                    skipped_budgets.append({
                        'excel_category': excel_budget['category'],
                        'excel_subcategory': excel_budget.get('subcategory'),
                        'error': str(e)
                    })
                    continue
                
                amount_per_user = excel_budget['total_amount'] / len(family_users)
                
                for user in family_users:
                    user_budget = models.UserBudget(
                        user_id=user.id,
                        family_budget_id=family_budget.id,
                        allocated_amount=round(amount_per_user, 2),
                        spent_amount=0.0,
                        income_amount=0.0
                    )
                    db.add(user_budget)
                
                created_budgets.append({
                    'category': system_category.value,
                    'subcategory': subcategory_str,
                    'total_amount': excel_budget['total_amount']
                })
            
            except Exception as e:
                skipped_budgets.append({
                    'excel_category': excel_budget.get('category'),
                    'error': str(e)
                })
                continue
        
        print(f"📊 Resumen de presupuestos: {len(created_budgets)} creados, {len(skipped_budgets)} saltados")
        if len(skipped_budgets) > 0:
            print(f"⚠️ Primeros 10 presupuestos saltados:")
            for skip in skipped_budgets[:10]:
                print(f"   - {skip.get('excel_category', 'N/A')} / {skip.get('excel_subcategory', 'N/A')}: {skip.get('reason', skip.get('error', 'N/A'))}")
        
        results["budgets_imported"] = {
            "created": len(created_budgets),
            "skipped": len(skipped_budgets),
            "year": year,
            "skipped_details": skipped_budgets[:20]  # Primeros 20 para debugging
        }
        
        # PASO 4: Importar transacciones del Excel (si existe la hoja)
        transactions_imported = 0
        transactions_errors = []
        
        if 'Input Transactions' in excel_file.sheet_names:
            try:
                excel_transactions = parse_excel_transactions(excel_file)
                print(f"📊 Transacciones encontradas en Excel: {len(excel_transactions)}")
                
                # Obtener todos los usuarios de la familia
                family_users = db.query(models.User).filter(
                    models.User.family_id == family.id
                ).all()
                
                if not family_users:
                    print("⚠️ No hay usuarios en la familia para asignar transacciones")
                else:
                    # Importar transacciones
                    for excel_trans in excel_transactions:
                        try:
                            # Mapear categorías
                            system_category, system_subcategory = map_excel_category_to_system(
                                excel_trans['category'],
                                excel_trans.get('subcategory')
                            )
                            
                            if not system_category:
                                transactions_errors.append({
                                    'date': str(excel_trans['date']),
                                    'amount': excel_trans['amount'],
                                    'error': f"Categoría no reconocida: {excel_trans['category']}"
                                })
                                continue
                            
                            # Determinar tipo de transacción
                            if excel_trans['type'] in ['INCOME']:
                                transaction_type = models.TransactionType.INCOME.value
                            else:
                                transaction_type = models.TransactionType.EXPENSE.value
                            
                            # Asignar a un usuario (por ahora al primero, luego se puede mejorar)
                            assigned_user = family_users[0]
                            
                            # Asegurar que system_subcategory sea válido antes de buscar presupuesto
                            if not system_subcategory or not isinstance(system_subcategory, Subcategory):
                                try:
                                    if system_category == Category.SERVICIOS_BASICOS:
                                        system_subcategory = Subcategory.ELECTRICIDAD_CFE
                                    elif system_category == Category.MERCADO:
                                        system_subcategory = Subcategory.MERCADO_GENERAL
                                    elif system_category == Category.TRANSPORTE:
                                        system_subcategory = Subcategory.GASOLINA
                                    elif system_category == Category.EDUCACION:
                                        system_subcategory = Subcategory.COLEGIATURAS
                                    elif system_category == Category.SALUD:
                                        system_subcategory = Subcategory.SEGURO_MEDICO
                                    elif system_category == Category.VIDA_SOCIAL:
                                        system_subcategory = Subcategory.SALIDAS_FAMILIARES
                                    else:
                                        system_subcategory = Subcategory.OTROS
                                except:
                                    system_subcategory = Subcategory.OTROS
                            
                            # Buscar presupuesto relacionado usando valores de los enums
                            family_budget = None
                            if system_subcategory:
                                family_budget = db.query(models.FamilyBudget).filter(
                                    models.FamilyBudget.family_id == family.id,
                                    models.FamilyBudget.category == system_category.value,
                                    models.FamilyBudget.subcategory == system_subcategory.value,
                                    models.FamilyBudget.year == excel_trans['date'].year
                                ).first()
                            
                            # Asegurar que system_subcategory sea válido
                            if not system_subcategory:
                                # Usar una subcategoría por defecto según la categoría
                                try:
                                    if system_category == Category.SERVICIOS_BASICOS:
                                        system_subcategory = Subcategory.ELECTRICIDAD_CFE
                                    elif system_category == Category.MERCADO:
                                        system_subcategory = Subcategory.MERCADO_GENERAL
                                    elif system_category == Category.TRANSPORTE:
                                        system_subcategory = Subcategory.GASOLINA
                                    elif system_category == Category.EDUCACION:
                                        system_subcategory = Subcategory.COLEGIATURAS
                                    elif system_category == Category.SALUD:
                                        system_subcategory = Subcategory.SEGURO_MEDICO
                                    elif system_category == Category.VIDA_SOCIAL:
                                        system_subcategory = Subcategory.SALIDAS_FAMILIARES
                                    else:
                                        system_subcategory = Subcategory.OTROS
                                except:
                                    system_subcategory = Subcategory.OTROS
                            
                            # Asegurar que sea un enum Subcategory
                            if not isinstance(system_subcategory, Subcategory):
                                try:
                                    system_subcategory = Subcategory(system_subcategory)
                                except:
                                    system_subcategory = Subcategory.OTROS
                            
                            # Crear transacción
                            transaction = models.Transaction(
                                user_id=assigned_user.id,
                                family_budget_id=family_budget.id if family_budget else None,
                                date=excel_trans['date'],
                                amount=excel_trans['amount'],
                                transaction_type=transaction_type,
                                currency="MXN",
                                merchant_or_beneficiary=excel_trans.get('description', '')[:100],
                                category=system_category,
                                subcategory=system_subcategory,
                                concept=excel_trans.get('description', '')[:200],
                                status=models.TransactionStatus.PROCESSED
                            )
                            db.add(transaction)
                            transactions_imported += 1
                            
                            # Actualizar presupuesto gastado si hay family_budget
                            if family_budget:
                                user_budget = db.query(models.UserBudget).filter(
                                    models.UserBudget.user_id == assigned_user.id,
                                    models.UserBudget.family_budget_id == family_budget.id
                                ).first()
                                
                                if user_budget:
                                    if transaction_type == models.TransactionType.INCOME.value:
                                        user_budget.income_amount += excel_trans['amount']
                                    else:
                                        user_budget.spent_amount += excel_trans['amount']
                                    db.add(user_budget)
                        
                        except Exception as e:
                            transactions_errors.append({
                                'date': str(excel_trans.get('date', 'N/A')),
                                'amount': excel_trans.get('amount', 0),
                                'error': str(e)
                            })
                            continue
                    
                    db.flush()
                    print(f"✅ Transacciones importadas: {transactions_imported}")
            
            except Exception as e:
                print(f"⚠️ Error al importar transacciones: {str(e)}")
                transactions_errors.append({
                    'error': f"Error general: {str(e)}"
                })
        else:
            print("ℹ️ No se encontró la hoja 'Input Transactions' en el Excel")
        
        results["transactions_imported"] = {
            "imported": transactions_imported,
            "errors": len(transactions_errors),
            "error_details": transactions_errors[:10]  # Primeros 10 errores
        }
        
        # Hacer commit de todos los cambios
        try:
            db.commit()
            print(f"✅ Commit exitoso: {len(created_budgets)} presupuestos y {transactions_imported} transacciones guardados")
        except Exception as e:
            db.rollback()
            print(f"❌ Error al hacer commit: {str(e)}")
            raise
        
        return {
            "message": "Sistema configurado completamente desde Excel",
            "summary": results,
            "note": "Solo los datos del Excel están ahora en el sistema"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        error_trace = traceback.format_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error al configurar desde Excel: {str(e)}\n\nDetalles técnicos:\n{error_trace[:500]}"
        )
