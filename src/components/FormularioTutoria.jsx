import React, { useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import './FormularioTutoria.css'

const FormularioTutoria = ({ horario, tutoria, onClose, isModal }) => {
  const { docentes, tutorias, horarios, addTutoria, updateTutoria } = useData()
  const isEditing = !!tutoria
  const hasDocentes = docentes && docentes.length > 0
  
  const [formData, setFormData] = useState({
    docenteId: tutoria?.docenteId || horario?.docenteId || '',
    tema: tutoria?.tema || '',
    idioma: tutoria?.idioma || '',
    nivel: tutoria?.nivel || '',
    modalidad: tutoria?.modalidad || '',
    fecha: tutoria?.fecha || horario?.fecha || new Date().toISOString().split('T')[0],
    horaInicio: tutoria?.horaInicio || horario?.horaInicio || '09:00',
    horaFin: tutoria?.horaFin || horario?.horaFin || '10:00'
  })

  useEffect(() => {
    if (tutoria) {
      setFormData({
        docenteId: tutoria.docenteId || '',
        tema: tutoria.tema || '',
        idioma: tutoria.idioma || '',
        nivel: tutoria.nivel || '',
        modalidad: tutoria.modalidad || '',
        fecha: tutoria.fecha || new Date().toISOString().split('T')[0],
        horaInicio: tutoria.horaInicio || '09:00',
        horaFin: tutoria.horaFin || '10:00'
      })
    }
  }, [tutoria])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!hasDocentes) {
      alert('No hay docentes/tutores registrados. Por favor agrega uno antes de agendar la tutoría.')
      return
    }

    if (!formData.docenteId) {
      alert('Por favor selecciona un docente/tutor')
      return
    }

    // Validar que haya un horario seleccionado
    const targetHorarioId = horario?.id || tutoria?.horarioId || null
    if (!targetHorarioId) {
      alert('Por favor selecciona un horario para agendar la tutoría')
      return
    }

    // Capacity check when scheduling into a horario
    if (targetHorarioId) {
      const horarioObj = horarios.find(h => h.id === targetHorarioId) || horario
      const capacity = horarioObj ? horarioObj.cuposDisponibles : null
      // count existing tutorias for this horario, excluding current tutoria if editing
      const existingCount = tutorias.filter(t => t.horarioId === targetHorarioId && t.id !== (tutoria?.id || null)).length
      if (capacity !== null && capacity !== undefined && existingCount >= capacity) {
        alert('Este horario ya alcanzó su cupo máximo. No se pueden agendar más estudiantes.')
        return
      }
    }

    try {
      if (isEditing) {
        await updateTutoria(tutoria.id, {
          docenteId: parseInt(formData.docenteId),
          tema: formData.tema,
          idioma: formData.idioma,
          nivel: formData.nivel,
          modalidad: formData.modalidad,
          fecha: formData.fecha,
          horaInicio: formData.horaInicio,
          horaFin: formData.horaFin
        })
      } else {
        const targetHorarioId = horario?.id || tutoria?.horarioId
        if (!targetHorarioId) {
          alert('Por favor selecciona un horario para agendar la tutoría')
          return
        }
        
        await addTutoria({
          docenteId: parseInt(formData.docenteId),
          horarioId: targetHorarioId,
          tema: formData.tema,
          idioma: formData.idioma,
          nivel: formData.nivel,
          modalidad: formData.modalidad,
          fecha: formData.fecha,
          horaInicio: formData.horaInicio,
          horaFin: formData.horaFin
        })
      }
      onClose()
    } catch (error) {
      alert(`Error: ${error.message || 'No se pudo agendar la tutoría'}`)
    }
  }

  return (
    <div className={`formulario-tutoria ${isModal ? 'modal' : ''}`}>
      <div className="formulario-tutoria-header">
        <h2>{isEditing ? 'Editar Tutoría' : 'Información de la Tutoría'}</h2>
      </div>
      <form onSubmit={handleSubmit} className="formulario-tutoria-form">
        <div className="form-group">
          <label>Docente/Tutor *</label>
          {!hasDocentes && (
            <div className="form-warning" style={{ background: '#fff4e5', padding: '10px', borderRadius: 6, color: '#663c00', marginBottom: 10 }}>
              No hay docentes/tutores registrados. Por favor agrega uno antes de agendar la tutoría.
            </div>
          )}
          <select
            name="docenteId"
            value={formData.docenteId}
            onChange={handleChange}
            required
            disabled={!hasDocentes}
            className="form-select"
          >
            <option value="">{hasDocentes ? 'Selecciona un docente/tutor' : 'No hay docentes disponibles'}</option>
            {docentes.map((docente) => (
              <option key={docente.id} value={docente.id}>
                {docente.nombre || (docente.nombres && docente.apellidos ? `${docente.nombres} ${docente.apellidos}`.trim() : docente.nombres || '')} {docente.rol ? `(${docente.rol})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Fecha *</label>
          <input
            type="date"
            name="fecha"
            value={formData.fecha}
            onChange={handleChange}
            required
            disabled
            className="form-input"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Hora Inicio *</label>
            <input
              type="time"
              name="horaInicio"
              value={formData.horaInicio}
              onChange={handleChange}
              required
              disabled
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Hora Fin *</label>
            <input
              type="time"
              name="horaFin"
              value={formData.horaFin}
              onChange={handleChange}
              required
              disabled
              className="form-input"
            />
          </div>
        </div>

        {/* Campo removido - los cupos ahora se muestran en el modal */}

        <div className="form-group">
          <label>Tema a Tratar</label>
          <input
            type="text"
            name="tema"
            value={formData.tema}
            onChange={handleChange}
            placeholder="Ej: Derivadas parciales"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Idioma *</label>
          <select
            name="idioma"
            value={formData.idioma}
            onChange={handleChange}
            required
            className="form-select"
          >
            <option value="">Selecciona un idioma</option>
            <option value="Inglés">Inglés</option>
            <option value="Francés">Francés</option>
            <option value="Alemán">Alemán</option>
            <option value="Portugués">Portugués</option>
            <option value="Italiano">Italiano</option>
            <option value="Español">Español</option>
          </select>
        </div>

        <div className="form-group">
          <label>Modalidad *</label>
          <select
            name="modalidad"
            value={formData.modalidad}
            onChange={handleChange}
            required
            className="form-select"
          >
            <option value="">Selecciona una modalidad</option>
            <option value="Presencial">Presencial</option>
            <option value="Virtual">Virtual</option>
            <option value="Híbrida">Híbrida</option>
          </select>
        </div>

        <div className="form-group">
          <label>Nivel *</label>
          <select
            name="nivel"
            value={formData.nivel}
            onChange={handleChange}
            required
            className="form-select"
          >
            <option value="">Selecciona un nivel</option>
            <option value="A1">A1 - Principiante</option>
            <option value="A2">A2 - Elemental</option>
            <option value="B1">B1 - Intermedio</option>
            <option value="B2">B2 - Intermedio alto</option>
            <option value="C1">C1 - Avanzado</option>
            <option value="C2">C2 - Dominio</option>
          </select>
        </div>

        <button type="submit" className="btn-agendar" disabled={!hasDocentes}>
          {isEditing ? '💾 Guardar Cambios' : (hasDocentes ? '📅 Agendar Tutoría' : 'Agregar docente/tutor primero')}
        </button>
      </form>
    </div>
  )
}

export default FormularioTutoria

