# =============================================================================
# HTTP Proxy - Load Balancer
# =============================================================================
# Proxy inverso que recibe requests HTTP y las reenvía al backend
# seleccionado por la estrategia de balanceo.
# Soporta: timeout, reintentos, timeouts configurables.
# =============================================================================

import json
import logging
import time
from typing import Callable

import requests
from flask import Response

from src.models import (
    ServiceInstance,
    ServiceStatus,
    ProxyEventType,
)
from src.service_registry import ServiceRegistry
from src.strategies import BalanceStrategy

logger = logging.getLogger("load-balancer.proxy")

# Headers que NO se forwardean al backend
STRIPPED_HEADERS = {
    "host",
    "connection",
    "transfer-encoding",
    "content-length",
}


class ProxyHandler:
    """Manejador de proxy inverso con balanceo de carga."""

    def __init__(
        self,
        registry: ServiceRegistry,
        strategy: BalanceStrategy,
        default_timeout_ms: int = 5000,
        on_event: Callable | None = None,
    ):
        self._registry = registry
        self._strategy = strategy
        self._default_timeout = default_timeout_ms / 1000
        self._on_event = on_event

    def forward(
        self,
        flask_request,
        service_name: str,
        path: str,
    ) -> tuple[Response, int]:
        """Reenvía una request Flask a un servicio backend.

        Args:
            flask_request: Request entrante de Flask.
            service_name: Nombre del servicio destino (usuarios, pagos, etc).
            path: Path a reenviar (ej: /api/usuarios/users).

        Returns:
            Tupla (Flask Response, status_code).
        """
        instance = self._select_instance(service_name)
        if not instance:
            instance = self._select_degraded_fallback(service_name)

        if not instance:
            logger.warning("No hay backends disponibles para: %s", service_name)
            self._emit_event(ProxyEventType.NO_BACKENDS_AVAILABLE, {
                "service": service_name, "path": path,
            })
            return self._error_response(
                503, f"No backends disponibles para: {service_name}"
            )

        # Intentar forward con reintentos
        last_error = ""
        for attempt in range(instance.max_retries + 1):
            try:
                return self._forward_single(flask_request, instance, path)
            except requests.Timeout:
                last_error = f"Timeout tras {instance.timeout_ms}ms"
                logger.warning(
                    "Timeout (%d/%d) %s/%s: %s",
                    attempt + 1, instance.max_retries + 1,
                    service_name, instance.instance_id, path,
                )
                self._emit_event(ProxyEventType.REQUEST_TIMEOUT, {
                    "service": service_name, "instance": instance.instance_id,
                    "path": path, "attempt": attempt + 1,
                })
            except requests.RequestException as e:
                last_error = str(e)
                logger.warning(
                    "Error (%d/%d) %s/%s: %s",
                    attempt + 1, instance.max_retries + 1,
                    service_name, instance.instance_id, e,
                )
            except Exception as e:
                last_error = f"Error inesperado: {e}"
                logger.error("Error en proxy: %s", e, exc_info=True)

            # Esperar antes de reintentar (backoff)
            if attempt < instance.max_retries:
                time.sleep(0.1 * (attempt + 1))

        # Todos los reintentos fallaron
        self._registry.record_request(
            service_name, instance.instance_id, 0, False,
        )
        self._emit_event(ProxyEventType.REQUEST_FAILED, {
            "service": service_name, "instance": instance.instance_id,
            "path": path, "error": last_error,
        })
        return self._error_response(
            502, f"Error en {service_name}: {last_error}"
        )

    def _forward_single(
        self, flask_request, instance: ServiceInstance, path: str,
    ) -> tuple[Response, int]:
        """Ejecuta un forward individual a una instancia."""
        start_time = time.time()
        target_url = f"{instance.url}{path}"

        # Incrementar conexiones activas
        instance.active_connections += 1

        try:
            # Headers
            headers = {
                k: v for k, v in flask_request.headers.items()
                if k.lower() not in STRIPPED_HEADERS
            }
            headers["X-Forwarded-For"] = flask_request.remote_addr or "unknown"
            headers["X-Forwarded-Host"] = flask_request.host
            headers["X-Forwarded-Proto"] = flask_request.scheme
            headers["X-Load-Balancer"] = "streaming-lb"

            # Body
            body = flask_request.get_data()

            # Request al backend
            resp = requests.request(
                method=flask_request.method,
                url=target_url,
                headers=headers,
                data=body,
                timeout=instance.timeout_ms / 1000,
                allow_redirects=False,
            )

            elapsed_ms = (time.time() - start_time) * 1000

            # Registrar éxito
            self._registry.record_request(
                instance.service_name, instance.instance_id, elapsed_ms, True,
            )

            # Construir response Flask con datos del backend
            flask_response = Response(
                response=resp.content,
                status=resp.status_code,
            )
            # Copiar headers relevantes del backend
            for key, value in resp.headers.items():
                if key.lower() not in STRIPPED_HEADERS and key.lower() != "content-encoding":
                    flask_response.headers[key] = value

            return flask_response, resp.status_code

        finally:
            # Decrementar conexiones activas
            instance.active_connections -= 1

    def _select_instance(self, service_name: str) -> ServiceInstance | None:
        """Selecciona instancia saludable según estrategia."""
        instances = self._registry.get_instances(service_name)
        if not instances:
            return None
        return self._strategy.select_instance(instances)

    def _select_degraded_fallback(self, service_name: str) -> ServiceInstance | None:
        """Fallback a instancia degradada si no hay saludables."""
        instances = self._registry.get_instances(service_name)
        degraded = [i for i in instances if i.status == ServiceStatus.DEGRADED]
        if degraded:
            logger.info("Usando fallback DEGRADED para: %s", service_name)
            return degraded[0]
        return None

    @staticmethod
    def _error_response(status_code: int, message: str) -> tuple[Response, int]:
        return Response(
            json.dumps({"error": message, "status": status_code}),
            status=status_code,
            content_type="application/json",
        ), status_code

    def _emit_event(self, event_type: ProxyEventType, data: dict) -> None:
        if self._on_event:
            self._on_event({
                "type": event_type.value,
                "severity": "warning",
                "timestamp": time.time(),
                **data,
            })
