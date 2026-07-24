import time
from flask import jsonify

from src.api import health_bp

get_db = lambda: None
get_stats = lambda: None
get_startup_time = lambda: time.time()


def init_health(db_fn, stats_fn, startup_fn):
    global get_db, get_stats, get_startup_time
    get_db = db_fn
    get_stats = stats_fn
    get_startup_time = startup_fn


@health_bp.route("/health", methods=["GET"])
def health():
    db = get_db()
    stats = get_stats()
    primary_ok = db.is_primary_connected() if db else False
    return jsonify({
        "status": "healthy" if primary_ok else "degraded",
        "service": "replication-manager",
        "version": "1.0.0",
        "uptime_seconds": time.time() - get_startup_time(),
        "primary_connected": primary_ok,
        "replicas": {
            str(rid): s.to_dict()
            for rid, s in (db.get_replica_states().items() if db else {}.items())
        } if db else {},
        "stats": stats.to_dict() if stats else {},
        "timestamp": time.time(),
    }), 200 if primary_ok else 503


@health_bp.route("/health/ready", methods=["GET"])
def readiness():
    return jsonify({"status": "ready", "timestamp": time.time()})
