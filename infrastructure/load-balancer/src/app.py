# =============================================================================
# Application Factory - Load Balancer
# =============================================================================
# Crea y configura la aplicación Flask con proxy inverso, health checks,
# service registry, estrategia de balanceo y heartbeats.
# =============================================================================

import json
import logging
import time

import redis as redis_lib
from flask import Flask, request, Response
from flask_cors import CORS

from src.config import Config
from src.service_registry import ServiceRegistry
from src.health_checker import HealthChecker
from src.strategies import StrategyFactory, BalanceStrategy
from src.proxy import ProxyHandler
from src.heartbeat_sender import HeartbeatSender

# API Blueprints
from src.api import health_bp, stats_bp
from src.api.health import init_health
from src.api.stats import init_stats

logger = logging.getLogger("load-balancer.app")

# Mapeo de rutas a servicios
# Las rutas /api/<servicio>/... se mapean al servicio correspondiente
SERVICE_ROUTE_MAP = {
    "usuarios": "usuarios",
    "pagos": "pagos",
    "recomendaciones": "recomendaciones",
}


class LoadBalancerApp:
    """Factory de la aplicación Load Balancer.

    Orquesta todos los componentes:
    - ProxyHandler para forward de requests
    - ServiceRegistry para tracking de backends
    - HealthChecker para monitoreo periódico
    - HeartbeatSender para comunicación con Event Monitor
    """

    def __init__(self, config: Config | None = None):
        self.config = config or Config()
        self.startup_time = time.time()
        self._setup_logging()

        # Componentes
        self.registry: ServiceRegistry | None = None
        self.health_checker: HealthChecker | None = None
        self.strategy: BalanceStrategy | None = None
        self.proxy: ProxyHandler | None = None
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
        self._init_services()
        self._init_proxy()
        self._init_redis()
        self._init_health_checks()
        self._init_heartbeats()
        self._register_blueprints(app)
        self._register_routes(app)
        self._init_api_dependencies()

        self.flask_app = app
        logger.info(
            "Load Balancer creado (estrategia=%s, %d servicios)",
            self.config.balancing_strategy,
            len(self.config.services),
        )
        return app

    def _init_services(self) -> None:
        """Inicializa ServiceRegistry y estrategia de balanceo."""
        self.registry = ServiceRegistry(
            services_config=self.config.services,
            unhealthy_threshold=self.config.unhealthy_threshold,
            on_event=self._on_event,
        )
        self.strategy = StrategyFactory.create(self.config.balancing_strategy)

    def _init_proxy(self) -> None:
        """Inicializa el ProxyHandler."""
        self.proxy = ProxyHandler(
            registry=self.registry,
            strategy=self.strategy,
            default_timeout_ms=5000,
            circuit_breaker_url=self.config.circuit_breaker_url,
            circuit_breaker_timeout=self.config.circuit_breaker_timeout,
            on_event=self._on_event,
        )

    def _init_health_checks(self) -> None:
        """Inicializa health checks periódicos."""
        self.health_checker = HealthChecker(
            registry=self.registry,
            check_interval=self.config.health_check_interval,
            timeout=3,
            on_health_change=self._on_health_change,
        )
        self.health_checker.start()

    def _init_redis(self) -> None:
        """Inicializa conexión Redis (no crítica si falla)."""
        if self.config.redis_enabled:
            try:
                self.redis_client = redis_lib.Redis(
                    host=self.config.redis_host,
                    port=self.config.redis_port,
                    decode_responses=True,
                    socket_connect_timeout=3,
                )
                self.redis_client.ping()
                logger.info("Redis conectado en %s:%s", self.config.redis_host, self.config.redis_port)
            except Exception as e:
                logger.warning("Redis no disponible: %s", e)
                self.redis_client = None

    def _init_heartbeats(self) -> None:
        """Inicializa el envío de heartbeats vía Redis Pub/Sub."""
        self.heartbeat_sender = HeartbeatSender(
            machine_id=2,
            interval_seconds=2,
            get_stats_fn=lambda: self.registry.get_stats().to_dict(),
            redis_client=self.redis_client,
        )
        self.heartbeat_sender.start()

    def _register_blueprints(self, app: Flask) -> None:
        """Registra blueprints de la API."""
        app.register_blueprint(health_bp)
        app.register_blueprint(stats_bp)

    def _register_routes(self, app: Flask) -> None:
        """Registra las rutas de proxy dinámicas.

        Captura todas las rutas /api/<servicio>/<path:rest>
        y las reenvía al backend correspondiente.
        """
        @app.route("/api/<service_name>/<path:rest>", methods=[
            "GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS",
        ])
        def proxy_service(service_name: str, rest: str):
            # Reenviar solo el path real del backend, sin el prefijo de ruteo
            # Ej: /api/usuarios/api/auth/login → rest=api/auth/login → /api/auth/login
            return self._handle_proxy(service_name, f"/{rest}")

        @app.route("/api/<service_name>", methods=[
            "GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS",
        ])
        def proxy_service_root(service_name: str):
            return self._handle_proxy(service_name, "/")

        # Ruta por defecto (root y rutas no reconocidas)
        @app.route("/")
        def root():
            return jsonify({
                "service": "load-balancer",
                "version": "1.0.0",
                "status": "running",
                "endpoints": {
                    "health": "/health",
                    "services": "/health/services",
                    "stats": "/stats",
                },
            })

    def _handle_proxy(self, service_name: str, path: str) -> tuple[Response, int]:
        """Maneja una request de proxy a un servicio backend.

        Valida el servicio, y delega al ProxyHandler.
        """
        # Responder inmediatamente a preflight OPTIONS (CORS)
        # Si el backend no responde, el preflight fallaría con 503
        if request.method == "OPTIONS":
            return Response('{"status":"ok"}', 200, content_type='application/json')

        # Validar que el servicio exista
        mapped = SERVICE_ROUTE_MAP.get(service_name)
        if not mapped:
            logger.warning("Servicio no encontrado: %s", service_name)
            return jsonify({
                "error": f"Servicio '{service_name}' no encontrado",
                "available": list(SERVICE_ROUTE_MAP.keys()),
            }), 404

        # Verificar si el servicio tiene instancias
        instances = self.registry.get_instances(mapped)
        if not instances:
            return jsonify({
                "error": f"Servicio '{service_name}' no tiene instancias registradas",
            }), 503

        return self.proxy.forward(request, mapped, path)

    def _init_api_dependencies(self) -> None:
        """Inyecta dependencias en los blueprints."""
        init_health(
            registry_fn=lambda: self.registry,
            startup_fn=lambda: self.startup_time,
        )
        init_stats(
            registry_fn=lambda: self.registry,
            hb_sender_fn=lambda: self.heartbeat_sender,
        )

    # ------------------------------------------------------------------
    # Manejadores de eventos
    # ------------------------------------------------------------------

    def _on_event(self, event: dict) -> None:
        """Maneja eventos internos del Load Balancer."""
        logger.info(
            "Evento: %s | servicio=%s | severidad=%s",
            event.get("type", "?"),
            event.get("service", "?"),
            event.get("severity", "info"),
        )

    def _on_health_change(self, service_name: str, instance_id: str, is_healthy: bool) -> None:
        """Callback cuando cambia la salud de un servicio."""
        status = "healthy" if is_healthy else "unhealthy"
        logger.info(
            "Cambio de salud: %s/%s → %s",
            service_name, instance_id, status,
        )

    # ------------------------------------------------------------------
    # Shutdown
    # ------------------------------------------------------------------

    def shutdown(self) -> None:
        """Detiene todos los servicios gracefulmente."""
        logger.info("Deteniendo Load Balancer...")
        if self.health_checker:
            self.health_checker.stop()
        if self.heartbeat_sender:
            self.heartbeat_sender.stop()
        logger.info("Load Balancer detenido")
