// Docente y Tutor contra el backend real (D-E*, T-E* del plan).
// Datos propios con prefijo [PRUEBA]: se crean por la API y se borran en afterAll (y en el globalTeardown).
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

const ID = { docente: Number(process.env.E2E_DOCENTE_ID || 18), tutor: Number(process.env.E2E_TUTOR_ID || 19) }
const sello = Date.now().toString(36)

// ---------- Vistas sin datos propios: en los 3 tamaños ----------
test.describe('Vistas personales @responsive', () => {
  test('Docente: agenda, mis tutorías e historial accesibles y sin scroll horizontal', async ({ page }) => {
    requireRole(test, 'docente')
    await login(page, 'docente')
    await expect(page.getByRole('heading', { name: 'Horarios disponibles', level: 1 })).toBeVisible()
    for (const [ruta, titulo] of [['/agenda', 'Horarios disponibles'], ['/mis-tutorias', 'Mis tutorías'], ['/historial', 'Tutorías finalizadas']]) {
      await page.goto(ruta)
      await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
      await expect(page.locator('.skeleton-group')).toHaveCount(0)
      await expectAccessible(page)
      await expectNoHorizontalScroll(page)
    }
  })

  test('Tutor: mis tutorías e historial accesibles; sin Agenda en el menú', async ({ page }) => {
    requireRole(test, 'tutor')
    await login(page, 'tutor')
    await expect(page.getByRole('heading', { name: 'Mis tutorías', level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Horarios disponibles' })).toHaveCount(0)
    for (const ruta of ['/mis-tutorias', '/historial']) {
      await page.goto(ruta)
      await expect(page.locator('.skeleton-group')).toHaveCount(0)
      await expectAccessible(page)
      await expectNoHorizontalScroll(page)
    }
  })
})

// ---------- Flujo completo Docente → Tutor → Docente (solo escritorio, en serie) ----------
test.describe.serial('Flujo agendar → cupos → finalizar', () => {
  /** @type {Awaited<ReturnType<typeof apiComo>>} */
  let admin
  let h1 // flujo principal (la tutoría se agenda con 2 cupos)
  let h2 // carrera "horario ya no disponible"
  let tutoriaId
  let tutoriaAjenaId
  const tema = `${PREFIJO} E2E ${sello}`

  test.beforeAll(async ({ playwright }, info) => {
    test.skip(info.project.name !== 'desktop', 'El flujo con datos se ejecuta una sola vez (desktop)')
    requireRole(test, 'admin')
    requireRole(test, 'docente')
    requireRole(test, 'tutor')
    admin = await apiComo(playwright, 'admin')
    h1 = await crearHorarioPrueba(admin, { titulo: `Agenda ${sello}`, fecha: fechaEnDias(20), usuarioId: ID.docente })
    h2 = await crearHorarioPrueba(admin, { titulo: `Carrera ${sello}`, fecha: fechaEnDias(21), horaInicio: '10:00', horaFin: '11:00', usuarioId: ID.docente })
  })

  test.afterAll(async () => {
    if (!admin) return
    const r = await limpiarPrueba(admin)
    expect(r.errores).toEqual([])
    await admin.dispose()
  })

  test('D-E1..E8 Docente agenda con un estudiante (POST atómico) y ve "1 de 2"', async ({ page }) => {
    const calls = trackApi(page)
    await login(page, 'docente')
    await expect(page).toHaveURL(/\/agenda$/)

    // Vista de disponibilidad: la fecha del horario [PRUEBA] lleva su franja; ya no muestra cupos (se definen al agendar)
    const enlace = page.locator(`a[href="/agenda/${h1.idHorario}/agendar"]`)
    for (let i = 0; i < 20 && !(await enlace.count()); i++) {
      await page.getByRole('button', { name: /fechas más/ }).click()
    }
    const fila = page.locator('.disp-lista > li').filter({ has: enlace })
    await expect(fila).not.toContainText(/cupos/i)
    await enlace.click()
    await expect(page).toHaveURL(new RegExp(`/agenda/${h1.idHorario}/agendar$`))

    // Paso 1: validaciones y datos
    await page.getByRole('button', { name: /Continuar/ }).click()
    await expect(page.getByText('Escribe el idioma.')).toBeVisible()
    await expect(page.getByText('Elige una modalidad.')).toBeVisible()
    await page.getByLabel('Idioma').fill('Inglés')
    await page.getByLabel('Nivel').fill('B1')
    await page.getByLabel('Tema').fill(tema)
    await page.getByRole('radio', { name: 'Virtual' }).check()
    await page.getByRole('button', { name: /Continuar/ }).click()

    // Paso 2: asignar al Tutor
    await expect(page.getByRole('heading', { name: /Paso 2 de 3/ })).toBeFocused()
    await page.getByRole('button', { name: /Continuar/ }).click()
    await expect(page.getByText('Elige quién impartirá la tutoría.')).toBeVisible()
    await page.getByLabel('Tutor o docente').selectOption(String(ID.tutor))
    // Cupos máximos: obligatorio, por defecto 5, entero 1–1000 con error junto al campo
    const cupos = page.getByLabel('Cupos máximos')
    await expect(cupos).toHaveValue('5')
    await cupos.fill('1001')
    await page.getByRole('button', { name: /Continuar/ }).click()
    await expect(page.locator('#f-cupos-error')).toHaveText('Debe ser un número entero entre 1 y 1000.')
    await expect(cupos).toBeFocused()
    await cupos.fill('')
    await page.getByRole('button', { name: /Continuar/ }).click()
    await expect(page.locator('#f-cupos-error')).toHaveText('Indica los cupos máximos.')
    await cupos.fill('2')
    await page.getByRole('button', { name: /Continuar/ }).click()

    // Paso 3: un estudiante (cupo 2)
    await expect(page.getByText('Puedes agregar hasta 2 estudiantes.')).toBeVisible()
    await page.getByRole('searchbox', { name: /Buscar estudiantes/ }).fill('Daniela')
    await page.locator('.picker__item').filter({ hasText: 'Daniela' }).click()
    await expect(page.getByText('1 de 2 seleccionados')).toBeVisible()
    await expectAccessible(page)

    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/Tutoria') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /Agendar tutoría/ }).click(),
    ])
    expect(resp.status()).toBe(201)
    const body = resp.request().postDataJSON()
    expect(body).toMatchObject({ estado: 'Pendiente', usuarioId: ID.tutor, horarioId: h1.idHorario, modalidad: 'Virtual' })
    expect(body.estudianteIds).toHaveLength(1)
    expect(body.cupos).toBe(2)
    expect(body.fechaTutoria).toMatch(/^\d{4}-\d{2}-\d{2}T08:00:00$/)
    // Atómico: no hay POST /estudiantes separado
    expect(calls.some((c) => c.method === 'POST' && /\/Tutoria\/\d+\/estudiantes$/.test(c.path))).toBeFalsy()

    tutoriaId = (await resp.json()).idTutoria
    await expect(page).toHaveURL(new RegExp(`/mis-tutorias/${tutoriaId}$`))
    await expect(page.getByText('1 de 2 ocupados')).toBeVisible()
    await expect(page.getByText('Agendada por')).toBeVisible()
  })

  test('D-E13 "Mis tutorías" del Docente incluye la agendada para el Tutor', async ({ page }) => {
    const calls = trackApi(page)
    await login(page, 'docente')
    await page.goto('/mis-tutorias')
    const fila = page.locator('.tutoria-row').filter({ hasText: tema })
    await expect(fila).toBeVisible()
    await expect(fila).toContainText('Agendada por ti')
    expect(calls.some((c) => new RegExp(`^/Tutoria/agendadas/usuario/${ID.docente}\\?estado=pendiente$`).test(c.path))).toBeTruthy()
    await page.getByRole('button', { name: 'Asignadas a mí' }).click()
    await expect(fila).toHaveCount(0)
    await page.getByRole('button', { name: 'Agendadas por mí' }).click()
    await expect(page.locator('.tutoria-row').filter({ hasText: tema })).toBeVisible()
  })

  test('D-E15 agregar hasta el cupo y 409 visible si el cupo cambia en el servidor', async ({ page }) => {
    await login(page, 'docente')
    await page.goto(`/mis-tutorias/${tutoriaId}`)
    await expect(page.getByText('1 de 2 ocupados')).toBeVisible()

    await page.getByRole('button', { name: 'Agregar estudiantes' }).click()
    const dialog = page.getByRole('dialog', { name: 'Agregar estudiantes' })
    await expect(dialog).toContainText('Quedan 1 de 2 cupos')
    await expect(dialog.locator('.picker__item').filter({ hasText: 'Daniela' })).toHaveCount(0) // excluye asignados
    await dialog.locator('.picker__item').filter({ hasText: 'Sebastián' }).click()

    // Otro usuario reduce el cupo de la tutoría mientras el diálogo está abierto → el servidor responde 409
    const actual = (await admin.get(`/Tutoria/${tutoriaId}`)).body
    const putTutoria = (cupos) => admin.put(`/Tutoria/${tutoriaId}`, {
      idioma: actual.idioma, nivel: actual.nivel, tema: actual.tema, modalidad: actual.modalidad, estado: actual.estado,
      fechaTutoria: actual.fechaTutoria, usuarioId: actual.usuarioId, horarioId: actual.horarioId, cupos,
    })
    expect(actual.cupos).toBe(2)
    const put = await putTutoria(1)
    expect(put.status).toBe(200)
    await dialog.getByRole('button', { name: 'Agregar seleccionados' }).click()
    await expect(dialog.getByRole('alert')).toContainText(/Cupo completo: 1 de 1 ocupados/)
    await dialog.getByRole('button', { name: 'Cancelar' }).click()

    // Se restablece el cupo y ahora sí se completa (2 de 2) → botón deshabilitado
    expect((await putTutoria(2)).status).toBe(200)
    await page.reload()
    await page.getByRole('button', { name: 'Agregar estudiantes' }).click()
    await dialog.locator('.picker__item').filter({ hasText: 'Sebastián' }).click()
    await dialog.getByRole('button', { name: 'Agregar seleccionados' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('2 de 2 ocupados')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Agregar estudiantes' })).toBeDisabled()
    // Contrato: reducir los cupos por debajo de los inscritos → 409
    expect((await putTutoria(1)).status).toBe(409)
  })

  test('D-E10 horario ocupado por otro durante el asistente → 409 visible', async ({ page }) => {
    await login(page, 'docente')
    await page.goto(`/agenda/${h2.idHorario}/agendar`)
    await page.getByLabel('Idioma').fill('Francés')
    await page.getByLabel('Nivel').fill('A2')
    await page.getByLabel('Tema').fill(`${PREFIJO} Carrera ${sello}`)
    await page.getByRole('radio', { name: 'Presencial' }).check()
    await page.getByRole('button', { name: /Continuar/ }).click()
    await page.getByRole('button', { name: 'Asignarme a mí' }).click()
    await page.getByLabel('Cupos máximos').fill('3')
    await page.getByRole('button', { name: /Continuar/ }).click()

    // El Administrador reserva el mismo horario (asignado al Docente) antes de que el Docente guarde
    const otra = await admin.post('/Tutoria', {
      idioma: 'Francés', nivel: 'A2', tema: `${PREFIJO} Reserva admin ${sello}`, modalidad: 'Virtual', estado: 'Pendiente',
      fechaTutoria: `${fechaEnDias(21)}T10:00:00`, usuarioId: ID.docente, horarioId: h2.idHorario, cupos: 3,
    })
    expect(otra.status).toBe(201)
    tutoriaAjenaId = otra.body.idTutoria

    await page.getByRole('button', { name: /Agendar tutoría/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'El horario ya no está disponible' })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/agenda/${h2.idHorario}/agendar$`))
  })

  test('T-E1..E4 Tutor ve la tutoría asignada, sin acciones de estudiantes, y la finaliza con calificación', async ({ page }) => {
    const calls = trackApi(page)
    await login(page, 'tutor')
    const fila = page.locator('.tutoria-row').filter({ hasText: tema })
    await expect(fila).toBeVisible()
    await fila.getByRole('link', { name: tema }).click()
    await expect(page.getByRole('heading', { name: 'Estudiantes' })).toBeVisible()
    await expect(page.getByText('2 de 2 ocupados')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Agregar estudiantes' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Quitar a / })).toHaveCount(0)
    await expectAccessible(page)

    await page.getByRole('link', { name: 'Calificar y finalizar' }).click()
    await expect(page.getByRole('heading', { name: 'Calificar y finalizar', level: 1 })).toBeVisible()
    const range = page.getByRole('slider', { name: 'Calificación de 1 a 5' })
    await range.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(range).toHaveAttribute('aria-valuetext', '4,5 de 5')
    await page.getByLabel(/Comentario/).fill(`${PREFIJO} Sesión E2E`)
    await expectAccessible(page)

    const [resp] = await Promise.all([
      page.waitForResponse((r) => /\/api\/Tutoria\/\d+\/finalizar$/.test(r.url())),
      page.getByRole('button', { name: 'Guardar y finalizar' }).click(),
    ])
    expect(resp.status()).toBe(200)
    expect(resp.request().postDataJSON()).toEqual({ calificacion: 4.5, comentario: `${PREFIJO} Sesión E2E` })
    await expect(page).toHaveURL(new RegExp(`/historial/${tutoriaId}$`))
    await expect(page.getByText('Calificación de la sesión')).toBeVisible()
    await expect(page.locator('.retro__score')).toContainText('4,5')
    // Atómico: sin POST Retroalimentacion ni Encuesta/enviar
    expect(calls.some((c) => c.method === 'POST' && c.path === '/Retroalimentacion')).toBeFalsy()
    expect(calls.some((c) => /^\/Encuesta\/enviar/.test(c.path))).toBeFalsy()
  })

  test('Tutor por URL directa a una tutoría ajena → "sin acceso"', async ({ page }) => {
    await login(page, 'tutor')
    await page.goto(`/mis-tutorias/${tutoriaAjenaId}`)
    await expect(page.getByRole('heading', { name: 'No tienes acceso a esta tutoría' })).toBeVisible()
    await page.goto(`/tutorias/${tutoriaAjenaId}/finalizar`)
    await expect(page.getByRole('heading', { name: 'No tienes acceso a esta tutoría' })).toBeVisible()
    await page.goto('/agenda')
    await expect(page.getByRole('heading', { name: 'No tienes acceso a esta sección' })).toBeVisible()
  })

  test('Docente ve la tutoría finalizada en su historial con la calificación', async ({ page }) => {
    await login(page, 'docente')
    await page.goto('/historial')
    const fila = page.locator('.tutoria-row').filter({ hasText: tema })
    await expect(fila).toBeVisible()
    await expect(fila).toContainText('Finalizada')
    await fila.getByRole('link', { name: tema }).click()
    await expect(page).toHaveURL(new RegExp(`/historial/${tutoriaId}$`))
    await expect(page.locator('.retro__score')).toContainText('4,5')
    await expect(page.getByRole('link', { name: 'Calificar y finalizar' })).toHaveCount(0)
  })

  test('Docente quita un estudiante (con confirmación) de su tutoría pendiente', async ({ page }) => {
    // Usa la tutoría que reservó el Admin para el Docente en H2: se le agrega un estudiante y se quita desde la UI
    expect((await admin.post(`/Tutoria/${tutoriaAjenaId}/estudiantes`, { estudianteIds: [20] })).status).toBe(200)
    await login(page, 'docente')
    await page.goto(`/mis-tutorias/${tutoriaAjenaId}`)
    await expect(page.getByText('1 de 3 ocupados')).toBeVisible()
    await page.getByRole('button', { name: /^Quitar a Daniela/ }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Quitar estudiante' })
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: 'Quitar' }).click()
    await expect(page.getByText('0 de 3 ocupados')).toBeVisible()
  })
})
