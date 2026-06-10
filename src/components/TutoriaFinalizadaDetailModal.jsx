import React, { useState, useEffect } from 'react'
import './TutoriaFinalizadaDetailModal.css'
import { useData } from '../context/DataContext'
import { notificacionService, tutoriaService, horarioService, encuestaService, retroalimentacionService } from '../services/apiService'

const TutoriaFinalizadaDetailModal = ({ tutoria, onClose }) => {
  const { getDocenteById, getEstudianteById, estudiantes, docentes, horarios } = useData()
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
      alert(`No se pudo obtener la información necesaria para descargar el reporte.\n\nTutoriaId: ${tutoriaId || 'No disponible'}\n\nPor favor, verifica que la tutoría tenga un ID válido.`)
      return
    }

    if (!window.confirm('¿Deseas descargar el reporte en Excel?')) {
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
      alert(error.message || 'Error al descargar el reporte. Por favor, inténtalo de nuevo.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="tutoria-finalizada-modal-overlay" onClick={onClose}>
      <div className="tutoria-finalizada-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tutoria-finalizada-modal-header">
          <div className="tutoria-finalizada-modal-title-section">
            <div className="tutoria-finalizada-color-indicator"></div>
            <div>
              <h2 className="tutoria-finalizada-modal-title">
                {idioma} {nivel}
              </h2>
              <p className="tutoria-finalizada-modal-date">{fechaFormateada}</p>
              <p className="tutoria-finalizada-modal-capacity">
                <span style={{ color: '#22c55e' }}>
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
              {exportando ? '⏳' : '📊'} {exportando ? 'Descargando...' : 'Descargar'}
            </button>
            <button 
              className="tutoria-finalizada-close-btn" 
              onClick={onClose}
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="tutoria-finalizada-modal-content">
          <div className="tutoria-finalizada-detail-item">
            <span className="tutoria-finalizada-detail-icon">☰</span>
            <span>Horario</span>
          </div>
          {horaInicioFormateada && horaFinFormateada && (
            <div className="tutoria-finalizada-detail-item">
              <span className="tutoria-finalizada-detail-icon">🕐</span>
              <span>{horaInicioFormateada} - {horaFinFormateada}</span>
            </div>
          )}
          <div className="tutoria-finalizada-detail-item">
            <span className="tutoria-finalizada-detail-icon">📍</span>
            <span>{modalidad}</span>
          </div>
          {horarioEspacio && (
            <div className="tutoria-finalizada-detail-item">
              <span className="tutoria-finalizada-detail-icon">🏢</span>
              <span>{horarioEspacio}</span>
            </div>
          )}
          {estudiantesInfo.length > 0 && (
            <div className="tutoria-finalizada-detail-item">
              <span className="tutoria-finalizada-detail-icon">👥</span>
              <span>{estudiantesInfo.length} cupo{estudiantesInfo.length !== 1 ? 's' : ''} disponible{estudiantesInfo.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          {(docente || usuarioNombre) && (
            <div className="tutoria-finalizada-detail-item">
              <span className="tutoria-finalizada-detail-icon">👩‍🏫</span>
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
            <span className="tutoria-finalizada-detail-icon">🔒</span>
            <span>Finalizada</span>
          </div>

          {/* Sección de Retroalimentación del Profesor */}
          <div className="tutoria-finalizada-students-section" style={{ marginTop: '16px' }}>
            <div className="tutoria-finalizada-students-header">
              <h3 className="tutoria-finalizada-students-title">
                💬 Retroalimentación del profesor
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
                const nombre = `${retro.UsuarioNombre ?? retro.usuarioNombre ?? ''} ${retro.UsuarioApellidos ?? retro.usuarioApellidos ?? ''}`.trim() || 'Docente'

                // Color de fondo según calificación
                let calColor = '#f59e0b'
                if (calificacion >= 4) calColor = '#16a34a'
                else if (calificacion < 3) calColor = '#dc2626'

                return (
                  <div key={retro.IdRetroalimentacion ?? retro.idRetroalimentacion} style={{
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderLeft: '4px solid #4472c4',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    marginBottom: '10px',
                  }}>
                    {/* Encabezado: docente + calificación */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: '#1e3a5f', fontSize: '14px' }}>
                        👩‍🏫 {nombre}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '16px', color: '#f59e0b' }}>
                          {'★'.repeat(calRedondeada)}{'☆'.repeat(5 - calRedondeada)}
                        </span>
                        <span style={{
                          background: calColor, color: 'white',
                          fontWeight: 'bold', fontSize: '13px',
                          padding: '2px 8px', borderRadius: '12px',
                        }}>
                          {Number(calificacion).toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* Comentario */}
                    {comentario ? (
                      <p style={{
                        margin: '0 0 6px', fontSize: '13px', color: '#374151',
                        lineHeight: '1.5', fontStyle: 'italic',
                      }}>
                        "{comentario}"
                      </p>
                    ) : (
                      <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>
                        Sin comentario
                      </p>
                    )}

                    {/* Fecha */}
                    {fecha && (
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>
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
          <div className="tutoria-finalizada-students-section" style={{ marginTop: '16px' }}>
            <div className="tutoria-finalizada-students-header">
              <h3 className="tutoria-finalizada-students-title">
                📋 Encuestas de satisfacción
                {encuestas.length > 0 && (
                  <span style={{
                    marginLeft: '8px', fontSize: '12px', fontWeight: 'normal',
                    color: '#6b7280', background: '#f3f4f6',
                    padding: '2px 8px', borderRadius: '12px',
                  }}>
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
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      background: '#f0fdf4', border: '1px solid #bbf7d0',
                      borderRadius: '8px', padding: '10px 14px', marginBottom: '12px',
                    }}>
                      <span style={{ fontSize: '20px', color: '#f59e0b' }}>
                        {'★'.repeat(Math.round(promedio))}{'☆'.repeat(5 - Math.round(promedio))}
                      </span>
                      <span style={{ fontWeight: 'bold', color: '#15803d' }}>
                        Promedio: {promedio.toFixed(1)}/5
                      </span>
                      <span style={{ color: '#6b7280', fontSize: '13px' }}>
                        ({respondidas.length} respuesta{respondidas.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                  )
                })()}

                {/* Lista de encuestas */}
                <ul className="tutoria-finalizada-students-list">
                  {encuestas.map((enc) => (
                    <li key={enc.idEncuesta} className="tutoria-finalizada-student-item" style={{
                      borderLeft: enc.tokenUsado ? '3px solid #22c55e' : '3px solid #d1d5db',
                    }}>
                      <div className="student-main" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div className="student-name">
                            {enc.estudianteNombre || 'Estudiante'}
                          </div>
                          {enc.tokenUsado ? (
                            <span style={{
                              fontSize: '18px', color: '#f59e0b', letterSpacing: '2px', flexShrink: 0,
                            }} title={`${enc.calificacion}/5`}>
                              {'★'.repeat(enc.calificacion)}{'☆'.repeat(5 - enc.calificacion)}
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '12px', color: '#9ca3af',
                              background: '#f3f4f6', padding: '2px 8px', borderRadius: '10px',
                            }}>
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
                          <div style={{
                            marginTop: '6px', fontSize: '13px', color: '#374151',
                            background: '#f9fafb', borderRadius: '6px',
                            padding: '6px 10px', fontStyle: 'italic',
                          }}>
                            "{enc.comentario}"
                          </div>
                        )}
                        {enc.tokenUsado && enc.fechaRespuesta && (
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
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

