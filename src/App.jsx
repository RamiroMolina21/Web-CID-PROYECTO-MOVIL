import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { FeedbackProvider } from './components/ui/Feedback'
import AppShell from './components/layout/AppShell'
import { RequireAuth, RequireRole, DataScope, RoleHome, NotFound, Splash } from './routes/guards'
import { GESTION, PERSONAL, TODOS, ROLES } from './lib/roles'
import Login from './pages/Login'
import './app.css'

// Gestión (Administrador/Auxiliar)
const Horarios = lazy(() => import('./pages/Horarios'))
const AgendarTutoria = lazy(() => import('./pages/AgendarTutoria'))
const Estudiantes = lazy(() => import('./pages/Estudiantes'))
const TutoriasFinalizadas = lazy(() => import('./pages/TutoriasFinalizadas'))
// Público
const EncuestaPage = lazy(() => import('./pages/EncuestaPage'))
// Personal (Docente/Tutor) — equivalencia con la app MAUI
const Agenda = lazy(() => import('./pages/personal/Agenda'))
const AgendarWizard = lazy(() => import('./pages/personal/AgendarWizard'))
const MisTutorias = lazy(() => import('./pages/personal/MisTutorias'))
const TutoriaDetalle = lazy(() => import('./pages/personal/TutoriaDetalle'))
const FinalizarTutoria = lazy(() => import('./pages/personal/FinalizarTutoria'))
const Configuracion = lazy(() => import('./pages/Configuracion'))
const OlvideContrasena = lazy(() => import('./pages/recuperacion/OlvideContrasena'))
const RestablecerContrasena = lazy(() => import('./pages/recuperacion/RestablecerContrasena'))

const PageFallback = () => <Splash label="Cargando…" />

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <FeedbackProvider>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/encuesta" element={<EncuestaPage />} />
                <Route path="/olvide-contrasena" element={<OlvideContrasena />} />
                <Route path="/restablecer-contrasena" element={<RestablecerContrasena />} />

                <Route element={<RequireAuth />}>
                  <Route element={<AppShell />}>
                    <Route element={<DataScope />}>
                      <Route index element={<RoleHome />} />

                      <Route element={<RequireRole roles={GESTION} />}>
                        <Route path="horarios" element={<Horarios />} />
                        <Route path="agendar-tutoria" element={<AgendarTutoria />} />
                        <Route path="estudiantes" element={<Estudiantes />} />
                        <Route path="tutorias-finalizadas" element={<TutoriasFinalizadas />} />
                      </Route>

                      <Route element={<RequireRole roles={[ROLES.DOCENTE]} />}>
                        <Route path="agenda" element={<Agenda />} />
                        <Route path="agenda/:horarioId/agendar" element={<AgendarWizard />} />
                      </Route>

                      <Route element={<RequireRole roles={PERSONAL} />}>
                        <Route path="mis-tutorias" element={<MisTutorias grupo="pendiente" />} />
                        <Route path="mis-tutorias/:id" element={<TutoriaDetalle />} />
                        <Route path="historial" element={<MisTutorias grupo="finalizada" />} />
                        <Route path="historial/:id" element={<TutoriaDetalle soloLectura />} />
                      </Route>

                      <Route element={<RequireRole roles={TODOS} />}>
                        <Route path="tutorias/:id/finalizar" element={<FinalizarTutoria />} />
                        <Route path="configuracion" element={<Configuracion />} />
                      </Route>

                      <Route path="*" element={<NotFound />} />
                    </Route>
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </FeedbackProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  )
}

export default App
