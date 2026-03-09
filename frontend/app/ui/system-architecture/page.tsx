'use client'

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import SAPLayout from '@/components/SAPLayout'
import { useRouter, useSearchParams } from 'next/navigation'
import ReactFlow, {
  Background,
  Panel,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type FitViewOptions,
  type Node,
} from 'reactflow'
import 'reactflow/dist/style.css'

export const dynamic = 'force-dynamic'

type Vista = 'jerarquia' | 'responsables' | 'presupuesto'
type LayoutMode = 'vertical' | 'horizontal' | 'compacto' | 'expandido'
type LayoutEngine = 'verticalTree' | 'horizontalTree' | 'compactTidy' | 'radial' | 'layered' | 'force'
type OrderMode = 'original' | 'nameAsc' | 'nameDesc' | 'organigrama'
type EdgeKind = 'smooth' | 'ortho'

type Entity = {
  id: string
  name: string
  type: string
  participatesInBudget?: boolean
  participatesInReports?: boolean
  owners?: { userId: string; user?: { name?: string } }[]
}

type Member = { id: string; name?: string; isFamilyAdmin?: boolean }

type Allocation = {
  id: string
  monthlyLimit?: string
  isActive?: boolean
  entity?: { id: string; name: string; type: string }
  category?: { id: string; name: string; type?: string }
}

type DataSet = {
  familyName: string
  members: Member[]
  entities: Entity[]
  allocs: Allocation[]
}

const typeLabel = (t: string) => {
  switch (t) {
    case 'PERSON':
      return 'PERSONA'
    case 'HOUSE':
      return 'VIVIENDA'
    case 'PET':
      return 'MASCOTA'
    case 'VEHICLE':
      return 'VEHÍCULO'
    case 'PROJECT':
      return 'PROYECTO'
    case 'FUND':
      return 'FONDO'
    case 'GROUP':
      return 'GRUPO'
    case 'OTHER':
      return 'PARTIDA'
    default:
      return t || 'PARTIDA'
  }
}

const typeClass = (t: string) => {
  switch (t) {
    case 'PERSON':
      return 'TYPE_PERSON'
    case 'HOUSE':
      return 'TYPE_HOUSE'
    case 'PET':
      return 'TYPE_PET'
    case 'VEHICLE':
      return 'TYPE_VEHICLE'
    case 'PROJECT':
      return 'TYPE_PROJECT'
    case 'FUND':
      return 'TYPE_FUND'
    case 'GROUP':
      return 'TYPE_GROUP'
    case 'OTHER':
      return 'TYPE_OTHER'
    default:
      return 'TYPE_OTHER'
  }
}

