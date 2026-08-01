import os
import hashlib
import hmac
import secrets
import smtplib
import unicodedata


def cargar_env_local(ruta='.env'):
    if not os.path.exists(ruta):
        return
    with open(ruta, encoding='utf-8') as archivo:
        for linea in archivo:
            linea = linea.strip()
            if not linea or linea.startswith('#') or '=' not in linea:
                continue
            clave, valor = linea.split('=', 1)
            os.environ.setdefault(clave.strip(), valor.strip().strip('"').strip("'"))

cargar_env_local()
from functools import wraps
from email.message import EmailMessage
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, send_from_directory, abort, g
from werkzeug.middleware.proxy_fix import ProxyFix
import pyodbc
import uuid
from passlib.hash import argon2
from werkzeug.security import check_password_hash as verificar_hash_legacy
from email_validator import validate_email, EmailNotValidError
from datetime import datetime, timedelta, timezone
import re
from flask_mail import Mail, Message
from werkzeug.utils import secure_filename
from cryptography.fernet import Fernet, InvalidToken
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
from werkzeug.exceptions import HTTPException

from observability import (
    APP_VERSION,
    INSTANCE_ID,
    configure_logging,
    finish_request_observability,
    log_exception,
    metrics_response,
    record_auth_event,
    record_business_event,
    record_password_reset_event,
    record_security_warning,
    set_sql_availability,
    start_request_observability,
)

logger = configure_logging()


def print(*args, **kwargs):
    logger.info(' '.join(str(arg) for arg in args))

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY')
if not app.secret_key:
    raise RuntimeError('Falta la variable de entorno FLASK_SECRET_KEY')

if os.environ.get('TRUST_PROXY_HEADERS', 'false').lower() == 'true':
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

app.config['SESSION_COOKIE_HTTPONLY'] = os.environ.get('SESSION_COOKIE_HTTPONLY', 'true').lower() == 'true'
app.config['SESSION_COOKIE_SECURE'] = os.environ.get('SESSION_COOKIE_SECURE', 'false').lower() == 'true'
app.config['SESSION_COOKIE_SAMESITE'] = os.environ.get('SESSION_COOKIE_SAMESITE', 'Lax')

JWT_ACCESS_MINUTES = int(os.environ.get('JWT_ACCESS_MINUTES', '20'))
JWT_REFRESH_DAYS = int(os.environ.get('JWT_REFRESH_DAYS', '14'))
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=JWT_ACCESS_MINUTES)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=JWT_REFRESH_DAYS)
jwt = JWTManager(app)

# Configuración de correo
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', '465'))
app.config['MAIL_USERNAME'] = os.environ.get('EMAIL_USER')
app.config['MAIL_PASSWORD'] = os.environ.get('EMAIL_PASSWORD')
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'false').lower() == 'true'
app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL', 'true').lower() == 'true'
mail = Mail(app)


def cors_allowed_origins():
    return {
        origin.strip()
        for origin in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
        if origin.strip()
    }


@app.after_request
def apply_cors_headers(response):
    origin = request.headers.get('Origin')
    allowed = cors_allowed_origins()
    if origin and origin in allowed:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Vary'] = 'Origin'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type, X-Device-Name'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    if request.method == 'OPTIONS':
        response.status_code = 204
    return response


@app.before_request
def before_request_observability():
    start_request_observability()


@app.after_request
def after_request_observability(response):
    return finish_request_observability(response)


def is_api_request():
    return (
        request.path.startswith('/api/')
        or request.path.startswith('/admin/')
        or request.path in {'/health', '/health/ready', '/metrics', '/login', '/registro'}
        or request.accept_mimetypes.best == 'application/json'
        or request.is_json
    )


def api_error_response(status_code, message):
    return jsonify({
        'success': False,
        'message': message,
        'request_id': getattr(g, 'request_id', None),
        'instance': INSTANCE_ID,
    }), status_code


@app.errorhandler(HTTPException)
def handle_http_exception(error):
    if is_api_request():
        messages = {
            400: 'Solicitud inválida.',
            401: 'No autenticado.',
            403: 'No tienes permiso para realizar esta acción.',
            404: 'Recurso no encontrado.',
            405: 'Método no permitido.',
            413: 'Archivo demasiado grande.',
            415: 'Tipo de contenido no permitido.',
            429: 'Demasiadas solicitudes.',
            503: 'Servicio no disponible.',
        }
        return api_error_response(error.code or 500, messages.get(error.code, 'No fue posible completar la solicitud.'))
    return error


@app.errorhandler(Exception)
def handle_unexpected_exception(error):
    if isinstance(error, HTTPException):
        return handle_http_exception(error)
    log_exception(logger, 'unexpected_exception')
    if is_api_request():
        return api_error_response(500, 'Ocurrió un error interno. Intenta nuevamente más tarde.')
    return 'Ocurrió un error interno.', 500

# Configuración BD
DB_CONFIG = {
    'driver': os.environ.get('DB_DRIVER', '{ODBC Driver 18 for SQL Server}'),
    'server': os.environ.get('DB_SERVER'),
    'database': os.environ.get('DB_NAME', 'JobNest'),
    'user': os.environ.get('DB_USER'),
    'password': os.environ.get('DB_PASSWORD'),
    'encrypt': os.environ.get('DB_ENCRYPT', 'yes'),
    'trust_server_certificate': os.environ.get('DB_TRUST_SERVER_CERTIFICATE', 'yes'),
    'timeout': os.environ.get('DB_TIMEOUT', '30')
}


ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
PORTAFOLIO_UPLOAD_FOLDER = os.path.join(app.root_path, 'static', 'uploads', 'portafolio')
PUBLICACION_UPLOAD_FOLDER = os.path.join(app.root_path, 'static', 'uploads', 'publicaciones')
MAX_PUBLICATION_IMAGES = 8
MAX_PUBLICATION_IMAGE_BYTES = 5 * 1024 * 1024
PUBLICATION_STATES = {
    'borrador',
    'pendiente_revision',
    'correcciones_solicitadas',
    'aprobada',
    'rechazada',
    'suspendida',
    'oculta'
}
IMAGE_REVIEW_STATES = {'pendiente', 'aprobada', 'rechazada', 'eliminada'}
ENCRYPTION_PREFIX = 'enc:v1:'


def hash_password(password):
    return argon2.hash(password)


def verificar_password(hash_guardado, password):
    if not hash_guardado:
        return False
    if hash_guardado.startswith('$argon2'):
        return argon2.verify(password, hash_guardado)
    return verificar_hash_legacy(hash_guardado, password)


def password_necesita_rehash(hash_guardado):
    return not hash_guardado or not hash_guardado.startswith('$argon2')


def obtener_cipher():
    key = os.environ.get('DATA_ENCRYPTION_KEY')
    if not key:
        raise RuntimeError('Falta la variable de entorno DATA_ENCRYPTION_KEY')
    return Fernet(key.encode())


def cifrar_dato(valor):
    if valor is None:
        return None
    texto = str(valor)
    if not texto:
        return None
    if texto.startswith(ENCRYPTION_PREFIX):
        return texto
    token = obtener_cipher().encrypt(texto.encode('utf-8')).decode('utf-8')
    return f'{ENCRYPTION_PREFIX}{token}'


def descifrar_dato(valor):
    if valor is None:
        return None
    texto = str(valor)
    if not texto.startswith(ENCRYPTION_PREFIX):
        return texto
    token = texto[len(ENCRYPTION_PREFIX):]
    try:
        return obtener_cipher().decrypt(token.encode('utf-8')).decode('utf-8')
    except (InvalidToken, RuntimeError):
        return ''


def archivo_imagen_permitido(nombre_archivo):
    return '.' in nombre_archivo and nombre_archivo.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS


def detectar_tipo_imagen(bytes_iniciales):
    if bytes_iniciales.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg', 'jpg'
    if bytes_iniciales.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png', 'png'
    if bytes_iniciales[:4] == b'RIFF' and bytes_iniciales[8:12] == b'WEBP':
        return 'image/webp', 'webp'
    return None, None


def validar_imagen_publicacion(file_storage):
    if not file_storage or file_storage.filename == '':
        return False, 'Selecciona una imagen válida.', None

    nombre = secure_filename(file_storage.filename)
    extension = nombre.rsplit('.', 1)[1].lower() if '.' in nombre else ''
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        return False, 'Solo se permiten imágenes JPEG, PNG o WebP.', None

    file_storage.stream.seek(0, os.SEEK_END)
    size = file_storage.stream.tell()
    file_storage.stream.seek(0)
    if size <= 0:
        return False, 'La imagen está vacía.', None
    if size > MAX_PUBLICATION_IMAGE_BYTES:
        return False, 'Cada imagen debe pesar máximo 5 MB.', None

    cabecera = file_storage.stream.read(32)
    file_storage.stream.seek(0)
    mime_real, extension_real = detectar_tipo_imagen(cabecera)
    if not mime_real:
        return False, 'El archivo no parece ser una imagen JPEG, PNG o WebP válida.', None

    navegador_mime = (file_storage.mimetype or '').lower()
    if navegador_mime and navegador_mime not in {'image/jpeg', 'image/png', 'image/webp'}:
        return False, 'El tipo MIME del archivo no está permitido.', None

    if extension == 'jpeg':
        extension = 'jpg'
    if extension_real != extension:
        return False, 'La extensión no coincide con el contenido real de la imagen.', None

    return True, '', {'mime': mime_real, 'extension': extension_real, 'size': size}

def get_db_connection():
    missing = [
        variable
        for variable, value in {
            'DB_SERVER': DB_CONFIG['server'],
            'DB_USER': DB_CONFIG['user'],
            'DB_PASSWORD': DB_CONFIG['password'],
        }.items()
        if not value
    ]
    if missing:
        raise RuntimeError(
            f"Faltan variables de entorno para la base de datos: {', '.join(missing)}"
        )

    try:
        cnxn = pyodbc.connect(
            f"DRIVER={DB_CONFIG['driver']};"
            f"SERVER={DB_CONFIG['server']};"
            f"DATABASE={DB_CONFIG['database']};"
            f"UID={DB_CONFIG['user']};"
            f"PWD={DB_CONFIG['password']};"
            f"Encrypt={DB_CONFIG['encrypt']};"
            f"TrustServerCertificate={DB_CONFIG['trust_server_certificate']};"
            f"Connection Timeout={DB_CONFIG['timeout']};"
        )
        print("✅ Conexión a la base de datos establecida con éxito.")
        return cnxn
    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"❌ Error al conectar a la base de datos (sqlstate: {sqlstate}): {ex}")
        raise


@app.route('/health')
def health():
    return jsonify({
        'status': 'ok',
        'service': 'jobnest-api',
        'instance': INSTANCE_ID,
        'version': APP_VERSION,
        'request_id': getattr(g, 'request_id', None),
    }), 200


@app.route('/health/ready')
def health_ready():
    try:
        with get_db_connection() as cnxn:
            cursor = cnxn.cursor()
            cursor.execute('SELECT 1')
            cursor.fetchone()
        set_sql_availability(True)
        return jsonify({
            'status': 'ready',
            'database': 'available',
            'service': 'jobnest-api',
            'instance': INSTANCE_ID,
            'request_id': getattr(g, 'request_id', None),
        }), 200
    except Exception as exc:
        set_sql_availability(False)
        logger.warning('database_readiness_failed', extra={
            'request_id': getattr(g, 'request_id', None),
            'event': 'database.readiness_failed',
            'sqlstate': getattr(exc, 'args', [''])[0] if getattr(exc, 'args', None) else None,
        })
        return jsonify({
            'status': 'not_ready',
            'database': 'unavailable',
            'service': 'jobnest-api',
            'instance': INSTANCE_ID,
            'request_id': getattr(g, 'request_id', None),
        }), 503


@app.route('/metrics')
def metrics():
    return metrics_response()

def enviar_correo_bienvenida(email, tipo_usuario):
    if tipo_usuario == 'cliente':
        asunto = "Bienvenido a JobNest 🎉"
        cuerpo = f"""
        Hola 👋

        Tu cuenta como CLIENTE fue creada correctamente en JobNest.

        Ya puedes buscar prestadores, solicitar servicios y comenzar a usar la plataforma.

        ¡Bienvenido!
        """
    else:
        asunto = "Bienvenido a JobNest 🎉"
        cuerpo = f"""
        Hola 👋

        Tu cuenta como PRESTADOR fue creada correctamente en JobNest.

        Ya puedes ofrecer tus servicios y recibir solicitudes de clientes.

        ¡Bienvenido!
        """
    msg = Message(asunto, sender=app.config['MAIL_USERNAME'], recipients=[email])
    msg.body = cuerpo
    mail.send(msg)

def enviar_correo_notificacion(destinatario, asunto, cuerpo):
    try:
        msg = Message(asunto, sender=app.config['MAIL_USERNAME'], recipients=[destinatario])
        msg.body = cuerpo
        mail.send(msg)
        print(f"✅ Correo enviado a {destinatario}")
    except Exception as e:
        print(f"❌ Error al enviar correo a {destinatario}: {e}")

