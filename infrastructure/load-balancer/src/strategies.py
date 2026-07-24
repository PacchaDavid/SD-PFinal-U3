# =============================================================================
# Load Balancing Strategies - Load Balancer
# =============================================================================
# Implementaciones de estrategias de balanceo de carga.
# =============================================================================

import random
from abc import ABC, abstractmethod
from threading import Lock
from typing import List, Optional

from src.models import ServiceInstance, ServiceStatus


class BalanceStrategy(ABC):
    """Strategy abstracta para balanceo de carga."""

    @abstractmethod
    def select_instance(self, instances: list[ServiceInstance]) -> ServiceInstance | None:
        """Selecciona una instancia de la lista de disponibles."""
        pass


class RoundRobinStrategy(BalanceStrategy):
    """Round-Robin: distribuye requests equitativamente.

    Itera secuencialmente sobre las instancias saludables.
    Simple, predecible, y justo para cargas homogéneas.
    """

    def __init__(self):
        self._index: dict[str, int] = {}
        self._lock = Lock()

    def select_instance(self, instances: list[ServiceInstance]) -> ServiceInstance | None:
        healthy = [i for i in instances if i.status == ServiceStatus.HEALTHY]
        if not healthy:
            return None

        # Usar el nombre del primer servicio como key
        service_key = healthy[0].service_name if healthy else "default"

        with self._lock:
            if service_key not in self._index:
                self._index[service_key] = 0

            idx = self._index[service_key] % len(healthy)
            self._index[service_key] = idx + 1
            return healthy[idx]


class LeastConnectionsStrategy(BalanceStrategy):
    """Menos Conexiones: elige la instancia con menos conexiones activas.

    Útil cuando las requests tienen cargas variables.
    """

    def select_instance(self, instances: list[ServiceInstance]) -> ServiceInstance | None:
        healthy = [i for i in instances if i.status == ServiceStatus.HEALTHY]
        if not healthy:
            return None

        # Elegir la instancia con menos conexiones activas
        return min(healthy, key=lambda i: i.active_connections)


class RandomStrategy(BalanceStrategy):
    """Aleatorio: elige una instancia al azar.

    Simple y efectivo para cargas homogéneas con muchas instancias.
    """

    def select_instance(self, instances: list[ServiceInstance]) -> ServiceInstance | None:
        healthy = [i for i in instances if i.status == ServiceStatus.HEALTHY]
        if not healthy:
            return None
        return random.choice(healthy)


class StrategyFactory:
    """Factory para crear estrategias de balanceo."""

    _strategies = {
        "round-robin": RoundRobinStrategy,
        "least-connections": LeastConnectionsStrategy,
        "random": RandomStrategy,
    }

    @classmethod
    def create(cls, name: str) -> BalanceStrategy:
        """Crea una estrategia por nombre.

        Args:
            name: Nombre de la estrategia (round-robin, least-connections, random).

        Returns:
            Instancia de la estrategia.

        Raises:
            ValueError: Si la estrategia no está soportada.
        """
        strategy_cls = cls._strategies.get(name)
        if not strategy_cls:
            supported = ", ".join(cls._strategies.keys())
            raise ValueError(
                f"Estrategia '{name}' no soportada. "
                f"Soportadas: {supported}"
            )
        return strategy_cls()
