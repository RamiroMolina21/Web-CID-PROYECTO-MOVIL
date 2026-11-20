// Recuperación de contraseña (contrato docs/api con Dante):
//   POST /Auth/olvide-contrasena · GET /Auth/restablecer-contrasena/validar · POST /Auth/restablecer-contrasena
// Las respuestas marcadas «simulada» usan page.route SOLO en la pestaña de la prueba (429, token válido, 204):
// provocarlas contra la API real bloquearía la cuenta o necesitaría un token del correo.
import { test, expect } from '@playwright/test'
import { apiComo, expectAccessible, expectNoHorizontalScroll, hasBackend, limpiarPrueba, loginUI, PREFIJO, sesionDe } from './helpers'
import { auditarPagina } from './responsive-helpers'

const GENERICO = 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.'
const INVALIDO = 'El enlace no es válido o ha caducado. Solicita uno nuevo.'

const json = (status, body, headers = {}) => ({
  status,
  contentType: 'application/json',
  headers,
  body: body === undefined ? '' : JSON.stringify(body),
})

const sinDefectos = async (page) => {
  const d = await auditarPagina(page)
  expect(d, JSON.stringify(d, null, 2)).toEqual({ camposPequenos: [], fuera: [], overflowDoc: 0, pequenos: [], recortados: [] })
}

