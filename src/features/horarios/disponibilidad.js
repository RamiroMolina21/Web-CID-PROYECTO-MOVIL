// Disponibilidad semanal de un docente a partir de sus horarios.
//
// Cada fila Horario del backend es UNA sesión (una fecha con su franja). Un "horario recurrente" se crea como
// varias filas sin identificador de serie, y su título lo genera el servidor con la fecha incluida, así que agrupar
// por título no reúne nada. La regla fiable con los datos actuales es agrupar por DOCENTE y, dentro de él,
// por día de la semana + franja (hora inicio–fin) + espacio: exactamente lo que se necesita para responder
// "qué días y a qué horas está disponible".

const pad = (n) => String(n).padStart(2, '0')

/** Días en orden de semana laboral (lunes primero). `js` = Date.getDay(). */
export const DIAS_SEMANA = [
  { key: 'lunes', js: 1, label: 'Lunes', corto: 'Lun' },
  { key: 'martes', js: 2, label: 'Martes', corto: 'Mar' },
  { key: 'miercoles', js: 3, label: 'Miércoles', corto: 'Mié' },
  { key: 'jueves', js: 4, label: 'Jueves', corto: 'Jue' },
  { key: 'viernes', js: 5, label: 'Viernes', corto: 'Vie' },
  { key: 'sabado', js: 6, label: 'Sábado', corto: 'Sáb' },
  { key: 'domingo', js: 0, label: 'Domingo', corto: 'Dom' },
]
const DIA_POR_JS = Object.fromEntries(DIAS_SEMANA.map((d) => [d.js, d]))

/** "YYYY-MM-DD" -> Date local (sin desfase de zona). */
export const fechaLocal = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

/** Date -> "YYYY-MM-DD" en hora local. */
export const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const hoyIso = () => isoLocal(new Date())

/** "HH:mm" -> minutos. */
export const minutos = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
}

/** "09:00" -> "9:00"; franja "9:00 – 11:00". */
export const horaCorta = (hhmm) => (hhmm ? hhmm.replace(/^0(\d)/, '$1') : '')
export const franjaTexto = (inicio, fin) => `${horaCorta(inicio)} – ${horaCorta(fin)}`

const fmtDia = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtCorta = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1)
/** "Martes, 21 de octubre" */
export const fechaLarga = (iso) => {
  const d = fechaLocal(iso)
  return d ? capital(fmtDia.format(d)) : '—'
}
/** "21 oct" */
export const fechaCorta = (iso) => {
  const d = fechaLocal(iso)
  return d ? fmtCorta.format(d).replace('.', '') : '—'
}

export const diaDe = (iso) => {
  const d = fechaLocal(iso)
  return d ? DIA_POR_JS[d.getDay()] : null
}

/**
 * Fechas de [desde, hasta] que caen en los días elegidos, con la franja de cada día.
 * `franjas`: { martes: { inicio: '09:00', fin: '11:00' }, ... } (solo días activos).
 */
export const generarSesiones = (desde, hasta, franjas) => {
  const ini = fechaLocal(desde)
  const fin = fechaLocal(hasta)
  if (!ini || !fin || fin < ini) return []
  const sesiones = []
  for (const d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) {
    const dia = DIA_POR_JS[d.getDay()]
    const f = franjas[dia.key]
    if (f) sesiones.push({ fecha: isoLocal(d), dia: dia.key, inicio: f.inicio, fin: f.fin })
  }
  return sesiones
}

/**
 * Horario normalizado: { id, fecha 'YYYY-MM-DD', inicio 'HH:mm', fin 'HH:mm', espacio, cupos, original }.
 * Resumen semanal: [{ dia, franjas: [{ key, inicio, fin, espacio, sesiones: [horario…] }] }] en orden lun→dom.
 */
export const resumenSemanal = (horarios) => {
  const porDia = new Map()
  for (const h of horarios) {
    const dia = diaDe(h.fecha)
    if (!dia) continue
    if (!porDia.has(dia.key)) porDia.set(dia.key, new Map())
    const franjas = porDia.get(dia.key)
    // Los horarios sin aula forman su propio grupo ('' tras limpiar), distinto de cualquier aula con nombre
    const key = `${dia.key}|${h.inicio}|${h.fin}|${(h.espacio || '').trim().toLowerCase()}`
    if (!franjas.has(key)) franjas.set(key, { key, inicio: h.inicio, fin: h.fin, espacio: h.espacio, sesiones: [] })
    franjas.get(key).sesiones.push(h)
  }
  return DIAS_SEMANA.filter((d) => porDia.has(d.key)).map((dia) => ({
    dia,
    franjas: [...porDia.get(dia.key).values()]
      .map((f) => ({ ...f, sesiones: [...f.sesiones].sort((a, b) => a.fecha.localeCompare(b.fecha)) }))
      .sort((a, b) => minutos(a.inicio) - minutos(b.inicio)),
  }))
}

/** Ordena sesiones por fecha y hora. */
export const ordenarSesiones = (lista) =>
  [...lista].sort((a, b) => a.fecha.localeCompare(b.fecha) || minutos(a.inicio) - minutos(b.inicio))

/** Resumen en una línea: "Mar 9:00 – 11:00 · Mié 16:00 – 18:00". */
export const resumenCorto = (resumen) =>
  resumen
    .map(({ dia, franjas }) => `${dia.corto} ${franjas.map((f) => franjaTexto(f.inicio, f.fin)).join(', ')}`)
    .join(' · ')

/** ¿Se solapan dos franjas "HH:mm"? */
export const seSolapan = (a1, a2, b1, b2) => minutos(a1) < minutos(b2) && minutos(a2) > minutos(b1)
