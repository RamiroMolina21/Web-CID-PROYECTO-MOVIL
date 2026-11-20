import React, { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { ApiError } from '../lib/apiClient'
import { homePorRol } from '../lib/roles'
import { esCuentaDesactivada, MENSAJE_DESACTIVADA, MENSAJE_CONTRASENA_CAMBIADA } from '../lib/session'
import Icon from '../components/ui/Icon'
import cdiLogo from '../img/cdi-logo-2022.png'
import './Login.css'

const MOTIVOS = {
  expirada: 'Tu sesión ha expirado. Inicia sesión de nuevo.',
  'sin-acceso': 'Tu cuenta no tiene acceso a CDITutorPro.',
  desactivada: MENSAJE_DESACTIVADA,
  'contrasena-cambiada': MENSAJE_CONTRASENA_CAMBIADA,
  restablecida: 'Contraseña restablecida. Inicia sesión con tu nueva contraseña.',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Solo se acepta una ruta interna como destino tras el login. */
const destinoSeguro = (redirect) =>
  redirect && redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/login') ? redirect : null

const mensajeDeError = (err) => {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 0:
        return 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.'
      case 400:
        return err.message || 'Revisa el correo y la contraseña.'
      case 401:
        return 'Correo o contraseña incorrectos.'
      case 403:
        return esCuentaDesactivada(err) ? MENSAJE_DESACTIVADA : 'Tu cuenta no tiene acceso a CDITutorPro.'
      case 429:
        return null // se muestra con cuenta atrás
      default:
        return err.message
    }
  }
  return err?.message || 'No se pudo iniciar sesión.'
}

const Login = () => {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [espera, setEspera] = useState(0)
  const [loading, setLoading] = useState(false)
  const { login, status, user, logoutReason } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const correoRef = useRef(null)

  const claveMotivo = params.get('motivo') || logoutReason
  const motivo = MOTIVOS[claveMotivo]

  useEffect(() => {
    document.title = 'Iniciar sesión · CDITutorPro'
  }, [])

  // Cuenta atrás tras 429
  useEffect(() => {
    if (espera <= 0) return undefined
    const id = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [espera])

  if (status === 'authenticated' && user) {
    return <Navigate to={destinoSeguro(params.get('redirect')) || homePorRol(user)} replace />
  }

  const validar = () => {
    const errs = {}
    if (!correo.trim()) errs.correo = 'Escribe tu correo institucional.'
    else if (!EMAIL_RE.test(correo.trim())) errs.correo = 'El formato del correo no es válido.'
    if (!contrasena) errs.contrasena = 'Escribe tu contraseña.'
    else if (contrasena.length < 6) errs.contrasena = 'La contraseña tiene al menos 6 caracteres.'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!validar()) return
    setLoading(true)
    try {
      const usuario = await login(correo, contrasena)
      navigate(destinoSeguro(params.get('redirect')) || homePorRol(usuario), { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setEspera(err.retryAfter || 60)
        setError('')
      } else {
        setError(mensajeDeError(err))
      }
      correoRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  const bloqueado = loading || espera > 0

  return (
    <div className="login-container">
      <button type="button" className="theme-toggle theme-toggle-floating" onClick={toggleTheme}>
        <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
        <span>{theme === 'light' ? 'Modo oscuro' : 'Modo claro'}</span>
      </button>
      <main className="login-card">
        <div className="login-header">
          {/* Logo oficial del Centro de Idiomas, sin alterar (292×63; se muestra a 2× de densidad máxima) */}
          <img src={cdiLogo} alt="CDI · Centro de Idiomas · CECAR" className="cdi-logo" width="292" height="63" decoding="async" />
          <h1 className="login-title"><span className="brand__cdi">CDI</span>TutorPro</h1>
          <p>Agenda y gestiona tus tutorías</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          {motivo && !error && espera === 0 && (
            <div className={claveMotivo === 'restablecida' ? 'success-message' : 'info-message'} role="status">{motivo}</div>
          )}
          {error && (
            <div className="error-message" role="alert">{error}</div>
          )}
          {espera > 0 && (
            <div className="error-message" role="alert">
              Demasiados intentos. Podrás intentarlo de nuevo en {espera} s.
            </div>
          )}

          <div className="form-group">
            <label htmlFor="correo">Correo institucional</label>
            <input
              ref={correoRef}
              id="correo"
              type="email"
              inputMode="email"
              autoComplete="username"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="usuario@cecar.edu.co"
              aria-invalid={!!fieldErrors.correo}
              aria-describedby={fieldErrors.correo ? 'correo-error' : undefined}
              disabled={loading}
            />
            {fieldErrors.correo && <p className="field-error" id="correo-error">{fieldErrors.correo}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="contrasena">Contraseña</label>
            <div className="password-input-wrapper">
              <input
                id="contrasena"
                type={mostrar ? 'text' : 'password'}
                autoComplete="current-password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                aria-invalid={!!fieldErrors.contrasena}
                aria-describedby={fieldErrors.contrasena ? 'contrasena-error' : undefined}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setMostrar((v) => !v)}
                aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={mostrar}
                disabled={loading}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  {mostrar && <path d="M4 4l16 16" />}
                </svg>
              </button>
            </div>
            {fieldErrors.contrasena && <p className="field-error" id="contrasena-error">{fieldErrors.contrasena}</p>}
            <Link to="/olvide-contrasena" className="forgot-link">¿Olvidaste tu contraseña?</Link>
          </div>

          <button type="submit" className="login-button" disabled={bloqueado} aria-busy={loading}>
            {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>

        <div className="login-footer">
          <p>Sistema de tutorías del Centro de Idiomas · Corporación Universitaria del Caribe – CECAR</p>
        </div>
      </main>
    </div>
  )
}

export default Login
