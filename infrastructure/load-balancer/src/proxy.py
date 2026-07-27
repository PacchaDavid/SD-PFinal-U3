# =============================================================================
# HTTP Proxy - Load Balancer
# =============================================================================
# Proxy inverso que recibe requests HTTP y las reenvía al backend
# seleccionado por la estrategia de balanceo.
#
# Circuit Breaker Integration:
# Antes de forwardear, consulta al Circuit Breaker service para verificar
# si el servicio destino permite requests. Si el CB está OPEN, devuelve
# un fallback específico para ese servicio.
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

# Top 10 genérico para fallback de recomendaciones
FALLBACK_MOVIES = [
    {"id": 101, "title": "El Padrino", "genre": "Crimen", "posterUrl": "/boletos.svg", "year": 1972, "rating": 9.2, "description": "El padrino de la mafia italiana en Nueva York."},
    {"id": 102, "title": "Pulp Fiction", "genre": "Crimen", "posterUrl": "/boletos.svg", "year": 1994, "rating": 8.9, "description": "Historias entrelazadas de criminales en Los Ángeles."},
    {"id": 103, "title": "El Caballero de la Noche", "genre": "Acción", "posterUrl": "/boletos.svg", "year": 2008, "rating": 9.0, "description": "Batman enfrenta al Joker en Gotham."},
    {"id": 104, "title": "Forrest Gump", "genre": "Drama", "posterUrl": "/boletos.svg", "year": 1994, "rating": 8.8, "description": "La vida de un hombre sencillo que vive grandes aventuras."},
    {"id": 105, "title": "Inception", "genre": "Ciencia Ficción", "posterUrl": "/boletos.svg", "year": 2010, "rating": 8.8, "description": "Ladrones que roban secretos del subconsciente."},
    {"id": 106, "title": "Matrix", "genre": "Ciencia Ficción", "posterUrl": "/boletos.svg", "year": 1999, "rating": 8.7, "description": "Un hacker descubre que la realidad es una simulación."},
    {"id": 107, "title": "Interestelar", "genre": "Ciencia Ficción", "posterUrl": "/boletos.svg", "year": 2014, "rating": 8.6, "description": "Astronautas viajan a través de un agujero de gusano."},
    {"id": 108, "title": "Parásitos", "genre": "Thriller", "posterUrl": "/boletos.svg", "year": 2019, "rating": 8.5, "description": "Una familia pobre se infiltra en un hogar rico."},
    {"id": 109, "title": "El Señor de los Anillos", "genre": "Fantasía", "posterUrl": "/boletos.svg", "year": 2001, "rating": 8.8, "description": "Un hobbit debe destruir un anillo mágico."},
    {"id": 110, "title": "Volver al Futuro", "genre": "Ciencia Ficción", "posterUrl": "/boletos.svg", "year": 1985, "rating": 8.5, "description": "Un adolescente viaja al pasado en un DeLorean."},
]


