import React, { lazy } from 'react'
import { Navigate, Outlet, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DataProvider } from '../context/DataContext'
import { homePorRol, tieneRol, GESTION } from '../lib/roles'
import Icon from '../components/ui/Icon'
const Dashboard = lazy(() => import('../pages/Dashboard'))

export const Splash = ({ label = 'Comprobando tu sesión…' }) => (
  <div className="splash" role="status" aria-live="polite">
    <span className="spinner spinner--lg" aria-hidden="true"><span /></span>
    <p>{label}</p>
  </div>
)

/** Exige sesión. Mientras se valida con /Auth/me muestra un splash. */
export const RequireAuth = () => {
  const { status, logoutReason } = useAuth()
  const location = useLocation()

  if (status === 'checking') return <Splash />
  if (status !== 'authenticated') {
    const params = new URLSearchParams()
    const destino = location.pathname + location.search
    if (destino && destino !== '/') params.set('redirect', destino)
    if (logoutReason) params.set('motivo', logoutReason)
    const qs = params.toString()
    return <Navigate to={`/login${qs ? `?${qs}` : ''}`} replace />
  }
  return <Outlet />
}

export const NoAccess = () => {
  const { user } = useAuth()
  return (
    <section className="state-panel state-panel--page state-panel--forbidden">
      <span className="state-panel__icon"><Icon name="lock" size={28} /></span>
      <h1 className="state-panel__title" tabIndex={-1} data-page-title>No tienes acceso a esta sección</h1>
      <p className="state-panel__text">Tu rol no permite abrir esta página. Si crees que es un error, contacta con Administración.</p>
      <div className="state-panel__action">
        <Link className="btn btn--primary" to={homePorRol(user)}>Ir a mi inicio</Link>
      </div>
    </section>
  )
}

export const NotFound = () => {
  const { user } = useAuth()
  return (
    <section className="state-panel state-panel--page">
      <span className="state-panel__icon"><Icon name="info" size={28} /></span>
      <h1 className="state-panel__title" tabIndex={-1} data-page-title>Página no encontrada</h1>
      <p className="state-panel__text">La dirección no existe o fue movida.</p>
      <div className="state-panel__action">
        <Link className="btn btn--primary" to={homePorRol(user)}>Ir a mi inicio</Link>
      </div>
    </section>
  )
}

/** Restringe por rol (UX). La autorización real la hace el backend. */
export const RequireRole = ({ roles }) => {
  const { user } = useAuth()
  return tieneRol(user, roles) ? <Outlet /> : <NoAccess />
}

/**
 * Datos de gestión: el DataProvider se monta SOLO para Administrador/Auxiliar y SOLO tras el login (fix W2).
 * Docente y Tutor nunca disparan GET Usuario/Horario/Tutoria (GestionWeb → 403).
 */
export const DataScope = () => {
  const { user } = useAuth()
  if (!tieneRol(user, GESTION)) return <Outlet />
  return (
    <DataProvider>
      <Outlet />
    </DataProvider>
  )
}

/** "/" → Dashboard para gestión; home del rol para Docente/Tutor. */
export const RoleHome = () => {
  const { user } = useAuth()
  if (tieneRol(user, GESTION)) return <Dashboard />
  return <Navigate to={homePorRol(user)} replace />
}
