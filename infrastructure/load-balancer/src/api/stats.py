# =============================================================================
# Stats API - Load Balancer
# =============================================================================
# Endpoints de estadísticas y métricas del Load Balancer.
# =============================================================================

import time
from flask import jsonify

from src.api import stats_bp

# Referencias inyectadas desde app.py
get_registry = lambda: None
get_heartbeat_sender = lambda: None


def init_stats(registry_fn, hb_sender_fn):
    global get_registry, get_heartbeat_sender
    get_registry = registry_fn
    get_heartbeat_sender = hb_sender_fn


@stats_bp.route("/stats", methods=["GET"])
def stats():
    """Estadísticas globales del Load Balancer."""
    registry = get_registry()
    if not registry:
        return jsonify({"error": "Registry no disponible"}), 503

    stats_data = registry.get_stats()
    hb_sender = get_heartbeat_sender()

    result = stats_data.to_dict()
    if hb_sender:
        result["heartbeats_sent"] = hb_sender.sent_count

    return jsonify(result)


@stats_bp.route("/stats/services", methods=["GET"])
def service_list():
    """Lista todos los servicios con sus instancias y estado."""
    registry = get_registry()
    if not registry:
        return jsonify({"error": "Registry no disponible"}), 503

    return jsonify({
        "services": registry.get_all_summaries(),
        "total_services": len(registry.get_all_services()),
    })
