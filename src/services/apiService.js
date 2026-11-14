// Servicios por dominio. Solo endpoints que EXISTEN en el contrato (docs/api/endpoints.md).
import { request, downloadFile } from '../lib/apiClient'

const enc = encodeURIComponent

// ==================== AUTH ====================
export const authService = {
  /** POST /Auth/login → { message, token, tokenType, expiresAt, usuario } */
  login: (correo, contrasena) =>
    request('/Auth/login', { method: 'POST', body: { correo, contrasena }, auth: false }),

  /** GET /Auth/me → UsuarioResponse (requiere token). Se pasa el token explícito al restaurar sesión. */
  me: (token, signal) =>
    request('/Auth/me', {
      signal,
      auth: !token,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  /** PUT /Auth/contrasena → 204. 400 con `message`/`errors`, 401, 429 (5 intentos / 15 min por usuario). */
  cambiarContrasena: (contrasenaActual, contrasenaNueva) =>
    request('/Auth/contrasena', { method: 'PUT', body: { contrasenaActual, contrasenaNueva } }),
}

// ==================== USUARIOS ====================
export const usuarioService = {
  getAll: (signal) => request('/Usuario', { signal }),
  /**
   * GET /Usuario paginado (aditivo): { page, pageSize (1–100), q, rol, activo } → { items, total }.
   * total = cabecera X-Total-Count (expuesta por CORS). Sin parámetros el backend devuelve todo: usar getAll.
   */
  buscar: async ({ page = 1, pageSize = 20, q, rol, activo } = {}, signal) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (q && q.trim()) params.set('q', q.trim())
    if (rol) params.set('rol', rol)
    if (activo === true || activo === false) params.set('activo', String(activo))
    const response = await request(`/Usuario?${params}`, { signal, raw: true })
    const items = await response.json()
    const total = Number(response.headers.get('X-Total-Count'))
    return { items: Array.isArray(items) ? items : [], total: Number.isFinite(total) ? total : items.length }
  },
  /** PATCH /Usuario/{id}/estado { activo } → UsuarioResponse. 403 Auxiliar sobre no Estudiante; 409 último admin / propia cuenta. */
  setEstado: (id, activo) => request(`/Usuario/${id}/estado`, { method: 'PATCH', body: { activo } }),
  getById: (id) => request(`/Usuario/${id}`),
  /** Política Personal: los 4 roles con acceso. */
  getByRol: (tipoRol, signal) => request(`/Usuario/by-rol/${enc(tipoRol)}`, { signal }),
  create: (data) => request('/Usuario', { method: 'POST', body: data }),
  update: (id, data) => request(`/Usuario/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/Usuario/${id}`, { method: 'DELETE' }),
}

// ==================== HORARIOS ====================
export const horarioService = {
  getAll: (signal) => request('/Horario', { signal }),
  getById: (id) => request(`/Horario/${id}`),
  getDisponibles: (signal) => request('/Horario/disponibles', { signal }),
  /** Docente/Tutor: solo su propio id (403 si no). */
  getByUsuario: (usuarioId, signal) => request(`/Horario/usuario/${usuarioId}`, { signal }),
  create: (data) => request('/Horario', { method: 'POST', body: data }),
  update: (id, data) => request(`/Horario/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/Horario/${id}`, { method: 'DELETE' }),
}

// ==================== TUTORIAS ====================
export const tutoriaService = {
  getAll: (signal) => request('/Tutoria', { signal }),
  getById: (id, signal) => request(`/Tutoria/${id}`, { signal }),
  create: (data) => request('/Tutoria', { method: 'POST', body: data }),
  update: (id, data) => request(`/Tutoria/${id}`, { method: 'PUT', body: data }),
  delete: (id) => {
    const tutoriaId = parseInt(id, 10)
    if (Number.isNaN(tutoriaId)) throw new Error(`ID de tutoría inválido: ${id}`)
    return request(`/Tutoria/${tutoriaId}`, { method: 'DELETE' })
  },
  /** body: { estudianteIds: number[] } — todo o nada; 400 si todos ya estaban asignados. */
  agregarEstudiantes: (id, estudiantesDto) =>
    request(`/Tutoria/${id}/estudiantes`, { method: 'POST', body: estudiantesDto }),
  getEstudiantesByTutoria: (id, signal) => request(`/Tutoria/${id}/estudiantes`, { signal }),
  eliminarEstudiante: (tutoriaId, estudianteId) =>
    request(`/Tutoria/${tutoriaId}/estudiantes/${estudianteId}`, { method: 'DELETE' }),
  getCalendarioPorDocente: (nombre, apellidos, correo) =>
    request(`/Tutoria/calendario/docente?${new URLSearchParams({ nombre, apellidos, correo })}`),
  getCalendarioPorEstudiante: (nombre, apellidos, correo) =>
    request(`/Tutoria/calendario/estudiante?${new URLSearchParams({ nombre, apellidos, correo })}`),
  getCalendarioPorIdiomaNivel: (idioma, nivel) =>
    request(`/Tutoria/calendario/idioma-nivel?${new URLSearchParams({ idioma, nivel })}`),
  /** Tutorías ASIGNADAS al usuario. `estado` acepta grupos (pendiente|finalizada|cancelada). Docente/Tutor: solo su id. */
  getByEstadoYUsuario: (estado, usuarioId, signal) =>
    request(`/Tutoria/estado/${enc(estado)}/usuario/${usuarioId}`, { signal }),
  /** Tutorías AGENDADAS en horarios del usuario (dueño del horario). Docente/Tutor: solo su id. */
  getAgendadas: (usuarioId, estado, signal) =>
    request(`/Tutoria/agendadas/usuario/${usuarioId}${estado ? `?estado=${enc(estado)}` : ''}`, { signal }),
  /**
   * PUT /Tutoria/{id}/finalizar. Cuerpo opcional { calificacion, comentario }: crea la retroalimentación
   * (autor = token) y finaliza en una transacción; el backend envía las encuestas.
   */
  finalizar: (id, body) =>
    request(`/Tutoria/${id}/finalizar`, { method: 'PUT', ...(body ? { body } : {}) }),
}

// ==================== NOTIFICACIONES ====================
export const notificacionService = {
  getAll: () => request('/Notificacion'),
  getById: (id) => request(`/Notificacion/${id}`),
  getByUsuario: (usuarioId) => request(`/Notificacion/usuario/${usuarioId}`),
  delete: (id) => request(`/Notificacion/${id}`, { method: 'DELETE' }),
  exportarReporteExcel: (tutoriaId) => downloadFile(`/Notificacion/reporte-excel/${tutoriaId}`),
}

// ==================== RETROALIMENTACION ====================
export const retroalimentacionService = {
  getAll: () => request('/Retroalimentacion'),
  getById: (id) => request(`/Retroalimentacion/${id}`),
  /** Participantes (Docente/Tutor) y gestión. */
  getByTutoria: (tutoriaId, signal) => request(`/Retroalimentacion/tutoria/${tutoriaId}`, { signal }),
  getByUsuario: (usuarioId) => request(`/Retroalimentacion/usuario/${usuarioId}`),
  /** body: { comentario: string|null, calificacion: 1–5 decimal, tutoriaId, usuarioId } */
  create: (data) => request('/Retroalimentacion', { method: 'POST', body: data }),
  update: (id, data) => request(`/Retroalimentacion/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/Retroalimentacion/${id}`, { method: 'DELETE' }),
}

// ==================== ENCUESTAS ====================
export const encuestaService = {
  // Públicos: sin Authorization
  verificarToken: (token) => request(`/Encuesta/verificar/${enc(token)}`, { auth: false }),
  responder: (data) => request('/Encuesta/responder', { method: 'POST', body: data, auth: false }),
  getByTutoria: (tutoriaId) => request(`/Encuesta/tutoria/${tutoriaId}`),
  getEstadisticas: () => request('/Encuesta/estadisticas'),
  /** Tutorías con encuestas sin responder: [{ tutoriaId, tema, fechaHora, enviadas, sinResponder }]. */
  getPendientes: (signal) => request('/Encuesta/pendientes', { signal }),
}

// ==================== MÉTRICAS ====================
export const metricasService = {
  getGenerales: () => request('/Metricas/generales'),
  getTutorias: () => request('/Metricas/tutorias'),
}

// ==================== ATENCIÓN (asuntos atendidos del dashboard) ====================
export const atencionService = {
  /** GET /Atencion/atendidos[?tipo=] → [{ tipo, clave, usuarioId, usuarioNombre, fecha (UTC "Z") }] */
  getAtendidos: (signal) => request('/Atencion/atendidos', { signal }),
  /** POST { tipo, claves (1–200) } → estado final de esas claves. Idempotente (conserva el primero). */
  marcar: (tipo, claves) => request('/Atencion/atendidos', { method: 'POST', body: { tipo, claves } }),
  /** DELETE → 204 (también si no existía). */
  deshacer: (tipo, clave) => request(`/Atencion/atendidos/${enc(tipo)}/${clave}`, { method: 'DELETE' }),
}
