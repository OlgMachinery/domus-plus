/**
 * Sistema de internacionalización (i18n)
 * Soporte para Español (Latinoamérica) e Inglés (Estados Unidos)
 */

export type Language = 'es' | 'en'

export interface Translations {
  // Navegación
    nav: {
      dashboard: string
      budgets: string
      transactions: string
      logs: string
      budgetSummary: string
      receipts: string
      userRecords: string
      personalBudget: string
      reports: string
      system: string
      logout: string
    }
  
  // Presupuestos
  budgets: {
    title: string
    subtitle: string
    newBudget: string
    createBudget: string
    editBudget: string
    deleteBudget: string
    category: string
    subcategory: string
    year: string
    totalAmount: string
    monthlyAmount: string
    annualAmount: string
    assigned: string
    spent: string
    available: string
    type: string
    shared: string
    individual: string
    distributionMethod: string
    equal: string
    percentage: string
    manual: string
    filters: string
    showFilters: string
    hideFilters: string
    clearFilters: string
    globalSummary: string
    annualMatrix: string
    budgetComposition: string
    modifyBudget: string
    adminPassword: string
    verifyPassword: string
    passwordIncorrect: string
    budgetCreated: string
    budgetUpdated: string
    budgetDeleted: string
    selectAccount: string
    selectContributors: string
    assignAmounts: string
    frequency: string
    daily: string
    weekly: string
    biweekly: string
    monthly: string
    bimonthly: string
    quarterly: string
    semiannual: string
    annual: string
    sameAllMonths: string
    selectMonths: string
    variableMonthly: string
    totalBudget: string
    distributionMode: string
    totalAmountMode: string
    percentageMode: string
    amountPerMember: string
    totalAccount: string
    allMembersSelected: string
    selectMembers: string
    selectAll: string
    deselectAll: string
    membersSelected: string
    contributors: string
    assignAmountsToMembers: string
    defineContribution: string
    modifyPercentage: string
    percentageDistributed: string
    mustSum100: string
  }
  
  // Transacciones
  transactions: {
    title: string
    subtitle: string
    newTransaction: string
    createTransaction: string
    editTransaction: string
    deleteTransaction: string
    date: string
    amount: string
    type: string
    income: string
    expense: string
    merchant: string
    beneficiary: string
    concept: string
    reference: string
    notes: string
    filters: string
    showFilters: string
    hideFilters: string
    clearFilters: string
    uploadReceipt: string
  }
  
  // Logs
  logs: {
    title: string
    subtitle: string
    date: string
    time: string
    user: string
    action: string
    entity: string
    description: string
    details: string
    viewDetails: string
    system: string
    filters: string
    showFilters: string
    hideFilters: string
    actionType: string
    entityType: string
    period: string
    days: string
    last7Days: string
    last30Days: string
    last90Days: string
    lastYear: string
    clearFilters: string
    noLogs: string
    loadingLogs: string
  }
  
  // Concentrado de Presupuesto
  budgetSummary: {
    title: string
    subtitle: string
    account: string
    accountName: string
    category: string
    subcategory: string
    editName: string
    save: string
    cancel: string
    totalAnnual: string
    monthlyAmount: string
    contributors: string
    distribution: string
    type: string
    shared: string
    individual: string
    noAccounts: string
    loading: string
    accountUpdated: string
    errorUpdating: string
  }
  
  // Dashboard
  dashboard: {
    title: string
    subtitle: string
    allocatedBudget: string
    additionalIncome: string
    spent: string
    available: string
    recentTransactions: string
    noTransactions: string
    setupFromExcel: string
    settingUp: string
    createUsers: string
    creating: string
    deleteAll: string
    deleting: string
    loadTestData: string
    loading: string
    clearTestData: string
    clearing: string
    myBudgets: string
  }
  
  // Común
  common: {
    save: string
    cancel: string
    delete: string
    edit: string
    create: string
    update: string
    close: string
    back: string
    next: string
    continue: string
    loading: string
    error: string
    success: string
    confirm: string
    accept: string
    all: string
    none: string
    search: string
    filter: string
    clear: string
    year: string
    month: string
    day: string
    total: string
    subtotal: string
    percentage: string
    amount: string
    currency: string
    date: string
    time: string
    user: string
    email: string
    phone: string
    name: string
    description: string
    details: string
    status: string
    active: string
    inactive: string
    yes: string
    no: string
    you: string
    show: string
    hide: string
    category: string
    subcategory: string
    merchant: string
    from: string
    to: string
    min: string
    max: string
  }
  
