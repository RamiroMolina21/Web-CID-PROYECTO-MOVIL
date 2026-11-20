import React, { useId, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useApiQuery } from '../hooks/useApiQuery'
import { useToast } from '../components/ui/Feedback'
import { PageHeader, LoadingState, ErrorState, Spinner } from '../components/ui/States'
import Icon from '../components/ui/Icon'
import { PasswordField, ListaRequisitos, requisitosContrasena } from '../components/ui/PasswordField'
import { authService } from '../services/apiService'
import { ApiError, getErrorMessage } from '../lib/apiClient'
import { formatFecha } from '../lib/fechas'
import { iniciales, nombreCompleto, normalizarRol, getRol } from '../lib/roles'
import './Configuracion.css'

const CambiarContrasena = ({ correo }) => {
  const toast = useToast()
  const reqId = useId()
  const actualRef = useRef(null)
  const nuevaRef = useRef(null)
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const lista = useMemo(() => requisitosContrasena(nueva, { actual, correo }), [nueva, actual, correo])
  const cumple = lista.every((r) => r.ok)

  const limpiar = (campo) => {
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
    if (errorGeneral) setErrorGeneral(null)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const er = {}
    if (!actual) er.actual = 'Escribe tu contraseña actual.'
    if (!nueva) er.nueva = 'Escribe la nueva contraseña.'
    else if (!cumple) er.nueva = 'La nueva contraseña no cumple los requisitos.'
    if (nueva && confirmar !== nueva) er.confirmar = 'Las contraseñas no coinciden.'
    setErrores(er)
    if (Object.keys(er).length) {
      const primero = { actual: actualRef, nueva: nuevaRef }[Object.keys(er)[0]]
      ;(primero?.current || document.getElementById('cfg-confirmar'))?.focus()
      return
    }

    setEnviando(true)
    setErrorGeneral(null)
    try {
      await authService.cambiarContrasena(actual, nueva)
      setActual('')
      setNueva('')
      setConfirmar('')
      setErrores({})
      toast.success('Usa la nueva contraseña la próxima vez que inicies sesión.', { title: 'Contraseña actualizada' })
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const min = Math.max(1, Math.ceil((err.retryAfter || 900) / 60))
        setErrorGeneral(`Demasiados intentos. Espera ${min} ${min === 1 ? 'minuto' : 'minutos'} antes de volver a intentarlo.`)
      } else if (err instanceof ApiError && err.status === 400) {
        const msg = err.message || ''
        const errNueva = err.errors?.ContrasenaNueva?.[0] || err.errors?.contrasenaNueva?.[0]
        if (/actual no es correcta/i.test(msg)) {
          setErrores({ actual: msg })
          actualRef.current?.focus()
        } else if (errNueva || /nueva contraseña/i.test(msg)) {
          setErrores({ nueva: errNueva || msg })
          nuevaRef.current?.focus()
        } else {
          setErrorGeneral(getErrorMessage(err))
        }
      } else {
        // 401 lo gestiona el cliente HTTP (cierra sesión y lleva al login)
        setErrorGeneral(getErrorMessage(err))
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="panel" aria-labelledby="cfg-pass-title">
      <div className="panel__head">
        <h2 className="panel__title" id="cfg-pass-title">Cambiar contraseña</h2>
      </div>
      <form className="panel__body form-grid" onSubmit={onSubmit} noValidate>
        {/* Ayuda a los gestores de contraseñas a asociar el cambio a la cuenta */}
        <input type="text" name="username" autoComplete="username" value={correo || ''} readOnly hidden />

        <PasswordField
          id="cfg-actual"
          label="Contraseña actual"
          value={actual}
          onChange={(v) => { setActual(v); limpiar('actual') }}
          autoComplete="current-password"
          error={errores.actual}
          inputRef={actualRef}
        />
        <div className="form-grid form-grid--2">
          <PasswordField
            id="cfg-nueva"
            label="Nueva contraseña"
            value={nueva}
            onChange={(v) => { setNueva(v); limpiar('nueva') }}
            autoComplete="new-password"
            error={errores.nueva}
            describedBy={reqId}
            inputRef={nuevaRef}
          />
          <PasswordField
            id="cfg-confirmar"
            label="Confirmar nueva contraseña"
            value={confirmar}
            onChange={(v) => { setConfirmar(v); limpiar('confirmar') }}
            autoComplete="new-password"
            error={errores.confirmar}
          />
        </div>

        <ListaRequisitos id={reqId} lista={lista} />

        {errorGeneral && (
          <p className="banner banner--error" role="alert">
            <Icon name="alert" size={18} />
            <span>{errorGeneral}</span>
          </p>
        )}

        <div className="form-footer">
          <p className="field__hint">Tu sesión actual seguirá abierta.</p>
          <div className="form-footer__end">
            <button type="submit" className="btn btn--primary" disabled={enviando} aria-busy={enviando}>
              {enviando ? <><Spinner /> Guardando…</> : 'Actualizar contraseña'}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}

const Configuracion = () => {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  // Datos frescos del servidor (no los del login)
  const { data, isLoading, isError, error, refetch } = useApiQuery((signal) => authService.me(undefined, signal), [])
  const cuenta = data || user
  const nombre = nombreCompleto(cuenta) || cuenta?.correo
  const rol = normalizarRol(getRol(cuenta)) || getRol(cuenta)

  return (
    <div className="personal-page personal-page--narrow config-page">
      <PageHeader title="Configuración" subtitle="Tu cuenta, seguridad y preferencias de visualización." />

      <section className="panel" aria-labelledby="cfg-cuenta-title">
        <div className="panel__head">
          <h2 className="panel__title" id="cfg-cuenta-title">Mi cuenta</h2>
        </div>
        <div className="panel__body">
          {isLoading && !data && <LoadingState rows={1} label="Cargando tu cuenta…" />}
          {isError && !data && <ErrorState error={error} onRetry={refetch} />}
          {cuenta && (
            <div className="cuenta">
              <span className="avatar avatar--lg" aria-hidden="true">{iniciales(nombre)}</span>
              <dl className="cuenta__datos">
                <div><dt>Nombre</dt><dd>{nombre}</dd></div>
                <div><dt>Correo</dt><dd>{cuenta.correo}</dd></div>
                <div><dt>Rol</dt><dd>{rol}</dd></div>
                {cuenta.fechaRegistro && <div><dt>Miembro desde</dt><dd>{formatFecha(cuenta.fechaRegistro)}</dd></div>}
              </dl>
            </div>
          )}
          <p className="field__hint cuenta__nota">Para cambiar tu nombre o correo, contacta con Administración.</p>
        </div>
      </section>

      <CambiarContrasena correo={cuenta?.correo} />

      <section className="panel" aria-labelledby="cfg-tema-title">
        <div className="panel__head">
          <h2 className="panel__title" id="cfg-tema-title">Apariencia</h2>
        </div>
        <div className="panel__body">
          <fieldset className="field">
            <legend className="field__label">Tema</legend>
            <div className="choice-group">
              {[['light', 'Claro', 'sun'], ['dark', 'Oscuro', 'moon']].map(([valor, etiqueta, icono]) => (
                <label className="choice" key={valor}>
                  <input
                    type="radio"
                    name="tema"
                    value={valor}
                    checked={theme === valor}
                    onChange={() => theme !== valor && toggleTheme()}
                  />
                  <span><Icon name={icono} size={16} /> {etiqueta}</span>
                </label>
              ))}
            </div>
            <p className="field__hint">Se guarda en este navegador.</p>
          </fieldset>
        </div>
      </section>
    </div>
  )
}

export default Configuracion
