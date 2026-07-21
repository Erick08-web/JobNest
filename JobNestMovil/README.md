# JobNestMovil

Aplicacion movil inicial de JobNest construida con Expo Go y Expo SDK 54.

## Ejecutar

```bash
cd /Users/erick/Desktop/JobNest/JobNestMovil
npm start
```

Escanea el QR con Expo Go.

## Backend

Para que Expo Go pueda conectarse desde el telefono, el backend Flask debe correr en la red local:

```bash
cd /Users/erick/Desktop/JobNest
source .venv/bin/activate
flask --app application run --host 0.0.0.0 --port 5000 --debug
```

En la app movil abre `API` y coloca la URL con la IP local de tu Mac, por ejemplo:

```text
http://192.168.0.108:5000
```

No uses `localhost` en Expo Go, porque en el telefono `localhost` apunta al telefono, no a tu Mac.

## Pantallas incluidas

- Inicio movil
- Login
- Registro Cliente / Prestador
- Exploracion de servicios
- Detalle de servicio
- Envio de solicitud
- Dashboard de cliente
- Dashboard de prestador
- Publicar servicio
- Solicitudes
- Ajustes de API
