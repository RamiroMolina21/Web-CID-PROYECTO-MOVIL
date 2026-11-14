import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useConfirm, useToast } from '../../components/ui/Feedback'
import { PageHeader, LoadingState, ErrorState, EmptyState, Spinner } from '../../components/ui/States'
import Icon from '../../components/ui/Icon'
import StudentPicker from '../../features/tutorias/StudentPicker'
import { fetchHorariosPropios, fetchUsuariosPorRol, parseCupos } from '../../features/tutorias/tutorias'
import { tutoriaService } from '../../services/apiService'
import { ApiError, getErrorMessage } from '../../lib/apiClient'
import { ESTADO_AL_CREAR, isHorarioDisponible } from '../../lib/estados'
import { combinarFechaHora, formatDiaLargo, formatRangoHoras } from '../../lib/fechas'
import { getUserId, nombreCompleto } from '../../lib/roles'
import './personal.css'

// Decisión (coordinador, 2026-11-11): modalidad de selección única.
const MODALIDADES = ['Virtual', 'Presencial', 'Híbrido']
const MAX_LEN = 45 // TutoriaCreate: idioma, nivel, tema, modalidad ≤ 45

const PASOS = [
  { id: 1, titulo: 'Tema', descripcion: 'Tema de la tutoría' },
  { id: 2, titulo: 'Asignación', descripcion: 'Quién la imparte' },
  { id: 3, titulo: 'Estudiantes', descripcion: 'Opcional' },
]

const cargar = async (yo, horarioId, signal) => {
  const [horarios, tutores, docentes, estudiantes] = await Promise.all([
    fetchHorariosPropios(yo, signal),
    fetchUsuariosPorRol('Tutor', signal),
    fetchUsuariosPorRol('Docente', signal),
    fetchUsuariosPorRol('Estudiante', signal),
  ])
  const horario = horarios.find((h) => h.idHorario === horarioId) || null
  const personas = [...tutores, ...docentes].sort((a, b) =>
    nombreCompleto(a).localeCompare(nombreCompleto(b), 'es')
  )
  return { horario, personas, estudiantes }
}

const Field = ({ id, label, error, hint, children, counter }) => (
  <div className="field">
    <label className="field__label" htmlFor={id}>{label}</label>
    {children}
    {hint && !error && <p className="field__hint" id={`${id}-hint`}>{hint}</p>}
    {error && <p className="field__error" id={`${id}-error`}>{error}</p>}
    {counter}
  </div>
)

