import logging
import threading
import time
from typing import Callable

import requests

logger = logging.getLogger("replication.heartbeat")


class HeartbeatSender:
    """Envía heartbeats al Event Monitor con métricas de replicación."""

    def __init__(self, event_monitor_url: str, service_name: str,
                 get_stats_fn: Callable | None = None,
                 machine_id: int = 3, interval_seconds: int = 2):
        self._url = event_monitor_url.rstrip("/")
        self._service = service_name
        self._get_stats = get_stats_fn
        self._machine_id = machine_id
        self._interval = interval_seconds

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
        logger.info("HeartbeatSender iniciado para %s", self._service)

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
        stats = self._get_stats() if self._get_stats else {}
        payload = {
            "node_id": self._node_id,
            "node_name": f"Replication Manager - {self._service}",
            "service_name": f"replication-{self._service}",
            "machine_id": self._machine_id,
            "status": "active",
            "timestamp": time.time(),
            "custom_metrics": {
                "service": self._service,
                "total_entries": getattr(stats, "total_entries", 0),
                "pending_entries": getattr(stats, "pending_entries", 0),
                "replicated_entries": getattr(stats, "replicated_entries", 0),
                "failed_entries": getattr(stats, "failed_entries", 0),
                "healthy_replicas": getattr(stats, "healthy_replicas", 0),
                "unhealthy_replicas": getattr(stats, "unhealthy_replicas", 0),
                "queue_depth": getattr(stats, "queue_depth", 0),
            },
        }
        try:
            resp = requests.post(
                f"{self._url}/nodes/{self._node_id}/heartbeat",
                json=payload, timeout=3,
            )
            self._sent_count += 1
            return resp.status_code < 500
        except requests.ConnectionError:
            logger.debug("Event Monitor no disponible")
            return False
        except Exception as e:
            logger.error("Error heartbeat: %s", e)
            return False
