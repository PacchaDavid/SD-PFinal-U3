# =============================================================================
# Health API - Event Monitor
# =============================================================================
# Endpoints de health check para el Event Monitor y Redis.
# =============================================================================

import time
from flask import jsonify

from src.api import health_bp


# Referencias inyectadas desde app.py
get_redis = lambda: None
get_startup_time = lambda: time.time()


def init_health(redis_fn, startup_time_fn):
    """Inicializa referencias a servicios externos."""
    global get_redis, get_startup_time
    get_redis = redis_fn
    get_startup_time = startup_time_fn


@health_bp.route("/health", methods=["GET"])
def health_check():
    """Health check principal del Event Monitor."""
    redis_client = get_redis()
    redis_ok = redis_client is not None and redis_client.is_connected()

    status = {
        "status": "healthy" if redis_ok else "degraded",
        "service": "event-monitor",
        "version": "1.0.0",
        "uptime_seconds": time.time() - get_startup_time(),
        "redis_connected": redis_ok,
        "timestamp": time.time(),
    }

    status_code = 200 if redis_ok else 503
    return jsonify(status), status_code


@health_bp.route("/health/redis", methods=["GET"])
def redis_health():
    """Health check específico de la conexión Redis."""
    redis_client = get_redis()
    if redis_client and redis_client.is_connected():
        return jsonify({
            "status": "healthy",
            "redis_host": redis_client.host,
            "redis_port": redis_client.port,
            "timestamp": time.time(),
        })
    return jsonify({
        "status": "unhealthy",
        "error": "Redis no conectado",
        "timestamp": time.time(),
    }), 503


@health_bp.route("/health/ready", methods=["GET"])
def readiness():
    """Readiness probe - indica si el servicio está listo para tráfico."""
    redis_client = get_redis()
    # El servicio está listo aunque Redis no esté disponible
    # (funciona en modo degradado)
    return jsonify({
        "status": "ready",
        "timestamp": time.time(),
    })
