# Migración MAUI → Web (CDITutorPro) — Fase 1: Análisis y planificación

- **Autor:** Alistar (frontend) · **Fecha:** 2026-11-11 · **Estado:** propuesta para revisión (no se ha modificado código)
- **Objetivo:** retirar la app MAUI. La web (React 18 + Vite, JS) debe ofrecer **equivalencia funcional completa** para Docente y Tutor, mantener lo que ya hace para Administrador y Auxiliar, e integrarse con el backend nuevo con JWT (rama `feature/jwt-auth`).

## 0. Fuentes y convenciones

| Fuente | Ruta | Cómo se usó |
|---|---|---|
| MAUI (referencia funcional) | `Taller 3 MAUI/Taller 3/Taller 3/` | Leídos `Services/*`, `ViewModels/*`, `Views/*.xaml(.cs)`, `Models/*`, `Converters/*`, `App.xaml.cs`, `MauiProgram.cs` |
| Flujo declarado | `WEBProyecto_Final/FlujoDeLaApp.txt` | Contrastado con el código (coincide salvo lo indicado) |
| Web destino | `webv1/` (rama `master`, último commit `2fe63af`) | Leídos `App.jsx`, contextos, `services/apiService.js`, `config/apiConfig.js`, páginas y modales |
| Contrato backend | `ApiRest Proyecto Movil/docs/api/*.md` | Leído completo |
| Backend real | `AgendamientoSolucion/` (rama `feature/jwt-auth`) | Verificados `Controllers/*`, `Security/Politicas.cs`, `Security/ClaimsPrincipalExtensions.cs`, `TutoriaService`, `RetroalimentacionService`, repositorios de Tutoria/Horario, constantes de estados y roles |

Marcas usadas en todo el documento:

- **EXISTE** — endpoint/campo/regla verificado en el código del backend.
- **PROPUESTO** — no existe; es una petición a Dante.
- **GAP** — la funcionalidad MAUI no puede replicarse con el backend actual (o solo con un workaround inaceptable).
- **BUG-MAUI** — comportamiento defectuoso de MAUI que **no** se replicará tal cual.

### 0.1 Verificación del contexto conocido

| Afirmación | Resultado |
|---|---|
| Web solo admite Administrador/Auxiliar | **Confirmado**: `AuthContext.login` rechaza otros roles en cliente (`rolPermitido = administrador \|\| auxiliar`). `Login.jsx` muestra "Solo usuarios Administrador y Auxiliar pueden acceder". |
| MAUI solo Docente/Tutor | **Confirmado**: `LoginViewModel` enruta Docente → `DocenteHomePage`, Tutor → `TutorHomePage`, resto → "Rol no reconocido". |
| Login devuelve `{message, token, tokenType, expiresAt, usuario}` | **Confirmado** (`Contracts/LoginResponseDto.cs`, `AuthController.Login`). |
| Fallback policy autenticada; públicos solo login, `Encuesta/verificar/{token}`, `Encuesta/responder` | **Confirmado** (`Politicas.Registrar` + `[AllowAnonymous]` en esos 3). |
| `GET Auth/me` | **Confirmado**. |
| Políticas `GestionWeb` (Admin+Aux), `SoloAdministrador`, `Personal` | **Matiz**: `Personal` = **Administrador, Auxiliar, Docente y Tutor** (`Roles.ConAcceso`), no solo Docente/Tutor. |
| Docente/Tutor solo su propio id en `Horario/usuario/{id}` y `Tutoria/estado/{e}/usuario/{id}` | **Confirmado** (`User.AsegurarAccesoADatosDe(usuarioId)` → 403 "Solo puede consultar sus propios datos"). |
| Errores `application/problem+json` con `message` | **Confirmado** por contrato (`GlobalExceptionHandler`/`ProblemDetailsDefaults`). |
| `usuarioId`/`horarioId`/`rolId` aditivos | **Confirmado** en contrato y `MapTutoria`. |
| Comentario opcional en encuesta y retroalimentación | **Confirmado** (`Comentario ?? string.Empty`). |
| Envío de encuestas idempotente | **Confirmado**; además `finalizar` ya las envía. |
| MAUI "Mis tutorías" del Docente filtra por `Tutoria.Usuario_idUsuario` (tutor asignado) | **Confirmado**: `TutoriaRepository.GetByEstadoAndUsuarioAsync` → `t.Usuario_idUsuario == usuarioId`. El propio XAML lo dice: "Tutorías donde estás asignado como tutor". |
| `MaxEstudiantes = 5` fijo ignora `Horario.Cupos` | **Confirmado** (`AgendarTutoriaViewModel.MaxEstudiantes = 5`, `DetalleTutoriaViewModel` usa `5 - Estudiantes.Count`). |
| Modalidad multiselección unida por coma | **Confirmado** (`string.Join(", ", …)`). |
| Finalizar + `Encuesta/enviar` duplicado | **Confirmado** (`CalificarTutoriaViewModel`: `FinalizarTutoriaAsync` y luego `_ = EnviarEncuestasAsync`). Hoy inofensivo por idempotencia. |

Hallazgos adicionales del backend (detalle en §3):

1. **Sin regla de propiedad** en `GET/PUT Tutoria/{id}`, `GET/POST Tutoria/{id}/estudiantes`, `PUT Tutoria/{id}/finalizar`, `POST Encuesta/enviar/{id}` (cualquier Docente/Tutor puede leer o finalizar cualquier tutoría por id — BOLA). El contrato lo reconoce en "Propuestas no implementadas".
2. `POST Retroalimentacion` **no** comprueba que `usuarioId` del cuerpo sea el usuario del token (suplantación posible).
3. `POST Tutoria` **no** comprueba que el horario esté disponible (si está `Ocupado`, crea igual → doble reserva), ni que el horario pertenezca al Docente, ni que `usuarioId` sea Docente/Tutor.
4. `POST Tutoria/{id}/estudiantes` **no** valida cupos.
5. `TutoriaResponse` no trae el dueño del horario ni los cupos; un Docente/Tutor no puede leer `GET Horario/{id}` (GestionWeb).

---

## 1. Inventario funcional de MAUI (basado en el código)

### 1.1 Arquitectura y navegación general

- **Arranque:** `App` registra rutas Shell y navega a `//Login`. `AppShell` solo contiene `LoginPage`.
- **Tras login:** se **reemplaza** `Application.Current.MainPage` por un `FlyoutPage` según rol (`DocenteHomePage` o `TutorHomePage`). Dentro, `Detail` es un `NavigationPage` y toda la navegación es `PushAsync` (pila) pasando ids por propiedad (`TutoriaId`, `HorarioId`).
- **Sesión:** solo en memoria (`AuthService._currentUser`). No hay persistencia, no hay token (hoy MAUI no envía `Authorization`), no hay expiración.
- **HTTP:** `HttpClient` nombrado `ApiClient`, base `https://…ngrok-free.dev/api/`, timeout 30 s, cabecera `ngrok-skip-browser-warning: true`. Casi todo usa `EnsureSuccessStatusCode` (lanza y muestra `ex.Message`); `AgregarEstudiantes`, `CreateRetroalimentacion` y `EnviarEncuestas` devuelven `bool`.
- **Refresco:** las listas recargan en `OnAppearing`; `HorariosDisponiblesPage` y `MisTutoriasPage` también disparan recarga en `OnDisappearing` (para refrescar al volver).
- **Feedback:** todo vía `DisplayAlert` modal (éxito, error, confirmación).
- **Estados visuales:** `EstadoColorConverter` (pendiente = naranja `#FF9800`, finalizada = verde `#4CAF50`, otro = gris) e `IsPendienteConverter` (muestra acciones solo si `estado == "pendiente"`, sin distinguir mayúsculas).
- **Código muerto:** `MainPage`, `Principal`, `Maestro`, `Detalle`, `NavigationService` (vacío). No forman parte del flujo.

### 1.2 Común — Login (`LoginPage` / `LoginViewModel`)

| Aspecto | Detalle |
|---|---|
| Datos mostrados | "Corporación Universitaria del Caribe", "Bienvenido", "Agenda tus tutorías de forma rápida y sencilla", pie "Universidad de Lenguas - Sistema de Tutorías" |
| Formulario | `Correo` (placeholder `usuario@uni.edu.co`, teclado email), `Contrasena` (password) |
| Validación cliente | ambos no vacíos → si no, "Por favor complete todos los campos" |
| Acción | `POST Auth/login` body `{ Correo, Contrasena }` → lee `usuario` (ignora token) |
| Éxito | Docente → `DocenteHomePage` (inicio = Horarios disponibles); Tutor → `TutorHomePage` (inicio = Mis tutorías); otro rol → "Rol no reconocido" |
| Error | cualquier excepción → `AuthService` devuelve `false` → "Credenciales inválidas" (no distingue 401/403/429/red) |
| Carga | botón deshabilitado mientras `IsLoading` |

### 1.3 Rol Docente

Menú lateral (`DocenteHomePage`, Flyout): cabecera con `NombreCompleto` y `Rol`; opciones **Inicio** (Horarios disponibles), **Mis Tutorías**, **Tutorías Finalizadas**, **Cerrar Sesión** (confirmación "¿Está seguro que desea cerrar sesión?" → borra usuario en memoria → `LoginPage`).

#### D1. Horarios disponibles (`HorariosDisponiblesPage` / `HorariosDisponiblesViewModel`) — pantalla de inicio

| Aspecto | Detalle |
|---|---|
| Carga | `GET Horario/usuario/{miId}` → `HorarioResponseDto[]`; filtra en cliente `estado.ToLower() == "disponible"` (**no** incluye `Libre`, a diferencia de `Horario/disponibles`) |
| Agrupación | por `(titulo, horaInicio.TimeOfDay, horaFin.TimeOfDay, espacio)` normalizados → `HorarioGrupoItem` (recurrente si >1 ocurrencia). Orden: próxima fecha ≥ hoy, luego hora inicio |
| Datos por grupo | título, etiqueta "Recurrente · N fechas" / "Horario único", "Hora: HH:mm - HH:mm", espacio, "Fecha(s): dd/MM/yyyy[ - dd/MM/yyyy]" |
| Cabecera | "Horarios Disponibles", "Reserva un horario disponible para una nueva tutoría", contador (`N` o `N (M fechas)`), fecha actual |
| Búsqueda | texto libre sobre título, espacio o fecha `dd/MM/yyyy` (contains, minúsculas) |
| Expandir | "Ver fechas (N)" / "Ocultar fechas": acordeón exclusivo (solo un grupo abierto). Cada ocurrencia: "dddd dd/MM/yyyy", "Hora: HH:mm", botón **Agendar** |
| Acción grupo | botón **Agendar Tutoría** (en grupos no recurrentes usa la primera ocurrencia) |
| Navegación | Agendar → D2 con `HorarioId` |
| Estados | indicador de carga; pull-to-refresh (`RefreshView` con `LoadDataCommand`); sin estado vacío explícito |
| Errores | "Error al cargar datos: {ex.Message}" |

