import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Sidebar.css'

const Sidebar = () => {
  const location = useLocation()

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/horarios', label: 'Horarios', icon: '🕐' },
    { path: '/agendar-tutoria', label: 'Agendar Tutoría', icon: '📅' },
    { path: '/estudiantes', label: 'Usuarios', icon: '👥' },
    { path: '/retroalimentaciones', label: 'Retroalimentaciones', icon: '💬' },
    { path: '/tutorias-finalizadas', label: 'Tutorías Finalizadas', icon: '✅' }
  ]

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
    </aside>
  )
}

export default Sidebar

