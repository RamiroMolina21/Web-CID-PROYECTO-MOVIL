import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { usuarioService, horarioService, tutoriaService } from '../services/apiService'

const ROLE_NAME_TO_ID = {
  administrador: 1,
  tutor: 2,
  docente: 3,
  coordinador: 3,
  estudiante: 4,
}

const ROLE_ID_TO_NAME = Object.entries(ROLE_NAME_TO_ID).reduce((acc, [name, id]) => {
  acc[id] = name.charAt(0).toUpperCase() + name.slice(1)
  return acc
}, {})

const DataContext = createContext()

export const useData = () => {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}

// Funciones de mapeo entre API y Frontend
const mapUsuarioFromAPI = (apiUsuario) => {
  const nombres = apiUsuario.nombres || apiUsuario.Nombres || apiUsuario.nombre || ''
  const apellidos = apiUsuario.apellidos || apiUsuario.Apellidos || apiUsuario.apellido || ''
  const nombreCompleto = [nombres, apellidos].filter(Boolean).join(' ').trim() || nombres || apellidos
  // Manejar tanto camelCase como PascalCase para el rol
  const rolNombre = apiUsuario.tipoRol || apiUsuario.TipoRol || apiUsuario.rol || ''
  const rolId = ROLE_NAME_TO_ID[(rolNombre || '').toLowerCase()] || null

  return {
    id: apiUsuario.idUsuario || apiUsuario.IdUsuario || apiUsuario.id || apiUsuario.Id,
    nombre: nombreCompleto,
    nombres: nombres,
    apellido: apellidos,
    apellidos: apellidos,
    email: apiUsuario.correo || apiUsuario.Correo || apiUsuario.email || '',
    correo: apiUsuario.correo || apiUsuario.Correo || apiUsuario.email || '',
    telefono: apiUsuario.telefono || apiUsuario.Telefono || '',
    carrera: apiUsuario.carrera || apiUsuario.Carrera || '',
    semestre: apiUsuario.semestre || apiUsuario.Semestre || '',
    notas: apiUsuario.notas || apiUsuario.Notas || '',
    rol: rolNombre || (rolId ? ROLE_ID_TO_NAME[rolId] : 'Estudiante'),
    tipoRol: rolNombre || (rolId ? ROLE_ID_TO_NAME[rolId] : 'Estudiante'),
    rolId: rolId,
  }
}

const mapUsuarioToAPI = (frontendUsuario, isEstudiante = true) => {
  const rawNombre = (frontendUsuario.nombre || frontendUsuario.nombres || '').trim()
  let nombres = rawNombre
  let apellidos = (frontendUsuario.apellido || frontendUsuario.apellidos || '').trim()

  if (!apellidos && rawNombre.includes(' ')) {
    const parts = rawNombre.split(' ')
    nombres = parts.shift() || ''
    apellidos = parts.join(' ')
  }

  const correo = frontendUsuario.email || frontendUsuario.correo || ''
  const contrasena = frontendUsuario.contrasena || frontendUsuario['contraseña'] || ''

  const rolPreferido = frontendUsuario.rol || frontendUsuario.tipoRol || (isEstudiante ? 'Estudiante' : 'Docente')
  const rolIdNormalizado = frontendUsuario.rolId ||
    ROLE_NAME_TO_ID[(rolPreferido || '').toLowerCase()] ||
    (isEstudiante ? ROLE_NAME_TO_ID.estudiante : ROLE_NAME_TO_ID.docente)

  if (!rolIdNormalizado) {
    throw new Error('El rol especificado no existe en el sistema')
  }

  const usuarioData = {
    nombres,
    apellidos,
    correo,
    contrasena: contrasena || (isEstudiante ? 'TempPass123!' : ''),
    rolId: rolIdNormalizado,
  }

  return usuarioData
}

