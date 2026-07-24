-- Migracion V2: moderacion avanzada de publicaciones, versiones e imagenes.
-- Idempotente para SQL Server.

IF COL_LENGTH('Publicaciones', 'EstadoRevision') IS NULL
    ALTER TABLE Publicaciones ADD EstadoRevision NVARCHAR(30) NOT NULL
        CONSTRAINT DF_Publicaciones_EstadoRevision DEFAULT 'aprobada';

IF COL_LENGTH('Publicaciones', 'RevisadoPor') IS NULL
    ALTER TABLE Publicaciones ADD RevisadoPor INT NULL;

IF COL_LENGTH('Publicaciones', 'FechaRevision') IS NULL
    ALTER TABLE Publicaciones ADD FechaRevision DATETIME NULL;

IF COL_LENGTH('Publicaciones', 'ComentarioRevision') IS NULL
    ALTER TABLE Publicaciones ADD ComentarioRevision NVARCHAR(500) NULL;

IF COL_LENGTH('Publicaciones', 'FechaActualizacion') IS NULL
    ALTER TABLE Publicaciones ADD FechaActualizacion DATETIME NULL;

IF OBJECT_ID('PublicacionVersiones', 'U') IS NULL
    CREATE TABLE PublicacionVersiones (
        id INT IDENTITY(1,1) PRIMARY KEY,
        PublicacionId INT NOT NULL,
        VersionNumero INT NOT NULL,
        Titulo NVARCHAR(255) NOT NULL,
        Descripcion NVARCHAR(MAX) NULL,
        Categoria NVARCHAR(100) NOT NULL,
        Precio DECIMAL(10,2) NULL,
        Ubicacion NVARCHAR(255) NULL,
        Experiencia INT NULL,
        Habilidades NVARCHAR(500) NULL,
        Disponibilidad NVARCHAR(100) NULL,
        IncluyeMateriales BIT NOT NULL DEFAULT 0,
        TipoPrecio NVARCHAR(20) NULL,
        Estado NVARCHAR(40) NOT NULL DEFAULT 'pendiente_revision',
        AutorId INT NOT NULL,
        RevisadoPor INT NULL,
        Observaciones NVARCHAR(MAX) NULL,
        MotivoRechazo NVARCHAR(MAX) NULL,
        EsVersionPublica BIT NOT NULL DEFAULT 0,
        CreadoEn DATETIME NOT NULL DEFAULT GETDATE(),
        RevisadoEn DATETIME NULL,
        ActualizadoEn DATETIME NULL,
        FOREIGN KEY (PublicacionId) REFERENCES Publicaciones(id),
        FOREIGN KEY (AutorId) REFERENCES Usuarios(id)
    );

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PublicacionVersiones_Publicacion_Numero' AND object_id = OBJECT_ID('PublicacionVersiones'))
    CREATE UNIQUE INDEX UX_PublicacionVersiones_Publicacion_Numero ON PublicacionVersiones(PublicacionId, VersionNumero);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PublicacionVersiones_Estado' AND object_id = OBJECT_ID('PublicacionVersiones'))
    CREATE INDEX IX_PublicacionVersiones_Estado ON PublicacionVersiones(Estado, CreadoEn DESC);

IF OBJECT_ID('PublicacionImagenes', 'U') IS NULL
    CREATE TABLE PublicacionImagenes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        PublicacionId INT NOT NULL,
        VersionId INT NOT NULL,
        UsuarioId INT NOT NULL,
        ImagenUrl NVARCHAR(500) NOT NULL,
        NombreArchivo NVARCHAR(255) NOT NULL,
        MimeType NVARCHAR(80) NOT NULL,
        TamanoBytes INT NOT NULL,
        Posicion INT NOT NULL DEFAULT 0,
        EsPrincipal BIT NOT NULL DEFAULT 0,
        EstadoRevision NVARCHAR(30) NOT NULL DEFAULT 'pendiente',
        MotivoRechazo NVARCHAR(MAX) NULL,
        CreadoEn DATETIME NOT NULL DEFAULT GETDATE(),
        RevisadoPor INT NULL,
        RevisadoEn DATETIME NULL,
        EliminadoEn DATETIME NULL,
        FOREIGN KEY (PublicacionId) REFERENCES Publicaciones(id),
        FOREIGN KEY (VersionId) REFERENCES PublicacionVersiones(id),
        FOREIGN KEY (UsuarioId) REFERENCES Usuarios(id)
    );

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PublicacionImagenes_Publica' AND object_id = OBJECT_ID('PublicacionImagenes'))
    CREATE INDEX IX_PublicacionImagenes_Publica ON PublicacionImagenes(PublicacionId, VersionId, EstadoRevision, Posicion);

