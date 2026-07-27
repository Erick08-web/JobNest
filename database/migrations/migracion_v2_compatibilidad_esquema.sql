USE JobNest;
GO

SET ANSI_NULLS ON;
GO

SET QUOTED_IDENTIFIER ON;
GO

-- Compatibilidad JobNest V2.
-- Corrige diferencias entre el esquema base historico y las consultas actuales
-- del backend Flask/JobNest V2 sin eliminar ni renombrar objetos existentes.

IF OBJECT_ID(N'dbo.Personas', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Personas', N'FotoPerfil') IS NULL
BEGIN
    ALTER TABLE dbo.Personas
    ADD FotoPerfil NVARCHAR(500) NULL;
END;
GO

IF OBJECT_ID(N'dbo.Hilos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Hilos', N'SolicitudServicioId') IS NULL
BEGIN
    ALTER TABLE dbo.Hilos
    ADD SolicitudServicioId INT NULL;
END;
GO

IF OBJECT_ID(N'dbo.Resenas', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Resenas', N'SolicitudServicioId') IS NULL
BEGIN
    ALTER TABLE dbo.Resenas
    ADD SolicitudServicioId INT NULL;
END;
GO

IF OBJECT_ID(N'dbo.PortafolioTrabajos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PortafolioTrabajos (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PortafolioTrabajos PRIMARY KEY,
        PublicacionId INT NOT NULL,
        PrestadorId INT NOT NULL,
        Titulo NVARCHAR(255) NOT NULL,
        Descripcion NVARCHAR(MAX) NULL,
        ImagenUrl NVARCHAR(500) NOT NULL,
        Activo BIT NOT NULL CONSTRAINT DF_PortafolioTrabajos_Activo DEFAULT 1,
        CreadoEn DATETIME NOT NULL CONSTRAINT DF_PortafolioTrabajos_CreadoEn DEFAULT GETDATE()
    );
END;
GO

IF OBJECT_ID(N'dbo.PortafolioTrabajos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.PortafolioTrabajos', N'PublicacionId') IS NULL
BEGIN
    ALTER TABLE dbo.PortafolioTrabajos ADD PublicacionId INT NULL;
END;
GO

IF OBJECT_ID(N'dbo.PortafolioTrabajos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.PortafolioTrabajos', N'PrestadorId') IS NULL
BEGIN
    ALTER TABLE dbo.PortafolioTrabajos ADD PrestadorId INT NULL;
END;
GO

IF OBJECT_ID(N'dbo.PortafolioTrabajos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.PortafolioTrabajos', N'Titulo') IS NULL
BEGIN
    ALTER TABLE dbo.PortafolioTrabajos ADD Titulo NVARCHAR(255) NULL;
END;
GO

IF OBJECT_ID(N'dbo.PortafolioTrabajos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.PortafolioTrabajos', N'Descripcion') IS NULL
BEGIN
    ALTER TABLE dbo.PortafolioTrabajos ADD Descripcion NVARCHAR(MAX) NULL;
END;
GO

IF OBJECT_ID(N'dbo.PortafolioTrabajos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.PortafolioTrabajos', N'ImagenUrl') IS NULL
BEGIN
    ALTER TABLE dbo.PortafolioTrabajos ADD ImagenUrl NVARCHAR(500) NULL;
END;
GO

IF OBJECT_ID(N'dbo.PortafolioTrabajos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.PortafolioTrabajos', N'Activo') IS NULL
BEGIN
    ALTER TABLE dbo.PortafolioTrabajos
    ADD Activo BIT NOT NULL
        CONSTRAINT DF_PortafolioTrabajos_Activo_Legacy DEFAULT 1;
END;
GO

IF OBJECT_ID(N'dbo.PortafolioTrabajos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.PortafolioTrabajos', N'CreadoEn') IS NULL
BEGIN
    ALTER TABLE dbo.PortafolioTrabajos
    ADD CreadoEn DATETIME NOT NULL
        CONSTRAINT DF_PortafolioTrabajos_CreadoEn_Legacy DEFAULT GETDATE();
END;
GO

IF OBJECT_ID(N'dbo.Hilos', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.SolicitudesServicios', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Hilos', N'SolicitudServicioId') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys fk
       INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
       INNER JOIN sys.tables parent_table ON fkc.parent_object_id = parent_table.object_id
       INNER JOIN sys.columns parent_column
           ON fkc.parent_object_id = parent_column.object_id
          AND fkc.parent_column_id = parent_column.column_id
       INNER JOIN sys.tables referenced_table ON fkc.referenced_object_id = referenced_table.object_id
       INNER JOIN sys.columns referenced_column
           ON fkc.referenced_object_id = referenced_column.object_id
          AND fkc.referenced_column_id = referenced_column.column_id
       WHERE parent_table.object_id = OBJECT_ID(N'dbo.Hilos')
         AND parent_column.name = N'SolicitudServicioId'
         AND referenced_table.object_id = OBJECT_ID(N'dbo.SolicitudesServicios')
         AND referenced_column.name = N'id'
   )
BEGIN
    ALTER TABLE dbo.Hilos WITH CHECK
    ADD CONSTRAINT FK_Hilos_SolicitudesServicios
        FOREIGN KEY (SolicitudServicioId) REFERENCES dbo.SolicitudesServicios(id);
END;
GO

IF OBJECT_ID(N'dbo.Resenas', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.SolicitudesServicios', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Resenas', N'SolicitudServicioId') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys fk
       INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
       INNER JOIN sys.tables parent_table ON fkc.parent_object_id = parent_table.object_id
       INNER JOIN sys.columns parent_column
           ON fkc.parent_object_id = parent_column.object_id
          AND fkc.parent_column_id = parent_column.column_id
       INNER JOIN sys.tables referenced_table ON fkc.referenced_object_id = referenced_table.object_id
       INNER JOIN sys.columns referenced_column
           ON fkc.referenced_object_id = referenced_column.object_id
          AND fkc.referenced_column_id = referenced_column.column_id
       WHERE parent_table.object_id = OBJECT_ID(N'dbo.Resenas')
         AND parent_column.name = N'SolicitudServicioId'
         AND referenced_table.object_id = OBJECT_ID(N'dbo.SolicitudesServicios')
         AND referenced_column.name = N'id'
   )
