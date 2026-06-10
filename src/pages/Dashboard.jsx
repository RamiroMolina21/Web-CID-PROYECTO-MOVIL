import React, { useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { metricasService, encuestaService } from '../services/apiService'
import { PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './Dashboard.css'

const Dashboard = () => {
  const { isDark } = useTheme()
  const {
    getTutoriasHoy,
    getHorariosDisponibles,
    estudiantes,
    docentes,
    tutorias,
    loading,
    error
  } = useData()

  const [metricas, setMetricas] = useState(null)
  const [loadingMetricas, setLoadingMetricas] = useState(true)
  const [errorMetricas, setErrorMetricas] = useState(null)
  const [estadisticasEncuesta, setEstadisticasEncuesta] = useState(null)

  useEffect(() => {
    loadMetricas()
    loadEstadisticasEncuesta()
  }, [])

  const loadMetricas = async () => {
    try {
      setLoadingMetricas(true)
      setErrorMetricas(null)
      const data = await metricasService.getGenerales()
      setMetricas(data)
    } catch (err) {
      setErrorMetricas(err.message || 'Error al cargar las métricas')
    } finally {
      setLoadingMetricas(false)
    }
  }

  const loadEstadisticasEncuesta = async () => {
    try {
      const data = await encuestaService.getEstadisticas()
      setEstadisticasEncuesta(data)
    } catch (err) {
      console.error('Error cargando estadísticas de encuestas:', err)
    }
  }

  const tutoriasHoy = getTutoriasHoy()
  const horariosDisponibles = getHorariosDisponibles()

  const tutoriasFinalizadas = tutorias.filter(t => {
    const estado = (t.estado || '').toLowerCase()
    return estado === 'finalizada' || estado === 'completada' || estado === 'finalizado' || estado === 'completado'
  })

  const usuariosRecientes = [
    ...(Array.isArray(estudiantes) ? [...estudiantes].reverse() : []),
    ...(Array.isArray(docentes) ? [...docentes].reverse() : [])
  ]

  const getInitials = (name) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  // Agrupar tutorías finalizadas por mes (últimos 6)
  const tutoriasPorMes = (() => {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const conteo = {}
    tutoriasFinalizadas.forEach(t => {
      if (!t.fecha) return
      const d = new Date(t.fecha + 'T00:00:00')
      const clave = `${d.getFullYear()}-${d.getMonth()}`
      conteo[clave] = (conteo[clave] || 0) + 1
    })
    const hoy = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1)
      const clave = `${d.getFullYear()}-${d.getMonth()}`
      return { mes: meses[d.getMonth()], cantidad: conteo[clave] || 0 }
    })
  })()

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dash-header">
          <h1>Dashboard</h1>
          <p>Cargando datos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="dash-header">
          <h1>Dashboard</h1>
          <div className="dash-error-box">
            <h3>Error al cargar datos</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  const promCalif = estadisticasEncuesta?.promedioCalificacion || 0
  const estrellas = Math.round(promCalif)
  const tasaResp = estadisticasEncuesta?.tasaRespuesta || 0

  const chartGrid = isDark ? '#334155' : '#f0f0f0'
  const chartTick = isDark ? '#94a3b8' : '#9ca3af'
  const tooltipStyle = {
    borderRadius: '8px',
    border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f1f5f9' : '#111827',
    fontSize: '13px',
  }

  return (
    <div className="dashboard">

      {/* ── Encabezado ─────────────────────────────────── */}
      <div className="dash-header">
        <div>
          <h1>Dashboard</h1>
          <p>Resumen general del sistema de tutorías</p>
        </div>
        <button className="dash-refresh-btn" onClick={() => { loadMetricas(); loadEstadisticasEncuesta() }}>
          🔄 Actualizar
        </button>
      </div>

      {/* ── KPIs principales ───────────────────────────── */}
      <div className="kpi-grid">

        <div className="kpi-card kpi-purple">
          <div className="kpi-top">
            <span className="kpi-icon">📅</span>
            <span className="kpi-label">Tutorías Hoy</span>
          </div>
          <div className="kpi-number">{tutoriasHoy.length}</div>
          <div className="kpi-sub">programadas para hoy</div>
        </div>

        <div className="kpi-card kpi-blue">
          <div className="kpi-top">
            <span className="kpi-icon">📚</span>
            <span className="kpi-label">Total Tutorías</span>
          </div>
          <div className="kpi-number">{tutorias.length}</div>
          <div className="kpi-sub">{tutoriasFinalizadas.length} finalizadas</div>
        </div>

        <div className="kpi-card kpi-green">
          <div className="kpi-top">
            <span className="kpi-icon">🕐</span>
            <span className="kpi-label">Horarios Disponibles</span>
          </div>
          <div className="kpi-number">{horariosDisponibles.length}</div>
          <div className="kpi-sub">listos para agendar</div>
        </div>

        <div className="kpi-card kpi-orange">
          <div className="kpi-top">
            <span className="kpi-icon">👥</span>
            <span className="kpi-label">Usuarios</span>
          </div>
          <div className="kpi-number">{estudiantes.length + docentes.length}</div>
          <div className="kpi-sub">{docentes.length} docentes · {estudiantes.length} estudiantes</div>
        </div>

        {/* Tarjeta de satisfacción */}
        <div className="kpi-card kpi-amber">
          <div className="kpi-top">
            <span className="kpi-icon">⭐</span>
            <span className="kpi-label">Satisfacción</span>
          </div>
          {estadisticasEncuesta && promCalif > 0 ? (
            <>
              <div className="kpi-number kpi-stars-number">{promCalif.toFixed(1)}<span className="kpi-outof">/5</span></div>
              <div className="kpi-stars">
                {[1,2,3,4,5].map(i => (
                  <span key={i} style={{ color: i <= estrellas ? '#f59e0b' : '#d1d5db', fontSize: '16px' }}>★</span>
                ))}
              </div>
              <div className="kpi-progress-wrap">
                <div className="kpi-progress-bar" style={{ width: `${tasaResp}%` }} />
              </div>
              <div className="kpi-sub">
                {estadisticasEncuesta.totalRespondidas}/{estadisticasEncuesta.totalEnviadas} respondidas ({tasaResp}%)
              </div>
            </>
          ) : (
            <>
              <div className="kpi-number" style={{ color: '#9ca3af' }}>—</div>
              <div className="kpi-sub">sin encuestas respondidas</div>
            </>
          )}
        </div>

      </div>

      {/* ── Gráfica mensual + Usuarios recientes ───────── */}
      <div className="dash-mid-grid">

        <div className="dash-card">
          <div className="dash-card-header">
            <h3>Tutorías Finalizadas</h3>
            <span className="dash-card-badge">{tutoriasFinalizadas.length} en total</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={tutoriasPorMes} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradTutorias" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: chartTick }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: chartTick }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(val) => [`${val} tutoría${val !== 1 ? 's' : ''}`, 'Finalizadas']}
              />
              <Area
                type="monotone"
                dataKey="cantidad"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                fill="url(#gradTutorias)"
                dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#6366f1' }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <p className="dash-card-footer">Últimos 6 meses</p>
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <h3>Usuarios Recientes</h3>
          </div>
          <div className="users-list">
            {usuariosRecientes.length > 0 ? usuariosRecientes.map((u) => (
              <div key={u.id} className="user-row">
                <div className="user-avatar">{getInitials(u.nombre)}</div>
                <div className="user-info">
                  <span className="user-name">{u.nombre}</span>
                  <span className="user-email">{u.email || u.correo || '—'}</span>
                </div>
                <span className="user-rol-badge">{u.rol || 'Usuario'}</span>
              </div>
            )) : (
              <p className="empty-msg">No hay usuarios recientes</p>
            )}
          </div>
        </div>

      </div>

      {/* ── Métricas detalladas ─────────────────────────── */}
      <div className="dash-card dash-metrics-card">
        <div className="dash-card-header">
          <h3>Métricas Detalladas</h3>
          <button className="dash-sm-btn" onClick={loadMetricas} disabled={loadingMetricas}>
            {loadingMetricas ? '⏳ Cargando...' : '🔄 Actualizar'}
          </button>
        </div>

        {loadingMetricas ? (
          <p className="empty-msg">Cargando métricas...</p>
        ) : errorMetricas ? (
          <div className="dash-error-inline">
            <p>{errorMetricas}</p>
            <button className="dash-sm-btn" onClick={loadMetricas}>Reintentar</button>
          </div>
        ) : metricas ? (
          <>
            {/* Resumen numérico en fila */}
            <div className="metrics-strip">
              <div className="mstrip-item">
                <span className="mstrip-val">{metricas.totalTutorias || 0}</span>
                <span className="mstrip-label">Total Tutorías</span>
              </div>
              <div className="mstrip-divider" />
              <div className="mstrip-item">
                <span className="mstrip-val green">{metricas.tutoriasCompletadas || 0}</span>
                <span className="mstrip-label">Completadas</span>
              </div>
              <div className="mstrip-divider" />
              <div className="mstrip-item">
                <span className="mstrip-val purple">{metricas.tutoriasProgramadas || 0}</span>
                <span className="mstrip-label">Programadas</span>
              </div>
              <div className="mstrip-divider" />
              <div className="mstrip-item">
                <span className="mstrip-val red">{metricas.tutoriasCanceladas || 0}</span>
                <span className="mstrip-label">Canceladas</span>
              </div>
              <div className="mstrip-divider" />
              <div className="mstrip-item">
                <span className="mstrip-val">{metricas.totalUsuarios || 0}</span>
                <span className="mstrip-label">Usuarios</span>
              </div>
              <div className="mstrip-divider" />
              <div className="mstrip-item">
                <span className="mstrip-val yellow">
                  {metricas.promedioCalificacion ? metricas.promedioCalificacion.toFixed(1) : '—'}
                </span>
                <span className="mstrip-label">Calif. Promedio</span>
              </div>
            </div>

            {/* Gráficas */}
            <div className="charts-row">

              <div className="chart-panel">
                <h4>Estados de Tutorías</h4>
                <p className="chart-sub">Distribución por estado</p>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Completadas', value: metricas.tutoriasCompletadas || 0 },
                        { name: 'Programadas', value: metricas.tutoriasProgramadas || 0 },
                        { name: 'Canceladas',  value: metricas.tutoriasCanceladas  || 0 },
                      ]}
                      cx="50%" cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      labelLine={false}
                      label={({ name, percent }) =>
                        percent > 0 ? `${(percent * 100).toFixed(0)}%` : ''
                      }
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#8b5cf6" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ color: isDark ? '#f1f5f9' : '#111827' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-panel">
                <h4>Distribución de Usuarios</h4>
                <p className="chart-sub">Docentes vs Estudiantes</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={[
                      { name: 'Docentes',    cantidad: metricas.totalDocentes    || 0 },
                      { name: 'Estudiantes', cantidad: metricas.totalEstudiantes || 0 },
                    ]}
                    margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                    <XAxis dataKey="name" tick={{ fontSize: 13, fill: chartTick }} />
                    <YAxis tick={{ fontSize: 13, fill: chartTick }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="cantidad" radius={[8, 8, 0, 0]} name="Cantidad">
                      <Cell fill="#8b5cf6" />
                      <Cell fill="#6366f1" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-panel">
                <h4>Gestión de Horarios</h4>
                <p className="chart-sub">Disponibles vs Ocupados</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={[{
                      name: 'Horarios',
                      Disponibles: metricas.horariosDisponibles || 0,
                      Ocupados: (metricas.totalHorarios || 0) - (metricas.horariosDisponibles || 0),
                    }]}
                    margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                    <XAxis dataKey="name" tick={{ fontSize: 13, fill: chartTick }} />
                    <YAxis tick={{ fontSize: 13, fill: chartTick }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ color: isDark ? '#f1f5f9' : '#111827' }} />
                    <Bar dataKey="Disponibles" fill="#10b981" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Ocupados"    fill="#94a3b8" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>
          </>
        ) : null}
      </div>

    </div>
  )
}

export default Dashboard
