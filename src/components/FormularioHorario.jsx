import React, { useState } from 'react'
import { useData } from '../context/DataContext'
import TimePicker from './TimePicker'
import './FormularioHorario.css'

const FormularioHorario = ({ horario, onClose, onSave }) => {
  const { addHorario, updateHorario, horarios, docentes } = useData()
  const [error, setError] = useState('')
  const [isRecurrente, setIsRecurrente] = useState(false)
  const [diasSeleccionados, setDiasSeleccionados] = useState({
    lunes: false,
    martes: false,
    miercoles: false,
    jueves: false,
    viernes: false,
    sabado: false,
    domingo: false
  })
  const [formData, setFormData] = useState({
    titulo: horario?.titulo || '',
    docenteId: horario?.docenteId || '',
    fecha: horario?.fecha || '',
    fechaFin: horario?.fechaFin || horario?.fecha || '',
    horaInicio: horario?.horaInicio || '',
    horaFin: horario?.horaFin || '',
    cuposDisponibles: horario?.cuposDisponibles || 5, // Valor por defecto: 5 cupos
    salon: horario?.salon || '',
    notas: horario?.notas || '',
    disponible: true // Siempre disponible por defecto
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleDiaChange = (dia) => {
    setDiasSeleccionados(prev => ({
      ...prev,
      [dia]: !prev[dia]
    }))
  }

  // Función para obtener el nombre del día de la semana en español
  const getDiaSemana = (fecha) => {
    const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
    return dias[fecha.getDay()]
  }

  // Función para generar fechas basadas en días seleccionados
  const generarFechasRecurrentes = () => {
    const fechas = []
    const currentDate = new Date(formData.fecha + 'T00:00:00')
    const endDate = new Date(formData.fechaFin + 'T00:00:00')
    
    while (currentDate <= endDate) {
      const diaSemana = getDiaSemana(currentDate)
      if (diasSeleccionados[diaSemana]) {
        fechas.push(currentDate.toISOString().split('T')[0])
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return fechas
  }

  const checkConflict = (fecha, horaInicio, horaFin) => {
    const dateStr = fecha
    const [startHour, startMin] = horaInicio.split(':').map(Number)
    const [endHour, endMin] = horaFin.split(':').map(Number)
    const startTime = startHour * 60 + startMin
    const endTime = endHour * 60 + endMin

    const conflictingHorario = horarios.find(h => {
      // Si estamos editando, ignorar el horario actual
      if (horario && h.id === horario.id) return false
      
      const horarioDate = new Date(h.fecha).toISOString().split('T')[0]
      if (horarioDate !== dateStr) return false

      const [hStartHour, hStartMin] = h.horaInicio.split(':').map(Number)
      const [hEndHour, hEndMin] = h.horaFin.split(':').map(Number)
      const hStartTime = hStartHour * 60 + hStartMin
      const hEndTime = hEndHour * 60 + hEndMin

      // Check if there's any overlap
      return (startTime < hEndTime && endTime > hStartTime)
    })

    if (conflictingHorario) {
      setError(`⚠️ Conflicto con el horario "${conflictingHorario.titulo || 'Sin título'}" (${conflictingHorario.horaInicio} - ${conflictingHorario.horaFin})`)
      return true
    }
    return false
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.fecha || !formData.horaInicio || !formData.horaFin) {
      setError('Por favor completa todos los campos requeridos (Fecha, Hora de Inicio, Hora de Fin)')
      return
    }

    // Validar que se haya seleccionado un docente
    if (!formData.docenteId || formData.docenteId === '') {
      setError('Por favor selecciona un docente/tutor')
      return
    }

    // Validar que el salón no esté vacío
    if (!formData.salon || !formData.salon.trim()) {
      setError('Por favor ingresa un salón')
      return
    }

    if (formData.horaInicio >= formData.horaFin) {
      setError('La hora de fin debe ser posterior a la hora de inicio')
      return
    }

    // Validar que la fecha fin sea posterior o igual a la fecha inicio
    if (new Date(formData.fechaFin) < new Date(formData.fecha)) {
      setError('⚠️ La fecha de fin debe ser igual o posterior a la fecha de inicio')
      return
    }

    // Validar días seleccionados si está en modo recurrente
    if (isRecurrente) {
      const hayDiasSeleccionados = Object.values(diasSeleccionados).some(dia => dia)
      if (!hayDiasSeleccionados) {
        setError('⚠️ Por favor selecciona al menos un día de la semana para la recurrencia')
        return
      }
    }

    // Crear array de fechas según el modo
    let fechas = []
    
    if (isRecurrente) {
      // Modo recurrente: solo los días seleccionados
      fechas = generarFechasRecurrentes()
    } else {
      // Modo normal: todos los días entre fecha inicio y fecha fin
    const currentDate = new Date(formData.fecha + 'T00:00:00')
    const endDate = new Date(formData.fechaFin + 'T00:00:00')
    
    while (currentDate <= endDate) {
        fechas.push(currentDate.toISOString().split('T')[0])
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }

    // Validar que haya al menos una fecha
    if (fechas.length === 0) {
      setError('⚠️ No se encontraron fechas válidas con la configuración seleccionada')
      return
    }

      // Verificar conflictos para cada fecha
    for (const fechaStr of fechas) {
      if (checkConflict(fechaStr, formData.horaInicio, formData.horaFin)) {
        setError(`⚠️ Ya existe un horario programado para el día ${fechaStr} en el horario seleccionado.`)
        return
      }
    }

    try {
      const horariosCreados = []
      
      if (horario) {
        // Si estamos editando y el usuario cambió el rango de fechas,
        // actualizamos el horario seleccionado y creamos nuevos registros
        // para las fechas adicionales dentro del rango.
        const horarioActualizado = await updateHorario(horario.id, {
          ...formData,
          fecha: formData.fecha,
          disponible: true
        })
        horariosCreados.push(horarioActualizado)

        // Crear horarios adicionales para las fechas del rango (excluye la fecha ya actualizada)
        for (const fecha of fechas) {
          if (fecha === formData.fecha) continue // ya actualizamos este
          const nuevoHorario = await addHorario({
            ...formData,
            fecha: fecha,
            disponible: true
          })
          horariosCreados.push(nuevoHorario)
        }
      } else {
        // Si es nuevo, creamos horarios para cada fecha
        for (const fecha of fechas) {
          const nuevoHorario = await addHorario({
            ...formData,
            fecha: fecha,
            disponible: true
          })
          horariosCreados.push(nuevoHorario)
        }
      }

      console.log('Horarios creados/actualizados:', horariosCreados)
      onSave()
    } catch (error) {
      setError(`Error: ${error.message || 'No se pudo guardar el horario'}`)
    }
  }

  return (
    <div className="formulario-overlay">
      <div className="formulario-horario">
        <div className="formulario-header">
          <h2>{horario ? 'Editar Horario' : 'Nuevo Horario'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="formulario-form">
          {error && (
            <div className="form-error">
              {error}
            </div>
          )}
          <div className="form-columns">
            <div className="form-column">
              <div className="form-group">
                <label>Título</label>
                <input
                  type="text"
                  name="titulo"
                  value={formData.titulo}
                  onChange={handleChange}
                  placeholder="Ej: Tutoría de Matemáticas"
                />
              </div>

              <div className="form-group">
                <label>Fecha *</label>
                <div className="input-with-icon">
                  <input
                    type="date"
                    name="fecha"
                    value={formData.fecha}
                    onChange={handleChange}
                    required
                  />
                  <span className="input-icon">📅</span>
                </div>
              </div>

              <div className="form-group">
                <label>Fecha Fin *</label>
                <div className="input-with-icon">
                  <input
                    type="date"
                    name="fechaFin"
                    value={formData.fechaFin}
                    onChange={handleChange}
                    min={formData.fecha}
                    required
                  />
                  <span className="input-icon">📅</span>
                </div>
              </div>

              <div className="form-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={isRecurrente}
                    onChange={(e) => setIsRecurrente(e.target.checked)}
                  />
                  <span>Horario recurrente</span>
                </label>
              </div>

              {isRecurrente && (
                <div className="form-group">
                  <label>Selecciona los días de la semana *</label>
                  <div className="dias-semana-container">
                    {[
                      { key: 'lunes', label: 'Lunes', abbr: 'L' },
                      { key: 'martes', label: 'Martes', abbr: 'M' },
                      { key: 'miercoles', label: 'Miércoles', abbr: 'X' },
                      { key: 'jueves', label: 'Jueves', abbr: 'J' },
                      { key: 'viernes', label: 'Viernes', abbr: 'V' },
                      { key: 'sabado', label: 'Sábado', abbr: 'S' },
                      { key: 'domingo', label: 'Domingo', abbr: 'D' }
                    ].map((dia) => (
                      <label 
                        key={dia.key} 
                        className={`dia-checkbox ${diasSeleccionados[dia.key] ? 'checked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={diasSeleccionados[dia.key]}
                          onChange={() => handleDiaChange(dia.key)}
                        />
                        <span className="dia-checkbox-label">
                          <span className="dia-abbr">{dia.abbr}</span>
                          <span className="dia-full">{dia.label}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="recurrencia-hint">
                    Se crearán horarios solo para los días seleccionados entre {formData.fecha} y {formData.fechaFin}
                  </p>
                </div>
              )}

              <div className="form-group">
                <label>Hora de Inicio *</label>
                <div className="input-with-icon">
                  <TimePicker
                    name="horaInicio"
                    value={formData.horaInicio}
                    onChange={handleChange}
                    placeholder="--:--"
                  />
                  <span className="input-icon">🕐</span>
                </div>
              </div>
            </div>

            <div className="form-column">
              <div className="form-group">
                <label>Hora de Fin *</label>
                <div className="input-with-icon">
                  <TimePicker
                    name="horaFin"
                    value={formData.horaFin}
                    onChange={handleChange}
                    placeholder="--:--"
                  />
                  <span className="input-icon">🕐</span>
                </div>
              </div>

              <div className="form-group">
                <label>Cupos Disponibles</label>
                <div className="input-with-icon">
                  <input
                    type="number"
                    name="cuposDisponibles"
                    value={formData.cuposDisponibles}
                    onChange={handleChange}
                    min="1"
                  />
                  <span className="input-icon">👥</span>
                </div>
              </div>

              <div className="form-group">
                <label>Aula *</label>
                <div className="input-with-icon">
                  <input
                    type="text"
                    name="salon"
                    value={formData.salon}
                    onChange={handleChange}
                    placeholder="Ej: Aula 301"
                    required
                  />
                  <span className="input-icon">📍</span>
                </div>
              </div>

              <div className="form-group">
                <label>Docente / Tutor</label>
                <div className="input-with-icon">
                  <select
                    name="docenteId"
                    value={formData.docenteId}
                    onChange={handleChange}
                  >
                    <option value="">-- Seleccionar --</option>
                    {docentes && docentes.length > 0 ? (
                      docentes.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.nombre || (d.nombres && d.apellidos ? `${d.nombres} ${d.apellidos}`.trim() : d.nombres || `Docente ${d.id}`)} {d.rol ? `(${d.rol})` : ''}
                        </option>
                      ))
                    ) : (
                      <option value="">No hay docentes disponibles</option>
                    )}
                  </select>
                  <span className="input-icon">👩‍🏫</span>
                </div>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              ✕ Cancelar
            </button>
            <button type="submit" className="btn-save">
              💾 Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default FormularioHorario

