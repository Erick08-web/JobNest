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
   AND COL_LENGTH(N'dbo.Categorias', N'Nombre') IS NOT NULL
   AND COL_LENGTH(N'dbo.Categorias', N'Slug') IS NOT NULL
BEGIN
    UPDATE dbo.Categorias
    SET Slug = LOWER(
        REPLACE(
        REPLACE(
        REPLACE(
        REPLACE(
        REPLACE(
        REPLACE(LTRIM(RTRIM(Nombre)), N' ', N'-'),
            N'á', N'a'),
            N'é', N'e'),
            N'í', N'i'),
            N'ó', N'o'),
            N'ú', N'u')
    )
    WHERE Slug IS NULL
      AND Nombre IS NOT NULL;
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

IF OBJECT_ID(N'dbo.Categorias', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = N'Plomería' OR Slug = N'plomeria')
        INSERT INTO dbo.Categorias (Nombre, Slug, Descripcion, Activa, Orden) VALUES (N'Plomería', N'plomeria', N'Servicios de tuberías, fugas, instalaciones y mantenimiento hidráulico.', 1, 10);

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = N'Electricidad' OR Slug = N'electricidad')
        INSERT INTO dbo.Categorias (Nombre, Slug, Descripcion, Activa, Orden) VALUES (N'Electricidad', N'electricidad', N'Instalaciones, reparaciones eléctricas y mantenimiento preventivo.', 1, 20);

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = N'Carpintería' OR Slug = N'carpinteria')
        INSERT INTO dbo.Categorias (Nombre, Slug, Descripcion, Activa, Orden) VALUES (N'Carpintería', N'carpinteria', N'Trabajos en madera, muebles, puertas y acabados.', 1, 30);

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = N'Pintura' OR Slug = N'pintura')
        INSERT INTO dbo.Categorias (Nombre, Slug, Descripcion, Activa, Orden) VALUES (N'Pintura', N'pintura', N'Pintura residencial, comercial, acabados y resanes.', 1, 40);

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = N'Albañilería' OR Slug = N'albanileria')
        INSERT INTO dbo.Categorias (Nombre, Slug, Descripcion, Activa, Orden) VALUES (N'Albañilería', N'albanileria', N'Construcción, remodelaciones, reparaciones y obra menor.', 1, 50);

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = N'Jardinería' OR Slug = N'jardineria')
        INSERT INTO dbo.Categorias (Nombre, Slug, Descripcion, Activa, Orden) VALUES (N'Jardinería', N'jardineria', N'Mantenimiento de jardines, poda, riego y áreas verdes.', 1, 60);

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = N'Limpieza' OR Slug = N'limpieza')
        INSERT INTO dbo.Categorias (Nombre, Slug, Descripcion, Activa, Orden) VALUES (N'Limpieza', N'limpieza', N'Limpieza doméstica, profunda, oficinas y mantenimiento general.', 1, 70);

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = N'Cerrajería' OR Slug = N'cerrajeria')
        INSERT INTO dbo.Categorias (Nombre, Slug, Descripcion, Activa, Orden) VALUES (N'Cerrajería', N'cerrajeria', N'Apertura, instalación y reparación de cerraduras.', 1, 80);

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = N'Reparación de electrodomésticos' OR Slug = N'reparacion-de-electrodomesticos')
        INSERT INTO dbo.Categorias (Nombre, Slug, Descripcion, Activa, Orden) VALUES (N'Reparación de electrodomésticos', N'reparacion-de-electrodomesticos', N'Diagnóstico y reparación de equipos del hogar.', 1, 90);

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = N'Instalación de aire acondicionado' OR Slug = N'instalacion-de-aire-acondicionado')
        INSERT INTO dbo.Categorias (Nombre, Slug, Descripcion, Activa, Orden) VALUES (N'Instalación de aire acondicionado', N'instalacion-de-aire-acondicionado', N'Instalación, mantenimiento y revisión de equipos de climatización.', 1, 100);

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = N'Mecánica' OR Slug = N'mecanica')
        INSERT INTO dbo.Categorias (Nombre, Slug, Descripcion, Activa, Orden) VALUES (N'Mecánica', N'mecanica', N'Mantenimiento, diagnóstico y reparación mecánica.', 1, 110);

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = N'Tecnología y soporte' OR Slug = N'tecnologia-y-soporte')
        INSERT INTO dbo.Categorias (Nombre, Slug, Descripcion, Activa, Orden) VALUES (N'Tecnología y soporte', N'tecnologia-y-soporte', N'Soporte técnico, instalación de software, redes y asistencia digital.', 1, 120);

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = N'Mudanzas' OR Slug = N'mudanzas')
        INSERT INTO dbo.Categorias (Nombre, Slug, Descripcion, Activa, Orden) VALUES (N'Mudanzas', N'mudanzas', N'Traslados, carga, descarga y apoyo logístico.', 1, 130);

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = N'Fotografía' OR Slug = N'fotografia')
        INSERT INTO dbo.Categorias (Nombre, Slug, Descripcion, Activa, Orden) VALUES (N'Fotografía', N'fotografia', N'Fotografía de eventos, producto, retrato y sesiones profesionales.', 1, 140);

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = N'Clases particulares' OR Slug = N'clases-particulares')
        INSERT INTO dbo.Categorias (Nombre, Slug, Descripcion, Activa, Orden) VALUES (N'Clases particulares', N'clases-particulares', N'Apoyo académico, tutorías, idiomas y capacitación personalizada.', 1, 150);
END;
GO
