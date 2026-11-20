import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { authService } from '../services/apiService'
import { setTokenProvider, setUnauthorizedHandler, resetUnauthorizedGuard, ApiError } from '../lib/apiClient'
import { readSession, writeSession, clearSession, msHastaExpirar, SESSION_KEY, motivo401 } from '../lib/session'
import { tieneRol, normalizarRol, getRol, GESTION, PERSONAL } from '../lib/roles'
import { invalidarUsuariosPorRol } from '../features/tutorias/tutorias'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

// setTimeout acepta como máximo 2^31-1 ms (~24,8 días)
const MAX_TIMEOUT = 2147483647

/**
 * status:
 *  - 'checking'      : validando la sesión guardada con GET /Auth/me
 *  - 'authenticated' : sesión válida
 *  - 'anonymous'     : sin sesión
 */
export const AuthProvider = ({ children }) => {
  // Una sesión guardada ya vencida se descarta al arrancar (y se informa en el login).
  // El inicializador debe ser PURO: React (StrictMode en desarrollo) puede llamarlo dos veces y quedarse
  // con el segundo resultado. Antes borraba el storage aquí → la 2.ª llamada no veía la sesión y se perdía
  // el motivo "expirada". El borrado se hace en un efecto (abajo).
  const [inicial] = useState(() => {
    const s = readSession()
    if (s && msHastaExpirar(s.expiresAt) <= 0) return { session: null, reason: 'expirada', vencida: s.token }
    return { session: s, reason: null, vencida: null }
  })
  const [session, setSession] = useState(inicial.session)
  const [status, setStatus] = useState(() => (inicial.session ? 'checking' : 'anonymous'))
  const [logoutReason, setLogoutReason] = useState(inicial.reason)
  const [offline, setOffline] = useState(false)
  const tokenRef = useRef(session?.token || null)
  const validacionRef = useRef(null)

  tokenRef.current = session?.token || null

  // Descarta del storage la sesión vencida detectada al arrancar (idempotente; solo si sigue siendo esa)
  useEffect(() => {
    if (inicial.vencida && readSession()?.token === inicial.vencida) clearSession()
  }, [inicial.vencida])

  const logout = useCallback((reason = null) => {
    clearSession()
    invalidarUsuariosPorRol()
    tokenRef.current = null
    setSession(null)
    setStatus('anonymous')
    setOffline(false)
    setLogoutReason(reason)
  }, [])

  // El cliente HTTP lee el token de aquí y avisa de los 401
  useEffect(() => {
    setTokenProvider(() => tokenRef.current)
    setUnauthorizedHandler((err) => logout(motivo401(err)))
    return () => {
      setTokenProvider(null)
      setUnauthorizedHandler(null)
    }
  }, [logout])

  // Validación de la sesión restaurada
  const validarAhora = useCallback(async () => {
    const stored = readSession()
    if (!stored || msHastaExpirar(stored.expiresAt) <= 0) {
      if (stored) logout('expirada')
      else setStatus('anonymous')
      return
    }
    setStatus('checking')
    // Si mientras esperábamos /Auth/me la sesión guardada cambió (login nuevo, logout u otra pestaña),
    // esta respuesta ya no aplica: no se escribe ni se cierra nada sobre la sesión nueva.
    const sigueVigente = () => readSession()?.token === stored.token
    try {
      const usuario = await authService.me(stored.token)
      if (!sigueVigente()) return
      if (!normalizarRol(getRol(usuario))) {
        logout('sin-acceso')
        return
      }
      const next = { ...stored, usuario }
      writeSession(next)
      setSession(next)
      setOffline(false)
      setStatus('authenticated')
    } catch (err) {
      if (!sigueVigente()) return
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        logout(err.status === 401 ? motivo401(err) : 'sin-acceso')
      } else {
        // Sin conexión: se mantiene la sesión guardada y se avisa
        setSession(stored)
        setOffline(true)
        setStatus('authenticated')
      }
    }
  }, [logout])

  // Una sola validación en vuelo: llamadas simultáneas (montaje doble de StrictMode, "Reintentar"
  // pulsado varias veces) comparten la misma petición a /Auth/me.
  const validar = useCallback(() => {
    if (!validacionRef.current) {
      validacionRef.current = validarAhora().finally(() => {
        validacionRef.current = null
      })
    }
    return validacionRef.current
  }, [validarAhora])

  useEffect(() => {
    if (session) validar()
    // solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Expiración proactiva
  useEffect(() => {
    if (!session?.expiresAt) return undefined
    const ms = msHastaExpirar(session.expiresAt)
    if (ms <= 0) {
      logout('expirada')
      return undefined
    }
    const id = setTimeout(() => logout('expirada'), Math.min(ms, MAX_TIMEOUT))
    return () => clearTimeout(id)
  }, [session?.expiresAt, logout])

  // Sincronización entre pestañas
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== SESSION_KEY) return
      const s = readSession()
      if (!s) {
        tokenRef.current = null
        setSession(null)
        setStatus('anonymous')
      } else if (s.token !== tokenRef.current) {
        setSession(s)
        setStatus('authenticated')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const login = useCallback(async (correo, contrasena) => {
    const response = await authService.login(correo.trim(), contrasena)
    if (!response?.token || !response?.usuario) {
      throw new Error('La respuesta del servidor no contiene la sesión.')
    }
    if (!normalizarRol(getRol(response.usuario))) {
      throw new ApiError({ status: 403, message: 'Tu cuenta no tiene acceso a CDITutorPro.' })
    }
    const next = {
      token: response.token,
      expiresAt: response.expiresAt,
      usuario: response.usuario,
    }
    writeSession(next)
    tokenRef.current = next.token
    resetUnauthorizedGuard()
    setSession(next)
    setLogoutReason(null)
    setOffline(false)
    setStatus('authenticated')
    return next.usuario
  }, [])

  const user = session?.usuario || null

  const value = useMemo(
    () => ({
      user,
      status,
      loading: status === 'checking',
      expiresAt: session?.expiresAt || null,
      offline,
      logoutReason,
      login,
      logout,
      revalidar: validar,
      isAuthenticated: () => status === 'authenticated',
      hasRole: (roles) => tieneRol(user, roles),
      isGestion: tieneRol(user, GESTION),
      isPersonal: tieneRol(user, PERSONAL),
    }),
    [user, status, session?.expiresAt, offline, logoutReason, login, logout, validar]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
