================================================================================
                    TUTORPRO - SISTEMA DE GESTIÓN DE TUTORÍAS
                           DOCUMENTACIÓN COMPLETA
================================================================================

DESCRIPCIÓN GENERAL
--------------------------------------------------------------------------------
TutorPro es una aplicación web completa desarrollada en React para la gestión 
integral de tutorías académicas. El sistema permite administrar horarios, 
estudiantes, docentes, tutorías agendadas, retroalimentaciones y métricas 
estadísticas, todo integrado con una API REST desarrollada en .NET.

TECNOLOGÍAS UTILIZADAS
--------------------------------------------------------------------------------
- React 18.2.0: Framework principal para la interfaz de usuario
- React Router DOM 6.20.0: Navegación y enrutamiento de la aplicación
- Vite 5.0.8: Herramienta de construcción y desarrollo
- CSS3: Estilos y diseño responsive
- API REST (.NET): Backend para gestión de datos
- ngrok: Túnel para conectar el frontend con la API local

ESTRUCTURA DEL PROYECTO
--------------------------------------------------------------------------------
src/
├── components/          Componentes reutilizables de la interfaz
│   ├── AgregarEstudianteModal.jsx          Modal para agregar estudiantes a horarios
│   ├── AgregarEstudianteATutoriaModal.jsx  Modal para agregar estudiantes a tutorías
│   ├── FormularioDocente.jsx               Formulario de creación/edición de docentes
│   ├── FormularioEstudiante.jsx            Formulario de creación/edición de estudiantes
│   ├── FormularioHorario.jsx               Formulario de creación/edición de horarios
│   ├── FormularioTutoria.jsx                Formulario de creación/edición de tutorías
│   ├── HorarioDetailModal.jsx               Modal de detalles de horario
│   ├── ProtectedRoute.jsx                   Componente de protección de rutas
│   ├── Sidebar.jsx                          Barra lateral de navegación
│   ├── TutoriaDetailModal.jsx                Modal de detalles de tutoría
│   └── TutoriaFinalizadaDetailModal.jsx     Modal de detalles de tutoría finalizada
│
├── pages/              Páginas principales de la aplicación
│   ├── Dashboard.jsx                        Página principal con métricas y gráficos
│   ├── Horarios.jsx                         Vista de calendario de horarios y tutorías
│   ├── AgendarTutoria.jsx                   Página para agendar nuevas tutorías
│   ├── Estudiantes.jsx                      Gestión de estudiantes
│   ├── Retroalimentaciones.jsx              Gestión de retroalimentaciones
│   ├── TutoriasFinalizadas.jsx              Vista de tutorías finalizadas
│   └── Login.jsx                            Página de inicio de sesión
│
├── context/            Gestión de estado global
│   ├── AuthContext.jsx                      Contexto de autenticación
│   └── DataContext.jsx                      Contexto de datos (usuarios, horarios, tutorías)
│
├── services/          Servicios de comunicación con la API
│   └── apiService.js                        Servicios para todos los endpoints de la API
│
├── config/             Configuración
│   └── apiConfig.js                         Configuración de la URL base de la API
│
└── App.jsx             Componente raíz de la aplicación

FUNCIONALIDADES PRINCIPALES POR PÁGINA
--------------------------------------------------------------------------------

1. LOGIN (Página de Inicio de Sesión)
   - Autenticación de usuarios mediante correo y contraseña
   - Validación de credenciales contra la API
   - Almacenamiento de token de autenticación
   - Redirección automática después del login exitoso
   - Protección de rutas mediante ProtectedRoute

