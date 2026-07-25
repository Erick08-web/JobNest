# Auditoria Final JobNest V2

Fecha: 2026-07-24  
Alcance: JobNest V2, backend Flask/API, frontend Next.js V2, app movil Expo/React Native, SQL Server, Docker/Nginx/Prometheus/Grafana.  
Resultado general: funcional para entrega con riesgos npm pendientes justificados por requerir saltos mayores.

## Resumen Ejecutivo

| Area | Estado | Evidencia | Pendiente | Riesgo |
| --- | --- | --- | --- | --- |
| Backend Flask | Completado | `python3 -m py_compile application.py observability.py`, Docker API build OK | Pruebas manuales completas en navegador no repetidas en esta pasada | Bajo |
| Frontend V2 | Completado | `npm run build` genera 34 rutas, Docker frontend build OK | Vulnerabilidades npm de Next requieren salto mayor | Alto controlado |
| Movil | Completado | `npx tsc --noEmit`, `npx expo install --check`, `npx expo export --platform android` OK | Vulnerabilidades transitivas Expo/RN requieren salto mayor | Alto controlado |
| SQL Server | Completado | Migraciones JWT y password reset ejecutadas dos veces; indices verificados | Ninguno encontrado | Bajo |
| Docker/Infra | Completado | `docker compose config`, `docker compose -f docker-compose.prod.yml config`, builds API/frontend/Nginx OK | Stack completo no se levanto en esta auditoria | Medio |
| Monitoreo | Completado | `promtool check config`, `promtool check rules` OK | Grafana no validado visualmente en esta pasada | Bajo |
| Secretos/logs | Completado | Barrido de patrones, Nginx ya no registra query strings | Rotar secretos reales que hayan sido compartidos fuera del repo | Medio |

## Hallazgos y Correcciones

| Severidad | Hallazgo | Correccion | Archivo |
| --- | --- | --- | --- |
| Alta | Nginx usaba `$request` en access log, lo que puede registrar tokens de recuperacion en query string. | Se cambio el log a `"$request_method $uri $server_protocol"` para no guardar parametros. | `nginx/nginx.conf` |
| Alta | Dependencias Python vulnerables en `requirements.txt`. | Se actualizaron `click`, `Flask`, `idna`, `Werkzeug`, `gunicorn` y `cryptography`. `pip-audit` queda limpio. | `requirements.txt` |
| Media | README tenia una `FLASK_SECRET_KEY` de ejemplo demasiado reutilizable. | Se reemplazo por placeholder generico. | `README.md` |
| Media | Script de limpieza de password reset fallaba en SQL Server por opciones `QUOTED_IDENTIFIER`. | Se agregaron `SET ANSI_NULLS ON` y `SET QUOTED_IDENTIFIER ON`; validado con rollback. | `limpiar_password_reset_tokens.sql` |
| Baja | Archivo movil duplicado y desconectado (`App 2.tsx`) contenia codigo antiguo con `localhost` y `any`. | Se elimino como codigo muerto; el entrypoint real usa `App.tsx`. | `JobNestMovil/App 2.tsx` |
| Media | Lockfile movil tenia transitivas corregibles sin romper build. | Se aplicaron parches no destructivos y se valido bundle Android. | `JobNestMovil/package-lock.json` |

## Vulnerabilidades de Dependencias

| Ecosistema | Resultado | Correccion | Pendiente |
| --- | --- | --- | --- |
| Python | `pip-audit -r requirements.txt`: sin vulnerabilidades conocidas despues del ajuste. | Si | Ninguno conocido. |
| Frontend Next.js | `npm audit`: 2 vulnerabilidades altas (`next`, `postcss`). | No, porque `npm audit fix --force` instalaria Next 16.2.11 y es salto mayor/breaking. | Planear migracion controlada Next 14 -> version parcheada mayor con pruebas visuales y regresion. |
| Movil Expo | `npm audit`: 27 vulnerabilidades, 19 altas y 8 moderadas, transitivas de Expo/React Native CLI/build tooling. | Parcial; se intento parche menor y `npm audit fix`, se corrigio lo seguro y se reparo la regresion con `npm dedupe`. | Resolver con migracion planificada a Expo/RN mayor; `--force` rompio `expo export` por RN 0.86 anidado. |

## Matriz de Rubrica

### Programacion Movil

