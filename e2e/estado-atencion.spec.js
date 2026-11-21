// Cuentas activas/inactivas (Usuarios, login) y "Atendido" en el dashboard. Datos [PRUEBA] y marcas de atendido
// creados aquí se borran al final (las marcas por DELETE /Atencion/atendidos).
import { test, expect } from '@playwright/test'
import {
  abrirConSesion,
  apiComo,
  crearHorarioPrueba,
  expectAccessible,
  fechaEnDias,
  limpiarPrueba,
  login,
  loginUI,
  PREFIJO,
  requireRole,
  sesionDe,
} from './helpers'

const sello = Date.now().toString(36)
const DOCENTE_ID = Number(process.env.E2E_DOCENTE_ID || 18)
const CONFIRMACION = '¿Está seguro de que ya le dio atención al asunto?'
const TIPOS = [
  'tutorias-vencidas',
  'proximas-sin-estudiantes',
  'horarios-libres-7d',
  'horarios-vencidos-disponibles',
  'finalizadas-sin-calificacion',
  'encuestas-sin-responder',
]

const crearUsuario = async (admin, { nombres, apellidos, rolId, sufijo }) => {
  const correo = `prueba.estado.${sello}.${sufijo}@cecar.test`
  const contrasena = `Estado-${sello}-${sufijo}x`
  const r = await admin.post('/Usuario', { nombres, apellidos, correo, contrasena, rolId })
  expect(r.status, JSON.stringify(r.body)).toBe(201)
  return { ...r.body, contrasena }
}

