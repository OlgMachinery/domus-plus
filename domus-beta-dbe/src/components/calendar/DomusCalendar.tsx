'use client'

/**
 * Calendario DOMUS con FullCalendar.
 * Consume la API existente /api/calendar/events (datos mapeados en el padre).
 * No modifica backend ni API.
 * Presentación: títulos cortos, tooltips, iconos profesionales, colores suaves.
 * En móvil (≤768px) la vista inicial es "Lista" para que sea legible; en desktop "Mes".
 */
import { useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'

export type DomusCalendarEvent = {
  id: string
  type: string
  title: string
  date: string
  amount?: number
  status?: string
  source_table: string
  source_id: string | null
}

function formatMoney(value: number, currency = 'MXN'): string {
  const v = Number.isFinite(value) ? value : 0
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(v)
  } catch {
    return `$ ${Math.round(v).toLocaleString('es-MX')}`
  }
}

const MONTH_ABBREV = /\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)(\s|$)/i
const MAX_SHORT_TITLE = 22

/**
 * Genera un título corto para la vista de calendario.
 * El título completo se muestra en tooltip y detalle.
 */
export function shortenTitleForCalendar(title: string): string {
  if (!title || !title.trim()) return ''
  let s = title.trim().replace(MONTH_ABBREV, ' ').replace(/\s+/g, ' ').trim()
  if (s.length <= MAX_SHORT_TITLE) return s
  return s.slice(0, MAX_SHORT_TITLE - 1) + '…'
}

function typeToLabel(type: string): string {
  const map: Record<string, string> = {
    payment: 'Pago',
    payment_expected: 'Esperado',
    cutoff: 'Corte presupuesto',
    utility_reminder: 'Factura',
    money_request: 'Solicitud',
    money_delivered: 'Entrega',
    budget_suggestion: 'Sugerencia presupuesto',
    birthday: 'Cumpleaños',
    appointment: 'Cita',
    reminder: 'Recordatorio',
    vacation: 'Vacaciones',
    custom: 'Evento',
  }
  return map[type] ?? type
}

function statusToLabel(status?: string): string {
  if (!status) return '—'
  const map: Record<string, string> = {
    completed: 'Completado',
    pending: 'Pendiente',
    scheduled: 'Programado',
    delivered: 'Entregado',
    PENDING: 'Pendiente',
    APPROVED: 'Aprobado',
    DELIVERED: 'Entregado',
  }
  return map[status] ?? status
}

/** Convierte eventos de la API DOMUS al formato FullCalendar (título corto en vista, completo en extendedProps) */
export function mapDomusEventsToFullCalendar(events: DomusCalendarEvent[]): Array<{
  id: string
  title: string
  date: string
  allDay: boolean
  extendedProps: {
    fullTitle: string
    amount?: number
    type: string
    source_id: string | null
    source_table: string
    status?: string
    tooltip: string
  }
}> {
  return events.map((e) => {
    const shortTitle = shortenTitleForCalendar(e.title)
    const displayTitle = e.amount != null ? `${shortTitle} ${formatMoney(e.amount)}` : shortTitle
    const tooltipLines = [
      e.title,
      e.amount != null ? `Monto: ${formatMoney(e.amount)}` : '',
      `Categoría: ${typeToLabel(e.type)}`,
      `Estado: ${statusToLabel(e.status)}`,
    ].filter(Boolean)
    return {
      id: e.id,
      title: displayTitle,
      date: e.date,
      allDay: true,
      extendedProps: {
        fullTitle: e.title,
        amount: e.amount,
        type: e.type,
        source_id: e.source_id,
        source_table: e.source_table,
        status: e.status,
        tooltip: tooltipLines.join('\n'),
      },
    }
  })
}

function eventClassNames(arg: { event: { extendedProps?: { type?: string } } }): string[] {
  const type = arg.event.extendedProps?.type
  if (type === 'payment') return ['fc-event-payment']
  if (type === 'payment_expected') return ['fc-event-expected']
  if (type === 'cutoff') return ['fc-event-cutoff']
  if (type === 'utility_reminder') return ['fc-event-utility']
  if (type === 'money_request' || type === 'money_delivered') return ['fc-event-money']
  if (type === 'budget_suggestion') return ['fc-event-budget']
  if (type === 'birthday') return ['fc-event-birthday']
  if (type === 'appointment') return ['fc-event-appointment']
  if (type === 'reminder') return ['fc-event-reminder']
  if (type === 'vacation') return ['fc-event-vacation']
  if (type === 'custom') return ['fc-event-custom']
  return ['fc-event-default']
}

export type DomusCalendarProps = {
  events: DomusCalendarEvent[]
  initialDate?: string
  onEventClick?: (sourceTable: string, sourceId: string | null) => void
  onDatesSet?: (start: Date, end: Date) => void
}

const MOBILE_BREAKPOINT = 768

export default function DomusCalendar({
  events,
  initialDate,
  onEventClick,
  onDatesSet,
}: DomusCalendarProps) {
  const fcEvents = mapDomusEventsToFullCalendar(events)
  const [initialView, setInitialView] = useState<string>('dayGridMonth')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT
    setInitialView(isMobile ? 'listMonth' : 'dayGridMonth')
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="domus-fullcalendar-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <span className="muted">Cargando calendario…</span>
      </div>
    )
  }

  return (
    <div className="domus-fullcalendar-wrap">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView={initialView as any}
        initialDate={initialDate ?? undefined}
        dayMaxEvents={4}
        views={{
          dayGridMonth: { dayMaxEvents: 4 },
          timeGridWeek: { dayMaxEvents: 4 },
        }}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,listMonth',
        }}
        buttonText={{
          prev: 'Anterior',
          next: 'Siguiente',
          today: 'Hoy',
          month: 'Mes',
          week: 'Semana',
          list: 'Lista',
        }}
        locale="es"
        events={fcEvents}
        eventClassNames={eventClassNames}
        eventDidMount={(info) => {
          const tooltip = (info.event.extendedProps as { tooltip?: string })?.tooltip
          if (tooltip) info.el.setAttribute('title', tooltip)
          info.el.classList.add('fc-event-domus')
        }}
        eventContent={(arg) => {
          const type = (arg.event.extendedProps as { type?: string })?.type || 'default'
          const iconClass = `fc-event-icon fc-event-icon-${type}`
          const safeTitle = String(arg.event.title)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
          return {
            html: `<span class="${iconClass}" aria-hidden="true"></span><span class="fc-event-title-text">${safeTitle}</span>`,
          }
        }}
        eventClick={(info) => {
          const ext = info.event.extendedProps as { source_table?: string; source_id?: string | null }
          if (ext?.source_table && ext?.source_id && onEventClick) {
            onEventClick(ext.source_table, ext.source_id)
          }
        }}
        datesSet={(info: { start: Date; end: Date }) => {
          if (onDatesSet) onDatesSet(info.start, info.end)
        }}
        height="parent"
        expandRows={true}
      />
    </div>
  )
}
