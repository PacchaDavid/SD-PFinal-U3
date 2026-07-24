import logging
import time
from typing import Callable

from src.db_manager import DatabaseManager
from src.models import ReplicaAck, ReplicationEntry, AckStatus, EntryStatus, ReplicaStatus

logger = logging.getLogger("replication.sync")


class ReplicaSync:
    """Sincroniza entradas de replicación a las réplicas.

    Para cada entrada, envía la operación a cada réplica secuencialmente,
    espera ACK (con timeout), y retorna los resultados.
    """

    def __init__(self, db_manager: DatabaseManager,
                 replica_timeout_ms: int = 3000,
                 retry_attempts: int = 3,
                 retry_delay_ms: int = 1000,
                 on_ack: Callable | None = None):
        self._db = db_manager
        self._timeout = replica_timeout_ms / 1000
        self._retry_attempts = retry_attempts
        self._retry_delay = retry_delay_ms / 1000
        self._on_ack = on_ack

    def sync_entry(self, entry: ReplicationEntry) -> dict:
        """Sincroniza una entrada a todas las réplicas.

        Args:
            entry: Entrada de replicación a sincronizar.

        Returns:
            Dict con resultados por réplica y si se alcanzó quorum.
        """
        replica_states = self._db.get_replica_states()
        acks = []
        success_count = 0

        # Parsear data si es string JSON
        import json
        row_data = json.loads(entry.data) if isinstance(entry.data, str) else entry.data

        for replica_id, state in sorted(replica_states.items()):
            ack = self._sync_to_replica(entry, replica_id, state, row_data)
            acks.append(ack.to_dict())

            if ack.status == AckStatus.ACKNOWLEDGED:
                success_count += 1

            # Actualizar entry con resultados
            entry.ack_count = success_count

            if self._on_ack:
                self._on_ack(entry, ack)

        return {
            "entry_id": entry.id,
            "acks": acks,
            "success_count": success_count,
            "total_replicas": len(replica_states),
            "quorum_reached": success_count >= entry.total_replicas // 2 + 1,
        }

    def _sync_to_replica(self, entry: ReplicationEntry, replica_id: int,
                         state, row_data: dict) -> ReplicaAck:
        """Sincroniza una entrada a una réplica específica con reintentos."""
        ack = ReplicaAck(
            entry_id=entry.id,
            replica_id=replica_id,
            host=state.host,
            port=state.port,
        )

        for attempt in range(self._retry_attempts + 1):
            try:
                result = self._db.execute_on_replica(
                    replica_id, entry.operation, entry.table_name, row_data,
                )

                if result.get("status") == "ACK":
                    ack.status = AckStatus.ACKNOWLEDGED
                    ack.response_time_ms = result.get("response_time_ms", 0)
                    logger.debug("ACK de réplica %d para entry %s (%.0fms)",
                                 replica_id, entry.id, ack.response_time_ms)
                    return ack

                # Error
                ack.status = AckStatus.ERROR
                ack.error = result.get("error", "Error desconocido")
                ack.response_time_ms = result.get("response_time_ms", 0)

                logger.warning("Error réplica %d (intento %d/%d): %s",
                               replica_id, attempt + 1,
                               self._retry_attempts + 1, ack.error)

            except Exception as e:
                ack.status = AckStatus.ERROR
                ack.error = str(e)
                logger.warning("Excepción réplica %d (intento %d/%d): %s",
                               replica_id, attempt + 1,
                               self._retry_attempts + 1, e)

            # Si hay más intentos, esperar antes de reintentar
            if attempt < self._retry_attempts:
                time.sleep(self._retry_delay * (attempt + 1))

        # Timeout después de agotar intentos
        if ack.status != AckStatus.ACKNOWLEDGED:
            ack.status = AckStatus.TIMEOUT
            if not ack.error:
                ack.error = f"Timeout tras {self._retry_attempts + 1} intentos"

        return ack

    def sync_batch(self, entries: list[ReplicationEntry]) -> list[dict]:
        """Sincroniza un lote de entradas.

        Procesa entradas en orden, cada una a todas las réplicas.
        """
        results = []
        for entry in entries:
            result = self.sync_entry(entry)
            results.append(result)
        return results
