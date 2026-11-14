import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Modal from './Modal'
import Icon from './Icon'

// ==================== TOASTS ====================
const ToastContext = createContext(null)
const MAX_TOASTS = 3
const DURATION = 5000

const ToastItem = ({ toast, onDismiss }) => {
  const timer = useRef(null)
  const start = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onDismiss(toast.id), toast.duration)
  }, [onDismiss, toast.id, toast.duration])

  useEffect(() => {
    start()
    return () => clearTimeout(timer.current)
  }, [start])

  const icon = { success: 'checkCircle', error: 'alert', warning: 'alert', info: 'info' }[toast.type]
  return (
    <li
      className={`ui-toast ui-toast--${toast.type}`}
      onMouseEnter={() => clearTimeout(timer.current)}
      onMouseLeave={start}
      onFocus={() => clearTimeout(timer.current)}
      onBlur={start}
    >
      <Icon name={icon} className="ui-toast__icon" />
      <div className="ui-toast__content">
        {toast.title && <p className="ui-toast__title">{toast.title}</p>}
        <p className="ui-toast__message">{toast.message}</p>
      </div>
      <button type="button" className="icon-btn icon-btn--sm" onClick={() => onDismiss(toast.id)} aria-label="Cerrar aviso">
        <Icon name="close" size={16} />
      </button>
    </li>
  )
}

// ==================== CONFIRM ====================
const ConfirmContext = createContext(null)

export const FeedbackProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)
  const idRef = useRef(0)

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const push = useCallback((type, message, opts = {}) => {
    idRef.current += 1
    const toast = { id: idRef.current, type, message, title: opts.title, duration: opts.duration || DURATION }
    setToasts((t) => [...t, toast].slice(-MAX_TOASTS))
    return toast.id
  }, [])

  const toast = useMemo(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('error', m, { duration: 8000, ...o }),
      warning: (m, o) => push('warning', m, { duration: 7000, ...o }),
      info: (m, o) => push('info', m, o),
      dismiss,
    }),
    [push, dismiss]
  )

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setConfirmState({ ...options, resolve })
      }),
    []
  )

  const closeConfirm = (result) => {
    confirmState?.resolve(result)
    setConfirmState(null)
  }

  const politeToasts = toasts.filter((t) => t.type !== 'error')
  const assertiveToasts = toasts.filter((t) => t.type === 'error')

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={confirm}>
        {children}
        <div className="ui-toaster">
          <ol className="ui-toaster__list" aria-live="polite" aria-relevant="additions">
            {politeToasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={dismiss} />)}
          </ol>
          <ol className="ui-toaster__list" aria-live="assertive" aria-relevant="additions">
            {assertiveToasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={dismiss} />)}
          </ol>
        </div>
        <Modal
          open={!!confirmState}
          onClose={() => closeConfirm(false)}
          title={confirmState?.title || '¿Confirmar?'}
          description={confirmState?.message}
          size="sm"
          role="alertdialog"
          footer={
            <>
              <button type="button" className="btn btn--secondary" onClick={() => closeConfirm(false)} data-autofocus>
                {confirmState?.cancelLabel || 'Cancelar'}
              </button>
              <button
                type="button"
                className={`btn ${confirmState?.danger ? 'btn--danger' : 'btn--primary'}`}
                onClick={() => closeConfirm(true)}
              >
                {confirmState?.confirmLabel || 'Confirmar'}
              </button>
            </>
          }
        />
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within FeedbackProvider')
  return ctx
}

/** const ok = await confirm({ title, message, confirmLabel, danger }) */
export const useConfirm = () => {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within FeedbackProvider')
  return ctx
}
