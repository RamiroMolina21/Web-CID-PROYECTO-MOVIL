import React, { useState, useEffect, useRef } from 'react'
import { useData } from '../context/DataContext'
import { useToast } from './ui/Feedback'
import './FormularioTutoria.css'
import Icon from './ui/Icon'

// Contrato POST /Tutoria: cupos entero 1–1000 (obligatorio). Valor inicial razonable para una tutoría de idiomas.
export const CUPOS_POR_DEFECTO = 5
export const validarCupos = (valor) => {
  const n = Number(valor)
  if (String(valor ?? '').trim() === '') return 'Indica los cupos máximos.'
  if (!Number.isInteger(n) || n < 1 || n > 1000) return 'Debe ser un número entero entre 1 y 1000.'
  return ''
}

const FormularioTutoria = ({ horario, tutoria, onClose, isModal }) => {
  const { docentes, tutorias, addTutoria, updateTutoria } = useData()
  const toast = useToast()
  const isEditing = !!tutoria
  const hasDocentes = docentes && docentes.length > 0
  
  // Detectar si es un horario recurrente
  const esRecurrente = horario?.esRecurrente || false
  const fechasDisponibles = horario?.fechasDisponibles || []
  const todosLosHorarios = horario?.todosLosHorarios || []
  
  const [horarioSeleccionadoId, setHorarioSeleccionadoId] = useState(null)
  const [agendarTodasLasFechas, setAgendarTodasLasFechas] = useState(false)
  const [errorCupos, setErrorCupos] = useState('')
  const cuposRef = useRef(null)
  const cuposIniciales = tutoria?.cupos ?? CUPOS_POR_DEFECTO
  
  const [formData, setFormData] = useState({
    docenteId: tutoria?.docenteId || horario?.docenteId || '',
    tema: tutoria?.tema || '',
    idioma: tutoria?.idioma || '',
    nivel: tutoria?.nivel || '',
    modalidad: tutoria?.modalidad || '',
    fecha: tutoria?.fecha || (esRecurrente && fechasDisponibles.length > 0 ? fechasDisponibles[0] : horario?.fecha) || new Date().toISOString().split('T')[0],
    horaInicio: tutoria?.horaInicio || horario?.horaInicio || '09:00',
    horaFin: tutoria?.horaFin || horario?.horaFin || '10:00',
    cuposMax: String(cuposIniciales),
  })
  
  // Inicializar y actualizar el horario seleccionado
  useEffect(() => {
    if (tutoria?.horarioId) {
      setHorarioSeleccionadoId(tutoria.horarioId)
    } else if (!esRecurrente && horario?.id) {
      setHorarioSeleccionadoId(horario.id)
    } else if (esRecurrente && formData.fecha && todosLosHorarios.length > 0) {
      const horarioParaFecha = todosLosHorarios.find(h => {
        const horarioDate = new Date(h.fecha).toISOString().split('T')[0]
        return horarioDate === formData.fecha
      })
      if (horarioParaFecha) {
        setHorarioSeleccionadoId(horarioParaFecha.id)
      }
    }
  }, [formData.fecha, esRecurrente, todosLosHorarios, horario, tutoria])

  useEffect(() => {
    if (tutoria) {
      setFormData({
        docenteId: tutoria.docenteId || '',
        tema: tutoria.tema || '',
        idioma: tutoria.idioma || '',
        nivel: tutoria.nivel || '',
        modalidad: tutoria.modalidad || '',
        fecha: tutoria.fecha || new Date().toISOString().split('T')[0],
        horaInicio: tutoria.horaInicio || '09:00',
        horaFin: tutoria.horaFin || '10:00',
        cuposMax: String(tutoria.cupos ?? CUPOS_POR_DEFECTO),
      })
    }
  }, [tutoria])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    if (name === 'cuposMax' && errorCupos) setErrorCupos('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!hasDocentes) {
      toast.error('No hay docentes/tutores registrados. Por favor agrega uno antes de agendar la tutoría.')
      return
    }

    if (!formData.docenteId) {
      toast.error('Por favor selecciona un docente/tutor')
      return
    }

    const errCupos = validarCupos(formData.cuposMax)
    if (errCupos) {
      setErrorCupos(errCupos)
      requestAnimationFrame(() => cuposRef.current?.focus())
      return
    }
    const cuposMax = Number(formData.cuposMax)

    // Obtener el ID del horario correcto (puede ser el seleccionado por fecha si es recurrente)
    const targetHorarioId = horarioSeleccionadoId || horario?.id || tutoria?.horarioId || null
    if (!targetHorarioId) {
      toast.error('Por favor selecciona un horario para agendar la tutoría')
      return
    }

    try {
      if (isEditing) {
        await updateTutoria(tutoria.id, {
          docenteId: parseInt(formData.docenteId),
          tema: formData.tema,
          idioma: formData.idioma,
          nivel: formData.nivel,
          modalidad: formData.modalidad,
          fecha: formData.fecha,
          horaInicio: formData.horaInicio,
          horaFin: formData.horaFin,
          // PUT: cupos opcional; solo se envía si cambió (409 si queda por debajo de los inscritos)
          ...(String(cuposMax) !== String(tutoria.cupos ?? '') ? { cuposMax } : {}),
        })
      } else {
        // Si es recurrente y se quiere agendar en todas las fechas
        if (esRecurrente && agendarTodasLasFechas && fechasDisponibles.length > 0) {
          // Validar capacidad para todas las fechas antes de agendar
          const fechasParaAgendar = fechasDisponibles.filter(fecha => {
            const horarioParaFecha = todosLosHorarios.find(h => {
              const horarioDate = new Date(h.fecha).toISOString().split('T')[0]
              return horarioDate === fecha
            })
            if (!horarioParaFecha) return false
            
            // Una tutoría por horario: se omiten las fechas que ya tienen una
            return !tutorias.some(t => t.horarioId === horarioParaFecha.id)
          })
          
          if (fechasParaAgendar.length === 0) {
            toast.error('No hay fechas disponibles para agendar. Todas las fechas ya están ocupadas.')
            return
          }
          
          // Crear tutorías para todas las fechas disponibles
          const tutoriasCreadas = []
          for (const fecha of fechasParaAgendar) {
            const horarioParaFecha = todosLosHorarios.find(h => {
              const horarioDate = new Date(h.fecha).toISOString().split('T')[0]
              return horarioDate === fecha
            })
            
            if (!horarioParaFecha) continue
            
            // Verificar capacidad y si ya tiene tutorías antes de crear
            // Omitir si ya tiene una tutoría asignada
            if (tutorias.some(t => t.horarioId === horarioParaFecha.id)) {
              console.warn(`La fecha ${fecha} ya está ocupada o tiene tutoría asignada, se omite`)
              continue
            }
            
            try {
              const nuevaTutoria = await addTutoria({
                docenteId: parseInt(formData.docenteId),
                horarioId: horarioParaFecha.id,
                tema: formData.tema,
                idioma: formData.idioma,
                nivel: formData.nivel,
                modalidad: formData.modalidad,
                fecha: fecha,
                horaInicio: formData.horaInicio,
                horaFin: formData.horaFin,
                cuposMax,
              })
              tutoriasCreadas.push(nuevaTutoria)
            } catch (error) {
              console.error(`Error creando tutoría para fecha ${fecha}:`, error)
              // Continuar con las demás fechas aunque una falle
            }
          }
          
          if (tutoriasCreadas.length === 0) {
            toast.error('No se pudo agendar ninguna tutoría. Por favor verifica las fechas disponibles.')
            return
          }
          
          toast.success(`Se han agendado ${tutoriasCreadas.length} tutoría(s) exitosamente en las fechas disponibles.`)
          onClose() // Cerrar el modal después de agendar todas las tutorías
          return
        } else {
          // Usar el horario seleccionado por fecha si es recurrente
          const targetHorarioId = horarioSeleccionadoId || horario?.id || tutoria?.horarioId
        if (!targetHorarioId) {
          toast.error('Por favor selecciona un horario para agendar la tutoría')
          return
        }
        
        await addTutoria({
          docenteId: parseInt(formData.docenteId),
          horarioId: targetHorarioId,
          tema: formData.tema,
          idioma: formData.idioma,
          nivel: formData.nivel,
          modalidad: formData.modalidad,
          fecha: formData.fecha,
          horaInicio: formData.horaInicio,
          horaFin: formData.horaFin,
          cuposMax,
        })
        }
      }
      onClose()
    } catch (error) {
      toast.error(`Error: ${error.message || 'No se pudo agendar la tutoría'}`)
    }
  }

  return (
    <div className={`formulario-tutoria ${isModal ? 'modal' : ''}`}>
      <div className="formulario-tutoria-header">
        <h2>{isEditing ? 'Editar Tutoría' : 'Información de la Tutoría'}</h2>
      </div>
      <form onSubmit={handleSubmit} className="formulario-tutoria-form">
        <div className="form-group">
          <label htmlFor="ft-docenteId">Docente/Tutor *</label>
          {!hasDocentes && (
            <div className="form-warning" style={{ background: '#fff4e5', padding: '10px', borderRadius: 6, color: '#663c00', marginBottom: 10 }}>
              No hay docentes/tutores registrados. Por favor agrega uno antes de agendar la tutoría.
            </div>
          )}
          <select
            id="ft-docenteId"
            name="docenteId"
            value={formData.docenteId}
            onChange={handleChange}
            required
            disabled={!hasDocentes}
            className="form-select"
          >
            <option value="">{hasDocentes ? 'Selecciona un docente/tutor' : 'No hay docentes disponibles'}</option>
            {docentes.filter((d) => d.activo !== false || String(d.id) === String(formData.docenteId)).map((docente) => (
              <option key={docente.id} value={docente.id}>
                {docente.nombre || (docente.nombres && docente.apellidos ? `${docente.nombres} ${docente.apellidos}`.trim() : docente.nombres || '')} {docente.rol ? `(${docente.rol})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="ft-fecha">Fecha *</label>
          {esRecurrente && fechasDisponibles.length > 0 ? (
            <>
              {!agendarTodasLasFechas && (
                <select
                  id="ft-fecha"
                  name="fecha"
                  value={formData.fecha}
                  onChange={handleChange}
                  required
                  className="form-select"
                >
                  <option value="">Selecciona una fecha</option>
                {fechasDisponibles.map((fecha) => {
                  const horarioParaFecha = todosLosHorarios.find(h => {
                    const horarioDate = new Date(h.fecha).toISOString().split('T')[0]
                    return horarioDate === fecha
                  })
                  if (!horarioParaFecha) return null
                  
                  // Una tutoría por horario: solo se ofrecen las fechas libres
                  if (tutorias.some(t => t.horarioId === horarioParaFecha.id)) return null
                    
                    const dateObj = new Date(fecha + 'T00:00:00')
                    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
                    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
                    const fechaFormateada = `${days[dateObj.getDay()]}, ${dateObj.getDate()} de ${months[dateObj.getMonth()]}`
                    
                    return (
                      <option key={fecha} value={fecha}>
                        {fechaFormateada}
                      </option>
                    )
                  })}
                </select>
              )}
              
              {agendarTodasLasFechas && (
                <div className="fechas-todas-info" style={{ 
                  padding: '1rem', 
                  background: '#f3f4f6', 
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <p style={{ margin: 0, fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                    Se agendará el tutor en {fechasDisponibles.length} fecha(s) disponible(s):
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
                    {fechasDisponibles.map((fecha) => {
                      const dateObj = new Date(fecha + 'T00:00:00')
                      const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
                      const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
                      const fechaFormateada = `${days[dateObj.getDay()]}, ${dateObj.getDate()} de ${months[dateObj.getMonth()]}`
                      return <li key={fecha}>{fechaFormateada}</li>
                    })}
                  </ul>
                </div>
              )}
              
              <label className="toggle-label" style={{ marginTop: '1rem' }}>
                <input
                  type="checkbox"
                  checked={agendarTodasLasFechas}
                  onChange={(e) => {
                    setAgendarTodasLasFechas(e.target.checked)
                    if (e.target.checked && fechasDisponibles.length > 0) {
                      // No necesitamos seleccionar una fecha específica si se agendan todas
                    }
                  }}
                />
                <span>Agendar en todas las fechas disponibles ({fechasDisponibles.length} fecha(s))</span>
              </label>
              
              {!agendarTodasLasFechas && (
                <p className="form-hint" style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  Este horario está disponible en múltiples fechas. Selecciona la fecha deseada o marca para agendar en todas.
                </p>
              )}
            </>
          ) : (
          <input
            type="date"
            id="ft-fecha"
            name="fecha"
            value={formData.fecha}
            onChange={handleChange}
            required
            disabled
            className="form-input"
          />
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="ft-horaInicio">Hora Inicio *</label>
            <input
              type="time"
              id="ft-horaInicio"
              name="horaInicio"
              value={formData.horaInicio}
              onChange={handleChange}
              required
              disabled
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="ft-horaFin">Hora Fin *</label>
            <input
              type="time"
              id="ft-horaFin"
              name="horaFin"
              value={formData.horaFin}
              onChange={handleChange}
              required
              disabled
              className="form-input"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="ft-cupos">Cupos máximos *</label>
          <input
            ref={cuposRef}
            id="ft-cupos"
            type="number"
            name="cuposMax"
            value={formData.cuposMax}
            onChange={handleChange}
            // Sin min/max/required nativos: la validación propia muestra el error junto al campo
            step="1"
            inputMode="numeric"
            aria-required="true"
            className="form-input"
            aria-invalid={!!errorCupos}
            aria-describedby={errorCupos ? 'ft-cupos-ayuda ft-cupos-error' : 'ft-cupos-ayuda'}
          />
          <p className="form-hint ft-hint" id="ft-cupos-ayuda">Máximo de estudiantes que pueden inscribirse (1 a 1000).</p>
          {errorCupos && <p className="ft-error" id="ft-cupos-error">{errorCupos}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="ft-tema">Tema a Tratar</label>
          <input
            type="text"
            id="ft-tema"
            name="tema"
            value={formData.tema}
            onChange={handleChange}
            placeholder="Ej: Derivadas parciales"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="ft-idioma">Idioma *</label>
          <select
            id="ft-idioma"
            name="idioma"
            value={formData.idioma}
            onChange={handleChange}
            required
            className="form-select"
          >
            <option value="">Selecciona un idioma</option>
            <option value="Inglés">Inglés</option>
            <option value="Francés">Francés</option>
            <option value="Alemán">Alemán</option>
            <option value="Portugués">Portugués</option>
            <option value="Italiano">Italiano</option>
            <option value="Español">Español</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="ft-modalidad">Modalidad *</label>
          <select
            id="ft-modalidad"
            name="modalidad"
            value={formData.modalidad}
            onChange={handleChange}
            required
            className="form-select"
          >
            <option value="">Selecciona una modalidad</option>
            <option value="Presencial">Presencial</option>
            <option value="Virtual">Virtual</option>
            <option value="Híbrida">Híbrida</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="ft-nivel">Nivel *</label>
          <select
            id="ft-nivel"
            name="nivel"
            value={formData.nivel}
            onChange={handleChange}
            required
            className="form-select"
          >
            <option value="">Selecciona un nivel</option>
            <option value="A1">A1 - Principiante</option>
            <option value="A2">A2 - Elemental</option>
            <option value="B1">B1 - Intermedio</option>
            <option value="B2">B2 - Intermedio alto</option>
            <option value="C1">C1 - Avanzado</option>
            <option value="C2">C2 - Dominio</option>
          </select>
        </div>

        <button type="submit" className="btn-agendar" disabled={!hasDocentes}>
          {isEditing ? <><Icon name="save" size={18} className="icon--inline" />Guardar Cambios</> : (hasDocentes ? <><Icon name="calendarPlus" size={18} className="icon--inline" />Agendar Tutoría</> : 'Agregar docente/tutor primero')}
        </button>
      </form>
    </div>
  )
}

export default FormularioTutoria

