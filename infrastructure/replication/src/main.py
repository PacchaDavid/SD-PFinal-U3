import logging
import os
import signal
import sys

logger = logging.getLogger("replication.main")


def main() -> None:
    from src.config import Config
    config = Config()

    from src.app import ReplicationApp
    app = ReplicationApp(config)
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
    logger.info("Replication Manager iniciando en %s:%s", host, port)
    logger.info("Servicio: %s", config.service_name)
    logger.info("Primary DB: %s:%s/%s", config.primary["host"],
                config.primary["port"], config.primary["database"])
    logger.info("Réplicas: %d", len(config.replicas))
    logger.info("Quorum mínimo: %d", config.quorum_min)
    logger.info("=" * 60)

    app.flask_app.run(
        host=host, port=port,
        debug=False, use_reloader=False,
    )


if __name__ == "__main__":
    main()
