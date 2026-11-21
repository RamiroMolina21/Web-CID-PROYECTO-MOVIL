import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../context/DataContext'
import './FormularioHorario.css'
import Icon from './ui/Icon'
import { DIAS_SEMANA, franjaTexto, generarSesiones, fechaCorta, minutos, seSolapan } from '../features/horarios/disponibilidad'

// Tope de sesiones por envío: evita crear cientos de filas por un rango mal escrito.
const MAX_SESIONES = 200

// Orden visual de los campos: el foco va al primer campo con error en este orden.
const ORDEN_CAMPOS = ['fecha', 'fechaFin', 'dias', 'horaInicio', 'horaFin', ...DIAS_SEMANA.map((d) => `franja-${d.key}`), 'docenteId', 'salon']
const ID_CAMPO = {
  docenteId: 'fh-docenteId',
  fecha: 'fh-fecha',
  fechaFin: 'fh-fechaFin',
  horaInicio: 'fh-horaInicio',
  horaFin: 'fh-horaFin',
  dias: 'fh-dia-lunes',
  salon: 'fh-salon',
  ...Object.fromEntries(DIAS_SEMANA.map((d) => [`franja-${d.key}`, `fh-franja-${d.key}-inicio`])),
}

const ErrorCampo = ({ id, mensaje }) => (mensaje ? <p className="fh-field__error" id={id}>{mensaje}</p> : null)

/**
 * Alta y edición de horarios: 1) fecha de la sesión (una fecha, o "Repetir este horario" con rango y días),
 * 2) horario (inicio/fin, o una franja por día con vista previa), 3) detalles (docente y aula opcional).
 * Sin cupos: la capacidad se define al agendar la tutoría (TutoriaCreate.cupos). Crear "una fecha" genera una sesión; "recurrente",
 * una sesión por cada día elegido dentro del rango. Editar cambia solo esa sesión.
 * Sin campo "título": el servidor lo genera ("{aula} · dd/MM/yyyy HH:mm–HH:mm", o sin aula
 * "dd/MM/yyyy HH:mm–HH:mm") y lo regenera al editar si era generado; los escritos a mano se conservan.
 */
