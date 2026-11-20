import React, { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services/apiService'
import { ApiError, getErrorMessage } from '../../lib/apiClient'
import Icon from '../../components/ui/Icon'
import { Spinner } from '../../components/ui/States'
import AuthLayout, { formatoEspera, useCuentaAtras } from './AuthLayout'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Contrato: la respuesta es siempre la misma, exista o no la cuenta (anti-enumeración).
export const MENSAJE_GENERICO = 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.'

const OlvideContrasena = () => {
  const { status, user } = useAuth()
  const [correo, setCorreo] = useState('')
  const [error, setError] = useState('')
  const [errorGeneral, setErrorGeneral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState('')
  const [espera, setEspera] = useCuentaAtras()
  const correoRef = useRef(null)
  const confirmRef = useRef(null)

  useEffect(() => {
    document.title = 'Recuperar contraseña · CDITutorPro'
  }, [])

  useEffect(() => {
    if (enviado) confirmRef.current?.focus()
  }, [enviado])

  // Con sesión iniciada la contraseña se cambia desde Configuración.
  if (status === 'authenticated' && user) return <Navigate to="/configuracion" replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    setErrorGeneral('')
    const valor = correo.trim()
    const er = !valor ? 'Escribe tu correo institucional.' : !EMAIL_RE.test(valor) ? 'El formato del correo no es válido.' : ''
    setError(er)
    if (er) {
      correoRef.current?.focus()
      return
    }
    setEnviando(true)
    try {
      await authService.olvideContrasena(valor)
      // Siempre el mensaje genérico, nunca «el correo no existe».
      setEnviado(MENSAJE_GENERICO)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setEspera(err.retryAfter || 60)
      } else if (err instanceof ApiError && err.status === 400) {
        setError(err.message || 'El formato del correo no es válido.')
        correoRef.current?.focus()
      } else {
        setErrorGeneral(getErrorMessage(err, 'No se pudo enviar la solicitud. Inténtalo de nuevo.'))
      }
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <AuthLayout titulo="Revisa tu correo">
        <div className="auth-body">
          <div className="auth-result" role="status" tabIndex={-1} ref={confirmRef}>
            <span className="auth-result__icon auth-result__icon--info"><Icon name="mail" size={24} /></span>
            <p className="auth-result__text">{enviado}</p>
            <p className="auth-muted">El enlace caduca pasado un tiempo y solo sirve una vez. Si no lo ves, revisa la carpeta de correo no deseado.</p>
          </div>
          <Link to="/login" className="btn btn--primary auth-btn">Volver a iniciar sesión</Link>
          <button type="button" className="auth-link" onClick={() => setEnviado('')}>Usar otro correo</button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout titulo="¿Olvidaste tu contraseña?" subtitulo="Escribe tu correo institucional y te enviaremos un enlace para crear una nueva.">
      <form className="auth-body" onSubmit={onSubmit} noValidate>
        {espera > 0 && (
          <p className="banner banner--error" role="alert">
            <Icon name="alert" size={18} />
            <span>Demasiadas solicitudes. Podrás intentarlo de nuevo en {formatoEspera(espera)}.</span>
          </p>
        )}
        {errorGeneral && (
          <p className="banner banner--error" role="alert">
            <Icon name="alert" size={18} />
            <span>{errorGeneral}</span>
          </p>
        )}
        <div className="field">
          <label className="field__label" htmlFor="rc-correo">Correo institucional</label>
          <input
            ref={correoRef}
            id="rc-correo"
            className="input"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="usuario@cecar.edu.co"
            value={correo}
            onChange={(e) => { setCorreo(e.target.value); if (error) setError('') }}
            aria-invalid={!!error}
            aria-describedby={error ? 'rc-correo-error' : undefined}
            disabled={enviando}
          />
          {error && <p className="field__error" id="rc-correo-error">{error}</p>}
        </div>
        <button type="submit" className="btn btn--primary auth-btn" disabled={enviando || espera > 0} aria-busy={enviando}>
          {enviando ? <><Spinner /> Enviando…</> : 'Enviar enlace'}
        </button>
        <Link to="/login" className="auth-link"><Icon name="arrowLeft" size={16} /> Volver a iniciar sesión</Link>
      </form>
    </AuthLayout>
  )
}

export default OlvideContrasena
