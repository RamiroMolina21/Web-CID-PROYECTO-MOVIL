import React, { useState } from 'react'
import Icon from './Icon'

// Política de contraseña del backend (PUT /Auth/contrasena y POST /Auth/restablecer-contrasena):
// 8–72 caracteres (≤ 72 bytes UTF-8), no solo espacios, distinta del correo y de la actual.
export const MIN_CONTRASENA = 8
export const MAX_BYTES_CONTRASENA = 72
const bytes = (s) => new TextEncoder().encode(s).length

/**
 * Requisitos verificables en el cliente. `actual` es opcional: al restablecer no se conoce la contraseña
 * actual y esa regla la comprueba solo el servidor.
 */
export const requisitosContrasena = (nueva, { actual, correo } = {}) => [
  { id: 'min', ok: nueva.length >= MIN_CONTRASENA, texto: `Al menos ${MIN_CONTRASENA} caracteres` },
  { id: 'max', ok: nueva.length > 0 && bytes(nueva) <= MAX_BYTES_CONTRASENA, texto: `Máximo ${MAX_BYTES_CONTRASENA} caracteres` },
  { id: 'esp', ok: nueva.trim().length > 0, texto: 'No puede ser solo espacios' },
  ...(actual !== undefined
    ? [{ id: 'act', ok: nueva.length > 0 && nueva !== actual, texto: 'Distinta de la contraseña actual' }]
    : []),
  {
    id: 'cor',
    ok: nueva.length > 0 && nueva.trim().toLowerCase() !== (correo || '').trim().toLowerCase(),
    texto: 'Distinta de tu correo',
  },
]

export const PasswordField = ({ id, label, value, onChange, autoComplete, error, describedBy, inputRef, disabled }) => {
  const [visible, setVisible] = useState(false)
  const errorId = `${id}-error`
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      <div className="password-field">
        <input
          ref={inputRef}
          id={id}
          className="input"
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={[error ? errorId : null, describedBy].filter(Boolean).join(' ') || undefined}
          spellCheck={false}
          disabled={disabled}
        />
        <button
          type="button"
          className="icon-btn password-field__toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={visible}
          disabled={disabled}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
        </button>
      </div>
      {error && <p className="field__error" id={errorId}>{error}</p>}
    </div>
  )
}

export const ListaRequisitos = ({ id, lista }) => (
  <ul className="requisitos" id={id} aria-label="Requisitos de la nueva contraseña">
    {lista.map((r) => (
      <li key={r.id} className={r.ok ? 'is-ok' : ''}>
        <Icon name={r.ok ? 'checkCircle' : 'circle'} size={16} />
        <span>{r.texto}</span>
        <span className="sr-only">{r.ok ? ' (cumplido)' : ' (pendiente)'}</span>
      </li>
    ))}
  </ul>
)
