import React, { useEffect, useRef, useState } from 'react'
import { useData } from '../context/DataContext'
import { useToast, useConfirm } from '../components/ui/Feedback'
import { useAuth } from '../context/AuthContext'
import { ROLES, getUserId, tieneRol } from '../lib/roles'
import { getErrorMessage } from '../lib/apiClient'
import { usuarioService } from '../services/apiService'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'
import { BlockError } from '../features/dashboard/DashPanel'
import { useDebounced, useUsuariosPaginados } from '../hooks/useUsuariosPaginados'
import FormularioEstudiante from '../components/FormularioEstudiante'
import FormularioDocente from '../components/FormularioDocente'
import './Estudiantes.css'

const LOTE = 20

const ESTADOS = [
  { id: 'todos', label: 'Todos', valor: undefined },
  { id: 'activos', label: 'Activos', valor: true },
  { id: 'inactivos', label: 'Inactivos', valor: false },
]

const ROLES_FILTRO = ['Estudiante', 'Docente', 'Tutor', 'Administrador', 'Auxiliar']

/** UsuarioResponse → forma que esperan las tarjetas y los formularios existentes. */
const ROLES_PERSONAL_ADMIN = [ROLES.DOCENTE, ROLES.TUTOR, ROLES.ADMIN, ROLES.AUXILIAR]
const ROLES_PERSONAL_AUXILIAR = [ROLES.DOCENTE, ROLES.TUTOR]

const aUsuario = (u) => {
  const rol = u.tipoRol || 'Sin rol'
  return {
    id: u.idUsuario,
    idUsuario: u.idUsuario,
    nombres: u.nombres || '',
    apellidos: u.apellidos || '',
    nombre: [u.nombres, u.apellidos].filter(Boolean).join(' ').trim() || u.correo,
    email: u.correo,
    correo: u.correo,
    rol,
    tipo: rol === 'Estudiante' ? 'estudiante' : 'docente',
    activo: u.activo !== false,
  }
}

/** Resumen de DELETE /Usuario/{id} en frases (solo lo que ocurrió). */
const LINEAS_RESUMEN = [
  ['tutoriasDesasignadas', (n) => `${n} ${n === 1 ? 'tutoría quedó' : 'tutorías quedaron'} sin asignar: reasígnalas desde Agendar tutoría.`],
  ['horariosConservados', (n) => `${n} ${n === 1 ? 'horario se conservó' : 'horarios se conservaron'} sin responsable porque ${n === 1 ? 'tiene' : 'tienen'} tutorías.`],
  ['horariosEliminados', (n) => `${n} ${n === 1 ? 'horario sin tutorías se eliminó' : 'horarios sin tutorías se eliminaron'}.`],
  ['inscripcionesEliminadas', (n) => `${n} ${n === 1 ? 'inscripción a una tutoría se eliminó' : 'inscripciones a tutorías se eliminaron'} (los cupos quedan libres).`],
  ['notificacionesEliminadas', (n) => `${n} ${n === 1 ? 'notificación se eliminó' : 'notificaciones se eliminaron'}.`],
  ['encuestasEliminadas', (n) => `${n} ${n === 1 ? 'encuesta sin responder se eliminó' : 'encuestas sin responder se eliminaron'}.`],
  ['encuestasAnonimizadas', (n) => `${n} ${n === 1 ? 'encuesta respondida se conservó' : 'encuestas respondidas se conservaron'} de forma anónima.`],
  ['retroalimentacionesConservadas', (n) => `${n} ${n === 1 ? 'retroalimentación se conservó' : 'retroalimentaciones se conservaron'} sin autor.`],
  ['informesConservados', (n) => `${n} ${n === 1 ? 'informe se conservó' : 'informes se conservaron'} sin autor.`],
  ['atendidosConservados', (n) => `${n} ${n === 1 ? 'asunto marcado como atendido se conservó' : 'asuntos marcados como atendidos se conservaron'}.`],
]
const frasesResumen = (resumen) =>
  LINEAS_RESUMEN.filter(([k]) => Number(resumen?.[k]) > 0).map(([k, f]) => ({ clave: k, texto: f(Number(resumen[k])) }))