#### D2. Agendar tutoría — asistente de 3 pasos (`AgendarTutoriaPage` / `AgendarTutoriaViewModel`)

Al aparecer: `LoadTutores()` → `GET Usuario/by-rol/Tutor` + `GET Usuario/by-rol/Docente` (lista combinada, **incluye al propio docente**); `LoadEstudiantes()` → `GET Usuario/by-rol/Estudiante`; `LoadHorario(id)` → `GET Horario/usuario/{miId}` y busca por `idHorario` (no hay endpoint por id para Docente).

| Paso | Título | Campos | Validación al pulsar "Continuar →" |
|---|---|---|---|
| 1 | "Tema de la tutoría" | `Idioma` (ej. Inglés), `Nivel` (ej. A1, B2, Avanzado…), `Tema` (ej. Gramática básica), **Modalidad** chips multiselección: Virtual, Presencial, Híbrido | idioma, nivel y tema no vacíos ("Complete idioma, nivel y tema."); ≥ 1 modalidad ("Seleccione al menos una modalidad.") |
| 2 | "Asignación" | Picker **Tutor / Docente** (`NombreConRol` = "Nombre Apellidos (Rol)"); **Fecha** y **Hora** de solo lectura "Definida por el horario seleccionado" | tutor seleccionado ("Seleccione un tutor o docente."); horario cargado ("No se encontró el horario seleccionado.") |
| 3 | "Estudiantes" | Búsqueda (nombre, nombres, apellidos, correo); lista con iniciales, nombre completo, correo, toggle "+"/"✓"; contador `N / 5`; "Seleccione hasta 5 estudiantes (opcional)" | máx. 5 (alerta "Cupos completos — Solo puede agregar hasta 5 estudiantes por tutoría.") |

- Indicador de pasos (1 Tema · 2 Asign. · 3 Estud.) con líneas activas; botones **Atrás** (paso > 1), **Continuar →** / **Guardar ✓**, **Cancelar** (confirmación "¿Desea cancelar el agendamiento de la tutoría?").
- **Guardar:**
  1. `POST Tutoria` body `{ Idioma, Nivel, Tema (trim), Modalidad: "Virtual, Presencial", Estado: "Pendiente", FechaTutoria: horario.FechaInicio.Date + horario.HoraInicio.TimeOfDay, UsuarioId: tutorSeleccionado, HorarioId, TutorId: tutorSeleccionado }` → `TutoriaResponseDto` (`TutorId` lo ignora el backend). El backend pasa el horario a `Ocupado`.
  2. Si hay estudiantes: `POST Tutoria/{idTutoria}/estudiantes` body `{ EstudianteIds: [...] }`. Si falla: "La tutoría se creó, pero no se pudieron agregar los estudiantes. Puede agregarlos desde el detalle." (no atómico).
  3. Alerta de éxito y `PopAsync` a D1 (que recarga y ya no muestra el horario ocupado).
- Sin validación de longitud (backend: ≤ 45 caracteres en idioma/nivel/tema/modalidad).

#### D3. Mis tutorías (`MisTutoriasPage` / `MisTutoriasViewModel`)

| Aspecto | Detalle |
|---|---|
| Carga | `GET Tutoria/estado/Pendiente/usuario/{miId}` → solo tutorías **asignadas** al docente (BUG-MAUI: no ve las que agendó para un Tutor) |
| Subtítulo | "Tutorías donde estás asignado como tutor" |
| Tarjeta | tema, idioma, fecha `dd/MM/yyyy HH:mm`, estado (color) |
| Acciones | **Ver Detalle** → D4; **Finalizar** (visible si estado = pendiente) → D6 (calificar) |
| Errores | "Error al cargar tutorías: …" |

#### D4. Detalle de tutoría (`DetalleTutoriaPage` / `DetalleTutoriaViewModel`)

| Aspecto | Detalle |
|---|---|
| Carga | `GET Tutoria/{id}` + `GET Tutoria/{id}/estudiantes` |
| Datos | tema, "Idioma:", "Nivel:", "Modalidad:", "Fecha: dd/MM/yyyy HH:mm", "Cupos: {N}/5 disponibles" (BUG-MAUI: muestra **ocupados** con la palabra "disponibles" y tope fijo 5), estado; lista "Estudiantes Agendados" (nombre completo, correo) |
| Acciones | **+ Agregar** → D5; al volver recarga estudiantes (`Disappearing`) |
| Nota | no hay quitar estudiante ni editar ni finalizar desde aquí |

#### D5. Agregar estudiantes (`AgregarEstudiantesPage` / `AgregarEstudiantesViewModel`)

| Aspecto | Detalle |
|---|---|
| Carga | `GET Usuario/by-rol/Estudiante` (todos, **incluidos los ya asignados**, sin búsqueda) |
| Interacción | toggle por estudiante ("Agregar"); botón **Guardar** habilitado si ≥ 1 seleccionado |
| Validación | ≥ 1 ("Seleccione al menos un estudiante"); **sin tope de cupos** (BUG-MAUI) |
| Acción | `POST Tutoria/{id}/estudiantes` `{ EstudianteIds }` → éxito "Estudiantes agregados correctamente" + volver; `false` → "No se pudieron agregar los estudiantes". El backend ignora los ya asignados y da **400** si todos lo estaban; es todo-o-nada |

#### D6. Calificar / finalizar tutoría (`CalificarTutoriaPage` / `CalificarTutoriaViewModel`) — compartida Docente/Tutor

| Aspecto | Detalle |
|---|---|
| Carga | `GET Tutoria/{id}` → muestra tema, "idioma - nivel" |
| Formulario | **Calificación (1-5)**: `Slider` continuo 1–5 (decimal, por defecto 3.0, mostrado "Calificación: 3.0"); **Comentario**: editor libre (opcional) |
| Validación | calificación entre 1 y 5; tutoría y usuario cargados ("Datos incompletos") |
| Guardar | 1) `POST Retroalimentacion` `{ Comentario: comentario ?? "", Calificacion, TutoriaId, UsuarioId: miId }`; 2) si OK → `PUT Tutoria/{id}/finalizar` (sin cuerpo; el backend envía encuestas); 3) `POST Encuesta/enviar/{id}` sin esperar (redundante). Éxito: "Retroalimentación guardada y tutoría finalizada" + volver |
| Errores | `POST` falla → "No se pudo guardar la retroalimentación"; `finalizar` falla → excepción "Error al guardar: …" **con la retroalimentación ya creada** (no atómico; reintentar duplica la retroalimentación) |

#### D7. Tutorías finalizadas (`TutoriasFinalizadasPage` / `TutoriasFinalizadasViewModel`)

- Carga `GET Tutoria/estado/Finalizada/usuario/{miId}` (solo asignadas; no incluye estado `Completada` del seed).
- Tarjeta: tema, "idioma - nivel", fecha, estado. Acción **Ver Detalle** → D8.

#### D8. Detalle de tutoría finalizada (`DetalleTutoriaFinalizadaPage`, reutiliza `DetalleTutoriaViewModel`)

- `GET Tutoria/{id}` + `GET Tutoria/{id}/estudiantes`. Muestra tema, idioma, nivel, modalidad, fecha, estado y "Estudiantes Agendados" (nombres, apellidos, correo). **Sin acciones.** No muestra la retroalimentación ni las encuestas.

### 1.4 Rol Tutor

Menú (`TutorHomePage`): cabecera nombre/rol; **Mis Tutorías** (inicio), **Tutorías Finalizadas**, **Cerrar Sesión** (misma confirmación). El Tutor **no** agenda tutorías ni gestiona estudiantes.

| Id | Pantalla / ViewModel | Endpoint(s) | Datos | Acciones / navegación |
|---|---|---|---|---|
| T1 | Mis tutorías (`MisTutoriasTutorPage` / `MisTutoriasTutorViewModel`) | `GET Tutoria/estado/Pendiente/usuario/{miId}` | "Tutorías asignadas como tutor"; tema, "idioma - nivel", fecha, estado | **Ver Detalle** → T2; **Calificar** (siempre visible; la lista ya es de pendientes) → D6 |
| T2 | Detalle (`DetalleTutoriaTutorPage` / `DetalleTutoriaTutorViewModel`) | `GET Tutoria/{id}`, `GET Tutoria/{id}/estudiantes` | tema, idioma, nivel, modalidad, fecha, estado (color); "Estudiantes Asignados" | **Calificar Tutoría** (solo si pendiente) → D6 |
| T3 | Calificar | = D6 | | |
| T4 | Tutorías finalizadas (`TutoriasFinalizadasTutorPage`) | `GET Tutoria/estado/Finalizada/usuario/{miId}` | tema, idioma-nivel, fecha, estado | **Ver Detalle** → T2 (sin botón calificar porque no está pendiente) |

### 1.5 Catálogo de llamadas HTTP de MAUI

