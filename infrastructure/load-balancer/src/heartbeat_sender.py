# =============================================================================
# Heartbeat Sender - Load Balancer
# =============================================================================
# Envía heartbeats periódicos al Event Monitor para indicar que el
# Load Balancer está vivo e incluye métricas de carga.
# =============================================================================

import logging
import time
import threading
from typing import Callable

import requests

logger = logging.getLogger("load-balancer.heartbeat")


class HeartbeatSender:
    """Envía heartbeats al Event Monitor a intervalos regulares.

    Los heartbeats incluyen métricas de carga (requests totales,
    instancias saludables, etc.) para monitoreo en tiempo real.
    """

    def __init__(
        self,
        event_monitor_url: str,
        machine_id: int = 2,
        interval_seconds: int = 2,
        get_stats_fn: Callable | None = None,
    ):
        self._event_monitor_url = event_monitor_url.rstrip("/")
        self._machine_id = machine_id
        self._interval = interval_seconds
        self._get_stats = get_stats_fn

        self._running = False
        self._thread: threading.Thread | None = None
        self._sent_count = 0

    def start(self) -> None:
        """Inicia el envío periódico de heartbeats."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._heartbeat_loop,
            name="heartbeat-sender",
            daemon=True,
        )
        self._thread.start()
        logger.info(
            "HeartbeatSender iniciado (intervalo=%ds, destino=%s)",
            self._interval, self._event_monitor_url,
        )

    def stop(self) -> None:
        """Detiene el envío de heartbeats."""
        self._running = False

    def _heartbeat_loop(self) -> None:
        """Loop que envía heartbeats periódicamente."""
        while self._running:
            try:
                self._send_heartbeat()
            except Exception as e:
                if self._running:  # No loguear si estamos cerrando
                    logger.error("Error enviando heartbeat: %s", e)
            time.sleep(self._interval)

    def _send_heartbeat(self) -> bool:
        """Envía un heartbeat al Event Monitor.

        Incluye métricas del Load Balancer si hay un callback configurado.
        """
        stats = self._get_stats() if self._get_stats else {}

        payload = {
            "node_id": self._get_node_id(),
            "node_name": "Load Balancer",
            "service_name": "load-balancer",
            "machine_id": self._machine_id,
            "status": "active",
            "timestamp": time.time(),
            "cpu_percent": 0.0,
            "memory_percent": 0.0,
            "uptime_seconds": stats.get("uptime_seconds", 0) if stats else 0,
            "custom_metrics": self._build_metrics(stats),
        }

        try:
            # Enviar heartbeat vía API REST del Event Monitor
            resp = requests.post(
                f"{self._event_monitor_url}/nodes/{self._get_node_id()}/heartbeat",
                json=payload,
                timeout=3,
            )
            self._sent_count += 1
            return resp.status_code < 500

        except requests.ConnectionError:
            logger.warning(
                "Event Monitor no disponible: %s", self._event_monitor_url,
            )
            return False
        except requests.Timeout:
            logger.debug("Heartbeat timeout (%s)", self._event_monitor_url)
            return False
        except Exception as e:
            logger.error("Error en heartbeat: %s", e)
            return False

    def _get_node_id(self) -> str:
        return "load-balancer"

    def _build_metrics(self, stats: dict) -> dict:
        """Construye métricas personalizadas del Load Balancer."""
        return {
            "total_requests": stats.get("total_requests", 0),
            "successful_requests": stats.get("successful_requests", 0),
            "failed_requests": stats.get("failed_requests", 0),
            "avg_response_time_ms": stats.get("avg_response_time_ms", 0.0),
            "services_healthy": stats.get("services_healthy", 0),
            "services_unhealthy": stats.get("services_unhealthy", 0),
            "services_degraded": stats.get("services_degraded", 0),
            "active_connections": stats.get("active_connections", 0),
        }

    @property
    def sent_count(self) -> int:
        return self._sent_count
