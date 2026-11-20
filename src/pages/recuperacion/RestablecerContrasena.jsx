import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services/apiService'
import { ApiError, getErrorMessage } from '../../lib/apiClient'
import Icon from '../../components/ui/Icon'
import { Spinner } from '../../components/ui/States'
import { PasswordField, ListaRequisitos, requisitosContrasena } from '../../components/ui/PasswordField'
import AuthLayout, { formatoEspera, useCuentaAtras } from './AuthLayout'

const MENSAJE_INVALIDO = 'El enlace no es válido o ha caducado. Solicita uno nuevo.'

const RestablecerContrasena = () => {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const { status, logout } = useAuth()
  const navigate = useNavigate()
  const reqId = useId()
  const nuevaRef = useRef(null)

  // validando | invalido | valido | error (red/servidor)
  const [estado, setEstado] = useState(token ? 'validando' : 'invalido')
  const [mensajeInvalido, setMensajeInvalido] = useState(MENSAJE_INVALIDO)
  const [correoMascara, setCorreoMascara] = useState('')
  const [reintento, setReintento] = useState(0)

  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [espera, setEspera] = useCuentaAtras()

  useEffect(() => {
    document.title = 'Restablecer contraseña · CDITutorPro'
  }, [])

  useEffect(() => {
    if (!token) return undefined
    const ctrl = new AbortController()
    setEstado('validando')
    authService
      .validarRestablecimiento(token, ctrl.signal)
      .then((r) => {
        if (r?.valido) {
          setCorreoMascara(r.correo || '')
          setEstado('valido')
        } else {
          setEstado('invalido')
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        if (err instanceof ApiError && err.status === 400) {
          setMensajeInvalido(err.message || MENSAJE_INVALIDO)
          setEstado('invalido')
        } else if (err instanceof ApiError && err.status === 429) {
          setEspera(err.retryAfter || 60)
          setEstado('error')
        } else {
          setErrorGeneral(getErrorMessage(err, 'No se pudo comprobar el enlace.'))
          setEstado('error')
        }
      })
    return () => ctrl.abort()
  }, [token, reintento]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (estado === 'valido') nuevaRef.current?.focus()
  }, [estado])

  const lista = useMemo(() => requisitosContrasena(nueva, {}), [nueva])
  const cumple = lista.every((r) => r.ok)

  const limpiar = (campo) => {
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
    if (errorGeneral) setErrorGeneral('')
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const er = {}
    if (!nueva) er.nueva = 'Escribe la nueva contraseña.'
    else if (!cumple) er.nueva = 'La nueva contraseña no cumple los requisitos.'
    if (nueva && confirmar !== nueva) er.confirmar = 'Las contraseñas no coinciden.'
    setErrores(er)
    if (Object.keys(er).length) {
      if (er.nueva) nuevaRef.current?.focus()
      else document.getElementById('rp-confirmar')?.focus()
      return
    }
    setEnviando(true)
    setErrorGeneral('')
    try {
      await authService.restablecerContrasena(token, nueva)
      // La sesión que hubiera abierta en este navegador deja de tener sentido tras restablecer.
      if (status === 'authenticated') logout()
      navigate('/login?motivo=restablecida', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setEspera(err.retryAfter || 60)
      } else if (err instanceof ApiError && err.status === 400) {
        // Política de contraseña: message tal cual en el campo (el token sigue siendo válido)
        if (/contraseña|correo/i.test(err.message || '') && !/enlace/i.test(err.message || '')) {
          setErrores({ nueva: err.message })
          nuevaRef.current?.focus()
        } else {
          // Token caducado o ya usado entre la validación y el envío
          setMensajeInvalido(err.message || MENSAJE_INVALIDO)
          setEstado('invalido')
        }
      } else {
        setErrorGeneral(getErrorMessage(err, 'No se pudo restablecer la contraseña.'))
      }
    } finally {
      setEnviando(false)
    }
  }

  if (estado === 'validando') {
    return (
      <AuthLayout titulo="Restablecer contraseña">
        <div className="auth-body">
          <p className="auth-loading" role="status"><Spinner /> Comprobando el enlace…</p>
        </div>
      </AuthLayout>
    )
  }

  if (estado === 'invalido') {
    return (
      <AuthLayout titulo="Enlace no válido">
        <div className="auth-body">
          <div className="auth-result" role="alert">
            <span className="auth-result__icon auth-result__icon--error"><Icon name="alert" size={24} /></span>
            <p className="auth-result__text">{token ? mensajeInvalido : 'Falta el código del enlace. Ábrelo de nuevo desde el correo o solicita uno nuevo.'}</p>
          </div>
          <Link to="/olvide-contrasena" className="btn btn--primary auth-btn">Solicitar un nuevo enlace</Link>
          <Link to="/login" className="auth-link"><Icon name="arrowLeft" size={16} /> Volver a iniciar sesión</Link>
        </div>
      </AuthLayout>
    )
  }

  if (estado === 'error') {
    return (
      <AuthLayout titulo="Restablecer contraseña">
        <div className="auth-body">
          <p className="banner banner--error" role="alert">
            <Icon name="alert" size={18} />
            <span>{espera > 0 ? `Demasiados intentos. Podrás intentarlo de nuevo en ${formatoEspera(espera)}.` : errorGeneral}</span>
          </p>
          <button type="button" className="btn btn--primary auth-btn" onClick={() => setReintento((n) => n + 1)} disabled={espera > 0}>
            <Icon name="refresh" size={18} /> Reintentar
          </button>
          <Link to="/login" className="auth-link"><Icon name="arrowLeft" size={16} /> Volver a iniciar sesión</Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      titulo="Crea una nueva contraseña"
      subtitulo={correoMascara ? <>Para la cuenta <strong className="auth-correo">{correoMascara}</strong></> : null}
    >
      <form className="auth-body" onSubmit={onSubmit} noValidate>
        {espera > 0 && (
          <p className="banner banner--error" role="alert">
            <Icon name="alert" size={18} />
            <span>Demasiados intentos. Podrás intentarlo de nuevo en {formatoEspera(espera)}.</span>
          </p>
        )}
        {errorGeneral && (
          <p className="banner banner--error" role="alert">
            <Icon name="alert" size={18} />
            <span>{errorGeneral}</span>
          </p>
        )}
        <PasswordField
          id="rp-nueva"
          label="Nueva contraseña"
          value={nueva}
          onChange={(v) => { setNueva(v); limpiar('nueva') }}
          autoComplete="new-password"
          error={errores.nueva}
          describedBy={reqId}
          inputRef={nuevaRef}
          disabled={enviando}
        />
        <PasswordField
          id="rp-confirmar"
          label="Confirmar nueva contraseña"
          value={confirmar}
          onChange={(v) => { setConfirmar(v); limpiar('confirmar') }}
          autoComplete="new-password"
          error={errores.confirmar}
          disabled={enviando}
        />
        <ListaRequisitos id={reqId} lista={lista} />
        <button type="submit" className="btn btn--primary auth-btn" disabled={enviando || espera > 0} aria-busy={enviando}>
          {enviando ? <><Spinner /> Guardando…</> : 'Guardar contraseña'}
        </button>
        <Link to="/login" className="auth-link"><Icon name="arrowLeft" size={16} /> Volver a iniciar sesión</Link>
      </form>
    </AuthLayout>
  )
}

export default RestablecerContrasena
