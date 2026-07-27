# =============================================================================
# Heartbeat Monitor - Event Monitor
# =============================================================================
# Monitorea heartbeats de nodos y detecta fallos.
# Ejecuta un ciclo cada N segundos verificando heartbeats recibidos.
# Si un nodo supera el timeout sin heartbeat, se marca como INACTIVE.
# =============================================================================

import logging
import threading
import time
from typing import Callable

from src.models import HeartbeatData, NodeInfo, NodeStatus, SystemEvent, EventType

logger = logging.getLogger("event-monitor.heartbeat")


class HeartbeatMonitor:
    """Monitor de heartbeats que detecta nodos caídos y genera eventos.

    Attributes:
        check_interval: Segundos entre cada ciclo de verificación.
        timeout_seconds: Segundos sin heartbeat para considerar fallo.
        max_missed: Máximo de heartbeats perdidos antes de marcar INACTIVE.
    """

    def __init__(
        self,
        check_interval: int = 2,
        timeout_seconds: int = 10,
        max_missed: int = 3,
        on_node_status_change: Callable | None = None,
        on_event: Callable | None = None,
    ):
        self.check_interval = check_interval
        self.timeout_seconds = timeout_seconds
        self.max_missed = max_missed
        self._on_node_status_change = on_node_status_change
        self._on_event = on_event

        self._nodes: dict[str, NodeInfo] = {}
        self._lock = threading.Lock()
        self._running = False
        self._thread: threading.Thread | None = None
        self._total_heartbeats = 0

    # ------------------------------------------------------------------
    # Gestión de nodos
    # ------------------------------------------------------------------

    def register_node(self, heartbeat: HeartbeatData) -> NodeInfo:
        """Registra o actualiza un nodo a partir de un heartbeat.

        Primero busca por node_id. Si no lo encuentra, busca un nodo INACTIVE
        con el mismo node_name + service_name para "resucitarlo" (evita
        duplicados cuando un contenedor se reinicia y obtiene un nuevo node_id).
        """
        with self._lock:
            if heartbeat.node_id in self._nodes:
                node = self._nodes[heartbeat.node_id]
                was_inactive = node.status == NodeStatus.INACTIVE
                node.last_heartbeat = heartbeat.timestamp
                node.heartbeat_count += 1
                node.missed_heartbeats = 0
                node.status = NodeStatus.ACTIVE
                node.cpu_percent = heartbeat.cpu_percent
                node.memory_percent = heartbeat.memory_percent
                node.uptime_seconds = heartbeat.uptime_seconds

                if was_inactive:
                    logger.info(
                        "Nodo REACTIVADO (mismo node_id): %s (%s)",
                        node.node_name, node.service_name,
                    )
            else:
                # Buscar nodo INACTIVE con mismo node_name + service_name
                existing = self._find_inactive_by_name(heartbeat.node_name, heartbeat.service_name)
                if existing is not None:
                    # Resucitar nodo existente: actualizar node_id y reactivar
                    old_id = existing.node_id
                    node = existing
                    node.node_id = heartbeat.node_id
                    node.last_heartbeat = heartbeat.timestamp
                    node.heartbeat_count += 1
                    node.missed_heartbeats = 0
                    node.status = NodeStatus.ACTIVE
                    node.cpu_percent = heartbeat.cpu_percent
                    node.memory_percent = heartbeat.memory_percent
                    node.uptime_seconds = heartbeat.uptime_seconds
                    node.machine_id = heartbeat.machine_id

                    # Transferir a la nueva clave y eliminar la vieja
                    self._nodes[heartbeat.node_id] = node
                    if old_id in self._nodes and old_id != heartbeat.node_id:
                        del self._nodes[old_id]

                    logger.info(
                        "Nodo REACTIVADO (nuevo node_id): %s (%s) - "
                        "node_id %s → %s",
                        node.node_name, node.service_name,
                        old_id, heartbeat.node_id,
                    )
                    self._emit_event(
                        EventType.NODE_STATUS_CHANGE,
                        source="heartbeat-monitor",
                        node_id=heartbeat.node_id,
                        message=(
                            f"Nodo {node.node_name} ({node.service_name}) "
                            f"reactivado con nuevo node_id tras reinicio"
                        ),
                        severity="info",
                        metadata={
                            "old_node_id": old_id,
                            "new_node_id": heartbeat.node_id,
                        },
                    )
                else:
                    node = NodeInfo(
                        node_id=heartbeat.node_id,
                        node_name=heartbeat.node_name,
                        service_name=heartbeat.service_name,
                        machine_id=heartbeat.machine_id,
                        status=NodeStatus.ACTIVE,
                        last_heartbeat=heartbeat.timestamp,
                        heartbeat_count=1,
                        missed_heartbeats=0,
                        cpu_percent=heartbeat.cpu_percent,
                        memory_percent=heartbeat.memory_percent,
                        uptime_seconds=heartbeat.uptime_seconds,
                    )
                    self._nodes[heartbeat.node_id] = node
                    self._emit_event(
                        EventType.NODE_REGISTERED,
                        source="heartbeat-monitor",
                        node_id=node.node_id,
                        message=f"Nodo registrado: {node.node_name} ({node.service_name})",
                        metadata=node.to_dict(),
                    )

            self._total_heartbeats += 1
            return node

    def _find_inactive_by_name(self, node_name: str, service_name: str) -> NodeInfo | None:
        """Busca un nodo INACTIVE que coincida con node_name y service_name.

        Útil cuando un nodo se reinicia y obtiene un nuevo node_id (por ej.
        cambio de hostname en Docker). Así evitamos duplicados.
        """
        for node in self._nodes.values():
            if (node.status == NodeStatus.INACTIVE
                    and node.node_name == node_name
                    and node.service_name == service_name):
                return node
        return None

    def process_heartbeat(self, data: dict) -> NodeInfo | None:
        """Procesa un heartbeat proveniente de Redis Pub/Sub.

        Args:
            data: Dict con datos del heartbeat (debe incluir node_id).

        Returns:
            NodeInfo del nodo actualizado, o None si error.
        """
        try:
            hb = HeartbeatData(
                node_id=data.get("node_id", ""),
                node_name=data.get("node_name", "unknown"),
                service_name=data.get("service_name", "unknown"),
                machine_id=int(data.get("machine_id", 0)),
                timestamp=data.get("timestamp", time.time()),
                status=data.get("status", "active"),
                cpu_percent=float(data.get("cpu_percent", 0.0)),
                memory_percent=float(data.get("memory_percent", 0.0)),
                uptime_seconds=float(data.get("uptime_seconds", 0.0)),
                custom_metrics=data.get("custom_metrics", {}),
            )
            return self.register_node(hb)
        except (ValueError, TypeError) as e:
            logger.error("Error procesando heartbeat: %s - data: %s", e, data)
            return None

    def remove_node(self, node_id: str) -> bool:
        """Elimina un nodo del monitor."""
        with self._lock:
            if node_id in self._nodes:
                node = self._nodes.pop(node_id)
                self._emit_event(
                    EventType.NODE_REMOVED,
                    source="heartbeat-monitor",
                    node_id=node_id,
                    message=f"Nodo eliminado: {node.node_name}",
                )
                return True
            return False

    # ------------------------------------------------------------------
    # Ciclo de verificación
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Inicia el ciclo de verificación de heartbeats en background."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._check_loop,
            name="heartbeat-monitor",
            daemon=True,
        )
        self._thread.start()
        logger.info(
            "HeartbeatMonitor iniciado (intervalo=%ds, timeout=%ds)",
            self.check_interval,
            self.timeout_seconds,
        )

    def stop(self) -> None:
        """Detiene el ciclo de verificación."""
        self._running = False

    def _check_loop(self) -> None:
        """Loop que verifica periodicamente el estado de los nodos."""
        while self._running:
            try:
                self._check_nodes()
            except Exception as e:
                logger.error("Error en ciclo de heartbeats: %s", e)
            time.sleep(self.check_interval)

    def _check_nodes(self) -> None:
        """Verifica cada nodo y actualiza estado según último heartbeat."""
        now = time.time()
        with self._lock:
            for node_id, node in list(self._nodes.items()):
                elapsed = now - node.last_heartbeat
                if elapsed > self.timeout_seconds and node.status == NodeStatus.ACTIVE:
                    node.missed_heartbeats += 1
                    if node.missed_heartbeats >= self.max_missed:
                        old_status = node.status
                        node.status = NodeStatus.INACTIVE
                        logger.warning(
                            "Nodo INACTIVE: %s (%s) - %d heartbeats perdidos",
                            node.node_name,
                            node.service_name,
                            node.missed_heartbeats,
                        )
                        self._emit_event(
                            EventType.NODE_STATUS_CHANGE,
                            source="heartbeat-monitor",
                            node_id=node_id,
                            message=(
                                f"Nodo {node.node_name} ({node.service_name}) "
                                f"cambió a INACTIVE tras {node.missed_heartbeats} "
                                f"heartbeats perdidos"
                            ),
                            severity="warning",
                            metadata={
                                "old_status": old_status.value,
                                "new_status": NodeStatus.INACTIVE.value,
                                "elapsed_seconds": elapsed,
                                "missed_count": node.missed_heartbeats,
                            },
                        )
                        if self._on_node_status_change:
                            self._on_node_status_change(node_id, old_status, node.status)
                elif (
                    elapsed <= self.timeout_seconds
                    and node.status == NodeStatus.INACTIVE
                ):
                    old_status = node.status
                    node.status = NodeStatus.ACTIVE
                    node.missed_heartbeats = 0
                    logger.info(
                        "Nodo RESTAURADO: %s (%s)",
                        node.node_name,
                        node.service_name,
                    )
                    self._emit_event(
                        EventType.NODE_STATUS_CHANGE,
                        source="heartbeat-monitor",
                        node_id=node_id,
                        message=(
                            f"Nodo {node.node_name} ({node.service_name}) "
                            f"restaurado a ACTIVE"
                        ),
                        metadata={
                            "old_status": old_status.value,
                            "new_status": NodeStatus.ACTIVE.value,
                        },
                    )
                    if self._on_node_status_change:
                        self._on_node_status_change(node_id, old_status, node.status)

    # ------------------------------------------------------------------
    # Consultas
    # ------------------------------------------------------------------

    def get_node(self, node_id: str) -> NodeInfo | None:
        """Obtiene información de un nodo."""
        with self._lock:
            return self._nodes.get(node_id)

    def get_all_nodes(self) -> list[NodeInfo]:
        """Obtiene todos los nodos registrados."""
        with self._lock:
            return list(self._nodes.values())

    def get_active_nodes(self) -> list[NodeInfo]:
        """Obtiene solo nodos activos."""
        with self._lock:
            return [n for n in self._nodes.values() if n.status == NodeStatus.ACTIVE]

    def get_inactive_nodes(self) -> list[NodeInfo]:
        """Obtiene solo nodos inactivos."""
        with self._lock:
            return [n for n in self._nodes.values() if n.status == NodeStatus.INACTIVE]

    def get_node_count(self) -> int:
        """Cantidad total de nodos registrados."""
        with self._lock:
            return len(self._nodes)

    def get_active_count(self) -> int:
        """Cantidad de nodos activos."""
        with self._lock:
            return sum(1 for n in self._nodes.values() if n.status == NodeStatus.ACTIVE)

    def get_total_heartbeats(self) -> int:
        """Total de heartbeats recibidos desde el inicio."""
        with self._lock:
            return self._total_heartbeats

    def get_summary(self) -> dict:
        """Resumen del estado del heartbeat monitor."""
        with self._lock:
            return {
                "total_nodes": len(self._nodes),
                "active_nodes": sum(
                    1 for n in self._nodes.values() if n.status == NodeStatus.ACTIVE
                ),
                "inactive_nodes": sum(
                    1 for n in self._nodes.values() if n.status == NodeStatus.INACTIVE
                ),
                "total_heartbeats": self._total_heartbeats,
                "nodes": [n.to_dict() for n in self._nodes.values()],
            }

    # ------------------------------------------------------------------
    # Eventos internos
    # ------------------------------------------------------------------

    def _emit_event(
        self,
        event_type: EventType,
        source: str = "heartbeat-monitor",
        node_id: str = "",
        message: str = "",
        severity: str = "info",
        metadata: dict | None = None,
    ) -> None:
        if self._on_event:
            event = SystemEvent(
                type=event_type.value,
                source=source,
                node_id=node_id,
                message=message,
                severity=severity,
                metadata=metadata or {},
            )
            self._on_event(event)
