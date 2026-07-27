# =============================================================================
# Application Factory - Circuit Breaker Service
# =============================================================================
# Crea y configura la aplicación Flask con la máquina de estados,
# Redis Pub/Sub para notificaciones, heartbeats y APIs REST.
# =============================================================================

import json
import logging
import time

import redis as redis_lib
from flask import Flask
from flask_cors import CORS

from src.config import Config
from src.circuit import CircuitBreakerStateMachine, CircuitEventType
from src.monitor import CircuitBreakerMonitor
from src.heartbeat_sender import HeartbeatSender
from src.models import CircuitEvent

# API Blueprints
from src.api import health_bp, circuits_bp
from src.api.health import init_health
from src.api.circuits import init_circuits

logger = logging.getLogger("circuit-breaker.app")


class CircuitBreakerApp:
    """Factory de la aplicación Circuit Breaker.

    Orquesta todos los componentes:
    - CircuitBreakerStateMachine (core)
    - Redis Pub/Sub para publicar cambios
    - CircuitBreakerMonitor para verificación periódica
    - HeartbeatSender para comunicación con Event Monitor
    """

    def __init__(self, config: Config | None = None):
        self.config = config or Config()
        self.startup_time = time.time()
        self._setup_logging()

        # Componentes
        self.state_machine: CircuitBreakerStateMachine | None = None
        self.monitor: CircuitBreakerMonitor | None = None
        self.heartbeat_sender: HeartbeatSender | None = None
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
        """Crea y configura la aplicación Flask completa."""
        app = Flask(__name__)
        CORS(app, resources={r"/*": {"origins": "*"}})

        # Inicializar componentes
        self._init_redis()
        self._init_state_machine()
        self._init_monitor()
        self._init_heartbeats()
        self._register_blueprints(app)
        self._init_api_dependencies()

        self.flask_app = app
        logger.info(
            "Circuit Breaker creado (threshold=%d, open_timeout=%ds)",
            self.config.failure_threshold,
            self.config.open_timeout_seconds,
        )
        return app

    def _init_redis(self) -> None:
        """Inicializa conexión Redis (no crítica si falla)."""
        try:
            self.redis_client = redis_lib.Redis(
                host=self.config.redis_host,
                port=self.config.redis_port,
                decode_responses=True,
                socket_connect_timeout=3,
            )
            self.redis_client.ping()
            logger.info(
                "Redis conectado en %s:%s",
                self.config.redis_host, self.config.redis_port,
            )
        except Exception as e:
            logger.warning("Redis no disponible: %s", e)
            self.redis_client = None

    def _init_state_machine(self) -> None:
        """Inicializa la máquina de estados del Circuit Breaker."""
        self.state_machine = CircuitBreakerStateMachine(
            failure_threshold=self.config.failure_threshold,
            success_threshold=self.config.success_threshold,
            open_timeout_seconds=self.config.open_timeout_seconds,
            half_open_max_requests=self.config.half_open_max_requests,
            sliding_window_size=self.config.sliding_window_size,
            on_state_change=self._on_state_change,
        )
        logger.info("State machine inicializada")

    def _init_monitor(self) -> None:
        """Inicializa el monitor periódico."""
        self.monitor = CircuitBreakerMonitor(
            state_machine=self.state_machine,
            check_interval=self.config.check_interval,
        )
        self.monitor.start()

    def _init_heartbeats(self) -> None:
        """Inicializa el envío de heartbeats vía Redis Pub/Sub."""
        self.heartbeat_sender = HeartbeatSender(
            state_machine=self.state_machine,
            machine_id=2,
            interval_seconds=2,
            redis_client=self.redis_client,
        )
        self.heartbeat_sender.start()

    def _register_blueprints(self, app: Flask) -> None:
        """Registra blueprints de la API."""
        app.register_blueprint(health_bp)
        app.register_blueprint(circuits_bp)

    def _init_api_dependencies(self) -> None:
        """Inyecta dependencias en los blueprints."""
        init_health(
            stats_fn=lambda: self.state_machine.get_stats() if self.state_machine else {},
            startup_fn=lambda: self.startup_time,
        )
        init_circuits(
            sm_fn=lambda: self.state_machine,
        )

    # ------------------------------------------------------------------
    # Manejador de cambios de estado
    # ------------------------------------------------------------------

    def _on_state_change(self, event: CircuitEvent) -> None:
        """Callback cuando un circuit breaker cambia de estado.

        Publica el evento en Redis Pub/Sub para que el Event Monitor
        lo recoja y lo transmita al panel de administración.
        """
        logger.info(
            "Cambio de estado: %s → %s (%s)",
            event.old_state, event.new_state, event.service,
        )

        if not self.redis_client:
            return

        try:
            payload = event.to_dict()
            self.redis_client.publish(
                self.config.redis_channel,
                json.dumps(payload),
            )
            logger.debug("Evento publicado en Redis: %s", event.type)
        except Exception as e:
            logger.error("Error publicando evento en Redis: %s", e)

    # ------------------------------------------------------------------
    # Shutdown
    # ------------------------------------------------------------------

    def shutdown(self) -> None:
        """Detiene todos los servicios gracefulmente."""
        logger.info("Deteniendo Circuit Breaker...")
        if self.monitor:
            self.monitor.stop()
        if self.heartbeat_sender:
            self.heartbeat_sender.stop()
        if self.redis_client:
            try:
                self.redis_client.close()
            except Exception:
                pass
        logger.info("Circuit Breaker detenido")
