# =============================================================================
# WebSocket Handler - Event Monitor
# =============================================================================
# Maneja la comunicación en tiempo real vía WebSocket (SocketIO).
# Transmite eventos del sistema, heartbeats, métricas y actualizaciones
# de estado a los clientes conectados (panel de administración).
# =============================================================================

import logging
import time
from typing import Any

from flask import request

from flask_socketio import SocketIO, emit, join_room, leave_room

from src.models import SystemEvent, EventType

logger = logging.getLogger("event-monitor.websocket")


class WebSocketHandler:
    """Manejador de WebSocket para comunicación en tiempo real.

    Gestiona conexiones de clientes y transmite eventos del sistema
    a través de rooms (canales temáticos).

    Rooms disponibles:
        - "events": Eventos del sistema.
        - "heartbeats": Heartbeats de nodos.
        - "metrics": Métricas periódicas.
        - "admin": Todos los eventos (panel admin).
    """

    ROOMS = {
        "events": "events",
        "heartbeats": "heartbeats",
        "metrics": "metrics",
        "admin": "admin",
    }

    def __init__(self, socketio: SocketIO | None = None):
        self.socketio = socketio
        self._connected_clients: dict[str, dict] = {}
        self._total_messages_sent = 0

    def init_app(self, socketio: SocketIO) -> None:
        """Inicializa con la instancia de SocketIO."""
        self.socketio = socketio
        self._register_handlers()

    def _register_handlers(self) -> None:
        """Registra los event handlers de SocketIO."""
        if not self.socketio:
            return

        sio = self.socketio

        @sio.on("connect")
        def on_connect(auth=None):
            client_id = request.sid
            self._connected_clients[client_id] = {
                "connected_at": time.time(),
                "rooms": [self.ROOMS["admin"]],
            }
            logger.info("Cliente WebSocket conectado: %s", client_id)
            # Unir automáticamente a sala admin
            join_room(self.ROOMS["admin"])
            emit("connected", {
                "status": "connected",
                "client_id": client_id,
                "rooms": list(self.ROOMS.values()),
                "timestamp": time.time(),
            })

        @sio.on("disconnect")
        def on_disconnect():
            client_id = request.sid
            self._connected_clients.pop(client_id, None)
            logger.info("Cliente WebSocket desconectado: %s", client_id)

        @sio.on("subscribe")
        def on_subscribe(data: dict):
            """Cliente se suscribe a un room específico."""
            room = data.get("room", "")
            if room in self.ROOMS.values():
                join_room(room)
                logger.debug("Cliente suscrito a room: %s", room)
                emit("subscribed", {"room": room})
            else:
                emit("error", {"message": f"Room '{room}' no válido"})

        @sio.on("unsubscribe")
        def on_unsubscribe(data: dict):
            """Cliente se desuscribe de un room."""
            room = data.get("room", "")
            leave_room(room)
            emit("unsubscribed", {"room": room})

        @sio.on("ping")
        def on_ping(data: dict = None):
            """Respuesta a ping del cliente."""
            emit("pong", {
                "server_time": time.time(),
                "clients_connected": self.get_client_count(),
            })

    # ------------------------------------------------------------------
    # Transmisión de eventos
    # ------------------------------------------------------------------

    def broadcast_event(self, event: SystemEvent) -> bool:
        """Transmite un evento del sistema a todos los clientes.

        Args:
            event: Evento del sistema a transmitir.

        Returns:
            True si se transmitió correctamente.
        """
        if not self.socketio:
            return False

        try:
            data = event.to_dict()
            self.socketio.emit("event", data, room=self.ROOMS["admin"])
            self.socketio.emit("event", data, room=self.ROOMS["events"])
            self._total_messages_sent += 1
            return True
        except Exception as e:
            logger.error("Error transmitiendo evento: %s", e)
            return False

    def broadcast_heartbeat(self, node_data: dict) -> bool:
        """Transmite un heartbeat a los clientes suscritos."""
        if not self.socketio:
            return False

        try:
            self.socketio.emit(
                "heartbeat", node_data, room=self.ROOMS["heartbeats"]
            )
            self.socketio.emit(
                "heartbeat", node_data, room=self.ROOMS["admin"]
            )
            self._total_messages_sent += 1
            return True
        except Exception as e:
            logger.error("Error transmitiendo heartbeat: %s", e)
            return False

    def broadcast_metrics(self, metrics: dict) -> bool:
        """Transmite métricas a los clientes suscritos."""
        if not self.socketio:
            return False

        try:
            self.socketio.emit("metrics", metrics, room=self.ROOMS["metrics"])
            self.socketio.emit("metrics", metrics, room=self.ROOMS["admin"])
            self._total_messages_sent += 1
            return True
        except Exception as e:
            logger.error("Error transmitiendo métricas: %s", e)
            return False

    def broadcast_node_status(self, node_data: dict) -> bool:
        """Transmite cambio de estado de un nodo."""
        if not self.socketio:
            return False

        try:
            self.socketio.emit(
                "node_status", node_data, room=self.ROOMS["admin"]
            )
            self.socketio.emit(
                "node_status", node_data, room=self.ROOMS["events"]
            )
            self._total_messages_sent += 1
            return True
        except Exception as e:
            logger.error("Error transmitiendo estado de nodo: %s", e)
            return False

    def broadcast_circuit_change(self, circuit_data: dict) -> bool:
        """Transmite cambio de estado de un circuit breaker."""
        if not self.socketio:
            return False

        try:
            self.socketio.emit(
                "circuit_change", circuit_data, room=self.ROOMS["admin"]
            )
            self._total_messages_sent += 1
            return True
        except Exception as e:
            logger.error("Error transmitiendo cambio de circuit breaker: %s", e)
            return False

    def broadcast_replication_event(self, replication_data: dict) -> bool:
        """Transmite evento de replicación."""
        if not self.socketio:
            return False

        try:
            self.socketio.emit(
                "replication", replication_data, room=self.ROOMS["admin"]
            )
            self._total_messages_sent += 1
            return True
        except Exception as e:
            logger.error("Error transmitiendo evento de replicación: %s", e)
            return False

    def broadcast_system_status(self, status_data: dict) -> bool:
        """Transmite estado general del sistema."""
        if not self.socketio:
            return False

        try:
            self.socketio.emit(
                "system_status", status_data, room=self.ROOMS["admin"]
            )
            self._total_messages_sent += 1
            return True
        except Exception as e:
            logger.error("Error transmitiendo estado del sistema: %s", e)
            return False

    # ------------------------------------------------------------------
    # Estado
    # ------------------------------------------------------------------

    def get_client_count(self) -> int:
        """Cantidad de clientes conectados."""
        if not self.socketio:
            return 0
        try:
            # SocketIO no expone conteo directamente, usamos estimación
            return len(self._connected_clients)
        except Exception:
            return 0

    def get_stats(self) -> dict:
        """Estadísticas del WebSocket handler."""
        return {
            "clients_connected": self.get_client_count(),
            "total_messages_sent": self._total_messages_sent,
            "rooms": list(self.ROOMS.values()),
        }
