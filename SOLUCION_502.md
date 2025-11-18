# Solución para Error 502 Bad Gateway

## Problema

Si ves errores **502 Bad Gateway** en ngrok, significa que ngrok está recibiendo las peticiones pero no puede conectarse a tu API .NET.

## Solución Paso a Paso

### 1. Verifica que tu API .NET esté corriendo

Abre tu navegador y visita:
```
http://localhost:5208/api/Usuario
```

**Debes ver:**
- Una respuesta JSON con los usuarios, O
- Un error de la API (como 401, 404, etc.)

**NO debes ver:**
- "Este sitio no se puede alcanzar"
- "ERR_CONNECTION_REFUSED"
- Página en blanco con error de conexión

### 2. Detén ngrok

Presiona `Ctrl+C` en la terminal donde está corriendo ngrok.

### 3. Reinicia ngrok correctamente

Ejecuta uno de estos comandos:

```bash
ngrok http 5208
```

O:

```bash
ngrok http http://localhost:5208
```

**⚠️ NO uses:**
```bash
ngrok http https://localhost:5208  # ❌ Esto causará errores 502
```

### 4. Verifica la configuración en ngrok

En la terminal de ngrok, debes ver:

```
Forwarding: https://xxx.ngrok-free.dev -> http://localhost:5208
```

**✅ Correcto:** `-> http://localhost:5208` (con http://)

**❌ Incorrecto:** `-> https://localhost:5208` (con https://)

### 5. Verifica CORS en tu API .NET

Asegúrate de que tu API .NET tenga CORS configurado correctamente.

**En Program.cs (ASP.NET Core 6+):**

```csharp
var builder = WebApplication.CreateBuilder(args);

// Agregar CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Usar CORS (debe ir ANTES de UseAuthorization)
app.UseCors("AllowReactApp");

app.UseAuthorization();
app.MapControllers();

app.Run();
```

**En Startup.cs (ASP.NET Core anterior a 6):**

```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddCors(options =>
    {
        options.AddPolicy("AllowReactApp", policy =>
        {
            policy.WithOrigins("http://localhost:5173")
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        });
    });
    
    services.AddControllers();
}

public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    // CORS debe ir ANTES de UseAuthorization
    app.UseCors("AllowReactApp");
    
    app.UseAuthorization();
    app.UseEndpoints(endpoints =>
    {
        endpoints.MapControllers();
    });
}
```

### 6. Verifica el puerto

Asegúrate de que:
- Tu API .NET esté corriendo en el puerto **5208**
- ngrok esté configurado para redirigir al puerto **5208**

Si tu API usa otro puerto, actualiza ngrok:
```bash
ngrok http [TU_PUERTO]
```

### 7. Reinicia todo

1. Detén tu API .NET
2. Detén ngrok
3. Inicia tu API .NET
4. Espera a que esté completamente iniciada
5. Inicia ngrok
6. Recarga la aplicación React

## Verificación

Después de seguir estos pasos:

1. Abre ngrok y verifica que NO haya errores 502
2. Abre la consola del navegador (F12) y verifica que las peticiones sean exitosas (status 200)
3. La aplicación debería mostrar los usuarios de la API

## Si el problema persiste

1. Verifica los logs de tu API .NET para ver si está recibiendo las peticiones
2. Verifica los logs de ngrok para ver los errores específicos
3. Verifica la consola del navegador (F12) para ver los errores de la aplicación
4. Asegúrate de que no haya firewall bloqueando las conexiones


