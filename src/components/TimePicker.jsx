import React, { useState, useRef, useEffect } from 'react'
import './TimePicker.css'

const TimePicker = ({ value, onChange, name, placeholder = '--:--' }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedHour, setSelectedHour] = useState(12)
  const [selectedMinute, setSelectedMinute] = useState(0)
  const [selectedPeriod, setSelectedPeriod] = useState('AM')
  const pickerRef = useRef(null)
  const hourRef = useRef(null)
  const minuteRef = useRef(null)
  const periodRef = useRef(null)

  // Parsear el valor inicial (formato HH:MM)
  useEffect(() => {
    if (value) {
      const [hour, minute] = value.split(':').map(Number)
      if (!isNaN(hour) && !isNaN(minute)) {
        let h = hour
        let period = 'AM'
        
        if (hour === 0) {
          h = 12
          period = 'AM'
        } else if (hour === 12) {
          h = 12
          period = 'PM'
        } else if (hour > 12) {
          h = hour - 12
          period = 'PM'
        }
        
        setSelectedHour(h)
        setSelectedMinute(minute)
        setSelectedPeriod(period)
      }
    }
  }, [value])

  // Cerrar el picker al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // Scroll automático a los valores seleccionados
      setTimeout(() => {
        if (hourRef.current) {
          const selectedElement = hourRef.current.querySelector('.selected')
          if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
        }
        if (minuteRef.current) {
          const selectedElement = minuteRef.current.querySelector('.selected')
          if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
        }
        if (periodRef.current) {
          const selectedElement = periodRef.current.querySelector('.selected')
          if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
        }
      }, 100)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, selectedHour, selectedMinute, selectedPeriod])

  // Generar arrays de horas, minutos y períodos
  const hours = Array.from({ length: 12 }, (_, i) => i + 1)
  const minutes = Array.from({ length: 60 }, (_, i) => i)
  const periods = ['AM', 'PM']

  // Convertir a formato 24 horas
  const convertTo24Hour = (hour, period) => {
    if (period === 'AM') {
      return hour === 12 ? 0 : hour
    } else {
      return hour === 12 ? 12 : hour + 12
    }
  }

  // Formatear hora para mostrar (HH:MM formato 12 horas)
  const formatDisplayTime = (hour, minute, period) => {
    const h = hour.toString().padStart(2, '0')
    const m = minute.toString().padStart(2, '0')
    return `${h}:${m} ${period}`
  }

  // Formatear hora para el input (HH:MM formato 24 horas)
  const formatInputTime = (hour, minute, period) => {
    const h24 = convertTo24Hour(hour, period)
    const h = h24.toString().padStart(2, '0')
    const m = minute.toString().padStart(2, '0')
    return `${h}:${m}`
  }

  const handleHourChange = (hour) => {
    setSelectedHour(hour)
    const newTime = formatInputTime(hour, selectedMinute, selectedPeriod)
    onChange({ target: { name, value: newTime } })
  }

  const handleMinuteChange = (minute) => {
    setSelectedMinute(minute)
    const newTime = formatInputTime(selectedHour, minute, selectedPeriod)
    onChange({ target: { name, value: newTime } })
  }

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period)
    const newTime = formatInputTime(selectedHour, selectedMinute, period)
    onChange({ target: { name, value: newTime } })
  }

  const displayValue = value 
    ? formatDisplayTime(selectedHour, selectedMinute, selectedPeriod)
    : placeholder

  return (
    <div className="time-picker-wrapper" ref={pickerRef}>
      <div 
        className="time-picker-input"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={value ? 'time-picker-value' : 'time-picker-placeholder'}>
          {displayValue}
        </span>
      </div>
      
      {isOpen && (
        <div className="time-picker-dropdown">
          <div className="time-picker-columns">
            {/* Columna de Horas */}
            <div className="time-picker-column">
              <div className="time-picker-column-header">Hora</div>
              <div className="time-picker-scrollable" ref={hourRef}>
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className={`time-picker-option ${
                      selectedHour === hour ? 'selected' : ''
                    }`}
                    onClick={() => handleHourChange(hour)}
                  >
                    {hour.toString().padStart(2, '0')}
                  </div>
                ))}
              </div>
            </div>

            {/* Columna de Minutos */}
            <div className="time-picker-column">
              <div className="time-picker-column-header">Minuto</div>
              <div className="time-picker-scrollable" ref={minuteRef}>
                {minutes.map((minute) => (
                  <div
                    key={minute}
                    className={`time-picker-option ${
                      selectedMinute === minute ? 'selected' : ''
                    }`}
                    onClick={() => handleMinuteChange(minute)}
                  >
                    {minute.toString().padStart(2, '0')}
                  </div>
                ))}
              </div>
            </div>

            {/* Columna de AM/PM */}
            <div className="time-picker-column">
              <div className="time-picker-column-header">Período</div>
              <div className="time-picker-scrollable" ref={periodRef}>
                {periods.map((period) => (
                  <div
                    key={period}
                    className={`time-picker-option ${
                      selectedPeriod === period ? 'selected' : ''
                    }`}
                    onClick={() => handlePeriodChange(period)}
                  >
                    {period === 'AM' ? 'a. m.' : 'p. m.'}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TimePicker

