import { expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs'
import path from 'node:path'

const PREFIX = { admin: 'ADMIN', auxiliar: 'AUX', docente: 'DOCENTE', tutor: 'TUTOR', estudiante: 'ESTUDIANTE' }

/** Credenciales de un rol desde el entorno. null si no están definidas. */
export const creds = (rol) => {
  const p = PREFIX[rol]
  const email = process.env[`E2E_${p}_EMAIL`]
  const password = process.env[`E2E_${p}_PASSWORD`]
  return email && password ? { email, password } : null
}

export const hasBackend = () => !!process.env.E2E_API_URL

/** Salta el test si no hay backend o credenciales para el rol. */
export const requireRole = (test, rol) => {
  test.skip(!hasBackend() || !creds(rol), `Requiere E2E_API_URL y credenciales de ${rol} (ver .env.e2e.example)`)
}

// ---------- Sesiones y límite de intentos de login (10/min por IP en el backend) ----------
const AUTH_DIR = path.resolve(process.cwd(), 'e2e/.auth')
const SESIONES = path.join(AUTH_DIR, 'sesiones.json')
const INTENTOS = path.join(AUTH_DIR, 'intentos.json')
const MAX_POR_VENTANA = 8
const VENTANA_MS = 65_000

const leerJson = (f, def) => {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return def }
}
const escribirJson = (f, v) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  fs.writeFileSync(f, JSON.stringify(v))
}

/** Espera si se alcanzaría el límite de logins del backend (429). */
export const esperarTurnoLogin = async () => {
  for (;;) {
    const ahora = Date.now()
    const recientes = leerJson(INTENTOS, []).filter((t) => ahora - t < VENTANA_MS)
    if (recientes.length < MAX_POR_VENTANA) {
      escribirJson(INTENTOS, [...recientes, ahora])
      return
    }
    await new Promise((r) => setTimeout(r, recientes[0] + VENTANA_MS - ahora + 250))
  }
}

/** Sesión {token, expiresAt, usuario} del rol, reutilizada entre pruebas (un login por rol). */
export const obtenerSesion = async (rol) => {
  const cache = leerJson(SESIONES, {})
  const s = cache[rol]
  if (s && Date.parse(s.expiresAt) - Date.now() > 10 * 60_000) return s
  const c = creds(rol)
  await esperarTurnoLogin()
  const res = await fetch(`${process.env.E2E_API_URL}/Auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: c.email, contrasena: c.password }),
  })
  if (!res.ok) throw new Error(`Login API ${rol}: ${res.status}`)
  const { token, expiresAt, usuario } = await res.json()
  const sesion = { token, expiresAt, usuario }
  escribirJson(SESIONES, { ...leerJson(SESIONES, {}), [rol]: sesion })
  return sesion
}

/** Login por API de una cuenta concreta (p. ej. un usuario [PRUEBA]); respeta el límite de intentos. */
export const sesionDe = async (email, password) => {
  await esperarTurnoLogin()
  const res = await fetch(`${process.env.E2E_API_URL}/Auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: email, contrasena: password }),
  })
  const body = await res.json().catch(() => null)
  return { status: res.status, sesion: res.ok ? { token: body.token, expiresAt: body.expiresAt, usuario: body.usuario } : null }
}

/** Abre la app con una sesión ya obtenida. */
export const abrirConSesion = async (page, sesion, ruta) => {
  await page.goto('/login')
  await page.evaluate((s) => localStorage.setItem('tutorpro.session.v1', JSON.stringify(s)), sesion)
  await page.goto(ruta)
  await expect(page.locator('#contenido')).toBeVisible()
}

/** Abre la app con la sesión del rol ya iniciada (restaura y valida con /Auth/me). */
export const login = async (page, rol) => {
  const sesion = await obtenerSesion(rol)
  await page.goto('/login')
  await page.evaluate((s) => localStorage.setItem('tutorpro.session.v1', JSON.stringify(s)), sesion)
  await page.goto(HOME[rol])
  await expect(page.locator('#contenido')).toBeVisible()
}

