import React, { useState } from 'react'
import { useData } from '../context/DataContext'
import FormularioTutoria from '../components/FormularioTutoria'
import HorarioDetailModal from '../components/HorarioDetailModal'
import './AgendarTutoria.css'

const AgendarTutoria = () => {
  const { horarios, getHorariosDisponibles, tutorias, getEstudianteById, deleteHorario, getDocenteById } = useData()
  const [selectedHorario, setSelectedHorario] = useState(null)
  const [searchDate, setSearchDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const horariosDisponibles = getHorariosDisponibles()
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

  const tutoriasAgendadas = tutorias
    .sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha)
      return a.horaInicio.localeCompare(b.horaInicio)
    })
    .slice(0, 10)

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

  const [selectedHorarioDetail, setSelectedHorarioDetail] = useState(null)

  const handleDeleteHorario = async (id) => {
    if (window.confirm('¿Eliminar horario?')) {
      try {
        await deleteHorario(id)
        setSelectedHorarioDetail(null)
      } catch (error) {
        alert(`Error: ${error.message || 'No se pudo eliminar el horario'}`)
      }
    }
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
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="date-input"
              />
            </div>
          </div>

          <div className="horarios-grid">
            {horariosDisponibles.map((horario) => (
              <div
                key={horario.id}
                className={`horario-card ${selectedHorario?.id === horario.id ? 'selected' : ''}`}
                onClick={() => setSelectedHorario(horario)}
              >
                <div className="horario-badges">
                  <span className="badge available">Disponible</span>
                  {selectedHorario?.id === horario.id && (
                    <span className="badge selected">Seleccionado</span>
                  )}
                </div>
                <h4>{horario.titulo || 'Sin título'}</h4>
                <div className="horario-info">
                  <span>📅 {formatDate(horario.fecha)}</span>
                  <span>🕐 {horario.horaInicio} - {horario.horaFin}</span>
                </div>

                {/* Cupos: ocupados/capacidad (esquina inferior derecha) */}
                <div className="cupos-badge" title={`Cupos: ${(() => {
                  const occupied = tutorias.filter(t => t.horarioId === horario.id).length
                  const capacity = horario.cuposDisponibles ?? 5
                  return `${occupied}/${capacity}`
                })()}`}>
                  {(() => {
                    const occupied = tutorias.filter(t => t.horarioId === horario.id).length
                    const capacity = horario.cuposDisponibles ?? 5
                    return `${occupied}/${capacity}`
                  })()}
                </div>
              </div>
            ))}
          </div>

          {/* Sección: Tutorias agendadas (por horario) */}
          <div className="section-subheader" style={{ marginTop: '1.25rem' }}>
            <h4>Tutorías Agendadas</h4>
          </div>

          <div className="horarios-grid">
            {/* Agrupar tutorías por horarioId */}
            {(() => {
              const horarioIds = [...new Set(tutorias.map(t => t.horarioId).filter(Boolean))]
              const groups = horarioIds.map(id => {
                const horarioObj = horarios.find(h => h.id === id)
                const associatedTutorias = tutorias.filter(t => t.horarioId === id)
                return { horario: horarioObj, tutorias: associatedTutorias }
              }).filter(g => g.horario)

              if (groups.length === 0) return <p style={{ color: '#6b7280' }}>No hay tutorías agendadas por horarios.</p>

              return groups.map(({ horario, tutorias: tuts }) => {
                // Obtener el docente del horario o de la primera tutoría
                const primeraTutoria = tuts.length > 0 ? tuts[0] : null
                const docenteId = horario.docenteId || primeraTutoria?.docenteId
                const docente = docenteId ? getDocenteById(docenteId) : null
                
                // Contar estudiantes únicos (pueden estar en múltiples tutorías)
                const estudiantesUnicos = new Set()
                tuts.forEach(t => {
                  if (t.estudiantesIds && t.estudiantesIds.length > 0) {
                    t.estudiantesIds.forEach(id => estudiantesUnicos.add(id))
                  } else if (t.estudianteId) {
                    estudiantesUnicos.add(t.estudianteId)
                  }
                })
                const estudiantesCount = estudiantesUnicos.size || tuts.length
                
                return (
                  <div
                    key={horario.id}
                    className={`horario-card`}
                    onClick={() => setSelectedHorarioDetail(horario)}
                  >
                    <div className="horario-badges">
                      <span className="badge agendada">Agendada</span>
                    </div>
                    <h4>{horario.titulo || 'Sin título'}</h4>
                    <div className="horario-info">
                      <span>📅 {formatDate(horario.fecha)}</span>
                      <span>🕐 {horario.horaInicio} - {horario.horaFin}</span>
                    </div>
                    {docente && (
                      <div className="horario-info" style={{ fontSize: '0.85rem', color: '#a0a0a0', marginTop: '0.25rem' }}>
                        <span>👩‍🏫 {docente.nombre || (docente.nombres && docente.apellidos ? `${docente.nombres} ${docente.apellidos}`.trim() : 'Docente')}</span>
                      </div>
                    )}

                    {/* contador: ocupados/capacidad */}
                    <div className="cupos-badge" title={`Estudiantes agendados: ${estudiantesCount}/${horario.cuposDisponibles ?? 5}`}>
                      {`${estudiantesCount}/${horario.cuposDisponibles ?? 5}`}
                    </div>
                  </div>
                )
              })
            })()}
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
          {selectedHorarioDetail && (
            <HorarioDetailModal
              horario={selectedHorarioDetail}
              onClose={() => setSelectedHorarioDetail(null)}
              onEdit={() => { /* opcional: abrir edición */ }}
              onDelete={handleDeleteHorario}
            />
          )}
        </div>

        <div className="tutorias-section">
          <div className="section-header">
            <h3>Estudiantes agendados</h3>
          </div>

          <div className="tutorias-list">
            {(() => {
              // Obtener todos los estudiantes únicos de todas las tutorías
              const estudiantesMap = new Map()
              tutoriasAgendadas.forEach(tutoria => {
                // Si tiene lista de estudiantesIds, usar esa
                if (tutoria.estudiantesIds && tutoria.estudiantesIds.length > 0) {
                  tutoria.estudiantesIds.forEach(estId => {
                    if (!estudiantesMap.has(estId)) {
                      estudiantesMap.set(estId, {
                        estudianteId: estId,
                        tutoria: tutoria
                      })
                    }
                  })
                } else if (tutoria.estudianteId) {
                  // Si solo tiene un estudianteId, usar ese
                  if (!estudiantesMap.has(tutoria.estudianteId)) {
                    estudiantesMap.set(tutoria.estudianteId, {
                      estudianteId: tutoria.estudianteId,
                      tutoria: tutoria
                    })
                  }
                }
              })

              return Array.from(estudiantesMap.values()).map(({ estudianteId, tutoria }) => {
                const estudiante = getEstudianteById(estudianteId)
                const docente = tutoria.docenteId ? getDocenteById(tutoria.docenteId) : null
                
                if (!estudiante) return null

                return (
                  <div key={`${tutoria.id}-${estudianteId}`} className="tutoria-card">
                    <div className="tutoria-header">
                      <h4>{estudiante.nombre}</h4>
                      <span className="status-badge pending">{tutoria.estado}</span>
                    </div>
                    <p className="tutoria-tema">{tutoria.tema || 'Sin tema'}</p>
                    {docente && (
                      <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0.25rem 0' }}>
                        👩‍🏫 Docente: {docente.nombre || (docente.nombres && docente.apellidos ? `${docente.nombres} ${docente.apellidos}`.trim() : 'Docente')}
                      </p>
                    )}
                    <div className="tutoria-details">
                      <span>📅 {formatShortDate(tutoria.fecha)}</span>
                      <span>🕐 {tutoria.horaInicio}</span>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgendarTutoria




