import React, { useState } from 'react'
import './HorarioDetailModal.css'
import { useData } from '../context/DataContext'
import AgregarEstudianteModal from './AgregarEstudianteModal'

const HorarioDetailModal = ({ horario, onClose, onEdit, onDelete }) => {
  const { getDocenteById, tutorias, getEstudianteById, loadData, tutoriaService, estudiantes, docentes, eliminarEstudianteDeTutoria, deleteTutoria } = useData()
  const [showAgregarEstudiante, setShowAgregarEstudiante] = useState(false)
  const [estudiantesPorTutoria, setEstudiantesPorTutoria] = useState({})
  const [loadingEstudiantes, setLoadingEstudiantes] = useState(false)
  const [eliminandoEstudiante, setEliminandoEstudiante] = useState(null)
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

  // Cargar estudiantes de cada tutoría cuando se monta el componente o cambian las tutorías
  React.useEffect(() => {
    const cargarEstudiantes = async () => {
      if (assignedTutorias.length === 0) {
        setEstudiantesPorTutoria({})
        return
      }
      
      setLoadingEstudiantes(true)
      const estudiantesMap = {}
      
      try {
        await Promise.all(
          assignedTutorias.map(async (tutoria) => {
            try {
              const estudiantesData = await tutoriaService.getEstudiantesByTutoria(tutoria.id)
              if (Array.isArray(estudiantesData)) {
                // El endpoint devuelve UsuarioResponseDto con IdUsuario
                estudiantesMap[tutoria.id] = estudiantesData.map(e => e.idUsuario || e.IdUsuario || e.id).filter(Boolean)
              }
            } catch (error) {
              console.warn(`Error cargando estudiantes de tutoría ${tutoria.id}:`, error)
              // Si hay estudiantesIds en la tutoría, usarlos como fallback
              if (tutoria.estudiantesIds && tutoria.estudiantesIds.length > 0) {
                estudiantesMap[tutoria.id] = tutoria.estudiantesIds
              } else if (tutoria.estudianteId) {
                // Si solo tiene un estudianteId, usarlo
                estudiantesMap[tutoria.id] = [tutoria.estudianteId]
              }
            }
          })
        )
        setEstudiantesPorTutoria(estudiantesMap)
      } catch (error) {
        console.error('Error cargando estudiantes:', error)
      } finally {
        setLoadingEstudiantes(false)
      }
    }
    
    cargarEstudiantes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedTutorias.map(t => t.id).join(',')])

  // Obtener todos los estudiantes únicos de todas las tutorías del horario
  const todosEstudiantesIds = React.useMemo(() => {
    const ids = new Set()
    assignedTutorias.forEach(tutoria => {
      if (estudiantesPorTutoria[tutoria.id]) {
        estudiantesPorTutoria[tutoria.id].forEach(id => ids.add(id))
      } else if (tutoria.estudiantesIds && tutoria.estudiantesIds.length > 0) {
        tutoria.estudiantesIds.forEach(id => ids.add(id))
      } else if (tutoria.estudianteId) {
        ids.add(tutoria.estudianteId)
      }
    })
    return Array.from(ids)
  }, [assignedTutorias, estudiantesPorTutoria])

  // Crear un mapa de estudianteId -> tutoriaId para saber de qué tutoría eliminar
  const estudianteATutoriaMap = React.useMemo(() => {
    const map = new Map()
    assignedTutorias.forEach(tutoria => {
      const estudiantesIds = estudiantesPorTutoria[tutoria.id] || tutoria.estudiantesIds || (tutoria.estudianteId ? [tutoria.estudianteId] : [])
      estudiantesIds.forEach(estId => {
        // Si un estudiante está en múltiples tutorías, usar la primera encontrada
        if (!map.has(estId)) {
          map.set(estId, tutoria.id)
        }
      })
    })
    return map
  }, [assignedTutorias, estudiantesPorTutoria])

  const handleEliminarEstudiante = async (estudianteId) => {
    const tutoriaId = estudianteATutoriaMap.get(estudianteId)
    if (!tutoriaId) {
      alert('No se pudo determinar la tutoría del estudiante')
      return
    }

    if (!window.confirm('¿Estás seguro de que deseas eliminar este estudiante de la tutoría?')) {
      return
    }

    try {
      setEliminandoEstudiante(estudianteId)
      await eliminarEstudianteDeTutoria(tutoriaId, estudianteId)
      // Recargar estudiantes después de eliminar
      const estudiantesMap = { ...estudiantesPorTutoria }
      if (estudiantesMap[tutoriaId]) {
        estudiantesMap[tutoriaId] = estudiantesMap[tutoriaId].filter(id => id !== estudianteId)
        setEstudiantesPorTutoria(estudiantesMap)
      }
      // Recargar datos completos para asegurar consistencia
      await loadData()
    } catch (error) {
      console.error('Error eliminando estudiante:', error)
      alert(error.message || 'Error al eliminar el estudiante')
    } finally {
      setEliminandoEstudiante(null)
    }
  }

  const handleDeleteTutorias = async () => {
    if (assignedTutorias.length === 0) {
      alert('No hay tutorías asociadas a este horario')
      return
    }

    const mensaje = assignedTutorias.length === 1
      ? '¿Estás seguro de que deseas eliminar esta tutoría?'
      : `¿Estás seguro de que deseas eliminar las ${assignedTutorias.length} tutorías asociadas a este horario?`

    if (!window.confirm(mensaje)) {
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
      alert('Tutorías eliminadas exitosamente')
      onClose()
    } catch (error) {
      console.error('Error eliminando tutorías:', error)
      alert(error.message || 'Error al eliminar las tutorías. Por favor, inténtalo de nuevo.')
    } finally {
      setEliminandoTutoria(null)
    }
  }

  return (
    <div className="horario-modal-overlay" onClick={onClose}>
      <div className="horario-modal" onClick={(e) => e.stopPropagation()}>
        <div className="horario-modal-header">
          <div className="horario-modal-title-section">
            <div className="horario-color-indicator"></div>
            <div>
              <h2 className="horario-modal-title">{horario.titulo || 'Horario'}</h2>
              <p className="horario-modal-date">{fechaFormateada}</p>
              <p className="horario-modal-capacity">
                {(() => {
                  const capacity = horario.cuposDisponibles || 5
                  const existingCount = todosEstudiantesIds.length
                  const available = capacity - existingCount
                  const color = available === 0 ? '#ef4444' : available <= 2 ? '#f97316' : '#22c55e'
                  return (
                    <span style={{ color }}>
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
              >
                {eliminandoTutoria !== null ? '⏳' : '🗑️'}
              </button>
            ) : (
              <button 
                className="horario-action-btn" 
                onClick={() => onDelete && onDelete(horario.id)}
                title="Eliminar horario"
              >
                🗑️
              </button>
            )}
            <button 
              className="horario-action-btn" 
              onClick={() => onEdit(horario)}
              title="Editar"
            >
              ✏️
            </button>
            <button 
              className="horario-action-btn horario-close-btn" 
              onClick={onClose}
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="horario-modal-content">
          <div className="horario-detail-item">
            <span className="horario-detail-icon">☰</span>
            <span>Horario</span>
          </div>
          <div className="horario-detail-item">
            <span className="horario-detail-icon">🕐</span>
            <span>{horario.horaInicio} - {horario.horaFin}</span>
          </div>
          {horario.tipoClase && (
            <div className="horario-detail-item">
              <span className="horario-detail-icon">📍</span>
              <span>{horario.tipoClase}</span>
            </div>
          )}
          {horario.salon && (
            <div className="horario-detail-item">
              <span className="horario-detail-icon">🏢</span>
              <span>{horario.salon}</span>
            </div>
          )}
          {horario.cuposDisponibles && (
            <div className="horario-detail-item">
              <span className="horario-detail-icon">👥</span>
              <span>{horario.cuposDisponibles} cupo{horario.cuposDisponibles > 1 ? 's' : ''} disponible{horario.cuposDisponibles > 1 ? 's' : ''}</span>
            </div>
          )}
          {docente && (
            <div className="horario-detail-item">
              <span className="horario-detail-icon">👩‍🏫</span>
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
          {/* Lista de estudiantes agendados para este horario */}
          <div className="horario-students-section">
            <div className="horario-students-header">
              <h3 className="horario-students-title">Estudiantes agendados</h3>
              <button
                className="horario-add-student-btn"
                onClick={() => setShowAgregarEstudiante(true)}
                disabled={(() => {
                  const capacity = horario.cuposDisponibles || 5
                  return todosEstudiantesIds.length >= capacity
                })()}
                title={(() => {
                  const capacity = horario.cuposDisponibles || 5
                  return todosEstudiantesIds.length >= capacity ? 'Cupo máximo alcanzado' : 'Agregar estudiante'
                })()}
              >
                + Agregar estudiante
              </button>
            </div>
            {loadingEstudiantes ? (
              <p className="no-students">Cargando estudiantes...</p>
            ) : todosEstudiantesIds.length > 0 ? (
              <ul className="horario-students-list">
                {todosEstudiantesIds.map((estudianteId) => {
                  const estudiante = getEstudianteById(estudianteId)
                  if (!estudiante) {
                    // Si no se encuentra, intentar buscar en la lista de estudiantes directamente
                    const estudianteDirecto = estudiantes?.find(e => e.id === estudianteId)
                    if (!estudianteDirecto) {
                      return null // No mostrar si no se encuentra
                    }
                    return (
                      <li key={estudianteId} className="horario-student-item">
                        <div className="student-main">
                          <div className="student-name">{estudianteDirecto.nombre || `Estudiante ID: ${estudianteId}`}</div>
                          <div className="student-meta">
                            {estudianteDirecto.email && <span className="student-email">{estudianteDirecto.email}</span>}
                            {estudianteDirecto.telefono && <span className="student-phone">{estudianteDirecto.telefono}</span>}
                          </div>
                        </div>
                        <div className="student-actions">
                          <div className="student-time">
                            {assignedTutorias.length > 0 ? assignedTutorias[0].horaInicio : ''}
                          </div>
                          <button
                            className="student-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEliminarEstudiante(estudianteId)
                            }}
                            disabled={eliminandoEstudiante === estudianteId}
                            title="Eliminar estudiante"
                          >
                            {eliminandoEstudiante === estudianteId ? '⏳' : '🗑️'}
                          </button>
                        </div>
                      </li>
                    )
                  }
                  return (
                    <li key={estudianteId} className="horario-student-item">
                      <div className="student-main">
                        <div className="student-name">{estudiante.nombre}</div>
                        <div className="student-meta">
                          {estudiante.email && <span className="student-email">{estudiante.email}</span>}
                          {estudiante.telefono && <span className="student-phone">{estudiante.telefono}</span>}
                        </div>
                      </div>
                      <div className="student-actions">
                        <div className="student-time">
                          {assignedTutorias.length > 0 ? assignedTutorias[0].horaInicio : ''}
                        </div>
                        <button
                          className="student-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEliminarEstudiante(estudianteId)
                          }}
                          disabled={eliminandoEstudiante === estudianteId}
                          title="Eliminar estudiante"
                        >
                          {eliminandoEstudiante === estudianteId ? '⏳' : '🗑️'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="no-students">No hay estudiantes asignados a este horario.</p>
            )}
          </div>
          <div className="horario-detail-item">
            <span className="horario-detail-icon">🔒</span>
            <span>{horario.disponible ? 'Disponible' : 'No disponible'}</span>
          </div>
          {horario.notas && (
            <div className="horario-notes">
              <p>{horario.notas}</p>
            </div>
          )}
        </div>
      </div>

      {showAgregarEstudiante && (
        <AgregarEstudianteModal
          horario={horario}
          onClose={() => setShowAgregarEstudiante(false)}
          onSuccess={async () => {
            // Recargar datos para reflejar los cambios
            await loadData()
          }}
        />
      )}
    </div>
  )
}

export default HorarioDetailModal