| # | Método y ruta | Payload | Respuesta usada | Pantallas | Rol |
|---|---|---|---|---|---|
| A1 | `POST Auth/login` | `{Correo, Contrasena}` | `usuario` | Login | ambos |
| A2 | `GET Horario/usuario/{miId}` | — | `HorarioResponse[]` | D1, D2 | Docente |
| A3 | `GET Horario/disponibles` | — | (definido en `ApiService`, **no usado**) | — | — |
| A4 | `POST Tutoria` | `TutoriaCreate` (+ `TutorId` ignorado) | `TutoriaResponse.idTutoria` | D2 | Docente |
| A5 | `GET Tutoria/{id}` | — | `TutoriaResponse` | D4, D6, D8, T2 | ambos |
| A6 | `GET Tutoria/estado/{Pendiente\|Finalizada}/usuario/{miId}` | — | `TutoriaResponse[]` | D3, D7, T1, T4 | ambos |
| A7 | `POST Tutoria/{id}/estudiantes` | `{EstudianteIds}` | bool | D2, D5 | Docente |
| A8 | `PUT Tutoria/{id}/finalizar` | — | `TutoriaResponse` | D6 | ambos |
| A9 | `GET Tutoria/{id}/estudiantes` | — | `UsuarioResponse[]` | D4, D8, T2 | ambos |
| A10 | `POST Retroalimentacion` | `{Comentario, Calificacion, TutoriaId, UsuarioId}` | bool | D6 | ambos |
| A11 | `POST Encuesta/enviar/{id}` | — | bool (fire & forget) | D6 | ambos |
| A12 | `GET Usuario/by-rol/{Tutor\|Docente\|Estudiante}` | — | `UsuarioResponse[]` | D2, D5 | Docente |

### 1.6 Comportamientos MAUI que **no** se replicarán (y qué hará la web)

| # | BUG-MAUI | Decisión web |
|---|---|---|
| M1 | Docente no ve tutorías que agendó para otro (filtra por tutor asignado) | "Mis tutorías" del Docente une **asignadas** + **agendadas en mis horarios** (requiere R1) |
| M2 | Tope fijo de 5 estudiantes; "Cupos: N/5 disponibles" con texto erróneo | Tope = `Horario.cupos` (requiere R5/R6); texto "N de M cupos ocupados" |
| M3 | Modalidad multiselección unida por coma | Selección **única** (radio group Virtual / Presencial / Híbrido), coherente con la web actual y con métricas por modalidad. Pendiente de confirmar (pregunta Q3) |
| M4 | Retroalimentación + finalizar no atómico; `Encuesta/enviar` redundante | No se llama a `Encuesta/enviar`. Si `finalizar` falla tras crear la retro, la UI ofrece "Reintentar finalizar" **sin** volver a crear la retro. Ideal: R8 (atómico) |
| M5 | Crear tutoría + asignar estudiantes no atómico | Igual que MAUI mientras no exista R9, pero con mensaje claro y enlace directo al detalle para reintentar la asignación |
| M6 | Agregar estudiantes lista también a los ya asignados y sin búsqueda | Excluir asignados, búsqueda, contador de cupos |
| M7 | Filtro `estado == "disponible"` excluye `Libre` | Considerar disponible `Disponible` o `Libre` (como `EstadosHorario.EsDisponible`) |
| M8 | Todos los errores = "Credenciales inválidas" / `ex.Message` crudo | Mensajes por status: 401, 403, 429 (con `Retry-After`), red, 5xx; usar `message` del problem+json |
| M9 | Calificación slider continuo (3.7, 4.23…) | Control accesible 1–5 con paso 0.5 y valor visible (pregunta Q4) |
| M10 | Sin sesión persistente ni token | Sesión persistente con JWT y expiración (§4.2) |

---

## 2. Matriz de equivalencia MAUI → Web

Columnas: **¿Existe en web?** (hoy) · **Ruta web destino** · **Endpoint** · **¿Autorizado hoy para ese rol?** (según `Politicas` + `AsegurarAccesoADatosDe` verificados).

### 2.1 Común

| Funcionalidad MAUI | ¿Existe en web? | Ruta web | Endpoint | ¿Autorizado? | Notas |
|---|---|---|---|---|---|
| Login Docente/Tutor | Parcial: solo Admin/Aux (bloqueo en cliente) | `/login` | `POST Auth/login` EXISTE | Sí (público; Estudiante → 403) | Quitar el filtro de rol del cliente; redirigir por rol |
| Sesión / logout con confirmación | Parcial: logout con `window.confirm`; la sesión **se borra al recargar** | sidebar → diálogo | — | — | ConfirmDialog accesible; sesión persistente con `expiresAt` |
| Validar sesión al abrir | No | — | `GET Auth/me` EXISTE | Sí (autenticado) | Fuente de verdad del rol tras recargar |
| Menú por rol | No (menú fijo Admin) | AppShell | — | — | Config de navegación por rol |

### 2.2 Docente

| Funcionalidad MAUI | ¿Existe en web? | Ruta web | Endpoint | ¿Autorizado hoy para Docente? | Estado |
|---|---|---|---|---|---|
| D1 Horarios disponibles propios, agrupados, búsqueda, expandir fechas | No (la web de gestión ve todos los horarios con `GET Horario`, GestionWeb) | `/agenda` (inicio Docente) | `GET Horario/usuario/{miId}` EXISTE | Sí (propio id) | OK |
| D2 Agendar: cargar horario elegido | No | `/agenda/:horarioId/agendar` | `GET Horario/usuario/{miId}` + búsqueda local EXISTE (`GET Horario/{id}` es GestionWeb) | Sí | OK (workaround aceptable) |
| D2 Listar tutores/docentes | Sí (Admin, vía `GET Usuario` GestionWeb) | idem | `GET Usuario/by-rol/Tutor` y `/Docente` EXISTE | Sí (Personal) | OK |
| D2 Listar estudiantes | Sí (Admin, vía `GET Usuario`) | idem | `GET Usuario/by-rol/Estudiante` EXISTE | Sí (Personal) | OK |
| D2 Crear tutoría | Sí (Admin, `FormularioTutoria`) | idem | `POST Tutoria` EXISTE | Sí (Personal) | OK, pero backend no valida horario disponible/propio (R4) |
| D2 Asignar estudiantes al crear (tope cupos) | Parcial (Admin, cálculo de cupos inconsistente) | idem | `POST Tutoria/{id}/estudiantes` EXISTE | Sí | **GAP parcial**: el tope de cupos solo puede validarse en cliente (R5) |
| D3 Mis tutorías — asignadas a mí | No | `/mis-tutorias` | `GET Tutoria/estado/Pendiente/usuario/{miId}` EXISTE | Sí (propio id) | OK |
| D3 Mis tutorías — **agendadas por mí** (owner del horario) | No | `/mis-tutorias` (pestaña/filtro "Agendadas por mí") | **No existe** | — | **GAP** → R1 |
| D4 Detalle de tutoría | Sí (Admin, modal `TutoriaDetailModal`) | `/mis-tutorias/:id` | `GET Tutoria/{id}`, `GET Tutoria/{id}/estudiantes` EXISTE | Sí, **pero sin regla de propiedad** | OK funcional; **riesgo seguridad** → R2 |
| D4 Cupos reales en el detalle | Parcial (Admin, vía `GET Horario/{id}`) | idem | `GET Horario/{id}` es GestionWeb → 403 Docente; `TutoriaResponse` no trae cupos | No | **GAP** → R6 |
| D5 Agregar estudiantes a tutoría | Sí (Admin, `AgregarEstudianteATutoriaModal`) | `/mis-tutorias/:id` (diálogo "Agregar estudiantes") | `POST Tutoria/{id}/estudiantes` EXISTE | Sí, sin propiedad ni cupos | OK funcional; → R2, R5 |
| D6 Calificar + finalizar | **No existe en web** (ningún rol finaliza desde la web) | `/mis-tutorias/:id/finalizar` | `POST Retroalimentacion` + `PUT Tutoria/{id}/finalizar` EXISTE | Sí, sin propiedad; `usuarioId` no verificado | OK funcional; → R2, R3, R8 |
| D7 Tutorías finalizadas (asignadas) | Parcial (Admin ve todas: `GET Tutoria` filtrando en cliente) | `/historial` | `GET Tutoria/estado/Finalizada/usuario/{miId}` EXISTE | Sí | OK, pero no incluye `Completada` (R7) ni las agendadas (R1) |
| D8 Detalle finalizada (solo lectura) | Sí (Admin, `TutoriaFinalizadaDetailModal` con retro/encuestas/Excel) | `/historial/:id` | `GET Tutoria/{id}`, `GET Tutoria/{id}/estudiantes` EXISTE | Sí | OK. Retro/encuestas/Excel **no** para Docente (GestionWeb) — MAUI tampoco los muestra |

### 2.3 Tutor

| Funcionalidad MAUI | ¿Existe en web? | Ruta web | Endpoint | ¿Autorizado hoy para Tutor? | Estado |
|---|---|---|---|---|---|
| T1 Mis tutorías pendientes asignadas | No | `/mis-tutorias` (inicio Tutor) | `GET Tutoria/estado/Pendiente/usuario/{miId}` EXISTE | Sí | OK |
| T2 Detalle | Sí (Admin, modal) | `/mis-tutorias/:id` (sin "Agregar estudiantes") | `GET Tutoria/{id}`, `GET …/estudiantes` EXISTE | Sí, sin propiedad | OK; → R2 |
| T3 Calificar + finalizar | No | `/mis-tutorias/:id/finalizar` | `POST Retroalimentacion`, `PUT …/finalizar` EXISTE | Sí, sin propiedad | OK; → R2, R3, R8 |
| T4 Finalizadas | Parcial (Admin) | `/historial`, `/historial/:id` | `GET Tutoria/estado/Finalizada/usuario/{miId}` EXISTE | Sí | OK; → R7 |

### 2.4 Administrador / Auxiliar (se mantiene; impacto de JWT)

