-- Migracion V2: panel de control administrador, moderacion y quejas.
-- Este script es idempotente para SQL Server.

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

IF OBJECT_ID('Quejas', 'U') IS NULL
    CREATE TABLE Quejas (
        id INT IDENTITY(1,1) PRIMARY KEY,
        UsuarioId INT NOT NULL,
        TipoUsuario NVARCHAR(30) NOT NULL,
        SolicitudServicioId INT NULL,
        PublicacionId INT NULL,
        Motivo NVARCHAR(120) NOT NULL,
        Descripcion NVARCHAR(MAX) NOT NULL,
        Estado NVARCHAR(30) NOT NULL DEFAULT 'pendiente',
        RespuestaAdmin NVARCHAR(MAX) NULL,
        AtendidaPor INT NULL,
        CreadoEn DATETIME NOT NULL DEFAULT GETDATE(),
        ActualizadoEn DATETIME NULL,
        FOREIGN KEY (UsuarioId) REFERENCES Usuarios(id)
    );

IF OBJECT_ID('BitacoraAdmin', 'U') IS NULL
    CREATE TABLE BitacoraAdmin (
        id INT IDENTITY(1,1) PRIMARY KEY,
        UsuarioId INT NULL,
        ActorId INT NULL,
        TipoEvento NVARCHAR(80) NOT NULL,
        Entidad NVARCHAR(80) NOT NULL,
        EntidadId INT NULL,
        Detalle NVARCHAR(MAX) NULL,
        CreadoEn DATETIME NOT NULL DEFAULT GETDATE()
    );

UPDATE Publicaciones
SET EstadoRevision = CASE WHEN Activa = 1 THEN 'aprobada' ELSE 'pendiente' END
WHERE EstadoRevision IS NULL OR EstadoRevision = '';
