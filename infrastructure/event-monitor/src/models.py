# =============================================================================
# Models - Event Monitor
# =============================================================================
# Modelos de datos usados por el Event Monitor: nodos, eventos, heartbeats.
# =============================================================================

import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class NodeStatus(str, Enum):
    """Estados posibles de un nodo en el sistema."""
    UNKNOWN = "unknown"
    STARTING = "starting"
    ACTIVE = "active"
    DEGRADED = "degraded"
    INACTIVE = "inactive"
    REMOVED = "removed"


class EventType(str, Enum):
    """Tipos de eventos del sistema."""
    # Heartbeat
    HEARTBEAT_RECEIVED = "heartbeat.received"
    HEARTBEAT_MISSED = "heartbeat.missed"
    HEARTBEAT_RESTORED = "heartbeat.restored"

    # Nodos
    NODE_REGISTERED = "node.registered"
    NODE_UNREGISTERED = "node.unregistered"
    NODE_STATUS_CHANGE = "node.status_change"
    NODE_REMOVED = "node.removed"

    # System
    SYSTEM_STARTUP = "system.startup"
    SYSTEM_SHUTDOWN = "system.shutdown"
    SYSTEM_ERROR = "system.error"

    # Circuit Breaker
    CIRCUIT_OPENED = "circuit.opened"
    CIRCUIT_CLOSED = "circuit.closed"
    CIRCUIT_HALF_OPEN = "circuit.half_open"

    # Replicación
    REPLICATION_STARTED = "replication.started"
    REPLICATION_COMPLETED = "replication.completed"
    REPLICATION_FAILED = "replication.failed"
    REPLICATION_ACK = "replication.ack"

    # Servicios
    SERVICE_UP = "service.up"
    SERVICE_DOWN = "service.down"
    SERVICE_DEGRADED = "service.degraded"


@dataclass
class HeartbeatData:
    """Datos de un heartbeat recibido de un nodo."""
    node_id: str
    node_name: str
    service_name: str
    machine_id: int
    timestamp: float = field(default_factory=lambda: time.time())
    status: str = "active"
    cpu_percent: float = 0.0
    memory_percent: float = 0.0
    uptime_seconds: float = 0.0
    custom_metrics: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class NodeInfo:
    """Información de un nodo registrado en el sistema."""
    node_id: str
    node_name: str
    service_name: str
    machine_id: int
    host: str = ""
    port: int = 0
    status: NodeStatus = NodeStatus.STARTING
    last_heartbeat: float = 0.0
    first_seen: float = field(default_factory=lambda: time.time())
    heartbeat_count: int = 0
    missed_heartbeats: int = 0
    cpu_percent: float = 0.0
    memory_percent: float = 0.0
    uptime_seconds: float = 0.0
    tags: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "node_id": self.node_id,
            "node_name": self.node_name,
            "service_name": self.service_name,
            "machine_id": self.machine_id,
            "host": self.host,
            "port": self.port,
            "status": self.status.value,
            "last_heartbeat": self.last_heartbeat,
            "first_seen": self.first_seen,
            "heartbeat_count": self.heartbeat_count,
            "missed_heartbeats": self.missed_heartbeats,
            "cpu_percent": self.cpu_percent,
            "memory_percent": self.memory_percent,
            "uptime_seconds": self.uptime_seconds,
            "tags": self.tags,
        }


@dataclass
class SystemEvent:
    """Un evento del sistema con timestamp."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: str = ""
    source: str = ""
    node_id: str = ""
    message: str = ""
    severity: str = "info"
    timestamp: float = field(default_factory=lambda: time.time())
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "source": self.source,
            "node_id": self.node_id,
            "message": self.message,
            "severity": self.severity,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
        }


@dataclass
class MetricsSnapshot:
    """Métrica agregada del sistema en un momento dado."""
    timestamp: float = field(default_factory=lambda: time.time())
    total_nodes: int = 0
    active_nodes: int = 0
    inactive_nodes: int = 0
    total_heartbeats: int = 0
    missed_heartbeats: int = 0
    total_events: int = 0
    circuits_open: int = 0
    circuits_closed: int = 0
    cpu_avg: float = 0.0
    memory_avg: float = 0.0
    replication_pending: int = 0

    def to_dict(self) -> dict:
        return asdict(self)