| Funcionalidad web actual | Ruta | Endpoints | ¿Autorizado? | Cambio necesario |
|---|---|---|---|---|
| Dashboard (métricas, gráficos Recharts, encuestas) | `/` | `GET Metricas/generales`, `GET Metricas/tutorias`, `GET Encuesta/estadisticas`, datos de `DataContext` | GestionWeb ✅ | Cargar datos **después** del login (hoy `DataProvider` carga al montar, sin token → 401 silencioso) |
| Horarios y tutorías (calendario día/semana/mes, CRUD horarios) | `/horarios` | `GET/POST/PUT/DELETE Horario`, `GET Tutoria` | GestionWeb ✅ | `DELETE` con tutorías → 409 con mensaje: mostrarlo |
| Agendar tutoría (gestión) | `/agendar-tutoria` | `POST/PUT/DELETE Tutoria`, `POST/DELETE Tutoria/{id}/estudiantes` | GestionWeb ✅ | Corregir `mapTutoriaToAPI`: usa `estudianteId` como `usuarioId` (asigna un estudiante como tutor) |
| Usuarios (estudiantes y docentes) | `/estudiantes` (etiqueta "Usuarios") | `GET/POST/PUT/DELETE Usuario` | GestionWeb ✅; Auxiliar solo Estudiantes | Ocultar CRUD de no-Estudiantes al Auxiliar; **no** enviar `TempPass123!` al editar (resetea la contraseña) |
| Tutorías finalizadas (retro, encuestas, Excel) | `/tutorias-finalizadas` | `GET Tutoria`, `GET Retroalimentacion/tutoria/{id}`, `GET Encuesta/tutoria/{id}`, `GET Notificacion/reporte-excel/{id}` | GestionWeb ✅ | Ninguno funcional; nombre de archivo ya legible por CORS |
| Retroalimentaciones | **página existe sin ruta** (`pages/Retroalimentaciones.jsx`) | `GET Retroalimentacion…` | GestionWeb ✅ | Decidir si se enruta (Q7) |
| Encuesta pública | `/encuesta?token=` | `GET Encuesta/verificar/{token}`, `POST Encuesta/responder` | Público ✅ | No enviar `Authorization`; quitar `alert` |

---

## 3. Para Dante — requisitos de backend

Priorización: **P0** bloquea la equivalencia o es un riesgo de seguridad; **P1** necesario para no replicar bugs; **P2** mejora.

### R1 (P0) — Tutorías agendadas por el Docente (dueño del horario) · **PROPUESTO** · cierra GAP D3/D7

- **Por qué:** el Docente agenda tutorías en **sus** horarios (`Horario.Usuario_idUsuario`) y suele asignarlas a un Tutor (`Tutoria.Usuario_idUsuario`). Hoy no hay forma de que las vea: `estado/{e}/usuario/{id}` filtra por tutor asignado y `GET Tutoria` es GestionWeb. No existe un campo "creado por"; el dueño del horario es el único vínculo real.
- **Propuesta (sigue el patrón existente):**
  `GET /api/Tutoria/agendadas/usuario/{usuarioId}?estado={estado}` · política `Personal` + `AsegurarAccesoADatosDe(usuarioId)` · filtro `t.Horario.Usuario_idUsuario == usuarioId` · `estado` opcional (ver R7 para sinónimos) · respuesta `TutoriaResponse[]` (con `estudiantes`, como el resto de listados).
- **Alternativa** (si se prefiere un único endpoint): `GET /api/Tutoria/mias?estado=` que devuelva la unión (asignadas ∪ agendadas) con un campo `relacion: "asignada" | "agendada" | "ambas"`. Para la UI ambas sirven; la primera es más simple de probar.

### R2 (P0) — Regla de propiedad en tutorías · **PROPUESTO** (hoy no hay ninguna comprobación)

Definición propuesta de "participa en la tutoría" para Docente/Tutor:

- **Asignado:** `Tutoria.Usuario_idUsuario == sub`.
- **Dueño del horario:** `Tutoria.Horario.Usuario_idUsuario == sub` (aplica al Docente que agendó).

| Endpoint | Admin/Aux | Docente | Tutor | Error |
|---|---|---|---|---|
| `GET Tutoria/{id}` | todas | asignado **o** dueño del horario | asignado | 403 "No tiene acceso a esta tutoría" |
| `GET Tutoria/{id}/estudiantes` | todas | idem | idem | 403 |
| `POST Tutoria/{id}/estudiantes` | todas | asignado o dueño del horario (MAUI: Docente sí) | **403** (MAUI no le ofrece la acción) — confirmar con producto (Q2) | 403 |
| `PUT Tutoria/{id}/finalizar` | todas | asignado o dueño del horario | asignado | 403 |
| `POST Encuesta/enviar/{id}` | todas | igual que finalizar (la web no lo usará; ver R8) | igual | 403 |
| `PUT Tutoria/{id}` / `DELETE` | sin cambio (GestionWeb) | 403 | 403 | — |

- Recomiendo **403** (coherente con `AsegurarAccesoADatosDe`) y no 404; el id no es secreto.
- Centralizar en un helper tipo `User.AsegurarAccesoATutoria(tutoria)` y cubrir con tests de `AutorizacionTests`.

### R3 (P0) — `POST Retroalimentacion`: el autor sale del token · **PROPUESTO**

- **Por qué:** hoy `usuarioId` viene del cuerpo y no se valida (`RetroalimentacionService.CreateRetroalimentacionAsync`): un Docente puede firmar retroalimentaciones a nombre de otro.
- **Propuesta:** para Docente/Tutor, `usuarioId` debe ser igual a `sub` (o ignorar el del cuerpo y usar `sub`), y la tutoría debe cumplir R2. Admin/Aux sin cambio. La web enviará siempre su propio id.
- **Opcional:** impedir una segunda retroalimentación del mismo usuario en la misma tutoría (409), lo que hace segura la reintención de M4.

### R4 (P0) — `POST Tutoria`: validaciones de negocio · **PROPUESTO**

Hoy (verificado en `TutoriaService.CreateTutoriaAsync`) solo comprueba que existan usuario y horario.

1. Horario **disponible** (`EstadosHorario.EsDisponible`) → si no, **409** "El horario ya no está disponible" (evita doble reserva por carrera o por URL manipulada).
2. Docente: el horario debe ser **suyo** (`Horario.Usuario_idUsuario == sub`) → 403. (Paridad MAUI: solo agenda en sus horarios.)
3. Tutor: **403** al crear (MAUI no le ofrece agendar) — o mantener `Personal` si producto quiere que el Tutor agende (Q2).
4. `usuarioId` debe tener rol **Docente o Tutor** → 400 "El usuario asignado debe ser Docente o Tutor". (La web de gestión actual puede enviar un estudiante como `usuarioId`: ver hallazgo W5.)
5. `fechaTutoria` debe coincidir con la fecha/hora del horario (o calcularse en servidor y dejar de ser obligatoria). La UI la deriva igual que MAUI: `fechaInicio (fecha) + horaInicio (hora)`.

### R5 (P1) — Semántica y validación de `Cupos` · **decisión + PROPUESTO**

- **Qué observo:** `Horario.cupos` es `string` en BD/DTO (`"10"`). Crear una tutoría pasa el horario a `Ocupado`, así que en la práctica **un horario aloja una sola tutoría**. La web ya interpreta `cupos` como capacidad, pero de forma inconsistente (en un sitio cuenta tutorías por horario, en otro estudiantes únicos del horario, en otro estudiantes de la tutoría). MAUI lo ignora (5 fijo).
- **Propuesta de significado:** `cupos` = **máximo de estudiantes asignados a la tutoría de ese horario**.
- **Validación en backend:** en `POST Tutoria/{id}/estudiantes`, si `asignadosActuales + nuevos > cupos` → **409** "Cupo completo: X de Y ocupados" (todo-o-nada, como ya es). Si `cupos` no es un entero ≥ 1 (datos legados) → sin límite y log de advertencia.
- **Validación en `POST/PUT Horario`:** `cupos` entero 1–N (mantener `string` en el DTO para no romper, pero validar formato); o migrar a `int` en un cambio versionado.
- La UI validará también en cliente (deshabilita selección al llegar al tope), pero **el backend debe ser la autoridad**.

### R6 (P1) — Campos aditivos en `TutoriaResponse` · **PROPUESTO**

| Campo | Tipo | Para qué |
|---|---|---|
| `horarioUsuarioId` | int | Saber si el usuario es dueño del horario → mostrar acciones (agregar estudiantes, finalizar) y etiqueta "Agendada por ti" |
| `horarioCupos` | int \| null | Mostrar "X de Y cupos" y limitar selección sin llamar a `GET Horario/{id}` (403 para Docente/Tutor) |
| `horarioTitulo` | string | Contexto en listas y detalle (hoy solo hay espacio y horas) |
| `horarioUsuarioNombre` / `horarioUsuarioApellidos` | string | "Agendada por …" en la vista del Tutor (opcional) |

Aditivo: no rompe a la web de gestión.

### R7 (P1) — Estados que usará la web · **decisión**

Valores que la web **escribirá**: solo `"Pendiente"` al crear (como MAUI y la web actual). El backend escribe `"Finalizada"` en `finalizar` y `"Ocupado"` en el horario.

Valores que la web **leerá** (normalizados en cliente, sin distinguir mayúsculas):

| Grupo UI | Valores aceptados | Badge |
|---|---|---|
| Pendiente | `Pendiente`, `Programada`, `Activo` | ámbar |
| Finalizada | `Finalizada`, `Completada` | verde |
| Cancelada | `Cancelada` | gris/rojo apagado |
| Horario disponible | `Disponible`, `Libre` | — |
| Horario ocupado | `Ocupado` | — |
| Horario cancelado | `Cancelado` | — |

Petición: que `GET Tutoria/estado/{estado}/usuario/{id}` (y R1) acepten el **grupo** (p. ej. `estado=pendiente` devuelve `Pendiente`+`Programada`+`Activo`, sin distinguir mayúsculas) usando `EstadosTutoria.PendientesLower/FinalizadosLower`. Hoy compara exacto: un Tutor no ve tutorías `Programada`/`Completada` del seed. Si no se cambia, la web hará 2–3 peticiones y unirá resultados (peor). Recomiendo además fijar los oficiales `Pendiente/Finalizada/Cancelada` y migrar datos (decisión ya abierta en el contrato).

### R8 (P1) — Finalizar con retroalimentación de forma atómica · **PROPUESTO**

- `PUT /api/Tutoria/{id}/finalizar` con cuerpo **opcional** `{ "calificacion": 4.5, "comentario": "…" }`: crea la retroalimentación (autor = `sub`) y finaliza en una transacción; encuestas después (como hoy). Sin cuerpo = comportamiento actual (compatibilidad).
- La web dejará de llamar a `POST Encuesta/enviar` (redundante).

### R9 (P2) — Crear tutoría con estudiantes en una sola operación · **PROPUESTO**

`TutoriaCreate.estudianteIds?: int[]` opcional: crea y asigna atómicamente (validando cupos, R5). Evita el estado "tutoría creada sin estudiantes" de M5.

### R10 (P2) — Lectura de la retroalimentación propia · **PROPUESTO (opcional, no requerido para paridad)**

