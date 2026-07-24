# =============================================================================
# Configuration Loader - Load Balancer
# =============================================================================
# Carga configuración desde archivo YAML + variables de entorno.
# Las variables de entorno con prefijo LB_ tienen prioridad sobre YAML.
# =============================================================================

import os
import yaml
from pathlib import Path


class Config:
    """Configuration manager for Load Balancer."""

    def __init__(self, config_path: str | None = None):
        self._data: dict = self._load_defaults()

        yaml_path = config_path or os.getenv(
            "CONFIG_PATH",
            str(Path(__file__).parent.parent.parent.parent / "configs" / "load-balancer.yaml"),
        )
        self._load_yaml(yaml_path)
        self._load_env()

    @staticmethod
    def _load_defaults() -> dict:
        return {
            "server": {
                "host": "0.0.0.0",
                "port": 8000,
            },
            "event_monitor": {
                "url": "http://event-monitor:8082",
                "health_check_interval": 5,
            },
            "services": {
                "usuarios": {
                    "host": "usuarios-service",
                    "port": 8080,
                    "health_path": "/actuator/health",
                    "max_retries": 3,
                    "timeout_ms": 5000,
                },
                "pagos": {
                    "host": "pagos-service",
                    "port": 8080,
                    "health_path": "/actuator/health",
                    "max_retries": 3,
                    "timeout_ms": 5000,
                },
                "recomendaciones": {
                    "host": "recomendaciones-service",
                    "port": 8080,
                    "health_path": "/actuator/health",
                    "max_retries": 3,
                    "timeout_ms": 5000,
                },
            },
            "balancing": {
                "strategy": "round-robin",
                "health_check_interval_seconds": 10,
                "unhealthy_threshold": 3,
            },
            "redis": {
                "host": "redis",
                "port": 6379,
                "enabled": True,
            },
            "logging": {
                "level": "INFO",
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
        """Lee variables LB_* y algunas directas para sobrescribir config."""
        for key, value in os.environ.items():
            if key.startswith("LB_"):
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
                self._data["event_monitor"]["url"] = value

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

    # --- Acceso a propiedades ---

    @property
    def host(self) -> str:
        return self._data["server"]["host"]

    @property
    def port(self) -> int:
        return self._data["server"]["port"]

    @property
    def event_monitor_url(self) -> str:
        return self._data["event_monitor"]["url"]

    @property
    def event_monitor_check_interval(self) -> int:
        return self._data["event_monitor"]["health_check_interval"]

    @property
    def services(self) -> dict:
        return self._data["services"]

    @property
    def balancing_strategy(self) -> str:
        return self._data["balancing"]["strategy"]

    @property
    def health_check_interval(self) -> int:
        return self._data["balancing"]["health_check_interval_seconds"]

    @property
    def unhealthy_threshold(self) -> int:
        return self._data["balancing"]["unhealthy_threshold"]

    @property
    def redis_host(self) -> str:
        return self._data["redis"]["host"]

    @property
    def redis_port(self) -> int:
        return self._data["redis"]["port"]

    @property
    def redis_enabled(self) -> bool:
        return self._data["redis"]["enabled"]

    @property
    def log_level(self) -> str:
        return self._data["logging"]["level"]

    @property
    def raw(self) -> dict:
        return self._data
