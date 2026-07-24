# =============================================================================
# Main Entry Point - Event Monitor
# =============================================================================
# Punto de entrada de la aplicación Event Monitor.
# Inicializa configuración, crea la app y arranca el servidor.
# =============================================================================
#
# Uso:
#   python -m src.main                    # Usar configuración por defecto
#   CONFIG_PATH=/path/to/config.yaml python -m src.main
#   PORT=9090 python -m src.main          # Sobrescribir puerto
#
# =============================================================================

import logging
import os
import signal
import sys

logger = logging.getLogger("event-monitor.main")


def main() -> None:
    """Punto de entrada principal del Event Monitor."""
    # Cargar configuración
    from src.config import Config
    config = Config()

    # Crear app
    from src.app import EventMonitorApp
    app = EventMonitorApp(config)
    flask_app = app.create_app()

    # Obtener host y puerto
    host = os.getenv("HOST", config.host)
    port = int(os.getenv("PORT", config.port))

    # Manejar señal de terminación
    def handle_signal(signum, frame):
        logger.info("Recibida señal %s, cerrando...", signum)
        app.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    logger.info("=" * 60)
    logger.info("Event Monitor iniciando en %s:%s", host, port)
    logger.info("Config: redis=%s:%s", config.redis_host, config.redis_port)
    logger.info("=" * 60)

    # Iniciar servidor con SocketIO
    app.socketio.run(
        flask_app,
        host=host,
        port=port,
        debug=False,
        use_reloader=False,
        log_output=False,
    )


if __name__ == "__main__":
    main()
