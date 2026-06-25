# JobNest

Aplicación web Flask para conectar clientes con prestadores de servicios.

## Configuración local

1. Crea y activa un entorno virtual.
2. Instala las dependencias:

   ```bash
   pip install -r requirements.txt
   ```

3. Copia `.env.example` a `.env` y reemplaza los valores de ejemplo.
4. Exporta las variables antes de iniciar la aplicación. El archivo `.env`
   no se carga automáticamente ni debe subirse al repositorio.
5. Ejecuta:

   ```bash
   flask --app application run --debug
   ```

## Variables obligatorias

- `FLASK_SECRET_KEY`
- `DB_SERVER`
- `DB_USER`
- `DB_PASSWORD`

Las variables de correo son necesarias para las funciones de notificación.

## Seguridad

No guardes contraseñas, cadenas de conexión, archivos `.env`, perfiles
subidos por usuarios ni paquetes ZIP dentro del repositorio.
