# =============================================================================
# Circuits API - Circuit Breaker
# =============================================================================
# Endpoints para consultar y gestionar circuit breakers.
# =============================================================================

from flask import jsonify, request

from src.api import circuits_bp

get_state_machine = lambda: None


def init_circuits(sm_fn):
    global get_state_machine
    get_state_machine = sm_fn


@circuits_bp.route("/circuits", methods=["GET"])
def list_circuits():
    """Lista todos los circuit breakers con su estado actual."""
    sm = get_state_machine()
    if not sm:
        return jsonify({"error": "State machine no disponible"}), 503

    stats = sm.get_stats()
    return jsonify(stats)


@circuits_bp.route("/circuits/<service_name>", methods=["GET"])
def get_circuit(service_name: str):
    """Obtiene el estado detallado de un circuit breaker específico."""
    sm = get_state_machine()
    if not sm:
        return jsonify({"error": "State machine no disponible"}), 503

    cb = sm.get_circuit(service_name)
    if cb:
        return jsonify(cb.to_dict())
    return jsonify({"error": f"Circuit Breaker '{service_name}' no encontrado"}), 404


@circuits_bp.route("/circuits/<service_name>/state", methods=["GET"])
def get_circuit_state(service_name: str):
    """Obtiene solo el estado actual de un circuit breaker."""
    sm = get_state_machine()
    if not sm:
        return jsonify({"error": "State machine no disponible"}), 503

    cb = sm.get_circuit(service_name)
    if cb:
        return jsonify({
            "service": service_name,
            "state": cb.state.value,
            "is_open": cb.is_open,
            "is_closed": cb.is_closed,
            "is_half_open": cb.is_half_open,
        })
    return jsonify({
        "service": service_name,
        "state": "unknown",
        "is_open": False,
        "is_closed": False,
        "is_half_open": False,
    })


@circuits_bp.route("/circuits/<service_name>/failures", methods=["POST"])
def record_failure(service_name: str):
    """Registra un fallo para un servicio (simula fallo para pruebas).

    Request body:
        error: str - Descripción del error (opcional)
    """
    sm = get_state_machine()
    if not sm:
        return jsonify({"error": "State machine no disponible"}), 503

    data = request.get_json(silent=True) or {}
    error = data.get("error", "Fallo simulado vía API")

    cb = sm.record_failure(service_name, error)
    return jsonify({
        "message": f"Fallo registrado para {service_name}",
        "state": cb.state.value,
        "consecutive_failures": cb.consecutive_failures,
        "failure_count": cb.failure_count,
    })


@circuits_bp.route("/circuits/<service_name>/success", methods=["POST"])
def record_success(service_name: str):
    """Registra un éxito para un servicio (simula éxito para pruebas)."""
    sm = get_state_machine()
    if not sm:
        return jsonify({"error": "State machine no disponible"}), 503

    cb = sm.record_success(service_name)
    return jsonify({
        "message": f"Éxito registrado para {service_name}",
        "state": cb.state.value,
        "consecutive_successes": cb.consecutive_successes,
    })


@circuits_bp.route("/circuits/<service_name>/check", methods=["GET"])
def check_request_allowed(service_name: str):
    """Verifica si una request está permitida para un servicio.

    Útil para que el Load Balancer consulte antes de forwardear.
    """
    sm = get_state_machine()
    if not sm:
        return jsonify({"error": "State machine no disponible"}), 503

    # Intentar obtener el circuito (no crear si no existe)
    cb = sm.get_circuit(service_name)
    if not cb:
        # Si no hay circuito, el servicio está en CLOSED (permitido)
        return jsonify({
            "service": service_name,
            "allowed": True,
            "state": "CLOSED",
            "reason": "Sin circuit breaker registrado (default: permitido)",
        })

    allowed = sm.is_request_allowed(service_name)

    if not allowed:
        sm.record_rejection(service_name)

    return jsonify({
        "service": service_name,
        "allowed": allowed,
        "state": cb.state.value,
        "reason": (
            "Request permitida" if allowed else
            f"Circuit Breaker {cb.state.value}: request rechazada"
        ),
    })


@circuits_bp.route("/circuits/events", methods=["GET"])
def list_events():
    """Lista eventos del historial de circuit breakers.

    Query params:
        limit: int (default 100)
        service: str - Filtrar por servicio
        since: float - Timestamp desde (epoch)
    """
    sm = get_state_machine()
    if not sm:
        return jsonify({"error": "State machine no disponible"}), 503

    limit = request.args.get("limit", 100, type=int)
    service = request.args.get("service")
    since = request.args.get("since", type=float)

    events = sm.get_events(limit=limit, service=service, since=since)
    return jsonify({
        "total": len(events),
        "events": events,
    })


@circuits_bp.route("/circuits/stats", methods=["GET"])
def circuits_stats():
    """Estadísticas globales del sistema de circuit breakers."""
    sm = get_state_machine()
    if not sm:
        return jsonify({"error": "State machine no disponible"}), 503

    stats = sm.get_stats()
    return jsonify({
        "total_circuits": stats["total_circuits"],
        "closed_count": stats["closed_count"],
        "open_count": stats["open_count"],
        "half_open_count": stats["half_open_count"],
        "total_requests": stats["total_requests"],
        "total_rejections": stats["total_rejections"],
        "total_failures": stats["total_failures"],
    })
