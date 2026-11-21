// Modales de gestión en claro y oscuro con axe (tokens, contraste ≥4.5:1, semántica de diálogo).
// Requiere backend. Crea un horario [PRUEBA] de hoy para abrir su detalle; se borra al final.
import { test, expect } from '@playwright/test'
import { apiComo, crearHorarioPrueba, expectAccessible, fechaEnDias, limpiarPrueba, login, requireRole } from './helpers'

const sello = Date.now().toString(36)
const DOCENTE_ID = Number(process.env.E2E_DOCENTE_ID || 18)
const TEMAS = ['light', 'dark']

const abrirCon = async (page, tema, ruta) => {
  await page.addInitScript((t) => localStorage.setItem('theme', t), tema)
  await login(page, 'admin')
  await page.goto(ruta)
  await expect(page.locator('html')).toHaveAttribute('data-theme', tema)
}

test.describe('M-E modales de gestión', () => {
  let admin
  let horario

  test.beforeAll(async ({ playwright }) => {
    requireRole(test, 'admin')
    admin = await apiComo(playwright, 'admin')
    horario = await crearHorarioPrueba(admin, { titulo: `Modal ${sello}`, fecha: fechaEnDias(0), usuarioId: DOCENTE_ID })
  })

  test.afterAll(async () => {
    if (!admin) return
    const r = await limpiarPrueba(admin)
    expect(r.errores).toEqual([])
    await admin.dispose()
  })

  for (const tema of TEMAS) {
    test(`tutoría finalizada (${tema}): abre con teclado, botón Descargar de marca, accesible @responsive`, async ({ page }) => {
      await abrirCon(page, tema, '/tutorias-finalizadas')
      const tarjeta = page.locator('.tutoria-card').first()
      await expect(tarjeta).toBeVisible()
      await tarjeta.focus()
      await page.keyboard.press('Enter')
      const modal = page.getByRole('dialog')
      await expect(modal).toBeVisible()
      await expect(modal.getByRole('heading', { level: 2 })).toBeVisible()
      // Espera a que terminen de cargar retroalimentación y encuestas
      await expect(modal.getByText(/Cargando/)).toHaveCount(0, { timeout: 15_000 })
      const descargar = modal.getByRole('button', { name: /Descargar/ })
      await expect(descargar).toBeVisible()
      const fondo = await descargar.evaluate((b) => getComputedStyle(b).backgroundColor)
      expect(fondo).not.toBe('rgb(59, 130, 246)') // ya no el azul #3b82f6 ajeno a la marca
      await expectAccessible(page)
      await modal.getByRole('button', { name: 'Cerrar' }).click()
      await expect(modal).toHaveCount(0)
    })

    // Solo escritorio: la vista Semana (por defecto) con bloques por docente es la de 1280 px
    test(`detalle de horario (${tema}): accesible`, async ({ page }) => {
      await abrirCon(page, tema, '/horarios')
      await page.locator(`.cal-evento[data-fecha="${fechaEnDias(0)}"]`).filter({ hasText: 'Laura' }).first().click()
      const modal = page.getByRole('dialog', { name: horario.titulo })
      await expect(modal).toBeVisible()
      await expect(modal.getByRole('button', { name: 'Editar horario' })).toBeVisible()
      await expectAccessible(page)
      await modal.getByRole('button', { name: 'Cerrar' }).click()
      await expect(modal).toHaveCount(0)
    })

    test(`agregar estudiante a tutoría (${tema}): sigue el tema y es accesible @responsive`, async ({ page }) => {
      await abrirCon(page, tema, '/agendar-tutoria')
      const boton = page.locator('.tutoria-agregar-estudiante-btn:not([disabled])').first()
      await expect(boton).toBeVisible()
      await boton.click()
      const modal = page.getByRole('dialog', { name: /Agregar Estudiante/ })
      await expect(modal).toBeVisible()
      // El fondo del modal usa --modal-bg (antes era #2d2d2d también en claro)
      const fondo = await page.locator('.agregar-estudiante-modal').evaluate((m) => getComputedStyle(m).backgroundColor)
      expect(fondo).toBe(tema === 'light' ? 'rgb(255, 255, 255)' : 'rgb(45, 45, 45)')
      await expectAccessible(page)
      await modal.getByRole('button', { name: 'Cerrar' }).click()
      await expect(modal).toHaveCount(0)
    })
  }
})