const sanitize = (v: string) => String(v || '').replace(/"/g, "'")

const LAYOUT_PRESETS: Record<LayoutMode, { layer: number }> = {
  vertical: { layer: 220 },
  horizontal: { layer: 220 },
  compacto: { layer: 170 },
  expandido: { layer: 260 },
}

type FlowApi = {
  fitView: (opts?: FitViewOptions) => void
  setCenter: (x: number, y: number, opts?: { duration?: number; zoom?: number }) => void
  zoomTo: (zoom: number, opts?: { duration?: number }) => void
}

function FlowApiInjector({ onReady }: { onReady: (api: FlowApi | null) => void }) {
  const { fitView, setCenter, zoomTo } = useReactFlow()
  useEffect(() => {
    onReady({ fitView, setCenter, zoomTo })
    return () => onReady(null)
  }, [fitView, setCenter, zoomTo, onReady])
  return null
}

function SystemArchitecturePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const showBuildSignal = searchParams.get('signal') === '1'
  const [data, setData] = useState<DataSet | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vista, setVista] = useState<Vista>('jerarquia')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('vertical')
  const [orderMode, setOrderMode] = useState<OrderMode>('organigrama')
  const [focusEntityId, setFocusEntityId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [customMode, setCustomMode] = useState(false)
  const [savedPositions, setSavedPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [viewLocked, setViewLocked] = useState(true)
  const [edgeKind, setEdgeKind] = useState<EdgeKind>('smooth')
  const [layoutEngine, setLayoutEngine] = useState<LayoutEngine>('radial')
  const [viewportZoom, setViewportZoom] = useState(1.1)
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 1200, h: 700 })
  const [recalcKey, setRecalcKey] = useState(0)
  const [uiFontScale, setUiFontScale] = useState(1)
  const [uiFontFamily, setUiFontFamily] = useState('Inter, system-ui, sans-serif')
  const [uiTextColor, setUiTextColor] = useState<string | null>(null)
  const [uiNodeBg, setUiNodeBg] = useState<string | null>(null)
  const [nodeBoxScale, setNodeBoxScale] = useState(1)
  const [uiCanvasBg, setUiCanvasBg] = useState('#f8fafc')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [colorEnabled, setColorEnabled] = useState(true)
  const clampScale = (v: number, min = 0.8, max = 1.3) => Math.min(max, Math.max(min, v))
  const skipAutoFitRef = useRef(false)
  const [userMoved, setUserMoved] = useState(false)
  const [lensEnabled, setLensEnabled] = useState(false)
  const [lensSize, setLensSize] = useState(140)
  const [zoomSlider, setZoomSlider] = useState(0.8)
  const [zoomControlEnabled, setZoomControlEnabled] = useState(true)
  const [lastViewport, setLastViewport] = useState<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 })
  const [lensPos, setLensPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [mobileOptionsOpen, setMobileOptionsOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  // Detección móvil en cliente para que aplique desde el primer pintado (no depender del tamaño del diagrama)
  useLayoutEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 520)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const collapseAll = () => {
    setCollapsedIds(new Set(nodes.map((n) => n.id)))
  }

  const expandAll = () => {
    setCollapsedIds(new Set())
  }

  const collapseByType = (t: string | null) => {
    if (!t) return
    const ids = nodes.filter((n) => (n.data as any)?.type === t).map((n) => n.id)
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
  }

  const expandByType = (t: string | null) => {
    if (!t) return
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      nodes.forEach((n) => {
        if ((n.data as any)?.type === t) next.delete(n.id)
      })
      return next
    })
  }
  const gridCols = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').slice(0, 26)
  const gridRows = Array.from({ length: 20 }, (_, i) => i + 1)

  // Fijar viewport: sin scroll vertical ni horizontal en toda la página
  useEffect(() => {
    const prev = {
      bodyOverflow: document.body.style.overflow,
      bodyOverflowX: document.body.style.overflowX,
      bodyHeight: document.body.style.height,
      htmlOverflow: document.documentElement.style.overflow,
      htmlOverflowX: document.documentElement.style.overflowX,
      htmlHeight: document.documentElement.style.height,
    }
    document.body.style.overflow = 'hidden'
    document.body.style.overflowX = 'hidden'
    document.body.style.height = '100vh'
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.style.overflowX = 'hidden'
    document.documentElement.style.height = '100vh'
    return () => {
      document.body.style.overflow = prev.bodyOverflow
      document.body.style.overflowX = prev.bodyOverflowX
      document.body.style.height = prev.bodyHeight
      document.documentElement.style.overflow = prev.htmlOverflow
      document.documentElement.style.overflowX = prev.htmlOverflowX
      document.documentElement.style.height = prev.htmlHeight
    }
  }, [])

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const flowApiRef = useRef<FlowApi | null>(null)
  const [flowApiReady, setFlowApiReady] = useState(false)
  const [initialCentered, setInitialCentered] = useState(false)

  // Cargar posiciones guardadas por usuario/navegador
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('domus-arch-custom-positions')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          setSavedPositions(parsed)
        }
      } catch {}
    }
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const [familyRes, membersRes, entitiesRes, allocsRes] = await Promise.all([
          fetch('/api/families/active'),
          fetch('/api/families/members'),
          fetch('/api/budget/entities'),
          fetch('/api/budget/allocations'),
        ])

        const familyJson = await familyRes.json().catch(() => ({}))
        const membersJson = await membersRes.json().catch(() => ({}))
        const entitiesJson = await entitiesRes.json().catch(() => ({}))
        const allocsJson = await allocsRes.json().catch(() => ({}))

        const familyName = familyJson?.family?.name || familyJson?.family?.id || 'Familia'
        const members: Member[] = Array.isArray(membersJson?.members) ? membersJson.members : []
        const entities: Entity[] = Array.isArray(entitiesJson?.entities) ? entitiesJson.entities : []
        const allocs: Allocation[] = Array.isArray(allocsJson?.allocations) ? allocsJson.allocations : []

        setData({ familyName, members, entities, allocs })
      } catch (e) {
        console.error('No se pudo cargar el organigrama', e)
        setError('No se pudo cargar el organigrama.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Cargar preferencias de UI
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('domus-arch-ui-prefs')
    if (!raw) return
    try {
      const prefs = JSON.parse(raw)
      if (prefs.fontScale) setUiFontScale(clampScale(prefs.fontScale))
      if (prefs.fontFamily) setUiFontFamily(prefs.fontFamily)
      if (prefs.textColor) setUiTextColor(prefs.textColor)
      if (prefs.nodeBg) setUiNodeBg(prefs.nodeBg)
      if (prefs.canvasBg) setUiCanvasBg(prefs.canvasBg)
      if (prefs.nodeBoxScale) setNodeBoxScale(clampScale(prefs.nodeBoxScale))
      if (prefs.typeFilter !== undefined) setTypeFilter(prefs.typeFilter)
      if (typeof prefs.colorEnabled === 'boolean') setColorEnabled(prefs.colorEnabled)
    } catch {}
  }, [])

  // Guardar preferencias de UI
  useEffect(() => {
    if (typeof window === 'undefined') return
    const prefs = {
      fontScale: uiFontScale,
      fontFamily: uiFontFamily,
      textColor: uiTextColor,
      nodeBg: uiNodeBg,
      canvasBg: uiCanvasBg,
      nodeBoxScale,
      typeFilter,
      colorEnabled,
    }
    localStorage.setItem('domus-arch-ui-prefs', JSON.stringify(prefs))
  }, [uiFontScale, uiFontFamily, uiTextColor, uiNodeBg, uiCanvasBg, nodeBoxScale, typeFilter, colorEnabled])

  useEffect(() => {
    const measure = () => {
      const el = document.getElementById('diagram-wrap')
      if (el) {
        const w = el.clientWidth || 1200
        const h = el.clientHeight || 700
        setViewportSize({ w, h })
        if (w > 0 && w < 520) setIsMobile(true)
      }
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => measure())
      : null
    const wrap = document.getElementById('diagram-wrap')
    if (ro && wrap) ro.observe(wrap)
    window.addEventListener('resize', measure)
    return () => {
      if (ro && wrap) ro.unobserve(wrap)
      window.removeEventListener('resize', measure)
    }
  }, [])

  const sortEntities = (entities: Entity[]) => {
    if (orderMode === 'nameAsc') return [...entities].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    if (orderMode === 'nameDesc') return [...entities].sort((a, b) => (b.name || '').localeCompare(a.name || ''))
    return entities
  }

  const typePriority = (t?: string) => {
    switch (t) {
      case 'ROOT':
        return 0
      case 'GOV':
        return 1
      case 'TYPE_PERSON':
        return 2
      case 'TYPE_HOUSE':
      case 'TYPE_VEHICLE':
      case 'TYPE_PROJECT':
        return 3
      case 'TYPE_FUND':
      case 'TYPE_GROUP':
        return 4
      case 'TYPE_OTHER':
      default:
        return 5
    }
  }

  const sortChildren = (nodes: { id: string; label: string; type?: string; children: any[] }[]) => {
    if (orderMode === 'organigrama') {
      nodes.sort((a, b) => {
        const pA = typePriority(a.type)
        const pB = typePriority(b.type)
        if (pA !== pB) return pA - pB
        return (a.label || '').localeCompare(b.label || '')
      })
    } else if (orderMode === 'nameAsc') {
      nodes.sort((a, b) => (a.label || '').localeCompare(b.label || ''))
    } else if (orderMode === 'nameDesc') {
      nodes.sort((a, b) => (b.label || '').localeCompare(a.label || ''))
    }
    nodes.forEach((n) => sortChildren(n.children || []))
  }

  type TreeNode = {
    id: string
    label: string
    type?: string
    entity?: Entity
    children: TreeNode[]
  }

  const snap = (val: number) => Math.round(val / 20) * 20

  const typeColor = (t?: string) => {
    if (!colorEnabled) return '#94a3b8'
    switch (t) {
      case 'ROOT':
        return '#0ea5e9'
      case 'GOV':
        return '#6366f1'
      case 'TYPE_PERSON':
        return '#10b981'
      case 'TYPE_HOUSE':
        return '#f59e0b'
      case 'TYPE_VEHICLE':
        return '#ef4444'
      case 'TYPE_PROJECT':
        return '#8b5cf6'
      case 'TYPE_FUND':
        return '#0ea5e9'
      case 'TYPE_GROUP':
        return '#22c55e'
      case 'TYPE_OTHER':
      default:
        return '#475569'
    }
  }

  const buildTree = useMemo(() => {
    if (!data) return { nodes: [] as Node[], edges: [] as Edge[] }
    const layerHeight = LAYOUT_PRESETS[layoutMode].layer

    const root: TreeNode = {
      id: 'FAMILY_ROOT',
      label: sanitize(data.familyName),
      type: 'ROOT',
      children: [],
    }

    // Gobernanza
    const gov = [
      { id: 'ADM', label: `Admins (${data.members.filter((m) => m.isFamilyAdmin).length})`, type: 'GOV' },
      { id: 'MEM', label: `Miembros (${data.members.length})`, type: 'GOV' },
    ].map((g) => ({ ...g, children: [] as TreeNode[] }))
    root.children.push(...gov)

    // Entidades (filtradas por foco)
    const ents = sortEntities(data.entities)
      .filter((e) => !focusEntityId || e.id === focusEntityId)
      .map<TreeNode>((e) => ({
        id: e.id,
        label: sanitize(e.name || '—'),
        type: typeClass(e.type),
        entity: e,
        children: [],
      }))
    gov[1].children.push(...ents) // colgamos de MEM para mantener jerarquía clara

    // Categorías solo en vista presupuesto y si no está colapsado el nodo
    if (vista === 'presupuesto') {
      ents.forEach((ent) => {
        const isCollapsed = collapsedIds.has(ent.id)
        if (isCollapsed) return
        const cats = data.allocs.filter((a) => a.entity?.id === ent.id && a.category).slice(0, 12)
        cats.forEach((a) => {
          if (!a.category) return
          ent.children.push({
            id: `CAT_${a.category.id}`,
            label: sanitize(a.category.name || 'Categoría'),
            type: 'TYPE_OTHER',
            children: [],
          })
        })
      })
    }

    // Layout automático de árbol
    type Measured = TreeNode & { size: number; depth: number; children: Measured[] }
    const measure = (node: TreeNode, depth: number): Measured => {
      const measuredKids: Measured[] = node.children.map((c) => measure(c, depth + 1))
      const size = measuredKids.length > 0 ? measuredKids.reduce((acc, k) => acc + k.size, 0) : 1
      return { ...node, children: measuredKids, size, depth }
    }

    const measuredRoot: Measured = measure(root, 0)
    sortChildren([measuredRoot])

    // Calcular amplitud máxima por nivel
    const levelCounts: Record<number, number> = {}
    const collectLevels = (n: Measured) => {
      levelCounts[n.depth] = (levelCounts[n.depth] || 0) + 1
      for (const c of n.children as Measured[]) {
        collectLevels(c)
      }
    }
    collectLevels(measuredRoot)
    const maxBreadth = Math.max(...Object.values(levelCounts))
    const gapX = Math.max(140, Math.min(260, 1100 / Math.max(1, maxBreadth / 1.2)))

    const positionedNodes: Node[] = []
    const positionedEdges: Edge[] = []
    const parentMap = new Map<string, string>()
    const depthMap = new Map<string, number>()

    const nodeBox = (depth: number) => {
      const fontS = clampScale(uiFontScale)
      const boxS = clampScale(nodeBoxScale)
      return {
        padding: (depth === 0 ? 14 : depth === 1 ? 12 : 10) * fontS * boxS,
        minWidth: (depth === 0 ? 200 : depth === 1 ? 170 : 140) * fontS * boxS,
        minHeight: (depth === 0 ? 64 : depth === 1 ? 56 : 52) * fontS * boxS,
      }
    }

    const nodeVisuals = (depth: number, t?: string) => {
      const baseOpacity = Math.max(0.5, 1 - depth * 0.08)
      const borderColor = typeColor(t)
      const border = `${borderColor}66`
      const bgLight = Math.min(97, 91 + depth * 1.2)
      const sat = Math.max(10, 30 - depth * 4.5)
      const fg = '#0b1224'
      const bgBase = `hsl(210, ${sat}%, ${bgLight}%)`
      const bg = uiNodeBg || bgBase
      const fgFinal = uiTextColor || fg
      const showLabel = depth <= 2 || viewportZoom >= 1.2
      return { baseOpacity, border, bg, fg: fgFinal, showLabel }
    }

    const edgeVisuals = (depth: number) => {
      const strokeWidth = Math.max(1.6, 5.6 - depth * 0.7)
      const strokeOpacity = Math.max(0.45, 0.9 - depth * 0.06)
      return { strokeWidth, strokeOpacity }
    }

    const placeVertical = (node: Measured, start: number) => {
      const width = node.size
      const center = start + width / 2
      const x = snap(center * gapX)
      const y = snap(node.depth * layerHeight)
      depthMap.set(node.id, node.depth)
      positionedNodes.push({
        id: node.id,
        position: { x, y },
        data: { label: node.label, entity: node.entity, type: node.type, depth: node.depth },
          style: {
          padding: nodeBox(node.depth).padding,
          borderRadius: 12,
          border: `1px solid ${nodeVisuals(node.depth, node.type).border}`,
          background: nodeVisuals(node.depth, node.type).bg,
          fontWeight: 600,
          minWidth: nodeBox(node.depth).minWidth,
          minHeight: nodeBox(node.depth).minHeight,
          textAlign: 'center',
          opacity: nodeVisuals(node.depth).baseOpacity,
          color: nodeVisuals(node.depth).fg,
        },
      })
      let offset = start
      ;(node.children as Measured[]).forEach((child) => {
        parentMap.set(child.id, node.id)
        placeVertical(child, offset)
        positionedEdges.push({
          id: `${node.id}-${child.id}`,
          source: node.id,
          target: child.id,
          type: edgeKind === 'smooth' ? 'smoothstep' : 'step',
          animated: false,
          style: {
            stroke: typeColor(child.type),
            strokeWidth: edgeVisuals(child.depth).strokeWidth,
            opacity: edgeVisuals(child.depth).strokeOpacity,
          },
        })
        offset += child.size
      })
    }

    const placeHorizontal = (node: Measured, start: number) => {
      const width = node.size
      const center = start + width / 2
      const y = snap(center * gapX)
      const x = snap(node.depth * layerHeight)
      depthMap.set(node.id, node.depth)
      positionedNodes.push({
        id: node.id,
        position: { x, y },
        data: { label: node.label, entity: node.entity, type: node.type, depth: node.depth },
        style: {
          padding: nodeBox(node.depth).padding,
          borderRadius: 12,
          border: `1px solid ${nodeVisuals(node.depth, node.type).border}`,
          background: nodeVisuals(node.depth, node.type).bg,
          fontWeight: 600,
          minWidth: nodeBox(node.depth).minWidth,
          minHeight: nodeBox(node.depth).minHeight,
          textAlign: 'center',
          opacity: nodeVisuals(node.depth).baseOpacity,
          color: nodeVisuals(node.depth).fg,
        },
      })
      let offset = start
      ;(node.children as Measured[]).forEach((child) => {
        parentMap.set(child.id, node.id)
        placeHorizontal(child, offset)
        positionedEdges.push({
          id: `${node.id}-${child.id}`,
          source: node.id,
          target: child.id,
          type: edgeKind === 'smooth' ? 'smoothstep' : 'step',
          animated: false,
          style: {
            stroke: typeColor(child.type),
            strokeWidth: edgeVisuals(child.depth).strokeWidth,
            opacity: edgeVisuals(child.depth).strokeOpacity,
          },
        })
        offset += child.size
      })
    }

    const placeRadial = (node: Measured, cx: number, cy: number, radiusStep: number, startAngle: number, endAngle: number) => {
      const angleSpan = endAngle - startAngle
      const children = node.children as Measured[]
      const aspect = viewportSize.w / viewportSize.h
      const baseRadius = Math.min(viewportSize.w, viewportSize.h) * 0.18
      const depthStretch = node.depth === 1 ? 2.0 : 1
      const radius = baseRadius + node.depth * radiusStep * depthStretch
      const stretchX = aspect >= 1 ? aspect : 1
      const stretchY = aspect >= 1 ? 1 : 1 / aspect
      const pos = { x: cx, y: cy }
      depthMap.set(node.id, node.depth)
      positionedNodes.push({
        id: node.id,
        position: { x: snap(pos.x), y: snap(pos.y) },
        data: { label: node.label, entity: node.entity, type: node.type, depth: node.depth },
        style: {
          padding: nodeBox(node.depth).padding,
          borderRadius: 12,
          border: `1px solid ${nodeVisuals(node.depth, node.type).border}`,
          background: nodeVisuals(node.depth, node.type).bg,
          fontWeight: 600,
          minWidth: Math.max(100, nodeBox(node.depth).minWidth),
          minHeight: nodeBox(node.depth).minHeight,
          textAlign: 'center',
          opacity: nodeVisuals(node.depth).baseOpacity,
          color: nodeVisuals(node.depth).fg,
        },
      })
      if (children.length === 0) return
      const totalSize = children.reduce((acc, c) => acc + c.size, 0)
      let currentAngle = startAngle
      children.forEach((child) => {
        const fraction = child.size / totalSize
        const childAngle = angleSpan * fraction
        const midAngle = currentAngle + childAngle / 2
        const childDepthStretch = child.depth === 1 ? 2.0 : 1
        const r = baseRadius + child.depth * radiusStep * childDepthStretch
        const childX = cx + Math.cos(midAngle) * r * stretchX
        const childY = cy + Math.sin(midAngle) * r * stretchY
        parentMap.set(child.id, node.id)
        positionedEdges.push({
          id: `${node.id}-${child.id}`,
          source: node.id,
          target: child.id,
          type: edgeKind === 'smooth' ? 'smoothstep' : 'step',
          animated: false,
          style: {
            stroke: typeColor(child.type),
            strokeWidth: edgeVisuals(child.depth).strokeWidth,
            opacity: edgeVisuals(child.depth).strokeOpacity,
          },
        })
        placeRadial(child, childX, childY, radiusStep, currentAngle, currentAngle + childAngle)
        currentAngle += childAngle
      })
    }

    const placedEdge = (_: string) => {}

    const placeCompact = (node: Measured, start: number) => {
      const width = node.size
      const center = start + width / 2
      const x = snap(center * (gapX * 0.8))
      const y = snap(node.depth * (layerHeight * 0.8))
      depthMap.set(node.id, node.depth)
      positionedNodes.push({
        id: node.id,
        position: { x, y },
        data: { label: node.label, entity: node.entity, type: node.type, depth: node.depth },
        style: {
          padding: nodeBox(node.depth).padding,
          borderRadius: 12,
          border: `1px solid ${nodeVisuals(node.depth, node.type).border}`,
          background: nodeVisuals(node.depth, node.type).bg,
          fontWeight: 600,
          minWidth: Math.max(100, nodeBox(node.depth).minWidth),
          minHeight: nodeBox(node.depth).minHeight,
          textAlign: 'center',
          opacity: nodeVisuals(node.depth).baseOpacity,
          color: nodeVisuals(node.depth).fg,
        },
      })
      let offset = start
      ;(node.children as Measured[]).forEach((child) => {
        parentMap.set(child.id, node.id)
        placeCompact(child, offset)
        positionedEdges.push({
          id: `${node.id}-${child.id}`,
          source: node.id,
          target: child.id,
          type: edgeKind === 'smooth' ? 'smoothstep' : 'step',
          animated: false,
          style: {
            stroke: typeColor(child.type),
            strokeWidth: edgeVisuals(child.depth).strokeWidth,
            opacity: edgeVisuals(child.depth).strokeOpacity,
          },
        })
        offset += child.size
      })
    }

    // Select layout engine
    if (layoutEngine === 'horizontalTree') {
      placeHorizontal(measuredRoot, 0)
    } else if (layoutEngine === 'compactTidy') {
      placeCompact(measuredRoot, 0)
    } else if (layoutEngine === 'radial' || layoutEngine === 'force') {
      const radialSpan = Math.PI * 2
      const radialBase = Math.min(viewportSize.w, viewportSize.h) * 0.18
      const radialStep = Math.max(layerHeight * 1.1, Math.min(viewportSize.w, viewportSize.h) * 0.18) + 50
      placeRadial(measuredRoot, 0, 0, radialStep, 0 + 0.08, radialSpan + 0.08)
    } else if (layoutEngine === 'layered') {
      placeVertical(measuredRoot, 0)
    } else {
      // verticalTree default
      placeVertical(measuredRoot, 0)
    }

    // Ajustar labels según zoom y resaltar camino seleccionado
    const pathSet = new Set<string>()
    if (selectedNodeId) {
      let cur: string | null = selectedNodeId
      while (cur) {
        pathSet.add(cur)
        cur = parentMap.get(cur) || null
      }
    }

    const finalNodes = positionedNodes.map((n) => {
      const depth = (n.data as any).depth || 0
      const visuals = nodeVisuals(depth, (n.data as any).type)
      const fullLabel = (n.data as any).label || ''
      const inPath = pathSet.size > 0 ? pathSet.has(n.id) : true

      const zoomAllows = viewportZoom >= 1.0 || depth <= 3
      const baseShow = depth <= 1
      const showLabel = baseShow || zoomAllows || inPath

      const truncated =
        fullLabel.length > 10 ? `${fullLabel.slice(0, 10)}…` : fullLabel
      const deepShort =
        fullLabel.length > 6 ? `${fullLabel.slice(0, 6)}…` : fullLabel

      const labelText = showLabel
        ? fullLabel
        : pathSet.size > 0 && !inPath
          ? '·'
          : truncated || ' '

      const opacityFactor = pathSet.size > 0 && !inPath ? 0.55 : 1
      const fontScale = clampScale(uiFontScale)
      const fontSize =
        (depth === 0 ? 22 : depth === 1 ? 18 : depth === 2 ? 16 : 14) * fontScale
      const fontWeight = depth <= 1 ? 700 : 600

      return {
        ...n,
        data: {
          ...n.data,
          label: (
            <span
              title={fullLabel}
              style={{
                fontSize,
                fontWeight,
                display: 'inline-block',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                maxWidth: 560,
                fontFamily: uiFontFamily,
              }}
            >
              {showLabel ? labelText : deepShort || '·'}
            </span>
          ),
        },
        style: {
          ...n.style,
          opacity: (n.style && typeof n.style.opacity === 'number' ? n.style.opacity : 1) * opacityFactor,
          border: inPath ? '1px solid #0ea5e9' : n.style?.border,
          boxShadow: inPath ? '0 0 0 2px rgba(14,165,233,0.18)' : undefined,
        },
      }
    })

    const finalEdges = positionedEdges.map((e) => {
      const targetDepth = depthMap.get(e.target) ?? depthMap.get(e.source) ?? 0
      const visuals = edgeVisuals(targetDepth)
      const inPath = pathSet.size > 0 ? pathSet.has(e.source) && pathSet.has(e.target) : true
      const childType = (nodes.find((n) => n.id === e.target)?.data as any)?.type
      const baseStroke = typeColor(childType)
      const passesFilter = !typeFilter || childType === typeFilter
      return {
        ...e,
        style: {
          ...(e.style || {}),
          stroke: inPath ? baseStroke : `${baseStroke}99`,
          strokeWidth: inPath ? visuals.strokeWidth + 1.4 : visuals.strokeWidth,
          opacity: passesFilter ? (inPath ? Math.min(1, (e.style as any)?.opacity || 1) : 0.7) : 0.25,
        },
      }
    })

    return { nodes: finalNodes, edges: finalEdges }
  }, [data, layoutMode, orderMode, collapsedIds, focusEntityId, vista, edgeKind, layoutEngine, viewportZoom, selectedNodeId, viewportSize, recalcKey])

  useEffect(() => {
    const applied = customMode
      ? buildTree.nodes.map((n) =>
          savedPositions[n.id]
            ? { ...n, position: savedPositions[n.id], draggable: true }
            : { ...n, draggable: true }
        )
      : buildTree.nodes.map((n) => ({ ...n, draggable: false }))
    setNodes(applied)
    setEdges(buildTree.edges)
  }, [buildTree, customMode, savedPositions, setNodes, setEdges])

  // Al cambiar de vista (Jerarquía / Responsables / Presupuesto) reiniciar foco y colapsados
  useEffect(() => {
    setFocusEntityId(null)
    setCollapsedIds(new Set())
    setInitialCentered(false)
    setUserMoved(false)
  }, [vista])

  useEffect(() => {
    const api = flowApiRef.current
    if (!api || nodes.length === 0) return
    if (customMode) return
    if (userMoved) return
    const container = document.querySelector('#diagram-wrap') as HTMLDivElement | null

    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    nodes.forEach((n) => {
      minX = Math.min(minX, n.position.x)
      maxX = Math.max(maxX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxY = Math.max(maxY, n.position.y)
    })
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const spanX = Math.max(200, maxX - minX)
    const spanY = Math.max(200, maxY - minY)
    const containerW = container?.clientWidth || 1200
    const containerH = container?.clientHeight || 700
    // Prefer encajar sin quedarse microscópico; priorizar legibilidad.
    const fitZoomRaw = Math.min((containerW * 0.78) / spanX, (containerH * 0.78) / spanY)
    const fitZoom = Math.min(1.8, Math.max(1.2, fitZoomRaw))
    const desiredZoom = focusEntityId ? Math.max(1.4, fitZoom) : fitZoom

    const targetId = focusEntityId || 'FAMILY_ROOT'
    const target = nodes.find((n) => n.id === targetId)
    const tx = target ? target.position.x : cx
    const ty = target ? target.position.y : cy

    api.setCenter(tx, ty, { duration: 260, zoom: desiredZoom })
    if (!initialCentered) setInitialCentered(true)
  }, [nodes, focusEntityId, initialCentered, customMode])

  // Auto ajustar al cargar o tras recalcular nodos
  useEffect(() => {
    if (customMode) return
    if (initialCentered) return
    if (userMoved) return
    const api = flowApiRef.current
    if (!api || nodes.length === 0) return
    if (skipAutoFitRef.current) {
      skipAutoFitRef.current = false
      return
    }
    const padding = isMobile ? 0.12 : 0.45
    const delay = isMobile ? 400 : 150
    const t = setTimeout(() => {
      api.fitView({ padding, includeHiddenNodes: true, duration: 200 })
      setInitialCentered(true)
    }, delay)
    return () => clearTimeout(t)
  }, [nodes, customMode, initialCentered, isMobile])

  // En móvil: cuando la API está lista y el contenedor tiene tamaño, forzar fitView para que TODO el diagrama quepa (sin scroll en el recuadro rojo)
  useEffect(() => {
    if (!isMobile || !flowApiReady || nodes.length === 0) return
    const api = flowApiRef.current
    if (!api) return
    const run = () => api.fitView({ padding: 0.12, includeHiddenNodes: true, duration: 280 })
    run()
    const t1 = setTimeout(run, 400)
    const t2 = setTimeout(run, 900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [isMobile, flowApiReady, viewportSize.w, viewportSize.h, nodes.length])

  // Si en móvil cambia el tamaño del recuadro (ej. rotación), volver a encajar el diagrama
  useEffect(() => {
    if (!isMobile || nodes.length === 0) return
    const wrap = document.getElementById('diagram-wrap')
    if (!wrap) return
    const ro = new ResizeObserver(() => {
      flowApiRef.current?.fitView({ padding: 0.12, includeHiddenNodes: true, duration: 200 })
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [isMobile, nodes.length])

  const onNodeClick = (_: any, node: Node) => {
    setSelectedNodeId(node.id)
    const isEntity = (node.data as any)?.entity
    if (isEntity) {
      setFocusEntityId(node.id)
    }
  }

  const applyZoomSlider = (val: number) => {
    const clamped = Math.min(3, Math.max(0.2, val))
    setZoomSlider(clamped)
    if (!zoomControlEnabled) return
    const api = flowApiRef.current
    if (api) {
      api.zoomTo(clamped, { duration: 120 })
      setUserMoved(true)
    }
  }

  const toggleCollapse = (nodeId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const downloadDiagramImage = useCallback(() => {
    const el = document.getElementById('diagram-wrap')
    if (!el) return
    toPng(el, { cacheBust: true, pixelRatio: 2, backgroundColor: uiCanvasBg || '#fff' })
      .then((dataUrl) => {
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `diagrama-${data?.familyName?.replace(/\s+/g, '-') || 'familia'}-${new Date().toISOString().slice(0, 10)}.png`
        link.click()
      })
      .catch((err) => console.error('Error al exportar diagrama:', err))
  }, [data?.familyName, uiCanvasBg])

  return (
    <SAPLayout title="" compact>
      <div
        className="system-arch-page"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
          margin: '0 auto',
          background: uiCanvasBg || '#ffffff',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          borderRadius: 8,
          padding: 2,
          paddingLeft: 'max(2px, env(safe-area-inset-left))',
          paddingRight: 'max(2px, env(safe-area-inset-right))',
          paddingBottom: 'max(2px, env(safe-area-inset-bottom))',
          boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          height: isMobile ? '100dvh' : 'calc(100vh - 25px - 4px - 8px)',
          maxHeight: isMobile ? '100dvh' : undefined,
          minHeight: 0,
          overflow: 'hidden',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Señal de build: solo visible con ?signal=1 para comprobar que domus-fam.com sirve este código */}
        {showBuildSignal && (
          <div
            role="status"
            style={{
              background: 'linear-gradient(135deg, #0f3d91 0%, #2f6fed 100%)',
              color: '#fff',
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
              textAlign: 'center',
              boxShadow: '0 4px 14px rgba(15,61,145,0.4)',
              flexShrink: 0,
            }}
          >
            ✓ Estás viendo el build correcto: domus-beta-dbe (diagrama-ok)
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            alignItems: 'stretch',
            background: '#f8fafc',
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 8,
            padding: isMobile ? 4 : 4,
            position: 'sticky',
            top: 0,
            zIndex: 5,
            minHeight: 32,
            overflow: 'visible',
            flexShrink: 0,
          }}
        >
          {/* Mensaje prueba de versión en verde: si lo ves, estás en el build correcto (sin línea roja) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span
              role="status"
              style={{
                background: '#15803d',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              ✓ Versión correcta (prueba)
            </span>
            <div className="tabRow" role="tablist" aria-label="Vista del diagrama" style={{ gap: 6, display: 'flex', flexWrap: 'wrap' }}>
              {(['jerarquia', 'responsables', 'presupuesto'] as Vista[]).map((v) => (
                <button key={v} className={`tabBtn ${vista === v ? 'tabBtnActive' : ''}`} onClick={() => setVista(v)} type="button" role="tab" aria-selected={vista === v} style={{ padding: '6px 10px', fontSize: 13 }}>
                  {v === 'jerarquia' ? 'Jerarquía' : v === 'responsables' ? 'Responsables' : 'Presupuesto'}
                </button>
              ))}
            </div>
            <select value={layoutEngine} onChange={(e) => { setLayoutEngine(e.target.value as LayoutEngine); setInitialCentered(false); }} style={{ padding: '6px 8px', borderRadius: 10, border: '1px solid rgba(15,23,42,0.15)', background: '#fff', fontSize: 13 }} aria-label="Layout">
              <option value="verticalTree">Vertical</option>
              <option value="horizontalTree">Horizontal</option>
              <option value="compactTidy">Compacto</option>
              <option value="radial">Radial</option>
              <option value="layered">Layered</option>
              <option value="force">Force</option>
            </select>
            <button type="button" className="btn btnPrimary btnSm" onClick={() => flowApiRef.current?.fitView({ padding: isMobile ? 0.12 : 0.25, includeHiddenNodes: true, duration: 200 })} style={{ padding: '6px 10px', fontSize: 13 }}>Auto ajustar</button>
            <button type="button" className="btn btnGhost btnSm" onClick={() => { setRecalcKey((k) => k + 1); setInitialCentered(false); setUserMoved(false); setTimeout(() => flowApiRef.current?.fitView({ padding: isMobile ? 0.12 : 0.25, includeHiddenNodes: true, duration: 200 }), 220); }} style={{ padding: '6px 10px', fontSize: 13 }} title="Reaplicar el layout actual">Recalcular layout</button>
            <button type="button" className="btn btnGhost btnSm" onClick={() => { setCustomMode(false); setSavedPositions({}); localStorage.removeItem('domus-arch-custom-positions'); setRecalcKey((k) => k + 1); setInitialCentered(false); setUserMoved(false); setTimeout(() => flowApiRef.current?.fitView({ padding: isMobile ? 0.12 : 0.25, includeHiddenNodes: true, duration: 200 }), 220); }} style={{ padding: '6px 10px', fontSize: 13 }} title="Volver al layout automático">Reset layout</button>
            <button type="button" className="btn btnGhost btnSm" onClick={downloadDiagramImage} style={{ padding: '6px 10px', fontSize: 13 }} title="Descargar el diagrama (canvas) como imagen PNG">Descargar imagen</button>
            <button type="button" className={`btn btnGhost btnSm ${mobileOptionsOpen ? 'pill' : ''}`} onClick={() => setMobileOptionsOpen((o) => !o)} style={{ padding: '6px 10px', fontSize: 13 }}>{mobileOptionsOpen ? 'Menos' : 'Más'}</button>
            <button type="button" className="btn btnGhost btnSm" onClick={() => router.push('/ui')} style={{ padding: '6px 10px', fontSize: 13, borderColor: 'rgba(239,68,68,0.4)', color: '#b91c1c' }}>Cerrar</button>
            {focusEntityId ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pill" style={{ fontSize: 12 }}>Entidad: {sanitize(data?.entities.find((e) => e.id === focusEntityId)?.name || '—')}</span>
                <button type="button" className="btn btnPrimary btnSm" onClick={() => { setFocusEntityId(null); setCollapsedIds(new Set()); flowApiRef.current?.fitView({ padding: 0.25 }); }}>Volver</button>
              </div>
            ) : null}
          </div>

          {/* Con "Más" abierto: Recalcular, Reset, etc. */}
          {mobileOptionsOpen && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', paddingTop: 4, borderTop: '1px solid rgba(15,23,42,0.08)' }}>
              <button type="button" className="btn btnGhost btnSm" style={{ fontSize: 12 }} onClick={() => { setRecalcKey((k) => k + 1); setInitialCentered(false); setUserMoved(false); setTimeout(() => flowApiRef.current?.fitView({ padding: isMobile ? 0.12 : 0.25, includeHiddenNodes: true, duration: 200 }), 220); }}>Recalcular</button>
              <button type="button" className="btn btnGhost btnSm" style={{ fontSize: 12 }} onClick={() => { setCustomMode(false); setSavedPositions({}); localStorage.removeItem('domus-arch-custom-positions'); setRecalcKey((k) => k + 1); setInitialCentered(false); setUserMoved(false); setTimeout(() => flowApiRef.current?.fitView({ padding: isMobile ? 0.12 : 0.25, includeHiddenNodes: true, duration: 200 }), 220); }}>Reset</button>
              <button type="button" className={`btn btnGhost btnSm ${customMode ? 'pill' : ''}`} style={{ fontSize: 12 }} onClick={() => setCustomMode((p) => { if (p) skipAutoFitRef.current = true; return !p; })} title={customMode ? 'Modo personalizado: puedes arrastrar nodos y guardar posiciones' : 'Activar para mover nodos y guardar vista'}>{customMode ? 'Modo personalizado ON' : 'Modo personalizado OFF'}</button>
              <button type="button" className={`btn btnGhost btnSm ${viewLocked ? 'pill' : ''}`} style={{ fontSize: 12 }} onClick={() => setViewLocked((v) => !v)} title={viewLocked ? 'Vista bloqueada: desactiva para arrastrar el canvas y hacer zoom con la rueda' : 'Vista desbloqueada: puedes arrastrar y hacer zoom'}>{viewLocked ? 'Bloqueo vista ON' : 'Bloqueo vista OFF'}</button>
              <button type="button" className={`btn btnGhost btnSm ${zoomControlEnabled ? 'pill' : ''}`} style={{ fontSize: 12 }} onClick={() => setZoomControlEnabled((v) => !v)} title={zoomControlEnabled ? 'Zoom manual ON: el deslizador controla el zoom' : 'Zoom manual OFF'}>{zoomControlEnabled ? 'Zoom manual ON' : 'Zoom manual OFF'}</button>
              <button type="button" className="btn btnGhost btnSm" style={{ fontSize: 12 }} onClick={() => { const first = nodes.find((n) => n.id === focusEntityId) || nodes.find((n) => n.id === 'FAMILY_ROOT'); if (first) flowApiRef.current?.setCenter(first.position.x, first.position.y, { duration: 300, zoom: focusEntityId ? 2.2 : 1.8 }); }}>Centrar</button>
            </div>
          )}

          {/* Colapsable: Modo, Orden, fuentes, filtros, etc. */}
          <details className="system-arch-opciones-avanzadas" style={{ border: '1px solid rgba(15,23,42,0.08)', borderRadius: 10, padding: 8, background: '#fff', marginTop: 4 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Opciones avanzadas</summary>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <span className="pill">Modo</span>
              {(['vertical', 'horizontal', 'compacto', 'expandido'] as LayoutMode[]).map((m) => (
                <button
                  key={m}
                  className={`btn btnGhost btnSm ${layoutMode === m ? 'pill' : ''}`}
                  onClick={() => setLayoutMode(m)}
                  type="button"
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
              <span className="pill">Orden</span>
              <select
                value={orderMode}
                onChange={(e) => setOrderMode(e.target.value as OrderMode)}
                style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(15,23,42,0.15)', background: '#fff' }}
                aria-label="Ordenar hermanos"
              >
                <option value="organigrama">Organigrama</option>
                <option value="original">Original</option>
                <option value="nameAsc">Nombre A-Z</option>
                <option value="nameDesc">Nombre Z-A</option>
              </select>

              <label className="pill" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Tamaño
                <input
                  type="range"
                  min={0.8}
                  max={1.3}
                  step={0.1}
                  value={uiFontScale}
                  onChange={(e) => setUiFontScale(parseFloat(e.target.value))}
                  style={{ width: 120 }}
                />
              </label>
              <label className="pill" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Ancho nodos
                <input
                  type="range"
                  min={0.8}
                  max={1.3}
                  step={0.1}
                  value={nodeBoxScale}
                  onChange={(e) => setNodeBoxScale(parseFloat(e.target.value))}
                  style={{ width: 120 }}
                />
              </label>
              <label className="pill" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Fuente
                <select
                  value={uiFontFamily}
                  onChange={(e) => setUiFontFamily(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(15,23,42,0.15)' }}
                >
                  <option value="Inter, system-ui, sans-serif">Inter</option>
                  <option value="Roboto, system-ui, sans-serif">Roboto</option>
                  <option value="Arial, system-ui, sans-serif">Arial</option>
                  <option value="Segoe UI, system-ui, sans-serif">Segoe UI</option>
                </select>
              </label>
              <label className="pill" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Texto
                <input
                  type="color"
                  value={uiTextColor || '#0b1224'}
                  onChange={(e) => setUiTextColor(e.target.value)}
                  style={{ width: 40, height: 28, padding: 0, border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </label>
              <label className="pill" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Fondo
                <input
                  type="color"
                  value={uiNodeBg || '#e6ebf2'}
                  onChange={(e) => setUiNodeBg(e.target.value)}
                  style={{ width: 40, height: 28, padding: 0, border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </label>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pill">Filtrar tipo</span>
                {[
                  { key: 'TYPE_PERSON', label: 'Persona' },
                  { key: 'TYPE_HOUSE', label: 'Casa' },
                  { key: 'TYPE_VEHICLE', label: 'Vehículo' },
                  { key: 'TYPE_PROJECT', label: 'Proyecto' },
                  { key: 'TYPE_FUND', label: 'Fondo' },
                  { key: 'TYPE_GROUP', label: 'Grupo' },
                  { key: 'TYPE_OTHER', label: 'Otro' },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`btn btnGhost btnSm ${typeFilter === t.key ? 'pill' : ''}`}
                    onClick={() => setTypeFilter((prev) => (prev === t.key ? null : t.key))}
                    style={{ borderColor: `${typeColor(t.key)}55`, color: typeColor(t.key) }}
                  >
                    {t.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btnGhost btnSm"
                  onClick={() => setTypeFilter(null)}
                >
                  Quitar filtro
                </button>
                <button
                  type="button"
                  className={`btn btnGhost btnSm ${colorEnabled ? 'pill' : ''}`}
                  onClick={() => setColorEnabled((v) => !v)}
                >
                  Colores por tipo {colorEnabled ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  className="btn btnGhost btnSm"
                  onClick={() => {
                    collapseAll()
                  }}
                >
                  Contraer todo
                </button>
                <button
                  type="button"
                  className="btn btnGhost btnSm"
                  onClick={() => {
                    expandAll()
                  }}
                >
                  Expandir todo
                </button>
                {typeFilter ? (
                  <>
                    <button
                      type="button"
                      className="btn btnGhost btnSm"
                      onClick={() => collapseByType(typeFilter)}
                    >
                      Contraer tipo
                    </button>
                    <button
                      type="button"
                      className="btn btnGhost btnSm"
                      onClick={() => expandByType(typeFilter)}
                    >
                      Expandir tipo
                    </button>
                  </>
                ) : null}
              </div>

              <label className="pill" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Fondo lienzo
                <select
                  value={uiCanvasBg}
                  onChange={(e) => setUiCanvasBg(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(15,23,42,0.15)' }}
                >
                  <option value="#f8fafc">Claro</option>
                  <option value="#ffffff">Blanco</option>
                  <option value="#f1f5f9">Gris tenue</option>
                  <option value="#0f172a">Oscuro</option>
                  <option value="#111827">Negro suave</option>
                  <option value="#e2e8f0">Azulado</option>
                </select>
              </label>

              <button
                className="btn btnGhost btnSm"
                type="button"
                onClick={() => {
                  setUiFontScale(1)
                  setUiFontFamily('Inter, system-ui, sans-serif')
                  setUiTextColor(null)
                  setUiNodeBg(null)
                  setUiCanvasBg('#f8fafc')
                  setNodeBoxScale(1)
                  setTypeFilter(null)
                  setColorEnabled(true)
                  setInitialCentered(false)
                  setUserMoved(false)
                  if (typeof window !== 'undefined') localStorage.removeItem('domus-arch-ui-prefs')
                }}
              >
                Reset estilo
              </button>
              <button
                className="btn btnGhost btnSm"
                type="button"
                onClick={() => {
                  setCollapsedIds(new Set())
                  setFocusEntityId(null)
                  setUserMoved(false)
                  flowApiRef.current?.fitView({ padding: 0.25 })
                }}
                disabled={loading}
              >
                Reset vista
              </button>
              <button
                type="button"
                onClick={() => router.push('/ui')}
                aria-label="Cerrar"
                className="btn btnGhost btnSm"
                style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#b91c1c' }}
              >
                Cerrar
              </button>
            </div>
          </details>

          {loading ? <span className="pill pillWarn">Cargando…</span> : null}
          {error ? <span className="pill pillError">{error}</span> : null}
        </div>

        {/* Contenedor del canvas: marco azul bien visible = zona de trabajo del diagrama */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            flex: 1,
            minHeight: isMobile ? 260 : '82vh',
            minWidth: 0,
            border: '6px solid #0f766e',
            borderRadius: 12,
            boxSizing: 'border-box',
          }}
        >
          <div
            role="status"
            aria-label="Zona de trabajo del diagrama"
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              zIndex: 20,
              background: '#0f766e',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(15,118,110,0.5)',
            }}
          >
            Zona de trabajo
          </div>
          <div
            id="diagram-wrap"
            className="diagram-canvas"
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              padding: isMobile ? 16 : 22,
              borderRadius: 16,
              border: '4px solid #0d9488',
              boxShadow: 'inset 0 0 0 1px rgba(13,148,136,0.35), 0 18px 42px rgba(15,23,42,0.12)',
              background: uiCanvasBg || '#fff',
              overflow: 'hidden',
              contain: 'layout',
              boxSizing: 'border-box',
            }}
          >
            {/* Retícula con letras (columnas) y números (filas) — detrás del diagrama, sin bloquear clics */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: isMobile ? 16 : 22,
                left: isMobile ? 16 : 22,
                right: isMobile ? 16 : 22,
                bottom: isMobile ? 16 : 22,
                zIndex: 0,
                pointerEvents: 'none',
                display: 'grid',
                gridTemplateColumns: '28px repeat(12, minmax(32px, 1fr))',
                gridTemplateRows: '24px repeat(12, minmax(32px, 1fr))',
                border: '1px solid rgba(15,118,110,0.2)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div style={{ gridColumn: 1, gridRow: 1 }} />
              {Array.from({ length: 12 }, (_, i) => (
                <div
                  key={`col-${i}`}
                  style={{
                    gridColumn: i + 2,
                    gridRow: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'rgba(15,118,110,0.6)',
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
              {Array.from({ length: 12 }, (_, i) => (
                <div
                  key={`row-${i}`}
                  style={{
                    gridColumn: 1,
                    gridRow: i + 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'rgba(15,118,110,0.6)',
                  }}
                >
                  {i + 1}
                </div>
              ))}
              {Array.from({ length: 12 * 12 }, (_, i) => {
                const col = (i % 12) + 2
                const row = Math.floor(i / 12) + 2
                return (
                  <div
                    key={`cell-${i}`}
                    style={{
                      gridColumn: col,
                      gridRow: row,
                      borderRight: '1px solid rgba(15,118,110,0.15)',
                      borderBottom: '1px solid rgba(15,118,110,0.15)',
                    }}
                  />
                )
              })}
            </div>
            <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, width: '100%' }}>
          <ReactFlow
            style={{ width: '100%', height: '100%' }}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={(_, n) => toggleCollapse(n.id)}
            defaultViewport={{ x: 0, y: 0, zoom: 1.6 }}
            minZoom={0.1}
            maxZoom={14}
            nodesDraggable={customMode && !viewLocked}
            panOnDrag={isMobile ? [1, 2] : (customMode ? [1, 2] : [2])}
            panOnScroll={isMobile ? false : (!viewLocked && customMode)}
            zoomOnScroll={isMobile ? false : (!viewLocked && customMode)}
            zoomOnPinch={isMobile ? true : (!viewLocked && customMode)}
            selectionOnDrag={!customMode}
            onMoveEnd={(_, vp) => {
              setLastViewport(vp)
              setUserMoved(true)
            }}
            snapToGrid
            snapGrid={[20, 20]}
            nodesConnectable={false}
            elementsSelectable
            proOptions={{ hideAttribution: true }}
            onMove={(_, vp) => {
              if (vp?.zoom) setViewportZoom(vp.zoom)
            }}
            onNodeDragStop={(_, n) => {
              if (!customMode) return
              setSavedPositions((prev) => {
                const next = { ...prev, [n.id]: { x: n.position.x, y: n.position.y } }
                if (typeof window !== 'undefined') localStorage.setItem('domus-arch-custom-positions', JSON.stringify(next))
                return next
              })
            }}
          >
            <FlowApiInjector onReady={(api) => { flowApiRef.current = api; setFlowApiReady(!!api) }} />
            <Background gap={18} color="#e0e7f1" />
            {/* En móvil no mostramos panel flotante para no tapar el diagrama; Auto ajustar y Centrar están en la barra */}
            <Panel position="top-right" className="system-arch-panel-zoom" style={{ display: 'flex', gap: 8, flexDirection: 'column', background: '#fff', padding: 8, borderRadius: 10, border: '1px solid rgba(15,23,42,0.1)', boxShadow: '0 6px 18px rgba(15,23,42,0.08)' }}>
                <label className="pill" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Zoom
                  <input
                    type="range"
                    min={0.2}
                    max={3}
                    step={0.05}
                    value={zoomSlider}
                    onChange={(e) => applyZoomSlider(parseFloat(e.target.value))}
                    style={{ width: 140 }}
                    disabled={!zoomControlEnabled}
                  />
                </label>
                <button type="button" className="btn btnGhost btnSm" onClick={() => flowApiRef.current?.fitView({ padding: 0.25, includeHiddenNodes: true })}>Auto ajustar</button>
                <button type="button" className="btn btnGhost btnSm" onClick={() => { const first = nodes.find((n) => n.id === focusEntityId) || nodes.find((n) => n.id === 'FAMILY_ROOT'); if (first) flowApiRef.current?.setCenter(first.position.x, first.position.y, { duration: 300, zoom: focusEntityId ? 2.2 : 1.8 }); }}>Centrar selección</button>
              </Panel>
          </ReactFlow>
            </div>
        </div>
        </div>
      </div>
    </SAPLayout>
  )
}

export default function SystemArchitecturePage() {
  return (
    <Suspense fallback={null}>
      <ReactFlowProvider>
        <SystemArchitecturePageInner />
      </ReactFlowProvider>
    </Suspense>
  )
}
