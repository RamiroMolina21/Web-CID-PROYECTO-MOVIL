# TutorPro - Sistema de Gestión de Tutorías

Sistema web completo para la gestión de tutorías, horarios y estudiantes.

## Características

- **Dashboard**: Vista general con métricas y próximas tutorías
- **Horarios**: Calendario semanal con gestión de horarios disponibles
- **Agendar Tutoría**: Sistema para agendar tutorías con horarios disponibles
- **Estudiantes**: Gestión completa de estudiantes con búsqueda y filtrado
- **Integración con API REST**: Consumo de API .NET mediante ngrok

## Instalación

1. Instala las dependencias:
```bash
npm install
```

2. Configura la URL de la API:
   - Copia el archivo `.env.example` a `.env`
   - Edita `.env` y agrega la URL de tu túnel ngrok:
   ```
   VITE_API_URL=https://tu-url-ngrok.ngrok.io/api
   ```

3. Configura ngrok para tu API .NET:
   ```bash
   ngrok http http://localhost:5000
   ```
   Reemplaza `5000` con el puerto donde corre tu API .NET.

4. Inicia el servidor de desarrollo:
```bash
npm run dev
```

5. Abre tu navegador en `http://localhost:5173`

## Configuración de ngrok

1. Descarga e instala ngrok desde [https://ngrok.com/](https://ngrok.com/)

2. **IMPORTANTE**: Inicia tu API .NET PRIMERO en el puerto 5208 (ej: `http://localhost:5208`)
   - Asegúrate de que la API esté corriendo y respondiendo correctamente
   - Verifica que puedas acceder a `http://localhost:5208/api/Usuario` en tu navegador

3. Ejecuta ngrok para crear el túnel (usa HTTP, no HTTPS):
   ```bash
   ngrok http 5208
   ```
   O alternativamente:
   ```bash
   ngrok http http://localhost:5208
   ```
   ⚠️ **NO uses**: `ngrok http https://localhost:5208` (esto causará errores 502 Bad Gateway)

4. Verifica en ngrok que la redirección sea correcta:
   - Debe mostrar: `https://xxx.ngrok-free.dev -> http://localhost:5208`
   - **NO debe mostrar**: `-> https://localhost:5208` (esto causará errores)

5. Copia la URL HTTPS que ngrok genera (ej: `https://abc123.ngrok-free.dev`)

6. Actualiza el archivo `src/config/apiConfig.js` con la URL completa:
   ```javascript
   export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://tu-url-ngrok.ngrok-free.dev/api'
   ```
   O crea un archivo `.env` en la raíz del proyecto:
   ```
   VITE_API_URL=https://tu-url-ngrok.ngrok-free.dev/api
   ```

7. Reinicia el servidor de desarrollo de Vite para que cargue la nueva variable de entorno

## Tecnologías

- React 18
- React Router DOM
- Vite
- CSS3
- API REST (.NET)

## Estructura del Proyecto

```
src/
├── components/     # Componentes reutilizables
├── pages/         # Páginas principales
├── context/       # Context API para estado global
├── services/      # Servicios API
├── config/        # Configuración de la API
└── App.jsx        # Componente principal
```

## Endpoints de la API

La aplicación consume los siguientes endpoints:

- **Auth**: `POST /api/Auth/login`
- **Usuario**: `GET, POST, PUT, DELETE /api/Usuario`
- **Horario**: `GET, POST, PUT, DELETE /api/Horario`
- **Tutoria**: `GET, POST, PUT, DELETE /api/Tutoria`
- **Notificacion**: `GET, DELETE /api/Notificacion`
- **Retroalimentacion**: `GET, POST, PUT, DELETE /api/Retroalimentacion`
- **Metricas**: `GET /api/Metricas`

## Solución de Problemas

### Error 502 Bad Gateway en ngrok

Si ves errores **502 Bad Gateway** en los logs de ngrok, significa que ngrok no puede conectarse a tu API .NET:

1. **Verifica que tu API .NET esté corriendo:**
   - Abre `http://localhost:5208/api/Usuario` en tu navegador
   - Deberías ver una respuesta JSON o un error de la API (no un error de conexión)

2. **Verifica la configuración de ngrok:**
   - En la terminal de ngrok, verifica que muestre: `-> http://localhost:5208` (NO https://)
   - Si muestra `-> https://localhost:5208`, detén ngrok y reinícialo con: `ngrok http 5208`

3. **Verifica el puerto:**
   - Asegúrate de que tu API .NET esté corriendo en el puerto 5208
   - Si usas otro puerto, actualiza ngrok: `ngrok http [TU_PUERTO]`

4. **Verifica CORS en tu API .NET:**
   ```csharp
   // En Program.cs o Startup.cs
   builder.Services.AddCors(options =>
   {
       options.AddPolicy("AllowReactApp", policy =>
       {
           policy.WithOrigins("http://localhost:5173")
                 .AllowAnyHeader()
                 .AllowAnyMethod();
       });
   });
   
   // Usar CORS
   app.UseCors("AllowReactApp");
   ```

### No se muestran usuarios en la web

Si la web carga pero no muestra usuarios:

1. Verifica en la consola del navegador (F12) si hay errores
2. Verifica que la API esté devolviendo datos en `http://localhost:5208/api/Usuario`
3. Verifica que los usuarios tengan el campo `tipoRol` o `rol` correctamente configurado
4. Revisa los logs en la consola del navegador para ver qué datos se están recibiendo

## Notas

- La aplicación ahora consume datos desde la API REST en lugar de localStorage
- Asegúrate de que tu API .NET esté corriendo y accesible mediante ngrok
- Si cambias la URL de ngrok, actualiza el archivo `src/config/apiConfig.js` o `.env` y reinicia el servidor
- Los errores 502 generalmente indican que ngrok no puede conectarse a tu API .NET






