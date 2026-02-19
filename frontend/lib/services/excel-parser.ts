/**
 * Servicio para parsear archivos Excel
 * Requiere: npm install xlsx
 */

export interface ExcelBudget {
  category: string
  subcategory: string
  monthly_amounts: Record<string, number>
  total_amount: number
}

export function parseExcelBudgets(excelBuffer: Buffer, sheetName: string = 'Input Categories Budget'): ExcelBudget[] {
  try {
    let XLSX: any
    try {
      XLSX = require('xlsx')
    } catch (requireError: any) {
      if (requireError.code === 'MODULE_NOT_FOUND' || requireError.message?.includes('Cannot find module')) {
        throw new Error('La dependencia xlsx no está instalada. Ejecuta: npm install xlsx')
      }
      throw requireError
    }
    const workbook = XLSX.read(excelBuffer, { type: 'buffer' })
    
    if (!workbook.SheetNames.includes(sheetName)) {
      throw new Error(`No se encontró la hoja '${sheetName}' en el Excel`)
    }
    
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null })
    
    const meses = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
                   'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
    
    // Buscar fila de header
    let headerRow = -1
    const monthCols: Record<string, number> = {}
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowStr = row.map((v: any) => String(v || '').toUpperCase()).join(' ')
      
      if (meses.some(mes => rowStr.includes(mes))) {
        headerRow = i
        // Buscar columnas de meses
        for (let j = 0; j < row.length; j++) {
          const val = String(row[j] || '').toUpperCase()
          for (const mes of meses) {
            if (val.includes(mes)) {
              monthCols[mes] = j + 1 // El valor está en la columna siguiente
              break
            }
          }
        }
        break
      }
    }
    
    if (headerRow === -1) {
      throw new Error('No se encontró la fila con los meses (JANUARY, FEBRUARY, etc.)')
    }
    
    if (Object.keys(monthCols).length === 0) {
      throw new Error('No se encontraron columnas de meses')
    }
    
    // Buscar índices de columnas dinámicamente
    let typeColIdx = -1
    let categoryColIdx = -1
    let subcategoryColIdx = -1
    
    // Buscar en la fila de header y las siguientes filas
    for (let searchRow = Math.max(0, headerRow - 2); searchRow <= headerRow + 2 && searchRow < data.length; searchRow++) {
      const row = data[searchRow]
      if (!row) continue
      
      for (let j = 0; j < row.length; j++) {
        const val = String(row[j] || '').trim().toUpperCase()
        
        if ((typeColIdx === -1) && (val === 'TYPE' || val === 'LEVEL 1' || val === 'LEVEL 1: TYPE' || val.includes('TYPE'))) {
          typeColIdx = j
        }
        if ((categoryColIdx === -1) && (val === 'CATEGORY' || val === 'LEVEL 2' || val === 'LEVEL 2: CATEGORY' || val.includes('CATEGOR'))) {
          categoryColIdx = j
        }
        if ((subcategoryColIdx === -1) && (val === 'SUBCATEGORY' || val === 'LEVEL 3' || val === 'LEVEL 3: SUBCATEGORY' || val.includes('SUBCATEGOR'))) {
          subcategoryColIdx = j
        }
      }
    }
    
    // Si no se encontraron, usar valores por defecto
    if (typeColIdx === -1) typeColIdx = 1
    if (categoryColIdx === -1) categoryColIdx = 2
    if (subcategoryColIdx === -1) subcategoryColIdx = 3
    
    const budgets: ExcelBudget[] = []
    let currentCategory: string | null = null
    let foundExpensesSection = false
    
    // Buscar sección EXPENSES (más flexible)
    for (let i = headerRow + 1; i < Math.min(headerRow + 500, data.length); i++) {
      const row = data[i]
      if (!row) continue
      
      // Buscar en la columna de Type
      if (typeColIdx < row.length) {
        const typeVal = String(row[typeColIdx] || '').trim().toUpperCase()
        if (typeVal === 'EXPENSES' || typeVal === 'EXPENSE') {
          foundExpensesSection = true
          break
        }
      }
      
      // También buscar en otras columnas por si acaso
      for (let j = 0; j < Math.min(row.length, 5); j++) {
        const val = String(row[j] || '').trim().toUpperCase()
        if (val === 'EXPENSES' || val === 'EXPENSE') {
          foundExpensesSection = true
          break
        }
      }
      if (foundExpensesSection) break
    }
    
    // Procesar filas
    for (let i = headerRow + 1; i < Math.min(headerRow + 500, data.length); i++) {
      const row = data[i]
      
      // Obtener Type
      const typeVal = typeColIdx < row.length ? String(row[typeColIdx] || '').trim().toUpperCase() : ''
      if (typeVal && typeVal !== 'EXPENSES' && typeVal !== 'EXPENSE' && foundExpensesSection) {
        if (typeVal === 'INCOME' || typeVal === 'SAVINGS' || typeVal === 'INVESTMENTS' || typeVal === 'DEBTS') {
          break // Fin de sección EXPENSES
        }
      }
      
      if (foundExpensesSection && typeVal && typeVal !== 'EXPENSES' && typeVal !== 'EXPENSE') {
        continue
      }
      
      // Obtener Category
      let category: string | null = null
      if (categoryColIdx < row.length) {
        const catVal = String(row[categoryColIdx] || '').trim()
        if (catVal && catVal.toUpperCase() !== 'EXPENSES' && catVal.toUpperCase() !== 'EXPENSE') {
          category = catVal
          currentCategory = category
        }
      }
      
      if (!category && currentCategory) {
        category = currentCategory
      }
      
      if (!category) continue
      
      // Obtener Subcategory
      let subcategory: string | null = null
      if (subcategoryColIdx < row.length) {
        const subcatVal = String(row[subcategoryColIdx] || '').trim()
        if (subcatVal) {
          subcategory = subcatVal
        }
      }
      
      if (!subcategory) continue
      
      // Obtener montos mensuales
      const monthlyAmounts: Record<string, number> = {}
      let totalAmount = 0
      
      for (const [mes, colIdx] of Object.entries(monthCols)) {
        if (colIdx < row.length) {
          const val = row[colIdx]
          let amount = 0
          
          if (typeof val === 'number') {
            amount = val
          } else if (typeof val === 'string') {
            const cleaned = val.replace(/[^0-9.-]/g, '')
            if (cleaned) {
              amount = parseFloat(cleaned) || 0
            }
          }
          
          if (amount > 0) {
            monthlyAmounts[mes] = amount
            totalAmount += amount
          }
        }
      }
      
        if (totalAmount > 0) {
        budgets.push({
          category,
          subcategory,
          monthly_amounts: monthlyAmounts,
          total_amount: totalAmount,
        })
      }
    }
    
    // Si no se encontraron presupuestos, proporcionar información de debug
    if (budgets.length === 0) {
      const debugInfo = {
        headerRow,
        monthColsFound: Object.keys(monthCols).length,
        typeColIdx,
        categoryColIdx,
        subcategoryColIdx,
        foundExpensesSection,
        rowsProcessed: Math.min(headerRow + 500, data.length) - headerRow - 1,
        sampleRow: headerRow >= 0 && data[headerRow + 1] ? data[headerRow + 1].slice(0, 10) : null,
      }
      
      throw new Error(
        `No se encontraron presupuestos válidos. ` +
        `Header encontrado en fila ${headerRow + 1}, ` +
        `${Object.keys(monthCols).length} meses encontrados, ` +
        `Sección EXPENSES: ${foundExpensesSection ? 'Sí' : 'No'}. ` +
        `Columnas: Type=${typeColIdx}, Category=${categoryColIdx}, Subcategory=${subcategoryColIdx}. ` +
        `Revisa que la estructura del Excel coincida con el formato esperado.`
      )
    }
    
    return budgets
  } catch (error: any) {
    throw new Error(`Error al parsear Excel: ${error.message}`)
  }
}
