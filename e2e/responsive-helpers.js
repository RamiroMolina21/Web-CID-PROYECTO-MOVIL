// Auditoría responsive en el navegador: desbordes, objetivos táctiles y tamaño de los campos.
// Se ejecuta con page.evaluate; devuelve hallazgos legibles (selector corto + medida).

/** Selector corto y estable para el informe. */
const describir = `(el) => {
  const parts = []
  let n = el
  for (let i = 0; n && n.nodeType === 1 && i < 3; i += 1) {
    let s = n.tagName.toLowerCase()
    if (n.id) { s += '#' + n.id; parts.unshift(s); break }
    const cls = [...n.classList].filter((c) => !/^is-|^active$/.test(c)).slice(0, 2)
    if (cls.length) s += '.' + cls.join('.')
    parts.unshift(s)
    n = n.parentElement
  }
  const txt = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 30)
  return parts.join(' > ') + (txt ? ' «' + txt + '»' : '')
}`

/**
 * Hallazgos:
 * - overflowDoc: px de scroll horizontal del documento.
 * - fuera: elementos visibles que se salen del viewport sin estar dentro de un contenedor con scroll/recorte propio.
 * - pequenos: controles interactivos visibles con alto o ancho < 44 px (excepto enlaces dentro de texto corrido).
 * - camposPequenos: inputs/selects/textarea con font-size < 16 px (provoca zoom en iOS).
 */
export const auditarPagina = async (page) =>
  page.evaluate((describirSrc) => {
    // eslint-disable-next-line no-new-func
    const describir = new Function(`return (${describirSrc})`)()
    const W = document.documentElement.clientWidth
    const visible = (el) => {
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    const enContenedorConScroll = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p)
        if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) return true
      }
      return false
    }
    const sr = (el) => el.closest('.sr-only, [aria-hidden="true"] .sr-only')

    const fuera = []
    const reportados = []
    for (const el of document.body.querySelectorAll('*')) {
      if (sr(el) || el.closest('.sr-only') || !visible(el)) continue
      if (reportados.some((r) => r.contains(el))) continue
      const r = el.getBoundingClientRect()
      if ((r.right > W + 1 || r.left < -1) && !enContenedorConScroll(el)) {
        // ignora el menú lateral oculto fuera de pantalla (drawer cerrado, inert)
        if (el.closest('[inert]')) continue
        reportados.push(el)
        fuera.push(`${describir(el)} [${Math.round(r.left)}→${Math.round(r.right)} de ${W}]`)
      }
    }

    // Recortados: se salen por los lados de su contenedor con overflow (hidden/clip/auto) sin que ese contenedor
    // sea un scroll horizontal intencionado (lista de excepciones justificadas).
    const SCROLL_H_PERMITIDO = '.calendar-week-view, .viz-table-wrap, .recharts-wrapper, .recharts-surface'
    const recortados = []
    const yaRecortados = []
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('.sr-only, [inert]') || !visible(el)) continue
      if (yaRecortados.some((r) => r.contains(el))) continue
      let cont = null
      for (let q = el.parentElement; q && q !== document.body; q = q.parentElement) {
        if (getComputedStyle(q).overflowX !== 'visible') { cont = q; break }
      }
      if (!cont || cont.matches(SCROLL_H_PERMITIDO) || cont.closest(SCROLL_H_PERMITIDO)) continue
      // Recortes intencionados: relleno parcial de estrellas y contenido visualmente oculto (1×1 px, para lectores)
      if (cont.matches('.stars__fill, .stars-display__fill')) continue
      const cr = cont.getBoundingClientRect()
      if (cr.width <= 1 || cr.height <= 1) continue
      const r = el.getBoundingClientRect()
      const c = cont.getBoundingClientRect()
      if (r.right > c.right + 1 || r.left < c.left - 1) {
        // texto truncado a propósito con elipsis: el propio elemento es el que recorta
        if (getComputedStyle(cont).textOverflow === 'ellipsis') continue
        yaRecortados.push(el)
        recortados.push(`${describir(el)} [${Math.round(r.left)}→${Math.round(r.right)} en ${describir(cont).split(' «')[0]} ${Math.round(c.left)}→${Math.round(c.right)}]`)
      }
    }

    const pequenos = []
    const interactivos = 'a[href], button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, [role="button"], summary'
    for (const el of document.querySelectorAll(interactivos)) {
      if (!visible(el) || el.closest('[inert]') || el.closest('.sr-only')) continue
      if (el.classList.contains('skip-link')) continue
      // Enlace estirado: su ::after cubre toda la fila (el objetivo real es la tarjeta)
      if (el.classList.contains('stretched-link')) continue
      // Etiquetas dentro de celdas del calendario mensual: mínimo WCAG 2.5.8 (24 px), no 44 (la celda no da más)
      if (el.matches('.month-horario-label, .month-tutoria-label')) { if (el.getBoundingClientRect().height >= 24) continue }
      // Enlaces dentro de texto corrido: excepción de WCAG 2.5.8 (en línea con el texto)
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.closest('p, li > span, td')) continue
      const r = el.getBoundingClientRect()
      if (r.height < 43.5 || r.width < 43.5) pequenos.push(`${describir(el)} ${Math.round(r.width)}×${Math.round(r.height)}`)
    }

    const camposPequenos = []
    for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea')) {
      if (!visible(el)) continue
      const fs = parseFloat(getComputedStyle(el).fontSize)
      if (fs < 16) camposPequenos.push(`${describir(el)} ${fs}px`)
    }

    return {
      overflowDoc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      fuera,
      recortados,
      pequenos: [...new Set(pequenos)],
      camposPequenos: [...new Set(camposPequenos)],
    }
  }, describir)
