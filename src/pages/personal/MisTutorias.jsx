import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApiQuery } from '../../hooks/useApiQuery'
import { PageHeader, LoadingState, EmptyState, ErrorState, StatusBadge } from '../../components/ui/States'
import Icon from '../../components/ui/Icon'
import { fetchMisTutorias, permisosTutoria } from '../../features/tutorias/tutorias'
import { formatHora, formatRangoHoras, parseLocal } from '../../lib/fechas'
import { getUserId, nombreCompleto, ROLES, tieneRol } from '../../lib/roles'
import { nombreAsignado } from '../../lib/usuarios'
import './personal.css'
import { aulaLimpia, aulaTexto } from '../../lib/aula'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const DateChip = ({ value }) => {
  const d = parseLocal(value)
  if (!d) return <span className="date-chip" aria-hidden="true">—</span>
  return (
    <span className="date-chip" aria-hidden="true">
      <span className="date-chip__day">{d.getDate()}</span>
      <span className="date-chip__month">{MESES[d.getMonth()]}</span>
    </span>
  )
}

const RELACION = {
  asignada: 'Asignada a ti',
  agendada: 'Agendada por ti',
  ambas: 'Agendada e impartida por ti',
}

const COPY = {
  pendiente: {
    titulo: 'Mis tutorías',
    docente: 'Tutorías pendientes que impartes o que agendaste en tus horarios.',
    tutor: 'Tutorías pendientes asignadas a ti.',
    vacioDocente: 'No tienes tutorías pendientes',
    vacioTutor: 'No tienes tutorías asignadas',
    textoDocente: 'Agenda una tutoría desde tus horarios disponibles.',
    textoTutor: 'Cuando un docente te asigne una tutoría aparecerá aquí.',
  },
  finalizada: {
    titulo: 'Tutorías finalizadas',
    docente: 'Tutorías completadas que impartiste o agendaste.',
    tutor: 'Tutorías completadas que impartiste.',
    vacioDocente: 'Aún no hay tutorías finalizadas',
    vacioTutor: 'Aún no hay tutorías finalizadas',
    textoDocente: 'Las tutorías que finalices aparecerán aquí.',
    textoTutor: 'Las tutorías que finalices aparecerán aquí.',
  },
}

