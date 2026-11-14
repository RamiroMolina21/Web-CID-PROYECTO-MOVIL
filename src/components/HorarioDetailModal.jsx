import React, { useState } from 'react'
import './HorarioDetailModal.css'
import { useData } from '../context/DataContext'
import { useToast, useConfirm } from './ui/Feedback'
import Icon from './ui/Icon'
import { ETIQUETA_ELIMINADO } from '../lib/usuarios'

const HorarioDetailModal = ({ horario, onClose, onEdit, onDelete }) => {
  const { getDocenteById, tutorias, docentes, deleteTutoria, loadData } = useData()
  const toast = useToast()
  const confirm = useConfirm()
  const [eliminandoTutoria, setEliminandoTutoria] = useState(null)
  
  if (!horario) return null

  // Obtener docente del horario - intentar múltiples formas
  let docente = horario.docenteId ? getDocenteById(Number(horario.docenteId) || horario.docenteId) : null
  
  // Si no se encontró por ID, buscar por correo o nombre
  if (!docente && horario.docenteCorreo && docentes) {
    docente = docentes.find(d => (d.email || d.correo)?.toLowerCase() === horario.docenteCorreo.toLowerCase())
  }
  
  // Si aún no se encontró, buscar por nombre y apellidos
  if (!docente && horario.docenteNombre && horario.docenteApellidos && docentes) {
    docente = docentes.find(d => {
      const nombreMatch = (d.nombres || d.nombre || '').toLowerCase() === horario.docenteNombre.toLowerCase()
      const apellidosMatch = (d.apellidos || d.apellido || '').toLowerCase() === horario.docenteApellidos.toLowerCase()
      return nombreMatch && apellidosMatch
    })
  }

  const fecha = new Date(horario.fecha)
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  
  // Ajustamos la fecha para que use la zona horaria local
  const fechaLocal = new Date(fecha.getTime() + fecha.getTimezoneOffset() * 60000)
  const fechaFormateada = `${diasSemana[fechaLocal.getDay()]}, ${fechaLocal.getDate()} ${meses[fechaLocal.getMonth()]}`

  // Tutorías asignadas a este horario
  const assignedTutorias = tutorias ? tutorias.filter(t => t.horarioId === horario.id) : []
  
  // Calcular cupos ocupados
  const todosEstudiantesIds = React.useMemo(() => {
    const ids = new Set()
    assignedTutorias.forEach(tutoria => {
      if (tutoria.estudiantesIds && tutoria.estudiantesIds.length > 0) {
        tutoria.estudiantesIds.forEach(id => ids.add(id))
      } else if (tutoria.estudianteId) {
        ids.add(tutoria.estudianteId)
      }
    })
    return Array.from(ids)
  }, [assignedTutorias])

  const handleDeleteTutorias = async () => {
    if (assignedTutorias.length === 0) {
      toast.info('No hay tutorías asociadas a este horario.')
      return
    }

    const mensaje = assignedTutorias.length === 1
      ? '¿Estás seguro de que deseas eliminar esta tutoría?'
      : `¿Estás seguro de que deseas eliminar las ${assignedTutorias.length} tutorías asociadas a este horario?`

    if (!(await confirm({ title: 'Eliminar tutorías', message: mensaje, confirmLabel: 'Eliminar', danger: true }))) {
      return
    }

    try {
      setEliminandoTutoria('processing')
      
      // Eliminar todas las tutorías asociadas al horario
      await Promise.all(
        assignedTutorias.map(async (tutoria) => {
          try {
            console.log(`[HorarioDetailModal] Eliminando tutoría ${tutoria.id}`)
            await deleteTutoria(tutoria.id)
          } catch (error) {
            console.error(`Error eliminando tutoría ${tutoria.id}:`, error)
            throw error
          }
        })
      )
      
      // Recargar datos para reflejar los cambios
      await loadData()
      toast.success('Tutorías eliminadas.')
      onClose()
    } catch (error) {
      console.error('Error eliminando tutorías:', error)
      toast.error(error.message || 'Error al eliminar las tutorías. Por favor, inténtalo de nuevo.')
    } finally {
      setEliminandoTutoria(null)
    }
  }

  return (
    <div className="horario-modal-overlay" onClick={onClose}>
      <div className="horario-modal" role="dialog" aria-modal="true" aria-labelledby="hd-modal-title" onClick={(e) => e.stopPropagation()}>
        <div className="horario-modal-header">
          <div className="horario-modal-title-section">
            <div className="horario-color-indicator"></div>
            <div>
              <h2 className="horario-modal-title" id="hd-modal-title">{horario.titulo || 'Horario'}</h2>
              <p className="horario-modal-date">{fechaFormateada}</p>
              <p className="horario-modal-capacity">
                {(() => {
                  const capacity = horario.cuposDisponibles || 5
                  const existingCount = todosEstudiantesIds.length
                  const available = capacity - existingCount
                  const tono = available <= 0 ? 'lleno' : available <= 2 ? 'pocos' : 'libre'
                  return (
                    <span className={`hd-capacity hd-capacity--${tono}`}>
                      {existingCount}/{capacity} cupos ocupados ({available} disponible{available !== 1 ? 's' : ''})
                    </span>
                  )
                })()}
              </p>
            </div>
          </div>
          <div className="horario-modal-actions">
            {assignedTutorias.length > 0 ? (
              <button 
                className="horario-action-btn" 
                onClick={handleDeleteTutorias}
                disabled={eliminandoTutoria !== null}
                title={assignedTutorias.length === 1 ? 'Eliminar tutoría' : `Eliminar ${assignedTutorias.length} tutorías`}
                aria-label={assignedTutorias.length === 1 ? 'Eliminar tutoría' : `Eliminar ${assignedTutorias.length} tutorías`}
              >
                {eliminandoTutoria !== null ? <span className="spinner" aria-hidden="true"><span /></span> : <Icon name="trash" size={18} />}
              </button>
            ) : (
              <button 
                className="horario-action-btn" 
                onClick={() => onDelete && onDelete(horario.id)}
                title="Eliminar horario"
                aria-label="Eliminar horario"
              >
                <Icon name="trash" size={18} />
              </button>
            )}
            <button 
              className="horario-action-btn" 
              onClick={() => onEdit(horario)}
              title="Editar"
              aria-label="Editar horario"
            >
              <Icon name="edit" size={18} />
            </button>
            <button 
              className="horario-action-btn horario-close-btn" 
              onClick={onClose}
              title="Cerrar"
              aria-label="Cerrar"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>

        <div className="horario-modal-content">
          <div className="horario-detail-item">
            <Icon name="text" size={18} className="horario-detail-icon" />
            <span>Horario</span>
          </div>
          <div className="horario-detail-item">
            <Icon name="clock" size={18} className="horario-detail-icon" />
            <span>{horario.horaInicio} - {horario.horaFin}</span>
          </div>
          {horario.tipoClase && (
            <div className="horario-detail-item">
              <Icon name="mapPin" size={18} className="horario-detail-icon" />
              <span>{horario.tipoClase}</span>
            </div>
          )}
          {horario.salon && (
            <div className="horario-detail-item">
              <Icon name="building" size={18} className="horario-detail-icon" />
              <span>{horario.salon}</span>
            </div>
          )}
          {horario.cuposDisponibles && (
            <div className="horario-detail-item">
              <Icon name="users" size={18} className="horario-detail-icon" />
              <span>{horario.cuposDisponibles} cupo{horario.cuposDisponibles > 1 ? 's' : ''} disponible{horario.cuposDisponibles > 1 ? 's' : ''}</span>
            </div>
          )}
          {horario.sinDueno && (
            <div className="horario-detail-item">
              <Icon name="teacher" size={18} className="horario-detail-icon" />
              <span>{ETIQUETA_ELIMINADO}</span>
            </div>
          )}
          {docente && !horario.sinDueno && (
            <div className="horario-detail-item">
              <Icon name="teacher" size={18} className="horario-detail-icon" />
              <div className="horario-docente-info">
                <div className="horario-docente-name">
                  {docente.nombre || (docente.nombres && docente.apellidos ? `${docente.nombres} ${docente.apellidos}`.trim() : docente.nombres || 'Docente')}
                </div>
                {docente.rol && <div className="horario-docente-tipo">{docente.rol}</div>}
                {(docente.email || docente.correo) && (
                  <div className="horario-docente-email">{docente.email || docente.correo}</div>
                )}
              </div>
            </div>
          )}
          <div className="horario-detail-item">
            <Icon name="lock" size={18} className="horario-detail-icon" />
            <span>{horario.disponible ? 'Disponible' : 'No disponible'}</span>
          </div>
          {horario.notas && (
            <div className="horario-notes">
              <p>{horario.notas}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default HorarioDetailModal





