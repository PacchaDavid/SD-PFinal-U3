# =============================================================================
# Redis Client - Event Monitor
# =============================================================================
# Cliente Redis con soporte Pub/Sub para el bus de eventos del sistema.
# Maneja reconexión automática y canales tipados.
# =============================================================================

import json
import logging
import threading
import time
from typing import Callable

import redis

logger = logging.getLogger("event-monitor.redis")


class RedisClient:
    """Cliente Redis con Pub/Sub para el bus de eventos distribuido.

    Gestiona múltiples canales de Pub/Sub para diferentes tipos de eventos
    (heartbeats, eventos del sistema, métricas, replicación, circuit breaker).

    Attributes:
        channels: dict con los nombres de canales configurados.
    """

    def __init__(self, host: str = "localhost", port: int = 6379, channels: dict | None = None):
        self.host = host
        self.port = port
        self.channels = channels or {}

        self._client: redis.Redis | None = None
        self._pubsub: redis.client.PubSub | None = None
        self._listener_thread: threading.Thread | None = None
        self._running = False
        self._handlers: dict[str, list[Callable]] = {}

    # ------------------------------------------------------------------
    # Conexión
    # ------------------------------------------------------------------

    def connect(self) -> bool:
        """Conecta al servidor Redis. Retorna True si exitoso."""
        try:
            self._client = redis.Redis(
                host=self.host,
                port=self.port,
                decode_responses=True,
                socket_connect_timeout=3,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=15,
            )
            self._client.ping()
            logger.info("Conectado a Redis en %s:%s", self.host, self.port)
            return True
        except redis.ConnectionError as e:
            logger.warning("No se pudo conectar a Redis (%s:%s): %s", self.host, self.port, e)
            self._client = None
            return False

    def is_connected(self) -> bool:
        """Verifica si la conexión a Redis está activa."""
        if not self._client:
            return False
        try:
            self._client.ping()
            return True
        except (redis.ConnectionError, redis.TimeoutError):
            return False

    def disconnect(self) -> None:
        """Cierra conexión y detiene listener Pub/Sub."""
        self._running = False
        if self._pubsub:
            try:
                self._pubsub.close()
            except Exception:
                pass
            self._pubsub = None
        if self._client:
            try:
                self._client.close()
            except Exception:
                pass
            self._client = None

    # ------------------------------------------------------------------
    # Publicación de mensajes
    # ------------------------------------------------------------------

    def publish(self, channel: str, message: dict) -> bool:
        """Publica un mensaje JSON en un canal Redis.

        Args:
            channel: Nombre del canal (ej: "heartbeats", "events").
            message: Dict con datos a publicar.

        Returns:
            True si se publicó exitosamente.
        """
        if not self._client or not self.is_connected():
            return False
        try:
            self._client.publish(channel, json.dumps(message, default=str))
            return True
        except redis.RedisError as e:
            logger.error("Error publicando en canal '%s': %s", channel, e)
            return False

    def publish_heartbeat(self, data: dict) -> bool:
        """Publica un heartbeat en el canal correspondiente."""
        return self.publish(self.channels.get("heartbeats", "heartbeats"), data)

    def publish_event(self, event: dict) -> bool:
        """Publica un evento del sistema."""
        return self.publish(self.channels.get("events", "events"), event)

    def publish_metrics(self, metrics: dict) -> bool:
        """Publica métricas del sistema."""
        return self.publish(self.channels.get("metrics", "metrics"), metrics)

    # ------------------------------------------------------------------
    # Suscripción a canales (Pub/Sub listener)
    # ------------------------------------------------------------------

    def subscribe(self, channel: str, handler: Callable) -> None:
        """Registra un handler para un canal Pub/Sub."""
        if channel not in self._handlers:
            self._handlers[channel] = []
        self._handlers[channel].append(handler)

    def start_listener(self) -> bool:
        """Inicia el thread listener de Pub/Sub en background.

        Debe llamarse después de registrar handlers con subscribe().
        """
        if not self._client or not self.is_connected():
            logger.error("No se puede iniciar listener: Redis no conectado")
            return False

        if self._running:
            return True

        try:
            self._pubsub = self._client.pubsub()
            # Suscribirse a todos los canales con handlers
            for channel in self._handlers:
                self._pubsub.subscribe(channel)
                logger.debug("Suscrito al canal: %s", channel)

            self._running = True
            self._listener_thread = threading.Thread(
                target=self._listener_loop,
                name="redis-pubsub-listener",
                daemon=True,
            )
            self._listener_thread.start()
            logger.info(
                "Listener Pub/Sub iniciado en %s canales",
                len(self._handlers),
            )
            return True
        except redis.RedisError as e:
            logger.error("Error iniciando listener Pub/Sub: %s", e)
            return False

    def _listener_loop(self) -> None:
        """Loop principal del listener Pub/Sub."""
        while self._running:
            try:
                if not self._pubsub:
                    break
                message = self._pubsub.get_message(
                    timeout=1.0, ignore_subscribe_messages=True
                )
                if message and message["type"] == "message":
                    channel = message["channel"]
                    data = json.loads(message["data"])
                    # Llamar a todos los handlers registrados para este canal
                    handlers = self._handlers.get(channel, [])
                    for handler in handlers:
                        try:
                            handler(data)
                        except Exception as e:
                            logger.error(
                                "Error en handler de canal '%s': %s", channel, e
                            )
            except redis.ConnectionError:
                logger.warning("Conexión Redis perdida en listener. Reintentando...")
                time.sleep(2)
            except Exception as e:
                logger.error("Error en listener Pub/Sub: %s", e)
                time.sleep(1)

    # ------------------------------------------------------------------
    # Operaciones KV (clave-valor)
    # ------------------------------------------------------------------

    def set_json(self, key: str, value: dict, ttl: int | None = None) -> bool:
        """Almacena un dict como JSON en Redis."""
        if not self._client:
            return False
        try:
            self._client.set(key, json.dumps(value, default=str))
            if ttl:
                self._client.expire(key, ttl)
            return True
        except redis.RedisError as e:
            logger.error("Error en set_json(%s): %s", key, e)
            return False

    def get_json(self, key: str) -> dict | None:
        """Recupera un JSON de Redis como dict."""
        if not self._client:
            return None
        try:
            data = self._client.get(key)
            return json.loads(data) if data else None
        except (redis.RedisError, json.JSONDecodeError) as e:
            logger.error("Error en get_json(%s): %s", key, e)
            return None

    def delete(self, key: str) -> bool:
        """Elimina una clave de Redis."""
        if not self._client:
            return False
        try:
            self._client.delete(key)
            return True
        except redis.RedisError:
            return False

    def keys(self, pattern: str) -> list[str]:
        """Busca claves por patrón."""
        if not self._client:
            return []
        try:
            return list(self._client.keys(pattern))
        except redis.RedisError:
            return []

    def hset_json(self, key: str, field: str, value: dict) -> bool:
        """Almacena un dict como JSON en un hash de Redis."""
        if not self._client:
            return False
        try:
            self._client.hset(key, field, json.dumps(value, default=str))
            return True
        except redis.RedisError:
            return False

    def hget_json(self, key: str, field: str) -> dict | None:
        """Recupera un JSON de un hash de Redis."""
        if not self._client:
            return None
        try:
            data = self._client.hget(key, field)
            return json.loads(data) if data else None
        except (redis.RedisError, json.JSONDecodeError):
            return None

    def hgetall_json(self, key: str) -> dict[str, dict]:
        """Recupera todos los campos de un hash como dicts."""
        if not self._client:
            return {}
        try:
            result = {}
            raw = self._client.hgetall(key)
            for field, value in raw.items():
                result[field] = json.loads(value)
            return result
        except (redis.RedisError, json.JSONDecodeError):
            return {}
