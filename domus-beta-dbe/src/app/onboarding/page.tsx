'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = [
  'Bienvenida',
  'Integrantes',
  'Mascotas',
  'Vehículos',
  'Casa y espacios',
  'Electrodomésticos',
  'Fondos y proyectos',
  'Servicios y categorías',
  'Resumen',
]
const TOTAL_STEPS = STEPS.length

type Integrante = { name: string; age?: string }
type Mascota = { name: string; type: string }
type Vehiculo = { id: string; name: string; type: string; marca: string; modelo: string; year: string; serie: string; photos: string[]; videos: string[] }
type Categoria = { name: string; monthlyLimit?: number; selected?: boolean }
/** Una unidad de electrodoméstico: tipo, año, modelo, código inventario (PREF-SUF), 3-10 fotos y 2 videos (URLs en storage). */
type ElectroEntry = {
  id: string
  typeName: string
  year: string
  model: string
  codePrefix: string
  codeSuffix: string
  photos: string[]
  videos: string[]
}
const MAX_PHOTOS_PER_ITEM = 10
const MIN_PHOTOS_PER_ITEM = 3
const MAX_VIDEOS_PER_ITEM = 2
type FondoItem = { name: string; type: 'FUND' | 'PROJECT'; selected?: boolean }

const MASCOTA_TIPOS = ['Perro', 'Gato', 'Ave', 'Pez', 'Roedor', 'Reptil', 'Otro']
const VEHICULO_TIPOS = ['Auto', 'Camioneta', 'SUV', 'Moto', 'Bici', 'Otro']

const ELECTRODOMESTICOS_PREDEF = [
  'Refrigerador', 'Estufa', 'Horno de microondas', 'Aire acondicionado', 'Calentador',
  'TV', 'Computadora(s)', 'Teléfono(s)', 'Tablet', 'Lavadora', 'Secadora',
  'Cama(s) / colchones', 'Ventilador', 'Aspiradora', 'Licuadora', 'Otro',
]
/** Prefijo de 3 letras por tipo para código de inventario (fácil de identificar y memorizar). */
const ELECTRO_CODE_PREFIX: Record<string, string> = {
  'Refrigerador': 'REF',
  'Estufa': 'EST',
  'Horno de microondas': 'MIC',
  'Aire acondicionado': 'AIR',
  'Calentador': 'CAL',
  'TV': 'TVS',
  'Computadora(s)': 'CPU',
  'Teléfono(s)': 'TEL',
  'Tablet': 'TAB',
  'Lavadora': 'LAV',
  'Secadora': 'SEC',
  'Cama(s) / colchones': 'CAM',
  'Ventilador': 'VEN',
  'Aspiradora': 'ASP',
  'Licuadora': 'LIC',
  'Otro': 'OTR',
}
function getDefaultElectroPrefix(typeName: string): string {
  return ELECTRO_CODE_PREFIX[typeName] ?? typeName.slice(0, 3).toUpperCase().padEnd(3, 'X')
}
function nextSuffixForType(entries: ElectroEntry[], typeName: string): string {
  const used = new Set(entries.filter((e) => e.typeName === typeName).map((e) => e.codeSuffix.slice(0, 3).toUpperCase()))
  const words = ['UNO', 'DOS', 'MAS', 'ALF', 'BET', 'GAM', 'SAL', 'SOL', 'MAR', 'DIA', 'MES', 'CEN', 'SUR', 'OES', 'PRI', 'SEG', 'TER', 'CUA', 'QUI', 'SEI', 'SIE', 'OCH', 'NUE']
  for (const w of words) {
    const s = w.slice(0, 3).toUpperCase()
    if (!used.has(s)) return s
  }
  for (let n = 1; n <= 99; n++) {
    const s = String(n).padStart(3, '0')
    if (!used.has(s)) return s
  }
  return 'XXX'
}

const FONDOS_PREDEF: { name: string; type: 'FUND' | 'PROJECT' }[] = [
  { name: 'Fondo de emergencia', type: 'FUND' },
  { name: 'Retiro', type: 'FUND' },
  { name: 'Educación (hijos)', type: 'FUND' },
  { name: 'Ahorro Navidad', type: 'FUND' },
  { name: 'Ahorro carro nuevo', type: 'FUND' },
  { name: 'Inversión', type: 'FUND' },
  { name: 'Vacaciones', type: 'PROJECT' },
  { name: 'Otro proyecto', type: 'PROJECT' },
]

