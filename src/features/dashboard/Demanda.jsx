import React, { useMemo, useState } from 'react'
import Hint from '../../components/ui/Hint'
import { agruparPor, formatNum, formatRatio } from './metricas'

const DIMENSIONES = [
  { id: 'idioma', label: 'Idioma' },
  { id: 'nivel', label: 'Nivel' },
  { id: 'modalidad', label: 'Modalidad' },
]
const TOP = 5

/** Demanda: top 5 + "Otros" en barras horizontales de una sola tinta, con cantidad y porcentaje. */
const Demanda = ({ tutorias }) => {
  const [dim, setDim] = useState('idioma')
  const { filas, total } = useMemo(() => agruparPor(tutorias, dim, TOP), [tutorias, dim])
  const max = Math.max(1, ...filas.map((f) => f.n))
  const dimLabel = DIMENSIONES.find((d) => d.id === dim).label.toLowerCase()

  return (
    <div className="demand">
      <div className="demand__bar">
        <div className="segmented segmented--sm" role="group" aria-label="Agrupar la demanda por">
          {DIMENSIONES.map((d) => (
            <button key={d.id} type="button" aria-pressed={dim === d.id} onClick={() => setDim(d.id)}>{d.label}</button>
          ))}
        </div>
        <Hint label="Demanda">Las variantes de escritura («Inglés», «ingles») se cuentan juntas. Los valores menos frecuentes se agrupan en «Otros».</Hint>
      </div>

      {total === 0 ? (
        <p className="dash-empty">No hay tutorías en este periodo.</p>
      ) : (
        <ol className="rank" aria-label={`Tutorías por ${dimLabel}`}>
          {filas.map((f) => (
            <li key={f.clave} className={`rank__row${f.clave === '__otros' ? ' rank__row--other' : ''}`} title={f.detalle || undefined}>
              <span className="rank__label">{f.etiqueta}</span>
              <span className="rank__bar" aria-hidden="true">{f.n > 0 && <span style={{ width: `${(f.n / max) * 100}%` }} />}</span>
              <span className="rank__value">
                {formatNum(f.n)}<span className="sr-only"> tutorías,</span> <small>{formatRatio(f.share)}</small>
                {f.detalle && <span className="sr-only">: {f.detalle}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default Demanda
