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
import { ProximasTutorias } from '../features/dashboard/Agenda'
import Kpis from '../features/dashboard/Kpis'
import Tendencia from '../features/dashboard/Tendencia'
import Calidad from '../features/dashboard/Calidad'
import Demanda from '../features/dashboard/Demanda'
import DocentesTop from '../features/dashboard/DocentesTop'
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
import './DashboardLayout.css'

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
 * Dashboard de gestión (Administrador y Auxiliar). Cuatro niveles, de lo urgente a lo complementario:
 *  1) KPIs (estado general) → 2) operación: actividad mensual + atención y próximas tutorías →
 *  3) calidad del servicio y demanda → 4) docentes y tutores (top 5; listado completo en un panel).
 * El periodo de análisis solo afecta a Demanda y Docentes (no a la agenda ni a la atención de hoy).
 * Cada bloque carga, falla y se reintenta por separado.
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
            {actualizado && <span className="dash-updated"> · Actualizado {formatHora(actualizado)}</span>}
          </>
        }
        actions={
          <>
            <button type="button" className="btn btn--secondary btn--sm" onClick={refrescar} disabled={refrescando}>
              {refrescando ? <Spinner /> : <Icon name="refresh" size={16} />}
              {refrescando ? 'Actualizando…' : 'Actualizar'}
            </button>
            <Link className="btn btn--primary btn--sm" to="/agendar-tutoria">
              <Icon name="calendarPlus" size={16} /> Agendar tutoría
            </Link>
          </>
        }
      />

      {/* Nivel 1: estado general */}
      <DashPanel
        className="dash-kpis-panel"
        title="Indicadores"
        hideTitle
        status={estadoDe('tutorias')}
        error={errorDe('tutorias')}
        onRetry={loadData}
        skeleton="kpi"
      >
        <Kpis kpis={kpis} />
      </DashPanel>

      {/* Nivel 2: operación */}
      <div className="dash-grid dash-grid--ops">
        <div className="dash-stack">
          <DashPanel
            className="dash-area-trend"
            title="Actividad de tutorías"
            subtitle="Últimos 12 meses, por mes de la sesión"
            status={estadoDe('tutorias')}
            error={errorDe('tutorias')}
            onRetry={loadData}
            skeleton="chart"
          >
            <Tendencia tendencia={tendencia} />
          </DashPanel>
          <DashPanel
            className="dash-area-agenda"
            title="Próximas tutorías"
            status={estadoDe('tutorias')}
            error={errorDe('tutorias')}
            onRetry={loadData}
          >
            <ProximasTutorias agenda={agenda} ahora={ahora} />
          </DashPanel>
        </div>

        <DashPanel
          id="atencion"
          className="dash-area-attention"
          title="Requiere atención"
          actions={atencion.activos.length > 0 && (
            <span className="count-pill">{formatNum(atencion.activos.length)}</span>
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
      </div>

      {/* Niveles 3 y 4: calidad (histórico) y análisis por periodo */}
      <section className="dash-analysis" aria-labelledby="dash-analisis-t">
        <div className="dash-analysis__head">
          <h2 id="dash-analisis-t" className="dash-analysis__title">Calidad y análisis</h2>
          <div className="dash-analysis__filter">
            <span className="dash-analysis__filter-label" id="dash-periodo-l">Periodo de Demanda y Docentes</span>
            <div className="segmented segmented--sm" role="group" aria-labelledby="dash-periodo-l">
              {PERIODOS.map((p) => (
                <button key={p.id} type="button" aria-pressed={periodo === p.id} onClick={() => setPeriodo(p.id)}>{p.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="dash-grid dash-grid--analysis">
          <DashPanel className="dash-area-quality dash-area-quality--wide" headingLevel={3} title="Calidad del servicio" subtitle="Histórico completo">
            <Calidad
              sesiones={{ status: estadoQuery(retroQ), error: retroQ.error, retry: () => retroQ.refetch(), data: calidadSesiones }}
              encuestas={{ status: estadoQuery(encuestasQ), error: encuestasQ.error, retry: () => encuestasQ.refetch(), data: encuestas }}
            />
          </DashPanel>

          <DashPanel
            className="dash-area-demand"
            headingLevel={3}
            title="Demanda"
            subtitle={desde ? `${formatNum(enPeriodo.length)} tutorías desde el ${formatFecha(desde)}` : `${formatNum(enPeriodo.length)} tutorías · todas las fechas`}
            status={estadoDe('tutorias')}
            error={errorDe('tutorias')}
            onRetry={loadData}
          >
            <Demanda tutorias={enPeriodo} />
          </DashPanel>

          <DashPanel
            className="dash-area-load"
            headingLevel={3}
            title="Docentes y tutores"
            subtitle={`${formatNum(carga.length)} personas`}
            status={estadoDe('tutorias', 'usuarios')}
            error={errorDe('tutorias') || errorDe('usuarios')}
            onRetry={loadData}
          >
            {retroQ.isError && !retro && (
              <p className="dash-inline-note" role="status">Calificaciones no disponibles: no se pudo cargar la retroalimentación.</p>
            )}
            <DocentesTop filas={carga} periodoLabel={periodoLabel} puedeGestionar={esAdmin} />
          </DashPanel>
        </div>
      </section>
    </div>
  )
}

export default Dashboard
