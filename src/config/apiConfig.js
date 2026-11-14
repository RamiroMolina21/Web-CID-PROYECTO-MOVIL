// Configuración de la API.
// En desarrollo define VITE_API_URL en .env.local (ej. http://localhost:5208/api).
export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://uninoculated-groved-marlena.ngrok-free.dev/api').replace(/\/$/, '')
