import React, { useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import './FormularioEstudiante.css'

const FormularioEstudiante = ({ estudiante, onClose, onSave }) => {
  const { addEstudiante, updateEstudiante } = useData()
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
  })

  useEffect(() => {
    if (estudiante) {
      const nombres = estudiante.nombres || estudiante.nombre || ''
      const apellidos = estudiante.apellidos || estudiante.apellido || ''

      setFormData({
        nombre: nombres,
        apellido: apellidos,
        email: estudiante.email || estudiante.correo || '',
      })
    }
  }, [estudiante])

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
      if (estudiante) {
        await updateEstudiante(estudiante.id, formData)
      } else {
        await addEstudiante(formData)
      }
      onSave()
    } catch (error) {
      alert(`Error: ${error.message || 'No se pudo guardar el estudiante'}`)
    }
  }

  return (
    <div className="formulario-estudiante-overlay">
      <div className="formulario-estudiante">
        <div className="formulario-estudiante-header">
          <h2>{estudiante ? 'Editar Estudiante' : 'Nuevo Estudiante'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="formulario-estudiante-form">
          <div className="form-group">
            <label>Nombres *</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ej: Juan Carlos"
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Apellidos *</label>
            <input
              type="text"
              name="apellido"
              value={formData.apellido}
              onChange={handleChange}
              placeholder="Ej: Pérez García"
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="ejemplo@correo.com"
              required
              className="form-input"
            />
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

export default FormularioEstudiante






