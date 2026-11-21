import React, { useState } from 'react'
import Modal from '../../components/ui/Modal'
import { aulaTexto } from '../../lib/aula'
import { StatusBadge } from '../../components/ui/States'
import Icon from '../../components/ui/Icon'
import { formatDiaLargo } from '../../lib/fechas'
import { inicioDia, sumarDias } from './metricas'
import { nombreAsignado } from '../../lib/usuarios'

const MAX_PROXIMAS = 6
const diaCorto = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })

const etiquetaDia = (fecha, ahora) => {
  const d = inicioDia(fecha)
  const hoy = inicioDia(ahora)
  if (d.getTime() === sumarDias(hoy, 1).getTime()) return 'Mañana'
  const s = diaCorto.format(d).replace(/\./g, '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const nombre = (t) => nombreAsignado(t)

const etiquetaDiaCorta = (fecha, ahora) =>
  inicioDia(fecha).getTime() === inicioDia(ahora).getTime() ? 'Hoy' : etiquetaDia(fecha, ahora)

const momento = (t, ahora) => {
  if (t.grupo !== 'pendiente') return null
  if (t.inicio <= ahora && t.fin >= ahora) return { tone: 'live', label: 'En curso' }
  if (t.fin < ahora) return { tone: 'late', label: 'Terminó sin finalizar' }
  return null
}

const Sesion = ({ t, ahora, conEstado, conDia = false }) => {
  const m = momento(t, ahora)
  const lleno = t.cupos && t.inscritos >= t.cupos
  return (
    <li className="agenda-item">
      <span className="agenda-item__time">
        {conDia && <span className="agenda-item__day">{etiquetaDiaCorta(t.inicio, ahora)}</span>}
        <span>{t.horaInicio}</span>
        {t.horaFin && <span className="agenda-item__end">{t.horaFin}</span>}
      </span>
      <div className="agenda-item__body">
        <p className="agenda-item__title">
          {[t.idioma, t.nivel].filter(Boolean).join(' · ') || 'Tutoría'}
          {t.tema && <span className="agenda-item__tema"> — {t.tema}</span>}
        </p>
        <p className="agenda-item__meta">
          <span>{nombre(t)}</span>
          <span>{[t.modalidad, aulaTexto(t.espacio)].filter(Boolean).join(' · ')}</span>
        </p>
      </div>
      <div className="agenda-item__side">
        {m && <span className={`agenda-flag agenda-flag--${m.tone}`}>{m.label}</span>}
        {!m && conEstado && t.grupo !== 'pendiente' && <StatusBadge estado={t.estado} />}
        <span className={`agenda-cupo${lleno ? ' is-full' : ''}${t.inscritos === 0 ? ' is-empty' : ''}`}>
          <Icon name="users" size={14} />
          {t.cupos ? `${t.inscritos}/${t.cupos}` : t.inscritos}
          <span className="sr-only">{t.cupos ? ` estudiantes de ${t.cupos} cupos` : ' estudiantes, sin límite de cupos'}</span>
          {lleno && <span className="agenda-cupo__tag">Lleno</span>}
        </span>
      </div>
    </li>
  )
}

const Agenda = ({ agenda, ahora }) => {
  const { deHoy, proximas, siguiente } = agenda
  // Agrupa las próximas por día (máx. MAX_PROXIMAS sesiones)
  const visibles = proximas.slice(0, MAX_PROXIMAS)
  const dias = []
  for (const t of visibles) {
    const k = inicioDia(t.inicio).getTime()
    const last = dias[dias.length - 1]
    if (last && last.k === k) last.items.push(t)
    else dias.push({ k, fecha: t.inicio, items: [t] })
  }

  return (
    <div className="agenda">
      <div className="agenda__group">
        <h3 className="agenda__day agenda__day--today">
          Hoy <span>{deHoy.length ? `${deHoy.length} ${deHoy.length === 1 ? 'tutoría' : 'tutorías'}` : ''}</span>
        </h3>
        {deHoy.length ? (
          <ul className="agenda__list">
            {deHoy.map((t) => <Sesion key={t.id} t={t} ahora={ahora} conEstado />)}
          </ul>
        ) : (
          <p className="agenda__empty">No hay tutorías programadas para hoy.</p>
        )}
      </div>

      {dias.map((d) => (
        <div key={d.k} className="agenda__group">
          <h3 className="agenda__day">{etiquetaDia(d.fecha, ahora)}</h3>
          <ul className="agenda__list">
            {d.items.map((t) => <Sesion key={t.id} t={t} ahora={ahora} />)}
          </ul>
        </div>
      ))}

      {proximas.length > MAX_PROXIMAS && (
        <p className="agenda__more">Y {proximas.length - MAX_PROXIMAS} más en los próximos 14 días.</p>
      )}

      {proximas.length === 0 && (
        <p className="agenda__empty agenda__empty--next">
          {siguiente
            ? <>Sin tutorías en los próximos 14 días. La siguiente es el <strong>{formatDiaLargo(siguiente.inicio).toLowerCase()}</strong>.</>
            : 'No hay más tutorías pendientes programadas.'}
        </p>
      )}
    </div>
  )
}

const MAX_RESUMEN = 3

/**
 * Resumen para el dashboard: las próximas 3 sesiones relevantes (las de hoy primero, luego las siguientes
 * pendientes) con hora, idioma, nivel, responsable y estado. La agenda completa se abre en un panel.
 * No depende del periodo de análisis: siempre es "desde hoy".
 */
export const ProximasTutorias = ({ agenda, ahora }) => {
  const [completa, setCompleta] = useState(false)
  const { deHoy, proximas, siguiente } = agenda
  const relevantes = [...deHoy.filter((t) => t.grupo === 'pendiente' ? t.fin >= ahora : true), ...proximas].slice(0, MAX_RESUMEN)
  const total = deHoy.length + proximas.length

  return (
    <div className="agenda agenda--resumen">
      {relevantes.length ? (
        <ul className="agenda__list">
          {relevantes.map((t) => <Sesion key={t.id} t={t} ahora={ahora} conEstado conDia />)}
        </ul>
      ) : (
        <p className="agenda__empty">
          {siguiente
            ? <>Sin tutorías en los próximos 14 días. La siguiente: <strong>{formatDiaLargo(siguiente.inicio).toLowerCase()}</strong>.</>
            : 'No hay tutorías programadas.'}
        </p>
      )}
      <button type="button" className="dash-link dash-link--button" onClick={() => setCompleta(true)}>
        Ver agenda completa{total ? ` (${total})` : ''} <Icon name="arrowRight" size={16} />
      </button>
      <Modal open={completa} onClose={() => setCompleta(false)} title="Agenda: hoy y próximos 14 días" size="lg">
        <Agenda agenda={agenda} ahora={ahora} />
      </Modal>
    </div>
  )
}

export default Agenda
