from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, auth
from typing import Dict, List, Any
import pandas as pd
import io

router = APIRouter()

@router.post("/read")
async def read_excel_file(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Lee un archivo Excel y devuelve su contenido en formato JSON.
    Soporta .xlsx, .xlsm, .xls
    """
    try:
        # Validar que sea un archivo Excel
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
                detail=f"El archivo debe ser Excel (.xlsx, .xlsm, .xls). Recibido: {file.filename}"
            )
        
        # Leer el archivo
        contents = await file.read()
        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="El archivo está vacío")
        
        # Determinar el engine según la extensión
        engine = 'openpyxl' if file_ext in ['.xlsx', '.xlsm'] else 'xlrd'
        
        try:
            # Leer el archivo Excel
            excel_file = pd.ExcelFile(io.BytesIO(contents), engine=engine)
        except Exception as e:
            raise HTTPException(
                status_code=400, 
                detail=f"Error al leer el archivo Excel: {str(e)}. Asegúrate de que el archivo no esté corrupto."
            )
        
        # Procesar cada hoja
        result: Dict[str, Any] = {
            "filename": file.filename,
            "sheets": [],
            "total_sheets": len(excel_file.sheet_names)
        }
        
        for sheet_name in excel_file.sheet_names:
            try:
                df = pd.read_excel(excel_file, sheet_name=sheet_name)
                
                # Convertir NaN a None para JSON
                df = df.where(pd.notnull(df), None)
                
                # Obtener información de la hoja
                sheet_info = {
                    "name": sheet_name,
                    "rows": len(df),
                    "columns": len(df.columns),
                    "column_names": list(df.columns),
                    "data": df.head(100).to_dict(orient='records'),  # Primeras 100 filas
                    "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()}
                }
                
                # Agregar estadísticas para columnas numéricas
                numeric_cols = df.select_dtypes(include=['number']).columns
                if len(numeric_cols) > 0:
                    sheet_info["statistics"] = df[numeric_cols].describe().to_dict()
                
                result["sheets"].append(sheet_info)
                
            except Exception as e:
                result["sheets"].append({
                    "name": sheet_name,
                    "error": f"Error al leer la hoja: {str(e)}"
                })
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error al procesar el archivo Excel: {str(e)}"
        )

@router.post("/preview")
async def preview_excel_file(
    file: UploadFile = File(...),
    sheet_name: str = None,
    rows: int = 10,
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Vista previa de un archivo Excel.
    Devuelve solo las primeras filas de una hoja específica.
    """
    try:
        # Validar extensión
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
        excel_file = pd.ExcelFile(io.BytesIO(contents), engine=engine)
        
        # Si no se especifica hoja, usar la primera
        if not sheet_name:
            sheet_name = excel_file.sheet_names[0]
        elif sheet_name not in excel_file.sheet_names:
            raise HTTPException(
                status_code=400,
                detail=f"La hoja '{sheet_name}' no existe. Hojas disponibles: {excel_file.sheet_names}"
            )
        
        # Leer la hoja
        df = pd.read_excel(excel_file, sheet_name=sheet_name, nrows=rows)
        df = df.where(pd.notnull(df), None)
        
        return {
            "filename": file.filename,
            "sheet_name": sheet_name,
            "total_rows_in_sheet": len(pd.read_excel(excel_file, sheet_name=sheet_name)),
            "preview_rows": rows,
            "columns": list(df.columns),
            "data": df.to_dict(orient='records')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al procesar el archivo: {str(e)}"
        )
