import React, { useId, useMemo, useState } from 'react'
import Icon from '../../components/ui/Icon'
import { fechaLarga, franjaTexto, ordenarSesiones, resumenSemanal } from './disponibilidad'
import './disponibilidad.css'
import { aulaTexto } from '../../lib/aula'

const LOTE = 12

/**
 * Disponibilidad de un docente: tabla "Día | Horario disponible" y la lista de fechas concretas con su franja.
 * Pulsar una franja de la tabla filtra las fechas a esa franja. Cada fecha lleva su acción de agendar.
 *
 * `sesiones`: horarios normalizados y ya filtrados (disponibles, de hoy en adelante)
 *   { id, fecha 'YYYY-MM-DD', inicio 'HH:mm', fin 'HH:mm', espacio, cupos }.
 * `renderAccion(sesion, etiqueta)`: botón o enlace "Agendar" de esa fecha.
 */
const DisponibilidadDocente = ({ sesiones, renderAccion, nombre }) => {
  const uid = useId()
  const [filtro, setFiltro] = useState(null)
  const [visibles, setVisibles] = useState(LOTE)

  const resumen = useMemo(() => resumenSemanal(sesiones), [sesiones])
  const franjaFiltro = filtro && resumen.flatMap((r) => r.franjas.map((f) => ({ ...f, dia: r.dia }))).find((f) => f.key === filtro)
  const lista = useMemo(
    () => ordenarSesiones(franjaFiltro ? franjaFiltro.sesiones : sesiones),
    [franjaFiltro, sesiones]
  )

  const elegir = (key) => {
    setFiltro((actual) => (actual === key ? null : key))
    setVisibles(LOTE)
  }

  if (sesiones.length === 0) {
    return (
      <p className="disp-vacio">
        <Icon name="calendar" size={18} />
        {nombre ? `${nombre} no tiene fechas disponibles a partir de hoy.` : 'No hay fechas disponibles a partir de hoy.'}
      </p>
    )
  }

  const tituloFechas = `${uid}-fechas`

  return (
    <div className="disp-cq">
    <div className="disp">
      <div className="disp__semana">
        <table className="disp-tabla">
          <caption>Disponibilidad semanal{nombre && <span className="sr-only"> de {nombre}</span>}</caption>
          <thead>
            <tr>
              <th scope="col">Día</th>
              <th scope="col">Horario disponible</th>
              <th scope="col" className="disp-tabla__num">Fechas</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map(({ dia, franjas }) => (
              <tr key={dia.key}>
                <th scope="row">{dia.label}</th>
                <td>
                  <ul className="disp-franjas">
                    {franjas.map((f) => (
                      <li key={f.key}>
                        <button
                          type="button"
                          className={`disp-franja${filtro === f.key ? ' is-activa' : ''}`}
                          aria-pressed={filtro === f.key}
                          aria-controls={tituloFechas}
                          onClick={() => elegir(f.key)}
                          title={`Ver solo los ${dia.label.toLowerCase()} de ${franjaTexto(f.inicio, f.fin)}`}
                        >
                          <span className="disp-franja__hora">{franjaTexto(f.inicio, f.fin)}</span>
                          <span className="disp-franja__lugar">{aulaTexto(f.espacio)}</span>
                          <span className="sr-only">, {f.sesiones.length} {f.sesiones.length === 1 ? 'fecha' : 'fechas'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="disp-tabla__num">{franjas.reduce((n, f) => n + f.sesiones.length, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="disp-ayuda">Elige una franja para ver solo sus fechas.</p>
      </div>

      <div className="disp__fechas">
        <div className="disp__fechas-head">
          <h3 id={tituloFechas} className="disp__fechas-titulo">
            {franjaFiltro
              ? `${franjaFiltro.dia.label} · ${franjaTexto(franjaFiltro.inicio, franjaFiltro.fin)}`
              : 'Próximas fechas disponibles'}
            <span className="disp__cuenta">{lista.length}</span>
          </h3>
          {franjaFiltro && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => elegir(filtro)}>
              Ver todas
            </button>
          )}
        </div>
        <ul className="disp-lista" aria-labelledby={tituloFechas}>
          {lista.slice(0, visibles).map((s) => {
            const etiqueta = `${fechaLarga(s.fecha)}, ${franjaTexto(s.inicio, s.fin)}`
            return (
              <li key={s.id} className="disp-fecha">
                <span className="disp-fecha__texto">
                  <span className="disp-fecha__dia">{fechaLarga(s.fecha)}</span>
                  <span className="disp-fecha__meta">
                    <Icon name="clock" size={14} />{franjaTexto(s.inicio, s.fin)}
                    <span aria-hidden="true"> · </span>{aulaTexto(s.espacio)}
                  </span>
                </span>
                {renderAccion(s, etiqueta)}
              </li>
            )
          })}
        </ul>
        {lista.length > visibles && (
          <button type="button" className="btn btn--secondary disp-mas" onClick={() => setVisibles((v) => v + LOTE)}>
            Mostrar {Math.min(LOTE, lista.length - visibles)} fechas más
          </button>
        )}
      </div>
    </div>
    </div>
  )
}

export default DisponibilidadDocente
