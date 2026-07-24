# =============================================================================
# Configuration Loader - Event Monitor
# =============================================================================
# Carga configuración desde archivo YAML + variables de entorno.
# Las variables de entorno tienen prioridad sobre el archivo YAML.
# =============================================================================

import os
import yaml
from pathlib import Path


class Config:
    """Configuration manager for Event Monitor.

    Carga configuración desde:
    1. Archivo YAML por defecto (configs/event-monitor.yaml)
    2. Variables de entorno con prefijo EM_ (tienen prioridad)

    Los valores se acceden como atributos: config.server.port
    """

    def __init__(self, config_path: str | None = None):
        self._data: dict = self._load_defaults()

        # Cargar desde YAML si existe
        yaml_path = config_path or os.getenv(
            "CONFIG_PATH",
            str(Path(__file__).parent.parent.parent.parent / "configs" / "event-monitor.yaml"),
        )
        self._load_yaml(yaml_path)

        # Sobrescribir con variables de entorno
        self._load_env()

    @staticmethod
    def _load_defaults() -> dict:
        return {
            "server": {
                "host": "0.0.0.0",
                "port": 8082,
            },
            "redis": {
                "host": "localhost",
                "port": 6379,
                "channels": {
                    "heartbeats": "heartbeats",
                    "events": "events",
                    "metrics": "metrics",
                    "replication": "replication",
                    "circuit_breaker": "circuit-breaker",
                    "system": "system",
                },
            },
            "heartbeat": {
                "interval_seconds": 2,
                "timeout_seconds": 10,
                "max_missed": 3,
            },
            "websocket": {
                "heartbeat_interval": 30,
            },
            "node_registration": {
                "required": True,
                "auto_remove_after_minutes": 5,
            },
            "logging": {
                "level": "INFO",
                "max_events_in_memory": 10000,
                "retention_days": 7,
            },
        }

    def _load_yaml(self, path: str) -> None:
        try:
            with open(path) as f:
                yaml_data = yaml.safe_load(f)
            if yaml_data:
                self._deep_merge(self._data, yaml_data)
        except (FileNotFoundError, PermissionError):
            pass  # Usar defaults si no hay archivo

    def _load_env(self) -> None:
        """Lee variables EM_* y las aplica con notación de puntos."""
        for key, value in os.environ.items():
            if key.startswith("EM_"):
                self._set_nested(key[3:].lower().replace("__", "."), value)
            # También aceptar vars sin prefijo para compatibilidad
            elif key == "PORT":
                self._set_nested("server.port", value)
            elif key == "REDIS_HOST":
                self._set_nested("redis.host", value)
            elif key == "REDIS_PORT":
                self._set_nested("redis.port", value)
            elif key == "LOG_LEVEL":
                self._set_nested("logging.level", value)

    def _set_nested(self, dotted_key: str, value: str) -> None:
        parts = dotted_key.split(".")
        target = self._data
        for part in parts[:-1]:
            if part not in target:
                target[part] = {}
            target = target[part]
        # Convertir tipos básicos
        key = parts[-1]
        if value.isdigit():
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
    def redis_host(self) -> str:
        return self._data["redis"]["host"]

    @property
    def redis_port(self) -> int:
        return self._data["redis"]["port"]

    @property
    def redis_channels(self) -> dict:
        return self._data["redis"]["channels"]

    @property
    def heartbeat_interval(self) -> int:
        return self._data["heartbeat"]["interval_seconds"]

    @property
    def heartbeat_timeout(self) -> int:
        return self._data["heartbeat"]["timeout_seconds"]

    @property
    def heartbeat_max_missed(self) -> int:
        return self._data["heartbeat"]["max_missed"]

    @property
    def ws_heartbeat_interval(self) -> int:
        return self._data["websocket"]["heartbeat_interval"]

    @property
    def auto_remove_minutes(self) -> int:
        return self._data["node_registration"]["auto_remove_after_minutes"]

    @property
    def log_level(self) -> str:
        return self._data["logging"]["level"]

    @property
    def max_events(self) -> int:
        return self._data["logging"]["max_events_in_memory"]

    @property
    def raw(self) -> dict:
        """Acceso a toda la config como dict."""
        return self._data
