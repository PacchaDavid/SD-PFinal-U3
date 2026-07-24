# =============================================================================
# Configuration Loader - Circuit Breaker
# =============================================================================
# Carga configuración desde archivo YAML + variables de entorno.
# Las variables de entorno con prefijo CB_ tienen prioridad.
# =============================================================================

import os
import yaml
from pathlib import Path


class Config:
    """Configuration manager for Circuit Breaker service."""

    def __init__(self, config_path: str | None = None):
        self._data: dict = self._load_defaults()

        yaml_path = config_path or os.getenv(
            "CONFIG_PATH",
            str(Path(__file__).parent.parent.parent.parent / "configs" / "circuit-breaker.yaml"),
        )
        self._load_yaml(yaml_path)
        self._load_env()

    @staticmethod
    def _load_defaults() -> dict:
        return {
            "circuit_breaker": {
                "failure_threshold": 5,
                "success_threshold": 3,
                "open_timeout_seconds": 30,
                "half_open_max_requests": 3,
            },
            "monitoring": {
                "check_interval_seconds": 5,
                "sliding_window_size": 20,
            },
            "notification": {
                "redis_channel": "circuit-breaker",
                "event_monitor_url": "http://event-monitor:8082",
            },
            "logging": {
                "level": "INFO",
            },
            "server": {
                "host": "0.0.0.0",
                "port": 8083,
            },
            "redis": {
                "host": "redis",
                "port": 6379,
            },
        }

    def _load_yaml(self, path: str) -> None:
        try:
            with open(path) as f:
                yaml_data = yaml.safe_load(f)
            if yaml_data:
                self._deep_merge(self._data, yaml_data)
        except (FileNotFoundError, PermissionError):
            pass

    def _load_env(self) -> None:
        for key, value in os.environ.items():
            if key.startswith("CB_"):
                self._set_nested(key[3:].lower().replace("__", "."), value)
            elif key == "PORT":
                self._data["server"]["port"] = int(value)
            elif key == "REDIS_HOST":
                self._data["redis"]["host"] = value
            elif key == "REDIS_PORT":
                self._data["redis"]["port"] = int(value)
            elif key == "LOG_LEVEL":
                self._data["logging"]["level"] = value
            elif key == "EVENT_MONITOR_URL":
                self._data["notification"]["event_monitor_url"] = value

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
    def failure_threshold(self) -> int:
        return self._data["circuit_breaker"]["failure_threshold"]

    @property
    def success_threshold(self) -> int:
        return self._data["circuit_breaker"]["success_threshold"]

    @property
    def open_timeout_seconds(self) -> int:
        return self._data["circuit_breaker"]["open_timeout_seconds"]

    @property
    def half_open_max_requests(self) -> int:
        return self._data["circuit_breaker"]["half_open_max_requests"]

    @property
    def check_interval(self) -> int:
        return self._data["monitoring"]["check_interval_seconds"]

    @property
    def sliding_window_size(self) -> int:
        return self._data["monitoring"]["sliding_window_size"]

    @property
    def redis_channel(self) -> str:
        return self._data["notification"]["redis_channel"]

    @property
    def event_monitor_url(self) -> str:
        return self._data["notification"]["event_monitor_url"]

    @property
    def host(self) -> str:
        return self._data["server"]["host"]

    @property
    def port(self) -> int:
        return self._data["server"]["port"]

    @property
    def redis_host(self) -> str:
        return self._data["redis"]["host"]

    @property
    def redis_port(self) -> int:
        return self._data["redis"]["port"]

    @property
    def log_level(self) -> str:
        return self._data["logging"]["level"]

    @property
    def raw(self) -> dict:
        return self._data
