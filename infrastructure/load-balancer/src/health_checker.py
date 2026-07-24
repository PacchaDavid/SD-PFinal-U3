# =============================================================================
# Health Checker - Load Balancer
# =============================================================================
# Ejecuta health checks periódicos a los servicios backend.
# Actualiza el ServiceRegistry con los resultados.
# =============================================================================

import logging
import threading
import time
from typing import Callable

import requests

from src.service_registry import ServiceRegistry

logger = logging.getLogger("load-balancer.health")


class HealthChecker:
    """Ejecuta health checks periódicos a los servicios backend.

    Cada N segundos verifica la salud de cada instancia registrada
    y actualiza su estado en el ServiceRegistry.
    """

    def __init__(
        self,
        registry: ServiceRegistry,
        check_interval: int = 10,
        timeout: int = 3,
        on_health_change: Callable | None = None,
    ):
        self._registry = registry
        self._check_interval = check_interval
        self._timeout = timeout
        self._on_health_change = on_health_change

        self._running = False
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        """Inicia el ciclo de health checks en background."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._check_loop,
            name="health-checker",
            daemon=True,
        )
        self._thread.start()
        logger.info(
            "HealthChecker iniciado (intervalo=%ds, timeout=%ds)",
            self._check_interval,
            self._timeout,
        )

    def stop(self) -> None:
        """Detiene el ciclo de health checks."""
        self._running = False

    def _check_loop(self) -> None:
        """Loop principal de health checks."""
        while self._running:
            try:
                self._check_all()
            except Exception as e:
                logger.error("Error en ciclo de health check: %s", e)
            time.sleep(self._check_interval)

    def _check_all(self) -> None:
        """Verifica la salud de todas las instancias registradas."""
        for service_name in self._registry.get_all_services():
            for instance in self._registry.get_instances(service_name):
                self._check_instance(service_name, instance)

    def _check_instance(self, service_name: str, instance) -> None:
        """Verifica la salud de una instancia específica."""
        start_time = time.time()
        is_healthy = False

        try:
            resp = requests.get(
                instance.health_url,
                timeout=self._timeout,
                headers={"User-Agent": "LoadBalancer/1.0"},
            )
            is_healthy = resp.status_code < 500
        except (requests.ConnectionError, requests.Timeout, requests.RequestException) as e:
            logger.debug(
                "Health check FAIL: %s/%s - %s",
                service_name, instance.instance_id, e,
            )

        response_time_ms = (time.time() - start_time) * 1000

        updated = self._registry.update_health(
            service_name, instance.instance_id, is_healthy, response_time_ms,
        )

        if updated and self._on_health_change:
            self._on_health_change(service_name, instance.instance_id, is_healthy)

    def check_service_now(self, service_name: str) -> dict | None:
        """Ejecuta un health check inmediato de un servicio.

        Útil para endpoints de administración que requieren
        verificación bajo demanda.
        """
        instances = self._registry.get_instances(service_name)
        if not instances:
            return None

        results = []
        for instance in instances:
            start = time.time()
            try:
                resp = requests.get(
                    instance.health_url,
                    timeout=self._timeout,
                )
                ok = resp.status_code < 500
                self._registry.update_health(
                    service_name, instance.instance_id, ok,
                    (time.time() - start) * 1000,
                )
                results.append({
                    "instance": instance.instance_id,
                    "healthy": ok,
                    "response_time_ms": round((time.time() - start) * 1000, 2),
                })
            except Exception as e:
                self._registry.update_health(
                    service_name, instance.instance_id, False,
                )
                results.append({
                    "instance": instance.instance_id,
                    "healthy": False,
                    "error": str(e),
                })

        return {
            "service": service_name,
            "results": results,
            "checked_at": time.time(),
        }
