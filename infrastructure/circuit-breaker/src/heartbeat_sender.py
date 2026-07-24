# =============================================================================
# Heartbeat Sender - Circuit Breaker
# =============================================================================
# Envía heartbeats periódicos al Event Monitor con el estado
# de todos los circuit breakers.
# =============================================================================

import logging
import time
import threading

import requests

from src.circuit import CircuitBreakerStateMachine

logger = logging.getLogger("circuit-breaker.heartbeat")


class HeartbeatSender:
    """Envía heartbeats al Event Monitor a intervalos regulares."""

    def __init__(
        self,
        event_monitor_url: str,
        state_machine: CircuitBreakerStateMachine,
        machine_id: int = 2,
        interval_seconds: int = 2,
    ):
        self._event_monitor_url = event_monitor_url.rstrip("/")
        self._state_machine = state_machine
        self._machine_id = machine_id
        self._interval = interval_seconds

        self._running = False
        self._thread: threading.Thread | None = None
        self._sent_count = 0

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._heartbeat_loop,
            name="cb-heartbeat",
            daemon=True,
        )
        self._thread.start()
        logger.info(
            "HeartbeatSender iniciado (intervalo=%ds, destino=%s)",
            self._interval, self._event_monitor_url,
        )

    def stop(self) -> None:
        self._running = False

    def _heartbeat_loop(self) -> None:
        while self._running:
            try:
                self._send_heartbeat()
            except Exception as e:
                if self._running:
                    logger.error("Error en heartbeat: %s", e)
            time.sleep(self._interval)

    def _send_heartbeat(self) -> bool:
        """Envía heartbeat con métricas de los circuit breakers."""
        stats = self._state_machine.get_stats()
        circuits = stats.get("circuits", [])

        # Construir métricas personalizadas
        open_services = [
            c["service_name"] for c in circuits if c.get("is_open")
        ]
        half_open_services = [
            c["service_name"] for c in circuits if c.get("is_half_open")
        ]

        payload = {
            "node_id": "circuit-breaker",
            "node_name": "Circuit Breaker Service",
            "service_name": "circuit-breaker",
            "machine_id": self._machine_id,
            "status": "active",
            "timestamp": time.time(),
            "cpu_percent": 0.0,
            "memory_percent": 0.0,
            "uptime_seconds": 0.0,
            "custom_metrics": {
                "total_circuits": stats.get("total_circuits", 0),
                "open_count": stats.get("open_count", 0),
                "closed_count": stats.get("closed_count", 0),
                "half_open_count": stats.get("half_open_count", 0),
                "total_rejections": stats.get("total_rejections", 0),
                "open_services": open_services,
                "half_open_services": half_open_services,
            },
        }

        try:
            resp = requests.post(
                f"{self._event_monitor_url}/nodes/circuit-breaker/heartbeat",
                json=payload,
                timeout=3,
            )
            self._sent_count += 1
            return resp.status_code < 500
        except requests.ConnectionError:
            logger.warning("Event Monitor no disponible: %s", self._event_monitor_url)
            return False
        except requests.Timeout:
            return False
        except Exception as e:
            logger.error("Error en heartbeat: %s", e)
            return False

    @property
    def sent_count(self) -> int:
        return self._sent_count
