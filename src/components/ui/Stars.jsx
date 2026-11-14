import React from 'react'
import Icon from './Icon'

const fmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })

/**
 * Calificación de 0 a 5 con estrellas SVG (admite fracciones: 3,5 → tres y media).
 * Es una sola imagen accesible ("3,5 de 5"); las estrellas son decorativas.
 */
const Stars = ({ value = 0, size = 16, className = '', label }) => {
  const v = Math.max(0, Math.min(5, Number(value) || 0))
  return (
    <span className={`stars-display ${className}`.trim()} role="img" aria-label={label || `${fmt.format(v)} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, v - (n - 1)))
        return (
          <span key={n} className="stars-display__item" style={{ width: size, height: size }}>
            <Icon name="star" size={size} className="stars-display__empty" />
            {fill > 0 && (
              <span className="stars-display__fill" style={{ width: `${fill * 100}%` }}>
                <Icon name="star" size={size} fill="currentColor" />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

export default Stars
