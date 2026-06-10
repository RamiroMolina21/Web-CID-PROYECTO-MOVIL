import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Horarios from './pages/Horarios'
import AgendarTutoria from './pages/AgendarTutoria'
import Estudiantes from './pages/Estudiantes'
import TutoriasFinalizadas from './pages/TutoriasFinalizadas'
import Login from './pages/Login'
import EncuestaPage from './pages/EncuestaPage'
import ProtectedRoute from './components/ProtectedRoute'
import { DataProvider } from './context/DataContext'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import './App.css'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/encuesta" element={<EncuestaPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="app-container">
                    <Sidebar />
                    <main className="main-content">
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/horarios" element={<Horarios />} />
                        <Route path="/agendar-tutoria" element={<AgendarTutoria />} />
                        <Route path="/estudiantes" element={<Estudiantes />} />
                        <Route path="/tutorias-finalizadas" element={<TutoriasFinalizadas />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </main>
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
          </Router>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App