const mapHorarioFromAPI = (apiHorario) => {
  // Validar y formatear fecha
  let fecha = null
  const fechaFuente = apiHorario.fecha || apiHorario.fechaInicio
  if (fechaFuente) {
    try {
      // Si viene como string ISO, extraer solo la fecha
      if (typeof fechaFuente === 'string') {
        fecha = fechaFuente.split('T')[0]
        // Validar formato YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
          const date = new Date(fechaFuente)
          if (!isNaN(date.getTime())) {
            fecha = date.toISOString().split('T')[0]
          } else {
            console.warn('Fecha inválida en horario:', fechaFuente)
            fecha = null
          }
        }
      }
    } catch (error) {
      console.warn('Error procesando fecha de horario:', error, fechaFuente)
      fecha = null
    }
  }

  let fechaFin = null
  if (apiHorario.fechaFin) {
    try {
      if (typeof apiHorario.fechaFin === 'string') {
        fechaFin = apiHorario.fechaFin.split('T')[0]
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
          const date = new Date(apiHorario.fechaFin)
          if (!isNaN(date.getTime())) {
            fechaFin = date.toISOString().split('T')[0]
          } else {
            fechaFin = null
          }
        }
      }
    } catch (error) {
      console.warn('Error procesando fechaFin de horario:', error)
      fechaFin = null
    }
  }

  // Extraer hora de inicio (puede venir como DateTime completo o solo hora)
  let horaInicio = ''
  if (apiHorario.horaInicio) {
    if (typeof apiHorario.horaInicio === 'string') {
      // Si viene como DateTime (ej: "2025-11-18T13:00:00"), extraer solo la hora
      if (apiHorario.horaInicio.includes('T')) {
        horaInicio = apiHorario.horaInicio.split('T')[1]?.split(':').slice(0, 2).join(':') || ''
      } else {
        // Si ya viene como hora (ej: "13:00")
        horaInicio = apiHorario.horaInicio.split(':').slice(0, 2).join(':')
      }
    }
  }

  // Extraer hora de fin (puede venir como DateTime completo o solo hora)
  let horaFin = ''
  if (apiHorario.horaFin) {
    if (typeof apiHorario.horaFin === 'string') {
      // Si viene como DateTime (ej: "2025-11-18T14:00:00"), extraer solo la hora
      if (apiHorario.horaFin.includes('T')) {
        horaFin = apiHorario.horaFin.split('T')[1]?.split(':').slice(0, 2).join(':') || ''
      } else {
        // Si ya viene como hora (ej: "14:00")
        horaFin = apiHorario.horaFin.split(':').slice(0, 2).join(':')
      }
    }
  }

  // Intentar obtener docenteId de diferentes formas
  let docenteId = apiHorario.usuarioId || apiHorario.usuarioIdUsuario || apiHorario.Usuario_idUsuario || apiHorario.UsuarioId || apiHorario.docenteId || apiHorario.idDocente
  
  // Si no hay docenteId pero hay información del usuario, guardarla para búsqueda posterior
  const usuarioNombre = apiHorario.usuarioNombre || apiHorario.UsuarioNombre
  const usuarioCorreo = apiHorario.usuarioCorreo || apiHorario.UsuarioCorreo
  const usuarioApellidos = apiHorario.usuarioApellidos || apiHorario.UsuarioApellidos

  return {
    id: apiHorario.idHorario || apiHorario.id,
    titulo: apiHorario.titulo || '',
    fecha: fecha,
    fechaFin: fechaFin,
    horaInicio: horaInicio,
    horaFin: horaFin,
    docenteId: docenteId,
    // Guardar información del usuario para búsqueda posterior si no hay ID
    docenteNombre: usuarioNombre,
    docenteApellidos: usuarioApellidos,
    docenteCorreo: usuarioCorreo,
    disponible: apiHorario.disponible !== undefined ? apiHorario.disponible : true,
    estado: apiHorario.estado || apiHorario.Estado || 'Disponible',
    cuposDisponibles: parseInt(apiHorario.cupos, 10) || apiHorario.cuposDisponibles || 5,
    tipoClase: apiHorario.tipoClase || 'Presencial',
    salon: apiHorario.espacio || apiHorario.salon || '',
    notas: apiHorario.notas || '',
  }
}

