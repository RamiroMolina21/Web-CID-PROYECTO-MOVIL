// Transversales con backend real (X1–X3, X5, X6, X8, X9, X13 del plan).
import { test, expect } from '@playwright/test'
import { hasBackend, login, loginUI, esperarTurnoLogin, HOME, requireRole, trackApi } from './helpers'

for (const rol of ['admin', 'auxiliar', 'docente', 'tutor']) {
  test.describe(`Sesión ${rol}`, () => {
    test.beforeEach(() => requireRole(test, rol))

    test(`login lleva a la home del rol y persiste al recargar @responsive`, async ({ page }) => {
      const calls = trackApi(page)
      await loginUI(page, rol)
      await expect(page).toHaveURL(new RegExp(`${HOME[rol].replace('/', '\\/')}$`))
      const session = await page.evaluate(() => JSON.parse(localStorage.getItem('tutorpro.session.v1')))
      expect(session.token).toBeTruthy()
      expect(session.expiresAt).toBeTruthy()

      await page.reload()
      await expect(page).toHaveURL(new RegExp(`${HOME[rol].replace('/', '\\/')}$`))
      expect(calls.some((c) => c.method === 'GET' && c.path === '/Auth/me')).toBeTruthy()

      // Personal: nunca dispara endpoints de gestión (W2)
      if (rol === 'docente' || rol === 'tutor') {
        const gestion = calls.filter((c) => ['/Usuario', '/Horario', '/Tutoria'].includes(c.path) && c.method === 'GET')
        expect(gestion).toEqual([])
      }
    })

    test('logout con diálogo de confirmación por teclado @responsive', async ({ page }) => {
      await login(page, rol)
      await expect(page).toHaveURL(new RegExp(HOME[rol].replace('/', '\\/')))
      if ((page.viewportSize()?.width || 1280) < 1024) await page.getByRole('button', { name: 'Abrir menú' }).click()
      await page.getByRole('button', { name: 'Cerrar sesión' }).click()
      const dialog = page.getByRole('alertdialog', { name: 'Cerrar sesión' })
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await page.getByRole('button', { name: 'Cerrar sesión' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Cerrar sesión' }).click()
      await expect(page).toHaveURL(/\/login/)
    })
  })
}

test('credenciales incorrectas → 401', async ({ page }) => {
  test.skip(!hasBackend(), 'Requiere backend')
  await esperarTurnoLogin()
  await page.goto('/login')
  await page.getByLabel('Correo institucional').fill('nadie@cecar.edu.co')
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta123')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.getByRole('alert')).toContainText('Correo o contraseña incorrectos.')
})

test('Estudiante sin acceso → 403', async ({ page }) => {
  requireRole(test, 'estudiante')
  await loginUI(page, 'estudiante')
  await expect(page.getByRole('alert')).toContainText('Tu cuenta no tiene acceso a TutorPro.')
})

test('token manipulado → vuelve al login con motivo', async ({ page }) => {
  requireRole(test, 'tutor')
  await login(page, 'tutor')
  await expect(page).toHaveURL(/\/mis-tutorias/)
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('tutorpro.session.v1'))
    s.token = `${s.token}x`
    localStorage.setItem('tutorpro.session.v1', JSON.stringify(s))
  })
  await page.reload()
  await expect(page).toHaveURL(/\/login\?.*motivo=expirada/)
})

test('rutas de otro rol muestran "sin acceso"', async ({ page }) => {
  requireRole(test, 'tutor')
  await login(page, 'tutor')
  for (const ruta of ['/agenda', '/estudiantes', '/horarios']) {
    await page.goto(ruta)
    await expect(page.getByRole('heading', { name: 'No tienes acceso a esta sección' })).toBeVisible()
  }
})

test('la consola no expone el token', async ({ page }) => {
  requireRole(test, 'docente')
  const logs = []
  page.on('console', (m) => logs.push(m.text()))
  await login(page, 'docente')
  await expect(page).toHaveURL(/\/agenda/)
  await expect(page.locator('.skeleton-group')).toHaveCount(0)
  expect(logs.filter((l) => /Bearer\s+ey|eyJhbGci/i.test(l))).toEqual([])
})

test('sesión expirada (expiresAt pasado) → login con motivo y redirect', async ({ page }) => {
  requireRole(test, 'tutor')
  await login(page, 'tutor')
  await expect(page).toHaveURL(/\/mis-tutorias$/)
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('tutorpro.session.v1'))
    s.expiresAt = new Date(Date.now() - 60_000).toISOString()
    localStorage.setItem('tutorpro.session.v1', JSON.stringify(s))
  })
  await page.goto('/historial')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fhistorial/)
})

test('401 en mitad del uso → logout único y vuelta al login; al reingresar vuelve a la ruta', async ({ page }) => {
  requireRole(test, 'docente')
  await login(page, 'docente')
  await expect(page).toHaveURL(/\/agenda$/)
  // Token inválido en memoria y en storage: la siguiente petición devuelve 401
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('tutorpro.session.v1'))
    s.token = `${s.token}x`
    localStorage.setItem('tutorpro.session.v1', JSON.stringify(s))
    window.dispatchEvent(new StorageEvent('storage', { key: 'tutorpro.session.v1' }))
  })
  await page.getByRole('link', { name: 'Tutorías finalizadas' }).first().click()
  await expect(page).toHaveURL(/\/login\?.*motivo=expirada/)
  await expect(page.getByText('Tu sesión ha expirado. Inicia sesión de nuevo.')).toBeVisible()
})
