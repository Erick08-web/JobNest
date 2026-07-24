-- Migracion V2: centro de operaciones administrativas.
-- Idempotente para SQL Server. No elimina datos historicos.

IF COL_LENGTH('Usuarios', 'EstadoCuenta') IS NULL
    ALTER TABLE Usuarios ADD EstadoCuenta NVARCHAR(30) NOT NULL
        CONSTRAINT DF_Usuarios_EstadoCuenta DEFAULT 'activa';

IF COL_LENGTH('Pagos', 'SolicitudServicioId') IS NULL
    ALTER TABLE Pagos ADD SolicitudServicioId INT NULL;

IF OBJECT_ID('AlertasSistema', 'U') IS NULL
    CREATE TABLE AlertasSistema (
        id INT IDENTITY(1,1) PRIMARY KEY,
        UsuarioId INT NULL,
        RolDestino NVARCHAR(40) NULL,
        Tipo NVARCHAR(80) NOT NULL,
        Prioridad NVARCHAR(20) NOT NULL DEFAULT 'media',
        Titulo NVARCHAR(180) NOT NULL,
        Mensaje NVARCHAR(MAX) NOT NULL,
        PublicacionId INT NULL,
        VersionId INT NULL,
        Entidad NVARCHAR(80) NULL,
        EntidadId INT NULL,
        Leida BIT NOT NULL DEFAULT 0,
        CreadoEn DATETIME NOT NULL DEFAULT GETDATE(),
        LeidaEn DATETIME NULL,
        FOREIGN KEY (UsuarioId) REFERENCES Usuarios(id)
    );

IF COL_LENGTH('AlertasSistema', 'Prioridad') IS NULL
    ALTER TABLE AlertasSistema ADD Prioridad NVARCHAR(20) NOT NULL
        CONSTRAINT DF_AlertasSistema_Prioridad DEFAULT 'media';

IF COL_LENGTH('AlertasSistema', 'Entidad') IS NULL
    ALTER TABLE AlertasSistema ADD Entidad NVARCHAR(80) NULL;

IF COL_LENGTH('AlertasSistema', 'EntidadId') IS NULL
    ALTER TABLE AlertasSistema ADD EntidadId INT NULL;

IF OBJECT_ID('BitacoraAdmin', 'U') IS NULL
    CREATE TABLE BitacoraAdmin (
        id INT IDENTITY(1,1) PRIMARY KEY,
        UsuarioId INT NULL,
        ActorId INT NULL,
        RolActor NVARCHAR(40) NULL,
        TipoEvento NVARCHAR(80) NOT NULL,
        Entidad NVARCHAR(80) NOT NULL,
        EntidadId INT NULL,
        Detalle NVARCHAR(MAX) NULL,
        ValorAnterior NVARCHAR(MAX) NULL,
        ValorNuevo NVARCHAR(MAX) NULL,
        IpOrigen NVARCHAR(80) NULL,
        UserAgent NVARCHAR(500) NULL,
        CreadoEn DATETIME NOT NULL DEFAULT GETDATE()
    );

IF COL_LENGTH('BitacoraAdmin', 'RolActor') IS NULL
    ALTER TABLE BitacoraAdmin ADD RolActor NVARCHAR(40) NULL;

IF COL_LENGTH('BitacoraAdmin', 'ValorAnterior') IS NULL
    ALTER TABLE BitacoraAdmin ADD ValorAnterior NVARCHAR(MAX) NULL;

IF COL_LENGTH('BitacoraAdmin', 'ValorNuevo') IS NULL
    ALTER TABLE BitacoraAdmin ADD ValorNuevo NVARCHAR(MAX) NULL;

IF COL_LENGTH('BitacoraAdmin', 'IpOrigen') IS NULL
    ALTER TABLE BitacoraAdmin ADD IpOrigen NVARCHAR(80) NULL;

IF COL_LENGTH('BitacoraAdmin', 'UserAgent') IS NULL
    ALTER TABLE BitacoraAdmin ADD UserAgent NVARCHAR(500) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AlertasSistema_Admin' AND object_id = OBJECT_ID('AlertasSistema'))
    CREATE INDEX IX_AlertasSistema_Admin ON AlertasSistema(Leida, Prioridad, CreadoEn DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_BitacoraAdmin_Consulta' AND object_id = OBJECT_ID('BitacoraAdmin'))
    CREATE INDEX IX_BitacoraAdmin_Consulta ON BitacoraAdmin(TipoEvento, Entidad, CreadoEn DESC);
