# =============================================================================
# API Blueprints - Load Balancer
# =============================================================================
from flask import Blueprint

health_bp = Blueprint("lb_health", __name__)
stats_bp = Blueprint("lb_stats", __name__)
services_bp = Blueprint("lb_services", __name__)
