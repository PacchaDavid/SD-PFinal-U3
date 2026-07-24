# =============================================================================
# Metrics API - Event Monitor
# =============================================================================
# Endpoints para métricas del sistema en tiempo real.
# =============================================================================

import time
from flask import jsonify

from src.api import metrics_bp
from src.models import MetricsSnapshot

# Referencias inyectadas desde app.py
get_heartbeat_monitor = lambda: None
get_registry = lambda: None
get_events = lambda: []
get_circuits = lambda: {}


def init_metrics(hb_fn, registry_fn, events_fn, circuits_fn):
    global get_heartbeat_monitor, get_registry, get_events, get_circuits
    get_heartbeat_monitor = hb_fn
    get_registry = registry_fn
    get_events = events_fn
    get_circuits = circuits_fn


@metrics_bp.route("/metrics", methods=["GET"])
def get_metrics():
    """Métricas agregadas del sistema en tiempo real."""
    hb = get_heartbeat_monitor()
    registry = get_registry()
    events = get_events()
    circuits = get_circuits()

    snapshot = MetricsSnapshot(
        timestamp=time.time(),
        total_nodes=hb.get_node_count() if hb else 0,
        active_nodes=hb.get_active_count() if hb else 0,
        inactive_nodes=(hb.get_node_count() - hb.get_active_count()) if hb else 0,
        total_heartbeats=hb.get_total_heartbeats() if hb else 0,
        total_events=len(events),
        circuits_open=sum(
            1 for c in circuits.values() if c.get("state") == "OPEN"
        ),
        circuits_closed=sum(
            1 for c in circuits.values() if c.get("state") == "CLOSED"
        ),
    )

    # Calcular promedios de CPU/memoria de nodos activos
    if hb:
        active_nodes = hb.get_active_nodes()
        if active_nodes:
            snapshot.cpu_avg = sum(n.cpu_percent for n in active_nodes) / len(active_nodes)
            snapshot.memory_avg = sum(
                n.memory_percent for n in active_nodes
            ) / len(active_nodes)

    return jsonify(snapshot.to_dict())


@metrics_bp.route("/metrics/topology", methods=["GET"])
def get_topology():
    """Topología de la red: nodos agrupados por máquina."""
    registry = get_registry()
    if not registry:
        return jsonify({"error": "Registry no disponible"}), 503

    nodes = registry.get_all_nodes()
    topology = {}

    for node in nodes:
        mid = str(node.machine_id)
        if mid not in topology:
            topology[mid] = {
                "machine_id": node.machine_id,
                "nodes": [],
            }
        topology[mid]["nodes"].append(node.to_dict())

    return jsonify({
        "machines": sorted(topology.values(), key=lambda m: m["machine_id"]),
        "total_nodes": len(nodes),
    })
