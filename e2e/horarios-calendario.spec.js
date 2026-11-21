// Página Horarios: franjas visibles por docente, filtro con resumen semanal, detalle y lista en móvil.
// Datos [PRUEBA] por la API (docente, 2 horarios disponibles y 1 tutoría la semana que viene), borrados al final.
import { test, expect } from '@playwright/test'
import { apiComo, crearHorarioPrueba, expectAccessible, expectNoHorizontalScroll, limpiarPrueba, login, PREFIJO, requireRole } from './helpers'

const sello = Date.now().toString(36)
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const lunesProximo = (() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const dia = d.getDay()
  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1) + 7)
  return d
})()
const dia = (n) => {
  const d = new Date(lunesProximo)
  d.setDate(d.getDate() + n)
  return d
}
const MARTES = iso(dia(1))
const MIERCOLES = iso(dia(2))
const JUEVES = iso(dia(3))

// CAPTURAS=<carpeta>: capturas para la revisión manual (1280/375, claro/oscuro)
const capturar = async (page, nombre) => {
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/${nombre}.png`, fullPage: true })
}

test.describe.serial('Horarios: horarios de los profesores [PRUEBA]', () => {
  let admin
  let docente
  const tema = `${PREFIJO} Calendario ${sello}`

  test.beforeAll(async ({ playwright }, info) => {
    test.skip(info.project.name !== 'desktop', 'Datos propios: una vez, en desktop (incluye la comprobación a 375 px)')
    requireRole(test, 'admin')
    admin = await apiComo(playwright, 'admin')
    const r = await admin.post('/Usuario', {
      nombres: `${PREFIJO} Calendario`, apellidos: `Docente ${sello}`, correo: `prueba.calendario.${sello}@cecar.test`, contrasena: `Calendario-${sello}-1`, rolId: 3,
    })
    expect(r.status).toBe(201)
    docente = r.body
    await crearHorarioPrueba(admin, { titulo: `Cal mar ${sello}`, fecha: MARTES, horaInicio: '09:00', horaFin: '11:00', usuarioId: docente.idUsuario })
    await crearHorarioPrueba(admin, { titulo: `Cal mie ${sello}`, fecha: MIERCOLES, horaInicio: '16:00', horaFin: '18:00', usuarioId: docente.idUsuario })
    const h3 = await crearHorarioPrueba(admin, { titulo: `Cal jue ${sello}`, fecha: JUEVES, horaInicio: '10:00', horaFin: '11:00', usuarioId: docente.idUsuario })
    const t = await admin.post('/Tutoria', {
      idioma: 'Inglés', nivel: 'B1', tema, modalidad: 'Virtual', estado: 'Pendiente',
      fechaTutoria: `${JUEVES}T10:00:00`, usuarioId: docente.idUsuario, horarioId: h3.idHorario, cupos: 3,
    })
    expect(t.status).toBe(201)
  })

  test.afterAll(async () => {
    if (!admin) return
    const r = await limpiarPrueba(admin)
    expect(r.errores).toEqual([])
    await admin.dispose()
  })

  test('Semana por defecto: franja primero, docente y tipo; filtro con resumen semanal; detalle', async ({ page }) => {
    for (const tema_ of ['light', 'dark']) {
      await page.addInitScript((t) => localStorage.setItem('theme', t), tema_)
      await login(page, 'admin')
      await page.goto('/horarios')
      await expect(page.getByLabel('Vista del calendario')).toHaveValue('semana')
      await page.getByRole('button', { name: 'Periodo siguiente' }).click()

      // Sin filtro ya se ve la franja y el docente de cada evento
      const martes = page.locator(`.cal-evento[data-fecha="${MARTES}"]`).filter({ hasText: `Docente ${sello}` })
      await expect(martes).toHaveCount(1)
      await expect(martes.locator('.cal-evento__hora')).toHaveText('9:00 – 11:00')
      await expect(martes).toHaveAccessibleName(new RegExp(`^Disponible, Martes, .*9:00 – 11:00.*Calendario Docente ${sello}`))

      // Filtro por docente: solo sus eventos y su resumen Día | Horario
      await page.getByLabel('Docente o tutor').selectOption(String(docente.idUsuario))
      const eventos = page.locator('.cal-evento')
      await expect(eventos).toHaveCount(3)
      const tutoria = page.locator('.cal-evento[data-tipo="tutoria"]')
      await expect(tutoria).toContainText('10:00 – 11:00')
      await expect(tutoria).toContainText(tema)
      await expect(tutoria).toHaveAccessibleName(/^Tutoría, /)

      const resumen = page.getByRole('table', { name: /Disponibilidad semanal/ })
      await expect(resumen.getByRole('row', { name: /^Martes/ })).toContainText('9:00 – 11:00')
      await expect(resumen.getByRole('row', { name: /^Miércoles/ })).toContainText('16:00 – 18:00')
      await expect(resumen.getByRole('row', { name: /^Jueves/ })).toHaveCount(0) // el jueves ya tiene tutoría
      await expectAccessible(page)
      await expectNoHorizontalScroll(page)
      await capturar(page, `semana-1280-${tema_}`)

      // Detalle del horario y de la tutoría
      await martes.click()
      const dlg = page.getByRole('dialog')
      await expect(dlg.getByRole('button', { name: 'Editar horario' })).toBeVisible()
      await dlg.getByRole('button', { name: 'Cerrar' }).click()
      await expect(dlg).toHaveCount(0)
      await tutoria.click()
      const dlgT = page.getByRole('dialog')
      await expect(dlgT).toContainText('10:00')
      await dlgT.getByRole('button', { name: /Cerrar/ }).first().click()
      await expect(dlgT).toHaveCount(0)

      // Mes: hora primero y nombre abreviado, sin truncar a ciegas
      await page.getByLabel('Vista del calendario').selectOption('mes')
      const mesDe = (s) => Number(s.slice(5, 7))
      if (mesDe(MARTES) !== new Date().getMonth() + 1) await page.getByRole('button', { name: 'Periodo siguiente' }).click()
      const enMes = page.locator(`.cal-evento--mes[data-fecha="${MARTES}"]`)
      await expect(enMes.locator('.cal-evento__hora')).toHaveText('9:00')
      await expect(enMes.locator('.cal-evento__docente')).toHaveText(`${PREFIJO} Docente`)
      await expectAccessible(page)
      await capturar(page, `mes-1280-${tema_}`)
    }
  })

  test('Móvil (375 px): lista por día con franjas, sin rejilla', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    for (const tema_ of ['light', 'dark']) {
      await page.addInitScript((t) => localStorage.setItem('theme', t), tema_)
      await login(page, 'admin')
      await page.goto('/horarios')
      await page.getByRole('button', { name: 'Periodo siguiente' }).click()
      await page.getByLabel('Docente o tutor').selectOption(String(docente.idUsuario))
      await expect(page.locator('.cal-rejilla')).toHaveCount(0)
      const dia_ = page.getByRole('region', { name: new RegExp(`^Martes, ${Number(MARTES.slice(8))} de`) })
      await expect(dia_.locator('.cal-evento')).toContainText('9:00 – 11:00')
      await expect(page.getByRole('table', { name: /Disponibilidad semanal/ })).toBeVisible()
      await expectAccessible(page)
      await expectNoHorizontalScroll(page)
      await capturar(page, `semana-375-${tema_}`)
    }
  })
})
