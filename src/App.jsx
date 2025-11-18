import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Horarios from './pages/Horarios'
import AgendarTutoria from './pages/AgendarTutoria'
import Estudiantes from './pages/Estudiantes'
import Retroalimentaciones from './pages/Retroalimentaciones'
import TutoriasFinalizadas from './pages/TutoriasFinalizadas'
import { DataProvider } from './context/DataContext'
import './App.css'

function App() {
  return (
    <DataProvider>
      <Router>
        <div className="app-container">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/horarios" element={<Horarios />} />
              <Route path="/agendar-tutoria" element={<AgendarTutoria />} />
              <Route path="/estudiantes" element={<Estudiantes />} />
              <Route path="/retroalimentaciones" element={<Retroalimentaciones />} />
              <Route path="/tutorias-finalizadas" element={<TutoriasFinalizadas />} />
            </Routes>
          </main>
        </div>
      </Router>
    </DataProvider>
  )
}

export default App

