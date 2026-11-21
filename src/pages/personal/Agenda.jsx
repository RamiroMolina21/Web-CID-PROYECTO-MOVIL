import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApiQuery } from '../../hooks/useApiQuery'
import { PageHeader, LoadingState, EmptyState, ErrorState } from '../../components/ui/States'
import { fetchHorariosPropios, filtrarDisponibles, parseCupos } from '../../features/tutorias/tutorias'
import DisponibilidadDocente from '../../features/horarios/DisponibilidadDocente'
import { hoyIso } from '../../features/horarios/disponibilidad'
import { formatHora } from '../../lib/fechas'
import { getUserId } from '../../lib/roles'
import './personal.css'

/** Horario de la API -> sesión normalizada para la vista de disponibilidad. */
const aSesion = (h) => ({
  id: h.idHorario,
  fecha: String(h.fechaInicio || '').slice(0, 10),
  inicio: formatHora(h.horaInicio),
  fin: formatHora(h.horaFin),
  espacio: h.espacio,
  cupos: parseCupos(h.cupos),
})

const Agenda = () => {
  const { user } = useAuth()
  const yo = getUserId(user)

  const { data, isLoading, isError, error, refetch } = useApiQuery(
    (signal) => fetchHorariosPropios(yo, signal),
    [yo]
  )

  // Disponibles y de hoy en adelante: lo que de verdad se puede agendar
  const sesiones = useMemo(() => {
    const hoy = hoyIso()
    return filtrarDisponibles(data || []).map(aSesion).filter((s) => s.fecha >= hoy && s.inicio !== '—')
  }, [data])

  return (
    <div className="personal-page">
      <PageHeader
        title="Horarios disponibles"
        subtitle="Tus días y franjas disponibles. Elige una fecha para agendar una tutoría."
        meta={
          data && (
            <span className="count-pill">
              {sesiones.length} {sesiones.length === 1 ? 'fecha disponible' : 'fechas disponibles'}
            </span>
          )
        }
      />

      {isLoading && <LoadingState label="Cargando tus horarios…" />}
      {isError && <ErrorState error={error} onRetry={refetch} />}

      {data && sesiones.length === 0 && (
        <EmptyState icon="calendar" title="No tienes horarios disponibles">
          Cuando Administración publique horarios a tu nombre aparecerán aquí para que puedas agendar tutorías.
        </EmptyState>
      )}

      {data && sesiones.length > 0 && (
        <section className="panel agenda-disp" aria-label="Tu disponibilidad">
          <DisponibilidadDocente
            sesiones={sesiones}
            renderAccion={(s, etiqueta) => (
              <Link className="btn btn--primary btn--sm" to={`/agenda/${s.id}/agendar`} aria-label={`Agendar el ${etiqueta}`}>
                Agendar
              </Link>
            )}
          />
        </section>
      )}
    </div>
  )
}

export default Agenda
