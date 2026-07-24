# =============================================================================
# Events API - Event Monitor
# =============================================================================
# Endpoints para consultar eventos del sistema.
# =============================================================================

from flask import jsonify, request

from src.api import events_bp

# Referencias inyectadas desde app.py
get_events = lambda: []


def init_events(events_fn):
    global get_events
    get_events = events_fn


@events_bp.route("/events", methods=["GET"])
def list_events():
    """Lista eventos del sistema con filtros opcionales.

    Query params:
        limit: int (default 100) - Máximo de eventos a retornar
        type: str - Filtrar por tipo de evento
        source: str - Filtrar por fuente
        node_id: str - Filtrar por nodo
        severity: str - Filtrar por severidad (info, warning, error)
        since: float - Timestamp desde (epoch)
    """
    events = get_events()

    # Aplicar filtros
    event_type = request.args.get("type")
    source = request.args.get("source")
    node_id = request.args.get("node_id")
    severity = request.args.get("severity")
    since = request.args.get("since", type=float)
    limit = request.args.get("limit", 100, type=int)

    filtered = events
    if event_type:
        filtered = [e for e in filtered if e.type == event_type]
    if source:
        filtered = [e for e in filtered if e.source == source]
    if node_id:
        filtered = [e for e in filtered if e.node_id == node_id]
    if severity:
        filtered = [e for e in filtered if e.severity == severity]
    if since:
        filtered = [e for e in filtered if e.timestamp >= since]

    # Ordenar por timestamp descendente y limitar
    filtered.sort(key=lambda e: e.timestamp, reverse=True)
    filtered = filtered[:limit]

    return jsonify({
        "total": len(filtered),
        "events": [e.to_dict() for e in filtered],
    })


@events_bp.route("/events/types", methods=["GET"])
def list_event_types():
    """Lista los tipos de eventos disponibles."""
    from src.models import EventType
    return jsonify({
        "types": [e.value for e in EventType],
    })


@events_bp.route("/events/summary", methods=["GET"])
def events_summary():
    """Resumen de eventos: conteo por tipo y severidad."""
    events = get_events()

    by_type = {}
    by_severity = {"info": 0, "warning": 0, "error": 0}
    by_source = {}

    for event in events:
        by_type[event.type] = by_type.get(event.type, 0) + 1
        by_severity[event.severity] = by_severity.get(event.severity, 0) + 1
        by_source[event.source] = by_source.get(event.source, 0) + 1

    return jsonify({
        "total": len(events),
        "by_type": by_type,
        "by_severity": by_severity,
        "by_source": by_source,
    })
