# JobNestMovil

Aplicacion movil inicial de JobNest construida con Expo Go y Expo SDK 54.

## Ejecutar

```bash
cd /Users/erick/Desktop/JobNest/JobNestMovil
npm start
```

Escanea el QR con Expo Go.

## Conexión

La app usa por defecto la plataforma oficial de JobNest:

```text
https://jobnestservices.com/api/backend
```

La pantalla de ajustes conserva el campo de conexión solo para soporte. Si detecta una dirección anterior o no segura, vuelve automáticamente a la dirección oficial.

## Pantallas incluidas

- Inicio movil
- Login
- Registro Cliente / Prestador
- Exploracion de servicios
- Detalle de servicio
- Envio de solicitud
- Dashboard de cliente
- Dashboard de prestador
- Publicar servicio
- Solicitudes
- Perfil editable
- Foto de perfil
- Cambio de contraseña
- Portafolio de prestador
- Reseñas del perfil
- Ajustes avanzados de conexión

## Perfil móvil

El perfil usa endpoints JWT móviles, no sesiones web:

- `GET /api/mobile/perfil`: obtiene datos completos del usuario autenticado.
- `PATCH /api/mobile/perfil`: actualiza nombre, apellidos y teléfono.
- `POST /api/mobile/perfil/foto`: sube foto con `multipart/form-data` en el campo `foto`.
- `POST /api/mobile/auth/change-password`: cambia contraseña validando la contraseña actual.
- `GET /api/mobile/mi-portafolio`: lista trabajos del portafolio del prestador autenticado.
- `GET /api/mobile/mi-perfil/resenas`: obtiene promedio, total y reseñas del perfil autenticado.

La foto se selecciona con permisos de galería mediante Expo ImagePicker. La contraseña no se guarda localmente; al cambiarla, el backend revoca las sesiones móviles y la app pide iniciar sesión otra vez.
