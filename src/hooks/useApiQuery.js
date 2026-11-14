import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Lectura de datos con estados explícitos, cancelación al desmontar/cambiar deps
 * y revalidación al volver a la pestaña (equivalente al OnAppearing de MAUI).
 *
 * @param {(signal: AbortSignal) => Promise<any>} fetcher
 * @param {any[]} deps
 * @param {{ enabled?: boolean, revalidateOnFocus?: boolean }} options
 */
export const useApiQuery = (fetcher, deps = [], { enabled = true, revalidateOnFocus = true } = {}) => {
  const [state, setState] = useState({ status: enabled ? 'loading' : 'idle', data: undefined, error: null })
  const controllerRef = useRef(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = useCallback(
    async ({ silent = false } = {}) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      if (!silent) setState((s) => ({ ...s, status: 'loading', error: null }))
      try {
        const data = await fetcherRef.current(controller.signal)
        if (!controller.signal.aborted) setState({ status: 'success', data, error: null })
        return data
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) return undefined
        setState((s) => ({ status: silent && s.data !== undefined ? 'success' : 'error', data: s.data, error }))
        return undefined
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  )

  useEffect(() => {
    if (!enabled) return undefined
    run()
    return () => controllerRef.current?.abort()
  }, [run, enabled])

  useEffect(() => {
    if (!enabled || !revalidateOnFocus) return undefined
    const onVisible = () => {
      if (document.visibilityState === 'visible') run({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [run, enabled, revalidateOnFocus])

  return {
    ...state,
    isLoading: state.status === 'loading',
    isError: state.status === 'error',
    refetch: run,
    setData: (updater) =>
      setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })),
  }
}

export default useApiQuery