const CATEGORIAS_PREDEF = [
  { name: 'Renta / Hipoteca', sugerido: 0 },
  { name: 'CFE / Luz', sugerido: 800 },
  { name: 'Agua y drenaje', sugerido: 200 },
  { name: 'Mantenimiento fraccionamiento', sugerido: 300 },
  { name: 'Internet / Teléfono', sugerido: 500 },
  { name: 'Supermercado', sugerido: 4000 },
  { name: 'Restaurantes', sugerido: 0 },
  { name: 'Medicinas', sugerido: 500 },
  { name: 'Salud / Doctor', sugerido: 0 },
  { name: 'Farmacia', sugerido: 0 },
  { name: 'Ropa', sugerido: 0 },
  { name: 'Gasolina', sugerido: 0 },
  { name: 'Mantenimiento auto', sugerido: 0 },
  { name: 'Seguro auto', sugerido: 0 },
  { name: 'Mascotas', sugerido: 0 },
  { name: 'Veterinario', sugerido: 0 },
  { name: 'Colegiaturas', sugerido: 0 },
  { name: 'Útiles escolares', sugerido: 0 },
  { name: 'Limpieza / Hogar', sugerido: 0 },
  { name: 'Reparaciones de casa', sugerido: 0 },
  { name: 'Entretenimiento', sugerido: 0 },
  { name: 'Suscripciones', sugerido: 0 },
  { name: 'Ahorro', sugerido: 0 },
  { name: 'Vacaciones', sugerido: 0 },
  { name: 'Cumpleaños', sugerido: 0 },
  { name: 'Eventos familiares', sugerido: 0 },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [canShow, setCanShow] = useState(false)
  const [userName, setUserName] = useState('')

  const [integrantes, setIntegrantes] = useState<Integrante[]>([])
  const [nuevoIntegrante, setNuevoIntegrante] = useState('')
  const [mascotas, setMascotas] = useState<Mascota[]>([])
  const [nuevaMascotaName, setNuevaMascotaName] = useState('')
  const [nuevaMascotaTipo, setNuevaMascotaTipo] = useState('Perro')
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [nuevoVehiculoName, setNuevoVehiculoName] = useState('')
  const [nuevoVehiculoTipo, setNuevoVehiculoTipo] = useState('Auto')
  const [casa, setCasa] = useState(true)
  const [jardin, setJardin] = useState(false)
  const [nombreJardin, setNombreJardin] = useState('Jardín')
  const [comidaFamilia, setComidaFamilia] = useState(true)
  const [electroEntries, setElectroEntries] = useState<ElectroEntry[]>([])
  const [fondos, setFondos] = useState<FondoItem[]>(() =>
    FONDOS_PREDEF.map((f) => ({ ...f, selected: false }))
  )
  const [nuevoFondoName, setNuevoFondoName] = useState('')
  const [categorias, setCategorias] = useState<Categoria[]>(() =>
    CATEGORIAS_PREDEF.map((c) => ({ name: c.name, monthlyLimit: c.sugerido || undefined, selected: true }))
  )
  const [nuevaCategoriaName, setNuevaCategoriaName] = useState('')

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const res = await fetch('/api/setup/onboarding-status', { credentials: 'include' })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        setCanShow(!!data.canShowOnboarding && !!data.hasFamily)
        if (data.isAdmin && data.hasFamily) {
          const meRes = await fetch('/api/auth/me', { credentials: 'include' })
          const meData = await meRes.json().catch(() => ({}))
          if (meData?.ok && meData?.user) setUserName(meData.user.name ?? '')
        }
        if (!data.hasFamily) { router.replace('/ui'); return }
        if (!data.canShowOnboarding) { router.replace('/ui'); return }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [router])

  const addIntegrante = () => {
    const name = nuevoIntegrante.trim()
    if (!name) return
    setIntegrantes((prev) => [...prev, { name }])
    setNuevoIntegrante('')
  }
  const removeIntegrante = (i: number) => setIntegrantes((prev) => prev.filter((_, idx) => idx !== i))

  const addMascota = () => {
    const name = nuevaMascotaName.trim() || 'Mascota'
    setMascotas((prev) => [...prev, { name, type: nuevaMascotaTipo }])
    setNuevaMascotaName('')
    setNuevaMascotaTipo('Perro')
  }
  const removeMascota = (i: number) => setMascotas((prev) => prev.filter((_, idx) => idx !== i))

  const addVehiculo = () => {
    const name = nuevoVehiculoName.trim() || nuevoVehiculoTipo
    setVehiculos((prev) => [...prev, { id: crypto.randomUUID(), name, type: nuevoVehiculoTipo, marca: '', modelo: '', year: '', serie: '', photos: [], videos: [] }])
    setNuevoVehiculoName('')
    setNuevoVehiculoTipo('Auto')
  }
  const addVariosVehiculos = (tipo: string, cantidad: number) => {
    const nuevos: Vehiculo[] = Array.from({ length: cantidad }, (_, i) => {
      const name = tipo === 'Auto' ? (i === 0 ? 'Auto' : `Auto ${i + 1}`)
        : tipo === 'Camioneta' ? (i === 0 ? 'Camioneta' : `Camioneta ${i + 1}`)
        : tipo === 'Moto' ? (i === 0 ? 'Moto' : `Moto ${i + 1}`)
        : tipo === 'Bici' ? (i === 0 ? 'Bici familiar' : `Bici ${i + 1}`)
        : (i === 0 ? tipo : `${tipo} ${i + 1}`)
      return { id: crypto.randomUUID(), name, type: tipo, marca: '', modelo: '', year: '', serie: '', photos: [], videos: [] }
    })
    setVehiculos((prev) => [...prev, ...nuevos])
  }
  const removeVehiculo = (i: number) => setVehiculos((prev) => prev.filter((_, idx) => idx !== i))
  const updateVehiculo = (id: string, field: keyof Pick<Vehiculo, 'marca' | 'modelo' | 'year' | 'serie'>, value: string) => {
    setVehiculos((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)))
  }
  const addVehiclePhoto = (id: string, url: string) => {
    setVehiculos((prev) => prev.map((v) => v.id === id && v.photos.length < MAX_PHOTOS_PER_ITEM ? { ...v, photos: [...v.photos, url] } : v))
  }
  const removeVehiclePhoto = (id: string, index: number) => {
    setVehiculos((prev) => prev.map((v) => v.id === id ? { ...v, photos: v.photos.filter((_, i) => i !== index) } : v))
  }
  const addVehicleVideo = (id: string, url: string) => {
    setVehiculos((prev) => prev.map((v) => v.id === id && v.videos.length < MAX_VIDEOS_PER_ITEM ? { ...v, videos: [...v.videos, url] } : v))
  }
  const removeVehicleVideo = (id: string, index: number) => {
    setVehiculos((prev) => prev.map((v) => v.id === id ? { ...v, videos: v.videos.filter((_, i) => i !== index) } : v))
  }
  const onVehicleMediaUpload = async (id: string, kind: 'PHOTO' | 'VIDEO', ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    if (!file) return
    ev.target.value = ''
    setUploadingMediaFor(id)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('kind', kind)
      const res = await fetch('/api/setup/upload-asset-media', { method: 'POST', credentials: 'include', body: form })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        if (kind === 'PHOTO') addVehiclePhoto(id, data.url)
        else addVehicleVideo(id, data.url)
      } else {
        alert(data.detail || 'No se pudo subir el archivo')
      }
    } catch (e) {
      alert('Error al subir')
    } finally {
      setUploadingMediaFor(null)
    }
  }

  const addElectroEntry = (typeName: string) => {
    setElectroEntries((prev) => {
      const prefix = getDefaultElectroPrefix(typeName)
      const suffix = nextSuffixForType(prev, typeName)
      return [...prev, { id: crypto.randomUUID(), typeName, year: '', model: '', codePrefix: prefix, codeSuffix: suffix, photos: [], videos: [] }]
    })
  }
  const updateElectroEntry = (id: string, field: keyof Pick<ElectroEntry, 'year' | 'model' | 'codePrefix' | 'codeSuffix'>, value: string) => {
    const normalized = (field === 'codePrefix' || field === 'codeSuffix') ? value.slice(0, 3).toUpperCase() : value
    setElectroEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: normalized } : e)))
  }
  const [uploadingMediaFor, setUploadingMediaFor] = useState<string | null>(null)
  const addElectroPhoto = (id: string, url: string) => {
    setElectroEntries((prev) => prev.map((e) => (e.id === id && e.photos.length < MAX_PHOTOS_PER_ITEM ? { ...e, photos: [...e.photos, url] } : e)))
  }
  const removeElectroPhoto = (id: string, index: number) => {
    setElectroEntries((prev) => prev.map((e) => (e.id === id ? { ...e, photos: e.photos.filter((_, i) => i !== index) } : e)))
  }
  const addElectroVideo = (id: string, url: string) => {
    setElectroEntries((prev) => prev.map((e) => (e.id === id && e.videos.length < MAX_VIDEOS_PER_ITEM ? { ...e, videos: [...e.videos, url] } : e)))
  }
  const removeElectroVideo = (id: string, index: number) => {
    setElectroEntries((prev) => prev.map((e) => (e.id === id ? { ...e, videos: e.videos.filter((_, i) => i !== index) } : e)))
  }
  const onElectroMediaUpload = async (id: string, kind: 'PHOTO' | 'VIDEO', ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    if (!file) return
    ev.target.value = ''
    setUploadingMediaFor(id)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('kind', kind)
      const res = await fetch('/api/setup/upload-asset-media', { method: 'POST', credentials: 'include', body: form })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        if (kind === 'PHOTO') addElectroPhoto(id, data.url)
        else addElectroVideo(id, data.url)
      } else {
        alert(data.detail || 'No se pudo subir el archivo')
      }
    } catch (e) {
      alert('Error al subir')
    } finally {
      setUploadingMediaFor(null)
    }
  }
  const removeElectroEntry = (id: string) => setElectroEntries((prev) => prev.filter((e) => e.id !== id))

  const toggleFondo = (i: number) => {
    setFondos((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], selected: !next[i].selected }
      return next
    })
  }
  const addFondoCustom = () => {
    const name = nuevoFondoName.trim()
    if (!name) return
    setFondos((prev) => [...prev, { name, type: 'FUND', selected: true }])
    setNuevoFondoName('')
  }

  const setCategoriaLimit = (index: number, value: number | '') => {
    setCategorias((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], monthlyLimit: value === '' ? undefined : value }
      return next
    })
  }
  const toggleCategoria = (index: number, selected: boolean) => {
    setCategorias((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], selected }
      return next
    })
  }
  const addCategoriaCustom = () => {
    const name = nuevaCategoriaName.trim()
    if (!name) return
    if (categorias.some((c) => c.name.toLowerCase() === name.toLowerCase())) return
    setCategorias((prev) => [...prev, { name, monthlyLimit: undefined, selected: true }])
    setNuevaCategoriaName('')
  }
  const removeCategoriaCustom = (index: number) => {
    const c = categorias[index]
    if (CATEGORIAS_PREDEF.some((p) => p.name === c.name)) return
    setCategorias((prev) => prev.filter((_, i) => i !== index))
  }
  const isCategoriaSelected = (c: Categoria) => c.selected !== false
  const categoriasSeleccionadas = categorias.filter((c) => c.selected !== false)
  const fondosSeleccionados = fondos.filter((f) => f.selected)
  const isCategoriaPredef = (name: string) => CATEGORIAS_PREDEF.some((p) => p.name === name)

  const handleFinalizar = async () => {
    setMessage('')
    setSubmitting(true)
    try {
      const payload = {
        integrantes: (userName && String(userName).trim()) ? [{ name: String(userName).trim() }, ...integrantes] : integrantes,
        mascotas,
        vehiculos: vehiculos.map((v) => ({
          name: v.name,
          type: v.type,
          marca: v.marca?.trim() || undefined,
          modelo: v.modelo?.trim() || undefined,
          year: v.year?.trim() || undefined,
          serie: v.serie?.trim() || undefined,
          photos: v.photos.slice(0, MAX_PHOTOS_PER_ITEM),
          videos: v.videos.slice(0, MAX_VIDEOS_PER_ITEM),
        })),
        casa,
        jardin: jardin ? nombreJardin : false,
        comidaFamilia,
        fondos: fondosSeleccionados.map((f) => ({ name: f.name, type: f.type })),
        categorias: categoriasSeleccionadas.map((c) => ({ name: c.name, monthlyLimit: 0 })),
        inventory: electroEntries.map((e) => ({
          typeName: e.typeName,
          year: e.year || undefined,
          model: e.model || undefined,
          inventoryCode: [e.codePrefix, e.codeSuffix].filter(Boolean).join('-') || undefined,
          photos: e.photos.slice(0, MAX_PHOTOS_PER_ITEM),
          videos: e.videos.slice(0, MAX_VIDEOS_PER_ITEM),
        })),
      }
      const res = await fetch('/api/setup/onboarding', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data.detail || 'No se pudo completar la configuración')
        return
      }
      router.replace('/ui?onboarding=done')
    } catch (e: any) {
      setMessage(e?.message || 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="sapRoot" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="sapRoot onboardingRoot" style={{ minHeight: '100vh' }}>
      <header className="sapHeader" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="sapHeaderLeft">
          <span className="sapBrand" style={{ cursor: 'pointer' }} onClick={() => router.push('/ui')}>DOMUS+</span>
          <span className="muted" style={{ fontSize: 13 }}>Configuración de familia</span>
        </div>
        <div className="sapHeaderRight">
          <span className="pill">Paso {step + 1} de {TOTAL_STEPS}</span>
          <button type="button" className="btn btnGhost btnSm" onClick={() => router.push('/ui')}>Salir</button>
        </div>
      </header>
      <div role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={TOTAL_STEPS} style={{ height: 4, background: 'var(--border)', width: '100%' }}>
        <div style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.2s ease' }} />
      </div>
      <main className="onboardingMain">
        {message ? <div className="alert">{message}</div> : null}

        {step === 0 && (
          <>
            <div className="onboardingStepHead">
              <h1 className="onboardingStepTitle">Configura tu familia en DOMUS</h1>
              <p className="onboardingStepDesc">Quién vive en casa, mascotas, vehículos, electrodomésticos, fondos y gastos. Puedes omitir cualquier paso y completarlo después en Presupuesto.</p>
            </div>
            <div className="onboardingStepActions">
              <button type="button" className="btn btnPrimary" onClick={() => setStep(1)}>Comenzar</button>
              <button type="button" className="btn btnGhost" onClick={() => router.push('/ui')}>Ya tengo destinos configurados</button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="onboardingStepHead">
              <h1 className="onboardingStepTitle">¿Quiénes viven en casa?</h1>
              <p className="onboardingStepDesc">Agrega los nombres. Tú ya estás incluido como administrador.</p>
            </div>
            <div className="onboardingFormRow">
              <input className="input" placeholder="Nombre de integrante" value={nuevoIntegrante} onChange={(e) => setNuevoIntegrante(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIntegrante())} />
              <button type="button" className="btn btnPrimary btnSm" onClick={addIntegrante} disabled={!nuevoIntegrante.trim()}>Agregar</button>
            </div>
            {userName && <div className="pill pillOk">Tú (admin): {userName}</div>}
            <ul className="onboardingList">
              {integrantes.map((item, i) => (
                <li key={i} className="onboardingListItem">
                  <span>{item.name}</span>
                  <button type="button" className="btn btnGhost btnSm" onClick={() => removeIntegrante(i)}>Eliminar</button>
                </li>
              ))}
            </ul>
            <div className="onboardingStepActions">
              <button type="button" className="btn btnPrimary" onClick={() => setStep(2)}>Siguiente</button>
              <button type="button" className="btn btnGhost" onClick={() => setStep(2)}>Omitir</button>
              <button type="button" className="btn btnGhost" onClick={() => setStep(0)}>Atrás</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="onboardingStepHead">
              <h1 className="onboardingStepTitle">¿Tienen mascotas?</h1>
              <p className="onboardingStepDesc">Cada mascota puede tener su propio presupuesto (veterinario, alimento).</p>
            </div>
            <div className="onboardingFormRow">
              <input className="input" placeholder="Nombre (ej. Luna, Max)" value={nuevaMascotaName} onChange={(e) => setNuevaMascotaName(e.target.value)} />
              <select className="select" value={nuevaMascotaTipo} onChange={(e) => setNuevaMascotaTipo(e.target.value)}>
                {MASCOTA_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button type="button" className="btn btnPrimary btnSm" onClick={addMascota}>Agregar mascota</button>
            </div>
            <ul className="onboardingList">
              {mascotas.map((item, i) => (
                <li key={i} className="onboardingListItem">
                  <span>{item.name} ({item.type})</span>
                  <button type="button" className="btn btnGhost btnSm" onClick={() => removeMascota(i)}>Eliminar</button>
                </li>
              ))}
            </ul>
            <div className="onboardingStepActions">
              <button type="button" className="btn btnPrimary" onClick={() => setStep(3)}>Siguiente</button>
              <button type="button" className="btn btnGhost" onClick={() => setStep(3)}>Omitir</button>
              <button type="button" className="btn btnGhost" onClick={() => setStep(1)}>Atrás</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="onboardingStepHead">
              <h1 className="onboardingStepTitle">¿Qué vehículos tienen?</h1>
              <p className="onboardingStepDesc">Autos, camionetas, motos o bicis. Indica marca, modelo, año y serie. Opcional: fotos o videos (máx 10 fotos, 2 videos por vehículo).</p>
            </div>
            <div className="onboardingQuickAdd">
              <span className="onboardingQuickAddLabel">Agregar rápido:</span>
              <div className="onboardingQuickAddBtns">
                <button type="button" className="btn btnGhost btnSm" onClick={() => addVariosVehiculos('Auto', 1)}>1 Auto</button>
                <button type="button" className="btn btnGhost btnSm" onClick={() => addVariosVehiculos('Auto', 2)}>2 Autos</button>
                <button type="button" className="btn btnGhost btnSm" onClick={() => addVariosVehiculos('Auto', 3)}>3 Autos</button>
                <button type="button" className="btn btnGhost btnSm" onClick={() => addVariosVehiculos('Camioneta', 1)}>Camioneta</button>
                <button type="button" className="btn btnGhost btnSm" onClick={() => addVariosVehiculos('Moto', 1)}>1 Moto</button>
                <button type="button" className="btn btnGhost btnSm" onClick={() => addVariosVehiculos('Bici', 1)}>1 Bici</button>
                <button type="button" className="btn btnGhost btnSm" onClick={() => addVariosVehiculos('Bici', 2)}>2 Bicis</button>
              </div>
            </div>
            <div className="onboardingFormRow">
              <input className="input" placeholder="Nombre (ej. Auto Mamá)" value={nuevoVehiculoName} onChange={(e) => setNuevoVehiculoName(e.target.value)} />
              <select className="select" value={nuevoVehiculoTipo} onChange={(e) => setNuevoVehiculoTipo(e.target.value)}>
                {VEHICULO_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button type="button" className="btn btnPrimary btnSm" onClick={addVehiculo}>Agregar</button>
            </div>
            <ul className="onboardingList">
              {vehiculos.map((item, i) => (
                <li key={item.id} className="onboardingCard">
                  <div className="onboardingCardHead">
                    <strong className="onboardingCardTitle">{item.name} ({item.type})</strong>
                    <button type="button" className="btn btnGhost btnSm" onClick={() => removeVehiculo(i)}>Eliminar</button>
                  </div>
                  <div className="onboardingFieldGrid">
                    <div className="onboardingField">
                      <span className="onboardingFieldLabel">Marca</span>
                      <input type="text" className="input" placeholder="Ej. Toyota" value={item.marca} onChange={(e) => updateVehiculo(item.id, 'marca', e.target.value)} />
                    </div>
                    <div className="onboardingField">
                      <span className="onboardingFieldLabel">Modelo</span>
                      <input type="text" className="input" placeholder="Ej. Corolla" value={item.modelo} onChange={(e) => updateVehiculo(item.id, 'modelo', e.target.value)} />
                    </div>
                    <div className="onboardingField">
                      <span className="onboardingFieldLabel">Año</span>
                      <input type="text" className="input" placeholder="2020" value={item.year} onChange={(e) => updateVehiculo(item.id, 'year', e.target.value)} maxLength={4} />
                    </div>
                    <div className="onboardingField">
                      <span className="onboardingFieldLabel">Serie / Nº serie</span>
                      <input type="text" className="input" placeholder="Opcional" value={item.serie} onChange={(e) => updateVehiculo(item.id, 'serie', e.target.value)} />
                    </div>
                  </div>
                  <div className="onboardingMediaRow">
                    <span className="onboardingMediaLabel">Fotos ({item.photos.length}/{MAX_PHOTOS_PER_ITEM}):</span>
                    {item.photos.map((url, idx) => (
                      <span key={idx} style={{ position: 'relative' }}>
                        <img src={`/api/setup/asset-media/signed?url=${encodeURIComponent(url)}`} alt="" className="onboardingMediaThumb" />
                        <button type="button" className="btn btnGhost btnSm" style={{ position: 'absolute', top: -4, right: -4, minWidth: 24, padding: 0, fontSize: 10 }} onClick={() => removeVehiclePhoto(item.id, idx)}>×</button>
                      </span>
                    ))}
                    {item.photos.length < MAX_PHOTOS_PER_ITEM && (
                      <label className="btn btnGhost btnSm" style={{ margin: 0, cursor: uploadingMediaFor === item.id ? 'wait' : 'pointer' }}>
                        {uploadingMediaFor === item.id ? 'Subiendo…' : `+ Foto`}
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} onChange={(ev) => onVehicleMediaUpload(item.id, 'PHOTO', ev)} disabled={!!uploadingMediaFor} />
                      </label>
                    )}
                  </div>
                  <div className="onboardingMediaRow">
                    <span className="onboardingMediaLabel">Videos ({item.videos.length}/{MAX_VIDEOS_PER_ITEM}):</span>
                    {item.videos.map((url, idx) => (
                      <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span className="onboardingMediaPlaceholder">🎬</span>
                        <button type="button" className="btn btnGhost btnSm" style={{ minWidth: 24, padding: 0 }} onClick={() => removeVehicleVideo(item.id, idx)}>×</button>
                      </span>
                    ))}
                    {item.videos.length < MAX_VIDEOS_PER_ITEM && (
                      <label className="btn btnGhost btnSm" style={{ margin: 0, cursor: uploadingMediaFor === item.id ? 'wait' : 'pointer' }}>
                        {uploadingMediaFor === item.id ? '…' : '+ Video'}
                        <input type="file" accept="video/mp4,video/webm,video/quicktime" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} onChange={(ev) => onVehicleMediaUpload(item.id, 'VIDEO', ev)} disabled={!!uploadingMediaFor} />
                      </label>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="onboardingStepActions">
              <button type="button" className="btn btnPrimary" onClick={() => setStep(4)}>Siguiente</button>
              <button type="button" className="btn btnGhost" onClick={() => setStep(4)}>Omitir</button>
              <button type="button" className="btn btnGhost" onClick={() => setStep(2)}>Atrás</button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="onboardingStepHead">
              <h1 className="onboardingStepTitle">Casa y espacios</h1>
              <p className="onboardingStepDesc">Destinos para gastos del hogar: casa (luz, agua, mantenimiento), jardín y comida en familia.</p>
            </div>
            <div className="onboardingOptionsBlock">
              <label className="checkboxRow onboardingOptionRow">
                <input type="checkbox" checked={casa} onChange={(e) => setCasa(e.target.checked)} />
                Incluir destino Casa (renta, luz, agua, reparaciones)
              </label>
              <label className="checkboxRow onboardingOptionRow">
                <input type="checkbox" checked={jardin} onChange={(e) => setJardin(e.target.checked)} />
                Tenemos jardín (destino separado)
              </label>
              {jardin && (
                <div className="onboardingFormRow" style={{ marginLeft: 24 }}>
                  <input className="input" placeholder="Nombre (ej. Jardín)" value={nombreJardin} onChange={(e) => setNombreJardin(e.target.value)} style={{ maxWidth: 200 }} />
                </div>
              )}
              <label className="checkboxRow onboardingOptionRow">
                <input type="checkbox" checked={comidaFamilia} onChange={(e) => setComidaFamilia(e.target.checked)} />
                Incluir destino Comida (Familia) para supermercado y restaurantes compartidos
              </label>
            </div>
            <div className="onboardingStepActions">
              <button type="button" className="btn btnPrimary" onClick={() => setStep(5)}>Siguiente</button>
              <button type="button" className="btn btnGhost" onClick={() => setStep(3)}>Atrás</button>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <div className="onboardingStepHead">
              <h1 className="onboardingStepTitle">Electrodomésticos y muebles</h1>
              <p className="onboardingStepDesc">Varias unidades por tipo. Código de inventario (ej. TVS-ALF). Fotos (3-10) y videos (2) por ítem; se guardan para reportes.</p>
            </div>
            <div className="onboardingElectroScroll">
              {ELECTRODOMESTICOS_PREDEF.map((typeName) => {
                const entries = electroEntries.filter((e) => e.typeName === typeName)
                return (
                  <div key={typeName} className="onboardingElectroSection">
                    <div className="onboardingElectroSectionHead">
                      <strong>{typeName}</strong>
                      <button type="button" className="btn btnPrimary btnSm" onClick={() => addElectroEntry(typeName)}>Añadir {typeName}</button>
                    </div>
                    {entries.length === 0 ? (
                      <p className="muted" style={{ fontSize: 13 }}>Ninguno añadido</p>
                    ) : (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {entries.map((e) => (
                          <li key={e.id} className="onboardingElectroItem">
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 'var(--space-12)' }}>
                              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                                <div className="onboardingElectroFields">
                                  <input type="text" className="input" placeholder="Año" value={e.year} onChange={(ev) => updateElectroEntry(e.id, 'year', ev.target.value)} style={{ width: 64 }} maxLength={4} />
                                  <input type="text" className="input" placeholder="Modelo / marca" value={e.model} onChange={(ev) => updateElectroEntry(e.id, 'model', ev.target.value)} style={{ minWidth: 120, flex: 1 }} />
                                </div>
                                <div className="onboardingElectroCode">
                                  <span className="muted" style={{ fontSize: 12 }}>Código:</span>
                                  <input type="text" className="input" value={e.codePrefix} onChange={(ev) => updateElectroEntry(e.id, 'codePrefix', ev.target.value)} maxLength={3} />
                                  <span>-</span>
                                  <input type="text" className="input" value={e.codeSuffix} onChange={(ev) => updateElectroEntry(e.id, 'codeSuffix', ev.target.value)} maxLength={3} />
                                  <span style={{ fontSize: 12, fontWeight: 600 }}>{[e.codePrefix, e.codeSuffix].filter(Boolean).join('-') || '—'}</span>
                                </div>
                                <div className="onboardingMediaRow">
                                  <span className="onboardingMediaLabel">Fotos ({e.photos.length}/{MAX_PHOTOS_PER_ITEM}):</span>
                                  {e.photos.map((url, i) => (
                                    <span key={i} style={{ position: 'relative' }}>
                                      <img src={`/api/setup/asset-media/signed?url=${encodeURIComponent(url)}`} alt="" className="onboardingMediaThumb" />
                                      <button type="button" className="btn btnGhost btnSm" style={{ position: 'absolute', top: -4, right: -4, minWidth: 22, padding: 0, fontSize: 10 }} onClick={() => removeElectroPhoto(e.id, i)}>×</button>
                                    </span>
                                  ))}
                                  {e.photos.length < MAX_PHOTOS_PER_ITEM && (
                                    <label className="btn btnGhost btnSm" style={{ margin: 0, cursor: uploadingMediaFor === e.id ? 'wait' : 'pointer' }}>
                                      {uploadingMediaFor === e.id ? '…' : '+ Foto'}
                                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} onChange={(ev) => onElectroMediaUpload(e.id, 'PHOTO', ev)} disabled={!!uploadingMediaFor} />
                                    </label>
                                  )}
                                </div>
                                <div className="onboardingMediaRow">
                                  <span className="onboardingMediaLabel">Videos ({e.videos.length}/{MAX_VIDEOS_PER_ITEM}):</span>
                                  {e.videos.map((url, i) => (
                                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                      <span className="onboardingMediaPlaceholder">🎬</span>
                                      <button type="button" className="btn btnGhost btnSm" style={{ minWidth: 22, padding: 0 }} onClick={() => removeElectroVideo(e.id, i)}>×</button>
                                    </span>
                                  ))}
                                  {e.videos.length < MAX_VIDEOS_PER_ITEM && (
                                    <label className="btn btnGhost btnSm" style={{ margin: 0, cursor: uploadingMediaFor === e.id ? 'wait' : 'pointer' }}>
                                      {uploadingMediaFor === e.id ? '…' : '+ Video'}
                                      <input type="file" accept="video/mp4,video/webm,video/quicktime" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} onChange={(ev) => onElectroMediaUpload(e.id, 'VIDEO', ev)} disabled={!!uploadingMediaFor} />
                                    </label>
                                  )}
                                </div>
                              </div>
                              <button type="button" className="btn btnGhost btnSm" onClick={() => removeElectroEntry(e.id)}>Eliminar</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="onboardingStepActions">
              <button type="button" className="btn btnPrimary" onClick={() => setStep(6)}>Siguiente</button>
              <button type="button" className="btn btnGhost" onClick={() => setStep(6)}>Omitir</button>
              <button type="button" className="btn btnGhost" onClick={() => setStep(4)}>Atrás</button>
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <div className="onboardingStepHead">
              <h1 className="onboardingStepTitle">Fondos y proyectos</h1>
              <p className="onboardingStepDesc">Fondos de ahorro (emergencia, retiro, educación) y proyectos (vacaciones, etc.).</p>
            </div>
            <div className="onboardingCheckGrid">
              {fondos.map((f, i) => (
                <label key={i} className="checkboxRow onboardingCheckItem">
                  <input type="checkbox" checked={f.selected} onChange={() => toggleFondo(i)} />
                  <span>{f.name}</span>
                  <span className="muted">({f.type === 'FUND' ? 'Fondo' : 'Proyecto'})</span>
                </label>
              ))}
            </div>
            <div className="onboardingFormRow">
              <input className="input" placeholder="Otro fondo (nombre)" value={nuevoFondoName} onChange={(e) => setNuevoFondoName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFondoCustom())} />
              <button type="button" className="btn btnPrimary btnSm" onClick={addFondoCustom} disabled={!nuevoFondoName.trim()}>Agregar</button>
            </div>
            <div className="onboardingStepActions">
              <button type="button" className="btn btnPrimary" onClick={() => setStep(7)}>Siguiente</button>
              <button type="button" className="btn btnGhost" onClick={() => setStep(7)}>Omitir</button>
              <button type="button" className="btn btnGhost" onClick={() => setStep(5)}>Atrás</button>
            </div>
          </>
        )}

        {step === 7 && (
          <>
            <div className="onboardingStepHead">
              <h1 className="onboardingStepTitle">Servicios y categorías de gasto</h1>
              <p className="onboardingStepDesc">Tipos de gasto a seguir. Puedes añadir categorías propias. El presupuesto se asigna después en /ui → Presupuesto por destino (Casa, autos, personas).</p>
            </div>
            <div className="onboardingCheckGrid">
              {categorias.map((c, i) => (
                <div key={i} className="onboardingCheckItem" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-8)' }}>
                  <label className="checkboxRow" style={{ flex: '1 1 200px', minWidth: 0, margin: 0 }}>
                    <input type="checkbox" checked={isCategoriaSelected(c)} onChange={(e) => toggleCategoria(i, e.target.checked)} />
                    <span style={{ minWidth: 0 }}>{c.name}</span>
                  </label>
                  {!isCategoriaPredef(c.name) && (
                    <button type="button" className="btn btnGhost btnSm" onClick={() => removeCategoriaCustom(i)}>Eliminar</button>
                  )}
                </div>
              ))}
            </div>
            <div className="onboardingFormRow">
              <input className="input" placeholder="Nueva categoría (ej. Cumpleaños padre)" value={nuevaCategoriaName} onChange={(e) => setNuevaCategoriaName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategoriaCustom())} />
              <button type="button" className="btn btnPrimary btnSm" onClick={addCategoriaCustom} disabled={!nuevaCategoriaName.trim()}>Añadir categoría</button>
            </div>
            <div className="onboardingStepActions">
              <button type="button" className="btn btnPrimary" onClick={() => setStep(8)}>Siguiente</button>
              <button type="button" className="btn btnGhost" onClick={() => setStep(6)}>Atrás</button>
            </div>
          </>
        )}

        {step === 8 && (
          <>
            <div className="onboardingStepHead">
              <h1 className="onboardingStepTitle">Revisa y termina</h1>
              <p className="onboardingStepDesc">Así quedará tu familia. Puedes cambiar todo después en Presupuesto.</p>
            </div>
            <div className="onboardingSummary">
              <p className="onboardingSummaryLine"><strong>Integrantes:</strong> {userName ? [userName, ...integrantes.map((i) => i.name)].join(', ') : integrantes.map((i) => i.name).join(', ') || '—'}</p>
              <p className="onboardingSummaryLine"><strong>Mascotas:</strong> {mascotas.length ? mascotas.map((m) => `${m.name} (${m.type})`).join(', ') : 'Ninguna'}</p>
              <p className="onboardingSummaryLine"><strong>Vehículos:</strong> {vehiculos.length ? vehiculos.map((v) => {
                const det = [v.marca, v.modelo, v.year].filter(Boolean).join(' ')
                return `${v.name} (${v.type})${det ? ` — ${det}` : ''}${v.serie ? ` · Serie: ${v.serie}` : ''}${v.photos.length || v.videos.length ? ` · ${v.photos.length} f, ${v.videos.length} v` : ''}`
              }).join('; ') : 'Ninguno'}</p>
              <p className="onboardingSummaryLine"><strong>Casa:</strong> {casa ? 'Sí' : 'No'} {jardin ? `· Jardín: ${nombreJardin}` : ''} {comidaFamilia ? '· Comida (Familia)' : ''}</p>
              {electroEntries.length > 0 && (
                <p className="onboardingSummaryLine"><strong>Electrodomésticos:</strong> {electroEntries.map((e) => {
                  const code = [e.codePrefix, e.codeSuffix].filter(Boolean).join('-') || '—'
                  return [e.typeName, code, e.year, e.model].filter(Boolean).join(' · ')
                }).join('; ')}</p>
              )}
              {fondosSeleccionados.length > 0 && <p className="onboardingSummaryLine"><strong>Fondos / Proyectos:</strong> {fondosSeleccionados.map((f) => f.name).join(', ')}</p>}
              <p className="onboardingSummaryLine"><strong>Categorías:</strong> {categoriasSeleccionadas.length ? categoriasSeleccionadas.map((c) => c.name).join(', ') : 'Ninguna'}</p>
            </div>
            <div className="onboardingStepActions">
              <button type="button" className="btn btnPrimary" onClick={handleFinalizar} disabled={submitting || !casa}>
                {submitting ? 'Guardando…' : 'Finalizar configuración'}
              </button>
              <button type="button" className="btn btnGhost" onClick={() => setStep(7)} disabled={submitting}>Atrás</button>
            </div>
            {!casa && <p className="muted" style={{ marginTop: 'var(--space-12)' }}>Se requiere al menos el destino Casa para finalizar.</p>}
          </>
        )}
      </main>
    </div>
  )
}
