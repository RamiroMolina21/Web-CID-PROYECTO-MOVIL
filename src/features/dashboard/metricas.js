// Cálculos del Dashboard de gestión. Funciones puras sobre datos del contrato:
//   - tutorías y horarios de DataContext (GET /Tutoria, GET /Horario, ya mapeados),
//   - usuarios de DataContext (GET /Usuario),
//   - GET /Retroalimentacion (RetroalimentacionResponse[]),
//   - GET /Encuesta/estadisticas.
// Nada se inventa: si un dato no existe, el indicador lo dice o no se muestra.
import { grupoEstadoTutoria, isHorarioDisponible } from '../../lib/estados'

// ---------- Fechas (hora local; el backend envía DateTime sin zona) ----------

const aFecha = (fecha, hora = '00:00') => {
  if (!fecha) return null
  const [y, m, d] = String(fecha).split('-').map(Number)
  const [h, mi] = String(hora || '00:00').split(':').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, h || 0, mi || 0)
}

export const inicioDia = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
export const sumarDias = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n)

export const inicioTutoria = (t) => aFecha(t.fecha, t.horaInicio)

/** Fin de la sesión: horaFin del horario si es válida; si no, inicio + 1 h. */
export const finTutoria = (t) => {
  const ini = inicioTutoria(t)
  if (!ini) return null
  const fin = t.horaFin ? aFecha(t.fecha, t.horaFin) : null
  return fin && fin > ini ? fin : new Date(ini.getTime() + 3_600_000)
}

export const inicioHorario = (h) => aFecha(h.fecha, h.horaInicio)

const ocupados = (t) => (Array.isArray(t.estudiantesIds) ? t.estudiantesIds.length : 0)

// ---------- Clasificación base ----------

/** Clasifica una vez todas las tutorías respecto a `ahora`. */
export const clasificarTutorias = (tutorias, ahora) =>
  tutorias
    .map((t) => {
      const inicio = inicioTutoria(t)
      const fin = finTutoria(t)
      if (!inicio) return null
      const grupo = grupoEstadoTutoria(t.estado)
      return {
        ...t,
        inicio,
        fin,
        grupo,
        inscritos: ocupados(t),
        // pendiente cuya sesión ya terminó: nadie la cerró
        vencida: grupo === 'pendiente' && fin < ahora,
        futura: grupo === 'pendiente' && fin >= ahora,
      }
    })
    .filter(Boolean)

// ---------- Zona "Requiere atención" ----------

const porFechaDesc = (a, b) => b.inicio - a.inicio
const porFechaAsc = (a, b) => a.inicio - b.inicio

/**
 * Asuntos de "Requiere atención". Cada uno lleva su `tipo` del contrato (/Atencion/atendidos) y las `claves`
 * actuales (idTutoria o idHorario). Los textos dependen del número de claves aún sin atender.
 * severity: 'alta' | 'media' | 'info'
 */
