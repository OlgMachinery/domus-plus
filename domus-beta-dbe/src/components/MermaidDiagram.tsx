'use client'

import mermaid from 'mermaid'
import { useEffect, useRef, useState } from 'react'

type MermaidDiagramProps = {
  diagram: string
}

export default function MermaidDiagram({ diagram }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [id] = useState(() => `mermaid-${Math.random().toString(36).slice(2, 10)}`)

  useEffect(() => {
    if (!containerRef.current) return

    const normalized = diagram.trim()

    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis',
      },
    })

    const render = async () => {
      if (!containerRef.current) return
      containerRef.current.innerHTML = ''
      try {
        mermaid.parse(normalized)
        const { svg } = await mermaid.render(id, normalized)
        if (containerRef.current) {
          containerRef.current.innerHTML = svg
          const svgEl = containerRef.current.querySelector('svg')
          if (svgEl) {
            svgEl.style.width = '100%'
            svgEl.style.height = 'auto'
            svgEl.style.maxWidth = '100%'
            svgEl.style.maxHeight = 'none'
            svgEl.style.display = 'block'
          }
        }
      } catch (err) {
        console.error('Error rendering mermaid diagram', err)
        if (containerRef.current) {
          containerRef.current.innerHTML = `<pre style="color:#b91c1c; background:#fef2f2; padding:12px; border-radius:8px; border:1px solid #fecdd3; white-space:pre-wrap;">${String(err)}</pre>`
        }
      }
    }

    render()
  }, [diagram, id])

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <div ref={containerRef} aria-label="Mermaid diagram" />
    </div>
  )
}
