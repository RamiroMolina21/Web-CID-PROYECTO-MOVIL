import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTheme } from '../../context/ThemeContext'
import Hint from '../../components/ui/Hint'
import { formatNum } from './metricas'

// Paleta validada con dataviz/validate_palette.js (CVD, banda de luminosidad y contraste ≥3:1 sobre la tarjeta).
// Mismo significado que los badges de estado: finalizada (verde azulado), pendiente (ámbar), cancelada (neutro).
const PALETA = {
  light: { finalizada: '#0d9488', pendiente: '#d97706', cancelada: '#64748b', grid: '#eef0f3', tick: '#6b7280', cursor: 'rgba(17,24,39,0.05)', surface: '#ffffff' },
  dark: { finalizada: '#0f9f8c', pendiente: '#c98500', cancelada: '#94a3b8', grid: '#334155', tick: '#94a3b8', cursor: 'rgba(241,245,249,0.06)', surface: '#1e293b' },
}

export const SERIES = [
  { key: 'finalizada', label: 'Finalizadas' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'cancelada', label: 'Canceladas' },
]
const ORDEN = SERIES.map((s) => s.key) // de abajo arriba

/** Segmento apilado: separación de 2 px con el de abajo y extremo redondeado solo en el segmento superior. */
const segmento = (key, surface) => (props) => {
  const { x, y, width, payload, fill } = props
  let { height } = props
  if (!height || height <= 0 || !payload) return null
  const i = ORDEN.indexOf(key)
  const hayDebajo = ORDEN.slice(0, i).some((k) => payload[k] > 0)
  const esTope = !ORDEN.slice(i + 1).some((k) => payload[k] > 0)
  if (hayDebajo) height = Math.max(1, height - 2)
  const r = esTope ? Math.min(4, width / 2, height) : 0
  const d = `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`
  return <path d={d} fill={fill} stroke={surface} strokeWidth={0} />
}

const TooltipMes = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const m = payload[0].payload
  return (
    <div className="viz-tooltip">
      <p className="viz-tooltip__title">{m.etiquetaLarga}</p>
      <ul>
        {SERIES.map((s) => (
          <li key={s.key}>
            <span className={`viz-swatch viz-swatch--${s.key}`} aria-hidden="true" />
            <span>{s.label}</span>
            <strong>{formatNum(m[s.key])}</strong>
          </li>
        ))}
      </ul>
      <p className="viz-tooltip__total">Total <strong>{formatNum(m.total)}</strong></p>
    </div>
  )
}

const Tendencia = ({ tendencia }) => {
  const { isDark } = useTheme()
  const [vista, setVista] = useState('grafica')
  const c = PALETA[isDark ? 'dark' : 'light']
  const { meses, total, pico, otros } = tendencia
  const totales = SERIES.map((s) => ({ ...s, n: meses.reduce((acc, m) => acc + m[s.key], 0) }))

  return (
    <div className="trend">
      <div className="trend__bar">
        <ul className="viz-legend" aria-label="Leyenda">
          {totales.map((s) => (
            <li key={s.key}>
              <span className={`viz-swatch viz-swatch--${s.key}`} aria-hidden="true" />
              {s.label} <strong>{formatNum(s.n)}</strong>
            </li>
          ))}
        </ul>
        <span className="trend__tools">
        <Hint label="Actividad de tutorías">
          {total === 0
            ? 'No hubo tutorías en los últimos 12 meses.'
            : `${formatNum(total)} tutorías en los últimos 12 meses. Mes con más actividad: ${pico.etiquetaLarga} (${formatNum(pico.total)}).`}
        </Hint>
        <div className="segmented segmented--sm" role="group" aria-label="Vista de la actividad mensual">
          <button type="button" aria-pressed={vista === 'grafica'} onClick={() => setVista('grafica')}>Gráfica</button>
          <button type="button" aria-pressed={vista === 'tabla'} onClick={() => setVista('tabla')}>Tabla</button>
        </div>
        </span>
      </div>



      {vista === 'grafica' ? (
        <div className="trend__chart" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={meses} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%" accessibilityLayer={false}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="etiqueta" tickLine={false} axisLine={{ stroke: c.grid }} tick={{ fontSize: 12, fill: c.tick }} interval={0} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: c.tick }} width={28} />
              <Tooltip content={<TooltipMes />} cursor={{ fill: c.cursor }} isAnimationActive={false} />
              {SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} stackId="estado" fill={c[s.key]} maxBarSize={28}
                  shape={segmento(s.key, c.surface)} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="viz-table-wrap" tabIndex={0} role="region" aria-label="Tabla de actividad mensual">
          <table className="viz-table">
            <caption className="sr-only">Tutorías por mes de la sesión y estado, últimos 12 meses</caption>
            <thead>
              <tr>
                <th scope="col">Mes</th>
                {SERIES.map((s) => <th key={s.key} scope="col">{s.label}</th>)}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.clave}>
                  <th scope="row">{m.etiquetaLarga}</th>
                  {SERIES.map((s) => <td key={s.key}>{formatNum(m[s.key])}</td>)}
                  <td><strong>{formatNum(m.total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {otros > 0 && (
        <p className="trend__note">{formatNum(otros)} con un estado no reconocido no se incluyen.</p>
      )}
    </div>
  )
}

export default Tendencia
