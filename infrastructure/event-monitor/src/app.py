# =============================================================================
# Application Factory - Event Monitor
# =============================================================================
# Crea y configura la aplicación Flask con SocketIO, Redis,
# HeartbeatMonitor, NodeRegistry y las APIs REST.
# =============================================================================

import logging
import time
from threading import Thread

from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO

from src.config import Config
from src.models import SystemEvent, EventType
from src.redis_client import RedisClient
from src.heartbeat_monitor import HeartbeatMonitor
from src.node_registry import NodeRegistry
from src.websocket_handler import WebSocketHandler

# API Blueprints
from src.api import health_bp, nodes_bp, events_bp, metrics_bp, status_bp
from src.api.health import init_health
from src.api.nodes import init_nodes
from src.api.events import init_events
from src.api.metrics import init_metrics
from src.api.status import init_status

logger = logging.getLogger("event-monitor.app")


class EventMonitorApp:
    """Factory de la aplicación Event Monitor.

    Orquesta todos los componentes del sistema:
    - Flask + SocketIO para APIs y WebSocket
    - RedisClient para bus de eventos
    - HeartbeatMonitor para detección de fallos
    - NodeRegistry para registro de nodos
    - WebSocketHandler para broadcasting en tiempo real
    """

    def __init__(self, config: Config | None = None):
        self.config = config or Config()
        self.startup_time = time.time()

        # Almacén de eventos en memoria
        self._events: list[SystemEvent] = []

        # Estado de circuit breakers (compartido con API)
        self._circuits: dict[str, dict] = {}

        # Componentes
        self.redis_client: RedisClient | None = None
        self.heartbeat_monitor: HeartbeatMonitor | None = None
        self.node_registry: NodeRegistry | None = None
        self.ws_handler: WebSocketHandler | None = None
        self.flask_app: Flask | None = None
        self.socketio: SocketIO | None = None

        # Configurar logging
        self._setup_logging()

    def _setup_logging(self) -> None:
        level = getattr(logging, self.config.log_level.upper(), logging.INFO)
        logging.basicConfig(
            level=level,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    # ------------------------------------------------------------------
    # Creación de la aplicación
    # ------------------------------------------------------------------

    def create_app(self) -> Flask:
        """Crea y configura la aplicación Flask completa."""
        app = Flask(__name__)
        app.config["SECRET_KEY"] = "event-monitor-secret-key-change-in-production"

        # CORS
        CORS(app, resources={r"/*": {"origins": "*"}})

        # SocketIO
        self.socketio = SocketIO(
            app,
            cors_allowed_origins="*",
            async_mode="eventlet",
            ping_timeout=10,
            ping_interval=25,
            max_http_buffer_size=10_000_000,
        )

        # Inicializar componentes
        self._init_redis()
        self._init_services()
        self._init_ws_handler()
        self._register_blueprints(app)
        self._init_api_dependencies()

        # Iniciar heartbeat monitor
        self._start_heartbeat_monitor()

        # Registrar shutdown
        self._register_shutdown(app)

        self.flask_app = app
        logger.info("Event Monitor app creada exitosamente")
        return app

    def _init_redis(self) -> None:
        """Inicializa el cliente Redis."""
        self.redis_client = RedisClient(
            host=self.config.redis_host,
            port=self.config.redis_port,
            channels=self.config.redis_channels,
        )

        if self.redis_client.connect():
            # Iniciar listener Pub/Sub para eventos entrantes
            self.redis_client.subscribe(
                self.config.redis_channels.get("heartbeats", "heartbeats"),
                self._on_heartbeat_message,
            )
            self.redis_client.subscribe(
                self.config.redis_channels.get("events", "events"),
                self._on_event_message,
            )
            self.redis_client.subscribe(
                self.config.redis_channels.get("metrics", "metrics"),
                self._on_metrics_message,
            )
            self.redis_client.subscribe(
                self.config.redis_channels.get("circuit_breaker", "circuit-breaker"),
                self._on_circuit_message,
            )
            self.redis_client.start_listener()
            logger.info("Redis conectado y listener Pub/Sub activo")
        else:
            logger.warning("Redis no disponible - modo degradado")

    def _init_services(self) -> None:
        """Inicializa HeartbeatMonitor y NodeRegistry."""
        # HeartbeatMonitor
        self.heartbeat_monitor = HeartbeatMonitor(
            check_interval=self.config.heartbeat_interval,
            timeout_seconds=self.config.heartbeat_timeout,
            max_missed=self.config.heartbeat_max_missed,
            on_node_status_change=self._on_node_status_change,
            on_event=self._on_internal_event,
        )

        # NodeRegistry
        self.node_registry = NodeRegistry(
            redis=self.redis_client,
            auto_remove_minutes=self.config.auto_remove_minutes,
            on_node_status_change=self._on_node_status_change,
            on_event=self._on_internal_event,
        )

    def _init_ws_handler(self) -> None:
        """Inicializa el WebSocket handler."""
        self.ws_handler = WebSocketHandler()
        if self.socketio:
            self.ws_handler.init_app(self.socketio)

    def _register_blueprints(self, app: Flask) -> None:
        """Registra los blueprints de la API."""
        app.register_blueprint(health_bp)
        app.register_blueprint(nodes_bp)
        app.register_blueprint(events_bp)
        app.register_blueprint(metrics_bp)
        app.register_blueprint(status_bp)

    def _init_api_dependencies(self) -> None:
        """Inyecta dependencias en los blueprints de la API."""
        init_health(
            redis_fn=lambda: self.redis_client,
            startup_time_fn=lambda: self.startup_time,
        )
        init_nodes(
            registry_fn=lambda: self.node_registry,
            hb_monitor_fn=lambda: self.heartbeat_monitor,
            registered_cb=self._on_node_registered,
        )
        init_events(events_fn=lambda: self._events)
        init_metrics(
            hb_fn=lambda: self.heartbeat_monitor,
            registry_fn=lambda: self.node_registry,
            events_fn=lambda: self._events,
            circuits_fn=lambda: self._circuits,
        )
        init_status(
            hb_fn=lambda: self.heartbeat_monitor,
            registry_fn=lambda: self.node_registry,
            events_fn=lambda: self._events,
            circuits_fn=lambda: self._circuits,
            redis_fn=lambda: self.redis_client,
            startup_fn=lambda: self.startup_time,
        )

    # ------------------------------------------------------------------
    # Inicio del Heartbeat Monitor
    # ------------------------------------------------------------------

    def _start_heartbeat_monitor(self) -> None:
        if self.heartbeat_monitor:
            self.heartbeat_monitor.start()
            # Emitir evento de startup
            self._on_internal_event(SystemEvent(
                type=EventType.SYSTEM_STARTUP.value,
                source="event-monitor",
                message="Event Monitor iniciado correctamente",
                metadata={
                    "redis_connected": self.redis_client.is_connected() if self.redis_client else False,
                    "config": self.config.raw,
                },
            ))

    # ------------------------------------------------------------------
    # Manejadores de eventos
    # ------------------------------------------------------------------

    def _on_internal_event(self, event: SystemEvent) -> None:
        """Procesa un evento interno del sistema."""
        # Almacenar en memoria
        self._events.append(event)
        if len(self._events) > self.config.max_events:
            self._events = self._events[-self.config.max_events:]

        # Publicar en Redis
        if self.redis_client:
            self.redis_client.publish_event(event.to_dict())

        # Transmitir por WebSocket
        if self.ws_handler:
            self.ws_handler.broadcast_event(event)

    def _on_heartbeat_message(self, data: dict) -> None:
        """Procesa un heartbeat recibido de Redis Pub/Sub."""
        if self.heartbeat_monitor:
            node = self.heartbeat_monitor.process_heartbeat(data)
            if node and self.ws_handler:
                self.ws_handler.broadcast_heartbeat(node.to_dict())

    def _on_event_message(self, data: dict) -> None:
        """Procesa un evento recibido de Redis Pub/Sub."""
        event = SystemEvent(
            id=data.get("id", ""),
            type=data.get("type", ""),
            source=data.get("source", ""),
            node_id=data.get("node_id", ""),
            message=data.get("message", ""),
            severity=data.get("severity", "info"),
            timestamp=data.get("timestamp", time.time()),
            metadata=data.get("metadata", {}),
        )
        self._events.append(event)
        if len(self._events) > self.config.max_events:
            self._events = self._events[-self.config.max_events:]

        if self.ws_handler:
            self.ws_handler.broadcast_event(event)

    def _on_metrics_message(self, data: dict) -> None:
        """Procesa métricas recibidas de Redis Pub/Sub."""
        if self.ws_handler:
            self.ws_handler.broadcast_metrics(data)

    def _on_circuit_message(self, data: dict) -> None:
        """Procesa cambios de circuit breaker recibidos de Redis."""
        circuit_id = data.get("circuit_id", data.get("service", "unknown"))
        self._circuits[circuit_id] = {
            **data,
            "last_updated": time.time(),
        }
        if self.ws_handler:
            self.ws_handler.broadcast_circuit_change(data)

    def _on_node_status_change(self, node_id: str, old_status, new_status) -> None:
        """Callback cuando un nodo cambia de estado."""
        if self.node_registry:
            self.node_registry.update_node_status(node_id, new_status)

        if self.ws_handler:
            self.ws_handler.broadcast_node_status({
                "node_id": node_id,
                "old_status": old_status.value if hasattr(old_status, "value") else str(old_status),
                "new_status": new_status.value if hasattr(new_status, "value") else str(new_status),
                "timestamp": time.time(),
            })

    def _on_node_registered(self, node) -> None:
        """Callback cuando un nodo es registrado vía API."""
        if self.ws_handler:
            self.ws_handler.broadcast_node_status({
                "node_id": node.node_id,
                "node_name": node.node_name,
                "status": "registered",
                "timestamp": time.time(),
            })

    # ------------------------------------------------------------------
    # Shutdown
    # ------------------------------------------------------------------

    def _register_shutdown(self, app: Flask) -> None:
        @app.teardown_appcontext
        def shutdown(_=None):
            pass

    def shutdown(self) -> None:
        """Detiene todos los servicios gracefulmente."""
        logger.info("Deteniendo Event Monitor...")
        if self.heartbeat_monitor:
            self.heartbeat_monitor.stop()
        if self.redis_client:
            self.redis_client.disconnect()

        self._on_internal_event(SystemEvent(
            type=EventType.SYSTEM_SHUTDOWN.value,
            source="event-monitor",
            message="Event Monitor detenido",
        ))
        logger.info("Event Monitor detenido")
