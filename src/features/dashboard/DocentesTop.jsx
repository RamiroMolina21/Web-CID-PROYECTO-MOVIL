import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import Modal from '../../components/ui/Modal'
import { iniciales } from '../../lib/roles'
import Carga from './Carga'
import { CRITERIO_TOP_DOCENTES, formatNota, formatNum, ordenarPorRelevancia } from './metricas'

const TOP = 5

/**
 * Nivel 4: los 5 docentes/tutores más relevantes (criterio visible) con realizadas y calificación.
 * El listado completo (tabla de carga) se abre en un panel; la gestión, en Usuarios (solo Administrador).
 */
const DocentesTop = ({ filas, periodoLabel, puedeGestionar }) => {
  const [completo, setCompleto] = useState(false)
  const ordenadas = useMemo(() => ordenarPorRelevancia(filas), [filas])
  const top = ordenadas.slice(0, TOP)

  if (filas.length === 0) return <p className="dash-empty">No hay docentes ni tutores registrados.</p>

  return (
    <div className="people">
      <p className="people__criterio">
        <Icon name="trendUp" size={14} /> {CRITERIO_TOP_DOCENTES} ({periodoLabel})
      </p>
      <ol className="people__list">
        {top.map((f, i) => (
          <li key={f.id} className="people__row">
            <span className="people__rank" aria-hidden="true">{i + 1}</span>
            <span className="avatar avatar--sm" aria-hidden="true">{iniciales(f.nombre)}</span>
            <span className="people__who">
              <span className="people__name">{f.nombre}</span>
              <span className="people__rol">
                {f.rol || 'Sin rol de personal'}
                {f.sinCerrar > 0 && <span className="people__warn"> · {formatNum(f.sinCerrar)} sin cerrar</span>}
              </span>
            </span>
            <span className="people__stat">
              <strong>{formatNum(f.realizadas)}</strong>
              <span className="people__stat-label">{f.realizadas === 1 ? 'realizada' : 'realizadas'}</span>
            </span>
            <span className="people__stat">
              <strong>{f.calificacion == null ? '—' : formatNota(f.calificacion)}</strong>
              <span className="people__stat-label">{f.calificacion == null ? 'sin calificar' : `nota (${formatNum(f.nCalificaciones)})`}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="people__foot">
        <button type="button" className="dash-link dash-link--button" onClick={() => setCompleto(true)}>
          Ver las {formatNum(filas.length)} personas <Icon name="arrowRight" size={16} />
        </button>
        {puedeGestionar && (
          <Link className="dash-link" to="/estudiantes">Gestionar docentes y tutores <Icon name="arrowRight" size={16} /></Link>
        )}
      </div>
      <Modal open={completo} onClose={() => setCompleto(false)} title="Carga por docente y tutor" description={`Ordenado por: ${CRITERIO_TOP_DOCENTES.toLowerCase()} (${periodoLabel}).`} size="lg">
        <div className="dash dash--embebido" tabIndex={0} role="region" aria-label="Listado completo de docentes y tutores">
          <Carga filas={ordenadas} todas />
        </div>
      </Modal>
    </div>
  )
}

export default DocentesTop
