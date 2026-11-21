// Aula (campo `espacio` del Horario). Es opcional: la API guarda y devuelve "" cuando no hay aula.
// Regla de presentación:
//  - Sesiones por venir y detalles (calendario, disponibilidad, agendar, agenda, mis tutorías, detalles):
//    se muestra "Aula por asignar" para que se vea que falta, nunca un hueco.
//  - Historial (tutorías finalizadas): si no hubo aula, la línea no se muestra.

export const AULA_POR_ASIGNAR = 'Aula por asignar'

/** Valor limpio del aula: '' si viene vacío, solo espacios, null, undefined o el marcador "N/A". */
export const aulaLimpia = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v).trim()
  return /^(n\/a|null|undefined)$/i.test(s) ? '' : s
}

export const tieneAula = (v) => aulaLimpia(v) !== ''

/** Texto a mostrar: el aula o "Aula por asignar". */
export const aulaTexto = (v) => aulaLimpia(v) || AULA_POR_ASIGNAR
