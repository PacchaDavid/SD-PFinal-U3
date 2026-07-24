import logging
import threading
import time
from typing import Callable

from src.db_manager import DatabaseManager
from src.models import ReplicaStatus

logger = logging.getLogger("replication.recovery")


class RecoveryManager:
    """Gestiona la recuperación automática de réplicas caídas.

    Monitorea réplicas periódicamente. Cuando una réplica se recupera,
    reproduce las operaciones pendientes desde la primary DB.
    """

    def __init__(self, db_manager: DatabaseManager,
                 health_check_interval: int = 2,
                 catch_up_batch_size: int = 50,
                 service_name: str = "default",
                 on_status_change: Callable | None = None):
        self._db = db_manager
        self._health_interval = health_check_interval
        self._catch_up_batch = catch_up_batch_size
        self._service_name = service_name
        self._on_status_change = on_status_change

        self._running = False
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._recovery_loop,
            name="recovery-manager", daemon=True,
        )
        self._thread.start()
        logger.info("RecoveryManager iniciado (health_check=%ds)", self._health_interval)

    def stop(self) -> None:
        self._running = False

    def _recovery_loop(self) -> None:
        while self._running:
            try:
                self._check_and_recover()
            except Exception as e:
                logger.error("Error en recovery loop: %s", e)
            time.sleep(self._health_interval)

    def _check_and_recover(self) -> None:
        """Verifica salud de réplicas y recupera las que están caídas."""
        replica_states = self._db.get_replica_states()

        for replica_id, state in replica_states.items():
            old_status = state.status

            # Verificar salud
            is_healthy = self._db.check_replica_health(replica_id)

            if is_healthy and old_status in (ReplicaStatus.UNHEALTHY,
                                              ReplicaStatus.UNKNOWN):
                logger.info("Réplica %d recuperada, iniciando catch-up", replica_id)
                self._catch_up(replica_id)
                state.is_pending_recovery = False

            elif not is_healthy and old_status == ReplicaStatus.HEALTHY:
                logger.warning("Réplica %d CAÍDA (%s:%s)",
                               replica_id, state.host, state.port)
                state.is_pending_recovery = True

    def _catch_up(self, replica_id: int) -> None:
        """Reproduce operaciones faltantes en una réplica recuperada."""
        try:
            entries_data = self._db.get_pending_entries(limit=self._catch_up_batch)
            if not entries_data:
                return

            for entry_data in entries_data:
                result = self._db.execute_on_replica(
                    replica_id, entry_data.get("operation", "INSERT"),
                    entry_data.get("table_name", ""),
                    entry_data.get("data", "{}"),
                )
                if result.get("status") != "ACK":
                    logger.warning("Catch-up réplica %d falló: %s",
                                   replica_id, result.get("error"))

            logger.info("Catch-up completado para réplica %d (%d entries)",
                        replica_id, len(entries_data))

        except Exception as e:
            logger.error("Error en catch-up réplica %d: %s", replica_id, e)