const iniciales = (name) => (name || '?').split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2)

const Estudiantes = () => {
  const { deleteEstudiante, deleteDocente } = useData()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const yo = getUserId(user)
  // Reglas del backend:
  // - El Auxiliar crea y edita Estudiantes, Docentes y Tutores (403 para Administrador/Auxiliar).
  // - Eliminar y activar/desactivar personal es solo del Administrador; el Auxiliar solo sobre Estudiantes.
  const esAdmin = tieneRol(user, [ROLES.ADMIN])
  const puedeEditar = (u) => esAdmin || u.tipo === 'estudiante' || ROLES_PERSONAL_AUXILIAR.includes(u.rol)
  const puedeEliminar = (u) => esAdmin || u.tipo === 'estudiante'
  // Nadie desactiva su propia cuenta (409 en el servidor): no se ofrece.
  const puedeCambiarEstado = (u) => puedeEliminar(u) && u.id !== yo
  // Roles que puede asignar quien usa el formulario de personal
  const rolesAsignables = esAdmin ? ROLES_PERSONAL_ADMIN : ROLES_PERSONAL_AUXILIAR

  const [showForm, setShowForm] = useState(false)
  const [showDocenteForm, setShowDocenteForm] = useState(false)
  const [editingEstudiante, setEditingEstudiante] = useState(null)
  const [editingDocente, setEditingDocente] = useState(null)
  const [rolNuevo, setRolNuevo] = useState(ROLES.DOCENTE)
  const [searchQuery, setSearchQuery] = useState('')
  const [estado, setEstado] = useState('todos')
  const [rol, setRol] = useState('')
  const [cambiando, setCambiando] = useState(null)
  const [resultadoEliminacion, setResultadoEliminacion] = useState(null)

  const q = useDebounced(searchQuery.trim(), 300)
  const filtroActivo = ESTADOS.find((e) => e.id === estado).valor
  const lista = useUsuariosPaginados({ q, rol: rol || undefined, activo: filtroActivo, pageSize: LOTE })
  const usuarios = lista.items.map(aUsuario)
  const filtrado = Boolean(q || rol || estado !== 'todos')

  // Carga de la página siguiente al acercarse al final (raíz = la lista si tiene scroll propio, si no el viewport)
  const contenedorRef = useRef(null)
  const centinelaRef = useRef(null)
  useEffect(() => {
    const centinela = centinelaRef.current
    if (!lista.hayMas || !centinela || lista.status !== 'ready' || typeof IntersectionObserver === 'undefined') return undefined
    const cont = contenedorRef.current
    const propio = cont && /(auto|scroll)/.test(getComputedStyle(cont).overflowY)
    const obs = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && lista.cargarMas(), {
      root: propio ? cont : null,
      rootMargin: '0px 0px 240px 0px',
    })
    obs.observe(centinela)
    return () => obs.disconnect()
  }, [lista.hayMas, lista.status, lista.items.length, lista.cargarMas]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    contenedorRef.current?.scrollTo?.({ top: 0 })
  }, [q, rol, estado])

  const handleDelete = async (u) => {
    const ok = await confirm({
      title: `¿Eliminar a ${u.nombre}?`,
      message:
        'Es definitivo y no se puede deshacer. Se borrarán su cuenta, sus inscripciones a tutorías, sus notificaciones y sus encuestas sin responder. ' +
        'Las tutorías y los horarios que comparte con otras personas se conservan sin asignar, para que puedas reasignarlos.' +
        (u.activo ? ' Si solo quieres retirarlo por un tiempo, usa «Desactivar»: es reversible.' : ''),
      confirmLabel: 'Eliminar definitivamente',
      danger: true,
    })
    if (!ok) return
    try {
      const respuesta = u.tipo === 'estudiante' ? await deleteEstudiante(u.id) : await deleteDocente(u.id)
      setResultadoEliminacion({ nombre: u.nombre, frases: frasesResumen(respuesta?.resumen) })
      lista.recargar()
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo eliminar el usuario.'))
    }
  }

  const handleEstado = async (u) => {
    const activar = !u.activo
    if (!activar) {
      const ok = await confirm({
        title: 'Desactivar cuenta',
        message: `${u.nombre} no podrá iniciar sesión ni ser asignado a tutorías hasta que se reactive. Sus datos se conservan.`,
        confirmLabel: 'Desactivar',
        danger: true,
      })
      if (!ok) return
    }
    setCambiando(u.id)
    try {
      const actualizado = await usuarioService.setEstado(u.id, activar)
      lista.actualizar(actualizado)
      toast.success(activar ? `La cuenta de ${u.nombre} está activa.` : `La cuenta de ${u.nombre} se desactivó.`)
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo cambiar el estado de la cuenta.'))
    } finally {
      setCambiando(null)
    }
  }

  const handleEdit = (u) => {
    if (u.tipo === 'estudiante') {
      setEditingEstudiante(u)
      setShowForm(true)
    } else {
      setEditingDocente({ ...u, nombre: u.nombres, apellido: u.apellidos })
      setShowDocenteForm(true)
    }
  }

  const nuevoPersonal = (rolInicial) => {
    setEditingDocente(null)
    setRolNuevo(rolInicial)
    setShowDocenteForm(true)
  }

  const cerrarFormularios = (guardado) => {
    setShowForm(false)
    setShowDocenteForm(false)
    setEditingEstudiante(null)
    setEditingDocente(null)
    if (guardado) lista.recargar()
  }

  return (
    <div className="estudiantes-page">
      <div className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p>Gestiona los usuarios del sistema y el estado de sus cuentas</p>
        </div>
        <div className="header-buttons">
          <button type="button" className="btn-secondary" onClick={() => nuevoPersonal(ROLES.DOCENTE)}>
            <Icon name="plus" size={18} /> Nuevo Docente
          </button>
          <button type="button" className="btn-secondary" onClick={() => nuevoPersonal(ROLES.TUTOR)}>
            <Icon name="plus" size={18} /> Nuevo Tutor
          </button>
          <button type="button" className="btn-primary" onClick={() => { setEditingEstudiante(null); setShowForm(true) }}>
            <Icon name="plus" size={18} /> Nuevo Estudiante
          </button>
        </div>
      </div>

      {showForm && (
        <FormularioEstudiante estudiante={editingEstudiante} onClose={() => cerrarFormularios(false)} onSave={() => cerrarFormularios(true)} />
      )}
      {showDocenteForm && (
        <FormularioDocente docente={editingDocente} rolInicial={rolNuevo} rolesPermitidos={rolesAsignables} onClose={() => cerrarFormularios(false)} onSave={() => cerrarFormularios(true)} />
      )}

      <Modal
        open={!!resultadoEliminacion}
        onClose={() => setResultadoEliminacion(null)}
        title={resultadoEliminacion ? `${resultadoEliminacion.nombre} se eliminó` : ''}
        description="Esto es lo que ocurrió con sus datos:"
        size="sm"
        footer={<button type="button" className="btn btn--primary" onClick={() => setResultadoEliminacion(null)} data-autofocus>Entendido</button>}
      >
        {resultadoEliminacion && (
          resultadoEliminacion.frases.length ? (
            <ul className="resumen-eliminacion">
              {resultadoEliminacion.frases.map((f) => (
                <li key={f.clave} data-clave={f.clave}>
                  <Icon name={f.clave === 'tutoriasDesasignadas' ? 'alert' : 'check'} size={16} />
                  <span>{f.texto}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="resumen-eliminacion__vacio">No tenía tutorías, horarios ni otros datos asociados.</p>
          )
        )}
      </Modal>

      <div className="usuarios-toolbar">
        <div className="usuarios-filtros">
          <div className="search-bar">
            <Icon name="search" size={20} className="search-icon" />
            <input
              type="search"
              placeholder="Buscar por nombre, apellidos o correo..."
              aria-label="Buscar usuarios"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              maxLength={100}
            />
          </div>
          <label className="usuarios-rol">
            <span className="sr-only">Filtrar por rol</span>
            <select className="select" value={rol} onChange={(e) => setRol(e.target.value)} aria-label="Filtrar por rol">
              <option value="">Todos los roles</option>
              {ROLES_FILTRO.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <div className="segmented" role="group" aria-label="Filtrar por estado de la cuenta">
            {ESTADOS.map((e) => (
              <button key={e.id} type="button" aria-pressed={estado === e.id} onClick={() => setEstado(e.id)}>{e.label}</button>
            ))}
          </div>
        </div>
        <p className="usuarios-count" aria-live="polite">
          {lista.status === 'loading' ? 'Cargando usuarios…' : (
            <>Mostrando <strong>{usuarios.length}</strong> de <strong>{lista.total}</strong> usuarios{filtrado && ' (con filtros)'}</>
          )}
          {lista.status === 'refreshing' && <span className="spinner usuarios-count__spinner" aria-hidden="true"><span /></span>}
        </p>
      </div>

      {lista.status === 'error' ? (
        <BlockError error={lista.error} onRetry={lista.recargar} />
      ) : (
        <div ref={contenedorRef} className="usuarios-scroll" role="region" aria-label="Lista de usuarios" aria-busy={lista.status !== 'ready'} tabIndex={0}>
          {lista.status === 'loading' ? (
            <ul className="estudiantes-grid" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="estudiante-card estudiante-card--skeleton">
                  <span className="skeleton skeleton--title" />
                  <span className="skeleton skeleton--line" />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="estudiantes-grid">
              {usuarios.map((u) => (
                <li key={u.id} className={`estudiante-card${u.activo ? '' : ' is-inactive'}`}>
                  <div className="estudiante-avatar-large" aria-hidden="true">{iniciales(u.nombre)}</div>
                  <div className="estudiante-info">
                    <h3>{u.nombre}</h3>
                    <div className="estudiante-tags">
                      <span className="estudiante-id">ID: {u.id} | {u.rol}</span>
                      <span className={`cuenta-badge cuenta-badge--${u.activo ? 'activa' : 'inactiva'}`}>
                        <span className="cuenta-badge__dot" aria-hidden="true" />
                        {u.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    <div className="estudiante-details">
                      <div className="detail-item">
                        <Icon name="mail" size={16} className="detail-icon" />
                        <span>{u.correo}</span>
                      </div>
                      <div className="detail-item">
                        <Icon name="user" size={16} className="detail-icon" />
                        <span>Rol: {u.rol}</span>
                      </div>
                    </div>
                  </div>
                  {puedeEditar(u) && (
                    <div className="estudiante-actions">
                      <button type="button" className="btn-edit" onClick={() => handleEdit(u)}>
                        <Icon name="edit" size={16} /> Editar<span className="sr-only"> a {u.nombre}</span>
                      </button>
                      {puedeCambiarEstado(u) && (
                        <button
                          type="button"
                          className={u.activo ? 'btn-estado btn-estado--off' : 'btn-estado btn-estado--on'}
                          onClick={() => handleEstado(u)}
                          disabled={cambiando === u.id}
                        >
                          <Icon name={u.activo ? 'lock' : 'checkCircle'} size={16} />
                          {u.activo ? 'Desactivar' : 'Activar'}<span className="sr-only"> la cuenta de {u.nombre}</span>
                        </button>
                      )}
                      {puedeEliminar(u) && (
                        <button type="button" className="btn-delete" onClick={() => handleDelete(u)}>
                          <Icon name="trash" size={16} /> Eliminar<span className="sr-only"> a {u.nombre}</span>
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {lista.status !== 'loading' && lista.hayMas && (
            <div className="usuarios-more">
              <div ref={centinelaRef} className="usuarios-sentinel" aria-hidden="true" />
              <button type="button" className="btn btn--secondary" onClick={lista.cargarMas} disabled={lista.cargandoMas}>
                {lista.cargandoMas ? 'Cargando…' : <>Cargar {Math.min(LOTE, lista.total - usuarios.length)} más <span className="usuarios-more__rest">(quedan {lista.total - usuarios.length})</span></>}
              </button>
            </div>
          )}

          {lista.status === 'ready' && usuarios.length === 0 && (
            <div className="empty-state">
              <Icon name="search" size={28} />
              <p>No se encontraron usuarios{q ? ` para «${q}»` : ''}{estado !== 'todos' ? ` ${estado}` : ''}.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Estudiantes
