import React from 'react'
import { BlockError, Meter, PanelSkeleton } from './DashPanel'
import { formatNota, formatNum, formatPct } from './metricas'

const MUESTRA_MINIMA = 5

const Medida = ({ titulo, valor, escala = '/5', ratio, detalle, aviso }) => (
  <div className="q-measure">
    <div className="q-measure__top">
      <h3 className="q-measure__title">{titulo}</h3>
      <p className="q-measure__value">
        {valor}
        {escala && valor !== '—' && <span className="q-measure__scale">{escala}</span>}
      </p>
    </div>
    <Meter ratio={ratio} />
    <p className="q-measure__detail">{detalle}</p>
    {aviso && <p className="q-measure__warn">{aviso}</p>}
  </div>
)

/**
 * sesiones: { status, error, retry, data: calcularCalidadSesiones() }
 * encuestas: { status, error, retry, data: GET /Encuesta/estadisticas }
 */
const Calidad = ({ sesiones, encuestas }) => {
  const s = sesiones.data
  const e = encuestas.data
  const hayComparacion = s?.promedio != null && e?.totalRespondidas > 0
  const diff = hayComparacion ? e.promedioCalificacion - s.promedio : null
  const maxDist = s ? Math.max(1, ...s.distribucion.map((d) => d.n)) : 1

  return (
    <div className="quality">
      {sesiones.status === 'loading' && <PanelSkeleton />}
      {sesiones.status === 'error' && <BlockError compact error={sesiones.error} onRetry={sesiones.retry} />}
      {sesiones.status === 'ready' && (
        <Medida
          titulo="Calificación de las sesiones"
          valor={formatNota(s.promedio)}
          ratio={s.promedio ? s.promedio / 5 : 0}
          detalle={s.n ? `Media de ${formatNum(s.n)} calificaciones registradas por docentes y tutores al finalizar.` : 'Aún no hay calificaciones de sesiones.'}
        />
      )}

      {encuestas.status === 'loading' && <PanelSkeleton />}
      {encuestas.status === 'error' && <BlockError compact error={encuestas.error} onRetry={encuestas.retry} />}
      {encuestas.status === 'ready' && (
        <>
          <Medida
            titulo="Satisfacción de los estudiantes"
            valor={e.totalRespondidas ? formatNota(e.promedioCalificacion) : '—'}
            ratio={e.totalRespondidas ? e.promedioCalificacion / 5 : 0}
            detalle={
              e.totalRespondidas
                ? `Media de ${formatNum(e.totalRespondidas)} ${e.totalRespondidas === 1 ? 'encuesta respondida' : 'encuestas respondidas'}.`
                : 'Ningún estudiante ha respondido la encuesta todavía.'
            }
            aviso={
              e.totalRespondidas > 0 && e.totalRespondidas < MUESTRA_MINIMA
                ? `Muestra pequeña: con ${formatNum(e.totalRespondidas)} ${e.totalRespondidas === 1 ? 'respuesta' : 'respuestas'}, tómalo como indicio.`
                : null
            }
          />
          <Medida
            titulo="Tasa de respuesta"
            valor={formatPct(e.tasaRespuesta || 0)}
            escala={null}
            ratio={(e.tasaRespuesta || 0) / 100}
            detalle={`${formatNum(e.totalRespondidas || 0)} de ${formatNum(e.totalEnviadas || 0)} encuestas enviadas.`}
          />
        </>
      )}

      {hayComparacion && (
        <p className="quality__compare">
          {Math.abs(diff) < 0.05
            ? 'Estudiantes y docentes valoran las sesiones de forma parecida.'
            : `Los estudiantes puntúan ${formatNota(Math.abs(diff))} ${diff > 0 ? 'por encima' : 'por debajo'} de la calificación que registran docentes y tutores.`}
        </p>
      )}

      {sesiones.status === 'ready' && s.n > 0 && (
        <div className="q-dist">
          <h3 className="q-dist__title">Distribución de calificaciones de las sesiones</h3>
          <ol className="rank rank--compact">
            {s.distribucion.map((d) => (
              <li key={d.banda} className="rank__row">
                <span className="rank__label">{d.etiqueta}</span>
                <span className="rank__bar" aria-hidden="true">{d.n > 0 && <span style={{ width: `${(d.n / maxDist) * 100}%` }} />}</span>
                <span className="rank__value">{formatNum(d.n)}<span className="sr-only"> sesiones</span></span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

export default Calidad
