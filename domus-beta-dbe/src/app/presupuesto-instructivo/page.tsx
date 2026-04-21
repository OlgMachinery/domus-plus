'use client'

import Link from 'next/link'
import './instructivo.css'

/**
 * Página pública del instructivo Presupuesto: Partida, Categoría, Monto → Cuenta.
 * Diseño tipo ERP (SAP / Linear / Notion). Solo instructiva, no modifica datos.
 */
export default function PresupuestoInstructivoPage() {
  const formatMoney = (value: number) => {
    try {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        maximumFractionDigits: 0,
      }).format(value)
    } catch {
      return `$ ${Math.round(value).toLocaleString('es-MX')}`
    }
  }

  const montoEjemplo = formatMoney(5000)

  return (
    <div className="instructivoRoot">
      <div className="instructivoContainer">
        <h1 className="instructivoTitle">Presupuesto: qué es cada cosa</h1>
        <p className="instructivoLead">
          En DOMUS, una cuenta de presupuesto se crea cuando defines Destino + Categoría + Presupuesto (tope mensual). Comparte este enlace por WhatsApp para explicarlo.
        </p>

        {/* DESTINO → CATEGORÍA → PRESUPUESTO */}
        <div
          className="instructivoFlowGrid"
          role="img"
          aria-label="Destino, Categoría y tope mensual generan una Cuenta"
        >
          <div className="instructivoCard">
            <div className="instructivoCardLabel">Destino</div>
            <p className="instructivoCardValue">Diego (Persona)</p>
            <p className="instructivoCardDesc">A qué o a quién asignas: persona, casa, auto…</p>
          </div>
          <div className="instructivoArrow" aria-hidden="true">→</div>
          <div className="instructivoCard">
            <div className="instructivoCardLabel">Categoría</div>
            <p className="instructivoCardValue">Supermercado</p>
            <p className="instructivoCardDesc">Tipo de gasto: super, luz, gasolina…</p>
          </div>
          <div className="instructivoArrow" aria-hidden="true">→</div>
          <div className="instructivoCard">
            <div className="instructivoCardLabel">Presupuesto</div>
            <p className="instructivoCardValue">{montoEjemplo}/mes</p>
            <p className="instructivoCardDesc">Tope mensual (en la app: pestaña Presupuesto).</p>
          </div>
        </div>

        <p className="instructivoGenera">↓ genera</p>

        {/* CUENTA (resultado) */}
        <div className="instructivoResultCard">
          <div className="instructivoCardLabel">Cuenta</div>
          <p className="instructivoCardValue">Diego · Supermercado</p>
          <p className="instructivoResultSub">Presupuesto mensual: {montoEjemplo}</p>
          <p className="instructivoCardDesc">Aquí se registran los gastos y el saldo disponible.</p>
        </div>

        {/* Cómo funciona */}
        <section className="instructivoSection" aria-labelledby="como-funciona">
          <h2 id="como-funciona" className="instructivoSectionTitle">
            Cómo funciona
          </h2>
          <p className="instructivoSectionText">
            En DOMUS, una cuenta de presupuesto se crea automáticamente cuando defines:
          </p>
          <p className="instructivoSectionText" style={{ marginBottom: 4 }}>
            <strong>Destino + Categoría + Presupuesto mensual</strong>
          </p>
          <div className="instructivoExample">
            Diego + Supermercado + {montoEjemplo}
          </div>
          <p className="instructivoSectionText" style={{ marginTop: 16 }}>
            <strong>Resultado:</strong> Cuenta creada: Diego · Supermercado
          </p>
        </section>

        <div className="instructivoFooter">
          <p style={{ marginBottom: 8 }}>
            <strong>Compartir por WhatsApp:</strong> envía este enlace. En la app: /ui → Presupuesto → Bloque 1 (Configuración).
          </p>
          <p>
            <Link href="/ui" className="instructivoLink">
              Ir a DOMUS
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
