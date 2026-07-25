IF OBJECT_ID('dbo.MobileRefreshTokens', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MobileRefreshTokens (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MobileRefreshTokens PRIMARY KEY,
        UsuarioId INT NOT NULL,
        Jti NVARCHAR(64) NOT NULL,
        TokenHash CHAR(64) NOT NULL,
        CreadoEn DATETIME2 NOT NULL CONSTRAINT DF_MobileRefreshTokens_CreadoEn DEFAULT SYSUTCDATETIME(),
        ExpiraEn DATETIME2 NOT NULL,
        RevocadoEn DATETIME2 NULL,
        ReemplazadoPorJti NVARCHAR(64) NULL,
        Dispositivo NVARCHAR(255) NULL,
        UltimoUsoEn DATETIME2 NULL,
        CONSTRAINT FK_MobileRefreshTokens_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(id)
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_MobileRefreshTokens_Jti'
      AND object_id = OBJECT_ID('dbo.MobileRefreshTokens')
)
BEGIN
    CREATE UNIQUE INDEX UX_MobileRefreshTokens_Jti ON dbo.MobileRefreshTokens (Jti);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_MobileRefreshTokens_TokenHash'
      AND object_id = OBJECT_ID('dbo.MobileRefreshTokens')
)
BEGIN
    CREATE UNIQUE INDEX UX_MobileRefreshTokens_TokenHash ON dbo.MobileRefreshTokens (TokenHash);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_MobileRefreshTokens_UsuarioId_RevocadoEn'
      AND object_id = OBJECT_ID('dbo.MobileRefreshTokens')
)
BEGIN
    CREATE INDEX IX_MobileRefreshTokens_UsuarioId_RevocadoEn
        ON dbo.MobileRefreshTokens (UsuarioId, RevocadoEn, ExpiraEn);
END;
