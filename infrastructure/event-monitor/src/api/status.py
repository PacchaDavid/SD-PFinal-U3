# =============================================================================
# Status API - Event Monitor
# =============================================================================
# Endpoint de estado general del sistema distribuido.
# =============================================================================

import time
from flask import jsonify

from src.api import status_bp

# Referencias inyectadas desde app.py
get_heartbeat_monitor = lambda: None
get_registry = lambda: None
get_events = lambda: []
get_circuits = lambda: {}
get_redis = lambda: None
get_startup_time = lambda: time.time()


def init_status(hb_fn, registry_fn, events_fn, circuits_fn, redis_fn, startup_fn):
    global get_heartbeat_monitor, get_registry, get_events
    global get_circuits, get_redis, get_startup_time
    get_heartbeat_monitor = hb_fn
    get_registry = registry_fn
    get_events = events_fn
    get_circuits = circuits_fn
    get_redis = redis_fn
    get_startup_time = startup_fn


@status_bp.route("/status", methods=["GET"])
def system_status():
    """Estado general completo del sistema distribuido."""
    hb = get_heartbeat_monitor()
    registry = get_registry()
    events = get_events()
    circuits = get_circuits()
    redis_client = get_redis()

    # Estado de servicios
    services_status = {}
    if registry:
        for node in registry.get_all_nodes():
            svc = node.service_name
            if svc not in services_status:
                services_status[svc] = {
                    "service": svc,
                    "total_nodes": 0,
                    "active_nodes": 0,
                    "status": "unknown",
                }
            services_status[svc]["total_nodes"] += 1
            if node.status.value == "active":
                services_status[svc]["active_nodes"] += 1

        for svc in services_status:
            s = services_status[svc]
            if s["active_nodes"] == s["total_nodes"]:
                s["status"] = "healthy"
            elif s["active_nodes"] > 0:
                s["status"] = "degraded"
            else:
                s["status"] = "down"

    return jsonify({
        "service": "event-monitor",
        "version": "1.0.0",
        "uptime_seconds": time.time() - get_startup_time(),
        "redis_connected": redis_client.is_connected() if redis_client else False,
        "nodes": hb.get_summary() if hb else {"error": "No disponible"},
        "services": list(services_status.values()) if registry else [],
        "circuit_breakers": list(circuits.values()) if circuits else [],
        "events_total": len(events),
        "timestamp": time.time(),
    })
