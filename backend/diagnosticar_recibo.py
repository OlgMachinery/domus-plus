#!/usr/bin/env python3
"""
Script para diagnosticar problemas con la extracción de items de recibos.
Analiza los logs del backend para identificar por qué se extrajeron pocos items.
"""

import sys
import re
from pathlib import Path

def analizar_logs(ruta_log=None):
    """
    Analiza los logs del backend para diagnosticar problemas de extracción.
    """
    print("🔍 Analizando logs de procesamiento de recibos...\n")
    
    # Buscar logs recientes
    if ruta_log:
        archivo_log = Path(ruta_log)
    else:
        # Buscar en ubicaciones comunes
        posibles_rutas = [
            Path("/tmp/domus_backend.log"),
            Path("./logs/backend.log"),
            Path("../logs/backend.log"),
        ]
        archivo_log = None
        for ruta in posibles_rutas:
            if ruta.exists():
                archivo_log = ruta
                break
    
    if not archivo_log or not archivo_log.exists():
        print("⚠️  No se encontró archivo de log.")
        print("📋 Busca manualmente en la salida del backend los siguientes mensajes:\n")
        print("Mensajes clave a buscar:")
        print("  - '📊 Datos extraídos: amount=..., items=... items'")
        print("  - '⚠️  ADVERTENCIA CRÍTICA: La respuesta fue truncada'")
        print("  - '📋 Número esperado de items detectado en OCR: ...'")
        print("  - '✅ Items procesados: .../...'")
        print("  - '⚠️  ... items duplicados filtrados'")
        print("  - '⚠️  ... items sin precio individual'")
        return
    
    print(f"📄 Leyendo log: {archivo_log}\n")
    
    try:
        with open(archivo_log, 'r', encoding='utf-8') as f:
            lineas = f.readlines()
    except Exception as e:
        print(f"❌ Error leyendo log: {e}")
        return
    
    # Buscar las últimas líneas relevantes (últimas 500 líneas)
    lineas_recientes = lineas[-500:] if len(lineas) > 500 else lineas
    
    # Patrones a buscar
    patrones = {
        'items_extraidos': r'📊 Datos extraídos:.*items=(\d+)',
        'items_esperados': r'📋 Número esperado de items detectado en OCR: (\d+)',
        'truncado': r'⚠️\s+ADVERTENCIA CRÍTICA: La respuesta fue truncada',
        'items_procesados': r'✅ Items procesados: (\d+)/(\d+)',
        'duplicados': r'⚠️\s+(\d+) items duplicados filtrados',
        'sin_precio': r'⚠️\s+(\d+) items sin precio individual',
        'sin_nombre': r'⚠️\s+(\d+) items sin nombre',
        'finish_reason': r'finish_reason[:\s]+(\w+)',
        'partes': r'✅ Parte (\d+): (\d+) items extraídos',
        'total_items': r'✅ Recibo procesado: (\d+) items de',
    }
    
    resultados = {k: [] for k in patrones.keys()}
    
    # Buscar patrones
    for linea in lineas_recientes:
        for nombre, patron in patrones.items():
            matches = re.findall(patron, linea)
            if matches:
                resultados[nombre].extend(matches if isinstance(matches[0], tuple) else [(linea.strip(), matches)])
    
    # Mostrar resultados
    print("=" * 60)
    print("📊 RESUMEN DE DIAGNÓSTICO")
    print("=" * 60)
    
    if resultados['items_extraidos']:
        items = resultados['items_extraidos'][-1]
        if isinstance(items, tuple):
            items = items[1][0] if items[1] else items[0]
        print(f"\n✅ Items extraídos por GPT: {items}")
    
    if resultados['items_esperados']:
        esperados = resultados['items_esperados'][-1]
        if isinstance(esperados, tuple):
            esperados = esperados[1][0] if esperados[1] else esperados[0]
        print(f"📋 Items esperados (OCR): {esperados}")
        if resultados['items_extraidos']:
            extraidos = int(resultados['items_extraidos'][-1][1][0] if isinstance(resultados['items_extraidos'][-1], tuple) else resultados['items_extraidos'][-1])
            esperados_int = int(esperados)
            porcentaje = (extraidos / esperados_int * 100) if esperados_int > 0 else 0
            print(f"📊 Porcentaje extraído: {porcentaje:.1f}%")
            if porcentaje < 50:
                print(f"⚠️  PROBLEMA CRÍTICO: Solo se extrajo {porcentaje:.1f}% de los items esperados")
    
    if resultados['truncado']:
        print(f"\n❌ PROBLEMA DETECTADO: La respuesta fue truncada por límite de tokens")
        print(f"   Esto significa que GPT no pudo extraer todos los items porque")
        print(f"   la respuesta excedió el límite de 16,384 tokens.")
        print(f"   SOLUCIÓN: Procesar el recibo en partes más pequeñas o usar")
        print(f"   una estrategia diferente.")
    
    if resultados['items_procesados']:
        proc = resultados['items_procesados'][-1]
        if isinstance(proc, tuple):
            procesados, total = proc[1] if proc[1] else (proc[0], '?')
        else:
            procesados, total = proc[0], proc[1] if len(proc) > 1 else '?'
        print(f"\n📦 Items procesados: {procesados}/{total}")
        if total != '?' and int(procesados) < int(total) * 0.8:
            print(f"⚠️  PROBLEMA: Se filtraron muchos items durante el procesamiento")
    
    if resultados['duplicados']:
        dup = resultados['duplicados'][-1]
        if isinstance(dup, tuple):
            dup = dup[1][0] if dup[1] else dup[0]
        print(f"\n🔄 Items duplicados filtrados: {dup}")
    
    if resultados['sin_precio']:
        sin_precio = resultados['sin_precio'][-1]
        if isinstance(sin_precio, tuple):
            sin_precio = sin_precio[1][0] if sin_precio[1] else sin_precio[0]
        print(f"💰 Items sin precio filtrados: {sin_precio}")
    
    if resultados['sin_nombre']:
        sin_nombre = resultados['sin_nombre'][-1]
        if isinstance(sin_nombre, tuple):
            sin_nombre = sin_nombre[1][0] if sin_nombre[1] else sin_nombre[0]
        print(f"📝 Items sin nombre: {sin_nombre}")
    
    if resultados['partes']:
        print(f"\n📄 Procesamiento por partes:")
        for parte_info in resultados['partes']:
            if isinstance(parte_info, tuple):
                parte_num, items = parte_info[1] if parte_info[1] else (parte_info[0], '?')
            else:
                parte_num, items = parte_info[0], parte_info[1] if len(parte_info) > 1 else '?'
            print(f"   Parte {parte_num}: {items} items")
    
    if resultados['total_items']:
        total = resultados['total_items'][-1]
        if isinstance(total, tuple):
            total = total[1][0] if total[1] else total[0]
        print(f"\n✅ Total final: {total} items")
    
    print("\n" + "=" * 60)
    print("💡 RECOMENDACIONES")
    print("=" * 60)
    
    if resultados['truncado']:
        print("\n1. La respuesta fue truncada:")
        print("   → Procesar el recibo en partes más pequeñas")
        print("   → O usar una imagen de mayor resolución pero más comprimida")
    
    if resultados['items_esperados'] and resultados['items_extraidos']:
        esperados = int(resultados['items_esperados'][-1][1][0] if isinstance(resultados['items_esperados'][-1], tuple) else resultados['items_esperados'][-1])
        extraidos = int(resultados['items_extraidos'][-1][1][0] if isinstance(resultados['items_extraidos'][-1], tuple) else resultados['items_extraidos'][-1])
        if extraidos < esperados * 0.5:
            print("\n2. Se extrajeron muy pocos items:")
            print("   → GPT puede estar agrupando o resumiendo items")
            print("   → Verificar que las instrucciones sean claras")
            print("   → Considerar procesar la imagen completa sin dividir")
    
    if resultados['duplicados']:
        dup = int(resultados['duplicados'][-1][1][0] if isinstance(resultados['duplicados'][-1], tuple) else resultados['duplicados'][-1])
        if dup > 10:
            print("\n3. Muchos duplicados filtrados:")
            print("   → Puede haber un problema con la detección de duplicados")
            print("   → Revisar la lógica de detección")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    ruta_log = sys.argv[1] if len(sys.argv) > 1 else None
    analizar_logs(ruta_log)
