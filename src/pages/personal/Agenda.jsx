import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApiQuery } from '../../hooks/useApiQuery'
import { PageHeader, LoadingState, EmptyState, ErrorState } from '../../components/ui/States'
import Icon from '../../components/ui/Icon'
import { agruparHorarios, fetchHorariosPropios, filtrarDisponibles } from '../../features/tutorias/tutorias'
import { formatDiaLargo, formatFecha, formatRangoHoras } from '../../lib/fechas'
import { getUserId } from '../../lib/roles'
import './personal.css'

const coincide = (grupo, q) => {
  if (!q) return true
  const fechas = grupo.ocurrencias.map((o) => formatFecha(o.fechaInicio)).join(' ')
  return `${grupo.titulo} ${grupo.espacio} ${fechas}`.toLowerCase().includes(q)
}

const rangoFechas = (g) => {
  const a = formatFecha(g.primeraFecha)
  const b = formatFecha(g.ultimaFecha)
  return a === b ? a : `${a} – ${b}`
}

const Agenda = () => {
  const { user } = useAuth()
  const yo = getUserId(user)
  const [query, setQuery] = useState('')
  const [abierto, setAbierto] = useState(null)

  const { data, isLoading, isError, error, refetch } = useApiQuery(
    (signal) => fetchHorariosPropios(yo, signal),
    [yo]
  )

  const grupos = useMemo(() => agruparHorarios(filtrarDisponibles(data || [])), [data])
  const q = query.trim().toLowerCase()
  const visibles = grupos.filter((g) => coincide(g, q))
  const totalFechas = grupos.reduce((n, g) => n + g.ocurrencias.length, 0)

  return (
    <div className="personal-page">
      <PageHeader
        title="Horarios disponibles"
        subtitle="Reserva uno de tus horarios para una nueva tutoría."
        meta={
          data && (
            <span className="count-pill">
              {grupos.length} {grupos.length === 1 ? 'horario' : 'horarios'}
              {totalFechas > grupos.length && ` · ${totalFechas} fechas`}
            </span>
          )
        }
      />

      {isLoading && <LoadingState label="Cargando tus horarios…" />}
      {isError && <ErrorState error={error} onRetry={refetch} />}

      {data && grupos.length === 0 && (
        <EmptyState icon="calendar" title="No tienes horarios disponibles">
          Cuando Administración publique horarios a tu nombre aparecerán aquí para que puedas agendar tutorías.
        </EmptyState>
      )}

      {data && grupos.length > 0 && (
        <>
          <div className="toolbar">
            <div className="search-field">
              <Icon name="search" size={18} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar título, espacio o fecha"
                aria-label="Buscar horarios"
              />
            </div>
          </div>

          {visibles.length === 0 ? (
            <EmptyState
              icon="search"
              title={`Ningún horario coincide con “${query}”`}
              action={<button type="button" className="btn btn--secondary" onClick={() => setQuery('')}>Limpiar búsqueda</button>}
            />
          ) : (
            <ul className="panel row-list slot-list" aria-label="Horarios disponibles">
              {visibles.map((g) => {
                const expandido = abierto === g.key
                const panelId = `fechas-${g.domId}`
                return (
                  <li key={g.key} className="slot">
                    <div className="slot__main">
                      <div className="slot__title-row">
                        <h2 className="slot__title">{g.titulo}</h2>
                        <span className={`tag${g.esRecurrente ? '' : ' tag--neutral'}`}>
                          {g.esRecurrente ? `Recurrente · ${g.ocurrencias.length} fechas` : 'Horario único'}
                        </span>
                      </div>
                      <div className="meta">
                        <span className="meta__item"><Icon name="clock" size={16} />{formatRangoHoras(g.horaInicio, g.horaFin)}</span>
                        <span className="meta__item"><Icon name="mapPin" size={16} />{g.espacio || 'Sin espacio'}</span>
                        <span className="meta__item"><Icon name="calendar" size={16} />{rangoFechas(g)}</span>
                        {g.cupos != null && (
                          <span className="meta__item"><Icon name="users" size={16} />{g.cupos} cupos</span>
                        )}
                      </div>
                    </div>
                    <div className="slot__actions">
                      {g.esRecurrente ? (
                        <button
                          type="button"
                          className="btn btn--secondary"
                          aria-expanded={expandido}
                          aria-controls={panelId}
                          onClick={() => setAbierto(expandido ? null : g.key)}
                        >
                          {expandido ? 'Ocultar fechas' : `Ver fechas (${g.ocurrencias.length})`}
                          <Icon name="chevronDown" size={18} className={`chevron${expandido ? ' is-open' : ''}`} />
                        </button>
                      ) : (
                        <Link className="btn btn--primary" to={`/agenda/${g.ocurrencias[0].idHorario}/agendar`}>
                          Agendar tutoría
                        </Link>
                      )}
                    </div>

                    {g.esRecurrente && (
                      <ul id={panelId} className="slot__dates" hidden={!expandido} aria-label={`Fechas de ${g.titulo}`}>
                        {g.ocurrencias.map((o) => (
                          <li key={o.idHorario} className="slot__date">
                            <span className="slot__date-text">
                              <span className="slot__date-day">{formatDiaLargo(o.fechaInicio)}</span>
                              <span className="slot__date-hour">{formatRangoHoras(o.horaInicio, o.horaFin)}</span>
                            </span>
                            <Link
                              className="btn btn--primary btn--sm"
                              to={`/agenda/${o.idHorario}/agendar`}
                              aria-label={`Agendar el ${formatDiaLargo(o.fechaInicio)}`}
                            >
                              Agendar
                            </Link>
                          </li>
                        ))}
                      </ul>
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

export default Agenda