MAUI no muestra la retroalimentación en el detalle finalizado. Si producto lo quiere en la web para Docente/Tutor: permitir `GET Retroalimentacion/tutoria/{id}` a participantes (R2).

### R11 (P0 operativo) — Entorno y datos de prueba

- Usuarios de prueba con hash **BCrypt** para los 4 roles (+ un Estudiante para probar el 403) y un script/seed reproducible para la BD de pruebas E2E (horarios disponibles del Docente, tutorías pendientes/finalizadas asignadas y agendadas).
- `Cors:AllowedOrigins` y `Encuesta:UrlBase` con el dominio real de la web cuando se despliegue; el preview de Vite (`http://localhost:4173`) si se usa para E2E.
- Confirmar que `expiresAt` refleja `Jwt:ExpirationMinutes` y que un usuario borrado o con rol cambiado obtiene 401 en `Auth/me` (la web lo usa al arrancar).

### Resumen de compatibilidades revisadas (sin incidencias)

camelCase en respuestas; fechas sin zona (la web las tratará como hora local, sin `toISOString()` para mostrar); `expiresAt` en UTC con `Z`; `calificacion` decimal 1–5 en retro; errores con `message` y `errors` (claves PascalCase); sin paginación; Bearer (no cookies) — no hace falta `credentials`.

---

## 4. Plan de implementación web

### 4.1 Estado actual de la web (hallazgos que condicionan el plan)

| # | Hallazgo | Impacto |
|---|---|---|
| W1 | `AuthContext` **borra la sesión al iniciar** la app; recargar = volver al login | Sustituir por sesión persistente con expiración |
| W2 | `DataProvider` envuelve toda la app y llama a `GET Usuario`, `GET Horario`, `GET Tutoria` **al montar, antes del login** y sin depender del rol. Con JWT: 401 silencioso → pantallas vacías tras el login; para Docente/Tutor serían 403 silenciosos | Cargar solo tras autenticación y solo para GestionWeb; las vistas personales usan su propia capa de datos |
| W3 | `handleResponse` interpreta 403 como "CORS"; no hay manejo global de 401 | Nuevo cliente HTTP (§4.3) |
| W4 | `request()` hace `console.log` de **las cabeceras, incluido `Authorization: Bearer …`**, y de los cuerpos (contraseñas en login) | Eliminar logs de cabeceras/cuerpos; logger solo en desarrollo |
| W5 | `mapTutoriaToAPI` usa `estudianteId` como `usuarioId` si existe (asigna un estudiante como tutor) | Corregir: `usuarioId` siempre es el docente/tutor |
| W6 | `mapUsuarioToAPI` envía `contrasena: 'TempPass123!'` al editar estudiantes → **resetea** su contraseña | Omitir `contrasena` en edición salvo que se cambie |
| W7 | `App.jsx` importa `./App.css` pero el archivo es `src/app.css` | Funciona en Windows; **falla el build en Linux/CI** (sensible a mayúsculas) |
| W8 | 0 atributos `aria-*`/`role`; modales `div` sin foco atrapado ni Esc; `alert`/`window.confirm` en 12 componentes | Componentes base accesibles (§4.7) |
| W9 | Shell no responsive: sidebar `position: fixed; width: 280px` + `margin-left: 280px` sin `@media` (Sidebar, Horarios, Estudiantes, modales sin media queries) | Shell responsive (§4.5) |
| W10 | `src/endpoints/**` contiene copias `.cs` del backend antiguo dentro del repo web | No se usan en el build; proponer eliminarlas en una PR aparte (confirmación del usuario) |
| W11 | `pages/Retroalimentaciones.jsx` existe y no está enrutada | Pregunta Q7 |
| W12 | No hay tests, lint ni type-check configurados | Añadir Playwright (E2E) y, opcional, Vitest para utilidades |

### 4.2 Arquitectura de autenticación

**Almacenamiento:** el contrato es Bearer (sin cookies httpOnly ni refresh). Se guarda en `localStorage` la clave `tutorpro.session = { token, expiresAt, usuario }` (una sola clave, versionable). Trade-off: `localStorage` es legible por un XSS; mitigaciones: sin `dangerouslySetInnerHTML`, sin scripts de terceros, CSP en el despliegue, token de 8 h. La alternativa robusta (cookie httpOnly + SameSite + CSRF) exige cambios de backend; se deja como propuesta futura, no bloquea.

**`AuthContext` (reescritura de `context/AuthContext.jsx`):**

```
estado: { status: 'checking' | 'authenticated' | 'anonymous', user, token, expiresAt }
login(correo, contrasena)  → POST Auth/login → guarda sesión → status=authenticated → devuelve user
logout({ reason })         → borra sesión, cancela timers, limpia caches de datos, navega a /login?motivo=...
hasRole(...roles), isGestion (Admin|Aux), isPersonal (Docente|Tutor)
```

1. **Arranque:** leer sesión; si no hay o `expiresAt <= ahora` → `anonymous`. Si hay → `status='checking'`, `GET Auth/me` con el token: 200 → `authenticated` con el **usuario devuelto por `/me`** (rol fresco); 401 → logout silencioso; error de red → mantener sesión con aviso "Sin conexión con el servidor" y botón Reintentar (no expulsar por un corte de red).
2. **Expiración proactiva:** `setTimeout` hasta `expiresAt` (acotado a 2^31-1 ms) → `logout({reason:'expirada'})`. Aviso no intrusivo 5 min antes ("Tu sesión vence a las HH:mm").
3. **Multi-pestaña:** escuchar `storage` → si otra pestaña cierra sesión, esta también.
4. **Login por rol:** se elimina el filtro de rol en cliente. Redirección: `?redirect=` si la ruta pertenece al rol; si no, a la home del rol (Admin/Aux `/`, Docente `/agenda`, Tutor `/mis-tutorias`).
5. **Mensajes de login:** 400 → errores por campo; 401 → "Correo o contraseña incorrectos"; 403 → "Tu cuenta no tiene acceso a CDITutorPro" (Estudiante); 429 → "Demasiados intentos. Intenta de nuevo en N s" (lee `Retry-After`, deshabilita el botón con cuenta atrás); red → "No se pudo conectar con el servidor".
6. **Copy del login:** quitar "Solo usuarios Administrador y Auxiliar pueden acceder".

### 4.3 Cliente HTTP (`services/apiClient.js`, refactor de `apiService.js`)

- `request(path, { method, body, signal, auth = true })`; cabeceras por defecto + `Authorization` desde el `AuthContext` (vía `setTokenProvider`), `ngrok-skip-browser-warning` solo si la base es ngrok.
- `ApiError extends Error { status, message, errors, traceId, retryAfter }` construido desde el problem+json (`message` → `detail` → `title` → texto genérico por status). Se elimina la lectura de `details`.
- **401** (excepto en `Auth/login`) → `onUnauthorized()` registrado por `AuthContext` → logout + `/login?motivo=expirada&redirect=<ruta actual>`. Una sola vez aunque fallen varias peticiones en paralelo.
- **403** → `ApiError` con `message` del servidor ("Solo puede consultar sus propios datos", "No tiene acceso a esta tutoría"); las vistas lo muestran en `ErrorState` tipo "Sin permiso", nunca como CORS.
- **409** → mensaje del servidor en toast/inline (cupo completo, horario ocupado, borrado con dependencias).
- `AbortController`: cada vista cancela sus peticiones al desmontar o al cambiar filtros.
- Endpoints públicos de encuesta con `auth:false` (sin `Authorization`).
- Se conservan los servicios por dominio (`tutoriaService`, `horarioService`…) con la misma API pública para no tocar a la vez todas las vistas de gestión; se añaden `authService.me()`, `tutoriaService.getByEstadoYUsuario(estado, id)`, `tutoriaService.finalizar(id[, body])`, `tutoriaService.getAgendadas(...)` (cuando exista R1).
- Logs: `debug()` solo con `import.meta.env.DEV`, sin cabeceras ni cuerpos.

### 4.4 Rutas y `ProtectedRoute` por rol

`ProtectedRoute` pasa a ser un layout route:

```jsx
<Route element={<RequireAuth />}>                       // checking → splash; anonymous → /login?redirect
  <Route element={<AppShell />}>
    <Route index element={<RoleHome />} />              // Admin/Aux → Dashboard; Docente → /agenda; Tutor → /mis-tutorias
    <Route element={<RequireRole roles={GESTION} />}> … rutas de gestión … </Route>
    <Route element={<RequireRole roles={['Docente']} />}> … agenda … </Route>
    <Route element={<RequireRole roles={['Docente','Tutor']} />}> … mis tutorías, historial … </Route>
    <Route path="*" element={<NotFound />} />
  </Route>
</Route>
```

`RequireRole` sin permiso → página "No tienes acceso a esta sección" con enlace a la home del rol (no redirige en silencio, para que el usuario entienda). La autorización real la hace el backend; esto es UX.

**Mapa de rutas:**

| Ruta | Vista | Admin | Aux | Docente | Tutor | Origen |
|---|---|---|---|---|---|---|
| `/login` | Login | público | | | | existente (ajustado) |
| `/encuesta?token=` | Encuesta pública | público | | | | existente |
| `/` | RoleHome → Dashboard | ✅ | ✅ | → `/agenda` | → `/mis-tutorias` | existente |
| `/horarios` | Horarios y tutorías (calendario) | ✅ | ✅ | ❌ | ❌ | existente |
| `/agendar-tutoria` | Agendar (gestión) | ✅ | ✅ | ❌ | ❌ | existente |
| `/estudiantes` | Usuarios | ✅ | ✅ (solo Estudiantes) | ❌ | ❌ | existente (se mantiene la ruta para no romper enlaces) |
| `/tutorias-finalizadas` | Finalizadas (gestión) | ✅ | ✅ | ❌ | ❌ | existente |
| `/retroalimentaciones` | Retroalimentaciones | ✅ | ✅ | ❌ | ❌ | existe sin ruta (Q7) |
| `/agenda` | Horarios disponibles (D1) | | | ✅ | ❌ | **nueva** |
| `/agenda/:horarioId/agendar` | Asistente de agendamiento (D2) | | | ✅ | ❌ | **nueva** |
| `/mis-tutorias` | Mis tutorías pendientes (D3/T1) | | | ✅ | ✅ | **nueva** |
| `/mis-tutorias/:id` | Detalle (D4/T2) + agregar estudiantes (D5, solo Docente con permiso) | | | ✅ | ✅ | **nueva** |
| `/mis-tutorias/:id/finalizar` | Calificar y finalizar (D6/T3) | | | ✅ | ✅ | **nueva** |
| `/historial` | Finalizadas propias (D7/T4) | | | ✅ | ✅ | **nueva** |
| `/historial/:id` | Detalle finalizada (D8) | | | ✅ | ✅ | **nueva** |

