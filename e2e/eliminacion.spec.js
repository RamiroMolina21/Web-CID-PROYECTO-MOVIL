// Eliminación definitiva de usuarios (contrato fase 4): diálogo, resumen y datos compartidos "sin asignar".
// Todo es [PRUEBA] y se borra al final (la tutoría y el horario conservados sin dueño se limpian por tema/título).
import { test, expect } from '@playwright/test'
import { apiComo, crearHorarioPrueba, expectAccessible, fechaEnDias, limpiarPrueba, login, PREFIJO, requireRole } from './helpers'

const sello = Date.now().toString(36)

test.describe('E-E eliminar un Docente con una tutoría compartida [PRUEBA]', () => {
  let admin
  let docente
  let tutoria

  test.beforeAll(async ({ playwright }) => {
    requireRole(test, 'admin')
    admin = await apiComo(playwright, 'admin')
    const d = await admin.post('/Usuario', {
      nombres: `${PREFIJO} Docente`, apellidos: `Eliminable ${sello}`, correo: `prueba.elim.doc.${sello}@cecar.test`,
      contrasena: `Elim-${sello}-d1`, rolId: 3,
    })
    expect(d.status, JSON.stringify(d.body)).toBe(201)
    docente = d.body
    const e = await admin.post('/Usuario', {
      nombres: `${PREFIJO} Estudiante`, apellidos: `Compartido ${sello}`, correo: `prueba.elim.est.${sello}@cecar.test`,
      contrasena: `Elim-${sello}-e1`, rolId: 4,
    })
    expect(e.status).toBe(201)
    const fecha = fechaEnDias(5)
    const h = await crearHorarioPrueba(admin, { titulo: `Eliminacion ${sello}`, fecha, horaInicio: '06:00', horaFin: '07:00', cupos: '3', usuarioId: docente.idUsuario })
    const t = await admin.post('/Tutoria', {
      idioma: `${PREFIJO} Idioma ${sello}`, nivel: 'B1', tema: `${PREFIJO} Compartida ${sello}`, modalidad: 'Presencial', estado: 'Pendiente',
      fechaTutoria: `${fecha}T06:00:00`, usuarioId: docente.idUsuario, horarioId: h.idHorario, estudianteIds: [e.body.idUsuario],
    })
    expect(t.status, JSON.stringify(t.body)).toBe(201)
    tutoria = t.body
  })

  test.afterAll(async () => {
    if (!admin) return
    const r = await limpiarPrueba(admin)
    expect(r.errores).toEqual([])
    await admin.dispose()
  })

  test('diálogo definitivo, resumen, tutoría "Sin asignar" visible y marcada en el dashboard', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/estudiantes')
    await page.getByPlaceholder(/Buscar por nombre/).fill(`Eliminable ${sello}`)
    const card = page.locator('.estudiante-card').filter({ hasText: `Eliminable ${sello}` })
    await expect(card).toHaveCount(1)

    // Confirmación: definitivo y qué pasará con lo compartido
    await card.getByRole('button', { name: /^Eliminar/ }).click()
    const dlg = page.getByRole('alertdialog', { name: /^¿Eliminar a .*Eliminable/ })
    await expect(dlg).toBeVisible()
    await expect(dlg).toContainText('Es definitivo')
    await expect(dlg).toContainText('se conservan sin asignar')
    await expect(dlg).toContainText('Desactivar')
    await expectAccessible(page)

    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/api/Usuario/${docente.idUsuario}`) && r.request().method() === 'DELETE'),
      dlg.getByRole('button', { name: 'Eliminar definitivamente' }).click(),
    ])
    expect(resp.status()).toBe(200)
    const { resumen } = await resp.json()
    expect(resumen.tutoriasDesasignadas).toBe(1)
    expect(resumen.horariosConservados).toBe(1)

    // Resumen legible de lo ocurrido
    const res = page.getByRole('dialog', { name: /se eliminó$/ })
    await expect(res).toBeVisible()
    await expect(res).toContainText('1 tutoría quedó sin asignar')
    await expect(res).toContainText('1 horario se conservó sin responsable')
    await expectAccessible(page)
    await res.getByRole('button', { name: 'Entendido' }).click()
    await expect(card).toHaveCount(0)

    // El backend la conserva sin asignar
    const t = await admin.get(`/Tutoria/${tutoria.idTutoria}`)
    expect(t.status).toBe(200)
    expect(t.body.usuarioId).toBeNull()
    expect(t.body.estudiantes).toHaveLength(1)

    // Agendar tutoría: la tarjeta sigue y dice "Sin asignar (usuario eliminado)" (nunca null/undefined)
    await page.goto('/agendar-tutoria')
    const tarjeta = page.locator('.tutoria-card').filter({ hasText: `Compartida ${sello}` })
    await expect(tarjeta).toBeVisible()
    await expect(tarjeta).toContainText('Sin asignar (usuario eliminado)')
    await tarjeta.click()
    const detalle = page.getByRole('dialog')
    await expect(detalle).toContainText('Sin asignar (usuario eliminado)')
    await expect(detalle).not.toContainText(/undefined|null/)

    // Dashboard: asunto nuevo "sin asignar", con acción y sin "Atendido" (el backend no tiene ese tipo)
    await page.goto('/')
    await expect(page.locator('.dash-panel[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 })
    const asunto = page.locator('.att-item[data-tipo="tutorias-sin-asignar"]')
    await expect(asunto).toBeVisible()
    await expect(asunto).toContainText(/pendientes? sin asignar/)
    await expect(asunto.locator('.att-detail__row').filter({ hasText: `Idioma ${sello}` })).toContainText('Sin asignar (usuario eliminado)')
    await expect(asunto.getByRole('link', { name: 'Ver en Agendar tutoría' })).toHaveAttribute('href', '/agendar-tutoria')
    await expect(asunto.getByRole('button', { name: /^Atendido/ })).toHaveCount(0)
    await expect(page.locator('#contenido')).not.toContainText(/\bundefined\b|\bnull\b/)
    await expectAccessible(page)

    // Calendario: el horario sin dueño muestra "Usuario eliminado" en su detalle (sin romper)
    await page.goto('/horarios')
    await expect(page.locator('#contenido')).not.toContainText(/\bundefined\b|\bnull\b/)
  })
})
