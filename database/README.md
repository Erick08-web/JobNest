# Base de datos JobNest V2

Esta carpeta documenta el orden reproducible para crear o actualizar la base SQL Server de JobNest V2.

## Requisitos

- SQL Server 2022 o compatible.
- `sqlcmd` disponible en el host o dentro del contenedor SQL Server.
- Archivo de entorno fuera de Git con los valores reales de conexion.
- No ejecutar seeds ni datos de prueba en produccion salvo que exista una instruccion explicita.

## Orden de instalacion

`JobNest.sql` es el script base historico: crea la base `JobNest` y las tablas principales.

Despues de crear la base, aplica las migraciones en este orden:

1. `seguridad_semana1.sql`
2. `migracion_jwt_refresh_tokens.sql`
3. `migracion_password_reset_tokens.sql`
4. `migracion_publicaciones_versiones_imagenes.sql`
5. `migracion_admin_control.sql`
6. `migracion_admin_operaciones.sql`
7. `database/migrations/migracion_v2_compatibilidad_esquema.sql`
8. `database/migrations/migracion_catalogo_categorias.sql`
9. `database/migrations/migracion_catalogos_pago.sql`
10. `database/migrations/migracion_integridad_solicitudes_resenas.sql`

`limpiar_password_reset_tokens.sql` no es una migracion de esquema. Es una tarea de mantenimiento y no debe ejecutarse como parte de la instalacion inicial.

## Ejecucion con sqlcmd

Ejemplo desde un contenedor SQL Server:

```bash
docker exec -i <SQLSERVER_CONTAINER> /opt/mssql-tools18/bin/sqlcmd \
  -S localhost \
  -U SA \
  -P "<SA_PASSWORD>" \
  -C \
  -b \
  -i JobNest.sql
```

Para migraciones posteriores:

```bash
docker exec -i <SQLSERVER_CONTAINER> /opt/mssql-tools18/bin/sqlcmd \
  -S localhost \
  -U SA \
  -P "<SA_PASSWORD>" \
  -C \
  -b \
  -d JobNest \
  -i database/migrations/migracion_v2_compatibilidad_esquema.sql
```

Para el catalogo obligatorio de categorias:

```bash
docker exec -i <SQLSERVER_CONTAINER> /opt/mssql-tools18/bin/sqlcmd \
  -S localhost \
  -U SA \
  -P "<SA_PASSWORD>" \
  -C \
  -b \
  -d JobNest \
  -i database/migrations/migracion_catalogo_categorias.sql
```

Para los catalogos operativos de pago:

```bash
docker exec -i <SQLSERVER_CONTAINER> /opt/mssql-tools18/bin/sqlcmd \
  -S localhost \
  -U SA \
  -P "<SA_PASSWORD>" \
  -C \
  -b \
  -d JobNest \
  -i database/migrations/migracion_catalogos_pago.sql
```

Para la integridad de resenas por solicitud:

```bash
docker exec -i <SQLSERVER_CONTAINER> /opt/mssql-tools18/bin/sqlcmd \
  -S localhost \
  -U SA \
  -P "<SA_PASSWORD>" \
  -C \
  -b \
  -d JobNest \
  -i database/migrations/migracion_integridad_solicitudes_resenas.sql
```

La base activa del proyecto debe llamarse `JobNest`. La migracion V2 mantiene `USE JobNest` para evitar ejecutar cambios sobre otra base por accidente.

Usa `-C` solo en entornos donde el certificado del servidor sea confiable para desarrollo o despliegue controlado. En produccion final debe usarse un certificado valido.

## Scripts historicos conocidos

- `JobNest.sql` contiene separadores heredados escritos como `go;`. Antes de ejecutarlo con `sqlcmd`, deben normalizarse a `GO` en una linea independiente, hasta que el script sea corregido formalmente.
- `migracion_publicaciones_versiones_imagenes.sql` contiene un `UPDATE` que utiliza una columna agregada en el mismo batch.
- `migracion_admin_control.sql` contiene un caso equivalente, donde un `UPDATE` depende de una columna creada en el mismo batch.
- Para una instalacion limpia, esos `ALTER TABLE` y `UPDATE` deben separarse con `GO` en lineas independientes.
- Estas observaciones corresponden a scripts historicos y no afectan la nueva migracion V2 de compatibilidad.

## Verificacion