Las páginas de detalle son **rutas** (no modales) para tener URL compartible, botón atrás del navegador y foco correcto — equivalentes a la pila de `PushAsync` de MAUI. Admin/Aux mantienen sus modales actuales en esta migración.

### 4.5 Layout, navegación por rol y shell responsive

**Navegación (config única `navigation.js`):**

| Rol | Ítems |
|---|---|
| Administrador | Dashboard · Horarios · Agendar tutoría · Usuarios · Tutorías finalizadas (· Retroalimentaciones si Q7) |
| Auxiliar | igual que Administrador (Usuarios limitado a Estudiantes dentro de la vista) |
| Docente | Agenda (horarios disponibles) · Mis tutorías · Historial |
| Tutor | Mis tutorías · Historial |

Pie del sidebar (todos): avatar con iniciales, nombre, rol, conmutador de tema, cerrar sesión (ConfirmDialog).

**Shell responsive (`AppShell` + refactor de `Sidebar.css`/`app.css`):**

- **≥ 1024 px:** sidebar fija de 280 px (identidad actual), contenido con `margin-inline-start: 280px` → mejor: grid `grid-template-columns: 280px 1fr` para no depender de `position: fixed`.
- **768–1023 px:** sidebar colapsada a raíl de iconos (72 px) con tooltips/labels accesibles; se expande con botón.
- **< 768 px:** barra superior (logo + título de la página + botón menú 44×44) y sidebar como **drawer** off-canvas: `aria-expanded`, foco atrapado, cierre con Esc, clic en overlay o al navegar, `inert` en el contenido de fondo. Padding de contenido `1rem` (16 px) en móvil, `2rem` en escritorio. Sin scroll horizontal de página: las tablas pasan a tarjetas.
- `prefers-reduced-motion`: sin transición del drawer.
- Enlace "Saltar al contenido" y `<main id="contenido" tabIndex={-1}>`; al cambiar de ruta se mueve el foco al `<h1>` de la página y se actualiza `document.title`.
- Iconos: hoy son emojis; se mantienen en esta fase para no alterar la identidad (se marcan `aria-hidden`). Sustituirlos por un set SVG coherente es una mejora opcional posterior (Q8).

**Identidad visual:** se respetan los tokens de `index.css` (desde la marca CDI: `--accent #b11d25` rojo CDI, `--accent-secondary #00529c` azul CECAR; superficies, radios 8–14 px, modo oscuro por `data-theme`), la tipografía de sistema y el tono "CDITutorPro / Gestión de Tutorías". Las vistas nuevas reutilizan esos tokens; se añaden solo tokens que faltan (`--warning-*`, `--success-*` para badges de estado, `--space-*` y `--radius-*` para consistencia) sin cambiar los existentes. No se introduce librería de UI. Tras construir, se ofrecerá `impeccable init`/`document` para capturar PRODUCT.md/DESIGN.md del sistema existente.

### 4.6 Capa de datos

- **Gestión (Admin/Aux):** `DataProvider` se monta **dentro** de `RequireRole(GESTION)` (no en la raíz), de modo que solo carga tras login y solo para esos roles. Se mantiene su API para no reescribir las vistas de gestión en esta migración. Se corrigen W5 y W6.
- **Personal (Docente/Tutor):** hooks por vista, sin estado global, con un pequeño `useApiQuery(key, fn)` propio (estado `idle/loading/success/error`, `refetch`, abort al desmontar, revalidar al volver a la pestaña). Justificación: son 6 vistas con lecturas simples; TanStack Query sería razonable pero no imprescindible — se propone **no** añadir dependencia salvo que el usuario la prefiera (Q9).
  - `useHorariosPropios()` → `GET Horario/usuario/{miId}` + filtro `EsDisponible` + agrupación (porta `HorarioGrupoItem` a `groupHorarios()` puro y testeable).
  - `useMisTutorias(grupoEstado)` → asignadas (`estado/{e}/usuario/{miId}`) ∪ agendadas (R1, solo Docente), deduplicadas por `idTutoria`, con `relacion` calculada (`asignada`, `agendada`, `ambas`) y orden por `fechaTutoria`.
  - `useTutoria(id)` → `GET Tutoria/{id}` + `GET Tutoria/{id}/estudiantes` en paralelo.
  - `useUsuariosPorRol(rol)` con caché en memoria de sesión (tutores, docentes, estudiantes).
- **Permisos de acción en UI** (`canAgregarEstudiantes`, `canFinalizar`) calculados con `user.idUsuario`, `tutoria.usuarioId` y `horarioUsuarioId` (R6). Mientras R6 no exista: Docente puede agregar si la tutoría vino del listado de agendadas o si es el asignado.
- **Fechas:** utilidades `parseLocalDateTime`, `formatFecha` (`dd/MM/yyyy`), `formatHora` (`HH:mm`), `formatDiaLargo` (`EEEE dd/MM/yyyy`, `Intl` es-CO). Nunca `toISOString()` para mostrar.
- **Estados:** `normalizeEstadoTutoria()` y `isHorarioDisponible()` según R7.

### 4.7 Componentes reutilizables a crear (`src/components/ui/`)

| Componente | Responsabilidad / accesibilidad | Sustituye |
|---|---|---|
| `AppShell`, `SidebarNav`, `TopBar`, `MobileDrawer` | §4.5 | `Sidebar` fijo |
| `PageHeader` | `h1`, subtítulo, contador, acciones; breadcrumb "Volver" en detalles | cabeceras repetidas |
| `Modal` | `<dialog>` nativo con `showModal()` (foco atrapado, Esc, `aria-labelledby`), restaura el foco al cerrar, bloquea scroll | modales `div` |
| `ConfirmDialog` | `alertdialog`, botón destructivo diferenciado, foco inicial en "Cancelar" | `window.confirm` |
| `ToastProvider` / `useToast` | región `aria-live="polite"` (errores `assertive`), autocierre 5 s pausable, máx. 3 | `alert()` |
| `DataTable` | tabla semántica (`<th scope>`, `caption`), orden opcional; < 768 px se renderiza como lista de tarjetas | tablas ad hoc |
| `EmptyState` | icono, título, texto, acción ("No tienes tutorías pendientes" + enlace a Agenda) | — |
| `ErrorState` | mensaje del `ApiError`, variante "Sin permiso" (403) y "Sin conexión", botón Reintentar | bloques "Error al cargar datos" |
| `Skeleton` / `LoadingState` | placeholders con dimensiones finales (sin CLS), `aria-busy` | "Cargando..." |
| `StatusBadge` | color + texto (no solo color) por grupo de estado R7 | `EstadoColorConverter` |
| `Stepper` | `<ol>` con `aria-current="step"`, pasos completados anunciados | indicador MAUI |
| `SearchInput` | `type="search"`, label visible o `aria-label`, limpiar | inputs sueltos |
| `ChoiceChips` / `RadioCards` | grupo `radiogroup`/`checkbox` real con teclado | chips MAUI |
| `StudentPicker` | búsqueda + lista de checkboxes, excluye asignados, contador "N de M", deshabilita al tope con explicación | listas MAUI y web |
| `RatingInput` | `input type=range` 1–5 paso 0.5 con `aria-valuetext` "4,5 de 5" + estrellas decorativas; o radiogroup de 5 estrellas (Q4) | `Slider` MAUI |
| `FormField` | label, ayuda, error con `aria-describedby`/`aria-invalid`, contador de caracteres (≤ 45, ≤ 300) | — |
| `Button` | variantes primaria/secundaria/peligro/ghost, estado `loading` con `aria-busy`, objetivo táctil ≥ 44 px | botones dispersos |

### 4.8 Vistas Docente/Tutor — diseño funcional y estados

**`/agenda` (D1, Docente).** PageHeader "Horarios disponibles" + "Reserva uno de tus horarios para una nueva tutoría" + contador "N horarios (M fechas)". SearchInput (título, espacio, fecha). Lista de grupos (tarjetas): título, etiqueta Recurrente/Único, hora, espacio, rango de fechas, cupos (`cupos` del horario). Grupo recurrente: disclosure "Ver fechas (N)" (`aria-expanded`, uno abierto a la vez como MAUI) con cada ocurrencia y su botón "Agendar". Grupo único: botón "Agendar tutoría". Estados: skeleton; vacío ("No tienes horarios disponibles. Los horarios los crea Administración."); error con reintento; búsqueda sin resultados ("Ningún horario coincide con 'x'" + limpiar). Refresco al volver a la pestaña.

**`/agenda/:horarioId/agendar` (D2, Docente).** Resumen fijo del horario (título, fecha, hora, espacio, cupos). Stepper 3 pasos con las **mismas validaciones** que MAUI más longitudes del backend:
1. Tema: Idioma*, Nivel*, Tema* (≤ 45, trim), Modalidad* (Q3).
2. Asignación: combobox con búsqueda de Tutores y Docentes ("Nombre Apellidos · Rol"), opción "Asignarme a mí" destacada; fecha/hora de solo lectura.
3. Estudiantes (opcional): StudentPicker con tope = `cupos` (fallback 5 si `cupos` no numérico, avisando).
Revisión antes de guardar. Guardar: botón con loading; `POST Tutoria` → si hay estudiantes `POST …/estudiantes`; éxito → toast + navegar a `/mis-tutorias/:id`; fallo parcial → toast de aviso + detalle con el StudentPicker abierto; 409 horario ocupado → mensaje y volver a la agenda. Cancelar con ConfirmDialog si hay cambios; aviso `beforeunload` con datos sin guardar. Horario inexistente o no disponible → ErrorState "Este horario ya no está disponible".