const FormularioHorario = ({ horario, onClose, onSave }) => {
  const { addHorario, updateHorario, horarios, docentes } = useData()
  const editando = Boolean(horario)
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [isRecurrente, setIsRecurrente] = useState(false)
  const [diasSeleccionados, setDiasSeleccionados] = useState(() => Object.fromEntries(DIAS_SEMANA.map((d) => [d.key, false])))
  // Recurrente: una franja horaria por cada día elegido (p. ej. Mar 9:00–11:00, Mié 16:00–18:00)
  const [franjas, setFranjas] = useState({})
  const [progreso, setProgreso] = useState(null)
  const [formData, setFormData] = useState({
    docenteId: horario?.docenteId || '',
    fecha: horario?.fecha || '',
    fechaFin: horario?.fechaFin || horario?.fecha || '',
    horaInicio: horario?.horaInicio || '',
    horaFin: horario?.horaFin || '',
    salon: horario?.salon || '',
    notas: horario?.notas || '',
    disponible: true,
  })
  const primerCampo = useRef(null)
  const generalRef = useRef(null)

  useEffect(() => {
    primerCampo.current?.focus()
  }, [])

  const limpiarError = (campo) => {
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    limpiarError(name)
  }

  const handleDiaChange = (dia) => {
    const activo = !diasSeleccionados[dia]
    setDiasSeleccionados((prev) => ({ ...prev, [dia]: activo }))
    limpiarError('dias')
    // Al activar un día se propone la última franja usada (o la general) para escribir menos
    if (activo && !franjas[dia]) {
      const ultima = Object.values(franjas).filter((x) => x.inicio || x.fin).pop()
      setFranjas((prev) => ({
        ...prev,
        [dia]: ultima ? { ...ultima } : { inicio: formData.horaInicio || '', fin: formData.horaFin || '' },
      }))
    }
  }

  const setFranja = (dia, campo, valor) => {
    setFranjas((prev) => ({ ...prev, [dia]: { ...prev[dia], [campo]: valor } }))
    limpiarError(`franja-${dia}`)
  }

  // Franjas de los días activos y sesiones que se generarán (vista previa)
  const franjasActivas = useMemo(
    () => Object.fromEntries(DIAS_SEMANA.filter((d) => diasSeleccionados[d.key]).map((d) => [d.key, franjas[d.key] || { inicio: '', fin: '' }])),
    [diasSeleccionados, franjas]
  )
  const sesionesPrevistas = useMemo(
    () => (isRecurrente ? generarSesiones(formData.fecha, formData.fechaFin, franjasActivas) : []),
    [isRecurrente, formData.fecha, formData.fechaFin, franjasActivas]
  )
  const cuentaPorDia = useMemo(() => {
    const c = {}
    for (const s of sesionesPrevistas) c[s.dia] = (c[s.dia] || 0) + 1
    return c
  }, [sesionesPrevistas])
  const diasActivos = DIAS_SEMANA.filter((d) => diasSeleccionados[d.key])

  /**
   * Solape con otro horario el mismo día del MISMO docente o en la MISMA aula (solo si ambos tienen aula:
   * dos horarios "sin aula" no chocan por eso).
   */
  const buscarConflicto = (fecha, horaInicio, horaFin) =>
    horarios.find((h) => {
      if (horario && h.id === horario.id) return false
      if (!h.fecha || !h.horaInicio || !h.horaFin || h.fecha.slice(0, 10) !== fecha) return false
      const mismoDocente = formData.docenteId && String(h.docenteId) === String(formData.docenteId)
      const mismaAula = Boolean(formData.salon.trim()) && (h.salon || '').trim().toLowerCase() === formData.salon.trim().toLowerCase()
      return (mismoDocente || mismaAula) && seSolapan(horaInicio, horaFin, h.horaInicio, h.horaFin)
    })

  const describirConflicto = (fecha, c) =>
    `El ${fechaCorta(fecha)} ya hay un horario ${String(c.docenteId) === String(formData.docenteId) ? 'de este docente' : 'en esa aula'} de ${franjaTexto(c.horaInicio, c.horaFin)}.`

  /** Muestra errores junto a sus campos y lleva el foco al primero (en orden visual). */
  const mostrarErrores = (er) => {
    setErrores(er)
    const primero = ORDEN_CAMPOS.find((k) => er[k])
    if (primero) requestAnimationFrame(() => document.getElementById(ID_CAMPO[primero])?.focus())
  }

  const mostrarGeneral = (msg) => {
    setErrorGeneral(msg)
    requestAnimationFrame(() => generalRef.current?.focus())
  }

  const validar = () => {
    const er = {}
    if (!formData.docenteId) er.docenteId = 'Elige el docente o tutor.'
    if (!formData.fecha) er.fecha = isRecurrente ? 'Indica desde qué fecha.' : 'Indica la fecha.'
    if (isRecurrente) {
      if (!formData.fechaFin) er.fechaFin = 'Indica hasta qué fecha.'
      else if (formData.fecha && formData.fechaFin < formData.fecha) er.fechaFin = 'Debe ser igual o posterior a la fecha de inicio.'
      if (diasActivos.length === 0) er.dias = 'Elige al menos un día de la semana.'
      for (const d of diasActivos) {
        const fr = franjasActivas[d.key]
        if (!fr.inicio || !fr.fin) er[`franja-${d.key}`] = `Indica la hora de inicio y de fin del ${d.label.toLowerCase()}.`
        else if (minutos(fr.inicio) >= minutos(fr.fin)) er[`franja-${d.key}`] = `En ${d.label.toLowerCase()} la hora de fin debe ser posterior a la de inicio.`
      }
    } else {
      if (!formData.horaInicio) er.horaInicio = 'Indica la hora de inicio.'
      if (!formData.horaFin) er.horaFin = 'Indica la hora de fin.'
      else if (formData.horaInicio && minutos(formData.horaInicio) >= minutos(formData.horaFin)) er.horaFin = 'La hora de fin debe ser posterior a la de inicio.'
    }
    return er
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorGeneral('')
    const er = validar()
    if (Object.values(er).some(Boolean)) {
      mostrarErrores(er)
      return
    }
    setErrores({})

    if (isRecurrente) {
      if (sesionesPrevistas.length === 0) return mostrarGeneral('Ninguno de los días elegidos cae dentro del rango de fechas.')
      if (sesionesPrevistas.length > MAX_SESIONES) {
        return mostrarGeneral(`Se generarían ${sesionesPrevistas.length} sesiones; el máximo por vez es ${MAX_SESIONES}. Acorta el rango de fechas.`)
      }
      for (const s of sesionesPrevistas) {
        const c = buscarConflicto(s.fecha, s.inicio, s.fin)
        if (c) return mostrarGeneral(describirConflicto(s.fecha, c))
      }
      // Una fila Horario por sesión, cada una con la franja de su día
      setProgreso({ hechas: 0, total: sesionesPrevistas.length })
      let hechas = 0
      try {
        for (const s of sesionesPrevistas) {
          await addHorario({ ...formData, fecha: s.fecha, fechaFin: formData.fechaFin, horaInicio: s.inicio, horaFin: s.fin, disponible: true })
          hechas += 1
          setProgreso({ hechas, total: sesionesPrevistas.length })
        }
        onSave()
      } catch (err) {
        mostrarGeneral(`Se crearon ${hechas} de ${sesionesPrevistas.length} sesiones. ${err.message || 'No se pudo guardar el horario.'}`)
      } finally {
        setProgreso(null)
      }
      return
    }

    // Una fecha (crear o editar esa sesión)
    const c = buscarConflicto(formData.fecha, formData.horaInicio, formData.horaFin)
    if (c) return mostrarGeneral(describirConflicto(formData.fecha, c))

    setProgreso({ hechas: 0, total: 1 })
    try {
      // Crear: una sesión (fin = fecha). Editar: se conserva la "vigencia" original de la fila (fechaFin),
      // como hacía el formulario anterior, para no alterar el título generado ni otros datos de la serie.
      const datos = { ...formData, fechaFin: editando ? formData.fechaFin || formData.fecha : formData.fecha, disponible: true }
      if (editando) await updateHorario(horario.id, datos)
      else await addHorario(datos)
      onSave()
    } catch (err) {
      mostrarGeneral(err.message || 'No se pudo guardar el horario.')
    } finally {
      setProgreso(null)
    }
  }

  const docentesVisibles = (docentes || []).filter((d) => d.activo !== false || String(d.id) === String(formData.docenteId))
  const nombreDocente = (d) =>
    d.nombre || (d.nombres && d.apellidos ? `${d.nombres} ${d.apellidos}`.trim() : d.nombres || `Docente ${d.id}`)
  const describe = (...ids) => ids.filter(Boolean).join(' ') || undefined
  const guardando = Boolean(progreso)

  // Campo con icono a la izquierda (fecha, hora, docente, aula) dentro de un input tipo píldora
  const conIcono = (icon, children, select = false) => (
    <div className={`fh-control${select ? ' fh-control--select' : ''}`}>
      <Icon name={icon} size={18} className="fh-control__icon" />
      {children}
      {select && <Icon name="chevronDown" size={18} className="fh-control__chevron" />}
    </div>
  )
  const req = <span className="fh-req" aria-hidden="true">*</span>

  return (
    <div className="formulario-overlay">
      <div className="formulario-horario fh" role="dialog" aria-modal="true" aria-labelledby="fh-titulo" aria-describedby="fh-subtitulo">
        <div className="formulario-header fh__header">
          <h2 id="fh-titulo">{editando ? 'Editar horario' : 'Nuevo horario'}</h2>
          {editando && horario?.titulo ? (
            <p className="fh__subtitulo" id="fh-subtitulo">
              <strong>{horario.titulo}</strong>
              <span> · El título se genera solo a partir del aula, la fecha y la hora.</span>
            </p>
          ) : (
            <p className="fh__subtitulo" id="fh-subtitulo">
              {editando ? 'Ajusta la fecha, la hora o los detalles de esta sesión.' : 'Configura la fecha, hora y disponibilidad de la sesión.'}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="fh__form" noValidate>
          <div className="fh__body">
            {errorGeneral && (
              <div className="form-error fh__general" role="alert" tabIndex={-1} ref={generalRef}>
                <Icon name="alert" size={18} />
                <span>{errorGeneral}</span>
              </div>
            )}

            {/* 1) Fecha de la sesión */}
            <fieldset className="fh-section">
              <legend className="fh-section__legend">1. Fecha de la sesión</legend>
              <div className="fh-grid">
                <div className="fh-field">
                  <label htmlFor="fh-fecha" className="fh-field__label">{isRecurrente ? 'Fecha de inicio' : 'Fecha'} {req}</label>
                  {conIcono('calendar',
                    <input
                      ref={primerCampo}
                      type="date" id="fh-fecha" name="fecha" className="fh-input" value={formData.fecha} onChange={handleChange}
                      aria-required="true" aria-invalid={!!errores.fecha} aria-describedby={describe(errores.fecha && 'fh-fecha-error')}
                    />
                  )}
                  <ErrorCampo id="fh-fecha-error" mensaje={errores.fecha} />
                </div>
                {isRecurrente && (
                  <div className="fh-field">
                    <label htmlFor="fh-fechaFin" className="fh-field__label">Fecha de fin {req}</label>
                    {conIcono('calendar',
                      <input
                        type="date" id="fh-fechaFin" name="fechaFin" className="fh-input" value={formData.fechaFin} min={formData.fecha || undefined}
                        onChange={handleChange} aria-required="true" aria-invalid={!!errores.fechaFin}
                        aria-describedby={describe(errores.fechaFin && 'fh-fechaFin-error')}
                      />
                    )}
                    <ErrorCampo id="fh-fechaFin-error" mensaje={errores.fechaFin} />
                  </div>
                )}
              </div>

              {!editando && (
                <label className="fh-switch">
                  <input
                    type="checkbox"
                    role="switch"
                    id="fh-repetir"
                    checked={isRecurrente}
                    aria-describedby="fh-repetir-ayuda"
                    onChange={(e) => { setIsRecurrente(e.target.checked); setErrores({}); setErrorGeneral('') }}
                  />
                  <span className="fh-switch__track" aria-hidden="true"><span className="fh-switch__thumb" /></span>
                  <span className="fh-switch__texto">
                    <span className="fh-switch__label">Repetir este horario</span>
                    <span className="fh-switch__ayuda" id="fh-repetir-ayuda">
                      {isRecurrente ? 'Se crea una sesión por cada día elegido entre las dos fechas.' : 'Desactivado: se crea una sola sesión en esa fecha.'}
                    </span>
                  </span>
                </label>
              )}

              {isRecurrente && (
                <div className="fh-field" role="group" aria-labelledby="fh-dias-label" aria-describedby={describe(errores.dias && 'fh-dias-error')}>
                  <span id="fh-dias-label" className="fh-field__label">Días de la semana {req}</span>
                  <div className="fh-dias">
                    {DIAS_SEMANA.map((dia) => (
                      <label key={dia.key} className={`fh-dia${diasSeleccionados[dia.key] ? ' is-activo' : ''}`} title={dia.label}>
                        <input
                          type="checkbox"
                          id={`fh-dia-${dia.key}`}
                          checked={diasSeleccionados[dia.key]}
                          onChange={() => handleDiaChange(dia.key)}
                        />
                        <span aria-hidden="true">{dia.corto}</span>
                        <span className="sr-only">{dia.label}</span>
                      </label>
                    ))}
                  </div>
                  <ErrorCampo id="fh-dias-error" mensaje={errores.dias} />
                </div>
              )}
            </fieldset>

            {/* 2) Horario */}
            <fieldset className="fh-section">
              <legend className="fh-section__legend">2. Horario</legend>
              {!isRecurrente ? (
                <div className="fh-grid">
                  <div className="fh-field">
                    <label htmlFor="fh-horaInicio" className="fh-field__label">Hora de inicio {req}</label>
                    {conIcono('clock',
                      <input
                        type="time" step="300" id="fh-horaInicio" name="horaInicio" className="fh-input"
                        value={formData.horaInicio} onChange={handleChange} aria-required="true"
                        aria-invalid={!!errores.horaInicio} aria-describedby={describe(errores.horaInicio && 'fh-horaInicio-error')}
                      />
                    )}
                    <ErrorCampo id="fh-horaInicio-error" mensaje={errores.horaInicio} />
                  </div>
                  <div className="fh-field">
                    <label htmlFor="fh-horaFin" className="fh-field__label">Hora de fin {req}</label>
                    {conIcono('clock',
                      <input
                        type="time" step="300" id="fh-horaFin" name="horaFin" className="fh-input"
                        value={formData.horaFin} onChange={handleChange} aria-required="true"
                        aria-invalid={!!errores.horaFin} aria-describedby={describe(errores.horaFin && 'fh-horaFin-error')}
                      />
                    )}
                    <ErrorCampo id="fh-horaFin-error" mensaje={errores.horaFin} />
                  </div>
                </div>
              ) : diasActivos.length === 0 ? (
                <p className="fh-vacio">Elige los días de la semana y aquí indicarás la franja horaria de cada uno.</p>
              ) : (
                <>
                  <div className="fh-franjas">
                    {diasActivos.map((d) => {
                      const err = errores[`franja-${d.key}`]
                      const errId = `fh-franja-${d.key}-error`
                      return (
                        <div key={d.key} className="fh-franja">
                          <span className="fh-franja__dia">{d.label}</span>
                          {conIcono('clock',
                            <input
                              type="time" step="300" id={`fh-franja-${d.key}-inicio`} className="fh-input"
                              value={franjasActivas[d.key].inicio} onChange={(e) => setFranja(d.key, 'inicio', e.target.value)}
                              aria-label={`${d.label}: hora de inicio`} aria-invalid={!!err} aria-describedby={describe(err && errId)}
                            />
                          )}
                          {conIcono('clock',
                            <input
                              type="time" step="300" className="fh-input"
                              value={franjasActivas[d.key].fin} onChange={(e) => setFranja(d.key, 'fin', e.target.value)}
                              aria-label={`${d.label}: hora de fin`} aria-invalid={!!err} aria-describedby={describe(err && errId)}
                            />
                          )}
                          <ErrorCampo id={errId} mensaje={err} />
                        </div>
                      )
                    })}
                  </div>

                  <section className="recurrencia-preview fh-preview" aria-labelledby="fh-preview-titulo">
                    <h3 id="fh-preview-titulo">Vista previa</h3>
                    <table className="recurrencia-tabla">
                      <thead>
                        <tr>
                          <th scope="col">Día</th>
                          <th scope="col">Horario disponible</th>
                          <th scope="col" className="num">Sesiones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diasActivos.map((d) => {
                          const fr = franjasActivas[d.key]
                          const valida = fr.inicio && fr.fin && minutos(fr.inicio) < minutos(fr.fin)
                          return (
                            <tr key={d.key}>
                              <th scope="row">{d.label}</th>
                              <td className={valida ? '' : 'pendiente'}>{valida ? franjaTexto(fr.inicio, fr.fin) : 'Falta la franja'}</td>
                              <td className="num">{cuentaPorDia[d.key] || 0}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <p className="recurrencia-total" aria-live="polite">
                      {sesionesPrevistas.length > 0
                        ? `Se crearán ${sesionesPrevistas.length} ${sesionesPrevistas.length === 1 ? 'sesión' : 'sesiones'} entre el ${fechaCorta(formData.fecha)} y el ${fechaCorta(formData.fechaFin)}.`
                        : 'Ninguno de los días elegidos cae dentro del rango de fechas.'}
                    </p>
                  </section>
                </>
              )}
            </fieldset>

            {/* 3) Detalles de la sesión */}
            <fieldset className="fh-section">
              <legend className="fh-section__legend">3. Detalles de la sesión</legend>
              <div className="fh-field">
                <label htmlFor="fh-docenteId" className="fh-field__label">Docente / Tutor {req}</label>
                {conIcono('teacher',
                  <select
                    id="fh-docenteId"
                    name="docenteId"
                    className="fh-input"
                    value={formData.docenteId}
                    onChange={handleChange}
                    aria-required="true"
                    aria-invalid={!!errores.docenteId}
                    aria-describedby={describe(errores.docenteId && 'fh-docenteId-error')}
                  >
                    <option value="">{docentesVisibles.length ? 'Seleccionar docente' : 'No hay docentes disponibles'}</option>
                    {docentesVisibles.map((d) => (
                      <option key={d.id} value={d.id}>
                        {nombreDocente(d)}{d.rol ? ` (${d.rol})` : ''}
                      </option>
                    ))}
                  </select>,
                  true
                )}
                <ErrorCampo id="fh-docenteId-error" mensaje={errores.docenteId} />
              </div>
              <div className="fh-field">
                <label htmlFor="fh-salon" className="fh-field__label">Aula <span className="fh-opcional">(opcional)</span></label>
                {conIcono('building',
                  <input
                    type="text" id="fh-salon" name="salon" className="fh-input" value={formData.salon} onChange={handleChange}
                    placeholder="Ej. Aula 301" maxLength={60} aria-describedby="fh-salon-ayuda" autoComplete="off"
                  />
                )}
                <p className="fh-field__hint" id="fh-salon-ayuda">Se puede asignar después.</p>
              </div>
            </fieldset>
          </div>

          <div className="form-actions fh__footer">
            {progreso && progreso.total > 1 && (
              <p className="fh__progreso" role="status">Creando sesiones: {progreso.hechas} de {progreso.total}…</p>
            )}
            <button type="button" onClick={onClose} className="btn-cancel fh-btn fh-btn--ghost">
              Cancelar
            </button>
            <button type="submit" className="btn-save fh-btn fh-btn--ink" disabled={guardando} aria-busy={guardando}>
              <Icon name="save" size={18} />
              {guardando ? 'Guardando…' : isRecurrente && sesionesPrevistas.length > 1 ? `Guardar ${sesionesPrevistas.length} sesiones` : editando ? 'Guardar cambios' : 'Guardar horario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default FormularioHorario