const mapHorarioToAPI = (frontendHorario, docenteData = null) => {
  // Validar y convertir docenteId - debe ser un número válido
  let docenteId = null
  if (frontendHorario.docenteId) {
    const parsedId = parseInt(frontendHorario.docenteId)
    if (!isNaN(parsedId) && parsedId > 0) {
      docenteId = parsedId
    } else {
      console.warn('docenteId inválido:', frontendHorario.docenteId)
    }
  }

  // Formatear fecha correctamente (asegurar formato YYYY-MM-DD)
  let fecha = frontendHorario.fecha
  if (!fecha) {
    throw new Error('La fecha es requerida')
  }
  
  // Si la fecha viene en formato diferente, convertirla
  if (typeof fecha === 'string') {
    if (fecha.includes('/')) {
      // Convertir de DD/MM/YYYY a YYYY-MM-DD
      const parts = fecha.split('/')
      if (parts.length === 3) {
        fecha = `${parts[2]}-${parts[1]}-${parts[0]}`
      }
    }
    // Asegurar que la fecha esté en formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      try {
        const date = new Date(fecha)
        if (isNaN(date.getTime())) {
          throw new Error(`Fecha inválida: ${fecha}`)
        }
        fecha = date.toISOString().split('T')[0]
      } catch (e) {
        console.error('Error formateando fecha:', e, fecha)
        throw new Error(`Fecha inválida: ${fecha}`)
      }
    }
  }

  // Validar horaInicio y horaFin
  if (!frontendHorario.horaInicio || !frontendHorario.horaFin) {
    throw new Error('Las horas de inicio y fin son requeridas')
  }

  // Formatear horaInicio y horaFin (asegurar formato HH:mm)
  let horaInicio = frontendHorario.horaInicio.trim()
  let horaFin = frontendHorario.horaFin.trim()
  
  // Convertir formato 12 horas a 24 horas si es necesario (ej: "10:00 a. m." -> "10:00")
  if (horaInicio.includes('a. m.') || horaInicio.includes('p. m.')) {
    horaInicio = horaInicio.replace(/\s*(a\.\s*m\.|p\.\s*m\.)\s*/i, '').trim()
    // Si tiene formato AM/PM, necesitamos convertir
    const horaParts = horaInicio.split(':')
    if (horaParts.length === 2) {
      let horas = parseInt(horaParts[0])
      const minutos = horaParts[1]
      if (frontendHorario.horaInicio.toLowerCase().includes('p. m.') && horas !== 12) {
        horas += 12
      } else if (frontendHorario.horaInicio.toLowerCase().includes('a. m.') && horas === 12) {
        horas = 0
      }
      horaInicio = `${horas.toString().padStart(2, '0')}:${minutos}`
    }
  }
  
  if (horaFin.includes('a. m.') || horaFin.includes('p. m.')) {
    horaFin = horaFin.replace(/\s*(a\.\s*m\.|p\.\s*m\.)\s*/i, '').trim()
    const horaParts = horaFin.split(':')
    if (horaParts.length === 2) {
      let horas = parseInt(horaParts[0])
      const minutos = horaParts[1]
      if (frontendHorario.horaFin.toLowerCase().includes('p. m.') && horas !== 12) {
        horas += 12
      } else if (frontendHorario.horaFin.toLowerCase().includes('a. m.') && horas === 12) {
        horas = 0
      }
      horaFin = `${horas.toString().padStart(2, '0')}:${minutos}`
    }
  }
  
  // Validar formato de hora (HH:mm)
  if (!/^\d{2}:\d{2}$/.test(horaInicio) || !/^\d{2}:\d{2}$/.test(horaFin)) {
    throw new Error('El formato de hora debe ser HH:mm (ej: 09:00, 14:30)')
  }

  // La API .NET (según el script SQL) espera:
  // fechaInicio (DATE), fechaFin (DATE), horaInicio (DATETIME), horaFin (DATETIME),
  // cupos (VARCHAR), espacio (VARCHAR), estado (VARCHAR), Usuario_idUsuario (INT)

  // Determinar fechaFin: si no viene, usar la misma fecha
  let fechaFin = frontendHorario.fechaFin
  if (!fechaFin) {
    fechaFin = fecha
  } else if (typeof fechaFin === 'string') {
    if (fechaFin.includes('/')) {
      const parts = fechaFin.split('/')
      if (parts.length === 3) {
        fechaFin = `${parts[2]}-${parts[1]}-${parts[0]}`
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
      try {
        const date = new Date(fechaFin)
        if (!isNaN(date.getTime())) {
          fechaFin = date.toISOString().split('T')[0]
        }
      } catch {}
    }
  }

  // La API .NET espera DateTime completo en formato ISO 8601
  // Combinar fecha con hora para crear DateTime: YYYY-MM-DDTHH:mm:ss
  const fechaHoraInicio = `${fecha}T${horaInicio}:00`
  const fechaHoraFin = `${fecha}T${horaFin}:00`
  
  // FechaInicio y FechaFin también deben ser DateTime (inicio y fin del día)
  const fechaInicioDateTime = `${fecha}T00:00:00`
  const fechaFinDateTime = `${fechaFin}T23:59:59`

  // Obtener cupos como número primero
  const cuposNum = frontendHorario.cuposDisponibles ? parseInt(frontendHorario.cuposDisponibles) : 5

  // Validar que el espacio no esté vacío (el DTO lo requiere)
  const espacio = (frontendHorario.salon || '').trim()
  if (!espacio) {
    throw new Error('El campo Salón es obligatorio')
  }

  // Validar que docenteId esté presente (el DTO lo requiere)
  if (!docenteId) {
    throw new Error('Debe seleccionar un docente/tutor')
  }

  // Construir el objeto para la API con los nombres de propiedades del backend
  // El DTO espera PascalCase: FechaInicio, FechaFin, HoraInicio, HoraFin, Cupos, Espacio, Estado, UsuarioId
  // Todos los campos DateTime deben estar en formato ISO 8601
  const horarioData = {
    FechaInicio: fechaInicioDateTime,  // DateTime (inicio del día)
    FechaFin: fechaFinDateTime,        // DateTime (fin del día)
    HoraInicio: fechaHoraInicio,       // DateTime (hora específica de inicio)
    HoraFin: fechaHoraFin,             // DateTime (hora específica de fin)
    Cupos: String(cuposNum),           // VARCHAR en la BD
    Espacio: espacio,
    Estado: 'Disponible',
    UsuarioId: docenteId               // Campo requerido por el DTO
  }

  // Agregar título si está disponible (aunque no esté en el DTO, puede ser útil)
  if (frontendHorario.titulo && frontendHorario.titulo.trim()) {
    horarioData.Titulo = frontendHorario.titulo.trim()
  }
  
  console.log('Horario mapeado para API:', horarioData)
  
  // Agregar fechaFin solo si es diferente de fecha (puede que la API no lo acepte)
  // Comentado por ahora ya que puede no ser parte del DTO
  // if (frontendHorario.fechaFin && frontendHorario.fechaFin !== fecha) {
  //   let fechaFin = frontendHorario.fechaFin
  //   if (fechaFin.includes('/')) {
  //     const parts = fechaFin.split('/')
  //     if (parts.length === 3) {
  //       fechaFin = `${parts[2]}-${parts[1]}-${parts[0]}`
  //     }
  //   }
  //   if (/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
  //     horarioData.fechaFin = fechaFin
  //   }
  // }
  
  // Notas pueden agregarse si el backend las soporta
  if (frontendHorario.notas && frontendHorario.notas.trim()) {
    horarioData.Notas = frontendHorario.notas.trim()
  }

  return horarioData
}

