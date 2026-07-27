# =============================================================================
# Heartbeat Sender - Load Balancer
# =============================================================================
# Envía heartbeats periódicos al Event Monitor vía Redis Pub/Sub
# (canal "heartbeats") para indicar que el Load Balancer está vivo
# e incluye métricas de carga.
# =============================================================================

import json
import logging
import time
import threading
from typing import Callable

import redis as redis_lib

logger = logging.getLogger("load-balancer.heartbeat")


class HeartbeatSender:
    """Envía heartbeats al Event Monitor a intervalos regulares vía Redis Pub/Sub.

    Los heartbeats incluyen métricas de carga (requests totales,
    instancias saludables, etc.) para monitoreo en tiempo real.
    """

    def __init__(
        self,
        machine_id: int = 2,
        interval_seconds: int = 2,
        get_stats_fn: Callable | None = None,
        redis_client: redis_lib.Redis | None = None,
    ):
        self._machine_id = machine_id
        self._interval = interval_seconds
        self._get_stats = get_stats_fn
        self._redis_client = redis_client

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
            "HeartbeatSender iniciado (intervalo=%ds, redis=%s)",
            self._interval,
            self._redis_client is not None,
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
                if self._running:
                    logger.error("Error enviando heartbeat: %s", e)
            time.sleep(self._interval)

    def _send_heartbeat(self) -> bool:
        """Publica un heartbeat en Redis Pub/Sub (canal 'heartbeats')."""
        if not self._redis_client:
            logger.warning("Redis no disponible para heartbeat")
            return False

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
            self._redis_client.publish("heartbeats", json.dumps(payload, default=str))
            self._sent_count += 1
            return True
        except Exception as e:
            logger.error("Error publicando heartbeat en Redis: %s", e)
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
