import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { ROLES, tieneRol } from '../lib/roles'
import { useApiQuery } from '../hooks/useApiQuery'
import { atencionService, encuestaService, retroalimentacionService } from '../services/apiService'
import { useConfirm, useToast } from '../components/ui/Feedback'
import { getErrorMessage } from '../lib/apiClient'
import { PageHeader, Spinner } from '../components/ui/States'
import Icon from '../components/ui/Icon'
import { formatDiaLargo, formatFecha, formatHora } from '../lib/fechas'
import DashPanel from '../features/dashboard/DashPanel'
import Atencion from '../features/dashboard/Atencion'
import Agenda from '../features/dashboard/Agenda'
import Indicadores from '../features/dashboard/Indicadores'
import Tendencia from '../features/dashboard/Tendencia'
import Calidad from '../features/dashboard/Calidad'
import Demanda from '../features/dashboard/Demanda'
import Carga from '../features/dashboard/Carga'
import {
  PERIODOS,
  calcularAgenda,
  aplicarAtendidos,
  calcularAtencion,
  calcularCalidadSesiones,
  calcularCarga,
  calcularKpis,
  calcularTendencia,
  clasificarTutorias,
  formatNum,
  inicioPeriodo,
} from '../features/dashboard/metricas'
import './Dashboard.css'

/** Reloj de la página: recalcula "en curso", "vencida", "hoy"… cada minuto. */
const useAhora = (ms = 60_000) => {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return ahora
}

const estadoQuery = (q) => (q.isLoading && q.data === undefined ? 'loading' : q.isError && q.data === undefined ? 'error' : 'ready')

/**
 * Dashboard de gestión (Administrador y Auxiliar).
 * Jerarquía: 1) qué requiere atención hoy → 2) indicadores con contexto → 3) tendencia y calidad →
 * 4) análisis por periodo (demanda y carga). Cada bloque carga, falla y se reintenta por separado.
 */
