import os

import pyodbc

def test_connection_mac():
    DB_CONFIG = {
        'driver': os.environ.get('DB_DRIVER', '{ODBC Driver 18 for SQL Server}'),
        'server': os.environ.get('DB_SERVER', 'localhost,1433'),
        'database': os.environ.get('DB_NAME', 'JobNest'),
        'user': os.environ.get('DB_USER'),
        'password': os.environ.get('DB_PASSWORD'),
        'trust_server_certificate': os.environ.get(
            'DB_TRUST_SERVER_CERTIFICATE',
            'yes',
        ),
    }

    missing = [
        variable
        for variable, value in {
            'DB_USER': DB_CONFIG['user'],
            'DB_PASSWORD': DB_CONFIG['password'],
        }.items()
        if not value
    ]
    if missing:
        print(f"Faltan variables de entorno: {', '.join(missing)}")
        return False

    try:
        connection_string = (
            f"DRIVER={DB_CONFIG['driver']};"
            f"SERVER={DB_CONFIG['server']};"
            f"DATABASE={DB_CONFIG['database']};"
            f"UID={DB_CONFIG['user']};"
            f"PWD={DB_CONFIG['password']};"
            f"TrustServerCertificate={DB_CONFIG['trust_server_certificate']};"
        )

        conn = pyodbc.connect(connection_string)
        cursor = conn.cursor()

        print("✓ Conexión establecida exitosamente!")

        # Probar consultas
        cursor.execute("SELECT name FROM sys.databases")
        databases = cursor.fetchall()
        print("✓ Bases de datos disponibles:")
        for db in databases:
            print(f"  - {db[0]}")

        cursor.execute("SELECT COUNT(*) FROM Usuarios")
        user_count = cursor.fetchone()[0]
        print(f"✓ Total de usuarios en JobNest: {user_count}")

        conn.close()
        return True

    except pyodbc.Error as e:
        print(f"✗ Error de pyodbc: {e}")
        return False
    except Exception as e:
        print(f"✗ Error general: {e}")
        return False

if __name__ == "__main__":
    test_connection_mac()