export const calcularAtencion = ({ tutorias, horarios, retroalimentaciones, encuestasPendientes, encuestas, ahora }) => {
  const hoy = inicioDia(ahora)
  const en7 = sumarDias(hoy, 8) // hasta el final del 7.º día
  const en14 = sumarDias(hoy, 15)
  const asuntos = []

  if (tutorias) {
    // Docente/Tutor eliminado: la tutoría pendiente se conservó sin asignar y hay que reasignarla.
    // El backend no tiene (aún) un tipo de "atendido" para este caso: se muestra sin botón "Atendido".
    asuntos.push({
      tipo: 'tutorias-sin-asignar',
      sinAtendido: true,
      severity: 'alta',
      detalle: 'tutorias',
      lista: tutorias.filter((t) => t.grupo === 'pendiente' && t.sinAsignar).sort(porFechaAsc),
      titulo: (n) => (n === 1 ? 'Tutoría pendiente sin asignar' : 'Tutorías pendientes sin asignar'),
      text: 'Su docente o tutor fue eliminado. Reasígnalas para que la sesión se pueda realizar.',
      okText: 'Todas las tutorías pendientes tienen docente o tutor',
      action: { to: '/agendar-tutoria', label: 'Ver en Agendar tutoría' },
    })
    asuntos.push({
      tipo: 'tutorias-vencidas',
      severity: 'alta',
      detalle: 'tutorias',
      lista: tutorias.filter((t) => t.vencida).sort(porFechaDesc),
      titulo: (n) => (n === 1 ? 'Tutoría pendiente con fecha pasada' : 'Tutorías pendientes con fecha pasada'),
      text: 'La sesión ya ocurrió y siguen sin finalizar: no tienen calificación ni se enviaron encuestas.',
      okText: 'Todas las sesiones pasadas están finalizadas',
      itemAction: (t) => ({ to: `/tutorias/${t.id}/finalizar`, label: 'Finalizar' }),
    })
    asuntos.push({
      tipo: 'proximas-sin-estudiantes',
      severity: 'media',
      detalle: 'tutorias',
      lista: tutorias.filter((t) => t.futura && t.inicio < en14 && t.inscritos === 0).sort(porFechaAsc),
      titulo: (n) => (n === 1 ? 'Tutoría próxima sin estudiantes' : 'Tutorías próximas sin estudiantes'),
      text: 'Programadas en los próximos 14 días y nadie inscrito todavía.',
      okText: 'Las tutorías de los próximos 14 días tienen estudiantes',
      action: { to: '/agendar-tutoria', label: 'Asignar estudiantes' },
    })
  }

  if (horarios) {
    const disponibles = horarios.filter((h) => isHorarioDisponible(h.estado)).map((h) => ({ ...h, inicio: inicioHorario(h) }))
    asuntos.push({
      tipo: 'horarios-libres-7d',
      severity: 'info',
      detalle: 'horarios',
      lista: disponibles.filter((h) => h.inicio && h.inicio >= ahora && h.inicio < en7).sort(porFechaAsc),
      titulo: (n) => (n === 1 ? 'Horario libre esta semana' : 'Horarios libres esta semana'),
      text: 'Disponibles en los próximos 7 días y sin ninguna tutoría agendada.',
      okText: 'No quedan horarios libres en los próximos 7 días',
      action: { to: '/agendar-tutoria', label: 'Agendar' },
    })
    asuntos.push({
      tipo: 'horarios-vencidos-disponibles',
      severity: 'info',
      detalle: 'horarios',
      lista: disponibles.filter((h) => h.inicio && h.inicio < hoy).sort(porFechaDesc),
      titulo: (n) => (n === 1 ? 'Horario disponible ya vencido' : 'Horarios disponibles ya vencidos'),
      text: 'Su fecha pasó sin que nadie los reservara. Puedes revisarlos o eliminarlos.',
      okText: 'No hay horarios vencidos sin usar',
      action: { to: '/horarios', label: 'Revisar horarios' },
    })
  }

  if (tutorias && retroalimentaciones) {
    const calificadas = new Set(retroalimentaciones.map((r) => r.tutoriaId))
    asuntos.push({
      tipo: 'finalizadas-sin-calificacion',
      severity: 'info',
      detalle: 'tutorias',
      lista: tutorias.filter((t) => t.grupo === 'finalizada' && !calificadas.has(t.id)).sort(porFechaDesc),
      titulo: (n) => (n === 1 ? 'Tutoría finalizada sin calificación' : 'Tutorías finalizadas sin calificación'),
      text: 'Se cerraron sin registrar la calificación de la sesión.',
      okText: 'Todas las tutorías finalizadas tienen calificación',
      action: { to: '/tutorias-finalizadas', label: 'Ver finalizadas' },
    })
  }

  if (encuestasPendientes) {
    // GET /Encuesta/pendientes: una fila por tutoría con encuestas sin responder (clave = tutoriaId)
    const tasa = encuestas ? ` Tasa de respuesta global: ${formatPct(encuestas.tasaRespuesta || 0)}.` : ''
    asuntos.push({
      tipo: 'encuestas-sin-responder',
      severity: 'info',
      detalle: 'encuestas',
      lista: encuestasPendientes.map((e) => ({ ...e, id: e.tutoriaId })),
      // El número visible son encuestas, no tutorías
      contar: (lista) => lista.reduce((s, e) => s + (e.sinResponder || 0), 0),
      titulo: (n) => (n === 1 ? 'Encuesta de satisfacción sin responder' : 'Encuestas de satisfacción sin responder'),
      text: `Estudiantes que aún no responden la encuesta de su tutoría.${tasa}`,
      okText: 'Todas las encuestas enviadas están respondidas',
    })
  }

  return asuntos.map((a) => ({ ...a, id: a.tipo }))
}

/**
 * Aplica los atendidos del servidor (regla del contrato: un asunto se muestra si ALGUNA clave actual no está atendida).
 * - activos: asuntos con claves pendientes (su lista y su número solo cuentan lo pendiente).
 * - atendidos: asuntos con todas sus claves atendidas (con quién y cuándo, la marca más reciente).
 * - enOrden: comprobaciones sin ningún caso.
 */