const Dashboard = () => {
  const { tutorias, horarios, docentes, loading, error, loadErrors = {}, loadData } = useData()
  const { user } = useAuth()
  // El Auxiliar no gestiona personal (backend: 403 sobre usuarios no Estudiante): sin ese acceso.
  const esAdmin = tieneRol(user, [ROLES.ADMIN])
  const ahora = useAhora()
  const [periodo, setPeriodo] = useState('365')

  const encuestasQ = useApiQuery(() => encuestaService.getEstadisticas(), [])
  const retroQ = useApiQuery(() => retroalimentacionService.getAll(), [])
  const pendientesQ = useApiQuery((signal) => encuestaService.getPendientes(signal), [])
  // Asuntos atendidos (persistidos en el servidor, compartidos por Admin y Auxiliar). Si falla, el bloque sigue.
  const atendidosQ = useApiQuery((signal) => atencionService.getAtendidos(signal), [])
  const toast = useToast()
  const confirm = useConfirm()
  const [atendiendo, setAtendiendo] = useState(null)

  // DataContext: esqueleto solo en la primera carga; al actualizar se mantiene el contenido.
  const cargadoUnaVez = useRef(false)
  const [actualizado, setActualizado] = useState(null)
  useEffect(() => {
    if (!loading) {
      cargadoUnaVez.current = true
      setActualizado(new Date())
    }
  }, [loading])
  const primeraCarga = loading && !cargadoUnaVez.current
  const errorGlobal = error ? { message: error } : null
  const errorDe = (recurso) => errorGlobal || loadErrors[recurso] || null
  const estadoDe = (...recursos) => (primeraCarga ? 'loading' : recursos.some((r) => errorDe(r)) ? 'error' : 'ready')

  const refrescar = () => {
    loadData()
    encuestasQ.refetch({ silent: encuestasQ.data !== undefined })
    retroQ.refetch({ silent: retroQ.data !== undefined })
    pendientesQ.refetch({ silent: pendientesQ.data !== undefined })
    atendidosQ.refetch({ silent: atendidosQ.data !== undefined })
  }
  const refrescando = loading || encuestasQ.isLoading || retroQ.isLoading || atendidosQ.isLoading

  // ---------- Derivados (baratos: unos cientos de filas como máximo) ----------
  const clasificadas = useMemo(() => clasificarTutorias(tutorias, ahora), [tutorias, ahora])
  const retro = Array.isArray(retroQ.data) ? retroQ.data : null
  const encuestas = encuestasQ.data || null
  const personal = useMemo(
    () => (docentes || []).filter((d) => /^(docente|tutor)$/i.test((d.rol || '').trim())),
    [docentes]
  )

  const tutoriasOk = !errorDe('tutorias')
  const horariosOk = !errorDe('horarios')

  const pendientes = Array.isArray(pendientesQ.data) ? pendientesQ.data : null
  const listaAtendidos = Array.isArray(atendidosQ.data) ? atendidosQ.data : []
  const atencion = useMemo(
    () =>
      aplicarAtendidos(
        calcularAtencion({
          tutorias: tutoriasOk ? clasificadas : null,
          horarios: horariosOk ? horarios : null,
          retroalimentaciones: retro,
          encuestasPendientes: pendientes,
          encuestas,
          ahora,
        }),
        listaAtendidos
      ),
    [clasificadas, horarios, retro, pendientes, encuestas, ahora, tutoriasOk, horariosOk, listaAtendidos]
  )

  // Marca TODAS las claves pendientes del asunto como atendidas (POST idempotente).
  const atender = async (asunto) => {
    const ok = await confirm({
      title: '¿Está seguro de que ya le dio atención al asunto?',
      message: `${asunto.title} (${formatNum(asunto.count)}). Dejará de aparecer como pendiente para todo el equipo hasta que surja un caso nuevo.`,
      confirmLabel: 'Sí, ya lo atendí',
      cancelLabel: 'Cancelar',
    })
    if (!ok) return
    setAtendiendo(asunto.tipo)
    try {
      const marcados = []
      for (let i = 0; i < asunto.claves.length; i += 200) {
        marcados.push(...((await atencionService.marcar(asunto.tipo, asunto.claves.slice(i, i + 200))) || []))
      }
      atendidosQ.setData((prev) => {
        const previos = Array.isArray(prev) ? prev : []
        const nuevos = marcados.filter((m) => !previos.some((p) => p.tipo === m.tipo && Number(p.clave) === Number(m.clave)))
        return [...previos, ...nuevos]
      })
      toast.success(`«${asunto.title}» quedó marcado como atendido.`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'No se pudo marcar el asunto como atendido.'))
    } finally {
      setAtendiendo(null)
    }
  }

  // Deshacer: borra las marcas de las claves actuales del asunto.
  const deshacer = async (asunto) => {
    setAtendiendo(asunto.tipo)
    try {
      await Promise.all(asunto.claves.map((c) => atencionService.deshacer(asunto.tipo, c)))
      const borradas = new Set(asunto.claves)
      atendidosQ.setData((prev) => (Array.isArray(prev) ? prev.filter((p) => !(p.tipo === asunto.tipo && borradas.has(Number(p.clave)))) : prev))
      toast.info(`«${asunto.title}» vuelve a estar pendiente.`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'No se pudo deshacer.'))
      atendidosQ.refetch({ silent: true })
    } finally {
      setAtendiendo(null)
    }
  }
  const agenda = useMemo(() => calcularAgenda(clasificadas, ahora), [clasificadas, ahora])
  const kpis = useMemo(() => calcularKpis(clasificadas, ahora), [clasificadas, ahora])
  const tendencia = useMemo(() => calcularTendencia(clasificadas, ahora), [clasificadas, ahora])
  const calidadSesiones = useMemo(() => (retro ? calcularCalidadSesiones(retro) : null), [retro])

  const desde = inicioPeriodo(periodo, ahora)
  const enPeriodo = useMemo(() => (desde ? clasificadas.filter((t) => t.inicio >= desde) : clasificadas), [clasificadas, desde?.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps
  const carga = useMemo(
    () => calcularCarga({ tutorias: clasificadas, personal, retroalimentaciones: retro, desde }),
    [clasificadas, personal, retro, desde?.getTime()] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Fuentes secundarias de la zona de atención que no se pudieron revisar
  const fallosAtencion = [
    !tutoriasOk && { nombre: 'tutorías', error: errorDe('tutorias'), onRetry: loadData },
    !horariosOk && { nombre: 'horarios', error: errorDe('horarios'), onRetry: loadData },
    retroQ.isError && !retro && { nombre: 'calificaciones de sesiones', error: retroQ.error, onRetry: () => retroQ.refetch() },
    pendientesQ.isError && !pendientes && { nombre: 'encuestas sin responder', error: pendientesQ.error, onRetry: () => pendientesQ.refetch() },
    atendidosQ.isError && !atendidosQ.data && { nombre: 'asuntos ya atendidos', error: atendidosQ.error, onRetry: () => atendidosQ.refetch() },
  ].filter(Boolean)
  const atencionEstado = primeraCarga ? 'loading' : !tutoriasOk && !horariosOk ? 'error' : 'ready'

  const periodoLabel = PERIODOS.find((p) => p.id === periodo).label.toLowerCase()

  return (
    <div className="dash">
      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            {formatDiaLargo(ahora)}
            {actualizado && <span className="dash-updated"> · Datos actualizados a las {formatHora(actualizado)}</span>}
          </>
        }
        actions={
          <>
            <button type="button" className="btn btn--secondary" onClick={refrescar} disabled={refrescando}>
              {refrescando ? <Spinner /> : <Icon name="refresh" size={18} />}
              {refrescando ? 'Actualizando…' : 'Actualizar'}
            </button>
            <Link className="btn btn--primary" to="/agendar-tutoria">
              <Icon name="calendarPlus" size={18} /> Agendar tutoría
            </Link>
          </>
        }
      />

      <div className="dash-grid dash-grid--top">
        <DashPanel
          className="dash-area-attention"
          title="Requiere atención"
          subtitle={
            atencion.activos.length
              ? 'Ordenado por prioridad. Cada asunto enlaza a donde se resuelve.'
              : 'Revisión de tutorías, horarios, calificaciones y encuestas.'
          }
          actions={atencion.activos.length > 0 && (
            <span className="count-pill">{formatNum(atencion.activos.length)} {atencion.activos.length === 1 ? 'asunto' : 'asuntos'}</span>
          )}
          status={atencionEstado}
          error={errorDe('tutorias')}
          onRetry={loadData}
        >
          <Atencion
            activos={atencion.activos}
            atendidos={atencion.atendidos}
            enOrden={atencion.enOrden}
            fallos={fallosAtencion}
            onAtender={atender}
            onDeshacer={deshacer}
            ocupado={atendiendo}
          />
        </DashPanel>

        <DashPanel
          className="dash-area-agenda"
          title="Agenda"
          subtitle="Hoy y próximos 14 días"
          status={estadoDe('tutorias')}
          error={errorDe('tutorias')}
          onRetry={loadData}
          footer={<Link className="dash-link" to="/horarios">Ver todos los horarios <Icon name="arrowRight" size={16} /></Link>}
        >
          <Agenda agenda={agenda} ahora={ahora} />
        </DashPanel>
      </div>

      <DashPanel
        className="dash-kpis-panel"
        title="Indicadores"
        subtitle="Cada cifra se compara con su periodo anterior o con su total"
        status={estadoDe('tutorias')}
        error={errorDe('tutorias')}
        onRetry={loadData}
        skeleton="kpi"
      >
        <Indicadores kpis={kpis} />
      </DashPanel>

      <div className="dash-grid dash-grid--mid">
        <DashPanel
          className="dash-area-trend"
          title="Actividad mensual"
          subtitle="Tutorías por mes de la sesión y estado, últimos 12 meses"
          status={estadoDe('tutorias')}
          error={errorDe('tutorias')}
          onRetry={loadData}
          skeleton="chart"
        >
          <Tendencia tendencia={tendencia} />
        </DashPanel>

        <DashPanel className="dash-area-quality" title="Calidad" subtitle="Histórico completo">
          <Calidad
            sesiones={{ status: estadoQuery(retroQ), error: retroQ.error, retry: () => retroQ.refetch(), data: calidadSesiones }}
            encuestas={{ status: estadoQuery(encuestasQ), error: encuestasQ.error, retry: () => encuestasQ.refetch(), data: encuestas }}
          />
        </DashPanel>
      </div>

      <section className="dash-analysis" aria-labelledby="dash-analisis-t">
        <div className="dash-analysis__head">
          <div>
            <h2 id="dash-analisis-t" className="dash-analysis__title">Análisis por periodo</h2>
            <p className="dash-analysis__subtitle">
              {desde ? `Sesiones desde el ${formatFecha(desde)}, incluidas las programadas.` : 'Todas las sesiones registradas.'}
            </p>
          </div>
          <div className="segmented" role="group" aria-label="Periodo del análisis">
            {PERIODOS.map((p) => (
              <button key={p.id} type="button" aria-pressed={periodo === p.id} onClick={() => setPeriodo(p.id)}>{p.label}</button>
            ))}
          </div>
        </div>

        <div className="dash-grid dash-grid--analysis">
          <DashPanel
            className="dash-area-demand"
            headingLevel={3}
            title="Demanda"
            subtitle={`${formatNum(enPeriodo.length)} tutorías · ${periodoLabel}`}
            status={estadoDe('tutorias')}
            error={errorDe('tutorias')}
            onRetry={loadData}
          >
            <Demanda tutorias={enPeriodo} />
          </DashPanel>

          <DashPanel
            className="dash-area-load"
            headingLevel={3}
            title="Carga por docente y tutor"
            subtitle={`${formatNum(carga.length)} personas: docentes, tutores y otros asignados a tutorías`}
            status={estadoDe('tutorias', 'usuarios')}
            error={errorDe('tutorias') || errorDe('usuarios')}
            onRetry={loadData}
            footer={esAdmin && (
              <Link className="dash-link" to="/estudiantes">Gestionar docentes y tutores <Icon name="arrowRight" size={16} /></Link>
            )}
          >
            {retroQ.isError && !retro && (
              <p className="dash-inline-note" role="status">Calificaciones no disponibles: no se pudo cargar la retroalimentación.</p>
            )}
            <Carga filas={carga} />
          </DashPanel>
        </div>
      </section>
    </div>
  )
}

export default Dashboard
