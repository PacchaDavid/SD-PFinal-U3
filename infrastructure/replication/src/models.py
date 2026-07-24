import time
import uuid
from dataclasses import dataclass, field, asdict
from enum import Enum


class EntryStatus(str, Enum):
    PENDING = "PENDING"
    PROPAGATING = "PROPAGATING"
    REPLICATED = "REPLICATED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class ReplicaStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


class AckStatus(str, Enum):
    PENDING = "PENDING"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    TIMEOUT = "TIMEOUT"
    ERROR = "ERROR"


@dataclass
class ReplicationEntry:
    id: str = ""
    operation: str = "INSERT"
    table_name: str = ""
    record_id: str = ""
    service: str = ""
    data: str = ""
    status: EntryStatus = EntryStatus.PENDING
    created_at: float = field(default_factory=time.time)
    propagated_at: float = 0.0
    ack_count: int = 0
    total_replicas: int = 3
    error: str = ""
    retry_count: int = 0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "operation": self.operation,
            "table_name": self.table_name,
            "record_id": self.record_id,
            "service": self.service,
            "data": self.data,
            "status": self.status.value,
            "created_at": self.created_at,
            "propagated_at": self.propagated_at,
            "ack_count": self.ack_count,
            "total_replicas": self.total_replicas,
            "error": self.error,
            "retry_count": self.retry_count,
        }


@dataclass
class ReplicaAck:
    entry_id: str
    replica_id: int
    host: str
    port: int
    status: AckStatus = AckStatus.PENDING
    response_time_ms: float = 0.0
    error: str = ""
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "entry_id": self.entry_id,
            "replica_id": self.replica_id,
            "host": self.host,
            "port": self.port,
            "status": self.status.value,
            "response_time_ms": round(self.response_time_ms, 2),
            "error": self.error,
            "timestamp": self.timestamp,
        }


@dataclass
class ReplicaNodeState:
    replica_id: int
    host: str
    port: int
    database: str
    user: str = "streaming"
    password: str = ""
    status: ReplicaStatus = ReplicaStatus.UNKNOWN
    last_health_check: float = 0.0
    last_ack_time: float = 0.0
    total_acks: int = 0
    total_timeouts: int = 0
    total_errors: int = 0
    avg_response_time_ms: float = 0.0
    is_pending_recovery: bool = False
    last_catch_up: float = 0.0

    def to_dict(self) -> dict:
        return {
            "replica_id": self.replica_id,
            "host": self.host,
            "port": self.port,
            "database": self.database,
            "status": self.status.value,
            "last_health_check": self.last_health_check,
            "last_ack_time": self.last_ack_time,
            "total_acks": self.total_acks,
            "total_timeouts": self.total_timeouts,
            "total_errors": self.total_errors,
            "avg_response_time_ms": round(self.avg_response_time_ms, 2),
            "is_pending_recovery": self.is_pending_recovery,
            "last_catch_up": self.last_catch_up,
        }

    @property
    def is_healthy(self) -> bool:
        return self.status == ReplicaStatus.HEALTHY

    @property
    def connection_string(self) -> str:
        return (
            f"mysql+pymysql://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.database}"
        )


@dataclass
class ReplicationStats:
    service_name: str = ""
    total_entries: int = 0
    pending_entries: int = 0
    replicated_entries: int = 0
    partial_entries: int = 0
    failed_entries: int = 0
    avg_ack_time_ms: float = 0.0
    total_replicas: int = 3
    healthy_replicas: int = 0
    unhealthy_replicas: int = 0
    queue_depth: int = 0
    uptime_seconds: float = 0.0
    writes_count: int = 0
    reads_count: int = 0
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ReplicationEvent:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: str = ""
    entry_id: str = ""
    service: str = ""
    message: str = ""
    severity: str = "info"
    timestamp: float = field(default_factory=time.time)
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "entry_id": self.entry_id,
            "service": self.service,
            "message": self.message,
            "severity": self.severity,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
        }
