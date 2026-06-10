import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { encuestaService } from '../services/apiService'

export default function EncuestaPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [estado, setEstado] = useState('cargando') // cargando | valido | respondida | error | enviado
  const [errorMsg, setErrorMsg] = useState('')
  const [encuestaInfo, setEncuestaInfo] = useState(null)
  const [calificacion, setCalificacion] = useState(0)
  const [hoveredStar, setHoveredStar] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!token) {
      setEstado('error')
      setErrorMsg('Enlace inválido. No se encontró el token de la encuesta.')
      return
    }
    verificarToken()
  }, [token])

  const verificarToken = async () => {
    try {
      const data = await encuestaService.verificarToken(token)
      setEncuestaInfo(data)
      setEstado('valido')
    } catch (err) {
      if (err.response?.status === 400) {
        setEstado('respondida')
      } else if (err.response?.status === 404) {
        setEstado('error')
        setErrorMsg('Este enlace no es válido o ha expirado.')
      } else {
        setEstado('error')
        setErrorMsg('No se pudo conectar con el servidor. Intenta más tarde.')
      }
    }
  }

  const handleEnviar = async () => {
    if (calificacion === 0) {
      alert('Por favor selecciona una calificación antes de enviar.')
      return
    }
    setEnviando(true)
    try {
      await encuestaService.responder({
        Token: token,
        Calificacion: calificacion,
        Comentario: comentario || null,
      })
      setEstado('enviado')
    } catch (err) {
      if (err.response?.status === 400) {
        setEstado('respondida')
      } else {
        alert('Ocurrió un error al enviar tu respuesta. Por favor intenta de nuevo.')
      }
    } finally {
      setEnviando(false)
    }
  }

  const renderEstrellas = () => {
    return [1, 2, 3, 4, 5].map((num) => (
      <button
        key={num}
        onClick={() => setCalificacion(num)}
        onMouseEnter={() => setHoveredStar(num)}
        onMouseLeave={() => setHoveredStar(0)}
        style={{
          fontSize: '42px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: num <= (hoveredStar || calificacion) ? '#f59e0b' : '#d1d5db',
          transition: 'color 0.15s',
          padding: '0 4px',
        }}
        title={`${num} estrella${num > 1 ? 's' : ''}`}
      >
        ★
      </button>
    ))
  }

  const labelCalificacion = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente']

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e8f0fe 0%, #f3f4f6 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '520px',
        width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        textAlign: 'center',
      }}>
        {/* Logo / Encabezado */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: '#1a73e8', margin: '0 auto 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px',
          }}>📋</div>
          <h1 style={{ color: '#1a73e8', margin: 0, fontSize: '22px' }}>Sistema de Tutorías</h1>
          <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '13px' }}>CECAR</p>
        </div>

        {/* Estado: Cargando */}
        {estado === 'cargando' && (
          <div>
            <p style={{ color: '#6b7280' }}>Cargando encuesta...</p>
          </div>
        )}

        {/* Estado: Error */}
        {estado === 'error' && (
          <div>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>❌</div>
            <h2 style={{ color: '#dc2626' }}>Enlace inválido</h2>
            <p style={{ color: '#6b7280' }}>{errorMsg}</p>
          </div>
        )}

        {/* Estado: Ya respondida */}
        {estado === 'respondida' && (
          <div>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <h2 style={{ color: '#16a34a' }}>Ya respondiste esta encuesta</h2>
            <p style={{ color: '#6b7280' }}>Tu respuesta ya fue registrada anteriormente. ¡Gracias!</p>
          </div>
        )}

        {/* Estado: Enviado exitosamente */}
        {estado === 'enviado' && (
          <div>
            <div style={{ fontSize: '56px', marginBottom: '12px' }}>🎉</div>
            <h2 style={{ color: '#16a34a' }}>¡Gracias por tu respuesta!</h2>
            <p style={{ color: '#6b7280' }}>
              Tu opinión nos ayuda a mejorar la calidad de las tutorías.
            </p>
            <div style={{
              background: '#f0fdf4', borderRadius: '8px', padding: '16px',
              marginTop: '20px', border: '1px solid #bbf7d0',
            }}>
              <p style={{ margin: 0, color: '#15803d', fontSize: '14px' }}>
                Tu calificación: {'★'.repeat(calificacion)}{'☆'.repeat(5 - calificacion)}
              </p>
            </div>
          </div>
        )}

        {/* Estado: Formulario válido */}
        {estado === 'valido' && (
          <div>
            <h2 style={{ color: '#111827', marginBottom: '6px' }}>Encuesta de Satisfacción</h2>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '28px' }}>
              Hola <strong>{encuestaInfo?.estudianteNombre}</strong>, ¿cómo fue tu experiencia en la tutoría?
            </p>

            {/* Estrellas */}
            <div style={{ marginBottom: '8px' }}>
              {renderEstrellas()}
            </div>
            <p style={{
              color: calificacion > 0 ? '#f59e0b' : '#9ca3af',
              fontWeight: 'bold', fontSize: '15px', marginBottom: '24px', minHeight: '22px',
            }}>
              {calificacion > 0 ? labelCalificacion[calificacion] : 'Selecciona una calificación'}
            </p>

            {/* Comentario */}
            <div style={{ textAlign: 'left', marginBottom: '24px' }}>
              <label style={{ color: '#374151', fontSize: '14px', fontWeight: 'bold' }}>
                Comentario (opcional)
              </label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="¿Tienes algo que quieras compartir sobre la tutoría?"
                maxLength={300}
                rows={4}
                style={{
                  width: '100%', marginTop: '8px', padding: '10px 12px',
                  border: '1px solid #d1d5db', borderRadius: '8px',
                  fontSize: '14px', resize: 'vertical', boxSizing: 'border-box',
                  fontFamily: 'Arial, sans-serif',
                }}
              />
              <p style={{ color: '#9ca3af', fontSize: '12px', textAlign: 'right', margin: '4px 0 0' }}>
                {comentario.length}/300
              </p>
            </div>

            {/* Botón enviar */}
            <button
              onClick={handleEnviar}
              disabled={enviando || calificacion === 0}
              style={{
                width: '100%', padding: '14px',
                background: calificacion === 0 ? '#9ca3af' : '#1a73e8',
                color: 'white', border: 'none', borderRadius: '8px',
                fontSize: '16px', fontWeight: 'bold', cursor: calificacion === 0 ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {enviando ? 'Enviando...' : 'Enviar respuesta'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