**`/mis-tutorias` (D3/T1).** PageHeader "Mis tutorías" + contador. Docente: control segmentado **Todas · Asignadas a mí · Agendadas por mí** (si R1 no está listo, solo "Asignadas a mí" con aviso). Lista/tabla: tema, idioma · nivel, fecha y hora, espacio, modalidad, N estudiantes, StatusBadge, etiqueta de relación. Acciones por fila: "Ver detalle", "Finalizar" (si pendiente y permitido). Vacío por rol (Docente: enlace a Agenda; Tutor: "Cuando te asignen una tutoría aparecerá aquí").

**`/mis-tutorias/:id` (D4/T2/D5).** Cabecera con tema y StatusBadge; ficha (idioma, nivel, modalidad, fecha, hora, espacio, tutor asignado, agendada por — R6); bloque Cupos "X de Y ocupados" con barra; lista de estudiantes (nombre, correo; vacío "Aún no hay estudiantes"). Acciones: "Agregar estudiantes" (Docente con permiso; abre Modal con StudentPicker excluyendo asignados; 409 cupo → mensaje; recarga la lista al guardar) y "Calificar y finalizar" (si pendiente). 403 → ErrorState "No tienes acceso a esta tutoría"; 404 → "La tutoría no existe".

**`/mis-tutorias/:id/finalizar` (D6/T3).** Resumen (tema, idioma - nivel, fecha). RatingInput (requerido, 1–5) y Comentario (opcional, ≤ 300 con contador). Texto informativo: "Al finalizar, se enviará la encuesta de satisfacción a los estudiantes." Envío: `POST Retroalimentacion` (usuarioId = yo) → `PUT …/finalizar`. Si el segundo falla: estado "Retroalimentación guardada, falta finalizar" con botón "Reintentar finalizar" (no repite el POST). 400 "ya está finalizada" → mensaje y enlace al historial. Éxito → toast y `/historial/:id`. Con R8: una sola llamada.

**`/historial` y `/historial/:id` (D7/D8/T4).** Lista de finalizadas (grupo R7; Docente con el mismo segmentado). Detalle de solo lectura: ficha + estudiantes (+ retroalimentación si R10).

### 4.9 Funcionalidades web existentes: se mantienen / cambian

| Funcionalidad | Decisión | Impacto |
|---|---|---|
| Login | Cambia: 4 roles, mensajes por status, redirección por rol, sesión persistente | Afecta a todos; Admin/Aux ya no pierden sesión al recargar |
| Sidebar | Cambia: menú por rol, responsive, ConfirmDialog | Visual igual en escritorio |
| `DataContext` | Se mantiene para gestión, montado tras auth; correcciones W5/W6 | Admin/Aux: arreglo del vacío post-login con JWT |
| Dashboard, Horarios, Agendar (gestión), Usuarios, Tutorías finalizadas | Se mantienen | Solo cambia el manejo de errores (toasts, 403/409) y `alert/confirm` → componentes; Usuarios oculta acciones no permitidas al Auxiliar |
| Modales de gestión | Se mantienen; se migran al `Modal` accesible de forma progresiva (misma apariencia) | Sin cambio funcional |
| Encuesta pública | Se mantiene; sin `Authorization`, sin `alert`, usando tokens de color (hoy usa colores fijos, se ve mal en modo oscuro) | Bajo |
| `apiService.js` | Refactor interno (cliente + ApiError + 401/403); misma API de servicios | Medio; se prueba con todas las vistas |
| `App.css`/`app.css` | Unificar nombre | Arregla build en Linux |

### 4.10 Fases de implementación (Fase 3 del protocolo)

| Fase | Contenido | Depende de Dante |
|---|---|---|
| F1 Fundaciones | apiClient + ApiError, AuthContext nuevo, RequireAuth/RequireRole, AppShell responsive, ui base (Modal, ConfirmDialog, Toast, estados, StatusBadge, Button, FormField), fix W2/W4/W7 | No |
| F2 Tutor | `/mis-tutorias`, detalle, finalizar, historial | No (funciona con lo existente; R2/R3/R7 lo endurecen) |
| F3 Docente | `/agenda`, asistente, detalle con agregar estudiantes, "Asignadas a mí" | No para lo básico |
| F4 Docente completo | "Agendadas por mí", cupos reales, permisos por dueño | **Sí: R1, R6** (y R5) |
| F5 Gestión | W5, W6, Auxiliar en Usuarios, alert/confirm → toasts/diálogos, 403/409 | No |
| F6 Verificación | E2E por rol, axe, responsive 375/768/1280, revisión contra backend real | R11 |

Hasta que existan R1/R6 no se usarán mocks silenciosos: la pestaña "Agendadas por mí" quedará oculta tras un flag (`VITE_FEATURE_AGENDADAS`) y se documentará.

---

## 5. Plan de pruebas E2E por rol

**Herramienta:** Playwright (`@playwright/test`, devDependency nueva y justificada: no hay ningún test en el repo; permite multi-rol con `storageState`, emulación móvil e inspección de red). Opcional `@axe-core/playwright` para accesibilidad automática.

**Entorno:** backend `feature/jwt-auth` contra una BD de pruebas con el seed de R11; web con `vite preview`; usuarios `admin`, `auxiliar`, `docente1`, `docente2`, `tutor1`, `tutor2`, `estudiante1` (credenciales en un `.env.e2e` no versionado). Proyectos Playwright: `desktop` (1280×800) y `mobile` (375×812) para los casos marcados (M).

### 5.1 Transversales (todos los roles)

| Id | Caso | Resultado esperado |
|---|---|---|
| X1 | Login correcto de cada rol | Redirige a su home; menú correcto; `localStorage` con `token`, `expiresAt`, `usuario` |
| X2 | Credenciales erróneas | "Correo o contraseña incorrectos" (401); sin sesión |
| X3 | Login de Estudiante | "Tu cuenta no tiene acceso a CDITutorPro" (403) |
| X4 | 11 intentos en 1 min | Mensaje 429 con cuenta atrás; botón deshabilitado |
| X5 | Recargar con sesión válida | Llama `GET Auth/me`, sigue autenticado en la misma ruta |
| X6 | Token caducado/manipulado en storage | `Auth/me` 401 → login con "Tu sesión ha expirado" y `redirect` |
| X7 | 401 en mitad de uso (token invalidado en el servidor o reloj adelantado) | Un único logout + redirección; vuelve a la ruta tras re-login |
| X8 | Logout con ConfirmDialog (teclado: Tab/Enter/Esc) | Sesión borrada; otras pestañas también salen |
| X9 | Ruta de otro rol por URL directa | Página "No tienes acceso" con enlace a su home; ninguna petición GestionWeb disparada |
| X10 (M) | Shell móvil: abrir/cerrar drawer, foco atrapado, Esc, navegar cierra | Sin scroll horizontal; objetivos ≥ 44 px |
| X11 | Navegación por teclado completa en cada vista nueva; "Saltar al contenido" | Foco visible y orden lógico; foco al `h1` al cambiar de ruta |
| X12 | axe sin violaciones serias/críticas en cada vista nueva (claro y oscuro) | 0 serious/critical |
| X13 | Consola sin errores; ninguna petición registra cabeceras `Authorization` en consola | Limpio |
| X14 | Encuesta pública con token válido / usado / inválido, sin sesión y con sesión caducada | Sin cabecera `Authorization` en esas peticiones; estados correctos |

### 5.2 Docente

| Id | Caso | Verificación |
|---|---|---|
| D-E1 | `/agenda` lista solo horarios propios disponibles (incluye `Libre`), agrupados; contador "N (M fechas)" | Petición `GET Horario/usuario/{miId}`; no aparece `Ocupado` |
| D-E2 | Búsqueda por título, espacio y fecha; sin resultados | Estado vacío de búsqueda |
| D-E3 | Expandir grupo recurrente (exclusivo) y agendar una ocurrencia | Navega a `/agenda/:id/agendar` con el horario correcto |
| D-E4 | Paso 1 validaciones: campos vacíos, sin modalidad, > 45 caracteres | Errores inline anunciados; no avanza |
| D-E5 | Paso 2: sin tutor → error; seleccionar Tutor; "Asignarme a mí" | Fecha/hora = las del horario |
| D-E6 | Paso 3: tope = `cupos` del horario; intentar superar | Selección deshabilitada con explicación |
| D-E7 | Guardar sin estudiantes | `POST Tutoria` con `estado:"Pendiente"`, `fechaTutoria` = fecha+hora del horario, `usuarioId` = tutor; horario desaparece de la agenda |
| D-E8 | Guardar con estudiantes | `POST Tutoria` + `POST …/estudiantes`; detalle muestra los estudiantes |
| D-E9 | Fallo al asignar estudiantes (forzado) | Aviso de éxito parcial; detalle con selector para reintentar |
| D-E10 | Horario ocupado por otro entre la carga y el guardado (con R4) | 409 → mensaje y vuelta a la agenda |
| D-E11 | Cancelar el asistente con cambios | ConfirmDialog; sin petición |
| D-E12 | `/mis-tutorias` "Asignadas a mí" | `GET Tutoria/estado/Pendiente/usuario/{miId}` |
| D-E13 | "Agendadas por mí" (con R1): tutoría agendada para `tutor1` aparece con etiqueta | Endpoint R1; deduplicación cuando el docente se asignó a sí mismo |
| D-E14 | Detalle: ficha, cupos "X de Y", estudiantes | `GET Tutoria/{id}` + `…/estudiantes` |
| D-E15 | Agregar estudiantes: excluye asignados; tope; guardar | Lista actualizada; 409 de cupo mostrado (con R5) |
| D-E16 | Finalizar: calificación requerida, comentario opcional/≤ 300 | `POST Retroalimentacion` (usuarioId = yo) + `PUT finalizar`; **no** llama `Encuesta/enviar`; pasa a historial |
| D-E17 | Fallo de `finalizar` tras crear retro | "Reintentar finalizar" no repite el POST |
| D-E18 | Finalizar una ya finalizada (doble pestaña) | Mensaje 400 del servidor |
| D-E19 | `/historial` y detalle de solo lectura | Sin acciones |
| D-E20 | `docente2` abre `/mis-tutorias/<id de docente1>` (con R2) | "No tienes acceso a esta tutoría" (403) |
| D-E21 (M) | D-E3, D-E8 y D-E16 en móvil | Usable sin zoom ni scroll horizontal |

### 5.3 Tutor

