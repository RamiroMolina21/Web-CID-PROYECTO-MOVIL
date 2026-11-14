import React, { useId } from 'react'
import Icon from '../../components/ui/Icon'
import { getErrorMessage } from '../../lib/apiClient'

/**
 * Bloque del Dashboard con estados propios: un bloque que falla no rompe el resto.
 * status: 'loading' | 'error' | 'ready'
 */
const DashPanel = ({ title, subtitle, actions, status = 'ready', error, onRetry, skeleton = 'list', className = '', children, footer, headingLevel = 2 }) => {
  const id = useId()
  const Heading = `h${headingLevel}`
  return (
    <section className={`dash-panel ${className}`.trim()} aria-labelledby={`${id}-t`} aria-busy={status === 'loading' || undefined}>
      <header className="dash-panel__head">
        <div className="dash-panel__heading">
          <Heading id={`${id}-t`} className="dash-panel__title">{title}</Heading>
          {subtitle && <p className="dash-panel__subtitle">{subtitle}</p>}
        </div>
        {actions && status === 'ready' && <div className="dash-panel__actions">{actions}</div>}
      </header>
      <div className="dash-panel__body">
        {status === 'loading' && <PanelSkeleton variant={skeleton} />}
        {status === 'error' && <BlockError error={error} onRetry={onRetry} />}
        {status === 'ready' && children}
      </div>
      {footer && status === 'ready' && <footer className="dash-panel__foot">{footer}</footer>}
    </section>
  )
}

export const PanelSkeleton = ({ variant = 'list' }) => (
  <div className={`dash-skel dash-skel--${variant}`} aria-hidden="true">
    {variant === 'chart' ? (
      <div className="dash-skel__chart">
        {[40, 65, 30, 80, 55, 70, 45, 90, 60, 35, 75, 50].map((h, i) => (
          <span key={i} className="skeleton" style={{ height: `${h}%` }} />
        ))}
      </div>
    ) : (
      Array.from({ length: variant === 'kpi' ? 1 : 3 }).map((_, i) => (
        <div key={i} className="dash-skel__row">
          <span className="skeleton skeleton--title" />
          <span className="skeleton skeleton--line" />
        </div>
      ))
    )}
    <span className="sr-only">Cargando…</span>
  </div>
)

export const BlockError = ({ error, onRetry, compact = false }) => (
  <div className={`dash-error${compact ? ' dash-error--compact' : ''}`} role="alert">
    <Icon name={error?.status === 0 ? 'wifiOff' : 'alert'} size={compact ? 16 : 20} />
    <div className="dash-error__text">
      <strong>{compact ? 'No se pudo cargar.' : 'No se pudo cargar este bloque.'}</strong>{' '}
      <span>{getErrorMessage(error)}</span>
    </div>
    {onRetry && (
      <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>
        <Icon name="refresh" size={16} /> Reintentar
      </button>
    )}
  </div>
)

/** Barra de proporción (0–1) con texto visible al lado; la barra es decorativa. */
export const Meter = ({ ratio, tone = 'accent' }) => (
  <span className={`dash-meter dash-meter--${tone}`} aria-hidden="true">
    <span style={{ width: `${Math.max(0, Math.min(1, ratio || 0)) * 100}%` }} />
  </span>
)

export default DashPanel
