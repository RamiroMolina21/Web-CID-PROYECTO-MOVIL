// El backend envía DateTime sin zona (hora local del servidor): "2026-11-11T08:00:00".
// Se interpretan como hora local; nunca usar toISOString() para mostrar.
const pad = (n) => String(n).padStart(2, '0')

/** Parsea "YYYY-MM-DD[THH:mm[:ss]]" como hora local. Devuelve Date o null. */
export const parseLocal = (value) => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (!m) {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
  // 0001-01-01 = "dato ausente" en el backend
  return date.getFullYear() < 1900 ? null : date
}

export const formatFecha = (value) => {
  const d = parseLocal(value)
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '—'
}

export const formatHora = (value) => {
  const d = parseLocal(value)
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '—'
}

const diaLargo = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
export const formatDiaLargo = (value) => {
  const d = parseLocal(value)
  if (!d) return '—'
  const s = diaLargo.format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const formatRangoHoras = (inicio, fin) => `${formatHora(inicio)} – ${formatHora(fin)}`

/** "YYYY-MM-DDTHH:mm:ss" sin zona, a partir de la fecha de `fechaValue` y la hora de `horaValue`. */
export const combinarFechaHora = (fechaValue, horaValue) => {
  const f = parseLocal(fechaValue)
  const h = parseLocal(horaValue)
  if (!f || !h) return null
  return `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}T${pad(h.getHours())}:${pad(h.getMinutes())}:00`
}

export const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export const timeKey = (value) => {
  const d = parseLocal(value)
  return d ? d.getHours() * 60 + d.getMinutes() : -1
}
