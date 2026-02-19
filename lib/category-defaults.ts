/**
 * Categorías y subcategorías predefinidas. Se siembran por familia y luego son editables como las personalizadas.
 */
export const PREDEFINED_CATEGORIES = [
  'Servicios Basicos',
  'Mercado',
  'Vivienda',
  'Transporte',
  'Impuestos',
  'Educacion',
  'Salud',
  'Salud Medicamentos',
  'Vida Social',
]

export const PREDEFINED_SUBCATEGORIES: Record<string, string[]> = {
  'Servicios Basicos': [
    'Electricidad CFE',
    'Agua Potable',
    'Gas LP',
    'Internet',
    'Entretenimiento',
    'Garrafones Agua',
    'Telcel',
  ],
  Mercado: ['Mercado General'],
  Vivienda: ['Cuotas Olinala', 'Seguro Vivienda', 'Mejoras y Remodelaciones'],
  Transporte: [
    'Gasolina',
    'Mantenimiento coches',
    'Seguros y Derechos',
    'Lavado',
    'LX600',
    'BMW',
    'HONDA CIVIC',
    'LAND CRUISER',
  ],
  Impuestos: ['Predial'],
  Educacion: [
    'Colegiaturas',
    'Gonzalo',
    'Sebastian',
    'Emiliano',
    'Isabela',
    'Santiago',
    'Enrique',
  ],
  Salud: ['Consulta', 'Medicamentos', 'Seguro Medico', 'Prevencion'],
  'Salud Medicamentos': [
    'Gonzalo Jr Vuminix, Medikinet',
    'Isabela Luvox, Risperdal',
    'Gonzalo MF, Lexapro, Concerta, Efexxor',
    'Sebastian MB, Concerta',
    'Emiliano MB, Concerta, Vuminix',
  ],
  'Vida Social': [
    'Salidas Personales',
    'Salidas Familiares',
    'Cumpleanos',
    'Aniversarios',
    'Regalos Navidad',
    'Salidas Gonzalo',
    'Salidas Emiliano',
    'Salidas Sebastian',
    'Semana Isabela',
    'Semana Santiago',
  ],
}
