# =============================================================================
# Main Entry Point - Circuit Breaker
# =============================================================================
# Punto de entrada del servicio Circuit Breaker.
# Inicializa configuración, crea la app y arranca el servidor.
# =============================================================================
#
# Uso:
#   python -m src.main                       # Usar configuración por defecto
#   CONFIG_PATH=/path/to/config.yaml python -m src.main
#   PORT=9090 python -m src.main             # Sobrescribir puerto
#
# =============================================================================

import logging
import os
import signal
import sys

logger = logging.getLogger("circuit-breaker.main")


def main() -> None:
    """Punto de entrada principal del Circuit Breaker."""
    from src.config import Config
    config = Config()

    from src.app import CircuitBreakerApp
    app = CircuitBreakerApp(config)
    flask_app = app.create_app()

    host = os.getenv("HOST", config.host)
    port = int(os.getenv("PORT", config.port))

    def handle_signal(signum, frame):
        logger.info("Recibida señal %s, cerrando...", signum)
        app.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    logger.info("=" * 60)
    logger.info("Circuit Breaker iniciando en %s:%s", host, port)
    logger.info("Failure threshold: %d", config.failure_threshold)
    logger.info("Success threshold: %d", config.success_threshold)
    logger.info("Open timeout: %ds", config.open_timeout_seconds)
    logger.info("Event Monitor: %s", config.event_monitor_url)
    logger.info("=" * 60)

    app.flask_app.run(
        host=host,
        port=port,
        debug=False,
        use_reloader=False,
    )


if __name__ == "__main__":
    main()
