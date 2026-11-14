// Dashboard de gestión (Administrador y Auxiliar). Datos propios [PRUEBA], borrados al final.
import { test, expect } from '@playwright/test'
import {
  apiComo,
  crearHorarioPrueba,
  expectAccessible,
  expectNoHorizontalScroll,
  fechaEnDias,
  limpiarPrueba,
  login,
  PREFIJO,
  requireRole,
  trackApi,
} from './helpers'

const sello = Date.now().toString(36)
const DOCENTE_ID = Number(process.env.E2E_DOCENTE_ID || 18)

const BLOQUES = ['Requiere atención', 'Agenda', 'Indicadores', 'Actividad mensual', 'Calidad', 'Análisis por periodo', 'Demanda', 'Carga por docente y tutor']

/** Errores de consola de la página (excluye avisos de React Router y logs informativos). */
const capturarErroresConsola = (page) => {
  const errores = []
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
  page.on('pageerror', (e) => errores.push(e.message))
  return errores
}

const esperarDashboard = async (page) => {
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
  // Fin de la primera carga: los bloques dejan de estar ocupados
  await expect(page.locator('.dash-panel[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 })
  await expect(page.locator('.quality .dash-skel')).toHaveCount(0)
}

for (const rol of ['admin', 'auxiliar']) {
  test(`D-E1 ${rol}: dashboard completo con datos reales, sin errores de red ni consola, accesible @responsive`, async ({ page }) => {
    requireRole(test, rol)
    const errores = capturarErroresConsola(page)
    const responses = []
    page.on('response', (r) => r.url().includes('/api/') && responses.push({ url: r.url(), status: r.status() }))

    await login(page, rol)
    await esperarDashboard(page)
    await page.waitForLoadState('networkidle')

    for (const nombre of BLOQUES) {
      await expect(page.getByRole('heading', { name: nombre, exact: true })).toBeVisible()
    }
    // Fuentes del contrato: listados de gestión + estadísticas de encuestas + retroalimentación
    for (const ruta of [/\/api\/Tutoria$/, /\/api\/Horario$/, /\/api\/Usuario$/, /\/api\/Encuesta\/estadisticas$/, /\/api\/Retroalimentacion$/]) {
      expect(responses.some((r) => ruta.test(r.url) && r.status === 200), `${ruta}`).toBeTruthy()
    }
    expect(responses.filter((r) => r.status >= 400)).toEqual([])
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(errores).toEqual([])

    // KPIs con contexto (valor + comparación o total)
    const kpis = page.locator('.kpi')
    await expect(kpis).toHaveCount(4)
    await expect(kpis.filter({ hasText: 'Próximos 7 días' })).toContainText(/frente a|Igual que/)

    // Acceso al personal solo para el Administrador
    await expect(page.getByRole('link', { name: 'Gestionar docentes y tutores' })).toHaveCount(rol === 'admin' ? 1 : 0)
    await expect(page.getByRole('link', { name: 'Agendar tutoría' }).first()).toBeVisible()

    await expectNoHorizontalScroll(page)
    await expectAccessible(page)

    // Tema oscuro también accesible: se carga con la preferencia guardada (sin transición de colores a medias)
    await page.evaluate(() => localStorage.setItem('theme', 'dark'))
    await page.reload()
    await esperarDashboard(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expectAccessible(page)
  })
}

test('D-E2 gráfica con alternativa en tabla y análisis por periodo @responsive', async ({ page }) => {
  requireRole(test, 'admin')
  await login(page, 'admin')
  await esperarDashboard(page)

  const tendencia = page.locator('.dash-area-trend')
  await tendencia.getByRole('button', { name: 'Tabla' }).click()
  await expect(tendencia.getByRole('button', { name: 'Tabla' })).toHaveAttribute('aria-pressed', 'true')
  const tabla = tendencia.getByRole('table')
  await expect(tabla.locator('tbody tr')).toHaveCount(12)
  await expect(tabla.getByRole('columnheader', { name: 'Finalizadas' })).toBeVisible()
  await tendencia.getByRole('button', { name: 'Gráfica' }).click()
  await expect(tendencia.locator('.recharts-surface')).toBeVisible()

  const analisis = page.locator('.dash-analysis')
  await analisis.getByRole('button', { name: 'Todo' }).click()
  await expect(analisis.getByText('Todas las sesiones registradas.')).toBeVisible()
  await analisis.getByRole('button', { name: '30 días' }).click()
  await expect(analisis.getByText(/^Sesiones desde el \d{2}\/\d{2}\/\d{4}/)).toBeVisible()

  const demanda = page.locator('.dash-area-demand')
  await demanda.getByRole('button', { name: 'Modalidad' }).click()
  await expect(demanda.getByRole('button', { name: 'Modalidad' })).toHaveAttribute('aria-pressed', 'true')
  await expectNoHorizontalScroll(page)
})

test.describe('D-E3 la zona de atención y la agenda reflejan datos reales [PRUEBA]', () => {
  let admin
  let vencida
  let manana

  test.beforeAll(async ({ playwright }) => {
    requireRole(test, 'admin')
    admin = await apiComo(playwright, 'admin')
    const ayer = fechaEnDias(-1)
    const hAyer = await crearHorarioPrueba(admin, { titulo: `Dash ayer ${sello}`, fecha: ayer, usuarioId: DOCENTE_ID })
    const t1 = await admin.post('/Tutoria', {
      idioma: `${PREFIJO} Vencida ${sello}`, nivel: 'A1', tema: `${PREFIJO} Dash vencida ${sello}`, modalidad: 'Virtual', estado: 'Pendiente',
      fechaTutoria: `${ayer}T08:00:00`, usuarioId: DOCENTE_ID, horarioId: hAyer.idHorario,
    })
    expect(t1.status, JSON.stringify(t1.body)).toBe(201)
    vencida = t1.body

    const fManana = fechaEnDias(1)
    const hManana = await crearHorarioPrueba(admin, { titulo: `Dash mañana ${sello}`, fecha: fManana, horaInicio: '07:00', horaFin: '07:45', usuarioId: DOCENTE_ID })
    const t2 = await admin.post('/Tutoria', {
      idioma: `${PREFIJO} Mañana ${sello}`, nivel: 'B2', tema: `${PREFIJO} Dash mañana ${sello}`, modalidad: 'Presencial', estado: 'Pendiente',
      fechaTutoria: `${fManana}T07:00:00`, usuarioId: DOCENTE_ID, horarioId: hManana.idHorario,
    })
    expect(t2.status, JSON.stringify(t2.body)).toBe(201)
    manana = t2.body
  })

  test.afterAll(async () => {
    if (!admin) return
    const r = await limpiarPrueba(admin)
    expect(r.errores).toEqual([])
    await admin.dispose()
  })

  test('vencida con enlace a finalizar, próxima sin estudiantes y en la agenda de mañana', async ({ page }) => {
    await login(page, 'admin')
    await esperarDashboard(page)
    const atencion = page.locator('.dash-area-attention')

    // Prioridad alta, abierta por defecto, la más reciente primero
    const itemVencidas = atencion.locator('.att-item--alta').filter({ hasText: /pendientes? con fecha pasada/ })
    await expect(itemVencidas).toBeVisible()
    const fila = itemVencidas.locator('.att-detail__row').filter({ hasText: `Vencida ${sello}` })
    await expect(fila).toBeVisible()
    await expect(fila.getByRole('link', { name: /Finalizar/ })).toHaveAttribute('href', `/tutorias/${vencida.idTutoria}/finalizar`)

    // Próxima sin estudiantes: se despliega y enlaza a donde se asignan
    const itemVacias = atencion.locator('.att-item').filter({ hasText: /próximas? sin estudiantes/ })
    await expect(itemVacias).toBeVisible()
    const toggle = itemVacias.getByRole('button', { name: 'Ver detalle' })
    await toggle.click()
    await expect(itemVacias.getByRole('button', { name: 'Ocultar' })).toHaveAttribute('aria-expanded', 'true')
    await expect(itemVacias.locator('.att-detail__row').filter({ hasText: `Mañana ${sello}` })).toBeVisible()
    await expect(itemVacias.getByRole('link', { name: 'Asignar estudiantes' })).toHaveAttribute('href', '/agendar-tutoria')

    // Agenda: grupo "Mañana" con la sesión y su cupo vacío
    const agenda = page.locator('.dash-area-agenda')
    const grupo = agenda.locator('.agenda__group').filter({ has: page.getByRole('heading', { name: 'Mañana', exact: true }) })
    const sesion = grupo.locator('.agenda-item').filter({ hasText: `Mañana ${sello}` })
    await expect(sesion).toBeVisible()
    await expect(sesion).toContainText('07:00')
    await expect(sesion.locator('.agenda-cupo')).toContainText('0/2')

    // El enlace de finalizar lleva a la pantalla real (sin enviar nada)
    await fila.getByRole('link', { name: /Finalizar/ }).click()
    await expect(page).toHaveURL(new RegExp(`/tutorias/${vencida.idTutoria}/finalizar$`))
    await expect(page.getByRole('heading', { name: 'Calificar y finalizar', level: 1 })).toBeVisible()
    expect(manana.idTutoria).toBeTruthy()
  })
})

test('D-E4 un bloque que falla no rompe el resto y se puede reintentar', async ({ page }) => {
  requireRole(test, 'admin')
  let fallar = true
  await page.route(/\/api\/Encuesta\/estadisticas$/, (route) =>
    fallar
      ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Fallo simulado' }) })
      : route.continue()
  )
  const calls = trackApi(page)
  await login(page, 'admin')
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()

  const calidad = page.locator('.dash-area-quality')
  await expect(calidad.getByRole('alert')).toContainText('No se pudo cargar')
  // El resto sigue funcionando con datos
  await expect(calidad.getByRole('heading', { name: 'Calificación de las sesiones' })).toBeVisible()
  await expect(page.locator('.kpi')).toHaveCount(4)
  // La zona de atención no depende de las estadísticas: sigue en pie
  await expect(page.locator('.dash-area-attention').getByRole('heading', { name: 'Requiere atención' })).toBeVisible()
  await expect(page.locator('.dash-area-attention').getByRole('alert')).toHaveCount(0)

  fallar = false
  await calidad.getByRole('button', { name: 'Reintentar' }).click()
  await expect(calidad.getByRole('heading', { name: 'Satisfacción de los estudiantes' })).toBeVisible()
  await expect(calidad.getByRole('alert')).toHaveCount(0)
  expect(calls.filter((c) => c.path === '/Encuesta/estadisticas').length).toBeGreaterThanOrEqual(2)
})
