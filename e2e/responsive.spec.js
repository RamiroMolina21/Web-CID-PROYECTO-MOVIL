// Vista móvil: todas las rutas y estados principales por rol a 320 y 375 (claro), 375 (oscuro) y 667×375 apaisado.
// Comprueba: sin scroll horizontal, nada fuera del viewport ni recortado por su contenedor (con excepciones justificadas
// en responsive-helpers.js), objetivos táctiles ≥44 px, campos ≥16 px (sin zoom en iOS) y axe sin serias/críticas.
// Solo navega: no crea ni modifica datos.
import { test, expect, devices } from '@playwright/test'
import { apiComo, expectAccessible, login, requireRole } from './helpers'
import { auditarPagina } from './responsive-helpers'

const { defaultBrowserType, ...MOVIL } = devices['Pixel 7'] // eslint-disable-line no-unused-vars

const VISTAS = [
  { nombre: '320', viewport: { width: 320, height: 640 }, tema: 'light' },
  { nombre: '375', viewport: { width: 375, height: 812 }, tema: 'light' },
  { nombre: '375-oscuro', viewport: { width: 375, height: 812 }, tema: 'dark' },
  { nombre: '667x375', viewport: { width: 667, height: 375 }, tema: 'light' },
]

const comprobar = async (page, donde) => {
  await page.waitForLoadState('networkidle')
  // Se mide en reposo: las animaciones de entrada (p. ej. diálogos a escala 0.96) alteran el tamaño un instante
  await page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running' || x.effect?.getTiming().iterations === Infinity))
  const a = await auditarPagina(page)
  expect.soft(a.overflowDoc, `${donde}: scroll horizontal del documento`).toBeLessThanOrEqual(0)
  expect.soft(a.fuera, `${donde}: elementos fuera del viewport`).toEqual([])
  expect.soft(a.recortados, `${donde}: elementos recortados por su contenedor`).toEqual([])
  expect.soft(a.pequenos, `${donde}: objetivos táctiles < 44 px`).toEqual([])
  expect.soft(a.camposPequenos, `${donde}: campos < 16 px (zoom en iOS)`).toEqual([])
  await expectAccessible(page)
}

const recorrer = async (page, rutas, prefijo) => {
  for (const ruta of rutas) {
    await page.goto(ruta)
    await expect(page.locator('#contenido, .login-card, .survey-card').first()).toBeVisible()
    await comprobar(page, `${prefijo} ${ruta}`)
  }
}

// Ids reales tomados de la API (sin depender de datos concretos)
const ids = {}
test.beforeAll(async ({ playwright }) => {
  requireRole(test, 'docente')
  requireRole(test, 'tutor')
  const docente = await apiComo(playwright, 'docente')
  const tutor = await apiComo(playwright, 'tutor')
  const dId = docente.usuario.idUsuario
  const tId = tutor.usuario.idUsuario
  const horarios = (await docente.get(`/Horario/usuario/${dId}`)).body || []
  const hoy = new Date().toISOString().slice(0, 10)
  ids.horarioLibre = horarios.find((h) => /disponible|libre/i.test(h.estado) && String(h.fechaInicio).slice(0, 10) >= hoy)?.idHorario
  ids.docPendiente = ((await docente.get(`/Tutoria/agendadas/usuario/${dId}?estado=pendiente`)).body || [])[0]?.idTutoria
  ids.docFinalizada = ((await docente.get(`/Tutoria/agendadas/usuario/${dId}?estado=finalizada`)).body || [])[0]?.idTutoria
  ids.tutPendiente = ((await tutor.get(`/Tutoria/estado/pendiente/usuario/${tId}`)).body || [])[0]?.idTutoria
  ids.tutFinalizada = ((await tutor.get(`/Tutoria/estado/finalizada/usuario/${tId}`)).body || [])[0]?.idTutoria
  await docente.dispose()
  await tutor.dispose()
})

