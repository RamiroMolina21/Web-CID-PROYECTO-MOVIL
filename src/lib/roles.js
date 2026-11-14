// Roles canónicos del backend (Roles.cs). Comparación sin distinguir mayúsculas.
export const ROLES = Object.freeze({
  ADMIN: 'Administrador',
  AUXILIAR: 'Auxiliar',
  DOCENTE: 'Docente',
  TUTOR: 'Tutor',
})

export const GESTION = [ROLES.ADMIN, ROLES.AUXILIAR]
export const PERSONAL = [ROLES.DOCENTE, ROLES.TUTOR]
export const TODOS = [...GESTION, ...PERSONAL]

export const getRol = (user) => (user?.tipoRol || user?.TipoRol || '').trim()

export const tieneRol = (user, roles) => {
  const rol = getRol(user).toLowerCase()
  return roles.some((r) => r.toLowerCase() === rol)
}

/** Rol canónico o null si no es un rol con acceso. */
export const normalizarRol = (valor) =>
  TODOS.find((r) => r.toLowerCase() === (valor || '').trim().toLowerCase()) || null

export const homePorRol = (user) => {
  const rol = normalizarRol(getRol(user))
  if (rol === ROLES.DOCENTE) return '/agenda'
  if (rol === ROLES.TUTOR) return '/mis-tutorias'
  return '/'
}

export const getUserId = (user) => user?.idUsuario ?? user?.IdUsuario ?? null

export const nombreCompleto = (u) =>
  [u?.nombres || u?.Nombres || u?.usuarioNombre, u?.apellidos || u?.Apellidos || u?.usuarioApellidos]
    .filter(Boolean)
    .join(' ')
    .trim()

export const iniciales = (nombre) =>
  (nombre || '?')
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?'
