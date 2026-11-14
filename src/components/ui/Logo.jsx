import React from 'react'

// Logo de TutorPro. Isotipo: las dos páginas de un libro abierto forman el travesaño de una "T"
// (Tutor) y el lomo baja como su asta. Misma geometría que public/favicon.svg (viewBox 32).
// La loseta usa --brand y el trazo --brand-contrast, así funciona en claro y oscuro.
export const LogoMark = ({ size = 40, className = '', title }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    className={`logo-mark ${className}`.trim()}
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
    focusable="false"
  >
    {title && <title>{title}</title>}
    <rect className="logo-mark__tile" width="32" height="32" rx="8" />
    <g className="logo-mark__glyph">
      <path d="M15.1 10.3C12.5 8.5 9.7 7.8 6.7 8 6.3 8.03 6 8.37 6 8.8V12.9C6 13.35 6.36 13.7 6.8 13.67 9.6 13.5 12.4 14.2 15.1 16Z" />
      <path d="M16.9 10.3C19.5 8.5 22.3 7.8 25.3 8 25.7 8.03 26 8.37 26 8.8V12.9C26 13.35 25.64 13.7 25.2 13.67 22.4 13.5 19.6 14.2 16.9 16Z" />
      <rect x="14.2" y="13" width="3.6" height="12" rx="1.8" />
    </g>
  </svg>
)

/**
 * Isotipo + logotipo. El nombre es texto real (accesible y nítido a cualquier tamaño).
 * `as` permite usarlo como encabezado (p. ej. h1 en el login).
 */
const Logo = ({ size = 40, tagline, as: Tag = 'span', className = '', layout = 'row' }) => (
  <Tag className={`brand brand--${layout} ${className}`.trim()}>
    <LogoMark size={size} />
    <span className="brand__text">
      <span className="brand__name">Tutor<span className="brand__pro">Pro</span></span>
      {tagline && <span className="brand__tagline">{tagline}</span>}
    </span>
  </Tag>
)

export default Logo
