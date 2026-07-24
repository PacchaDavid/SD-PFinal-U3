# =============================================================================
# Models - Load Balancer
# =============================================================================
# Modelos de datos: instancias de servicio, estadísticas, eventos.
# =============================================================================

import time
import uuid
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any


class ServiceStatus(str, Enum):
    """Estados de salud de un servicio backend."""
    UNKNOWN = "unknown"
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class BalanceStrategy(str, Enum):
    """Estrategias de balanceo disponibles."""
    ROUND_ROBIN = "round-robin"
    LEAST_CONNECTIONS = "least-connections"
    RANDOM = "random"


class ProxyEventType(str, Enum):
    """Eventos generados por el Load Balancer."""
    REQUEST_FORWARDED = "proxy.request_forwarded"
    REQUEST_FAILED = "proxy.request_failed"
    REQUEST_TIMEOUT = "proxy.request_timeout"
    BACKEND_MARKED_UNHEALTHY = "proxy.backend_unhealthy"
    BACKEND_MARKED_HEALTHY = "proxy.backend_healthy"
    BACKEND_MARKED_DEGRADED = "proxy.backend_degraded"
    NO_BACKENDS_AVAILABLE = "proxy.no_backends_available"


@dataclass
class ServiceInstance:
    """Representa una instancia de servicio backend."""
    service_name: str
    instance_id: str
    host: str
    port: int
    health_path: str = "/actuator/health"
    max_retries: int = 3
    timeout_ms: int = 5000

    status: ServiceStatus = ServiceStatus.UNKNOWN
    active_connections: int = 0
    total_requests: int = 0
    failed_requests: int = 0
    last_health_check: float = 0.0
    last_response_time_ms: float = 0.0
    consecutive_failures: int = 0
    registered_at: float = field(default_factory=lambda: time.time())

    @property
    def url(self) -> str:
        return f"http://{self.host}:{self.port}"

    @property
    def health_url(self) -> str:
        return f"{self.url}{self.health_path}"

    @property
    def success_rate(self) -> float:
        if self.total_requests == 0:
            return 1.0
        return 1.0 - (self.failed_requests / self.total_requests)

    def record_request(self, response_time_ms: float, success: bool) -> None:
        self.total_requests += 1
        self.last_response_time_ms = response_time_ms
        if success:
            self.consecutive_failures = 0
        else:
            self.failed_requests += 1
            self.consecutive_failures += 1

    def to_dict(self) -> dict:
        return {
            "service_name": self.service_name,
            "instance_id": self.instance_id,
            "host": self.host,
            "port": self.port,
            "url": self.url,
            "status": self.status.value,
            "active_connections": self.active_connections,
            "total_requests": self.total_requests,
            "failed_requests": self.failed_requests,
            "success_rate": round(self.success_rate, 4),
            "last_health_check": self.last_health_check,
            "last_response_time_ms": round(self.last_response_time_ms, 2),
            "consecutive_failures": self.consecutive_failures,
            "registered_at": self.registered_at,
        }


@dataclass
class BalancerStats:
    """Estadísticas globales del Load Balancer."""
    uptime_seconds: float = 0.0
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    requests_per_service: dict = field(default_factory=dict)
    avg_response_time_ms: float = 0.0
    active_connections: int = 0
    services_healthy: int = 0
    services_unhealthy: int = 0
    services_degraded: int = 0
    timestamp: float = field(default_factory=lambda: time.time())

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ForwardResult:
    """Resultado de un intento de forward a backend."""
    success: bool
    status_code: int = 0
    response_time_ms: float = 0.0
    instance: ServiceInstance | None = None
    error: str = ""
