import React, { useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { useToast } from './ui/Feedback'
import { getErrorMessage } from '../lib/apiClient'
import './FormularioDocente.css'
import Icon from './ui/Icon'

const TODOS_LOS_ROLES = ['Docente', 'Tutor', 'Administrador', 'Auxiliar']

/**
 * Alta/edición de personal. `rolInicial` preselecciona el rol al crear («Nuevo Tutor»).
 * `rolesPermitidos` limita el selector: el Auxiliar solo asigna Docente o Tutor (403 en el servidor si no).
 */
const FormularioDocente = ({ docente, onClose, onSave, rolInicial = 'Docente', rolesPermitidos = TODOS_LOS_ROLES }) => {
  const { addDocente, updateDocente } = useData()
  const toast = useToast()
  const [verContrasena, setVerContrasena] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    correo: '',
    contrasena: '',
    rol: rolesPermitidos.includes(rolInicial) ? rolInicial : rolesPermitidos[0],
  })
  const [guardando, setGuardando] = useState(false)
  const esEdicion = Boolean(docente)
  // El título sigue al rol elegido: «Nuevo Tutor», «Editar Docente»…
  const titulo = (esEdicion ? 'Editar ' : 'Nuevo ') + formData.rol

  useEffect(() => {
    if (docente) {
      setFormData({
        nombre: docente.nombres || docente.nombre || '',
        apellido: docente.apellidos || docente.apellido || '',
        correo: docente.correo || docente.email || '',
        contrasena: '',
        rol: docente.rol || rolesPermitidos[0],
      })
    }
  }, [docente])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      if (docente) {
        await updateDocente(docente.id, formData)
      } else {
        await addDocente(formData)
      }
      onSave()
    } catch (error) {
      // 403 del servidor (rol no permitido para el Auxiliar) y validaciones: su mensaje tal cual
      toast.error(getErrorMessage(error, 'No se pudo guardar el usuario.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="formulario-docente-overlay">
      <div className="formulario-docente" role="dialog" aria-modal="true" aria-labelledby="fd-titulo">
        <div className="formulario-docente-header">
          <h2 id="fd-titulo">{titulo}</h2>
        </div>
        <form onSubmit={handleSubmit} className="formulario-docente-form">
          <div className="form-group">
            <label htmlFor="fd-nombre">Nombre *</label>
            <input
              type="text"
              id="fd-nombre"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ej: Juan"
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="fd-apellido">Apellido *</label>
            <input
              type="text"
              id="fd-apellido"
              name="apellido"
              value={formData.apellido}
              onChange={handleChange}
              placeholder="Ej: Pérez"
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="fd-correo">Correo *</label>
            <input
              type="email"
              id="fd-correo"
              name="correo"
              value={formData.correo}
              onChange={handleChange}
              placeholder="ejemplo@correo.com"
              required
              autoComplete="off"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="fd-contrasena">Contraseña{esEdicion ? '' : ' *'}</label>
            <div className="fd-password">
              <input
                type={verContrasena ? 'text' : 'password'}
                id="fd-contrasena"
                name="contrasena"
                value={formData.contrasena}
                onChange={handleChange}
                placeholder={esEdicion ? 'Sin cambios' : '••••••••'}
                required={!esEdicion}
                aria-describedby={esEdicion ? 'fd-contrasena-ayuda' : undefined}
                autoComplete="new-password"
                spellCheck={false}
                className="form-input"
              />
              <button
                type="button"
                className="icon-btn fd-password__toggle"
                onClick={() => setVerContrasena((v) => !v)}
                aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={verContrasena}
                aria-controls="fd-contrasena"
                title={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Icon name={verContrasena ? 'eyeOff' : 'eye'} size={18} />
              </button>
            </div>
            {esEdicion && <p className="fd-ayuda" id="fd-contrasena-ayuda">Déjala vacía para conservar la contraseña actual.</p>}
          </div>

          <div className="form-group">
            <label htmlFor="fd-rol">Rol *</label>
            <select
              id="fd-rol"
              name="rol"
              value={formData.rol}
              onChange={handleChange}
              required
              className="form-input"
            >
              {rolesPermitidos.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              <Icon name="close" size={18} /> Cancelar
            </button>
            <button type="submit" className="btn-save" disabled={guardando} aria-busy={guardando}>
              <Icon name="save" size={18} /> {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default FormularioDocente