export const aplicarAtendidos = (asuntos, atendidos = []) => {
  const porTipo = new Map()
  for (const a of atendidos || []) {
    const t = String(a.tipo).toLowerCase()
    if (!porTipo.has(t)) porTipo.set(t, new Map())
    porTipo.get(t).set(Number(a.clave), a)
  }
  const peso = { alta: 0, media: 1, info: 2 }
  const activos = []
  const resueltos = []
  const enOrden = []
  for (const a of asuntos) {
    if (a.lista.length === 0) {
      enOrden.push(a)
      continue
    }
    // Asuntos sin tipo en el backend: no se consultan atendidos (siempre pendientes mientras haya casos)
    const marcas = a.sinAtendido ? new Map() : porTipo.get(a.tipo) || new Map()
    const pendientes = a.lista.filter((x) => !marcas.has(Number(x.id)))
    const contar = a.contar || ((l) => l.length)
    if (pendientes.length) {
      const n = contar(pendientes)
      activos.push({ ...a, items: pendientes, claves: pendientes.map((x) => Number(x.id)), count: n, title: a.titulo(n) })
    } else {
      const usadas = a.lista.map((x) => marcas.get(Number(x.id)))
      const ultima = usadas.reduce((m, x) => (!m || Date.parse(x.fecha) > Date.parse(m.fecha) ? x : m), null)
      const n = contar(a.lista)
      resueltos.push({ ...a, items: a.lista, claves: a.lista.map((x) => Number(x.id)), count: n, title: a.titulo(n), marca: ultima })
    }
  }
  activos.sort((x, y) => peso[x.severity] - peso[y.severity])
  return { activos, atendidos: resueltos, enOrden }
}

// ---------- Agenda ----------

/** Tutorías de hoy (cualquier estado) y próximas pendientes hasta `dias`. */
export const calcularAgenda = (tutorias, ahora, dias = 14) => {
  const hoy = inicioDia(ahora)
  const manana = sumarDias(hoy, 1)
  const limite = sumarDias(hoy, dias + 1)
  const deHoy = tutorias.filter((t) => t.inicio >= hoy && t.inicio < manana).sort(porFechaAsc)
  const proximas = tutorias.filter((t) => t.grupo === 'pendiente' && t.inicio >= manana && t.inicio < limite).sort(porFechaAsc)
  const siguiente = proximas.length
    ? null
    : tutorias.filter((t) => t.grupo === 'pendiente' && t.inicio >= limite).sort(porFechaAsc)[0] || null
  return { deHoy, proximas, siguiente }
}

// ---------- KPIs con contexto ----------

export const calcularKpis = (tutorias, ahora) => {
  const hoy = inicioDia(ahora)
  const noCancelada = (t) => t.grupo !== 'cancelada'

  // Próximos 7 días naturales (hoy + 7, como la agenda) frente a los 7 días anteriores
  const en7 = sumarDias(hoy, 8)
  const hace7 = sumarDias(hoy, -7)
  const proximas7 = tutorias.filter((t) => t.futura && t.inicio < en7)
  const anteriores7 = tutorias.filter((t) => noCancelada(t) && t.inicio >= hace7 && t.inicio < ahora)

  // Realizadas (finalizadas) por fecha de la sesión: últimos 30 días frente a los 30 previos
  const hace30 = sumarDias(hoy, -29)
  const hace60 = sumarDias(hoy, -59)
  const fin = tutorias.filter((t) => t.grupo === 'finalizada')
  const realizadas30 = fin.filter((t) => t.inicio >= hace30 && t.inicio <= ahora).length
  const realizadasPrev = fin.filter((t) => t.inicio >= hace60 && t.inicio < hace30).length

  // Tasa de cierre: de las sesiones ya ocurridas (no canceladas), cuántas se finalizaron
  const ocurridas = tutorias.filter((t) => noCancelada(t) && t.fin < ahora && (t.grupo === 'finalizada' || t.grupo === 'pendiente'))
  const cerradas = ocurridas.filter((t) => t.grupo === 'finalizada').length
  const sinCerrar = ocurridas.length - cerradas

  // Ocupación de las próximas tutorías con cupo definido
  const futuras = tutorias.filter((t) => t.futura)
  const conCupo = futuras.filter((t) => t.cupos)
  const inscritosConCupo = conCupo.reduce((s, t) => s + Math.min(t.inscritos, t.cupos), 0)
  const cuposTotales = conCupo.reduce((s, t) => s + t.cupos, 0)

  // Pendientes cuya sesión ya terminó (misma regla que "vencida" en clasificarTutorias)
  const vencidas = tutorias.filter((t) => t.vencida)
  const vencidasHace7 = vencidas.filter((t) => t.fin < hace7).length

  return {
    vencidas: { valor: vencidas.length, masDe7Dias: vencidasHace7 },
    proximas7: {
      valor: proximas7.length,
      inscritos: proximas7.reduce((s, t) => s + t.inscritos, 0),
      anterior: anteriores7.length,
    },
    realizadas30: { valor: realizadas30, anterior: realizadasPrev },
    cierre: {
      ratio: ocurridas.length ? cerradas / ocurridas.length : null,
      cerradas,
      ocurridas: ocurridas.length,
      sinCerrar,
    },
    ocupacion: {
      ratio: cuposTotales ? inscritosConCupo / cuposTotales : null,
      inscritos: inscritosConCupo,
      cupos: cuposTotales,
      futuras: futuras.length,
      llenas: conCupo.filter((t) => t.inscritos >= t.cupos).length,
      vacias: futuras.filter((t) => t.inscritos === 0).length,
      sinLimite: futuras.length - conCupo.length,
    },
  }
}

