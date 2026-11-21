import React, { useId, useState } from 'react'
import Icon from '../../components/ui/Icon'
import Hint from '../../components/ui/Hint'
import { BlockError, Meter, PanelSkeleton } from './DashPanel'
import { formatNota, formatNum, formatPct } from './metricas'

const MUESTRA_MINIMA = 5

/** Indicador compacto: título, valor con escala, medidor y una línea de base; aviso de muestra pequeña si aplica. */
const Medida = ({ titulo, valor, escala = '/5', ratio, base, aviso, hint }) => (
  <div className="q-tile">
    <div className="q-tile__head">
      <h3 className="q-tile__title">{titulo}</h3>
      {hint && <Hint label={titulo}>{hint}</Hint>}
    </div>
    <p className="q-tile__value">
      {valor}
      {escala && valor !== '—' && <span className="q-tile__scale">{escala}</span>}
    </p>
    <Meter ratio={ratio} tone="blue" />
    <p className="q-tile__base">{base}</p>
    {aviso && (
      <p className="q-tile__warn">
        <Icon name="alert" size={14} />
        {aviso}
      </p>
    )}
  </div>
)

/**
 * Nivel 3: calidad del servicio (histórico completo). Cálculos sin cambios:
 * sesiones = calcularCalidadSesiones(GET /Retroalimentacion); encuestas = GET /Encuesta/estadisticas.
 */
const Calidad = ({ sesiones, encuestas }) => {
  const [distribucion, setDistribucion] = useState(false)
  const distId = useId()
  const s = sesiones.data
  const e = encuestas.data
  const hayComparacion = s?.promedio != null && e?.totalRespondidas > 0
  const diff = hayComparacion ? e.promedioCalificacion - s.promedio : null
  const maxDist = s ? Math.max(1, ...s.distribucion.map((d) => d.n)) : 1
  const comparacion = hayComparacion
    ? Math.abs(diff) < 0.05
      ? 'Estudiantes y docentes valoran las sesiones de forma parecida.'
      : `Los estudiantes puntúan ${formatNota(Math.abs(diff))} ${diff > 0 ? 'por encima' : 'por debajo'} de la calificación que registran docentes y tutores.`
    : null

  return (
    <div className="quality">
      <div className="q-tiles">
        {sesiones.status === 'loading' && <PanelSkeleton />}
        {sesiones.status === 'error' && <BlockError compact error={sesiones.error} onRetry={sesiones.retry} />}
        {sesiones.status === 'ready' && (
          <Medida
            titulo="Calificación de las sesiones"
            valor={formatNota(s.promedio)}
            ratio={s.promedio ? s.promedio / 5 : 0}
            base={s.n ? `${formatNum(s.n)} calificaciones` : 'Sin calificaciones aún'}
            hint="Media de las calificaciones que registran docentes y tutores al finalizar cada sesión."
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
              base={e.totalRespondidas ? `${formatNum(e.totalRespondidas)} ${e.totalRespondidas === 1 ? 'encuesta' : 'encuestas'}` : 'Sin respuestas aún'}
              aviso={
                e.totalRespondidas > 0 && e.totalRespondidas < MUESTRA_MINIMA
                  ? `Muestra pequeña: ${formatNum(e.totalRespondidas)} ${e.totalRespondidas === 1 ? 'respuesta' : 'respuestas'}, tómalo como indicio.`
                  : null
              }
              hint={['Media de las encuestas de satisfacción respondidas por los estudiantes.', comparacion].filter(Boolean).join(' ')}
            />
            <Medida
              titulo="Tasa de respuesta"
              valor={formatPct(e.tasaRespuesta || 0)}
              escala={null}
              ratio={(e.tasaRespuesta || 0) / 100}
              base={`${formatNum(e.totalRespondidas || 0)} de ${formatNum(e.totalEnviadas || 0)} enviadas`}
              hint="Encuestas respondidas frente a encuestas enviadas al finalizar las tutorías."
            />
          </>
        )}
      </div>

      {sesiones.status === 'ready' && s.n > 0 && (
        <div className="q-dist">
          <button type="button" className="att-history__toggle" aria-expanded={distribucion} aria-controls={distId} onClick={() => setDistribucion((v) => !v)}>
            Distribución de calificaciones de las sesiones
            <Icon name="chevronDown" size={14} className={distribucion ? 'is-flipped' : ''} />
          </button>
          <ol id={distId} className="rank rank--compact" hidden={!distribucion}>
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
