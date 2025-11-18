// Configuración de la API
// Cambia esta URL por la URL de tu túnel ngrok
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://loculicidally-epiphanic-marcelle.ngrok-free.dev/api'

// Log para debug - puedes eliminarlo después
console.log('API Base URL:', API_BASE_URL)

// Configuración de headers por defecto
export const getDefaultHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
  
  // Header para bypass del warning de ngrok free tier
  // Este header debe estar presente en todas las peticiones, incluyendo OPTIONS (preflight)
  if (API_BASE_URL.includes('ngrok-free.dev') || API_BASE_URL.includes('ngrok.io')) {
    headers['ngrok-skip-browser-warning'] = 'true'
  }
  
  // Si hay un token de autenticación, agregarlo
  const token = localStorage.getItem('authToken')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return headers
}