BEGIN
    ALTER TABLE dbo.Resenas WITH CHECK
    ADD CONSTRAINT FK_Resenas_SolicitudesServicios
        FOREIGN KEY (SolicitudServicioId) REFERENCES dbo.SolicitudesServicios(id);
END;
GO

IF OBJECT_ID(N'dbo.PortafolioTrabajos', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.Publicaciones', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.PortafolioTrabajos', N'PublicacionId') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys fk
       INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
       INNER JOIN sys.tables parent_table ON fkc.parent_object_id = parent_table.object_id
       INNER JOIN sys.columns parent_column
           ON fkc.parent_object_id = parent_column.object_id
          AND fkc.parent_column_id = parent_column.column_id
       INNER JOIN sys.tables referenced_table ON fkc.referenced_object_id = referenced_table.object_id
       INNER JOIN sys.columns referenced_column
           ON fkc.referenced_object_id = referenced_column.object_id
          AND fkc.referenced_column_id = referenced_column.column_id
       WHERE parent_table.object_id = OBJECT_ID(N'dbo.PortafolioTrabajos')
         AND parent_column.name = N'PublicacionId'
         AND referenced_table.object_id = OBJECT_ID(N'dbo.Publicaciones')
         AND referenced_column.name = N'id'
   )
BEGIN
    ALTER TABLE dbo.PortafolioTrabajos WITH CHECK
    ADD CONSTRAINT FK_PortafolioTrabajos_Publicaciones
        FOREIGN KEY (PublicacionId) REFERENCES dbo.Publicaciones(id);
