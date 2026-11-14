import React, { useState, useEffect } from 'react'
import './TutoriaFinalizadaDetailModal.css'
import { useData } from '../context/DataContext'
import { useToast, useConfirm } from './ui/Feedback'
import { notificacionService, tutoriaService, horarioService, encuestaService, retroalimentacionService } from '../services/apiService'
import Icon from './ui/Icon'
import { ETIQUETA_SIN_ASIGNAR, nombreAutor, tutoriaSinAsignar } from '../lib/usuarios'
import Stars from './ui/Stars'

const TutoriaFinalizadaDetailModal = ({ tutoria, onClose }) => {
  const { getDocenteById, getEstudianteById, estudiantes, docentes, horarios } = useData()
  const toast = useToast()
  const confirm = useConfirm()
  const [estudiantesTutoria, setEstudiantesTutoria] = useState([])
  const [loadingEstudiantes, setLoadingEstudiantes] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [docenteId, setDocenteId] = useState(null)
  const [encuestas, setEncuestas] = useState([])
  const [loadingEncuestas, setLoadingEncuestas] = useState(false)
  const [retroalimentaciones, setRetroalimentaciones] = useState([])
  const [loadingRetro, setLoadingRetro] = useState(false)
  
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
  
  // Intentar obtener usuarioId de múltiples formas
  let usuarioId = getProp(tutoria, 'usuarioId', 'UsuarioId', 'docenteId', 'DocenteId', 'idDocente', 'IdDocente')
  
  const usuarioNombre = getProp(tutoria, 'usuarioNombre', 'UsuarioNombre')
  const usuarioApellidos = getProp(tutoria, 'usuarioApellidos', 'UsuarioApellidos')
  const usuarioCorreo = getProp(tutoria, 'usuarioCorreo', 'UsuarioCorreo')
  
  const horarioEspacio = getProp(tutoria, 'horarioEspacio', 'HorarioEspacio', 'espacio', 'Espacio') || ''
  const horarioHoraInicio = getProp(tutoria, 'horarioHoraInicio', 'HorarioHoraInicio', 'horaInicio', 'HoraInicio')
  const horarioHoraFin = getProp(tutoria, 'horarioHoraFin', 'HorarioHoraFin', 'horaFin', 'HoraFin')
  const horarioId = getProp(tutoria, 'horarioId', 'HorarioId', 'idHorario', 'IdHorario')

  // Si no se encontró por ID, buscar por correo, nombre/apellidos o desde el horario
  useEffect(() => {
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
  }, [docentes, horarios, usuarioCorreo, usuarioNombre, usuarioApellidos, usuarioId, horarioId])

  // Usar el docenteId encontrado o el usuarioId
  const docenteIdFinal = docenteId || usuarioId
  
  // Buscar docente por ID
  const docente = docenteIdFinal ? getDocenteById(docenteIdFinal) : null

  // Formatear fecha
  const fecha = fechaTutoria ? new Date(fechaTutoria) : null
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  
  const fechaFormateada = fecha 
    ? `${diasSemana[fecha.getDay()]}, ${fecha.getDate()} ${meses[fecha.getMonth()]}`
    : 'Fecha no disponible'

  // Formatear hora
  const horaInicioFormateada = horarioHoraInicio
    ? new Date(horarioHoraInicio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : ''
  const horaFinFormateada = horarioHoraFin
    ? new Date(horarioHoraFin).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : ''

  // Cargar estudiantes de la tutoría
  useEffect(() => {
    const cargarEstudiantes = async () => {
      if (!tutoriaId) return

      setLoadingEstudiantes(true)
      try {
        const estudiantesData = await tutoriaService.getEstudiantesByTutoria(tutoriaId)
        if (Array.isArray(estudiantesData)) {
          setEstudiantesTutoria(estudiantesData)
        } else if (getProp(tutoria, 'estudiantes', 'Estudiantes')) {
          // Si vienen en la respuesta de la tutoría
          setEstudiantesTutoria(getProp(tutoria, 'estudiantes', 'Estudiantes'))
        }
      } catch (error) {
        console.warn('Error cargando estudiantes de tutoría:', error)
        // Intentar usar estudiantes de la respuesta si están disponibles
        if (getProp(tutoria, 'estudiantes', 'Estudiantes')) {
          setEstudiantesTutoria(getProp(tutoria, 'estudiantes', 'Estudiantes'))
        }
      } finally {
        setLoadingEstudiantes(false)
      }
    }

    cargarEstudiantes()
  }, [tutoriaId])

  // Cargar encuestas de la tutoría
  useEffect(() => {
    const cargarEncuestas = async () => {
      if (!tutoriaId) return
      setLoadingEncuestas(true)
      try {
        const data = await encuestaService.getByTutoria(tutoriaId)
        setEncuestas(Array.isArray(data) ? data : [])
      } catch (error) {
        console.warn('Error cargando encuestas de tutoría:', error)
        setEncuestas([])
      } finally {
        setLoadingEncuestas(false)
      }
    }
    cargarEncuestas()
  }, [tutoriaId])

  // Cargar retroalimentaciones de la tutoría
  useEffect(() => {
    const cargarRetroalimentaciones = async () => {
      if (!tutoriaId) return
      setLoadingRetro(true)
      try {
        const data = await retroalimentacionService.getByTutoria(tutoriaId)
        setRetroalimentaciones(Array.isArray(data) ? data : [])
      } catch (error) {
        console.warn('Error cargando retroalimentaciones de tutoría:', error)
        setRetroalimentaciones([])
      } finally {
        setLoadingRetro(false)
      }
    }
    cargarRetroalimentaciones()
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

  const handleExportar = async () => {
    if (!tutoriaId) {
      console.error('TutoriaId faltante para exportar:', { tutoriaId, tutoria })
      toast.error(`No se pudo obtener la información necesaria para descargar el reporte.\n\nTutoriaId: ${tutoriaId || 'No disponible'}\n\nPor favor, verifica que la tutoría tenga un ID válido.`)
      return
    }

    if (!(await confirm({ title: 'Descargar reporte', message: '¿Deseas descargar el reporte de esta tutoría en Excel?', confirmLabel: 'Descargar' }))) {
      return
    }

    try {
      setExportando(true)
      console.log('Descargando reporte con tutoriaId:', tutoriaId)
      await notificacionService.exportarReporteExcel(tutoriaId)
      // El archivo se descarga automáticamente, no necesitamos mostrar un mensaje adicional
      // pero podemos mostrar uno opcional para confirmar
      console.log('Reporte descargado exitosamente')
    } catch (error) {
      console.error('Error descargando reporte:', error)
      toast.error(error.message || 'Error al descargar el reporte. Por favor, inténtalo de nuevo.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="tutoria-finalizada-modal-overlay" onClick={onClose}>
      <div className="tutoria-finalizada-modal" role="dialog" aria-modal="true" aria-labelledby="tf-modal-title" onClick={(e) => e.stopPropagation()}>
        <div className="tutoria-finalizada-modal-header">
          <div className="tutoria-finalizada-modal-title-section">
            <div className="tutoria-finalizada-color-indicator"></div>
            <div>
              <h2 className="tutoria-finalizada-modal-title" id="tf-modal-title">
                {idioma} {nivel}
              </h2>
              <p className="tutoria-finalizada-modal-date">{fechaFormateada}</p>
              <p className="tutoria-finalizada-modal-capacity">
                <span className="tf-count">
                  {estudiantesInfo.length} estudiante{estudiantesInfo.length !== 1 ? 's' : ''} agendado{estudiantesInfo.length !== 1 ? 's' : ''}
                </span>
              </p>
            </div>
          </div>
          <div className="tutoria-finalizada-modal-actions">
            <button 
              className="tutoria-finalizada-export-btn"
              onClick={handleExportar}
              disabled={exportando}
              title="Descargar reporte Excel"
            >
              {exportando ? <span className="spinner" aria-hidden="true"><span /></span> : <Icon name="download" size={18} />} {exportando ? 'Descargando...' : 'Descargar'}
            </button>
            <button 
              className="tutoria-finalizada-close-btn" 
              onClick={onClose}
              title="Cerrar"
              aria-label="Cerrar"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>

        <div className="tutoria-finalizada-modal-content">
          <div className="tutoria-finalizada-detail-item">
            <Icon name="text" size={18} className="tutoria-finalizada-detail-icon" />
            <span>Horario</span>
          </div>
          {horaInicioFormateada && horaFinFormateada && (
            <div className="tutoria-finalizada-detail-item">
              <Icon name="clock" size={18} className="tutoria-finalizada-detail-icon" />
              <span>{horaInicioFormateada} - {horaFinFormateada}</span>
            </div>
          )}
          <div className="tutoria-finalizada-detail-item">
            <Icon name="mapPin" size={18} className="tutoria-finalizada-detail-icon" />
            <span>{modalidad}</span>
          </div>
          {horarioEspacio && (
            <div className="tutoria-finalizada-detail-item">
              <Icon name="building" size={18} className="tutoria-finalizada-detail-icon" />
              <span>{horarioEspacio}</span>
            </div>
          )}
          {estudiantesInfo.length > 0 && (
            <div className="tutoria-finalizada-detail-item">
              <Icon name="users" size={18} className="tutoria-finalizada-detail-icon" />
              <span>{estudiantesInfo.length} cupo{estudiantesInfo.length !== 1 ? 's' : ''} disponible{estudiantesInfo.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          {tutoriaSinAsignar(tutoria) && (
            <div className="tutoria-finalizada-detail-item">
              <Icon name="teacher" size={18} className="tutoria-finalizada-detail-icon" />
              <span className="tutoria-sin-asignar">{ETIQUETA_SIN_ASIGNAR}</span>
            </div>
          )}
          {!tutoriaSinAsignar(tutoria) && (docente || usuarioNombre) && (
            <div className="tutoria-finalizada-detail-item">
              <Icon name="teacher" size={18} className="tutoria-finalizada-detail-icon" />
              <div className="tutoria-finalizada-docente-info">
                <div className="tutoria-finalizada-docente-name">
                  {docente 
                    ? (docente.nombre || (docente.nombres && docente.apellidos ? `${docente.nombres} ${docente.apellidos}`.trim() : docente.nombres || 'Docente'))
                    : `${usuarioNombre || ''} ${usuarioApellidos || ''}`.trim() || 'Docente'}
                </div>
                {docente?.rol && <div className="tutoria-finalizada-docente-tipo">{docente.rol}</div>}
                {(docente?.email || docente?.correo || usuarioCorreo) && (
                  <div className="tutoria-finalizada-docente-email">{docente?.email || docente?.correo || usuarioCorreo}</div>
                )}
              </div>
            </div>
          )}
          
          {/* Lista de estudiantes agendados */}
          <div className="tutoria-finalizada-students-section">
            <div className="tutoria-finalizada-students-header">
              <h3 className="tutoria-finalizada-students-title">Estudiantes agendados</h3>
            </div>
            {loadingEstudiantes ? (
              <p className="no-students">Cargando estudiantes...</p>
            ) : estudiantesInfo.length > 0 ? (
              <ul className="tutoria-finalizada-students-list">
                {estudiantesInfo.map((estudiante) => (
                  <li key={estudiante.id} className="tutoria-finalizada-student-item">
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
          
          <div className="tutoria-finalizada-detail-item">
            <Icon name="lock" size={18} className="tutoria-finalizada-detail-icon" />
            <span>Finalizada</span>
          </div>

          {/* Sección de Retroalimentación del Profesor */}
          <div className="tutoria-finalizada-students-section tf-section">
            <div className="tutoria-finalizada-students-header">
              <h3 className="tutoria-finalizada-students-title">
                <Icon name="message" size={18} className="icon--inline" />Retroalimentación del profesor
              </h3>
            </div>

            {loadingRetro ? (
              <p className="no-students">Cargando retroalimentación...</p>
            ) : retroalimentaciones.length === 0 ? (
              <p className="no-students">No hay retroalimentación registrada para esta tutoría.</p>
            ) : (
              retroalimentaciones.map((retro) => {
                const calificacion = retro.Calificacion ?? retro.calificacion ?? 0
                const calRedondeada = Math.round(calificacion)
                const comentario = retro.Comentario ?? retro.comentario ?? ''
                const fecha = retro.Fecha ?? retro.fecha
                const nombre = nombreAutor(retro)

                // Tono según calificación (pares de tokens con contraste ≥4.5:1 en claro y oscuro)
                const tono = calificacion >= 4 ? 'alta' : calificacion < 3 ? 'baja' : 'media'

                return (
                  <div key={retro.IdRetroalimentacion ?? retro.idRetroalimentacion} className="tf-retro">
                    {/* Encabezado: docente + calificación */}
                    <div className="tf-retro__head">
                      <span className="tf-retro__author">
                        <Icon name="teacher" size={16} className="icon--inline" />{nombre}
                      </span>
                      <div className="tf-retro__score">
                        <Stars value={calificacion} size={16} />
                        <span className={`tf-pill tf-pill--${tono}`}>
                          {Number(calificacion).toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* Comentario */}
                    {comentario ? (
                      <p className="tf-quote">
                        "{comentario}"
                      </p>
                    ) : (
                      <p className="tf-quote tf-quote--empty">
                        Sin comentario
                      </p>
                    )}

                    {/* Fecha */}
                    {fecha && (
                      <div className="tf-meta">
                        {new Date(fecha).toLocaleDateString('es-ES', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Sección de Encuestas de Satisfacción */}
          <div className="tutoria-finalizada-students-section tf-section">
            <div className="tutoria-finalizada-students-header">
              <h3 className="tutoria-finalizada-students-title">
                <Icon name="clipboard" size={18} className="icon--inline" />Encuestas de satisfacción
                {encuestas.length > 0 && (
                  <span className="tf-chip">
                    {encuestas.filter(e => e.tokenUsado).length}/{encuestas.length} respondidas
                  </span>
                )}
              </h3>
            </div>

            {loadingEncuestas ? (
              <p className="no-students">Cargando encuestas...</p>
            ) : encuestas.length === 0 ? (
              <p className="no-students">No se han enviado encuestas para esta tutoría.</p>
            ) : (
              <>
                {/* Promedio si hay respuestas */}
                {encuestas.filter(e => e.tokenUsado).length > 0 && (() => {
                  const respondidas = encuestas.filter(e => e.tokenUsado)
                  const promedio = respondidas.reduce((s, e) => s + e.calificacion, 0) / respondidas.length
                  return (
                    <div className="tf-average">
                      <Stars value={promedio} size={20} />
                      <span className="tf-average__value">
                        Promedio: {promedio.toFixed(1)}/5
                      </span>
                      <span className="tf-meta">
                        ({respondidas.length} respuesta{respondidas.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                  )
                })()}

                {/* Lista de encuestas */}
                <ul className="tutoria-finalizada-students-list">
                  {encuestas.map((enc) => (
                    <li key={enc.idEncuesta} className="tutoria-finalizada-student-item tf-survey">
                      <div className="student-main tf-survey__main">
                        <div className="tf-survey__head">
                          <div className="student-name">
                            {enc.estudianteNombre || 'Estudiante'}
                          </div>
                          {enc.tokenUsado ? (
                            <Stars value={enc.calificacion} size={18} />
                          ) : (
                            <span className="tf-chip">
                              Pendiente
                            </span>
                          )}
                        </div>
                        {enc.estudianteCorreo && (
                          <div className="student-meta">
                            <span className="student-email">{enc.estudianteCorreo}</span>
                          </div>
                        )}
                        {enc.tokenUsado && enc.comentario && (
                          <div className="tf-quote tf-quote--boxed">
                            "{enc.comentario}"
                          </div>
                        )}
                        {enc.tokenUsado && enc.fechaRespuesta && (
                          <div className="tf-meta">
                            Respondida el {new Date(enc.fechaRespuesta).toLocaleDateString('es-ES', {
                              day: '2-digit', month: 'short', year: 'numeric'
                            })}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TutoriaFinalizadaDetailModal

