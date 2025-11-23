import React, { useState } from 'react'
import { useData } from '../context/DataContext'
import FormularioHorario from '../components/FormularioHorario'
import TutoriaDetailModal from '../components/TutoriaDetailModal'
import HorarioDetailModal from '../components/HorarioDetailModal'
import './Horarios.css'

const Horarios = () => {
  const { tutorias, horarios, deleteHorario, getEstudianteById, loading, error } = useData()
  const [showHorarioForm, setShowHorarioForm] = useState(false)
  const [selectedTutoria, setSelectedTutoria] = useState(null)
  const [selectedHorario, setSelectedHorario] = useState(null)
  const [horarioToEdit, setHorarioToEdit] = useState(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('semana')
  
  // Filtrar datos válidos y aplicar filtros de negocio
  const validHorarios = Array.isArray(horarios) 
    ? horarios
        .filter(h => h && h.fecha && h.horaInicio && h.horaFin)
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
    : []
  
  const validTutorias = Array.isArray(tutorias)
    ? tutorias
        .filter(t => t && t.fecha && t.horaInicio && t.horaFin)
        .filter(t => {
          // Filtrar tutorías finalizadas
          const estado = (t.estado || '').toLowerCase()
          const estadosFinalizados = ['finalizada', 'completada', 'finalizado', 'completado']
          return !estadosFinalizados.includes(estado)
        })
    : []

  const getWeekDates = () => {
    const start = new Date(currentDate)
    const day = start.getDay()
    const diff = start.getDate() - day + (day === 0 ? -6 : 1)
    start.setDate(diff)

    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const getDayDates = () => {
    return [new Date(currentDate)]
  }

  const getMonthDates = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())
    
    const dates = []
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const getYearMonths = () => {
    const year = currentDate.getFullYear()
    const months = []
    for (let i = 0; i < 12; i++) {
      months.push(new Date(year, i, 1))
    }
    return months
  }

  const getHours = () => {
    const hours = []
    // 1 AM to 11 AM
    for (let i = 1; i < 12; i++) {
      hours.push(`${i} AM`)
    }
    // 12 PM (noon)
    hours.push('12 PM')
    // 1 PM to 11 PM
    for (let i = 1; i < 12; i++) {
      hours.push(`${i} PM`)
    }
    // 12 AM (midnight)
    hours.push('12 AM')
    return hours
  }

  const formatDate = (date) => {
    const days = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
    return days[date.getDay()]
  }

  const formatDateNumber = (date) => {
    return date.getDate()
  }

  const formatMonthYear = () => {
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`
  }

  const formatDayDate = () => {
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    return `${currentDate.getDate()} ${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`
  }

  // Función auxiliar para validar y formatear fechas
  const formatDateToISOString = (dateInput) => {
    if (!dateInput) return null
    
    // Si ya es una fecha en formato YYYY-MM-DD, devolverla directamente
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
      return dateInput.split('T')[0]
    }
    
    // Intentar crear una fecha válida
    try {
      const date = new Date(dateInput)
      if (isNaN(date.getTime())) {
        console.warn('Fecha inválida:', dateInput)
        return null
      }
      return date.toISOString().split('T')[0]
    } catch (error) {
      console.warn('Error al procesar fecha:', dateInput, error)
      return null
    }
  }

  const getTutoriasForDate = (date) => {
    try {
      const dateStr = date.toISOString().split('T')[0]
      return validTutorias.filter(t => {
        if (!t || !t.fecha) return false
        const tutoriaDate = formatDateToISOString(t.fecha)
        return tutoriaDate === dateStr
      })
    } catch (error) {
      console.error('Error en getTutoriasForDate:', error)
      return []
    }
  }

  const getTutoriasForTimeSlot = (date, hour) => {
    try {
      const dateStr = date.toISOString().split('T')[0]
      return validTutorias.filter(t => {
        if (!t || !t.fecha || !t.horaInicio) return false
        
        const tutoriaDate = formatDateToISOString(t.fecha)
        if (!tutoriaDate || tutoriaDate !== dateStr) return false
        
        // Convert hour display format to 24-hour format for comparison
        const [hourNum, period] = hour.split(' ')
        let hour24 = parseInt(hourNum)
        if (period === 'PM' && hour24 !== 12) {
          hour24 += 12
        } else if (period === 'AM' && hourNum === '12') {
          hour24 = 0
        }
        
        const [startHour] = t.horaInicio.split(':')
        const startHour24 = parseInt(startHour)
        return startHour24 === hour24
      })
    } catch (error) {
      console.error('Error en getTutoriasForTimeSlot:', error)
      return []
    }
  }

  const getHorariosForDate = (date) => {
    try {
      const dateStr = date.toISOString().split('T')[0]
      return validHorarios.filter(h => {
        if (!h || !h.fecha) return false
        const horarioDate = formatDateToISOString(h.fecha)
        return horarioDate === dateStr
      })
    } catch (error) {
      console.error('Error en getHorariosForDate:', error)
      return []
    }
  }

  const getHorariosForTimeSlot = (date, hour) => {
    try {
      const dateStr = date.toISOString().split('T')[0]
      return validHorarios.filter(h => {
        if (!h || !h.fecha || !h.horaInicio) return false
        
        const horarioDate = formatDateToISOString(h.fecha)
        if (!horarioDate || horarioDate !== dateStr) return false
        
        // Convert hour display format to 24-hour format for comparison
        const [hourNum, period] = hour.split(' ')
        let hour24 = parseInt(hourNum)
        if (period === 'PM' && hour24 !== 12) {
          hour24 += 12
        } else if (period === 'AM' && hourNum === '12') {
          hour24 = 0
        }
        
        // Extraer la hora del horario (puede venir como "13:00" o "2025-11-18T13:00:00")
        let horaInicioStr = h.horaInicio
        if (horaInicioStr && horaInicioStr.includes('T')) {
          // Si viene como DateTime, extraer solo la hora
          horaInicioStr = horaInicioStr.split('T')[1]?.split(':').slice(0, 2).join(':') || horaInicioStr
        }
        
        const [startHour] = horaInicioStr.split(':')
        const startHour24 = parseInt(startHour)
        
        if (isNaN(startHour24)) {
          console.warn('Hora de inicio inválida en horario:', h.id, h.horaInicio)
          return false
        }
        
        return startHour24 === hour24
      })
    } catch (error) {
      console.error('Error en getHorariosForTimeSlot:', error)
      return []
    }
  }

  // Calcula la altura en píxeles para la duración entre horaInicio y horaFin
  // Cada time-slot tiene 60px de altura, así que 1 hora = 60px
  const calculateDuration = (horaInicio, horaFin, fecha) => {
    try {
      // Validar que las horas existan
      if (!horaInicio || !horaFin) {
        return 60 // Altura por defecto (1 hora)
      }
      
      // Extraer la hora si viene como DateTime completo
      let horaInicioStr = horaInicio
      let horaFinStr = horaFin
      
      if (horaInicioStr && horaInicioStr.includes('T')) {
        horaInicioStr = horaInicioStr.split('T')[1]?.split(':').slice(0, 2).join(':') || horaInicioStr
      }
      if (horaFinStr && horaFinStr.includes('T')) {
        horaFinStr = horaFinStr.split('T')[1]?.split(':').slice(0, 2).join(':') || horaFinStr
      }
      
      // Calculamos usando solo el tiempo
      const [sH, sM] = (horaInicioStr || '00:00').split(':').map(Number)
      const [eH, eM] = (horaFinStr || '00:00').split(':').map(Number)
      
      // Validar que sean números válidos
      if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) {
        return 60
      }
      
      let startMinutes = sH * 60 + sM
      let endMinutes = eH * 60 + eM

      let diff = endMinutes - startMinutes
      if (diff <= 0) {
        // Si termina al día siguiente, agregamos 24 horas
        diff += 24 * 60
      }
      
      // Cada time-slot tiene 60px de altura, así que 1 hora = 60px
      // Convertimos minutos a píxeles: (minutos / 60) * 60px
      const heightInPixels = (diff / 60) * 60
      
      // Asegurar altura mínima de 1 hora
      return Math.max(60, heightInPixels)
    } catch (err) {
      console.warn('Error calculando duración:', err, { horaInicio, horaFin, fecha })
      return 60
    }
  }

  // Calcula el margen superior basado en los minutos de inicio
  // Si el horario empieza a las 1:30 PM, el marginTop debe ser 30/60 * 60px = 30px
  const calculateMarginTop = (horaInicio) => {
    try {
      if (!horaInicio) return 0
      
      // Extraer la hora si viene como DateTime completo
      let horaInicioStr = horaInicio
      if (horaInicioStr && horaInicioStr.includes('T')) {
        horaInicioStr = horaInicioStr.split('T')[1]?.split(':').slice(0, 2).join(':') || horaInicioStr
      }
      
      const [hours, minutes] = horaInicioStr.split(':').map(Number)
      
      if (isNaN(hours) || isNaN(minutes)) return 0
      
      // Los minutos se convierten a píxeles: (minutos / 60) * 60px
      return (minutes / 60) * 60
    } catch (err) {
      console.warn('Error calculando marginTop:', err, horaInicio)
      return 0
    }
  }

  // Calcula la posición absoluta desde el inicio del calendar-day-column
  // basado en la hora de inicio del horario
  const calculateAbsoluteTop = (horaInicio) => {
    try {
      if (!horaInicio) return 4 // 4px = padding del time-slot
      
      // Extraer la hora si viene como DateTime completo
      let horaInicioStr = horaInicio
      if (horaInicioStr && horaInicioStr.includes('T')) {
        horaInicioStr = horaInicioStr.split('T')[1]?.split(':').slice(0, 2).join(':') || horaInicioStr
      }
      
      const [hours, minutes] = horaInicioStr.split(':').map(Number)
      
      if (isNaN(hours) || isNaN(minutes)) return 4
      
      // Convertir hora a índice en el array de horas
      // Las horas van de 1 AM a 12 AM
      let hourIndex = 0
      if (hours === 12) {
        hourIndex = 11 // 12 PM está en el índice 11
      } else if (hours >= 1 && hours <= 11) {
        hourIndex = hours - 1 // 1 AM = índice 0, 11 AM = índice 10
      } else if (hours === 0) {
        hourIndex = 23 // 12 AM está al final
      } else {
        // Horas PM (13-23)
        hourIndex = hours - 1
      }
      
      // Calcular posición: (índice * 60px por time-slot) + (minutos / 60 * 60px) + padding
      const topPosition = (hourIndex * 60) + (minutes / 60 * 60) + 4
      
      return topPosition
    } catch (err) {
      console.warn('Error calculando absoluteTop:', err, horaInicio)
      return 4
    }
  }

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate)
    if (viewMode === 'dia') {
      newDate.setDate(newDate.getDate() + direction)
    } else if (viewMode === 'semana') {
      newDate.setDate(newDate.getDate() + (direction * 7))
    } else if (viewMode === 'mes') {
      newDate.setMonth(newDate.getMonth() + direction)
    } else if (viewMode === 'año') {
      newDate.setFullYear(newDate.getFullYear() + direction)
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const handleTutoriaClick = (tutoria) => {
    setSelectedTutoria(tutoria)
  }

  const handleHorarioClick = (horario) => {
    setSelectedHorario(horario)
  }

  const isToday = (date) => {
    return date.toDateString() === new Date().toDateString()
  }

  const isCurrentMonth = (date) => {
    return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear()
  }

  const renderDayView = () => {
    try {
      const dates = getDayDates()
      const hours = getHours()
      const date = dates[0]
      const tutoriasDelDia = getTutoriasForDate(date)

      return (
        <div className="calendar-day-view">
          <div className="calendar-timezone">GMT-05</div>
          <div className="calendar-day-indicator">
            <div className="day-of-week">{formatDate(date)}</div>
            <div className={`day-number ${isToday(date) ? 'today' : ''}`}>
              {formatDateNumber(date)}
            </div>
          </div>
          <div className="calendar-day-grid">
            <div className="calendar-time-column">
              {hours.map((hour) => (
                <div key={hour} className="time-cell">
                  {hour}
                </div>
              ))}
            </div>
            <div className="calendar-day-column">
              {hours.map((hour) => {
                try {
                  const slotTutorias = getTutoriasForTimeSlot(date, hour)
                  const slotHorarios = getHorariosForTimeSlot(date, hour)
                  return (
                    <div key={hour} className="time-slot">
                      {slotHorarios
                        .filter(horario => horario && horario.horaInicio)
                        .map((horario) => {
                          try {
                            // Obtener tutorías vinculadas a este horario
                            const tutoriasDelHorario = slotTutorias.filter(t => t && t.horarioId === horario.id)
                            const duration = calculateDuration(horario.horaInicio, horario.horaFin, horario.fecha)
                            const cuposOcupados = tutoriasDelHorario.length
                            const cuposTotal = horario.cuposDisponibles || 5
                            
                            const absoluteTop = calculateAbsoluteTop(horario.horaInicio)
                            
                            return (
                              <div 
                                key={horario.id} 
                                className="horario-block"
                                style={{ 
                                  height: `${duration}px`,
                                  top: `${absoluteTop}px`, // Posición absoluta desde el inicio del calendar-day-column
                                  zIndex: 1
                                }}
                                onClick={() => handleHorarioClick(horario)}
                              >
                                <div className="horario-title">{horario.titulo || 'Horario'}</div>
                                {tutoriasDelHorario.length > 0 && (
                                  <div className="horario-cupos-info">
                                    {cuposOcupados}/{cuposTotal} cupos
                                  </div>
                                )}
                                <div className="horario-time">
                                  {horario.horaInicio} - {horario.horaFin}
                                </div>
                              </div>
                            )
                          } catch (error) {
                            console.warn('Error renderizando horario en día:', error, horario)
                            return null
                          }
                        })}

                      {/* Mostrar solo tutorías que NO están vinculadas a un horario */}
                      {slotTutorias
                        .filter(tutoria => tutoria && !tutoria.horarioId && tutoria.horaInicio)
                        .map((tutoria) => {
                          try {
                            const duration = calculateDuration(tutoria.horaInicio, tutoria.horaFin, tutoria.fecha)
                            const horaParts = tutoria.horaInicio ? tutoria.horaInicio.split(':') : ['0', '0']
                            const minutos = horaParts[1] ? parseInt(horaParts[1]) : 0
                            const marginTop = isNaN(minutos) ? 0 : (minutos / 60) * 70
                            
                            return (
                              <div 
                                key={tutoria.id} 
                                className="tutoria-block"
                                style={{ 
                                  height: `${duration}px`,
                                  marginTop: `${marginTop}px`,
                                  zIndex: 1
                                }}
                                onClick={() => handleTutoriaClick(tutoria)}
                              >
                                <div className="tutoria-title">{tutoria.tema || tutoria.materia || 'Tutoría'}</div>
                                <div className="tutoria-time">
                                  {tutoria.horaInicio} - {tutoria.horaFin}
                                </div>
                              </div>
                            )
                          } catch (error) {
                            console.warn('Error renderizando tutoria en día:', error, tutoria)
                            return null
                          }
                        })}
                    </div>
                  )
                } catch (error) {
                  console.error('Error renderizando hora en día:', error, hour)
                  return <div key={hour} className="time-slot"></div>
                }
              })}
            </div>
          </div>
        </div>
      )
    } catch (error) {
      console.error('Error renderizando vista de día:', error)
      return (
        <div className="calendar-day-view">
          <div className="calendar-timezone">GMT-05</div>
          <div className="calendar-day-indicator">
            <div className="day-of-week">Error</div>
            <div className="day-number">!</div>
          </div>
          <div style={{ padding: '20px', color: 'red' }}>
            Error al renderizar la vista de día. Revisa la consola para más detalles.
          </div>
        </div>
      )
    }
  }

  const renderWeekView = () => {
    try {
      const dates = getWeekDates()
      const hours = getHours()

      return (
        <div className="calendar-week-view">
          <div className="calendar-week-header">
            <div className="calendar-timezone-header">GMT-05</div>
            {dates.map((date, idx) => (
              <div key={idx} className="calendar-day-header">
                <div className="day-of-week">{formatDate(date)}</div>
                <div className={`day-number ${isToday(date) ? 'today' : ''}`}>
                  {formatDateNumber(date)}
                </div>
              </div>
            ))}
          </div>
          <div className="calendar-week-grid">
            <div className="calendar-time-column">
              {hours.map((hour) => (
                <div key={hour} className="time-cell">
                  {hour}
                </div>
              ))}
            </div>
            {dates.map((date, idx) => {
              try {
                const horariosDelDia = getHorariosForDate(date)
                const tutoriasDelDia = getTutoriasForDate(date)
                
                return (
                  <div key={idx} className="calendar-day-column">
                    {/* Renderizar bloques de horarios directamente en el calendar-day-column */}
                    {horariosDelDia
                      .filter(horario => horario && horario.horaInicio)
                      .map((horario) => {
                        try {
                          const tutoriasDelHorario = tutoriasDelDia.filter(t => t && t.horarioId === horario.id)
                          const duration = calculateDuration(horario.horaInicio, horario.horaFin, horario.fecha)
                          const absoluteTop = calculateAbsoluteTop(horario.horaInicio)
                          const cuposOcupados = tutoriasDelHorario.length
                          const cuposTotal = horario.cuposDisponibles || 5
                          
                          return (
                            <div 
                              key={horario.id} 
                              className="horario-block"
                              style={{ 
                                height: `${duration}px`,
                                top: `${absoluteTop}px` // Posición absoluta desde el inicio del calendar-day-column
                              }}
                              onClick={() => handleHorarioClick(horario)}
                            >
                              <div className="horario-title">{horario.titulo || 'Horario'}</div>
                              {tutoriasDelHorario.length > 0 && (
                                <div className="horario-cupos-info">
                                  {cuposOcupados}/{cuposTotal}
                                </div>
                              )}
                              <div className="horario-time">
                                {horario.horaInicio} - {horario.horaFin}
                              </div>
                            </div>
                          )
                        } catch (error) {
                          console.warn('Error renderizando horario en semana:', error, horario)
                          return null
                        }
                      })}
                    
                    {/* Renderizar time-slots para la estructura del grid */}
                    {hours.map((hour) => {
                      try {
                        const slotTutorias = getTutoriasForTimeSlot(date, hour)
                        return (
                          <div key={hour} className="time-slot">
                            {/* Mostrar solo tutorías que NO están vinculadas a un horario */}
                            {slotTutorias
                              .filter(tutoria => tutoria && !tutoria.horarioId && tutoria.horaInicio)
                              .map((tutoria) => {
                                try {
                                  const duration = calculateDuration(tutoria.horaInicio, tutoria.horaFin, tutoria.fecha)
                                  const horaParts = tutoria.horaInicio ? tutoria.horaInicio.split(':') : ['0', '0']
                                  const minutos = horaParts[1] ? parseInt(horaParts[1]) : 0
                                  const marginTop = isNaN(minutos) ? 0 : (minutos / 60) * 60
                                  
                                  return (
                                    <div 
                                      key={tutoria.id} 
                                      className="tutoria-block"
                                      style={{ 
                                        height: `${duration}px`,
                                        marginTop: `${marginTop}px`
                                      }}
                                      onClick={() => handleTutoriaClick(tutoria)}
                                    >
                                      <div className="tutoria-title">{tutoria.tema || tutoria.materia || 'Tutoría'}</div>
                                    </div>
                                  )
                                } catch (error) {
                                  console.warn('Error renderizando tutoria en semana:', error, tutoria)
                                  return null
                                }
                              })}
                          </div>
                        )
                      } catch (error) {
                        console.error('Error renderizando hora en semana:', error, hour)
                        return <div key={hour} className="time-slot"></div>
                      }
                    })}
                  </div>
                )
              } catch (error) {
                console.error('Error renderizando día en semana:', error, date)
                return <div key={idx} className="calendar-day-column"></div>
              }
            })}
          </div>
        </div>
      )
    } catch (error) {
      console.error('Error renderizando vista de semana:', error)
      return (
        <div className="calendar-week-view">
          <div style={{ padding: '20px', color: 'red' }}>
            Error al renderizar la vista de semana. Revisa la consola para más detalles.
          </div>
        </div>
      )
    }
  }

  const renderMonthView = () => {
    const dates = getMonthDates()
    const daysOfWeek = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

    return (
      <div className="calendar-month-view">
        <div className="calendar-month-header">
          {daysOfWeek.map((day) => (
            <div key={day} className="month-day-header">{day}</div>
          ))}
        </div>
        <div className="calendar-month-grid">
        {dates.map((date, idx) => {
          try {
            const tutoriasForDate = getTutoriasForDate(date)
            const horariosForDate = getHorariosForDate(date)
            const isCurrentMonthDate = isCurrentMonth(date)
            const isTodayDate = isToday(date)
            
            return (
              <div 
                key={idx} 
                className={`month-day-cell ${!isCurrentMonthDate ? 'other-month' : ''} ${isTodayDate ? 'today' : ''}`}
              >
                <div className="month-day-number">{formatDateNumber(date)}</div>
                <div className="month-day-events">
                  {/* Mostrar horarios con sus tutorías agendadas */}
                  {horariosForDate.map((horario) => {
                    const tutoriasDelHorario = tutoriasForDate.filter(t => t.horarioId === horario.id)
                    const cuposOcupados = tutoriasDelHorario.length
                    const cuposTotal = horario.cuposDisponibles || 5
                    
                    return (
                      <div
                        key={`h-${horario.id}`}
                        className="month-horario-label"
                        onClick={() => handleHorarioClick(horario)}
                      >
                        {horario.titulo || 'Horario'}
                        {tutoriasDelHorario.length > 0 && (
                          <span className="month-cupos-badge"> {cuposOcupados}/{cuposTotal}</span>
                        )}
                      </div>
                    )
                  })}
                  {/* Mostrar solo tutorías que NO están vinculadas a un horario */}
                  {tutoriasForDate
                    .filter(tutoria => !tutoria.horarioId)
                    .map((tutoria) => (
                      <div 
                        key={tutoria.id} 
                        className="month-tutoria-label"
                        onClick={() => handleTutoriaClick(tutoria)}
                      >
                        {tutoria.tema || tutoria.materia || 'Tutoría'}
                      </div>
                    ))}
                </div>
              </div>
            )
          } catch (error) {
            console.error('Error renderizando día del mes:', error, date)
            return (
              <div key={idx} className="month-day-cell">
                <div className="month-day-number">{formatDateNumber(date)}</div>
              </div>
            )
          }
        })}
        </div>
      </div>
    )
  }

  const renderYearView = () => {
    const months = getYearMonths()
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    const daysOfWeek = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

    return (
      <div className="calendar-year-view">
        {months.map((month, monthIdx) => {
          const year = month.getFullYear()
          const monthNum = month.getMonth()
          const firstDay = new Date(year, monthNum, 1)
          const lastDay = new Date(year, monthNum + 1, 0)
          const startDate = new Date(firstDay)
          startDate.setDate(startDate.getDate() - firstDay.getDay())
          
          const monthDates = []
          for (let i = 0; i < 42; i++) {
            const date = new Date(startDate)
            date.setDate(startDate.getDate() + i)
            monthDates.push(date)
          }

          return (
            <div key={monthIdx} className="year-month">
              <div className="year-month-name">{monthNames[monthNum]}</div>
              <div className="year-month-header">
                {daysOfWeek.map((day) => (
                  <div key={day} className="year-day-header">{day}</div>
                ))}
              </div>
              <div className="year-month-grid">
                {monthDates.map((date, dateIdx) => {
                  try {
                    const tutoriasForDate = getTutoriasForDate(date)
                    const horariosForDate = getHorariosForDate(date)
                    const isCurrentMonthDate = date.getMonth() === monthNum
                    const isTodayDate = isToday(date)
                    
                    return (
                      <div 
                        key={dateIdx} 
                        className={`year-day-cell ${!isCurrentMonthDate ? 'other-month' : ''} ${isTodayDate ? 'today' : ''}`}
                      >
                        <div className="year-day-number-inner">
                          {isTodayDate ? (
                            <div className="year-day-badge">{formatDateNumber(date)}</div>
                          ) : (
                            <div className="year-day-number-text">{formatDateNumber(date)}</div>
                          )}
                          <div className="year-day-dots">
                            {tutoriasForDate.length > 0 && (
                              <button
                                className="year-day-dot tutoria"
                                title={`${tutoriasForDate.length} tutoría(s)`}
                                onClick={() => handleTutoriaClick(tutoriasForDate[0])}
                              />
                            )}
                            {horariosForDate.length > 0 && (
                              <button
                                className="year-day-dot horario"
                                title={`${horariosForDate.length} horario(s)`}
                                onClick={() => handleHorarioClick(horariosForDate[0])}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  } catch (error) {
                    console.error('Error renderizando día del año:', error, date)
                    return (
                      <div key={dateIdx} className="year-day-cell">
                        <div className="year-day-number-inner">
                          <div className="year-day-number-text">{formatDateNumber(date)}</div>
                        </div>
                      </div>
                    )
                  }
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Manejo de estados de carga y error
  if (loading) {
    return (
      <div className="horarios-page">
        <div className="page-header">
          <div>
            <h1>Horarios y Tutorías</h1>
            <p>Cargando datos desde la API...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="horarios-page">
        <div className="page-header">
          <div>
            <h1>Horarios y Tutorías</h1>
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
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="horarios-page">
      <div className="page-header">
        <div>
          <h1>Horarios y Tutorías</h1>
          <p>Gestiona tus horarios y tutorías programadas</p>
        </div>
        <div className="header-buttons">
          <button className="btn-secondary" onClick={() => setShowHorarioForm(true)}>
            + Nuevo Horario
          </button>
        </div>
      </div>

      {(showHorarioForm || horarioToEdit) && (
        <FormularioHorario
          horario={horarioToEdit}
          onClose={() => {
            setShowHorarioForm(false)
            setHorarioToEdit(null)
          }}
          onSave={() => {
            setShowHorarioForm(false)
            setHorarioToEdit(null)
          }}
        />
      )}

      {selectedTutoria && (
        <TutoriaDetailModal
          tutoria={selectedTutoria}
          onClose={() => setSelectedTutoria(null)}
          onEdit={() => {}}
        />
      )}

      {selectedHorario && (
        <HorarioDetailModal
          horario={selectedHorario}
          onClose={() => setSelectedHorario(null)}
          onEdit={(horario) => {
            setHorarioToEdit(horario)
            setSelectedHorario(null)
          }}
          onDelete={async (id) => {
            if (window.confirm('¿Estás seguro de que deseas eliminar este horario?')) {
              try {
                await deleteHorario(id)
                setSelectedHorario(null)
              } catch (error) {
                alert(`Error: ${error.message || 'No se pudo eliminar el horario'}`)
              }
            }
          }}
        />
      )}

      <div className="calendar-section">
        <div className="calendar-header">
          <div className="calendar-nav">
            <button onClick={goToToday} className="nav-btn today-btn">Hoy</button>
            <button onClick={() => navigateDate(-1)} className="nav-btn">‹</button>
            <button onClick={() => navigateDate(1)} className="nav-btn">›</button>
            <span className="date-range">
              {viewMode === 'dia' && formatDayDate()}
              {viewMode === 'semana' && formatMonthYear()}
              {viewMode === 'mes' && formatMonthYear()}
              {viewMode === 'año' && currentDate.getFullYear()}
            </span>
          </div>
          <div className="calendar-header-right">
            <div className="calendar-legend">
              <div className="legend-item">
                <div className="legend-color legend-horario"></div>
                <span className="legend-text">Horarios</span>
              </div>
              <div className="legend-item">
                <div className="legend-color legend-tutoria"></div>
                <span className="legend-text">Tutorías</span>
              </div>
            </div>
            <div className="calendar-actions">
              <select 
                value={viewMode} 
                onChange={(e) => setViewMode(e.target.value)}
                className="view-select"
              >
                <option value="dia">Día</option>
                <option value="semana">Semana</option>
                <option value="mes">Mes</option>
                <option value="año">Año</option>
              </select>
            </div>
          </div>
        </div>

        {viewMode === 'dia' && renderDayView()}
        {viewMode === 'semana' && renderWeekView()}
        {viewMode === 'mes' && renderMonthView()}
        {viewMode === 'año' && renderYearView()}
      </div>
    </div>
  )
}

export default Horarios
