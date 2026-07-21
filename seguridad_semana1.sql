-- Migracion ED Semana 1: campos preparados para cifrado en reposo.
-- Ejecutar una sola vez sobre la base JobNest antes de guardar datos cifrados.

IF COL_LENGTH('Personas', 'Telefono') IS NOT NULL
    ALTER TABLE Personas ALTER COLUMN Telefono NVARCHAR(MAX) NULL;

IF COL_LENGTH('Mensajes', 'Cuerpo') IS NOT NULL
    ALTER TABLE Mensajes ALTER COLUMN Cuerpo NVARCHAR(MAX) NULL;

IF COL_LENGTH('SolicitudesServicios', 'MensajeCliente') IS NOT NULL
    ALTER TABLE SolicitudesServicios ALTER COLUMN MensajeCliente NVARCHAR(MAX) NULL;

IF COL_LENGTH('Pagos', 'ProcesadorChargeId') IS NOT NULL
    ALTER TABLE Pagos ALTER COLUMN ProcesadorChargeId NVARCHAR(MAX) NULL;

-- Evidencia sugerida de hashing:
-- SELECT TOP 10 id, Email, PasswordHash FROM Usuarios ORDER BY id DESC;

-- Evidencia sugerida de cifrado en reposo:
-- SELECT TOP 10 UsuarioId, Telefono FROM Personas WHERE Telefono IS NOT NULL ORDER BY id DESC;
-- SELECT TOP 10 id, Cuerpo FROM Mensajes ORDER BY id DESC;
-- SELECT TOP 10 id, MensajeCliente FROM SolicitudesServicios WHERE MensajeCliente IS NOT NULL ORDER BY id DESC;
-- SELECT TOP 10 id, ProcesadorChargeId FROM Pagos WHERE ProcesadorChargeId IS NOT NULL ORDER BY id DESC;