/** Login real por el formulario (respeta el límite de intentos). */
export const loginUI = async (page, rol, { email, password } = {}) => {
  const c = email ? { email, password } : creds(rol)
  await esperarTurnoLogin()
  await page.goto('/login')
  await page.getByLabel('Correo institucional').fill(c.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(c.password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
}

export const HOME = { admin: '/', auxiliar: '/', docente: '/agenda', tutor: '/mis-tutorias' }

/** Sin violaciones serias o críticas de WCAG 2.x A/AA. */
export const expectAccessible = async (page, { exclude = [] } = {}) => {
  // Se analiza en reposo: durante la animación de entrada de un diálogo (opacidad) axe mide mal el contraste
  await page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running' || x.effect?.getTiming().iterations === Infinity))
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
  for (const sel of exclude) builder = builder.exclude(sel)
  const { violations } = await builder.analyze()
  const graves = violations.filter((v) => ['serious', 'critical'].includes(v.impact))
  expect(graves.map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}

export const expectNoHorizontalScroll = async (page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

/** Registra peticiones a la API para aserciones de red. */
export const trackApi = (page) => {
  const calls = []
  page.on('request', (req) => {
    const url = req.url()
    if (url.includes('/api/')) calls.push({ method: req.method(), path: url.split('/api')[1], headers: req.headers() })
  })
  return calls
}

// ---------- API directa (solo para preparar y limpiar datos [PRUEBA]) ----------
export const PREFIJO = '[PRUEBA]'

export const apiUrl = (path) => `${process.env.E2E_API_URL}${path}`

/** Contexto de API autenticado como `rol` (usa el `request` de Playwright). */
export const apiComo = async (playwright, rol) => {
  const ctx = await playwright.request.newContext()
  const { token, usuario } = await obtenerSesion(rol)
  const headers = { Authorization: `Bearer ${token}` }
  const call = async (method, path, data) => {
    const r = await ctx.fetch(apiUrl(path), { method, headers, data })
    const text = await r.text()
    let body = null
    try { body = text ? JSON.parse(text) : null } catch { body = text }
    return { status: r.status(), body }
  }
  return {
    usuario,
    token,
    get: (p) => call('GET', p),
    post: (p, d) => call('POST', p, d),
    put: (p, d) => call('PUT', p, d),
    patch: (p, d) => call('PATCH', p, d),
    del: (p) => call('DELETE', p),
    dispose: () => ctx.dispose(),
  }
}

const pad = (n) => String(n).padStart(2, '0')
/** Fecha local YYYY-MM-DD a `dias` de hoy. */
export const fechaEnDias = (dias) => {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Crea un horario [PRUEBA] del Docente por la API (como Administrador). Sin cupos salvo que se indiquen. */
export const crearHorarioPrueba = async (admin, { titulo, fecha, horaInicio = '08:00', horaFin = '09:00', cupos, usuarioId }) => {
  const r = await admin.post('/Horario', {
    titulo: `${PREFIJO} ${titulo}`,
    fechaInicio: `${fecha}T00:00:00`,
    fechaFin: `${fecha}T23:59:59`,
    horaInicio: `${fecha}T${horaInicio}:00`,
    horaFin: `${fecha}T${horaFin}:00`,
    // Contrato: cupos del horario opcional (la capacidad va en la tutoría); solo se envía si el test lo pide
    ...(cupos !== undefined ? { cupos } : {}),
    espacio: `${PREFIJO} Sala E2E`,
    estado: 'Disponible',
    usuarioId,
  })
  if (r.status !== 201) throw new Error(`POST Horario ${r.status}: ${JSON.stringify(r.body)}`)
  return r.body
}

/**
 * Borra TODO lo marcado [PRUEBA]: tutorías (por tema o por horario [PRUEBA]), luego horarios, luego usuarios.
 * No toca ningún otro registro.
 */
export const limpiarPrueba = async (admin) => {
  const errores = []
  const horarios = ((await admin.get('/Horario')).body || []).filter((h) => (h.titulo || '').startsWith(PREFIJO))
  const idsHorario = new Set(horarios.map((h) => h.idHorario))
  const tutorias = ((await admin.get('/Tutoria')).body || []).filter(
    (t) => (t.tema || '').startsWith(PREFIJO) || idsHorario.has(t.horarioId)
  )
  for (const t of tutorias) {
    const r = await admin.del(`/Tutoria/${t.idTutoria}`)
    if (r.status !== 200 && r.status !== 404) errores.push(`Tutoria ${t.idTutoria}: ${r.status}`)
  }
  for (const h of horarios) {
    const r = await admin.del(`/Horario/${h.idHorario}`)
    if (r.status !== 200 && r.status !== 404) errores.push(`Horario ${h.idHorario}: ${r.status}`)
  }
  const usuarios = ((await admin.get('/Usuario')).body || []).filter((u) => (u.nombres || '').startsWith(PREFIJO))
  for (const u of usuarios) {
    const r = await admin.del(`/Usuario/${u.idUsuario}`)
    if (r.status !== 200 && r.status !== 404) errores.push(`Usuario ${u.idUsuario}: ${r.status}`)
  }
  return { tutorias: tutorias.length, horarios: horarios.length, usuarios: usuarios.length, errores }
}
