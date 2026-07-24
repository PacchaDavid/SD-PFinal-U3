# =============================================================================
# Service Registry - Load Balancer
# =============================================================================
# Mantiene el registro de instancias de servicios backend disponibles,
# su estado de salud y proporciona la instancia a utilizar según
# la estrategia de balanceo configurada.
# =============================================================================

import logging
import time
from threading import RLock
from typing import Callable

from src.models import (
    ServiceInstance,
    ServiceStatus,
    BalancerStats,
    ProxyEventType,
)

logger = logging.getLogger("load-balancer.registry")


class ServiceRegistry:
    """Registro de servicios backend con tracking de salud.

    Almacena instancias de servicios, monitorea su estado,
    y expone métodos para obtener la mejor instancia disponible.
    """

    def __init__(
        self,
        services_config: dict,
        unhealthy_threshold: int = 3,
        on_event: Callable | None = None,
    ):
        self._services: dict[str, list[ServiceInstance]] = {}
        self._lock = RLock()
        self._on_event = on_event
        self._unhealthy_threshold = unhealthy_threshold

        # Inicializar servicios desde configuración
        self._init_from_config(services_config)

    def _init_from_config(self, services_config: dict) -> None:
        """Inicializa instancias desde la configuración YAML.

        Por ahora cada servicio tiene 1 instancia. En futuras fases
        se pueden añadir múltiples réplicas por servicio.
        """
        for name, svc in services_config.items():
            instance = ServiceInstance(
                service_name=name,
                instance_id=f"{name}-1",
                host=svc.get("host", f"{name}-service"),
                port=int(svc.get("port", 8080)),
                health_path=svc.get("health_path", "/actuator/health"),
                max_retries=int(svc.get("max_retries", 3)),
                timeout_ms=int(svc.get("timeout_ms", 5000)),
            )
            self._services[name] = [instance]
            logger.info(
                "Servicio registrado: %s → %s:%s",
                name, instance.host, instance.port,
            )

    # ------------------------------------------------------------------
    # Gestión de instancias
    # ------------------------------------------------------------------

    def get_instances(self, service_name: str) -> list[ServiceInstance]:
        """Obtiene todas las instancias de un servicio."""
        with self._lock:
            return list(self._services.get(service_name, []))

    def get_healthy_instances(self, service_name: str) -> list[ServiceInstance]:
        """Obtiene solo instancias saludables de un servicio."""
        with self._lock:
            return [
                inst for inst in self._services.get(service_name, [])
                if inst.status == ServiceStatus.HEALTHY
            ]

    def get_all_services(self) -> list[str]:
        """Lista todos los nombres de servicios registrados."""
        with self._lock:
            return list(self._services.keys())

    def get_instance(self, service_name: str, instance_id: str) -> ServiceInstance | None:
        """Obtiene una instancia específica por ID."""
        with self._lock:
            for inst in self._services.get(service_name, []):
                if inst.instance_id == instance_id:
                    return inst
            return None

    def update_health(
        self,
        service_name: str,
        instance_id: str,
        is_healthy: bool,
        response_time_ms: float = 0.0,
    ) -> ServiceInstance | None:
        """Actualiza el estado de salud de una instancia.

        Retorna la instancia actualizada o None si no existe.
        """
        old_status = None
        instance_copy = None

        with self._lock:
            instance = self.get_instance(service_name, instance_id)
            if not instance:
                return None

            old_status = instance.status
            instance.last_health_check = time.time()
            instance.last_response_time_ms = response_time_ms

            if is_healthy:
                instance.consecutive_failures = 0
                instance.status = ServiceStatus.HEALTHY
            else:
                instance.consecutive_failures += 1
                if instance.consecutive_failures >= self._unhealthy_threshold:
                    instance.status = ServiceStatus.UNHEALTHY
                else:
                    instance.status = ServiceStatus.DEGRADED

        # Emitir evento FUERA del lock para evitar bloqueos
        if old_status != instance.status and old_status is not None:
            self._emit_status_event(service_name, instance, old_status)

        return instance

    def record_request(
        self,
        service_name: str,
        instance_id: str,
        response_time_ms: float,
        success: bool,
    ) -> None:
        """Registra el resultado de una request a una instancia."""
        with self._lock:
            instance = self.get_instance(service_name, instance_id)
            if instance:
                instance.record_request(response_time_ms, success)

    # ------------------------------------------------------------------
    # Estadísticas
    # ------------------------------------------------------------------

    def get_stats(self) -> BalancerStats:
        """Obtiene estadísticas agregadas de todos los servicios."""
        with self._lock:
            stats = BalancerStats()
            healthy = 0
            unhealthy = 0
            degraded = 0
            total_req = 0
            total_succ = 0
            total_fail = 0
            total_time = 0.0
            total_instances = 0

            for name, instances in self._services.items():
                for inst in instances:
                    if inst.status == ServiceStatus.HEALTHY:
                        healthy += 1
                    elif inst.status == ServiceStatus.UNHEALTHY:
                        unhealthy += 1
                    else:
                        degraded += 1

                    total_req += inst.total_requests
                    total_fail += inst.failed_requests
                    total_time += inst.last_response_time_ms
                    total_instances += 1

                    # Requests por servicio
                    if name not in stats.requests_per_service:
                        stats.requests_per_service[name] = 0
                    stats.requests_per_service[name] += inst.total_requests

                total_succ = total_req - total_fail
                if total_instances > 0:
                    stats.avg_response_time_ms = total_time / total_instances

            stats.total_requests = total_req
            stats.successful_requests = total_succ
            stats.failed_requests = total_fail
            stats.services_healthy = healthy
            stats.services_unhealthy = unhealthy
            stats.services_degraded = degraded

            return stats

    def get_service_summary(self, service_name: str) -> dict | None:
        """Resumen de un servicio específico."""
        with self._lock:
            instances = self._services.get(service_name)
            if not instances:
                return None
            return {
                "service": service_name,
                "instances": [inst.to_dict() for inst in instances],
                "healthy_count": sum(
                    1 for i in instances if i.status == ServiceStatus.HEALTHY
                ),
                "total_count": len(instances),
            }

    def get_all_summaries(self) -> list[dict]:
        """Resumen de todos los servicios."""
        return [
            self.get_service_summary(svc)
            for svc in self.get_all_services()
        ]

    # ------------------------------------------------------------------
    # Eventos
    # ------------------------------------------------------------------

    def _emit_status_event(
        self,
        service_name: str,
        instance: ServiceInstance,
        old_status: ServiceStatus,
    ) -> None:
        if not self._on_event:
            return

        if instance.status == ServiceStatus.UNHEALTHY:
            event_type = ProxyEventType.BACKEND_MARKED_UNHEALTHY
            severity = "warning"
        elif instance.status == ServiceStatus.HEALTHY and old_status != ServiceStatus.HEALTHY:
            event_type = ProxyEventType.BACKEND_MARKED_HEALTHY
            severity = "info"
        else:
            event_type = ProxyEventType.BACKEND_MARKED_DEGRADED
            severity = "warning"

        self._on_event({
            "type": event_type.value,
            "service": service_name,
            "instance_id": instance.instance_id,
            "old_status": old_status.value,
            "new_status": instance.status.value,
            "consecutive_failures": instance.consecutive_failures,
            "severity": severity,
            "timestamp": time.time(),
        })
