import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone

from flask import Response, g, request
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest


INSTANCE_ID = os.environ.get('INSTANCE_ID', os.environ.get('HOSTNAME', 'local'))
APP_VERSION = os.environ.get('APP_VERSION', 'dev')
REQUEST_ID_PATTERN = re.compile(r'^[A-Za-z0-9._:-]{1,80}$')
SENSITIVE_KEYS = {
    'authorization',
    'access_token',
    'refresh_token',
    'token',
    'jwt',
    'password',
    'contrasena',
    'contraseña',
    'confirm_password',
    'confirmpassword',
    'cookie',
    'set-cookie',
    'secret',
    'db_password',
    'email_password',
    'flask_secret_key',
    'jwt_secret_key',
    'data_encryption_key',
}

HTTP_REQUESTS = Counter(
    'jobnest_http_requests_total',
    'Total de solicitudes HTTP procesadas por Flask.',
    ['method', 'route', 'status', 'instance'],
)
HTTP_DURATION = Histogram(
    'jobnest_http_request_duration_seconds',
    'Duracion de solicitudes HTTP en segundos.',
    ['method', 'route', 'instance'],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)
HTTP_ERRORS = Counter(
    'jobnest_http_errors_total',
    'Total de respuestas HTTP 4xx y 5xx.',
    ['family', 'route', 'instance'],
)
AUTH_EVENTS = Counter(
    'jobnest_auth_events_total',
    'Eventos de autenticacion sin datos personales.',
    ['event', 'result', 'channel', 'instance'],
)
BUSINESS_EVENTS = Counter(
    'jobnest_business_events_total',
    'Eventos basicos de negocio sin datos personales.',
    ['event', 'channel', 'instance'],
)
PASSWORD_RESET_EVENTS = Counter(
    'jobnest_password_reset_events_total',
    'Eventos de recuperacion de contraseña sin datos personales.',
    ['result', 'channel', 'instance'],
)
SQL_AVAILABLE = Gauge(
    'jobnest_sqlserver_available',
    'Disponibilidad de SQL Server reportada por /health/ready.',
    ['instance'],
)
APP_INFO = Gauge(
    'jobnest_app_info',
    'Informacion de instancia de JobNest API.',
    ['instance', 'version'],
)
APP_INFO.labels(instance=INSTANCE_ID, version=APP_VERSION).set(1)


class JsonFormatter(logging.Formatter):
    def format(self, record):
        payload = {
            'timestamp': datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'instance': INSTANCE_ID,
        }
        for key in (
            'request_id',
            'method',
            'path',
            'route',
            'status',
            'duration_ms',
            'client_ip',
            'user_id',
            'role',
            'event',
            'sqlstate',
        ):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            payload['exception'] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


class TextFormatter(logging.Formatter):
    def format(self, record):
        request_id = getattr(record, 'request_id', '-')
        instance = getattr(record, 'instance', INSTANCE_ID)
        return f'{self.formatTime(record)} {record.levelname} {record.name} instance={instance} request_id={request_id} {record.getMessage()}'


def configure_logging():
    level_name = os.environ.get('LOG_LEVEL', 'INFO').upper()
    level = getattr(logging, level_name, logging.INFO)
    formatter = JsonFormatter() if os.environ.get('LOG_FORMAT', 'text').lower() == 'json' else TextFormatter()

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)
    root_logger.setLevel(level)
    logging.getLogger('werkzeug').setLevel(level)
    return logging.getLogger('jobnest')


def sanitize_value(key, value):
    normalized = str(key).lower().replace('-', '_')
    if normalized in SENSITIVE_KEYS or any(secret in normalized for secret in ('password', 'token', 'secret', 'cookie', 'authorization')):
        return '[REDACTED]'
    if isinstance(value, dict):
        return sanitize_dict(value)
    if isinstance(value, (list, tuple)):
        return [sanitize_value(key, item) for item in value]
    if isinstance(value, str) and len(value) > 300:
        return f'{value[:300]}...[TRUNCATED]'
    return value


