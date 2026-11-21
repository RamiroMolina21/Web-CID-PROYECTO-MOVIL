import React, { useEffect, useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { useToast, useConfirm } from '../components/ui/Feedback'
import FormularioHorario from '../components/FormularioHorario'
import TutoriaDetailModal from '../components/TutoriaDetailModal'
import HorarioDetailModal from '../components/HorarioDetailModal'
import Icon from '../components/ui/Icon'
import DisponibilidadDocente from '../features/horarios/DisponibilidadDocente'
import { fechaLarga, franjaTexto, horaCorta, hoyIso, isoLocal, minutos } from '../features/horarios/disponibilidad'
import {
  TIPOS_EVENTO, aHora, aIso, diasDeVista, moverFecha, nombreCorto, nombreMes, ordenarEventos,
  rangoHoras, repartirCarriles, tituloPeriodo,
} from '../features/horarios/calendario'
import { isHorarioDisponible } from '../lib/estados'
import { ETIQUETA_ELIMINADO, ETIQUETA_SIN_ASIGNAR } from '../lib/usuarios'
import { aulaTexto } from '../lib/aula'
import './Horarios.css'
import './HorariosCalendario.css'

// Vista por defecto: Semana. Es la que deja ver a la vez el día, la franja exacta (posición en la rejilla
// por horas) y el docente de cada disponibilidad; el Mes resume y el Día detalla. En móvil, las vistas
// Día/Semana/Mes se muestran como lista por día (una rejilla de 7 columnas no es legible a 375 px).
const VISTA_INICIAL = 'semana'
const ESTADOS_ACTIVOS = ['pendiente', 'programada', 'programado', 'activa', 'activo', 'en curso', 'en_curso']
const HORA_PX = 60
const MAX_MES = 3
const TODOS = ''

const useMovil = () => {
  const query = '(max-width: 767px)'
  const [movil, setMovil] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const fn = (e) => setMovil(e.matches)
    mql.addEventListener('change', fn)
    return () => mql.removeEventListener('change', fn)
  }, [])
  return movil
}

/** Nombre completo accesible de un evento: tipo, fecha, franja, docente, tema y aula. */
const etiquetaEvento = (e) =>
  [
    TIPOS_EVENTO[e.tipo].label,
    `${fechaLarga(e.fecha)}, ${franjaTexto(e.inicio, e.fin)}`,
    e.docente,
    e.tema,
    aulaTexto(e.espacio),
  ].filter(Boolean).join('. ')

// El nombre accesible sale del propio contenido (texto visible + partes solo para lectores de pantalla),
// así coincide con lo que se ve (WCAG 2.5.3) y el lector oye tipo, fecha, docente completo y aula.
const Evento = ({ evento, variante, estilo, onAbrir, corto = false }) => {
  const abreviado = variante === 'mes' || variante === 'estrecho'
  return (
    <button
      type="button"
      className={`cal-evento cal-evento--${evento.tipo} cal-evento--${variante}${corto ? ' cal-evento--corto' : ''}`}
      style={estilo}
      onClick={() => onAbrir(evento)}
      title={etiquetaEvento(evento)}
      data-fecha={evento.fecha}
      data-tipo={evento.tipo}
    >
      <span className="sr-only">{TIPOS_EVENTO[evento.tipo].label}, {fechaLarga(evento.fecha)}, </span>
      <span className="cal-evento__hora">
        <Icon name={TIPOS_EVENTO[evento.tipo].icon} size={12} />
        {variante === 'mes' ? horaCorta(evento.inicio) : franjaTexto(evento.inicio, evento.fin)}
      </span>
      {variante === 'mes' && <span className="sr-only"> a {horaCorta(evento.fin)}</span>}
      <span className="sr-only">, </span>
      <span className="cal-evento__docente">{abreviado ? evento.docenteCorto : evento.docente}</span>
      {abreviado && evento.docenteCorto !== evento.docente && <span className="sr-only"> ({evento.docente})</span>}
      {evento.tema && variante !== 'mes' && <><span className="sr-only">, </span><span className="cal-evento__tema">{evento.tema}</span></>}
      {evento.tema && variante === 'mes' && <span className="sr-only">, {evento.tema}</span>}
      <span className="sr-only">, {aulaTexto(evento.espacio)}</span>
    </button>
  )
}