test.describe('U-E cuentas activas e inactivas [PRUEBA]', () => {
  let admin
  let estudiante
  let docente

  test.beforeAll(async ({ playwright }) => {
    requireRole(test, 'admin')
    admin = await apiComo(playwright, 'admin')
    estudiante = await crearUsuario(admin, { nombres: `${PREFIJO} José`, apellidos: `Núñez ${sello}`, rolId: 4, sufijo: 'est' })
    docente = await crearUsuario(admin, { nombres: `${PREFIJO} Docente`, apellidos: `Estado ${sello}`, rolId: 3, sufijo: 'doc' })
  })

  test.afterAll(async () => {
    if (!admin) return
    const r = await limpiarPrueba(admin)
    expect(r.errores).toEqual([])
    await admin.dispose()
  })

  test('Admin: búsqueda en el servidor sin tildes, X-Total-Count, badge, filtro y desactivar/activar', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/estudiantes')
    const tarjetas = page.locator('.estudiante-card')
    await expect(tarjetas.first()).toBeVisible()

    // "nunez jose" encuentra "José Núñez": búsqueda en el servidor (cada palabra, sin tildes ni mayúsculas)
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/Usuario?') && r.url().includes(`q=NUNEZ+jose+${sello}`)),
      page.getByPlaceholder(/Buscar por nombre/).fill(`NUNEZ jose ${sello}`),
    ])
    expect(resp.status()).toBe(200)
    expect(resp.headers()['x-total-count']).toBe('1')
    const card = tarjetas.filter({ hasText: `Núñez ${sello}` })
    await expect(card).toHaveCount(1)
    await expect(tarjetas).toHaveCount(1)
    await expect(page.locator('.usuarios-count')).toContainText('Mostrando 1 de 1 usuarios')
    await expect(card.locator('.cuenta-badge')).toHaveText('Activa')

    // Desactivar con confirmación → PATCH /estado
    await card.getByRole('button', { name: /Desactivar/ }).click()
    const dlg = page.getByRole('alertdialog', { name: 'Desactivar cuenta' })
    await expect(dlg).toBeVisible()
    const [patch] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/api/Usuario/${estudiante.idUsuario}/estado`) && r.request().method() === 'PATCH'),
      dlg.getByRole('button', { name: 'Desactivar' }).click(),
    ])
    expect(patch.status()).toBe(200)
    expect((await patch.json()).activo).toBe(false)
    await expect(card.locator('.cuenta-badge')).toHaveText('Inactiva')

    // Filtro por estado (en el servidor)
    await page.getByRole('button', { name: 'Activos', exact: true }).click()
    await expect(tarjetas).toHaveCount(0)
    await expect(page.locator('.usuarios-count')).toContainText('Mostrando 0 de 0 usuarios')
    await page.getByRole('button', { name: 'Inactivos', exact: true }).click()
    await expect(card).toHaveCount(1)

    // Reactivar (sin confirmación)
    await card.getByRole('button', { name: /Activar/ }).click()
    await expect(card).toHaveCount(0) // ya no cumple el filtro "Inactivos"
    await page.getByRole('button', { name: 'Todos', exact: true }).click()
    await expect(tarjetas.filter({ hasText: `Núñez ${sello}` }).locator('.cuenta-badge')).toHaveText('Activa')

    // Nadie se desactiva a sí mismo: la tarjeta del admin no ofrece la acción
    await page.getByPlaceholder(/Buscar por nombre/).fill(process.env.E2E_ADMIN_EMAIL)
    const propia = tarjetas.filter({ hasText: process.env.E2E_ADMIN_EMAIL })
    await expect(propia).toHaveCount(1)
    await expect(propia.getByRole('button', { name: /Desactivar|Activar/ })).toHaveCount(0)
    await expectAccessible(page)
  })

  test('Auxiliar: activa/desactiva solo Estudiantes; al personal solo lo edita', async ({ page }) => {
    requireRole(test, 'auxiliar')
    await login(page, 'auxiliar')
    await page.goto('/estudiantes')
    await page.getByPlaceholder(/Buscar por nombre/).fill(sello)
    const tarjetas = page.locator('.estudiante-card')
    await expect(tarjetas).toHaveCount(2)
    await expect(tarjetas.filter({ hasText: `Núñez ${sello}` }).getByRole('button', { name: /Desactivar/ })).toHaveCount(1)
    const personal = tarjetas.filter({ hasText: `Estado ${sello}` })
    await expect(personal.getByRole('button', { name: /Desactivar|Activar|Eliminar/ })).toHaveCount(0)
    await expect(personal.getByRole('button', { name: /Editar/ })).toHaveCount(1)
  })

  test('cuenta desactivada: el login lo explica y una sesión abierta se cierra con ese motivo', async ({ page }) => {
    // 1) Sesión abierta del Docente [PRUEBA] y luego se desactiva: la siguiente petición da 401 con el motivo
    const { status, sesion } = await sesionDe(docente.correo, docente.contrasena)
    expect(status).toBe(200)
    await abrirConSesion(page, sesion, '/mis-tutorias')
    await expect(page).toHaveURL(/\/mis-tutorias$/)
    const off = await admin.patch(`/Usuario/${docente.idUsuario}/estado`, { activo: false })
    expect(off.status).toBe(200)
    await page.reload()
    await expect(page).toHaveURL(/\/login\?.*motivo=desactivada/)
    await expect(page.getByRole('status').filter({ hasText: 'La cuenta está desactivada. Contacte con un administrador.' })).toBeVisible()

    // 2) Login de la cuenta desactivada: 403 con el mensaje del servidor (no "sin acceso")
    await loginUI(page, 'docente', { email: docente.correo, password: docente.contrasena })
    await expect(page.getByRole('alert')).toContainText('La cuenta está desactivada. Contacte con un administrador.')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('A-E dashboard: "Atendido" en cada tipo de asunto [PRUEBA]', () => {
  let admin

  test.beforeAll(async ({ playwright }) => {
    requireRole(test, 'admin')
    admin = await apiComo(playwright, 'admin')
    const tutoria = async (horario, fecha, hora, etiqueta) => {
      const r = await admin.post('/Tutoria', {
        idioma: `${PREFIJO} ${etiqueta} ${sello}`, nivel: 'A1', tema: `${PREFIJO} Atencion ${etiqueta} ${sello}`, modalidad: 'Virtual',
        estado: 'Pendiente', fechaTutoria: `${fecha}T${hora}:00`, usuarioId: DOCENTE_ID, horarioId: horario.idHorario, cupos: 3,
      })
      expect(r.status, JSON.stringify(r.body)).toBe(201)
      return r.body
    }
    // tutorias-vencidas
    const ayer = fechaEnDias(-1)
    await tutoria(await crearHorarioPrueba(admin, { titulo: `At vencida ${sello}`, fecha: ayer, usuarioId: DOCENTE_ID }), ayer, '08:00', 'Vencida')
    // proximas-sin-estudiantes
    const manana = fechaEnDias(1)
    await tutoria(await crearHorarioPrueba(admin, { titulo: `At vacia ${sello}`, fecha: manana, horaInicio: '06:00', horaFin: '06:45', usuarioId: DOCENTE_ID }), manana, '06:00', 'Vacia')
    // horarios-libres-7d y horarios-vencidos-disponibles
    await crearHorarioPrueba(admin, { titulo: `At libre ${sello}`, fecha: fechaEnDias(3), horaInicio: '06:00', horaFin: '06:30', usuarioId: DOCENTE_ID })
    await crearHorarioPrueba(admin, { titulo: `At vencido ${sello}`, fecha: fechaEnDias(-2), horaInicio: '06:00', horaFin: '06:30', usuarioId: DOCENTE_ID })
    // finalizadas-sin-calificacion + encuestas-sin-responder: finalizada sin cuerpo, con un estudiante [PRUEBA]
    const est = await admin.post('/Usuario', {
      nombres: `${PREFIJO} Encuesta`, apellidos: `Atencion ${sello}`, correo: `prueba.atencion.${sello}@cecar.test`, contrasena: `Aten-${sello}-x1`, rolId: 4,
    })
    expect(est.status).toBe(201)
    const hace3 = fechaEnDias(-3)
    const fin = await tutoria(await crearHorarioPrueba(admin, { titulo: `At finalizada ${sello}`, fecha: hace3, usuarioId: DOCENTE_ID }), hace3, '08:00', 'Finalizada')
    expect((await admin.post(`/Tutoria/${fin.idTutoria}/estudiantes`, { estudianteIds: [est.body.idUsuario] })).status).toBe(200)
    expect((await admin.put(`/Tutoria/${fin.idTutoria}/finalizar`)).status).toBe(200)
  })

  test.afterAll(async () => {
    if (!admin) return
    // Borra TODAS las marcas creadas (la BD partía de 0 atendidos)
    const marcas = (await admin.get('/Atencion/atendidos')).body || []
    for (const m of marcas) {
      const r = await admin.del(`/Atencion/atendidos/${m.tipo}/${m.clave}`)
      expect(r.status).toBe(204)
    }
    expect(((await admin.get('/Atencion/atendidos')).body || []).length).toBe(0)
    const r = await limpiarPrueba(admin)
    expect(r.errores).toEqual([])
    await admin.dispose()
  })

  test('cada tipo: botón verde "Atendido", confirmación exacta, persiste tras recargar y se puede deshacer', async ({ page }) => {
    await login(page, 'admin')
    await expect(page.locator('.dash-panel[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 })
    const zona = page.locator('.dash-area-attention')
    // El historial (atendidos y su "Deshacer") está en un panel plegado
    const abrirHistorial = async () => {
      const b = zona.locator('.att-history__toggle')
      if ((await b.getAttribute('aria-expanded')) === 'false') await b.click()
    }

    // Todos los tipos aparecen y tienen su botón "Atendido"
    for (const tipo of TIPOS) {
      await expect(zona.locator(`.att-item[data-tipo="${tipo}"]`).getByRole('button', { name: /^Atendido/ })).toBeVisible()
    }
    const verde = await zona.locator('.btn-atendido').first().evaluate((b) => getComputedStyle(b).backgroundColor)
    expect(verde).toBe('rgb(220, 252, 231)') // --success-bg (tema claro)

    // Cancelar no marca nada
    await zona.locator('.att-item[data-tipo="horarios-libres-7d"]').getByRole('button', { name: /^Atendido/ }).click()
    const dlg = page.getByRole('alertdialog', { name: CONFIRMACION })
    await expect(dlg).toBeVisible()
    await dlg.getByRole('button', { name: 'Cancelar' }).click()
    await expect(zona.locator('.att-item[data-tipo="horarios-libres-7d"]')).toBeVisible()

    // Marcar cada tipo
    for (const tipo of TIPOS) {
      await zona.locator(`.att-item[data-tipo="${tipo}"]`).getByRole('button', { name: /^Atendido/ }).click()
      await expect(dlg).toBeVisible()
      await expect(dlg.getByRole('heading', { name: CONFIRMACION })).toBeVisible()
      const [post] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith('/api/Atencion/atendidos') && r.request().method() === 'POST'),
        dlg.getByRole('button', { name: 'Sí, ya lo atendí' }).click(),
      ])
      expect(post.status()).toBe(200)
      expect(post.request().postDataJSON().tipo).toBe(tipo)
      await expect(zona.locator(`.att-item[data-tipo="${tipo}"]`)).toHaveCount(0)
      await abrirHistorial()
      await expect(zona.locator(`.att-done__item[data-tipo="${tipo}"]`)).toContainText('Atendido por')
    }
    await expectAccessible(page)

    // Persisten tras recargar (servidor)
    await page.reload()
    await expect(page.locator('.dash-panel[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 })
    await abrirHistorial()
    for (const tipo of TIPOS) {
      await expect(zona.locator(`.att-done__item[data-tipo="${tipo}"]`)).toBeVisible()
      await expect(zona.locator(`.att-item[data-tipo="${tipo}"]`)).toHaveCount(0)
    }

    // Deshacer devuelve el asunto a pendientes
    for (const tipo of TIPOS) {
      await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/api/Atencion/atendidos/${tipo}/`) && r.request().method() === 'DELETE'),
        zona.locator(`.att-done__item[data-tipo="${tipo}"]`).getByRole('button', { name: /Deshacer/ }).click(),
      ])
      await expect(zona.locator(`.att-item[data-tipo="${tipo}"]`)).toBeVisible()
    }
    await expect(zona.locator('.att-done__item')).toHaveCount(0)
  })

  test('si falla /Atencion/atendidos, el bloque sigue mostrando los asuntos', async ({ page }) => {
    await page.route(/\/api\/Atencion\/atendidos$/, (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Fallo simulado' }) })
        : route.continue()
    )
    await login(page, 'admin')
    const zona = page.locator('.dash-area-attention')
    await expect(zona.getByText('No se pudo revisar: asuntos ya atendidos')).toBeVisible()
    await expect(zona.locator('.att-item[data-tipo="tutorias-vencidas"]')).toBeVisible()
    await expect(zona.locator('.btn-atendido').first()).toBeVisible()
  })
})
