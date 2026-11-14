import React, { useEffect, useId, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { encuestaService } from '../services/apiService'
import { useToast } from '../components/ui/Feedback'
import Icon from '../components/ui/Icon'
import Logo from '../components/ui/Logo'
import Stars from '../components/ui/Stars'
import './EncuestaPage.css'

const ETIQUETAS = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente']
const MAX_COMENTARIO = 300

/** Selector de 1 a 5 estrellas: grupo de radios nativos (teclado con flechas, lector de pantalla). */
const SelectorEstrellas = ({ value, onChange, name }) => {
  const [hover, setHover] = useState(0)
  const activo = hover || value
  return (
    <fieldset className="survey-rating" onMouseLeave={() => setHover(0)}>
      <legend className="survey-rating__legend">Calificación de la tutoría</legend>
      <div className="survey-rating__stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`survey-star${n <= activo ? ' is-on' : ''}`} onMouseEnter={() => setHover(n)}>
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
            />
            <Icon name="star" size={40} fill={n <= activo ? 'currentColor' : 'none'} />
            <span className="sr-only">{n} de 5: {ETIQUETAS[n]}</span>
          </label>
        ))}
      </div>
      <p className="survey-rating__label" aria-live="polite">
        {value > 0 ? ETIQUETAS[value] : 'Selecciona una calificación'}
      </p>
    </fieldset>
  )
}

const Resultado = ({ tone, icon, title, children }) => (
  <div className={`survey-result survey-result--${tone}`}>
    <span className="survey-result__icon" aria-hidden="true"><Icon name={icon} size={32} /></span>
    <h1 className="survey-result__title">{title}</h1>
    {children}
  </div>
)

export default function EncuestaPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const toast = useToast()
  const nombreRadio = useId()
  const comentarioId = useId()

  const [estado, setEstado] = useState('cargando') // cargando | valido | respondida | error | enviado
  const [errorMsg, setErrorMsg] = useState('')
  const [encuestaInfo, setEncuestaInfo] = useState(null)
  const [calificacion, setCalificacion] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!token) {
      setEstado('error')
      setErrorMsg('Enlace inválido. No se encontró el token de la encuesta.')
      return
    }
    verificarToken()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleEnviar = async (e) => {
    e.preventDefault()
    if (calificacion === 0) {
      toast.warning('Selecciona una calificación antes de enviar.')
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
        toast.error('No se pudo enviar tu respuesta. Inténtalo de nuevo.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="survey-page">
      <main className="survey-card">
        <header className="survey-head">
          <Logo size={48} layout="column" tagline="Corporación Universitaria del Caribe" />
        </header>

        {estado === 'cargando' && (
          <p className="survey-loading" role="status">
            <span className="spinner" aria-hidden="true"><span /></span> Cargando encuesta…
          </p>
        )}

        {estado === 'error' && (
          <Resultado tone="error" icon="alert" title="Enlace inválido">
            <p>{errorMsg}</p>
          </Resultado>
        )}

        {estado === 'respondida' && (
          <Resultado tone="success" icon="checkCircle" title="Ya respondiste esta encuesta">
            <p>Tu respuesta ya fue registrada anteriormente. ¡Gracias!</p>
          </Resultado>
        )}

        {estado === 'enviado' && (
          <Resultado tone="success" icon="checkCircle" title="¡Gracias por tu respuesta!">
            <p>Tu opinión nos ayuda a mejorar la calidad de las tutorías.</p>
            <p className="survey-result__summary">
              Tu calificación: <Stars value={calificacion} size={18} label={`${calificacion} de 5`} />{' '}
              <strong>{ETIQUETAS[calificacion]}</strong>
            </p>
          </Resultado>
        )}

        {estado === 'valido' && (
          <form className="survey-form" onSubmit={handleEnviar} noValidate>
            <h1 className="survey-title">Encuesta de satisfacción</h1>
            <p className="survey-intro">
              Hola <strong>{encuestaInfo?.estudianteNombre}</strong>, ¿cómo fue tu experiencia en la tutoría?
            </p>

            <SelectorEstrellas value={calificacion} onChange={setCalificacion} name={nombreRadio} />

            <div className="field survey-comment">
              <label className="field__label" htmlFor={comentarioId}>Comentario (opcional)</label>
              <textarea
                id={comentarioId}
                className="textarea"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="¿Tienes algo que quieras compartir sobre la tutoría?"
                maxLength={MAX_COMENTARIO}
                rows={4}
              />
              <p className="field__counter">{comentario.length}/{MAX_COMENTARIO}</p>
            </div>

            <button type="submit" className="btn btn--primary btn--block" disabled={enviando || calificacion === 0}>
              {enviando ? 'Enviando…' : 'Enviar respuesta'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
