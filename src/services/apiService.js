import { API_BASE_URL, getDefaultHeaders } from '../config/apiConfig'

// Función auxiliar para manejar respuestas
const handleResponse = async (response) => {
  if (!response.ok) {
    let errorMessage = `Error ${response.status}: ${response.statusText}`
    
    // Mensajes específicos para errores comunes
    if (response.status === 502) {
      errorMessage = '502 Bad Gateway: ngrok no puede conectarse a tu API .NET. Verifica que: 1) Tu API .NET esté corriendo en el puerto 5208, 2) ngrok esté configurado correctamente (debe usar http://localhost:5208, no https://), 3) No haya firewall bloqueando la conexión.'
    } else if (response.status === 503) {
      errorMessage = '503 Service Unavailable: El servidor no está disponible. Verifica que tu API .NET esté corriendo.'
    } else if (response.status === 404) {
      errorMessage = `404 Not Found: El endpoint ${response.url} no existe. Verifica la URL de la API.`
    } else if (response.status === 403) {
      errorMessage = '403 Forbidden: Acceso denegado. Verifica los permisos de CORS en tu API .NET. Asegúrate de que CORS permita el origen de tu aplicación React.'
    } else if (response.status === 0) {
      errorMessage = 'Error de CORS: No se pudo conectar con la API. Verifica que: 1) La API .NET tenga CORS configurado correctamente, 2) ngrok esté corriendo, 3) La URL de la API sea correcta.'
    }
    
    let errorData = null
    try {
      errorData = await response.json()
      // Si hay un objeto de error con más detalles, intentar extraerlos
      if (errorData.errors && typeof errorData.errors === 'object') {
        // ModelState errors de .NET
        const errorMessages = Object.entries(errorData.errors)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
          .join('; ')
        errorMessage = errorMessages || errorData.message || errorMessage
        console.error('Validation errors:', errorData.errors)
      } else {
        // Usar el mensaje del error, y si hay detalles, agregarlos
        errorMessage = errorData.message || errorMessage
        if (errorData.details && errorData.details !== errorData.message) {
          errorMessage = `${errorMessage}: ${errorData.details}`
        }
      }
      console.error('API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        error: errorData,
        message: errorMessage
      })
    } catch (e) {
      // Si no se puede parsear el JSON, usar el mensaje por defecto
      console.error('Error parsing error response:', e)
      console.error('API Error Response (raw):', {
        status: response.status,
        statusText: response.statusText,
        url: response.url
      })
    }
    
    // Crear un error con información adicional
    const apiError = new Error(errorMessage)
    apiError.response = {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      data: errorData
    }
    throw apiError
  }
  
  // Si la respuesta está vacía (status 204 No Content), retornar null
  if (response.status === 204) {
    return null
  }
  
  // Intentar parsear JSON, si falla retornar un objeto vacío
  try {
    const data = await response.json()
    return data
  } catch (e) {
    console.warn('Error parsing JSON response, returning empty object:', e)
    return {}
  }
}

// Función auxiliar para hacer peticiones
const request = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`
  const defaultHeaders = getDefaultHeaders()
  
  // Configuración de la petición con CORS explícito
  const config = {
    method: options.method || 'GET',
    mode: 'cors', // Asegurar que se use CORS
    credentials: 'omit', // No enviar cookies automáticamente (puede causar problemas con CORS)
    headers: {
      ...defaultHeaders,
      ...options.headers, // Los headers personalizados tienen prioridad
    },
  }
  
  // Solo incluir body si existe y no es GET o HEAD
  if (options.body && config.method !== 'GET' && config.method !== 'HEAD') {
    config.body = options.body
  }
  
  // Si hay opciones adicionales como cache, redirect, etc., incluirlas
  if (options.cache !== undefined) config.cache = options.cache
  if (options.redirect !== undefined) config.redirect = options.redirect

  try {
    // Log del body si existe (para debugging)
    if (config.body) {
      try {
        const bodyData = JSON.parse(config.body)
        console.log('Making API request to:', url, {
          method: config.method,
          body: bodyData,
          headers: config.headers
        })
      } catch (e) {
        console.log('Making API request to:', url, {
          method: config.method,
          headers: config.headers
        })
      }
    } else {
      console.log('Making API request to:', url, {
        method: config.method,
        headers: config.headers
      })
    }
    
    const response = await fetch(url, config)
    console.log('API Response:', { status: response.status, statusText: response.statusText, url: response.url })
    return handleResponse(response)
  } catch (error) {
    console.error('API Request Error:', {
      error: error.message,
      url: url,
      name: error.name,
      stack: error.stack
    })
    
    // Si es un error de red, proporcionar un mensaje más útil
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.name === 'TypeError') {
      const ngrokUrl = API_BASE_URL.replace('/api', '')
      throw new Error(`Error de conexión: No se pudo conectar con la API a través de ngrok. Verifica que: 1) ngrok esté corriendo en ${ngrokUrl}, 2) tu API .NET esté ejecutándose en http://localhost:5208, 3) ngrok esté configurado correctamente (debe redirigir a http://localhost:5208, no https://), 4) La API .NET tenga CORS configurado para permitir peticiones desde tu aplicación React (debe permitir http://localhost:5173).`)
    }
    throw error
  }
}

