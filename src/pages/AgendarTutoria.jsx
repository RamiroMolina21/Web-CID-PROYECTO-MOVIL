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

  const horariosDisponibles = getHorariosDisponibles()
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

  const tutoriasAgendadas = tutorias
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
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha)
      return a.horaInicio.localeCompare(b.horaInicio)
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
                      <button
                        className="tutoria-agregar-estudiante-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setTutoriaParaAgregarEstudiante(tutoria)
                        }}
                        title="Agregar estudiante"
                      >
                        ➕ Agregar Estudiante
                      </button>
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




