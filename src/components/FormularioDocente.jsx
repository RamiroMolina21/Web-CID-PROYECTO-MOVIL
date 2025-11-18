import React, { useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import './FormularioDocente.css'

const FormularioDocente = ({ docente, onClose, onSave }) => {
  const { addDocente, updateDocente } = useData()
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    correo: '',
    contrasena: '',
    rol: 'Docente',
  })

  useEffect(() => {
    if (docente) {
      setFormData({
        nombre: docente.nombres || docente.nombre || '',
        apellido: docente.apellidos || docente.apellido || '',
        correo: docente.correo || docente.email || '',
        contrasena: '',
        rol: docente.rol || 'Docente',
      })
    }
  }, [docente])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (docente) {
        await updateDocente(docente.id, formData)
      } else {
        await addDocente(formData)
      }
      onSave()
    } catch (error) {
      alert(`Error: ${error.message || 'No se pudo guardar el docente'}`)
    }
  }

  return (
    <div className="formulario-docente-overlay">
      <div className="formulario-docente">
        <div className="formulario-docente-header">
          <h2>{docente ? 'Editar Docente' : 'Nuevo Docente'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="formulario-docente-form">
          <div className="form-group">
            <label>Nombre *</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ej: Juan"
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Apellido *</label>
            <input
              type="text"
              name="apellido"
              value={formData.apellido}
              onChange={handleChange}
              placeholder="Ej: Pérez"
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Correo *</label>
            <input
              type="email"
              name="correo"
              value={formData.correo}
              onChange={handleChange}
              placeholder="ejemplo@correo.com"
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Contraseña *</label>
            <input
              type="password"
              name="contrasena"
              value={formData.contrasena}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Rol *</label>
            <select
              name="rol"
              value={formData.rol}
              onChange={handleChange}
              required
              className="form-input"
            >
              <option value="Docente">Docente</option>
              <option value="Administrador">Administrador</option>
              <option value="Tutor">Tutor</option>
            </select>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              ✕ Cancelar
            </button>
            <button type="submit" className="btn-save">
              💾 Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default FormularioDocente





