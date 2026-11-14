import React, { useId, useMemo, useState } from 'react'
import Icon from '../../components/ui/Icon'
import { iniciales, nombreCompleto } from '../../lib/roles'

const normalizar = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/**
 * Selección de estudiantes con búsqueda y tope de cupos.
 * @param {{ estudiantes: object[], seleccion: number[], onChange: (ids:number[]) => void,
 *           max: number|null, excluidos?: number[], ocupados?: number }} props
 *  - max: cupos disponibles para esta selección (null = sin límite conocido)
 */
const StudentPicker = ({ estudiantes, seleccion, onChange, max, excluidos = [], label = 'Estudiantes' }) => {
  const [query, setQuery] = useState('')
  const searchId = useId()
  const countId = useId()

  const disponibles = useMemo(
    () => estudiantes.filter((e) => !excluidos.includes(e.idUsuario)),
    [estudiantes, excluidos]
  )

  const filtrados = useMemo(() => {
    const q = normalizar(query.trim())
    if (!q) return disponibles
    return disponibles.filter((e) =>
      normalizar(`${nombreCompleto(e)} ${e.correo}`).includes(q)
    )
  }, [disponibles, query])

  const lleno = max != null && seleccion.length >= max

  const toggle = (id) => {
    if (seleccion.includes(id)) onChange(seleccion.filter((x) => x !== id))
    else if (!lleno) onChange([...seleccion, id])
  }

  return (
    <div className="picker">
      <div className="picker__head">
        <div className="search-field">
          <Icon name="search" size={18} />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o correo"
            aria-label={`Buscar ${label.toLowerCase()}`}
            aria-describedby={countId}
          />
        </div>
        <p className="picker__count" id={countId} aria-live="polite">
          <strong>{seleccion.length}</strong>
          {max != null ? ` de ${max} seleccionados` : ' seleccionados'}
        </p>
      </div>

      {lleno && (
        <p className="banner banner--info picker__notice" role="status">
          <Icon name="info" size={18} />
          <span>Alcanzaste el cupo máximo. Quita a alguien para elegir a otra persona.</span>
        </p>
      )}

      {disponibles.length === 0 ? (
        <p className="picker__empty">No hay estudiantes disponibles para agregar.</p>
      ) : filtrados.length === 0 ? (
        <p className="picker__empty">Ningún estudiante coincide con “{query}”.</p>
      ) : (
        <ul className="picker__list" aria-label={label}>
          {filtrados.map((e) => {
            const checked = seleccion.includes(e.idUsuario)
            const disabled = !checked && lleno
            const nombre = nombreCompleto(e) || e.correo
            return (
              <li key={e.idUsuario}>
                <label className={`picker__item${checked ? ' is-checked' : ''}${disabled ? ' is-disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(e.idUsuario)}
                  />
                  <span className="avatar" aria-hidden="true">{iniciales(nombre)}</span>
                  <span className="picker__text">
                    <span className="picker__name">{nombre}</span>
                    <span className="picker__mail">{e.correo}</span>
                  </span>
                  <span className="picker__check" aria-hidden="true">
                    <Icon name={checked ? 'check' : 'plus'} size={18} />
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default StudentPicker
