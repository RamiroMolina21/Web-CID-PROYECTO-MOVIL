// Lógica de dominio de las vistas personales (Docente/Tutor). Contrato: docs/api (fase 2, R1–R11).
import { horarioService, retroalimentacionService, tutoriaService, usuarioService } from '../../services/apiService'
import { grupoEstadoTutoria, isHorarioDisponible } from '../../lib/estados'
import { parseLocal, startOfToday, timeKey } from '../../lib/fechas'
import { getUserId, tieneRol, ROLES, GESTION } from '../../lib/roles'

/** Cupos del horario como entero. null = sin límite (contrato: horarioCupos null). */
export const parseCupos = (cupos) => {
  if (typeof cupos === 'number') return Number.isInteger(cupos) && cupos > 0 ? cupos : null
  const n = parseInt(String(cupos ?? '').trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

// ---------- Horarios ----------

export const fetchHorariosPropios = async (usuarioId, signal) => {
  const horarios = await horarioService.getByUsuario(usuarioId, signal)
  return Array.isArray(horarios) ? horarios : []
}

/** Agrupa ocurrencias iguales (título, horas, espacio) como HorarioGrupoItem de MAUI. */
export const agruparHorarios = (horarios) => {
  const grupos = new Map()
  for (const h of horarios) {
    const key = [
      (h.titulo || '').trim().toLowerCase(),
      timeKey(h.horaInicio),
      timeKey(h.horaFin),
      (h.espacio || '').trim().toLowerCase(),
    ].join('|')
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key).push(h)
  }

  const hoy = startOfToday()
  return [...grupos.entries()]
    .map(([key, items], index) => {
      const ocurrencias = [...items].sort((a, b) => parseLocal(a.fechaInicio) - parseLocal(b.fechaInicio))
      const primera = ocurrencias[0]
      const fechas = ocurrencias.map((o) => parseLocal(o.fechaInicio)).filter(Boolean)
      const proxima = fechas.find((f) => f >= hoy) || fechas[0] || null
      return {
        key,
        domId: `grupo-${index}-${primera.idHorario}`,
        titulo: primera.titulo,
        espacio: primera.espacio,
        horaInicio: primera.horaInicio,
        horaFin: primera.horaFin,
        cupos: parseCupos(primera.cupos),
        ocurrencias,
        esRecurrente: ocurrencias.length > 1,
        primeraFecha: fechas[0] || null,
        ultimaFecha: fechas[fechas.length - 1] || null,
        proxima,
      }
    })
    .sort((a, b) => (a.proxima - b.proxima) || (timeKey(a.horaInicio) - timeKey(b.horaInicio)))
}

export const filtrarDisponibles = (horarios) => horarios.filter((h) => isHorarioDisponible(h.estado))

// ---------- Tutorías ----------

/** Relación del usuario con la tutoría (para etiquetas y filtros). */
export const relacionCon = (user, t) => {
  const yo = getUserId(user)
  const asignada = t.usuarioId === yo
  const agendada = t.horarioUsuarioId === yo
  if (asignada && agendada) return 'ambas'
  if (agendada) return 'agendada'
  return 'asignada'
}

const ordenarPorFecha = (lista, desc = false) =>
  [...lista].sort((a, b) => {
    const d = (parseLocal(a.fechaTutoria) || 0) - (parseLocal(b.fechaTutoria) || 0)
    return desc ? -d : d
  })

/**
 * Tutorías del usuario por grupo ('pendiente' | 'finalizada').
 *  - Tutor: GET Tutoria/estado/{grupo}/usuario/{miId} (asignadas).
 *  - Docente: asignadas ∪ GET Tutoria/agendadas/usuario/{miId}?estado={grupo}, deduplicado por idTutoria.
 */
export const fetchMisTutorias = async (user, grupo, signal) => {
  const yo = getUserId(user)
  const peticiones = [tutoriaService.getByEstadoYUsuario(grupo, yo, signal)]
  if (tieneRol(user, [ROLES.DOCENTE])) peticiones.push(tutoriaService.getAgendadas(yo, grupo, signal))
  const resultados = await Promise.all(peticiones)

  const porId = new Map()
  for (const t of resultados.flat().filter(Boolean)) {
    if (!porId.has(t.idTutoria)) porId.set(t.idTutoria, t)
  }
  let lista = [...porId.values()]
    .filter((t) => grupoEstadoTutoria(t.estado) === grupo)
    .map((t) => ({ ...t, relacion: relacionCon(user, t) }))

  // Historial: calificación registrada de cada sesión (GET Retroalimentacion/tutoria/{id}, participantes).
  // Una petición por tutoría; si falla una, esa fila se muestra sin calificación.
  if (grupo === 'finalizada' && lista.length > 0) {
    const notas = await Promise.all(
      lista.map((t) =>
        retroalimentacionService
          .getByTutoria(t.idTutoria, signal)
          .then((rs) => (Array.isArray(rs) && rs.length ? rs.reduce((a, r) => a + Number(r.calificacion), 0) / rs.length : null))
          .catch((err) => {
            if (err?.name === 'AbortError') throw err
            return null
          })
      )
    )
    lista = lista.map((t, i) => ({ ...t, calificacionSesion: notas[i] }))
  }
  return ordenarPorFecha(lista, grupo === 'finalizada')
}

export const fetchTutoriaDetalle = async (id, signal) => {
  const [tutoria, estudiantes] = await Promise.all([
    tutoriaService.getById(id, signal),
    tutoriaService.getEstudiantesByTutoria(id, signal),
  ])
  return { tutoria, estudiantes: Array.isArray(estudiantes) ? estudiantes : tutoria?.estudiantes || [] }
}

// ---------- Permisos (UX; la autoridad es el backend: regla de propiedad R2) ----------

/**
 * Decisiones de producto (2026-11-11):
 *  - Docente: tutorías asignadas a él o agendadas en SUS horarios → ver, finalizar, gestionar estudiantes.
 *  - Tutor: solo asignadas → ver y finalizar; no gestiona estudiantes.
 *  - Administrador/Auxiliar: sin restricción.
 */
export const permisosTutoria = (user, tutoria) => {
  const yo = getUserId(user)
  const pendiente = grupoEstadoTutoria(tutoria?.estado) === 'pendiente'
  const asignado = tutoria?.usuarioId != null && tutoria.usuarioId === yo
  const duenoHorario = tutoria?.horarioUsuarioId != null && tutoria.horarioUsuarioId === yo
  const gestion = tieneRol(user, GESTION)
  const docente = tieneRol(user, [ROLES.DOCENTE])
  const tutor = tieneRol(user, [ROLES.TUTOR])

  const participa = gestion || (docente && (asignado || duenoHorario)) || (tutor && asignado)
  const gestionaEstudiantes = gestion || (docente && (asignado || duenoHorario))
  return {
    participa,
    asignado,
    duenoHorario,
    puedeFinalizar: pendiente && participa,
    puedeAgregarEstudiantes: pendiente && gestionaEstudiantes,
    puedeQuitarEstudiantes: pendiente && gestionaEstudiantes,
  }
}

// ---------- Usuarios por rol ----------

const cacheRol = new Map()
export const fetchUsuariosPorRol = async (rol, signal) => {
  if (cacheRol.has(rol)) return cacheRol.get(rol)
  const lista = await usuarioService.getByRol(rol, signal)
  const data = Array.isArray(lista) ? lista : []
  cacheRol.set(rol, data)
  return data
}
export const invalidarUsuariosPorRol = () => cacheRol.clear()
