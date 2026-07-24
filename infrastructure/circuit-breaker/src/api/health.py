# =============================================================================
# Health API - Circuit Breaker
# =============================================================================
# Endpoints de health check para el Circuit Breaker.
# =============================================================================

import time
from flask import jsonify

from src.api import health_bp

get_stats_fn = lambda: {}
get_startup_time = lambda: time.time()


def init_health(stats_fn, startup_fn):
    global get_stats_fn, get_startup_time
    get_stats_fn = stats_fn
    get_startup_time = startup_fn


@health_bp.route("/health", methods=["GET"])
def health():
    """Health check principal del servicio Circuit Breaker."""
    try:
        stats = get_stats_fn()
        is_healthy = True  # El CB siempre está healthy aunque haya circuitos abiertos

        return jsonify({
            "status": "healthy" if is_healthy else "degraded",
            "service": "circuit-breaker",
            "version": "1.0.0",
            "uptime_seconds": time.time() - get_startup_time(),
            "total_circuits": stats.get("total_circuits", 0),
            "open_circuits": stats.get("open_count", 0),
            "half_open_circuits": stats.get("half_open_count", 0),
            "timestamp": time.time(),
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "timestamp": time.time(),
        }), 500


@health_bp.route("/health/ready", methods=["GET"])
def readiness():
    """Readiness probe."""
    return jsonify({"status": "ready", "timestamp": time.time()})
