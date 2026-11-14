// Personas referenciadas desde tutorías, horarios, retroalimentaciones y atendidos.
// Contrato (docs/api "Datos desvinculados"): un id de usuario null significa "usuario eliminado";
// nunca se muestra "null"/"undefined"/"N/A" ni se enlaza a su ficha.

export const ETIQUETA_ELIMINADO = 'Usuario eliminado'
export const ETIQUETA_SIN_ASIGNAR = 'Sin asignar (usuario eliminado)'

const limpio = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v).trim()
  return /^(n\/a|null|undefined)$/i.test(s) ? '' : s
}

/** "Nombres Apellidos" sin valores vacíos ni marcadores; '' si no hay nada que mostrar. */
export const unirNombre = (...partes) => partes.map(limpio).filter(Boolean).join(' ')

const leer = (o, ...claves) => {
  for (const k of claves) {
    if (o && o[k] !== undefined) return o[k]
  }
  return undefined
}

/** ¿La tutoría perdió a su asignado? (usuarioId null en TutoriaResponse; docenteId null en el modelo de DataContext). */
export const tutoriaSinAsignar = (t) => {
  if (!t) return false
  if ('sinAsignar' in t) return Boolean(t.sinAsignar)
  const id = leer(t, 'usuarioId', 'UsuarioId', 'docenteId')
  return id === null || id === 0
}

/** Nombre de quien imparte la tutoría, o la etiqueta de "sin asignar". */
export const nombreAsignado = (t) => {
  if (tutoriaSinAsignar(t)) return ETIQUETA_SIN_ASIGNAR
  return (
    unirNombre(leer(t, 'usuarioNombre', 'UsuarioNombre', 'docenteNombre'), leer(t, 'usuarioApellidos', 'UsuarioApellidos', 'docenteApellidos')) ||
    'Sin docente asignado'
  )
}

/** Dueño del horario de la tutoría (quien la agendó). */
export const nombreDuenoHorario = (t) => {
  const id = leer(t, 'horarioUsuarioId', 'HorarioUsuarioId')
  if (id === null) return ETIQUETA_ELIMINADO
  return unirNombre(leer(t, 'horarioUsuarioNombre'), leer(t, 'horarioUsuarioApellidos')) || '—'
}

/** Autor de una retroalimentación o responsable de un horario: nombre o "Usuario eliminado". */
export const nombreAutor = (o, { claveId = 'usuarioId' } = {}) => {
  const id = leer(o, claveId, claveId.charAt(0).toUpperCase() + claveId.slice(1))
  const nombre = unirNombre(leer(o, 'usuarioNombre', 'UsuarioNombre', 'docenteNombre'), leer(o, 'usuarioApellidos', 'UsuarioApellidos', 'docenteApellidos'))
  if (id === null && !nombre) return ETIQUETA_ELIMINADO
  return nombre || ETIQUETA_ELIMINADO
}