| Id | Caso | Verificación |
|---|---|---|
| T-E1 | Home = `/mis-tutorias` con pendientes asignadas; vacío correcto | `GET Tutoria/estado/Pendiente/usuario/{miId}` |
| T-E2 | Menú sin Agenda; `/agenda` por URL → sin acceso | Ninguna petición de horarios |
| T-E3 | Detalle sin "Agregar estudiantes" | Botón ausente |
| T-E4 | Calificar y finalizar (como D-E16/D-E17) | Igual |
| T-E5 | Historial y detalle | `estado/Finalizada` (o grupo R7) |
| T-E6 | `tutor2` abre tutoría de `tutor1` (con R2) | 403 mostrado |
| T-E7 | Tutoría del seed en estado `Programada`/`Completada` (con R7) | Aparece en la lista correcta con el badge correcto |
| T-E8 (M) | T-E1 y T-E4 en móvil | OK |

### 5.4 Administrador y Auxiliar (regresión)

| Id | Caso | Verificación |
|---|---|---|
| G-E1 | Dashboard carga datos tras el login (fix W2) | `GET Metricas/*`, `GET Usuario/Horario/Tutoria` con 200; sin 401 previos |
| G-E2 | Horarios: crear, editar, borrar; borrar con tutorías | 409 mostrado como mensaje |
| G-E3 | Agendar (gestión): `usuarioId` es siempre docente/tutor (fix W5) | Cuerpo del `POST Tutoria` |
| G-E4 | Usuarios: editar estudiante sin tocar contraseña (fix W6) | El cuerpo del `PUT Usuario/{id}` no incluye `contrasena` (que el hash no cambie se verifica con un test de backend) |
| G-E5 | Auxiliar: no ve acciones de crear/editar/borrar Docentes; si fuerza la petición → mensaje 403 | UI + mensaje |
| G-E6 | Tutorías finalizadas: retro, encuestas, Excel con nombre de archivo correcto | Descarga |
| G-E7 | Admin/Aux por URL a `/mis-tutorias` o `/agenda` | Sin acceso (rutas personales no son de gestión) |

### 5.5 Criterios de salida de la migración

Todos los casos D-E*, T-E*, X* y G-E* en verde contra el backend real (los que dependen de R1/R2/R4/R5/R7 marcados como bloqueados hasta que Dante los entregue); build en Linux (CI) sin errores; 0 violaciones axe serias; verificación manual en 375/768/1280 en claro y oscuro; checklist de paridad MAUI (§1.3–1.4) revisado pantalla por pantalla.

---

## 6. Preguntas abiertas para el usuario

1. **Q1 — Dueño de la tutoría para el Docente:** ¿confirmas que "tutorías que agendé" = tutorías en **mis horarios** (dueño del `Horario`)? No existe otro registro de quién agendó.
2. **Q2 — Permisos del Tutor:** MAUI no le permite agendar ni agregar estudiantes. ¿Se mantiene así (y se bloquea también en backend), o el Tutor debe poder hacerlo en la web?
3. **Q3 — Modalidad:** ¿selección única (Virtual/Presencial/Híbrido, como la web actual) o múltiple como MAUI? Recomiendo única.
4. **Q4 — Calificación:** ¿1–5 con medios puntos (recomendado), solo enteros (estrellas), o continuo como el slider de MAUI?
5. **Q5 — Cupos:** ¿`cupos` = máximo de estudiantes por tutoría en ese horario? ¿Debe el backend rechazar asignaciones que lo superen?
6. **Q6 — Quién finaliza:** ¿puede finalizar el Docente dueño del horario aunque la tutoría esté asignada a un Tutor, o solo quien la imparte?
7. **Q7 — Retroalimentaciones:** existe `pages/Retroalimentaciones.jsx` sin ruta. ¿Se enruta para Admin/Aux, se elimina o se deja?
8. **Q8 — Iconografía:** ¿se mantienen los emojis del menú (identidad actual) o se sustituyen por iconos SVG coherentes en una fase posterior?
9. **Q9 — Dependencias:** ¿aceptas añadir `@playwright/test` (y opcionalmente `@axe-core/playwright`)? ¿Prefieres TanStack Query para la capa de datos personal o un hook propio ligero (recomendado para no añadir dependencias)?
10. **Q10 — Admin/Aux y finalizar:** ¿deben Admin/Aux poder finalizar tutorías desde la web (hoy no pueden)? No es necesario para la paridad.
11. **Q11 — Copias `.cs` en `src/endpoints/`:** ¿autorizas eliminarlas en una PR separada?
12. **Q12 — Despliegue:** ¿dominio de producción de la web (para `Cors:AllowedOrigins` y `Encuesta:UrlBase`)?

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Sin R2/R3 el backend permite leer/finalizar/firmar tutorías ajenas; la web solo lo oculta | Priorizar R2/R3 antes de retirar MAUI |
| Sin R1 la paridad mejorada del Docente (agendadas) no es posible | Fase F4 condicionada; flag de funcionalidad |
| Estados con sinónimos ocultan tutorías del seed en filtros exactos | R7 o unión en cliente |
| Token en `localStorage` expuesto a XSS | Higiene XSS + CSP; propuesta futura de cookie httpOnly |
| Refactor de `apiService`/`DataContext` puede romper vistas de gestión | Mantener API pública de servicios; regresión G-E* |
| Sin refresh token: expulsión a las 8 h en mitad de un formulario | Aviso previo y conservación del borrador del formulario de finalizar en `sessionStorage` |

---

## 8. Decisiones tomadas tras la Fase 1 (2026-11-11)

**Decididas por el usuario**

| Tema | Decisión | Efecto en la web |
|---|---|---|
| Propiedad (Q1/Q6) | "Docente dueño + Tutor asignado": el Docente ve y gestiona todas las tutorías de sus horarios (aunque las imparta un Tutor) y puede finalizarlas; el Tutor solo las asignadas. Nadie toca tutorías ajenas | `permisosTutoria()` en `src/features/tutorias/tutorias.js`. El listado "Agendadas por mí" queda tras `VITE_FEATURE_AGENDADAS` hasta R1 |
| Rol Tutor (Q2) | Igual que MAUI: ve y finaliza sus asignadas; no agenda ni agrega estudiantes | Sin rutas `/agenda`; sin botón "Agregar estudiantes" |
| Cupos (Q5) | Máximo de estudiantes de la tutoría de ese horario; el backend rechaza el exceso; la web muestra "X de Y" | Tope en asistente y en "Agregar estudiantes"; medidor en el detalle |
| Tests (Q9) | Playwright + axe | `@playwright/test`, `@axe-core/playwright` (devDependencies), `e2e/` |

**Valores por defecto fijados por el coordinador (no los decidió el usuario)**

| Tema | Valor por defecto |
|---|---|
| Q3 Modalidad | Selección única (Virtual / Presencial / Híbrido) |
| Q4 Calificación | 1–5 con medios puntos (`input range` paso 0,5) |
| Q7 Retroalimentaciones.jsx | Se deja como está (sin ruta) |
| Q8 Iconos | SVG inline propios (`src/components/ui/Icon.jsx`) en la shell y vistas nuevas; sin dependencias |
| Q10 Admin/Aux finalizan | Sí, sin restricción de propiedad (ruta compartida `/tutorias/:id/finalizar`, enlace desde el modal de detalle de gestión) |
| Q11 `src/endpoints/` | No se borra todavía |
| Q12 Dominio | Desconocido: se trabaja con `http://localhost:5173` (dev) y `http://localhost:4173` (preview/E2E) |

**Ajustes de implementación respecto al plan**

- Shell: sidebar fija ≥ 1024 px y drawer por debajo (incluida tablet 768 px), en lugar del raíl de iconos; deja más ancho a las vistas de gestión.
- La ruta de finalizar es `/tutorias/:id/finalizar` (compartida por los 4 roles) en lugar de `/mis-tutorias/:id/finalizar`.
- El Docente obtiene cupos y propiedad de una tutoría cruzando `tutoria.horarioId` con `GET Horario/usuario/{miId}` (endpoint existente) mientras no exista R6.

## 9. F4 e integración real (2026-11-11)

- Contrato fase 2 de Dante (R1–R11) integrado: "Mis tutorías" del Docente = `estado/{grupo}/usuario/{miId}` ∪ `agendadas/usuario/{miId}?estado={grupo}` (deduplicado); el Tutor solo usa el primero. Se eliminó el flag `VITE_FEATURE_AGENDADAS` y el banner provisional.
- Permisos por `horarioUsuarioId`; cupos desde `horarioCupos` (`null` = sin límite).
- Asistente: `POST /Tutoria` atómico con `estudianteIds`. Finalizar: `PUT /Tutoria/{id}/finalizar` con `{ calificacion, comentario }` atómico; ante 409 se ofrece "Finalizar sin calificar".
- Detalle: "Agendada por", quitar estudiante (Docente participante / gestión) con confirmación, calificación registrada en tutorías finalizadas (`GET Retroalimentacion/tutoria/{id}`).
- Gestión: validación de cupos 1–1000 en el formulario de horarios.
- E2E: 58 pruebas pasadas en 1280/768/375 contra el backend real (7 saltadas: Auxiliar sin credenciales).

## 10. Configuración, Auxiliar y revisión visual con datos de demostración (2026-11-11)

- Nueva ruta `/configuracion` para los 4 roles: Mi cuenta (`GET /Auth/me`), Cambiar contraseña (`PUT /Auth/contrasena`, requisitos en vivo, confirmación solo en cliente, errores por campo, 429 en minutos) y Apariencia (tema).
- Auxiliar (cuenta real) cubierto por E2E: gestión web, solo Estudiantes, 403 con mensaje si fuerza personal, finaliza tutorías, Configuración.
- Correcciones visuales con datos reales: columnas del calendario mensual que se deformaban con etiquetas largas (y contraste de etiquetas), cabecera del calendario desbordando en móvil, KPIs del Dashboard (horarios disponibles contaba todos, "docentes" incluía administradores, fecha "hoy" en UTC), gráfico de estados como donut con leyenda con cantidades, franja de métricas en móvil, insignia de rol real en Usuarios, calificación por sesión en el historial personal, filtro segmentado compacto en móvil, iniciales sin símbolos, contraste del filtro segmentado, anillo de foco en títulos al navegar.
