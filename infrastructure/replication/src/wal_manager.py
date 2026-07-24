import json
import logging
import threading
import time
from typing import Callable

from src.db_manager import DatabaseManager
from src.replica_sync import ReplicaSync
from src.models import (
    ReplicationEntry, EntryStatus, ReplicationEvent,
    ReplicationStats,
)

logger = logging.getLogger("replication.wal")


class WALManager:
    """Write-Ahead Log Manager.

    Procesa el log de replicación:
    1. Polling periódico de la tabla replication_log en primary DB
    2. Propagación a réplicas vía ReplicaSync
    3. Actualización de estado en primary DB
    4. Publicación de eventos a Redis/Event Monitor
    """

    def __init__(self, db_manager: DatabaseManager,
                 replica_sync: ReplicaSync,
                 poll_interval_ms: int = 500,
                 max_batch_size: int = 100,
                 quorum_min: int = 2,
                 service_name: str = "default",
                 on_event: Callable | None = None):
        self._db = db_manager
        self._sync = replica_sync
        self._poll_interval = poll_interval_ms / 1000
        self._max_batch = max_batch_size
        self._quorum_min = quorum_min
        self._service_name = service_name
        self._on_event = on_event

        self._running = False
        self._thread: threading.Thread | None = None

        # Cola en memoria para entradas recibidas vía API
        self._incoming_queue: list[ReplicationEntry] = []
        self._queue_lock = threading.Lock()

        # Estadísticas
        self._total_processed = 0
        self._total_acks = 0
        self._total_errors = 0
        self._start_time = time.time()

    # ------------------------------------------------------------------
    # Cola de Entrada (REST API)
    # ------------------------------------------------------------------

    def enqueue_entry(self, entry: ReplicationEntry) -> None:
        """Agrega una entrada a la cola (desde API REST)."""
        with self._queue_lock:
            self._incoming_queue.append(entry)

        logger.debug("Entry encolada: %s [%s %s.%s]",
                     entry.id, entry.operation, entry.table_name, entry.record_id)

    # ------------------------------------------------------------------
    # Ciclo de Procesamiento
    # ------------------------------------------------------------------

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._process_loop,
            name="wal-manager", daemon=True,
        )
        self._thread.start()
        logger.info("WALManager iniciado (poll=%sms, batch=%d, quorum=%d)",
                     self._poll_interval * 1000, self._max_batch, self._quorum_min)

    def stop(self) -> None:
        self._running = False

    def _process_loop(self) -> None:
        while self._running:
            try:
                # 1. Procesar cola en memoria (API)
                self._flush_incoming_queue()

                # 2. Polling de la tabla primary DB
                self._poll_primary_db()

            except Exception as e:
                logger.error("Error en ciclo WAL: %s", e, exc_info=True)

            time.sleep(self._poll_interval)

    def _flush_incoming_queue(self) -> None:
        """Procesa entradas de la cola de API y las persiste en primary DB."""
        entries = []
        with self._queue_lock:
            if not self._incoming_queue:
                return
            entries = self._incoming_queue[:self._max_batch]
            self._incoming_queue = self._incoming_queue[self._max_batch:]

        for entry in entries:
            # Persistir en primary DB
            self._db.insert_entry(entry.to_dict())
            logger.debug("Entry persistida en primary DB: %s", entry.id)

    def _poll_primary_db(self) -> None:
        """Obtiene entradas pendientes de la primary DB y las procesa."""
        entries_data = self._db.get_pending_entries(limit=self._max_batch)
        if not entries_data:
            return

        entries = [self._dict_to_entry(e) for e in entries_data]

        # Marcar como PROPAGATING
        for entry in entries:
            self._db.update_entry_status(entry.id, "PROPAGATING")

        logger.info("Procesando %d entradas pendientes", len(entries))

        # Sincronizar a réplicas
        results = self._sync.sync_batch(entries)

        # Actualizar estados
        for entry, result in zip(entries, results):
            self._update_entry_result(entry, result)

    def _update_entry_result(self, entry: ReplicationEntry,
                              result: dict) -> None:
        """Actualiza estado de una entry según resultado de sincronización."""
        success_count = result.get("success_count", 0)
        total = result.get("total_replicas", 3)
        quorum = success_count >= min(self._quorum_min, (total // 2 + 1))

        if success_count == total:
            status = "REPLICATED"
            severity = "info"
            msg = f"Entry replicada exitosamente ({success_count}/{total})"
        elif quorum:
            status = "PARTIAL"
            severity = "warning"
            msg = f"Entry replicada parcialmente ({success_count}/{total})"
        else:
            status = "FAILED"
            severity = "error"
            msg = f"Entry NO replicada ({success_count}/{total})"

        # Actualizar en primary DB
        self._db.update_entry_status(entry.id, status, success_count,
                                     error=msg if status == "FAILED" else "")

        # Estadísticas
        self._total_processed += 1
        if status == "REPLICATED" or status == "PARTIAL":
            self._total_acks += success_count
        else:
            self._total_errors += 1

        # Emitir evento
        self._emit_replication_event(
            type=f"replication.{status.lower()}",
            entry_id=entry.id,
            message=msg,
            severity=severity,
            metadata=result,
        )

        logger.info("Entry %s → %s (%d/%d réplicas)",
                     entry.id, status, success_count, total)

    # ------------------------------------------------------------------
    # Utilidades
    # ------------------------------------------------------------------

    @staticmethod
    def _dict_to_entry(data: dict) -> ReplicationEntry:
        return ReplicationEntry(
            id=data.get("id", ""),
            operation=data.get("operation", "INSERT"),
            table_name=data.get("table_name", ""),
            record_id=data.get("record_id", ""),
            service=data.get("service", ""),
            data=data.get("data", "{}"),
            status=EntryStatus(data.get("status", "PENDING")),
            created_at=float(data.get("created_at", time.time())),
            propagated_at=float(data.get("propagated_at", 0)),
            ack_count=int(data.get("ack_count", 0)),
            total_replicas=int(data.get("total_replicas", 3)),
            error=data.get("error", ""),
            retry_count=int(data.get("retry_count", 0)),
        )

    # ------------------------------------------------------------------
    # Eventos
    # ------------------------------------------------------------------

    def _emit_replication_event(self, type: str, entry_id: str = "",
                                 message: str = "", severity: str = "info",
                                 metadata: dict | None = None) -> None:
        if self._on_event:
            event = ReplicationEvent(
                type=type, entry_id=entry_id,
                service=self._service_name, message=message,
                severity=severity, metadata=metadata or {},
            )
            self._on_event(event)

    # ------------------------------------------------------------------
    # Estadísticas
    # ------------------------------------------------------------------

    def get_stats(self) -> ReplicationStats:
        """Estadísticas del WAL Manager."""
        counts = self._db.get_entry_count_by_status()
        return ReplicationStats(
            service_name=self._service_name,
            total_entries=self._total_processed,
            pending_entries=counts.get("PENDING", 0) + counts.get("PROPAGATING", 0),
            replicated_entries=counts.get("REPLICATED", 0),
            partial_entries=counts.get("PARTIAL", 0),
            failed_entries=counts.get("FAILED", 0),
            avg_ack_time_ms=0.0,
            total_replicas=len(self._db.get_replica_states()),
            healthy_replicas=sum(
                1 for s in self._db.get_replica_states().values()
                if s.is_healthy
            ),
            unhealthy_replicas=sum(
                1 for s in self._db.get_replica_states().values()
                if not s.is_healthy
            ),
            queue_depth=len(self._incoming_queue),
            uptime_seconds=time.time() - self._start_time,
            writes_count=self._total_processed,
            reads_count=0,
        )
