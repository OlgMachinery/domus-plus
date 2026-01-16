#!/usr/bin/env python3
"""
Script para analizar la estructura del Excel de DOMUS y replicar su lógica
"""
import pandas as pd
import sys
import json
from pathlib import Path

def analizar_estructura_categorias(excel_file):
    """Analiza la hoja 'Hide Dropdown Lists' para extraer la estructura de categorías"""
    print("\n" + "="*80)
    print("📋 ESTRUCTURA DE CATEGORÍAS")
    print("="*80)
    
    try:
        df = pd.read_excel(excel_file, sheet_name='Hide Dropdown Lists', header=None)
        
        # Buscar la fila con los headers
        header_row = None
        for idx, row in df.iterrows():
            if 'Level 1: Type' in str(row.values):
                header_row = idx
                break
        
        if header_row is None:
            print("❌ No se encontró la fila de headers")
            return None
        
        # Leer desde la fila de headers
        df_cat = pd.read_excel(excel_file, sheet_name='Hide Dropdown Lists', header=header_row)
        
        # Limpiar nombres de columnas
        df_cat.columns = [str(col).strip() if pd.notna(col) else f'col_{i}' for i, col in enumerate(df_cat.columns)]
        
        # Buscar columnas relevantes
        level1_col = None
        level2_col = None
        level3_col = None
        
        for col in df_cat.columns:
            if 'Level 1' in str(col) or 'Type' in str(col):
                level1_col = col
            elif 'Level 2' in str(col) or 'Category' in str(col):
                level2_col = col
            elif 'Level 3' in str(col) or 'Subcategory' in str(col):
                level3_col = col
        
        print(f"   Columnas encontradas:")
        print(f"   - Level 1 (Type): {level1_col}")
        print(f"   - Level 2 (Category): {level2_col}")
        print(f"   - Level 3 (Subcategory): {level3_col}")
        
        # Extraer estructura
        estructura = {}
        
        for idx, row in df_cat.iterrows():
            level1 = str(row[level1_col]).strip() if pd.notna(row[level1_col]) and str(row[level1_col]).strip() not in ['0', 'nan', 'NaN', ''] else None
            level2 = str(row[level2_col]).strip() if pd.notna(row[level2_col]) and str(row[level2_col]).strip() not in ['0', 'nan', 'NaN', ''] else None
            level3 = str(row[level3_col]).strip() if pd.notna(row[level3_col]) and str(row[level3_col]).strip() not in ['0', 'nan', 'NaN', ''] else None
            
            if level1 and level1.upper() in ['INCOME', 'EXPENSES']:
                if level1 not in estructura:
                    estructura[level1] = {}
                
                if level2:
                    if level2 not in estructura[level1]:
                        estructura[level1][level2] = []
                    
                    if level3 and level3 not in estructura[level1][level2]:
                        estructura[level1][level2].append(level3)
        
        print(f"\n   Estructura extraída:")
        print(json.dumps(estructura, indent=2, ensure_ascii=False))
        
        return estructura
        
    except Exception as e:
        print(f"❌ Error al analizar categorías: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def analizar_presupuestos(excel_file):
    """Analiza la hoja 'Input Categories Budget' para extraer presupuestos"""
    print("\n" + "="*80)
    print("💰 ESTRUCTURA DE PRESUPUESTOS")
    print("="*80)
    
    try:
        # Leer la hoja
        df = pd.read_excel(excel_file, sheet_name='Input Categories Budget', header=None)
        
        # Buscar la fila con los meses (JANUARY, FEBRUARY, etc.)
        meses = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
                 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
        
        header_row = None
        for idx, row in df.iterrows():
            row_str = ' '.join([str(x) for x in row.values if pd.notna(x)])
            if any(mes in row_str.upper() for mes in meses):
                header_row = idx
                break
        
        if header_row is None:
            print("❌ No se encontró la fila con los meses")
            return None
        
        # Leer desde la fila de headers
        df_budget = pd.read_excel(excel_file, sheet_name='Input Categories Budget', header=header_row)
        
        # Buscar columnas de categorías y meses
        category_col = None
        month_cols = {}
        
        for col in df_budget.columns:
            col_str = str(col).upper()
            if 'CATEGOR' in col_str or 'BUDGET' in col_str:
                category_col = col
            for mes in meses:
                if mes in col_str:
                    month_cols[mes] = col
        
        print(f"   Columna de categoría: {category_col}")
        print(f"   Columnas de meses encontradas: {list(month_cols.keys())}")
        
        # Extraer presupuestos (primeras filas con datos)
        presupuestos = []
        
        for idx, row in df_budget.iterrows():
            if idx > 50:  # Limitar búsqueda
                break
            
            category = None
            if category_col:
                category = str(row[category_col]).strip() if pd.notna(row[category_col]) else None
            
            if category and category not in ['nan', 'NaN', '', '0', None]:
                budget_data = {
                    'category': category,
                    'months': {}
                }
                
                for mes, col in month_cols.items():
                    try:
                        value = row[col]
                        if pd.notna(value) and isinstance(value, (int, float)):
                            budget_data['months'][mes] = float(value)
                    except:
                        pass
                
                if budget_data['months']:
                    presupuestos.append(budget_data)
        
        print(f"\n   Presupuestos encontrados: {len(presupuestos)}")
        for p in presupuestos[:10]:  # Mostrar primeros 10
            print(f"   - {p['category']}: {sum(p['months'].values()):,.2f} total")
        
        return presupuestos
        
    except Exception as e:
        print(f"❌ Error al analizar presupuestos: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def analizar_dropdown_dinamico(excel_file):
    """Analiza la hoja 'Hide Dynamic Lists' para categorías dinámicas"""
    print("\n" + "="*80)
    print("📝 LISTAS DINÁMICAS (CATEGORÍAS Y SUBCATEGORÍAS)")
    print("="*80)
    
    try:
        df = pd.read_excel(excel_file, sheet_name='Hide Dynamic Lists', header=0)
        
        # Buscar columnas relevantes
        main_type_col = None
        category_col = None
        subcategory_col = None
        
        for col in df.columns:
            col_str = str(col).upper()
            if 'MAIN TYPE' in col_str:
                main_type_col = col
            elif 'CATEGORY DYNAMIC' in col_str:
                category_col = col
            elif 'SUB CATEGORY' in col_str:
                subcategory_col = col
        
        print(f"   Columnas encontradas:")
        print(f"   - Main Type: {main_type_col}")
        print(f"   - Category: {category_col}")
        print(f"   - Subcategory: {subcategory_col}")
        
        # Extraer datos
        categorias_dinamicas = {}
        
        for idx, row in df.iterrows():
            if idx > 20:  # Limitar
                break
            
            main_type = str(row[main_type_col]).strip() if main_type_col and pd.notna(row[main_type_col]) else None
            category = str(row[category_col]).strip() if category_col and pd.notna(row[category_col]) else None
            
            if main_type and main_type.upper() in ['INCOME', 'EXPENSES']:
                if main_type not in categorias_dinamicas:
                    categorias_dinamicas[main_type] = []
                
                if category and category not in ['nan', 'NaN', '', '0']:
                    if category not in categorias_dinamicas[main_type]:
                        categorias_dinamicas[main_type].append(category)
        
        print(f"\n   Categorías dinámicas encontradas:")
        for main_type, categories in categorias_dinamicas.items():
            print(f"   - {main_type}: {len(categories)} categorías")
            for cat in categories[:5]:
                print(f"     • {cat}")
        
        return categorias_dinamicas
        
    except Exception as e:
        print(f"❌ Error al analizar listas dinámicas: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def main():
    archivo = sys.argv[1] if len(sys.argv) > 1 else '~/Downloads/Financials.xlsm'
    archivo = str(Path(archivo).expanduser())
    
    if not Path(archivo).exists():
        print(f"❌ El archivo no existe: {archivo}")
        return
    
    print(f"📊 Analizando archivo: {archivo}")
    
    try:
        excel_file = pd.ExcelFile(archivo, engine='openpyxl')
        print(f"\n📋 Hojas disponibles: {excel_file.sheet_names}")
        
        # Analizar estructura de categorías
        estructura_cat = analizar_estructura_categorias(excel_file)
        
        # Analizar presupuestos
        presupuestos = analizar_presupuestos(excel_file)
        
        # Analizar dropdown dinámico
        categorias_dinamicas = analizar_dropdown_dinamico(excel_file)
        
        # Resumen
        print("\n" + "="*80)
        print("📊 RESUMEN DEL ANÁLISIS")
        print("="*80)
        print(f"✅ Estructura de categorías: {'Extraída' if estructura_cat else 'No disponible'}")
        print(f"✅ Presupuestos: {'Extraídos' if presupuestos else 'No disponibles'}")
        print(f"✅ Categorías dinámicas: {'Extraídas' if categorias_dinamicas else 'No disponibles'}")
        
    except Exception as e:
        print(f"❌ Error al procesar el archivo: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