| Requisito | Estado | Evidencia | Pendiente | Riesgo |
| --- | --- | --- | --- | --- |
| Utilidad real para el PI | Completado | App movil consume API real: auth, publicaciones, solicitudes, recuperacion. | Prueba fisica final en varios dispositivos. | Bajo |
| Diseno profesional | Completado | Pantallas existentes compilan y usan navegacion/estilos propios. | Validacion visual manual en celular. | Bajo |
| Funcional en varios dispositivos | Parcial | `expo export --platform android` OK; Expo QR disponible via script. | No se probo fisicamente en varios equipos en esta pasada. | Medio |
| Navigation clara | Completado | `React Navigation`, typed routes y deep link password reset. | Ninguno detectado. | Bajo |
| Validaciones obligatorias | Completado | Validaciones movil/backend en auth, publicaciones, solicitudes y password reset. | Pruebas manuales complementarias. | Bajo |
| API propia y BD | Completado | Flask API + SQL Server; migraciones verificadas. | Ninguno detectado. | Bajo |
| Web/API/BD en nube | Parcial | Docker prod preparado con Nginx, API1/API2 y SQL privado. | Despliegue real en proveedor/cloud no ejecutado aqui. | Medio |

### Seguridad Informatica

| Requisito | Estado | Evidencia | Pendiente | Riesgo |
| --- | --- | --- | --- | --- |
| Hashing | Completado | `passlib[argon2]`, passwords y refresh/reset tokens hasheados. | Ninguno detectado. | Bajo |
| Encriptacion | Completado | `cryptography`/Fernet para datos sensibles configurables. | Usar `DATA_ENCRYPTION_KEY` fuerte en prod. | Bajo |
| Dos servidores | Completado | `docker-compose.prod.yml` define `api1` y `api2`. | Levantar stack completo en servidor final. | Medio |
| Monitoreo | Completado | Prometheus/Grafana config, reglas validas. | Validacion visual Grafana en runtime. | Bajo |
| Firewall | Parcial | Produccion solo expone Nginx; redes internas Docker. | Firewall del proveedor/host debe configurarse fuera del repo. | Medio |
| JWT | Completado | Movil usa access/refresh; refresh hasheado, rotacion y revocacion. | Prueba manual con expiracion real larga no repetida. | Bajo |
| SSL | Parcial | Nginx prod soporta HTTPS/certs configurables. | Instalar certificado real en deploy. | Medio |
| Balanceador | Completado | Nginx balancea `api1` y `api2`. | Prueba runtime con stack levantado. | Bajo |
| SQL privado | Completado | Produccion usa `expose` y red interna para SQL. | Validar reglas cloud. | Bajo |
| Logs seguros | Completado | Nginx no registra query string; logs app sanitizan claves sensibles. | No imprimir secretos en capturas o conversaciones. | Bajo |

### Funcionalidad

| Requisito | Estado | Evidencia | Pendiente | Riesgo |
| --- | --- | --- | --- | --- |
| Registro | Completado | Backend y V2 compilan; validaciones presentes. | Prueba manual final recomendada. | Bajo |
| Login web | Completado | Sesiones Flask en V2; build OK. | Prueba navegador no repetida en esta pasada. | Bajo |
| Login movil JWT | Completado | JWT y SecureStore; TypeScript/export OK. | Prueba fisica final. | Bajo |
| Publicaciones | Completado | Moderacion/admin V2 y endpoints existentes. | Prueba manual de imagenes en navegador. | Bajo |
| Solicitudes | Completado | Endpoints y vistas V2 existentes. | Prueba manual de ciclo completo. | Bajo |
| Recuperacion password | Completado | Migracion, endpoints, web/movil, limpieza validada. | SMTP real depende de variables. | Bajo |
| Administracion web | Completado | Rutas V2 `/admin`, publicaciones, usuarios, solicitudes, pagos, quejas, bitacora. | Prueba de rol admin en navegador final. | Bajo |
| Roles | Completado | Sesion web por rol y JWT movil con claims/validaciones. | Pruebas manuales complementarias. | Bajo |

## Evidencias Ejecutadas

| Prueba | Resultado |
| --- | --- |
| `python3 -m py_compile application.py observability.py` | OK |
| `PYTHONPATH=/tmp/jobnest-pip-audit python3 -m pip_audit --cache-dir /tmp/jobnest-pip-audit-cache -r requirements.txt` | OK, sin vulnerabilidades conocidas |
| `npm run build` en `frontend` | OK, 34 rutas generadas |
| `npx tsc --noEmit` en `JobNestMovil` | OK |
| `npx expo install --check` | OK, dependencias compatibles; aviso de modo offline en sandbox |
| `npx expo export --platform android --output-dir /tmp/jobnest-final-audit-export-5` | OK |
| `docker compose --env-file .env.example config` con placeholders | OK |
| `docker compose --env-file .env.production.example -f docker-compose.prod.yml config` con placeholders | OK |
| Docker build API | OK, imagen `jobnest-api:audit` |
| Docker build frontend | OK, imagen `jobnest-frontend:audit` |
| Docker build Nginx | OK, imagen `jobnest-nginx:audit` |
| Prometheus config prod/dev | OK |
| Prometheus alerts | OK, 5 reglas |
| Migracion `migracion_jwt_refresh_tokens.sql` dos veces | OK |
| Migracion `migracion_password_reset_tokens.sql` dos veces | OK |
| Limpieza `limpiar_password_reset_tokens.sql` con rollback | OK |
| Tablas/indices SQL | `MobileRefreshTokens` y `PasswordResetTokens` con indices esperados |

