# =============================================================================
# Circuit Breaker State Machine - Circuit Breaker Service
# =============================================================================
# Máquina de estados del Circuit Breaker.
# Gestiona las transiciones: CLOSED → OPEN → HALF_OPEN → CLOSED
# =============================================================================
#
# Diagrama de estados:
#
#     ┌──────────┐    fallos >= threshold    ┌──────────┐
#     │  CLOSED  │ ────────────────────────▶  │   OPEN   │
#     │ (normal) │                            │ (abierto)│
#     └──────────┘                            └──────────┘
#          ▲                                      │
#          │                              timeout  │
#          │                              expirado │
#          │                                      ▼
#          │                            ┌──────────┐
#          │     éxitos >= threshold    │ HALF_OPEN│
#          └────────────────────────────│ (prueba) │
#                                       └──────────┘
#                                             │
#                                        fallo │
#                                             ▼
#                                       ┌──────────┐
#                                       │   OPEN   │
#                                       └──────────┘
# =============================================================================

import logging
import time
from threading import RLock
from typing import Callable

from src.models import (
    CircuitBreaker as CircuitBreakerData,
    CircuitState,
    CircuitEvent,
    CircuitEventType,
    FailureRecord,
)

logger = logging.getLogger("circuit-breaker.core")


class CircuitBreakerStateMachine:
    """Máquina de estados del Circuit Breaker.

    Mantiene un circuit breaker por servicio y gestiona
    las transiciones de estado según las reglas configuradas.
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        success_threshold: int = 3,
        open_timeout_seconds: int = 30,
        half_open_max_requests: int = 3,
        sliding_window_size: int = 20,
        on_state_change: Callable | None = None,
    ):
        self._failure_threshold = failure_threshold
        self._success_threshold = success_threshold
        self._open_timeout = open_timeout_seconds
        self._half_open_max = half_open_max_requests
        self._window_size = sliding_window_size
        self._on_state_change = on_state_change

        self._circuits: dict[str, CircuitBreakerData] = {}
        self._events: list[CircuitEvent] = []
        self._max_events = 10000
        self._lock = RLock()

    # ------------------------------------------------------------------
    # Gestión de circuitos
    # ------------------------------------------------------------------

    def get_or_create(self, service_name: str) -> CircuitBreakerData:
        """Obtiene un circuit breaker existente o crea uno nuevo."""
        with self._lock:
            if service_name not in self._circuits:
                self._circuits[service_name] = CircuitBreakerData(
                    service_name=service_name,
                    failure_threshold=self._failure_threshold,
                    success_threshold=self._success_threshold,
                    open_timeout_seconds=self._open_timeout,
                    half_open_max_requests=self._half_open_max,
                    max_window_size=self._window_size,
                )
                logger.info("Circuit Breaker creado para: %s", service_name)
            return self._circuits[service_name]

    def get_circuit(self, service_name: str) -> CircuitBreakerData | None:
        """Obtiene un circuit breaker por nombre de servicio."""
        with self._lock:
            return self._circuits.get(service_name)

    def get_all_circuits(self) -> list[CircuitBreakerData]:
        """Obtiene todos los circuit breakers."""
        with self._lock:
            return list(self._circuits.values())

    def get_all_states(self) -> dict[str, str]:
        """Obtiene un mapa servicio → estado actual."""
        with self._lock:
            return {
                name: cb.state.value
                for name, cb in self._circuits.items()
            }

    # ------------------------------------------------------------------
    # Registro de eventos de servicios
    # ------------------------------------------------------------------

    def record_failure(self, service_name: str, error: str = "") -> CircuitBreakerData:
        """Registra un fallo y evalúa si abrir el circuito.

        Args:
            service_name: Nombre del servicio que falló.
            error: Descripción del error.

        Returns:
            CircuitBreakerData actualizado.
        """
        cb = self.get_or_create(service_name)

        with self._lock:
            cb.total_requests += 1
            cb.total_failures += 1
            cb.failure_count += 1
            cb.consecutive_failures += 1
            cb.consecutive_successes = 0
            cb.last_failure_time = time.time()

            # Agregar al sliding window
            cb.recent_failures.append(FailureRecord(
                service=service_name, error=error,
            ))
            if len(cb.recent_failures) > cb.max_window_size:
                cb.recent_failures = cb.recent_failures[-cb.max_window_size:]

        # Evaluar si debemos abrir el circuito
        self._evaluate_open(cb)

        self._add_event(CircuitEvent(
            type=CircuitEventType.FAILURE_RECORDED.value,
            service=service_name,
            message=f"Fallo registrado en {service_name}: {error}" if error
                    else f"Fallo registrado en {service_name}",
            severity="warning",
            metadata={
                "failure_count": cb.failure_count,
                "consecutive_failures": cb.consecutive_failures,
                "state": cb.state.value,
            },
        ))

        return cb

    def record_success(self, service_name: str) -> CircuitBreakerData:
        """Registra un éxito y evalúa si cerrar el circuito.

        Args:
            service_name: Nombre del servicio exitoso.

        Returns:
            CircuitBreakerData actualizado.
        """
        cb = self.get_or_create(service_name)

        with self._lock:
            cb.total_requests += 1
            cb.total_successes += 1
            cb.success_count += 1
            cb.consecutive_successes += 1
            cb.consecutive_failures = 0
            cb.last_success_time = time.time()

        # Evaluar si debemos cerrar el circuito (solo en HALF_OPEN)
        if cb.is_half_open:
            self._evaluate_close(cb)

        self._add_event(CircuitEvent(
            type=CircuitEventType.SUCCESS_RECORDED.value,
            service=service_name,
            message=f"Éxito registrado en {service_name}",
            severity="info",
            metadata={
                "consecutive_successes": cb.consecutive_successes,
                "state": cb.state.value,
            },
        ))

        return cb

    def is_request_allowed(self, service_name: str) -> bool:
        """Verifica si una request puede pasar al servicio.

        Reglas:
        - CLOSED: siempre permitido.
        - OPEN: rechazado, excepto si timeout expiró (transición a HALF_OPEN).
        - HALF_OPEN: permitido si no se excedió half_open_max_requests.

        Args:
            service_name: Nombre del servicio.

        Returns:
            True si la request puede proseguir.
        """
        cb = self.get_or_create(service_name)

        if cb.is_closed:
            return True

        if cb.is_open:
            if self._check_timeout_expired(cb):
                return self._transition_to_half_open(cb)
            self._record_rejection(cb)
            return False

        if cb.is_half_open:
            with self._lock:
                if cb.half_open_requests >= cb.half_open_max_requests:
                    return False
                cb.half_open_requests += 1
            return True

        return True

    def record_rejection(self, service_name: str) -> None:
        """Registra una request rechazada por el Circuit Breaker.

        Útil para que el Load Balancer reporte rechazos externamente.
        """
        cb = self.get_or_create(service_name)
        self._record_rejection(cb)

    def _record_rejection(self, cb: CircuitBreakerData) -> None:
        """Interno: registra un rechazo y emite evento."""
        with self._lock:
            cb.total_rejections += 1

        self._add_event(CircuitEvent(
            type=CircuitEventType.REQUEST_REJECTED.value,
            service=cb.service_name,
            message=(
                f"Request rechazada para {cb.service_name}: "
                f"Circuit Breaker en estado {cb.state.value}"
            ),
            severity="warning",
            metadata=cb.to_dict(),
        ))

    # ------------------------------------------------------------------
    # Evaluación de transiciones
    # ------------------------------------------------------------------

    def _evaluate_open(self, cb: CircuitBreakerData) -> None:
        """Evalúa si abrir el circuito (CLOSED → OPEN)."""
        if not cb.is_closed:
            return

        should_open = False
        with self._lock:
            if cb.consecutive_failures >= cb.failure_threshold:
                should_open = True

        if should_open:
            self._transition_to_open(cb)

    def _evaluate_close(self, cb: CircuitBreakerData) -> None:
        """Evalúa si cerrar el circuito (HALF_OPEN → CLOSED)."""
        if not cb.is_half_open:
            return

        should_close = False
        with self._lock:
            if cb.consecutive_successes >= cb.success_threshold:
                should_close = True

        if should_close:
            self._transition_to_closed(cb)
        elif cb.consecutive_failures > 0:
            # Si falla en HALF_OPEN, volver a OPEN
            self._transition_to_open(cb)

    def _check_timeout_expired(self, cb: CircuitBreakerData) -> bool:
        """Verifica si el timeout del estado OPEN ha expirado."""
        if not cb.is_open:
            return False

        elapsed = time.time() - cb.opened_at
        if elapsed >= cb.open_timeout_seconds:
            logger.info(
                "Timeout expirado para %s (%.1fs >= %ds)",
                cb.service_name, elapsed, cb.open_timeout_seconds,
            )
            return True
        return False

    # ------------------------------------------------------------------
    # Transiciones de estado
    # ------------------------------------------------------------------

    def _transition_to_open(self, cb: CircuitBreakerData) -> None:
        """Transición: cualquier estado → OPEN."""
        with self._lock:
            old_state = cb.state
            cb.state = CircuitState.OPEN
            cb.opened_at = time.time()
            cb.last_state_change = cb.opened_at
            cb.half_open_requests = 0

        logger.warning(
            "Circuit Breaker OPEN: %s (tras %d fallos consecutivos)",
            cb.service_name, cb.consecutive_failures,
        )

        self._emit_state_change(cb, old_state, CircuitEventType.OPENED)

    def _transition_to_half_open(self, cb: CircuitBreakerData) -> bool:
        """Transición: OPEN → HALF_OPEN.

        Returns:
            True si la transición fue exitosa.
        """
        with self._lock:
            old_state = cb.state
            cb.state = CircuitState.HALF_OPEN
            cb.consecutive_successes = 0
            cb.half_open_requests = 1  # La request actual cuenta
            cb.last_state_change = time.time()

        logger.info(
            "Circuit Breaker HALF_OPEN: %s (probando recuperación)",
            cb.service_name,
        )

        self._emit_state_change(cb, old_state, CircuitEventType.HALF_OPEN)
        return True

    def _transition_to_closed(self, cb: CircuitBreakerData) -> None:
        """Transición: HALF_OPEN → CLOSED."""
        with self._lock:
            old_state = cb.state
            cb.state = CircuitState.CLOSED
            cb.failure_count = 0
            cb.success_count = 0
            cb.consecutive_failures = 0
            cb.consecutive_successes = 0
            cb.half_open_requests = 0
            cb.recent_failures = []
            cb.last_state_change = time.time()

        logger.info(
            "Circuit Breaker CLOSED: %s (recuperado tras %d éxitos)",
            cb.service_name, cb.success_threshold,
        )

        self._emit_state_change(cb, old_state, CircuitEventType.CLOSED)

    # ------------------------------------------------------------------
    # Eventos y notificaciones
    # ------------------------------------------------------------------

    def _emit_state_change(
        self,
        cb: CircuitBreakerData,
        old_state: CircuitState,
        event_type: CircuitEventType,
    ) -> None:
        """Emite un evento de cambio de estado."""
        severity_map = {
            CircuitEventType.OPENED: "error",
            CircuitEventType.HALF_OPEN: "warning",
            CircuitEventType.CLOSED: "info",
        }

        event = CircuitEvent(
            type=event_type.value,
            service=cb.service_name,
            old_state=old_state.value,
            new_state=cb.state.value,
            message=(
                f"Circuit Breaker {cb.service_name}: "
                f"{old_state.value} → {cb.state.value}"
            ),
            severity=severity_map.get(event_type, "info"),
            metadata={
                "consecutive_failures": cb.consecutive_failures,
                "consecutive_successes": cb.consecutive_successes,
                "failure_rate": cb.failure_rate,
                "open_duration": cb.open_duration,
            },
        )

        self._add_event(event)

        if self._on_state_change:
            self._on_state_change(event)

    def _add_event(self, event: CircuitEvent) -> None:
        """Agrega un evento al historial."""
        self._events.append(event)
        if len(self._events) > self._max_events:
            self._events = self._events[-self._max_events:]

    # ------------------------------------------------------------------
    # Estadísticas
    # ------------------------------------------------------------------

    def get_stats(self) -> dict:
        """Estadísticas globales de todos los circuit breakers."""
        with self._lock:
            circuits = list(self._circuits.values())

        stats = {
            "total_circuits": len(circuits),
            "closed_count": sum(1 for c in circuits if c.is_closed),
            "open_count": sum(1 for c in circuits if c.is_open),
            "half_open_count": sum(1 for c in circuits if c.is_half_open),
            "total_requests": sum(c.total_requests for c in circuits),
            "total_rejections": sum(c.total_rejections for c in circuits),
            "total_failures": sum(c.total_failures for c in circuits),
            "total_events": len(self._events),
            "circuits": [c.to_dict() for c in circuits],
        }
        return stats

    def get_events(
        self,
        limit: int = 100,
        service: str | None = None,
        since: float | None = None,
    ) -> list[dict]:
        """Obtiene eventos del historial con filtros opcionales."""
        events = self._events
        if service:
            events = [e for e in events if e.service == service]
        if since:
            events = [e for e in events if e.timestamp >= since]
        events = events[-limit:]
        return [e.to_dict() for e in events]