IF OBJECT_ID('PublicacionRevisiones', 'U') IS NULL
    CREATE TABLE PublicacionRevisiones (
        id INT IDENTITY(1,1) PRIMARY KEY,
        PublicacionId INT NOT NULL,
        VersionId INT NOT NULL,
        AdministradorId INT NOT NULL,
        Accion NVARCHAR(60) NOT NULL,
        EstadoAnterior NVARCHAR(40) NULL,
        EstadoNuevo NVARCHAR(40) NOT NULL,
        Observaciones NVARCHAR(MAX) NULL,
        EsNotaInterna BIT NOT NULL DEFAULT 0,
        CreadoEn DATETIME NOT NULL DEFAULT GETDATE(),
        FOREIGN KEY (PublicacionId) REFERENCES Publicaciones(id),
        FOREIGN KEY (VersionId) REFERENCES PublicacionVersiones(id),
        FOREIGN KEY (AdministradorId) REFERENCES Usuarios(id)
    );

IF OBJECT_ID('AlertasSistema', 'U') IS NULL
    CREATE TABLE AlertasSistema (
        id INT IDENTITY(1,1) PRIMARY KEY,
        UsuarioId INT NULL,
        RolDestino NVARCHAR(40) NULL,
        Tipo NVARCHAR(80) NOT NULL,
        Titulo NVARCHAR(180) NOT NULL,
        Mensaje NVARCHAR(MAX) NOT NULL,
        PublicacionId INT NULL,
        VersionId INT NULL,
        Leida BIT NOT NULL DEFAULT 0,
        CreadoEn DATETIME NOT NULL DEFAULT GETDATE(),
        LeidaEn DATETIME NULL,
        FOREIGN KEY (UsuarioId) REFERENCES Usuarios(id)
    );

UPDATE Publicaciones
SET EstadoRevision = CASE WHEN Activa = 1 THEN 'aprobada' ELSE 'pendiente_revision' END
WHERE EstadoRevision IS NULL OR EstadoRevision IN ('', 'pendiente');

INSERT INTO PublicacionVersiones (
    PublicacionId, VersionNumero, Titulo, Descripcion, Categoria, Precio, Ubicacion,
    Experiencia, Habilidades, Disponibilidad, IncluyeMateriales, TipoPrecio, Estado,
    AutorId, EsVersionPublica, CreadoEn, RevisadoEn
)
SELECT p.id, 1, p.Titulo, CAST(p.Descripcion AS NVARCHAR(MAX)), p.Categoria, p.Precio, p.Ubicacion,
       p.Experiencia, p.Habilidades, p.Disponibilidad, p.IncluyeMateriales, p.TipoPrecio,
       CASE WHEN p.Activa = 1 AND p.EstadoRevision = 'aprobada' THEN 'aprobada' ELSE 'pendiente_revision' END,
       p.UsuarioId,
       CASE WHEN p.Activa = 1 AND p.EstadoRevision = 'aprobada' THEN 1 ELSE 0 END,
       p.FechaCreacion,
       CASE WHEN p.Activa = 1 AND p.EstadoRevision = 'aprobada' THEN ISNULL(p.FechaRevision, p.FechaCreacion) ELSE NULL END
FROM Publicaciones p
WHERE NOT EXISTS (SELECT 1 FROM PublicacionVersiones pv WHERE pv.PublicacionId = p.id);
