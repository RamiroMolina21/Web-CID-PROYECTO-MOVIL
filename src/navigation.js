import { ROLES } from './lib/roles'

// Menú lateral por rol. El orden es el de la navegación.
const GESTION_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/horarios', label: 'Horarios', icon: 'clock' },
  { to: '/agendar-tutoria', label: 'Agendar tutoría', icon: 'calendarPlus' },
  { to: '/estudiantes', label: 'Usuarios', icon: 'users' },
  { to: '/tutorias-finalizadas', label: 'Tutorías finalizadas', icon: 'checkCircle' },
]

const CONFIG = { to: '/configuracion', label: 'Configuración', icon: 'settings' }

export const NAV_POR_ROL = {
  [ROLES.ADMIN]: [...GESTION_ITEMS, CONFIG],
  [ROLES.AUXILIAR]: [...GESTION_ITEMS, CONFIG],
  [ROLES.DOCENTE]: [
    { to: '/agenda', label: 'Horarios disponibles', icon: 'calendarPlus' },
    { to: '/mis-tutorias', label: 'Mis tutorías', icon: 'clipboard' },
    { to: '/historial', label: 'Tutorías finalizadas', icon: 'history' },
    CONFIG,
  ],
  [ROLES.TUTOR]: [
    { to: '/mis-tutorias', label: 'Mis tutorías', icon: 'clipboard' },
    { to: '/historial', label: 'Tutorías finalizadas', icon: 'history' },
    CONFIG,
  ],
}

// Títulos para document.title
export const TITULOS = [
  [/^\/$/, 'Dashboard'],
  [/^\/horarios/, 'Horarios'],
  [/^\/agendar-tutoria/, 'Agendar tutoría'],
  [/^\/estudiantes/, 'Usuarios'],
  [/^\/tutorias-finalizadas/, 'Tutorías finalizadas'],
  [/^\/agenda\/\d+\/agendar/, 'Agendar tutoría'],
  [/^\/agenda/, 'Horarios disponibles'],
  [/^\/mis-tutorias\/\d+/, 'Detalle de tutoría'],
  [/^\/mis-tutorias/, 'Mis tutorías'],
  [/^\/tutorias\/\d+\/finalizar/, 'Calificar y finalizar'],
  [/^\/historial\/\d+/, 'Tutoría finalizada'],
  [/^\/historial/, 'Tutorías finalizadas'],
  [/^\/configuracion/, 'Configuración'],
  [/^\/login/, 'Iniciar sesión'],
  [/^\/encuesta/, 'Encuesta de satisfacción'],
]
