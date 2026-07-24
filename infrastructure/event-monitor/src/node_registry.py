# =============================================================================
# Node Registry - Event Monitor
# =============================================================================
# Gestiona el registro, autenticación y ciclo de vida de los nodos.
# Mantiene un registro persistente en Redis de todos los nodos conocidos.
# =============================================================================

import logging
import time
from typing import Callable

from src.models import NodeInfo, NodeStatus, SystemEvent, EventType
from src.redis_client import RedisClient

logger = logging.getLogger("event-monitor.registry")


class NodeRegistry:
    """Registro central de nodos del sistema distribuido.

    Persiste el estado de nodos en Redis y coordina con el
    HeartbeatMonitor para mantener el estado actualizado.
    """

    REDIS_NODES_KEY = "streaming:nodes"
    REDIS_REGISTERED_KEY = "streaming:registered_nodes"

    def __init__(
        self,
        redis: RedisClient,
        auto_remove_minutes: int = 5,
        on_node_status_change: Callable | None = None,
        on_event: Callable | None = None,
    ):
        self._redis = redis
        self._auto_remove_minutes = auto_remove_minutes
        self._on_node_status_change = on_node_status_change
        self._on_event = on_event

    # ------------------------------------------------------------------
    # Registro de nodos
    # ------------------------------------------------------------------

    def register_node(
        self,
        node_id: str,
        node_name: str,
        service_name: str,
        machine_id: int,
        host: str = "",
        port: int = 0,
        tags: dict | None = None,
    ) -> NodeInfo:
        """Registra un nuevo nodo o actualiza uno existente.

        Args:
            node_id: Identificador único del nodo.
            node_name: Nombre legible del nodo.
            service_name: Nombre del servicio (usuarios, pagos, etc).
            machine_id: ID de la máquina física (1-5).
            host: Host/IP del nodo.
            port: Puerto del servicio.
            tags: Metadatos adicionales.

        Returns:
            NodeInfo del nodo registrado.
        """
        now = time.time()
        node = NodeInfo(
            node_id=node_id,
            node_name=node_name,
            service_name=service_name,
            machine_id=machine_id,
            host=host,
            port=port,
            status=NodeStatus.ACTIVE,
            last_heartbeat=now,
            first_seen=now,
            heartbeat_count=0,
            tags=tags or {},
        )

        # Persistir en Redis
        self._save_node(node)

        self._emit_event(
            EventType.NODE_REGISTERED,
            source="node-registry",
            node_id=node_id,
            message=f"Nodo registrado: {node_name} (Máquina {machine_id})",
            metadata=node.to_dict(),
        )

        logger.info(
            "Nodo registrado: %s | servicio=%s | máquina=%d",
            node_name,
            service_name,
            machine_id,
        )
        return node

    def unregister_node(self, node_id: str) -> bool:
        """Elimina un nodo del registro."""
        node = self.get_node(node_id)
        if node:
            self._redis.hset_json(self.REDIS_NODES_KEY, node_id, {
                **node.to_dict(),
                "status": NodeStatus.REMOVED.value,
                "removed_at": time.time(),
            })

            self._emit_event(
                EventType.NODE_UNREGISTERED,
                source="node-registry",
                node_id=node_id,
                message=f"Nodo dado de baja: {node.node_name}",
                severity="warning",
                metadata=node.to_dict(),
            )
            logger.info("Nodo dado de baja: %s", node_id)
            return True
        return False

    def get_node(self, node_id: str) -> NodeInfo | None:
        """Obtiene un nodo del registro."""
        data = self._redis.hget_json(self.REDIS_NODES_KEY, node_id)
        if data:
            return NodeInfo(
                node_id=data.get("node_id", node_id),
                node_name=data.get("node_name", ""),
                service_name=data.get("service_name", ""),
                machine_id=data.get("machine_id", 0),
                host=data.get("host", ""),
                port=data.get("port", 0),
                status=NodeStatus(data.get("status", "unknown")),
                last_heartbeat=data.get("last_heartbeat", 0.0),
                first_seen=data.get("first_seen", 0.0),
                heartbeat_count=data.get("heartbeat_count", 0),
                missed_heartbeats=data.get("missed_heartbeats", 0),
                cpu_percent=data.get("cpu_percent", 0.0),
                memory_percent=data.get("memory_percent", 0.0),
                uptime_seconds=data.get("uptime_seconds", 0.0),
                tags=data.get("tags", {}),
            )
        return None

    def get_all_nodes(self) -> list[NodeInfo]:
        """Obtiene todos los nodos registrados."""
        raw_nodes = self._redis.hgetall_json(self.REDIS_NODES_KEY)
        nodes = []
        for node_id, data in raw_nodes.items():
            try:
                nodes.append(NodeInfo(
                    node_id=data.get("node_id", node_id),
                    node_name=data.get("node_name", ""),
                    service_name=data.get("service_name", ""),
                    machine_id=int(data.get("machine_id", 0)),
                    host=data.get("host", ""),
                    port=int(data.get("port", 0)),
                    status=NodeStatus(data.get("status", "unknown")),
                    last_heartbeat=float(data.get("last_heartbeat", 0.0)),
                    first_seen=float(data.get("first_seen", 0.0)),
                    heartbeat_count=int(data.get("heartbeat_count", 0)),
                    missed_heartbeats=int(data.get("missed_heartbeats", 0)),
                    cpu_percent=float(data.get("cpu_percent", 0.0)),
                    memory_percent=float(data.get("memory_percent", 0.0)),
                    uptime_seconds=float(data.get("uptime_seconds", 0.0)),
                    tags=data.get("tags", {}),
                ))
            except (ValueError, KeyError) as e:
                logger.warning("Error parseando nodo %s: %s", node_id, e)
        return nodes

    def get_nodes_by_machine(self, machine_id: int) -> list[NodeInfo]:
        """Obtiene nodos de una máquina específica."""
        return [n for n in self.get_all_nodes() if n.machine_id == machine_id]

    def get_nodes_by_service(self, service_name: str) -> list[NodeInfo]:
        """Obtiene nodos de un servicio específico."""
        return [n for n in self.get_all_nodes() if n.service_name == service_name]

    def update_node_status(
        self, node_id: str, new_status: NodeStatus, metadata: dict | None = None
    ) -> NodeInfo | None:
        """Actualiza el estado de un nodo y persiste el cambio."""
        node = self.get_node(node_id)
        if not node:
            return None

        old_status = node.status
        node.status = new_status

        if metadata:
            node.tags.update(metadata)

        self._save_node(node)

        if old_status != new_status:
            self._emit_event(
                EventType.NODE_STATUS_CHANGE,
                source="node-registry",
                node_id=node_id,
                message=(
                    f"Nodo {node.node_name} cambió: "
                    f"{old_status.value} → {new_status.value}"
                ),
                severity="warning" if new_status == NodeStatus.INACTIVE else "info",
                metadata={
                    "old_status": old_status.value,
                    "new_status": new_status.value,
                    **node.to_dict(),
                },
            )
            if self._on_node_status_change:
                self._on_node_status_change(node_id, old_status, new_status)

        return node

    # ------------------------------------------------------------------
    # Persistencia
    # ------------------------------------------------------------------

    def _save_node(self, node: NodeInfo) -> None:
        """Persiste un nodo en Redis."""
        self._redis.hset_json(self.REDIS_NODES_KEY, node.node_id, node.to_dict())
        # Mantener un set de nodos registrados por machine_id
        self._redis.set_json(
            f"{self.REDIS_REGISTERED_KEY}:{node.machine_id}:{node.node_id}",
            node.to_dict(),
            ttl=3600,
        )

    # ------------------------------------------------------------------
    # Limpieza
    # ------------------------------------------------------------------

    def cleanup_stale_nodes(self) -> int:
        """Elimina nodos inactivos que superaron el tiempo de auto-remoción.

        Maneja dos casos:
        - Nodos con status REMOVED: se eliminan definitivamente.
        - Nodos con status INACTIVE: se marcan como REMOVED si superan
          el tiempo de auto-remoción sin heartbeats.

        Returns:
            Cantidad de nodos eliminados.
        """
        now = time.time()
        removed = 0
        auto_remove_seconds = self._auto_remove_minutes * 60

        for node in self.get_all_nodes():
            elapsed = now - node.last_heartbeat
            should_remove = False

            if node.status == NodeStatus.REMOVED:
                if elapsed > auto_remove_seconds:
                    should_remove = True
            elif node.status == NodeStatus.INACTIVE:
                if elapsed > auto_remove_seconds:
                    should_remove = True
                    logger.info(
                        "Nodo INACTIVE eliminado por timeout: %s (%s) - %.0fs sin heartbeat",
                        node.node_name, node.service_name, elapsed,
                    )

            if should_remove:
                self._redis.delete(
                    f"{self.REDIS_REGISTERED_KEY}:{node.machine_id}:{node.node_id}"
                )
                # Marcar como REMOVED en el hash principal
                self._redis.hset_json(self.REDIS_NODES_KEY, node.node_id, {
                    **node.to_dict(),
                    "status": NodeStatus.REMOVED.value,
                    "removed_at": now,
                })
                removed += 1

        if removed:
            logger.info("Limpieza: %d nodos obsoletos eliminados", removed)
        return removed

    # ------------------------------------------------------------------
    # Estadísticas
    # ------------------------------------------------------------------

    def get_summary(self) -> dict:
        """Resumen del registro de nodos."""
        nodes = self.get_all_nodes()
        return {
            "total": len(nodes),
            "by_status": {
                status.value: sum(1 for n in nodes if n.status == status)
                for status in NodeStatus
            },
            "by_machine": {
                str(mid): len([n for n in nodes if n.machine_id == mid])
                for mid in sorted(set(n.machine_id for n in nodes))
            },
            "by_service": {
                svc: len([n for n in nodes if n.service_name == svc])
                for svc in sorted(set(n.service_name for n in nodes))
            },
            "nodes": [n.to_dict() for n in nodes],
        }

    # ------------------------------------------------------------------
    # Eventos internos
    # ------------------------------------------------------------------

    def _emit_event(
        self,
        event_type: EventType,
        source: str = "node-registry",
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
