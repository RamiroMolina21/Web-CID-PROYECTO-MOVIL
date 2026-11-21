import React, { useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { useToast } from './ui/Feedback'
import { tutoriaService } from '../services/apiService'
import './AgregarEstudianteModal.css'
import Icon from './ui/Icon'

const AgregarEstudianteATutoriaModal = ({ tutoria, onClose, onSuccess }) => {
  const { estudiantes, horarios } = useData()
  const toast = useToast()
  const [selectedEstudianteId, setSelectedEstudianteId] = useState('')
  const [loading, setLoading] = useState(false)
  const [estudiantesTutoria, setEstudiantesTutoria] = useState([])
  // Capacidad efectiva: tutoria.cupos → cupos del horario (antiguos) → null = sin límite
  const [cuposDisponibles, setCuposDisponibles] = useState(tutoria?.cupos ?? null)

  if (!tutoria) return null

  // Función auxiliar para obtener propiedades
  const getProp = (obj, ...keys) => {
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key]
      const pascalKey = key.charAt(0).toUpperCase() + key.slice(1)
      if (obj[pascalKey] !== undefined) return obj[pascalKey]
    }
    return null
  }

  const tutoriaId = getProp(tutoria, 'idTutoria', 'id', 'IdTutoria', 'Id')
  const horarioId = getProp(tutoria, 'horarioId', 'HorarioId', 'idHorario', 'IdHorario')

  // Cargar estudiantes actuales de la tutoría
  useEffect(() => {
    const cargarEstudiantes = async () => {
      if (!tutoriaId) return

      try {
        const estudiantesData = await tutoriaService.getEstudiantesByTutoria(tutoriaId)
        if (Array.isArray(estudiantesData)) {
          setEstudiantesTutoria(estudiantesData)
        }
      } catch (error) {
        console.warn('Error cargando estudiantes de tutoría:', error)
      }
    }

    cargarEstudiantes()
  }, [tutoriaId])

  // Obtener información del horario para calcular cupos
  useEffect(() => {
    if (horarioId && horarios) {
      const horario = horarios.find(h => {
        const hId = getProp(h, 'id', 'idHorario', 'IdHorario', 'Id')
        return hId && hId.toString() === horarioId.toString()
      })
      if (horario) {
        setCuposDisponibles(tutoria?.cupos ?? horario.cuposDisponibles ?? null)
      }
    }
  }, [horarioId, horarios])

  // Calcular cupos disponibles
  const cuposOcupados = estudiantesTutoria.length
  const available = cuposDisponibles != null ? cuposDisponibles - cuposOcupados : null
  const isFull = available != null && available <= 0

  // Filtrar estudiantes que ya están en la tutoría
  // Solo cuentas activas (asignar una desactivada → 400 en el servidor)
  const estudiantesDisponibles = estudiantes.filter(est => {
    return est.activo !== false && !estudiantesTutoria.some(estTut => {
      const estTutId = getProp(estTut, 'idUsuario', 'IdUsuario', 'id', 'Id')
      return estTutId && estTutId.toString() === est.id.toString()
    })
  })

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (isFull) {
      toast.error('Esta tutoría ya alcanzó su cupo máximo. No se pueden agendar más estudiantes.')
      return
    }

    if (!selectedEstudianteId) {
      toast.error('Por favor selecciona un estudiante')
      return
    }

    if (!tutoriaId) {
      toast.error('Error: No se pudo obtener el ID de la tutoría')
      return
    }

    setLoading(true)
    try {
      // Agregar el estudiante a la tutoría usando el endpoint correcto
      await tutoriaService.agregarEstudiantes(tutoriaId, {
        EstudianteIds: [parseInt(selectedEstudianteId)]
      })
      
      if (onSuccess) {
        onSuccess()
      }
      onClose()
    } catch (error) {
      toast.error(`Error: ${error.message || 'No se pudo agregar el estudiante a la tutoría'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="agregar-estudiante-overlay" onClick={onClose}>
      <div className="agregar-estudiante-modal" role="dialog" aria-modal="true" aria-labelledby="ae-modal-title" onClick={(e) => e.stopPropagation()}>
        <div className="agregar-estudiante-header">
          <h2 id="ae-modal-title">Agregar Estudiante a Tutoría</h2>
          <button type="button" className="agregar-estudiante-close" onClick={onClose} aria-label="Cerrar"><Icon name="close" size={20} /></button>
        </div>

        {isFull && (
          <div className="agregar-estudiante-warning">
            <Icon name="alert" size={18} className="icon--inline" />Esta tutoría ya alcanzó su cupo máximo ({cuposOcupados}/{cuposDisponibles} ocupados)
          </div>
        )}

        <form onSubmit={handleSubmit} className="agregar-estudiante-form">
          <div className="agregar-estudiante-form-group">
            <label htmlFor="ae-estudiante">Estudiante *</label>
            <select
              id="ae-estudiante"
              value={selectedEstudianteId}
              onChange={(e) => setSelectedEstudianteId(e.target.value)}
              required
              disabled={isFull}
              className="agregar-estudiante-select"
            >
              <option value="">Selecciona un estudiante</option>
              {estudiantesDisponibles.map((estudiante) => (
                <option key={estudiante.id} value={estudiante.id}>
                  {estudiante.nombre} {estudiante.email ? `(${estudiante.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="agregar-estudiante-info">
            <p>{cuposDisponibles != null ? <>Cupos disponibles: <strong>{available}/{cuposDisponibles}</strong></> : 'Sin límite de cupos'}</p>
            <p className="agregar-estudiante-hint">
              Estudiantes ya agendados: {cuposOcupados}
            </p>
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
              disabled={isFull || loading || estudiantesDisponibles.length === 0}
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

export default AgregarEstudianteATutoriaModal