// ---------- Tendencia mensual ----------

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Últimos `n` meses (incluido el actual) por mes de la sesión y grupo de estado. */
export const calcularTendencia = (tutorias, ahora, n = 12) => {
  const meses = Array.from({ length: n }, (_, i) => {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - (n - 1 - i), 1)
    return {
      clave: `${d.getFullYear()}-${d.getMonth()}`,
      etiqueta: MESES[d.getMonth()],
      etiquetaLarga: `${MESES[d.getMonth()]} ${d.getFullYear()}`,
      anio: d.getFullYear(),
      finalizada: 0,
      pendiente: 0,
      cancelada: 0,
      total: 0,
    }
  })
  const idx = new Map(meses.map((m, i) => [m.clave, i]))
  let otros = 0
  for (const t of tutorias) {
    const i = idx.get(`${t.inicio.getFullYear()}-${t.inicio.getMonth()}`)
    if (i === undefined) continue
    if (t.grupo === 'otro') {
      otros += 1
      continue
    }
    meses[i][t.grupo] += 1
    meses[i].total += 1
  }
  const total = meses.reduce((s, m) => s + m.total, 0)
  const pico = meses.reduce((best, m) => (m.total > (best?.total ?? 0) ? m : best), null)
  return { meses, total, pico, otros }
}

// ---------- Demanda (idioma / nivel / modalidad) ----------

const clave = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()

const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/**
 * Agrupa sin distinguir mayúsculas ni tildes ("Inglés", "Ingles", "ingles" → una barra) y muestra
 * la variante más frecuente. Las `top` primeras van solas; el resto se suma en "Otros".
 */
export const agruparPor = (tutorias, campo, top = 6) => {
  const grupos = new Map()
  for (const t of tutorias) {
    const original = String(t[campo] || '').trim()
    const k = clave(original) || '∅'
    if (!grupos.has(k)) grupos.set(k, { n: 0, variantes: new Map() })
    const g = grupos.get(k)
    g.n += 1
    g.variantes.set(original, (g.variantes.get(original) || 0) + 1)
  }
  const total = tutorias.length
  const filas = [...grupos.entries()]
    .map(([k, g]) => {
      const [variante] = [...g.variantes.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]
      return { clave: k, etiqueta: k === '∅' ? 'Sin dato' : capitalizar(variante), n: g.n }
    })
    .sort((a, b) => b.n - a.n || a.etiqueta.localeCompare(b.etiqueta, 'es'))

  const visibles = filas.slice(0, top)
  const resto = filas.slice(top)
  if (resto.length) {
    visibles.push({
      clave: '__otros',
      etiqueta: `Otros (${resto.length})`,
      n: resto.reduce((s, f) => s + f.n, 0),
      detalle: resto.map((f) => f.etiqueta).join(', '),
    })
  }
  return { filas: visibles.map((f) => ({ ...f, share: total ? f.n / total : 0 })), total, distintos: filas.length }
}

export const PERIODOS = [
  { id: '30', label: '30 días', dias: 30 },
  { id: '90', label: '90 días', dias: 90 },
  { id: '365', label: '12 meses', dias: 365 },
  { id: 'todo', label: 'Todo', dias: null },
]

