'use client'

import { useEffect, useState } from 'react'
import SAPLayout from '@/components/SAPLayout'

export const dynamic = 'force-dynamic'

type PriceIncrease = {
  productKey: string
  status: string
  changePercent: number
  recentAvg: number
  previousAvg: number
  recentCount: number
  previousCount: number
}

type BestPrice = {
  productKey: string
  description: string
  unit: string
  bestMerchant: string | null
  bestPrice: number
  lastDate: string
}

type BuyThisWeek = {
  productKey: string
  description: string
  unit: string
  suggestedMerchant: string | null
  suggestedPrice: number
  lastPurchaseDate: string | null
  daysSincePurchase: number | null
}

type UtilityAnomaly = {
  receiptId: string
  unit: string
  quantity: number
  periodStart: string | null
  periodEnd: string | null
  merchantName: string | null
  percentAboveAvg: number
  historicalAvg: number
}

type SuggestionsData = {
  ok: boolean
  bestPricePerProduct?: BestPrice[]
  buyThisWeek?: BuyThisWeek[]
  priceIncreases?: PriceIncrease[]
  utilityAnomalies?: UtilityAnomaly[]
}

type SummaryData = { ok: boolean; summary?: string; month?: string }

export default function PreciosConsumosPage() {
  const [suggestions, setSuggestions] = useState<SuggestionsData | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        const [sugRes, sumRes] = await Promise.all([
          fetch('/api/reports/price-suggestions'),
          fetch('/api/reports/consumption-summary'),
        ])
        if (cancelled) return
        if (!sugRes.ok) {
          if (sugRes.status === 401) setError('Inicia sesión para ver precios y consumos.')
          else setError('No se pudieron cargar las sugerencias.')
          return
        }
        const sug: SuggestionsData = await sugRes.json()
        const sum: SummaryData = sumRes.ok ? await sumRes.json() : { ok: false }
        setSuggestions(sug)
        setSummary(sum)
      } catch (e) {
        if (!cancelled) setError('Error de conexión.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <SAPLayout title="Precios y consumos" subtitle="Análisis de precios del super y consumo de luz/agua">
        <p style={{ color: '#64748b' }}>Cargando…</p>
      </SAPLayout>
    )
  }

  if (error) {
    return (
      <SAPLayout title="Precios y consumos">
        <p style={{ color: '#b91c1c' }}>{error}</p>
      </SAPLayout>
    )
  }

  const increases = suggestions?.priceIncreases ?? []
  const bestPrices = suggestions?.bestPricePerProduct ?? []
  const buyThisWeek = suggestions?.buyThisWeek ?? []
  const anomalies = suggestions?.utilityAnomalies ?? []
  const summaryText = summary?.summary ?? ''

  return (
    <SAPLayout
      title="Precios y consumos"
      subtitle="Subidas de precio, mejor precio por producto, qué comprar esta semana y consumo de luz/agua"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {summaryText && (
          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>Resumen del mes</h2>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                fontSize: 13,
                padding: 12,
                background: '#f1f5f9',
                borderRadius: 8,
                margin: 0,
                color: '#334155',
              }}
            >
              {summaryText}
            </pre>
          </section>
        )}

        {increases.length > 0 && (
          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>📈 Productos con subida de precio</h2>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {increases.map((i) => (
                <li key={i.productKey} style={{ marginBottom: 4, fontSize: 13 }}>
                  <strong>{i.productKey}</strong>: +{i.changePercent.toFixed(1)}% (${i.previousAvg} → ${i.recentAvg})
                </li>
              ))}
            </ul>
          </section>
        )}

        {bestPrices.length > 0 && (
          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>💰 Mejor precio en tu historial</h2>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {bestPrices.slice(0, 8).map((p) => (
                <li key={p.productKey} style={{ marginBottom: 4, fontSize: 13 }}>
                  <strong>{p.description}</strong> ({p.unit}): ${p.bestPrice.toFixed(2)} en {p.bestMerchant ?? '—'} (última compra: {p.lastDate || '—'})
                </li>
              ))}
            </ul>
          </section>
        )}

        {buyThisWeek.length > 0 && (
          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>🛒 Sugerencia: qué comprar esta semana</h2>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {buyThisWeek.map((p) => (
                <li key={p.productKey} style={{ marginBottom: 4, fontSize: 13 }}>
                  <strong>{p.description}</strong> ({p.unit}): conviene en {p.suggestedMerchant ?? '—'} ~${p.suggestedPrice.toFixed(2)}
                  {p.daysSincePurchase != null && ` · hace ${p.daysSincePurchase} días que no lo compras`}
                </li>
              ))}
            </ul>
          </section>
        )}

        {anomalies.length > 0 && (
          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>⚠️ Consumo por encima de tu promedio</h2>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {anomalies.map((a, idx) => (
                <li key={`${a.receiptId}-${idx}`} style={{ marginBottom: 4, fontSize: 13 }}>
                  {a.unit}: +{a.percentAboveAvg.toFixed(0)}% sobre promedio ({a.merchantName ?? 'recibo'})
                </li>
              ))}
            </ul>
          </section>
        )}

        {!summaryText && increases.length === 0 && bestPrices.length === 0 && buyThisWeek.length === 0 && anomalies.length === 0 && (
          <p style={{ color: '#64748b', fontSize: 14 }}>
            Aún no hay suficientes datos de recibos o utilidades. Sube recibos con líneas de productos (nombre, cantidad, precio) y facturas de luz/agua para ver análisis y sugerencias.
          </p>
        )}
      </div>
    </SAPLayout>
  )
}