# Carpeta para subir imágenes (original)
UPLOAD_FOLDER = 'multimedia'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# ==================== CONFIGURACIÓN SUBIDA FOTOS PERFIL ====================
PERFIL_UPLOAD_FOLDER = 'static/uploads/perfiles'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['PERFIL_UPLOAD_FOLDER'] = PERFIL_UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024
os.makedirs(PERFIL_UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ==================== VALIDACIONES ====================
def is_valid_email(email):
    try:
        validate_email(email, check_deliverability=False)
        email_regex = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
        return bool(email_regex.match(email))
    except EmailNotValidError:
        return False

def is_valid_password(password):
    min_length = 8
    max_length = 128
    has_upper_case = any(c.isupper() for c in password)
    has_number = any(c.isdigit() for c in password)
    has_special_char = any(c in "!@#$%^&*(),.?\":{}|<>" for c in password)
    if len(password) < min_length:
        return 'La contraseña debe tener al menos 8 caracteres.'
    if len(password) > max_length:
        return 'La contraseña debe tener máximo 128 caracteres.'
    if not has_upper_case:
        return 'La contraseña debe contener al menos una letra mayúscula.'
    if not has_number:
        return 'La contraseña debe contener al menos un número.'
    if not has_special_char:
        return 'La contraseña debe contener al menos un carácter especial (!@#$%^&*(),.?:{}|<>).'
    return ''

def is_valid_person_name_field(name, is_apellido=False):
    letters_spaces_accents_regex = re.compile(r"^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$")
    if not bool(letters_spaces_accents_regex.match(name)):
        return False
    if is_apellido and len(name.split()) > 1:
        return False
    return True

def is_valid_phone_number(phone):
    return re.fullmatch(r"^\d{10,20}$", phone)


class ValidationError(Exception):
    def __init__(self, errors, message='Revisa los datos ingresados', status_code=400):
        super().__init__(message)
        self.errors = errors
        self.message = message
        self.status_code = status_code


def validation_response(errors, message='Revisa los datos ingresados', status_code=400):
    return jsonify({'success': False, 'message': message, 'errors': errors}), status_code


def clean_text(value):
    if value is None:
        return ''
    return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', str(value)).strip()


def add_required_text(errors, field, value, label, min_len=1, max_len=None):
    text = clean_text(value)
    if not text:
        errors[field] = f'{label} es obligatorio.'
        return text
    if len(text) < min_len:
        errors[field] = f'{label} debe tener al menos {min_len} caracteres.'
    elif max_len and len(text) > max_len:
        errors[field] = f'{label} debe tener máximo {max_len} caracteres.'
    return text


def add_optional_text(errors, field, value, label, max_len):
    text = clean_text(value)
    if text and len(text) > max_len:
        errors[field] = f'{label} debe tener máximo {max_len} caracteres.'
    return text


def parse_positive_decimal(errors, field, value, label, required=True, maximum=1000000):
    raw = clean_text(value)
    if not raw:
        if required:
            errors[field] = f'{label} es obligatorio.'
        return None
    if raw.lower() in {'nan', 'infinity', '+infinity', '-infinity'}:
        errors[field] = f'{label} debe ser un número válido.'
        return None
    try:
        number = float(raw)
    except ValueError:
        errors[field] = f'{label} debe ser un número válido.'
        return None
    if number <= 0:
        errors[field] = f'{label} debe ser mayor que cero.'
    elif number > maximum:
        errors[field] = f'{label} no debe superar ${maximum:,.0f}.'
    return round(number, 2)


def parse_int_range(errors, field, value, label, minimum=0, maximum=80, required=True):
    raw = clean_text(value)
    if not raw:
        if required:
            errors[field] = f'{label} es obligatorio.'
        return None
    try:
        number = int(raw)
    except ValueError:
        errors[field] = f'{label} debe ser un número entero válido.'
        return None
    if number < minimum or number > maximum:
        errors[field] = f'{label} debe estar entre {minimum} y {maximum}.'
    return number


def parse_iso_date(errors, field, value, label, required=True, allow_today=True):
    raw = clean_text(value)
    if not raw:
        if required:
            errors[field] = f'{label} es obligatoria.'
        return None
    try:
        parsed = datetime.strptime(raw, '%Y-%m-%d').date()
    except ValueError:
        errors[field] = f'{label} debe tener formato YYYY-MM-DD.'
        return None
    today = datetime.now().date()
    if parsed < today or (not allow_today and parsed == today):
        errors[field] = f'{label} no puede ser una fecha pasada.'
    return parsed


def parse_hhmm_time(errors, field, value, label, required=False):
    raw = clean_text(value)
    if not raw:
        if required:
            errors[field] = f'{label} es obligatoria.'
        return None
    try:
        return datetime.strptime(raw, '%H:%M').time()
    except ValueError:
        errors[field] = f'{label} debe tener formato HH:MM.'
        return None


def reject_unknown_fields(source, allowed_fields, blocked_fields):
    keys = set(source.keys())
    blocked = keys.intersection(blocked_fields)
    unknown = keys.difference(allowed_fields).difference(blocked_fields)
    errors = {}
    for field in blocked:
        errors[field] = 'Este campo no puede enviarse desde la aplicación móvil.'
    for field in unknown:
        errors[field] = 'Campo no permitido.'
    return errors


def normalize_category_slug(value):
    text = clean_text(value).lower()
    text = ''.join(
        char for char in unicodedata.normalize('NFD', text)
        if unicodedata.category(char) != 'Mn'
    )
    text = re.sub(r'[^a-z0-9]+', '-', text).strip('-')
    return text


def get_canonical_category_name(cursor, category):
    category_name = clean_text(category)
    if not category_name:
        return None
    category_slug = normalize_category_slug(category_name)
    cursor.execute("""
        SELECT TOP 1 Nombre
        FROM Categorias
        WHERE Activa = 1
          AND (Nombre = ? OR Slug = ?)
        ORDER BY CASE WHEN Nombre = ? THEN 0 ELSE 1 END, Nombre
    """, (category_name, category_slug, category_name))
    row = cursor.fetchone()
    return row[0] if row else None


def category_exists(cursor, category):
    return get_canonical_category_name(cursor, category) is not None


def list_active_categories(cursor):
    cursor.execute("""
        SELECT Nombre
        FROM Categorias
        WHERE Activa = 1
        ORDER BY
            CASE WHEN Orden IS NULL THEN 1 ELSE 0 END,
            Orden,
            Nombre
    """)
    return [row[0] for row in cursor.fetchall()]


def get_admin_emails():
    return {
        email.strip().lower()
        for email in os.environ.get('ADMIN_EMAILS', '').split(',')
        if email.strip()
    }


def user_has_admin_role(cursor, user_id, email=None):
    if email and email.lower() in get_admin_emails():
        return True

    cursor.execute("""
        SELECT 1
        FROM UsuarioRoles ur
        INNER JOIN Roles r ON ur.RolId = r.id
        WHERE ur.UsuarioId = ? AND LOWER(r.Nombre) IN ('admin', 'administrador')
    """, (user_id,))
    return cursor.fetchone() is not None


def get_user_type(cursor, user_id, email=None):
    if user_has_admin_role(cursor, user_id, email):
        return 'administrador'

    cursor.execute("SELECT id FROM Prestadores WHERE UsuarioId = ?", (user_id,))
    return 'prestador' if cursor.fetchone() is not None else 'cliente'


def ensure_jwt_configured():
    if not app.config.get('JWT_SECRET_KEY'):
        raise RuntimeError('Falta la variable de entorno JWT_SECRET_KEY')


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def bearer_token_from_request():
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.lower().startswith('bearer '):
        return ''
    return auth_header.split(' ', 1)[1].strip()


def hash_token(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def ensure_mobile_refresh_schema(cursor):
    cursor.execute("""
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
        END
    """)
    cursor.execute("""
        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'UX_MobileRefreshTokens_Jti'
              AND object_id = OBJECT_ID('dbo.MobileRefreshTokens')
        )
        BEGIN
            CREATE UNIQUE INDEX UX_MobileRefreshTokens_Jti ON dbo.MobileRefreshTokens (Jti);
        END
    """)
    cursor.execute("""
        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'UX_MobileRefreshTokens_TokenHash'
              AND object_id = OBJECT_ID('dbo.MobileRefreshTokens')
        )
        BEGIN
            CREATE UNIQUE INDEX UX_MobileRefreshTokens_TokenHash ON dbo.MobileRefreshTokens (TokenHash);
        END
    """)
    cursor.execute("""
        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'IX_MobileRefreshTokens_UsuarioId_RevocadoEn'
              AND object_id = OBJECT_ID('dbo.MobileRefreshTokens')
        )
        BEGIN
            CREATE INDEX IX_MobileRefreshTokens_UsuarioId_RevocadoEn
                ON dbo.MobileRefreshTokens (UsuarioId, RevocadoEn, ExpiraEn);
        END
    """)


def mobile_user_response(user):
    return {
        'id': user['id'],
        'nombre': user.get('nombre') or 'Usuario',
        'apellido': user.get('apellido_paterno') or '',
        'email': user['email'],
        'tipo_usuario': user['tipo_usuario'],
        'estado_cuenta': 'activa' if user['activo'] else 'inactiva',
        'foto_perfil': user.get('foto_perfil'),
    }


def fetch_mobile_user(cursor, user_id):
    cursor.execute("""
        SELECT u.id, u.Email, u.Activo, p.Nombre, p.ApellidoP, p.ApellidoM, p.FotoPerfil
        FROM Usuarios u
        LEFT JOIN Personas p ON u.id = p.UsuarioId
        WHERE u.id = ?
    """, (user_id,))
    row = cursor.fetchone()
    if not row:
        return None

    return {
        'id': row[0],
        'email': row[1],
        'activo': bool(row[2]),
        'nombre': row[3],
        'apellido_paterno': row[4],
        'apellido_materno': row[5],
        'foto_perfil': row[6],
        'tipo_usuario': get_user_type(cursor, row[0], row[1]),
    }


def issue_mobile_tokens(cursor, user, device_name=None):
    ensure_jwt_configured()
    identity = str(user['id'])
    claims = {'rol': user['tipo_usuario']}
    access_token = create_access_token(identity=identity, additional_claims=claims)
    refresh_token = create_refresh_token(identity=identity, additional_claims=claims)
    refresh_payload = decode_token(refresh_token)
    refresh_jti = refresh_payload['jti']
    refresh_exp = datetime.fromtimestamp(refresh_payload['exp'], tz=timezone.utc).replace(tzinfo=None)

    ensure_mobile_refresh_schema(cursor)
    cursor.execute("""
        INSERT INTO MobileRefreshTokens (UsuarioId, Jti, TokenHash, ExpiraEn, Dispositivo, UltimoUsoEn)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (user['id'], refresh_jti, hash_token(refresh_token), refresh_exp, device_name, utc_now()))

    return access_token, refresh_token


def validate_refresh_token_record(cursor, user_id, jti, token):
    ensure_mobile_refresh_schema(cursor)
    cursor.execute("""
        SELECT id, TokenHash, RevocadoEn, ExpiraEn
        FROM MobileRefreshTokens
        WHERE UsuarioId = ? AND Jti = ?
    """, (user_id, jti))
    row = cursor.fetchone()
    if not row:
        return None, 'desconocido'

    token_hash = hash_token(token)
    if not hmac.compare_digest(row[1], token_hash):
        return row, 'desconocido'
    if row[2] is not None:
        return row, 'revocado'
    if row[3] <= utc_now():
        return row, 'expirado'

    return row, None


def revoke_refresh_token(cursor, token_id, replacement_jti=None):
    cursor.execute("""
        UPDATE MobileRefreshTokens
        SET RevocadoEn = COALESCE(RevocadoEn, ?),
            ReemplazadoPorJti = COALESCE(ReemplazadoPorJti, ?),
            UltimoUsoEn = ?
        WHERE id = ?
    """, (utc_now(), replacement_jti, utc_now(), token_id))


def revoke_user_refresh_tokens(cursor, user_id):
    cursor.execute("""
        UPDATE MobileRefreshTokens
        SET RevocadoEn = COALESCE(RevocadoEn, ?),
            UltimoUsoEn = ?
        WHERE UsuarioId = ? AND RevocadoEn IS NULL
    """, (utc_now(), utc_now(), user_id))


PASSWORD_RESET_PUBLIC_MESSAGE = 'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.'
PASSWORD_RESET_INVALID_MESSAGE = 'El enlace es inválido o ha expirado.'


def password_reset_minutes():
    return max(15, min(int(os.environ.get('PASSWORD_RESET_TOKEN_MINUTES', '30')), 60))


def password_reset_window_minutes():
    return max(1, int(os.environ.get('PASSWORD_RESET_WINDOW_MINUTES', '15')))


def password_reset_email_limit():
    return max(1, int(os.environ.get('PASSWORD_RESET_MAX_PER_EMAIL', '3')))


def password_reset_ip_limit():
    return max(1, int(os.environ.get('PASSWORD_RESET_MAX_PER_IP', '10')))


def normalize_reset_channel(value):
    return value if value in {'web', 'mobile'} else None


def hash_reset_lookup(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def hash_reset_token(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def current_client_ip():
    forwarded_for = request.headers.get('X-Forwarded-For', '')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()[:45]
    return (request.headers.get('X-Real-IP') or request.remote_addr or '')[:45]


def ensure_password_reset_schema(cursor):
    cursor.execute("SET QUOTED_IDENTIFIER ON")
    cursor.execute("""
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
        END
    """)
    cursor.execute("""
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PasswordResetTokens_TokenHash')
        BEGIN
            CREATE UNIQUE INDEX UX_PasswordResetTokens_TokenHash
            ON PasswordResetTokens(TokenHash)
            WHERE TokenHash IS NOT NULL;
        END
    """)
    cursor.execute("""
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PasswordResetTokens_Usuario')
        BEGIN
            CREATE INDEX IX_PasswordResetTokens_Usuario
            ON PasswordResetTokens(UsuarioId, FechaCreacion DESC);
        END
    """)
    cursor.execute("""
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PasswordResetTokens_EmailHash')
        BEGIN
            CREATE INDEX IX_PasswordResetTokens_EmailHash
            ON PasswordResetTokens(EmailHash, FechaCreacion DESC);
        END
    """)
    cursor.execute("""
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PasswordResetTokens_Ip')
        BEGIN
            CREATE INDEX IX_PasswordResetTokens_Ip
            ON PasswordResetTokens(IpSolicitud, FechaCreacion DESC);
        END
    """)
    cursor.execute("""
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PasswordResetTokens_Expiracion')
        BEGIN
            CREATE INDEX IX_PasswordResetTokens_Expiracion
            ON PasswordResetTokens(FechaExpiracion);
        END
    """)


def build_reset_link(token, channel):
    if channel == 'mobile':
        base = os.environ.get('MOBILE_DEEP_LINK_BASE', 'jobnest://restablecer-password')
    else:
        base = f"{os.environ.get('WEB_BASE_URL', 'http://localhost:3000').rstrip('/')}/restablecer-password"
    separator = '&' if '?' in base else '?'
    return f'{base}{separator}token={token}'


def reset_email_content(link, minutes):
    subject = 'Restablece tu contraseña de JobNest'
    text = (
        'Hola,\n\n'
        'Recibimos una solicitud para restablecer tu contraseña de JobNest.\n'
        f'Usa este enlace durante los próximos {minutes} minutos:\n\n'
        f'{link}\n\n'
        'Si no solicitaste este cambio, ignora este correo.\n'
        'No compartas este enlace con nadie.\n'
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;color:#101828;line-height:1.6">
      <h2>JobNest</h2>
      <p>Recibimos una solicitud para restablecer tu contraseña.</p>
      <p><a href="{link}" style="display:inline-block;padding:12px 18px;background:#3457ff;color:#fff;border-radius:8px;text-decoration:none">Restablecer contraseña</a></p>
      <p>Este enlace vence en {minutes} minutos.</p>
      <p>Si no solicitaste este cambio, ignora este correo. No compartas este enlace con nadie.</p>
    </div>
    """
    return subject, text, html


def send_password_reset_email(email, link, minutes):
    mode = os.environ.get('MAIL_MODE', 'console').lower()
    subject, text, html = reset_email_content(link, minutes)
    if mode == 'console':
        logger.info('password_reset_console_email_local_only', extra={
            'request_id': getattr(g, 'request_id', None),
            'event': 'password_reset.console_email',
        })
        if os.environ.get('LOG_FORMAT', 'text').lower() != 'json':
            logger.info(f'Enlace local de recuperación JobNest: {link}')
        return True
    if mode != 'smtp':
        logger.warning('password_reset_mail_mode_invalid', extra={'request_id': getattr(g, 'request_id', None)})
        return False

    host = os.environ.get('SMTP_HOST')
    username = os.environ.get('SMTP_USERNAME')
    password = os.environ.get('SMTP_PASSWORD')
    mail_from = os.environ.get('MAIL_FROM') or username
    port = int(os.environ.get('SMTP_PORT', '587'))
    timeout = int(os.environ.get('SMTP_TIMEOUT_SECONDS', '10'))
    use_tls = os.environ.get('SMTP_USE_TLS', 'true').lower() == 'true'
    if not host or not mail_from:
        logger.warning('password_reset_smtp_not_configured', extra={'request_id': getattr(g, 'request_id', None)})
        return False

    message = EmailMessage()
    message['Subject'] = subject
    message['From'] = mail_from
    message['To'] = email
    message.set_content(text)
    message.add_alternative(html, subtype='html')
    try:
        with smtplib.SMTP(host, port, timeout=timeout) as smtp:
            if use_tls:
                smtp.starttls()
            if username and password:
                smtp.login(username, password)
            smtp.send_message(message)
        return True
    except Exception:
        logger.exception('password_reset_smtp_failed', extra={'request_id': getattr(g, 'request_id', None)})
        return False


def password_reset_validation_response(errors, status=400):
    return jsonify({
        'success': False,
        'message': 'No fue posible restablecer la contraseña.',
        'errors': errors,
        'request_id': getattr(g, 'request_id', None),
    }), status


def public_password_reset_response():
    return jsonify({'success': True, 'message': PASSWORD_RESET_PUBLIC_MESSAGE}), 200


@app.route('/api/auth/password/forgot', methods=['POST'])
def password_forgot():
    data = request.get_json(silent=True) or {}
    correo = (data.get('correo') or data.get('email') or '').strip().lower()
    channel = normalize_reset_channel(data.get('canal') or data.get('channel') or 'web')
    errors = {}
    if not correo:
        errors['correo'] = 'El correo es obligatorio.'
    elif len(correo) > 150 or not is_valid_email(correo):
        errors['correo'] = 'Ingresa un correo válido.'
    if not channel:
        errors['canal'] = 'El canal no es válido.'
    if errors:
        record_password_reset_event('failed_validation', channel or 'unknown')
        return password_reset_validation_response(errors)

    conn = None
    email_hash = hash_reset_lookup(correo)
    ip = current_client_ip()
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_password_reset_schema(cursor)

        window = password_reset_window_minutes()
        cursor.execute("""
            SELECT COUNT(*)
            FROM PasswordResetTokens
            WHERE EmailHash = ? AND FechaCreacion >= DATEADD(MINUTE, ?, SYSUTCDATETIME())
        """, (email_hash, -window))
        email_attempts = cursor.fetchone()[0]
        cursor.execute("""
            SELECT COUNT(*)
            FROM PasswordResetTokens
            WHERE IpSolicitud = ? AND FechaCreacion >= DATEADD(MINUTE, ?, SYSUTCDATETIME())
        """, (ip, -window))
        ip_attempts = cursor.fetchone()[0]
        if email_attempts >= password_reset_email_limit() or ip_attempts >= password_reset_ip_limit():
            record_password_reset_event('rate_limited', channel)
            logger.warning('password_reset_rate_limited', extra={
                'request_id': getattr(g, 'request_id', None),
                'event': 'password_reset.rate_limited',
            })
            return jsonify({
                'success': False,
                'message': 'Demasiadas solicitudes. Intenta nuevamente más tarde.',
                'request_id': getattr(g, 'request_id', None),
            }), 429

        cursor.execute("""
            SELECT id, Email, Activo
            FROM Usuarios
            WHERE LOWER(Email) = ?
        """, (correo,))
        user = cursor.fetchone()
        minutes = password_reset_minutes()
        expires_at = utc_now() + timedelta(minutes=minutes)
        token_hash = None
        user_id = None
        email_sent = False

        if user and bool(user[2]):
            user_id = user[0]
            cursor.execute("""
                UPDATE PasswordResetTokens
                SET Revocado = 1
                WHERE UsuarioId = ?
                  AND FechaUso IS NULL
                  AND Revocado = 0
                  AND FechaExpiracion > SYSUTCDATETIME()
            """, (user_id,))
            token = secrets.token_urlsafe(32)
            token_hash = hash_reset_token(token)
            reset_link = build_reset_link(token, channel)
            email_sent = send_password_reset_email(user[1], reset_link, minutes)
            record_password_reset_event('requested', channel)
            if not email_sent:
                record_password_reset_event('email_failed', channel)
        else:
            record_password_reset_event('requested_no_active_account', channel)

        cursor.execute("""
            INSERT INTO PasswordResetTokens
                (UsuarioId, EmailHash, TokenHash, Canal, IpSolicitud, FechaExpiracion, Revocado, EmailEnviado)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?)
        """, (user_id, email_hash, token_hash, channel, ip, expires_at if token_hash else None, 1 if email_sent else 0))
        conn.commit()
        return public_password_reset_response()

    except pyodbc.Error as ex:
        if conn:
            conn.rollback()
        logger.exception('password_reset_forgot_db_error', extra={
            'request_id': getattr(g, 'request_id', None),
            'sqlstate': ex.args[0] if ex.args else None,
        })
        record_password_reset_event('failed', channel)
        return jsonify({'success': False, 'message': 'No fue posible procesar la solicitud.', 'request_id': getattr(g, 'request_id', None)}), 500
    except Exception:
        if conn:
            conn.rollback()
        logger.exception('password_reset_forgot_unexpected', extra={'request_id': getattr(g, 'request_id', None)})
        record_password_reset_event('failed', channel)
        return jsonify({'success': False, 'message': 'No fue posible procesar la solicitud.', 'request_id': getattr(g, 'request_id', None)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/api/auth/password/reset', methods=['POST'])
def password_reset():
    data = request.get_json(silent=True) or {}
    token = data.get('token') or ''
    password = data.get('password') or ''
    confirmation = data.get('password_confirmation') or data.get('passwordConfirmation') or ''
    channel = normalize_reset_channel(data.get('canal') or data.get('channel') or 'web') or 'web'
    errors = {}

    if not token:
        errors['token'] = PASSWORD_RESET_INVALID_MESSAGE
    elif len(token) > 256 or not re.match(r'^[A-Za-z0-9_-]+$', token):
        errors['token'] = PASSWORD_RESET_INVALID_MESSAGE
    if not password:
        errors['password'] = 'La contraseña es obligatoria.'
    elif password.strip() == '':
        errors['password'] = 'La contraseña no puede estar vacía.'
    else:
        password_error = is_valid_password(password)
        if password_error:
            errors['password'] = password_error
    if not confirmation:
        errors['password_confirmation'] = 'Confirma tu contraseña.'
    elif password != confirmation:
        errors['password_confirmation'] = 'Las contraseñas no coinciden.'
    if errors:
        record_password_reset_event('failed_validation', channel)
        return password_reset_validation_response(errors)

    conn = None
    token_hash = hash_reset_token(token)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_password_reset_schema(cursor)
        cursor.execute("""
            SELECT prt.id, prt.UsuarioId, prt.TokenHash, prt.FechaExpiracion,
                   prt.FechaUso, prt.Revocado, u.PasswordHash, u.Activo
            FROM PasswordResetTokens prt
            INNER JOIN Usuarios u ON prt.UsuarioId = u.id
            WHERE prt.TokenHash = ?
        """, (token_hash,))
        row = cursor.fetchone()
        if not row or not hmac.compare_digest((row[2] or '').strip(), token_hash):
            record_password_reset_event('failed_invalid_token', channel)
            return password_reset_validation_response({'token': PASSWORD_RESET_INVALID_MESSAGE})
        token_id, user_id, _, expires_at, used_at, revoked, current_hash, active = row
        if used_at is not None or bool(revoked) or not expires_at or expires_at <= utc_now() or not bool(active):
            record_password_reset_event('failed_invalid_token', channel)
            return password_reset_validation_response({'token': PASSWORD_RESET_INVALID_MESSAGE})
        if verificar_password(current_hash, password):
            record_password_reset_event('failed_same_password', channel)
            return password_reset_validation_response({'password': 'La nueva contraseña no puede ser igual a la actual.'}, 409)

        cursor.execute("UPDATE Usuarios SET PasswordHash = ?, UltimoLogin = ? WHERE id = ?", (hash_password(password), utc_now(), user_id))
        cursor.execute("""
            UPDATE PasswordResetTokens
            SET FechaUso = ?, Revocado = 1
            WHERE id = ? AND FechaUso IS NULL AND Revocado = 0
        """, (utc_now(), token_id))
        cursor.execute("""
            UPDATE PasswordResetTokens
            SET Revocado = 1
            WHERE UsuarioId = ? AND id <> ? AND FechaUso IS NULL AND Revocado = 0
        """, (user_id, token_id))
        revoke_user_refresh_tokens(cursor, user_id)
        conn.commit()
        g.safe_user_id = user_id
        record_password_reset_event('completed', channel)
        logger.info('password_reset_completed', extra={
            'request_id': getattr(g, 'request_id', None),
            'event': 'password_reset.completed',
            'user_id': user_id,
        })
        return jsonify({'success': True, 'message': 'Tu contraseña fue actualizada correctamente.'}), 200

    except pyodbc.Error as ex:
        if conn:
            conn.rollback()
        logger.exception('password_reset_db_error', extra={
            'request_id': getattr(g, 'request_id', None),
            'sqlstate': ex.args[0] if ex.args else None,
        })
        record_password_reset_event('failed', channel)
        return jsonify({'success': False, 'message': 'No fue posible restablecer la contraseña.', 'request_id': getattr(g, 'request_id', None)}), 500
    except Exception:
        if conn:
            conn.rollback()
        logger.exception('password_reset_unexpected', extra={'request_id': getattr(g, 'request_id', None)})
        record_password_reset_event('failed', channel)
        return jsonify({'success': False, 'message': 'No fue posible restablecer la contraseña.', 'request_id': getattr(g, 'request_id', None)}), 500
    finally:
        if conn:
            conn.close()


def load_mobile_jwt_user():
    identity = get_jwt_identity()
    claims = get_jwt()
    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        return None, jsonify({'success': False, 'message': 'Token inválido'}), 401

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        user = fetch_mobile_user(cursor, user_id)
        if not user:
            return None, jsonify({'success': False, 'message': 'Usuario no encontrado'}), 401
        if not user['activo']:
            return None, jsonify({'success': False, 'message': 'Cuenta inactiva'}), 403
        if claims.get('rol') and claims.get('rol') != user['tipo_usuario']:
            return None, jsonify({'success': False, 'message': 'El rol de la sesión ya no es válido'}), 403
        return user, None, None
    finally:
        if conn:
            conn.close()


def mobile_role_required(*roles):
    def decorator(view):
        @wraps(view)
        @jwt_required()
        def wrapped(*args, **kwargs):
            user, response, status = load_mobile_jwt_user()
            if response is not None:
                return response, status
            if roles and user['tipo_usuario'] not in roles:
                return jsonify({'success': False, 'message': 'No tienes permiso para realizar esta acción.'}), 403
            g.mobile_user = user
            return view(*args, **kwargs)
        return wrapped
    return decorator


@jwt.expired_token_loader
def jwt_expired_callback(jwt_header, jwt_payload):
    record_security_warning('jwt.expired')
    if request.path == '/api/mobile/auth/refresh':
        record_auth_event('refresh', 'failed', 'mobile')
    return jsonify({'success': False, 'message': 'Token expirado'}), 401


@jwt.invalid_token_loader
def jwt_invalid_callback(reason):
    record_security_warning('jwt.invalid')
    if request.path == '/api/mobile/auth/refresh':
        record_auth_event('refresh', 'failed', 'mobile')
    return jsonify({'success': False, 'message': 'Token inválido'}), 401


@jwt.unauthorized_loader
def jwt_missing_callback(reason):
    record_security_warning('jwt.missing')
    if request.path == '/api/mobile/auth/refresh':
        record_auth_event('refresh', 'failed', 'mobile')
    return jsonify({'success': False, 'message': 'Token requerido'}), 401


@jwt.revoked_token_loader
def jwt_revoked_callback(jwt_header, jwt_payload):
    record_security_warning('jwt.revoked')
    if request.path == '/api/mobile/auth/refresh':
        record_auth_event('refresh', 'failed', 'mobile')
    return jsonify({'success': False, 'message': 'Token revocado'}), 401


def require_admin_session():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        record_security_warning('admin.unauthenticated_access')
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    if session.get('tipo_usuario') != 'administrador':
        record_security_warning('admin.forbidden_access', role=session.get('tipo_usuario'))
        return jsonify({'success': False, 'message': 'Solo administradores pueden acceder a esta sección.'}), 403

    return None


def fmt_datetime(value):
    return value.strftime('%d/%m/%Y %H:%M') if value else ''


def fmt_date(value):
    return value.strftime('%d/%m/%Y') if value else ''


def parse_int_arg(name, default, minimum=1, maximum=100):
    try:
        value = int(request.args.get(name, default))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(value, maximum))


def date_filter_args():
    desde = request.args.get('desde', '').strip()
    hasta = request.args.get('hasta', '').strip()
    return desde, hasta


def ensure_control_schema(cursor):
    cursor.execute("""
        IF COL_LENGTH('Publicaciones', 'EstadoRevision') IS NULL
            ALTER TABLE Publicaciones ADD EstadoRevision NVARCHAR(30) NOT NULL
                CONSTRAINT DF_Publicaciones_EstadoRevision DEFAULT 'aprobada'
    """)
    cursor.execute("""
        IF COL_LENGTH('Publicaciones', 'RevisadoPor') IS NULL
            ALTER TABLE Publicaciones ADD RevisadoPor INT NULL
    """)
    cursor.execute("""
        IF COL_LENGTH('Publicaciones', 'FechaRevision') IS NULL
            ALTER TABLE Publicaciones ADD FechaRevision DATETIME NULL
    """)
    cursor.execute("""
        IF COL_LENGTH('Publicaciones', 'ComentarioRevision') IS NULL
            ALTER TABLE Publicaciones ADD ComentarioRevision NVARCHAR(500) NULL
    """)
    cursor.execute("""
        IF COL_LENGTH('Publicaciones', 'FechaActualizacion') IS NULL
            ALTER TABLE Publicaciones ADD FechaActualizacion DATETIME NULL
    """)
    cursor.execute("""
        IF OBJECT_ID('PublicacionVersiones', 'U') IS NULL
            CREATE TABLE PublicacionVersiones (
                id INT IDENTITY(1,1) PRIMARY KEY,
                PublicacionId INT NOT NULL,
                VersionNumero INT NOT NULL,
                Titulo NVARCHAR(255) NOT NULL,
                Descripcion NVARCHAR(MAX) NULL,
                Categoria NVARCHAR(100) NOT NULL,
                Precio DECIMAL(10,2) NULL,
                Ubicacion NVARCHAR(255) NULL,
                Experiencia INT NULL,
                Habilidades NVARCHAR(500) NULL,
                Disponibilidad NVARCHAR(100) NULL,
                IncluyeMateriales BIT NOT NULL DEFAULT 0,
                TipoPrecio NVARCHAR(20) NULL,
                Estado NVARCHAR(40) NOT NULL DEFAULT 'pendiente_revision',
                AutorId INT NOT NULL,
                RevisadoPor INT NULL,
                Observaciones NVARCHAR(MAX) NULL,
                MotivoRechazo NVARCHAR(MAX) NULL,
                EsVersionPublica BIT NOT NULL DEFAULT 0,
                CreadoEn DATETIME NOT NULL DEFAULT GETDATE(),
                RevisadoEn DATETIME NULL,
                ActualizadoEn DATETIME NULL,
                FOREIGN KEY (PublicacionId) REFERENCES Publicaciones(id),
                FOREIGN KEY (AutorId) REFERENCES Usuarios(id)
            )
    """)
    cursor.execute("""
        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'UX_PublicacionVersiones_Publicacion_Numero'
              AND object_id = OBJECT_ID('PublicacionVersiones')
        )
            CREATE UNIQUE INDEX UX_PublicacionVersiones_Publicacion_Numero
            ON PublicacionVersiones(PublicacionId, VersionNumero)
    """)
    cursor.execute("""
        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'IX_PublicacionVersiones_Estado'
              AND object_id = OBJECT_ID('PublicacionVersiones')
        )
            CREATE INDEX IX_PublicacionVersiones_Estado
            ON PublicacionVersiones(Estado, CreadoEn DESC)
    """)
    cursor.execute("""
        IF OBJECT_ID('PublicacionImagenes', 'U') IS NULL
            CREATE TABLE PublicacionImagenes (
                id INT IDENTITY(1,1) PRIMARY KEY,
                PublicacionId INT NOT NULL,
                VersionId INT NOT NULL,
                UsuarioId INT NOT NULL,
                ImagenUrl NVARCHAR(500) NOT NULL,
                NombreArchivo NVARCHAR(255) NOT NULL,
                MimeType NVARCHAR(80) NOT NULL,
                TamanoBytes INT NOT NULL,
                Posicion INT NOT NULL DEFAULT 0,
                EsPrincipal BIT NOT NULL DEFAULT 0,
                EstadoRevision NVARCHAR(30) NOT NULL DEFAULT 'pendiente',
                MotivoRechazo NVARCHAR(MAX) NULL,
                CreadoEn DATETIME NOT NULL DEFAULT GETDATE(),
                RevisadoPor INT NULL,
                RevisadoEn DATETIME NULL,
                EliminadoEn DATETIME NULL,
                FOREIGN KEY (PublicacionId) REFERENCES Publicaciones(id),
                FOREIGN KEY (VersionId) REFERENCES PublicacionVersiones(id),
                FOREIGN KEY (UsuarioId) REFERENCES Usuarios(id)
            )
    """)
    cursor.execute("""
        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'IX_PublicacionImagenes_Publica'
              AND object_id = OBJECT_ID('PublicacionImagenes')
        )
            CREATE INDEX IX_PublicacionImagenes_Publica
            ON PublicacionImagenes(PublicacionId, VersionId, EstadoRevision, Posicion)
    """)
    cursor.execute("""
        IF OBJECT_ID('PublicacionRevisiones', 'U') IS NULL
            CREATE TABLE PublicacionRevisiones (
                id INT IDENTITY(1,1) PRIMARY KEY,
                PublicacionId INT NOT NULL,
                VersionId INT NOT NULL,
                AdministradorId INT NOT NULL,
                Accion NVARCHAR(60) NOT NULL,
                EstadoAnterior NVARCHAR(40) NULL,
                EstadoNuevo NVARCHAR(40) NOT NULL,
                Observaciones NVARCHAR(MAX) NULL,
                EsNotaInterna BIT NOT NULL DEFAULT 0,
                CreadoEn DATETIME NOT NULL DEFAULT GETDATE(),
                FOREIGN KEY (PublicacionId) REFERENCES Publicaciones(id),
                FOREIGN KEY (VersionId) REFERENCES PublicacionVersiones(id),
                FOREIGN KEY (AdministradorId) REFERENCES Usuarios(id)
            )
    """)
    cursor.execute("""
        IF OBJECT_ID('AlertasSistema', 'U') IS NULL
            CREATE TABLE AlertasSistema (
                id INT IDENTITY(1,1) PRIMARY KEY,
                UsuarioId INT NULL,
                RolDestino NVARCHAR(40) NULL,
                Tipo NVARCHAR(80) NOT NULL,
                Titulo NVARCHAR(180) NOT NULL,
                Mensaje NVARCHAR(MAX) NOT NULL,
                PublicacionId INT NULL,
                VersionId INT NULL,
                Leida BIT NOT NULL DEFAULT 0,
                CreadoEn DATETIME NOT NULL DEFAULT GETDATE(),
                LeidaEn DATETIME NULL,
                FOREIGN KEY (UsuarioId) REFERENCES Usuarios(id)
            )
    """)
    cursor.execute("""
        IF OBJECT_ID('Quejas', 'U') IS NULL
            CREATE TABLE Quejas (
                id INT IDENTITY(1,1) PRIMARY KEY,
                UsuarioId INT NOT NULL,
                TipoUsuario NVARCHAR(30) NOT NULL,
                SolicitudServicioId INT NULL,
                PublicacionId INT NULL,
                Motivo NVARCHAR(120) NOT NULL,
                Descripcion NVARCHAR(MAX) NOT NULL,
                Estado NVARCHAR(30) NOT NULL DEFAULT 'pendiente',
                RespuestaAdmin NVARCHAR(MAX) NULL,
                AtendidaPor INT NULL,
                CreadoEn DATETIME NOT NULL DEFAULT GETDATE(),
                ActualizadoEn DATETIME NULL,
                FOREIGN KEY (UsuarioId) REFERENCES Usuarios(id)
            )
    """)
    cursor.execute("""
        IF OBJECT_ID('BitacoraAdmin', 'U') IS NULL
            CREATE TABLE BitacoraAdmin (
                id INT IDENTITY(1,1) PRIMARY KEY,
                UsuarioId INT NULL,
                ActorId INT NULL,
                TipoEvento NVARCHAR(80) NOT NULL,
                Entidad NVARCHAR(80) NOT NULL,
                EntidadId INT NULL,
                Detalle NVARCHAR(MAX) NULL,
                CreadoEn DATETIME NOT NULL DEFAULT GETDATE()
            )
    """)
    cursor.execute("""
        IF COL_LENGTH('BitacoraAdmin', 'RolActor') IS NULL
            ALTER TABLE BitacoraAdmin ADD RolActor NVARCHAR(40) NULL
    """)
    cursor.execute("""
        IF COL_LENGTH('BitacoraAdmin', 'ValorAnterior') IS NULL
            ALTER TABLE BitacoraAdmin ADD ValorAnterior NVARCHAR(MAX) NULL
    """)
    cursor.execute("""
        IF COL_LENGTH('BitacoraAdmin', 'ValorNuevo') IS NULL
            ALTER TABLE BitacoraAdmin ADD ValorNuevo NVARCHAR(MAX) NULL
    """)
    cursor.execute("""
        IF COL_LENGTH('BitacoraAdmin', 'IpOrigen') IS NULL
            ALTER TABLE BitacoraAdmin ADD IpOrigen NVARCHAR(80) NULL
    """)
    cursor.execute("""
        IF COL_LENGTH('BitacoraAdmin', 'UserAgent') IS NULL
            ALTER TABLE BitacoraAdmin ADD UserAgent NVARCHAR(500) NULL
    """)
    cursor.execute("""
        IF COL_LENGTH('AlertasSistema', 'Prioridad') IS NULL
            ALTER TABLE AlertasSistema ADD Prioridad NVARCHAR(20) NOT NULL
                CONSTRAINT DF_AlertasSistema_Prioridad DEFAULT 'media'
    """)
    cursor.execute("""
        IF COL_LENGTH('AlertasSistema', 'Entidad') IS NULL
            ALTER TABLE AlertasSistema ADD Entidad NVARCHAR(80) NULL
    """)
    cursor.execute("""
        IF COL_LENGTH('AlertasSistema', 'EntidadId') IS NULL
            ALTER TABLE AlertasSistema ADD EntidadId INT NULL
    """)
    cursor.execute("""
        IF COL_LENGTH('Usuarios', 'EstadoCuenta') IS NULL
            ALTER TABLE Usuarios ADD EstadoCuenta NVARCHAR(30) NOT NULL
                CONSTRAINT DF_Usuarios_EstadoCuenta DEFAULT 'activa'
    """)
    cursor.execute("""
        IF COL_LENGTH('Pagos', 'SolicitudServicioId') IS NULL
            ALTER TABLE Pagos ADD SolicitudServicioId INT NULL
    """)
    cursor.execute("""
        UPDATE Publicaciones
        SET EstadoRevision = CASE WHEN Activa = 1 THEN 'aprobada' ELSE 'pendiente_revision' END
        WHERE EstadoRevision IS NULL OR EstadoRevision = '' OR EstadoRevision = 'pendiente'
    """)
    cursor.execute("""
        INSERT INTO PublicacionVersiones (
            PublicacionId, VersionNumero, Titulo, Descripcion, Categoria, Precio, Ubicacion,
            Experiencia, Habilidades, Disponibilidad, IncluyeMateriales, TipoPrecio, Estado,
            AutorId, EsVersionPublica, CreadoEn, RevisadoEn
        )
        SELECT p.id, 1, p.Titulo, CAST(p.Descripcion AS NVARCHAR(MAX)), p.Categoria, p.Precio, p.Ubicacion,
               p.Experiencia, p.Habilidades, p.Disponibilidad, p.IncluyeMateriales, p.TipoPrecio,
               CASE WHEN p.Activa = 1 AND p.EstadoRevision = 'aprobada' THEN 'aprobada' ELSE 'pendiente_revision' END,
               p.UsuarioId,
               CASE WHEN p.Activa = 1 AND p.EstadoRevision = 'aprobada' THEN 1 ELSE 0 END,
               p.FechaCreacion,
               CASE WHEN p.Activa = 1 AND p.EstadoRevision = 'aprobada' THEN ISNULL(p.FechaRevision, p.FechaCreacion) ELSE NULL END
        FROM Publicaciones p
        WHERE NOT EXISTS (
            SELECT 1 FROM PublicacionVersiones pv WHERE pv.PublicacionId = p.id
        )
    """)


def audit_event(cursor, tipo_evento, entidad, entidad_id=None, detalle=None, usuario_id=None, actor_id=None, valor_anterior=None, valor_nuevo=None):
    cursor.execute("""
        INSERT INTO BitacoraAdmin (
            UsuarioId, ActorId, RolActor, TipoEvento, Entidad, EntidadId, Detalle,
            ValorAnterior, ValorNuevo, IpOrigen, UserAgent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        usuario_id,
        actor_id,
        session.get('tipo_usuario'),
        tipo_evento,
        entidad,
        entidad_id,
        detalle,
        valor_anterior,
        valor_nuevo,
        request.headers.get('X-Forwarded-For', request.remote_addr or ''),
        request.headers.get('User-Agent', '')[:500]
    ))


def crear_alerta(cursor, tipo, titulo, mensaje, publicacion_id=None, version_id=None, usuario_id=None, rol_destino=None, prioridad='media', entidad=None, entidad_id=None):
    cursor.execute("""
        INSERT INTO AlertasSistema (
            UsuarioId, RolDestino, Tipo, Prioridad, Titulo, Mensaje, PublicacionId, VersionId, Entidad, EntidadId
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (usuario_id, rol_destino, tipo, prioridad, titulo, mensaje, publicacion_id, version_id, entidad, entidad_id))


def obtener_siguiente_version(cursor, publicacion_id):
    cursor.execute("SELECT COALESCE(MAX(VersionNumero), 0) + 1 FROM PublicacionVersiones WHERE PublicacionId = ?", (publicacion_id,))
    return int(cursor.fetchone()[0])


def crear_version_publicacion(cursor, publicacion_id, user_id, datos, estado='pendiente_revision'):
    version_numero = obtener_siguiente_version(cursor, publicacion_id)
    cursor.execute("""
        INSERT INTO PublicacionVersiones (
            PublicacionId, VersionNumero, Titulo, Descripcion, Categoria, Precio, Ubicacion,
            Experiencia, Habilidades, Disponibilidad, IncluyeMateriales, TipoPrecio, Estado, AutorId
        )
        OUTPUT INSERTED.id
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        publicacion_id,
        version_numero,
        datos['titulo'],
        datos['descripcion'],
        datos['categoria'],
        datos['precio'],
        datos['ubicacion'],
        datos['experiencia'],
        datos['habilidades'],
        datos['disponibilidad'],
        datos['incluye_materiales'],
        datos['tipo_precio'],
        estado,
        user_id
    ))
    return int(cursor.fetchone()[0])


def obtener_version_publica_id(cursor, publicacion_id):
    cursor.execute("""
        SELECT TOP 1 id
        FROM PublicacionVersiones
        WHERE PublicacionId = ? AND EsVersionPublica = 1 AND Estado = 'aprobada'
        ORDER BY VersionNumero DESC
    """, (publicacion_id,))
    row = cursor.fetchone()
    return row[0] if row else None


def obtener_ultima_version_id(cursor, publicacion_id):
    cursor.execute("""
        SELECT TOP 1 id
        FROM PublicacionVersiones
        WHERE PublicacionId = ?
        ORDER BY VersionNumero DESC
    """, (publicacion_id,))
    row = cursor.fetchone()
    return row[0] if row else None


def sincronizar_publicacion_desde_version(cursor, publicacion_id, version_id, admin_id):
    cursor.execute("""
        SELECT Titulo, Descripcion, Categoria, Precio, Ubicacion, Experiencia, Habilidades,
               Disponibilidad, IncluyeMateriales, TipoPrecio
        FROM PublicacionVersiones
        WHERE id = ? AND PublicacionId = ?
    """, (version_id, publicacion_id))
    version = cursor.fetchone()
    if not version:
        raise ValueError('Versión no encontrada para sincronizar.')

    cursor.execute("UPDATE PublicacionVersiones SET EsVersionPublica = 0 WHERE PublicacionId = ?", (publicacion_id,))
    cursor.execute("""
        UPDATE PublicacionVersiones
        SET Estado = 'aprobada', EsVersionPublica = 1, RevisadoPor = ?, RevisadoEn = GETDATE(), ActualizadoEn = GETDATE()
        WHERE id = ?
    """, (admin_id, version_id))
    cursor.execute("""
        UPDATE Publicaciones
        SET Titulo = ?, Descripcion = ?, Categoria = ?, Precio = ?, Ubicacion = ?, Experiencia = ?,
            Habilidades = ?, Disponibilidad = ?, IncluyeMateriales = ?, TipoPrecio = ?,
            Activa = 1, EstadoRevision = 'aprobada', RevisadoPor = ?, FechaRevision = GETDATE(),
            ComentarioRevision = NULL, FechaActualizacion = GETDATE()
        WHERE id = ?
    """, (
        version[0], version[1], version[2], version[3], version[4], version[5],
        version[6], version[7], version[8], version[9], admin_id, publicacion_id
    ))
    cursor.execute("""
        UPDATE PublicacionImagenes
        SET EstadoRevision = 'aprobada', RevisadoPor = ?, RevisadoEn = GETDATE()
        WHERE VersionId = ? AND EstadoRevision = 'pendiente'
    """, (admin_id, version_id))


def guardar_imagenes_version(cursor, publicacion_id, version_id, user_id, imagenes):
    if not imagenes:
        return []
    cursor.execute("""
        SELECT COUNT(*)
        FROM PublicacionImagenes
        WHERE VersionId = ? AND EstadoRevision <> 'eliminada'
    """, (version_id,))
    existentes = int(cursor.fetchone()[0])
    if existentes + len(imagenes) > MAX_PUBLICATION_IMAGES:
        raise ValueError(f'Cada publicación puede tener máximo {MAX_PUBLICATION_IMAGES} imágenes por versión.')

    os.makedirs(PUBLICACION_UPLOAD_FOLDER, exist_ok=True)
    guardadas = []
    for index, imagen in enumerate(imagenes, start=existentes):
        valida, mensaje, meta = validar_imagen_publicacion(imagen)
        if not valida:
            raise ValueError(mensaje)

        nombre_final = f"{publicacion_id}_{version_id}_{uuid.uuid4().hex}.{meta['extension']}"
        ruta_archivo = os.path.join(PUBLICACION_UPLOAD_FOLDER, nombre_final)
        imagen.save(ruta_archivo)
        ruta_relativa = f"/static/uploads/publicaciones/{nombre_final}"
        cursor.execute("""
            INSERT INTO PublicacionImagenes (
                PublicacionId, VersionId, UsuarioId, ImagenUrl, NombreArchivo, MimeType,
                TamanoBytes, Posicion, EsPrincipal, EstadoRevision
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')
        """, (
            publicacion_id,
            version_id,
            user_id,
            ruta_relativa,
            nombre_final,
            meta['mime'],
            meta['size'],
            index,
            1 if index == 0 else 0
        ))
        cursor.execute("SELECT SCOPE_IDENTITY()")
        imagen_id = int(cursor.fetchone()[0])
        guardadas.append({'id': imagen_id, 'url': ruta_relativa})
        audit_event(cursor, 'imagen_subida', 'PublicacionImagenes', imagen_id,
                    f'Imagen subida para publicación {publicacion_id}, versión {version_id}.',
                    usuario_id=user_id, actor_id=user_id)
    return guardadas


def leer_datos_publicacion_form():
    datos, errors = validar_datos_publicacion(request.form)
    if errors:
        first_error = next(iter(errors.values()))
        raise ValueError(first_error)
    return datos


def validar_datos_publicacion(form_data, cursor=None):
    allowed_fields = {
        'titulo', 'descripcion', 'categoria', 'salario', 'ubicacion', 'experiencia',
        'habilidades', 'disponibilidad', 'tipo_precio', 'incluye_materiales'
    }
    blocked_fields = {'prestador_id', 'usuario_id', 'aprobada', 'estado_admin', 'creado_por', 'estado_revision'}
    errors = reject_unknown_fields(form_data, allowed_fields, blocked_fields)

    titulo = add_required_text(errors, 'titulo', form_data.get('titulo'), 'El título', min_len=5, max_len=255)
    descripcion = add_required_text(errors, 'descripcion', form_data.get('descripcion'), 'La descripción', min_len=20, max_len=4000)
    categoria = add_required_text(errors, 'categoria', form_data.get('categoria'), 'La categoría', max_len=100)
    categoria_canonica = categoria
    precio_decimal = parse_positive_decimal(errors, 'salario', form_data.get('salario'), 'El precio', required=True, maximum=1000000)
    ubicacion = add_required_text(errors, 'ubicacion', form_data.get('ubicacion'), 'La ubicación', min_len=3, max_len=255)
    experiencia_int = parse_int_range(errors, 'experiencia', form_data.get('experiencia'), 'La experiencia', minimum=0, maximum=80, required=True)
    habilidades = add_optional_text(errors, 'habilidades', form_data.get('habilidades'), 'Las habilidades', 500)
    disponibilidad = add_optional_text(errors, 'disponibilidad', form_data.get('disponibilidad'), 'La disponibilidad', 100)
    tipo_precio = clean_text(form_data.get('tipo_precio') or 'hora')
    incluye_materiales = form_data.get('incluye_materiales') == 'on'

    if tipo_precio not in {'hora', 'servicio', 'dia', 'proyecto'}:
        errors['tipo_precio'] = 'El tipo de precio no es válido.'
    if cursor and categoria:
        categoria_canonica = get_canonical_category_name(cursor, categoria)
        if not categoria_canonica:
            errors['categoria'] = 'Selecciona una categoría disponible.'

    return {
        'titulo': titulo,
        'descripcion': descripcion,
        'categoria': categoria_canonica,
        'precio': precio_decimal,
        'ubicacion': ubicacion,
        'experiencia': experiencia_int,
        'habilidades': habilidades,
        'disponibilidad': disponibilidad,
        'tipo_precio': tipo_precio,
        'incluye_materiales': incluye_materiales
    }, errors


# ==================== RUTAS PRINCIPALES ====================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/registro')
def mostrar_formulario_registro():
    return render_template('registro.html')

@app.route('/iniciar_sesion')
def mostrar_formulario_inicio_sesion():
    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/registrar_usuario_web', methods=['POST'])
def registrar_usuario_web():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        errors = {}

        email = clean_text(data.get('email', '')).lower()
        password = data.get('password') or ''
        confirm_password = data.get('confirmPassword') or ''
        user_type = clean_text(data.get('userType', '')).lower()
        terms_checked = data.get('termsCheck') == 'on'

        if not email:
            errors['email'] = 'El correo electrónico es obligatorio.'
        elif len(email) > 150:
            errors['email'] = 'El correo electrónico debe tener máximo 150 caracteres.'
        elif not is_valid_email(email):
            errors['email'] = 'Introduce un correo electrónico válido (ej. usuario@dominio.com).'

        password_validation_result = is_valid_password(password)
        if password_validation_result:
            errors['password'] = password_validation_result

        if not confirm_password:
            errors['confirmPassword'] = 'Confirma tu contraseña.'
        elif password != confirm_password:
            errors['confirmPassword'] = 'Las contraseñas no coinciden.'

        if not terms_checked:
            errors['termsCheck'] = 'Debes aceptar los términos y condiciones.'

        if not user_type:
            errors['userType'] = 'Selecciona un tipo de cuenta.'
        elif user_type not in ['prestador', 'cliente']:
            errors['userType'] = 'Tipo de cuenta no válido.'

        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute("SELECT id FROM Usuarios WHERE LOWER(Email) = ?", (email,))
            if cursor.fetchone():
                errors['email'] = 'Este correo electrónico ya está registrado.'

            first_name = clean_text(data.get('firstName', ''))
            last_name_p = clean_text(data.get('lastNameP', ''))
            last_name_m = clean_text(data.get('lastNameM', ''))
            candidate_phone = clean_text(data.get('candidatePhone', ''))

            if not first_name:
                errors['firstName'] = 'El nombre es obligatorio.'
            elif len(first_name) > 100:
                errors['firstName'] = 'El nombre debe tener máximo 100 caracteres.'
            elif not is_valid_person_name_field(first_name):
                errors['firstName'] = 'Solo se permiten letras, espacios y acentos en el nombre.'

            if not last_name_p:
                errors['lastNameP'] = 'El apellido paterno es obligatorio.'
            elif len(last_name_p) > 100:
                errors['lastNameP'] = 'El apellido paterno debe tener máximo 100 caracteres.'
            elif not is_valid_person_name_field(last_name_p, is_apellido=True):
                errors['lastNameP'] = 'Solo se permite un apellido en el campo de apellido paterno.'

            if not last_name_m:
                errors['lastNameM'] = 'El apellido materno es obligatorio.'
            elif len(last_name_m) > 100:
                errors['lastNameM'] = 'El apellido materno debe tener máximo 100 caracteres.'
            elif not is_valid_person_name_field(last_name_m, is_apellido=True):
                errors['lastNameM'] = 'Solo se permite un apellido en el campo de apellido materno.'

            if candidate_phone and not is_valid_phone_number(candidate_phone):
                errors['candidatePhone'] = 'El número de teléfono debe contener entre 10 y 20 dígitos numéricos.'

            if errors:
                status_code = 409 if 'email' in errors and 'registrado' in errors['email'] else 400
                return jsonify({'success': False, 'errors': errors, 'message': 'Errores de validación.'}), status_code

            conn.autocommit = False
            try:
                hashed_password = hash_password(password)

                sql_query_usuario = "INSERT INTO Usuarios (Email, PasswordHash, Activo, CreadoEn, UltimoLogin) VALUES (?, ?, ?, ?, ?)"
                current_time = datetime.now()
                cursor.execute(sql_query_usuario, (email, hashed_password, 1, current_time, current_time))

                cursor.execute("SELECT id FROM Usuarios WHERE Email = ?", (email,))
                user_id = cursor.fetchone()[0]

                sql_query_persona = "INSERT INTO Personas (UsuarioId, Nombre, ApellidoP, ApellidoM, Telefono) VALUES (?, ?, ?, ?, ?)"
                cursor.execute(sql_query_persona, (user_id, first_name, last_name_p, last_name_m, cifrar_dato(candidate_phone) if candidate_phone else None))

                if user_type == 'prestador':
                    sql_query_prestador = "INSERT INTO Prestadores (UsuarioId, Verificado, RatingPromedio, TotalResenas) VALUES (?, ?, ?, ?)"
                    cursor.execute(sql_query_prestador, (user_id, 0, 0.0, 0))

                conn.commit()
                print("Datos insertados y commit realizado con éxito.")

                try:
                    enviar_correo_bienvenida(email, user_type)
                except Exception as e:
                    print(f"Error enviando correo: {e}")

                return jsonify({'success': True, 'message': '¡Registro exitoso!'}), 200

            except Exception as inner_ex:
                conn.rollback()
                raise inner_ex

        except pyodbc.Error as ex:
            sqlstate = ex.args[0]
            print(f"Error de base de datos en registro (sqlstate: {sqlstate}): {ex}")
            if sqlstate == '23000':
                return jsonify({'success': False, 'message': 'El correo electrónico ya está registrado. por favor, utiliza otro.', 'errors': {'email': 'Este correo electrónico ya está registrado.'}}), 409
            else:
                return jsonify({'success': False, 'message': 'No fue posible completar el registro.'}), 500
        except Exception as e:
            print(f"Error inesperado en el servidor durante el registro: {e}")
            return jsonify({'success': False, 'message': 'No fue posible completar el registro.'}), 500
        finally:
            if conn:
                conn.autocommit = True
                conn.close()

@app.route('/login', methods=['POST'])
def login_usuario():
    if request.method == 'POST':
        correo = clean_text(request.form.get('email', '')).lower()
        contrasena_ingresada = request.form.get('password', '')

        if not correo or not contrasena_ingresada:
            return jsonify({'success': False, 'message': 'Por favor, ingresa tu correo y contraseña.'}), 400

        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute("""
                SELECT u.id, u.PasswordHash, u.Activo, u.Email,
                       u.CreadoEn, u.UltimoLogin
                FROM Usuarios u
                WHERE u.Email = ?
            """, (correo,))
            resultado = cursor.fetchone()

            if resultado:
                user_id = resultado[0]
                contrasena_hasheada_db = resultado[1]
                activo = resultado[2]
                correo_usuario = resultado[3]
                fecha_registro = resultado[4]
                ultima_sesion = resultado[5]

                if not activo:
                    record_auth_event('login', 'failed_inactive', 'web')
                    return jsonify({'success': False, 'message': 'Tu cuenta está desactivada. Contacta al administrador.'}), 401

                if verificar_password(contrasena_hasheada_db, contrasena_ingresada):
                    if password_necesita_rehash(contrasena_hasheada_db):
                        cursor.execute(
                            "UPDATE Usuarios SET PasswordHash = ?, UltimoLogin = ? WHERE id = ?",
                            (hash_password(contrasena_ingresada), datetime.now(), user_id)
                        )
                    else:
                        cursor.execute("UPDATE Usuarios SET UltimoLogin = ? WHERE id = ?", (datetime.now(), user_id))
                    conn.commit()

                    cursor.execute("SELECT Nombre, ApellidoP, ApellidoM, Telefono, FotoPerfil FROM Personas WHERE UsuarioId = ?", (user_id,))
                    persona_data = cursor.fetchone()

                    tipo_usuario = get_user_type(cursor, user_id, correo_usuario)

                    session['usuario_autenticado'] = True
                    session['user_id'] = user_id
                    session['correo'] = correo_usuario
                    session['tipo_usuario'] = tipo_usuario
                    session['fecha_registro'] = fecha_registro.strftime('%d de %B de %Y') if fecha_registro else 'n/a'
                    session['ultima_sesion'] = datetime.now().strftime('%d de %B de %Y, %I:%M %p')

                    if persona_data:
                        session['nombres'] = persona_data[0]
                        session['apellido_paterno'] = persona_data[1]
                        session['apellido_materno'] = persona_data[2]
                        session['telefono'] = descifrar_dato(persona_data[3])
                        session['foto_perfil'] = persona_data[4]
                    else:
                        session['nombres'] = 'Usuario'
                        session['apellido_paterno'] = ''
                        session['apellido_materno'] = ''
                        session['telefono'] = ''
                        session['foto_perfil'] = None

                    g.safe_user_id = user_id
                    g.safe_user_role = tipo_usuario
                    record_auth_event('login', 'success', 'web')
                    return jsonify({'success': True, 'message': '¡Bienvenido! has iniciado sesión exitosamente.'}), 200
                else:
                    record_auth_event('login', 'failed', 'web')
                    return jsonify({'success': False, 'message': 'Contraseña incorrecta. por favor, inténtalo de nuevo.'}), 401
            else:
                record_auth_event('login', 'failed', 'web')
                return jsonify({'success': False, 'message': 'Correo electrónico no registrado.'}), 404

        except pyodbc.Error as ex:
            sqlstate = ex.args[0]
            print(f"Error de base de datos en login (sqlstate: {sqlstate}): {ex}")
            return jsonify({'success': False, 'message': 'No fue posible iniciar sesión.'}), 500
        except Exception as e:
            print(f"Error inesperado en el servidor durante el login: {e}")
            return jsonify({'success': False, 'message': 'No fue posible iniciar sesión.'}), 500
        finally:
            if conn:
                conn.close()

@app.route('/get_user_data', methods=['GET'])
def get_user_data():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'message': 'No autenticado'}), 401

    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'message': 'Id de usuario no encontrado en la sesión'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        ensure_control_schema(cursor)
        cursor.execute("""
            SELECT u.Email, p.Nombre, p.ApellidoP, p.ApellidoM, p.Telefono, p.FotoPerfil
            FROM Usuarios u
            JOIN Personas p ON u.id = p.UsuarioId
            WHERE u.id = ?
        """, (user_id,))
        user_data = cursor.fetchone()

        if not user_data:
            return jsonify({'message': 'Datos de usuario no encontrados'}), 404

        response_data = {
            'correo': user_data[0],
            'nombres': user_data[1],
            'apellido_paterno': user_data[2],
            'apellido_materno': user_data[3],
            'telefono': descifrar_dato(user_data[4]),
            'foto_perfil': user_data[5],
            'tipo_usuario': session.get('tipo_usuario', 'cliente'),
            'fecha_registro': session.get('fecha_registro'),
            'ultima_sesion': session.get('ultima_sesion')
        }
        return jsonify(response_data), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener datos de usuario (sqlstate: {sqlstate}): {ex}")
        return jsonify({'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al obtener datos de usuario: {e}")
        return jsonify({'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()


@app.route('/api/mobile/auth/login', methods=['POST'])
def mobile_auth_login():
    data = request.get_json(silent=True) or request.form
    correo = (data.get('email') or '').strip().lower()
    contrasena_ingresada = data.get('password') or ''
    device_name = (request.headers.get('X-Device-Name') or data.get('device_name') or '').strip()[:255] or None
    errors = {}

    if not correo:
        errors['email'] = 'El correo es obligatorio.'
    elif len(correo) > 150 or not is_valid_email(correo):
        errors['email'] = 'Ingresa un correo válido.'
    if not contrasena_ingresada:
        errors['password'] = 'La contraseña es obligatoria.'
    if errors:
        return validation_response(errors)

    conn = None
    try:
        ensure_jwt_configured()
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_mobile_refresh_schema(cursor)
        cursor.execute("""
            SELECT u.id, u.PasswordHash, u.Activo, u.Email, p.Nombre, p.ApellidoP, p.ApellidoM, p.FotoPerfil
            FROM Usuarios u
            LEFT JOIN Personas p ON u.id = p.UsuarioId
            WHERE LOWER(u.Email) = ?
        """, (correo,))
        resultado = cursor.fetchone()

        if not resultado or not verificar_password(resultado[1], contrasena_ingresada):
            record_auth_event('login', 'failed', 'mobile')
            return jsonify({'success': False, 'message': 'Credenciales incorrectas'}), 401
        if not resultado[2]:
            record_auth_event('login', 'failed_inactive', 'mobile')
            return jsonify({'success': False, 'message': 'Cuenta inactiva'}), 403

        user = {
            'id': resultado[0],
            'email': resultado[3],
            'activo': bool(resultado[2]),
            'nombre': resultado[4],
            'apellido_paterno': resultado[5],
            'apellido_materno': resultado[6],
            'foto_perfil': resultado[7],
            'tipo_usuario': get_user_type(cursor, resultado[0], resultado[3]),
        }

        if user['tipo_usuario'] == 'administrador':
            record_auth_event('login', 'failed_admin_mobile', 'mobile')
            return jsonify({
                'success': False,
                'message': 'La administración debe realizarse desde la plataforma web.'
            }), 403

        if password_necesita_rehash(resultado[1]):
            cursor.execute(
                "UPDATE Usuarios SET PasswordHash = ?, UltimoLogin = ? WHERE id = ?",
                (hash_password(contrasena_ingresada), datetime.now(), user['id'])
            )
        else:
            cursor.execute("UPDATE Usuarios SET UltimoLogin = ? WHERE id = ?", (datetime.now(), user['id']))

        access_token, refresh_token = issue_mobile_tokens(cursor, user, device_name)
        conn.commit()

        g.safe_user_id = user['id']
        g.safe_user_role = user['tipo_usuario']
        record_auth_event('login', 'success', 'mobile')
        return jsonify({
            'success': True,
            'token_type': 'Bearer',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'access_expires_in': JWT_ACCESS_MINUTES * 60,
            'refresh_expires_in': JWT_REFRESH_DAYS * 24 * 60 * 60,
            'user': mobile_user_response(user),
            'role': user['tipo_usuario'],
        }), 200

    except RuntimeError as e:
        record_auth_event('login', 'failed_config', 'mobile')
        return jsonify({'success': False, 'message': str(e)}), 500
    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos en login móvil (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': 'No fue posible iniciar sesión.'}), 500
    except Exception as e:
        print(f"Error inesperado en login móvil: {e}")
        return jsonify({'success': False, 'message': 'No fue posible iniciar sesión.'}), 500
    finally:
        if conn:
            conn.close()


@app.route('/api/mobile/auth/me', methods=['GET'])
@jwt_required()
def mobile_auth_me():
    user, response, status = load_mobile_jwt_user()
    if response is not None:
        return response, status
    if user['tipo_usuario'] == 'administrador':
        return jsonify({'success': False, 'message': 'La administración debe realizarse desde la plataforma web.'}), 403
    return jsonify({'success': True, 'user': mobile_user_response(user), 'role': user['tipo_usuario']}), 200


def mobile_profile_payload(cursor, user_id):
    cursor.execute("""
        SELECT u.id, u.Email, u.Activo, u.CreadoEn,
               p.Nombre, p.ApellidoP, p.ApellidoM, p.Telefono, p.FotoPerfil,
               pr.Verificado, pr.RatingPromedio, pr.TotalResenas
        FROM Usuarios u
        LEFT JOIN Personas p ON u.id = p.UsuarioId
        LEFT JOIN Prestadores pr ON u.id = pr.UsuarioId
        WHERE u.id = ?
    """, (user_id,))
    row = cursor.fetchone()
    if not row:
        return None

    role = get_user_type(cursor, row[0], row[1])
    profile = {
        'usuario_id': row[0],
        'email': row[1],
        'rol': role,
        'nombre': row[4] or '',
        'apellido_paterno': row[5] or '',
        'apellido_materno': row[6] or '',
        'telefono': descifrar_dato(row[7]) or '',
        'foto_perfil': row[8],
        'fecha_registro': row[3].strftime('%d/%m/%Y') if row[3] else '',
        'activo': bool(row[2]),
    }
    if role == 'prestador':
        profile['profesional'] = {
            'verificado': bool(row[9]) if row[9] is not None else False,
            'rating_promedio': float(row[10]) if row[10] is not None else None,
            'total_resenas': int(row[11] or 0),
        }
    return profile


def validate_mobile_profile_payload(data):
    allowed_fields = {'nombre', 'apellido_paterno', 'apellido_materno', 'telefono'}
    blocked_fields = {'usuario_id', 'id', 'email', 'rol', 'tipo_usuario', 'activo', 'password', 'password_hash', 'PasswordHash'}
    errors = reject_unknown_fields(data, allowed_fields, blocked_fields)
    cleaned = {}

    if 'nombre' in data:
        value = clean_text(data.get('nombre'))
        if not value:
            errors['nombre'] = 'El nombre es obligatorio.'
        elif len(value) > 100 or not is_valid_person_name_field(value):
            errors['nombre'] = 'El nombre solo debe contener letras, espacios y acentos.'
        else:
            cleaned['Nombre'] = ' '.join(word.capitalize() for word in value.split())

    for api_field, db_field, label in (
        ('apellido_paterno', 'ApellidoP', 'apellido paterno'),
        ('apellido_materno', 'ApellidoM', 'apellido materno'),
    ):
        if api_field in data:
            value = clean_text(data.get(api_field))
            if not value:
                errors[api_field] = f'El {label} es obligatorio.'
            elif len(value) > 100 or not is_valid_person_name_field(value, is_apellido=True):
                errors[api_field] = f'El {label} solo debe contener letras, espacios y acentos.'
            else:
                cleaned[db_field] = ' '.join(word.capitalize() for word in value.split())

    if 'telefono' in data:
        phone = clean_text(data.get('telefono'))
        if phone and not is_valid_phone_number(phone):
            errors['telefono'] = 'El teléfono debe contener entre 10 y 20 dígitos.'
        else:
            cleaned['Telefono'] = cifrar_dato(phone) if phone else None

    return cleaned, errors


def validate_mobile_profile_photo(file_storage):
    if not file_storage or file_storage.filename == '':
        return False, 'Selecciona una foto válida.', None

    safe_name = secure_filename(file_storage.filename)
    extension = safe_name.rsplit('.', 1)[1].lower() if '.' in safe_name else ''
    if extension == 'jpeg':
        extension = 'jpg'
    if extension not in {'jpg', 'png', 'webp'}:
        return False, 'Solo se permiten imágenes JPEG, PNG o WebP.', None

    file_storage.stream.seek(0, os.SEEK_END)
    size = file_storage.stream.tell()
    file_storage.stream.seek(0)
    if size <= 0:
        return False, 'La foto está vacía.', None
    if size > app.config['MAX_CONTENT_LENGTH']:
        return False, 'La foto debe pesar máximo 2 MB.', None

    header = file_storage.stream.read(32)
    file_storage.stream.seek(0)
    mime_real, extension_real = detectar_tipo_imagen(header)
    if not mime_real:
        return False, 'El archivo no parece ser una imagen válida.', None
    if extension_real != extension:
        return False, 'La extensión no coincide con el contenido de la imagen.', None
    if (file_storage.mimetype or '').lower() not in {'', 'image/jpeg', 'image/png', 'image/webp'}:
        return False, 'El tipo de archivo no está permitido.', None

    return True, '', {'extension': extension_real, 'size': size}


def maybe_remove_previous_profile_photo(cursor, user_id, previous_path):
    if not previous_path or not previous_path.startswith('/static/uploads/perfiles/'):
        return
    cursor.execute("SELECT COUNT(*) FROM Personas WHERE FotoPerfil = ? AND UsuarioId <> ?", (previous_path, user_id))
    if cursor.fetchone()[0]:
        return
    absolute = os.path.join(app.root_path, previous_path.lstrip('/'))
    try:
        if os.path.isfile(absolute):
            os.remove(absolute)
    except OSError:
        logger.warning('profile_photo_cleanup_failed', extra={'event': 'profile.photo.cleanup_failed'})


@app.route('/api/mobile/perfil', methods=['GET'])
@jwt_required()
def mobile_get_profile():
    user, response, status = load_mobile_jwt_user()
    if response is not None:
        return response, status

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        profile = mobile_profile_payload(cursor, user['id'])
        if not profile:
            return jsonify({'success': False, 'message': 'Perfil no encontrado.'}), 404
        return jsonify({'success': True, 'perfil': profile}), 200
    except pyodbc.Error as ex:
        print(f"Error de base de datos al obtener perfil móvil (sqlstate: {ex.args[0]}): {ex}")
        return jsonify({'success': False, 'message': 'No fue posible cargar el perfil.'}), 500
    except Exception as e:
        print(f"Error inesperado al obtener perfil móvil: {e}")
        return jsonify({'success': False, 'message': 'Ocurrió un error inesperado.'}), 500
    finally:
        if conn:
            conn.close()


@app.route('/api/mobile/perfil', methods=['PATCH', 'PUT'])
@jwt_required()
def mobile_update_profile():
    user, response, status = load_mobile_jwt_user()
    if response is not None:
        return response, status

    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return validation_response({'perfil': 'Envía un objeto válido.'})
    updates, errors = validate_mobile_profile_payload(data)
    if errors:
        return validation_response(errors)

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT UsuarioId FROM Personas WHERE UsuarioId = ?", (user['id'],))
        if not cursor.fetchone():
            return jsonify({'success': False, 'message': 'Perfil no encontrado.'}), 404
        if updates:
            assignments = ', '.join(f"{field} = ?" for field in updates)
            values = list(updates.values()) + [user['id']]
            cursor.execute(f"UPDATE Personas SET {assignments} WHERE UsuarioId = ?", values)
            audit_event(cursor, 'perfil_actualizado_mobile', 'Usuarios', user['id'],
                        'El usuario actualizó sus datos desde la aplicación móvil.',
                        usuario_id=user['id'], actor_id=user['id'])
        profile = mobile_profile_payload(cursor, user['id'])
        conn.commit()
        return jsonify({'success': True, 'message': 'Perfil actualizado.', 'perfil': profile}), 200
    except pyodbc.Error as ex:
        if conn:
            conn.rollback()
        print(f"Error de base de datos al actualizar perfil móvil (sqlstate: {ex.args[0]}): {ex}")
        return jsonify({'success': False, 'message': 'No fue posible actualizar el perfil.'}), 500
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error inesperado al actualizar perfil móvil: {e}")
        return jsonify({'success': False, 'message': 'Ocurrió un error inesperado.'}), 500
    finally:
        if conn:
            conn.close()


@app.route('/api/mobile/perfil/foto', methods=['POST'])
@jwt_required()
def mobile_update_profile_photo():
    user, response, status = load_mobile_jwt_user()
    if response is not None:
        return response, status

    photo = request.files.get('foto')
    valid, message, meta = validate_mobile_profile_photo(photo)
    if not valid:
        return jsonify({'success': False, 'message': message}), 400

    conn = None
    saved_path = None
    try:
        profile_dir = os.path.join(app.root_path, 'static', 'uploads', 'perfiles')
        os.makedirs(profile_dir, exist_ok=True)
        filename = f"{user['id']}_{datetime.now().strftime('%Y%m%d%H%M%S%f')}_{secrets.token_hex(4)}.{meta['extension']}"
        saved_path = os.path.join(profile_dir, filename)
        public_path = f"/static/uploads/perfiles/{filename}"
        photo.save(saved_path)

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT FotoPerfil FROM Personas WHERE UsuarioId = ?", (user['id'],))
        row = cursor.fetchone()
        if not row:
            if saved_path and os.path.exists(saved_path):
                os.remove(saved_path)
            return jsonify({'success': False, 'message': 'Perfil no encontrado.'}), 404
        previous_path = row[0]
        cursor.execute("UPDATE Personas SET FotoPerfil = ? WHERE UsuarioId = ?", (public_path, user['id']))
        audit_event(cursor, 'foto_perfil_actualizada_mobile', 'Usuarios', user['id'],
                    'El usuario actualizó su foto desde la aplicación móvil.',
                    usuario_id=user['id'], actor_id=user['id'])
        profile = mobile_profile_payload(cursor, user['id'])
        conn.commit()
        maybe_remove_previous_profile_photo(cursor, user['id'], previous_path)
        return jsonify({'success': True, 'message': 'Foto actualizada.', 'foto_url': public_path, 'perfil': profile}), 200
    except pyodbc.Error as ex:
        if conn:
            conn.rollback()
        if saved_path and os.path.exists(saved_path):
            os.remove(saved_path)
        print(f"Error de base de datos al actualizar foto móvil (sqlstate: {ex.args[0]}): {ex}")
        return jsonify({'success': False, 'message': 'No fue posible actualizar la foto.'}), 500
    except Exception as e:
        if conn:
            conn.rollback()
        if saved_path and os.path.exists(saved_path):
            os.remove(saved_path)
        print(f"Error inesperado al actualizar foto móvil: {e}")
        return jsonify({'success': False, 'message': 'Ocurrió un error inesperado.'}), 500
    finally:
        if conn:
            conn.close()


@app.route('/api/mobile/auth/change-password', methods=['POST'])
@jwt_required()
def mobile_change_password():
    user, response, status = load_mobile_jwt_user()
    if response is not None:
        return response, status

    data = request.get_json(silent=True) or {}
    current_password = data.get('current_password') or ''
    new_password = data.get('new_password') or ''
    confirm_password = data.get('confirm_password') or ''
    errors = {}
    if not current_password:
        errors['current_password'] = 'La contraseña actual es obligatoria.'
    if not new_password:
        errors['new_password'] = 'La nueva contraseña es obligatoria.'
    else:
        password_error = is_valid_password(new_password)
        if password_error:
            errors['new_password'] = password_error
    if not confirm_password:
        errors['confirm_password'] = 'Confirma tu nueva contraseña.'
    elif new_password != confirm_password:
        errors['confirm_password'] = 'Las contraseñas no coinciden.'
    if errors:
        return validation_response(errors)

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT PasswordHash FROM Usuarios WHERE id = ?", (user['id'],))
        row = cursor.fetchone()
        if not row:
            return jsonify({'success': False, 'message': 'Usuario no encontrado.'}), 404
        if not verificar_password(row[0], current_password):
            return jsonify({'success': False, 'message': 'La contraseña actual es incorrecta.'}), 401
        if verificar_password(row[0], new_password):
            return jsonify({'success': False, 'message': 'La nueva contraseña no puede ser igual a la actual.'}), 409
        cursor.execute("UPDATE Usuarios SET PasswordHash = ? WHERE id = ?", (hash_password(new_password), user['id']))
        revoke_user_refresh_tokens(cursor, user['id'])
        audit_event(cursor, 'password_actualizado_mobile', 'Usuarios', user['id'],
                    'El usuario cambió su contraseña desde la aplicación móvil.',
                    usuario_id=user['id'], actor_id=user['id'])
        conn.commit()
        record_auth_event('change_password', 'success', 'mobile')
        return jsonify({'success': True, 'message': 'Contraseña actualizada. Inicia sesión nuevamente.'}), 200
    except pyodbc.Error as ex:
        if conn:
            conn.rollback()
        print(f"Error de base de datos al cambiar contraseña móvil (sqlstate: {ex.args[0]}): {ex}")
        return jsonify({'success': False, 'message': 'No fue posible cambiar la contraseña.'}), 500
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error inesperado al cambiar contraseña móvil: {e}")
        return jsonify({'success': False, 'message': 'Ocurrió un error inesperado.'}), 500
    finally:
        if conn:
            conn.close()


@app.route('/api/mobile/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def mobile_auth_refresh():
    refresh_token = bearer_token_from_request()
    claims = get_jwt()
    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        record_auth_event('refresh', 'failed', 'mobile')
        return jsonify({'success': False, 'message': 'Token inválido'}), 401

    conn = None
    try:
        ensure_jwt_configured()
        conn = get_db_connection()
        cursor = conn.cursor()
        user = fetch_mobile_user(cursor, user_id)
        if not user:
            record_auth_event('refresh', 'failed', 'mobile')
            return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 401
        if not user['activo']:
            revoke_user_refresh_tokens(cursor, user_id)
            conn.commit()
            record_auth_event('refresh', 'failed_inactive', 'mobile')
            return jsonify({'success': False, 'message': 'Cuenta inactiva'}), 403
        if user['tipo_usuario'] == 'administrador':
            revoke_user_refresh_tokens(cursor, user_id)
            conn.commit()
            record_auth_event('refresh', 'failed_admin_mobile', 'mobile')
            return jsonify({'success': False, 'message': 'La administración debe realizarse desde la plataforma web.'}), 403

        record, error = validate_refresh_token_record(cursor, user_id, claims['jti'], refresh_token)
        if error:
            if error in {'desconocido', 'revocado'}:
                revoke_user_refresh_tokens(cursor, user_id)
                conn.commit()
                record_security_warning('refresh.reuse_or_revoked')
            record_auth_event('refresh', 'failed', 'mobile')
            return jsonify({'success': False, 'message': 'Sesión inválida'}), 401

        access_token, new_refresh_token = issue_mobile_tokens(cursor, user, request.headers.get('X-Device-Name'))
        new_refresh_jti = decode_token(new_refresh_token)['jti']
        revoke_refresh_token(cursor, record[0], new_refresh_jti)
        conn.commit()

        g.safe_user_id = user['id']
        g.safe_user_role = user['tipo_usuario']
        record_auth_event('refresh', 'success', 'mobile')
        return jsonify({
            'success': True,
            'token_type': 'Bearer',
            'access_token': access_token,
            'refresh_token': new_refresh_token,
            'access_expires_in': JWT_ACCESS_MINUTES * 60,
            'refresh_expires_in': JWT_REFRESH_DAYS * 24 * 60 * 60,
            'user': mobile_user_response(user),
            'role': user['tipo_usuario'],
        }), 200

    except RuntimeError as e:
        record_auth_event('refresh', 'failed_config', 'mobile')
        return jsonify({'success': False, 'message': str(e)}), 500
    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al renovar token móvil (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': 'No fue posible renovar la sesión.'}), 500
    except Exception as e:
        print(f"Error inesperado al renovar token móvil: {e}")
        return jsonify({'success': False, 'message': 'No fue posible renovar la sesión.'}), 500
    finally:
        if conn:
            conn.close()


@app.route('/api/mobile/auth/logout', methods=['POST'])
@jwt_required(optional=True)
def mobile_auth_logout():
    data = request.get_json(silent=True) or {}
    refresh_token = (data.get('refresh_token') or '').strip()
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_mobile_refresh_schema(cursor)

        if refresh_token:
            try:
                payload = decode_token(refresh_token, allow_expired=True)
                user_id = int(payload['sub'])
                cursor.execute("""
                    UPDATE MobileRefreshTokens
                    SET RevocadoEn = COALESCE(RevocadoEn, ?),
                        UltimoUsoEn = ?
                    WHERE UsuarioId = ? AND Jti = ? AND TokenHash = ?
                """, (utc_now(), utc_now(), user_id, payload['jti'], hash_token(refresh_token)))
            except Exception:
                pass
        else:
            identity = get_jwt_identity()
            if identity:
                try:
                    revoke_user_refresh_tokens(cursor, int(identity))
                except (TypeError, ValueError):
                    pass

        conn.commit()
        record_auth_event('logout', 'success', 'mobile')
        return jsonify({'success': True, 'message': 'Sesión móvil cerrada'}), 200
    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al cerrar sesión móvil (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': 'No fue posible revocar la sesión en el servidor.'}), 500
    finally:
        if conn:
            conn.close()

@app.route('/subir_foto_perfil', methods=['POST'])
def subir_foto_perfil():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session['user_id']
    if 'foto' not in request.files:
        return jsonify({'success': False, 'message': 'No se envió ninguna foto'}), 400

    file = request.files['foto']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'Archivo vacío'}), 400

    if not allowed_file(file.filename):
        return jsonify({'success': False, 'message': 'Formato no permitido. Use PNG, JPG, JPEG o GIF'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    nuevo_nombre = f"{user_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.{ext}"
    ruta_relativa = f"/static/uploads/perfiles/{nuevo_nombre}"
    ruta_absoluta = os.path.join(app.root_path, 'static', 'uploads', 'perfiles', nuevo_nombre)

    file.save(ruta_absoluta)

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE Personas SET FotoPerfil = ? WHERE UsuarioId = ?", (ruta_relativa, user_id))
        conn.commit()

        session['foto_perfil'] = ruta_relativa

        return jsonify({'success': True, 'message': 'Foto actualizada', 'foto_url': ruta_relativa}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/obtener_foto_perfil', methods=['GET'])
def obtener_foto_perfil():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session['user_id']
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT FotoPerfil FROM Personas WHERE UsuarioId = ?", (user_id,))
        row = cursor.fetchone()
        foto_url = row[0] if row and row[0] else None
        return jsonify({'success': True, 'foto_url': foto_url}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()

# ==================== ACTUALIZAR PERFIL Y CONTRASEÑA ====================
@app.route('/actualizar_perfil', methods=['POST'])
def actualizar_perfil():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'Por favor, inicia sesión para actualizar tu perfil.'}), 401

    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': 'Error: no se pudo encontrar el id de usuario en la sesión.'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)

        nombres = request.form.get('nombres', '').strip()
        apellido_paterno = request.form.get('apellido_paterno', '').strip()
        apellido_materno = request.form.get('apellido_materno', '').strip()
        telefono = request.form.get('telefono', '').strip()

        if nombres:
            nombres = ' '.join(word.capitalize() for word in nombres.split())
        if apellido_paterno:
            apellido_paterno = ' '.join(word.capitalize() for word in apellido_paterno.split())
        if apellido_materno:
            apellido_materno = ' '.join(word.capitalize() for word in apellido_materno.split())

        if not nombres:
            return jsonify({'success': False, 'message': 'El nombre es obligatorio.'}), 400
        if not is_valid_person_name_field(nombres):
            return jsonify({'success': False, 'message': 'El nombre solo debe contener letras, espacios y acentos.'}), 400

        if not apellido_paterno:
            return jsonify({'success': False, 'message': 'El apellido paterno es obligatorio.'}), 400
        if not is_valid_person_name_field(apellido_paterno, is_apellido=True):
            return jsonify({'success': False, 'message': 'El apellido paterno solo debe contener una palabra, letras, espacios y acentos.'}), 400

        if not apellido_materno:
            return jsonify({'success': False, 'message': 'El apellido materno es obligatorio.'}), 400
        if not is_valid_person_name_field(apellido_materno, is_apellido=True):
            return jsonify({'success': False, 'message': 'El apellido materno solo debe contener una palabra, letras, espacios y acentos.'}), 400

        if telefono and not is_valid_phone_number(telefono):
            return jsonify({'success': False, 'message': 'El número de teléfono debe contener entre 10 y 20 dígitos numéricos.'}), 400

        sql_update_persona = """
            UPDATE Personas
            SET Nombre = ?, ApellidoP = ?, ApellidoM = ?, Telefono = ?
            WHERE UsuarioId = ?
        """
        cursor.execute(sql_update_persona, (nombres, apellido_paterno, apellido_materno, cifrar_dato(telefono) if telefono else None, user_id))
        audit_event(cursor, 'perfil_actualizado', 'Usuarios', user_id,
                    'El usuario actualizó sus datos de perfil.', usuario_id=user_id, actor_id=user_id)

        session['nombres'] = nombres
        session['apellido_paterno'] = apellido_paterno
        session['apellido_materno'] = apellido_materno
        session['telefono'] = telefono

        conn.commit()
        return jsonify({'success': True, 'message': 'Tu perfil ha sido actualizado exitosamente.'}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al actualizar perfil (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Ocurrió un error en la base de datos al actualizar tu perfil: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al actualizar perfil: {e}")
        return jsonify({'success': False, 'message': f"Ocurrió un error inesperado al actualizar tu perfil: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/cambiar_contrasena', methods=['POST'])
def cambiar_contrasena():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'Por favor, inicia sesión para cambiar tu contraseña.'}), 401

    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': 'Error: no se pudo encontrar el id de usuario en la sesión.'}), 400

    contrasena_actual = request.form.get('contrasena_actual', '').strip()
    nueva_contrasena = request.form.get('nueva_contrasena', '').strip()
    confirmar_nueva_contrasena = request.form.get('confirmar_nueva_contrasena', '').strip()

    if not contrasena_actual:
        return jsonify({'success': False, 'message': 'La contraseña actual es obligatoria.'}), 400
    if not nueva_contrasena:
        return jsonify({'success': False, 'message': 'La nueva contraseña es obligatoria.'}), 400
    if not confirmar_nueva_contrasena:
        return jsonify({'success': False, 'message': 'Confirma tu nueva contraseña.'}), 400

    if nueva_contrasena != confirmar_nueva_contrasena:
        return jsonify({'success': False, 'message': 'Las contraseñas no coinciden.'}), 400

    password_validation_result = is_valid_password(nueva_contrasena)
    if password_validation_result:
        return jsonify({'success': False, 'message': password_validation_result}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("SELECT PasswordHash FROM Usuarios WHERE id = ?", (user_id,))
        resultado = cursor.fetchone()

        if resultado and verificar_password(resultado[0], contrasena_actual):
            nueva_contrasena_hasheada = hash_password(nueva_contrasena)
            sql_update_contrasena = "UPDATE Usuarios SET PasswordHash = ? WHERE id = ?"
            cursor.execute(sql_update_contrasena, (nueva_contrasena_hasheada, user_id))
            conn.commit()
            return jsonify({'success': True, 'message': 'Tu contraseña ha sido cambiada exitosamente.'}), 200
        else:
            return jsonify({'success': False, 'message': 'La contraseña actual es incorrecta.'}), 401

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al cambiar contraseña (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Ocurrió un error en la base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al cambiar contraseña: {e}")
        return jsonify({'success': False, 'message': f"Ocurrió un error inesperado al cambiar tu contraseña: {e}"}), 500
    finally:
        if conn:
            conn.close()

# ==================== PUBLICACIONES ====================
@app.route('/crear_publicacion', methods=['POST'])
def crear_publicacion():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'Por favor, inicia sesión para crear una publicación.'}), 401

    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')
    if tipo_usuario != 'prestador':
        return jsonify({'success': False, 'message': 'Solo los prestadores pueden crear publicaciones.'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        datos, errors = validar_datos_publicacion(request.form, cursor)
        if errors:
            return validation_response(errors)
        imagenes = request.files.getlist('imagenes')

        sql_insert = """
            INSERT INTO Publicaciones (UsuarioId, Titulo, Descripcion, Categoria, Precio, Ubicacion,
                                       Experiencia, Habilidades, Disponibilidad, IncluyeMateriales, TipoPrecio,
                                       Activa, EstadoRevision, ComentarioRevision)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pendiente_revision', NULL)
        """
        cursor.execute(sql_insert, (
            user_id, datos['titulo'], datos['descripcion'], datos['categoria'], datos['precio'],
            datos['ubicacion'], datos['experiencia'], datos['habilidades'], datos['disponibilidad'],
            datos['incluye_materiales'], datos['tipo_precio']
        ))
        publicacion_row = cursor.fetchone()
        if not publicacion_row or publicacion_row[0] is None:
            raise RuntimeError('No fue posible obtener el identificador de la publicación creada.')
        nueva_publicacion_id = int(publicacion_row[0])
        version_id = crear_version_publicacion(cursor, nueva_publicacion_id, user_id, datos)
        guardar_imagenes_version(cursor, nueva_publicacion_id, version_id, user_id, imagenes)
        audit_event(cursor, 'publicacion_enviada_revision', 'Publicaciones', nueva_publicacion_id,
                    f"Publicación creada por prestador y enviada a revisión: {datos['titulo']}",
                    usuario_id=user_id, actor_id=user_id)
        crear_alerta(cursor, 'publicacion_revision', 'Nueva publicación pendiente',
                     f"{datos['titulo']} fue enviada a revisión administrativa.",
                     publicacion_id=nueva_publicacion_id, version_id=version_id, rol_destino='administrador')
        conn.commit()
        record_business_event('publicacion_creada', 'web')
        return jsonify({'success': True, 'message': 'Publicación enviada a revisión del administrador. Aparecerá en marketplace cuando sea aprobada.'}), 200

    except ValueError as e:
        if conn:
            conn.rollback()
        return jsonify({'success': False, 'message': str(e)}), 400
    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al crear publicación (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Ocurrió un error en la base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al crear publicación: {e}")
        return jsonify({'success': False, 'message': f"Ocurrió un error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/mis_publicaciones', methods=['GET'])
def mis_publicaciones():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)

        if tipo_usuario == 'prestador':
            cursor.execute("""
                SELECT pub.id, v.Titulo, v.Descripcion, v.Categoria, v.Precio, v.Ubicacion, v.Experiencia,
                       v.Habilidades, v.Disponibilidad, v.IncluyeMateriales, v.TipoPrecio, v.CreadoEn, pub.Activa,
                       v.Estado, COALESCE(v.Observaciones, v.MotivoRechazo, pub.ComentarioRevision), v.RevisadoEn, v.ActualizadoEn,
                       v.id, v.VersionNumero,
                       (SELECT TOP 1 pv.VersionNumero FROM PublicacionVersiones pv WHERE pv.PublicacionId = pub.id AND pv.EsVersionPublica = 1 ORDER BY pv.VersionNumero DESC) AS VersionPublica,
                       (SELECT TOP 1 ImagenUrl FROM PublicacionImagenes img WHERE img.VersionId = v.id AND img.EstadoRevision <> 'eliminada' ORDER BY img.EsPrincipal DESC, img.Posicion) AS ImagenPrincipal
                FROM Publicaciones pub
                INNER JOIN PublicacionVersiones v ON v.id = (
                    SELECT TOP 1 pv.id
                    FROM PublicacionVersiones pv
                    WHERE pv.PublicacionId = pub.id
                    ORDER BY pv.VersionNumero DESC
                )
                WHERE pub.UsuarioId = ?
                ORDER BY v.CreadoEn DESC
            """, (user_id,))
        else:
            cursor.execute("""
                SELECT id, Titulo, Descripcion, Categoria, Precio, Ubicacion, Experiencia,
                       Habilidades, Disponibilidad, IncluyeMateriales, TipoPrecio, FechaCreacion, Activa,
                       EstadoRevision, ComentarioRevision, FechaRevision, FechaActualizacion
                FROM Publicaciones
                WHERE Activa = 1 AND EXISTS (
                    SELECT 1 FROM PublicacionVersiones pv
                    WHERE pv.PublicacionId = Publicaciones.id AND pv.Estado = 'aprobada' AND pv.EsVersionPublica = 1
                )
                ORDER BY FechaCreacion DESC
            """)

        publicaciones = cursor.fetchall()
        publicaciones_list = []
        for pub in publicaciones:
            publicaciones_list.append({
                'id': pub[0],
                'titulo': pub[1],
                'descripcion': pub[2],
                'categoria': pub[3],
                'precio': float(pub[4]) if pub[4] else None,
                'ubicacion': pub[5],
                'experiencia': pub[6],
                'habilidades': pub[7],
                'disponibilidad': pub[8],
                'incluye_materiales': bool(pub[9]),
                'tipo_precio': pub[10],
                'fecha_creacion': pub[11].strftime('%d/%m/%Y %H:%M') if pub[11] else '',
                'activa': bool(pub[12]),
                'estado_revision': pub[13],
                'comentario_revision': pub[14] or '',
                'fecha_revision': fmt_datetime(pub[15]),
                'fecha_actualizacion': fmt_datetime(pub[16]),
                'version_id': pub[17] if len(pub) > 17 else None,
                'version_numero': pub[18] if len(pub) > 18 else None,
                'version_publica': pub[19] if len(pub) > 19 else None,
                'imagen_principal': pub[20] if len(pub) > 20 else None
            })

        return jsonify({'success': True, 'publicaciones': publicaciones_list}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener publicaciones (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al obtener publicaciones: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/publicaciones_activas', methods=['GET'])
def publicaciones_activas():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("""
            SELECT p.id, p.Titulo, p.Descripcion, p.Categoria, p.Precio, p.Ubicacion,
                   p.Experiencia, p.Habilidades, p.Disponibilidad, p.IncluyeMateriales,
                   p.TipoPrecio, p.FechaCreacion,
                   per.Nombre, per.ApellidoP, per.ApellidoM, per.Telefono, per.FotoPerfil,
                   u.Email,
                   (SELECT TOP 1 img.ImagenUrl
                    FROM PublicacionImagenes img
                    INNER JOIN PublicacionVersiones pv ON img.VersionId = pv.id
                    WHERE img.PublicacionId = p.id AND pv.EsVersionPublica = 1
                      AND img.EstadoRevision = 'aprobada'
                    ORDER BY img.EsPrincipal DESC, img.Posicion) AS ImagenPrincipal
            FROM Publicaciones p
            INNER JOIN Usuarios u ON p.UsuarioId = u.id
            INNER JOIN Personas per ON u.id = per.UsuarioId
            WHERE p.Activa = 1 AND EXISTS (
                SELECT 1 FROM PublicacionVersiones pv
                WHERE pv.PublicacionId = p.id AND pv.Estado = 'aprobada' AND pv.EsVersionPublica = 1
            )
            ORDER BY p.FechaCreacion DESC
        """)
        publicaciones = cursor.fetchall()
        publicaciones_list = []
        for pub in publicaciones:
            precio_texto = f"${pub[4]}" if pub[4] else "Consultar precio"
            if pub[4] and pub[10]:
                tipo_precio_map = {'hora': '/hora', 'servicio': '/servicio', 'dia': '/día', 'proyecto': '/proyecto'}
                precio_texto = f"${pub[4]}{tipo_precio_map.get(pub[10], '')}"

            publicaciones_list.append({
                'id': pub[0],
                'titulo': pub[1],
                'descripcion': pub[2],
                'categoria': pub[3],
                'precio': float(pub[4]) if pub[4] else None,
                'precio_texto': precio_texto,
                'ubicacion': pub[5],
                'experiencia': pub[6],
                'habilidades': pub[7],
                'disponibilidad': pub[8],
                'incluye_materiales': bool(pub[9]),
                'tipo_precio': pub[10],
                'fecha_creacion': pub[11].strftime('%d/%m/%Y') if pub[11] else '',
                'prestador_nombre': f"{pub[12]} {pub[13]} {pub[14]}",
                'prestador_telefono': descifrar_dato(pub[15]),
                'prestador_foto': pub[16],
                'prestador_email': pub[17],
                'imagen_principal': pub[18]
            })

        return jsonify({'success': True, 'publicaciones': publicaciones_list}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener publicaciones activas (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al obtener publicaciones activas: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()


@app.route('/api/mobile/publicaciones_activas', methods=['GET'])
def mobile_publicaciones_activas():
    return publicaciones_activas()


@app.route('/api/mobile/categorias', methods=['GET'])
def mobile_categorias():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        categorias = list_active_categories(cursor)
        return jsonify({'success': True, 'categorias': categorias}), 200
    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener categorías móviles (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': 'No fue posible cargar las categorías.'}), 500
    except Exception as e:
        print(f"Error inesperado al obtener categorías móviles: {e}")
        return jsonify({'success': False, 'message': 'No fue posible cargar las categorías.'}), 500
    finally:
        if conn:
            conn.close()


@app.route('/categorias', methods=['GET'])
def categorias():
    return mobile_categorias()

@app.route('/toggle_publicacion/<int:publicacion_id>', methods=['POST'])
def toggle_publicacion(publicacion_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session.get('user_id')
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("SELECT Activa, EstadoRevision FROM Publicaciones WHERE id = ? AND UsuarioId = ?", (publicacion_id, user_id))
        publicacion = cursor.fetchone()
        if not publicacion:
            return jsonify({'success': False, 'message': 'Publicación no encontrada o no tienes permisos.'}), 404

        nuevo_estado = not publicacion[0]
        if nuevo_estado and publicacion[1] != 'aprobada':
            return jsonify({'success': False, 'message': 'La publicación debe ser aprobada por el administrador antes de activarse.'}), 400
        cursor.execute("UPDATE Publicaciones SET Activa = ? WHERE id = ?", (nuevo_estado, publicacion_id))
        audit_event(cursor, 'publicacion_estado_prestador', 'Publicaciones', publicacion_id,
                    f"Prestador {'activó' if nuevo_estado else 'desactivó'} la publicación.",
                    usuario_id=user_id, actor_id=user_id)
        conn.commit()
        estado_texto = "activada" if nuevo_estado else "desactivada"
        return jsonify({'success': True, 'message': f'Publicación {estado_texto} exitosamente.'}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al cambiar estado de publicación (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al cambiar estado de publicación: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

# ==================== DETALLES, BÚSQUEDA Y SOLICITUDES ====================
@app.route('/detalles_publicacion/<int:publicacion_id>', methods=['GET'])
def detalles_publicacion(publicacion_id):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("""
            SELECT p.id, p.Titulo, p.Descripcion, p.Categoria, p.Precio, p.Ubicacion,
                   p.Experiencia, p.Habilidades, p.Disponibilidad, p.IncluyeMateriales,
                   p.TipoPrecio, p.FechaCreacion,
                   per.Nombre, per.ApellidoP, per.ApellidoM, per.Telefono,
                   u.Email, u.id as PrestadorId,
                   (SELECT TOP 1 img.ImagenUrl
                    FROM PublicacionImagenes img
                    INNER JOIN PublicacionVersiones pv ON img.VersionId = pv.id
                    WHERE img.PublicacionId = p.id AND pv.EsVersionPublica = 1
                      AND img.EstadoRevision = 'aprobada'
                    ORDER BY img.EsPrincipal DESC, img.Posicion) AS ImagenPrincipal
            FROM Publicaciones p
            INNER JOIN Usuarios u ON p.UsuarioId = u.id
            INNER JOIN Personas per ON u.id = per.UsuarioId
            WHERE p.id = ? AND p.Activa = 1 AND EXISTS (
                SELECT 1 FROM PublicacionVersiones pv
                WHERE pv.PublicacionId = p.id AND pv.Estado = 'aprobada' AND pv.EsVersionPublica = 1
            )
        """, (publicacion_id,))
        publicacion = cursor.fetchone()
        if not publicacion:
            return jsonify({'success': False, 'message': 'Publicación no encontrada.'}), 404

        precio_texto = f"${publicacion[4]}" if publicacion[4] else "Consultar precio"
        if publicacion[4] and publicacion[10]:
            tipo_precio_map = {'hora': '/hora', 'servicio': '/servicio', 'dia': '/día', 'proyecto': '/proyecto'}
            precio_texto = f"${publicacion[4]}{tipo_precio_map.get(publicacion[10], '')}"

        publicacion_detalles = {
            'id': publicacion[0],
            'titulo': publicacion[1],
            'descripcion': publicacion[2],
            'categoria': publicacion[3],
            'precio': float(publicacion[4]) if publicacion[4] else None,
            'precio_texto': precio_texto,
            'ubicacion': publicacion[5],
            'experiencia': publicacion[6],
            'habilidades': publicacion[7],
            'disponibilidad': publicacion[8],
            'incluye_materiales': bool(publicacion[9]),
            'tipo_precio': publicacion[10],
            'fecha_creacion': publicacion[11].strftime('%d/%m/%Y') if publicacion[11] else '',
            'prestador_nombre': f"{publicacion[12]} {publicacion[13]} {publicacion[14]}",
            'prestador_telefono': descifrar_dato(publicacion[15]),
            'prestador_email': publicacion[16],
            'prestador_id': publicacion[17],
            'imagen_principal': publicacion[18]
        }
        return jsonify({'success': True, 'publicacion': publicacion_detalles}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener detalles de publicación (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al obtener detalles de publicación: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/buscar_publicaciones', methods=['GET'])
def buscar_publicaciones():
    query = request.args.get('q', '').strip()
    categoria = clean_text(request.args.get('categoria'))
    precio_max = request.args.get('precio_max', '').strip()
    experiencia_min = request.args.get('experiencia_min', '').strip()

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        sql = """
            SELECT p.id, p.Titulo, p.Descripcion, p.Categoria, p.Precio, p.Ubicacion,
                   p.Experiencia, p.Habilidades, p.Disponibilidad, p.IncluyeMateriales,
                   p.TipoPrecio, p.FechaCreacion,
                   per.Nombre, per.ApellidoP, per.ApellidoM, per.Telefono, per.FotoPerfil,
                   u.Email,
                   (SELECT TOP 1 img.ImagenUrl
                    FROM PublicacionImagenes img
                    INNER JOIN PublicacionVersiones pv ON img.VersionId = pv.id
                    WHERE img.PublicacionId = p.id AND pv.EsVersionPublica = 1
                      AND img.EstadoRevision = 'aprobada'
                    ORDER BY img.EsPrincipal DESC, img.Posicion) AS ImagenPrincipal
            FROM Publicaciones p
            INNER JOIN Usuarios u ON p.UsuarioId = u.id
            INNER JOIN Personas per ON u.id = per.UsuarioId
            WHERE p.Activa = 1 AND EXISTS (
                SELECT 1 FROM PublicacionVersiones pv
                WHERE pv.PublicacionId = p.id AND pv.Estado = 'aprobada' AND pv.EsVersionPublica = 1
            )
        """
        params = []
        categoria_filtro = (get_canonical_category_name(cursor, categoria) or categoria) if categoria else None

        if query:
            sql += " AND (p.Titulo LIKE ? OR p.Descripcion LIKE ? OR p.Habilidades LIKE ?)"
            params.extend([f'%{query}%', f'%{query}%', f'%{query}%'])

        if categoria_filtro:
            sql += " AND p.Categoria = ?"
            params.append(categoria_filtro)

        if precio_max:
            try:
                precio_max_float = float(precio_max)
                sql += " AND (p.Precio <= ? OR p.Precio IS NULL)"
                params.append(precio_max_float)
            except ValueError:
                pass

        if experiencia_min:
            try:
                experiencia_min_int = int(experiencia_min)
                sql += " AND p.Experiencia >= ?"
                params.append(experiencia_min_int)
            except ValueError:
                pass

        sql += " ORDER BY p.FechaCreacion DESC"
        cursor.execute(sql, params)
        publicaciones = cursor.fetchall()

        publicaciones_list = []
        for pub in publicaciones:
            precio_texto = f"${pub[4]}" if pub[4] else "Consultar precio"
            if pub[4] and pub[10]:
                tipo_precio_map = {'hora': '/hora', 'servicio': '/servicio', 'dia': '/día', 'proyecto': '/proyecto'}
                precio_texto = f"${pub[4]}{tipo_precio_map.get(pub[10], '')}"

            publicaciones_list.append({
                'id': pub[0],
                'titulo': pub[1],
                'descripcion': pub[2],
                'categoria': pub[3],
                'precio': float(pub[4]) if pub[4] else None,
                'precio_texto': precio_texto,
                'ubicacion': pub[5],
                'experiencia': pub[6],
                'habilidades': pub[7],
                'disponibilidad': pub[8],
                'incluye_materiales': bool(pub[9]),
                'tipo_precio': pub[10],
                'fecha_creacion': pub[11].strftime('%d/%m/%Y') if pub[11] else '',
                'prestador_nombre': f"{pub[12]} {pub[13]} {pub[14]}",
                'prestador_telefono': descifrar_dato(pub[15]),
                'prestador_foto': pub[16],
                'prestador_email': pub[17],
                'imagen_principal': pub[18]
            })

        return jsonify({'success': True, 'publicaciones': publicaciones_list}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al buscar publicaciones (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al buscar publicaciones: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()


@app.route('/mi_portafolio', methods=['GET'])
def mi_portafolio():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')
    if tipo_usuario != 'prestador':
        return jsonify({'success': False, 'message': 'Solo los prestadores pueden consultar su portafolio.'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT pt.id, pt.PublicacionId, p.Titulo, p.Categoria, pt.Titulo, pt.Descripcion,
                   pt.ImagenUrl, pt.CreadoEn
            FROM PortafolioTrabajos pt
            INNER JOIN Publicaciones p ON pt.PublicacionId = p.id
            WHERE pt.PrestadorId = ? AND pt.Activo = 1
            ORDER BY pt.CreadoEn DESC
        """, (user_id,))
        trabajos = cursor.fetchall()
        portafolio = []
        for trabajo in trabajos:
            portafolio.append({
                'id': trabajo[0],
                'publicacion_id': trabajo[1],
                'publicacion_titulo': trabajo[2],
                'categoria': trabajo[3],
                'titulo': trabajo[4],
                'descripcion': trabajo[5],
                'imagen_url': trabajo[6],
                'creado_en': trabajo[7].strftime('%d/%m/%Y') if trabajo[7] else ''
            })
        return jsonify({'success': True, 'portafolio': portafolio}), 200
    except pyodbc.Error as ex:
        print(f"Error de base de datos al obtener portafolio: {ex}")
        return jsonify({'success': False, 'message': f'Error de base de datos: {ex}'}), 500
    except Exception as e:
        print(f"Error inesperado al obtener portafolio: {e}")
        return jsonify({'success': False, 'message': f'Error inesperado: {e}'}), 500
    finally:
        if conn:
            conn.close()


@app.route('/portafolio_publicacion/<int:publicacion_id>', methods=['GET'])
def portafolio_publicacion(publicacion_id):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("""
            SELECT 1
            FROM Publicaciones p
            WHERE p.id = ? AND p.Activa = 1 AND EXISTS (
                SELECT 1 FROM PublicacionVersiones pv
                WHERE pv.PublicacionId = p.id AND pv.Estado = 'aprobada' AND pv.EsVersionPublica = 1
            )
        """, (publicacion_id,))
        if not cursor.fetchone():
            return jsonify({'success': False, 'message': 'Publicación no encontrada.'}), 404
        cursor.execute("""
            SELECT id, Titulo, Descripcion, ImagenUrl, CreadoEn
            FROM PortafolioTrabajos
            WHERE PublicacionId = ? AND Activo = 1
            ORDER BY CreadoEn DESC
        """, (publicacion_id,))
        trabajos = cursor.fetchall()
        portafolio = []
        for trabajo in trabajos:
            portafolio.append({
                'id': trabajo[0],
                'titulo': trabajo[1],
                'descripcion': trabajo[2],
                'imagen_url': trabajo[3],
                'creado_en': trabajo[4].strftime('%d/%m/%Y') if trabajo[4] else ''
            })
        return jsonify({'success': True, 'portafolio': portafolio}), 200
    except pyodbc.Error as ex:
        print(f"Error de base de datos al obtener portafolio de publicación: {ex}")
        return jsonify({'success': False, 'message': f'Error de base de datos: {ex}'}), 500
    except Exception as e:
        print(f"Error inesperado al obtener portafolio de publicación: {e}")
        return jsonify({'success': False, 'message': f'Error inesperado: {e}'}), 500
    finally:
        if conn:
            conn.close()


@app.route('/subir_trabajo_portafolio', methods=['POST'])
def subir_trabajo_portafolio():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')
    if tipo_usuario != 'prestador':
        return jsonify({'success': False, 'message': 'Solo los prestadores pueden subir trabajos.'}), 403

    publicacion_id = request.form.get('publicacion_id', '').strip()
    titulo = request.form.get('titulo', '').strip()
    descripcion = request.form.get('descripcion', '').strip()
    foto = request.files.get('foto')

    if not publicacion_id:
        return jsonify({'success': False, 'message': 'Selecciona el oficio relacionado.'}), 400
    if not titulo:
        return jsonify({'success': False, 'message': 'El título del trabajo es obligatorio.'}), 400
    if not foto or foto.filename == '':
        return jsonify({'success': False, 'message': 'Selecciona una foto del trabajo.'}), 400
    if not archivo_imagen_permitido(foto.filename):
        return jsonify({'success': False, 'message': 'Solo se permiten imágenes PNG, JPG, JPEG o WEBP.'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("SELECT id FROM Publicaciones WHERE id = ? AND UsuarioId = ?", (publicacion_id, user_id))
        publicacion = cursor.fetchone()
        if not publicacion:
            return jsonify({'success': False, 'message': 'La publicación no existe o no te pertenece.'}), 404

        os.makedirs(PORTAFOLIO_UPLOAD_FOLDER, exist_ok=True)
        nombre_seguro = secure_filename(foto.filename)
        base, extension = os.path.splitext(nombre_seguro)
        base = base[:70] or 'trabajo'
        nombre_final = f"{user_id}_{publicacion_id}_{datetime.now().strftime('%Y%m%d%H%M%S%f')}_{base}{extension.lower()}"
        ruta_archivo = os.path.join(PORTAFOLIO_UPLOAD_FOLDER, nombre_final)
        foto.save(ruta_archivo)
        ruta_relativa = f"/static/uploads/portafolio/{nombre_final}"

        cursor.execute("""
            INSERT INTO PortafolioTrabajos (PublicacionId, PrestadorId, Titulo, Descripcion, ImagenUrl)
            VALUES (?, ?, ?, ?, ?)
        """, (publicacion_id, user_id, titulo, descripcion, ruta_relativa))
        conn.commit()
        return jsonify({'success': True, 'message': 'Trabajo agregado al portafolio.', 'imagen_url': ruta_relativa}), 200
    except pyodbc.Error as ex:
        if os.path.exists(locals().get('ruta_archivo', '')):
            os.remove(ruta_archivo)
        print(f"Error de base de datos al subir trabajo de portafolio: {ex}")
        return jsonify({'success': False, 'message': f'Error de base de datos: {ex}'}), 500
    except Exception as e:
        if os.path.exists(locals().get('ruta_archivo', '')):
            os.remove(ruta_archivo)
        print(f"Error inesperado al subir trabajo de portafolio: {e}")
        return jsonify({'success': False, 'message': f'Error inesperado: {e}'}), 500
    finally:
        if conn:
            conn.close()


@app.route('/eliminar_trabajo_portafolio/<int:trabajo_id>', methods=['POST'])
def eliminar_trabajo_portafolio(trabajo_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session.get('user_id')
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM PortafolioTrabajos WHERE id = ? AND PrestadorId = ? AND Activo = 1", (trabajo_id, user_id))
        trabajo = cursor.fetchone()
        if not trabajo:
            return jsonify({'success': False, 'message': 'Trabajo no encontrado o sin permisos.'}), 404
        cursor.execute("UPDATE PortafolioTrabajos SET Activo = 0 WHERE id = ?", (trabajo_id,))
        conn.commit()
        return jsonify({'success': True, 'message': 'Trabajo eliminado del portafolio.'}), 200
    except pyodbc.Error as ex:
        print(f"Error de base de datos al eliminar trabajo de portafolio: {ex}")
        return jsonify({'success': False, 'message': f'Error de base de datos: {ex}'}), 500
    except Exception as e:
        print(f"Error inesperado al eliminar trabajo de portafolio: {e}")
        return jsonify({'success': False, 'message': f'Error inesperado: {e}'}), 500
    finally:
        if conn:
            conn.close()

@app.route('/enviar_solicitud', methods=['POST'])
def enviar_solicitud():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')
    if tipo_usuario != 'cliente':
        return jsonify({'success': False, 'message': 'Solo los clientes pueden enviar solicitudes.'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        publicacion_id = request.form.get('publicacion_id', '').strip()
        fecha_servicio = request.form.get('fecha_servicio', '').strip()
        hora_servicio = request.form.get('hora_servicio', '').strip()
        mensaje = request.form.get('mensaje', '').strip()

        if not publicacion_id:
            return jsonify({'success': False, 'message': 'ID de publicación es obligatorio.'}), 400
        if not fecha_servicio:
            return jsonify({'success': False, 'message': 'La fecha del servicio es obligatoria.'}), 400

        cursor.execute("""
            SELECT UsuarioId
            FROM Publicaciones p
            WHERE p.id = ?
              AND p.Activa = 1
              AND EXISTS (
                  SELECT 1 FROM PublicacionVersiones pv
                  WHERE pv.PublicacionId = p.id
                    AND pv.Estado = 'aprobada'
                    AND pv.EsVersionPublica = 1
              )
        """, (publicacion_id,))
        publicacion = cursor.fetchone()
        if not publicacion:
            return jsonify({'success': False, 'message': 'Publicación no encontrada o no activa.'}), 404
        prestador_id = publicacion[0]

        sql_insert = """
            INSERT INTO SolicitudesServicios (PublicacionId, ClienteId, PrestadorId, FechaServicio, HoraServicio, MensajeCliente, Estado)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        cursor.execute(sql_insert, (publicacion_id, user_id, prestador_id, fecha_servicio, hora_servicio, cifrar_dato(mensaje) if mensaje else None, 'pendiente'))
        conn.commit()

        # --- Enviar correo al prestador ---
        cursor.execute("SELECT Titulo FROM Publicaciones WHERE id = ?", (publicacion_id,))
        titulo_servicio = cursor.fetchone()[0]
        cursor.execute("SELECT Nombre, ApellidoP, ApellidoM FROM Personas WHERE UsuarioId = ?", (user_id,))
        cliente_nombre_row = cursor.fetchone()
        nombre_cliente = f"{cliente_nombre_row[0]} {cliente_nombre_row[1]} {cliente_nombre_row[2]}".strip()
        cursor.execute("SELECT Email FROM Usuarios WHERE id = ?", (prestador_id,))
        prestador_email = cursor.fetchone()[0]

        cuerpo = f"""
        Hola,

        Has recibido una nueva solicitud de servicio.

        Servicio: {titulo_servicio}
        Cliente: {nombre_cliente}
        Fecha solicitada: {fecha_servicio} {hora_servicio if hora_servicio else 'a convenir'}

        Ingresa a tu panel para revisar los detalles y aceptar o rechazar la solicitud.
        """
        enviar_correo_notificacion(prestador_email, "Nueva solicitud en JobNest", cuerpo)

        record_business_event('solicitud_creada', 'web')
        return jsonify({'success': True, 'message': 'Solicitud enviada exitosamente.'}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al enviar solicitud (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Ocurrió un error en la base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al enviar solicitud: {e}")
        return jsonify({'success': False, 'message': f"Ocurrió un error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/mis_solicitudes_prestador', methods=['GET'])
def mis_solicitudes_prestador():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')
    if tipo_usuario != 'prestador':
        return jsonify({'success': False, 'message': 'Solo los prestadores pueden ver solicitudes.'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.id, s.FechaSolicitud, s.FechaServicio, s.HoraServicio, s.MensajeCliente, s.Estado,
                   p.Titulo, p.Precio, p.Categoria,
                   per.Nombre, per.ApellidoP, per.ApellidoM, per.Telefono, per.FotoPerfil,
                   u.Email
            FROM SolicitudesServicios s
            INNER JOIN Publicaciones p ON s.PublicacionId = p.id
            INNER JOIN Usuarios u ON s.ClienteId = u.id
            INNER JOIN Personas per ON u.id = per.UsuarioId
            WHERE s.PrestadorId = ?
            ORDER BY s.FechaSolicitud DESC
        """, (user_id,))
        solicitudes = cursor.fetchall()
        solicitudes_list = []
        for sol in solicitudes:
            solicitudes_list.append({
                'id': sol[0],
                'fecha_solicitud': sol[1].strftime('%d/%m/%Y %H:%M') if sol[1] else '',
                'fecha_servicio': sol[2].strftime('%d/%m/%Y') if sol[2] else '',
                'hora_servicio': sol[3].strftime('%H:%M') if sol[3] else '',
                'mensaje_cliente': descifrar_dato(sol[4]),
                'estado': sol[5],
                'titulo_publicacion': sol[6],
                'precio': float(sol[7]) if sol[7] else None,
                'categoria': sol[8],
                'cliente_nombre': f"{sol[9]} {sol[10]} {sol[11]}",
                'cliente_telefono': descifrar_dato(sol[12]),
                'cliente_foto': sol[13],
                'cliente_email': sol[14]
            })
        return jsonify({'success': True, 'solicitudes': solicitudes_list}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener solicitudes (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al obtener solicitudes: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/mis_solicitudes_cliente', methods=['GET'])
def mis_solicitudes_cliente():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')
    if tipo_usuario != 'cliente':
        return jsonify({'success': False, 'message': 'Solo los clientes pueden ver sus solicitudes.'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.id, s.FechaSolicitud, s.FechaServicio, s.HoraServicio, s.MensajeCliente, s.Estado,
                   p.Titulo, p.Precio, p.Categoria,
                   per.Nombre, per.ApellidoP, per.ApellidoM, per.Telefono, per.FotoPerfil,
                   u.Email
            FROM SolicitudesServicios s
            INNER JOIN Publicaciones p ON s.PublicacionId = p.id
            INNER JOIN Usuarios u ON s.PrestadorId = u.id
            INNER JOIN Personas per ON u.id = per.UsuarioId
            WHERE s.ClienteId = ?
            ORDER BY s.FechaSolicitud DESC
        """, (user_id,))
        solicitudes = cursor.fetchall()
        solicitudes_list = []
        for sol in solicitudes:
            solicitudes_list.append({
                'id': sol[0],
                'fecha_solicitud': sol[1].strftime('%d/%m/%Y %H:%M') if sol[1] else '',
                'fecha_servicio': sol[2].strftime('%d/%m/%Y') if sol[2] else '',
                'hora_servicio': sol[3].strftime('%H:%M') if sol[3] else '',
                'mensaje_cliente': descifrar_dato(sol[4]),
                'estado': sol[5],
                'titulo_publicacion': sol[6],
                'precio': float(sol[7]) if sol[7] else None,
                'categoria': sol[8],
                'prestador_nombre': f"{sol[9]} {sol[10]} {sol[11]}",
                'prestador_telefono': descifrar_dato(sol[12]),
                'prestador_foto': sol[13],
                'prestador_email': sol[14]
            })
        return jsonify({'success': True, 'solicitudes': solicitudes_list}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener solicitudes (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al obtener solicitudes: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()


@app.route('/api/mobile/enviar_solicitud', methods=['POST'])
@mobile_role_required('cliente')
def mobile_enviar_solicitud():
    user_id = g.mobile_user['id']

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        allowed_fields = {'publicacion_id', 'fecha_servicio', 'hora_servicio', 'mensaje'}
        blocked_fields = {'cliente_id', 'prestador_id', 'estado', 'usuario_id'}
        errors = reject_unknown_fields(request.form, allowed_fields, blocked_fields)

        publicacion_id_raw = clean_text(request.form.get('publicacion_id'))
        try:
            publicacion_id = int(publicacion_id_raw)
            if publicacion_id <= 0:
                errors['publicacion_id'] = 'La publicación no es válida.'
        except (TypeError, ValueError):
            publicacion_id = None
            errors['publicacion_id'] = 'La publicación no es válida.'

        fecha_servicio = parse_iso_date(errors, 'fecha_servicio', request.form.get('fecha_servicio'), 'La fecha del servicio')
        hora_servicio = parse_hhmm_time(errors, 'hora_servicio', request.form.get('hora_servicio'), 'La hora del servicio', required=False)
        mensaje = add_optional_text(errors, 'mensaje', request.form.get('mensaje'), 'El mensaje', 1000)

        if errors:
            return validation_response(errors)

        cursor.execute("""
            SELECT UsuarioId
            FROM Publicaciones p
            WHERE p.id = ?
              AND p.Activa = 1
              AND EXISTS (
                  SELECT 1 FROM PublicacionVersiones pv
                  WHERE pv.PublicacionId = p.id
                    AND pv.Estado = 'aprobada'
                    AND pv.EsVersionPublica = 1
              )
        """, (publicacion_id,))
        publicacion = cursor.fetchone()
        if not publicacion:
            return jsonify({'success': False, 'message': 'Publicación no encontrada o no activa.'}), 404
        prestador_id = publicacion[0]
        if prestador_id == user_id:
            return validation_response({'publicacion_id': 'No puedes solicitar tu propia publicación.'})

        cursor.execute("""
            SELECT TOP 1 id
            FROM SolicitudesServicios
            WHERE PublicacionId = ?
              AND ClienteId = ?
              AND Estado IN ('pendiente', 'aceptada')
        """, (publicacion_id, user_id))
        if cursor.fetchone():
            return jsonify({
                'success': False,
                'message': 'Ya tienes una solicitud activa para esta publicación.',
                'errors': {'publicacion_id': 'Ya tienes una solicitud activa para esta publicación.'}
            }), 409

        cursor.execute("""
            INSERT INTO SolicitudesServicios (PublicacionId, ClienteId, PrestadorId, FechaServicio, HoraServicio, MensajeCliente, Estado)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (publicacion_id, user_id, prestador_id, fecha_servicio, hora_servicio, cifrar_dato(mensaje) if mensaje else None, 'pendiente'))
        conn.commit()

        record_business_event('solicitud_creada', 'mobile')
        return jsonify({'success': True, 'message': 'Solicitud enviada exitosamente.'}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al enviar solicitud móvil (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': 'No fue posible enviar la solicitud.'}), 500
    except Exception as e:
        print(f"Error inesperado al enviar solicitud móvil: {e}")
        return jsonify({'success': False, 'message': 'Ocurrió un error inesperado.'}), 500
    finally:
        if conn:
            conn.close()


@app.route('/api/mobile/mis_solicitudes_prestador', methods=['GET'])
@mobile_role_required('prestador')
def mobile_mis_solicitudes_prestador():
    user_id = g.mobile_user['id']

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.id, s.FechaSolicitud, s.FechaServicio, s.HoraServicio, s.MensajeCliente, s.Estado,
                   p.Titulo, p.Precio, p.Categoria,
                   per.Nombre, per.ApellidoP, per.ApellidoM, per.Telefono, per.FotoPerfil,
                   u.Email
            FROM SolicitudesServicios s
            INNER JOIN Publicaciones p ON s.PublicacionId = p.id
            INNER JOIN Usuarios u ON s.ClienteId = u.id
            INNER JOIN Personas per ON u.id = per.UsuarioId
            WHERE s.PrestadorId = ?
            ORDER BY s.FechaSolicitud DESC
        """, (user_id,))
        solicitudes = cursor.fetchall()
        solicitudes_list = []
        for sol in solicitudes:
            solicitudes_list.append({
                'id': sol[0],
                'fecha_solicitud': sol[1].strftime('%d/%m/%Y %H:%M') if sol[1] else '',
                'fecha_servicio': sol[2].strftime('%d/%m/%Y') if sol[2] else '',
                'hora_servicio': sol[3].strftime('%H:%M') if sol[3] else '',
                'mensaje_cliente': descifrar_dato(sol[4]),
                'estado': sol[5],
                'titulo_publicacion': sol[6],
                'precio': float(sol[7]) if sol[7] else None,
                'categoria': sol[8],
                'cliente_nombre': f"{sol[9]} {sol[10]} {sol[11]}",
                'cliente_telefono': descifrar_dato(sol[12]),
                'cliente_foto': sol[13],
                'cliente_email': sol[14]
            })
        return jsonify({'success': True, 'solicitudes': solicitudes_list}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener solicitudes móviles prestador (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': 'Error de base de datos.'}), 500
    except Exception as e:
        print(f"Error inesperado al obtener solicitudes móviles prestador: {e}")
        return jsonify({'success': False, 'message': 'Error inesperado.'}), 500
    finally:
        if conn:
            conn.close()


@app.route('/api/mobile/mis_solicitudes_cliente', methods=['GET'])
@mobile_role_required('cliente')
def mobile_mis_solicitudes_cliente():
    user_id = g.mobile_user['id']

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.id, s.FechaSolicitud, s.FechaServicio, s.HoraServicio, s.MensajeCliente, s.Estado,
                   p.Titulo, p.Precio, p.Categoria,
                   per.Nombre, per.ApellidoP, per.ApellidoM, per.Telefono, per.FotoPerfil,
                   u.Email
            FROM SolicitudesServicios s
            INNER JOIN Publicaciones p ON s.PublicacionId = p.id
            INNER JOIN Usuarios u ON s.PrestadorId = u.id
            INNER JOIN Personas per ON u.id = per.UsuarioId
            WHERE s.ClienteId = ?
            ORDER BY s.FechaSolicitud DESC
        """, (user_id,))
        solicitudes = cursor.fetchall()
        solicitudes_list = []
        for sol in solicitudes:
            solicitudes_list.append({
                'id': sol[0],
                'fecha_solicitud': sol[1].strftime('%d/%m/%Y %H:%M') if sol[1] else '',
                'fecha_servicio': sol[2].strftime('%d/%m/%Y') if sol[2] else '',
                'hora_servicio': sol[3].strftime('%H:%M') if sol[3] else '',
                'mensaje_cliente': descifrar_dato(sol[4]),
                'estado': sol[5],
                'titulo_publicacion': sol[6],
                'precio': float(sol[7]) if sol[7] else None,
                'categoria': sol[8],
                'prestador_nombre': f"{sol[9]} {sol[10]} {sol[11]}",
                'prestador_telefono': descifrar_dato(sol[12]),
                'prestador_foto': sol[13],
                'prestador_email': sol[14]
            })
        return jsonify({'success': True, 'solicitudes': solicitudes_list}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener solicitudes móviles cliente (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': 'Error de base de datos.'}), 500
    except Exception as e:
        print(f"Error inesperado al obtener solicitudes móviles cliente: {e}")
        return jsonify({'success': False, 'message': 'Error inesperado.'}), 500
    finally:
        if conn:
            conn.close()


@app.route('/api/mobile/crear_publicacion', methods=['POST'])
@mobile_role_required('prestador')
def mobile_crear_publicacion():
    user_id = g.mobile_user['id']

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        datos, errors = validar_datos_publicacion(request.form, cursor)
        if errors:
            return validation_response(errors)
        imagenes = request.files.getlist('imagenes')

        cursor.execute("""
            INSERT INTO Publicaciones (UsuarioId, Titulo, Descripcion, Categoria, Precio, Ubicacion,
                                       Experiencia, Habilidades, Disponibilidad, IncluyeMateriales, TipoPrecio,
                                       Activa, EstadoRevision, ComentarioRevision)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pendiente_revision', NULL)
        """, (
            user_id, datos['titulo'], datos['descripcion'], datos['categoria'], datos['precio'],
            datos['ubicacion'], datos['experiencia'], datos['habilidades'], datos['disponibilidad'],
            datos['incluye_materiales'], datos['tipo_precio']
        ))
        nueva_publicacion_id = int(cursor.fetchone()[0])
        version_id = crear_version_publicacion(cursor, nueva_publicacion_id, user_id, datos)
        guardar_imagenes_version(cursor, nueva_publicacion_id, version_id, user_id, imagenes)
        audit_event(cursor, 'publicacion_enviada_revision', 'Publicaciones', nueva_publicacion_id,
                    f"Publicación móvil creada por prestador y enviada a revisión: {datos['titulo']}",
                    usuario_id=user_id, actor_id=user_id)
        crear_alerta(cursor, 'publicacion_revision', 'Nueva publicación pendiente',
                     f"{datos['titulo']} fue enviada a revisión administrativa.",
                     publicacion_id=nueva_publicacion_id, version_id=version_id, rol_destino='administrador')
        conn.commit()
        record_business_event('publicacion_creada', 'mobile')
        return jsonify({'success': True, 'message': 'Publicación enviada a revisión del administrador. Aparecerá en marketplace cuando sea aprobada.'}), 200

    except ValueError as e:
        if conn:
            conn.rollback()
        return jsonify({'success': False, 'message': str(e)}), 400
    except pyodbc.Error as ex:
        if conn:
            conn.rollback()
        sqlstate = ex.args[0]
        print(f"Error de base de datos al crear publicación móvil (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': 'No fue posible crear la publicación.'}), 500
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error inesperado al crear publicación móvil: {e}")
        return jsonify({'success': False, 'message': 'Ocurrió un error inesperado.'}), 500
    finally:
        if conn:
            conn.close()


@app.route('/api/mobile/mi-portafolio', methods=['GET'])
@mobile_role_required('prestador')
def mobile_mi_portafolio():
    user_id = g.mobile_user['id']

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT pt.id, pt.PublicacionId, pt.Titulo, pt.Descripcion, pt.ImagenUrl,
                   pt.Activo, pt.CreadoEn, p.Titulo, p.Categoria
            FROM PortafolioTrabajos pt
            INNER JOIN Publicaciones p ON pt.PublicacionId = p.id
            WHERE pt.PrestadorId = ? AND pt.Activo = 1
            ORDER BY pt.CreadoEn DESC
        """, (user_id,))
        trabajos = []
        for row in cursor.fetchall():
            trabajos.append({
                'id': row[0],
                'publicacion_id': row[1],
                'titulo': row[2],
                'descripcion': row[3],
                'imagen_url': row[4],
                'activo': bool(row[5]),
                'creado_en': row[6].strftime('%d/%m/%Y') if row[6] else '',
                'publicacion_titulo': row[7],
                'categoria': row[8],
            })
        return jsonify({'success': True, 'portafolio': trabajos}), 200
    except pyodbc.Error as ex:
        print(f"Error de base de datos al obtener portafolio móvil (sqlstate: {ex.args[0]}): {ex}")
        return jsonify({'success': False, 'message': 'No fue posible cargar el portafolio.'}), 500
    except Exception as e:
        print(f"Error inesperado al obtener portafolio móvil: {e}")
        return jsonify({'success': False, 'message': 'Ocurrió un error inesperado.'}), 500
    finally:
        if conn:
            conn.close()


@app.route('/api/mobile/mi-perfil/resenas', methods=['GET'])
@jwt_required()
def mobile_mis_resenas():
    user, response, status = load_mobile_jwt_user()
    if response is not None:
        return response, status
    return mobile_profile_reviews_response(user['id'])


@app.route('/api/mobile/perfiles/<int:usuario_id>/resenas', methods=['GET'])
@jwt_required(optional=True)
def mobile_perfil_resenas(usuario_id):
    return mobile_profile_reviews_response(usuario_id)


def mobile_profile_reviews_response(user_id):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM Usuarios WHERE id = ? AND Activo = 1", (user_id,))
        if not cursor.fetchone():
            return jsonify({'success': False, 'message': 'Perfil no encontrado.'}), 404

        cursor.execute("""
            SELECT AVG(CAST(Calificacion AS FLOAT)), COUNT(*)
            FROM Resenas
            WHERE EvaluadoId = ? AND Calificacion IS NOT NULL
        """, (user_id,))
        summary = cursor.fetchone()
        promedio = float(summary[0]) if summary and summary[0] is not None else None
        total = int(summary[1] or 0) if summary else 0

        cursor.execute("""
            SELECT TOP 20 r.Calificacion, r.Comentario, r.CreadoEn,
                   per.Nombre, per.ApellidoP
            FROM Resenas r
            LEFT JOIN Personas per ON r.RevisorId = per.UsuarioId
            WHERE r.EvaluadoId = ? AND r.Calificacion IS NOT NULL
            ORDER BY r.CreadoEn DESC
        """, (user_id,))
        resenas = []
        for row in cursor.fetchall():
            resenas.append({
                'calificacion': int(row[0]) if row[0] is not None else None,
                'comentario': row[1] or '',
                'fecha': row[2].strftime('%d/%m/%Y') if row[2] else '',
                'revisor_nombre': f"{row[3] or ''} {row[4] or ''}".strip() or 'Usuario JobNest',
            })
        return jsonify({'success': True, 'promedio': promedio, 'total': total, 'resenas': resenas}), 200
    except pyodbc.Error as ex:
        print(f"Error de base de datos al obtener reseñas móviles (sqlstate: {ex.args[0]}): {ex}")
        return jsonify({'success': False, 'message': 'No fue posible cargar las reseñas.'}), 500
    except Exception as e:
        print(f"Error inesperado al obtener reseñas móviles: {e}")
        return jsonify({'success': False, 'message': 'Ocurrió un error inesperado.'}), 500
    finally:
        if conn:
            conn.close()

# ==================== AGENDA ====================
@app.route('/debug_solicitudes', methods=['GET'])
def debug_solicitudes():
    if 'usuario_autenticado' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    user_id = session.get('user_id')
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, Email FROM Usuarios WHERE id = ?", (user_id,))
        usuario = cursor.fetchone()
        cursor.execute("""
            SELECT id, Estado, PrestadorId, ClienteId, FechaAceptacion, FechaServicio, HoraServicio
            FROM SolicitudesServicios
            WHERE PrestadorId = ? AND Estado = 'aceptada'
        """, (user_id,))
        solicitudes = cursor.fetchall()
        return jsonify({
            'usuario': {'id': usuario[0] if usuario else None, 'email': usuario[1] if usuario else None},
            'solicitudes_aceptadas': [{'id': s[0], 'estado': s[1], 'prestador_id': s[2], 'cliente_id': s[3],
                                       'fecha_aceptacion': s[4].strftime('%Y-%m-%d %H:%M:%S') if s[4] else None,
                                       'fecha_servicio': s[5].strftime('%Y-%m-%d') if s[5] else None,
                                       'hora_servicio': str(s[6]) if s[6] else None} for s in solicitudes],
            'total_solicitudes': len(solicitudes)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/obtener_eventos_agenda', methods=['GET'])
def obtener_eventos_agenda():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado', 'debug': {'session_user': None}}), 401
    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')
    if tipo_usuario != 'prestador':
        return jsonify({'success': False, 'message': 'Solo los prestadores pueden acceder a la agenda.',
                        'debug': {'session_user': user_id, 'tipo_usuario': tipo_usuario}}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                s.id as solicitud_id,
                s.FechaAceptacion,
                s.FechaServicio,
                s.HoraServicio,
                s.Estado,
                p.Titulo as titulo_publicacion,
                per.Nombre,
                per.ApellidoP,
                per.ApellidoM,
                s.MensajeCliente,
                p.Precio
            FROM SolicitudesServicios s
            INNER JOIN Publicaciones p ON s.PublicacionId = p.id
            INNER JOIN Usuarios u ON s.ClienteId = u.id
            INNER JOIN Personas per ON u.id = per.UsuarioId
            WHERE s.PrestadorId = ? AND s.Estado = 'aceptada'
            ORDER BY s.FechaServicio, s.HoraServicio
        """, (user_id,))
        filas = cursor.fetchall()
        eventos_list = []
        for evento in filas:
            solicitud_id = evento[0]
            fecha_aceptacion_raw = evento[1]
            fecha_servicio_raw = evento[2]
            hora_servicio_raw = evento[3]
            titulo_publicacion = evento[5]
            cliente_nombre = f"{evento[6]} {evento[7]} {evento[8]}"
            mensaje_cliente = descifrar_dato(evento[9])
            precio_raw = evento[10]

            if isinstance(fecha_servicio_raw, str):
                try:
                    fecha_servicio_date = datetime.strptime(fecha_servicio_raw.split(' ')[0], '%Y-%m-%d').date()
                except Exception:
                    fecha_servicio_date = fecha_servicio_raw
            else:
                fecha_servicio_date = fecha_servicio_raw

            hora_servicio = None
            if hora_servicio_raw:
                if isinstance(hora_servicio_raw, str):
                    try:
                        hora_servicio = datetime.strptime(hora_servicio_raw.split('.')[0], '%H:%M:%S').time()
                    except Exception:
                        hora_servicio = hora_servicio_raw
                else:
                    hora_servicio = hora_servicio_raw

            if hora_servicio and isinstance(fecha_servicio_date, datetime):
                fecha_inicio_dt = fecha_servicio_date if isinstance(fecha_servicio_date, datetime) else datetime.combine(fecha_servicio_date, hora_servicio)
            elif hora_servicio and not isinstance(fecha_servicio_date, datetime):
                fecha_inicio_dt = datetime.combine(fecha_servicio_date, hora_servicio)
            else:
                fecha_inicio_dt = fecha_servicio_date

            if isinstance(fecha_inicio_dt, datetime):
                start_val = fecha_inicio_dt.isoformat()
                end_val = (fecha_inicio_dt + timedelta(hours=2)).isoformat()
            else:
                start_val = fecha_inicio_dt.strftime('%Y-%m-%d')
                end_val = start_val

            precio = f"${precio_raw}" if precio_raw else "Consultar precio"
            eventos_list.append({
                'id': f"solicitud_{solicitud_id}",
                'title': f"Trabajo: {titulo_publicacion}",
                'start': start_val,
                'end': end_val,
                'extendedProps': {
                    'tipo': 'trabajo_aceptado',
                    'solicitud_id': solicitud_id,
                    'cliente_nombre': cliente_nombre,
                    'descripcion': mensaje_cliente or 'Sin mensaje adicional',
                    'fecha_aceptacion': fecha_aceptacion_raw.strftime('%d/%m/%Y %H:%M') if isinstance(fecha_aceptacion_raw, datetime) else (fecha_aceptacion_raw or 'No especificada'),
                    'precio': precio,
                    'servicio': titulo_publicacion
                },
                'color': '#28a745',
                'textColor': '#ffffff',
                'allDay': (hora_servicio is None)
            })
        return jsonify({'success': True, 'eventos': eventos_list, 'debug': {'session_user': user_id, 'filas_encontradas': len(filas)}}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener eventos de agenda (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al obtener eventos de agenda: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

# ==================== RUTAS PARA EDITAR PUBLICACIONES ====================
@app.route('/obtener_publicacion/<int:publicacion_id>', methods=['GET'])
def obtener_publicacion(publicacion_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401
    user_id = session.get('user_id')
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, Titulo, Descripcion, Categoria, Precio, Ubicacion,
                   Experiencia, Habilidades, Disponibilidad, IncluyeMateriales, TipoPrecio
            FROM Publicaciones
            WHERE id = ? AND UsuarioId = ?
        """, (publicacion_id, user_id))
        publicacion = cursor.fetchone()
        if not publicacion:
            return jsonify({'success': False, 'message': 'Publicación no encontrada o no tienes permisos.'}), 404
        publicacion_data = {
            'id': publicacion[0],
            'titulo': publicacion[1],
            'descripcion': publicacion[2],
            'categoria': publicacion[3],
            'precio': float(publicacion[4]) if publicacion[4] else None,
            'ubicacion': publicacion[5],
            'experiencia': publicacion[6],
            'habilidades': publicacion[7],
            'disponibilidad': publicacion[8],
            'incluye_materiales': bool(publicacion[9]),
            'tipo_precio': publicacion[10]
        }
        return jsonify({'success': True, 'publicacion': publicacion_data}), 200
    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener publicación (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al obtener publicación: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/editar_publicacion/<int:publicacion_id>', methods=['POST'])
def editar_publicacion(publicacion_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'Por favor, inicia sesión para editar la publicación.'}), 401
    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')
    if tipo_usuario != 'prestador':
        return jsonify({'success': False, 'message': 'Solo los prestadores pueden editar publicaciones.'}), 403
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("SELECT id, Activa, EstadoRevision FROM Publicaciones WHERE id = ? AND UsuarioId = ?", (publicacion_id, user_id))
        publicacion = cursor.fetchone()
        if not publicacion:
            return jsonify({'success': False, 'message': 'Publicación no encontrada o no tienes permisos para editarla.'}), 404

        datos, errors = validar_datos_publicacion(request.form, cursor)
        if errors:
            return validation_response(errors)
        imagenes = request.files.getlist('imagenes')
        version_id = crear_version_publicacion(cursor, publicacion_id, user_id, datos)
        guardar_imagenes_version(cursor, publicacion_id, version_id, user_id, imagenes)

        if not publicacion[1]:
            cursor.execute("""
                UPDATE Publicaciones
                SET Titulo = ?, Descripcion = ?, Categoria = ?, Precio = ?, Ubicacion = ?,
                    Experiencia = ?, Habilidades = ?, Disponibilidad = ?, IncluyeMateriales = ?, TipoPrecio = ?,
                    EstadoRevision = 'pendiente_revision', RevisadoPor = NULL, FechaRevision = NULL,
                    ComentarioRevision = NULL, FechaActualizacion = GETDATE()
                WHERE id = ? AND UsuarioId = ?
            """, (
                datos['titulo'], datos['descripcion'], datos['categoria'], datos['precio'], datos['ubicacion'],
                datos['experiencia'], datos['habilidades'], datos['disponibilidad'], datos['incluye_materiales'],
                datos['tipo_precio'], publicacion_id, user_id
            ))

        audit_event(cursor, 'version_creada', 'PublicacionVersiones', version_id,
                    f"Versión enviada a revisión: {datos['titulo']}",
                    usuario_id=user_id, actor_id=user_id)
        crear_alerta(cursor, 'publicacion_revision', 'Nueva versión pendiente',
                     f"{datos['titulo']} tiene cambios pendientes de revisión.",
                     publicacion_id=publicacion_id, version_id=version_id, rol_destino='administrador')
        conn.commit()
        return jsonify({'success': True, 'message': 'Los cambios se guardaron como versión pendiente. La versión pública aprobada seguirá visible hasta que el administrador apruebe esta actualización.'}), 200

    except ValueError as e:
        if conn:
            conn.rollback()
        return jsonify({'success': False, 'message': str(e)}), 400
    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al editar publicación (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Ocurrió un error en la base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al editar publicación: {e}")
        return jsonify({'success': False, 'message': f"Ocurrió un error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

# ==================== CALIFICACIONES ====================
@app.route('/servicios_concluidos', methods=['GET'])
def servicios_concluidos():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session['user_id']
    tipo = session['tipo_usuario']

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if tipo == 'cliente':
            cursor.execute("""
                SELECT
                    s.id, p.Titulo,
                    per_pre.Nombre, per_pre.ApellidoP, per_pre.ApellidoM,
                    s.FechaServicio, p.Precio,
                    r_mia.Calificacion AS mi_calificacion,
                    r_mia.Comentario AS mi_comentario,
                    r_recibida.Calificacion AS calificacion_recibida,
                    r_recibida.Comentario AS comentario_recibido
                FROM SolicitudesServicios s
                INNER JOIN Publicaciones p ON s.PublicacionId = p.id
                INNER JOIN Usuarios u_pre ON s.PrestadorId = u_pre.id
                INNER JOIN Personas per_pre ON u_pre.id = per_pre.UsuarioId
                LEFT JOIN Resenas r_mia ON r_mia.SolicitudServicioId = s.id AND r_mia.RevisorId = ?
                LEFT JOIN Resenas r_recibida ON r_recibida.SolicitudServicioId = s.id AND r_recibida.EvaluadoId = ?
                WHERE s.ClienteId = ? AND s.Estado IN ('concluido', 'calificado')
                ORDER BY s.FechaServicio DESC
            """, (user_id, user_id, user_id))
        else:
            cursor.execute("""
                SELECT
                    s.id, p.Titulo,
                    per_cli.Nombre, per_cli.ApellidoP, per_cli.ApellidoM,
                    s.FechaServicio, p.Precio,
                    r_mia.Calificacion AS mi_calificacion,
                    r_mia.Comentario AS mi_comentario,
                    r_recibida.Calificacion AS calificacion_recibida,
                    r_recibida.Comentario AS comentario_recibido
                FROM SolicitudesServicios s
                INNER JOIN Publicaciones p ON s.PublicacionId = p.id
                INNER JOIN Usuarios u_cli ON s.ClienteId = u_cli.id
                INNER JOIN Personas per_cli ON u_cli.id = per_cli.UsuarioId
                LEFT JOIN Resenas r_mia ON r_mia.SolicitudServicioId = s.id AND r_mia.RevisorId = ?
                LEFT JOIN Resenas r_recibida ON r_recibida.SolicitudServicioId = s.id AND r_recibida.EvaluadoId = ?
                WHERE s.PrestadorId = ? AND s.Estado IN ('concluido', 'calificado')
                ORDER BY s.FechaServicio DESC
            """, (user_id, user_id, user_id))

        rows = cursor.fetchall()
        servicios = []
        for row in rows:
            servicios.append({
                'id': row[0],
                'titulo': row[1],
                'nombre_contratante': f"{row[2]} {row[3]} {row[4]}",
                'fecha_servicio': row[5].strftime('%d/%m/%Y') if row[5] else '',
                'precio': float(row[6]) if row[6] else None,
                'mi_calificacion': row[7],
                'mi_comentario': row[8],
                'calificacion_recibida': row[9],
                'comentario_recibido': row[10]
            })
        return jsonify({'success': True, 'servicios': servicios}), 200

    except Exception as e:
        print(f"Error en servicios_concluidos: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/calificar_servicio', methods=['POST'])
def calificar_servicio():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    data = request.get_json()
    solicitud_id = data.get('solicitud_id')
    calificacion = data.get('calificacion')
    comentario = data.get('comentario', '').strip()
    opcion_predeterminada = data.get('opcion_predeterminada', '')

    if not solicitud_id or not calificacion:
        return jsonify({'success': False, 'message': 'Faltan datos'}), 400

    user_id = session['user_id']
    tipo = session['tipo_usuario']

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT ClienteId, PrestadorId FROM SolicitudesServicios WHERE id = ?", (solicitud_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'success': False, 'message': 'Solicitud no encontrada'}), 404

        cliente_id = row[0]
        prestador_id = row[1]

        if tipo == 'cliente':
            evaluado_id = prestador_id
        else:
            evaluado_id = cliente_id

        cursor.execute("""
            SELECT id
            FROM Resenas
            WHERE SolicitudServicioId = ? AND RevisorId = ?
        """, (solicitud_id, user_id))
        if cursor.fetchone():
            return jsonify({'success': False, 'message': 'Ya calificaste esta solicitud.'}), 409

        comentario_final = opcion_predeterminada
        if comentario:
            comentario_final += f"\n{comentario}" if comentario_final else comentario

        cursor.execute("""
            INSERT INTO Resenas (SolicitudServicioId, RevisorId, EvaluadoId, Calificacion, Comentario, CreadoEn)
            VALUES (?, ?, ?, ?, ?, GETDATE())
        """, (solicitud_id, user_id, evaluado_id, calificacion, comentario_final))

        # Enviar correo al evaluado
        cursor.execute("SELECT Email FROM Usuarios WHERE id = ?", (evaluado_id,))
        evaluado_email = cursor.fetchone()[0]
        asunto = "Has recibido una nueva calificación"
        cuerpo = f"""
        Hola,

        Alguien ha calificado tu servicio. Calificación: {calificacion} estrellas.
        Comentario: {comentario_final}

        Puedes ver los detalles en tu panel.
        """
        enviar_correo_notificacion(evaluado_email, asunto, cuerpo)

        cursor.execute("UPDATE SolicitudesServicios SET Estado = 'calificado' WHERE id = ?", (solicitud_id,))

        if tipo == 'cliente':
            cursor.execute("""
                SELECT AVG(Calificacion) FROM Resenas
                WHERE EvaluadoId = ? AND Calificacion IS NOT NULL
            """, (evaluado_id,))
            avg_rating = cursor.fetchone()[0] or 0.0
            cursor.execute("UPDATE Prestadores SET RatingPromedio = ? WHERE UsuarioId = ?", (avg_rating, evaluado_id))

        conn.commit()
        return jsonify({'success': True, 'message': 'Calificación guardada correctamente'}), 200

    except Exception as e:
        print(f"Error en calificar_servicio: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()

# ==================== MENSAJES ====================
@app.route('/mis_conversaciones', methods=['GET'])
def mis_conversaciones():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session['user_id']
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT h.id, h.SolicitudServicioId, p.Titulo, u.id AS otro_usuario_id,
                   per.Nombre, per.ApellidoP, per.ApellidoM, per.FotoPerfil,
                   (SELECT TOP 1 Cuerpo FROM Mensajes WHERE HiloId = h.id ORDER BY EnviadoEn DESC) AS ultimo_mensaje,
                   (SELECT TOP 1 EnviadoEn FROM Mensajes WHERE HiloId = h.id ORDER BY EnviadoEn DESC) AS ultimo_enviado
            FROM Hilos h
            INNER JOIN SolicitudesServicios ss ON h.SolicitudServicioId = ss.id
            INNER JOIN Publicaciones p ON ss.PublicacionId = p.id
            INNER JOIN Usuarios u ON (u.id = ss.ClienteId OR u.id = ss.PrestadorId) AND u.id != ?
            INNER JOIN Personas per ON u.id = per.UsuarioId
            WHERE ss.ClienteId = ? OR ss.PrestadorId = ?
            ORDER BY ultimo_enviado DESC
        """, (user_id, user_id, user_id))
        rows = cursor.fetchall()
        conversaciones = []
        for row in rows:
            conversaciones.append({
                'id': row[0],
                'solicitud_id': row[1],
                'titulo_publicacion': row[2],
                'otro_usuario_id': row[3],
                'otro_nombre': f"{row[4]} {row[5]} {row[6]}",
                'otro_foto': row[7],
                'ultimo_mensaje': descifrar_dato(row[8]),
                'ultimo_enviado': row[9].strftime('%d/%m/%Y %H:%M') if row[9] else ''
            })
        return jsonify({'success': True, 'conversaciones': conversaciones}), 200

    except Exception as e:
        print(f"Error en mis_conversaciones: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/obtener_mensajes/<int:hilo_id>', methods=['GET'])
def obtener_mensajes(hilo_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session['user_id']
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ss.ClienteId, ss.PrestadorId
            FROM Hilos h
            INNER JOIN SolicitudesServicios ss ON h.SolicitudServicioId = ss.id
            WHERE h.id = ?
        """, (hilo_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'success': False, 'message': 'Hilo no encontrado'}), 404
        if row[0] != user_id and row[1] != user_id:
            return jsonify({'success': False, 'message': 'No tienes permiso'}), 403

        cursor.execute("""
            SELECT m.id, m.EmisorId, m.Cuerpo, m.EnviadoEn,
                   per.Nombre, per.ApellidoP, per.ApellidoM
            FROM Mensajes m
            LEFT JOIN Personas per ON m.EmisorId = per.UsuarioId
            WHERE m.HiloId = ?
            ORDER BY m.EnviadoEn ASC
        """, (hilo_id,))
        rows = cursor.fetchall()
        mensajes = []
        for row in rows:
            mensajes.append({
                'id': row[0],
                'emisor_id': row[1],
                'cuerpo': descifrar_dato(row[2]),
                'enviado_en': row[3].strftime('%d/%m/%Y %H:%M') if row[3] else '',
                'emisor_nombre': f"{row[4]} {row[5]} {row[6]}".strip() if row[4] else 'Usuario'
            })
        return jsonify({'success': True, 'mensajes': mensajes}), 200

    except Exception as e:
        print(f"Error en obtener_mensajes: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/enviar_mensaje', methods=['POST'])
def enviar_mensaje():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    data = request.get_json()
    solicitud_id = data.get('solicitud_id')
    mensaje = data.get('mensaje', '').strip()
    hilo_id = data.get('hilo_id')

    if not mensaje:
        return jsonify({'success': False, 'message': 'El mensaje no puede estar vacío'}), 400

    user_id = session['user_id']

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if hilo_id:
            cursor.execute("""
                SELECT ss.ClienteId, ss.PrestadorId
                FROM Hilos h
                INNER JOIN SolicitudesServicios ss ON h.SolicitudServicioId = ss.id
                WHERE h.id = ?
            """, (hilo_id,))
            row = cursor.fetchone()
            if not row or (row[0] != user_id and row[1] != user_id):
                return jsonify({'success': False, 'message': 'No tienes permiso'}), 403
        else:
            if not solicitud_id:
                return jsonify({'success': False, 'message': 'Se requiere solicitud_id'}), 400
            cursor.execute("SELECT ClienteId, PrestadorId FROM SolicitudesServicios WHERE id = ?", (solicitud_id,))
            row = cursor.fetchone()
            if not row or (row[0] != user_id and row[1] != user_id):
                return jsonify({'success': False, 'message': 'No participas en esta solicitud'}), 403

            cursor.execute("SELECT id FROM Hilos WHERE SolicitudServicioId = ?", (solicitud_id,))
            hilo = cursor.fetchone()
            if hilo:
                hilo_id = hilo[0]
            else:
                cursor.execute("INSERT INTO Hilos (SolicitudServicioId, CreadoEn) VALUES (?, GETDATE())", (solicitud_id,))
                hilo_id = cursor.execute("SELECT SCOPE_IDENTITY()").fetchone()[0]
                conn.commit()

        cursor.execute("""
            INSERT INTO Mensajes (HiloId, EmisorId, Cuerpo, EnviadoEn)
            VALUES (?, ?, ?, GETDATE())
        """, (hilo_id, user_id, cifrar_dato(mensaje)))
        conn.commit()

        # --- Enviar correo al destinatario ---
        cursor.execute("""
            SELECT ss.ClienteId, ss.PrestadorId
            FROM Hilos h
            INNER JOIN SolicitudesServicios ss ON h.SolicitudServicioId = ss.id
            WHERE h.id = ?
        """, (hilo_id,))
        row = cursor.fetchone()
        if row:
            otro_id = row[0] if row[0] != user_id else row[1]
            cursor.execute("SELECT Email FROM Usuarios WHERE id = ?", (otro_id,))
            destinatario_email = cursor.fetchone()[0]
            cursor.execute("SELECT Nombre, ApellidoP, ApellidoM FROM Personas WHERE UsuarioId = ?", (user_id,))
            emisor_nombre_row = cursor.fetchone()
            nombre_emisor = f"{emisor_nombre_row[0]} {emisor_nombre_row[1]} {emisor_nombre_row[2]}".strip()
            cuerpo = f"""
            Tienes un nuevo mensaje en JobNest.

            De: {nombre_emisor}
            Mensaje: {mensaje}

            Responde desde tu panel.
            """
            enviar_correo_notificacion(destinatario_email, "Nuevo mensaje en JobNest", cuerpo)

        return jsonify({'success': True, 'message': 'Mensaje enviado', 'hilo_id': hilo_id}), 200

    except Exception as e:
        print(f"Error en enviar_mensaje: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()

# ==================== PAGOS ====================
@app.route('/obtener_solicitudes_pendientes_pago', methods=['GET'])
def obtener_solicitudes_pendientes_pago():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session['user_id']
    tipo = session['tipo_usuario']
    if tipo != 'cliente':
        return jsonify({'success': False, 'message': 'Solo los clientes pueden realizar pagos'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.id, p.Titulo, s.FechaServicio, p.Precio, per.Nombre, per.ApellidoP, per.ApellidoM
            FROM SolicitudesServicios s
            INNER JOIN Publicaciones p ON s.PublicacionId = p.id
            INNER JOIN Usuarios u ON s.PrestadorId = u.id
            INNER JOIN Personas per ON u.id = per.UsuarioId
            LEFT JOIN Pagos pg ON s.id = pg.SolicitudServicioId AND pg.EstatusId = (SELECT id FROM Estatus WHERE Nombre = 'completado')
            WHERE s.ClienteId = ? AND s.Estado = 'aceptada' AND pg.id IS NULL
            ORDER BY s.FechaServicio ASC
        """, (user_id,))
        rows = cursor.fetchall()
        solicitudes = []
        for row in rows:
            solicitudes.append({
                'id': row[0],
                'titulo': row[1],
                'fecha_servicio': row[2].strftime('%d/%m/%Y') if row[2] else '',
                'precio': float(row[3]) if row[3] else 0,
                'prestador_nombre': f"{row[4]} {row[5]} {row[6]}"
            })
        return jsonify({'success': True, 'solicitudes': solicitudes}), 200

    except Exception as e:
        print(f"Error en obtener_solicitudes_pendientes_pago: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/procesar_pago', methods=['POST'])
def procesar_pago():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    data = request.get_json()
    solicitud_id = data.get('solicitud_id')
    metodo = data.get('metodo')
    monto = data.get('monto')

    if not solicitud_id or not metodo or not monto:
        return jsonify({'success': False, 'message': 'Datos incompletos'}), 400
    metodo_normalizado = str(metodo).strip().lower()
    if metodo_normalizado not in {'efectivo', 'tarjeta'}:
        return jsonify({'success': False, 'message': 'Método de pago no soportado'}), 400

    user_id = session['user_id']
    tipo = session['tipo_usuario']
    if tipo != 'cliente':
        return jsonify({'success': False, 'message': 'No autorizado'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT s.id, p.Precio
            FROM SolicitudesServicios s
            INNER JOIN Publicaciones p ON s.PublicacionId = p.id
            LEFT JOIN Pagos pg ON s.id = pg.SolicitudServicioId AND pg.EstatusId = (SELECT id FROM Estatus WHERE Nombre = 'completado')
            WHERE s.id = ? AND s.ClienteId = ? AND s.Estado = 'aceptada' AND pg.id IS NULL
        """, (solicitud_id, user_id))
        row = cursor.fetchone()
        if not row:
            return jsonify({'success': False, 'message': 'La solicitud no es válida para pago'}), 400

        precio_esperado = float(row[1]) if row[1] else 0
        if monto != precio_esperado:
            return jsonify({'success': False, 'message': 'El monto no coincide con el precio del servicio'}), 400

        cursor.execute("SELECT id FROM MetodosPago WHERE Nombre = ?", (metodo_normalizado.capitalize(),))
        metodo_row = cursor.fetchone()
        if not metodo_row:
            return jsonify({'success': False, 'message': 'Método de pago no válido'}), 400
        metodo_id = metodo_row[0]

        cursor.execute("SELECT id FROM Estatus WHERE Nombre = 'completado'")
        estatus_completado = cursor.fetchone()[0]

        if metodo_normalizado == 'efectivo':
            cursor.execute("""
                INSERT INTO Pagos (SolicitudServicioId, Monto, Moneda, MetodoId, EstatusId, Procesador, PagadoEn, CreadoEn)
                VALUES (?, ?, 'MXN', ?, ?, 'Efectivo', GETDATE(), GETDATE())
            """, (solicitud_id, monto, metodo_id, estatus_completado))
            conn.commit()
            return jsonify({'success': True, 'message': 'Pago registrado exitosamente. El servicio ha sido pagado.'}), 200

        elif metodo_normalizado == 'tarjeta':
            numero = data.get('numero')
            nombre = data.get('nombre')
            expiracion = data.get('expiracion')
            cvv = data.get('cvv')

            if not numero or not nombre or not expiracion or not cvv:
                return jsonify({'success': False, 'message': 'Todos los campos de la tarjeta son obligatorios'}), 400

            if not re.match(r'^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,}$', nombre):
                return jsonify({'success': False, 'message': 'Nombre del titular inválido (solo letras y espacios)'}), 400

            numero = re.sub(r'[\s\-]', '', numero)
            if not re.match(r'^\d{13,19}$', numero):
                return jsonify({'success': False, 'message': 'Número de tarjeta inválido (debe tener entre 13 y 19 dígitos)'}), 400

            if not re.match(r'^\d{3,4}$', cvv):
                return jsonify({'success': False, 'message': 'CVV inválido (3 o 4 dígitos)'}), 400

            if not re.match(r'^(0[1-9]|1[0-2])\/\d{2}$', expiracion):
                return jsonify({'success': False, 'message': 'Formato de fecha inválido (MM/AA)'}), 400
            mes, anio = expiracion.split('/')
            anio_actual = datetime.now().year % 100
            mes_actual = datetime.now().month
            if int(anio) < anio_actual or (int(anio) == anio_actual and int(mes) < mes_actual):
                return jsonify({'success': False, 'message': 'Tarjeta expirada'}), 400

            transaccion_id = f"SIM-{solicitud_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            cursor.execute("""
                INSERT INTO Pagos (SolicitudServicioId, Monto, Moneda, MetodoId, EstatusId, Procesador, ProcesadorChargeId, PagadoEn, CreadoEn)
                VALUES (?, ?, 'MXN', ?, ?, 'Simulación', ?, GETDATE(), GETDATE())
            """, (solicitud_id, monto, metodo_id, estatus_completado, cifrar_dato(transaccion_id)))
            conn.commit()
            return jsonify({'success': True, 'message': 'Pago procesado exitosamente', 'transaccion_id': transaccion_id}), 200

    except Exception as e:
        print(f"Error en procesar_pago: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()

# ==================== ACTUALIZAR ESTADO DE SOLICITUD ====================
@app.route('/actualizar_estado_solicitud/<int:solicitud_id>', methods=['POST'])
def actualizar_estado_solicitud(solicitud_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    data = request.get_json()
    nuevo_estado = data.get('estado')
    if nuevo_estado not in ['aceptada', 'rechazada']:
        return jsonify({'success': False, 'message': 'Estado no válido'}), 400

    user_id = session['user_id']
    tipo = session['tipo_usuario']
    if tipo != 'prestador':
        return jsonify({'success': False, 'message': 'Solo prestadores pueden actualizar estado'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT Estado FROM SolicitudesServicios WHERE id = ? AND PrestadorId = ?", (solicitud_id, user_id))
        solicitud_estado = cursor.fetchone()
        if not solicitud_estado:
            return jsonify({'success': False, 'message': 'No tienes permiso para modificar esta solicitud'}), 403
        if solicitud_estado[0] != 'pendiente':
            return jsonify({'success': False, 'message': 'La solicitud ya fue atendida y no puede modificarse nuevamente.'}), 409

        # Obtener datos para el correo antes de actualizar
        cursor.execute("""
            SELECT s.ClienteId, p.Titulo, per.Nombre, per.ApellidoP, per.ApellidoM
            FROM SolicitudesServicios s
            INNER JOIN Publicaciones p ON s.PublicacionId = p.id
            INNER JOIN Personas per ON s.PrestadorId = per.UsuarioId
            WHERE s.id = ?
        """, (solicitud_id,))
        solicitud_info = cursor.fetchone()
        if not solicitud_info:
            return jsonify({'success': False, 'message': 'Solicitud no encontrada'}), 404
        cliente_id = solicitud_info[0]
        titulo_servicio = solicitud_info[1]
        prestador_nombre = f"{solicitud_info[2]} {solicitud_info[3]} {solicitud_info[4]}".strip()

        if nuevo_estado == 'aceptada':
            cursor.execute("""
                UPDATE SolicitudesServicios
                SET Estado = ?, FechaAceptacion = GETDATE()
                WHERE id = ? AND PrestadorId = ? AND Estado = 'pendiente'
            """, (nuevo_estado, solicitud_id, user_id))
        else:
            cursor.execute("""
                UPDATE SolicitudesServicios
                SET Estado = ?
                WHERE id = ? AND PrestadorId = ? AND Estado = 'pendiente'
            """, (nuevo_estado, solicitud_id, user_id))
        if cursor.rowcount != 1:
            conn.rollback()
            cursor.execute("SELECT Estado FROM SolicitudesServicios WHERE id = ? AND PrestadorId = ?", (solicitud_id, user_id))
            estado_actual = cursor.fetchone()
            if not estado_actual:
                return jsonify({'success': False, 'message': 'No tienes permiso para modificar esta solicitud'}), 403
            return jsonify({'success': False, 'message': f"La solicitud ya fue atendida y no puede modificarse nuevamente. Estado actual: {estado_actual[0]}."}), 409

        # Enviar correo al cliente
        cursor.execute("SELECT Email FROM Usuarios WHERE id = ?", (cliente_id,))
        cliente_email = cursor.fetchone()[0]

        if nuevo_estado == 'aceptada':
            asunto = "Solicitud aceptada"
            cuerpo = f"""
            Hola,

            Tu solicitud para el servicio "{titulo_servicio}" ha sido ACEPTADA por {prestador_nombre}.

            Puedes contactar al prestador desde la sección de Mensajes para coordinar los detalles.
            """
        else:
            asunto = "Solicitud rechazada"
            cuerpo = f"""
            Hola,

            Tu solicitud para el servicio "{titulo_servicio}" ha sido RECHAZADA por {prestador_nombre}.

            No te desanimes, hay más prestadores disponibles.
            """
        enviar_correo_notificacion(cliente_email, asunto, cuerpo)

        # SI LA SOLICITUD FUE ACEPTADA, CREAR HILO DE CONVERSACIÓN (si no existe)
        if nuevo_estado == 'aceptada':
            cursor.execute("SELECT id FROM Hilos WHERE SolicitudServicioId = ?", (solicitud_id,))
            hilo_existente = cursor.fetchone()
            if not hilo_existente:
                cursor.execute("INSERT INTO Hilos (SolicitudServicioId, CreadoEn) VALUES (?, GETDATE())", (solicitud_id,))
                hilo_id = cursor.execute("SELECT SCOPE_IDENTITY()").fetchone()[0]
                print(f"✅ Hilo creado automáticamente para la solicitud {solicitud_id} (ID de hilo: {hilo_id})")

                mensaje_bienvenida = f"✅ Solicitud aceptada para el servicio: {titulo_servicio}. Ahora pueden conversar para coordinar los detalles."
                cursor.execute("""
                    INSERT INTO Mensajes (HiloId, EmisorId, Cuerpo, EnviadoEn)
                    VALUES (?, NULL, ?, GETDATE())
                """, (hilo_id, cifrar_dato(mensaje_bienvenida)))
                print(f"💬 Mensaje automático insertado en el hilo {hilo_id}")

        conn.commit()
        return jsonify({'success': True, 'message': f'Solicitud {nuevo_estado}'}), 200

    except Exception as e:
        print(f"Error en actualizar_estado_solicitud: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/marcar_concluido/<int:solicitud_id>', methods=['POST'])
def marcar_concluido(solicitud_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session['user_id']
    tipo = session['tipo_usuario']
    if tipo != 'prestador':
        return jsonify({'success': False, 'message': 'Solo prestadores pueden marcar como concluido'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM SolicitudesServicios WHERE id = ? AND PrestadorId = ? AND Estado = 'aceptada'",
                       (solicitud_id, user_id))
        if not cursor.fetchone():
            return jsonify({'success': False, 'message': 'Solicitud no encontrada o no está aceptada'}), 404

        cursor.execute("UPDATE SolicitudesServicios SET Estado = 'concluido' WHERE id = ?", (solicitud_id,))
        conn.commit()
        return jsonify({'success': True, 'message': 'Trabajo marcado como concluido'}), 200

    except Exception as e:
        print(f"Error en marcar_concluido: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


# ==================== ADMINISTRADOR ====================
@app.route('/admin/resumen', methods=['GET'])
def admin_resumen():
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)

        cursor.execute("SELECT COUNT(*) FROM Usuarios")
        total_usuarios = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM Usuarios WHERE Activo = 1")
        usuarios_activos = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM Usuarios WHERE Activo = 0")
        usuarios_inactivos = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM Prestadores")
        prestadores = cursor.fetchone()[0]
        cursor.execute("""
            SELECT COUNT(*)
            FROM Prestadores pr
            INNER JOIN Usuarios u ON pr.UsuarioId = u.id
            WHERE u.Activo = 1
        """)
        prestadores_activos = cursor.fetchone()[0]
        cursor.execute("""
            SELECT COUNT(*)
            FROM Prestadores pr
            INNER JOIN Usuarios u ON pr.UsuarioId = u.id
            WHERE u.Activo = 0
        """)
        prestadores_inactivos = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM Prestadores WHERE Verificado = 0")
        prestadores_pendientes_validacion = cursor.fetchone()[0]
        cursor.execute("""
            SELECT COUNT(DISTINCT ur.UsuarioId)
            FROM UsuarioRoles ur
            INNER JOIN Roles r ON ur.RolId = r.id
            WHERE LOWER(r.Nombre) IN ('admin', 'administrador')
        """)
        administradores = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM Publicaciones WHERE Activa = 1")
        publicaciones_activas = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM Publicaciones WHERE Activa = 0")
        publicaciones_inactivas = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM PublicacionVersiones WHERE Estado = 'pendiente_revision'")
        publicaciones_pendientes = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM PublicacionVersiones WHERE Estado = 'rechazada'")
        publicaciones_rechazadas = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM SolicitudesServicios")
        solicitudes = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM Quejas WHERE Estado = 'pendiente'")
        quejas_pendientes = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM Quejas WHERE Estado IN ('asignada', 'en_revision')")
        quejas_en_revision = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM Quejas WHERE Estado IN ('resuelta', 'cerrada')")
        quejas_resueltas = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM Mensajes")
        mensajes = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM Resenas")
        resenas = cursor.fetchone()[0]
        cursor.execute("SELECT COALESCE(SUM(Monto), 0) FROM Pagos")
        pagos_total = float(cursor.fetchone()[0] or 0)
        cursor.execute("""
            SELECT COALESCE(e.Nombre, 'sin_estado'), COUNT(*), COALESCE(SUM(p.Monto), 0)
            FROM Pagos p
            LEFT JOIN Estatus e ON p.EstatusId = e.id
            GROUP BY e.Nombre
        """)
        pagos_por_estado = [{'estado': row[0], 'total': row[1], 'monto': float(row[2] or 0)} for row in cursor.fetchall()]
        cursor.execute("SELECT COUNT(*) FROM AlertasSistema WHERE Leida = 0")
        alertas_pendientes = cursor.fetchone()[0]

        cursor.execute("""
            SELECT Estado, COUNT(*)
            FROM SolicitudesServicios
            GROUP BY Estado
            ORDER BY COUNT(*) DESC
        """)
        solicitudes_por_estado = [{'estado': row[0] or 'sin_estado', 'total': row[1]} for row in cursor.fetchall()]
        solicitudes_estado_map = {item['estado']: item['total'] for item in solicitudes_por_estado}

        cursor.execute("""
            SELECT TOP 8 b.id, b.TipoEvento, b.Entidad, b.EntidadId, b.Detalle, b.CreadoEn,
                   actor.Email
            FROM BitacoraAdmin b
            LEFT JOIN Usuarios actor ON b.ActorId = actor.id
            ORDER BY b.CreadoEn DESC
        """)
        actividad_reciente = [{
            'id': row[0],
            'tipo_evento': row[1],
            'entidad': row[2],
            'entidad_id': row[3],
            'detalle': row[4] or '',
            'creado_en': fmt_datetime(row[5]),
            'actor_email': row[6] or ''
        } for row in cursor.fetchall()]

        clientes = max(total_usuarios - prestadores - administradores, 0)
        clientes_activos = max(usuarios_activos - prestadores_activos - administradores, 0)
        clientes_inactivos = max(usuarios_inactivos - prestadores_inactivos, 0)
        return jsonify({
            'success': True,
            'resumen': {
                'usuarios': total_usuarios,
                'usuarios_activos': usuarios_activos,
                'usuarios_inactivos': usuarios_inactivos,
                'clientes': clientes,
                'clientes_activos': clientes_activos,
                'clientes_inactivos': clientes_inactivos,
                'prestadores': prestadores,
                'prestadores_activos': prestadores_activos,
                'prestadores_inactivos': prestadores_inactivos,
                'prestadores_pendientes_validacion': prestadores_pendientes_validacion,
                'administradores': administradores,
                'publicaciones_activas': publicaciones_activas,
                'publicaciones_inactivas': publicaciones_inactivas,
                'publicaciones_pendientes': publicaciones_pendientes,
                'publicaciones_rechazadas': publicaciones_rechazadas,
                'solicitudes': solicitudes,
                'solicitudes_nuevas': solicitudes_estado_map.get('pendiente', 0),
                'solicitudes_aceptadas': solicitudes_estado_map.get('aceptada', 0),
                'solicitudes_rechazadas': solicitudes_estado_map.get('rechazada', 0),
                'servicios_concluidos': solicitudes_estado_map.get('concluido', 0) + solicitudes_estado_map.get('concluida', 0) + solicitudes_estado_map.get('calificado', 0),
                'servicios_cancelados': solicitudes_estado_map.get('cancelada_cliente', 0) + solicitudes_estado_map.get('cancelada_prestador', 0) + solicitudes_estado_map.get('cancelada', 0),
                'servicios_con_incidencias': solicitudes_estado_map.get('en_disputa', 0),
                'quejas_pendientes': quejas_pendientes,
                'quejas_en_revision': quejas_en_revision,
                'quejas_resueltas': quejas_resueltas,
                'alertas_pendientes': alertas_pendientes,
                'mensajes': mensajes,
                'resenas': resenas,
                'pagos_total': pagos_total,
                'pagos_por_estado': pagos_por_estado,
                'solicitudes_por_estado': solicitudes_por_estado,
                'actividad_reciente': actividad_reciente
            }
        }), 200

    except Exception as e:
        print(f"Error en admin_resumen: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/usuarios', methods=['GET'])
def admin_usuarios():
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("""
            SELECT TOP 40
                u.id, u.Email, u.Activo, u.CreadoEn, u.UltimoLogin,
                p.Nombre, p.ApellidoP, p.ApellidoM,
                CASE WHEN pr.id IS NULL THEN 0 ELSE 1 END AS EsPrestador,
                COALESCE(STRING_AGG(r.Nombre, ', '), '') AS Roles
            FROM Usuarios u
            LEFT JOIN Personas p ON u.id = p.UsuarioId
            LEFT JOIN Prestadores pr ON u.id = pr.UsuarioId
            LEFT JOIN UsuarioRoles ur ON u.id = ur.UsuarioId
            LEFT JOIN Roles r ON ur.RolId = r.id
            GROUP BY u.id, u.Email, u.Activo, u.CreadoEn, u.UltimoLogin,
                     p.Nombre, p.ApellidoP, p.ApellidoM, pr.id
            ORDER BY u.CreadoEn DESC
        """)
        usuarios = []
        for row in cursor.fetchall():
            roles = row[9] or ''
            tipo = 'administrador' if row[1].lower() in get_admin_emails() or 'admin' in roles.lower() else ('prestador' if row[8] else 'cliente')
            usuarios.append({
                'id': row[0],
                'email': row[1],
                'activo': bool(row[2]),
                'creado_en': fmt_datetime(row[3]),
                'ultimo_login': fmt_datetime(row[4]),
                'nombre': f"{row[5] or ''} {row[6] or ''} {row[7] or ''}".strip() or 'Sin perfil',
                'tipo_usuario': tipo
            })

        return jsonify({'success': True, 'usuarios': usuarios}), 200

    except Exception as e:
        print(f"Error en admin_usuarios: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/publicaciones', methods=['GET'])
def admin_publicaciones():
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("""
            SELECT TOP 40
                pub.id, v.Titulo, v.Categoria, v.Precio, pub.Activa, pub.FechaCreacion,
                per.Nombre, per.ApellidoP, per.ApellidoM, u.Email,
                v.Estado, COALESCE(v.Observaciones, v.MotivoRechazo, pub.ComentarioRevision), v.RevisadoEn, v.Descripcion,
                v.Ubicacion, v.Experiencia, v.Habilidades, v.Disponibilidad, v.IncluyeMateriales,
                v.id AS VersionId, v.VersionNumero, v.EsVersionPublica,
                (SELECT TOP 1 ImagenUrl FROM PublicacionImagenes img WHERE img.VersionId = v.id AND img.EstadoRevision <> 'eliminada' ORDER BY img.EsPrincipal DESC, img.Posicion) AS ImagenPrincipal
            FROM Publicaciones pub
            INNER JOIN PublicacionVersiones v ON v.id = (
                SELECT TOP 1 pv.id
                FROM PublicacionVersiones pv
                WHERE pv.PublicacionId = pub.id
                ORDER BY CASE WHEN pv.Estado = 'pendiente_revision' THEN 0 ELSE 1 END, pv.VersionNumero DESC
            )
            INNER JOIN Usuarios u ON pub.UsuarioId = u.id
            LEFT JOIN Personas per ON u.id = per.UsuarioId
            ORDER BY CASE WHEN v.Estado = 'pendiente_revision' THEN 0 ELSE 1 END, v.CreadoEn DESC
        """)
        publicaciones = [{
            'id': row[0],
            'titulo': row[1],
            'categoria': row[2],
            'precio': float(row[3]) if row[3] else None,
            'activa': bool(row[4]),
            'fecha_creacion': fmt_datetime(row[5]),
            'prestador_nombre': f"{row[6] or ''} {row[7] or ''} {row[8] or ''}".strip() or row[9],
            'prestador_email': row[9],
            'estado_revision': row[10],
            'comentario_revision': row[11] or '',
            'fecha_revision': fmt_datetime(row[12]),
            'descripcion': row[13] or '',
            'ubicacion': row[14] or '',
            'experiencia': row[15],
            'habilidades': row[16] or '',
            'disponibilidad': row[17] or '',
            'incluye_materiales': bool(row[18]),
            'version_id': row[19],
            'version_numero': row[20],
            'es_version_publica': bool(row[21]),
            'imagen_principal': row[22]
        } for row in cursor.fetchall()]

        return jsonify({'success': True, 'publicaciones': publicaciones}), 200

    except Exception as e:
        print(f"Error en admin_publicaciones: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/publicaciones/<int:publicacion_id>', methods=['GET'])
def admin_detalle_publicacion(publicacion_id):
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("""
            SELECT pub.id, pub.UsuarioId, u.Email, u.Activo, per.Nombre, per.ApellidoP, per.ApellidoM,
                   pub.Activa, pub.FechaCreacion
            FROM Publicaciones pub
            INNER JOIN Usuarios u ON pub.UsuarioId = u.id
            LEFT JOIN Personas per ON u.id = per.UsuarioId
            WHERE pub.id = ?
        """, (publicacion_id,))
        pub = cursor.fetchone()
        if not pub:
            return jsonify({'success': False, 'message': 'Publicación no encontrada.'}), 404

        cursor.execute("""
            SELECT id, VersionNumero, Titulo, Descripcion, Categoria, Precio, Ubicacion, Experiencia,
                   Habilidades, Disponibilidad, IncluyeMateriales, TipoPrecio, Estado, Observaciones,
                   MotivoRechazo, EsVersionPublica, CreadoEn, RevisadoEn
            FROM PublicacionVersiones
            WHERE PublicacionId = ?
            ORDER BY VersionNumero DESC
        """, (publicacion_id,))
        versiones = []
        for row in cursor.fetchall():
            versiones.append({
                'id': row[0],
                'version_numero': row[1],
                'titulo': row[2],
                'descripcion': row[3],
                'categoria': row[4],
                'precio': float(row[5]) if row[5] else None,
                'ubicacion': row[6],
                'experiencia': row[7],
                'habilidades': row[8],
                'disponibilidad': row[9],
                'incluye_materiales': bool(row[10]),
                'tipo_precio': row[11],
                'estado': row[12],
                'observaciones': row[13] or '',
                'motivo_rechazo': row[14] or '',
                'es_version_publica': bool(row[15]),
                'creado_en': fmt_datetime(row[16]),
                'revisado_en': fmt_datetime(row[17])
            })

        cursor.execute("""
            SELECT id, VersionId, ImagenUrl, Posicion, EsPrincipal, EstadoRevision, MotivoRechazo, CreadoEn
            FROM PublicacionImagenes
            WHERE PublicacionId = ? AND EstadoRevision <> 'eliminada'
            ORDER BY VersionId DESC, Posicion
        """, (publicacion_id,))
        imagenes = [{
            'id': row[0],
            'version_id': row[1],
            'imagen_url': row[2],
            'posicion': row[3],
            'es_principal': bool(row[4]),
            'estado_revision': row[5],
            'motivo_rechazo': row[6] or '',
            'creado_en': fmt_datetime(row[7])
        } for row in cursor.fetchall()]

        cursor.execute("""
            SELECT r.id, r.Accion, r.EstadoAnterior, r.EstadoNuevo, r.Observaciones, r.CreadoEn,
                   u.Email
            FROM PublicacionRevisiones r
            INNER JOIN Usuarios u ON r.AdministradorId = u.id
            WHERE r.PublicacionId = ?
            ORDER BY r.CreadoEn DESC
        """, (publicacion_id,))
        revisiones = [{
            'id': row[0],
            'accion': row[1],
            'estado_anterior': row[2],
            'estado_nuevo': row[3],
            'observaciones': row[4] or '',
            'creado_en': fmt_datetime(row[5]),
            'admin_email': row[6]
        } for row in cursor.fetchall()]

        return jsonify({
            'success': True,
            'publicacion': {
                'id': pub[0],
                'activa': bool(pub[7]),
                'fecha_creacion': fmt_datetime(pub[8]),
                'prestador': {
                    'id': pub[1],
                    'email': pub[2],
                    'activo': bool(pub[3]),
                    'nombre': f"{pub[4] or ''} {pub[5] or ''} {pub[6] or ''}".strip() or pub[2]
                },
                'version_publica': next((item for item in versiones if item['es_version_publica']), None),
                'version_actual': versiones[0] if versiones else None,
                'versiones': versiones,
                'imagenes': imagenes,
                'revisiones': revisiones
            }
        }), 200

    except Exception as e:
        print(f"Error en admin_detalle_publicacion: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/solicitudes', methods=['GET'])
def admin_solicitudes():
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("""
            SELECT TOP 40
                s.id, s.FechaSolicitud, s.FechaServicio, s.Estado, p.Titulo, p.Precio,
                cli.Nombre, cli.ApellidoP, cli.ApellidoM,
                pre.Nombre, pre.ApellidoP, pre.ApellidoM
            FROM SolicitudesServicios s
            INNER JOIN Publicaciones p ON s.PublicacionId = p.id
            LEFT JOIN Personas cli ON s.ClienteId = cli.UsuarioId
            LEFT JOIN Personas pre ON s.PrestadorId = pre.UsuarioId
            ORDER BY s.FechaSolicitud DESC
        """)
        solicitudes = [{
            'id': row[0],
            'fecha_solicitud': fmt_datetime(row[1]),
            'fecha_servicio': fmt_date(row[2]),
            'estado': row[3],
            'titulo_publicacion': row[4],
            'precio': float(row[5]) if row[5] else None,
            'cliente_nombre': f"{row[6] or ''} {row[7] or ''} {row[8] or ''}".strip(),
            'prestador_nombre': f"{row[9] or ''} {row[10] or ''} {row[11] or ''}".strip()
        } for row in cursor.fetchall()]

        return jsonify({'success': True, 'solicitudes': solicitudes}), 200

    except Exception as e:
        print(f"Error en admin_solicitudes: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/pagos', methods=['GET'])
def admin_pagos():
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized

    estado = request.args.get('estado', '').strip()
    q = request.args.get('q', '').strip()
    page = parse_int_arg('page', 1, 1, 10000)
    page_size = parse_int_arg('page_size', 25, 1, 100)
    offset = (page - 1) * page_size
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        where = []
        params = []
        if estado:
            where.append("COALESCE(e.Nombre, '') = ?")
            params.append(estado)
        if q:
            where.append("(u_cli.Email LIKE ? OR u_pre.Email LIKE ? OR p.ProcesadorChargeId LIKE ? OR pub.Titulo LIKE ?)")
            params.extend([f'%{q}%', f'%{q}%', f'%{q}%', f'%{q}%'])
        where_sql = f"WHERE {' AND '.join(where)}" if where else ""
        cursor.execute(f"""
            SELECT COUNT(*)
            FROM Pagos p
            LEFT JOIN Estatus e ON p.EstatusId = e.id
            LEFT JOIN SolicitudesServicios ss ON p.SolicitudServicioId = ss.id
            LEFT JOIN Publicaciones pub ON ss.PublicacionId = pub.id
            LEFT JOIN Usuarios u_cli ON ss.ClienteId = u_cli.id
            LEFT JOIN Usuarios u_pre ON ss.PrestadorId = u_pre.id
            {where_sql}
        """, params)
        total = cursor.fetchone()[0]
        cursor.execute(f"""
            SELECT p.id, p.Monto, p.Moneda, p.Procesador, p.ProcesadorChargeId, p.PagadoEn, p.CreadoEn,
                   COALESCE(e.Nombre, 'sin_estado') AS EstadoPago,
                   mp.Nombre AS Metodo,
                   ss.id AS SolicitudId, ss.Estado AS EstadoSolicitud,
                   pub.Titulo,
                   u_cli.Email AS ClienteEmail, u_pre.Email AS PrestadorEmail
            FROM Pagos p
            LEFT JOIN Estatus e ON p.EstatusId = e.id
            LEFT JOIN MetodosPago mp ON p.MetodoId = mp.id
            LEFT JOIN SolicitudesServicios ss ON p.SolicitudServicioId = ss.id
            LEFT JOIN Publicaciones pub ON ss.PublicacionId = pub.id
            LEFT JOIN Usuarios u_cli ON ss.ClienteId = u_cli.id
            LEFT JOIN Usuarios u_pre ON ss.PrestadorId = u_pre.id
            {where_sql}
            ORDER BY p.CreadoEn DESC
            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """, [*params, offset, page_size])
        pagos = [{
            'id': row[0],
            'monto': float(row[1] or 0),
            'moneda': row[2] or 'MXN',
            'procesador': row[3] or 'interno',
            'referencia': row[4] or '',
            'pagado_en': fmt_datetime(row[5]),
            'creado_en': fmt_datetime(row[6]),
            'estado': row[7],
            'metodo': row[8] or '',
            'solicitud_id': row[9],
            'estado_solicitud': row[10] or '',
            'publicacion_titulo': row[11] or '',
            'cliente_email': row[12] or '',
            'prestador_email': row[13] or ''
        } for row in cursor.fetchall()]
        return jsonify({'success': True, 'pagos': pagos, 'total': total, 'page': page, 'page_size': page_size}), 200
    except Exception as e:
        print(f"Error en admin_pagos: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/alertas', methods=['GET'])
def admin_alertas():
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized

    solo_no_leidas = request.args.get('no_leidas', '0') == '1'
    page = parse_int_arg('page', 1, 1, 10000)
    page_size = parse_int_arg('page_size', 25, 1, 100)
    offset = (page - 1) * page_size
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        where = "WHERE Leida = 0" if solo_no_leidas else ""
        cursor.execute(f"SELECT COUNT(*) FROM AlertasSistema {where}")
        total = cursor.fetchone()[0]
        cursor.execute(f"""
            SELECT id, Tipo, Prioridad, Titulo, Mensaje, PublicacionId, VersionId,
                   Entidad, EntidadId, Leida, CreadoEn
            FROM AlertasSistema
            {where}
            ORDER BY CASE Prioridad WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, CreadoEn DESC
            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """, (offset, page_size))
        alertas = [{
            'id': row[0],
            'tipo': row[1],
            'prioridad': row[2],
            'titulo': row[3],
            'mensaje': row[4],
            'publicacion_id': row[5],
            'version_id': row[6],
            'entidad': row[7],
            'entidad_id': row[8],
            'leida': bool(row[9]),
            'creado_en': fmt_datetime(row[10])
        } for row in cursor.fetchall()]
        return jsonify({'success': True, 'alertas': alertas, 'total': total, 'page': page, 'page_size': page_size}), 200
    except Exception as e:
        print(f"Error en admin_alertas: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/alertas/<int:alerta_id>/leer', methods=['POST'])
def admin_marcar_alerta_leida(alerta_id):
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("UPDATE AlertasSistema SET Leida = 1, LeidaEn = GETDATE() WHERE id = ?", (alerta_id,))
        audit_event(cursor, 'alerta_marcada_leida', 'AlertasSistema', alerta_id, 'Alerta marcada como leída.', actor_id=session.get('user_id'))
        conn.commit()
        return jsonify({'success': True, 'message': 'Alerta marcada como leída.'}), 200
    except Exception as e:
        print(f"Error en admin_marcar_alerta_leida: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/usuarios/<int:user_id>/toggle', methods=['POST'])
def admin_toggle_usuario(user_id):
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized

    if user_id == session.get('user_id'):
        return jsonify({'success': False, 'message': 'No puedes desactivar tu propia cuenta administradora.'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("SELECT Activo FROM Usuarios WHERE id = ?", (user_id,))
        usuario = cursor.fetchone()
        if not usuario:
            return jsonify({'success': False, 'message': 'Usuario no encontrado.'}), 404

        nuevo_estado = 0 if usuario[0] else 1
        cursor.execute("UPDATE Usuarios SET Activo = ? WHERE id = ?", (nuevo_estado, user_id))
        audit_event(cursor, 'usuario_estado_admin', 'Usuarios', user_id,
                    f"Admin {'activó' if nuevo_estado else 'desactivó'} la cuenta.",
                    usuario_id=user_id, actor_id=session.get('user_id'))
        conn.commit()
        return jsonify({'success': True, 'message': f"Usuario {'activado' if nuevo_estado else 'desactivado'} correctamente."}), 200

    except Exception as e:
        print(f"Error en admin_toggle_usuario: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/publicaciones/<int:publicacion_id>/toggle', methods=['POST'])
def admin_toggle_publicacion(publicacion_id):
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("SELECT Activa, EstadoRevision FROM Publicaciones WHERE id = ?", (publicacion_id,))
        publicacion = cursor.fetchone()
        if not publicacion:
            return jsonify({'success': False, 'message': 'Publicación no encontrada.'}), 404

        nuevo_estado = 0 if publicacion[0] else 1
        if nuevo_estado and publicacion[1] != 'aprobada':
            return jsonify({'success': False, 'message': 'Solo puedes activar publicaciones aprobadas.'}), 400
        cursor.execute("UPDATE Publicaciones SET Activa = ? WHERE id = ?", (nuevo_estado, publicacion_id))
        audit_event(cursor, 'publicacion_estado_admin', 'Publicaciones', publicacion_id,
                    f"Admin {'activó' if nuevo_estado else 'desactivó'} la publicación.",
                    actor_id=session.get('user_id'))
        conn.commit()
        return jsonify({'success': True, 'message': f"Publicación {'activada' if nuevo_estado else 'desactivada'} correctamente."}), 200

    except Exception as e:
        print(f"Error en admin_toggle_publicacion: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/publicaciones/<int:publicacion_id>/revision', methods=['POST'])
def admin_revisar_publicacion(publicacion_id):
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized

    data = request.get_json(silent=True) or {}
    estado = (data.get('estado') or '').strip().lower()
    comentario = (data.get('comentario') or '').strip()
    version_id = data.get('version_id')

    acciones_validas = {
        'aprobada': 'aprobar',
        'rechazada': 'rechazar',
        'correcciones_solicitadas': 'solicitar_correcciones',
        'suspendida': 'suspender',
        'oculta': 'ocultar'
    }
    if estado not in acciones_validas:
        return jsonify({'success': False, 'message': 'Estado de revisión no válido.'}), 400
    if estado in ('rechazada', 'correcciones_solicitadas', 'suspendida', 'oculta') and not comentario:
        return jsonify({'success': False, 'message': 'Agrega un motivo u observación para esta acción.'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("SELECT UsuarioId, Titulo FROM Publicaciones WHERE id = ?", (publicacion_id,))
        publicacion = cursor.fetchone()
        if not publicacion:
            return jsonify({'success': False, 'message': 'Publicación no encontrada.'}), 404

        if version_id:
            cursor.execute("SELECT id, Estado FROM PublicacionVersiones WHERE id = ? AND PublicacionId = ?", (version_id, publicacion_id))
        else:
            cursor.execute("""
                SELECT TOP 1 id, Estado
                FROM PublicacionVersiones
                WHERE PublicacionId = ?
                ORDER BY CASE WHEN Estado = 'pendiente_revision' THEN 0 ELSE 1 END, VersionNumero DESC
            """, (publicacion_id,))
        version = cursor.fetchone()
        if not version:
            return jsonify({'success': False, 'message': 'Versión no encontrada.'}), 404

        estado_anterior = version[1]
        version_id = version[0]
        if estado == 'aprobada':
            sincronizar_publicacion_desde_version(cursor, publicacion_id, version_id, session.get('user_id'))
            observaciones_set = comentario or None
            motivo_set = None
        else:
            observaciones_set = comentario if estado == 'correcciones_solicitadas' else None
            motivo_set = comentario if estado in ('rechazada', 'suspendida', 'oculta') else None
            cursor.execute("""
                UPDATE PublicacionVersiones
                SET Estado = ?, RevisadoPor = ?, RevisadoEn = GETDATE(), ActualizadoEn = GETDATE(),
                    Observaciones = ?, MotivoRechazo = ?
                WHERE id = ?
            """, (estado, session.get('user_id'), observaciones_set, motivo_set, version_id))
            public_version_id = obtener_version_publica_id(cursor, publicacion_id)
            if estado in ('suspendida', 'oculta') or not public_version_id:
                cursor.execute("""
                    UPDATE Publicaciones
                    SET Activa = 0, EstadoRevision = ?, RevisadoPor = ?, FechaRevision = GETDATE(),
                        ComentarioRevision = ?, FechaActualizacion = GETDATE()
                    WHERE id = ?
                """, (estado, session.get('user_id'), comentario, publicacion_id))

        cursor.execute("""
            INSERT INTO PublicacionRevisiones (
                PublicacionId, VersionId, AdministradorId, Accion, EstadoAnterior, EstadoNuevo, Observaciones
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (publicacion_id, version_id, session.get('user_id'), acciones_validas[estado], estado_anterior, estado, comentario or None))
        if estado == 'aprobada':
            cursor.execute("""
                UPDATE PublicacionVersiones
                SET Observaciones = ?, MotivoRechazo = NULL
                WHERE id = ?
            """, (observaciones_set, version_id))
        cursor.execute("""
            UPDATE Publicaciones
            SET EstadoRevision = CASE WHEN Activa = 1 THEN 'aprobada' ELSE ? END,
                ComentarioRevision = ?
            WHERE id = ?
        """, (estado, comentario or None, publicacion_id))
        crear_alerta(cursor, 'publicacion_decision', f"Publicación {estado}",
                     comentario or f"Tu publicación fue marcada como {estado}.",
                     publicacion_id=publicacion_id, version_id=version_id, usuario_id=publicacion[0])
        audit_event(cursor, f'publicacion_{estado}', 'Publicaciones', publicacion_id,
                    comentario or f"Publicación {estado} por administrador.",
                    usuario_id=publicacion[0], actor_id=session.get('user_id'))
        conn.commit()
        return jsonify({'success': True, 'message': f"Publicación {estado} correctamente."}), 200

    except Exception as e:
        print(f"Error en admin_revisar_publicacion: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/publicaciones/<int:publicacion_id>/reactivar', methods=['POST'])
def admin_reactivar_publicacion(publicacion_id):
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized

    data = request.get_json(silent=True) or {}
    comentario = (data.get('comentario') or '').strip()
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        public_version_id = obtener_version_publica_id(cursor, publicacion_id)
        if not public_version_id:
            return jsonify({'success': False, 'message': 'No hay una versión aprobada para reactivar.'}), 400
        cursor.execute("SELECT UsuarioId FROM Publicaciones WHERE id = ?", (publicacion_id,))
        publicacion = cursor.fetchone()
        if not publicacion:
            return jsonify({'success': False, 'message': 'Publicación no encontrada.'}), 404
        cursor.execute("""
            UPDATE Publicaciones
            SET Activa = 1, EstadoRevision = 'aprobada', RevisadoPor = ?, FechaRevision = GETDATE(),
                ComentarioRevision = ?, FechaActualizacion = GETDATE()
            WHERE id = ?
        """, (session.get('user_id'), comentario or None, publicacion_id))
        cursor.execute("""
            INSERT INTO PublicacionRevisiones (
                PublicacionId, VersionId, AdministradorId, Accion, EstadoAnterior, EstadoNuevo, Observaciones
            )
            VALUES (?, ?, ?, 'reactivar', 'oculta', 'aprobada', ?)
        """, (publicacion_id, public_version_id, session.get('user_id'), comentario or None))
        crear_alerta(cursor, 'publicacion_decision', 'Publicación reactivada',
                     comentario or 'Tu publicación aprobada fue reactivada.',
                     publicacion_id=publicacion_id, version_id=public_version_id, usuario_id=publicacion[0])
        audit_event(cursor, 'publicacion_reactivada', 'Publicaciones', publicacion_id,
                    comentario or 'Publicación reactivada por administrador.',
                    usuario_id=publicacion[0], actor_id=session.get('user_id'))
        conn.commit()
        return jsonify({'success': True, 'message': 'Publicación reactivada correctamente.'}), 200

    except Exception as e:
        print(f"Error en admin_reactivar_publicacion: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/publicaciones/<int:publicacion_id>/imagenes', methods=['POST'])
def subir_imagenes_publicacion(publicacion_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401
    user_id = session.get('user_id')
    if session.get('tipo_usuario') != 'prestador':
        return jsonify({'success': False, 'message': 'Solo prestadores pueden subir imágenes.'}), 403

    imagenes = request.files.getlist('imagenes')
    if not imagenes:
        imagen_unica = request.files.get('imagen')
        imagenes = [imagen_unica] if imagen_unica else []

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("SELECT id FROM Publicaciones WHERE id = ? AND UsuarioId = ?", (publicacion_id, user_id))
        if not cursor.fetchone():
            return jsonify({'success': False, 'message': 'La publicación no existe o no te pertenece.'}), 404
        version_id = obtener_ultima_version_id(cursor, publicacion_id)
        if not version_id:
            return jsonify({'success': False, 'message': 'La publicación aún no tiene una versión editable.'}), 400
        guardadas = guardar_imagenes_version(cursor, publicacion_id, version_id, user_id, imagenes)
        crear_alerta(cursor, 'publicacion_revision', 'Imágenes pendientes',
                     'Se agregaron imágenes para revisión administrativa.',
                     publicacion_id=publicacion_id, version_id=version_id, rol_destino='administrador')
        conn.commit()
        return jsonify({'success': True, 'message': 'Imágenes enviadas a revisión.', 'imagenes': guardadas}), 200
    except ValueError as e:
        if conn:
            conn.rollback()
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        print(f"Error en subir_imagenes_publicacion: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/publicaciones/<int:publicacion_id>/imagenes/<int:imagen_id>', methods=['DELETE', 'POST'])
def eliminar_imagen_publicacion(publicacion_id, imagen_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401
    user_id = session.get('user_id')
    if session.get('tipo_usuario') != 'prestador':
        return jsonify({'success': False, 'message': 'Solo prestadores pueden eliminar imágenes.'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("""
            SELECT img.id
            FROM PublicacionImagenes img
            INNER JOIN Publicaciones pub ON img.PublicacionId = pub.id
            WHERE img.id = ? AND img.PublicacionId = ? AND pub.UsuarioId = ?
        """, (imagen_id, publicacion_id, user_id))
        if not cursor.fetchone():
            return jsonify({'success': False, 'message': 'Imagen no encontrada o sin permisos.'}), 404
        cursor.execute("""
            UPDATE PublicacionImagenes
            SET EstadoRevision = 'eliminada', EliminadoEn = GETDATE()
            WHERE id = ?
        """, (imagen_id,))
        audit_event(cursor, 'imagen_eliminada', 'PublicacionImagenes', imagen_id,
                    f'Imagen marcada como eliminada por prestador.',
                    usuario_id=user_id, actor_id=user_id)
        conn.commit()
        return jsonify({'success': True, 'message': 'Imagen eliminada de la versión.'}), 200
    except Exception as e:
        print(f"Error en eliminar_imagen_publicacion: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/imagenes/<int:imagen_id>/aprobar', methods=['POST'])
def admin_aprobar_imagen(imagen_id):
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("SELECT PublicacionId, VersionId, UsuarioId, EstadoRevision FROM PublicacionImagenes WHERE id = ?", (imagen_id,))
        imagen = cursor.fetchone()
        if not imagen:
            return jsonify({'success': False, 'message': 'Imagen no encontrada.'}), 404
        cursor.execute("""
            UPDATE PublicacionImagenes
            SET EstadoRevision = 'aprobada', MotivoRechazo = NULL, RevisadoPor = ?, RevisadoEn = GETDATE()
            WHERE id = ?
        """, (session.get('user_id'), imagen_id))
        audit_event(cursor, 'imagen_aprobada', 'PublicacionImagenes', imagen_id,
                    'Imagen aprobada por administrador.', usuario_id=imagen[2], actor_id=session.get('user_id'))
        conn.commit()
        return jsonify({'success': True, 'message': 'Imagen aprobada.'}), 200
    except Exception as e:
        print(f"Error en admin_aprobar_imagen: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/imagenes/<int:imagen_id>/rechazar', methods=['POST'])
def admin_rechazar_imagen(imagen_id):
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized
    data = request.get_json(silent=True) or {}
    motivo = (data.get('motivo') or '').strip()
    if not motivo:
        return jsonify({'success': False, 'message': 'El motivo de rechazo de imagen es obligatorio.'}), 400
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("SELECT PublicacionId, VersionId, UsuarioId FROM PublicacionImagenes WHERE id = ?", (imagen_id,))
        imagen = cursor.fetchone()
        if not imagen:
            return jsonify({'success': False, 'message': 'Imagen no encontrada.'}), 404
        cursor.execute("""
            UPDATE PublicacionImagenes
            SET EstadoRevision = 'rechazada', MotivoRechazo = ?, RevisadoPor = ?, RevisadoEn = GETDATE()
            WHERE id = ?
        """, (motivo, session.get('user_id'), imagen_id))
        audit_event(cursor, 'imagen_rechazada', 'PublicacionImagenes', imagen_id,
                    motivo, usuario_id=imagen[2], actor_id=session.get('user_id'))
        crear_alerta(cursor, 'imagen_rechazada', 'Imagen rechazada',
                     motivo, publicacion_id=imagen[0], version_id=imagen[1], usuario_id=imagen[2])
        conn.commit()
        return jsonify({'success': True, 'message': 'Imagen rechazada.'}), 200
    except Exception as e:
        print(f"Error en admin_rechazar_imagen: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/quejas', methods=['POST'])
def crear_queja():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'Inicia sesión para enviar una queja.'}), 401

    data = request.get_json(silent=True) or {}
    motivo = (data.get('motivo') or '').strip()
    descripcion = (data.get('descripcion') or '').strip()
    solicitud_id = data.get('solicitud_id')
    publicacion_id = data.get('publicacion_id')

    if not motivo:
        return jsonify({'success': False, 'message': 'El motivo de la queja es obligatorio.'}), 400
    if not descripcion or len(descripcion) < 10:
        return jsonify({'success': False, 'message': 'Describe la queja con al menos 10 caracteres.'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("""
            INSERT INTO Quejas (UsuarioId, TipoUsuario, SolicitudServicioId, PublicacionId, Motivo, Descripcion)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (session.get('user_id'), session.get('tipo_usuario', 'cliente'), solicitud_id, publicacion_id, motivo, descripcion))
        cursor.execute("SELECT SCOPE_IDENTITY()")
        queja_id = int(cursor.fetchone()[0])
        audit_event(cursor, 'queja_creada', 'Quejas', queja_id, motivo,
                    usuario_id=session.get('user_id'), actor_id=session.get('user_id'))
        conn.commit()
        return jsonify({'success': True, 'message': 'Tu queja fue enviada al administrador para seguimiento.'}), 200

    except Exception as e:
        print(f"Error en crear_queja: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/quejas', methods=['GET'])
def admin_quejas():
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("""
            SELECT TOP 50 q.id, q.TipoUsuario, q.Motivo, q.Descripcion, q.Estado, q.CreadoEn,
                   q.RespuestaAdmin, q.SolicitudServicioId, q.PublicacionId,
                   u.Email, p.Nombre, p.ApellidoP, p.ApellidoM
            FROM Quejas q
            INNER JOIN Usuarios u ON q.UsuarioId = u.id
            LEFT JOIN Personas p ON u.id = p.UsuarioId
            ORDER BY CASE WHEN q.Estado = 'pendiente' THEN 0 ELSE 1 END, q.CreadoEn DESC
        """)
        quejas = [{
            'id': row[0],
            'tipo_usuario': row[1],
            'motivo': row[2],
            'descripcion': row[3],
            'estado': row[4],
            'creado_en': fmt_datetime(row[5]),
            'respuesta_admin': row[6] or '',
            'solicitud_id': row[7],
            'publicacion_id': row[8],
            'usuario_email': row[9],
            'usuario_nombre': f"{row[10] or ''} {row[11] or ''} {row[12] or ''}".strip() or row[9]
        } for row in cursor.fetchall()]
        return jsonify({'success': True, 'quejas': quejas}), 200

    except Exception as e:
        print(f"Error en admin_quejas: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/quejas/<int:queja_id>/resolver', methods=['POST'])
def admin_resolver_queja(queja_id):
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized

    data = request.get_json(silent=True) or {}
    respuesta = (data.get('respuesta') or '').strip()
    estado = (data.get('estado') or 'resuelta').strip().lower()
    if estado not in ('en_revision', 'resuelta'):
        return jsonify({'success': False, 'message': 'Estado de queja no válido.'}), 400
    if estado == 'resuelta' and not respuesta:
        return jsonify({'success': False, 'message': 'Agrega una respuesta antes de resolver la queja.'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("SELECT UsuarioId FROM Quejas WHERE id = ?", (queja_id,))
        queja = cursor.fetchone()
        if not queja:
            return jsonify({'success': False, 'message': 'Queja no encontrada.'}), 404
        cursor.execute("""
            UPDATE Quejas
            SET Estado = ?, RespuestaAdmin = ?, AtendidaPor = ?, ActualizadoEn = GETDATE()
            WHERE id = ?
        """, (estado, respuesta or None, session.get('user_id'), queja_id))
        audit_event(cursor, 'queja_actualizada', 'Quejas', queja_id, respuesta or estado,
                    usuario_id=queja[0], actor_id=session.get('user_id'))
        conn.commit()
        return jsonify({'success': True, 'message': 'Queja actualizada correctamente.'}), 200

    except Exception as e:
        print(f"Error en admin_resolver_queja: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/bitacora', methods=['GET'])
def admin_bitacora():
    unauthorized = require_admin_session()
    if unauthorized:
        return unauthorized

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        ensure_control_schema(cursor)
        cursor.execute("""
            SELECT TOP 60 b.id, b.TipoEvento, b.Entidad, b.EntidadId, b.Detalle, b.CreadoEn,
                   actor.Email, objetivo.Email
            FROM BitacoraAdmin b
            LEFT JOIN Usuarios actor ON b.ActorId = actor.id
            LEFT JOIN Usuarios objetivo ON b.UsuarioId = objetivo.id
            ORDER BY b.CreadoEn DESC
        """)
        eventos = [{
            'id': row[0],
            'tipo_evento': row[1],
            'entidad': row[2],
            'entidad_id': row[3],
            'detalle': row[4] or '',
            'creado_en': fmt_datetime(row[5]),
            'actor_email': row[6] or '',
            'usuario_email': row[7] or ''
        } for row in cursor.fetchall()]
        return jsonify({'success': True, 'eventos': eventos}), 200

    except Exception as e:
        print(f"Error en admin_bitacora: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


# ==================== CHATBOT ====================
def extraer_categoria_y_calificacion(mensaje):
    mensaje = mensaje.lower()
    categorias = {
        'plomero': 'plomeria',
        'electricista': 'electricidad',
        'carpintero': 'carpinteria',
        'jardinero': 'jardineria',
        'limpieza': 'limpieza',
        'reparaciones': 'reparacion-de-electrodomesticos',
        'tecnologia': 'tecnologia-y-soporte',
        'diseño': 'tecnologia-y-soporte',
        'educacion': 'clases-particulares',
        'bienestar': 'limpieza'
    }
    categoria = None
    for palabra, cat in categorias.items():
        if palabra in mensaje:
            categoria = cat
            break

    if any(p in mensaje for p in ['excelente', 'excelentes', 'mejor', 'recomendado']):
        calificacion_min = 4.5
        comentario_keyword = 'Excelente servicio'
    elif any(p in mensaje for p in ['buen', 'buena', 'bien', 'regular']):
        calificacion_min = 3.0
        comentario_keyword = 'Buen servicio'
    elif any(p in mensaje for p in ['aceptable', 'suficiente']):
        calificacion_min = 2.5
        comentario_keyword = 'Servicio aceptable'
    elif any(p in mensaje for p in ['mal', 'malo', 'pésimo', 'deficiente']):
        calificacion_min = 1.0
        comentario_keyword = 'Mal servicio'
    else:
        calificacion_min = 4.0
        comentario_keyword = None

    return categoria, calificacion_min, comentario_keyword

@app.route('/chatbot', methods=['POST'])
def chatbot_mensaje():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    if session.get('tipo_usuario') != 'cliente':
        return jsonify({'success': False, 'message': 'Solo clientes pueden usar el chatbot'}), 403

    data = request.get_json()
    mensaje = data.get('mensaje', '').strip()
    if not mensaje:
        return jsonify({'success': False, 'message': 'Mensaje vacío'}), 400

    categoria, calificacion_min, comentario_keyword = extraer_categoria_y_calificacion(mensaje)

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        sql = """
            SELECT
                u.id, p.Nombre, p.ApellidoP, p.ApellidoM,
                pr.RatingPromedio,
                (SELECT TOP 1 Comentario FROM Resenas WHERE EvaluadoId = u.id ORDER BY CreadoEn DESC) as ultimo_comentario
            FROM Prestadores pr
            INNER JOIN Usuarios u ON pr.UsuarioId = u.id
            INNER JOIN Personas p ON u.id = p.UsuarioId
            WHERE pr.RatingPromedio >= ?
        """
        params = [calificacion_min]

        if categoria:
            categoria = get_canonical_category_name(cursor, categoria) or categoria
            sql += " AND EXISTS (SELECT 1 FROM Publicaciones pub WHERE pub.UsuarioId = u.id AND pub.Categoria = ? AND pub.Activa = 1 AND pub.EstadoRevision = 'aprobada')"
            params.append(categoria)

        if comentario_keyword:
            sql += " AND EXISTS (SELECT 1 FROM Resenas r WHERE r.EvaluadoId = u.id AND r.Comentario LIKE ?)"
            params.append(f'%{comentario_keyword}%')

        sql += " ORDER BY pr.RatingPromedio DESC"

        cursor.execute(sql, params)
        rows = cursor.fetchall()

        if not rows:
            respuesta = f"Lo siento, no encontré prestadores de {categoria if categoria else 'servicios'} con {comentario_keyword if comentario_keyword else 'buena calificación'}. Intenta con otros criterios."
            return jsonify({'success': True, 'respuesta': respuesta, 'prestadores': []})

        prestadores_list = []
        for row in rows:
            nombre_completo = f"{row[1]} {row[2]} {row[3]}".strip()
            rating = float(row[4]) if row[4] else 0
            ultimo_comentario = row[5] if row[5] else ''
            prestadores_list.append({
                'id': row[0],
                'nombre': nombre_completo,
                'rating': rating,
                'ultimo_comentario': ultimo_comentario
            })

        texto = f"🔍 Encontré {len(prestadores_list)} prestador(es) con {comentario_keyword if comentario_keyword else 'buena calificación'}:\n\n"
        for i, p in enumerate(prestadores_list[:5], 1):
            texto += f"{i}. {p['nombre']} - ⭐ {p['rating']}\n   Comentario: {p['ultimo_comentario'][:80]}\n\n"
        if len(prestadores_list) > 5:
            texto += f"... y {len(prestadores_list)-5} más.\n"
        texto += "\n¿Quieres ver detalles de alguno? Escribe el número."

        return jsonify({'success': True, 'respuesta': texto, 'prestadores': prestadores_list})

    except Exception as e:
        print(f"Error en chatbot: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()

# ==================== OTRAS RUTAS ====================
@app.route('/logout')
def logout():
    session.clear()
    flash('Has cerrado sesión exitosamente.', 'info')
    return redirect('/')

@app.route('/terminos_y_condiciones')
def terminos_y_condiciones():
    return render_template('terminos_condiciones.html')

@app.route('/<path:filename>')
def mostrar_pagina_estatica(filename):
    template_name = filename.removeprefix('templates/')
    public_templates = {
        'consejos_entrevista.html',
        'contacto.html',
        'dashboard.html',
        'guia_cv.html',
        'index.html',
        'login.html',
        'politica_privacidad.html',
        'preguntas_frecuentes.html',
        'registro.html',
        'terminos_condiciones.html',
    }
    if template_name in public_templates:
        return render_template(template_name)

    allowed_ext = ('.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.html', '.json')
    if not any(filename.lower().endswith(ext) for ext in allowed_ext):
        abort(404)
    return send_from_directory(app.root_path, filename)

if __name__ == '__main__':
    app.run(debug=True)
