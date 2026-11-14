import React from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import { ApiError, getErrorMessage } from '../../lib/apiClient'
import { grupoEstadoTutoria, ETIQUETA_GRUPO } from '../../lib/estados'

export const PageHeader = ({ title, subtitle, actions, back, meta }) => (
  <header className="page-head">
    {back && (
      <Link to={back.to} className="page-head__back">
        <Icon name="arrowLeft" size={18} />
        <span>{back.label}</span>
      </Link>
    )}
    <div className="page-head__row">
      <div className="page-head__text">
        <h1 tabIndex={-1} data-page-title>{title}</h1>
        {subtitle && <p className="page-head__subtitle">{subtitle}</p>}
      </div>
      {(actions || meta) && (
        <div className="page-head__actions">
          {meta}
          {actions}
        </div>
      )}
    </div>
  </header>
)

export const LoadingState = ({ label = 'Cargando…', rows = 3, variant = 'list' }) => (
  <div className={`skeleton-group skeleton-group--${variant}`} aria-busy="true" aria-live="polite">
    <span className="sr-only">{label}</span>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="skeleton-card" aria-hidden="true">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--line" />
        <div className="skeleton skeleton--line skeleton--short" />
      </div>
    ))}
  </div>
)

export const EmptyState = ({ icon = 'calendar', title, children, action }) => (
  <div className="state-panel">
    <span className="state-panel__icon"><Icon name={icon} size={28} /></span>
    <h2 className="state-panel__title">{title}</h2>
    {children && <p className="state-panel__text">{children}</p>}
    {action && <div className="state-panel__action">{action}</div>}
  </div>
)

export const ErrorState = ({ error, onRetry, title }) => {
  const status = error instanceof ApiError ? error.status : null
  const variant = status === 403 ? 'forbidden' : status === 0 ? 'offline' : status === 404 ? 'notfound' : 'error'
  const defaults = {
    forbidden: { icon: 'lock', title: 'No tienes acceso a esta información' },
    offline: { icon: 'wifiOff', title: 'Sin conexión con el servidor' },
    notfound: { icon: 'info', title: 'No encontramos lo que buscas' },
    error: { icon: 'alert', title: 'No se pudo cargar la información' },
  }[variant]

  return (
    <div className={`state-panel state-panel--${variant}`} role="alert">
      <span className="state-panel__icon"><Icon name={defaults.icon} size={28} /></span>
      <h2 className="state-panel__title">{title || defaults.title}</h2>
      <p className="state-panel__text">{getErrorMessage(error)}</p>
      {onRetry && variant !== 'forbidden' && variant !== 'notfound' && (
        <div className="state-panel__action">
          <button type="button" className="btn btn--secondary" onClick={onRetry}>
            <Icon name="refresh" size={18} /> Reintentar
          </button>
        </div>
      )}
    </div>
  )
}

export const StatusBadge = ({ estado }) => {
  const grupo = grupoEstadoTutoria(estado)
  return (
    <span className={`estado-badge estado-badge--${grupo}`}>
      <span className="estado-badge__dot" aria-hidden="true" />
      {grupo === 'otro' && estado ? estado : ETIQUETA_GRUPO[grupo]}
    </span>
  )
}

export const Spinner = ({ label }) => (
  <span className="spinner" role={label ? 'status' : undefined} aria-label={label}>
    <span aria-hidden="true" />
  </span>
)
