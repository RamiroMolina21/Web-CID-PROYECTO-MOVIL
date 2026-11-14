// Configuración (Mi cuenta + Cambiar contraseña) para los 4 roles.
// El cambio de contraseña se prueba SOLO con un Docente [PRUEBA] creado y borrado por la API.
import { test, expect } from '@playwright/test'
import {
  abrirConSesion,
  apiComo,
  creds,
  expectAccessible,
  expectNoHorizontalScroll,
  limpiarPrueba,
  login,
  PREFIJO,
  requireRole,
  sesionDe,
} from './helpers'

for (const rol of ['admin', 'auxiliar', 'docente', 'tutor']) {
  test(`Configuración disponible para ${rol} @responsive`, async ({ page }) => {
    requireRole(test, rol)
    await login(page, rol)
    await expect(page.locator('a[href="/configuracion"]')).toHaveCount(1)
    await page.locator('a[href="/configuracion"]').evaluate((a) => a.click())
    await expect(page).toHaveURL(/\/configuracion$/)
    await expect(page.getByRole('heading', { name: 'Configuración', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible()
    await expect(page.locator('.cuenta__datos')).toContainText(creds(rol).email)
    await expect(page.getByRole('heading', { name: 'Cambiar contraseña' })).toBeVisible()
    await expect(page.getByLabel('Contraseña actual', { exact: true })).toHaveAttribute('autocomplete', 'current-password')
    await expect(page.getByLabel('Nueva contraseña', { exact: true })).toHaveAttribute('autocomplete', 'new-password')
    await expectAccessible(page)
    await expectNoHorizontalScroll(page)
  })
}

test.describe.serial('Cambiar contraseña (usuario [PRUEBA])', () => {
  let admin
  const sello = Date.now().toString(36)
  const correo = `prueba.clave.${sello}@cecar.test`
  const clave1 = `Inicial-${sello}-a1`
  const clave2 = `Nueva-${sello}-b2`
  let sesion

  test.beforeAll(async ({ playwright }, info) => {
    test.skip(info.project.name !== 'desktop', 'Se ejecuta una vez (desktop): límite de 5 intentos/15 min por usuario')
    // Puede esperar su turno de login (límite de 10/min por IP en el backend; ver helpers.esperarTurnoLogin)
    test.setTimeout(150_000)
    requireRole(test, 'admin')
    admin = await apiComo(playwright, 'admin')
    const r = await admin.post('/Usuario', { nombres: `${PREFIJO} Clave`, apellidos: `E2E ${sello}`, correo, contrasena: clave1, rolId: 3 })
    expect(r.status).toBe(201)
    const login = await sesionDe(correo, clave1)
    expect(login.status).toBe(200)
    sesion = login.sesion
  })

  test.afterAll(async () => {
    if (!admin) return
    const r = await limpiarPrueba(admin)
    expect(r.errores).toEqual([])
    await admin.dispose()
  })

  const llenar = async (page, actual, nueva, confirmar = nueva) => {
    await page.getByLabel('Contraseña actual', { exact: true }).fill(actual)
    await page.getByLabel('Nueva contraseña', { exact: true }).fill(nueva)
    await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill(confirmar)
  }

  test('confirmación distinta e igual al correo: validación en cliente, sin petición', async ({ page }) => {
    const puts = []
    page.on('request', (r) => r.method() === 'PUT' && r.url().endsWith('/Auth/contrasena') && puts.push(r))
    await abrirConSesion(page, sesion, '/configuracion')

    await llenar(page, clave1, clave2, `${clave2}x`)
    await page.getByRole('button', { name: 'Actualizar contraseña' }).click()
    await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible()

    await llenar(page, clave1, correo.toUpperCase())
    await expect(page.locator('.requisitos li', { hasText: 'Distinta de tu correo' })).not.toHaveClass(/is-ok/)
    await page.getByRole('button', { name: 'Actualizar contraseña' }).click()
    await expect(page.getByText('La nueva contraseña no cumple los requisitos.')).toBeVisible()
    expect(puts).toHaveLength(0)

    // El servidor también lo rechaza (regla del contrato)
    const r = await fetch(`${process.env.E2E_API_URL}/Auth/contrasena`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.token}` },
      body: JSON.stringify({ contrasenaActual: clave1, contrasenaNueva: correo }),
    })
    expect(r.status).toBe(400)
    expect((await r.json()).message).toMatch(/igual a su correo/i)
  })

  test('contraseña actual incorrecta: error en el campo y la sesión sigue abierta', async ({ page }) => {
    await abrirConSesion(page, sesion, '/configuracion')
    await llenar(page, 'NoEsLaActual-123', clave2)
    await page.getByRole('button', { name: 'Actualizar contraseña' }).click()
    await expect(page.locator('#cfg-actual-error')).toHaveText('La contraseña actual no es correcta')
    await expect(page.getByLabel('Contraseña actual', { exact: true })).toBeFocused()
    await expect(page).toHaveURL(/\/configuracion$/)
  })

  test('éxito: toast, la sesión sigue válida y el login funciona con la nueva', async ({ page }) => {
    test.setTimeout(150_000) // los logins de comprobación esperan turno (10/min por IP)
    await abrirConSesion(page, sesion, '/configuracion')
    await page.getByRole('button', { name: 'Mostrar nueva contraseña' }).click()
    await llenar(page, clave1, clave2)
    await expect(page.locator('.requisitos li.is-ok')).toHaveCount(5)
    await expectAccessible(page)
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/Auth/contrasena')),
      page.getByRole('button', { name: 'Actualizar contraseña' }).click(),
    ])
    expect(resp.status()).toBe(204)
    expect(resp.request().postDataJSON()).toEqual({ contrasenaActual: clave1, contrasenaNueva: clave2 })
    await expect(page.getByText('Contraseña actualizada')).toBeVisible()
    await expect(page.getByLabel('Contraseña actual', { exact: true })).toHaveValue('')

    // La sesión sigue válida
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Configuración', level: 1 })).toBeVisible()

    // Login con la nueva funciona y con la anterior no
    expect((await sesionDe(correo, clave2)).status).toBe(200)
    expect((await sesionDe(correo, clave1)).status).toBe(401)
  })
})
