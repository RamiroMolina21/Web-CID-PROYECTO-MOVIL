import React from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import Hint from '../../components/ui/Hint'
import { Meter } from './DashPanel'
import { formatNum, formatRatio } from './metricas'

/** Variación frente al periodo anterior. Neutra: más sesiones no es "bueno" ni "malo" por sí solo. */
const Delta = ({ actual, anterior, periodo }) => {
  const diff = actual - anterior
  return (
    <span className="kpi-card__delta" title={`${formatNum(anterior)} ${periodo}`}>
      <Icon name={diff > 0 ? 'trendUp' : diff < 0 ? 'trendDown' : 'minus'} size={14} />
      {diff === 0 ? 'Igual que' : `${diff > 0 ? '+' : '−'}${formatNum(Math.abs(diff))} vs.`} {periodo}
    </span>
  )
}

/**
 * Tarjeta KPI compacta: icono, valor, una línea de contexto y, si aplica, comparación o medidor.
 * `to` la hace clicable (navegación al módulo donde se gestiona). `tone`: neutral | alert | ok.
 */
const KpiCard = ({ icon, label, value, unit, context, extra, hint, to, tone = 'neutral' }) => {
  // Enlace interno de la página (#ancla) o navegación a un módulo
  const Tag = !to ? 'div' : to.startsWith('#') ? 'a' : Link
  const props = !to ? {} : to.startsWith('#') ? { href: to } : { to }
  return (
    <li className={`kpi-card kpi-card--${tone}`}>
      <Tag className="kpi-card__inner" {...props}>
        <span className="kpi-card__top">
          <span className="kpi-card__icon" aria-hidden="true"><Icon name={icon} size={16} /></span>
          <span className="kpi-card__label">{label}</span>
        </span>
        <span className="kpi-card__value">
          {value}
          {unit && <span className="kpi-card__unit"> {unit}</span>}
        </span>
        <span className="kpi-card__context">{context}</span>
        {extra}
        {to && <Icon name="chevronRight" size={16} className="kpi-card__go" />}
      </Tag>
      {hint && <Hint label={label}>{hint}</Hint>}
    </li>
  )
}

/** Nivel 1: estado general en 5 cifras. Cálculos en metricas.calcularKpis (sin cambios de significado). */
const Kpis = ({ kpis }) => {
  const { vencidas, proximas7, realizadas30, cierre, ocupacion } = kpis
  return (
    <ul className="kpi-strip" aria-label="Indicadores principales">
      <KpiCard
        icon="calendar"
        label="Programadas · 7 días"
        value={formatNum(proximas7.valor)}
        context={`${formatNum(proximas7.inscritos)} ${proximas7.inscritos === 1 ? 'estudiante inscrito' : 'estudiantes inscritos'}`}
        extra={<Delta actual={proximas7.valor} anterior={proximas7.anterior} periodo="7 días previos" />}
        hint="Tutorías pendientes cuya sesión es hoy o en los próximos 7 días, comparadas con las sesiones no canceladas de los 7 días anteriores."
        to="/horarios"
      />
      <KpiCard
        icon="checkCircle"
        label="Finalizadas · 30 días"
        value={formatNum(realizadas30.valor)}
        context="Por fecha de la sesión"
        extra={<Delta actual={realizadas30.valor} anterior={realizadas30.anterior} periodo="30 días previos" />}
        hint="Tutorías finalizadas cuya sesión fue en los últimos 30 días, frente a los 30 días anteriores."
        to="/tutorias-finalizadas"
      />
      <KpiCard
        icon="alert"
        label="Vencidas sin cerrar"
        value={formatNum(vencidas.valor)}
        tone={vencidas.valor > 0 ? 'alert' : 'ok'}
        context={vencidas.valor === 0 ? 'Todas las sesiones pasadas están cerradas' : vencidas.masDe7Dias > 0 ? `${formatNum(vencidas.masDe7Dias)} hace más de 7 días` : 'Pendientes de finalizar'}
        hint="Tutorías en estado pendiente cuya sesión ya terminó: falta finalizarlas (calificación y encuestas)."
        to="#atencion"
      />
      <KpiCard
        icon="trendUp"
        label="Tasa de cierre"
        value={formatRatio(cierre.ratio)}
        context={cierre.ocurridas ? `${formatNum(cierre.cerradas)} de ${formatNum(cierre.ocurridas)} sesiones pasadas` : 'Aún no hay sesiones pasadas'}
        extra={<Meter ratio={cierre.ratio} />}
        hint="De las sesiones ya ocurridas (sin contar canceladas), qué parte se finalizó."
      />
      <KpiCard
        icon="users"
        label="Ocupación de cupos"
        value={formatRatio(ocupacion.ratio)}
        context={
          ocupacion.cupos
            ? `${formatNum(ocupacion.inscritos)} de ${formatNum(ocupacion.cupos)} cupos · ${formatNum(ocupacion.futuras)} próximas`
            : ocupacion.futuras ? 'Las próximas no tienen cupo definido' : 'No hay tutorías próximas'
        }
        extra={<Meter ratio={ocupacion.ratio} />}
        hint={
          [
            'Estudiantes inscritos frente a cupos en las tutorías pendientes por venir con cupo definido.',
            ocupacion.llenas ? `${formatNum(ocupacion.llenas)} llenas.` : null,
            ocupacion.vacias ? `${formatNum(ocupacion.vacias)} sin estudiantes.` : null,
          ].filter(Boolean).join(' ')
        }
      />
    </ul>
  )
}

export default Kpis