test.describe('Olvidé mi contraseña', () => {
  test('el login enlaza a la recuperación @responsive', async ({ page }) => {
    await page.goto('/login')
    const enlace = page.getByRole('link', { name: '¿Olvidaste tu contraseña?' })
    await expect(enlace).toBeVisible()
    await enlace.click()
    await expect(page).toHaveURL(/\/olvide-contrasena$/)
    await expect(page.getByRole('heading', { name: '¿Olvidaste tu contraseña?', level: 1 })).toBeVisible()
    await expectAccessible(page)
    await expectNoHorizontalScroll(page)
    await sinDefectos(page)
    await page.getByRole('link', { name: /Volver a iniciar sesión/ }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('valida el correo sin llamar a la API', async ({ page }) => {
    const llamadas = []
    page.on('request', (r) => r.url().includes('/api/') && llamadas.push(r.url()))
    await page.goto('/olvide-contrasena')
    await page.getByRole('button', { name: 'Enviar enlace' }).click()
    await expect(page.getByText('Escribe tu correo institucional.')).toBeVisible()
    await page.getByLabel('Correo institucional').fill('no-es-correo')
    await page.getByRole('button', { name: 'Enviar enlace' }).click()
    await expect(page.getByText('El formato del correo no es válido.')).toBeVisible()
    await expect(page.getByLabel('Correo institucional')).toBeFocused()
    expect(llamadas).toEqual([])
  })

  test('muestra siempre el mensaje genérico (API real)', async ({ page }) => {
    test.skip(!hasBackend(), 'Requiere E2E_API_URL')
    await page.goto('/olvide-contrasena')
    // Correo inexistente: la respuesta es la misma que con uno registrado (anti-enumeración)
    await page.getByLabel('Correo institucional').fill(`no-existe.${Date.now().toString(36)}@cecar.test`)
    const [r] = await Promise.all([
      page.waitForResponse((x) => x.url().includes('/api/Auth/olvide-contrasena')),
      page.getByRole('button', { name: 'Enviar enlace' }).click(),
    ])
    expect(r.status()).toBe(200)
    await expect(page.getByRole('status').filter({ hasText: GENERICO })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible()
    await expectAccessible(page)
  })

  test('429: cuenta atrás con Retry-After y botón bloqueado (simulada)', async ({ page }) => {
    await page.route('**/api/Auth/olvide-contrasena', (route) =>
      route.fulfill(json(429, { message: 'Demasiadas solicitudes.' }, { 'Retry-After': '75', 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Retry-After' }))
    )
    await page.goto('/olvide-contrasena')
    await page.getByLabel('Correo institucional').fill('alguien@cecar.edu.co')
    await page.getByRole('button', { name: 'Enviar enlace' }).click()
    await expect(page.getByRole('alert')).toContainText(/Podrás intentarlo de nuevo en 1:1\d min/)
    await expect(page.getByRole('button', { name: 'Enviar enlace' })).toBeDisabled()
    await expectAccessible(page)
  })
})

test.describe('Restablecer contraseña', () => {
  test('sin token: enlace no válido con acceso a pedir otro', async ({ page }) => {
    await page.goto('/restablecer-contrasena')
    await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible()
    await page.getByRole('link', { name: 'Solicitar un nuevo enlace' }).click()
    await expect(page).toHaveURL(/\/olvide-contrasena$/)
  })

  test('token inválido: 400 real con el mensaje del servidor @responsive', async ({ page }) => {
    test.skip(!hasBackend(), 'Requiere E2E_API_URL')
    const [r] = await Promise.all([
      page.waitForResponse((x) => x.url().includes('/api/Auth/restablecer-contrasena/validar')),
      page.goto('/restablecer-contrasena?token=token-de-prueba-invalido'),
    ])
    expect(r.status()).toBe(400)
    await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(INVALIDO)
    await expect(page.getByRole('link', { name: 'Solicitar un nuevo enlace' })).toBeVisible()
    await expectAccessible(page)
    await expectNoHorizontalScroll(page)
  })

  test('token válido: requisitos en vivo, error del servidor en el campo y éxito al login (simulada) @responsive', async ({ page }) => {
    await page.route('**/api/Auth/restablecer-contrasena/validar**', (route) =>
      route.fulfill(json(200, { valido: true, correo: 'r***@cecar.edu.co', expiraEn: '2099-01-01T00:00:00Z' }))
    )
    let intentos = 0
    await page.route('**/api/Auth/restablecer-contrasena', (route) => {
      intentos += 1
      if (intentos === 1) {
        return route.fulfill(json(400, {
          message: 'La nueva contraseña debe ser distinta de la actual.',
          errors: { ContrasenaNueva: ['La nueva contraseña debe ser distinta de la actual.'] },
        }))
      }
      return route.fulfill({ status: 204, body: '' })
    })
    await page.goto('/restablecer-contrasena?token=simulado')
    await expect(page.getByRole('heading', { name: 'Crea una nueva contraseña' })).toBeVisible()
    await expect(page.getByText('r***@cecar.edu.co')).toBeVisible()
    await expectAccessible(page)
    await expectNoHorizontalScroll(page)
    await sinDefectos(page)

    const nueva = page.getByLabel('Nueva contraseña', { exact: true })
    await expect(nueva).toBeFocused()
    await nueva.fill('corta')
    await expect(page.getByRole('list', { name: 'Requisitos de la nueva contraseña' }).getByText('Al menos 8 caracteres')).toBeVisible()
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.getByText('La nueva contraseña no cumple los requisitos.')).toBeVisible()

    await nueva.fill('Contrasena-Nueva-1')
    await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill('otra-distinta')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible()

    await page.getByRole('button', { name: 'Mostrar confirmar nueva contraseña' }).click()
    await expect(page.getByLabel('Confirmar nueva contraseña', { exact: true })).toHaveAttribute('type', 'text')
    await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill('Contrasena-Nueva-1')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.locator('#rp-nueva-error')).toHaveText('La nueva contraseña debe ser distinta de la actual.')

    await nueva.fill('Contrasena-Nueva-2')
    await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill('Contrasena-Nueva-2')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page).toHaveURL(/\/login\?motivo=restablecida$/)
    await expect(page.getByRole('status').filter({ hasText: 'Contraseña restablecida. Inicia sesión con tu nueva contraseña.' })).toBeVisible()
    await expectAccessible(page)
  })

  test('token caducado entre la validación y el envío (simulada)', async ({ page }) => {
    await page.route('**/api/Auth/restablecer-contrasena/validar**', (route) =>
      route.fulfill(json(200, { valido: true, correo: 'r***@cecar.edu.co', expiraEn: '2099-01-01T00:00:00Z' }))
    )
    await page.route('**/api/Auth/restablecer-contrasena', (route) => route.fulfill(json(400, { message: INVALIDO })))
    await page.goto('/restablecer-contrasena?token=simulado')
    await page.getByLabel('Nueva contraseña', { exact: true }).fill('Contrasena-Nueva-1')
    await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill('Contrasena-Nueva-1')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(INVALIDO)
  })


})

// Flujo extremo a extremo con un token REAL. El enlace lo da POST /dev/restablecimiento/enlace (solo Development,
// solo cuentas «[PRUEBA]», sin enviar correo). Una vez, en desktop; el usuario [PRUEBA] se borra al final.
test.describe.serial('Restablecer con token real [PRUEBA]', () => {
  let admin
  let usuario
  const sello = Date.now().toString(36)
  const correo = `prueba.restablecer.${sello}@cecar.test`
  const inicial = `Inicial-${sello}-1`
  const nueva = `Nueva-${sello}-2`

  const pedirEnlace = async (playwright) => {
    const origen = new URL(process.env.E2E_API_URL).origin
    const ctx = await playwright.request.newContext()
    const r = await ctx.post(`${origen}/dev/restablecimiento/enlace`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { correo },
    })
    expect(r.status()).toBe(200)
    const body = await r.json()
    await ctx.dispose()
    expect(body.token).toBeTruthy()
    return body.token
  }

  test.beforeAll(async ({ playwright }, info) => {
    test.skip(info.project.name !== 'desktop' || !hasBackend(), 'Una vez, en desktop, con API')
    admin = await apiComo(playwright, 'admin')
    const r = await admin.post('/Usuario', { nombres: `${PREFIJO} Restablecer`, apellidos: `Tutor ${sello}`, correo, contrasena: inicial, rolId: 2 })
    expect(r.status).toBe(201)
    usuario = r.body
  })

  test.afterAll(async () => {
    if (!admin) return
    const r = await limpiarPrueba(admin)
    expect(r.errores).toEqual([])
    await admin.dispose()
  })

  test('restablece, invalida las sesiones anteriores y el enlace no se reutiliza', async ({ page, playwright, browser }) => {
    expect(usuario?.idUsuario).toBeTruthy()
    const antes = await sesionDe(correo, inicial)
    expect(antes.status).toBe(200)

    const token = await pedirEnlace(playwright)
    await page.goto(`/restablecer-contrasena?token=${encodeURIComponent(token)}`)
    await expect(page.getByRole('heading', { name: 'Crea una nueva contraseña' })).toBeVisible()
    await expect(page.locator('.auth-correo')).toContainText('@cecar.test')
    await expectAccessible(page)

    // Fallo de política: igual a la actual -> mensaje del servidor en el campo; el token sigue valiendo
    await page.getByLabel('Nueva contraseña', { exact: true }).fill(inicial)
    await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill(inicial)
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.locator('#rp-nueva-error')).toContainText('distinta de la actual')

    await page.getByLabel('Nueva contraseña', { exact: true }).fill(nueva)
    await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill(nueva)
    const [r] = await Promise.all([
      page.waitForResponse((x) => x.url().endsWith('/api/Auth/restablecer-contrasena') && x.request().method() === 'POST'),
      page.getByRole('button', { name: 'Guardar contraseña' }).click(),
    ])
    expect(r.status()).toBe(204)
    await expect(page).toHaveURL(/\/login\?motivo=restablecida$/)
    await expect(page.getByRole('status').filter({ hasText: 'Contraseña restablecida' })).toBeVisible()

    // El enlace ya usado no vale
    await page.goto(`/restablecer-contrasena?token=${encodeURIComponent(token)}`)
    await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible()

    // La sesión abierta antes del cambio se cierra con su motivo
    const ctx = await browser.newContext()
    const vieja = await ctx.newPage()
    await vieja.goto('/login')
    await vieja.evaluate((s) => localStorage.setItem('tutorpro.session.v1', JSON.stringify(s)), antes.sesion)
    await vieja.goto('/mis-tutorias')
    await expect(vieja).toHaveURL(/\/login\?.*motivo=contrasena-cambiada/)
    await expect(vieja.getByRole('status').filter({ hasText: 'La contraseña de la cuenta se cambió' })).toBeVisible()
    await ctx.close()

    // Inicia sesión con la nueva contraseña
    await loginUI(page, 'tutor', { email: correo, password: nueva })
    await expect(page).toHaveURL(/\/mis-tutorias$/)
  })
})
