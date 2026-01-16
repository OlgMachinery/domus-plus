#!/usr/bin/env python3
"""
Script para leer y mostrar el contenido de archivos Excel
"""
import pandas as pd
import sys
import os
from pathlib import Path

def leer_excel(archivo_path):
    """Lee un archivo Excel y muestra su contenido"""
    try:
        # Verificar que el archivo existe
        if not os.path.exists(archivo_path):
            print(f"❌ El archivo no existe: {archivo_path}")
            return
        
        print(f"📊 Leyendo archivo: {archivo_path}")
        print("=" * 80)
        
        # Leer el archivo Excel
        # Para .xlsm necesitamos openpyxl
        excel_file = pd.ExcelFile(archivo_path, engine='openpyxl')
        
        print(f"\n📋 Hojas disponibles: {excel_file.sheet_names}")
        print("=" * 80)
        
        # Leer cada hoja
        for sheet_name in excel_file.sheet_names:
            print(f"\n📄 HOJA: {sheet_name}")
            print("-" * 80)
            
            df = pd.read_excel(excel_file, sheet_name=sheet_name)
            
            print(f"   Filas: {len(df)}")
            print(f"   Columnas: {len(df.columns)}")
            print(f"\n   Columnas: {list(df.columns)}")
            
            # Mostrar primeras filas
            print(f"\n   Primeras 10 filas:")
            print(df.head(10).to_string())
            
            # Mostrar información de tipos de datos
            print(f"\n   Tipos de datos:")
            print(df.dtypes)
            
            # Mostrar estadísticas si hay columnas numéricas
            numeric_cols = df.select_dtypes(include=['number']).columns
            if len(numeric_cols) > 0:
                print(f"\n   Estadísticas (columnas numéricas):")
                print(df[numeric_cols].describe())
            
            print("\n" + "=" * 80)
        
    except Exception as e:
        print(f"❌ Error al leer el archivo: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        archivo = sys.argv[1]
    else:
        # Buscar archivos Excel en el directorio actual y padre
        posibles_archivos = []
        for dir_path in [".", "..", "../.."]:
            for ext in ["*.xlsm", "*.xlsx", "*.xls"]:
                posibles_archivos.extend(Path(dir_path).glob(ext))
        
        # También buscar en el directorio home del usuario
        home_dir = Path.home()
        for ext in ["*.xlsm", "*.xlsx", "*.xls"]:
            try:
                posibles_archivos.extend(home_dir.glob(ext))
                posibles_archivos.extend(home_dir.glob(f"**/{ext}"))
            except:
                pass
        
        if posibles_archivos:
            print("📁 Archivos Excel encontrados:")
            for i, archivo in enumerate(posibles_archivos, 1):
                print(f"   {i}. {archivo}")
            
            if len(posibles_archivos) == 1:
                archivo = str(posibles_archivos[0])
                print(f"\n✅ Usando: {archivo}")
            else:
                print("\n❌ Múltiples archivos encontrados. Especifica cuál usar:")
                print(f"   python3 leer_excel.py <ruta_al_archivo>")
                sys.exit(1)
        else:
            print("❌ No se encontró ningún archivo Excel.")
            print("\nUso:")
            print("   python3 leer_excel.py <ruta_al_archivo>")
            print("\nEjemplos:")
            print("   python3 leer_excel.py Financials.xlsm")
            print("   python3 leer_excel.py ~/Downloads/Financials.xlsm")
            print("   python3 leer_excel.py /ruta/completa/a/Financials.xlsm")
            print("\nO coloca el archivo Excel en el directorio del proyecto.")
            sys.exit(1)
    
    leer_excel(archivo)