  // Meses
  months: {
    january: string
    february: string
    march: string
    april: string
    may: string
    june: string
    july: string
    august: string
    september: string
    october: string
    november: string
    december: string
  }
}

const translations: Record<Language, Translations> = {
  es: {
    nav: {
      dashboard: 'Dashboard',
      budgets: 'Presupuestos',
      transactions: 'Transacciones',
      logs: 'Log de Actividad',
      budgetSummary: 'Concentrado Presupuesto',
      receipts: 'Recibos',
      userRecords: 'Registros de Usuario',
      personalBudget: 'Mi Presupuesto Personal',
      reports: 'Reportes',
      system: 'Sistema',
      logout: 'Cerrar Sesión'
    },
    budgets: {
      title: 'Presupuestos Familiares',
      subtitle: 'Gestión de presupuestos comunes e individuales',
      newBudget: 'Nuevo Presupuesto',
      createBudget: 'Crear Presupuesto',
      editBudget: 'Editar Presupuesto',
      deleteBudget: 'Eliminar Presupuesto',
      category: 'Categoría',
      subcategory: 'Subcategoría',
      year: 'Año',
      totalAmount: 'Monto Total',
      monthlyAmount: 'Monto Mensual',
      annualAmount: 'Monto Anual',
      assigned: 'Asignado',
      spent: 'Gastado',
      available: 'Disponible',
      type: 'Tipo',
      shared: 'Compartido',
      individual: 'Individual',
      distributionMethod: 'Método de Distribución',
      equal: 'Igual',
      percentage: 'Por Porcentaje',
      manual: 'Manual',
      filters: 'Filtros',
      showFilters: 'Mostrar Filtros',
      hideFilters: 'Ocultar Filtros',
      clearFilters: 'Limpiar Filtros',
      globalSummary: 'Resumen Global',
      annualMatrix: 'Matriz Anual',
      budgetComposition: 'Composición del Presupuesto',
      modifyBudget: 'Modificar Presupuesto',
      adminPassword: 'Contraseña de Administrador',
      verifyPassword: 'Verificar',
      passwordIncorrect: 'Contraseña incorrecta',
      budgetCreated: 'Presupuesto creado correctamente',
      budgetUpdated: 'Presupuesto actualizado correctamente',
      budgetDeleted: 'Presupuesto eliminado correctamente',
      selectAccount: 'Seleccionar Cuenta',
      selectContributors: 'Seleccionar Integrantes',
      assignAmounts: 'Asignar Montos',
      frequency: 'Frecuencia de Asignación',
      daily: 'Diario',
      weekly: 'Semanal',
      biweekly: 'Quincenal',
      monthly: 'Mensual',
      bimonthly: 'Bimensual',
      quarterly: 'Trimestral',
      semiannual: 'Semestral',
      annual: 'Anual',
      sameAllMonths: '¿Es igual todos los meses?',
      selectMonths: 'Selecciona los meses',
      variableMonthly: 'Asignación variable por mes',
      totalBudget: 'Monto total del presupuesto',
      distributionMode: 'Modo de distribución',
      totalAmountMode: 'Monto total (dividir igual)',
      percentageMode: 'Distribución por porcentajes',
      amountPerMember: 'Monto por integrante',
      totalAccount: 'Total de la cuenta',
      allMembersSelected: 'Todos los integrantes están seleccionados por defecto',
      selectMembers: 'Seleccionar Integrantes',
      selectAll: 'Seleccionar todos',
      deselectAll: 'Deseleccionar todos',
      membersSelected: 'integrantes seleccionados',
      contributors: 'Integrantes que Contribuyen',
      assignAmountsToMembers: 'Asigna montos a cada integrante',
      defineContribution: 'Define cuánto contribuye cada integrante',
      modifyPercentage: 'Al modificar un porcentaje, la diferencia se distribuye automáticamente',
      percentageDistributed: 'Total porcentajes',
      mustSum100: 'debe sumar 100%'
    },
    transactions: {
      title: 'Transacciones',
      subtitle: 'Gestión de ingresos y egresos',
      newTransaction: 'Nueva Transacción',
      createTransaction: 'Crear Transacción',
      editTransaction: 'Editar Transacción',
      deleteTransaction: 'Eliminar Transacción',
      date: 'Fecha',
      amount: 'Monto',
      type: 'Tipo',
      income: 'Ingreso',
      expense: 'Egreso',
      merchant: 'Comercio',
      beneficiary: 'Beneficiario',
      concept: 'Concepto',
      reference: 'Referencia',
      notes: 'Notas',
      filters: 'Filtros',
      showFilters: 'Mostrar Filtros',
      hideFilters: 'Ocultar Filtros',
      clearFilters: 'Limpiar Filtros',
      uploadReceipt: 'Subir Recibo'
    },
    logs: {
      title: 'Log de Actividad',
      subtitle: 'Registro de todos los movimientos del sistema',
      date: 'Fecha',
      time: 'Hora',
      user: 'Usuario',
      action: 'Acción',
      entity: 'Entidad',
      description: 'Descripción',
      details: 'Detalles',
      viewDetails: 'Ver detalles',
      system: 'Sistema',
      filters: 'Filtros',
      showFilters: 'Mostrar Filtros',
      hideFilters: 'Ocultar Filtros',
      actionType: 'Tipo de Acción',
      entityType: 'Tipo de Entidad',
      period: 'Período',
      days: 'días',
      last7Days: 'Últimos 7 días',
      last30Days: 'Últimos 30 días',
      last90Days: 'Últimos 90 días',
      lastYear: 'Último año',
      clearFilters: 'Limpiar Filtros',
      noLogs: 'No hay logs de actividad para el período seleccionado',
      loadingLogs: 'Cargando logs...'
    },
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Resumen de presupuestos y transacciones',
      allocatedBudget: 'Presupuesto Asignado',
      additionalIncome: 'Ingresos Adicionales',
      spent: 'Gastado',
      available: 'Disponible',
      recentTransactions: 'Transacciones Recientes',
      noTransactions: 'No hay transacciones aún',
      setupFromExcel: 'Configurar desde Excel',
      settingUp: 'Configurando...',
      createUsers: 'Crear Usuarios',
      creating: 'Creando...',
      deleteAll: 'Eliminar Todo',
      deleting: 'Eliminando...',
      loadTestData: 'Cargar Datos de Prueba',
      loading: 'Cargando...',
      clearTestData: 'Borrar Datos de Prueba',
      clearing: 'Borrando...',
      myBudgets: 'Mis Presupuestos'
    },
    budgetSummary: {
      title: 'Concentrado del Presupuesto Anual',
      subtitle: 'Resumen y gestión de todas las cuentas del presupuesto',
      account: 'Cuenta',
      accountName: 'Nombre de la Cuenta',
      category: 'Categoría',
      subcategory: 'Subcategoría',
      editName: 'Editar Nombre',
      save: 'Guardar',
      cancel: 'Cancelar',
      totalAnnual: 'Total Anual',
      monthlyAmount: 'Monto Mensual',
      contributors: 'Contribuyentes',
      distribution: 'Distribución',
      type: 'Tipo',
      shared: 'Compartido',
      individual: 'Individual',
      noAccounts: 'No hay cuentas en el presupuesto',
      loading: 'Cargando concentrado...',
      accountUpdated: 'Cuenta actualizada correctamente',
      errorUpdating: 'Error al actualizar la cuenta'
    },
    common: {
      save: 'Guardar',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      edit: 'Editar',
      create: 'Crear',
      update: 'Actualizar',
      close: 'Cerrar',
      back: 'Volver',
      next: 'Siguiente',
      continue: 'Continuar',
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito',
      confirm: 'Confirmar',
      accept: 'Aceptar',
      all: 'Todos',
      none: 'Ninguno',
      search: 'Buscar',
      filter: 'Filtrar',
      clear: 'Limpiar',
      year: 'Año',
      month: 'Mes',
      day: 'Día',
      total: 'Total',
      subtotal: 'Subtotal',
      percentage: 'Porcentaje',
      amount: 'Monto',
      currency: 'Moneda',
      date: 'Fecha',
      time: 'Hora',
      user: 'Usuario',
      email: 'Correo',
      phone: 'Teléfono',
      name: 'Nombre',
      description: 'Descripción',
      details: 'Detalles',
      status: 'Estado',
      active: 'Activo',
      inactive: 'Inactivo',
      yes: 'Sí',
      no: 'No',
      you: 'Tú',
      show: 'Mostrar',
      hide: 'Ocultar',
      category: 'Categoría',
      subcategory: 'Subcategoría',
      merchant: 'Comercio',
      from: 'Desde',
      to: 'Hasta',
      min: 'Mínimo',
      max: 'Máximo'
    },
    months: {
      january: 'Enero',
      february: 'Febrero',
      march: 'Marzo',
      april: 'Abril',
      may: 'Mayo',
      june: 'Junio',
      july: 'Julio',
      august: 'Agosto',
      september: 'Septiembre',
      october: 'Octubre',
      november: 'Noviembre',
      december: 'Diciembre'
    }
  },
  en: {
    nav: {
      dashboard: 'Dashboard',
      budgets: 'Budgets',
      transactions: 'Transactions',
      logs: 'Activity Log',
      budgetSummary: 'Budget Summary',
      receipts: 'Receipts',
      userRecords: 'User Records',
      personalBudget: 'My Personal Budget',
      reports: 'Reports',
      system: 'System',
      logout: 'Logout'
    },
    budgets: {
      title: 'Family Budgets',
      subtitle: 'Management of common and individual budgets',
      newBudget: 'New Budget',
      createBudget: 'Create Budget',
      editBudget: 'Edit Budget',
      deleteBudget: 'Delete Budget',
      category: 'Category',
      subcategory: 'Subcategory',
      year: 'Year',
      totalAmount: 'Total Amount',
      monthlyAmount: 'Monthly Amount',
      annualAmount: 'Annual Amount',
      assigned: 'Assigned',
      spent: 'Spent',
      available: 'Available',
      type: 'Type',
      shared: 'Shared',
      individual: 'Individual',
      distributionMethod: 'Distribution Method',
      equal: 'Equal',
      percentage: 'By Percentage',
      manual: 'Manual',
      filters: 'Filters',
      showFilters: 'Show Filters',
      hideFilters: 'Hide Filters',
      clearFilters: 'Clear Filters',
      globalSummary: 'Global Summary',
      annualMatrix: 'Annual Matrix',
      budgetComposition: 'Budget Composition',
      modifyBudget: 'Modify Budget',
      adminPassword: 'Administrator Password',
      verifyPassword: 'Verify',
      passwordIncorrect: 'Incorrect password',
      budgetCreated: 'Budget created successfully',
      budgetUpdated: 'Budget updated successfully',
      budgetDeleted: 'Budget deleted successfully',
      selectAccount: 'Select Account',
      selectContributors: 'Select Contributors',
      assignAmounts: 'Assign Amounts',
      frequency: 'Assignment Frequency',
      daily: 'Daily',
      weekly: 'Weekly',
      biweekly: 'Biweekly',
      monthly: 'Monthly',
      bimonthly: 'Bimonthly',
      quarterly: 'Quarterly',
      semiannual: 'Semiannual',
      annual: 'Annual',
      sameAllMonths: 'Is it the same every month?',
      selectMonths: 'Select months',
      variableMonthly: 'Variable assignment per month',
      totalBudget: 'Total budget amount',
      distributionMode: 'Distribution mode',
      totalAmountMode: 'Total amount (divide equally)',
      percentageMode: 'Distribution by percentages',
      amountPerMember: 'Amount per member',
      totalAccount: 'Account total',
      allMembersSelected: 'All members are selected by default',
      selectMembers: 'Select Members',
      selectAll: 'Select all',
      deselectAll: 'Deselect all',
      membersSelected: 'members selected',
      contributors: 'Contributing Members',
      assignAmountsToMembers: 'Assign amounts to each member',
      defineContribution: 'Define how much each member contributes',
      modifyPercentage: 'When modifying a percentage, the difference is automatically distributed',
      percentageDistributed: 'Total percentages',
      mustSum100: 'must sum 100%'
    },
    transactions: {
      title: 'Transactions',
      subtitle: 'Income and expense management',
      newTransaction: 'New Transaction',
      createTransaction: 'Create Transaction',
      editTransaction: 'Edit Transaction',
      deleteTransaction: 'Delete Transaction',
      date: 'Date',
      amount: 'Amount',
      type: 'Type',
      income: 'Income',
      expense: 'Expense',
      merchant: 'Merchant',
      beneficiary: 'Beneficiary',
      concept: 'Concept',
      reference: 'Reference',
      notes: 'Notes',
      filters: 'Filters',
      showFilters: 'Show Filters',
      hideFilters: 'Hide Filters',
      clearFilters: 'Clear Filters',
      uploadReceipt: 'Upload Receipt'
    },
    logs: {
      title: 'Activity Log',
      subtitle: 'Record of all system movements',
      date: 'Date',
      time: 'Time',
      user: 'User',
      action: 'Action',
      entity: 'Entity',
      description: 'Description',
      details: 'Details',
      viewDetails: 'View details',
      system: 'System',
      filters: 'Filters',
      showFilters: 'Show Filters',
      hideFilters: 'Hide Filters',
      actionType: 'Action Type',
      entityType: 'Entity Type',
      period: 'Period',
      days: 'days',
      last7Days: 'Last 7 days',
      last30Days: 'Last 30 days',
      last90Days: 'Last 90 days',
      lastYear: 'Last year',
      clearFilters: 'Clear Filters',
      noLogs: 'No activity logs for the selected period',
      loadingLogs: 'Loading logs...'
    },
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Summary of budgets and transactions',
      allocatedBudget: 'Allocated Budget',
      additionalIncome: 'Additional Income',
      spent: 'Spent',
      available: 'Available',
      recentTransactions: 'Recent Transactions',
      noTransactions: 'No transactions yet',
      setupFromExcel: 'Setup from Excel',
      settingUp: 'Setting up...',
      createUsers: 'Create Users',
      creating: 'Creating...',
      deleteAll: 'Delete All',
      deleting: 'Deleting...',
      loadTestData: 'Load Test Data',
      loading: 'Loading...',
      clearTestData: 'Clear Test Data',
      clearing: 'Clearing...',
      myBudgets: 'My Budgets'
    },
    budgetSummary: {
      title: 'Annual Budget Summary',
      subtitle: 'Summary and management of all budget accounts',
      account: 'Account',
      accountName: 'Account Name',
      category: 'Category',
      subcategory: 'Subcategory',
      editName: 'Edit Name',
      save: 'Save',
      cancel: 'Cancel',
      totalAnnual: 'Annual Total',
      monthlyAmount: 'Monthly Amount',
      contributors: 'Contributors',
      distribution: 'Distribution',
      type: 'Type',
      shared: 'Shared',
      individual: 'Individual',
      noAccounts: 'No accounts in the budget',
      loading: 'Loading summary...',
      accountUpdated: 'Account updated successfully',
      errorUpdating: 'Error updating account'
    },
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      update: 'Update',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      continue: 'Continue',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      confirm: 'Confirm',
      accept: 'Accept',
      all: 'All',
      none: 'None',
      search: 'Search',
      filter: 'Filter',
      clear: 'Clear',
      year: 'Year',
      month: 'Month',
      day: 'Day',
      total: 'Total',
      subtotal: 'Subtotal',
      percentage: 'Percentage',
      amount: 'Amount',
      currency: 'Currency',
      date: 'Date',
      time: 'Time',
      user: 'User',
      email: 'Email',
      phone: 'Phone',
      name: 'Name',
      description: 'Description',
      details: 'Details',
      status: 'Status',
      active: 'Active',
      inactive: 'Inactive',
      yes: 'Yes',
      no: 'No',
      you: 'You',
      show: 'Show',
      hide: 'Hide',
      category: 'Category',
      subcategory: 'Subcategory',
      merchant: 'Merchant',
      from: 'From',
      to: 'To',
      min: 'Min',
      max: 'Max'
    },
    months: {
      january: 'January',
      february: 'February',
      march: 'March',
      april: 'April',
      may: 'May',
      june: 'June',
      july: 'July',
      august: 'August',
      september: 'September',
      october: 'October',
      november: 'November',
      december: 'December'
    }
  }
}

// Hook para usar traducciones
export function useTranslation(language: Language = 'es'): Translations {
  return translations[language]
}

// Función helper para obtener traducción
export function t(language: Language = 'es'): Translations {
  return translations[language]
}

// Contexto de idioma (se puede expandir con React Context si es necesario)
export function getLanguage(): Language {
  if (typeof window === 'undefined') return 'es'
  const stored = localStorage.getItem('language') as Language
  return stored && (stored === 'es' || stored === 'en') ? stored : 'es'
}

export function setLanguage(language: Language) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('language', language)
  }
}
