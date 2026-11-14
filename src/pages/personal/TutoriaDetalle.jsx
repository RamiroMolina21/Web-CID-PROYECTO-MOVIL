import React, { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useConfirm, useToast } from '../../components/ui/Feedback'
import Modal from '../../components/ui/Modal'
import { PageHeader, LoadingState, ErrorState, StatusBadge, Spinner } from '../../components/ui/States'
import Icon from '../../components/ui/Icon'
import StudentPicker from '../../features/tutorias/StudentPicker'
import { fetchTutoriaDetalle, fetchUsuariosPorRol, parseCupos, permisosTutoria } from '../../features/tutorias/tutorias'
import { retroalimentacionService, tutoriaService } from '../../services/apiService'
import { getErrorMessage } from '../../lib/apiClient'
import { grupoEstadoTutoria } from '../../lib/estados'
import { formatDiaLargo, formatFecha, formatRangoHoras, formatHora, parseLocal } from '../../lib/fechas'
import { getUserId, iniciales, nombreCompleto } from '../../lib/roles'
import { nombreAsignado, nombreAutor, nombreDuenoHorario } from '../../lib/usuarios'
import './personal.css'

const valor = (v) => (v && v !== 'N/A' ? v : '—')

const formatNota = (n) =>
  Number(n).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })

const AgregarEstudiantesModal = ({ open, onClose, tutoriaId, asignados, cupos, onAdded }) => {
  const toast = useToast()
  const [seleccion, setSeleccion] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const { data, isLoading, isError, error: loadError, refetch } = useApiQuery(
    (signal) => fetchUsuariosPorRol('Estudiante', signal),
    [],
    { enabled: open, revalidateOnFocus: false }
  )

  const restantes = cupos != null ? Math.max(0, cupos - asignados.length) : null

  const cerrar = () => {
    if (guardando) return
    setSeleccion([])
    setError(null)
    onClose()
  }

  const guardar = async () => {
    if (seleccion.length === 0) {
      setError(new Error('Selecciona al menos un estudiante.'))
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await tutoriaService.agregarEstudiantes(tutoriaId, { estudianteIds: seleccion })
      toast.success(
        seleccion.length === 1 ? 'Se agregó 1 estudiante.' : `Se agregaron ${seleccion.length} estudiantes.`,
        { title: 'Estudiantes agregados' }
      )
      setSeleccion([])
      onAdded()
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title="Agregar estudiantes"
      description={
        restantes != null
          ? `Quedan ${restantes} de ${cupos} cupos en esta tutoría.`
          : 'Este horario no tiene límite de cupos.'
      }
      size="lg"
      dismissable={!guardando}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={cerrar} disabled={guardando}>Cancelar</button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={guardar}
            disabled={guardando || seleccion.length === 0 || restantes === 0}
            aria-busy={guardando}
          >
            {guardando ? <><Spinner /> Guardando…</> : 'Agregar seleccionados'}
          </button>
        </>
      }
    >
      {isLoading && <LoadingState rows={2} label="Cargando estudiantes…" />}
      {isError && <ErrorState error={loadError} onRetry={refetch} />}
      {data && restantes === 0 ? (
        <p className="banner banner--warning" role="status">
          <Icon name="alert" size={18} />
          <span>La tutoría ya alcanzó su cupo máximo.</span>
        </p>
      ) : data ? (
        <StudentPicker
          estudiantes={data}
          seleccion={seleccion}
          onChange={setSeleccion}
          max={restantes}
          excluidos={asignados.map((e) => e.idUsuario)}
        />
      ) : null}
      {error && (
        <p className="banner banner--error modal-error" role="alert">
          <Icon name="alert" size={18} />
          <span>{getErrorMessage(error)}</span>
        </p>
      )}
    </Modal>
  )
}

