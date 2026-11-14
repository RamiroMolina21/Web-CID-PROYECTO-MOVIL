# Pruebas E2E (Playwright + axe)

Plan de casos: `docs/migracion-maui-web.md` §5.

```bash
npm install
npx playwright install chromium        # una vez
cp .env.e2e.example .env.e2e           # rellenar con usuarios de la BD de PRUEBAS (no se versiona)
npm run test:e2e                       # build + vite preview (4173) + pruebas
npm run test:e2e -- e2e/publico.spec.js   # solo los casos que no necesitan backend
```

- Sin `E2E_API_URL` o sin credenciales de un rol, sus pruebas se **saltan** (no hay mocks).
- Proyectos: `desktop` (1280×800) ejecuta todo; `tablet` (768) y `mobile` (375) ejecutan los casos etiquetados `@responsive`/`@mobile`.
- El backend debe permitir el origen `http://localhost:4173` en `Cors:AllowedOrigins`.
- Informe HTML en `playwright-report/` (ignorado por git).

## Notas de ejecución

- El backend limita el login a 10 intentos/min por IP: las pruebas hacen **un login por rol** (sesión reutilizada en `e2e/.auth/`, ignorada por git) y esperan turno cuando hace falta (`esperarTurnoLogin`).
- Datos: solo se crean registros con prefijo `[PRUEBA]` (horarios del Docente, tutorías en esos horarios, un usuario Estudiante) y se borran por la API en `afterAll` y en `globalSetup`/`globalTeardown` (también si una prueba falla).
- Sin credenciales de Auxiliar, sus casos se saltan.
