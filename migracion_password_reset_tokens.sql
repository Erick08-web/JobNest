USE JobNest;
GO

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PasswordResetTokens')
BEGIN
    CREATE TABLE PasswordResetTokens (
        id INT IDENTITY(1,1) PRIMARY KEY,
        UsuarioId INT NULL,
        EmailHash CHAR(64) NOT NULL,
        TokenHash CHAR(64) NULL,
        Canal NVARCHAR(20) NOT NULL,
        IpSolicitud NVARCHAR(45) NULL,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaExpiracion DATETIME2 NULL,
        FechaUso DATETIME2 NULL,
        Revocado BIT NOT NULL DEFAULT 0,
        EmailEnviado BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_PasswordResetTokens_Usuarios
            FOREIGN KEY (UsuarioId) REFERENCES Usuarios(id)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PasswordResetTokens_TokenHash')
BEGIN
    CREATE UNIQUE INDEX UX_PasswordResetTokens_TokenHash
    ON PasswordResetTokens(TokenHash)
    WHERE TokenHash IS NOT NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PasswordResetTokens_Usuario')
BEGIN
    CREATE INDEX IX_PasswordResetTokens_Usuario
    ON PasswordResetTokens(UsuarioId, FechaCreacion DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PasswordResetTokens_EmailHash')
BEGIN
    CREATE INDEX IX_PasswordResetTokens_EmailHash
    ON PasswordResetTokens(EmailHash, FechaCreacion DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PasswordResetTokens_Ip')
BEGIN
    CREATE INDEX IX_PasswordResetTokens_Ip
    ON PasswordResetTokens(IpSolicitud, FechaCreacion DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PasswordResetTokens_Expiracion')
BEGIN
    CREATE INDEX IX_PasswordResetTokens_Expiracion
    ON PasswordResetTokens(FechaExpiracion);
END;
GO

PRINT 'Migracion PasswordResetTokens aplicada correctamente.';
GO
