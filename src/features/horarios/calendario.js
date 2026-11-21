// Cálculos del calendario de Horarios: rangos por vista, eventos normalizados y reparto en carriles.
import { fechaLocal, isoLocal, minutos } from './disponibilidad'

export const TIPOS_EVENTO = {
  disponible: { label: 'Disponible', icon: 'calendar' },
  tutoria: { label: 'Tutoría', icon: 'book' },
  ocupado: { label: 'Ocupado', icon: 'lock' },
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const nombreMes = (m) => MESES[m]

/** "YYYY-MM-DD" a partir de lo que venga ("2026-11-20", "2026-11-20T00:00:00", Date). */
export const aIso = (valor) => {
  if (!valor) return null
  if (valor instanceof Date) return isoLocal(valor)
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(valor))
  if (m) return m[1]
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : isoLocal(d)
}

/** "HH:mm" a partir de "HH:mm", "HH:mm:ss" o "YYYY-MM-DDTHH:mm:ss". */
export const aHora = (valor) => {
  const m = /(\d{1,2}):(\d{2})/.exec(String(valor || '').split('T').pop())
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

export const lunesDe = (fecha) => {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  const dia = d.getDay()
  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1))
  return d
}

const sumarDias = (d, n) => {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Días visibles de la vista (dia | semana | mes); mes = 6 semanas completas desde el lunes. */
export const diasDeVista = (vista, fecha) => {
  if (vista === 'dia') return [new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())]
  if (vista === 'semana') {
    const l = lunesDe(fecha)
    return Array.from({ length: 7 }, (_, i) => sumarDias(l, i))
  }
  const primero = lunesDe(new Date(fecha.getFullYear(), fecha.getMonth(), 1))
  return Array.from({ length: 42 }, (_, i) => sumarDias(primero, i))
}

/** Texto del periodo visible: "jueves, 20 de noviembre de 2026" | "16 – 22 nov 2026" | "noviembre 2026" | "2026". */
export const tituloPeriodo = (vista, fecha) => {
  if (vista === 'año') return String(fecha.getFullYear())
  if (vista === 'mes') return `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`
  if (vista === 'dia') {
    const s = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(fecha)
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  const l = lunesDe(fecha)
  const d = sumarDias(l, 6)
  const ini = l.getMonth() === d.getMonth() ? `${l.getDate()}` : `${l.getDate()} ${MESES_CORTOS[l.getMonth()]}`
  return `${ini} – ${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`
}

/** Desplaza la fecha de referencia una unidad de la vista. */
export const moverFecha = (vista, fecha, dir) => {
  const d = new Date(fecha)
  if (vista === 'dia') d.setDate(d.getDate() + dir)
  else if (vista === 'semana') d.setDate(d.getDate() + 7 * dir)
  else if (vista === 'mes') d.setMonth(d.getMonth() + dir, 1)
  else d.setFullYear(d.getFullYear() + dir)
  return d
}

export const ordenarEventos = (lista) =>
  [...lista].sort((a, b) => a.fecha.localeCompare(b.fecha) || minutos(a.inicio) - minutos(b.inicio) || a.docente.localeCompare(b.docente, 'es'))

/**
 * Reparte los eventos de un día en carriles para que los solapados queden lado a lado.
 * Devuelve [{ evento, carril, carriles }], donde `carriles` es el máximo del grupo de solapes.
 */
export const repartirCarriles = (eventos) => {
  const orden = [...eventos].sort((a, b) => minutos(a.inicio) - minutos(b.inicio) || minutos(b.fin) - minutos(a.fin))
  const salida = []
  let grupo = []
  let finGrupo = -1
  let finesCarril = []
  const cerrar = () => {
    const n = finesCarril.length
    grupo.forEach((x) => salida.push({ ...x, carriles: n }))
    grupo = []
    finesCarril = []
  }
  for (const e of orden) {
    const ini = minutos(e.inicio)
    if (grupo.length && ini >= finGrupo) cerrar()
    let carril = finesCarril.findIndex((f) => f <= ini)
    if (carril === -1) {
      carril = finesCarril.length
      finesCarril.push(0)
    }
    finesCarril[carril] = minutos(e.fin)
    finGrupo = Math.max(grupo.length ? finGrupo : 0, minutos(e.fin))
    grupo.push({ evento: e, carril })
  }
  if (grupo.length) cerrar()
  return salida
}

/** Horas visibles de la rejilla: 7:00–20:00 como mínimo, ampliadas si algún evento sale de ahí. */
export const rangoHoras = (eventos) => {
  let ini = 7
  let fin = 20
  for (const e of eventos) {
    ini = Math.min(ini, Math.floor(minutos(e.inicio) / 60))
    fin = Math.max(fin, Math.ceil(minutos(e.fin) / 60))
  }
  return { ini, fin: Math.min(fin, 24) }
}

/** "Andrés Felipe Castro Ruiz" con nombres/apellidos -> "Andrés Castro". */
export const nombreCorto = (nombres, apellidos, completo) => {
  const n = (nombres || '').trim().split(/\s+/)[0]
  const a = (apellidos || '').trim().split(/\s+/)[0]
  if (n && a) return `${n} ${a}`
  const partes = (completo || '').trim().split(/\s+/)
  if (partes.length >= 4) return `${partes[0]} ${partes[2]}`
  if (partes.length >= 2) return `${partes[0]} ${partes[1]}`
  return completo || ''
}

export { fechaLocal, isoLocal }
