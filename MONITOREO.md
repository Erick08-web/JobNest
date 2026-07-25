# Monitoreo y observabilidad JobNest V2

Este monitoreo aplica a JobNest V2 con Flask como API, Next.js como frontend principal y SQL Server como base de datos.

## Arquitectura

Flujo básico:

```text
Usuario -> Nginx -> frontend V2
Usuario -> Nginx -> api1/api2
Prometheus -> api1:/metrics
Prometheus -> api2:/metrics
Grafana -> Prometheus
api1/api2 -> SQL Server
```

En producción, `/metrics`, Prometheus y Grafana no quedan publicados por Nginx. Prometheus consulta las APIs por la red Docker y Grafana consulta Prometheus por `monitoring_net`.

## Servicios

- `api1` y `api2`: Flask + Gunicorn con logs estructurados y métricas.
- `nginx`: reverse proxy, balanceador y logs con upstream/time/request ID.
- `prometheus`: recolección de métricas.
- `grafana`: dashboard provisionado.
- `sqlserver`: base de datos privada.

## Puertos

Desarrollo:

- API: `localhost:5001`
- Frontend: `localhost:3000`
- Prometheus con perfil monitoring: `localhost:9090`
- Grafana con perfil monitoring: `localhost:3001`

Producción:

- Público: `80` y `443` únicamente.
- Prometheus y Grafana: sin puerto público. Acceso recomendado por túnel SSH o red privada.

Ejemplo de túnel:

```bash
ssh -L 3001:localhost:3001 usuario@servidor
```

## Levantar monitoreo en desarrollo

```bash
docker compose --env-file .env --profile monitoring up --build
```

Prometheus:

```text
http://localhost:9090
```

Grafana:

```text
http://localhost:3001
```

## Levantar monitoreo en producción

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d
```

No abras Prometheus ni Grafana al público. Usa túnel SSH, VPN o reglas de firewall controladas.

## Request ID

Nginx genera o propaga `X-Request-ID`. Flask reutiliza ese valor si es válido o genera un UUID nuevo.

Cada respuesta incluye:

```text
X-Request-ID
X-JobNest-Instance
```

Prueba:

```bash
curl -skI https://localhost/health
curl -skI -H "X-Request-ID: prueba-123" https://localhost/health
```

## Identificación de instancia

Cada API utiliza:

```text
INSTANCE_ID=api1
INSTANCE_ID=api2
```

Demostración de balanceo:

```bash
for i in {1..10}; do
  curl -skI https://localhost/health | grep X-JobNest-Instance
