import json
import logging
import threading
import time
from typing import Callable

import redis as redis_lib

logger = logging.getLogger("replication.heartbeat")


class HeartbeatSender:
    """Envía heartbeats al Event Monitor vía Redis Pub/Sub con métricas de replicación."""

    def __init__(
        self,
        service_name: str,
        get_stats_fn: Callable | None = None,
        machine_id: int = 3,
        interval_seconds: int = 2,
        redis_client: redis_lib.Redis | None = None,
    ):
        self._service = service_name
        self._get_stats = get_stats_fn
        self._machine_id = machine_id
        self._interval = interval_seconds
        self._redis_client = redis_client

        self._running = False
        self._thread: threading.Thread | None = None
        self._sent_count = 0
        self._node_id = f"replication-{service_name}"

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._loop, name="rep-heartbeat", daemon=True,
        )
        self._thread.start()
        logger.info(
            "HeartbeatSender iniciado para %s (redis=%s)",
            self._service,
            self._redis_client is not None,
        )

    def stop(self) -> None:
        self._running = False

    def _loop(self) -> None:
        while self._running:
            try:
                self._send()
            except Exception as e:
                if self._running:
                    logger.error("Error heartbeat: %s", e)
            time.sleep(self._interval)

    def _send(self) -> bool:
        """Publica un heartbeat en Redis Pub/Sub (canal 'heartbeats')."""
        if not self._redis_client:
            logger.warning("Redis no disponible para heartbeat")
            return False

        stats = self._get_stats() if self._get_stats else {}
        if hasattr(stats, "to_dict"):
            stats = stats.to_dict()
        elif not isinstance(stats, dict):
            stats = {}

        payload = {
            "node_id": self._node_id,
            "node_name": f"Replication Manager - {self._service}",
            "service_name": f"replication-{self._service}",
            "machine_id": self._machine_id,
            "status": "active",
            "timestamp": time.time(),
            "custom_metrics": {
                "service": self._service,
                "total_entries": stats.get("total_entries", 0),
                "pending_entries": stats.get("pending_entries", 0),
                "replicated_entries": stats.get("replicated_entries", 0),
                "failed_entries": stats.get("failed_entries", 0),
                "healthy_replicas": stats.get("healthy_replicas", 0),
                "unhealthy_replicas": stats.get("unhealthy_replicas", 0),
                "queue_depth": stats.get("queue_depth", 0),
            },
        }

        try:
            self._redis_client.publish("heartbeats", json.dumps(payload, default=str))
            self._sent_count += 1
            return True
        except Exception as e:
            logger.error("Error publicando heartbeat en Redis: %s", e)
            return False
