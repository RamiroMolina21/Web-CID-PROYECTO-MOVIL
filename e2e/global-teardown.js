// Red de seguridad: borra por la API cualquier dato [PRUEBA] que haya quedado (aunque una prueba falle).
import { request } from '@playwright/test'
import { apiComo, creds, limpiarPrueba } from './helpers'

export default async function globalTeardown() {
  if (!process.env.E2E_API_URL || !creds('admin')) return
  const admin = await apiComo({ request }, 'admin')
  try {
    const r = await limpiarPrueba(admin)
    console.log(`[teardown] limpieza [PRUEBA]: ${JSON.stringify(r)}`)
  } finally {
    await admin.dispose()
  }
}
