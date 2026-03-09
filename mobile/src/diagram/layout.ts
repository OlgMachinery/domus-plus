export type RawNode = {
  id: string
  label: string
  type?: string
  children?: RawNode[]
}

export type PlacedNode = {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  depth: number
  type?: string
}

export type PlacedEdge = {
  id: string
  from: PlacedNode
  to: PlacedNode
}

const NODE_W = 140
const NODE_H = 64
const GAP_X = 28
const GAP_Y = 120

export function placeTree(root: RawNode): { nodes: PlacedNode[]; edges: PlacedEdge[]; bounds: { width: number; height: number } } {
  const placed: PlacedNode[] = []
  const edges: PlacedEdge[] = []

  function measure(node: RawNode): number {
    if (!node.children || node.children.length === 0) return NODE_W
    const widths = node.children.map(measure)
    return Math.max(NODE_W, widths.reduce((a, b) => a + b + GAP_X, -GAP_X))
  }

  function layout(node: RawNode, depth: number, xLeft: number, totalWidth: number) {
    const xCenter = xLeft + totalWidth / 2
    const pnode: PlacedNode = {
      id: node.id,
      label: node.label,
      x: xCenter,
      y: depth * GAP_Y,
      width: NODE_W,
      height: NODE_H,
      depth,
      type: node.type,
    }
    placed.push(pnode)
    if (!node.children || node.children.length === 0) return
    let cursor = xLeft
    for (const child of node.children) {
      const cw = Math.max(NODE_W, measure(child))
      layout(child, depth + 1, cursor, cw)
      cursor += cw + GAP_X
      const childPlaced = placed[placed.length - 1]
      edges.push({ id: `${node.id}-${child.id}`, from: pnode, to: childPlaced })
    }
  }

  const totalWidth = Math.max(NODE_W, measure(root))
  layout(root, 0, 0, totalWidth)

  const maxX = Math.max(...placed.map((n) => n.x + n.width / 2))
  const minX = Math.min(...placed.map((n) => n.x - n.width / 2))
  const maxY = Math.max(...placed.map((n) => n.y + n.height))
  const width = maxX - minX
  const height = maxY + GAP_Y

  // normalize to start at 0
  placed.forEach((n) => {
    n.x = n.x - minX
  })

  return { nodes: placed, edges, bounds: { width, height } }
}

export const demoTree: RawNode = {
  id: 'root',
  label: 'Familia de ww',
  children: [
    {
      id: 'andre',
      label: 'Andre',
    },
    {
      id: 'adriana',
      label: 'Adriana (23)',
    },
    {
      id: 'clase',
      label: 'Clases arte',
    },
    {
      id: 'casa',
      label: 'Casa',
    },
    {
      id: 'auto',
      label: 'Auto (blanco)',
    },
    {
      id: 'vacaciones',
      label: 'Vacaciones',
    },
    {
      id: 'cole',
      label: 'Cole de Amanda',
    },
    {
      id: 'colegiatura',
      label: 'Colegiatura Santi',
    },
    {
      id: 'estudios',
      label: 'Estudios Edith',
    },
    {
      id: 'emergencia',
      label: 'Fondo emergencia',
    },
    {
      id: 'inversion',
      label: 'Fondo inversión',
    },
    {
      id: 'retiro',
      label: 'Retiro',
    },
    {
      id: 'palico',
      label: 'Palico',
    },
  ],
}
