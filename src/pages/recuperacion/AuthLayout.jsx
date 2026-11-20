import React, { useEffect, useState } from 'react'
import { useTheme } from '../../context/ThemeContext'
import Icon from '../../components/ui/Icon'
import cdiLogo from '../../img/cdi-logo-2022.png'
import '../Login.css'
import './Recuperacion.css'

/** Marco de las páginas públicas de acceso: mismo fondo, logo y tarjeta que el login. */
const AuthLayout = ({ titulo, subtitulo, children }) => {
  const { theme, toggleTheme } = useTheme()
  return (
    <div className="login-container">
      <button type="button" className="theme-toggle theme-toggle-floating" onClick={toggleTheme}>
        <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
        <span>{theme === 'light' ? 'Modo oscuro' : 'Modo claro'}</span>
      </button>
      <main className="login-card auth-card">
        <div className="login-header auth-header">
          <img src={cdiLogo} alt="CDI · Centro de Idiomas · CECAR" className="cdi-logo" width="292" height="63" decoding="async" />
          <h1 className="auth-title">{titulo}</h1>
          {subtitulo && <p>{subtitulo}</p>}
        </div>
        {children}
        <div className="login-footer">
          <p><span className="brand__cdi">CDI</span>TutorPro · Centro de Idiomas · Corporación Universitaria del Caribe – CECAR</p>
        </div>
      </main>
    </div>
  )
}

export default AuthLayout

/** «12 s», «4:05 min» para las cuentas atrás de un 429. */
export const formatoEspera = (s) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`)

/** Cuenta atrás en segundos; el setter la (re)arranca. */
export const useCuentaAtras = () => {
  const [seg, setSeg] = useState(0)
  useEffect(() => {
    if (seg <= 0) return undefined
    const id = setTimeout(() => setSeg((v) => v - 1), 1000)
    return () => clearTimeout(id)
  }, [seg])
  return [seg, setSeg]
}
