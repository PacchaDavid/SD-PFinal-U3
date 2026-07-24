# =============================================================================
# Models - Circuit Breaker
# =============================================================================
# Modelos de datos: estados del circuit breaker, métricas, eventos.
# =============================================================================

import time
import uuid
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any


class CircuitState(str, Enum):
    """Estados posibles del Circuit Breaker."""
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitEventType(str, Enum):
    """Tipos de eventos del Circuit Breaker."""
    OPENED = "circuit.opened"
    CLOSED = "circuit.closed"
    HALF_OPEN = "circuit.half_open"
    FAILURE_RECORDED = "circuit.failure_recorded"
    SUCCESS_RECORDED = "circuit.success_recorded"
    REQUEST_REJECTED = "circuit.request_rejected"
    TIMEOUT_EXPIRED = "circuit.timeout_expired"


@dataclass
class FailureRecord:
    """Registro de un fallo en el sliding window."""
    timestamp: float = field(default_factory=time.time)
    service: str = ""
    error: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class CircuitBreaker:
    """Estado de un circuit breaker para un servicio específico.

    Transiciones de estado:
        CLOSED → (failure_threshold alcanzado) → OPEN
        OPEN → (timeout expirado) → HALF_OPEN
        HALF_OPEN → (success_threshold alcanzado) → CLOSED
        HALF_OPEN → (fallo) → OPEN
    """
    service_name: str
    state: CircuitState = CircuitState.CLOSED

    # Thresholds
    failure_threshold: int = 5
    success_threshold: int = 3
    open_timeout_seconds: int = 30
    half_open_max_requests: int = 3

    # Tracking
    failure_count: int = 0
    success_count: int = 0
    half_open_requests: int = 0
    consecutive_successes: int = 0
    consecutive_failures: int = 0

    # Timestamps
    last_failure_time: float = 0.0
    last_success_time: float = 0.0
    last_state_change: float = field(default_factory=time.time)
    opened_at: float = 0.0
    created_at: float = field(default_factory=time.time)

    # Sliding window de fallos recientes
    recent_failures: list = field(default_factory=list)
    max_window_size: int = 20

    # Métricas acumuladas
    total_requests: int = 0
    total_successes: int = 0
    total_failures: int = 0
    total_rejections: int = 0

    @property
    def is_open(self) -> bool:
        return self.state == CircuitState.OPEN

    @property
    def is_closed(self) -> bool:
        return self.state == CircuitState.CLOSED

    @property
    def is_half_open(self) -> bool:
        return self.state == CircuitState.HALF_OPEN

    @property
    def open_duration(self) -> float:
        if self.opened_at == 0:
            return 0.0
        return time.time() - self.opened_at

    @property
    def time_since_last_state_change(self) -> float:
        return time.time() - self.last_state_change

    @property
    def failure_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.total_failures / self.total_requests

    @property
    def success_rate(self) -> float:
        if self.total_requests == 0:
            return 1.0
        return self.total_successes / self.total_requests

    def to_dict(self) -> dict:
        return {
            "service_name": self.service_name,
            "state": self.state.value,
            "failure_threshold": self.failure_threshold,
            "success_threshold": self.success_threshold,
            "open_timeout_seconds": self.open_timeout_seconds,
            "half_open_max_requests": self.half_open_max_requests,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "consecutive_failures": self.consecutive_failures,
            "consecutive_successes": self.consecutive_successes,
            "failure_rate": round(self.failure_rate, 4),
            "success_rate": round(self.success_rate, 4),
            "total_requests": self.total_requests,
            "total_successes": self.total_successes,
            "total_failures": self.total_failures,
            "total_rejections": self.total_rejections,
            "is_open": self.is_open,
            "is_closed": self.is_closed,
            "is_half_open": self.is_half_open,
            "open_duration_seconds": round(self.open_duration, 2),
            "last_failure_time": self.last_failure_time,
            "last_success_time": self.last_success_time,
            "last_state_change": self.last_state_change,
            "opened_at": self.opened_at,
            "created_at": self.created_at,
            "recent_failures_count": len(self.recent_failures),
        }


@dataclass
class CircuitEvent:
    """Evento de cambio de estado del Circuit Breaker."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: str = ""
    service: str = ""
    old_state: str = ""
    new_state: str = ""
    message: str = ""
    severity: str = "info"
    timestamp: float = field(default_factory=time.time)
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "service": self.service,
            "old_state": self.old_state,
            "new_state": self.new_state,
            "message": self.message,
            "severity": self.severity,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
        }


@dataclass
class CircuitBreakerStats:
    """Estadísticas globales del sistema de Circuit Breakers."""
    total_circuits: int = 0
    closed_count: int = 0
    open_count: int = 0
    half_open_count: int = 0
    total_requests: int = 0
    total_rejections: int = 0
    total_failures: int = 0
    total_events: int = 0
    uptime_seconds: float = 0.0
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return asdict(self)
