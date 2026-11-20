// Marca (logo/favicon), ausencia de emojis y lista incremental de Usuarios. Datos propios [PRUEBA], borrados al final.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  apiComo,
  expectAccessible,
  expectNoHorizontalScroll,
  limpiarPrueba,
  login,
  PREFIJO,
  requireRole,
} from './helpers'

// Emojis y pictogramas (Unicode Extended_Pictographic), selector de variante emoji (U+FE0F), keycap (U+20E3)
// y los símbolos que se usaban como iconos: ✓ ✔ ✕ ✖ ✗ ✘ (U+2713–2718) y ★ ☆ (U+2605–2606).
// Búsqueda reproducible equivalente: rg -n --pcre2 "[\p{Extended_Pictographic}\x{FE0F}\x{20E3}\x{2713}-\x{2718}\x{2605}\x{2606}]" src index.html
export const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{20E3}\u{2713}-\u{2718}\u{2605}\u{2606}]/u

const LOTE = 20
const sello = Date.now().toString(36)

test('X-1 sin emojis ni pictogramas en src/ ni en index.html', () => {
  const raiz = process.cwd()
  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
  const archivos = [...walk(path.join(raiz, 'src')).filter((f) => /\.(jsx?|tsx?|css|html|json)$/.test(f)), path.join(raiz, 'index.html')]
  const hallazgos = []
  for (const f of archivos) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((linea, i) => {
      const m = linea.match(EMOJI_RE)
      if (m) hallazgos.push(`${path.relative(raiz, f)}:${i + 1} → ${m[0]} (U+${m[0].codePointAt(0).toString(16).toUpperCase()})`)
    })
  }
  expect(archivos.length).toBeGreaterThan(50)
  expect(hallazgos).toEqual([])
})

test('X-2 favicon y apple-touch-icon servidos y enlazados', async ({ page, request }) => {
  const fav = await request.get('/favicon.svg')
  expect(fav.status()).toBe(200)
  expect(fav.headers()['content-type']).toContain('image/svg+xml')
  expect(await fav.text()).toContain('<title>CDITutorPro</title>')
  const touch = await request.get('/apple-touch-icon.png')
  expect(touch.status()).toBe(200)
  expect(touch.headers()['content-type']).toContain('image/png')

  await page.goto('/login')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#b11d25')
  await expect(page.locator('link[href="/vite.svg"]')).toHaveCount(0)
})

