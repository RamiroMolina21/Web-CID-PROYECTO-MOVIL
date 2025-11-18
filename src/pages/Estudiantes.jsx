import React, { useState } from 'react'
import { useData } from '../context/DataContext'
import FormularioEstudiante from '../components/FormularioEstudiante'
import FormularioDocente from '../components/FormularioDocente'
import './Estudiantes.css'

const Estudiantes = () => {
  const { estudiantes, docentes, deleteEstudiante, deleteDocente } = useData()
  const [showForm, setShowForm] = useState(false)
  const [showDocenteForm, setShowDocenteForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingEstudiante, setEditingEstudiante] = useState(null)
  const [editingDocente, setEditingDocente] = useState(null)

  // Combinar estudiantes y docentes para mostrar
  const usuarios = [
    ...estudiantes.map(e => ({ ...e, tipo: 'estudiante' })),
    ...docentes.map(d => ({ 
      ...d, 
      tipo: 'docente', 
      // El nombre ya viene completo desde mapUsuarioFromAPI, no concatenar
      nombre: d.nombre || (d.nombres && d.apellidos ? `${d.nombres} ${d.apellidos}`.trim() : d.nombres || '')
    }))
  ]

  const filteredUsuarios = usuarios.filter(usuario => {
    const query = searchQuery.toLowerCase()
    return (
      usuario.nombre.toLowerCase().includes(query) ||
      (usuario.email || usuario.correo || '').toLowerCase().includes(query) ||
      (usuario.carrera || '').toLowerCase().includes(query) ||
      (usuario.rol || '').toLowerCase().includes(query)
    )
  })

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }


  const handleDelete = async (id, tipo) => {
    const confirmMessage = tipo === 'estudiante' 
      ? '¿Estás seguro de que deseas eliminar este estudiante?'
      : '¿Estás seguro de que deseas eliminar este docente?'
    
    if (window.confirm(confirmMessage)) {
      try {
        if (tipo === 'estudiante') {
          await deleteEstudiante(id)
        } else {
          await deleteDocente(id)
        }
      } catch (error) {
        alert(`Error: ${error.message || 'No se pudo eliminar el usuario'}`)
      }
    }
  }

  const handleEdit = (usuario) => {
    if (usuario.tipo === 'estudiante') {
      setEditingEstudiante(usuario)
      setShowForm(true)
    } else {
      // Separar nombre completo en nombre y apellido para edición
      const nombreCompleto = usuario.nombre.split(' ')
      const nombre = nombreCompleto[0] || ''
      const apellido = nombreCompleto.slice(1).join(' ') || ''
      setEditingDocente({ ...usuario, nombre, apellido })
      setShowDocenteForm(true)
    }
  }

  return (
    <div className="estudiantes-page">
      <div className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p>Gestiona los usuarios del sistema</p>
        </div>
        <div className="header-buttons">
          <button className="btn-secondary" onClick={() => {
            setEditingDocente(null)
            setShowDocenteForm(true)
          }}>
            + Nuevo Docente
          </button>
          <button className="btn-primary" onClick={() => {
            setEditingEstudiante(null)
            setShowForm(true)
          }}>
            + Nuevo Estudiante
          </button>
        </div>
      </div>

      {showForm && (
        <FormularioEstudiante
          estudiante={editingEstudiante}
          onClose={() => {
            setShowForm(false)
            setEditingEstudiante(null)
          }}
          onSave={() => {
            setShowForm(false)
            setEditingEstudiante(null)
          }}
        />
      )}

      {showDocenteForm && (
        <FormularioDocente
          docente={editingDocente}
          onClose={() => {
            setShowDocenteForm(false)
            setEditingDocente(null)
          }}
          onSave={() => {
            setShowDocenteForm(false)
            setEditingDocente(null)
          }}
        />
      )}

      <div className="search-bar">
        <input
          type="text"
          placeholder="Buscar por nombre, email, carrera o rol..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <span className="search-icon">🔍</span>
      </div>

      <div className="estudiantes-grid">
        {filteredUsuarios.map((usuario) => (
          <div key={`${usuario.tipo}-${usuario.id}`} className="estudiante-card">
            <div className="estudiante-avatar-large">
              {getInitials(usuario.nombre)}
            </div>
            <div className="estudiante-info">
              <h3>{usuario.nombre}</h3>
              <div className="estudiante-id">ID: {usuario.id} | {usuario.tipo === 'estudiante' ? 'Estudiante' : 'Docente'}</div>
              <div className="estudiante-details">
                <div className="detail-item">
                  <span className="detail-icon">📧</span>
                  <span>{usuario.email || usuario.correo}</span>
                </div>
                {usuario.tipo === 'estudiante' && (
                  <>
                    <div className="detail-item">
                      <span className="detail-icon">📞</span>
                      <span>{usuario.telefono || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-icon">📚</span>
                      <span>{usuario.carrera || 'N/A'}</span>
                    </div>
                  </>
                )}
                {usuario.tipo === 'docente' && (
                  <div className="detail-item">
                    <span className="detail-icon">👤</span>
                    <span>Rol: {usuario.rol || 'Docente'}</span>
                  </div>
                )}
              </div>
              {usuario.notas && (
                <p className="estudiante-notas">{usuario.notas}</p>
              )}
            </div>
            <div className="estudiante-actions">
              <button
                className="btn-edit"
                onClick={() => handleEdit(usuario)}
              >
                ✏️ Editar
              </button>
              <button
                className="btn-delete"
                onClick={() => handleDelete(usuario.id, usuario.tipo)}
              >
                🗑️ Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredUsuarios.length === 0 && (
        <div className="empty-state">
          <p>No se encontraron usuarios</p>
        </div>
      )}
    </div>
  )
}

export default Estudiantes

