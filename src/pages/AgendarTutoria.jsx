import React, { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import FormularioTutoria from '../components/FormularioTutoria'
import TutoriaDetailModal from '../components/TutoriaDetailModal'
import AgregarEstudianteATutoriaModal from '../components/AgregarEstudianteATutoriaModal'
import './AgendarTutoria.css'
import { ETIQUETA_SIN_ASIGNAR } from '../lib/usuarios'
import Icon from '../components/ui/Icon'
import DisponibilidadDocente from '../features/horarios/DisponibilidadDocente'
import { franjaTexto, resumenSemanal } from '../features/horarios/disponibilidad'

const SIN_DOCENTE = 'sin-docente'

const AgendarTutoria = () => {
  const { getHorariosDisponibles, tutorias, getDocenteById, loadData } = useData()
  const [selectedHorario, setSelectedHorario] = useState(null)
  const [selectedTutoria, setSelectedTutoria] = useState(null)
  const [tutoriaParaAgregarEstudiante, setTutoriaParaAgregarEstudiante] = useState(null)
  const [searchTutoriaQuery, setSearchTutoriaQuery] = useState('')
  const [searchTutoriaDate, setSearchTutoriaDate] = useState('')

  const [docenteSel, setDocenteSel] = useState('')

  // Sesiones agendables: horario disponible, de hoy en adelante y sin tutoría (una tutoría por horario).
  const ocupados = useMemo(() => new Set(tutorias.map((t) => t.horarioId)), [tutorias])
  const disponibles = getHorariosDisponibles().filter((h) => h.fecha && h.horaInicio && h.horaFin && !ocupados.has(h.id))

  // Disponibilidad agrupada por docente (ver features/horarios/disponibilidad.js: por qué no por título)
  const porDocente = useMemo(() => {
    const mapa = new Map()
    for (const h of disponibles) {
      const key = h.docenteId ? String(h.docenteId) : SIN_DOCENTE
      if (!mapa.has(key)) mapa.set(key, [])
      mapa.get(key).push({
        id: h.id, fecha: h.fecha, inicio: h.horaInicio, fin: h.horaFin, espacio: h.salon, cupos: h.cuposDisponibles, original: h,
      })
    }
    return [...mapa.entries()]
      .map(([key, sesiones]) => {
        const d = key === SIN_DOCENTE ? null : getDocenteById(Number(key))
        const nombre = key === SIN_DOCENTE
          ? 'Sin docente asignado'
          : d?.nombre || [d?.nombres, d?.apellidos].filter(Boolean).join(' ') || sesiones[0].original.docenteNombre || `Docente ${key}`
        return { key, nombre, rol: d?.rol, sesiones, resumen: resumenSemanal(sesiones) }
      })
      .sort((a, b) => (a.key === SIN_DOCENTE) - (b.key === SIN_DOCENTE) || a.nombre.localeCompare(b.nombre, 'es'))
  }, [disponibles, getDocenteById]) // eslint-disable-line react-hooks/exhaustive-deps

  const grupoSel = porDocente.find((g) => g.key === docenteSel) || null

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
            <h3 id="disp-titulo"><Icon name="calendar" size={20} className="icon--inline" />Disponibilidad por docente</h3>
            <div className="search-controls disp-picker">
              <label htmlFor="at-docente" className="disp-picker__label">Docente o tutor</label>
              <select
                id="at-docente"
                className="select disp-picker__select"
                value={docenteSel}
                onChange={(e) => setDocenteSel(e.target.value)}
              >
                <option value="">Elige un docente…</option>
                {porDocente.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.nombre} ({g.sesiones.length} {g.sesiones.length === 1 ? 'fecha' : 'fechas'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {porDocente.length === 0 ? (
            <p className="tutorias-empty">No hay horarios disponibles a partir de hoy. Publica horarios en la sección Horarios.</p>
          ) : grupoSel ? (
            <div className="disp-docente">
              <div className="disp-docente__head">
                <div>
                  <h4 className="disp-docente__nombre">{grupoSel.nombre}</h4>
                  {grupoSel.rol && <span className="disp-docente__rol">{grupoSel.rol}</span>}
                </div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDocenteSel('')}>
                  <Icon name="arrowLeft" size={16} /> Todos los docentes
                </button>
              </div>
              <DisponibilidadDocente
                sesiones={grupoSel.sesiones}
                nombre={grupoSel.nombre}
                renderAccion={(s, etiqueta) => (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => setSelectedHorario({ ...s.original, esRecurrente: false })}
                    aria-label={`Agendar el ${etiqueta}`}
                  >
                    Agendar
                  </button>
                )}
              />
            </div>
          ) : (
            <ul className="docentes-disp" aria-labelledby="disp-titulo">
              {porDocente.map((g) => (
                <li key={g.key}>
                  <button type="button" className="docente-disp" onClick={() => setDocenteSel(g.key)}>
                    <span className="docente-disp__head">
                      <span className="docente-disp__nombre">{g.nombre}</span>
                      <span className="docente-disp__cuenta">{g.sesiones.length} {g.sesiones.length === 1 ? 'fecha' : 'fechas'}</span>
                    </span>
                    <span className="docente-disp__dias">
                      {g.resumen.map(({ dia, franjas }) => (
                        <span key={dia.key} className="docente-disp__dia">
                          <strong>{dia.corto}</strong> {franjas.map((f) => franjaTexto(f.inicio, f.fin)).join(', ')}
                        </span>
                      ))}
                    </span>
                    <span className="docente-disp__cta">Ver disponibilidad <Icon name="chevronRight" size={16} /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}

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
            <h3><Icon name="book" size={20} className="icon--inline" />Tutorías Agendadas</h3>
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
              <p className="tutorias-empty">
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
                            <Icon name="plus" size={16} className="icon--inline" />Agregar Estudiante
                          </button>
                        )
                      })()}
                    </div>
                    <p className="tutoria-tema">
                      <strong>{tutoria.idioma || ''} {tutoria.nivel || ''}</strong>
                      {tutoria.tema ? ` - ${tutoria.tema}` : ''}
                    </p>
                    {tutoria.sinAsignar && (
                      <p className="tutoria-docente tutoria-sin-asignar" style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>
                        <Icon name="alert" size={16} className="icon--inline" />{ETIQUETA_SIN_ASIGNAR}
                      </p>
                    )}
                    {docente && !tutoria.sinAsignar && (
                      <p className="tutoria-docente" style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>
                        <Icon name="teacher" size={16} className="icon--inline" />Docente: {docente.nombre || (docente.nombres && docente.apellidos ? `${docente.nombres} ${docente.apellidos}`.trim() : 'Docente')}
                      </p>
                    )}
                    <div className="tutoria-details">
                      <span><Icon name="calendar" size={16} className="icon--inline" />{formatShortDate(tutoria.fecha)}</span>
                      <span><Icon name="clock" size={16} className="icon--inline" />{tutoria.horaInicio}{tutoria.horaFin ? ` - ${tutoria.horaFin}` : ''}</span>
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