class ProxyHandler:
    """Manejador de proxy inverso con balanceo de carga y Circuit Breaker."""

    def __init__(
        self,
        registry: ServiceRegistry,
        strategy: BalanceStrategy,
        default_timeout_ms: int = 5000,
        circuit_breaker_url: str | None = None,
        circuit_breaker_timeout: int = 2000,
        on_event: Callable | None = None,
    ):
        self._registry = registry
        self._strategy = strategy
        self._default_timeout = default_timeout_ms / 1000
        self._cb_url = circuit_breaker_url
        self._cb_timeout = circuit_breaker_timeout / 1000
        self._on_event = on_event

    def forward(
        self,
        flask_request,
        service_name: str,
        path: str,
    ) -> tuple[Response, int]:
        """Reenvía una request Flask a un servicio backend.

        Primero consulta al Circuit Breaker. Si está OPEN, retorna fallback.
        Si está CLOSED, forwardea y reporta éxito/fallo al CB.

        Args:
            flask_request: Request entrante de Flask.
            service_name: Nombre del servicio destino (usuarios, pagos, etc).
            path: Path a reenviar (ej: /api/auth/login).

        Returns:
            Tupla (Flask Response, status_code).
        """
        # 1. Consultar Circuit Breaker
        cb_check = self._check_circuit_breaker(service_name)
        if cb_check and not cb_check.get("allowed", True):
            state = cb_check.get("state", "OPEN")
            logger.warning("CB bloqueó request para %s (estado=%s)", service_name, state)
            self._emit_event(ProxyEventType.REQUEST_REJECTED, {
                "service": service_name, "path": path, "cb_state": state,
            })
            return self._circuit_breaker_fallback(service_name, path)

        # 2. Seleccionar instancia
        instance = self._select_instance(service_name)
        if not instance:
            instance = self._select_degraded_fallback(service_name)

        # 2b. Si no hay instancias HEALTHY/DEGRADED, intentar con CUALQUIER instancia
        #     como último recurso. El fallo real de conexión reportará al CB.
        if not instance:
            instance = self._select_any_instance(service_name)

        if not instance:
            logger.warning("No hay backends disponibles para: %s", service_name)
            self._emit_event(ProxyEventType.NO_BACKENDS_AVAILABLE, {
                "service": service_name, "path": path,
            })
            # Reportar fallo al CB incluso sin backends, para que el circuito
            # pueda abrirse automáticamente cuando un servicio completo cae.
            self._record_cb_failure(service_name, "No backends available")
            return self._error_response(
                503, f"No backends disponibles para: {service_name}"
            )

        # 3. Forward con reintentos
        last_error = ""
        success = False
        response = None
        status_code = 502

        for attempt in range(instance.max_retries + 1):
            try:
                resp, code = self._forward_single(flask_request, instance, path)
                response, status_code = resp, code
                success = status_code < 500
                if success:
                    break
                last_error = f"HTTP {status_code} del backend"
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

            # Backoff antes de reintentar
            if attempt < instance.max_retries:
                time.sleep(0.1 * (attempt + 1))

        # 4. Reportar al Circuit Breaker
        if success:
            self._record_cb_success(service_name)
            self._registry.record_request(
                service_name, instance.instance_id, 0, True,
            )
        else:
            self._record_cb_failure(service_name, last_error)
            self._registry.record_request(
                service_name, instance.instance_id, 0, False,
            )
            self._emit_event(ProxyEventType.REQUEST_FAILED, {
                "service": service_name, "instance": instance.instance_id,
                "path": path, "error": last_error,
            })

        if response:
            return response, status_code
        return self._error_response(
            502, f"Error en {service_name}: {last_error}"
        )

    # ------------------------------------------------------------------
    # Circuit Breaker Integration
    # ------------------------------------------------------------------

    def _check_circuit_breaker(self, service_name: str) -> dict | None:
        """Consulta al Circuit Breaker si la request está permitida."""
        if not self._cb_url:
            return None
        try:
            resp = requests.get(
                f"{self._cb_url}/circuits/{service_name}/check",
                timeout=self._cb_timeout,
            )
            if resp.status_code == 200:
                return resp.json()
        except requests.RequestException:
            logger.debug("CB no disponible para %s", service_name)
        return None

    def _record_cb_failure(self, service_name: str, error: str = "") -> None:
        """Reporta un fallo al Circuit Breaker."""
        if not self._cb_url:
            return
        try:
            requests.post(
                f"{self._cb_url}/circuits/{service_name}/failures",
                json={"error": error},
                timeout=self._cb_timeout,
            )
        except requests.RequestException:
            pass

    def _record_cb_success(self, service_name: str) -> None:
        """Reporta un éxito al Circuit Breaker."""
        if not self._cb_url:
            return
        try:
            requests.post(
                f"{self._cb_url}/circuits/{service_name}/success",
                timeout=self._cb_timeout,
            )
        except requests.RequestException:
            pass

    def _circuit_breaker_fallback(self, service_name: str, path: str) -> tuple[Response, int]:
        """Retorna un fallback específico según el servicio cuando el CB está OPEN."""
        fallbacks = {
            "recomendaciones": self._fallback_recomendaciones,
            "usuarios": self._fallback_usuarios,
            "pagos": self._fallback_pagos,
        }

        fallback_fn = fallbacks.get(service_name, self._fallback_generic)
        return fallback_fn(path)

    def _fallback_recomendaciones(self, path: str) -> tuple[Response, int]:
        """Fallback: top 10 genérico cuando recomendaciones está OPEN."""
        return Response(
            json.dumps({
                "cb_fallback": True,
                "message": "El servicio de recomendaciones no está disponible. Mostrando top 10 genérico.",
                "data": FALLBACK_MOVIES,
            }),
            status=200,
            content_type="application/json",
        ), 200

    def _fallback_usuarios(self, path: str) -> tuple[Response, int]:
        """Fallback para usuarios según el endpoint."""
        if "login" in path or "auth" in path:
            return Response(
                json.dumps({
                    "cb_fallback": True,
                    "error": "circuit_breaker_open",
                    "message": "El servicio de autenticación no está disponible temporalmente. "
                               "Intenta de nuevo en unos minutos.",
                }),
                status=503,
                content_type="application/json",
            ), 503
        return self._fallback_generic(path)

    def _fallback_pagos(self, path: str) -> tuple[Response, int]:
        """Fallback para pagos."""
        return Response(
            json.dumps({
                "cb_fallback": True,
                "error": "circuit_breaker_open",
                "message": "El servicio de pagos no está disponible temporalmente. "
                           "Tu transacción no pudo ser procesada. Intenta más tarde.",
            }),
            status=503,
            content_type="application/json",
        ), 503

    def _fallback_generic(self, path: str) -> tuple[Response, int]:
        """Fallback genérico para cualquier servicio."""
        return Response(
            json.dumps({
                "cb_fallback": True,
                "error": "circuit_breaker_open",
                "message": "Servicio temporalmente no disponible. Intenta de nuevo más tarde.",
            }),
            status=503,
            content_type="application/json",
        ), 503

    # ------------------------------------------------------------------
    # Forward methods
    # ------------------------------------------------------------------

    def _forward_single(
        self, flask_request, instance: ServiceInstance, path: str,
    ) -> tuple[Response, int]:
        """Ejecuta un forward individual a una instancia."""
        start_time = time.time()
        target_url = f"{instance.url}{path}"

        instance.active_connections += 1

        try:
            headers = {
                k: v for k, v in flask_request.headers.items()
                if k.lower() not in STRIPPED_HEADERS
            }
            headers["X-Forwarded-For"] = flask_request.remote_addr or "unknown"
            headers["X-Forwarded-Host"] = flask_request.host
            headers["X-Forwarded-Proto"] = flask_request.scheme
            headers["X-Load-Balancer"] = "streaming-lb"

            body = flask_request.get_data()

            resp = requests.request(
                method=flask_request.method,
                url=target_url,
                headers=headers,
                data=body,
                timeout=instance.timeout_ms / 1000,
                allow_redirects=False,
            )

            elapsed_ms = (time.time() - start_time) * 1000

            self._registry.record_request(
                instance.service_name, instance.instance_id, elapsed_ms, True,
            )

            flask_response = Response(
                response=resp.content,
                status=resp.status_code,
            )
            for key, value in resp.headers.items():
                if key.lower() not in STRIPPED_HEADERS and key.lower() != "content-encoding":
                    flask_response.headers[key] = value

            return flask_response, resp.status_code

        finally:
            instance.active_connections -= 1

    def _select_instance(self, service_name: str) -> ServiceInstance | None:
        instances = self._registry.get_instances(service_name)
        if not instances:
            return None
        return self._strategy.select_instance(instances)

    def _select_degraded_fallback(self, service_name: str) -> ServiceInstance | None:
        instances = self._registry.get_instances(service_name)
        degraded = [i for i in instances if i.status == ServiceStatus.DEGRADED]
        if degraded:
            logger.info("Usando fallback DEGRADED para: %s", service_name)
            return degraded[0]
        return None

    def _select_any_instance(self, service_name: str) -> ServiceInstance | None:
        """Selecciona CUALQUIER instancia disponible, incluso UNHEALTHY.

        Útil como último recurso para que el proxy intente conectar
        y reporte el fallo real al Circuit Breaker.
        """
        instances = self._registry.get_instances(service_name)
        if instances:
            instance = instances[0]
            logger.info(
                "Último recurso: instancia %s (%s) para: %s",
                instance.instance_id, instance.status.value, service_name,
            )
            return instance
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
