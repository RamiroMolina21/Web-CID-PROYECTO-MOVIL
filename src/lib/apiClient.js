// Cliente HTTP único de la web. Contrato: docs/api (backend feature/jwt-auth).
// - Bearer token inyectado desde AuthContext (setTokenProvider).
// - Errores problem+json → ApiError { status, message, errors, traceId, retryAfter }.
// - 401 fuera del login → onUnauthorized (logout + redirect), una sola vez por ráfaga.
import { API_BASE_URL } from '../config/apiConfig'

const isNgrok = /ngrok-free\.dev|ngrok\.io/.test(API_BASE_URL)

let tokenProvider = () => null
let unauthorizedHandler = null
let unauthorizedFired = false

export const setTokenProvider = (fn) => {
  tokenProvider = typeof fn === 'function' ? fn : () => null
}

export const setUnauthorizedHandler = (fn) => {
  unauthorizedHandler = typeof fn === 'function' ? fn : null
  unauthorizedFired = false
}

export const resetUnauthorizedGuard = () => {
  unauthorizedFired = false
}

const debug = (...args) => {
  if (import.meta.env.DEV) console.debug('[api]', ...args)
}

const MENSAJES_POR_STATUS = {
  400: 'La solicitud no es válida. Revisa los datos e inténtalo de nuevo.',
  401: 'Tu sesión ha expirado. Inicia sesión de nuevo.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'El recurso solicitado no existe.',
  409: 'La operación entra en conflicto con el estado actual de los datos.',
  429: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
  500: 'Error interno del servidor. Inténtalo más tarde.',
  502: 'El servidor no está disponible en este momento (502).',
  503: 'El servidor no está disponible en este momento (503).',
}

export class ApiError extends Error {
  constructor({ status, message, errors = null, traceId = null, retryAfter = null, url = '', data = null }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
    this.traceId = traceId
    this.retryAfter = retryAfter
    this.url = url
    // Compatibilidad con el código existente que lee error.response.status / .data
    this.response = { status, data, url }
  }

  get isNetwork() {
    return this.status === 0
  }
}

const parseRetryAfter = (value) => {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds))
  const date = Date.parse(value)
  return Number.isNaN(date) ? null : Math.max(0, Math.round((date - Date.now()) / 1000))
}

const buildError = async (response) => {
  let data = null
  try {
    const text = await response.text()
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  let message = (data && (data.message || data.detail || data.title)) || MENSAJES_POR_STATUS[response.status] ||
    `Error ${response.status}`

  // Errores de validación de modelo: preferir el primer mensaje legible
  const errors = data && typeof data.errors === 'object' ? data.errors : null
  if (errors && !data.message) {
    const first = Object.values(errors).flat().find(Boolean)
    if (first) message = first
  }

  return new ApiError({
    status: response.status,
    message,
    errors,
    traceId: data?.traceId || null,
    retryAfter: parseRetryAfter(response.headers.get('Retry-After')),
    url: response.url,
    data,
  })
}

const buildHeaders = ({ auth, json, extra }) => {
  const headers = { Accept: 'application/json' }
  if (json) headers['Content-Type'] = 'application/json'
  if (isNgrok) headers['ngrok-skip-browser-warning'] = 'true'
  if (auth) {
    const token = tokenProvider()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  return { ...headers, ...extra }
}

/**
 * @param {string} path Ruta relativa a /api (ej. '/Tutoria/5')
 * @param {{ method?: string, body?: unknown, signal?: AbortSignal, auth?: boolean, raw?: boolean, headers?: object }} options
 */
export const request = async (path, options = {}) => {
  const { method = 'GET', body, signal, auth = true, raw = false, headers = {} } = options
  const hasBody = body !== undefined && method !== 'GET' && method !== 'HEAD'
  const url = `${API_BASE_URL}${path}`

  let response
  try {
    response = await fetch(url, {
      method,
      mode: 'cors',
      credentials: 'omit',
      signal,
      headers: buildHeaders({ auth, json: hasBody, extra: headers }),
      body: hasBody ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    debug('network error', method, path)
    throw new ApiError({
      status: 0,
      message: 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
      url,
    })
  }

  debug(method, path, response.status)

  if (!response.ok) {
    const error = await buildError(response)
    if (response.status === 401 && auth && unauthorizedHandler && !unauthorizedFired) {
      unauthorizedFired = true
      unauthorizedHandler(error)
    }
    throw error
  }

  if (raw) return response
  if (response.status === 204) return null

  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** Descarga un archivo binario respetando Content-Disposition. */
export const downloadFile = async (path, fallbackName) => {
  const response = await request(path, { raw: true, headers: { Accept: '*/*' } })
  const disposition = response.headers.get('content-disposition') || ''
  let filename = fallbackName || `reporte_${Date.now()}.xlsx`
  const star = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  const plain = disposition.match(/filename="?([^";]+)"?/i)
  if (star) filename = decodeURIComponent(star[1])
  else if (plain) filename = plain[1]

  const blob = await response.blob()
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
  return { success: true, filename }
}

/** Mensaje legible para mostrar al usuario a partir de cualquier error. */
export const getErrorMessage = (error, fallback = 'Ocurrió un error inesperado.') => {
  if (!error) return fallback
  if (error instanceof ApiError) return error.message
  return error.message || fallback
}
