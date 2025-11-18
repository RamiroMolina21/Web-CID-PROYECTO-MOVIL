import React, { useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import './FormularioEstudiante.css'

const FormularioEstudiante = ({ estudiante, onClose, onSave }) => {
  const { addEstudiante, updateEstudiante } = useData()
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    semestre: '',
    carrera: '',
    notas: '',
  })

  useEffect(() => {
    if (estudiante) {
      const nombres = estudiante.nombres || estudiante.nombre || ''
      const apellidos = estudiante.apellidos || estudiante.apellido || ''

      setFormData({
        nombre: nombres,
        apellido: apellidos,
        email: estudiante.email || estudiante.correo || '',
        telefono: estudiante.telefono || '',
        semestre: estudiante.semestre || '',
        carrera: estudiante.carrera || '',
        notas: estudiante.notas || '',
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

          <div className="form-group">
            <label>Teléfono</label>
            <input
              type="tel"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              placeholder="+52 123 456 7890"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Semestre</label>
            <input
              type="text"
              name="semestre"
              value={formData.semestre}
              onChange={handleChange}
              placeholder="Ej: 5to Semestre"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Carrera / Programa</label>
            <input
              type="text"
              name="carrera"
              value={formData.carrera}
              onChange={handleChange}
              placeholder="Ej: Ingeniería en Sistemas"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Notas Adicionales</label>
            <textarea
              name="notas"
              value={formData.notas}
              onChange={handleChange}
              placeholder="Información adicional sobre el estudiante..."
              rows="4"
              className="form-textarea"
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






