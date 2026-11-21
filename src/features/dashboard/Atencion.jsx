import React, { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import Hint from '../../components/ui/Hint'
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

const DetalleTutoria = ({ t, accion }) => (
  <li className="att-detail__row">
    <span className="att-detail__when">
      {formatFecha(t.fecha)} <span className="att-detail__time">{t.horaInicio || formatHora(t.inicio)}</span>
    </span>
    <span className="att-detail__what">
      <strong>{[t.idioma, t.nivel].filter(Boolean).join(' · ') || 'Tutoría'}</strong>
      <span className="att-detail__who">{nombreAsignado(t)}</span>
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

/** Una fila compacta por asunto: icono, número, título y acciones; descripción en el tooltip y detalle desplegable. */
const ItemAtencion = ({ item, onAtender, ocupado }) => {
  // Plegado por defecto: el número y el título bastan para priorizar; el detalle, bajo demanda
  const [abierto, setAbierto] = useState(false)
  const detalleId = useId()
  const sev = SEVERIDAD[item.severity]
  const lista = item.items || []

  return (
    <li className={`att-item att-item--${item.severity}`} data-tipo={item.tipo}>
      <div className="att-item__main">
        <span className="att-item__icon" aria-hidden="true"><Icon name={sev.icon} size={16} /></span>
        <span className="att-item__count">{formatNum(item.count)}</span>
        <h3 className="att-item__title">
          <span className="sr-only">{sev.label}: {formatNum(item.count)} </span>
          {item.title}
        </h3>
        <Hint label={item.title}>{item.text}</Hint>
        <div className="att-item__actions">
          {lista.length > 0 && (
            <button
              type="button"
              className="att-item__toggle"
              aria-expanded={abierto}
              aria-controls={detalleId}
              onClick={() => setAbierto((v) => !v)}
            >
              {abierto ? 'Ocultar' : 'Ver detalle'}
              <Icon name="chevronDown" size={14} className={abierto ? 'is-flipped' : ''} />
            </button>
          )}
          {item.action && (
            <Link className="att-item__link" to={item.action.to}>{item.action.label}</Link>
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
 * activos: asuntos con claves sin atender (por severidad); atendidos: ya marcados (con deshacer);
 * enOrden: comprobaciones sin casos. fallos: fuentes que no se pudieron revisar ({ nombre, error, onRetry }).
 * El historial (atendidos y comprobaciones en orden) queda en un panel secundario plegado.
 */
const Atencion = ({ activos, atendidos = [], enOrden, fallos = [], onAtender, onDeshacer, ocupado }) => {
  const [historial, setHistorial] = useState(false)
  const historialId = useId()
  const hayHistorial = atendidos.length > 0 || enOrden.length > 0

  return (
    <>
      {activos.length === 0 ? (
        <p className="att-clear">
          <Icon name="checkCircle" size={18} />
          {atendidos.length ? 'Todo en orden: lo pendiente ya se marcó como atendido.' : 'Todo en orden: nada requiere atención.'}
        </p>
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

      {hayHistorial && (
        <div className="att-history">
          <button
            type="button"
            className="att-history__toggle"
            aria-expanded={historial}
            aria-controls={historialId}
            onClick={() => setHistorial((v) => !v)}
          >
            <Icon name="history" size={14} />
            Atendidos ({formatNum(atendidos.length)}) · Sin pendientes ({formatNum(enOrden.length)})
            <Icon name="chevronDown" size={14} className={historial ? 'is-flipped' : ''} />
          </button>
          <div id={historialId} hidden={!historial}>
            {atendidos.length > 0 && (
              <ul className="att-done__list">
                {atendidos.map((a) => (
                  <li key={a.id} className="att-done__item" data-tipo={a.tipo}>
                    <Icon name="checkCircle" size={16} className="att-done__icon" />
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
            )}
            {enOrden.length > 0 && (
              <ul className="att-ok__list">
                {enOrden.map((i) => (
                  <li key={i.id}><Icon name="check" size={14} />{i.okText}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default Atencion
