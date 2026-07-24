# =============================================================================
# API Blueprints - Circuit Breaker
# =============================================================================
from flask import Blueprint

health_bp = Blueprint("cb_health", __name__)
circuits_bp = Blueprint("cb_circuits", __name__)
