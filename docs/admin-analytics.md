# Motor analitico administrativo

Este documento describe el contrato de metricas reales para el panel administrativo de JobNest V2. Las consultas se exponen desde Flask como API administrativa y deben consumirse desde el frontend Next.js.

## Alcance

El motor analitico cubre:

- Resumen general del sistema.
- Usuarios por rol y estado.
- Publicaciones por estado, categoria y periodo.
- Solicitudes por estado, categoria y periodo.
- Pagos por estatus, metodo y monto.
- Resenas por calificacion y categoria.
- Marketplace por oferta, demanda y ubicacion.
- Moderacion por acciones, quejas y pendientes.
- Visualizacion administrativa en `/admin/analitica`.
- Exportacion filtrada a PDF y Excel.

No genera datos simulados, no consulta informacion sensible como hashes de contrasena o tokens, y no modifica registros.

## Pagina de Analitica

La interfaz principal vive en `frontend/app/admin/analitica/page.tsx` y se integra con el shell administrativo V2. La entrada de navegacion esta habilitada en el sidebar como `Analitica`.

La pagina se organiza en:

- Header con acciones de exportacion.
- Filtros globales con chips activos y URL compartible.
- KPIs principales.
- Tabs por modulo para evitar una pagina interminable.
- Graficas SVG responsivas.
- Tablas resumen para rankings y datos alternativos accesibles.

La carga es progresiva: primero se consulta el resumen general y luego cada modulo se carga cuando el administrador abre su tab. Si una seccion falla, se muestra error parcial y boton de reintento sin bloquear el resto.

## Endpoints

Todos los endpoints requieren sesion de administrador:

- `GET /admin/analytics/filter-options`
- `GET /admin/analytics/overview`
- `GET /admin/analytics/users`
- `GET /admin/analytics/publications`
- `GET /admin/analytics/requests`
- `GET /admin/analytics/payments`
- `GET /admin/analytics/reviews`
- `GET /admin/analytics/marketplace`
- `GET /admin/analytics/moderation`

## Filtros

Filtros comunes:

- `preset`: `today`, `yesterday`, `last_7_days`, `last_30_days`, `current_week`, `previous_week`, `current_month`, `previous_month`, `current_year`, `custom`.
- `date_from`: fecha ISO `YYYY-MM-DD`.
- `date_to`: fecha ISO `YYYY-MM-DD`.
- `granularity`: `day`, `week`, `month`.
- `timezone`: zona horaria enviada por cliente para trazabilidad.
- `limit`: limite de distribuciones, entre 1 y 25.

Filtros especificos:

- `role`: `cliente`, `prestador`, `administrador`.
- `category`: categoria validada contra catalogo y publicaciones existentes.
- `status`: estado validado contra solicitudes, publicaciones, versiones o quejas.
- `location`: texto de ubicacion para publicaciones.
- `provider_id`: identificador numerico de prestador.
- `client_id`: identificador numerico de cliente.
- `admin_id`: identificador numerico de administrador.
- `payment_method`: metodo de pago existente.
- `payment_status`: estatus de pago existente.

El rango maximo permitido es de 370 dias por solicitud.

En frontend, los filtros se aplican solo al presionar `Aplicar`; no se dispara una solicitud por cada cambio. La URL se sincroniza con los filtros aplicados para que el enlace pueda compartirse.

## Contrato de respuesta

Las respuestas analiticas comparten esta forma:

```json
{
  "success": true,
  "period": {
    "date_from": "2026-07-01",
    "date_to": "2026-07-31",
    "previous_date_from": "2026-06-01",
    "previous_date_to": "2026-06-30",
    "granularity": "day",
    "timezone": "America/Mexico_City"
  },
  "filters": {},
  "kpis": {},
  "series": {},
  "distributions": {}
}
```

Los KPIs incluyen:

- `value`: valor del periodo actual.
- `previous`: valor del periodo anterior equivalente.
- `change_percentage`: variacion porcentual cuando existe base de comparacion.

Las series incluyen buckets completos con ceros cuando no hay registros en un periodo, para evitar huecos visuales.

Las distribuciones incluyen:

- `label`: grupo visible.
- `value`: total o promedio.
- `percentage`: participacion del grupo sobre el total de la distribucion.

## Definiciones de metricas

Usuarios:

- `total`: usuarios registrados.
- `new_users`: usuarios creados en el periodo.
- `active_users`: usuarios con `Activo = 1`.
- `inactive_users`: usuarios con `Activo = 0`.
- `by_role`: distribucion por `TipoUsuario`.

Publicaciones:

- `total`: publicaciones existentes.
- `created`: publicaciones creadas en el periodo.
- `pending`: publicaciones pendientes de revision.
- `approved`: publicaciones aprobadas.
- `rejected`: publicaciones rechazadas.
- `by_category`: distribucion por categoria.

Solicitudes:

- `total`: solicitudes existentes.
- `created`: solicitudes creadas en el periodo.
- `accepted`: solicitudes aceptadas.
- `completed`: solicitudes concluidas, concluidas femeninas o calificadas.
- `cancelled`: solicitudes canceladas.

Pagos:

- `total`: pagos existentes.
- `completed`: pagos con estatus completado.
- `completed_amount`: suma de pagos completados.
- `pending_amount`: suma de pagos pendientes.

Resenas:

