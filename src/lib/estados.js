// Estados (docs/api/cambios-y-migracion.md → "Estados oficiales"). La web solo ESCRIBE "Pendiente".
// Lee agrupando sinónimos, igual que EstadosTutoria/EstadosHorario del backend.
export const ESTADO_AL_CREAR = 'Pendiente'

const norm = (e) => (e || '').trim().toLowerCase()

const PENDIENTES = ['pendiente', 'programada', 'activo']
const FINALIZADAS = ['finalizada', 'completada']

/** @returns {'pendiente'|'finalizada'|'cancelada'|'otro'} */
export const grupoEstadoTutoria = (estado) => {
  const e = norm(estado)
  if (PENDIENTES.includes(e)) return 'pendiente'
  if (FINALIZADAS.includes(e)) return 'finalizada'
  if (e === 'cancelada') return 'cancelada'
  return 'otro'
}

export const ETIQUETA_GRUPO = {
  pendiente: 'Pendiente',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
  otro: 'Sin estado',
}

/**
 * Valores exactos a consultar en GET Tutoria/estado/{estado}/usuario/{id} (compara exacto).
 * Hoy solo se piden los que escriben los clientes; el seed puede tener sinónimos (R7 para Dante).
 */
export const ESTADOS_CONSULTA = {
  pendiente: ['Pendiente'],
  finalizada: ['Finalizada'],
}

export const isHorarioDisponible = (estado) => ['disponible', 'libre'].includes(norm(estado))