const AgendarWizard = () => {
  const { horarioId: horarioIdParam } = useParams()
  const horarioId = Number(horarioIdParam)
  const { user } = useAuth()
  const yo = getUserId(user)
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const stepHeadingRef = useRef(null)

  const { data, isLoading, isError, error, refetch } = useApiQuery(
    (signal) => cargar(yo, horarioId, signal),
    [yo, horarioId],
    { revalidateOnFocus: false }
  )

  const [paso, setPaso] = useState(1)
  const [form, setForm] = useState({ idioma: '', nivel: '', tema: '', modalidad: '', tutorId: '' })
  const [estudiantes, setEstudiantes] = useState([])
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState(null)

  const dirty = useMemo(
    () => Object.values(form).some((v) => String(v).trim()) || estudiantes.length > 0,
    [form, estudiantes]
  )

  useEffect(() => {
    if (!dirty || guardando) return undefined
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, guardando])

  // Llevar el foco al título del paso al cambiar de paso
  const primerRender = useRef(true)
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false
      return
    }
    stepHeadingRef.current?.focus()
  }, [paso])

  const horario = data?.horario
  const cupos = horario ? parseCupos(horario.cupos) : null
  const tutor = data?.personas.find((p) => String(p.idUsuario) === String(form.tutorId))

  const set = (campo) => (e) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }))
    if (errores[campo]) setErrores((er) => ({ ...er, [campo]: undefined }))
  }

  const validarPaso = (n) => {
    const er = {}
    if (n === 1) {
      for (const [campo, etiqueta] of [['idioma', 'el idioma'], ['nivel', 'el nivel'], ['tema', 'el tema']]) {
        const v = form[campo].trim()
        if (!v) er[campo] = `Escribe ${etiqueta}.`
        else if (v.length > MAX_LEN) er[campo] = `Máximo ${MAX_LEN} caracteres.`
      }
      if (!form.modalidad) er.modalidad = 'Elige una modalidad.'
    }
    if (n === 2 && !form.tutorId) er.tutorId = 'Elige quién impartirá la tutoría.'
    setErrores(er)
    if (Object.keys(er).length) {
      const primero = Object.keys(er)[0]
      requestAnimationFrame(() => document.getElementById(`f-${primero}`)?.focus())
      return false
    }
    return true
  }

  const siguiente = () => {
    if (validarPaso(paso)) setPaso((p) => Math.min(3, p + 1))
  }

  const cancelar = async () => {
    if (dirty) {
      const ok = await confirm({
        title: 'Cancelar el agendamiento',
        message: 'Se perderán los datos que escribiste. ¿Deseas salir?',
        confirmLabel: 'Salir sin guardar',
        cancelLabel: 'Seguir editando',
        danger: true,
      })
      if (!ok) return
    }
    navigate('/agenda')
  }

  const guardar = async () => {
    if (!validarPaso(1)) return setPaso(1)
    if (!validarPaso(2)) return setPaso(2)
    const fechaTutoria = combinarFechaHora(horario.fechaInicio, horario.horaInicio)
    if (!fechaTutoria) {
      setErrorGuardar(new Error('No se pudo obtener la fecha y hora del horario seleccionado.'))
      return
    }

    setGuardando(true)
    setErrorGuardar(null)
    try {
      // Operación atómica: crea la tutoría y asigna los estudiantes (todo o nada, respetando cupos).
      const creada = await tutoriaService.create({
        idioma: form.idioma.trim(),
        nivel: form.nivel.trim(),
        tema: form.tema.trim(),
        modalidad: form.modalidad,
        estado: ESTADO_AL_CREAR,
        fechaTutoria,
        usuarioId: Number(form.tutorId),
        horarioId,
        ...(estudiantes.length > 0 ? { estudianteIds: estudiantes } : {}),
      })
      toast.success(
        estudiantes.length > 0 ? 'La tutoría quedó agendada con sus estudiantes.' : 'La tutoría quedó agendada.',
        { title: 'Tutoría agendada' }
      )
      navigate(`/mis-tutorias/${creada.idTutoria}`, { replace: true })
    } catch (err) {
      setErrorGuardar(err)
      requestAnimationFrame(() => document.querySelector('.wizard__error')?.scrollIntoView({ block: 'nearest' }))
    } finally {
      setGuardando(false)
    }
  }

  if (!Number.isFinite(horarioId)) {
    return <EmptyState icon="info" title="Horario no válido" action={<Link className="btn btn--primary" to="/agenda">Volver a horarios</Link>} />
  }

  const back = { to: '/agenda', label: 'Horarios disponibles' }

  if (isLoading) {
    return (
      <div className="personal-page">
        <PageHeader title="Agendar tutoría" back={back} />
        <LoadingState rows={2} />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="personal-page">
        <PageHeader title="Agendar tutoría" back={back} />
        <ErrorState error={error} onRetry={refetch} />
      </div>
    )
  }
  if (!horario || !isHorarioDisponible(horario.estado)) {
    return (
      <div className="personal-page">
        <PageHeader title="Agendar tutoría" back={back} />
        <EmptyState
          icon="calendar"
          title="Este horario ya no está disponible"
          action={<Link className="btn btn--primary" to="/agenda">Ver horarios disponibles</Link>}
        >
          Puede que ya tenga una tutoría o que no sea uno de tus horarios.
        </EmptyState>
      </div>
    )
  }

  const pasoActual = PASOS[paso - 1]
  const conflicto = errorGuardar instanceof ApiError && errorGuardar.status === 409

  return (
    <div className="personal-page personal-page--narrow">
      <PageHeader title="Agendar tutoría" back={back} />

      <section className="horario-resumen" aria-label="Horario seleccionado">
        <p className="horario-resumen__title">{horario.titulo}</p>
        <div className="meta">
          <span className="meta__item"><Icon name="calendar" size={16} />{formatDiaLargo(horario.fechaInicio)}</span>
          <span className="meta__item"><Icon name="clock" size={16} />{formatRangoHoras(horario.horaInicio, horario.horaFin)}</span>
          <span className="meta__item"><Icon name="mapPin" size={16} />{horario.espacio}</span>
          <span className="meta__item"><Icon name="users" size={16} />{cupos != null ? `${cupos} cupos` : 'Sin límite de cupos'}</span>
        </div>
      </section>

      <ol className="stepper" aria-label="Pasos">
        {PASOS.map((p) => (
          <li
            key={p.id}
            className={`stepper__step${p.id === paso ? ' is-current' : ''}${p.id < paso ? ' is-done' : ''}`}
            aria-current={p.id === paso ? 'step' : undefined}
          >
            <span className="stepper__dot" aria-hidden="true">
              {p.id < paso ? <Icon name="check" size={14} strokeWidth={2.5} /> : p.id}
            </span>
            <span className="stepper__label">
              {p.titulo}
              <span className="sr-only">{p.id < paso ? ' (completado)' : p.id === paso ? ' (paso actual)' : ''}</span>
            </span>
          </li>
        ))}
      </ol>

      <form
        className="panel wizard"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (paso < 3) siguiente()
          else guardar()
        }}
      >
        <div className="panel__body">
          <h2 className="wizard__title" tabIndex={-1} ref={stepHeadingRef}>
            Paso {paso} de 3 · {pasoActual.descripcion}
          </h2>

          {paso === 1 && (
            <div className="form-grid">
              <div className="form-grid form-grid--2">
                <Field id="f-idioma" label="Idioma" error={errores.idioma}>
                  <input id="f-idioma" className="input" value={form.idioma} onChange={set('idioma')} placeholder="Ej.: Inglés"
                    maxLength={MAX_LEN} autoComplete="off" aria-invalid={!!errores.idioma}
                    aria-describedby={errores.idioma ? 'f-idioma-error' : undefined} />
                </Field>
                <Field id="f-nivel" label="Nivel" error={errores.nivel}>
                  <input id="f-nivel" className="input" value={form.nivel} onChange={set('nivel')} placeholder="Ej.: A1, B2, Avanzado"
                    maxLength={MAX_LEN} autoComplete="off" aria-invalid={!!errores.nivel}
                    aria-describedby={errores.nivel ? 'f-nivel-error' : undefined} />
                </Field>
              </div>
              <Field id="f-tema" label="Tema" error={errores.tema}
                counter={<span className="field__counter">{form.tema.length}/{MAX_LEN}</span>}>
                <input id="f-tema" className="input" value={form.tema} onChange={set('tema')} placeholder="Ej.: Gramática básica"
                  maxLength={MAX_LEN} autoComplete="off" aria-invalid={!!errores.tema}
                  aria-describedby={errores.tema ? 'f-tema-error' : undefined} />
              </Field>
              <fieldset className="field" aria-describedby={errores.modalidad ? 'f-modalidad-error' : undefined}>
                <legend className="field__label">Modalidad</legend>
                <div className="choice-group">
                  {MODALIDADES.map((m, i) => (
                    <label className="choice" key={m}>
                      <input
                        type="radio"
                        name="modalidad"
                        id={i === 0 ? 'f-modalidad' : undefined}
                        value={m}
                        checked={form.modalidad === m}
                        onChange={set('modalidad')}
                      />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
                {errores.modalidad && <p className="field__error" id="f-modalidad-error">{errores.modalidad}</p>}
              </fieldset>
            </div>
          )}

          {paso === 2 && (
            <div className="form-grid">
              <Field id="f-tutorId" label="Tutor o docente" error={errores.tutorId}
                hint="Puede ser un Tutor u otro Docente, incluido tú.">
                <select id="f-tutorId" className="select" value={form.tutorId} onChange={set('tutorId')}
                  aria-invalid={!!errores.tutorId}
                  aria-describedby={errores.tutorId ? 'f-tutorId-error' : 'f-tutorId-hint'}>
                  <option value="">Selecciona una persona</option>
                  {data.personas.map((p) => (
                    <option key={p.idUsuario} value={p.idUsuario}>
                      {nombreCompleto(p) || p.correo} · {p.tipoRol}{p.idUsuario === yo ? ' (tú)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {!form.tutorId && (
                <button type="button" className="btn btn--ghost wizard__self"
                  onClick={() => setForm((f) => ({ ...f, tutorId: String(yo) }))}>
                  <Icon name="user" size={18} /> Asignarme a mí
                </button>
              )}
              <div className="form-grid form-grid--2">
                <div className="field">
                  <span className="field__label">Fecha</span>
                  <p className="readonly-value">{formatDiaLargo(horario.fechaInicio)}</p>
                </div>
                <div className="field">
                  <span className="field__label">Hora</span>
                  <p className="readonly-value">{formatRangoHoras(horario.horaInicio, horario.horaFin)}</p>
                </div>
              </div>
              <p className="field__hint">La fecha y la hora las define el horario seleccionado.</p>
            </div>
          )}

          {paso === 3 && (
            <div className="form-grid">
              <p className="field__hint">
                {cupos != null
                  ? `Puedes agregar hasta ${cupos} ${cupos === 1 ? 'estudiante' : 'estudiantes'}.`
                  : 'Este horario no tiene límite de cupos.'}{' '}
                También podrás hacerlo después desde el detalle.
              </p>
              <StudentPicker
                estudiantes={data.estudiantes}
                seleccion={estudiantes}
                onChange={setEstudiantes}
                max={cupos}
              />
              <dl className="resumen">
                <div><dt>Tema</dt><dd>{form.tema} · {form.idioma} {form.nivel}</dd></div>
                <div><dt>Modalidad</dt><dd>{form.modalidad}</dd></div>
                <div><dt>Imparte</dt><dd>{tutor ? `${nombreCompleto(tutor)} (${tutor.tipoRol})` : '—'}</dd></div>
              </dl>
            </div>
          )}

          {errorGuardar && (
            <div className="banner banner--error wizard__error" role="alert">
              <Icon name="alert" size={18} />
              <span>
                {conflicto ? getErrorMessage(errorGuardar) : `No se pudo agendar la tutoría. ${getErrorMessage(errorGuardar)}`}
              </span>
              {conflicto && /horario/i.test(errorGuardar.message) && <Link className="btn btn--secondary btn--sm" to="/agenda">Ver horarios</Link>}
            </div>
          )}

          <div className="form-footer">
            <button type="button" className="btn btn--ghost" onClick={cancelar} disabled={guardando}>Cancelar</button>
            <div className="form-footer__end">
              {paso > 1 && (
                <button type="button" className="btn btn--secondary" onClick={() => setPaso((p) => p - 1)} disabled={guardando}>
                  <Icon name="chevronLeft" size={18} /> Atrás
                </button>
              )}
              {paso < 3 ? (
                <button type="submit" className="btn btn--primary">
                  Continuar <Icon name="chevronRight" size={18} />
                </button>
              ) : (
                <button type="submit" className="btn btn--primary" disabled={guardando} aria-busy={guardando}>
                  {guardando ? <><Spinner /> Agendando…</> : <><Icon name="check" size={18} /> Agendar tutoría</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default AgendarWizard
