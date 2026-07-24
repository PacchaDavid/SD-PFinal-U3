# =============================================================================
# Health API - Load Balancer
# =============================================================================
# Endpoints de health check para el Load Balancer.
# =============================================================================

import time
from flask import jsonify

from src.api import health_bp
from src.service_registry import ServiceRegistry

# Referencias inyectadas desde app.py
get_registry = lambda: None
get_startup_time = lambda: time.time()


def init_health(registry_fn, startup_fn):
    global get_registry, get_startup_time
    get_registry = registry_fn
    get_startup_time = startup_fn


@health_bp.route("/health", methods=["GET"])
def health():
    """Health check principal del Load Balancer."""
    registry = get_registry()
    if registry:
        stats = registry.get_stats()
        is_healthy = stats.services_healthy > 0

        return jsonify({
            "status": "healthy" if is_healthy else "degraded",
            "service": "load-balancer",
            "version": "1.0.0",
            "uptime_seconds": time.time() - get_startup_time(),
            "healthy_services": stats.services_healthy,
            "unhealthy_services": stats.services_unhealthy,
            "total_requests": stats.total_requests,
            "timestamp": time.time(),
        }), 200 if is_healthy else 503

    return jsonify({"status": "error", "message": "Registry no disponible"}), 503


@health_bp.route("/health/ready", methods=["GET"])
def readiness():
    """Readiness probe."""
    return jsonify({
        "status": "ready",
        "timestamp": time.time(),
    })


@health_bp.route("/health/services", methods=["GET"])
def services_health():
    """Health check detallado de todos los servicios backend."""
    registry = get_registry()
    if not registry:
        return jsonify({"error": "Registry no disponible"}), 503

    return jsonify({
        "services": registry.get_all_summaries(),
        "timestamp": time.time(),
    })
