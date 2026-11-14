import React, { useMemo, useState } from 'react'
import { agruparPor, formatNum, formatRatio } from './metricas'

const DIMENSIONES = [
  { id: 'idioma', label: 'Idioma' },
  { id: 'nivel', label: 'Nivel' },
  { id: 'modalidad', label: 'Modalidad' },
]

/** Barras ordenadas (una sola tinta): compara la demanda entre valores de una dimensión. */
const Demanda = ({ tutorias }) => {
  const [dim, setDim] = useState('idioma')
  const { filas, total } = useMemo(() => agruparPor(tutorias, dim), [tutorias, dim])
  const max = Math.max(1, ...filas.map((f) => f.n))
  const otros = filas.find((f) => f.clave === '__otros')
  const dimLabel = DIMENSIONES.find((d) => d.id === dim).label.toLowerCase()

  return (
    <div className="demand">
      <div className="segmented segmented--sm" role="group" aria-label="Agrupar la demanda por">
        {DIMENSIONES.map((d) => (
          <button key={d.id} type="button" aria-pressed={dim === d.id} onClick={() => setDim(d.id)}>{d.label}</button>
        ))}
      </div>

      {total === 0 ? (
        <p className="dash-empty">No hay tutorías en este periodo.</p>
      ) : (
        <>
          <ol className="rank" aria-label={`Tutorías por ${dimLabel}`}>
            {filas.map((f) => (
              <li key={f.clave} className={`rank__row${f.clave === '__otros' ? ' rank__row--other' : ''}`}>
                <span className="rank__label">{f.etiqueta}</span>
                <span className="rank__bar" aria-hidden="true">{f.n > 0 && <span style={{ width: `${(f.n / max) * 100}%` }} />}</span>
                <span className="rank__value">
                  {formatNum(f.n)}<span className="sr-only"> tutorías,</span> <small>{formatRatio(f.share)}</small>
                </span>
              </li>
            ))}
          </ol>
          {otros && <p className="demand__note">Otros: {otros.detalle}.</p>}
          <p className="demand__note">Las variantes de escritura («Inglés», «ingles») se cuentan juntas.</p>
        </>
      )}
    </div>
  )
}

export default Demanda
