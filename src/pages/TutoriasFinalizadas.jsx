import React, { useState, useEffect } from 'react'
import { tutoriaService } from '../services/apiService'
import { useData } from '../context/DataContext'
import TutoriaFinalizadaDetailModal from '../components/TutoriaFinalizadaDetailModal'
import './TutoriasFinalizadas.css'

const TutoriasFinalizadas = () => {
  const { tutorias: tutoriasContext, loading: contextLoading } = useData()
  const [tutoriasFinalizadas, setTutoriasFinalizadas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTutoria, setSelectedTutoria] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadTutoriasFinalizadas()
  }, [])

  const loadTutoriasFinalizadas = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await tutoriaService.getAll()
      
      // Filtrar tutorías con estado "Finalizada" o "Completada"
      const finalizadas = Array.isArray(data) 
        ? data.filter(t => {
            const estado = t.estado || t.Estado || ''
            return estado.toLowerCase() === 'finalizada' || 
                   estado.toLowerCase() === 'completada' ||
                   estado.toLowerCase() === 'completa'
          })
        : []
      
      setTutoriasFinalizadas(finalizadas)
    } catch (err) {
      console.error('Error cargando tutorías finalizadas:', err)
      setError(err.message || 'Error al cargar las tutorías finalizadas')
      setTutoriasFinalizadas([])
    } finally {
      setLoading(false)
    }
  }

  // Función auxiliar para obtener propiedades
  const getProp = (obj, ...keys) => {
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key]
      const pascalKey = key.charAt(0).toUpperCase() + key.slice(1)
      if (obj[pascalKey] !== undefined) return obj[pascalKey]
    }
    return null
  }

  const filteredTutorias = tutoriasFinalizadas.filter(tutoria => {
    if (!searchQuery) return true
    
    const query = searchQuery.toLowerCase()
    const tema = (getProp(tutoria, 'tema', 'Tema') || '').toLowerCase()
    const idioma = (getProp(tutoria, 'idioma', 'Idioma') || '').toLowerCase()
    const nivel = (getProp(tutoria, 'nivel', 'Nivel') || '').toLowerCase()
    const modalidad = (getProp(tutoria, 'modalidad', 'Modalidad') || '').toLowerCase()
    const usuarioNombre = (getProp(tutoria, 'usuarioNombre', 'UsuarioNombre') || '').toLowerCase()
    
    return (
      tema.includes(query) ||
      idioma.includes(query) ||
      nivel.includes(query) ||
      modalidad.includes(query) ||
      usuarioNombre.includes(query)
    )
  })

  const formatDate = (dateString) => {
    if (!dateString) return 'Fecha no disponible'
    try {
      const date = new Date(dateString)
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                     'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
      return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`
    } catch (error) {
      return dateString
    }
  }

  if (loading) {
    return (
      <div className="tutorias-finalizadas-page">
        <div className="page-header">
          <h1>Tutorías Finalizadas</h1>
          <p>Cargando tutorías finalizadas...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="tutorias-finalizadas-page">
        <div className="page-header">
          <h1>Tutorías Finalizadas</h1>
          <div className="error-message">
            <h3>Error al cargar datos</h3>
            <p>{error}</p>
            <button className="btn-primary" onClick={loadTutoriasFinalizadas}>
              Reintentar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="tutorias-finalizadas-page">
      <div className="page-header">
        <div>
          <h1>Tutorías Finalizadas</h1>
          <p>Visualiza y gestiona todas las tutorías que han sido finalizadas</p>
        </div>
        <button className="btn-primary" onClick={loadTutoriasFinalizadas}>
          🔄 Actualizar
        </button>
      </div>

      <div className="search-section">
        <div className="search-group">
          <label htmlFor="searchInput">Buscar:</label>
          <input
            id="searchInput"
            type="text"
            placeholder="Buscar por tema, idioma, nivel, modalidad o docente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="stats-section">
        <div className="stat-card">
          <div className="stat-value">{tutoriasFinalizadas.length}</div>
          <div className="stat-label">Total Tutorías Finalizadas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{filteredTutorias.length}</div>
          <div className="stat-label">Mostrando</div>
        </div>
      </div>

      <div className="tutorias-list">
        {filteredTutorias.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <h3>No se encontraron tutorías finalizadas</h3>
            <p>
              {searchQuery
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'Aún no hay tutorías finalizadas en el sistema'}
            </p>
          </div>
        ) : (
          filteredTutorias.map((tutoria) => {
            const id = getProp(tutoria, 'idTutoria', 'id', 'IdTutoria', 'Id')
            const tema = getProp(tutoria, 'tema', 'Tema') || 'Sin tema'
            const idioma = getProp(tutoria, 'idioma', 'Idioma') || ''
            const nivel = getProp(tutoria, 'nivel', 'Nivel') || ''
            const modalidad = getProp(tutoria, 'modalidad', 'Modalidad') || ''
            const fechaTutoria = getProp(tutoria, 'fechaTutoria', 'fecha', 'FechaTutoria', 'Fecha')
            const usuarioNombre = getProp(tutoria, 'usuarioNombre', 'UsuarioNombre') || ''
            const usuarioApellidos = getProp(tutoria, 'usuarioApellidos', 'UsuarioApellidos') || ''
            const horarioEspacio = getProp(tutoria, 'horarioEspacio', 'HorarioEspacio', 'espacio', 'Espacio') || ''
            const horarioHoraInicio = getProp(tutoria, 'horarioHoraInicio', 'HorarioHoraInicio', 'horaInicio', 'HoraInicio')
            const horarioHoraFin = getProp(tutoria, 'horarioHoraFin', 'HorarioHoraFin', 'horaFin', 'HoraFin')
            const estudiantes = getProp(tutoria, 'estudiantes', 'Estudiantes') || []

            return (
              <div 
                key={id} 
                className="tutoria-card"
                onClick={() => setSelectedTutoria(tutoria)}
              >
                <div className="tutoria-card-header">
                  <div className="tutoria-card-title-section">
                    <h3>{tema}</h3>
                    <p className="tutoria-card-subtitle">
                      {idioma} - {nivel}
                    </p>
                  </div>
                  <div className="tutoria-card-status">
                    <span className="status-badge finalizada">Finalizada</span>
                  </div>
                </div>

                <div className="tutoria-card-body">
                  <div className="tutoria-card-info">
                    <div className="info-item">
                      <span className="info-icon">📅</span>
                      <span>{formatDate(fechaTutoria)}</span>
                    </div>
                    {horarioHoraInicio && horarioHoraFin && (
                      <div className="info-item">
                        <span className="info-icon">🕐</span>
                        <span>
                          {new Date(horarioHoraInicio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - 
                          {new Date(horarioHoraFin).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                    <div className="info-item">
                      <span className="info-icon">📍</span>
                      <span>{modalidad}</span>
                    </div>
                    {horarioEspacio && (
                      <div className="info-item">
                        <span className="info-icon">🏢</span>
                        <span>{horarioEspacio}</span>
                      </div>
                    )}
                    {usuarioNombre && (
                      <div className="info-item">
                        <span className="info-icon">👩‍🏫</span>
                        <span>{usuarioNombre} {usuarioApellidos}</span>
                      </div>
                    )}
                    {Array.isArray(estudiantes) && estudiantes.length > 0 && (
                      <div className="info-item">
                        <span className="info-icon">👥</span>
                        <span>{estudiantes.length} estudiante{estudiantes.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {selectedTutoria && (
        <TutoriaFinalizadaDetailModal
          tutoria={selectedTutoria}
          onClose={() => setSelectedTutoria(null)}
        />
      )}
    </div>
  )
}

export default TutoriasFinalizadas


