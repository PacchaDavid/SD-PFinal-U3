# =============================================================================
# Nodes API - Event Monitor
# =============================================================================
# Endpoints para gestión de nodos del sistema distribuido.
# =============================================================================

import time
from flask import jsonify, request

from src.api import nodes_bp
from src.models import HeartbeatData, NodeStatus

# Referencias inyectadas desde app.py
get_registry = lambda: None
get_heartbeat_monitor = lambda: None
on_node_registered_callback = lambda node: None


def init_nodes(registry_fn, hb_monitor_fn, registered_cb=None):
    """Inicializa referencias a servicios."""
    global get_registry, get_heartbeat_monitor, on_node_registered_callback
    get_registry = registry_fn
    get_heartbeat_monitor = hb_monitor_fn
    if registered_cb:
        on_node_registered_callback = registered_cb


@nodes_bp.route("/nodes", methods=["GET"])
def list_nodes():
    """Lista todos los nodos registrados en el sistema.

    Primero intenta con el NodeRegistry (registro manual via POST).
    Si está vacío, usa el HeartbeatMonitor (nodos detectados via Redis Pub/Sub).
    """
    registry = get_registry()
    if registry:
        summary = registry.get_summary()
        # Si el registry tiene datos, devolverlos
        if summary.get("total_nodes", 0) > 0:
            return jsonify(summary)

    # Fallback: usar HeartbeatMonitor (nodos detectados via Redis)
    hb_monitor = get_heartbeat_monitor()
    if hb_monitor:
        summary = hb_monitor.get_summary()
        if summary.get("total_nodes", 0) > 0:
            return jsonify(summary)

    # Si ambos están vacíos o no disponibles
    if registry:
        return jsonify(registry.get_summary())
    return jsonify({"error": "No hay datos de nodos disponibles"}), 503


@nodes_bp.route("/nodes/<node_id>", methods=["GET"])
def get_node(node_id: str):
    """Obtiene información detallada de un nodo específico."""
    registry = get_registry()
    if not registry:
        return jsonify({"error": "Registry no disponible"}), 503

    node = registry.get_node(node_id)
    if node:
        return jsonify(node.to_dict())
    return jsonify({"error": "Nodo no encontrado"}), 404


@nodes_bp.route("/nodes", methods=["POST"])
def register_node():
    """Registra un nuevo nodo en el sistema.

    Request body:
        node_id: str (requerido)
        node_name: str
        service_name: str
        machine_id: int
        host: str
        port: int
        tags: dict
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body requerido"}), 400

    node_id = data.get("node_id")
    if not node_id:
        return jsonify({"error": "node_id es requerido"}), 400

    registry = get_registry()
    if not registry:
        return jsonify({"error": "Registry no disponible"}), 503

    node = registry.register_node(
        node_id=node_id,
        node_name=data.get("node_name", node_id),
        service_name=data.get("service_name", "unknown"),
        machine_id=int(data.get("machine_id", 0)),
        host=data.get("host", ""),
        port=int(data.get("port", 0)),
        tags=data.get("tags", {}),
    )

    # Registrar también en HeartbeatMonitor para tracking de salud en tiempo real
    # Sin esto, el nodo nunca se marcaría como INACTIVE al dejar de enviar heartbeats
    hb_monitor = get_heartbeat_monitor()
    if hb_monitor:
        hb_monitor.register_node(HeartbeatData(
            node_id=node_id,
            node_name=data.get("node_name", node_id),
            service_name=data.get("service_name", "unknown"),
            machine_id=int(data.get("machine_id", 0)),
            timestamp=time.time(),
            status="active",
        ))

    on_node_registered_callback(node)

    return jsonify(node.to_dict()), 201


@nodes_bp.route("/nodes/<node_id>", methods=["DELETE"])
def unregister_node(node_id: str):
    """Elimina un nodo del sistema."""
    registry = get_registry()
    if not registry:
        return jsonify({"error": "Registry no disponible"}), 503

    if registry.unregister_node(node_id):
        return jsonify({"message": f"Nodo {node_id} eliminado"})
    return jsonify({"error": "Nodo no encontrado"}), 404


@nodes_bp.route("/nodes/status", methods=["GET"])
def nodes_status_summary():
    """Resumen rápido del estado de todos los nodos."""
    hb_monitor = get_heartbeat_monitor()
    if not hb_monitor:
        return jsonify({"error": "HeartbeatMonitor no disponible"}), 503

    return jsonify(hb_monitor.get_summary())
