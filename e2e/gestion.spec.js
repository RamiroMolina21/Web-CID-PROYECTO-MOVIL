// Regresión Administrador / Auxiliar (G-E* del plan). Datos propios [PRUEBA], borrados al final.
import { test, expect } from '@playwright/test'
import {
  apiComo,
  creds,
  expectAccessible,
  expectNoHorizontalScroll,
  fechaEnDias,
  limpiarPrueba,
  login,
  PREFIJO,
  requireRole,
} from './helpers'

const sello = Date.now().toString(36)

test('G-E1 dashboard carga datos tras el login (sin 401) @responsive', async ({ page }) => {
  requireRole(test, 'admin')
  const responses = []
  page.on('response', (r) => r.url().includes('/api/') && responses.push({ url: r.url(), status: r.status() }))
  await login(page, 'admin')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(responses.filter((r) => r.status >= 400)).toEqual([])
  expect(responses.some((r) => /\/api\/Usuario$/.test(r.url) && r.status === 200)).toBeTruthy()
  await expectNoHorizontalScroll(page)
})

test('G-E5 Auxiliar crea personal solo como Docente o Tutor', async ({ page }) => {
  requireRole(test, 'auxiliar')
  await login(page, 'auxiliar')
  await page.goto('/estudiantes')
  await expect(page.getByRole('heading', { name: 'Usuarios', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nuevo Docente' })).toBeVisible()
  await page.getByRole('button', { name: 'Nuevo Tutor' }).click()
  const dlg = page.getByRole('dialog', { name: 'Nuevo Tutor' })
  await expect(dlg).toBeVisible()
  const rol = dlg.getByLabel('Rol *')
  await expect(rol).toHaveValue('Tutor')
  // Nunca Administrador ni Auxiliar en el selector del Auxiliar
  await expect(rol.locator('option')).toHaveText(['Docente', 'Tutor'])
  await rol.selectOption('Docente')
  await expect(page.getByRole('dialog', { name: 'Nuevo Docente' })).toBeVisible()
  await expectAccessible(page)
})

test('G-E5b Administrador: «Nuevo Tutor» preselecciona el rol Tutor', async ({ page }) => {
  requireRole(test, 'admin')
  await login(page, 'admin')
  await page.goto('/estudiantes')
  await page.getByRole('button', { name: 'Nuevo Tutor' }).click()
  const dlg = page.getByRole('dialog', { name: 'Nuevo Tutor' })
  await expect(dlg).toBeVisible()
  await expect(dlg.getByLabel('Rol *')).toHaveValue('Tutor')
  await expect(dlg.getByLabel('Rol *').locator('option')).toHaveText(['Docente', 'Tutor', 'Administrador', 'Auxiliar'])
  await dlg.getByRole('button', { name: /Cancelar/ }).click()
  await page.getByRole('button', { name: 'Nuevo Docente' }).click()
  await expect(page.getByRole('dialog', { name: 'Nuevo Docente' }).getByLabel('Rol *')).toHaveValue('Docente')
})

test('G-E7 Admin no entra a las vistas personales', async ({ page }) => {
  requireRole(test, 'admin')
  await login(page, 'admin')
  for (const ruta of ['/agenda', '/mis-tutorias', '/historial']) {
    await page.goto(ruta)
    await expect(page.getByRole('heading', { name: 'No tienes acceso a esta sección' })).toBeVisible()
  }
})

test.describe.serial('Gestión con datos [PRUEBA]', () => {
  let admin

  test.beforeAll(async ({ playwright }, info) => {
    test.skip(info.project.name !== 'desktop', 'Se ejecuta una vez (desktop)')
    requireRole(test, 'admin')
    admin = await apiComo(playwright, 'admin')
  })

  test.afterAll(async () => {
    if (!admin) return
    const r = await limpiarPrueba(admin)
    expect(r.errores).toEqual([])
    await admin.dispose()
  })

  test('G-E4 editar un usuario [PRUEBA] no resetea su contraseña', async ({ page, playwright }) => {
    const correo = `prueba.e2e.${sello}@cecar.test`
    const clave = `Prueba-${sello}-x1`
    const creado = await admin.post('/Usuario', { nombres: `${PREFIJO} E2E`, apellidos: `Usuario ${sello}`, correo, contrasena: clave, rolId: 4 })
    expect(creado.status).toBe(201)

    const puts = []
    page.on('request', (r) => {
      if (r.method() === 'PUT' && /\/api\/Usuario\/\d+$/.test(r.url())) puts.push(r.postDataJSON())
    })
    await login(page, 'admin')
    await page.goto('/estudiantes')
    await page.getByPlaceholder(/Buscar por nombre/).fill(sello)
    const card = page.locator('.estudiante-card').filter({ hasText: sello })
    await expect(card).toHaveCount(1)
    await card.getByRole('button', { name: /Editar/ }).click()
    const apellidos = page.locator('input[name="apellido"]')
    await apellidos.fill(`Editado ${sello}`)
    await page.locator('.btn-save').click()
    await expect.poll(() => puts.length).toBe(1)
    expect(puts[0]).not.toHaveProperty('contrasena')
    await expect(page.locator('.estudiante-card').filter({ hasText: `Editado ${sello}` })).toHaveCount(1)

    // La contraseña original sigue siendo válida: el login responde 403 (Estudiante sin acceso), no 401
    const ctx = await playwright.request.newContext()
    const r = await ctx.post(`${process.env.E2E_API_URL}/Auth/login`, { data: { correo, contrasena: clave } })
    expect(r.status()).toBe(403)
    await ctx.dispose()
  })

  test('G-E2 CRUD de horario [PRUEBA] desde la interfaz (sin campo título: lo genera el servidor)', async ({ page }) => {
    const hoy = fechaEnDias(0)
    await login(page, 'admin')
    await page.goto('/horarios')
    await page.getByRole('button', { name: 'Nuevo Horario' }).click()
    await expect(page.locator('input[name="titulo"]')).toHaveCount(0)
    await expect(page.getByLabel('Título')).toHaveCount(0)

    // Orden del formulario: 1. Fecha → 2. Horario → 3. Detalles; el foco empieza en la fecha
    const dlgForm = page.getByRole('dialog', { name: 'Nuevo horario' })
    await expect(dlgForm).toContainText('Configura la fecha, hora y disponibilidad de la sesión.')
    const leyendas = await dlgForm.locator('legend').allTextContents()
    expect(leyendas).toEqual(['1. Fecha de la sesión', '2. Horario', '3. Detalles de la sesión'])
    await expect(page.locator('#fh-fecha')).toBeFocused()
    await expect(page.getByRole('switch', { name: 'Repetir este horario' })).not.toBeChecked()
    await expect(page.locator('#fh-fechaFin')).toHaveCount(0) // "Fecha de fin" solo al repetir
    // Sin cupos en el horario: se definen al agendar la tutoría
    await expect(dlgForm.getByLabel(/Cupos/)).toHaveCount(0)
    await expect(page.locator('#horario-cupos')).toHaveCount(0)

    // Errores junto a su campo y foco al primero (en orden visual: la fecha)
    const posts = []
    page.on('request', (r) => r.method() === 'POST' && r.url().endsWith('/api/Horario') && posts.push(r))
    await page.getByRole('button', { name: /Guardar/ }).click()
    await expect(page.locator('#fh-fecha-error')).toHaveText('Indica la fecha.')
    await expect(page.locator('#fh-fecha')).toBeFocused()
    await expect(page.locator('#fh-docenteId-error')).toHaveText('Elige el docente o tutor.')
    await expectAccessible(page)

    await page.locator('#fh-docenteId').selectOption(String(process.env.E2E_DOCENTE_ID || 18))
    await page.locator('#fh-fecha').fill(hoy)
    await page.locator('#fh-horaInicio').fill('10:00')
    await page.locator('#fh-horaFin').fill('10:00')
    await page.locator('#fh-salon').fill(`${PREFIJO} Aula`)
    await page.getByRole('button', { name: /Guardar/ }).click()
    // 10:00–10:00 no es válido: error en la hora de fin; se corrige a 10:30
    await expect(page.locator('#fh-horaFin-error')).toHaveText('La hora de fin debe ser posterior a la de inicio.')
    await expect(page.locator('#fh-horaFin')).toBeFocused()
    await page.locator('#fh-horaFin').fill('10:30')
    expect(posts).toHaveLength(0)

    const [crear] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/Horario') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /Guardar/ }).click(),
    ])
    expect(crear.status()).toBe(201)
    const creado = await crear.json()
    // Contrato: sin cupos en POST /Horario → se guarda "" (la web ya no los envía)
    expect(JSON.parse(crear.request().postData() || '{}')).not.toHaveProperty('Cupos')
    expect(creado.cupos ?? '').toBe('')
    // Título generado: "{espacio} · dd/MM/yyyy HH:mm–HH:mm"
    const [y, m, d] = hoy.split('-')
    expect(creado.titulo).toBe(`${PREFIJO} Aula · ${d}/${m}/${y} 10:00–10:30`)
    let titulo = creado.titulo

    // Editar desde el calendario: vista Semana (por defecto), bloque de hoy con su franja y el Docente
    const abrirHorario = async () => {
      await page.locator(`.cal-evento[data-fecha="${hoy}"]`).filter({ hasText: 'Laura' }).filter({ hasText: /^.*10:00 – 10:\d\d/ }).first().click()
      await expect(page.locator('.horario-modal-title')).toHaveText(titulo)
    }
    await abrirHorario()
    await page.getByTitle('Editar').click()
    // Editar una sesión: sin selector de modo, título actual visible
    await expect(page.getByRole('heading', { name: 'Editar horario' })).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Repetir este horario' })).toHaveCount(0)
    await expect(page.locator('.fh__subtitulo')).toContainText(titulo)
    await expect(page.locator('#horario-cupos')).toHaveCount(0)
    await page.locator('#fh-horaFin').fill('10:45')
    const [editar] = await Promise.all([
      page.waitForResponse((r) => new RegExp(`/api/Horario/${creado.idHorario}$`).test(r.url()) && r.request().method() === 'PUT'),
      page.getByRole('button', { name: /Guardar|Actualizar/ }).last().click(),
    ])
    expect(editar.status()).toBe(200)
    expect(JSON.parse(editar.request().postData() || '{}')).not.toHaveProperty('Cupos')
    // El título generado se regenera con la nueva hora de fin
    const editado = await editar.json()
    expect(editado.titulo).toBe(`${PREFIJO} Aula · ${d}/${m}/${y} 10:00–10:45`)
    titulo = editado.titulo

    // Eliminar con el diálogo de confirmación accesible
    await abrirHorario()
    await page.getByTitle('Eliminar horario').click()
    const dlg = page.getByRole('alertdialog', { name: 'Eliminar horario' })
    await expect(dlg).toBeVisible()
    const [borrar] = await Promise.all([
      page.waitForResponse((r) => new RegExp(`/api/Horario/${creado.idHorario}$`).test(r.url()) && r.request().method() === 'DELETE'),
      dlg.getByRole('button', { name: 'Eliminar' }).click(),
    ])
    expect(borrar.status()).toBe(200)
    expect(creds('admin')).toBeTruthy()
  })
})

// ---------- Auxiliar (cuenta real; solo datos [PRUEBA] propios) ----------
test.describe.serial('Auxiliar', () => {
  let admin
  let aux
  let horario
  let tutoria
  const marca = `${Date.now().toString(36)}x`

  test.beforeAll(async ({ playwright }, info) => {
    test.skip(info.project.name !== 'desktop', 'Se ejecuta una vez (desktop)')
    requireRole(test, 'admin')
    requireRole(test, 'auxiliar')
    admin = await apiComo(playwright, 'admin')
    aux = await apiComo(playwright, 'auxiliar')
    const fecha = fechaEnDias(-1) // sesión de ayer, pendiente de finalizar
    const h = await admin.post('/Horario', {
      titulo: `${PREFIJO} Aux ${marca}`, fechaInicio: `${fecha}T00:00:00`, fechaFin: `${fecha}T23:59:59`,
      horaInicio: `${fecha}T07:00:00`, horaFin: `${fecha}T08:00:00`, cupos: '2', espacio: `${PREFIJO} Sala`,
      estado: 'Disponible', usuarioId: Number(process.env.E2E_DOCENTE_ID || 18),
    })
    expect(h.status).toBe(201)
    horario = h.body
    const t = await admin.post('/Tutoria', {
      idioma: 'Inglés', nivel: 'A1', tema: `${PREFIJO} Aux ${marca}`, modalidad: 'Virtual', estado: 'Pendiente',
      fechaTutoria: `${fecha}T07:00:00`, usuarioId: Number(process.env.E2E_DOCENTE_ID || 18), horarioId: horario.idHorario, cupos: 3,
    })
    expect(t.status).toBe(201)
    tutoria = t.body
  })

  test.afterAll(async () => {
    if (!admin) return
    const r = await limpiarPrueba(admin)
    expect(r.errores).toEqual([])
    await admin.dispose()
    await aux?.dispose()
  })

  test('accede a la gestión web: menú de gestión y dashboard', async ({ page }) => {
    await login(page, 'auxiliar')
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
    for (const nombre of ['Horarios', 'Agendar tutoría', 'Usuarios', 'Tutorías finalizadas', 'Configuración']) {
      await expect(page.getByRole('navigation', { name: 'Menú principal' }).getByRole('link', { name: nombre })).toBeVisible()
    }
  })

  test('sobre el personal solo edita (sin eliminar ni desactivar); crea y borra un Estudiante [PRUEBA]', async ({ page }) => {
    await login(page, 'auxiliar')
    await page.goto('/estudiantes')
    // La lista se pinta por lotes: se busca al docente como lo haría el usuario
    await page.getByPlaceholder(/Buscar por nombre/).fill(process.env.E2E_DOCENTE_EMAIL)
    const docente = page.locator('.estudiante-card').filter({ hasText: process.env.E2E_DOCENTE_EMAIL })
    await expect(docente).toHaveCount(1)
    await expect(docente.getByRole('button', { name: /Editar/ })).toHaveCount(1)
    await expect(docente.getByRole('button', { name: /Eliminar|Desactivar|Activar/ })).toHaveCount(0)

    await page.getByRole('button', { name: 'Nuevo Estudiante' }).click()
    await page.getByLabel('Nombres *').fill(`${PREFIJO} Aux`)
    await page.getByLabel('Apellidos *').fill(`Estudiante ${marca}`)
    await page.getByLabel('Email *').fill(`prueba.aux.${marca}@cecar.test`)
    const [crear] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/Usuario') && r.request().method() === 'POST'),
      page.locator('.btn-save').click(),
    ])
    expect(crear.status()).toBe(201)

    await page.getByPlaceholder(/Buscar por nombre/).fill(marca)
    const card = page.locator('.estudiante-card').filter({ hasText: marca })
    await expect(card).toHaveCount(1)
    await card.getByRole('button', { name: /Eliminar/ }).click()
    // Confirmación de eliminación definitiva (contrato fase 4) y resumen de lo ocurrido
    const dlg = page.getByRole('alertdialog', { name: /^¿Eliminar a .*\?$/ })
    await expect(dlg).toContainText('definitivo')
    const [borrar] = await Promise.all([
      page.waitForResponse((r) => /\/api\/Usuario\/\d+$/.test(r.url()) && r.request().method() === 'DELETE'),
      dlg.getByRole('button', { name: 'Eliminar definitivamente' }).click(),
    ])
    expect(borrar.status()).toBe(200)
    const resumen = page.getByRole('dialog', { name: / se eliminó$/ })
    await expect(resumen).toBeVisible()
    await resumen.getByRole('button', { name: 'Entendido' }).click()
    await expect(card).toHaveCount(0)
  })

  test('crea un Tutor [PRUEBA] desde la UI y lo edita', async ({ page }) => {
    await login(page, 'auxiliar')
    await page.goto('/estudiantes')
    await page.getByRole('button', { name: 'Nuevo Tutor' }).click()
    const dlg = page.getByRole('dialog', { name: 'Nuevo Tutor' })
    await dlg.getByLabel('Nombre *').fill(`${PREFIJO} AuxTutor`)
    await dlg.getByLabel('Apellido *').fill(`Personal ${marca}`)
    await dlg.getByLabel('Correo *').fill(`prueba.auxtutor.${marca}@cecar.test`)
    await dlg.getByLabel('Contraseña *').fill(`AuxTutor-${marca}1`)
    const [crear] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/Usuario') && r.request().method() === 'POST'),
      dlg.getByRole('button', { name: /Guardar/ }).click(),
    ])
    expect(crear.status()).toBe(201)

    await page.getByPlaceholder(/Buscar por nombre/).fill(`Personal ${marca}`)
    const card = page.locator('.estudiante-card').filter({ hasText: `Personal ${marca}` })
    await expect(card).toHaveCount(1)
    await expect(card.getByRole('button', { name: /Eliminar|Desactivar/ })).toHaveCount(0)
    await card.getByRole('button', { name: /Editar/ }).click()
    const editar = page.getByRole('dialog', { name: 'Editar Tutor' })
    await expect(editar.getByLabel('Contraseña', { exact: true })).toHaveValue('')
    await editar.getByLabel('Apellido *').fill(`Personal ${marca} Editado`)
    const [put] = await Promise.all([
      page.waitForResponse((r) => /\/api\/Usuario\/\d+$/.test(r.url()) && r.request().method() === 'PUT'),
      editar.getByRole('button', { name: /Guardar/ }).click(),
    ])
    expect(put.status()).toBe(200)
    await expect(page.locator('.estudiante-card').filter({ hasText: 'Editado' })).toHaveCount(1)
  })

  test('si forzara crear un Administrador o Auxiliar, el backend responde 403 con mensaje', async () => {
    for (const rolId of [1, 5]) {
      const r = await aux.post('/Usuario', {
        nombres: `${PREFIJO} Forzado`, apellidos: marca, correo: `prueba.forzado${rolId}.${marca}@cecar.test`, contrasena: `Forzado-${marca}1`, rolId,
      })
      expect(r.status).toBe(403)
      expect(r.body.message).toBeTruthy()
    }
  })

  test('puede finalizar una tutoría [PRUEBA] con calificación', async ({ page }) => {
    await login(page, 'auxiliar')
    await page.goto(`/tutorias/${tutoria.idTutoria}/finalizar`)
    await expect(page.getByRole('heading', { name: 'Calificar y finalizar', level: 1 })).toBeVisible()
    await page.getByLabel(/Comentario/).fill(`${PREFIJO} Auxiliar`)
    const [resp] = await Promise.all([
      page.waitForResponse((r) => /\/api\/Tutoria\/\d+\/finalizar$/.test(r.url())),
      page.getByRole('button', { name: 'Guardar y finalizar' }).click(),
    ])
    expect(resp.status()).toBe(200)
    expect(resp.request().postDataJSON()).toEqual({ calificacion: 3, comentario: `${PREFIJO} Auxiliar` })
    await expect(page).toHaveURL(/\/tutorias-finalizadas$/)
  })
})
