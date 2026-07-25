# Recuperación segura de contraseña JobNest V2

Esta fase implementa recuperación de contraseña para web V2 y aplicación móvil usando Flask y SQL Server como fuente compartida.

## Flujo

1. El usuario solicita recuperación desde web o móvil.
2. Flask normaliza el correo y responde siempre con un mensaje genérico.
3. Si existe una cuenta activa, revoca tokens anteriores activos.
4. Genera un token con `secrets.token_urlsafe(32)`.
5. Guarda únicamente `SHA-256(token)` en SQL Server.
6. Envía el enlace por `MAIL_MODE=console` o `MAIL_MODE=smtp`.
7. El usuario abre `/restablecer-password?token=...` o `jobnest://restablecer-password?token=...`.
8. Flask valida token, expiración, un solo uso y contraseña.
9. Actualiza `Usuarios.PasswordHash` con Argon2.
10. Marca el token como usado/revocado.
11. Revoca refresh tokens móviles del usuario.

## Endpoints

Solicitud:

```http
POST /api/auth/password/forgot
```

Body:

```json
{
  "correo": "usuario@ejemplo.com",
  "canal": "web"
}
```

Respuesta pública:

```json
{
  "success": true,
  "message": "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña."
}
```

Restablecimiento:

```http
POST /api/auth/password/reset
```

Body:

```json
{
  "token": "token-del-enlace",
  "password": "Nueva123!",
  "password_confirmation": "Nueva123!",
  "canal": "web"
}
```

## Tabla SQL

Migración:

```bash
sqlcmd -S localhost,1433 -d JobNest -U SA -P "$DB_PASSWORD" -C -i migracion_password_reset_tokens.sql
```

Tabla:

```text
PasswordResetTokens
```

Campos importantes:

- `UsuarioId`
- `EmailHash`
- `TokenHash`
- `Canal`
- `IpSolicitud`
- `FechaCreacion`
- `FechaExpiracion`
- `FechaUso`
- `Revocado`
- `EmailEnviado`

No se guarda el token plano ni contraseña.

## Expiración y rate limit

Variables:

```text
PASSWORD_RESET_TOKEN_MINUTES=30
PASSWORD_RESET_MAX_PER_EMAIL=3
PASSWORD_RESET_MAX_PER_IP=10
PASSWORD_RESET_WINDOW_MINUTES=15
```

El rate limit se apoya en SQL Server, por lo que funciona con `api1` y `api2`.

## Correo

Desarrollo:

```text
MAIL_MODE=console
```

En modo console no se envía correo real. En formato de log texto puede mostrar el enlace local para pruebas. En JSON no imprime el token completo.

Producción:

```text
MAIL_MODE=smtp
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_USE_TLS=true
SMTP_TIMEOUT_SECONDS=10
MAIL_FROM=
```

Si SMTP falla, el cliente recibe respuesta genérica. El error técnico se registra sin credenciales.

## Web V2

Rutas:

- `/recuperar-password`
- `/restablecer-password?token=...`

El login V2 tiene el enlace “Olvidé mi contraseña”.

## Móvil

Pantallas:

- `ForgotPassword`
- `ResetPassword`

Deep link:

```text
jobnest://restablecer-password?token=TOKEN
```

Expo:

```json
{
  "scheme": "jobnest"
}
```

En Expo Go el comportamiento puede depender del cliente Expo. En una build nativa el esquema `jobnest://` queda registrado por la app.

## Sesiones

Las sesiones web actuales son cookies firmadas de Flask. No existe tabla de sesiones persistentes, por lo que no se cierran todas las sesiones web activas al cambiar contraseña.

Sí se revocan refresh tokens móviles existentes en `MobileRefreshTokens`.

## Limpieza

Script:

```bash
sqlcmd -S localhost,1433 -d JobNest -U SA -P "$DB_PASSWORD" -C -i limpiar_password_reset_tokens.sql
```

Elimina tokens usados, revocados o expirados con más de 30 días.

## Métricas

Métrica:

```promql
jobnest_password_reset_events_total
```

Etiquetas:

- `result`
- `channel`
- `instance`

Ejemplos:

```promql
sum(rate(jobnest_password_reset_events_total[5m])) by (result, channel)
```

```promql
sum(rate(jobnest_password_reset_events_total{result="completed"}[5m])) by (channel)
```

## Seguridad

- Token aleatorio con `secrets.token_urlsafe(32)`.
- Hash SHA-256 del token.
- Un solo uso.
- Expiración corta.
- Revocación de tokens anteriores.
- Rate limit por hash de correo e IP.
- Respuesta genérica para evitar enumeración.
- No se aceptan URLs desde cliente.
- No se aceptan IDs de usuario desde cliente.
- No se registran contraseñas ni tokens.
- Consultas parametrizadas.
- Transacción en restablecimiento.

## Pruebas rápidas

Solicitud:

```bash
curl -X POST http://localhost:5001/api/auth/password/forgot \
  -H "Content-Type: application/json" \
  -d '{"correo":"usuario@example.com","canal":"web"}'
```

Restablecimiento:

```bash
curl -X POST http://localhost:5001/api/auth/password/reset \
  -H "Content-Type: application/json" \
  -d '{"token":"TOKEN","password":"Nueva123!","password_confirmation":"Nueva123!","canal":"web"}'
```