def sanitize_dict(data):
    if not isinstance(data, dict):
        return data
    return {key: sanitize_value(key, value) for key, value in data.items()}


def mask_email(email):
    if not email or '@' not in email:
        return None
    local, domain = email.split('@', 1)
    if len(local) <= 2:
        masked_local = f'{local[:1]}***'
    else:
        masked_local = f'{local[:2]}***'
    return f'{masked_local}@{domain}'


def get_request_id():
    incoming_id = request.headers.get('X-Request-ID', '').strip()
    if incoming_id and REQUEST_ID_PATTERN.match(incoming_id):
        return incoming_id
    return str(uuid.uuid4())


def normalized_route():
    if request.url_rule and request.url_rule.rule:
        return request.url_rule.rule
    return request.path or 'unknown'


def client_ip():
    forwarded_for = request.headers.get('X-Forwarded-For', '')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.headers.get('X-Real-IP') or request.remote_addr or ''


def request_context_extra(status=None, duration_ms=None):
    return {
        'request_id': getattr(g, 'request_id', None),
        'method': request.method if request else None,
        'path': request.path if request else None,
        'route': normalized_route() if request else None,
        'status': status,
        'duration_ms': duration_ms,
        'client_ip': client_ip() if request else None,
        'user_id': getattr(g, 'safe_user_id', None),
        'role': getattr(g, 'safe_user_role', None),
    }


def start_request_observability():
    g.request_started_at = time.perf_counter()
    g.request_id = get_request_id()


def finish_request_observability(response):
    duration = time.perf_counter() - getattr(g, 'request_started_at', time.perf_counter())
    duration_ms = round(duration * 1000, 2)
    route = normalized_route()
    status = str(response.status_code)

    HTTP_REQUESTS.labels(request.method, route, status, INSTANCE_ID).inc()
    HTTP_DURATION.labels(request.method, route, INSTANCE_ID).observe(duration)
    if response.status_code >= 400:
        family = '5xx' if response.status_code >= 500 else '4xx'
        HTTP_ERRORS.labels(family, route, INSTANCE_ID).inc()

    response.headers['X-Request-ID'] = getattr(g, 'request_id', '')
    response.headers['X-JobNest-Instance'] = INSTANCE_ID

    if request.path != '/metrics':
        logging.getLogger('jobnest.http').info(
            'http_request',
            extra=request_context_extra(status=response.status_code, duration_ms=duration_ms),
        )
    return response


def metrics_response():
    return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)


def record_auth_event(event, result, channel):
    AUTH_EVENTS.labels(event=event, result=result, channel=channel, instance=INSTANCE_ID).inc()
    logging.getLogger('jobnest.security').info(
        'auth_event',
        extra={**request_context_extra(), 'event': f'{channel}.{event}.{result}'},
    )


def record_security_warning(event, **extra):
    logging.getLogger('jobnest.security').warning(
        event,
        extra={**request_context_extra(), 'event': event, **sanitize_dict(extra)},
    )


def record_business_event(event, channel):
    BUSINESS_EVENTS.labels(event=event, channel=channel, instance=INSTANCE_ID).inc()
    logging.getLogger('jobnest.business').info(
        'business_event',
        extra={**request_context_extra(), 'event': f'{channel}.{event}'},
    )


def record_password_reset_event(result, channel):
    PASSWORD_RESET_EVENTS.labels(result=result, channel=channel, instance=INSTANCE_ID).inc()
    logging.getLogger('jobnest.security').info(
        'password_reset_event',
        extra={**request_context_extra(), 'event': f'password_reset.{channel}.{result}'},
    )


def set_sql_availability(available):
    SQL_AVAILABLE.labels(instance=INSTANCE_ID).set(1 if available else 0)


def log_exception(logger, message, **extra):
    logger.exception(message, extra={**request_context_extra(), **sanitize_dict(extra)})