const mapTutoriaFromAPI = (apiTutoria) => {
  // Validar y formatear fecha desde FechaTutoria (DateTime) o fecha
  let fecha = null
  let horaInicio = ''
  let horaFin = ''
  
  const fechaFuente = apiTutoria.fechaTutoria || apiTutoria.fecha
  if (fechaFuente) {
    try {
      if (typeof fechaFuente === 'string') {
        // Si viene como DateTime ISO (YYYY-MM-DDTHH:mm:ss), separar fecha y hora
        if (fechaFuente.includes('T')) {
          const [datePart, timePart] = fechaFuente.split('T')
          fecha = datePart
          if (timePart) {
            horaInicio = timePart.substring(0, 5) // HH:mm
          }
        } else {
          fecha = fechaFuente.split('T')[0]
        }
        
        // Validar formato YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
          const date = new Date(fechaFuente)
          if (!isNaN(date.getTime())) {
            fecha = date.toISOString().split('T')[0]
            if (!horaInicio && fechaFuente.includes('T')) {
              horaInicio = date.toISOString().split('T')[1].substring(0, 5)
            }
          } else {
            console.warn('Fecha inválida en tutoria:', fechaFuente)
            fecha = null
          }
        }
      }
    } catch (error) {
      console.warn('Error procesando fecha de tutoria:', error, fechaFuente)
      fecha = null
    }
  }

  // Extraer horaInicio y horaFin de HorarioHoraInicio/HorarioHoraFin si están disponibles
  if (apiTutoria.horarioHoraInicio) {
    try {
      const horarioInicio = typeof apiTutoria.horarioHoraInicio === 'string' 
        ? apiTutoria.horarioHoraInicio 
        : new Date(apiTutoria.horarioHoraInicio).toISOString()
      if (horarioInicio.includes('T')) {
        horaInicio = horarioInicio.split('T')[1].substring(0, 5)
      }
    } catch (e) {
      console.warn('Error procesando horarioHoraInicio:', e)
    }
  }

  if (apiTutoria.horarioHoraFin) {
    try {
      const horarioFin = typeof apiTutoria.horarioHoraFin === 'string' 
        ? apiTutoria.horarioHoraFin 
        : new Date(apiTutoria.horarioHoraFin).toISOString()
      if (horarioFin.includes('T')) {
        horaFin = horarioFin.split('T')[1].substring(0, 5)
      }
    } catch (e) {
      console.warn('Error procesando horarioHoraFin:', e)
    }
  }

  // Extraer información del docente desde UsuarioNombre, UsuarioApellidos, UsuarioCorreo
  // o desde el objeto Profesor si está disponible
  // Nota: En Tutoria, UsuarioId es el docente (quien da la tutoría), no el estudiante
  // Los estudiantes están en la tabla intermedia TutoriaEstudiante
  let docenteId = apiTutoria.docenteId || apiTutoria.idDocente || apiTutoria.usuarioId || apiTutoria.UsuarioId
  const docenteNombre = apiTutoria.usuarioNombre || apiTutoria.UsuarioNombre || (apiTutoria.profesor?.nombres || apiTutoria.profesor?.nombre)
  const docenteApellidos = apiTutoria.usuarioApellidos || apiTutoria.UsuarioApellidos || apiTutoria.profesor?.apellidos
  const docenteCorreo = apiTutoria.usuarioCorreo || apiTutoria.UsuarioCorreo || apiTutoria.profesor?.correo

  // Extraer estudiantes de la lista Estudiantes si está disponible
  const estudiantesIds = apiTutoria.estudiantes && Array.isArray(apiTutoria.estudiantes)
    ? apiTutoria.estudiantes.map(e => e.idUsuario || e.id || e.estudianteId).filter(Boolean)
    : []

  return {
    id: apiTutoria.idTutoria || apiTutoria.id,
    // Para compatibilidad: usar el primer estudiante si hay lista, o el estudianteId directo
    estudianteId: estudiantesIds.length > 0 ? estudiantesIds[0] : (apiTutoria.usuarioId || apiTutoria.estudianteId || apiTutoria.idEstudiante),
    // Guardar todos los IDs de estudiantes
    estudiantesIds: estudiantesIds.length > 0 ? estudiantesIds : (apiTutoria.usuarioId ? [apiTutoria.usuarioId] : []),
    docenteId: docenteId,
    // Guardar información del docente para búsqueda posterior
    docenteNombre: docenteNombre,
    docenteApellidos: docenteApellidos,
    docenteCorreo: docenteCorreo,
    // Intentar obtener horarioId de diferentes variantes del nombre del campo
    horarioId: apiTutoria.horarioId || apiTutoria.idHorario || apiTutoria.horario_idHorario || apiTutoria.HorarioId || apiTutoria.Horario_idHorario,
    tema: apiTutoria.tema || '',
    idioma: apiTutoria.idioma || '',
    nivel: apiTutoria.nivel || '',
    modalidad: apiTutoria.modalidad || '',
    fecha: fecha,
    horaInicio: horaInicio || apiTutoria.horaInicio || '',
    horaFin: horaFin || apiTutoria.horaFin || '',
    estado: apiTutoria.estado || 'Pendiente',
    notas: apiTutoria.notas || '',
  }
}

