import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

export const dynamic = 'force-dynamic'

type ExportFormat = 'csv' | 'html' | 'pdf' | 'docx'

function parseDateParam(value: string | null): Date | null {
  if (!value) return null
  // Acepta YYYY-MM-DD (o ISO completo)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function safeFilePart(value: string) {
  return value
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

function csvCell(value: unknown) {
  const s = value === null || value === undefined ? '' : String(value)
  const needsQuotes = /[",\n\r]/.test(s)
  const escaped = s.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

function fmtDate(d: Date | null) {
  if (!d) return 'Todo'
  try {
    return d.toISOString().slice(0, 10)
  } catch {
    return '—'
  }
}

function money(n: number) {
  const v = Number.isFinite(n) ? n : 0
  return Math.round(v).toString()
}

export async function GET(req: NextRequest) {
  try {
    const { familyId } = await requireMembership(req)
    const url = new URL(req.url)

    const formatRaw = (url.searchParams.get('format') || 'csv').toLowerCase()
    const format = (['csv', 'html', 'pdf', 'docx'] as ExportFormat[]).includes(formatRaw as any)
      ? (formatRaw as ExportFormat)
      : null
    if (!format) return jsonError('Formato inválido (csv|html|pdf|docx)', 400)

    const from = parseDateParam(url.searchParams.get('from'))
    const to = parseDateParam(url.searchParams.get('to'))
    if ((url.searchParams.get('from') && !from) || (url.searchParams.get('to') && !to)) {
      return jsonError('Rango inválido (from/to)', 400)
    }

    const entityId = url.searchParams.get('entityId')
    const categoryId = url.searchParams.get('categoryId')
    const userId = url.searchParams.get('userId')
    const receipt = (url.searchParams.get('receipt') || 'all').toLowerCase() // all|with|without

    const family = await prisma.family.findUnique({
      where: { id: familyId },
      select: { id: true, name: true, currency: true },
    })
    if (!family) return jsonError('Familia no encontrada', 404)

    const includedEntities = await prisma.budgetEntity.findMany({
      where: {
        familyId,
        isActive: true,
        participatesInReports: true,
        ...(entityId ? { id: entityId } : {}),
      },
      select: { id: true, name: true, type: true },
      orderBy: { createdAt: 'asc' },
    })
    const includedEntityIds = includedEntities.map((e) => e.id)

    const categories = await prisma.budgetCategory.findMany({
      where: { familyId, isActive: true, ...(categoryId ? { id: categoryId } : {}) },
      select: { id: true, name: true, type: true },
      orderBy: { createdAt: 'asc' },
    })
    const categoryIds = categories.map((c) => c.id)

    const allocations = await prisma.entityBudgetAllocation.findMany({
      where: {
        familyId,
        isActive: true,
        ...(includedEntityIds.length ? { entityId: { in: includedEntityIds } } : { entityId: '__none__' }),
        ...(categoryIds.length ? { categoryId: { in: categoryIds } } : { categoryId: '__none__' }),
      },
      select: {
        id: true,
        monthlyLimit: true,
        entity: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const dateWhere: any = {}
    if (from) dateWhere.gte = from
    if (to) dateWhere.lt = to

    const txWhere: any = { familyId }
    if (from || to) txWhere.date = dateWhere
    if (userId) txWhere.userId = userId
    txWhere.allocation = {
      ...(includedEntityIds.length ? { entityId: { in: includedEntityIds } } : { entityId: '__none__' }),
      ...(categoryIds.length ? { categoryId: { in: categoryIds } } : { categoryId: '__none__' }),
      entity: { isActive: true, participatesInReports: true },
    }
    if (receipt === 'with') txWhere.receipts = { some: {} }
    if (receipt === 'without') txWhere.receipts = { none: {} }

    const txs = await prisma.transaction.findMany({
      where: txWhere,
      select: {
        id: true,
        amount: true,
        date: true,
        description: true,
        user: { select: { id: true, name: true, email: true } },
        allocation: {
          select: {
            id: true,
            entity: { select: { id: true, name: true, type: true } },
            category: { select: { id: true, name: true, type: true } },
          },
        },
        receipts: { select: { id: true } },
      },
      orderBy: { date: 'desc' },
      take: 500,
    })

    const budgetTotal = allocations.reduce((s, a) => s + (Number(a.monthlyLimit) || 0), 0)
    const spentTotal = txs.reduce((s, t) => s + (Number(t.amount) || 0), 0)
    const available = budgetTotal - spentTotal

    const spentByAlloc: Record<string, number> = {}
    for (const t of txs) {
      const allocId = t.allocation?.id
      if (!allocId) continue
      spentByAlloc[allocId] = (spentByAlloc[allocId] || 0) + (Number(t.amount) || 0)
    }
    let overspend = 0
    for (const a of allocations) {
      const limit = Number(a.monthlyLimit) || 0
      const spent = spentByAlloc[a.id] || 0
      if (limit > 0 && spent > limit) overspend += 1
    }

    const budgetByCat: Record<string, number> = {}
    for (const a of allocations) {
      const id = a.category.id
      budgetByCat[id] = (budgetByCat[id] || 0) + (Number(a.monthlyLimit) || 0)
    }
    const spentByCat: Record<string, number> = {}
    for (const t of txs) {
      const id = t.allocation?.category?.id
      if (!id) continue
      spentByCat[id] = (spentByCat[id] || 0) + (Number(t.amount) || 0)
    }
    const byCategory = categories
      .map((c) => {
        const budget = budgetByCat[c.id] || 0
        const spent = spentByCat[c.id] || 0
        const avail = budget - spent
        const progress = budget > 0 ? spent / budget : 0
        return { id: c.id, name: c.name, budget, spent, available: avail, progress }
      })
      .sort((a, b) => b.spent - a.spent)

    const budgetByEntity: Record<string, number> = {}
    for (const a of allocations) {
      const id = a.entity.id
      budgetByEntity[id] = (budgetByEntity[id] || 0) + (Number(a.monthlyLimit) || 0)
    }
    const spentByEntity: Record<string, number> = {}
    for (const t of txs) {
      const id = t.allocation?.entity?.id
      if (!id) continue
      spentByEntity[id] = (spentByEntity[id] || 0) + (Number(t.amount) || 0)
    }
    const byObject = includedEntities
      .map((e) => {
        const budget = budgetByEntity[e.id] || 0
        const spent = spentByEntity[e.id] || 0
        const avail = budget - spent
        const progress = budget > 0 ? spent / budget : 0
        return { id: e.id, name: e.name, type: e.type, budget, spent, available: avail, progress }
      })
      .sort((a, b) => b.spent - a.spent)

    const byMemberMap: Record<string, { id: string; name: string; email: string; spent: number; count: number }> = {}
    for (const t of txs) {
      const u = t.user
      const id = u?.id || 'unknown'
      const name = u?.name || u?.email || '—'
      const email = u?.email || ''
      if (!byMemberMap[id]) byMemberMap[id] = { id, name, email, spent: 0, count: 0 }
      byMemberMap[id]!.spent += Number(t.amount) || 0
      byMemberMap[id]!.count += 1
    }
    const byMember = Object.values(byMemberMap).sort((a, b) => b.spent - a.spent)

    const periodLabel = `${fmtDate(from)}_a_${fmtDate(to)}`
    const filenameBase = safeFilePart(`DOMUS_Reportes_${family.name}_${periodLabel}`)

    if (format === 'csv') {
      const lines: string[] = []
      // BOM para Excel
      lines.push('\ufeffDOMUS+ Reportes')
      lines.push(`Familia,${csvCell(family.name)}`)
      lines.push(`Rango,${csvCell(fmtDate(from))},${csvCell(fmtDate(to))}`)
      lines.push(`Moneda,${csvCell(family.currency)}`)
      lines.push('')
      lines.push(`Resumen,Presupuesto,Gastado,Disponible,Alertas,Transacciones`)
      lines.push(
        `,${money(budgetTotal)},${money(spentTotal)},${money(available)},${csvCell(overspend)},${csvCell(txs.length)}`
      )
      lines.push('')
      lines.push('Por categoría')
      lines.push('Categoría,Presupuesto,Gastado,Disponible,Progreso')
      for (const r of byCategory) {
        lines.push(
          `${csvCell(r.name)},${money(r.budget)},${money(r.spent)},${money(r.available)},${csvCell(
            (r.progress * 100).toFixed(1) + '%'
          )}`
        )
      }
      lines.push('')
      lines.push('Por objeto')
      lines.push('Tipo,Objeto,Presupuesto,Gastado,Disponible,Progreso')
      for (const r of byObject) {
        lines.push(
          `${csvCell(r.type)},${csvCell(r.name)},${money(r.budget)},${money(r.spent)},${money(r.available)},${csvCell(
            (r.progress * 100).toFixed(1) + '%'
          )}`
        )
      }
      lines.push('')
      lines.push('Por integrante')
      lines.push('Integrante,Email,Transacciones,Gastado')
      for (const r of byMember) {
        lines.push(`${csvCell(r.name)},${csvCell(r.email)},${csvCell(r.count)},${money(r.spent)}`)
      }

      const body = lines.join('\n')
      return new NextResponse(body, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${filenameBase}.csv"`,
          'cache-control': 'no-store',
        },
      })
    }

    if (format === 'html') {
      const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${family.name} — Reportes</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px; color: #0f172a; }
    h1 { margin: 0 0 6px; }
    .muted { color: #64748b; margin-bottom: 18px; }
    .kpi { display:flex; gap:12px; flex-wrap:wrap; margin: 12px 0 18px; }
    .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; min-width: 200px; }
    .title { font-size: 12px; color:#64748b; text-transform: uppercase; letter-spacing: .06em; font-weight: 800; }
    .value { font-size: 18px; font-weight: 900; margin-top: 6px; }
    table { width:100%; border-collapse: collapse; margin: 10px 0 22px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; font-size: 13px; text-align: left; }
    th { font-size: 12px; color:#334155; text-transform: uppercase; letter-spacing: .06em; }
  </style>
</head>
<body>
  <h1>Reportes</h1>
  <div class="muted">Familia: <b>${family.name}</b> • Rango: <b>${fmtDate(from)}</b> → <b>${fmtDate(to)}</b> • Moneda: <b>${family.currency}</b></div>

  <div class="kpi">
    <div class="card"><div class="title">Presupuesto</div><div class="value">${money(budgetTotal)}</div></div>
    <div class="card"><div class="title">Gastado</div><div class="value">${money(spentTotal)}</div></div>
    <div class="card"><div class="title">Disponible</div><div class="value">${money(available)}</div></div>
    <div class="card"><div class="title">Alertas</div><div class="value">${overspend}</div></div>
  </div>

  <h2>Por categoría</h2>
  <table>
    <thead><tr><th>Categoría</th><th>Presup.</th><th>Gastado</th><th>Disp.</th><th>Progreso</th></tr></thead>
    <tbody>
      ${byCategory
        .map(
          (r) =>
            `<tr><td>${r.name}</td><td>${money(r.budget)}</td><td>${money(r.spent)}</td><td>${money(
              r.available
            )}</td><td>${(r.progress * 100).toFixed(1)}%</td></tr>`
        )
        .join('')}
    </tbody>
  </table>

  <h2>Por objeto</h2>
  <table>
    <thead><tr><th>Tipo</th><th>Objeto</th><th>Presup.</th><th>Gastado</th><th>Disp.</th><th>Progreso</th></tr></thead>
    <tbody>
      ${byObject
        .map(
          (r) =>
            `<tr><td>${r.type}</td><td>${r.name}</td><td>${money(r.budget)}</td><td>${money(r.spent)}</td><td>${money(
              r.available
            )}</td><td>${(r.progress * 100).toFixed(1)}%</td></tr>`
        )
        .join('')}
    </tbody>
  </table>

  <h2>Por integrante</h2>
  <table>
    <thead><tr><th>Integrante</th><th>Email</th><th>Tx</th><th>Gastado</th></tr></thead>
    <tbody>
      ${byMember
        .map((r) => `<tr><td>${r.name}</td><td>${r.email}</td><td>${r.count}</td><td>${money(r.spent)}</td></tr>`)
        .join('')}
    </tbody>
  </table>
</body>
</html>`

      return new NextResponse(html, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-disposition': `attachment; filename="${filenameBase}.html"`,
          'cache-control': 'no-store',
        },
      })
    }

    if (format === 'pdf') {
      const pdf = await PDFDocument.create()
      const font = await pdf.embedFont(StandardFonts.Helvetica)
      const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
      const page = pdf.addPage([595.28, 841.89]) // A4
      const { width, height } = page.getSize()

      const left = 42
      let y = height - 54
      const lineH = 14

      const draw = (text: string, opts?: { bold?: boolean; size?: number; color?: any }) => {
        const size = opts?.size ?? 11
        const color = opts?.color ?? rgb(0.07, 0.09, 0.14)
        page.drawText(text, { x: left, y, size, font: opts?.bold ? fontBold : font, color })
        y -= lineH
      }

      draw('DOMUS+ — Reportes', { bold: true, size: 16 })
      y -= 4
      draw(`Familia: ${family.name}`, { bold: true })
      draw(`Rango: ${fmtDate(from)} → ${fmtDate(to)}   Moneda: ${family.currency}`, { color: rgb(0.39, 0.45, 0.55) })
      y -= 6

      draw(`Presupuesto: ${money(budgetTotal)}   Gastado: ${money(spentTotal)}   Disponible: ${money(available)}`, { bold: true })
      draw(`Alertas (sobregasto): ${overspend}   Transacciones: ${txs.length}`, { color: rgb(0.39, 0.45, 0.55) })
      y -= 8

      const topCats = byCategory.slice(0, 12)
      draw('Top categorías', { bold: true })
      for (const r of topCats) {
        if (y < 80) break
        draw(`- ${r.name}: ${money(r.spent)} / ${money(r.budget)} (${(r.progress * 100).toFixed(0)}%)`)
      }
      y -= 4

      const topObj = byObject.slice(0, 12)
      draw('Top objetos', { bold: true })
      for (const r of topObj) {
        if (y < 80) break
        draw(`- ${r.type} ${r.name}: ${money(r.spent)} / ${money(r.budget)} (${(r.progress * 100).toFixed(0)}%)`)
      }
      y -= 4

      const topMembers = byMember.slice(0, 12)
      draw('Por integrante', { bold: true })
      for (const r of topMembers) {
        if (y < 80) break
        draw(`- ${r.name}: ${money(r.spent)} (${r.count} tx)`)
      }

      // Footer
      page.drawText('Generado por DOMUS+ (beta)', { x: left, y: 30, size: 9, font, color: rgb(0.39, 0.45, 0.55) })

      const bytes = await pdf.save()
      const ab = (bytes.buffer as ArrayBuffer).slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      return new Response(ab, {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': `attachment; filename="${filenameBase}.pdf"`,
          'cache-control': 'no-store',
        },
      })
    }

    // docx
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({ text: 'DOMUS+ — Reportes', heading: HeadingLevel.TITLE }),
            new Paragraph({
              children: [
                new TextRun({ text: `Familia: ${family.name}   `, bold: true }),
                new TextRun({ text: `Rango: ${fmtDate(from)} → ${fmtDate(to)}   ` }),
                new TextRun({ text: `Moneda: ${family.currency}` }),
              ],
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              children: [
                new TextRun({ text: `Presupuesto: ${money(budgetTotal)}   `, bold: true }),
                new TextRun({ text: `Gastado: ${money(spentTotal)}   `, bold: true }),
                new TextRun({ text: `Disponible: ${money(available)}   `, bold: true }),
                new TextRun({ text: `Alertas: ${overspend}` }),
              ],
            }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'Por categoría', heading: HeadingLevel.HEADING_2 }),
            makeDocxTable(
              ['Categoría', 'Presup.', 'Gastado', 'Disp.', 'Progreso'],
              byCategory.map((r) => [
                r.name,
                money(r.budget),
                money(r.spent),
                money(r.available),
                `${(r.progress * 100).toFixed(1)}%`,
              ])
            ),
            new Paragraph({ text: 'Por objeto', heading: HeadingLevel.HEADING_2 }),
            makeDocxTable(
              ['Tipo', 'Objeto', 'Presup.', 'Gastado', 'Disp.', 'Progreso'],
              byObject.map((r) => [
                String(r.type),
                r.name,
                money(r.budget),
                money(r.spent),
                money(r.available),
                `${(r.progress * 100).toFixed(1)}%`,
              ])
            ),
            new Paragraph({ text: 'Por integrante', heading: HeadingLevel.HEADING_2 }),
            makeDocxTable(
              ['Integrante', 'Email', 'Tx', 'Gastado'],
              byMember.map((r) => [r.name, r.email, String(r.count), money(r.spent)])
            ),
          ],
        },
      ],
    })

    const buf = await Packer.toBuffer(doc)
    const ab = (buf.buffer as ArrayBuffer).slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    return new Response(ab, {
      status: 200,
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'content-disposition': `attachment; filename="${filenameBase}.docx"`,
        'cache-control': 'no-store',
      },
    })
  } catch (e: any) {
    const msg = e?.message || 'No se pudo exportar'
    const status =
      msg === 'No autenticado' ? 401 : msg === 'No hay familia activa' ? 400 : msg === 'No tienes acceso a esta familia' ? 403 : 500
    return jsonError(msg, status)
  }
}

function makeDocxTable(header: string[], rows: string[][]) {
  const toCell = (text: string, headerCell = false) =>
    new TableCell({
      width: { size: 100 / header.length, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: headerCell })],
        }),
      ],
    })

  const headerRow = new TableRow({
    children: header.map((h) => toCell(h, true)),
  })
  const bodyRows = rows.map(
    (r) =>
      new TableRow({
        children: r.map((c) => toCell(c)),
      })
  )

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  })
}