const Horarios = () => {
  const { tutorias, horarios, deleteHorario, loading, error, getDocenteById } = useData()
  const toast = useToast()
  const confirm = useConfirm()
  const movil = useMovil()
  const [showHorarioForm, setShowHorarioForm] = useState(false)
  const [selectedTutoria, setSelectedTutoria] = useState(null)
  const [selectedHorario, setSelectedHorario] = useState(null)
  const [horarioToEdit, setHorarioToEdit] = useState(null)
  const [fecha, setFecha] = useState(() => new Date())
  const [vista, setVista] = useState(VISTA_INICIAL)
  const [docenteSel, setDocenteSel] = useState(TODOS)

  // ---------- Eventos normalizados ----------
  const eventos = useMemo(() => {
    const persona = (id, respaldo) => {
      const d = id ? getDocenteById(Number(id) || id) : null
      if (d) {
        const completo = d.nombre || [d.nombres, d.apellidos].filter(Boolean).join(' ').trim() || respaldo || 'Docente'
        return { docente: completo, docenteCorto: nombreCorto(d.nombres, d.apellidos, completo) }
      }
      const completo = respaldo || 'Docente'
      return { docente: completo, docenteCorto: nombreCorto(null, null, completo) }
    }
    const listaH = Array.isArray(horarios) ? horarios : []
    const listaT = Array.isArray(tutorias) ? tutorias : []
    const porId = new Map(listaH.map((h) => [h.id, h]))
    const activas = listaT.filter((t) => t && aIso(t.fecha) && aHora(t.horaInicio) && aHora(t.horaFin) && ESTADOS_ACTIVOS.includes((t.estado || '').toLowerCase()))
    const conTutoria = new Set(activas.map((t) => t.horarioId).filter(Boolean))

    const deHorarios = listaH
      .filter((h) => h && aIso(h.fecha) && aHora(h.horaInicio) && aHora(h.horaFin) && !conTutoria.has(h.id))
      .map((h) => {
        const respaldo = h.sinDueno ? ETIQUETA_ELIMINADO : [h.docenteNombre, h.docenteApellidos].filter(Boolean).join(' ')
        return {
          key: `h${h.id}`,
          tipo: isHorarioDisponible(h.estado) ? 'disponible' : 'ocupado',
          fecha: aIso(h.fecha),
          inicio: aHora(h.horaInicio),
          fin: aHora(h.horaFin),
          docenteId: h.docenteId ? String(h.docenteId) : null,
          ...(h.sinDueno ? { docente: ETIQUETA_ELIMINADO, docenteCorto: ETIQUETA_ELIMINADO } : persona(h.docenteId, respaldo)),
          espacio: h.salon,
          cupos: h.cuposDisponibles,
          horario: h,
        }
      })

    const deTutorias = activas.map((t) => {
      const h = porId.get(t.horarioId)
      const id = t.docenteId || h?.docenteId || null
      return {
        key: `t${t.id}`,
        tipo: 'tutoria',
        fecha: aIso(t.fecha),
        inicio: aHora(t.horaInicio),
        fin: aHora(t.horaFin),
        docenteId: t.sinAsignar ? null : id ? String(id) : null,
        ...(t.sinAsignar ? { docente: ETIQUETA_SIN_ASIGNAR, docenteCorto: 'Sin asignar' } : persona(id, [t.docenteNombre, t.docenteApellidos].filter(Boolean).join(' '))),
        tema: [t.idioma, t.nivel].filter(Boolean).join(' ') + (t.tema ? ` · ${t.tema}` : ''),
        espacio: h?.salon,
        tutoria: t,
      }
    })
    return ordenarEventos([...deHorarios, ...deTutorias])
  }, [horarios, tutorias, getDocenteById])

  // Docentes con eventos, para el filtro
  const docentesConEventos = useMemo(() => {
    const m = new Map()
    for (const e of eventos) if (e.docenteId && !m.has(e.docenteId)) m.set(e.docenteId, e.docente)
    return [...m.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [eventos])

  const visibles = docenteSel === TODOS ? eventos : eventos.filter((e) => e.docenteId === docenteSel)
  const nombreSel = docentesConEventos.find((d) => d.id === docenteSel)?.nombre

  // Resumen semanal del docente elegido: sus franjas disponibles de hoy en adelante
  const sesionesDocente = useMemo(() => {
    if (docenteSel === TODOS) return []
    const hoy = hoyIso()
    return visibles
      .filter((e) => e.tipo === 'disponible' && e.fecha >= hoy)
      .map((e) => ({ id: e.horario.id, fecha: e.fecha, inicio: e.inicio, fin: e.fin, espacio: e.espacio, cupos: e.cupos, horario: e.horario }))
  }, [visibles, docenteSel])

  const porFecha = useMemo(() => {
    const m = new Map()
    for (const e of visibles) {
      if (!m.has(e.fecha)) m.set(e.fecha, [])
      m.get(e.fecha).push(e)
    }
    return m
  }, [visibles])

  const abrir = (e) => {
    if (e.tutoria) setSelectedTutoria(e.tutoria)
    else setSelectedHorario(e.horario)
  }

  const irADia = (iso) => {
    const [y, m, d] = iso.split('-').map(Number)
    setFecha(new Date(y, m - 1, d))
    setVista('dia')
  }

  const hoy = hoyIso()

  // ---------- Vistas ----------
  const renderRejilla = (dias) => {
    const isos = dias.map(isoLocal)
    const delRango = isos.flatMap((d) => porFecha.get(d) || [])
    const { ini, fin } = rangoHoras(delRango)
    const horas = Array.from({ length: fin - ini }, (_, i) => ini + i)
    const alto = horas.length * HORA_PX
    return (
      <div className="calendar-week-view cal-scroll">
      <div className={`cal-rejilla cal-rejilla--${dias.length === 1 ? 'dia' : 'semana'}`}>
        <div className="cal-rejilla__cabecera" aria-hidden="true">
          <span />
          {dias.map((d, i) => (
            <span key={isos[i]} className={`cal-rejilla__dia${isos[i] === hoy ? ' es-hoy' : ''}`}>
              <span className="cal-rejilla__dia-nombre">{new Intl.DateTimeFormat('es-CO', { weekday: 'short' }).format(d).replace('.', '')}</span>
              <span className="cal-rejilla__dia-num">{d.getDate()}</span>
            </span>
          ))}
        </div>
        <div className="cal-rejilla__cuerpo" style={{ height: alto }}>
          <div className="cal-rejilla__horas" aria-hidden="true">
            {horas.map((h) => (
              <span key={h} className="cal-rejilla__hora" style={{ top: (h - ini) * HORA_PX }}>{h}:00</span>
            ))}
          </div>
          {dias.map((d, i) => {
            const delDia = porFecha.get(isos[i]) || []
            const colocados = repartirCarriles(delDia)
            return (
              <section
                key={isos[i]}
                className={`cal-rejilla__columna${isos[i] === hoy ? ' es-hoy' : ''}`}
                aria-label={`${fechaLarga(isos[i])}: ${delDia.length} ${delDia.length === 1 ? 'evento' : 'eventos'}`}
              >
                {horas.map((h) => <span key={h} className="cal-rejilla__linea" style={{ top: (h - ini) * HORA_PX }} aria-hidden="true" />)}
                {colocados.map(({ evento, carril, carriles }) => {
                  const top = ((minutos(evento.inicio) - ini * 60) / 60) * HORA_PX
                  const altura = Math.max(((minutos(evento.fin) - minutos(evento.inicio)) / 60) * HORA_PX - 2, 26)
                  const ancho = 100 / carriles
                  return (
                    <Evento
                      key={evento.key}
                      evento={evento}
                      variante={carriles > 2 && dias.length > 1 ? 'estrecho' : 'bloque'}
                      onAbrir={abrir}
                      corto={altura < 80}
                      estilo={{ top, height: altura, left: `calc(${carril * ancho}% + 2px)`, width: `calc(${ancho}% - 4px)` }}
                    />
                  )
                })}
              </section>
            )
          })}
        </div>
      </div>
      </div>
    )
  }

  const renderMes = () => {
    const dias = diasDeVista('mes', fecha)
    const mes = fecha.getMonth()
    return (
      <div className="cal-mes">
        <div className="cal-mes__cabecera" aria-hidden="true">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <span key={d}>{d}</span>)}
        </div>
        {Array.from({ length: 6 }, (_, s) => (
          <div key={s} className="cal-mes__semana">
            {dias.slice(s * 7, s * 7 + 7).map((d) => {
              const iso = isoLocal(d)
              const delDia = porFecha.get(iso) || []
              const fuera = d.getMonth() !== mes
              return (
                <div key={iso} className={`cal-mes__celda${fuera ? ' es-fuera' : ''}${iso === hoy ? ' es-hoy' : ''}`}>
                  <button
                    type="button"
                    className="cal-mes__num"
                    onClick={() => irADia(iso)}
                    aria-label={`Ver el ${fechaLarga(iso)} (${delDia.length} ${delDia.length === 1 ? 'evento' : 'eventos'})`}
                  >
                    {d.getDate()}
                  </button>
                  <div className="cal-mes__eventos">
                    {delDia.slice(0, MAX_MES).map((e) => <Evento key={e.key} evento={e} variante="mes" onAbrir={abrir} />)}
                    {delDia.length > MAX_MES && (
                      <button type="button" className="cal-mes__mas" onClick={() => irADia(iso)}>
                        {delDia.length - MAX_MES} más<span className="sr-only"> el {fechaLarga(iso)}</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  const renderAnio = () => {
    const año = fecha.getFullYear()
    return (
      <ul className="cal-anio">
        {Array.from({ length: 12 }, (_, m) => {
          const prefijo = `${año}-${String(m + 1).padStart(2, '0')}`
          const delMes = visibles.filter((e) => e.fecha.startsWith(prefijo))
          const cuenta = (t) => delMes.filter((e) => e.tipo === t).length
          return (
            <li key={m}>
              <button
                type="button"
                className="cal-anio__mes"
                onClick={() => { setFecha(new Date(año, m, 1)); setVista('mes') }}
              >
                <span className="cal-anio__nombre">{nombreMes(m)}</span>
                {delMes.length === 0 ? (
                  <span className="cal-anio__vacio">Sin eventos</span>
                ) : (
                  <span className="cal-anio__cuentas">
                    {['disponible', 'tutoria', 'ocupado'].filter((t) => cuenta(t) > 0).map((t) => (
                      <span key={t} className={`cal-anio__cuenta cal-anio__cuenta--${t}`}>
                        <Icon name={TIPOS_EVENTO[t].icon} size={14} />{cuenta(t)} {TIPOS_EVENTO[t].label.toLowerCase()}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  // Móvil: lista por día con sus franjas
  const renderLista = (dias) => {
    const conEventos = dias.map(isoLocal).filter((iso) => (porFecha.get(iso) || []).length > 0)
    if (conEventos.length === 0) {
      return <p className="cal-vacio"><Icon name="calendar" size={18} />No hay horarios ni tutorías en este periodo.</p>
    }
    return (
      <div className="cal-lista">
        {conEventos.map((iso) => (
          <section key={iso} className={`cal-lista__dia${iso === hoy ? ' es-hoy' : ''}`} aria-labelledby={`cal-dia-${iso}`}>
            <h3 id={`cal-dia-${iso}`} className="cal-lista__fecha">
              {fechaLarga(iso)}{iso === hoy && <span className="cal-lista__hoy">Hoy</span>}
            </h3>
            <ul>
              {porFecha.get(iso).map((e) => (
                <li key={e.key}>
                  <Evento evento={e} variante="lista" onAbrir={abrir} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    )
  }

  const renderVista = () => {
    if (vista === 'año') return renderAnio()
    const dias = vista === 'mes' ? diasDeVista('mes', fecha).filter((d) => d.getMonth() === fecha.getMonth()) : diasDeVista(vista, fecha)
    if (movil) return renderLista(dias)
    if (vista === 'mes') return renderMes()
    return renderRejilla(diasDeVista(vista, fecha))
  }

  if (loading) {
    return (
      <div className="horarios-page">
        <p className="cal-vacio" role="status">Cargando horarios…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="horarios-page">
        <div className="page-header">
          <div>
            <h1>Horarios y Tutorías</h1>
          </div>
        </div>
        <p className="banner banner--error" role="alert">
          <Icon name="alert" size={18} />
          <span>No se pudieron cargar los horarios: {error}</span>
        </p>
      </div>
    )
  }

  return (
    <div className="horarios-page">
      <div className="page-header">
        <div>
          <h1>Horarios y Tutorías</h1>
          <p>Disponibilidad de los docentes por día y franja, y tutorías programadas</p>
        </div>
        <div className="header-buttons">
          <button className="btn-secondary" onClick={() => setShowHorarioForm(true)}>
            <Icon name="plus" size={18} className="icon--inline" />Nuevo Horario
          </button>
        </div>
      </div>

      {(showHorarioForm || horarioToEdit) && (
        <FormularioHorario
          horario={horarioToEdit}
          onClose={() => { setShowHorarioForm(false); setHorarioToEdit(null) }}
          onSave={() => { setShowHorarioForm(false); setHorarioToEdit(null) }}
        />
      )}

      {selectedTutoria && (
        <TutoriaDetailModal tutoria={selectedTutoria} onClose={() => setSelectedTutoria(null)} onEdit={() => {}} />
      )}

      {selectedHorario && (
        <HorarioDetailModal
          horario={selectedHorario}
          onClose={() => setSelectedHorario(null)}
          onEdit={(h) => { setHorarioToEdit(h); setSelectedHorario(null) }}
          onDelete={async (id) => {
            if (await confirm({ title: 'Eliminar horario', message: '¿Seguro que deseas eliminar este horario? Esta acción no se puede deshacer.', confirmLabel: 'Eliminar', danger: true })) {
              try {
                await deleteHorario(id)
                setSelectedHorario(null)
              } catch (err) {
                toast.error(`Error: ${err.message || 'No se pudo eliminar el horario'}`)
              }
            }
          }}
        />
      )}

      <div className={`cal-layout${docenteSel !== TODOS ? ' cal-layout--con-docente' : ''}`}>
        <section className="calendar-section cal" aria-labelledby="cal-periodo">
          <div className="cal-barra">
            <div className="cal-nav">
              <button type="button" onClick={() => setFecha(new Date())} className="btn btn--secondary btn--sm">Hoy</button>
              <button type="button" onClick={() => setFecha((f) => moverFecha(vista, f, -1))} className="icon-btn" aria-label="Periodo anterior">
                <Icon name="chevronLeft" size={20} />
              </button>
              <button type="button" onClick={() => setFecha((f) => moverFecha(vista, f, 1))} className="icon-btn" aria-label="Periodo siguiente">
                <Icon name="chevronRight" size={20} />
              </button>
              <h2 id="cal-periodo" className="cal-periodo" aria-live="polite">{tituloPeriodo(vista, fecha)}</h2>
            </div>
            <div className="cal-filtros">
              <label className="cal-filtro">
                <span className="cal-filtro__label">Docente o tutor</span>
                <select className="select" value={docenteSel} onChange={(e) => setDocenteSel(e.target.value)}>
                  <option value={TODOS}>Todos los docentes</option>
                  {docentesConEventos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </label>
              <label className="cal-filtro">
                <span className="cal-filtro__label">Vista</span>
                <select className="select" aria-label="Vista del calendario" value={vista} onChange={(e) => setVista(e.target.value)}>
                  <option value="dia">Día</option>
                  <option value="semana">Semana</option>
                  <option value="mes">Mes</option>
                  <option value="año">Año</option>
                </select>
              </label>
            </div>
          </div>

          <ul className="cal-leyenda" aria-label="Leyenda">
            {Object.entries(TIPOS_EVENTO).map(([k, t]) => (
              <li key={k} className={`cal-leyenda__item cal-leyenda__item--${k}`}>
                <span className="cal-leyenda__muestra"><Icon name={t.icon} size={12} /></span>
                {k === 'disponible' ? 'Horario disponible' : k === 'tutoria' ? 'Tutoría programada' : 'Horario ocupado'}
              </li>
            ))}
          </ul>

          {renderVista()}
        </section>

        {docenteSel !== TODOS && (
          <aside className="cal-docente" aria-labelledby="cal-docente-titulo">
            <div className="cal-docente__head">
              <h2 id="cal-docente-titulo" className="cal-docente__nombre">{nombreSel}</h2>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDocenteSel(TODOS)}>
                <Icon name="close" size={16} /> Quitar filtro
              </button>
            </div>
            <DisponibilidadDocente
              sesiones={sesionesDocente}
              nombre={nombreSel}
              renderAccion={(s, etiqueta) => (
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setSelectedHorario(s.horario)} aria-label={`Ver detalle del ${etiqueta}`}>
                  Ver
                </button>
              )}
            />
          </aside>
        )}
      </div>
    </div>
  )
}

export default Horarios
