// Horarios recurrentes con una franja por día (Mar 9–11, Mié 16–18, Jue 16–18) y su uso al agendar.
// Flujo completo contra la API real con datos [PRUEBA] (docente, aula y tutorías), borrados al final.
import { test, expect } from '@playwright/test'
import { apiComo, expectAccessible, expectNoHorizontalScroll, limpiarPrueba, login, PREFIJO, requireRole, sesionDe } from './helpers'

const sello = Date.now().toString(36)
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Rango: del lunes de dentro de 1–2 semanas a 20 días después -> 3 martes, 3 miércoles y 3 jueves
const inicio = (() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 7)
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1)
  return d
})()
const fin = new Date(inicio)
fin.setDate(fin.getDate() + 20)
const DESDE = iso(inicio)
const HASTA = iso(fin)

const PLAN = [
  { dia: 'Martes', js: 2, inicio: '09:00', fin: '11:00', texto: '9:00 – 11:00' },
  { dia: 'Miércoles', js: 3, inicio: '16:00', fin: '18:00', texto: '16:00 – 18:00' },
  { dia: 'Jueves', js: 4, inicio: '16:00', fin: '18:00', texto: '16:00 – 18:00' },
]
const AULA = `${PREFIJO} Aula ${sello}`
const hhmm = (v) => String(v).slice(11, 16)

// CAPTURAS=<carpeta>: guarda capturas a 1280 y 375 px para la revisión manual de diseño
const capturar = async (page, nombre) => {
  const dir = process.env.CAPTURAS
  if (!dir) return
  const original = page.viewportSize()
  for (const ancho of [1280, 375]) {
    await page.setViewportSize({ width: ancho, height: ancho === 375 ? 812 : 900 })
    await page.waitForTimeout(250)
    await page.screenshot({ path: `${dir}/${nombre}-${ancho}.png`, fullPage: true })
  }
  await page.setViewportSize(original)
}

