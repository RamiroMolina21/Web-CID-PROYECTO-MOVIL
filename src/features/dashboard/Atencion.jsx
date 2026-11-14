import React, { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import { formatFecha, formatHora } from '../../lib/fechas'
import { ETIQUETA_ELIMINADO, nombreAsignado } from '../../lib/usuarios'
import { BlockError } from './DashPanel'
import { formatNum } from './metricas'

const SEVERIDAD = {
  alta: { icon: 'alert', label: 'Prioridad alta' },
  media: { icon: 'clock', label: 'Revisar pronto' },
  info: { icon: 'info', label: 'Para revisar' },
}

const MAX_DETALLE = 5
const fechaHoraLocal = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const nombreDocente = (t) => nombreAsignado(t)

const DetalleTutoria = ({ t, accion }) => (
  <li className="att-detail__row">
    <span className="att-detail__when">
      {formatFecha(t.fecha)} <span className="att-detail__time">{t.horaInicio || formatHora(t.inicio)}</span>
    </span>
    <span className="att-detail__what">
      <strong>{[t.idioma, t.nivel].filter(Boolean).join(' · ') || 'Tutoría'}</strong>
      <span className="att-detail__who">{nombreDocente(t)}</span>
    </span>
    {accion && (
      <Link className="att-detail__action" to={accion.to}>
        {accion.label}
        <span className="sr-only">: {t.idioma} {t.nivel} del {formatFecha(t.fecha)}</span>
      </Link>
    )}
  </li>
)

const DetalleHorario = ({ h }) => (
  <li className="att-detail__row">
    <span className="att-detail__when">
      {formatFecha(h.fecha)} <span className="att-detail__time">{h.horaInicio}</span>
    </span>
    <span className="att-detail__what">
      <strong>{h.titulo || 'Horario'}</strong>
      <span className="att-detail__who">
        {h.sinDueno ? ETIQUETA_ELIMINADO : [h.docenteNombre, h.docenteApellidos].filter((x) => x && x !== 'N/A').join(' ') || 'Sin responsable'}
      </span>
    </span>
  </li>
)

const DetalleEncuesta = ({ e }) => (
  <li className="att-detail__row">
    <span className="att-detail__when">
      {formatFecha(e.fechaHora)} <span className="att-detail__time">{formatHora(e.fechaHora)}</span>
    </span>
    <span className="att-detail__what">
      <strong>{e.tema || `Tutoría ${e.tutoriaId}`}</strong>
      <span className="att-detail__who">{formatNum(e.sinResponder)} de {formatNum(e.enviadas)} sin responder</span>
    </span>
  </li>
)

const Detalle = ({ item, x }) =>
  item.detalle === 'horarios' ? <DetalleHorario h={x} />
    : item.detalle === 'encuestas' ? <DetalleEncuesta e={x} />
      : <DetalleTutoria t={x} accion={item.itemAction?.(x)} />

const ItemAtencion = ({ item, onAtender, ocupado }) => {
  const [abierto, setAbierto] = useState(item.severity === 'alta')
  const detalleId = useId()
  const sev = SEVERIDAD[item.severity]
  const lista = item.items || []

  return (
    <li className={`att-item att-item--${item.severity}`} data-tipo={item.tipo}>
      <div className="att-item__main">
        <span className="att-item__icon" aria-hidden="true"><Icon name={sev.icon} size={18} /></span>
        <span className="att-item__count">{formatNum(item.count)}</span>
        <div className="att-item__text">
          <h3 className="att-item__title">
            <span className="sr-only">{sev.label}: {formatNum(item.count)} </span>
            {item.title}
          </h3>
          <p className="att-item__desc">{item.text}</p>
          <span className="att-item__sev">{sev.label}</span>
        </div>
        <div className="att-item__actions">
          {lista.length > 0 && (
            <button
              type="button"
              className="btn btn--ghost btn--sm att-item__toggle"
              aria-expanded={abierto}
              aria-controls={detalleId}
              onClick={() => setAbierto((v) => !v)}
            >
              {abierto ? 'Ocultar' : 'Ver detalle'}
              <Icon name="chevronDown" size={16} className={abierto ? 'is-flipped' : ''} />
            </button>
          )}
          {item.action && (
            <Link className="btn btn--secondary btn--sm" to={item.action.to}>
              {item.action.label}
            </Link>
          )}
          {!item.sinAtendido && (
            <button type="button" className="btn-atendido" onClick={() => onAtender(item)} disabled={ocupado}>
              <Icon name="check" size={14} strokeWidth={2.25} />
              Atendido<span className="sr-only">: {item.title}</span>
            </button>
          )}
        </div>
      </div>
      {lista.length > 0 && (
        <div id={detalleId} className="att-detail" hidden={!abierto}>
          <ul className="att-detail__list">
            {lista.slice(0, MAX_DETALLE).map((x) => <Detalle key={x.id} item={item} x={x} />)}
          </ul>
          {lista.length > MAX_DETALLE && <p className="att-detail__more">Y {formatNum(lista.length - MAX_DETALLE)} más.</p>}
        </div>
      )}
    </li>
  )
}

/**
 * activos: asuntos con claves sin atender (ordenados por severidad); atendidos: asuntos ya marcados;
 * enOrden: comprobaciones sin casos. fallos: fuentes que no se pudieron revisar ({ nombre, error, onRetry }).
 */
const Atencion = ({ activos, atendidos = [], enOrden, fallos = [], onAtender, onDeshacer, ocupado }) => (
  <>
    {activos.length === 0 ? (
      <div className="att-clear">
        <span className="att-clear__icon" aria-hidden="true"><Icon name="checkCircle" size={24} /></span>
        <div>
          <p className="att-clear__title">Todo en orden</p>
          <p className="att-clear__text">
            {atendidos.length ? 'Los asuntos pendientes ya se marcaron como atendidos.' : 'No hay asuntos pendientes en tutorías, horarios ni encuestas.'}
          </p>
        </div>
      </div>
    ) : (
      <ul className="att-list">
        {activos.map((item) => <ItemAtencion key={item.id} item={item} onAtender={onAtender} ocupado={ocupado === item.tipo} />)}
      </ul>
    )}

    {fallos.map((f) => (
      <div key={f.nombre} className="att-fail">
        <p className="att-fail__label">No se pudo revisar: {f.nombre}</p>
        <BlockError compact error={f.error} onRetry={f.onRetry} />
      </div>
    ))}

    {atendidos.length > 0 && (
      <div className="att-done">
        <h3 className="att-ok__title">Atendidos</h3>
        <ul className="att-done__list">
          {atendidos.map((a) => (
            <li key={a.id} className="att-done__item" data-tipo={a.tipo}>
              <Icon name="checkCircle" size={18} className="att-done__icon" />
              <div className="att-done__text">
                <p className="att-done__title">{formatNum(a.count)} · {a.title}</p>
                {a.marca && (
                  <p className="att-done__meta">
                    {a.marca.usuarioId === null || !a.marca.usuarioNombre ? 'Atendido por un usuario eliminado' : `Atendido por ${a.marca.usuarioNombre}`} · {fechaHoraLocal.format(new Date(a.marca.fecha))}
                  </p>
                )}
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => onDeshacer(a)} disabled={ocupado === a.tipo}>
                Deshacer<span className="sr-only">: {a.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )}

    {enOrden.length > 0 && (activos.length > 0 || atendidos.length > 0) && (
      <div className="att-ok">
        <h3 className="att-ok__title">Sin pendientes</h3>
        <ul className="att-ok__list">
          {enOrden.map((i) => (
            <li key={i.id}>
              <Icon name="check" size={16} />
              {i.okText}
            </li>
          ))}
        </ul>
      </div>
    )}
  </>
)

export default Atencion
