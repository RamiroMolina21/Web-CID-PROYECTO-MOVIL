import React, { useState } from 'react'
import { useData } from '../context/DataContext'
import FormularioTutoria from '../components/FormularioTutoria'
import TutoriaDetailModal from '../components/TutoriaDetailModal'
import AgregarEstudianteATutoriaModal from '../components/AgregarEstudianteATutoriaModal'
import './AgendarTutoria.css'

const AgendarTutoria = () => {
  const { horarios, getHorariosDisponibles, tutorias, getDocenteById, loadData } = useData()
  const [selectedHorario, setSelectedHorario] = useState(null)
  const [selectedTutoria, setSelectedTutoria] = useState(null)
  const [tutoriaParaAgregarEstudiante, setTutoriaParaAgregarEstudiante] = useState(null)
  const [searchDate, setSearchDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTutoriaQuery, setSearchTutoriaQuery] = useState('')
  const [searchTutoriaDate, setSearchTutoriaDate] = useState('')

  // Función para agrupar horarios recurrentes
  const agruparHorariosRecurrentes = (horariosList) => {
    const grupos = new Map()
    
    horariosList.forEach(horario => {
      // Crear clave única basada en título, hora inicio, hora fin, docente y salón
      const titulo = horario.titulo || 'Sin título'
      const horaInicio = horario.horaInicio || ''
      const horaFin = horario.horaFin || ''
      const docenteId = horario.docenteId || ''
      const salon = horario.salon || ''
      
      const clave = `${titulo}|${horaInicio}|${horaFin}|${docenteId}|${salon}`
      
      if (!grupos.has(clave)) {
        grupos.set(clave, {
          horarios: [],
          titulo,
          horaInicio,
          horaFin,
          docenteId,
          salon,
          cuposDisponibles: horario.cuposDisponibles || 5
        })
      }
      
      grupos.get(clave).horarios.push(horario)
    })
    
    return Array.from(grupos.values())
  }

  // Obtener todos los horarios disponibles (sin agrupar aún)
  const todosHorariosDisponibles = getHorariosDisponibles()
    .filter(h => {
      // Filtrar horarios con estado "Ocupado"
      if (h.estado && h.estado.toLowerCase() === 'ocupado') {
        return false
      }
      // También filtrar si está al límite de capacidad
      const occupied = tutorias.filter(t => t.horarioId === h.id).length
      const capacity = h.cuposDisponibles ?? 5
      if (occupied >= capacity) {
        return false
      }
      return true
    })
    .filter(h => {
      if (searchDate) {
        const horarioDate = new Date(h.fecha).toISOString().split('T')[0]
        return horarioDate === searchDate
      }
      return true
    })
    .filter(h => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          h.titulo?.toLowerCase().includes(query)
        )
      }
      return true
    })

  // Ordenar por id descendente (más recientes primero) antes de agrupar
  const horariosOrdenadosPorRecientes = [...todosHorariosDisponibles].sort((a, b) => (b.id || 0) - (a.id || 0))

  // Agrupar horarios recurrentes
  const gruposHorarios = agruparHorariosRecurrentes(horariosOrdenadosPorRecientes)
  
  // Para cada grupo, seleccionar el horario más cercano disponible como representante
  const horariosDisponibles = gruposHorarios.map(grupo => {
    // Ordenar horarios del grupo por fecha (más cercanos primero)
    const horariosOrdenados = grupo.horarios.sort((a, b) => {
      const fechaA = new Date(a.fecha + 'T00:00:00').getTime()
      const fechaB = new Date(b.fecha + 'T00:00:00').getTime()
      return fechaA - fechaB
    })
    
    // Seleccionar el primero disponible (más cercano)
    const horarioRepresentante = horariosOrdenados[0]
    
    // Obtener todas las fechas disponibles del grupo (excluyendo las que ya tienen tutorías)
    const fechasDisponibles = horariosOrdenados
      .map(h => {
        const tutoriasEnHorario = tutorias.filter(t => t.horarioId === h.id)
        const occupied = tutoriasEnHorario.length
        const capacity = h.cuposDisponibles ?? 5
        const tieneCupo = occupied < capacity
        const tieneTutoria = tutoriasEnHorario.length > 0
        // Una fecha está disponible solo si tiene cupo Y no tiene ninguna tutoría asignada
        return { 
          fecha: h.fecha, 
          horario: h, 
          disponible: tieneCupo && !tieneTutoria,
          ocupado: occupied,
          capacidad: capacity
        }
      })
      .filter(item => item.disponible)
      .map(item => item.fecha)
    
    return {
      ...horarioRepresentante,
      grupoId: `${grupo.titulo}|${grupo.horaInicio}|${grupo.horaFin}|${grupo.docenteId}|${grupo.salon}`,
      esRecurrente: grupo.horarios.length > 1,
      totalOcurrencias: grupo.horarios.length,
      fechasDisponibles: fechasDisponibles,
      todosLosHorarios: horariosOrdenados // Guardar todos para poder seleccionar uno específico
    }
    })

  const tutoriasAgendadas = tutorias
    .filter(t => {
      const estado = (t.estado || '').toLowerCase()
      return estado !== 'finalizada' && estado !== 'completada' && estado !== 'completa'
    })
    .filter(t => {
      if (searchTutoriaDate) {
        const tutoriaDate = new Date(t.fecha).toISOString().split('T')[0]
        return tutoriaDate === searchTutoriaDate
      }
      return true
    })
    .filter(t => {
      if (searchTutoriaQuery) {
        const query = searchTutoriaQuery.toLowerCase()
        return (
          t.tema?.toLowerCase().includes(query) ||
          t.idioma?.toLowerCase().includes(query)
        )
      }
      return true
    })
    .sort((a, b) => {
      if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha)
      return b.horaInicio.localeCompare(a.horaInicio)
    })

  const formatDate = (dateString) => {
    // Crear la fecha y ajustar a la zona horaria local
    const date = new Date(dateString + 'T00:00:00')
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]}`
  }

  const formatShortDate = (dateString) => {
    // Crear la fecha y ajustar a la zona horaria local
    const date = new Date(dateString + 'T00:00:00')
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 
                    'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    return `${date.getDate()} ${months[date.getMonth()]}`
  }

  return (
    <div className="agendar-tutoria-page">
      <div className="page-header">
        <div>
          <h1>Agendar Tutoría</h1>
          <p>Reserva un horario disponible para una nueva tutoría</p>
        </div>
      </div>

      <div className="agendar-content">
        <div className="horarios-section">
          <div className="section-header">
            <h3>📅 Horarios Disponibles</h3>
            <div className="search-controls">
              <input
                type="text"
                placeholder="Buscar por título (ej: Inglés Básico)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="date-input"
                title="Filtrar por fecha"
              />
            </div>
          </div>

          <div className="horarios-grid">
            {horariosDisponibles.map((horario) => {
              // Calcular cupos totales para el grupo si es recurrente
              const esRecurrente = horario.esRecurrente || false
              let cuposInfo = ''
              let totalOcupados = 0
              
              if (esRecurrente && horario.todosLosHorarios) {
                // Sumar cupos de todos los horarios del grupo
                totalOcupados = horario.todosLosHorarios.reduce((sum, h) => {
                  return sum + tutorias.filter(t => t.horarioId === h.id).length
                }, 0)
                const totalCapacidad = horario.todosLosHorarios.length * (horario.cuposDisponibles || 5)
                cuposInfo = `${totalOcupados}/${totalCapacidad}`
              } else {
                const occupied = tutorias.filter(t => t.horarioId === horario.id).length
                const capacity = horario.cuposDisponibles ?? 5
                totalOcupados = occupied
                cuposInfo = `${occupied}/${capacity}`
              }
              
              return (
              <div
                  key={horario.grupoId || horario.id}
                  className={`horario-card ${selectedHorario?.grupoId === horario.grupoId || selectedHorario?.id === horario.id ? 'selected' : ''}`}
                onClick={() => setSelectedHorario(horario)}
              >
                <div className="horario-badges">
                  <div className="horario-badges-left">
                    <span className="badge available">Disponible</span>
                    {esRecurrente && (
                      <span className="badge recurrente" title={`Horario recurrente con ${horario.totalOcurrencias} fechas disponibles`}>
                        🔄 Recurrente ({horario.totalOcurrencias})
                      </span>
                    )}
                    {selectedHorario?.grupoId === horario.grupoId || selectedHorario?.id === horario.id ? (
                      <span className="badge selected">Seleccionado</span>
                    ) : null}
                  </div>
                  <div className="cupos-badge" title={`Cupos: ${cuposInfo}`}>
                    {cuposInfo}
                  </div>
                </div>
                <h4>{horario.titulo || 'Sin título'}</h4>
                <div className="horario-info">
                  <span>📅 {esRecurrente ? 'Múltiples fechas disponibles' : formatDate(horario.fecha)}</span>
                  <span>🕐 {horario.horaInicio} - {horario.horaFin}</span>
                </div>
                {esRecurrente && horario.fechasDisponibles && horario.fechasDisponibles.length > 0 && (
                  <div className="fechas-recurrentes-hint">
                    {horario.fechasDisponibles.length} fecha(s) disponible(s)
                  </div>
                )}
                </div>
              )
            })}
          </div>

          {selectedHorario && (
            <div className="modal-overlay" onClick={() => setSelectedHorario(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal">
                  <FormularioTutoria
                    horario={selectedHorario}
                    onClose={() => setSelectedHorario(null)}
                    isModal={true}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="tutorias-section">
          <div className="section-header">
            <h3>📚 Tutorías Agendadas</h3>
            <div className="search-controls">
              <input
                type="text"
                placeholder="Buscar por idioma o tema (ej: Inglés, Gramática)"
                value={searchTutoriaQuery}
                onChange={(e) => setSearchTutoriaQuery(e.target.value)}
                className="search-input"
              />
              <input
                type="date"
                value={searchTutoriaDate}
                onChange={(e) => setSearchTutoriaDate(e.target.value)}
                className="date-input"
                title="Filtrar por fecha"
              />
            </div>
          </div>

          <div className="tutorias-list">
            {tutoriasAgendadas.length === 0 ? (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                No hay tutorías agendadas
              </p>
            ) : (
              tutoriasAgendadas.map((tutoria) => {
                const docente = tutoria.docenteId ? getDocenteById(tutoria.docenteId) : null
                
                // Determinar el color del badge según el estado
                const getStatusBadgeClass = (estado) => {
                  const estadoLower = (estado || '').toLowerCase()
                  if (estadoLower === 'finalizada' || estadoLower === 'completada') {
                    return 'status-badge finalized'
                  } else if (estadoLower === 'programada' || estadoLower === 'pendiente') {
                    return 'status-badge scheduled'
                  } else if (estadoLower === 'activo' || estadoLower === 'en curso') {
                    return 'status-badge active'
                  } else if (estadoLower === 'cancelada') {
                    return 'status-badge cancelled'
                  }
                  return 'status-badge pending'
                }

                return (
                  <div 
                    key={tutoria.id} 
                    className="tutoria-card"
                    onClick={() => setSelectedTutoria(tutoria)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="tutoria-header">
                      <span className={getStatusBadgeClass(tutoria.estado)}>
                        {tutoria.estado || 'Pendiente'}
                      </span>
                      {(() => {
                        const estadoLower = (tutoria.estado || '').toLowerCase()
                        const esFinalizada = estadoLower === 'finalizada' || estadoLower === 'completada' || estadoLower === 'completa'
                        return (
                          <button
                            className="tutoria-agregar-estudiante-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!esFinalizada) setTutoriaParaAgregarEstudiante(tutoria)
                            }}
                            disabled={esFinalizada}
                            title={esFinalizada ? 'Esta tutoría ya está finalizada' : 'Agregar estudiante'}
                            style={esFinalizada ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
                          >
                            ➕ Agregar Estudiante
                          </button>
                        )
                      })()}
                    </div>
                    <p className="tutoria-tema">
                      <strong>{tutoria.idioma || ''} {tutoria.nivel || ''}</strong>
                      {tutoria.tema ? ` - ${tutoria.tema}` : ''}
                    </p>
                    {docente && (
                      <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0.25rem 0' }}>
                        👩‍🏫 Docente: {docente.nombre || (docente.nombres && docente.apellidos ? `${docente.nombres} ${docente.apellidos}`.trim() : 'Docente')}
                      </p>
                    )}
                    <div className="tutoria-details">
                      <span>📅 {formatShortDate(tutoria.fecha)}</span>
                      <span>🕐 {tutoria.horaInicio}{tutoria.horaFin ? ` - ${tutoria.horaFin}` : ''}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {selectedTutoria && (
        <TutoriaDetailModal
          tutoria={selectedTutoria}
          onClose={() => setSelectedTutoria(null)}
          onEdit={(tutoria) => {
            // Aquí puedes agregar lógica para editar si es necesario
            console.log('Editar tutoría:', tutoria)
            setSelectedTutoria(null)
          }}
        />
      )}

      {tutoriaParaAgregarEstudiante && (
        <AgregarEstudianteATutoriaModal
          tutoria={tutoriaParaAgregarEstudiante}
          onClose={() => setTutoriaParaAgregarEstudiante(null)}
          onSuccess={async () => {
            // Recargar datos para actualizar la lista de tutorías
            if (loadData) {
              await loadData()
            }
            setTutoriaParaAgregarEstudiante(null)
          }}
        />
      )}
    </div>
  )
}

export default AgendarTutoria




