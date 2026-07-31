USE JobNest;
GO

SET ANSI_NULLS ON;
GO

SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.Resenas', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Resenas', N'SolicitudServicioId') IS NOT NULL
   AND COL_LENGTH(N'dbo.Resenas', N'RevisorId') IS NOT NULL
   AND EXISTS (
       SELECT 1
       FROM dbo.Resenas
       WHERE SolicitudServicioId IS NOT NULL
         AND RevisorId IS NOT NULL
       GROUP BY SolicitudServicioId, RevisorId
       HAVING COUNT(*) > 1
   )
BEGIN
    THROW 51020, 'No se puede crear UX_Resenas_Solicitud_Revisor porque existen resenas duplicadas para la misma solicitud y revisor.', 1;
END;
GO

IF OBJECT_ID(N'dbo.Resenas', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Resenas', N'SolicitudServicioId') IS NOT NULL
   AND COL_LENGTH(N'dbo.Resenas', N'RevisorId') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = N'UX_Resenas_Solicitud_Revisor'
         AND object_id = OBJECT_ID(N'dbo.Resenas')
   )
BEGIN
    CREATE UNIQUE INDEX UX_Resenas_Solicitud_Revisor
        ON dbo.Resenas(SolicitudServicioId, RevisorId)
        WHERE SolicitudServicioId IS NOT NULL
          AND RevisorId IS NOT NULL;
END;
GO
