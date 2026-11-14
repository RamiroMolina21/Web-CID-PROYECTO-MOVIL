// Limpia restos [PRUEBA] de ejecuciones anteriores antes de empezar.
import teardown from './global-teardown'

export default async function globalSetup() {
  await teardown()
}