const mapTutoriaToAPI = (frontendTutoria) => {
  // Validar y formatear fecha
  let fecha = frontendTutoria.fecha
  if (!fecha) {
    throw new Error('La fecha es requerida')
  }
  
  // Convertir fecha a formato YYYY-MM-DD si viene en otro formato
  if (typeof fecha === 'string') {
    if (fecha.includes('/')) {
      const parts = fecha.split('/')
      if (parts.length === 3) {
        fecha = `${parts[2]}-${parts[1]}-${parts[0]}`
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      try {
        const date = new Date(fecha)
        if (isNaN(date.getTime())) {
          throw new Error(`Fecha inválida: ${fecha}`)
        }
        fecha = date.toISOString().split('T')[0]
      } catch (e) {
        console.error('Error formateando fecha:', e, fecha)
        throw new Error(`Fecha inválida: ${fecha}`)
      }
    }
  }

  // Validar y formatear horaInicio
  let horaInicio = frontendTutoria.horaInicio || '09:00'
  if (typeof horaInicio === 'string') {
    horaInicio = horaInicio.trim()
    // Convertir formato 12 horas a 24 horas si es necesario
    if (horaInicio.includes('a. m.') || horaInicio.includes('p. m.')) {
      horaInicio = horaInicio.replace(/\s*(a\.\s*m\.|p\.\s*m\.)\s*/i, '').trim()
      const horaParts = horaInicio.split(':')
      if (horaParts.length === 2) {
        let horas = parseInt(horaParts[0])
        const minutos = horaParts[1]
        if (frontendTutoria.horaInicio.toLowerCase().includes('p. m.') && horas !== 12) {
          horas += 12
        } else if (frontendTutoria.horaInicio.toLowerCase().includes('a. m.') && horas === 12) {
          horas = 0
        }
        horaInicio = `${horas.toString().padStart(2, '0')}:${minutos}`
      }
    }
    if (!/^\d{2}:\d{2}$/.test(horaInicio)) {
      throw new Error('El formato de hora de inicio debe ser HH:mm (ej: 09:00, 14:30)')
    }
  }

  // Combinar fecha y horaInicio en FechaTutoria (DateTime)
  const fechaTutoria = `${fecha}T${horaInicio}:00`

  // Validar campos requeridos
  if (!frontendTutoria.idioma || !frontendTutoria.idioma.trim()) {
    throw new Error('El idioma es obligatorio')
  }
  if (!frontendTutoria.nivel || !frontendTutoria.nivel.trim()) {
    throw new Error('El nivel es obligatorio')
  }
  if (!frontendTutoria.modalidad || !frontendTutoria.modalidad.trim()) {
    throw new Error('La modalidad es obligatoria')
  }

  const tutoriaData = {
    idioma: frontendTutoria.idioma.trim(),
    nivel: frontendTutoria.nivel.trim(),
    tema: frontendTutoria.tema || '',
    modalidad: frontendTutoria.modalidad.trim(),
    estado: frontendTutoria.estado || 'Pendiente',
    fechaTutoria: fechaTutoria, // DateTime en formato ISO: YYYY-MM-DDTHH:mm:ss
  }

  // HorarioId es requerido por el backend - validar que esté presente
  if (!frontendTutoria.horarioId) {
    throw new Error('El ID del horario es obligatorio para crear una tutoría')
  }
  tutoriaData.horarioId = parseInt(frontendTutoria.horarioId)

  // UsuarioId: Si hay estudianteId, usarlo; si no, usar docenteId como UsuarioId
  // (el backend requiere UsuarioId, y el docente es quien da la tutoría)
  if (frontendTutoria.estudianteId) {
    tutoriaData.usuarioId = parseInt(frontendTutoria.estudianteId)
  } else if (frontendTutoria.docenteId) {
    // Usar el docente como UsuarioId si no hay estudiante
    tutoriaData.usuarioId = parseInt(frontendTutoria.docenteId)
  } else {
    throw new Error('Se requiere al menos un docente/tutor para la tutoría')
  }

  // Validar que los IDs sean números válidos
  if (isNaN(tutoriaData.horarioId)) {
    throw new Error('El ID del horario debe ser un número válido')
  }
  if (isNaN(tutoriaData.usuarioId)) {
    throw new Error('El ID del usuario debe ser un número válido')
  }

  console.log('Datos de tutoría a enviar:', tutoriaData)
  return tutoriaData
}

export const DataProvider = ({ children }) => {
  const [horarios, setHorarios] = useState([])
  const [estudiantes, setEstudiantes] = useState([])
  const [docentes, setDocentes] = useState([])
  const [tutorias, setTutorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Cargar todos los datos desde la API
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Cargar usuarios (estudiantes y docentes)
      const [usuariosData, horariosData, tutoriasData] = await Promise.all([
        usuarioService.getAll().catch((err) => {
          console.error('Error cargando usuarios:', err.message)
          // Si es un error 502, lanzar el error para que se muestre al usuario
          if (err.message.includes('502') || err.message.includes('Bad Gateway')) {
            throw err
          }
          return []
        }),
        horarioService.getAll().catch((err) => {
          console.error('Error cargando horarios:', err.message)
          if (err.message.includes('502') || err.message.includes('Bad Gateway')) {
            throw err
          }
          return []
        }),
        tutoriaService.getAll().catch((err) => {
          console.error('Error cargando tutorías:', err.message)
          if (err.message.includes('502') || err.message.includes('Bad Gateway')) {
            throw err
          }
          return []
        }),
      ])

      // Log para debug - ver qué está devolviendo la API
      console.log('Usuarios recibidos de la API:', usuariosData)
      console.log('Total de usuarios recibidos:', Array.isArray(usuariosData) ? usuariosData.length : 0)

      // Separar estudiantes y docentes por tipoRol
      // Usar tanto tipoRol como TipoRol (PascalCase) para compatibilidad
      const estudiantesList = Array.isArray(usuariosData)
        ? usuariosData
            .filter(u => {
              const rol = (u.tipoRol || u.TipoRol || u.rol || '').toLowerCase()
              return rol === 'estudiante'
            })
            .map(mapUsuarioFromAPI)
        : []
      
      const docentesList = Array.isArray(usuariosData)
        ? usuariosData
            .filter(u => {
              const rol = (u.tipoRol || u.TipoRol || u.rol || '').toLowerCase()
              return rol === 'docente' || rol === 'administrador' || rol === 'coordinador' || rol === 'tutor'
            })
            .map(mapUsuarioFromAPI)
        : []

      // Log para debug - ver cuántos usuarios se filtraron
      console.log('Estudiantes filtrados:', estudiantesList.length)
      console.log('Docentes filtrados:', docentesList.length)
      
      // Si hay usuarios que no se filtraron, mostrarlos en consola para debug
      if (Array.isArray(usuariosData)) {
        const usuariosSinRol = usuariosData.filter(u => {
          const rol = (u.tipoRol || u.TipoRol || u.rol || '').toLowerCase()
          return rol !== 'estudiante' && rol !== 'docente' && rol !== 'administrador' && rol !== 'coordinador' && rol !== 'tutor'
        })
        if (usuariosSinRol.length > 0) {
          console.warn('Usuarios sin rol reconocido o con rol vacío:', usuariosSinRol)
        }
      }

      setEstudiantes(estudiantesList)
      setDocentes(docentesList)
      
      // Mapear y filtrar horarios válidos (con fecha válida)
      const horariosMapeados = Array.isArray(horariosData) 
        ? horariosData.map(mapHorarioFromAPI).filter(h => h && h.fecha && h.horaInicio && h.horaFin)
        : []
      setHorarios(horariosMapeados)
      
      // Mapear y filtrar tutorías válidas (con fecha válida)
      let tutoriasMapeadas = Array.isArray(tutoriasData)
        ? tutoriasData.map(mapTutoriaFromAPI).filter(t => t && t.fecha && t.horaInicio && t.horaFin)
        : []
      
      // Preservar horarioId y docenteId de tutorías existentes o intentar deducirlos
      setTutorias(prevTutorias => {
        // Crear mapas de tutorías existentes por ID para preservar datos
        const existingTutoriasMap = new Map()
        const existingDocentesMap = new Map()
        prevTutorias.forEach(t => {
          if (t.id) {
            if (t.horarioId) {
              existingTutoriasMap.set(t.id, t.horarioId)
            }
            if (t.docenteId) {
              existingDocentesMap.set(t.id, {
                docenteId: t.docenteId,
                docenteNombre: t.docenteNombre,
                docenteApellidos: t.docenteApellidos,
                docenteCorreo: t.docenteCorreo
              })
            }
          }
        })
        
        // Actualizar tutorías mapeadas con datos preservados o deducidos
        const tutoriasConDatos = tutoriasMapeadas.map(t => {
          let tutoriaActualizada = { ...t }
          
          // Preservar horarioId
          if (!tutoriaActualizada.horarioId) {
            const existingHorarioId = existingTutoriasMap.get(t.id)
            if (existingHorarioId) {
              tutoriaActualizada.horarioId = existingHorarioId
            } else {
              // Intentar deducirlo comparando fecha y horas con horarios
              if (t.fecha && t.horaInicio && t.horaFin && horariosMapeados.length > 0) {
                const matchingHorario = horariosMapeados.find(h => {
                  const fechaMatch = h.fecha === t.fecha
                  const horaInicioMatch = h.horaInicio === t.horaInicio
                  const horaFinMatch = h.horaFin === t.horaFin
                  return fechaMatch && horaInicioMatch && horaFinMatch
                })
                
                if (matchingHorario) {
                  tutoriaActualizada.horarioId = matchingHorario.id
                }
              }
            }
          }
          
          // Preservar información del docente
          if (!tutoriaActualizada.docenteId) {
            const existingDocente = existingDocentesMap.get(t.id)
            if (existingDocente) {
              tutoriaActualizada.docenteId = existingDocente.docenteId
              tutoriaActualizada.docenteNombre = existingDocente.docenteNombre
              tutoriaActualizada.docenteApellidos = existingDocente.docenteApellidos
              tutoriaActualizada.docenteCorreo = existingDocente.docenteCorreo
            }
          }
          
          return tutoriaActualizada
        })
        
        return tutoriasConDatos
      })
      
      console.log('DataContext: Datos cargados exitosamente', {
        estudiantes: estudiantesList.length,
        docentes: docentesList.length,
        horarios: horariosMapeados.length,
        tutorias: tutoriasMapeadas.length,
        horariosRaw: horariosData.length,
        tutoriasRaw: tutoriasData.length
      })
    } catch (err) {
      console.error('Error cargando datos:', err)
      setError(err.message || 'Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [])

  // Cargar datos al montar el componente
  useEffect(() => {
    console.log('DataContext: Cargando datos desde la API...')
    loadData()
  }, [loadData])

  // ==================== HORARIOS ====================
  const addHorario = async (horario) => {
    try {
      // Obtener datos del docente si está disponible
      let docenteData = null
      if (horario.docenteId) {
        const docenteIdNum = parseInt(horario.docenteId)
        // Buscar en docentes
        docenteData = docentes.find(d => d.id === docenteIdNum)
        
        // Si no se encuentra, buscar en todos los usuarios (estudiantes + docentes)
        if (!docenteData) {
          const allUsers = [...estudiantes, ...docentes]
          docenteData = allUsers.find(u => u.id === docenteIdNum)
          if (docenteData) {
            console.log('Docente encontrado en todos los usuarios:', docenteData)
          }
        }
      }
      
      const horarioData = mapHorarioToAPI(horario, docenteData)
      console.log('Enviando horario a la API:', horarioData)
      const response = await horarioService.create(horarioData)
      const newHorario = mapHorarioFromAPI(response)
      console.log('Horario creado y mapeado:', newHorario)
      
      // Validar que el horario tenga los campos necesarios antes de agregarlo
      if (newHorario && newHorario.fecha && newHorario.horaInicio && newHorario.horaFin) {
        setHorarios(prev => [...prev, newHorario])
      } else {
        console.warn('Horario creado pero con datos incompletos, recargando desde API:', newHorario)
        // Si el horario no tiene los datos completos, recargar desde la API
        await loadData()
      }
      
      return newHorario
    } catch (err) {
      console.error('Error creando horario:', err)
      console.error('Datos que se intentaron enviar:', mapHorarioToAPI(horario))
      throw err
    }
  }

  const updateHorario = async (id, updatedData) => {
    try {
      // Obtener datos del docente si está disponible
      let docenteData = null
      if (updatedData.docenteId) {
        const docenteIdNum = parseInt(updatedData.docenteId)
        // Buscar en docentes
        docenteData = docentes.find(d => d.id === docenteIdNum)
        
        // Si no se encuentra, buscar en todos los usuarios
        if (!docenteData) {
          const allUsers = [...estudiantes, ...docentes]
          docenteData = allUsers.find(u => u.id === docenteIdNum)
        }
      }
      
      const horarioData = mapHorarioToAPI(updatedData, docenteData)
      const response = await horarioService.update(id, horarioData)
      const updatedHorario = mapHorarioFromAPI(response)
      setHorarios(prev => prev.map(h => h.id === id ? updatedHorario : h))
      return updatedHorario
    } catch (err) {
      console.error('Error actualizando horario:', err)
      throw err
    }
  }

  const deleteHorario = async (id) => {
    try {
      await horarioService.delete(id)
      setHorarios(prev => prev.filter(h => h.id !== id))
    } catch (err) {
      console.error('Error eliminando horario:', err)
      throw err
    }
  }

  // ==================== ESTUDIANTES ====================
  const addEstudiante = async (estudiante) => {
    try {
      const estudianteData = mapUsuarioToAPI(estudiante, true)
      const response = await usuarioService.create(estudianteData)
      const newEstudiante = mapUsuarioFromAPI(response)
      setEstudiantes(prev => [...prev, newEstudiante])
      return newEstudiante
    } catch (err) {
      console.error('Error creando estudiante:', err)
      throw err
    }
  }

  const updateEstudiante = async (id, updatedData) => {
    try {
      const estudianteData = mapUsuarioToAPI(updatedData, true)
      const response = await usuarioService.update(id, estudianteData)
      const updatedEstudiante = mapUsuarioFromAPI(response)
      setEstudiantes(prev => prev.map(e => e.id === id ? updatedEstudiante : e))
      return updatedEstudiante
    } catch (err) {
      console.error('Error actualizando estudiante:', err)
      throw err
    }
  }

  const deleteEstudiante = async (id) => {
    try {
      await usuarioService.delete(id)
      setEstudiantes(prev => prev.filter(e => e.id !== id))
    } catch (err) {
      console.error('Error eliminando estudiante:', err)
      throw err
    }
  }

  // ==================== DOCENTES ====================
  const addDocente = async (docente) => {
    try {
      const docenteData = mapUsuarioToAPI(docente, false)
      const response = await usuarioService.create(docenteData)
      const newDocente = mapUsuarioFromAPI(response)
      setDocentes(prev => [...prev, newDocente])
      return newDocente
    } catch (err) {
      console.error('Error creando docente:', err)
      throw err
    }
  }

  const updateDocente = async (id, updatedData) => {
    try {
      const docenteData = mapUsuarioToAPI(updatedData, false)
      const response = await usuarioService.update(id, docenteData)
      const updatedDocente = mapUsuarioFromAPI(response)
      setDocentes(prev => prev.map(d => d.id === id ? updatedDocente : d))
      return updatedDocente
    } catch (err) {
      console.error('Error actualizando docente:', err)
      throw err
    }
  }

  const deleteDocente = async (id) => {
    try {
      await usuarioService.delete(id)
      setDocentes(prev => prev.filter(d => d.id !== id))
    } catch (err) {
      console.error('Error eliminando docente:', err)
      throw err
    }
  }

  // ==================== TUTORIAS ====================
  const addTutoria = async (tutoria) => {
    try {
      console.log('Creando tutoría con datos:', tutoria)
      const tutoriaData = mapTutoriaToAPI(tutoria)
      console.log('Datos mapeados para API:', tutoriaData)
      const response = await tutoriaService.create(tutoriaData)
      console.log('Respuesta del backend:', response)
      const newTutoria = mapTutoriaFromAPI(response)
      // Preservar el horarioId del request ya que la API no lo devuelve en la respuesta
      if (tutoria.horarioId && !newTutoria.horarioId) {
        newTutoria.horarioId = tutoria.horarioId
      }
      // También preservar el docenteId si no viene en la respuesta
      if (tutoria.docenteId && !newTutoria.docenteId) {
        newTutoria.docenteId = tutoria.docenteId
        // Buscar información del docente para preservarla
        const docente = docentes.find(d => d.id === tutoria.docenteId)
        if (docente) {
          newTutoria.docenteNombre = docente.nombres || docente.nombre
          newTutoria.docenteApellidos = docente.apellidos || docente.apellido
          newTutoria.docenteCorreo = docente.email || docente.correo
        }
      }
      // Preservar el estudianteId del request ya que la API puede no devolverlo correctamente
      if (tutoria.estudianteId && !newTutoria.estudianteId) {
        newTutoria.estudianteId = tutoria.estudianteId
        // Agregar a estudiantesIds si no está
        if (!newTutoria.estudiantesIds || newTutoria.estudiantesIds.length === 0) {
          newTutoria.estudiantesIds = [tutoria.estudianteId]
        }
      }
      console.log('Tutoría mapeada desde API (con horarioId preservado):', newTutoria)
      setTutorias(prev => [...prev, newTutoria])
      // Recargar datos para obtener la información completa
      await loadData()
      return newTutoria
    } catch (err) {
      console.error('Error creando tutoria:', err)
      console.error('Datos que se intentaron enviar:', tutoria)
      // Mejorar el mensaje de error
      if (err.message && err.message.includes('Usuario no encontrado')) {
        throw new Error('El docente/tutor seleccionado no existe en el sistema. Por favor verifica que el docente esté registrado correctamente.')
      }
      throw err
    }
  }

  const updateTutoria = async (id, updatedData) => {
    try {
      const tutoriaData = mapTutoriaToAPI(updatedData)
      const response = await tutoriaService.update(id, tutoriaData)
      const updatedTutoria = mapTutoriaFromAPI(response)
      setTutorias(prev => prev.map(t => t.id === id ? updatedTutoria : t))
      return updatedTutoria
    } catch (err) {
      console.error('Error actualizando tutoria:', err)
      throw err
    }
  }

  const deleteTutoria = async (id) => {
    try {
      // Validar que el ID sea un número válido
      const tutoriaId = parseInt(id)
      if (isNaN(tutoriaId)) {
        throw new Error(`ID de tutoría inválido: ${id}`)
      }
      
      console.log(`[deleteTutoria] Eliminando tutoría con ID: ${tutoriaId}`)
      
      // Verificar que la tutoría existe antes de intentar eliminarla
      const tutoria = tutorias.find(t => t.id === tutoriaId)
      if (!tutoria) {
        console.warn(`[deleteTutoria] Tutoría con ID ${tutoriaId} no encontrada en el estado local`)
      }
      
      // Llamar al endpoint correcto de tutoría
      await tutoriaService.delete(tutoriaId)
      
      console.log(`[deleteTutoria] Tutoría ${tutoriaId} eliminada exitosamente`)
      
      // Actualizar el estado local
      setTutorias(prev => prev.filter(t => t.id !== tutoriaId))
      
      // También recargar datos para asegurar consistencia
      await loadData()
    } catch (err) {
      console.error('[deleteTutoria] Error eliminando tutoria:', err)
      console.error('[deleteTutoria] ID recibido:', id)
      console.error('[deleteTutoria] Tipo de ID:', typeof id)
      
      // Extraer mensaje de error más descriptivo
      let errorMessage = 'Error al eliminar la tutoría'
      
      // Intentar extraer el mensaje del error de diferentes formas
      if (err?.response?.data) {
        const errorData = err.response.data
        errorMessage = errorData.message || errorData.details || errorMessage
        // Si hay detalles adicionales, agregarlos
        if (errorData.details && errorData.details !== errorData.message) {
          errorMessage = `${errorMessage}: ${errorData.details}`
        }
      } else if (err?.message) {
        errorMessage = err.message
      }
      
      throw new Error(errorMessage)
    }
  }

  const eliminarEstudianteDeTutoria = async (tutoriaId, estudianteId) => {
    try {
      await tutoriaService.eliminarEstudiante(tutoriaId, estudianteId)
      // Actualizar la tutoría en el estado local
      setTutorias(prev => prev.map(t => {
        if (t.id === tutoriaId) {
          // Remover el estudiante de estudiantesIds
          const nuevosEstudiantesIds = (t.estudiantesIds || []).filter(id => id !== estudianteId)
          // Si estudiantesIds queda vacío y había un estudianteId único, limpiarlo
          if (nuevosEstudiantesIds.length === 0 && t.estudianteId === estudianteId) {
            return { ...t, estudiantesIds: [], estudianteId: null }
          }
          return { ...t, estudiantesIds: nuevosEstudiantesIds }
        }
        return t
      }))
      // Recargar datos para asegurar consistencia
      await loadData()
    } catch (err) {
      console.error('Error eliminando estudiante de tutoria:', err)
      const errorMessage = err?.response?.data?.message || err?.message || 'Error al eliminar el estudiante de la tutoría'
      throw new Error(errorMessage)
    }
  }

  // ==================== FUNCIONES DE UTILIDAD ====================
  const getEstudianteById = (id) => {
    return estudiantes.find(e => e.id === id)
  }

  const getDocenteById = (id) => {
    return docentes.find(d => d.id === id)
  }

  const getTutoriaById = (id) => {
    return tutorias.find(t => t.id === id)
  }

  const getHorariosDisponibles = () => {
    return horarios.filter(h => h.disponible !== false)
  }

  const getTutoriasHoy = () => {
    const today = new Date().toISOString().split('T')[0]
    return tutorias.filter(t => {
      const tutoriaDate = t.fecha ? t.fecha.split('T')[0] : t.fecha
      return tutoriaDate === today
    })
  }

  const getProximasTutorias = () => {
    const today = new Date().toISOString().split('T')[0]
    return tutorias
      .filter(t => {
        const tutoriaDate = t.fecha ? t.fecha.split('T')[0] : t.fecha
        return tutoriaDate >= today
      })
      .sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha)
        return (a.horaInicio || '').localeCompare(b.horaInicio || '')
      })
      .slice(0, 5)
  }

  const getEstudiantesRecientes = () => {
    return estudiantes.slice(-5).reverse()
  }

  const value = {
    horarios,
    estudiantes,
    tutorias,
    docentes,
    loading,
    error,
    loadData,
    addHorario,
    updateHorario,
    deleteHorario,
    addEstudiante,
    updateEstudiante,
    deleteEstudiante,
    addDocente,
    updateDocente,
    deleteDocente,
    addTutoria,
    updateTutoria,
    deleteTutoria,
    eliminarEstudianteDeTutoria,
    getEstudianteById,
    getDocenteById,
    getTutoriaById,
    getHorariosDisponibles,
    getTutoriasHoy,
    getProximasTutorias,
    getEstudiantesRecientes,
    tutoriaService
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
