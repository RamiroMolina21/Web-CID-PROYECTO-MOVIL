import React from 'react'

// Marca de CDITutorPro (Centro de Idiomas CDI · CECAR).
// Isotipo propio y coherente con el logo institucional: loseta en rojo CDI con la burbuja de diálogo "…"
// del logo del Centro de Idiomas. No reproduce ni deforma el logo oficial (ese se usa tal cual en el login).
// Misma geometría que public/favicon.svg (viewBox 32).
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
    <path className="logo-mark__glyph" d="M16 6.5c-5.8 0-10.5 3.9-10.5 8.8 0 2.6 1.3 4.9 3.4 6.5l-1 4.2c-.1.5.4.9.9.6l4.6-2.6c.8.2 1.7.2 2.6.2 5.8 0 10.5-3.9 10.5-8.9S21.8 6.5 16 6.5Z" />
    <g className="logo-mark__dots">
      <circle cx="11.2" cy="15.3" r="1.6" />
      <circle cx="16" cy="15.3" r="1.6" />
      <circle cx="20.8" cy="15.3" r="1.6" />
    </g>
  </svg>
)

/**
 * Isotipo + logotipo "CDITutorPro" (texto real, accesible y nítido). "CDI" en el rojo institucional.
 * `as` permite usarlo como encabezado.
 */
const Logo = ({ size = 40, tagline, as: Tag = 'span', className = '', layout = 'row' }) => (
  <Tag className={`brand brand--${layout} ${className}`.trim()}>
    <LogoMark size={size} />
    <span className="brand__text">
      <span className="brand__name"><span className="brand__cdi">CDI</span>TutorPro</span>
      {tagline && <span className="brand__tagline">{tagline}</span>}
    </span>
  </Tag>
)

export default Logo
