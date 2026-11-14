import React from 'react'
import Icon from '../../components/ui/Icon'
import { Meter } from './DashPanel'
import { formatNum, formatRatio } from './metricas'

/** Comparación con el periodo anterior. Neutra en color: más sesiones no es "bueno" ni "malo" por sí solo. */
const Delta = ({ actual, anterior, periodo }) => {
  const diff = actual - anterior
  const icon = diff > 0 ? 'trendUp' : diff < 0 ? 'trendDown' : 'minus'
  const texto =
    diff === 0
      ? `Igual que ${periodo} (${formatNum(anterior)})`
      : `${diff > 0 ? '+' : '−'}${formatNum(Math.abs(diff))} frente a ${periodo} (${formatNum(anterior)})`
  return (
    <span className="kpi__delta">
      <Icon name={icon} size={16} />
      {texto}
    </span>
  )
}

const plural = (n, uno, varios) => `${formatNum(n)} ${n === 1 ? uno : varios}`

const Indicadores = ({ kpis }) => {
  const { proximas7, realizadas30, cierre, ocupacion } = kpis
  return (
    <dl className="kpis">
      <div className="kpi">
        <dt className="kpi__label">Próximos 7 días</dt>
        <dd className="kpi__value">
          {formatNum(proximas7.valor)} <span className="kpi__unit">{proximas7.valor === 1 ? 'tutoría' : 'tutorías'}</span>
        </dd>
        <dd className="kpi__context">
          {plural(proximas7.inscritos, 'estudiante inscrito', 'estudiantes inscritos')}
        </dd>
        <dd className="kpi__context"><Delta actual={proximas7.valor} anterior={proximas7.anterior} periodo="los 7 días anteriores" /></dd>
      </div>

      <div className="kpi">
        <dt className="kpi__label">Realizadas en 30 días</dt>
        <dd className="kpi__value">
          {formatNum(realizadas30.valor)} <span className="kpi__unit">{realizadas30.valor === 1 ? 'finalizada' : 'finalizadas'}</span>
        </dd>
        <dd className="kpi__context">Por fecha de la sesión</dd>
        <dd className="kpi__context"><Delta actual={realizadas30.valor} anterior={realizadas30.anterior} periodo="los 30 días previos" /></dd>
      </div>

      <div className="kpi">
        <dt className="kpi__label">Tasa de cierre</dt>
        <dd className="kpi__value">{formatRatio(cierre.ratio)}</dd>
        <dd className="kpi__meter"><Meter ratio={cierre.ratio} /></dd>
        <dd className="kpi__context">
          {cierre.ocurridas
            ? `${formatNum(cierre.cerradas)} de ${formatNum(cierre.ocurridas)} sesiones pasadas finalizadas`
            : 'Aún no hay sesiones pasadas'}
          {cierre.sinCerrar > 0 && <strong className="kpi__warn"> · {plural(cierre.sinCerrar, 'sin cerrar', 'sin cerrar')}</strong>}
        </dd>
      </div>

      <div className="kpi">
        <dt className="kpi__label">Ocupación de cupos</dt>
        <dd className="kpi__value">{formatRatio(ocupacion.ratio)}</dd>
        <dd className="kpi__meter"><Meter ratio={ocupacion.ratio} /></dd>
        <dd className="kpi__context">
          {ocupacion.cupos
            ? `${formatNum(ocupacion.inscritos)} de ${formatNum(ocupacion.cupos)} cupos en ${plural(ocupacion.futuras, 'tutoría próxima', 'tutorías próximas')}`
            : ocupacion.futuras
              ? 'Las tutorías próximas no tienen cupo definido'
              : 'No hay tutorías próximas'}
        </dd>
        {(ocupacion.llenas > 0 || ocupacion.vacias > 0) && (
          <dd className="kpi__context">
            {[ocupacion.llenas ? plural(ocupacion.llenas, 'llena', 'llenas') : null, ocupacion.vacias ? plural(ocupacion.vacias, 'sin estudiantes', 'sin estudiantes') : null]
              .filter(Boolean)
              .join(' · ')}
          </dd>
        )}
      </div>
    </dl>
  )
}

export default Indicadores