test.describe.serial('Horario recurrente con franja por día [PRUEBA]', () => {
  let admin
  let docente
  const correo = `prueba.recurrente.${sello}@cecar.test`
  const contrasena = `Recurrente-${sello}-1`
  const temaGestion = `${PREFIJO} Recurrente gestion ${sello}`
  const temaAgenda = `${PREFIJO} Recurrente agenda ${sello}`
  let sesionDocente

  test.beforeAll(async ({ playwright }, info) => {
    test.skip(info.project.name !== 'desktop', 'Flujo con datos: una vez, en desktop')
    requireRole(test, 'admin')
    admin = await apiComo(playwright, 'admin')
    const r = await admin.post('/Usuario', { nombres: `${PREFIJO} Recurrente`, apellidos: `Docente ${sello}`, correo, contrasena, rolId: 3 })
    expect(r.status).toBe(201)
    docente = r.body
  })

  test.afterAll(async () => {
    if (!admin) return
    const r = await limpiarPrueba(admin)
    expect(r.errores).toEqual([])
    await admin.dispose()
  })

  test('Admin crea el horario recurrente con una franja por día y la vista previa cuadra', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/horarios')
    await page.getByRole('button', { name: 'Nuevo Horario' }).click()
    await page.getByRole('switch', { name: 'Repetir este horario' }).check()
    await page.locator('#fh-fecha').fill(DESDE)
    await page.locator('#fh-fechaFin').fill(HASTA)
    for (const p of PLAN) {
      await page.locator('.fh-dia').filter({ hasText: p.dia }).click()
      await page.getByLabel(`${p.dia}: hora de inicio`).fill(p.inicio)
      await page.getByLabel(`${p.dia}: hora de fin`).fill(p.fin)
    }
    await expect(page.locator('#horario-cupos')).toHaveCount(0) // los cupos se definen al agendar la tutoría
    await page.locator('#fh-salon').fill(AULA)
    await page.locator('#fh-docenteId').selectOption(String(docente.idUsuario))

    // Vista previa Día | Horario | Sesiones
    const preview = page.getByRole('region', { name: 'Vista previa' })
    for (const p of PLAN) {
      const fila = preview.getByRole('row', { name: new RegExp(`^${p.dia}`) })
      await expect(fila).toContainText(p.texto)
      await expect(fila.getByRole('cell').last()).toHaveText('3')
    }
    await expect(preview).toContainText('Se crearán 9 sesiones')
    await expectAccessible(page)
    await capturar(page, 'form-recurrente')

    // Validación: franja invertida
    await page.getByLabel('Jueves: hora de fin').fill('15:00')
    await page.getByRole('button', { name: /Guardar/ }).click()
    await expect(page.locator('#fh-franja-jueves-error')).toHaveText('En jueves la hora de fin debe ser posterior a la de inicio.')
    await expect(page.getByLabel('Jueves: hora de inicio')).toBeFocused()
    await page.getByLabel('Jueves: hora de fin').fill('18:00')

    const posts = []
    page.on('response', (r) => r.url().endsWith('/api/Horario') && r.request().method() === 'POST' && posts.push(r.status()))
    await page.getByRole('button', { name: /Guardar/ }).click()
    await expect.poll(() => posts.length, { timeout: 30_000 }).toBe(9)
    expect(posts.every((s) => s === 201)).toBeTruthy()

    // La API tiene 9 sesiones con la franja de su día
    const r = await admin.get(`/Horario/usuario/${docente.idUsuario}`)
    expect(r.status).toBe(200)
    expect(r.body).toHaveLength(9)
    for (const h of r.body) {
      const d = new Date(`${String(h.fechaInicio).slice(0, 10)}T00:00:00`)
      const p = PLAN.find((x) => x.js === d.getDay())
      expect(p, `día inesperado ${h.fechaInicio}`).toBeTruthy()
      expect([hhmm(h.horaInicio), hhmm(h.horaFin)]).toEqual([p.inicio, p.fin])
      expect(h.espacio).toBe(AULA)
    }

    // Un segundo intento con el mismo docente y franja choca (solape del mismo docente)
    await page.getByRole('button', { name: 'Nuevo Horario' }).click()
    await page.getByRole('switch', { name: 'Repetir este horario' }).check()
    await page.locator('#fh-fecha').fill(DESDE)
    await page.locator('#fh-fechaFin').fill(HASTA)
    await page.locator('.fh-dia').filter({ hasText: 'Martes' }).click()
    await page.getByLabel('Martes: hora de inicio').fill('10:00')
    await page.getByLabel('Martes: hora de fin').fill('12:00')
    await page.locator('#fh-salon').fill(`${PREFIJO} Otra ${sello}`)
    await page.locator('#fh-docenteId').selectOption(String(docente.idUsuario))
    await page.getByRole('button', { name: /Guardar/ }).click()
    await expect(page.getByRole('alert')).toContainText('ya hay un horario de este docente de 9:00 – 11:00')
    await page.getByRole('button', { name: /Cancelar/ }).click()
  })

  test('Agendar tutoría: tabla Día | Horario, fechas por franja y agenda en una fecha concreta', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/agendar-tutoria')
    const nombre = `${PREFIJO} Recurrente Docente ${sello}`
    // Tarjeta del docente con su resumen semanal, sin abrir nada
    const tarjeta = page.locator('.docente-disp').filter({ hasText: nombre })
    await expect(tarjeta).toContainText('9 fechas')
    await capturar(page, 'agendar-docentes')
    await expect(tarjeta).toContainText('Mar 9:00 – 11:00')
    await expect(tarjeta).toContainText('Mié 16:00 – 18:00')
    await tarjeta.click()
    await expect(page.getByLabel('Docente o tutor')).toHaveValue(String(docente.idUsuario))

    const tabla = page.getByRole('table', { name: /Disponibilidad semanal/ })
    for (const p of PLAN) {
      const fila = tabla.getByRole('row', { name: new RegExp(`^${p.dia}`) })
      await expect(fila).toContainText(p.texto)
    }
    await expectAccessible(page)
    await expectNoHorizontalScroll(page)
    await capturar(page, 'agendar-disponibilidad')

    // Filtra por la franja del miércoles: 3 fechas, todas miércoles 16:00 – 18:00
    await tabla.getByRole('row', { name: /^Miércoles/ }).getByRole('button').click()
    const lista = page.locator('.disp-lista > li')
    await expect(lista).toHaveCount(3)
    for (const li of await lista.all()) {
      await expect(li).toContainText('Miércoles')
      await expect(li).toContainText('16:00 – 18:00')
    }

    // Agenda en el primer miércoles
    const primero = lista.first()
    const fechaTexto = (await primero.locator('.disp-fecha__dia').textContent()).trim()
    await primero.getByRole('button', { name: /^Agendar el / }).click()
    const modal = page.locator('.formulario-tutoria')
    await expect(modal).toBeVisible()
    await modal.locator('select[name="idioma"]').selectOption('Inglés')
    await modal.locator('select[name="modalidad"]').selectOption('Virtual')
    await modal.locator('select[name="nivel"]').selectOption('A2')
    await modal.locator('[name="tema"]').fill(temaGestion)
    // Cupos máximos: obligatorio, entero 1–1000, por defecto 5; error junto al campo y sin POST si no es válido
    const cuposInput = modal.getByLabel('Cupos máximos *')
    await expect(cuposInput).toHaveValue('5')
    const postsTutoria = []
    page.on('request', (r) => r.method() === 'POST' && r.url().endsWith('/api/Tutoria') && postsTutoria.push(r))
    await cuposInput.fill('0')
    await modal.getByRole('button', { name: /Agendar Tutoría/ }).click()
    await expect(modal.locator('#ft-cupos-error')).toHaveText('Debe ser un número entero entre 1 y 1000.')
    await expect(cuposInput).toBeFocused()
    await expect(cuposInput).toHaveAttribute('aria-invalid', 'true')
    await cuposInput.fill('')
    await modal.getByRole('button', { name: /Agendar Tutoría/ }).click()
    await expect(modal.locator('#ft-cupos-error')).toHaveText('Indica los cupos máximos.')
    expect(postsTutoria).toHaveLength(0)
    await cuposInput.fill('2')
    await expect(modal.locator('#ft-cupos-error')).toHaveCount(0)
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/Tutoria') && r.request().method() === 'POST'),
      modal.getByRole('button', { name: /Agendar Tutoría/ }).click(),
    ])
    expect(resp.status()).toBe(201)
    const body = resp.request().postDataJSON()
    expect(body.usuarioId).toBe(docente.idUsuario)
    expect(body.fechaTutoria).toMatch(/T16:00:00$/)
    expect(body.cupos).toBe(2)
    expect((await resp.json()).cupos).toBe(2)

    // Se ve en Tutorías agendadas con su fecha/hora y desaparece de las fechas libres
    const card = page.locator('.tutoria-card').filter({ hasText: temaGestion })
    await expect(card).toBeVisible()
    await expect(card).toContainText('16:00')
    await card.click()
    // El detalle muestra la fecha elegida, su franja y el docente
    const detalle = page.getByRole('dialog')
    await expect(detalle).toContainText(fechaTexto.replace(/ de /g, ' ').replace(/^(\S+), /, '$1, '))
    await expect(detalle).toContainText('16:00 - 18:00')
    await expect(detalle).toContainText(nombre)
    await page.keyboard.press('Escape')
  })

  test('Docente: su agenda muestra Día | Horario y agenda desde una fecha concreta; la ve en Mis tutorías', async ({ page }) => {
    const s = await sesionDe(correo, contrasena)
    expect(s.status).toBe(200)
    sesionDocente = s.sesion
    await page.goto('/login')
    await page.evaluate((x) => localStorage.setItem('tutorpro.session.v1', JSON.stringify(x)), sesionDocente)

    // La tutoría agendada desde gestión ya aparece en Mis tutorías del docente
    await page.goto('/mis-tutorias')
    await expect(page.locator('.tutoria-row').filter({ hasText: temaGestion })).toBeVisible()

    await page.goto('/agenda')
    await expect(page.getByRole('heading', { name: 'Horarios disponibles', level: 1 })).toBeVisible()
    await expect(page.locator('.count-pill')).toHaveText('8 fechas disponibles')
    const tabla = page.getByRole('table', { name: /Disponibilidad semanal/ })
    for (const p of PLAN) {
      await expect(tabla.getByRole('row', { name: new RegExp(`^${p.dia}`) })).toContainText(p.texto)
    }
    // El miércoles ya agendado ya no cuenta
    await expect(tabla.getByRole('row', { name: /^Miércoles/ }).getByRole('cell').last()).toHaveText('2')
    await expectAccessible(page)
    await expectNoHorizontalScroll(page)

    await capturar(page, 'agenda-docente')
    await tabla.getByRole('row', { name: /^Jueves/ }).getByRole('button').click()
    const jueves = page.locator('.disp-lista > li').first()
    await expect(jueves).toContainText('Jueves')
    await jueves.getByRole('link', { name: /^Agendar el / }).click()
    await expect(page).toHaveURL(/\/agenda\/\d+\/agendar$/)

    await page.getByLabel('Idioma').fill('Inglés')
    await page.getByLabel('Nivel').fill('B1')
    await page.getByLabel('Tema').fill(temaAgenda)
    await page.getByRole('radio', { name: 'Virtual' }).check()
    await page.getByRole('button', { name: /Continuar/ }).click()
    await page.getByLabel('Tutor o docente').selectOption(String(docente.idUsuario))
    await page.getByRole('button', { name: /Continuar/ }).click()
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/Tutoria') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /Agendar tutoría/ }).click(),
    ])
    expect(resp.status()).toBe(201)
    expect(resp.request().postDataJSON().fechaTutoria).toMatch(/T16:00:00$/)
    const id = (await resp.json()).idTutoria
    await expect(page).toHaveURL(new RegExp(`/mis-tutorias/${id}$`))
    await expect(page.getByText(temaAgenda).first()).toBeVisible()

    await page.goto('/mis-tutorias')
    await expect(page.locator('.tutoria-row').filter({ hasText: temaAgenda })).toBeVisible()
  })
})