## Comandos para Presentacion

Usar placeholders; no incluir contrasenas reales.

```bash
python3 -m py_compile application.py observability.py
cd frontend && npm run build
cd JobNestMovil && npx tsc --noEmit
cd JobNestMovil && npx expo install --check
cd JobNestMovil && npx expo export --platform android --output-dir /tmp/jobnest-presentacion-export
env JOBNEST_ENV_FILE=.env.example MSSQL_SA_PASSWORD='REEMPLAZAR' GRAFANA_ADMIN_PASSWORD='REEMPLAZAR' docker compose --env-file .env.example config
env JOBNEST_ENV_FILE=.env.production.example MSSQL_SA_PASSWORD='REEMPLAZAR' GRAFANA_ADMIN_PASSWORD='REEMPLAZAR' PUBLIC_DOMAIN=example.com docker compose --env-file .env.production.example -f docker-compose.prod.yml config
docker build -t jobnest-api:audit .
docker build -t jobnest-frontend:audit ./frontend
docker build -t jobnest-nginx:audit ./nginx
docker run --rm --entrypoint promtool -v "$PWD/monitoring/prometheus:/etc/prometheus:ro" prom/prometheus:v2.55.1 check config /etc/prometheus/prometheus.yml
docker run --rm --entrypoint promtool -v "$PWD/monitoring/prometheus:/etc/prometheus:ro" prom/prometheus:v2.55.1 check config /etc/prometheus/prometheus.dev.yml
docker run --rm --entrypoint promtool -v "$PWD/monitoring/prometheus:/etc/prometheus:ro" prom/prometheus:v2.55.1 check rules /etc/prometheus/alerts.yml
sqlcmd -S localhost,1433 -d JobNest -U '<usuario>' -P '<password>' -C -i migracion_jwt_refresh_tokens.sql
sqlcmd -S localhost,1433 -d JobNest -U '<usuario>' -P '<password>' -C -i migracion_password_reset_tokens.sql
```

## Evidencias de Seguridad para Mostrar

| Tema | Como demostrar |
| --- | --- |
| JWT movil | Login movil devuelve access/refresh; refresh se guarda hasheado en `MobileRefreshTokens`. |
| Refresh rotation | Usar `/api/mobile/auth/refresh`; el refresh anterior queda revocado/reemplazado. |
| Logout revoca | Usar `/api/mobile/auth/logout`; revisar `RevocadoEn`. |
| Recuperacion | Solicitar enlace; reset exitoso invalida token y refresh tokens moviles. |
| SQL privado | En prod compose, SQL usa `expose` y red `jobnest_private`, no `ports`. |
| Balanceo | Nginx upstream apunta a `api1:5000` y `api2:5000`. |
| HTTPS | `docker-compose.prod.yml` expone 80/443 y Nginx carga certificados desde `deploy/certs`. |
| Request ID | Nginx agrega request id y logs lo conservan sin query string. |
| Prometheus | `promtool` valida config y reglas; `/metrics` queda restringido por Nginx. |
| Grafana | Provisioning existe en `monitoring/grafana/provisioning`. |

## Limitaciones Reales

- No se levanto el stack completo de produccion en esta pasada; se validaron configs, builds e infraestructura estatica.
- No se hizo prueba fisica en varios celulares durante esta auditoria; se genero bundle Android y TypeScript paso.
- Next.js tiene vulnerabilidades altas reportadas por `npm audit`; la correccion segura requiere migracion mayor planificada.
- Expo/React Native mantiene vulnerabilidades transitivas; `npm audit fix --force` rompio el bundle al instalar RN 0.86 anidado, por eso no se conserva.
- Las sesiones web firmadas no se invalidan globalmente tras cambio de contrasena; el reset revoca refresh tokens moviles. Cambiar esto bien requiere versionado de sesiones/migracion especifica.
- Si se compartieron credenciales reales fuera del repositorio, deben rotarse manualmente antes de entrega publica.

## Estado Git al Cierre

No se ejecuto `git add`, `git commit` ni `git push`.

Archivos modificados/creados por esta auditoria:

- `AUDITORIA_FINAL.md`
- `README.md`
- `requirements.txt`
- `nginx/nginx.conf`
- `limpiar_password_reset_tokens.sql`
- `JobNestMovil/package-lock.json`
- `JobNestMovil/App 2.tsx` eliminado por codigo muerto

