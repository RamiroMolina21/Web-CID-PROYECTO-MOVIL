import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../Sidebar'
import Icon from '../ui/Icon'
import { LogoMark } from '../ui/Logo'
import { LoadingState } from '../ui/States'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../ui/Feedback'
import { msHastaExpirar } from '../../lib/session'
import { formatHora } from '../../lib/fechas'
import { TITULOS } from '../../navigation'

const DESKTOP_QUERY = '(min-width: 1024px)'
const AVISO_EXPIRACION_MS = 5 * 60 * 1000

const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

const tituloDeRuta = (pathname) => TITULOS.find(([re]) => re.test(pathname))?.[1] || 'TutorPro'

const AppShell = () => {
  const location = useLocation()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const drawerRef = useRef(null)
  const firstRender = useRef(true)
  const { expiresAt, offline, revalidar } = useAuth()
  const toast = useToast()
  const titulo = tituloDeRuta(location.pathname)

  const closeDrawer = useCallback((restoreFocus = true) => {
    setDrawerOpen(false)
    if (restoreFocus) menuButtonRef.current?.focus()
  }, [])

  // Título del documento y foco al h1 al cambiar de ruta
  useEffect(() => {
    document.title = `${titulo} · TutorPro`
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const id = requestAnimationFrame(() => {
      const target =
        document.querySelector('[data-page-title]') ||
        document.querySelector('#contenido h1') ||
        document.getElementById('contenido')
      if (!target) return
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
      window.scrollTo(0, 0)
    })
    return () => cancelAnimationFrame(id)
  }, [location.pathname, titulo])

  // Cerrar el drawer al pasar a escritorio
  useEffect(() => {
    if (isDesktop) setDrawerOpen(false)
  }, [isDesktop])

  // Drawer móvil: Esc, foco atrapado y bloqueo de scroll
  useEffect(() => {
    if (!drawerOpen) return undefined
    const root = document.documentElement
    root.classList.add('has-drawer')
    const panel = drawerRef.current
    const focusables = () =>
      panel ? [...panel.querySelectorAll('a[href], button:not([disabled])')] : []
    focusables()[0]?.focus()

    const onKey = (e) => {
      // Un diálogo modal abierto (p. ej. confirmar cierre de sesión) gestiona su propio teclado
      if (document.querySelector('dialog[open]')) return
      if (e.key === 'Escape') {
        e.preventDefault()
        closeDrawer()
      } else if (e.key === 'Tab') {
        const els = focusables()
        if (!els.length) return
        const first = els[0]
        const last = els[els.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      root.classList.remove('has-drawer')
    }
  }, [drawerOpen, closeDrawer])

  // Aviso previo a la expiración del token (8 h, sin refresh token)
  useEffect(() => {
    if (!expiresAt) return undefined
    const ms = msHastaExpirar(expiresAt) - AVISO_EXPIRACION_MS
    if (ms <= 0 || ms > 2147483647) return undefined
    const id = setTimeout(() => {
      toast.warning(`Tu sesión vence a las ${formatHora(new Date(Date.parse(expiresAt)))}. Guarda tu trabajo.`, {
        title: 'La sesión está por expirar',
        duration: 15000,
      })
    }, ms)
    return () => clearTimeout(id)
  }, [expiresAt, toast])

  const drawerMode = !isDesktop

  return (
    <div className={`app-shell${drawerMode ? ' app-shell--drawer' : ''}${drawerOpen ? ' is-drawer-open' : ''}`}>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>

      {drawerMode && (
        <header className="topbar">
          <button
            ref={menuButtonRef}
            type="button"
            className="icon-btn topbar__menu"
            aria-label="Abrir menú"
            aria-expanded={drawerOpen}
            aria-controls="menu-lateral"
            onClick={() => setDrawerOpen(true)}
          >
            <Icon name="menu" size={22} />
          </button>
          <span className="topbar__brand">
            <LogoMark size={32} />
            <span className="topbar__title">{titulo}</span>
          </span>
        </header>
      )}

      <div
        ref={drawerRef}
        className="app-shell__nav"
        {...(drawerMode && !drawerOpen ? { inert: '' } : {})}
        {...(drawerMode ? { role: 'dialog', 'aria-modal': drawerOpen ? 'true' : undefined, 'aria-label': 'Menú' } : {})}
      >
        {drawerMode && (
          <button type="button" className="icon-btn app-shell__close" aria-label="Cerrar menú" onClick={() => closeDrawer()}>
            <Icon name="close" size={22} />
          </button>
        )}
        <Sidebar id="menu-lateral" onNavigate={() => drawerMode && closeDrawer(false)} />
      </div>
      {drawerMode && (
        <div className="app-shell__overlay" aria-hidden="true" onClick={() => closeDrawer()} />
      )}

      <main
        id="contenido"
        className="main-content"
        tabIndex={-1}
        {...(drawerMode && drawerOpen ? { inert: '' } : {})}
      >
        {offline && (
          <div className="banner banner--warning" role="status">
            <Icon name="wifiOff" size={18} />
            <span>No se pudo verificar tu sesión con el servidor. Algunos datos pueden no cargar.</span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={revalidar}>Reintentar</button>
          </div>
        )}
        <Suspense fallback={<LoadingState label="Cargando página…" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}

export default AppShell