Lista tablas y columnas principales:

```sql
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
ORDER BY TABLE_SCHEMA, TABLE_NAME;

SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN (
  'Personas',
  'Hilos',
  'Resenas',
  'PortafolioTrabajos',
  'Publicaciones',
  'PublicacionVersiones',
  'PublicacionImagenes'
)
ORDER BY TABLE_NAME, ORDINAL_POSITION;
```

Verifica compatibilidad V2:

```sql
SELECT COL_LENGTH('dbo.Personas', 'FotoPerfil') AS Personas_FotoPerfil;
SELECT COL_LENGTH('dbo.Hilos', 'SolicitudServicioId') AS Hilos_SolicitudServicioId;
SELECT COL_LENGTH('dbo.Resenas', 'SolicitudServicioId') AS Resenas_SolicitudServicioId;
SELECT OBJECT_ID('dbo.PortafolioTrabajos', 'U') AS PortafolioTrabajos;
```

## Idempotencia

Cada migracion nueva debe poder ejecutarse mas de una vez. Antes de agregar objetos usa:

- `COL_LENGTH` para columnas.
- `OBJECT_ID` para tablas.
- `sys.indexes` para indices.
- `sys.foreign_keys`, `sys.default_constraints` o `sys.check_constraints` para restricciones.

Si una migracion agrega una columna y despues actualiza datos usando esa columna, separa el `ALTER TABLE` y el `UPDATE` con `GO` en lineas independientes.

## Migracion V2 de compatibilidad

`database/migrations/migracion_v2_compatibilidad_esquema.sql` corrige diferencias reales entre el esquema base historico y el backend actual:

- Agrega `Personas.FotoPerfil` para foto de perfil web/movil.
- Agrega `Hilos.SolicitudServicioId` para mensajeria de solicitudes V2.
- Agrega `Resenas.SolicitudServicioId` para calificaciones por solicitud V2.
- Crea `PortafolioTrabajos` para el portafolio del prestador.

La migracion no elimina datos, no inserta usuarios, no crea datos de prueba y no modifica contrasenas.

## Catalogo obligatorio de categorias

`database/migrations/migracion_catalogo_categorias.sql` prepara el catalogo oficial de categorias/oficios para instalaciones nuevas de JobNest V2.

Este catalogo es dato operativo obligatorio, no un seed de prueba. Permite que web V2 y la app movil puedan listar categorias y crear la primera publicacion aunque la base aun no tenga publicaciones aprobadas.

La migracion reutiliza `dbo.Categorias` si ya existe en el esquema historico, agrega columnas de control faltantes de forma idempotente y carga 15 oficios oficiales sin duplicar por nombre o slug.

Antes de crear indices unicos, la migracion revisa nombres y slugs historicos normalizados con `LTRIM/RTRIM` y la intercalacion real de SQL Server. Si encuentra duplicados, se detiene con un error controlado para que se resuelvan manualmente.

La migracion no elimina, fusiona ni reescribe categorias historicas arbitrarias. Las categorias historicas sin slug permanecen con `Slug NULL`; SQL Server permite varios `NULL` porque el indice unico de slug es filtrado. Solo las 15 categorias oficiales reciben slugs deterministas.

## Catalogos operativos de pago

`database/migrations/migracion_catalogos_pago.sql` carga los valores minimos que el backend V2 necesita para procesar pagos:

- `MetodosPago.Nombre = 'Efectivo'`
- `MetodosPago.Nombre = 'Tarjeta'`
- `Estatus.Nombre = 'completado'`

Estos registros son datos operativos obligatorios, no seeds de prueba. La migracion verifica que las tablas y columnas existan, inserta solo valores faltantes y puede ejecutarse mas de una vez sin duplicarlos.

## Integridad de resenas por solicitud

`database/migrations/migracion_integridad_solicitudes_resenas.sql` evita que un mismo usuario califique dos veces la misma solicitud de servicio.

Antes de crear el indice unico filtrado `UX_Resenas_Solicitud_Revisor`, la migracion revisa si ya existen duplicados historicos por `SolicitudServicioId` y `RevisorId`. Si encuentra duplicados, se detiene con un error controlado para que el equipo los revise manualmente; no elimina, fusiona ni modifica resenas existentes.

El indice es filtrado para mantener compatibilidad con resenas historicas ligadas solo a `OrdenId`.
