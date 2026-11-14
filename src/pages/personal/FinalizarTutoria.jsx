import React, { useEffect, useId, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useToast } from '../../components/ui/Feedback'
import { PageHeader, LoadingState, ErrorState, EmptyState, Spinner, StatusBadge } from '../../components/ui/States'
import Icon from '../../components/ui/Icon'
import { permisosTutoria } from '../../features/tutorias/tutorias'
import { tutoriaService } from '../../services/apiService'
import { ApiError, getErrorMessage } from '../../lib/apiClient'
import { grupoEstadoTutoria } from '../../lib/estados'
import { formatDiaLargo, formatHora } from '../../lib/fechas'
import { getUserId, GESTION, tieneRol } from '../../lib/roles'
import './personal.css'

const MAX_COMENTARIO = 300
const draftKey = (id) => `tutorpro.finalizar.${id}`

const leerBorrador = (id) => {
  try {
    return JSON.parse(sessionStorage.getItem(draftKey(id)) || 'null')
  } catch {
    return null
  }
}
const guardarBorrador = (id, value) => {
  try {
    if (value) sessionStorage.setItem(draftKey(id), JSON.stringify(value))
    else sessionStorage.removeItem(draftKey(id))
  } catch {
    /* noop */
  }
}

const Estrellas = ({ valor }) => (
  <span className="stars" aria-hidden="true">
    {[1, 2, 3, 4, 5].map((n) => {
      const fill = Math.max(0, Math.min(1, valor - (n - 1)))
      return (
        <span key={n} className="stars__item">
          <Icon name="star" size={28} className="stars__empty" />
          <span className="stars__fill" style={{ width: `${fill * 100}%` }}>
            <Icon name="star" size={28} />
          </span>
        </span>
      )
    })}
  </span>
)