for (const vista of VISTAS) {
  test.describe(`Responsive ${vista.nombre}`, () => {
    test.use({ ...MOVIL, viewport: vista.viewport })
    test.beforeEach(async ({ page }) => {
      test.setTimeout(240_000)
      await page.addInitScript((t) => localStorage.setItem('theme', t), vista.tema)
    })

    test(`R-${vista.nombre} públicas: login con motivos, encuesta, sin sesión`, async ({ page }) => {
      await recorrer(page, ['/login', '/login?motivo=expirada', '/login?motivo=desactivada', '/encuesta', '/encuesta?token=no-valido'], 'pública')
    })

    test(`R-${vista.nombre} Administrador: rutas, menú, calendario, modales y formularios`, async ({ page }) => {
      requireRole(test, 'admin')
      await login(page, 'admin')
      await recorrer(page, ['/', '/horarios', '/agendar-tutoria', '/estudiantes', '/tutorias-finalizadas', '/configuracion', '/agenda', '/ruta-inexistente'], 'admin')

      await page.goto('/')
      await page.getByRole('button', { name: 'Abrir menú' }).click()
      await expect(page.getByRole('dialog', { name: 'Menú' })).toBeVisible()
      await comprobar(page, 'admin menú')
      await page.keyboard.press('Escape')

      await page.goto('/')
      await page.locator('.btn-atendido').first().click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await comprobar(page, 'admin confirmación Atendido')
      await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click()

      for (const vistaCal of ['dia', 'semana', 'mes', 'anio']) {
        await page.goto('/horarios')
        const select = page.getByLabel('Vista del calendario')
        if (vistaCal === 'anio') await select.selectOption({ index: 3 })
        else await select.selectOption(vistaCal)
        await comprobar(page, `admin horarios ${vistaCal}`)
      }

      await page.goto('/horarios')
      await page.getByRole('button', { name: 'Nuevo Horario' }).click()
      await expect(page.getByRole('heading', { name: 'Nuevo Horario' })).toBeVisible()
      await comprobar(page, 'admin nuevo horario')
      // Acciones visibles sin desplazar el modal (pie fijo en móvil)
      await expect(page.getByRole('button', { name: /Guardar/ })).toBeInViewport()

      await page.goto('/horarios')
      const etiqueta = page.locator('.month-horario-label, .month-tutoria-label').first()
      if (await etiqueta.count()) {
        await etiqueta.click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await comprobar(page, 'admin detalle de horario/tutoría')
      }

      await page.goto('/tutorias-finalizadas')
      await page.locator('.tutoria-card').first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await comprobar(page, 'admin modal tutoría finalizada')

      await page.goto('/agendar-tutoria')
      const agregar = page.locator('.tutoria-agregar-estudiante-btn:not([disabled])').first()
      if (await agregar.count()) {
        await agregar.click()
        await expect(page.getByRole('dialog', { name: /Agregar Estudiante/ })).toBeVisible()
        await comprobar(page, 'admin agregar estudiante')
      }

      for (const boton of ['Nuevo Estudiante', 'Nuevo Docente', 'Nuevo Tutor']) {
        await page.goto('/estudiantes')
        await page.getByRole('button', { name: boton }).click()
        await expect(page.getByRole('button', { name: /Guardar/ })).toBeVisible()
        await comprobar(page, `admin ${boton}`)
      }
    })

    test(`R-${vista.nombre} Auxiliar: dashboard y usuarios`, async ({ page }) => {
      requireRole(test, 'auxiliar')
      await login(page, 'auxiliar')
      await recorrer(page, ['/', '/estudiantes', '/configuracion'], 'auxiliar')
    })

    test(`R-${vista.nombre} Docente: agenda, asistente, mis tutorías, detalle, finalizar, historial`, async ({ page }) => {
      requireRole(test, 'docente')
      await login(page, 'docente')
      const rutas = ['/agenda', '/mis-tutorias', '/historial', '/configuracion', '/estudiantes']
      if (ids.docPendiente) rutas.push(`/mis-tutorias/${ids.docPendiente}`, `/tutorias/${ids.docPendiente}/finalizar`)
      if (ids.docFinalizada) rutas.push(`/historial/${ids.docFinalizada}`)
      await recorrer(page, rutas, 'docente')

      if (ids.horarioLibre) {
        await page.goto(`/agenda/${ids.horarioLibre}/agendar`)
        await comprobar(page, 'docente asistente paso 1')
        await page.getByLabel('Idioma').fill('Inglés')
        await page.getByLabel('Nivel').fill('B1')
        await page.getByLabel('Tema').fill('Revisión responsive')
        await page.getByRole('radio', { name: 'Virtual' }).check()
        await page.getByRole('button', { name: /Continuar/ }).click()
        await expect(page.getByRole('heading', { name: /Paso 2 de 3/ })).toBeVisible()
        await comprobar(page, 'docente asistente paso 2')
        await page.getByLabel('Tutor o docente').selectOption({ index: 1 })
        await page.getByRole('button', { name: /Continuar/ }).click()
        await expect(page.getByRole('heading', { name: /Paso 3 de 3/ })).toBeVisible()
        await comprobar(page, 'docente asistente paso 3')
      }

      if (ids.docPendiente) {
        await page.goto(`/mis-tutorias/${ids.docPendiente}`)
        const agregar = page.getByRole('button', { name: 'Agregar estudiantes' })
        if (await agregar.isEnabled()) {
          await agregar.click()
          await expect(page.getByRole('dialog')).toBeVisible()
          await comprobar(page, 'docente diálogo agregar estudiantes')
          await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()
        }
        const quitar = page.getByRole('button', { name: /^Quitar a / }).first()
        if (await quitar.count()) {
          await quitar.click()
          await expect(page.getByRole('alertdialog')).toBeVisible()
          await comprobar(page, 'docente confirmación quitar')
          await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click()
        }
      }

      await page.goto('/agenda')
      await page.getByRole('button', { name: 'Abrir menú' }).click()
      await comprobar(page, 'docente menú')
    })

    test(`R-${vista.nombre} Tutor: mis tutorías, detalle e historial`, async ({ page }) => {
      requireRole(test, 'tutor')
      await login(page, 'tutor')
      const rutas = ['/mis-tutorias', '/historial', '/configuracion', '/agenda']
      if (ids.tutPendiente) rutas.push(`/mis-tutorias/${ids.tutPendiente}`)
      if (ids.tutFinalizada) rutas.push(`/historial/${ids.tutFinalizada}`)
      await recorrer(page, rutas, 'tutor')
    })
  })
}