END;
GO

IF OBJECT_ID(N'dbo.PortafolioTrabajos', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.Usuarios', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.PortafolioTrabajos', N'PrestadorId') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys fk
       INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
       INNER JOIN sys.tables parent_table ON fkc.parent_object_id = parent_table.object_id
       INNER JOIN sys.columns parent_column
           ON fkc.parent_object_id = parent_column.object_id
          AND fkc.parent_column_id = parent_column.column_id
       INNER JOIN sys.tables referenced_table ON fkc.referenced_object_id = referenced_table.object_id
       INNER JOIN sys.columns referenced_column
           ON fkc.referenced_object_id = referenced_column.object_id
          AND fkc.referenced_column_id = referenced_column.column_id
       WHERE parent_table.object_id = OBJECT_ID(N'dbo.PortafolioTrabajos')
         AND parent_column.name = N'PrestadorId'
         AND referenced_table.object_id = OBJECT_ID(N'dbo.Usuarios')
         AND referenced_column.name = N'id'
   )
BEGIN
    ALTER TABLE dbo.PortafolioTrabajos WITH CHECK
    ADD CONSTRAINT FK_PortafolioTrabajos_Usuarios
        FOREIGN KEY (PrestadorId) REFERENCES dbo.Usuarios(id);
END;
GO

IF OBJECT_ID(N'dbo.Hilos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Hilos', N'SolicitudServicioId') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = N'IX_Hilos_SolicitudServicioId'
         AND object_id = OBJECT_ID(N'dbo.Hilos')
   )
BEGIN
    CREATE INDEX IX_Hilos_SolicitudServicioId
        ON dbo.Hilos(SolicitudServicioId);
END;
GO

IF OBJECT_ID(N'dbo.Resenas', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Resenas', N'SolicitudServicioId') IS NOT NULL
   AND COL_LENGTH(N'dbo.Resenas', N'RevisorId') IS NOT NULL
   AND COL_LENGTH(N'dbo.Resenas', N'EvaluadoId') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = N'IX_Resenas_Solicitud_Revisor'
         AND object_id = OBJECT_ID(N'dbo.Resenas')
   )
BEGIN
    CREATE INDEX IX_Resenas_Solicitud_Revisor
        ON dbo.Resenas(SolicitudServicioId, RevisorId, EvaluadoId);
END;
GO

IF OBJECT_ID(N'dbo.PortafolioTrabajos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.PortafolioTrabajos', N'PublicacionId') IS NOT NULL
   AND COL_LENGTH(N'dbo.PortafolioTrabajos', N'Activo') IS NOT NULL
   AND COL_LENGTH(N'dbo.PortafolioTrabajos', N'CreadoEn') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = N'IX_PortafolioTrabajos_Publicacion_Activo'
         AND object_id = OBJECT_ID(N'dbo.PortafolioTrabajos')
   )
BEGIN
    CREATE INDEX IX_PortafolioTrabajos_Publicacion_Activo
        ON dbo.PortafolioTrabajos(PublicacionId, Activo, CreadoEn DESC);
END;
GO

IF OBJECT_ID(N'dbo.PortafolioTrabajos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.PortafolioTrabajos', N'PrestadorId') IS NOT NULL
   AND COL_LENGTH(N'dbo.PortafolioTrabajos', N'Activo') IS NOT NULL
   AND COL_LENGTH(N'dbo.PortafolioTrabajos', N'CreadoEn') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = N'IX_PortafolioTrabajos_Prestador_Activo'
         AND object_id = OBJECT_ID(N'dbo.PortafolioTrabajos')
   )
BEGIN
    CREATE INDEX IX_PortafolioTrabajos_Prestador_Activo
        ON dbo.PortafolioTrabajos(PrestadorId, Activo, CreadoEn DESC);
END;
GO
