import multiprocessing
import os

bind = os.environ.get('GUNICORN_BIND', '0.0.0.0:5000')
workers = int(os.environ.get('GUNICORN_WORKERS', str(max(2, multiprocessing.cpu_count() // 2))))
threads = int(os.environ.get('GUNICORN_THREADS', '2'))
timeout = int(os.environ.get('GUNICORN_TIMEOUT', '60'))
graceful_timeout = int(os.environ.get('GUNICORN_GRACEFUL_TIMEOUT', '30'))
keepalive = int(os.environ.get('GUNICORN_KEEPALIVE', '5'))

accesslog = '-'
errorlog = '-'
loglevel = os.environ.get('GUNICORN_LOG_LEVEL', 'info')
