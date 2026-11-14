import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { grupoEstadoTutoria } from '../lib/estados'
import { useToast, useConfirm } from './ui/Feedback'
import { tutoriaService, horarioService } from '../services/apiService'
import './TutoriaDetailModal.css'
import Icon from './ui/Icon'
import { ETIQUETA_SIN_ASIGNAR, tutoriaSinAsignar } from '../lib/usuarios'

const TutoriaDetailModal = ({ tutoria, onClose, onEdit }) => {
  const { deleteTutoria, getEstudianteById, getDocenteById, horarios, docentes } = useData()
  const toast = useToast()
  const confirm = useConfirm()
  const [estudiantesTutoria, setEstudiantesTutoria] = useState([])
  const [loadingEstudiantes, setLoadingEstudiantes] = useState(false)
  const [docenteId, setDocenteId] = useState(null)

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
  const tema = getProp(tutoria, 'tema', 'Tema') || 'Sin tema'
  const idioma = getProp(tutoria, 'idioma', 'Idioma') || ''
  const nivel = getProp(tutoria, 'nivel', 'Nivel') || ''
  const modalidad = getProp(tutoria, 'modalidad', 'Modalidad') || ''
  const fechaTutoria = getProp(tutoria, 'fechaTutoria', 'fecha', 'FechaTutoria', 'Fecha')
  const horarioId = getProp(tutoria, 'horarioId', 'HorarioId', 'idHorario', 'IdHorario')
  
  // Intentar obtener usuarioId de múltiples formas
  let usuarioId = getProp(tutoria, 'usuarioId', 'UsuarioId', 'docenteId', 'DocenteId', 'idDocente', 'IdDocente')
  
  const usuarioNombre = getProp(tutoria, 'usuarioNombre', 'UsuarioNombre')
  const usuarioApellidos = getProp(tutoria, 'usuarioApellidos', 'UsuarioApellidos')
  const usuarioCorreo = getProp(tutoria, 'usuarioCorreo', 'UsuarioCorreo')
  
  const horarioEspacio = getProp(tutoria, 'horarioEspacio', 'HorarioEspacio', 'espacio', 'Espacio') || ''
  const horarioHoraInicio = getProp(tutoria, 'horarioHoraInicio', 'HorarioHoraInicio', 'horaInicio', 'HoraInicio')
  const horarioHoraFin = getProp(tutoria, 'horarioHoraFin', 'HorarioHoraFin', 'horaFin', 'HoraFin')

  // Si no se encontró por ID, buscar por correo, nombre/apellidos o desde el horario
  useEffect(() => {
    // Primero, si la tutoria tiene docenteId directamente, usarlo
    if (tutoria.docenteId) {
      setDocenteId(tutoria.docenteId)
      return
    }
    
    // Si ya tenemos un usuarioId, usarlo directamente
    if (usuarioId) {
      setDocenteId(usuarioId)
      return
    }
    
    // Si tenemos horarioId, intentar obtener el docenteId desde el horario
    if (horarioId) {
      // Primero buscar en el contexto
      if (horarios && Array.isArray(horarios)) {
        const horario = horarios.find(h => {
          const hId = getProp(h, 'id', 'idHorario', 'IdHorario', 'Id')
          return hId && hId.toString() === horarioId.toString()
        })
        
        if (horario) {
          // El horario mapeado tiene docenteId directamente
          const docenteIdDelHorario = getProp(horario, 'docenteId', 'DocenteId', 'usuarioId', 'UsuarioId', 'idUsuario', 'IdUsuario')
          if (docenteIdDelHorario) {
            console.log('DocenteId obtenido desde el horario del contexto:', docenteIdDelHorario)
            setDocenteId(docenteIdDelHorario)
            return
          }
        }
      }
      
      // Si no se encontró en el contexto, intentar obtenerlo desde la API
      const obtenerHorarioDesdeAPI = async () => {
        try {
          const horarioData = await horarioService.getById(horarioId)
          const docenteIdDelHorario = getProp(horarioData, 'usuarioId', 'UsuarioId', 'docenteId', 'DocenteId', 'idUsuario', 'IdUsuario', 'Usuario_idUsuario')
          if (docenteIdDelHorario) {
            console.log('DocenteId obtenido desde el horario de la API:', docenteIdDelHorario)
            setDocenteId(docenteIdDelHorario)
          }
        } catch (error) {
          console.warn('Error obteniendo horario desde la API:', error)
        }
      }
      
      obtenerHorarioDesdeAPI()
    }
    
    // Si no tenemos usuarioId ni desde el horario, buscar por correo o nombre/apellidos
    if (docentes && (usuarioCorreo || (usuarioNombre && usuarioApellidos))) {
      // Buscar por correo
      if (usuarioCorreo) {
        const docentePorCorreo = docentes.find(d => 
          (d.email || d.correo)?.toLowerCase() === usuarioCorreo.toLowerCase()
        )
        if (docentePorCorreo) {
          setDocenteId(docentePorCorreo.id)
          return
        }
      }
      
      // Buscar por nombre y apellidos
      if (usuarioNombre && usuarioApellidos) {
        const docentePorNombre = docentes.find(d => {
          const nombresMatch = (d.nombres || d.nombre || '').toLowerCase() === usuarioNombre.toLowerCase()
          const apellidosMatch = (d.apellidos || d.apellido || '').toLowerCase() === usuarioApellidos.toLowerCase()
          return nombresMatch && apellidosMatch
        })
        if (docentePorNombre) {
          setDocenteId(docentePorNombre.id)
          return
        }
      }
    }
  }, [tutoria, docentes, horarios, usuarioCorreo, usuarioNombre, usuarioApellidos, usuarioId, horarioId])

  // Usar el docenteId encontrado o el usuarioId
  const docenteIdFinal = docenteId || usuarioId || tutoria.docenteId
  
  // Buscar docente por ID
  let docente = docenteIdFinal ? getDocenteById(docenteIdFinal) : null
  
  // Si no se encontró el docente, intentar obtenerlo directamente desde la tutoria
  if (!docente && tutoria.docenteId) {
    docente = getDocenteById(tutoria.docenteId)
  }
  
  // Log para debug
  console.log('[TutoriaDetailModal] Información del tutor:', {
    docenteIdFinal,
    docenteId,
    usuarioId,
    tutoriaDocenteId: tutoria.docenteId,
    docente,
    usuarioNombre,
    usuarioApellidos,
    usuarioCorreo,
    tutoria: tutoria
  })

  // Obtener información del horario si está disponible
  const horario = horarioId && horarios ? horarios.find(h => {
    const hId = getProp(h, 'id', 'idHorario', 'IdHorario', 'Id')
    return hId && hId.toString() === horarioId.toString()
  }) : null

  const espacio = horario?.salon || horarioEspacio || ''
  const cuposDisponibles = horario?.cuposDisponibles || 5

  // Formatear fecha
  const fecha = fechaTutoria ? new Date(fechaTutoria + 'T00:00:00') : null
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  
  const fechaFormateada = fecha 
    ? `${diasSemana[fecha.getDay()]}, ${fecha.getDate()} ${meses[fecha.getMonth()]}`
    : 'Fecha no disponible'

  // Formatear hora
  let horaInicioFormateada = ''
  let horaFinFormateada = ''
  
  if (horarioHoraInicio) {
    try {
      const horaInicio = typeof horarioHoraInicio === 'string' 
        ? horarioHoraInicio 
        : new Date(horarioHoraInicio).toISOString()
      if (horaInicio.includes('T')) {
        horaInicioFormateada = horaInicio.split('T')[1]?.substring(0, 5) || tutoria.horaInicio || ''
      } else {
        horaInicioFormateada = tutoria.horaInicio || horaInicio.substring(0, 5) || ''
      }
    } catch (e) {
      horaInicioFormateada = tutoria.horaInicio || ''
    }
  } else {
    horaInicioFormateada = tutoria.horaInicio || ''
  }

  if (horarioHoraFin) {
    try {
      const horaFin = typeof horarioHoraFin === 'string' 
        ? horarioHoraFin 
        : new Date(horarioHoraFin).toISOString()
      if (horaFin.includes('T')) {
        horaFinFormateada = horaFin.split('T')[1]?.substring(0, 5) || tutoria.horaFin || ''
      } else {
        horaFinFormateada = tutoria.horaFin || horaFin.substring(0, 5) || ''
      }
    } catch (e) {
      horaFinFormateada = tutoria.horaFin || ''
    }
  } else {
    horaFinFormateada = tutoria.horaFin || ''
  }

  // Cargar estudiantes de la tutoría
  useEffect(() => {
    const cargarEstudiantes = async () => {
      if (!tutoriaId) return

      setLoadingEstudiantes(true)
      try {
        const estudiantesData = await tutoriaService.getEstudiantesByTutoria(tutoriaId)
        if (Array.isArray(estudiantesData)) {
          setEstudiantesTutoria(estudiantesData)
        }
      } catch (error) {
        console.warn('Error cargando estudiantes de tutoría:', error)
      } finally {
        setLoadingEstudiantes(false)
      }
    }

    cargarEstudiantes()
  }, [tutoriaId])

  // Obtener información de estudiantes
  const estudiantesInfo = estudiantesTutoria.map(est => {
    const estId = getProp(est, 'idUsuario', 'IdUsuario', 'id', 'Id')
    const estudiante = estId ? getEstudianteById(estId) : null
    return {
      id: estId,
      nombre: estudiante?.nombre || getProp(est, 'nombres', 'Nombres') || 'Estudiante',
      apellidos: estudiante?.apellidos || getProp(est, 'apellidos', 'Apellidos') || '',
      email: estudiante?.email || getProp(est, 'correo', 'Correo') || '',
      nombreCompleto: estudiante?.nombre || 
        `${getProp(est, 'nombres', 'Nombres') || ''} ${getProp(est, 'apellidos', 'Apellidos') || ''}`.trim() || 
        'Estudiante'
    }
  })

  const cuposOcupados = estudiantesInfo.length
  const cuposRestantes = cuposDisponibles - cuposOcupados

  const handleDelete = async () => {
    if (!(await confirm({ title: 'Eliminar tutoría', message: '¿Seguro que deseas eliminar esta tutoría? Esta acción no se puede deshacer.', confirmLabel: 'Eliminar', danger: true }))) {
      return
    }

    try {
      if (!tutoria.id) {
        throw new Error('No se pudo obtener el ID de la tutoría')
      }
      
      await deleteTutoria(tutoria.id)
      onClose()
    } catch (error) {
      console.error('[TutoriaDetailModal] Error eliminando tutoría:', error)
      toast.error(error.message || 'Error al eliminar la tutoría. Por favor, inténtalo de nuevo.')
    }
  }

  const handleEdit = () => {
    if (onEdit) {
      onEdit(tutoria)
      onClose()
    }
  }

  return (
    <div className="tutoria-modal-overlay" onClick={onClose}>
      <div className="tutoria-modal" role="dialog" aria-modal="true" aria-labelledby="td-modal-title" onClick={(e) => e.stopPropagation()}>
        <div className="tutoria-modal-header">
          <div className="tutoria-modal-title-section">
            <div className="tutoria-color-indicator"></div>
            <div>
              <h2 className="tutoria-modal-title" id="td-modal-title">
                {idioma} {nivel}
              </h2>
              <p className="tutoria-modal-date">{fechaFormateada}</p>
              <p className="tutoria-modal-capacity">
                <span className="td-count">
                  {estudiantesInfo.length} estudiante{estudiantesInfo.length !== 1 ? 's' : ''} agendado{estudiantesInfo.length !== 1 ? 's' : ''}
                </span>
              </p>
            </div>
          </div>
          <div className="tutoria-modal-actions">
            <button 
              className="tutoria-close-btn" 
              onClick={onClose}
              title="Cerrar"
              aria-label="Cerrar"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>

        <div className="tutoria-modal-content">
          <div className="tutoria-detail-item">
            <Icon name="text" size={18} className="tutoria-detail-icon" />
            <span>Horario</span>
          </div>
          {horaInicioFormateada && horaFinFormateada && (
            <div className="tutoria-detail-item">
              <Icon name="clock" size={18} className="tutoria-detail-icon" />
              <span>{horaInicioFormateada} - {horaFinFormateada}</span>
            </div>
          )}
          {modalidad && (
            <div className="tutoria-detail-item">
              <Icon name="mapPin" size={18} className="tutoria-detail-icon" />
              <span>{modalidad}</span>
            </div>
          )}
          {espacio && (
            <div className="tutoria-detail-item">
              <Icon name="building" size={18} className="tutoria-detail-icon" />
              <span>{espacio}</span>
            </div>
          )}
          {cuposRestantes >= 0 && (
            <div className="tutoria-detail-item">
              <Icon name="users" size={18} className="tutoria-detail-icon" />
              <span>{cuposRestantes} cupo{cuposRestantes !== 1 ? 's' : ''} disponible{cuposRestantes !== 1 ? 's' : ''}</span>
            </div>
          )}
          {tutoriaSinAsignar(tutoria) && (
            <div className="tutoria-detail-item">
              <Icon name="teacher" size={18} className="tutoria-detail-icon" />
              <span className="tutoria-sin-asignar">{ETIQUETA_SIN_ASIGNAR}</span>
            </div>
          )}
          {!tutoriaSinAsignar(tutoria) && (docente || usuarioNombre || tutoria.docenteNombre) && (
            <div className="tutoria-detail-item">
              <Icon name="teacher" size={18} className="tutoria-detail-icon" />
              <div className="tutoria-docente-info">
                <div className="tutoria-docente-name">
                  {docente 
                    ? (docente.nombre || (docente.nombres && docente.apellidos ? `${docente.nombres} ${docente.apellidos}`.trim() : docente.nombres || 'Docente'))
                    : (usuarioNombre && usuarioApellidos
                        ? `${usuarioNombre} ${usuarioApellidos}`.trim()
                        : (tutoria.docenteNombre && tutoria.docenteApellidos
                            ? `${tutoria.docenteNombre} ${tutoria.docenteApellidos}`.trim()
                            : usuarioNombre || tutoria.docenteNombre || 'Docente'))}
                </div>
                {docente?.rol && <div className="tutoria-docente-tipo">{docente.rol}</div>}
                {(docente?.email || docente?.correo || usuarioCorreo || tutoria.docenteCorreo) && (
                  <div className="tutoria-docente-email">{docente?.email || docente?.correo || usuarioCorreo || tutoria.docenteCorreo}</div>
                )}
              </div>
            </div>
          )}
          
          {/* Lista de estudiantes agendados */}
          <div className="tutoria-students-section">
            <div className="tutoria-students-header">
              <h3 className="tutoria-students-title">Estudiantes agendados</h3>
            </div>
            {loadingEstudiantes ? (
              <p className="no-students">Cargando estudiantes...</p>
            ) : estudiantesInfo.length > 0 ? (
              <ul className="tutoria-students-list">
                {estudiantesInfo.map((estudiante) => (
                  <li key={estudiante.id} className="tutoria-student-item">
                    <div className="student-main">
                      <div className="student-name">{estudiante.nombreCompleto}</div>
                      {estudiante.email && (
                        <div className="student-meta">
                          <span className="student-email">{estudiante.email}</span>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-students">No hay estudiantes asignados a esta tutoría.</p>
            )}
          </div>
          
          {tutoria.estado && (
            <div className="tutoria-detail-item">
              <Icon name="lock" size={18} className="tutoria-detail-icon" />
              <span>{tutoria.estado}</span>
            </div>
          )}

          {tutoria.id && grupoEstadoTutoria(tutoria.estado) === 'pendiente' && (
            <div className="tutoria-detail-finalizar">
              <Link className="btn btn--primary btn--block" to={`/tutorias/${tutoria.id}/finalizar`}>
                Calificar y finalizar
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TutoriaDetailModal
