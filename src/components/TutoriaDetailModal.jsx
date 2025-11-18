import React, { useState } from 'react'
import { useData } from '../context/DataContext'
import './TutoriaDetailModal.css'

const TutoriaDetailModal = ({ tutoria, onClose, onEdit }) => {
  const { deleteTutoria, getEstudianteById } = useData()
  const [showMoreOptions, setShowMoreOptions] = useState(false)

  if (!tutoria) return null

  const estudiante = getEstudianteById(tutoria.estudianteId)
  const fecha = new Date(tutoria.fecha)
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  
  const fechaFormateada = `${diasSemana[fecha.getDay()]}, ${fecha.getDate()} ${meses[fecha.getMonth()]}`

  const handleDelete = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta tutoría?')) {
      return
    }

    try {
      console.log('[TutoriaDetailModal] Intentando eliminar tutoría:', {
        id: tutoria.id,
        tipo: typeof tutoria.id,
        tutoriaCompleta: tutoria
      })
      
      // Asegurarse de que estamos usando el ID correcto de la tutoría
      if (!tutoria.id) {
        throw new Error('No se pudo obtener el ID de la tutoría')
      }
      
      await deleteTutoria(tutoria.id)
      onClose()
    } catch (error) {
      console.error('[TutoriaDetailModal] Error eliminando tutoría:', error)
      alert(error.message || 'Error al eliminar la tutoría. Por favor, inténtalo de nuevo.')
    }
  }

  const handleEdit = () => {
    onEdit(tutoria)
    onClose()
  }

  return (
    <div className="tutoria-modal-overlay" onClick={onClose}>
      <div className="tutoria-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tutoria-modal-header">
          <div className="tutoria-modal-title-section">
            <div className="tutoria-color-indicator"></div>
            <div>
              <h2 className="tutoria-modal-title">{tutoria.tema || 'Tutoría'}</h2>
              <p className="tutoria-modal-date">{fechaFormateada}</p>
            </div>
          </div>
          <div className="tutoria-modal-actions">
            <button 
              className="tutoria-action-btn" 
              onClick={handleDelete}
              title="Eliminar"
            >
              🗑️
            </button>
            <button 
              className="tutoria-action-btn" 
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              title="Más opciones"
            >
              ⋮
            </button>
            <button 
              className="tutoria-action-btn tutoria-close-btn" 
              onClick={onClose}
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {showMoreOptions && (
          <div className="tutoria-more-options">
            <button onClick={handleEdit} className="tutoria-option-btn">
              ✏️ Editar
            </button>
            <button onClick={handleDelete} className="tutoria-option-btn tutoria-option-delete">
              🗑️ Eliminar
            </button>
          </div>
        )}

        <div className="tutoria-modal-content">
          <div className="tutoria-detail-item">
            <span className="tutoria-detail-icon">☰</span>
            <span>Tutoría</span>
          </div>
          <div className="tutoria-detail-item">
            <span className="tutoria-detail-icon">📅</span>
            <span>{estudiante ? estudiante.nombre : 'Estudiante no encontrado'}</span>
          </div>
          <div className="tutoria-detail-item">
            <span className="tutoria-detail-icon">🕐</span>
            <span>{tutoria.horaInicio} - {tutoria.horaFin}</span>
          </div>
          {tutoria.materia && (
            <div className="tutoria-detail-item">
              <span className="tutoria-detail-icon">📚</span>
              <span>{tutoria.materia}</span>
            </div>
          )}
          {tutoria.idioma && (
            <div className="tutoria-detail-item">
              <span className="tutoria-detail-icon">🌐</span>
              <span>{tutoria.idioma}</span>
            </div>
          )}
          {tutoria.nivel && (
            <div className="tutoria-detail-item">
              <span className="tutoria-detail-icon">📊</span>
              <span>Nivel: {tutoria.nivel}</span>
            </div>
          )}
          <div className="tutoria-detail-item">
            <span className="tutoria-detail-icon">🔒</span>
            <span>Público</span>
          </div>
          {tutoria.notas && (
            <div className="tutoria-notes">
              <p>{tutoria.notas}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TutoriaDetailModal