/** Calificación registrada (GET Retroalimentacion/tutoria/{id}, disponible para participantes). */
const Retroalimentaciones = ({ tutoriaId }) => {
  const { data, isLoading, isError } = useApiQuery(
    (signal) => retroalimentacionService.getByTutoria(tutoriaId, signal),
    [tutoriaId],
    { revalidateOnFocus: false }
  )
  if (isLoading) return <LoadingState rows={1} label="Cargando calificación…" />
  if (isError) return null
  const lista = Array.isArray(data) ? data : []
  return (
    <section className="panel detail-span" aria-labelledby="retro-title">
      <div className="panel__head">
        <h2 className="panel__title" id="retro-title">Calificación de la sesión</h2>
      </div>
      <div className="panel__body">
        {lista.length === 0 ? (
          <p className="list-empty">No se registró calificación para esta tutoría.</p>
        ) : (
          <ul className="retro-list">
            {lista.map((r) => (
              <li key={r.idRetroalimentacion} className="retro">
                <p className="retro__score">
                  <Icon name="star" size={18} className="retro__star" />
                  <strong>{formatNota(r.calificacion)}</strong> / 5
                </p>
                <p className="retro__meta">
                  {nombreAutor(r)} · {formatFecha(r.fecha)}
                </p>
                {r.comentario && <p className="retro__comment">{r.comentario}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

const TutoriaDetalle = ({ soloLectura = false }) => {
  const { id } = useParams()
  const { user } = useAuth()
  const yo = getUserId(user)
  const toast = useToast()
  const confirm = useConfirm()
  const [modal, setModal] = useState(false)
  const [quitando, setQuitando] = useState(null)

  const { data, isLoading, isError, error, refetch } = useApiQuery((signal) => fetchTutoriaDetalle(id, signal), [id, yo])

  const back = soloLectura
    ? { to: '/historial', label: 'Tutorías finalizadas' }
    : { to: '/mis-tutorias', label: 'Mis tutorías' }

  if (isLoading && !data) {
    return (
      <div className="personal-page">
        <PageHeader title="Detalle de tutoría" back={back} />
        <LoadingState rows={2} />
      </div>
    )
  }
  if (isError && !data) {
    return (
      <div className="personal-page">
        <PageHeader title="Detalle de tutoría" back={back} />
        <ErrorState
          error={error}
          onRetry={refetch}
          title={error?.status === 403 ? 'No tienes acceso a esta tutoría' : error?.status === 404 ? 'La tutoría no existe' : undefined}
        />
      </div>
    )
  }

  const { tutoria, estudiantes } = data
  const permisos = permisosTutoria(user, tutoria)
  const cupos = parseCupos(tutoria.horarioCupos)
  const ocupados = estudiantes.length
  const lleno = cupos != null && ocupados >= cupos
  const finalizada = grupoEstadoTutoria(tutoria.estado) === 'finalizada'
  const tieneHorario = parseLocal(tutoria.horarioHoraInicio)
  const imparte = tutoria.usuarioId === yo ? 'Tú' : nombreAsignado(tutoria)
  const agendo =
    tutoria.horarioUsuarioId === yo
      ? 'Tú'
      : nombreDuenoHorario(tutoria)
  const acciones = !soloLectura && !finalizada

  const quitar = async (estudiante) => {
    const nombre = nombreCompleto(estudiante) || estudiante.correo
    const ok = await confirm({
      title: 'Quitar estudiante',
      message: `¿Quitar a ${nombre} de esta tutoría? Liberará un cupo.`,
      confirmLabel: 'Quitar',
      danger: true,
    })
    if (!ok) return
    setQuitando(estudiante.idUsuario)
    try {
      await tutoriaService.eliminarEstudiante(tutoria.idTutoria, estudiante.idUsuario)
      toast.success(`${nombre} ya no está en la tutoría.`)
      await refetch({ silent: true })
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setQuitando(null)
    }
  }

  return (
    <div className="personal-page">
      <PageHeader
        title={tutoria.tema || 'Tutoría'}
        subtitle={[tutoria.idioma, tutoria.nivel].filter(Boolean).join(' · ')}
        back={back}
        meta={<StatusBadge estado={tutoria.estado} />}
        actions={
          acciones && permisos.puedeFinalizar ? (
            <Link className="btn btn--primary" to={`/tutorias/${tutoria.idTutoria}/finalizar`}>
              <Icon name="checkCircle" size={18} /> Calificar y finalizar
            </Link>
          ) : null
        }
      />

      <div className="detail-grid">
        <section className="panel" aria-labelledby="info-title">
          <div className="panel__head">
            <h2 className="panel__title" id="info-title">Información</h2>
          </div>
          <dl className="panel__body info-list">
            <div><dt>Fecha</dt><dd>{formatDiaLargo(tutoria.fechaTutoria)}</dd></div>
            <div>
              <dt>Hora</dt>
              <dd>{tieneHorario ? formatRangoHoras(tutoria.horarioHoraInicio, tutoria.horarioHoraFin) : formatHora(tutoria.fechaTutoria)}</dd>
            </div>
            <div><dt>Espacio</dt><dd>{valor(tutoria.horarioEspacio)}</dd></div>
            <div><dt>Modalidad</dt><dd>{valor(tutoria.modalidad)}</dd></div>
            <div><dt>Horario</dt><dd>{valor(tutoria.horarioTitulo)}</dd></div>
            <div>
              <dt>Imparte</dt>
              <dd>
                {imparte || '—'}
                {tutoria.usuarioId !== yo && tutoria.usuarioCorreo && tutoria.usuarioCorreo !== 'N/A' && (
                  <span className="info-list__secondary">{tutoria.usuarioCorreo}</span>
                )}
              </dd>
            </div>
            <div><dt>Agendada por</dt><dd>{agendo || '—'}</dd></div>
          </dl>
        </section>

        <section className="panel" aria-labelledby="est-title">
          <div className="panel__head">
            <h2 className="panel__title" id="est-title">Estudiantes</h2>
            {acciones && permisos.puedeAgregarEstudiantes && (
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setModal(true)}
                disabled={lleno}
                title={lleno ? 'La tutoría alcanzó su cupo máximo' : undefined}
              >
                <Icon name="plus" size={18} /> Agregar estudiantes
              </button>
            )}
          </div>
          <div className="panel__body">
            {cupos != null ? (
              <div className={`meter${lleno ? ' meter--full' : ''}`}>
                <div className="meter__label">
                  <span>Cupos</span>
                  <span><strong>{ocupados}</strong> de {cupos} ocupados</span>
                </div>
                <div
                  className="meter__track"
                  role="meter"
                  aria-label="Cupos ocupados"
                  aria-valuemin={0}
                  aria-valuemax={cupos}
                  aria-valuenow={Math.min(ocupados, cupos)}
                  aria-valuetext={`${ocupados} de ${cupos} cupos ocupados`}
                >
                  <div className="meter__fill" style={{ width: `${Math.min(100, (ocupados / cupos) * 100)}%` }} />
                </div>
              </div>
            ) : (
              <p className="field__hint">
                {ocupados} {ocupados === 1 ? 'estudiante agendado' : 'estudiantes agendados'} · sin límite de cupos
              </p>
            )}

            {estudiantes.length === 0 ? (
              <p className="list-empty">Aún no hay estudiantes en esta tutoría.</p>
            ) : (
              <ul className="people-list">
                {estudiantes.map((e) => {
                  const nombre = nombreCompleto(e) || e.correo
                  return (
                    <li key={e.idUsuario} className="person">
                      <span className="avatar" aria-hidden="true">{iniciales(nombre)}</span>
                      <span className="person__text">
                        <span className="person__name">{nombre}</span>
                        <span className="person__mail">{e.correo}</span>
                      </span>
                      {acciones && permisos.puedeQuitarEstudiantes && (
                        <button
                          type="button"
                          className="icon-btn person__remove"
                          onClick={() => quitar(e)}
                          disabled={quitando === e.idUsuario}
                          aria-label={`Quitar a ${nombre}`}
                        >
                          {quitando === e.idUsuario ? <Spinner /> : <Icon name="close" size={18} />}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {finalizada && <Retroalimentaciones tutoriaId={tutoria.idTutoria} />}
      </div>

      {acciones && permisos.puedeAgregarEstudiantes && (
        <AgregarEstudiantesModal
          open={modal}
          onClose={() => setModal(false)}
          tutoriaId={tutoria.idTutoria}
          asignados={estudiantes}
          cupos={cupos}
          onAdded={() => refetch({ silent: true })}
        />
      )}
    </div>
  )
}

export default TutoriaDetalle
