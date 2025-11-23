import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { metricasService } from '../services/apiService'
import './Dashboard.css'

const Dashboard = () => {
  const navigate = useNavigate()
  const {
    getTutoriasHoy,
    getHorariosDisponibles,
    estudiantes,
    docentes,
    tutorias,
    getProximasTutorias,
    getEstudiantesRecientes,
    getEstudianteById,
    loading,
    error
  } = useData()

  const [metricas, setMetricas] = useState(null)
  const [loadingMetricas, setLoadingMetricas] = useState(true)
  const [errorMetricas, setErrorMetricas] = useState(null)

  useEffect(() => {
    loadMetricas()
  }, [])

  const loadMetricas = async () => {
    try {
      setLoadingMetricas(true)
      setErrorMetricas(null)
      const data = await metricasService.getGenerales()
      setMetricas(data)
    } catch (err) {
      console.error('Error cargando métricas:', err)
      setErrorMetricas(err.message || 'Error al cargar las métricas')
    } finally {
      setLoadingMetricas(false)
    }
  }

  const tutoriasHoy = getTutoriasHoy()
  const horariosDisponibles = getHorariosDisponibles()
  const proximasTutorias = getProximasTutorias()
  const estudiantesRecientes = getEstudiantesRecientes()
  
  // Combinar estudiantes y docentes para mostrar usuarios recientes
  const usuariosRecientes = [
    ...(Array.isArray(estudiantes) ? estudiantes.slice(-3).reverse() : []),
    ...(Array.isArray(docentes) ? docentes.slice(-2).reverse() : [])
  ].slice(0, 5) // Mostrar máximo 5 usuarios

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
  }

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
          <p>Cargando datos desde la API...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
          <div style={{ 
            padding: '20px', 
            background: '#fee', 
            border: '1px solid #fcc', 
            borderRadius: '8px',
            color: '#c33',
            marginTop: '20px'
          }}>
            <h3>Error al cargar datos</h3>
            <p><strong>Error:</strong> {error}</p>
            <p style={{ marginTop: '10px', fontSize: '14px' }}>
              <strong>Posibles soluciones:</strong>
            </p>
            <ul style={{ marginTop: '10px', paddingLeft: '20px', textAlign: 'left' }}>
              <li><strong>Verifica que tu API .NET esté corriendo</strong> en el puerto 5208</li>
              <li><strong>Verifica la configuración de ngrok:</strong> Debe estar redirigiendo a <code>http://localhost:5208</code> (no https://)</li>
              <li><strong>Comando correcto de ngrok:</strong> <code>ngrok http 5208</code> o <code>ngrok http http://localhost:5208</code></li>
              <li><strong>Verifica CORS en tu API .NET:</strong> Debe permitir requests desde <code>http://localhost:5173</code></li>
              <li>Revisa la consola del navegador (F12) para más detalles del error</li>
              <li>Revisa los logs de ngrok para ver los errores 502</li>
            </ul>
            <div style={{ marginTop: '15px', padding: '10px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}>
              <strong>💡 Tip:</strong> Si ves errores 502 en ngrok, significa que ngrok está recibiendo las peticiones pero no puede conectarse a tu API .NET. 
              Asegúrate de que tu API .NET esté corriendo antes de iniciar ngrok.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Bienvenido al sistema de gestión de tutorías</p>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-content">
            <div>
              <p className="metric-label">Tutorías Hoy</p>
              <h2 className="metric-value">{tutoriasHoy.length}</h2>
            </div>
            <div className="metric-icon purple">
              📅
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-content">
            <div>
              <p className="metric-label">Horarios Disponibles</p>
              <h2 className="metric-value">{horariosDisponibles.length}</h2>
            </div>
            <div className="metric-icon green">
              🕐
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-content">
            <div>
              <p className="metric-label">Total Estudiantes</p>
              <h2 className="metric-value">{estudiantes.length}</h2>
            </div>
            <div className="metric-icon orange">
              👥
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-content">
            <div>
              <p className="metric-label">Total Tutorías</p>
              <h2 className="metric-value">{tutorias.length}</h2>
            </div>
            <div className="metric-icon blue">
              ✓
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-section">
          <div className="section-header">
            <h3>Próximas Tutorías ↗</h3>
            <button className="btn-primary" onClick={() => navigate('/agendar-tutoria')}>
              Agendar Nueva
            </button>
          </div>

          <div className="tutorias-list">
            {proximasTutorias.map((tutoria) => {
              const estudiante = getEstudianteById(tutoria.estudianteId)
              if (!estudiante) return null
              
              return (
                <div key={tutoria.id} className="tutoria-card">
                  <div className="tutoria-info">
                    <h4>{estudiante.nombre}</h4>
                    <p className="tutoria-tema">{tutoria.tema}</p>
                    <div className="tutoria-details">
                      <span>📅 {formatDate(tutoria.fecha)}</span>
                      <span>🕐 {tutoria.horaInicio} - {tutoria.horaFin}</span>
                    </div>
                  </div>
                  <span className="status-badge pending">{tutoria.estado}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <h3>Usuarios Recientes 👥</h3>
          </div>

          <div className="estudiantes-list">
            {usuariosRecientes.length > 0 ? (
              usuariosRecientes.map((usuario) => (
                <div key={usuario.id} className="estudiante-card">
                  <div className="estudiante-avatar">
                    {getInitials(usuario.nombre)}
                  </div>
                  <div className="estudiante-info">
                    <h4>{usuario.nombre}</h4>
                    <p>{usuario.email || usuario.correo || 'Sin email'}</p>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                No hay usuarios recientes
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Sección de Métricas */}
      <div className="metricas-section">
        <div className="section-header">
          <h3>Métricas 📊</h3>
          <button className="btn-secondary" onClick={loadMetricas} disabled={loadingMetricas}>
            {loadingMetricas ? '⏳' : '🔄'} {loadingMetricas ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>

        {loadingMetricas ? (
          <div className="metricas-loading">
            <p>Cargando métricas...</p>
          </div>
        ) : errorMetricas ? (
          <div className="metricas-error">
            <p>Error al cargar métricas: {errorMetricas}</p>
            <button className="btn-primary" onClick={loadMetricas}>
              Reintentar
            </button>
          </div>
        ) : metricas ? (
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-content">
                <div>
                  <p className="metric-label">Total Tutorías</p>
                  <h2 className="metric-value">{metricas.totalTutorias || 0}</h2>
                </div>
                <div className="metric-icon blue">
                  📚
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-content">
                <div>
                  <p className="metric-label">Tutorías Completadas</p>
                  <h2 className="metric-value">{metricas.tutoriasCompletadas || 0}</h2>
                </div>
                <div className="metric-icon green">
                  ✅
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-content">
                <div>
                  <p className="metric-label">Tutorías Canceladas</p>
                  <h2 className="metric-value">{metricas.tutoriasCanceladas || 0}</h2>
                </div>
                <div className="metric-icon red">
                  ❌
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-content">
                <div>
                  <p className="metric-label">Tutorías Programadas</p>
                  <h2 className="metric-value">{metricas.tutoriasProgramadas || 0}</h2>
                </div>
                <div className="metric-icon purple">
                  📅
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-content">
                <div>
                  <p className="metric-label">Promedio Calificación</p>
                  <h2 className="metric-value">
                    {metricas.promedioCalificacion 
                      ? metricas.promedioCalificacion.toFixed(2) 
                      : '0.00'}
                  </h2>
                </div>
                <div className="metric-icon yellow">
                  ⭐
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-content">
                <div>
                  <p className="metric-label">Total Usuarios</p>
                  <h2 className="metric-value">{metricas.totalUsuarios || 0}</h2>
                </div>
                <div className="metric-icon orange">
                  👥
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-content">
                <div>
                  <p className="metric-label">Total Docentes</p>
                  <h2 className="metric-value">{metricas.totalDocentes || 0}</h2>
                </div>
                <div className="metric-icon purple">
                  👩‍🏫
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-content">
                <div>
                  <p className="metric-label">Total Estudiantes</p>
                  <h2 className="metric-value">{metricas.totalEstudiantes || 0}</h2>
                </div>
                <div className="metric-icon blue">
                  🎓
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-content">
                <div>
                  <p className="metric-label">Total Horarios</p>
                  <h2 className="metric-value">{metricas.totalHorarios || 0}</h2>
                </div>
                <div className="metric-icon green">
                  🕐
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-content">
                <div>
                  <p className="metric-label">Horarios Disponibles</p>
                  <h2 className="metric-value">{metricas.horariosDisponibles || 0}</h2>
                </div>
                <div className="metric-icon green">
                  ✓
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default Dashboard
