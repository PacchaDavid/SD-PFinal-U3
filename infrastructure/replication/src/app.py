import json
import logging
import time
import redis as redis_lib

from flask import Flask
from flask_cors import CORS

from src.config import Config
from src.db_manager import DatabaseManager
from src.replica_sync import ReplicaSync
from src.wal_manager import WALManager
from src.recovery_manager import RecoveryManager
from src.heartbeat_sender import HeartbeatSender
from src.models import ReplicationEvent

from src.api import health_bp, replication_bp
from src.api.health import init_health
from src.api.replication import init_replication

logger = logging.getLogger("replication.app")


class ReplicationApp:
    """Factory de la aplicación Replication Manager."""

    def __init__(self, config: Config | None = None):
        self.config = config or Config()
        self.startup_time = time.time()
        self._setup_logging()

        self.db: DatabaseManager | None = None
        self.sync: ReplicaSync | None = None
        self.wal: WALManager | None = None
        self.recovery: RecoveryManager | None = None
        self.heartbeat: HeartbeatSender | None = None
        self.redis_client: redis_lib.Redis | None = None
        self.flask_app: Flask | None = None

    def _setup_logging(self) -> None:
        level = getattr(logging, self.config.log_level.upper(), logging.INFO)
        logging.basicConfig(
            level=level,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    def create_app(self) -> Flask:
        app = Flask(__name__)
        CORS(app, resources={r"/*": {"origins": "*"}})

        self._init_redis()
        self._init_db()
        self._init_sync()
        self._init_wal()
        self._init_recovery()
        self._init_heartbeats()
        self._register_blueprints(app)
        self._init_api_deps()

        self.flask_app = app
        logger.info(
            "Replication Manager creado: %s (quorum=%d, poll=%dms)",
            self.config.service_name, self.config.quorum_min,
            self.config.poll_interval_ms,
        )
        return app

    def _init_redis(self) -> None:
        try:
            self.redis_client = redis_lib.Redis(
                host=self.config.redis_host, port=self.config.redis_port,
                decode_responses=True, socket_connect_timeout=3,
            )
            self.redis_client.ping()
            logger.info("Redis conectado %s:%s", self.config.redis_host, self.config.redis_port)
        except Exception as e:
            logger.warning("Redis no disponible: %s", e)
            self.redis_client = None

    def _init_db(self) -> None:
        self.db = DatabaseManager(self.config.primary, self.config.replicas)
        # Reintentar conexión por si MariaDB aún está inicializando
        max_retries = 12
        retry_delay = 5  # segundos
        for attempt in range(1, max_retries + 1):
            if self.db.connect_primary():
                logger.info(
                    "Primary DB conectada para %s (intento %d/%d)",
                    self.config.service_name, attempt, max_retries,
                )
                return
            if attempt < max_retries:
                logger.warning(
                    "Primary DB no disponible (intento %d/%d), reintentando en %ds...",
                    attempt, max_retries, retry_delay,
                )
                time.sleep(retry_delay)
        logger.warning(
            "Primary DB NO disponible tras %d intentos - modo limitado",
            max_retries,
        )

    def _init_sync(self) -> None:
        self.sync = ReplicaSync(
            db_manager=self.db,
            replica_timeout_ms=self.config.replica_timeout_ms,
            retry_attempts=self.config.retry_attempts,
            retry_delay_ms=self.config.retry_delay_ms,
            on_ack=self._on_ack,
        )

    def _init_wal(self) -> None:
        self.wal = WALManager(
            db_manager=self.db,
            replica_sync=self.sync,
            poll_interval_ms=self.config.poll_interval_ms,
            max_batch_size=self.config.max_batch_size,
            quorum_min=self.config.quorum_min,
            service_name=self.config.service_name,
            on_event=self._on_replication_event,
        )
        self.wal.start()

    def _init_recovery(self) -> None:
        self.recovery = RecoveryManager(
            db_manager=self.db,
            health_check_interval=self.config.health_check_interval,
            catch_up_batch_size=self.config.catch_up_batch_size,
            service_name=self.config.service_name,
        )
        self.recovery.start()

    def _init_heartbeats(self) -> None:
        _MACHINE_IDS = {"usuarios": 3, "recomendaciones": 4, "pagos": 5}
        machine_id = _MACHINE_IDS.get(self.config.service_name, 3)

        self.heartbeat = HeartbeatSender(
            event_monitor_url=self.config.event_monitor_url,
            service_name=self.config.service_name,
            get_stats_fn=lambda: self.wal.get_stats() if self.wal else None,
            machine_id=machine_id,
            interval_seconds=2,
        )
        self.heartbeat.start()

    def _register_blueprints(self, app: Flask) -> None:
        app.register_blueprint(health_bp)
        app.register_blueprint(replication_bp)

    def _init_api_deps(self) -> None:
        init_health(
            db_fn=lambda: self.db,
            stats_fn=lambda: self.wal.get_stats() if self.wal else None,
            startup_fn=lambda: self.startup_time,
        )
        init_replication(
            db_fn=lambda: self.db,
            wal_fn=lambda: self.wal,
            sync_fn=lambda: self.sync,
        )

    # ------------------------------------------------------------------
    # Event Handlers
    # ------------------------------------------------------------------

    def _on_ack(self, entry, ack) -> None:
        """Callback cuando se recibe un ACK de una réplica."""
        if self.redis_client:
            try:
                self.redis_client.publish(
                    self.config.redis_channel,
                    json.dumps({
                        "type": "replication.ack",
                        "entry_id": entry.id,
                        "replica_id": ack.replica_id,
                        "status": ack.status.value,
                        "response_time_ms": ack.response_time_ms,
                        "timestamp": time.time(),
                    }),
                )
            except Exception as e:
                logger.debug("Error publicando ACK en Redis: %s", e)

    def _on_replication_event(self, event: ReplicationEvent) -> None:
        """Callback cuando el WAL genera un evento de replicación."""
        logger.info("Evento replicación: %s | %s", event.type, event.message)

        if self.redis_client:
            try:
                self.redis_client.publish(
                    "events",
                    json.dumps(event.to_dict()),
                )
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Shutdown
    # ------------------------------------------------------------------

    def shutdown(self) -> None:
        logger.info("Deteniendo Replication Manager...")
        if self.wal: self.wal.stop()
        if self.recovery: self.recovery.stop()
        if self.heartbeat: self.heartbeat.stop()
        if self.db: self.db.close()
        if self.redis_client:
            try: self.redis_client.close()
            except Exception: pass
        logger.info("Replication Manager detenido")
