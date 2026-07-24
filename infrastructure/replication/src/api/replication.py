import time
from flask import jsonify, request

from src.api import replication_bp
from src.models import ReplicationEntry

get_db = lambda: None
get_wal = lambda: None
get_sync = lambda: None


def init_replication(db_fn, wal_fn, sync_fn):
    global get_db, get_wal, get_sync
    get_db = db_fn
    get_wal = wal_fn
    get_sync = sync_fn


@replication_bp.route("/api/replication/log", methods=["POST"])
def receive_log():
    """Recibe una entrada de replicación desde un microservicio.

    Request body:
        id: str, operation: str, table_name: str, record_id: str,
        service: str, data: str (JSON), timestamp: float
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body requerido"}), 400

    entry = ReplicationEntry(
        id=data.get("id", ""),
        operation=data.get("operation", "INSERT"),
        table_name=data.get("table_name", ""),
        record_id=data.get("record_id", ""),
        service=data.get("service", ""),
        data=data.get("data", "{}"),
        created_at=data.get("timestamp", time.time()),
        total_replicas=3,
    )

    if not entry.id:
        return jsonify({"error": "id es requerido"}), 400
    if not entry.table_name:
        return jsonify({"error": "table_name es requerido"}), 400

    wal = get_wal()
    if wal:
        wal.enqueue_entry(entry)
        return jsonify({
            "status": "queued",
            "entry_id": entry.id,
            "message": "Entrada de replicación recibida",
        }), 202

    # Fallback: escribir directamente a DB
    db = get_db()
    if db and db.insert_entry(entry.to_dict()):
        return jsonify({
            "status": "stored",
            "entry_id": entry.id,
        }), 201

    return jsonify({"error": "Sistema de replicación no disponible"}), 503


@replication_bp.route("/api/replication/status", methods=["GET"])
def replication_status():
    """Estado del sistema de replicación."""
    db = get_db()
    wal = get_wal()
    stats = wal.get_stats() if wal else None
    replica_states = db.get_replica_states() if db else {}

    return jsonify({
        "service": stats.service_name if stats else "unknown",
        "stats": stats.to_dict() if stats else {},
        "replicas": {
            str(rid): s.to_dict()
            for rid, s in replica_states.items()
        },
        "health_checks": {
            str(rid): db.check_replica_health(rid)
            for rid in replica_states
        } if db else {},
        "timestamp": time.time(),
    })


@replication_bp.route("/api/replication/entries", methods=["GET"])
def list_entries():
    """Lista entradas de replicación con filtros."""
    db = get_db()
    if not db:
        return jsonify({"error": "DB no disponible"}), 503

    limit = request.args.get("limit", 50, type=int)
    status = request.args.get("status")

    entries = db.get_pending_entries(limit=limit)
    if status:
        entries = [e for e in entries if e.get("status") == status]

    return jsonify({
        "total": len(entries),
        "entries": [dict(e) for e in entries],
    })


@replication_bp.route("/api/replication/entries/<entry_id>", methods=["GET"])
def get_entry(entry_id: str):
    """Obtiene una entrada de replicación por ID."""
    db = get_db()
    if not db:
        return jsonify({"error": "DB no disponible"}), 503

    entries = db.get_pending_entries(limit=1000)
    entry = next((e for e in entries if e.get("id") == entry_id), None)
    if entry:
        return jsonify(dict(entry))
    return jsonify({"error": "Entry no encontrada"}), 404


@replication_bp.route("/api/replication/stats", methods=["GET"])
def stats():
    """Estadísticas detalladas de replicación."""
    wal = get_wal()
    db = get_db()
    if not wal or not db:
        return jsonify({"error": "No disponible"}), 503

    stats_data = wal.get_stats()
    counts = db.get_entry_count_by_status()

    return jsonify({
        **stats_data.to_dict(),
        "counts_by_status": counts,
        "replica_details": {
            str(rid): s.to_dict()
            for rid, s in db.get_replica_states().items()
        },
    })
