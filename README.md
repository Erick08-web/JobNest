# JobNest V2

JobNest es una plataforma para conectar clientes con prestadores de servicios. Esta version mantiene el backend original en Flask y agrega un frontend moderno en Next.js dentro de `frontend/`.

## Estructura

```text
JobNest/
├── application.py        # Backend Flask y API existente
├── requirements.txt      # Dependencias Python
├── JobNest.sql           # Script/base SQL Server del proyecto
├── static/               # Assets y uploads usados por Flask
├── templates/            # Vistas legacy de Flask
└── frontend/             # JobNest V2 en Next.js
```

## Requisitos

- Python 3.13 recomendado para este entorno local.
- Node.js compatible con Next.js 14.
- SQL Server disponible localmente, por Docker/Azure o el contenedor que ya uses.
- ODBC Driver 18 for SQL Server instalado.

## Variables de entorno

Crea o revisa el archivo `.env` en la raiz del proyecto. Ejemplo local:

```env
FLASK_SECRET_KEY=jobnest_dev_secret
DB_DRIVER={ODBC Driver 18 for SQL Server}
DB_SERVER=127.0.0.1,1433
DB_NAME=JobNest
DB_USER=sa
DB_PASSWORD=tu_password
DB_ENCRYPT=yes
DB_TRUST_SERVER_CERTIFICATE=yes
DATA_ENCRYPTION_KEY=replace-with-a-fernet-key-generated-with-python
```

Tambien pueden configurarse variables de correo si quieres probar notificaciones.

## Ejecutar el backend Flask

En una terminal:

```bash
cd /Users/erick/Desktop/JobNest
source .venv/bin/activate
FLASK_SKIP_DOTENV=1 ./.venv/bin/python -m flask --app application run --host 127.0.0.1 --port 5001
```

El backend debe quedar en:

```text
http://127.0.0.1:5001
```

## Ejecutar el frontend JobNest V2

En otra terminal:

```bash
cd /Users/erick/Desktop/JobNest/frontend
npm install
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:5001 npm run dev
```

El frontend debe quedar en:

```text
http://localhost:3000
```

Si el puerto 3000 esta ocupado:

```bash
lsof -ti :3000
kill -9 $(lsof -ti :3000)
npm run dev
```

## Rutas principales V2

- `/` Landing page
- `/login` Inicio de sesion
- `/registro` Registro cliente/prestador
- `/buscar` Busqueda de servicios reales
- `/servicios/[id]` Perfil real de servicio
- `/cliente` Dashboard cliente
- `/profesional` Dashboard prestador
- `/publicar` Crear, editar, activar/desactivar publicaciones y subir portafolio
- `/solicitudes` Seguimiento de solicitudes
- `/mensajes` Conversaciones
- `/pagos` Pagos pendientes
- `/agenda` Agenda del prestador
- `/cuenta` Perfil, foto y contraseña
- `/resenas` Servicios concluidos y calificaciones
- `/terminos`, `/privacidad`, `/ayuda` Paginas informativas

## Flujo de prueba recomendado

1. Inicia backend Flask.
2. Inicia frontend Next.
3. Registra o inicia sesion con una cuenta prestador.
4. Entra a `/publicar` y crea una publicacion.
5. Sube una foto al portafolio relacionada con esa publicacion.
6. Cierra sesion e inicia con una cuenta cliente.
7. Entra a `/buscar` y abre el perfil del servicio.
8. Envia una solicitud desde `/servicios/[id]`.
9. Entra como prestador y acepta la solicitud desde `/solicitudes`.
10. Entra como cliente y revisa `/pagos`.
11. Registra pago.
12. Entra como prestador y marca la solicitud como concluida.
13. Entra como cliente y califica desde `/resenas`.
14. Revisa que `/mensajes` muestre conversaciones ligadas a solicitudes.

## Verificacion tecnica

Backend:

```bash
cd /Users/erick/Desktop/JobNest
./.venv/bin/python -m py_compile application.py
```

Frontend:

```bash
cd /Users/erick/Desktop/JobNest/frontend
npm run build
```

## Notas de entrega

- La version nueva vive en `frontend/`.
- Las vistas legacy de Flask siguen existiendo para no romper el backend original.
- JobNest V2 consume endpoints de Flask mediante el proxy `/api/backend/*` configurado en `frontend/next.config.mjs`.
- No subas `.env`, uploads de usuarios, `.venv`, `node_modules` ni archivos ZIP al repositorio.