2. DASHBOARD (Página Principal)
   - Tarjetas de métricas principales:
     * Tutorías del día actual
     * Horarios disponibles
     * Total de estudiantes
     * Total de tutorías
   
   - Gráfico de Tutorías Finalizadas por Mes:
     * Visualización de los últimos 12 meses
     * Gráfico de barras interactivo
     * Muestra el total de tutorías finalizadas por mes
     * Tooltips con información detallada al pasar el mouse
   
   - Sección de Usuarios Recientes:
     * Lista de los últimos 5 usuarios (estudiantes y docentes)
     * Avatares con iniciales
     * Información de contacto
   
   - Sección de Métricas Detalladas:
     * Total de tutorías
     * Tutorías completadas
     * Tutorías canceladas
     * Tutorías programadas
     * Promedio de calificaciones
     * Total de usuarios, docentes y estudiantes
     * Total de horarios y horarios disponibles
     * Botón de actualización manual de métricas

3. HORARIOS (Vista de Calendario)
   - Vista de calendario con múltiples modos:
     * Vista de Día: Muestra un día completo con horarios y tutorías
     * Vista de Semana: Muestra 7 días con horarios y tutorías
     * Vista de Mes: Vista mensual con eventos marcados
     * Vista de Año: Vista anual con indicadores de eventos
   
   - Visualización de Horarios:
     * Bloques morados (#6366f1) representando horarios disponibles
     * Información de título, hora inicio/fin, cupos disponibles
     * Click para ver detalles completos del horario
   
   - Visualización de Tutorías:
     * Bloques verdes (#10b981) representando tutorías agendadas
     * Muestra tutorías con estados: pendiente, programada, activa
     * Filtrado automático de tutorías finalizadas
     * Badge "(Horario)" para tutorías vinculadas a un horario
     * Click para ver detalles completos de la tutoría
   
   - Funcionalidades:
     * Navegación entre fechas (hoy, anterior, siguiente)
     * Filtro por vista (día, semana, mes, año)
     * Creación de nuevos horarios desde el calendario
     * Edición y eliminación de horarios
     * Visualización de cupos ocupados/disponibles

4. AGENDAR TUTORÍA
   - Sección de Horarios Disponibles:
     * Lista de horarios con cupos disponibles
     * Búsqueda por título de horario
     * Filtro por fecha
     * Indicador visual de cupos ocupados/capacidad
     * Click en horario para crear nueva tutoría
   
   - Sección de Tutorías Agendadas:
     * Lista de todas las tutorías agendadas
     * Búsqueda por idioma o tema
     * Filtro por fecha
     * Badges de estado (Pendiente, Programada, Activa, Cancelada, Finalizada)
     * Información del docente asignado
     * Botón "Agregar Estudiante" en cada tarjeta de tutoría
     * Click en tutoría para ver detalles completos
   
   - Funcionalidades:
     * Creación de tutorías desde horarios disponibles
     * Agregar estudiantes a tutorías existentes
     * Visualización de detalles de tutorías
     * Filtrado y búsqueda avanzada

5. ESTUDIANTES
   - Gestión completa de estudiantes:
     * Lista de todos los estudiantes registrados
     * Búsqueda por nombre o correo
     * Creación de nuevos estudiantes
     * Edición de estudiantes existentes
     * Eliminación de estudiantes
   
   - Información mostrada:
     * Nombre completo
     * Correo electrónico
     * Teléfono
     * Carrera
     * Semestre
     * Avatar con iniciales

6. RETROALIMENTACIONES
   - Gestión de retroalimentaciones:
     * Lista de todas las retroalimentaciones
     * Filtrado por tutoría o usuario
     * Búsqueda por texto
     * Creación de nuevas retroalimentaciones
     * Edición y eliminación
   
   - Información mostrada:
     * Tutoría asociada
     * Usuario que realizó la retroalimentación
     * Calificación
     * Comentarios
     * Fecha de creación

7. TUTORÍAS FINALIZADAS
   - Vista de tutorías completadas:
     * Lista de tutorías con estado "finalizada" o "completada"
     * Filtrado por fecha
     * Búsqueda por tema o idioma
     * Visualización de detalles completos
     * Exportación de reportes Excel (si está disponible en la API)

COMPONENTES PRINCIPALES Y SUS FUNCIONES
--------------------------------------------------------------------------------

1. SIDEBAR (Barra Lateral de Navegación)
   - Navegación entre todas las secciones
   - Información del usuario logueado
   - Botón de cerrar sesión
   - Indicador visual de la página actual

2. FORMULARIOS
   - FormularioHorario:
     * Campos: Título, Fecha, Fecha Fin, Hora Inicio, Hora Fin, 
       Cupos Disponibles, Aula, Docente/Tutor
     * Validación de conflictos de horarios
     * Creación de múltiples horarios en rango de fechas
   
   - FormularioTutoria:
     * Creación de tutorías desde horarios disponibles
     * Selección de tema, idioma, nivel, modalidad
   
   - FormularioEstudiante:
     * Creación y edición de estudiantes
     * Validación de campos requeridos
   
   - FormularioDocente:
     * Creación y edición de docentes
     * Asignación de roles

3. MODALES DE DETALLE
   - HorarioDetailModal:
     * Información completa del horario
     * Cupos ocupados/disponibles
     * Información del docente
     * Edición y eliminación
     * Eliminación de tutorías asociadas
   
   - TutoriaDetailModal:
     * Información completa de la tutoría
     * Lista de estudiantes agendados
     * Información del docente
     * Horario y ubicación
     * Estado de la tutoría
   
   - TutoriaFinalizadaDetailModal:
     * Detalles de tutorías finalizadas
     * Estudiantes participantes
     * Opción de exportar reporte

4. MODALES DE AGREGAR ESTUDIANTE
   - AgregarEstudianteModal:
     * Agregar estudiantes a horarios disponibles
     * Validación de cupos disponibles
     * Creación automática de tutoría si no existe
   
   - AgregarEstudianteATutoriaModal:
     * Agregar estudiantes directamente a tutorías existentes
     * Filtrado de estudiantes ya agendados
     * Validación de cupos disponibles
     * Uso del endpoint: POST /api/tutoria/{id}/estudiantes

INTEGRACIÓN CON LA API
--------------------------------------------------------------------------------

La aplicación se comunica con una API REST desarrollada en .NET a través de 
ngrok. Todos los servicios están centralizados en apiService.js:

ENDPOINTS UTILIZADOS:

1. AUTENTICACIÓN:
   - POST /api/Auth/login: Inicio de sesión

2. USUARIOS:
   - GET /api/Usuario: Obtener todos los usuarios
   - GET /api/Usuario/{id}: Obtener usuario por ID
   - GET /api/Usuario/by-rol/{tipoRol}: Obtener usuarios por rol
   - POST /api/Usuario: Crear usuario
   - PUT /api/Usuario/{id}: Actualizar usuario
   - DELETE /api/Usuario/{id}: Eliminar usuario

3. HORARIOS:
   - GET /api/Horario: Obtener todos los horarios
   - GET /api/Horario/{id}: Obtener horario por ID
   - GET /api/Horario/disponibles: Obtener horarios disponibles
   - GET /api/Horario/usuario/{usuarioId}: Obtener horarios por usuario
   - POST /api/Horario: Crear horario
   - PUT /api/Horario/{id}: Actualizar horario
   - DELETE /api/Horario/{id}: Eliminar horario

4. TUTORÍAS:
   - GET /api/Tutoria: Obtener todas las tutorías
   - GET /api/Tutoria/{id}: Obtener tutoría por ID
   - POST /api/Tutoria: Crear tutoría
   - PUT /api/Tutoria/{id}: Actualizar tutoría
   - DELETE /api/Tutoria/{id}: Eliminar tutoría
   - POST /api/Tutoria/{id}/estudiantes: Agregar estudiantes a tutoría
   - GET /api/Tutoria/{id}/estudiantes: Obtener estudiantes de tutoría
   - DELETE /api/Tutoria/{tutoriaId}/estudiantes/{estudianteId}: Eliminar estudiante
   - GET /api/Tutoria/calendario/docente: Calendario por docente
   - GET /api/Tutoria/calendario/estudiante: Calendario por estudiante
   - GET /api/Tutoria/calendario/idioma-nivel: Calendario por idioma y nivel

5. NOTIFICACIONES:
   - GET /api/Notificacion: Obtener todas las notificaciones
   - GET /api/Notificacion/{id}: Obtener notificación por ID
   - GET /api/Notificacion/usuario/{usuarioId}: Obtener notificaciones por usuario
   - DELETE /api/Notificacion/{id}: Eliminar notificación
   - GET /api/Notificacion/reporte-excel/{tutoriaId}: Exportar reporte Excel

6. RETROALIMENTACIONES:
   - GET /api/Retroalimentacion: Obtener todas las retroalimentaciones
   - GET /api/Retroalimentacion/{id}: Obtener retroalimentación por ID
   - GET /api/Retroalimentacion/tutoria/{tutoriaId}: Obtener por tutoría
   - GET /api/Retroalimentacion/usuario/{usuarioId}: Obtener por usuario
   - POST /api/Retroalimentacion: Crear retroalimentación
   - PUT /api/Retroalimentacion/{id}: Actualizar retroalimentación
   - DELETE /api/Retroalimentacion/{id}: Eliminar retroalimentación

7. MÉTRICAS:
   - GET /api/Metricas/generales: Obtener métricas generales
   - GET /api/Metricas/tutorias: Obtener métricas de tutorías

CARACTERÍSTICAS IMPLEMENTADAS
--------------------------------------------------------------------------------

1. SISTEMA DE AUTENTICACIÓN:
   - Login con correo y contraseña
   - Protección de rutas mediante ProtectedRoute
   - Almacenamiento de token en localStorage
   - Context API para gestión de estado de autenticación

2. GESTIÓN DE ESTADO:
   - DataContext: Estado global para usuarios, horarios, tutorías, docentes
   - AuthContext: Estado global para autenticación
   - Carga automática de datos al iniciar la aplicación
   - Actualización reactiva de datos después de operaciones CRUD

3. INTERFAZ DE USUARIO:
   - Diseño responsive y moderno
   - Tema con colores morados (#8b5cf6, #6366f1) como primarios
   - Iconos emoji para mejor UX
   - Modales para operaciones importantes
   - Formularios con validación
   - Búsqueda y filtrado en todas las listas
   - Indicadores visuales de estado (badges de colores)

4. FUNCIONALIDADES ESPECÍFICAS:
   - Agregar estudiantes a tutorías desde la página de Agendar Tutoría
   - Visualización de tutorías en el calendario de Horarios
   - Filtrado de tutorías por estado (pendiente, programada, activa)
   - Gráfico de tutorías finalizadas por mes en Dashboard
   - Cálculo automático de cupos disponibles
   - Validación de conflictos de horarios
   - Creación de múltiples horarios en rango de fechas

5. OPTIMIZACIONES:
   - Código limpio sin funciones no utilizadas
   - Imports optimizados
   - Componentes reutilizables
   - Manejo de errores en todas las peticiones API
   - Mensajes de error descriptivos

INSTALACIÓN Y CONFIGURACIÓN
--------------------------------------------------------------------------------

1. INSTALACIÓN DE DEPENDENCIAS:
   npm install

2. CONFIGURACIÓN DE NGROK:
   a. Descargar e instalar ngrok desde https://ngrok.com/
   b. Iniciar la API .NET en el puerto 5208
   c. Ejecutar: ngrok http 5208
   d. Copiar la URL HTTPS generada por ngrok

3. CONFIGURACIÓN DE LA API:
   a. Editar src/config/apiConfig.js o crear archivo .env
   b. Configurar: VITE_API_URL=https://tu-url-ngrok.ngrok-free.dev/api
   c. Reiniciar el servidor de desarrollo

4. CONFIGURACIÓN DE CORS EN LA API .NET:
   - Permitir origen: http://localhost:5173
   - Permitir métodos: GET, POST, PUT, DELETE
   - Permitir headers: Content-Type, Authorization

5. INICIAR LA APLICACIÓN:
   npm run dev
   
   La aplicación estará disponible en: http://localhost:5173

ESTADOS DE TUTORÍAS
--------------------------------------------------------------------------------

La aplicación maneja los siguientes estados de tutorías:

- PENDIENTE: Tutoría creada pero aún no confirmada
- PROGRAMADA: Tutoría confirmada y programada
- ACTIVA: Tutoría en curso
- FINALIZADA/COMPLETADA: Tutoría finalizada exitosamente
- CANCELADA: Tutoría cancelada

FILTROS Y BÚSQUEDAS
--------------------------------------------------------------------------------

1. DASHBOARD:
   - No tiene filtros (muestra datos generales)

2. HORARIOS:
   - Filtro por vista: Día, Semana, Mes, Año
   - Navegación por fechas

3. AGENDAR TUTORÍA:
   - Búsqueda de horarios por título
   - Filtro de horarios por fecha
   - Búsqueda de tutorías por idioma o tema
   - Filtro de tutorías por fecha

4. ESTUDIANTES:
   - Búsqueda por nombre o correo

5. RETROALIMENTACIONES:
   - Filtro por tutoría
   - Filtro por usuario
   - Búsqueda por texto

6. TUTORÍAS FINALIZADAS:
   - Filtro por fecha
   - Búsqueda por tema o idioma

VALIDACIONES IMPLEMENTADAS
--------------------------------------------------------------------------------

1. FORMULARIOS:
   - Campos requeridos marcados con asterisco (*)
   - Validación de formato de fechas
   - Validación de rangos de fechas (fecha fin >= fecha inicio)
   - Validación de horas (hora fin > hora inicio)
   - Validación de cupos (mínimo 1)
   - Validación de conflictos de horarios
   - Validación de selección de docente/tutor

2. OPERACIONES:
   - Confirmación antes de eliminar registros
   - Validación de cupos antes de agregar estudiantes
   - Validación de existencia de datos antes de operaciones

MANEJO DE ERRORES
--------------------------------------------------------------------------------

- Mensajes de error descriptivos para el usuario
- Logs en consola para debugging
- Manejo de errores 502 (Bad Gateway) con mensajes específicos
- Manejo de errores de CORS
- Manejo de errores de validación de la API
- Mensajes de error personalizados según el tipo de error

NOTAS IMPORTANTES
--------------------------------------------------------------------------------

1. La aplicación requiere que la API .NET esté corriendo en el puerto 5208
2. ngrok debe estar configurado correctamente (HTTP, no HTTPS hacia localhost)
3. CORS debe estar configurado en la API para permitir requests desde localhost:5173
4. Los tokens de autenticación se almacenan en localStorage
5. Los datos se cargan automáticamente al iniciar la aplicación
6. Los cambios se reflejan inmediatamente después de operaciones CRUD
7. El gráfico de tutorías finalizadas muestra los últimos 12 meses
8. Las tutorías en el calendario solo muestran estados: pendiente, programada, activa

LIMPIADO DE CÓDIGO
--------------------------------------------------------------------------------

Se eliminó código no utilizado:
- Función getProximasTutorias del DataContext
- useNavigate y navigate del Dashboard
- Variable estudiantesRecientes no utilizada
- Variable estudiantes no utilizada en AgendarTutoria
- Imports de getEstudianteById no utilizados

VERSIONES Y DEPENDENCIAS
--------------------------------------------------------------------------------

- react: ^18.2.0
- react-dom: ^18.2.0
- react-router-dom: ^6.20.0
- vite: ^5.0.8

ESTRUCTURA DE DATOS
--------------------------------------------------------------------------------

USUARIO:
- id, nombres, apellidos, correo, telefono, carrera, semestre, tipoRol

HORARIO:
- id, titulo, fecha, fechaFin, horaInicio, horaFin, cuposDisponibles, 
  salon, docenteId, disponible, notas

TUTORÍA:
- id, horarioId, docenteId, estudianteId, estudiantesIds, tema, idioma, 
  nivel, modalidad, fecha, horaInicio, horaFin, estado

RETROALIMENTACIÓN:
- id, tutoriaId, usuarioId, calificacion, comentarios, fecha

================================================================================
                           FIN DE LA DOCUMENTACIÓN
================================================================================

