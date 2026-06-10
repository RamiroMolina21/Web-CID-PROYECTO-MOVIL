import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import './Sidebar.css'

const Sidebar = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/horarios', label: 'Horarios', icon: '🕐' },
    { path: '/agendar-tutoria', label: 'Agendar Tutoría', icon: '📅' },
    { path: '/estudiantes', label: 'Usuarios', icon: '👥' },
    { path: '/tutorias-finalizadas', label: 'Tutorías Finalizadas', icon: '✅' }
  ]

  const handleLogout = () => {
    if (window.confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      logout()
      navigate('/login')
    }
  }

  // Obtener nombre completo del usuario
  const getNombreCompleto = () => {
    if (!user) return 'Usuario'
    const nombres = user.nombres || user.Nombres || ''
    const apellidos = user.apellidos || user.Apellidos || ''
    return `${nombres} ${apellidos}`.trim() || user.correo || user.Correo || 'Usuario'
  }

  // Obtener rol del usuario
  const getRol = () => {
    if (!user) return ''
    const rol = user.tipoRol || user.TipoRol || ''
    return rol.charAt(0).toUpperCase() + rol.slice(1).toLowerCase()
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">📚</div>
        </div>
        <div className="logo-text">
          <h1>TutorPro</h1>
          <p>Gestión de Tutorías</p>
        </div>
      </div>

      <div className="sidebar-menu">
        <h3 className="menu-title">MENÚ PRINCIPAL</h3>
        <nav className="menu-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`menu-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="menu-icon">{item.icon}</span>
              <span className="menu-label">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {getNombreCompleto()
              .split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </div>
          <div className="user-details">
            <div className="user-name">{getNombreCompleto()}</div>
            <div className="user-role">{getRol()}</div>
          </div>
        </div>
        <button type="button" className="theme-toggle" onClick={toggleTheme}>
          <span>{theme === 'light' ? '🌙' : '☀️'}</span>
          <span>{theme === 'light' ? 'Modo oscuro' : 'Modo claro'}</span>
        </button>
        <button className="logout-button" onClick={handleLogout}>
          <span className="logout-icon">🚪</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar

