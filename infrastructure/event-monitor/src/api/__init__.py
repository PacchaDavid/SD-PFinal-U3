# =============================================================================
# API Blueprints - Event Monitor
# =============================================================================
from flask import Blueprint

health_bp = Blueprint("health", __name__)
nodes_bp = Blueprint("nodes", __name__)
events_bp = Blueprint("events", __name__)
metrics_bp = Blueprint("metrics", __name__)
status_bp = Blueprint("status", __name__)