// ==================== AUTH ====================
export const authService = {
  login: async (email, password) => {
    const response = await request('/Auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    
    // Guardar token si viene en la respuesta
    if (response.token) {
      localStorage.setItem('authToken', response.token)
    }
    
    return response
  },
}

// ==================== USUARIOS ====================
export const usuarioService = {
  // Obtener todos los usuarios
  getAll: async () => {
    return request('/Usuario')
  },

  // Obtener usuario por ID
  getById: async (id) => {
    return request(`/Usuario/${id}`)
  },

  // Obtener usuarios por rol
  getByRol: async (tipoRol) => {
    return request(`/Usuario/by-rol/${tipoRol}`)
  },

  // Crear usuario
  create: async (usuarioData) => {
    return request('/Usuario', {
      method: 'POST',
      body: JSON.stringify(usuarioData),
    })
  },

  // Actualizar usuario
  update: async (id, usuarioData) => {
    return request(`/Usuario/${id}`, {
      method: 'PUT',
      body: JSON.stringify(usuarioData),
    })
  },

  // Eliminar usuario
  delete: async (id) => {
    return request(`/Usuario/${id}`, {
      method: 'DELETE',
    })
  },
}

// ==================== HORARIOS ====================
export const horarioService = {
  // Obtener todos los horarios
  getAll: async () => {
    return request('/Horario')
  },

  // Obtener horario por ID
  getById: async (id) => {
    return request(`/Horario/${id}`)
  },

  // Obtener horarios disponibles
  getDisponibles: async () => {
    return request('/Horario/disponibles')
  },

  // Obtener horarios por usuario
  getByUsuario: async (usuarioId) => {
    return request(`/Horario/usuario/${usuarioId}`)
  },

  // Crear horario
  create: async (horarioData) => {
    return request('/Horario', {
      method: 'POST',
      body: JSON.stringify(horarioData),
    })
  },

  // Actualizar horario
  update: async (id, horarioData) => {
    return request(`/Horario/${id}`, {
      method: 'PUT',
      body: JSON.stringify(horarioData),
    })
  },

  // Eliminar horario
  delete: async (id) => {
    return request(`/Horario/${id}`, {
      method: 'DELETE',
    })
  },
}

// ==================== TUTORIAS ====================
export const tutoriaService = {
  // Obtener todas las tutorías
  getAll: async () => {
    return request('/Tutoria')
  },

  // Obtener tutoria por ID
  getById: async (id) => {
    return request(`/Tutoria/${id}`)
  },

  // Crear tutoria
  create: async (tutoriaData) => {
    return request('/Tutoria', {
      method: 'POST',
      body: JSON.stringify(tutoriaData),
    })
  },

  // Actualizar tutoria
  update: async (id, tutoriaData) => {
    return request(`/Tutoria/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tutoriaData),
    })
  },

  // Eliminar tutoria
  delete: async (id) => {
    const tutoriaId = parseInt(id)
    if (isNaN(tutoriaId)) {
      throw new Error(`ID de tutoría inválido: ${id}`)
    }
    console.log(`[tutoriaService.delete] Llamando DELETE /Tutoria/${tutoriaId}`)
    return request(`/Tutoria/${tutoriaId}`, {
      method: 'DELETE',
    })
  },

  // Agregar estudiantes a tutoria
  agregarEstudiantes: async (id, estudiantesDto) => {
    return request(`/Tutoria/${id}/estudiantes`, {
      method: 'POST',
      body: JSON.stringify(estudiantesDto),
    })
  },

  // Obtener estudiantes de una tutoria
  getEstudiantesByTutoria: async (id) => {
    return request(`/Tutoria/${id}/estudiantes`)
  },

  // Eliminar estudiante de una tutoria
  eliminarEstudiante: async (tutoriaId, estudianteId) => {
    return request(`/Tutoria/${tutoriaId}/estudiantes/${estudianteId}`, {
      method: 'DELETE',
    })
  },

  // Obtener calendario por docente
  getCalendarioPorDocente: async (nombre, apellidos, correo) => {
    const params = new URLSearchParams({ nombre, apellidos, correo })
    return request(`/Tutoria/calendario/docente?${params}`)
  },

  // Obtener calendario por estudiante
  getCalendarioPorEstudiante: async (nombre, apellidos, correo) => {
    const params = new URLSearchParams({ nombre, apellidos, correo })
    return request(`/Tutoria/calendario/estudiante?${params}`)
  },

  // Obtener calendario por idioma y nivel
  getCalendarioPorIdiomaNivel: async (idioma, nivel) => {
    const params = new URLSearchParams({ idioma, nivel })
    return request(`/Tutoria/calendario/idioma-nivel?${params}`)
  },
}

// ==================== NOTIFICACIONES ====================
export const notificacionService = {
  // Obtener todas las notificaciones
  getAll: async () => {
    return request('/Notificacion')
  },

  // Obtener notificación por ID
  getById: async (id) => {
    return request(`/Notificacion/${id}`)
  },

  // Obtener notificaciones por usuario
  getByUsuario: async (usuarioId) => {
    return request(`/Notificacion/usuario/${usuarioId}`)
  },

  // Eliminar notificación
  delete: async (id) => {
    return request(`/Notificacion/${id}`, {
      method: 'DELETE',
    })
  },

  // Exportar reporte Excel por email
  exportarReporteExcel: async (tutoriaId, docenteId) => {
    return request(`/Notificacion/email/reporte-excel/${tutoriaId}/docente/${docenteId}`, {
      method: 'POST',
    })
  },
}

// ==================== RETROALIMENTACION ====================
export const retroalimentacionService = {
  // Obtener todas las retroalimentaciones
  getAll: async () => {
    return request('/Retroalimentacion')
  },

  // Obtener retroalimentación por ID
  getById: async (id) => {
    return request(`/Retroalimentacion/${id}`)
  },

  // Obtener retroalimentaciones por tutoria
  getByTutoria: async (tutoriaId) => {
    return request(`/Retroalimentacion/tutoria/${tutoriaId}`)
  },

  // Obtener retroalimentaciones por usuario
  getByUsuario: async (usuarioId) => {
    return request(`/Retroalimentacion/usuario/${usuarioId}`)
  },

  // Crear retroalimentación
  create: async (retroalimentacionData) => {
    return request('/Retroalimentacion', {
      method: 'POST',
      body: JSON.stringify(retroalimentacionData),
    })
  },

  // Actualizar retroalimentación
  update: async (id, retroalimentacionData) => {
    return request(`/Retroalimentacion/${id}`, {
      method: 'PUT',
      body: JSON.stringify(retroalimentacionData),
    })
  },

  // Eliminar retroalimentación
  delete: async (id) => {
    return request(`/Retroalimentacion/${id}`, {
      method: 'DELETE',
    })
  },
}

// ==================== MÉTRICAS ====================
export const metricasService = {
  // Obtener métricas generales
  getGenerales: async () => {
    return request('/Metricas/generales')
  },

  // Obtener métricas de tutorías
  getTutorias: async () => {
    return request('/Metricas/tutorias')
  },
}

