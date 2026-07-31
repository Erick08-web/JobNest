USE JobNest;
GO

SET ANSI_NULLS ON;
GO

SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.Categorias', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Categorias (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Categorias PRIMARY KEY,
        Nombre NVARCHAR(150) NOT NULL,
        ParentId INT NULL,
        Slug NVARCHAR(160) NULL,
        Descripcion NVARCHAR(255) NULL,
        Activa BIT NOT NULL CONSTRAINT DF_Categorias_Activa DEFAULT 1,
        Orden INT NULL,
        CreadoEn DATETIME2 NOT NULL CONSTRAINT DF_Categorias_CreadoEn DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Categorias_Parent FOREIGN KEY (ParentId) REFERENCES dbo.Categorias(id)
    );
END;
GO

IF OBJECT_ID(N'dbo.Categorias', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Categorias', N'Slug') IS NULL
BEGIN
    ALTER TABLE dbo.Categorias ADD Slug NVARCHAR(160) NULL;
END;
GO

IF OBJECT_ID(N'dbo.Categorias', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Categorias', N'Descripcion') IS NULL
BEGIN
    ALTER TABLE dbo.Categorias ADD Descripcion NVARCHAR(255) NULL;
END;
GO

IF OBJECT_ID(N'dbo.Categorias', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Categorias', N'Activa') IS NULL
BEGIN
    ALTER TABLE dbo.Categorias
    ADD Activa BIT NOT NULL
        CONSTRAINT DF_Categorias_Activa_Legacy DEFAULT 1;
END;
GO

IF OBJECT_ID(N'dbo.Categorias', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Categorias', N'Orden') IS NULL
BEGIN
    ALTER TABLE dbo.Categorias ADD Orden INT NULL;
END;
GO

IF OBJECT_ID(N'dbo.Categorias', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Categorias', N'CreadoEn') IS NULL
BEGIN
    ALTER TABLE dbo.Categorias
    ADD CreadoEn DATETIME2 NOT NULL
        CONSTRAINT DF_Categorias_CreadoEn_Legacy DEFAULT SYSUTCDATETIME();
END;
GO

IF OBJECT_ID(N'dbo.Categorias', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Categorias', N'ParentId') IS NOT NULL
   AND COL_LENGTH(N'dbo.Categorias', N'id') IS NOT NULL
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
       WHERE parent_table.object_id = OBJECT_ID(N'dbo.Categorias')
         AND parent_column.name = N'ParentId'
         AND referenced_table.object_id = OBJECT_ID(N'dbo.Categorias')
         AND referenced_column.name = N'id'
   )
BEGIN
    ALTER TABLE dbo.Categorias WITH CHECK
    ADD CONSTRAINT FK_Categorias_Parent
        FOREIGN KEY (ParentId) REFERENCES dbo.Categorias(id);
END;
GO

IF OBJECT_ID(N'dbo.Categorias', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Categorias', N'Nombre') IS NOT NULL
   AND EXISTS (
       SELECT 1
       FROM dbo.Categorias
       WHERE Nombre IS NOT NULL
       GROUP BY LTRIM(RTRIM(Nombre))
       HAVING COUNT(*) > 1
   )
BEGIN
    THROW 51000, 'No se puede crear UX_Categorias_Nombre porque existen nombres de categorias duplicados que requieren resolucion manual.', 1;
END;
GO

IF OBJECT_ID(N'dbo.Categorias', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Categorias', N'Slug') IS NOT NULL
   AND EXISTS (
       SELECT 1
       FROM dbo.Categorias
       WHERE Slug IS NOT NULL
       GROUP BY LTRIM(RTRIM(Slug))
       HAVING COUNT(*) > 1
   )
BEGIN
    THROW 51001, 'No se puede crear UX_Categorias_Slug porque existen slugs de categorias duplicados que requieren resolucion manual.', 1;
END;
GO

IF OBJECT_ID(N'dbo.Categorias', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Categorias', N'Nombre') IS NOT NULL
   AND COL_LENGTH(N'dbo.Categorias', N'Slug') IS NOT NULL
BEGIN
    DECLARE @CategoriasOficiales TABLE (
        Nombre NVARCHAR(150) NOT NULL,
        Slug NVARCHAR(160) NOT NULL,
        Descripcion NVARCHAR(255) NOT NULL,
        Orden INT NOT NULL
    );

    INSERT INTO @CategoriasOficiales (Nombre, Slug, Descripcion, Orden)
    VALUES
        (N'Plomería', N'plomeria', N'Servicios de tuberías, fugas, instalaciones y mantenimiento hidráulico.', 10),
        (N'Electricidad', N'electricidad', N'Instalaciones, reparaciones eléctricas y mantenimiento preventivo.', 20),
        (N'Carpintería', N'carpinteria', N'Trabajos en madera, muebles, puertas y acabados.', 30),
        (N'Pintura', N'pintura', N'Pintura residencial, comercial, acabados y resanes.', 40),
        (N'Albañilería', N'albanileria', N'Construcción, remodelaciones, reparaciones y obra menor.', 50),
        (N'Jardinería', N'jardineria', N'Mantenimiento de jardines, poda, riego y áreas verdes.', 60),
        (N'Limpieza', N'limpieza', N'Limpieza doméstica, profunda, oficinas y mantenimiento general.', 70),
        (N'Cerrajería', N'cerrajeria', N'Apertura, instalación y reparación de cerraduras.', 80),
        (N'Reparación de electrodomésticos', N'reparacion-de-electrodomesticos', N'Diagnóstico y reparación de equipos del hogar.', 90),
        (N'Instalación de aire acondicionado', N'instalacion-de-aire-acondicionado', N'Instalación, mantenimiento y revisión de equipos de climatización.', 100),
        (N'Mecánica', N'mecanica', N'Mantenimiento, diagnóstico y reparación mecánica.', 110),
        (N'Tecnología y soporte', N'tecnologia-y-soporte', N'Soporte técnico, instalación de software, redes y asistencia digital.', 120),
        (N'Mudanzas', N'mudanzas', N'Traslados, carga, descarga y apoyo logístico.', 130),
        (N'Fotografía', N'fotografia', N'Fotografía de eventos, producto, retrato y sesiones profesionales.', 140),
        (N'Clases particulares', N'clases-particulares', N'Apoyo académico, tutorías, idiomas y capacitación personalizada.', 150);

    IF EXISTS (
        SELECT 1
        FROM dbo.Categorias c
        INNER JOIN @CategoriasOficiales oficial
            ON LTRIM(RTRIM(c.Slug)) = oficial.Slug
        WHERE c.Slug IS NOT NULL
          AND LTRIM(RTRIM(c.Nombre)) <> oficial.Nombre
    )
    BEGIN
        THROW 51002, 'No se puede cargar el catalogo oficial porque un slug oficial ya esta usado por otra categoria.', 1;
    END;

    UPDATE c
    SET Slug = oficial.Slug,
        Descripcion = COALESCE(c.Descripcion, oficial.Descripcion),
        Orden = COALESCE(c.Orden, oficial.Orden)
    FROM dbo.Categorias c
    INNER JOIN @CategoriasOficiales oficial
        ON LTRIM(RTRIM(c.Nombre)) = oficial.Nombre
    WHERE c.Slug IS NULL
       OR LTRIM(RTRIM(c.Slug)) <> oficial.Slug;

    INSERT INTO dbo.Categorias (Nombre, Slug, Descripcion, Activa, Orden)
    SELECT oficial.Nombre, oficial.Slug, oficial.Descripcion, 1, oficial.Orden
    FROM @CategoriasOficiales oficial
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.Categorias c
        WHERE LTRIM(RTRIM(c.Nombre)) = oficial.Nombre
           OR LTRIM(RTRIM(c.Slug)) = oficial.Slug
    );
END;
GO

IF OBJECT_ID(N'dbo.Categorias', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Categorias', N'Nombre') IS NOT NULL
   AND COL_LENGTH(N'dbo.Categorias', N'Slug') IS NOT NULL
   AND EXISTS (
       SELECT 1
       FROM dbo.Categorias
       WHERE Slug IS NOT NULL
       GROUP BY LTRIM(RTRIM(Slug))
       HAVING COUNT(*) > 1
   )
BEGIN
    THROW 51003, 'No se puede crear UX_Categorias_Slug porque la carga del catalogo detecto slugs duplicados.', 1;
END;
GO

IF OBJECT_ID(N'dbo.Categorias', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Categorias', N'Nombre') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = N'UX_Categorias_Nombre'
         AND object_id = OBJECT_ID(N'dbo.Categorias')
   )
BEGIN
    CREATE UNIQUE INDEX UX_Categorias_Nombre
        ON dbo.Categorias(Nombre)
        WHERE Nombre IS NOT NULL;
END;
GO

IF OBJECT_ID(N'dbo.Categorias', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Categorias', N'Slug') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = N'UX_Categorias_Slug'
         AND object_id = OBJECT_ID(N'dbo.Categorias')
   )
BEGIN
    CREATE UNIQUE INDEX UX_Categorias_Slug
        ON dbo.Categorias(Slug)
        WHERE Slug IS NOT NULL;
END;
GO
