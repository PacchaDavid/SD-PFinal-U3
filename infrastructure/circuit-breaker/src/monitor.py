# =============================================================================
# Monitor - Circuit Breaker
# =============================================================================
# Monitorea servicios periódicamente para detectar cambios de estado
# y evaluar si se deben activar los circuit breakers.
# =============================================================================

import logging
import threading
import time

from src.circuit import CircuitBreakerStateMachine

logger = logging.getLogger("circuit-breaker.monitor")


class CircuitBreakerMonitor:
    """Monitorea periódicamente el estado de los circuit breakers.

    Verifica timeouts de circuitos en OPEN, evalúa transiciones,
    y mantiene actualizadas las estadísticas globales.
    """

    def __init__(
        self,
        state_machine: CircuitBreakerStateMachine,
        check_interval: int = 5,
    ):
        self._state_machine = state_machine
        self._check_interval = check_interval
        self._running = False
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        """Inicia el ciclo de monitoreo en background."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._monitor_loop,
            name="cb-monitor",
            daemon=True,
        )
        self._thread.start()
        logger.info(
            "CircuitBreakerMonitor iniciado (intervalo=%ds)",
            self._check_interval,
        )

    def stop(self) -> None:
        """Detiene el ciclo de monitoreo."""
        self._running = False

    def _monitor_loop(self) -> None:
        """Loop principal de monitoreo."""
        while self._running:
            try:
                self._check_open_circuits()
            except Exception as e:
                logger.error("Error en monitoreo: %s", e)
            time.sleep(self._check_interval)

    def _check_open_circuits(self) -> None:
        """Verifica circuitos en OPEN para transicionar a HALF_OPEN.

        El check de timeout se maneja en is_request_allowed() cuando
        llega una request. Este método fuerza la verificación periódica
        para detectar timeouts incluso sin tráfico.
        """
        for cb in self._state_machine.get_all_circuits():
            if cb.is_open:
                # is_request_allowed maneja la transición si timeout expiró
                self._state_machine.is_request_allowed(cb.service_name)
