import React, { useState, useEffect } from 'react'
import { retroalimentacionService, usuarioService, tutoriaService } from '../services/apiService'
import './Retroalimentaciones.css'

const Retroalimentaciones = () => {
  const [retroalimentaciones, setRetroalimentaciones] = useState([])
  const [filteredRetroalimentaciones, setFilteredRetroalimentaciones] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [tutorias, setTutorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterType, setFilterType] = useState('todas') // 'todas', 'tutoria', 'usuario'
  const [filterValue, setFilterValue] = useState('')
  const [selectedTutoriaId, setSelectedTutoriaId] = useState('')
  const [selectedUsuarioId, setSelectedUsuarioId] = useState('')

  useEffect(() => {
    loadAllData()
  }, [])

  useEffect(() => {
    loadFilteredRetroalimentaciones()
  }, [filterType, selectedTutoriaId, selectedUsuarioId])

  useEffect(() => {
    applyTextFilter()
  }, [retroalimentaciones, filterValue])

  const loadAllData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Cargar todos los datos en paralelo
      const [retroData, usuariosData, tutoriasData] = await Promise.all([
        retroalimentacionService.getAll().catch(err => {
          console.error('Error cargando retroalimentaciones:', err)
          return []
        }),
        usuarioService.getAll().catch(err => {
          console.error('Error cargando usuarios:', err)
          return []
        }),
        tutoriaService.getAll().catch(err => {
          console.error('Error cargando tutorías:', err)
          return []
        })
      ])

      setRetroalimentaciones(Array.isArray(retroData) ? retroData : [])
      setUsuarios(Array.isArray(usuariosData) ? usuariosData : [])
      setTutorias(Array.isArray(tutoriasData) ? tutoriasData : [])
    } catch (err) {
      console.error('Error cargando datos:', err)
      setError(err.message || 'Error al cargar los datos')
      setRetroalimentaciones([])
      setUsuarios([])
      setTutorias([])
    } finally {
      setLoading(false)
    }
  }

  const loadRetroalimentaciones = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await retroalimentacionService.getAll()
      setRetroalimentaciones(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error cargando retroalimentaciones:', err)
      setError(err.message || 'Error al cargar las retroalimentaciones')
      setRetroalimentaciones([])
    } finally {
      setLoading(false)
    }
  }

  // Función auxiliar para obtener propiedades en ambos formatos (camelCase y PascalCase)
  const getProp = (obj, ...keys) => {
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key]
      const pascalKey = key.charAt(0).toUpperCase() + key.slice(1)
      if (obj[pascalKey] !== undefined) return obj[pascalKey]
    }
    return null
  }

  // Cargar retroalimentaciones según el filtro seleccionado
  const loadFilteredRetroalimentaciones = async () => {
    try {
      setLoading(true)
      setError(null)
      let data = []

      if (filterType === 'tutoria' && selectedTutoriaId) {
        // Llamar al endpoint específico para obtener retroalimentaciones por tutoría
        console.log('Cargando retroalimentaciones por tutoría:', selectedTutoriaId)
        data = await retroalimentacionService.getByTutoria(selectedTutoriaId)
      } else if (filterType === 'usuario' && selectedUsuarioId) {
        // Llamar al endpoint específico para obtener retroalimentaciones por usuario
        console.log('Cargando retroalimentaciones por usuario:', selectedUsuarioId)
        data = await retroalimentacionService.getByUsuario(selectedUsuarioId)
      } else if (filterType === 'todas') {
        // Cargar todas las retroalimentaciones
        console.log('Cargando todas las retroalimentaciones')
        data = await retroalimentacionService.getAll()
      } else {
        // Si no hay selección válida, no cargar nada nuevo
        console.log('No hay filtro válido seleccionado, manteniendo datos actuales')
        setLoading(false)
        return
      }

      console.log('Retroalimentaciones cargadas:', data)
      setRetroalimentaciones(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error cargando retroalimentaciones filtradas:', err)
      setError(err.message || 'Error al cargar las retroalimentaciones')
      setRetroalimentaciones([])
    } finally {
      setLoading(false)
    }
  }

  // Aplicar filtro de búsqueda por texto sobre las retroalimentaciones cargadas
  const applyTextFilter = () => {
    let filtered = [...retroalimentaciones]

    // Filtro de búsqueda por texto
    if (filterValue) {
      const searchLower = filterValue.toLowerCase()
      filtered = filtered.filter((r) => {
        const comentario = (getProp(r, 'comentario', 'Comentario') || '').toLowerCase()
        const usuarioNombre = (getProp(r, 'usuarioNombre', 'UsuarioNombre') || '').toLowerCase()
        const usuarioApellidos = (getProp(r, 'usuarioApellidos', 'UsuarioApellidos') || '').toLowerCase()
        const tutoriaTema = (getProp(r, 'tutoriaTema', 'TutoriaTema') || '').toLowerCase()
        // Manejar el typo del backend: tutorialdioma en lugar de tutoriaIdioma
        const tutoriaIdioma = (getProp(r, 'tutoriaIdioma', 'TutoriaIdioma', 'tutorialdioma', 'Tutorialdioma') || '').toLowerCase()
        const calificacion = String(getProp(r, 'calificacion', 'Calificacion') || '')

        return (
          comentario.includes(searchLower) ||
          usuarioNombre.includes(searchLower) ||
          usuarioApellidos.includes(searchLower) ||
          tutoriaTema.includes(searchLower) ||
          tutoriaIdioma.includes(searchLower) ||
          calificacion.includes(searchLower)
        )
      })
    }

    // Ordenar por fecha más reciente primero
    filtered.sort((a, b) => {
      const dateA = new Date(getProp(a, 'fecha', 'Fecha') || 0)
      const dateB = new Date(getProp(b, 'fecha', 'Fecha') || 0)
      return dateB - dateA
    })

    setFilteredRetroalimentaciones(filtered)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Fecha no disponible'
    try {
      const date = new Date(dateString)
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
      const day = date.getDate()
      const month = months[date.getMonth()]
      const year = date.getFullYear()
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return `${day} ${month} ${year}, ${hours}:${minutes}`
    } catch (error) {
      return dateString
    }
  }

  const renderStars = (calificacion) => {
    const rating = parseFloat(calificacion) || 0
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

    return (
      <div className="stars-container">
        {[...Array(fullStars)].map((_, i) => (
          <span key={i} className="star full">★</span>
        ))}
        {hasHalfStar && <span className="star half">★</span>}
        {[...Array(emptyStars)].map((_, i) => (
          <span key={i} className="star empty">☆</span>
        ))}
        <span className="rating-value">{rating.toFixed(2)}</span>
      </div>
    )
  }

  // Obtener usuarios y tutorías para los filtros
  // Usar la lista completa de usuarios y tutorías, no solo los que tienen retroalimentaciones
  const usuariosList = usuarios.map(u => ({
    id: getProp(u, 'idUsuario', 'id', 'IdUsuario', 'Id'),
    nombre: getProp(u, 'nombres', 'nombre', 'Nombres', 'Nombre') || '',
    apellidos: getProp(u, 'apellidos', 'apellido', 'Apellidos', 'Apellido') || '',
    nombreCompleto: `${getProp(u, 'nombres', 'nombre', 'Nombres', 'Nombre') || ''} ${getProp(u, 'apellidos', 'apellido', 'Apellidos', 'Apellido') || ''}`.trim()
  })).filter(u => u.id)

  const tutoriasList = tutorias.map(t => ({
    id: getProp(t, 'idTutoria', 'id', 'IdTutoria', 'Id'),
    tema: getProp(t, 'tema', 'Tema') || 'Sin tema',
    idioma: getProp(t, 'idioma', 'Idioma') || '',
    nivel: getProp(t, 'nivel', 'Nivel') || ''
  })).filter(t => t.id)

  if (loading) {
    return (
      <div className="retroalimentaciones-page">
        <div className="page-header">
          <h1>Retroalimentaciones</h1>
          <p>Cargando retroalimentaciones...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="retroalimentaciones-page">
        <div className="page-header">
          <h1>Retroalimentaciones</h1>
          <div className="error-message">
            <h3>Error al cargar datos</h3>
            <p>{error}</p>
            <button className="btn-primary" onClick={loadRetroalimentaciones}>
              Reintentar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="retroalimentaciones-page">
      <div className="page-header">
        <div>
          <h1>Retroalimentaciones</h1>
          <p>Gestiona y visualiza todas las retroalimentaciones de tutorías y usuarios</p>
        </div>
        <button className="btn-primary" onClick={loadRetroalimentaciones}>
          🔄 Actualizar
        </button>
      </div>

      <div className="filters-section">
        <div className="filters-row">
          <div className="filter-group">
            <label htmlFor="filterType">Filtrar por:</label>
            <select
              id="filterType"
              value={filterType}
              onChange={(e) => {
                const newFilterType = e.target.value
                setFilterType(newFilterType)
                setSelectedTutoriaId('')
                setSelectedUsuarioId('')
                // Si se cambia a "todas", cargar todas las retroalimentaciones inmediatamente
                if (newFilterType === 'todas') {
                  loadRetroalimentaciones()
                }
              }}
              className="filter-select"
            >
              <option value="todas">Todas las retroalimentaciones</option>
              <option value="tutoria">Por Tutoría</option>
              <option value="usuario">Por Usuario</option>
            </select>
          </div>

          {filterType === 'tutoria' && (
            <div className="filter-group">
              <label htmlFor="tutoriaFilter">Tutoría:</label>
              <select
                id="tutoriaFilter"
                value={selectedTutoriaId}
                onChange={(e) => setSelectedTutoriaId(e.target.value)}
                className="filter-select"
              >
                <option value="">Seleccionar tutoría</option>
                {tutoriasList.map((tutoria) => (
                  <option key={tutoria.id} value={tutoria.id}>
                    ID: {tutoria.id} - {tutoria.idioma} - {tutoria.tema}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterType === 'usuario' && (
            <div className="filter-group">
              <label htmlFor="usuarioFilter">Usuario:</label>
              <select
                id="usuarioFilter"
                value={selectedUsuarioId}
                onChange={(e) => setSelectedUsuarioId(e.target.value)}
                className="filter-select"
              >
                <option value="">Seleccionar usuario</option>
                {usuariosList.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    ID: {usuario.id} - {usuario.nombreCompleto || `${usuario.nombre} ${usuario.apellidos}`.trim() || 'Sin nombre'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-group search-group">
            <label htmlFor="searchFilter">Buscar:</label>
            <input
              id="searchFilter"
              type="text"
              placeholder="Buscar en comentarios, usuarios, tutorías..."
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </div>

      <div className="stats-section">
        <div className="stat-card">
          <div className="stat-value">{retroalimentaciones.length}</div>
          <div className="stat-label">Total Retroalimentaciones</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{filteredRetroalimentaciones.length}</div>
          <div className="stat-label">Mostrando</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {retroalimentaciones.length > 0
              ? (
                  retroalimentaciones.reduce((sum, r) => sum + (parseFloat(getProp(r, 'calificacion', 'Calificacion')) || 0), 0) /
                  retroalimentaciones.length
                ).toFixed(2)
              : '0.00'}
          </div>
          <div className="stat-label">Calificación Promedio</div>
        </div>
      </div>

      <div className="retroalimentaciones-list">
        {filteredRetroalimentaciones.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>No se encontraron retroalimentaciones</h3>
            <p>
              {filterType !== 'todas' || filterValue
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'Aún no hay retroalimentaciones registradas en el sistema'}
            </p>
          </div>
        ) : (
          filteredRetroalimentaciones.map((retro) => {
            const idRetro = getProp(retro, 'idRetroalimentacion', 'id', 'IdRetroalimentacion', 'Id')
            const usuarioNombre = getProp(retro, 'usuarioNombre', 'UsuarioNombre') || ''
            const usuarioApellidos = getProp(retro, 'usuarioApellidos', 'UsuarioApellidos') || ''
            const usuarioId = getProp(retro, 'usuarioIdUsuario', 'usuarioId', 'UsuarioIdUsuario', 'UsuarioId')
            const fecha = getProp(retro, 'fecha', 'Fecha')
            // Manejar el typo del backend: tutorialdioma en lugar de tutoriaIdioma
            const tutoriaIdioma = getProp(retro, 'tutoriaIdioma', 'TutoriaIdioma', 'tutorialdioma', 'Tutorialdioma') || 'N/A'
            const tutoriaTema = getProp(retro, 'tutoriaTema', 'TutoriaTema') || 'Sin tema'
            const tutoriaId = getProp(retro, 'tutoriaIdTutoria', 'tutoriaId', 'TutoriaIdTutoria', 'TutoriaId')
            const calificacion = getProp(retro, 'calificacion', 'Calificacion')
            const comentario = getProp(retro, 'comentario', 'Comentario') || 'Sin comentario'

            return (
              <div key={idRetro} className="retroalimentacion-card">
                <div className="retroalimentacion-header">
                  <div className="retroalimentacion-user">
                    <div className="user-avatar">
                      {(usuarioNombre[0] || 'U').toUpperCase()}
                    </div>
                    <div className="user-info">
                      <h3>
                        {usuarioNombre} {usuarioApellidos}
                      </h3>
                      <p className="user-id">ID Usuario: {usuarioId}</p>
                    </div>
                  </div>
                  <div className="retroalimentacion-date">
                    {formatDate(fecha)}
                  </div>
                </div>

                <div className="retroalimentacion-tutoria">
                  <div className="tutoria-badge">
                    <span className="badge-label">Tutoría:</span>
                    <span className="badge-value">
                      {tutoriaIdioma} - {tutoriaTema}
                    </span>
                  </div>
                  <span className="tutoria-id">ID: {tutoriaId}</span>
                </div>

                <div className="retroalimentacion-rating">
                  {renderStars(calificacion)}
                </div>

                <div className="retroalimentacion-comment">
                  <p>{comentario}</p>
                </div>

                <div className="retroalimentacion-footer">
                  <span className="retro-id">ID Retroalimentación: {idRetro}</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default Retroalimentaciones