const MisTutorias = ({ grupo = 'pendiente' }) => {
  const { user } = useAuth()
  const yo = getUserId(user)
  const esDocente = tieneRol(user, [ROLES.DOCENTE])
  const copy = COPY[grupo]
  const [query, setQuery] = useState('')
  const [filtro, setFiltro] = useState('todas')

  const { data, isLoading, isError, error, refetch } = useApiQuery(
    (signal) => fetchMisTutorias(user, grupo, signal),
    [yo, grupo]
  )

  const lista = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data || []).filter((t) => {
      if (filtro === 'asignadas' && t.relacion === 'agendada') return false
      if (filtro === 'agendadas' && t.relacion === 'asignada') return false
      if (!q) return true
      return `${t.tema} ${t.idioma} ${t.nivel} ${t.modalidad} ${t.horarioEspacio}`.toLowerCase().includes(q)
    })
  }, [data, query, filtro])

  const base = grupo === 'pendiente' ? '/mis-tutorias' : '/historial'

  return (
    <div className="personal-page">
      <PageHeader
        title={copy.titulo}
        subtitle={esDocente ? copy.docente : copy.tutor}
        meta={data && data.length > 0 && <span className="count-pill">{data.length} {data.length === 1 ? 'tutoría' : 'tutorías'}</span>}
      />

      {isLoading && <LoadingState label="Cargando tutorías…" />}
      {isError && <ErrorState error={error} onRetry={refetch} />}

      {data && data.length === 0 && (
        <EmptyState
          icon={grupo === 'pendiente' ? 'clipboard' : 'history'}
          title={esDocente ? copy.vacioDocente : copy.vacioTutor}
          action={
            esDocente && grupo === 'pendiente' ? (
              <Link className="btn btn--primary" to="/agenda">Ver horarios disponibles</Link>
            ) : null
          }
        >
          {esDocente ? copy.textoDocente : copy.textoTutor}
        </EmptyState>
      )}

      {data && data.length > 0 && (
        <>
          <div className="toolbar">
            <div className="search-field">
              <Icon name="search" size={18} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por tema, idioma, nivel o espacio"
                aria-label="Buscar tutorías"
              />
            </div>
            {esDocente && (
              <div className="segmented" role="group" aria-label="Filtrar tutorías">
                {[['todas', 'Todas', ''], ['asignadas', 'Asignadas', ' a mí'], ['agendadas', 'Agendadas', ' por mí']].map(([k, l, extra]) => (
                  <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>
                    {l}{extra && <span className="hide-sm">{extra}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {lista.length === 0 ? (
            <EmptyState
              icon="search"
              title="Ninguna tutoría coincide con la búsqueda"
              action={<button type="button" className="btn btn--secondary" onClick={() => { setQuery(''); setFiltro('todas') }}>Limpiar filtros</button>}
            />
          ) : (
            <ul className="panel row-list tutoria-list" aria-label={copy.titulo}>
              {lista.map((t) => {
                const permisos = permisosTutoria(user, t)
                const imparte = t.usuarioId === yo ? 'Tú' : nombreAsignado(t)
                return (
                  <li key={t.idTutoria} className="tutoria-row">
                    <DateChip value={t.fechaTutoria} />
                    <div className="tutoria-row__main">
                      <div className="tutoria-row__title-row">
                        <h2 className="tutoria-row__title">
                          <Link to={`${base}/${t.idTutoria}`} className="stretched-link">{t.tema || 'Tutoría sin tema'}</Link>
                        </h2>
                        <StatusBadge estado={t.estado} />
                        {t.calificacionSesion != null && (
                          <span className="nota-pill" title="Calificación de la sesión">
                            <Icon name="star" size={14} className="nota-pill__star" />
                            {t.calificacionSesion.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            <span className="sr-only"> de 5</span>
                          </span>
                        )}
                      </div>
                      <p className="tutoria-row__sub">
                        {[t.idioma, t.nivel, t.modalidad].filter(Boolean).join(' · ')}
                      </p>
                      <div className="meta">
                        <span className="meta__item">
                          <Icon name="clock" size={16} />
                          <span className="sr-only">Fecha: </span>
                          {parseLocal(t.fechaTutoria)?.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })}
                          {' · '}
                          {t.horarioHoraInicio && parseLocal(t.horarioHoraInicio)
                            ? formatRangoHoras(t.horarioHoraInicio, t.horarioHoraFin)
                            : formatHora(t.fechaTutoria)}
                        </span>
                        {/* Pendientes: "Aula por asignar" si falta; historial: solo si hubo aula */}
                        {(grupo === 'pendiente' || aulaLimpia(t.horarioEspacio)) && (
                          <span className="meta__item"><Icon name="mapPin" size={16} />{aulaTexto(t.horarioEspacio)}</span>
                        )}
                        <span className="meta__item">
                          <Icon name="users" size={16} />
                          {(t.estudiantes || []).length} {(t.estudiantes || []).length === 1 ? 'estudiante' : 'estudiantes'}
                        </span>
                        {esDocente && t.usuarioId !== yo && imparte && (
                          <span className="meta__item"><Icon name="user" size={16} />Imparte: {imparte}</span>
                        )}
                        {esDocente && t.relacion && (
                          <span className="tag tag--neutral">{RELACION[t.relacion]}</span>
                        )}
                      </div>
                    </div>
                    {grupo === 'pendiente' && permisos.puedeFinalizar && (
                      <div className="tutoria-row__actions">
                        <Link className="btn btn--secondary btn--sm" to={`/tutorias/${t.idTutoria}/finalizar`}>
                          Calificar y finalizar
                        </Link>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export default MisTutorias
