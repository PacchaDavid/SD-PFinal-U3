import os
import yaml
from pathlib import Path


class Config:
    """Configuration manager for Replication Manager."""

    def __init__(self, config_path: str | None = None):
        self._data: dict = self._load_defaults()
        yaml_path = config_path or os.getenv(
            "CONFIG_PATH",
            str(Path(__file__).parent.parent.parent.parent / "configs" / "replication.yaml"),
        )
        self._load_yaml(yaml_path)
        self._load_env()

    @staticmethod
    def _load_defaults() -> dict:
        return {
            "server": {"host": "0.0.0.0", "port": 8090},
            "replication": {
                "service_name": "default",
                "poll_interval_ms": 500,
                "replica_timeout_ms": 3000,
                "quorum_min": 2,
                "max_batch_size": 100,
                "retry_attempts": 3,
                "retry_delay_ms": 1000,
            },
            "databases": {
                "primary": {
                    "host": "localhost", "port": 3306,
                    "database": "streaming", "user": "streaming",
                    "password": "streaming_secret_2024",
                },
                "replicas": [
                    {"id": 1, "host": "localhost", "port": 3307,
                     "database": "streaming", "user": "streaming",
                     "password": "streaming_secret_2024"},
                    {"id": 2, "host": "localhost", "port": 3308,
                     "database": "streaming", "user": "streaming",
                     "password": "streaming_secret_2024"},
                    {"id": 3, "host": "localhost", "port": 3309,
                     "database": "streaming", "user": "streaming",
                     "password": "streaming_secret_2024"},
                ],
            },
            "recovery": {
                "auto_catch_up": True, "catch_up_batch_size": 50,
                "health_check_interval": 2,
            },
            "notifications": {
                "redis_channel": "replication",
                "event_monitor_url": "http://event-monitor:8082",
            },
            "redis": {"host": "redis", "port": 6379},
            "logging": {"level": "INFO"},
        }

    def _load_yaml(self, path: str) -> None:
        try:
            with open(path) as f:
                data = yaml.safe_load(f)
            if data:
                self._deep_merge(self._data, data)
        except (FileNotFoundError, PermissionError):
            pass

    def _load_env(self) -> None:
        for key, value in os.environ.items():
            if key.startswith("REP_"):
                self._set_nested(key[4:].lower().replace("__", "."), value)
            elif key == "SERVICE_NAME":
                self._data["replication"]["service_name"] = value
            elif key == "DB_PRIMARY_HOST":
                self._data["databases"]["primary"]["host"] = value
            elif key == "DB_PRIMARY_PORT":
                self._data["databases"]["primary"]["port"] = int(value)
            elif key == "DB_NAME":
                self._data["databases"]["primary"]["database"] = value
                for r in self._data["databases"]["replicas"]:
                    r["database"] = value
            elif key == "DB_USER":
                self._data["databases"]["primary"]["user"] = value
                for r in self._data["databases"]["replicas"]:
                    r["user"] = value
            elif key == "DB_PASSWORD":
                self._data["databases"]["primary"]["password"] = value
                for r in self._data["databases"]["replicas"]:
                    r["password"] = value
            elif key == "DB_REPLICA1_HOST":
                if len(self._data["databases"]["replicas"]) > 0:
                    self._data["databases"]["replicas"][0]["host"] = value
            elif key == "DB_REPLICA1_PORT":
                if len(self._data["databases"]["replicas"]) > 0:
                    self._data["databases"]["replicas"][0]["port"] = int(value)
            elif key == "DB_REPLICA2_HOST":
                if len(self._data["databases"]["replicas"]) > 1:
                    self._data["databases"]["replicas"][1]["host"] = value
            elif key == "DB_REPLICA2_PORT":
                if len(self._data["databases"]["replicas"]) > 1:
                    self._data["databases"]["replicas"][1]["port"] = int(value)
            elif key == "DB_REPLICA3_HOST":
                if len(self._data["databases"]["replicas"]) > 2:
                    self._data["databases"]["replicas"][2]["host"] = value
            elif key == "DB_REPLICA3_PORT":
                if len(self._data["databases"]["replicas"]) > 2:
                    self._data["databases"]["replicas"][2]["port"] = int(value)
            elif key == "QUORUM_MIN":
                self._data["replication"]["quorum_min"] = int(value)
            elif key == "POLL_INTERVAL":
                self._data["replication"]["poll_interval_ms"] = int(value)
            elif key == "REPLICA_TIMEOUT":
                self._data["replication"]["replica_timeout_ms"] = int(value)
            elif key == "REDIS_HOST":
                self._data["redis"]["host"] = value
            elif key == "REDIS_PORT":
                self._data["redis"]["port"] = int(value)
            elif key == "EVENT_MONITOR_URL":
                self._data["notifications"]["event_monitor_url"] = value
            elif key == "LOG_LEVEL":
                self._data["logging"]["level"] = value
            elif key == "PORT":
                self._data["server"]["port"] = int(value)

    def _set_nested(self, dotted_key: str, value: str) -> None:
        parts = dotted_key.split(".")
        target = self._data
        for part in parts[:-1]:
            if part not in target:
                target[part] = {}
            target = target[part]
        key = parts[-1]
        if isinstance(target.get(key), bool):
            target[key] = value.lower() in ("true", "yes", "1")
        elif value.isdigit():
            target[key] = int(value)
        elif value.lower() in ("true", "yes", "1"):
            target[key] = True
        elif value.lower() in ("false", "no", "0"):
            target[key] = False
        else:
            target[key] = value

    @staticmethod
    def _deep_merge(base: dict, override: dict) -> None:
        for key, value in override.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                Config._deep_merge(base[key], value)
            else:
                base[key] = value

    @property
    def host(self): return self._data["server"]["host"]
    @property
    def port(self): return self._data["server"]["port"]
    @property
    def service_name(self): return self._data["replication"]["service_name"]
    @property
    def poll_interval_ms(self): return self._data["replication"]["poll_interval_ms"]
    @property
    def replica_timeout_ms(self): return self._data["replication"]["replica_timeout_ms"]
    @property
    def quorum_min(self): return self._data["replication"]["quorum_min"]
    @property
    def max_batch_size(self): return self._data["replication"]["max_batch_size"]
    @property
    def retry_attempts(self): return self._data["replication"]["retry_attempts"]
    @property
    def retry_delay_ms(self): return self._data["replication"]["retry_delay_ms"]
    @property
    def primary(self): return self._data["databases"]["primary"]
    @property
    def replicas(self): return self._data["databases"]["replicas"]
    @property
    def auto_catch_up(self): return self._data["recovery"]["auto_catch_up"]
    @property
    def catch_up_batch_size(self): return self._data["recovery"]["catch_up_batch_size"]
    @property
    def health_check_interval(self): return self._data["recovery"]["health_check_interval"]
    @property
    def redis_channel(self): return self._data["notifications"]["redis_channel"]
    @property
    def event_monitor_url(self): return self._data["notifications"]["event_monitor_url"]
    @property
    def redis_host(self): return self._data["redis"]["host"]
    @property
    def redis_port(self): return self._data["redis"]["port"]
    @property
    def log_level(self): return self._data["logging"]["level"]
    @property
    def raw(self): return self._data
