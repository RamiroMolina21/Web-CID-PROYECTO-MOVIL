import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useConfirm } from './ui/Feedback'
import Icon from './ui/Icon'
import Logo from './ui/Logo'
import { NAV_POR_ROL } from '../navigation'
import { getRol, iniciales, nombreCompleto, normalizarRol } from '../lib/roles'
import './Sidebar.css'

const Sidebar = ({ id, onNavigate }) => {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const confirm = useConfirm()

  const rol = normalizarRol(getRol(user))
  const items = NAV_POR_ROL[rol] || []
  const nombre = nombreCompleto(user) || user?.correo || 'Usuario'

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Cerrar sesión',
      message: '¿Seguro que deseas cerrar sesión?',
      confirmLabel: 'Cerrar sesión',
      danger: true,
    })
    if (ok) logout()
  }

  return (
    <aside className="sidebar" id={id} aria-label="Navegación principal">
      <div className="sidebar-header">
        <Logo size={44} tagline="Gestión de tutorías" />
      </div>

      <nav className="sidebar-menu" aria-labelledby="menu-title">
        <h2 className="menu-title" id="menu-title">Menú principal</h2>
        <ul className="menu-nav">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}
                onClick={onNavigate}
              >
                <Icon name={item.icon} className="menu-icon" />
                <span className="menu-label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar" aria-hidden="true">{iniciales(nombre)}</div>
          <div className="user-details">
            <p className="user-name" title={nombre}>{nombre}</p>
            <p className="user-role">{rol || getRol(user)}</p>
          </div>
        </div>
        <button type="button" className="theme-toggle" onClick={toggleTheme}>
          <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
          <span>{theme === 'light' ? 'Modo oscuro' : 'Modo claro'}</span>
        </button>
        <button type="button" className="logout-button" onClick={handleLogout}>
          <Icon name="logout" size={18} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