test('X-3 logo oficial del CDI en el login y en la encuesta pública, accesibles en claro y oscuro @responsive', async ({ page }) => {
  for (const tema of ['light', 'dark']) {
    await page.addInitScript((t) => localStorage.setItem('theme', t), tema)
    await page.goto('/login')
    const h1 = page.getByRole('heading', { name: 'CDITutorPro', level: 1 })
    await expect(h1).toBeVisible()
    // Logo oficial del Centro de Idiomas (imagen con alt) y fondo institucional con capa oscura
    const logo = page.getByRole('img', { name: 'CDI · Centro de Idiomas · CECAR' })
    await expect(logo).toBeVisible()
    expect(await logo.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true)
    expect(await page.locator('.login-container').evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('fondologin')
    await expectAccessible(page)
    await expectNoHorizontalScroll(page)

    await page.goto('/encuesta')
    await expect(page.locator('.survey-head svg.logo-mark')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Enlace inválido' })).toBeVisible()
    await expectAccessible(page)
  }
})

test('X-4 logo en el shell: menú lateral en escritorio, barra superior en tablet/móvil @responsive', async ({ page }) => {
  requireRole(test, 'admin')
  await login(page, 'admin')
  const ancho = page.viewportSize().width
  if (ancho >= 1024) {
    await expect(page.locator('.sidebar-header svg.logo-mark')).toBeVisible()
    await expect(page.locator('.sidebar-header .brand__name')).toHaveText('CDITutorPro')
  } else {
    await expect(page.locator('.topbar svg.logo-mark')).toBeVisible()
    await page.getByRole('button', { name: 'Abrir menú' }).click()
    await expect(page.locator('.sidebar-header svg.logo-mark')).toBeVisible()
  }
})

for (const [ruta, titulo] of [['/horarios', 'Horarios'], ['/agendar-tutoria', null], ['/tutorias-finalizadas', 'Tutorías Finalizadas']]) {
  test(`X-5 ${ruta} sin emojis renderizados y accesible en claro y oscuro @responsive`, async ({ page }) => {
    requireRole(test, 'admin')
    for (const tema of ['light', 'dark']) {
      await page.addInitScript((t) => localStorage.setItem('theme', t), tema)
      await login(page, 'admin')
      await page.goto(ruta)
      if (titulo) await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
      await page.waitForLoadState('networkidle')
      const texto = await page.locator('#contenido').innerText()
      expect(texto.match(new RegExp(EMOJI_RE.source, 'gu')) || []).toEqual([])
      await expectAccessible(page)
      await expectNoHorizontalScroll(page)
    }
  })
}

test.describe('X-6 Usuarios: carga incremental [PRUEBA]', () => {
  let admin

  test.beforeAll(async ({ playwright }) => {
    requireRole(test, 'admin')
    admin = await apiComo(playwright, 'admin')
    // Garantiza más de un lote aunque la BD tenga pocos usuarios
    for (let i = 0; i < 6; i += 1) {
      const r = await admin.post('/Usuario', {
        nombres: `${PREFIJO} Lote`,
        apellidos: `Usuario ${sello} ${i}`,
        correo: `prueba.lote.${sello}.${i}@cecar.test`,
        contrasena: `Lote-${sello}-${i}x`,
        rolId: 4,
      })
      expect(r.status, JSON.stringify(r.body)).toBe(201)
    }
  })

  test.afterAll(async () => {
    if (!admin) return
    const r = await limpiarPrueba(admin)
    expect(r.errores).toEqual([])
    await admin.dispose()
  })

  test('lote inicial, más al hacer scroll y con "Cargar más", contador y reinicio al buscar @responsive', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/estudiantes')
    await expect(page.getByRole('heading', { name: 'Usuarios', level: 1 })).toBeVisible()
    const tarjetas = page.locator('.estudiante-card')
    const contador = page.locator('.usuarios-count')
    await expect(tarjetas.first()).toBeVisible()

    const total = Number((await contador.locator('strong').nth(1).textContent()).trim())
    expect(total).toBeGreaterThan(LOTE)
    await expect(tarjetas).toHaveCount(LOTE)
    await expect(contador).toContainText(`Mostrando ${LOTE} de ${total} usuarios`)

    // Scroll hasta el final de lo pintado: el centinela carga el siguiente lote
    await page.locator('.usuarios-sentinel').scrollIntoViewIfNeeded()
    const segundo = Math.min(total, LOTE * 2)
    await expect(tarjetas).toHaveCount(segundo)
    await expect(contador).toContainText(`Mostrando ${segundo} de ${total} usuarios`)

    // Respaldo accesible: botón "Cargar más" hasta completar
    for (let n = segundo; n < total; n = Math.min(total, n + LOTE)) {
      await page.getByRole('button', { name: /^Cargar \d+ más/ }).click()
      await expect(tarjetas).toHaveCount(Math.min(total, n + LOTE))
    }
    await expect(page.getByRole('button', { name: /^Cargar \d+ más/ })).toHaveCount(0)
    await expect(contador).toContainText(`Mostrando ${total} de ${total} usuarios`)

    // Buscar reinicia el lote y el contador refleja el filtro
    await page.getByPlaceholder(/Buscar por nombre/).fill(sello)
    await expect(tarjetas).toHaveCount(6)
    await expect(contador).toContainText('Mostrando 6 de 6 usuarios')
    await page.getByPlaceholder(/Buscar por nombre/).fill('')
    await expect(tarjetas).toHaveCount(LOTE)

    // Escritorio: scroll propio de la lista; tablet/móvil: scroll de la página (sin scroll anidado)
    const overflow = await page.locator('.usuarios-scroll').evaluate((el) => getComputedStyle(el).overflowY)
    expect(overflow).toBe(page.viewportSize().width >= 1024 ? 'auto' : 'visible')

    await expectNoHorizontalScroll(page)
    await expectAccessible(page)
    await page.evaluate(() => localStorage.setItem('theme', 'dark'))
    await page.reload()
    await expect(tarjetas).toHaveCount(LOTE)
    await expectAccessible(page)
  })
})
