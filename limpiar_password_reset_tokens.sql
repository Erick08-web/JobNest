USE JobNest;
GO

DELETE FROM PasswordResetTokens
WHERE FechaCreacion < DATEADD(DAY, -30, SYSUTCDATETIME())
  AND (
      Revocado = 1
      OR FechaUso IS NOT NULL
      OR FechaExpiracion < SYSUTCDATETIME()
  );
GO

PRINT 'Limpieza de PasswordResetTokens completada.';
GO
