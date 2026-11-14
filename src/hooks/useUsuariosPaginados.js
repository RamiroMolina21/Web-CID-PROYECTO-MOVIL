import { useCallback, useEffect, useRef, useState } from 'react'
import { usuarioService } from '../services/apiService'

/**
 * Lista de usuarios paginada en el servidor (GET /Usuario?page&pageSize&q&rol&activo + X-Total-Count).
 * - Cambiar filtros reinicia en la página 1 y cancela la petición anterior (AbortController).
 * - `cargarMas` pide la página siguiente y la añade; nunca hay dos peticiones de página en vuelo.
 */
export const useUsuariosPaginados = ({ q, rol, activo, pageSize = 20 }) => {
  const [state, setState] = useState({ items: [], total: 0, page: 0, status: 'loading', error: null, cargandoMas: false })
  const controllerRef = useRef(null)
  const enVueloRef = useRef(false)
  const filtrosRef = useRef({ q, rol, activo })
  filtrosRef.current = { q, rol, activo }

  const pedir = useCallback(
    async (page, { reemplazar }) => {
      if (!reemplazar && enVueloRef.current) return
      if (reemplazar) controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      enVueloRef.current = true
      setState((s) => (reemplazar ? { ...s, status: s.page ? 'refreshing' : 'loading', error: null } : { ...s, cargandoMas: true, error: null }))
      try {
        const { items, total } = await usuarioService.buscar({ ...filtrosRef.current, page, pageSize }, controller.signal)
        if (controller.signal.aborted) return
        setState((s) => ({
          items: reemplazar ? items : [...s.items, ...items.filter((u) => !s.items.some((x) => x.idUsuario === u.idUsuario))],
          total,
          page,
          status: 'ready',
          error: null,
          cargandoMas: false,
        }))
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) return
        setState((s) => ({ ...s, status: s.page && !reemplazar ? 'ready' : 'error', error, cargandoMas: false }))
      } finally {
        if (controllerRef.current === controller) enVueloRef.current = false
      }
    },
    [pageSize]
  )

  const recargar = useCallback(() => pedir(1, { reemplazar: true }), [pedir])

  useEffect(() => {
    recargar()
    return () => controllerRef.current?.abort()
  }, [q, rol, activo, recargar])

  const hayMas = state.items.length < state.total
  const cargarMas = useCallback(() => {
    if (hayMas && state.status === 'ready') pedir(state.page + 1, { reemplazar: false })
  }, [hayMas, pedir, state.page, state.status])

  /** Actualiza un usuario en la lista (p. ej. tras PATCH estado) o lo quita si ya no cumple el filtro. */
  const actualizar = useCallback((usuario) => {
    setState((s) => {
      const f = filtrosRef.current
      const sigue = f.activo === undefined || f.activo === null || usuario.activo === f.activo
      return sigue
        ? { ...s, items: s.items.map((u) => (u.idUsuario === usuario.idUsuario ? usuario : u)) }
        : { ...s, items: s.items.filter((u) => u.idUsuario !== usuario.idUsuario), total: Math.max(0, s.total - 1) }
    })
  }, [])

  return { ...state, hayMas, cargarMas, recargar, actualizar }
}

/** Retrasa un valor (búsqueda mientras se escribe). */
export const useDebounced = (value, ms = 300) => {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

export default useUsuariosPaginados
