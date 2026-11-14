import React, { useEffect, useId, useRef } from 'react'
import Icon from './Icon'

/**
 * Diálogo modal accesible sobre <dialog> nativo: foco atrapado, Esc, restauración del foco.
 * `onClose` se llama al pulsar Esc, el botón cerrar o el fondo (si `dismissable`).
 */
const Modal = ({ open, onClose, title, description, children, footer, size = 'md', dismissable = true, role }) => {
  const ref = useRef(null)
  const lastFocus = useRef(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      lastFocus.current = document.activeElement
      dialog.showModal()
      document.documentElement.classList.add('has-modal')
      const preferred = dialog.querySelector('[data-autofocus]')
      if (preferred) preferred.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return undefined
    const handleClose = () => {
      document.documentElement.classList.remove('has-modal')
      const el = lastFocus.current
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus()
    }
    const handleCancel = (e) => {
      e.preventDefault()
      if (dismissable) onClose?.()
    }
    dialog.addEventListener('close', handleClose)
    dialog.addEventListener('cancel', handleCancel)
    return () => {
      dialog.removeEventListener('close', handleClose)
      dialog.removeEventListener('cancel', handleCancel)
    }
  }, [onClose, dismissable])

  useEffect(() => () => document.documentElement.classList.remove('has-modal'), [])

  const onBackdrop = (e) => {
    if (dismissable && e.target === ref.current) onClose?.()
  }

  return (
    <dialog
      ref={ref}
      className={`ui-modal ui-modal--${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      role={role}
      onMouseDown={onBackdrop}
    >
      {open && (
        <div className="ui-modal__panel">
          <header className="ui-modal__header">
            <div>
              <h2 id={titleId} className="ui-modal__title">{title}</h2>
              {description && <p id={descId} className="ui-modal__description">{description}</p>}
            </div>
            {dismissable && (
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
                <Icon name="close" />
              </button>
            )}
          </header>
          <div className="ui-modal__body">{children}</div>
          {footer && <footer className="ui-modal__footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

export default Modal
