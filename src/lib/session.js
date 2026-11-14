// Persistencia de la sesión: una sola clave versionada en localStorage.
// Trade-off documentado en docs/migracion-maui-web.md §4.2 (Bearer sin cookies httpOnly).
export const SESSION_KEY = 'tutorpro.session.v1'
const LEGACY_KEYS = ['authToken', 'user']

export const readSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s?.token || !s?.expiresAt || !s?.usuario) return null
    return s
  } catch {
    return null
  }
}

export const writeSession = (session) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* almacenamiento no disponible: la sesión vive solo en memoria */
  }
}

export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY)
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* noop */
  }
}

export const msHastaExpirar = (expiresAt) => {
  const t = Date.parse(expiresAt)
  return Number.isNaN(t) ? 0 : t - Date.now()
}

/**
 * Cuenta desactivada (contrato: login → 403 y token ya emitido → 401, ambos con este mensaje).
 * Se reconoce por el mensaje del servidor: "La cuenta está desactivada. Contacte con un administrador".
 */
export const esCuentaDesactivada = (err) => /cuenta est[aá] desactivada/i.test(err?.message || '')
export const MENSAJE_DESACTIVADA = 'La cuenta está desactivada. Contacte con un administrador.'
