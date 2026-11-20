// Casos que NO requieren backend (X5/X9 parciales, X10, X12, X14 parcial del plan).
import { test, expect } from '@playwright/test'
import { expectAccessible, expectNoHorizontalScroll } from './helpers'

test.describe('Sin sesión', () => {
  test('una ruta protegida redirige al login conservando el destino @responsive', async ({ page }) => {
    await page.goto('/mis-tutorias')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fmis-tutorias/)
    await expect(page.getByRole('heading', { name: 'CDITutorPro' })).toBeVisible()
  })

  test('validación del formulario sin llamar a la API', async ({ page }) => {
    const apiCalls = []
    page.on('request', (r) => r.url().includes('/api/') && apiCalls.push(r.url()))
    await page.goto('/login')
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.getByText('Escribe tu correo institucional.')).toBeVisible()
    await expect(page.getByText('Escribe tu contraseña.')).toBeVisible()
    await page.getByLabel('Correo institucional').fill('no-es-correo')
    await page.getByLabel('Contraseña', { exact: true }).fill('123')
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.getByText('El formato del correo no es válido.')).toBeVisible()
    await expect(page.getByText('La contraseña tiene al menos 6 caracteres.')).toBeVisible()
    expect(apiCalls).toEqual([])
  })

  test('mostrar/ocultar contraseña', async ({ page }) => {
    await page.goto('/login')
    const pwd = page.getByLabel('Contraseña', { exact: true })
    await expect(pwd).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click()
    await expect(pwd).toHaveAttribute('type', 'text')
  })

  test('motivo de expiración visible @responsive', async ({ page }) => {
    await page.goto('/login?motivo=expirada')
    await expect(page.getByText('Tu sesión ha expirado. Inicia sesión de nuevo.')).toBeVisible()
  })

  test('login accesible y sin scroll horizontal @responsive', async ({ page }) => {
    await page.goto('/login')
    await expectAccessible(page)
    await expectNoHorizontalScroll(page)
  })

  test('encuesta sin token muestra enlace inválido sin Authorization', async ({ page }) => {
    await page.goto('/encuesta')
    await expect(page.getByRole('heading', { name: 'Enlace inválido' })).toBeVisible()
  })

  test('sesión corrupta en storage se descarta', async ({ page }) => {
    await page.goto('/login')
    await page.evaluate(() =>
      localStorage.setItem('tutorpro.session.v1', JSON.stringify({ token: 'x', expiresAt: '2000-01-01T00:00:00Z', usuario: { tipoRol: 'Tutor' } }))
    )
    await page.goto('/mis-tutorias')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fmis-tutorias&motivo=expirada/)
    expect(await page.evaluate(() => localStorage.getItem('tutorpro.session.v1'))).toBeNull()
  })
})