const formatNota = (n) => n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const FinalizarTutoria = () => {
  const { id } = useParams()
  const { user } = useAuth()
  const yo = getUserId(user)
  const navigate = useNavigate()
  const toast = useToast()
  const rangeId = useId()
  const comentarioId = useId()
  const esGestion = tieneRol(user, GESTION)

  const [calificacion, setCalificacion] = useState(() => leerBorrador(id)?.calificacion ?? 3)
  const [comentario, setComentario] = useState(() => leerBorrador(id)?.comentario ?? '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  // 409 "Ya registró una retroalimentación": se ofrece finalizar sin volver a calificar
  const [yaCalificada, setYaCalificada] = useState(false)

  const { data, isLoading, isError, error: loadError, refetch } = useApiQuery(
    (signal) => tutoriaService.getById(id, signal),
    [id, yo],
    { revalidateOnFocus: false }
  )

  // Borrador por si la sesión expira a mitad del formulario
  useEffect(() => {
    guardarBorrador(id, { calificacion, comentario })
  }, [id, calificacion, comentario])

  const back = esGestion
    ? { to: '/tutorias-finalizadas', label: 'Tutorías finalizadas' }
    : { to: `/mis-tutorias/${id}`, label: 'Detalle de la tutoría' }

  const header = <PageHeader title="Calificar y finalizar" back={back} />

  if (isLoading && !data) return <div className="personal-page personal-page--narrow">{header}<LoadingState rows={1} /></div>
  if (isError && !data) {
    return (
      <div className="personal-page personal-page--narrow">
        {header}
        <ErrorState error={loadError} onRetry={refetch}
          title={loadError?.status === 403 ? 'No tienes acceso a esta tutoría' : loadError?.status === 404 ? 'La tutoría no existe' : undefined} />
      </div>
    )
  }

  const tutoria = data
  const permisos = permisosTutoria(user, tutoria)
  const grupo = grupoEstadoTutoria(tutoria.estado)
  const destinoFinal = esGestion ? '/tutorias-finalizadas' : `/historial/${id}`

  if (grupo === 'finalizada') {
    return (
      <div className="personal-page personal-page--narrow">
        {header}
        <EmptyState icon="checkCircle" title="Esta tutoría ya está finalizada"
          action={<Link className="btn btn--primary" to={destinoFinal}>Ver tutoría</Link>} />
      </div>
    )
  }
  if (!permisos.participa || grupo === 'cancelada') {
    return (
      <div className="personal-page personal-page--narrow">
        {header}
        <EmptyState icon="lock" title={grupo === 'cancelada' ? 'No se puede finalizar una tutoría cancelada' : 'No puedes finalizar esta tutoría'}>
          {grupo === 'cancelada' ? null : 'Solo quien la imparte, el docente dueño del horario o Administración pueden finalizarla.'}
        </EmptyState>
      </div>
    )
  }

  const enviar = async (conCalificacion) => {
    setEnviando(true)
    setError(null)
    try {
      // Atómico: crea la retroalimentación (autor = token) y finaliza; el backend envía las encuestas.
      await tutoriaService.finalizar(
        tutoria.idTutoria,
        conCalificacion ? { calificacion, comentario: comentario.trim() || null } : undefined
      )
      guardarBorrador(id, null)
      toast.success('La tutoría quedó finalizada y se enviaron las encuestas de satisfacción.', { title: 'Tutoría finalizada' })
      navigate(destinoFinal, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setYaCalificada(true)
      setError(err)
    } finally {
      setEnviando(false)
    }
  }

  const onSubmit = (e) => {
    e.preventDefault()
    if (yaCalificada) return enviar(false)
    if (calificacion < 1 || calificacion > 5) {
      setError(new Error('La calificación debe estar entre 1 y 5.'))
      return undefined
    }
    return enviar(true)
  }

  return (
    <div className="personal-page personal-page--narrow">
      {header}

      <section className="horario-resumen" aria-label="Tutoría">
        <div className="horario-resumen__row">
          <p className="horario-resumen__title">{tutoria.tema}</p>
          <StatusBadge estado={tutoria.estado} />
        </div>
        <div className="meta">
          <span className="meta__item"><Icon name="globe" size={16} />{[tutoria.idioma, tutoria.nivel].filter(Boolean).join(' · ')}</span>
          <span className="meta__item"><Icon name="calendar" size={16} />{formatDiaLargo(tutoria.fechaTutoria)}</span>
          <span className="meta__item"><Icon name="clock" size={16} />{formatHora(tutoria.fechaTutoria)}</span>
        </div>
      </section>

      <form className="panel" onSubmit={onSubmit} noValidate>
        <div className="panel__body form-grid">
          <fieldset className="field rating" disabled={enviando || yaCalificada}>
            <legend className="field__label">Calificación</legend>
            <div className="rating__row">
              <Estrellas valor={calificacion} />
              <output className="rating__value" htmlFor={rangeId} aria-live="polite">
                {formatNota(calificacion)} <span>/ 5</span>
              </output>
            </div>
            <label className="sr-only" htmlFor={rangeId}>Calificación de 1 a 5</label>
            <input
              id={rangeId}
              type="range"
              className="rating__range"
              min={1}
              max={5}
              step={0.5}
              value={calificacion}
              onChange={(e) => setCalificacion(Number(e.target.value))}
              aria-valuetext={`${formatNota(calificacion)} de 5`}
            />
            <div className="rating__scale" aria-hidden="true"><span>1</span><span>3</span><span>5</span></div>
          </fieldset>

          <div className="field">
            <label className="field__label" htmlFor={comentarioId}>
              Comentario <span className="field__optional">(opcional)</span>
            </label>
            <textarea
              id={comentarioId}
              className="textarea"
              value={comentario}
              onChange={(e) => setComentario(e.target.value.slice(0, MAX_COMENTARIO))}
              maxLength={MAX_COMENTARIO}
              placeholder="¿Cómo fue la sesión? Avances, dificultades, próximos pasos…"
              disabled={enviando || yaCalificada}
              aria-describedby={`${comentarioId}-count`}
            />
            <span className="field__counter" id={`${comentarioId}-count`}>{comentario.length}/{MAX_COMENTARIO}</span>
          </div>

          <p className="field__hint">
            Al finalizar, los estudiantes recibirán por correo la encuesta de satisfacción. Esta acción no se puede deshacer.
          </p>

          {error && (
            <div className={`banner ${yaCalificada ? 'banner--warning' : 'banner--error'}`} role="alert">
              <Icon name="alert" size={18} />
              <span>
                {getErrorMessage(error)}
                {yaCalificada && '. Puedes finalizar la tutoría sin volver a calificarla.'}
              </span>
            </div>
          )}

          <div className="form-footer">
            <Link className="btn btn--ghost" to={back.to}>Cancelar</Link>
            <div className="form-footer__end">
              <button type="submit" className="btn btn--primary" disabled={enviando} aria-busy={enviando}>
                {enviando ? (
                  <><Spinner /> Finalizando…</>
                ) : yaCalificada ? (
                  <><Icon name="checkCircle" size={18} /> Finalizar sin calificar</>
                ) : (
                  <><Icon name="checkCircle" size={18} /> Guardar y finalizar</>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default FinalizarTutoria
