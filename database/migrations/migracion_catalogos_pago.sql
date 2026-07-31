USE JobNest;
GO

IF OBJECT_ID(N'dbo.MetodosPago', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.MetodosPago', N'Nombre') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM dbo.MetodosPago
       WHERE Nombre = 'Efectivo'
   )
BEGIN
    INSERT INTO dbo.MetodosPago (Nombre)
    VALUES ('Efectivo');
END;
GO

IF OBJECT_ID(N'dbo.MetodosPago', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.MetodosPago', N'Nombre') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM dbo.MetodosPago
       WHERE Nombre = 'Tarjeta'
   )
BEGIN
    INSERT INTO dbo.MetodosPago (Nombre)
    VALUES ('Tarjeta');
END;
GO

IF OBJECT_ID(N'dbo.Estatus', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Estatus', N'Nombre') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM dbo.Estatus
       WHERE Nombre = 'completado'
   )
BEGIN
    INSERT INTO dbo.Estatus (Nombre)
    VALUES ('completado');
END;
GO
