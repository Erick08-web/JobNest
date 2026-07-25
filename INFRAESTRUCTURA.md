# Infraestructura de despliegue JobNest V2

Este documento aplica únicamente a JobNest V2:

- Frontend principal: `frontend` con Next.js y TypeScript.
- Backend activo: Flask como API.
- Base de datos activa: SQL Server.
- App móvil: `JobNestMovil`, consumiendo la API Flask.

La versión antigua queda solo como referencia histórica.

## Archivos principales

- `Dockerfile`: imagen productiva de Flask con Gunicorn y ODBC Driver 18.
- `frontend/Dockerfile`: imagen productiva de Next.js con salida standalone.
- `nginx/Dockerfile`: imagen de Nginx.
- `nginx/conf.d/default.conf`: proxy HTTPS, balanceador y rutas públicas.
- `docker-compose.yml`: entorno local/development.
- `docker-compose.prod.yml`: entorno production.
- `.env.example`: plantilla local.
- `.env.production.example`: plantilla productiva.

## Topología

### Desarrollo

En desarrollo se exponen puertos para facilitar pruebas:

- Next.js: `http://localhost:3000`
- Flask API: `http://localhost:5001`
- SQL Server: `localhost:1433`

Servicios:

- `frontend`
- `api`
- `sqlserver`

### Producción

En producción solo Nginx publica puertos:

- `80`
- `443`

Servicios internos:

- `frontend`, sin puerto público.
- `api1`, sin puerto público.
- `api2`, sin puerto público.
- `sqlserver`, sin puerto público.

Nginx balancea la API entre `api1:5000` y `api2:5000`.

Redes:

- `jobnest_public`: Nginx, frontend y API.
- `jobnest_private`: API y SQL Server. Es interna.

## Variables de entorno

Para desarrollo:

```bash
cp .env.example .env
```

Edita `.env` y coloca valores reales para:

- `FLASK_SECRET_KEY`
- `DATA_ENCRYPTION_KEY`
- `JWT_SECRET_KEY`
- `MSSQL_SA_PASSWORD`
- `DB_PASSWORD`
- credenciales de correo si usarás envío real.

Para producción:

```bash
cp .env.production.example .env.production
```

Edita `.env.production` y coloca:

- `PUBLIC_DOMAIN`
- secretos productivos de Flask/JWT/cifrado.
- contraseña fuerte de SQL Server.
- certificado SQL válido si usarás `DB_TRUST_SERVER_CERTIFICATE=no`.
- `CORS_ALLOWED_ORIGINS=https://tu-dominio`.

## Certificados HTTPS

El Compose productivo espera estos archivos:

```text
deploy/certs/fullchain.pem
deploy/certs/privkey.pem
```

Puedes generarlos con Let's Encrypt en el servidor o copiar certificados válidos. La carpeta está ignorada por Git para no subir secretos.

## Levantar desarrollo

```bash
docker compose --env-file .env -f docker-compose.yml up --build
```

Validaciones rápidas:

```bash
curl http://localhost:5001/health
curl http://localhost:5001/health/ready
open http://localhost:3000
```

La app móvil debe usar:

```bash
EXPO_PUBLIC_API_URL=http://IP_DE_TU_MAC:5001
```

Si no defines esa variable, la app intenta detectar la IP usada por Expo.

## Levantar producción

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config
docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d
```

Validaciones rápidas:

```bash
curl -k https://TU_DOMINIO/nginx-health
curl -k https://TU_DOMINIO/health
curl -k https://TU_DOMINIO/health/ready
```

## Rutas publicadas por Nginx

- `/`: frontend V2.
- `/api/backend/*`: proxy hacia Flask, quitando el prefijo usado por Next.
- `/api/*`: proxy hacia Flask para endpoints móviles y API directa.
- `/static/*`: archivos estáticos servidos por Flask.
- `/health`: health check básico de Flask.
- `/health/ready`: readiness check con conexión a SQL Server.
- `/nginx-health`: health check de Nginx.

## Firewall recomendado con UFW

En producción, el servidor público debe permitir únicamente SSH y web:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

No abras `1433`, `5000`, `5001` ni `3000` en producción.

## Monitoreo básico

Estado de servicios:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f nginx
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api1 api2
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f sqlserver
```

Health checks:

```bash
docker inspect --format='{{json .State.Health}}' jobnest-api-dev
```

En producción los contenedores no tienen nombres fijos para evitar choques entre proyectos, por eso conviene revisar con `docker compose ps`.

## Notas de seguridad

- No subas `.env`, `.env.production`, certificados ni llaves privadas.
- En local puedes usar `DB_TRUST_SERVER_CERTIFICATE=yes`.
- En producción lo correcto es usar certificados válidos y mantener `DB_TRUST_SERVER_CERTIFICATE=no`.
- `SESSION_COOKIE_SECURE=true` debe permanecer activo en producción.
- `TRUST_PROXY_HEADERS=true` solo debe usarse cuando Flask está detrás de Nginx.

## Verificación antes de subir cambios

```bash
docker compose --env-file .env -f docker-compose.yml config
docker compose --env-file .env.production -f docker-compose.prod.yml config
python3 -m py_compile application.py
cd frontend && npm run build
cd ../JobNestMovil && npx tsc --noEmit
```
