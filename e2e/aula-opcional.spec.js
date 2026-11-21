// Aula opcional (contrato con Dante, rama API feature/aula-opcional): crear horarios sin aula (simple y
// recurrente), verlos como "Aula por asignar" y agendar sobre ellos. Datos [PRUEBA], borrados al final.
// Los horarios sin aula no llevan "[PRUEBA]" en el título (el servidor lo genera sin aula), así que se borran
// explícitamente por docente antes de la limpieza general.
import { test, expect } from '@playwright/test'
import { apiComo, expectAccessible, limpiarPrueba, login, PREFIJO, requireRole, sesionDe } from './helpers'

const sello = Date.now().toString(36)
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const lunes = (() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const dia = d.getDay()
  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1) + 14)
  return d
})()
const masDias = (n) => {
  const d = new Date(lunes)
  d.setDate(d.getDate() + n)
  return iso(d)
}
// CAPTURAS=<carpeta>: capturas a 1280 y 375 px para la revisión manual
const capturar = async (page, nombre) => {
  const dir = process.env.CAPTURAS
  if (!dir) return
  const original = page.viewportSize()
  for (const ancho of [1280, 375]) {
    await page.setViewportSize({ width: ancho, height: ancho === 375 ? 812 : 900 })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${dir}/${nombre}-${ancho}.png`, fullPage: true })
  }
  await page.setViewportSize(original)
}

const TITULO_SIN_AULA = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}–\d{2}:\d{2}$/

test.describe.serial('Aula opcional [PRUEBA]', () => {
  let admin
  let docente
  const correo = `prueba.aula.${sello}@cecar.test`
  const contrasena = `Aula-${sello}-1`
  const tema = `${PREFIJO} Sin aula ${sello}`

  test.beforeAll(async ({ playwright }, info) => {
    test.skip(info.project.name !== 'desktop', 'Datos propios: una vez, en desktop')
    requireRole(test, 'admin')
    admin = await apiComo(playwright, 'admin')
    const r = await admin.post('/Usuario', { nombres: `${PREFIJO} Aula`, apellidos: `Docente ${sello}`, correo, contrasena, rolId: 3 })
    expect(r.status).toBe(201)
    docente = r.body
  })

  test.afterAll(async () => {
    if (!admin) return
    if (docente) {
      const propios = (await admin.get(`/Horario/usuario/${docente.idUsuario}`)).body || []
      const tutorias = ((await admin.get('/Tutoria')).body || []).filter((t) => propios.some((h) => h.idHorario === t.horarioId))
      for (const t of tutorias) await admin.del(`/Tutoria/${t.idTutoria}`)
      for (const h of propios) await admin.del(`/Horario/${h.idHorario}`)
    }
    const r = await limpiarPrueba(admin)
    expect(r.errores).toEqual([])
    await admin.dispose()
  })

  const abrirNuevo = async (page) => {
    await page.getByRole('button', { name: 'Nuevo Horario' }).click()
    await expect(page.getByLabel(/^Aula/)).not.toHaveAttribute('required', '')
  }

  test('crea un horario simple sin aula y se ve "Aula por asignar"', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/horarios')
    await abrirNuevo(page)
    const fecha = masDias(1)
    await page.locator('#fh-fecha').fill(fecha)
    await page.locator('#fh-horaInicio').fill('10:00')
    await page.locator('#fh-horaFin').fill('11:00')
    await page.locator('#fh-docenteId').selectOption(String(docente.idUsuario))
    await capturar(page, 'form-sin-aula')
    const [r] = await Promise.all([
      page.waitForResponse((x) => x.url().endsWith('/api/Horario') && x.request().method() === 'POST'),
      page.getByRole('button', { name: /Guardar/ }).click(),
    ])
    expect(r.status()).toBe(201)
    const body = await r.json()
    expect(body.espacio).toBe('')
    expect(body.titulo).toMatch(TITULO_SIN_AULA)

    // Calendario (semana de la fecha): nombre accesible con "Aula por asignar", nunca null/undefined
    await page.getByLabel('Docente o tutor').selectOption(String(docente.idUsuario))
    await page.getByRole('button', { name: 'Periodo siguiente' }).click()
    await page.getByRole('button', { name: 'Periodo siguiente' }).click()
    const evento = page.locator(`.cal-evento[data-fecha="${fecha}"]`)
    await expect(evento).toHaveAccessibleName(/Aula por asignar$/)
    await capturar(page, 'calendario-sin-aula')
    await expect(page.locator('#contenido')).not.toContainText(/undefined|null/)
    await evento.click()
    const dlg = page.getByRole('dialog')
    await expect(dlg).toContainText('Aula por asignar')
    await expectAccessible(page)
    await dlg.getByRole('button', { name: 'Cerrar' }).click()
  })

  test('crea un horario recurrente por franjas sin aula', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/horarios')
    await abrirNuevo(page)
    await page.getByRole('switch', { name: 'Repetir este horario' }).check()
    await page.locator('#fh-fecha').fill(masDias(0))
    await page.locator('#fh-fechaFin').fill(masDias(13))
    for (const [dia, ini, fin] of [['Martes', '13:00', '14:00'], ['Jueves', '15:00', '17:00']]) {
      await page.locator('.fh-dia').filter({ hasText: dia }).click()
      await page.getByLabel(`${dia}: hora de inicio`).fill(ini)
      await page.getByLabel(`${dia}: hora de fin`).fill(fin)
    }
    await page.locator('#fh-docenteId').selectOption(String(docente.idUsuario))
    await expect(page.getByRole('region', { name: 'Vista previa' })).toContainText('Se crearán 4 sesiones')
    const estados = []
    page.on('response', (x) => x.url().endsWith('/api/Horario') && x.request().method() === 'POST' && estados.push(x.status()))
    await page.getByRole('button', { name: /Guardar/ }).click()
    await expect.poll(() => estados.length, { timeout: 30_000 }).toBe(4)
    expect(estados.every((s) => s === 201)).toBeTruthy()
    const propios = (await admin.get(`/Horario/usuario/${docente.idUsuario}`)).body
    expect(propios).toHaveLength(5)
    expect(propios.every((h) => h.espacio === '')).toBeTruthy()
  })

  test('Agendar tutoría muestra "Aula por asignar" y agenda sobre un horario sin aula; el docente lo ve', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/agendar-tutoria')
    await page.getByLabel('Docente o tutor').selectOption(String(docente.idUsuario))
    const tabla = page.getByRole('table', { name: /Disponibilidad semanal/ })
    await expect(tabla.locator('.disp-franja__lugar').first()).toHaveText('Aula por asignar')
    const primera = page.locator('.disp-lista > li').first()
    await expect(primera).toContainText('Aula por asignar')
    await expect(primera).not.toContainText(/undefined|null|·\s*·/)
    await capturar(page, 'agendar-sin-aula')
    await expectAccessible(page)
    await primera.getByRole('button', { name: /^Agendar el / }).click()
    const modal = page.locator('.formulario-tutoria')
    await modal.locator('select[name="idioma"]').selectOption('Inglés')
    await modal.locator('select[name="modalidad"]').selectOption('Virtual')
    await modal.locator('select[name="nivel"]').selectOption('A1')
    await modal.locator('[name="tema"]').fill(tema)
    const [r] = await Promise.all([
      page.waitForResponse((x) => x.url().endsWith('/api/Tutoria') && x.request().method() === 'POST'),
      modal.getByRole('button', { name: /Agendar Tutoría/ }).click(),
    ])
    expect(r.status()).toBe(201)
    expect(r.request().postDataJSON().cupos).toBe(5) // valor por defecto del campo "Cupos máximos"
    const card = page.locator('.tutoria-card').filter({ hasText: tema })
    await card.click()
    await expect(page.getByRole('dialog')).toContainText('Aula por asignar')

    // Docente: Mis tutorías y detalle con "Aula por asignar"
    const s = await sesionDe(correo, contrasena)
    expect(s.status).toBe(200)
    await page.evaluate((x) => localStorage.setItem('tutorpro.session.v1', JSON.stringify(x)), s.sesion)
    await page.goto('/mis-tutorias')
    const fila = page.locator('.tutoria-row').filter({ hasText: tema })
    await expect(fila).toContainText('Aula por asignar')
    await fila.getByRole('link', { name: tema }).click()
    await expect(page.getByRole('definition').filter({ hasText: 'Aula por asignar' })).toBeVisible()
    await expectAccessible(page)
  })
})