done
```

No se fuerza alternancia exacta, pero deben aparecer ambas instancias si Nginx está distribuyendo tráfico y ambas APIs están saludables.

## Endpoints

- `GET /health`: estado ligero de Flask. No consulta SQL Server.
- `GET /health/ready`: consulta mínima `SELECT 1` contra SQL Server.
- `GET /metrics`: métricas Prometheus. No debe ser público en producción.

## Métricas

Métricas HTTP:

- `jobnest_http_requests_total`
- `jobnest_http_request_duration_seconds`
- `jobnest_http_errors_total`

Métricas de autenticación:

- `jobnest_auth_events_total`

Eventos:

- `login`
- `refresh`
- `logout`

Métricas de negocio básico:

- `jobnest_business_events_total`

Eventos:

- `publicacion_creada`
- `solicitud_creada`

Disponibilidad:

- `jobnest_sqlserver_available`
- `jobnest_app_info`

Etiquetas usadas:

- `method`
- `route`
- `status`
- `family`
- `instance`
- `event`
- `result`
- `channel`
- `version`

No se usan correos, nombres, tokens, IDs de usuario ni textos libres como etiquetas.

## PromQL útil

Peticiones por segundo:

```promql
sum(rate(jobnest_http_requests_total[5m]))
```

Peticiones por instancia:

```promql
sum(rate(jobnest_http_requests_total[5m])) by (instance)
```

Errores 5xx:

```promql
sum(rate(jobnest_http_requests_total{status=~"5.."}[5m]))
```

Errores 4xx:

```promql
sum(rate(jobnest_http_errors_total{family="4xx"}[5m])) by (instance)
```

Percentil 95:

```promql
histogram_quantile(
  0.95,
  sum(rate(jobnest_http_request_duration_seconds_bucket[5m])) by (le)
)
```

Logins exitosos y fallidos:

```promql
sum(rate(jobnest_auth_events_total{event="login"}[5m])) by (result, channel)
```

Refresh exitosos y fallidos:

```promql
sum(rate(jobnest_auth_events_total{event="refresh"}[5m])) by (result)
```

Publicaciones creadas:

```promql
sum(rate(jobnest_business_events_total{event="publicacion_creada"}[5m])) by (channel)
```

Solicitudes creadas:

```promql
sum(rate(jobnest_business_events_total{event="solicitud_creada"}[5m])) by (channel)
```

SQL Server disponible:

```promql
jobnest_sqlserver_available
```

## Dashboard

Grafana carga automáticamente el dashboard:

```text
JobNest V2 Observabilidad
```

Paneles incluidos:

- Peticiones por minuto.
- Respuestas por código HTTP.
- Errores 4xx.
- Errores 5xx.
- Latencia promedio.
- Percentil 95.
- Peticiones por instancia.
- Estado de `api1`.
- Estado de `api2`.
- Logins exitosos y fallidos.
- Refresh exitosos y fallidos.
- Publicaciones creadas.
- Solicitudes creadas.

## Alertas

Las reglas están en:

```text
monitoring/prometheus/alerts.yml
```

Alertas incluidas:

- API caída.
- Errores 5xx elevados.
- Latencia p95 elevada.
- SQL Server no disponible.
- Login fallido elevado.

No hay envío por correo, Slack ni SMS en esta fase. Los umbrales son académicos y deben ajustarse con tráfico real.

## Logs

Flask usa `logging` estándar.

Variables:

```text
LOG_LEVEL=INFO
LOG_FORMAT=json
```

En producción se recomienda `LOG_FORMAT=json`. En desarrollo puede usarse `text`.

Los logs incluyen:

- timestamp.
- nivel.
- logger.
- mensaje.
- método.
- ruta.
- código.
- duración.
- IP.
- request ID.
- instancia.
- usuario/rol solo cuando es seguro y está disponible.

No se registran:

- contraseñas.
- tokens.
- cookies completas.
- `Authorization`.
- secretos.
- cadenas de conexión completas.
- archivos binarios.

Nginx registra:

- IP.
- método/ruta.
- status.
- bytes.
- referer.
- user-agent.
- tiempo total.
- tiempo upstream.
- upstream atendido.
- request ID.

## Rotación

Compose usa `json-file` con límites:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"
```

Para producción real puede integrarse un recolector externo, pero no se agrega ELK/Loki en esta fase.

## Verificación

Validar configuración:

```bash
docker compose --env-file .env -f docker-compose.yml config
docker compose --env-file .env.production -f docker-compose.prod.yml config
```

Validar Prometheus:

```bash
docker run --rm --entrypoint promtool -v "$PWD/monitoring/prometheus:/etc/prometheus:ro" prom/prometheus:v2.55.1 check config /etc/prometheus/prometheus.yml
docker run --rm --entrypoint promtool -v "$PWD/monitoring/prometheus:/etc/prometheus:ro" prom/prometheus:v2.55.1 check config /etc/prometheus/prometheus.dev.yml
docker run --rm --entrypoint promtool -v "$PWD/monitoring/prometheus:/etc/prometheus:ro" prom/prometheus:v2.55.1 check rules /etc/prometheus/alerts.yml
```

Validar métricas:

```bash
curl http://localhost:5001/metrics | grep jobnest_http_requests_total
```

Validar que `/metrics` no sea público:

```bash
curl -sk https://localhost/metrics
```

Debe devolver `404`.

## Solución de problemas

Si Prometheus muestra `api1` o `api2` como down:

- revisa `docker compose ps`.
- revisa `/health` en cada API.
- revisa que ambos servicios estén en `jobnest_public`.

Si Grafana no muestra datos:

- revisa que el datasource `Prometheus` esté provisionado.
- revisa que Prometheus tenga targets `up`.
- revisa el rango temporal del dashboard.

Si `/health/ready` devuelve 503:

- revisa disponibilidad de SQL Server.
- revisa `DB_SERVER`.
- revisa `DB_USER`.
- revisa certificado/ODBC.

## Límites

Esta fase agrega observabilidad básica y proporcional al proyecto. No incluye:

- alertmanager.
- notificaciones externas.
- trazas distribuidas.
- ELK.
- Loki.
- monitoreo de host.
- monitoreo detallado de SQL Server.
