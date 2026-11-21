import React, { useId, useState } from 'react'
import { iniciales } from '../../lib/roles'
import { formatNota, formatNum } from './metricas'

const VISIBLES = 6

/** Carga por docente/tutor. Solo lectura: no ofrece acciones sobre el personal. */
const Carga = ({ filas, todas = false }) => {
  const [todos, setTodos] = useState(false)
  const listaId = useId()
  const mostradas = todos || todas ? filas : filas.slice(0, VISIBLES)
  const sinCarga = filas.filter((f) => !f.proximas && !f.sinCerrar && !f.realizadas).length

  if (filas.length === 0) return <p className="dash-empty">No hay docentes ni tutores registrados.</p>

  return (
    <div className="load">
      <table className="load-table" id={listaId}>
        <caption className="sr-only">Carga de trabajo por docente y tutor</caption>
        <thead>
          <tr>
            <th scope="col">Persona</th>
            <th scope="col" className="num">Próximas</th>
            <th scope="col" className="num">Sin cerrar</th>
            <th scope="col" className="num">Realizadas</th>
            <th scope="col" className="num">Calificación</th>
          </tr>
        </thead>
        <tbody>
          {mostradas.map((f) => (
            <tr key={f.id}>
              <th scope="row">
                <span className="load-person">
                  <span className="avatar avatar--sm" aria-hidden="true">{iniciales(f.nombre)}</span>
                  <span className="load-person__text">
                    <span className="load-person__name">{f.nombre}</span>
                    <span className="load-person__rol">{f.rol || 'Sin rol de personal'}{f.activo === false ? ' · cuenta inactiva' : ''}</span>
                  </span>
                </span>
              </th>
              <td className="num" data-label="Próximas">{formatNum(f.proximas)}</td>
              <td className={`num${f.sinCerrar ? ' is-warn' : ''}`} data-label="Sin cerrar">{formatNum(f.sinCerrar)}</td>
              <td className="num" data-label="Realizadas">{formatNum(f.realizadas)}</td>
              <td className="num" data-label="Calificación">
                {f.calificacion == null ? (
                  <span className="muted">—<span className="sr-only">sin calificaciones</span></span>
                ) : (
                  <>
                    {formatNota(f.calificacion)}
                    <span className="load-n"> ({formatNum(f.nCalificaciones)})</span>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="load__foot">
        <p className="load__note">
          «Realizadas» y «Calificación» usan el periodo elegido; «Próximas» y «Sin cerrar», todas las fechas.
          {sinCarga > 0 && ` ${formatNum(sinCarga)} sin actividad en el periodo.`}
        </p>
        {!todas && filas.length > VISIBLES && (
          <button type="button" className="btn btn--ghost btn--sm" aria-expanded={todos} aria-controls={listaId} onClick={() => setTodos((v) => !v)}>
            {todos ? 'Mostrar menos' : `Ver las ${formatNum(filas.length)} personas`}
          </button>
        )}
      </div>
    </div>
  )
}

export default Carga
