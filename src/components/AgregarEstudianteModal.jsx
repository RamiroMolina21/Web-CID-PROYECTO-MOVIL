import React, { useState } from 'react'
import { useData } from '../context/DataContext'
import './AgregarEstudianteModal.css'

const AgregarEstudianteModal = ({ horario, onClose, onSuccess }) => {
  const { estudiantes, tutorias, addTutoria, tutoriaService, docentes } = useData()
  const [selectedEstudianteId, setSelectedEstudianteId] = useState('')
  const [loading, setLoading] = useState(false)

  if (!horario) return null

  // Calcular cupos disponibles - contar estudiantes únicos en tutorías del horario
  // Necesitamos contar los estudiantes únicos, no las tutorías
  const tutoriasDelHorario = tutorias ? tutorias.filter(t => t.horarioId === horario.id) : []
  const estudiantesUnicos = new Set()
  tutoriasDelHorario.forEach(t => {
    if (t.estudiantesIds && t.estudiantesIds.length > 0) {
      t.estudiantesIds.forEach(id => estudiantesUnicos.add(id))
    } else if (t.estudianteId) {
      estudiantesUnicos.add(t.estudianteId)
    }
  })
  const existingCount = estudiantesUnicos.size
  const capacity = horario.cuposDisponibles || 5
  const available = capacity - existingCount
  const isFull = available <= 0

  // Obtener el docente del horario - intentar múltiples formas
  let docenteId = horario.docenteId
  
  // Si no hay docenteId, intentar buscarlo por correo o nombre
  if (!docenteId && docentes && docentes.length > 0) {
    // Buscar por correo si está disponible
    if (horario.docenteCorreo) {
      const docentePorCorreo = docentes.find(d => 
        (d.email || d.correo)?.toLowerCase() === horario.docenteCorreo.toLowerCase()
      )
      if (docentePorCorreo) {
        docenteId = docentePorCorreo.id
      }
    }
    
    // Si aún no se encontró, buscar por nombre y apellidos
    if (!docenteId && horario.docenteNombre && horario.docenteApellidos) {
      const docentePorNombre = docentes.find(d => {
        const nombreMatch = (d.nombres || d.nombre || '').toLowerCase() === horario.docenteNombre.toLowerCase()
        const apellidosMatch = (d.apellidos || d.apellido || '').toLowerCase() === horario.docenteApellidos.toLowerCase()
        return nombreMatch && apellidosMatch
      })
      if (docentePorNombre) {
        docenteId = docentePorNombre.id
      }
    }
  }

  // Obtener la primera tutoría del horario para usar como base
  const primeraTutoria = tutoriasDelHorario.length > 0 ? tutoriasDelHorario[0] : null
  const defaultIdioma = primeraTutoria?.idioma || 'Español'
  const defaultNivel = primeraTutoria?.nivel || 'A1'
  const defaultModalidad = primeraTutoria?.modalidad || 'Presencial'
  const defaultTema = primeraTutoria?.tema || 'Sin tema'

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (isFull) {
      alert('Este horario ya alcanzó su cupo máximo. No se pueden agendar más estudiantes.')
      return
    }

    if (!selectedEstudianteId) {
      alert('Por favor selecciona un estudiante')
      return
    }

    setLoading(true)
    try {
      // Usar el docenteId encontrado, o intentar obtenerlo de la primera tutoría del horario
      let finalDocenteId = docenteId
      
      // Si aún no se encontró, intentar obtenerlo de la primera tutoría del horario
      if (!finalDocenteId && primeraTutoria && primeraTutoria.docenteId) {
        finalDocenteId = primeraTutoria.docenteId
      }
      
      // Si aún no se encontró y hay información del docente en el horario, buscar en docentes
      if (!finalDocenteId && docentes && docentes.length > 0) {
        if (horario.docenteCorreo) {
          const docentePorCorreo = docentes.find(d => 
            (d.email || d.correo)?.toLowerCase() === horario.docenteCorreo.toLowerCase()
          )
          if (docentePorCorreo) {
            finalDocenteId = docentePorCorreo.id
          }
        }
        
        if (!finalDocenteId && horario.docenteNombre && horario.docenteApellidos) {
          const docentePorNombre = docentes.find(d => {
            const nombreMatch = (d.nombres || d.nombre || '').toLowerCase() === horario.docenteNombre.toLowerCase()
            const apellidosMatch = (d.apellidos || d.apellido || '').toLowerCase() === horario.docenteApellidos.toLowerCase()
            return nombreMatch && apellidosMatch
          })
          if (docentePorNombre) {
            finalDocenteId = docentePorNombre.id
          }
        }
      }

      if (!finalDocenteId) {
        console.error('No se pudo determinar el docente. Horario:', horario)
        alert('Error: No se pudo determinar el docente para este horario. Por favor verifica que el horario tenga un docente asignado.')
        setLoading(false)
        return
      }

      // Verificar si ya existe una tutoría para este horario
      let tutoriaId = primeraTutoria?.id

      // Si no existe tutoría, crear una nueva primero
      if (!tutoriaId) {
        const nuevaTutoria = await addTutoria({
          docenteId: parseInt(finalDocenteId),
          horarioId: horario.id,
          tema: defaultTema,
          idioma: defaultIdioma,
          nivel: defaultNivel,
          modalidad: defaultModalidad,
          fecha: horario.fecha,
          horaInicio: horario.horaInicio,
          horaFin: horario.horaFin,
          estado: 'Pendiente'
        })
        tutoriaId = nuevaTutoria.id
      }

      // Agregar el estudiante a la tutoría usando el endpoint correcto
      await tutoriaService.agregarEstudiantes(tutoriaId, {
        EstudianteIds: [parseInt(selectedEstudianteId)]
      })
      
      if (onSuccess) {
        onSuccess()
      }
      onClose()
    } catch (error) {
      alert(`Error: ${error.message || 'No se pudo agregar el estudiante a la tutoría'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="agregar-estudiante-overlay" onClick={onClose}>
      <div className="agregar-estudiante-modal" onClick={(e) => e.stopPropagation()}>
        <div className="agregar-estudiante-header">
          <h2>Agregar Estudiante</h2>
          <button className="agregar-estudiante-close" onClick={onClose}>✕</button>
        </div>

        {isFull && (
          <div className="agregar-estudiante-warning">
            ⚠️ Este horario ya alcanzó su cupo máximo ({capacity}/{capacity} ocupados)
          </div>
        )}

        <form onSubmit={handleSubmit} className="agregar-estudiante-form">
          <div className="agregar-estudiante-form-group">
            <label>Estudiante *</label>
            <select
              value={selectedEstudianteId}
              onChange={(e) => setSelectedEstudianteId(e.target.value)}
              required
              disabled={isFull}
              className="agregar-estudiante-select"
            >
              <option value="">Selecciona un estudiante</option>
              {estudiantes.map((estudiante) => (
                <option key={estudiante.id} value={estudiante.id}>
                  {estudiante.nombre} {estudiante.email ? `(${estudiante.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="agregar-estudiante-info">
            <p>Cupos disponibles: <strong>{available}/{capacity}</strong></p>
          </div>

          <div className="agregar-estudiante-actions">
            <button
              type="button"
              onClick={onClose}
              className="agregar-estudiante-btn-cancel"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isFull || loading}
              className="agregar-estudiante-btn-submit"
            >
              {loading ? 'Agregando...' : 'Agregar Estudiante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AgregarEstudianteModal

