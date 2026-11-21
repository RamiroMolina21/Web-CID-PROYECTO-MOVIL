import React, { useId } from 'react'
import Icon from './Icon'

/**
 * Información adicional bajo demanda: un botón "i" que muestra una nota al pasar el ratón o al enfocarlo.
 * La nota también describe el botón (aria-describedby), así que el lector de pantalla la lee sin abrir nada.
 */
const Hint = ({ label, children, align = 'end' }) => {
  const id = useId()
  return (
    <span className={`hint hint--${align}`}>
      <button type="button" className="hint__btn" aria-label={`Más información: ${label}`} aria-describedby={id}>
        <Icon name="info" size={14} />
      </button>
      <span role="tooltip" id={id} className="hint__pop">{children}</span>
    </span>
  )
}

export default Hint
