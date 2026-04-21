/**
 * Plantilla de partidas para presupuesto personal (entorno por usuario).
 * Códigos jerárquicos: 6xxx Transporte, 7xxx Educación, 8xxx Salud, 9xxx Otros.
 * Cada item: { code, name, parentCode? } — parentCode = código del padre (opcional).
 */
export const PARTIDAS_TEMPLATE: { code: string; name: string; parentCode?: string }[] = [
  // ═══ 6000 TRANSPORTE ═══
  { code: '6000', name: 'TRANSPORTE' },
  { code: '6100', name: 'Combustible', parentCode: '6000' },
  { code: '6110', name: 'Gasolina LX600', parentCode: '6100' },
  { code: '6120', name: 'Gasolina BMW', parentCode: '6100' },
  { code: '6130', name: 'Gasolina Honda Civic', parentCode: '6100' },
  { code: '6140', name: 'Gasolina Land Cruiser', parentCode: '6100' },
  { code: '6200', name: 'Mantenimiento vehicular', parentCode: '6000' },
  { code: '6210', name: 'Servicio LX600', parentCode: '6200' },
  { code: '6220', name: 'Servicio BMW', parentCode: '6200' },
  { code: '6230', name: 'Servicio Honda Civic', parentCode: '6200' },
  { code: '6240', name: 'Servicio Land Cruiser', parentCode: '6200' },
  { code: '6300', name: 'Seguros vehiculares', parentCode: '6000' },
  { code: '6400', name: 'Verificación / Tenencia', parentCode: '6000' },
  // ═══ 7000 EDUCACIÓN ═══
  { code: '7000', name: 'EDUCACIÓN' },
  { code: '7100', name: 'Colegiaturas', parentCode: '7000' },
  { code: '7110', name: 'Colegiatura - Gonzalo Jr', parentCode: '7100' },
  { code: '7120', name: 'Colegiatura - Sebastián', parentCode: '7100' },
  { code: '7130', name: 'Colegiatura - Emiliano', parentCode: '7100' },
  { code: '7140', name: 'Colegiatura - Isabella', parentCode: '7100' },
  { code: '7150', name: 'Colegiatura - Santiago', parentCode: '7100' },
  { code: '7160', name: 'Colegiatura - Enrique', parentCode: '7100' },
  { code: '7200', name: 'Materiales escolares', parentCode: '7000' },
  { code: '7300', name: 'Uniformes', parentCode: '7000' },
  { code: '7400', name: 'Transporte escolar', parentCode: '7000' },
  { code: '7500', name: 'Extracurriculares', parentCode: '7000' },
  // ═══ 8000 SALUD ═══
  { code: '8000', name: 'SALUD' },
  { code: '8100', name: 'Seguro médico', parentCode: '8000' },
  { code: '8200', name: 'Consultas médicas', parentCode: '8000' },
  { code: '8300', name: 'Medicamentos', parentCode: '8000' },
  { code: '8400', name: 'Dental', parentCode: '8000' },
  { code: '8500', name: 'Óptica', parentCode: '8000' },
  { code: '8600', name: 'Otros gastos médicos', parentCode: '8000' },
  // ═══ 9000 OTROS GASTOS ═══
  { code: '9000', name: 'OTROS GASTOS' },
  { code: '9100', name: 'Ropa y calzado', parentCode: '9000' },
  { code: '9200', name: 'Entretenimiento', parentCode: '9000' },
  { code: '9300', name: 'Regalos y celebraciones', parentCode: '9000' },
  { code: '9400', name: 'Impuestos personales', parentCode: '9000' },
  { code: '9500', name: 'Seguros de vida', parentCode: '9000' },
  { code: '9600', name: 'Donaciones', parentCode: '9000' },
  { code: '9700', name: 'Electrónicos y tecnología', parentCode: '9000' },
  { code: '9710', name: 'Cuidado personal', parentCode: '9000' },
  { code: '9720', name: 'Deportes y fitness', parentCode: '9000' },
  { code: '9730', name: 'Mascotas', parentCode: '9000' },
  { code: '9740', name: 'Viajes y vacaciones', parentCode: '9000' },
  { code: '9750', name: 'Muebles y decoración', parentCode: '9000' },
  { code: '9760', name: 'Suscripciones y membresías', parentCode: '9000' },
  { code: '9900', name: 'Gastos varios', parentCode: '9000' },
]