- `total`: resenas existentes.
- `average_rating`: promedio de calificacion.
- `five_star`: resenas con calificacion 5.
- `low_rating`: resenas con calificacion menor o igual a 2.

Marketplace:

- `active_publications`: publicaciones activas.
- `visible_publications`: publicaciones activas y aprobadas.
- `requests_per_publication`: solicitudes promedio por publicacion visible.
- `completion_rate`: porcentaje de solicitudes completadas sobre solicitudes del periodo.

Moderacion:

- `actions_total`: acciones registradas en bitacora administrativa.
- `complaints_total`: quejas registradas.
- `complaints_open`: quejas abiertas o en revision.
- `publications_pending`: publicaciones pendientes de revision.

## Graficas implementadas

La Fase 4 usa componentes SVG propios en React para evitar dependencias visuales adicionales:

- Linea/area: series por periodo.
- Dona: distribuciones con pocas categorias.
- Barras horizontales: rankings y categorias.
- Barras dobles: oferta contra demanda del marketplace.
- Tablas: alternativa accesible y soporte para rankings.

Las graficas manejan serie vacia, valores cero y nulos con el mensaje:

`No hay datos para este periodo. Prueba con otro rango de fechas o elimina algunos filtros.`

No se rellenan espacios con datos inventados.

## Exportacion PDF

La accion `PDF` genera un archivo:

`jobnest-analytics-YYYY-MM-DD.pdf`

Dependencias:

- `jspdf`
- `jspdf-autotable`

Contenido:

- Encabezado JobNest.
- Titulo del reporte.
- Fecha de generacion.
- Administrador, cuando esta disponible.
- Periodo.
- Filtros aplicados.
- KPIs.
- Resumen por modulo.
- Pie de pagina con numeracion.
- Dominio oficial.

La exportacion se genera del lado cliente con los datos ya solicitados por la vista. Si algun modulo no fue cargado, se consulta antes de generar el archivo respetando los mismos filtros.

## Exportacion Excel

La accion `Excel` genera un archivo:

`jobnest-analytics-YYYY-MM-DD.xlsx`

Dependencias:

- `exceljs`
- `file-saver`

Hojas:

- `Resumen`
- `Usuarios`
- `Publicaciones`
- `Solicitudes`
- `Pagos`
- `Reseñas`
- `Marketplace`
- `Moderación`
- `Filtros`

Cada hoja incluye encabezados formateados, filtros automaticos, freeze pane en encabezados y anchos de columna consistentes. Si no hay datos, se escribe una fila clara de `Sin datos`.

## Seguridad

- Todos los endpoints usan la misma validacion de sesion administrativa que el panel actual.
- Los filtros se validan antes de ejecutar consultas.
- Las entradas del usuario se envian como parametros SQL.
- No se retorna `PasswordHash`, tokens de sesion, refresh tokens ni secretos.
- No se usa `SELECT *`.
- Las consultas son de solo lectura.

## Privacidad

Las exportaciones aplican minimizacion:

- No incluyen contrasenas.
- No incluyen hashes.
- No incluyen tokens.
- No incluyen datos de recuperacion.
- No incluyen detalles de tarjeta.
- Evitan correos en rankings salvo cuando el backend solo dispone de etiqueta administrativa.
- Incluyen IDs solo cuando aportan trazabilidad operativa.

Los datos exportados son agregados, KPIs, distribuciones, series y rankings administrativos.

## Dependencias frontend

La Fase 4 agrega dependencias de exportacion:

- `jspdf`
- `jspdf-autotable`
- `exceljs`
- `file-saver`
- `@types/file-saver`

No se agrega libreria de graficas; las visualizaciones se renderizan con SVG propio.

## Recomendaciones de indices

Para bases con alto volumen, revisar indices sobre:

- `Usuarios.FechaRegistro`, `Usuarios.TipoUsuario`, `Usuarios.Activo`.
- `Publicaciones.FechaCreacion`, `Publicaciones.EstadoRevision`, `Publicaciones.Categoria`, `Publicaciones.PrestadorId`.
- `SolicitudesServicios.FechaSolicitud`, `SolicitudesServicios.Estado`, `SolicitudesServicios.PublicacionId`, `SolicitudesServicios.ClienteId`.
- `Pagos.FechaPago`, `Pagos.Estatus`, `Pagos.MetodoPago`.
- `Resenas.FechaCreacion`, `Resenas.SolicitudServicioId`, `Resenas.RevisorId`.
- `Quejas.FechaCreacion`, `Quejas.Estado`.
- `BitacoraAdmin.CreadoEn`, `BitacoraAdmin.ActorId`, `BitacoraAdmin.TipoEvento`.

Estas recomendaciones no crean indices por si mismas; cualquier cambio de esquema debe ir en una migracion separada.

## Limitaciones conocidas

- La zona horaria se reporta en el contrato, pero las consultas usan las fechas almacenadas en SQL Server tal como existen.
- `change_percentage` es `null` cuando el periodo anterior vale cero.
- Los promedios y tasas dependen de que los estados historicos se mantengan normalizados.
- Los endpoints no reemplazan monitoreo tecnico como Prometheus o logs; son metricas de negocio.
- Las exportaciones son cliente-side y estan pensadas para el volumen agregado de los endpoints actuales, no para descargas masivas de miles de filas.
- Las graficas nativas de Excel no se generan en esta fase; se prioriza consistencia de datos y formato estable.