/** Fecha de inicio del periodo (null = sin límite). */
export const inicioPeriodo = (periodoId, ahora) => {
  const p = PERIODOS.find((x) => x.id === periodoId)
  return p?.dias ? sumarDias(inicioDia(ahora), -(p.dias - 1)) : null
}

// ---------- Carga por docente / tutor ----------

const promedio = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)

/**
 * Una fila por Docente/Tutor (de GET /Usuario) y por cualquier otro asignado que aparezca en tutorías.
 * - proximas: pendientes por venir (todas)
 * - sinCerrar: pendientes vencidas (todas)
 * - realizadas: finalizadas con sesión dentro del periodo
 * - calificacion: media de las retroalimentaciones de esas tutorías realizadas
 */
export const calcularCarga = ({ tutorias, personal, retroalimentaciones, desde }) => {
  const filas = new Map()
  for (const p of personal) {
    filas.set(String(p.id), { id: p.id, nombre: p.nombre || p.email, rol: p.rol, activo: p.activo !== false, proximas: 0, sinCerrar: 0, realizadas: 0, notas: [] })
  }
  const retroPorTutoria = new Map()
  for (const r of retroalimentaciones || []) {
    if (!retroPorTutoria.has(r.tutoriaId)) retroPorTutoria.set(r.tutoriaId, [])
    retroPorTutoria.get(r.tutoriaId).push(Number(r.calificacion))
  }

  for (const t of tutorias) {
    if (t.docenteId == null) continue
    const k = String(t.docenteId)
    if (!filas.has(k)) {
      const nombre = [t.docenteNombre, t.docenteApellidos].filter((x) => x && x !== 'N/A').join(' ') || 'Sin nombre'
      filas.set(k, { id: t.docenteId, nombre, rol: null, proximas: 0, sinCerrar: 0, realizadas: 0, notas: [] })
    }
    const f = filas.get(k)
    if (t.futura) f.proximas += 1
    if (t.vencida) f.sinCerrar += 1
    if (t.grupo === 'finalizada' && (!desde || t.inicio >= desde)) {
      f.realizadas += 1
      f.notas.push(...(retroPorTutoria.get(t.id) || []))
    }
  }

  return [...filas.values()]
    .map(({ notas, ...f }) => ({ ...f, calificacion: promedio(notas.filter(Number.isFinite)), nCalificaciones: notas.length }))
    .sort(
      (a, b) =>
        b.proximas - a.proximas ||
        b.sinCerrar - a.sinCerrar ||
        b.realizadas - a.realizadas ||
        a.nombre.localeCompare(b.nombre, 'es')
    )
}

/**
 * Los `n` docentes/tutores más relevantes para el resumen del dashboard.
 * Criterio (visible en la interfaz): más tutorías realizadas en el periodo; a igualdad, mejor calificación
 * y luego más tutorías próximas. Las filas son las de calcularCarga (mismas cifras que el listado completo).
 */
export const CRITERIO_TOP_DOCENTES = 'Más tutorías realizadas en el periodo'
export const ordenarPorRelevancia = (filas) =>
  [...filas].sort(
    (a, b) =>
      b.realizadas - a.realizadas ||
      (b.calificacion ?? -1) - (a.calificacion ?? -1) ||
      b.proximas - a.proximas ||
      a.nombre.localeCompare(b.nombre, 'es')
  )

// ---------- Calidad ----------

/** Calificación de sesiones (retroalimentaciones de docentes/tutores al finalizar) y su distribución. */
export const calcularCalidadSesiones = (retroalimentaciones) => {
  const notas = (retroalimentaciones || []).map((r) => Number(r.calificacion)).filter((n) => Number.isFinite(n) && n > 0)
  const distribucion = [5, 4, 3, 2, 1].map((b) => ({
    banda: b,
    etiqueta: b === 5 ? '5' : `${b} a ${b},9`,
    n: notas.filter((n) => (b === 5 ? n >= 5 : n >= b && n < b + 1)).length,
  }))
  return { promedio: promedio(notas), n: notas.length, distribucion }
}

// ---------- Formato ----------

const nf1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const nf0 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
export const formatNota = (n) => (n == null ? '—' : nf1.format(n))
export const formatNum = (n) => nf0.format(n)
/** Porcentaje desde 0–100. */
export function formatPct(n) {
  return `${nf0.format(n)} %`
}
export const formatRatio = (r) => (r == null ? '—' : `${nf0.format(r * 100)} %`)
