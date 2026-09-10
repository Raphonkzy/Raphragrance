"""
Raphragrance — Kubernetes Health Check Routes
  GET /healthz  → liveness probe  (no external deps, always 200)
  GET /readyz   → readiness probe (checks local app state only)
"""
from flask import Blueprint, jsonify

health_bp = Blueprint("health", __name__)

# Simple flag — could be set to False during graceful shutdown
_ready = True


@health_bp.get("/healthz")
def liveness():
    """Liveness probe — no external dependencies."""
    return jsonify({"status": "ok", "service": "raphragrance"}), 200


@health_bp.get("/readyz")
def readiness():
    """Readiness probe — reflects internal app state only."""
    if not _ready:
        return jsonify({"status": "not_ready"}), 503
    return jsonify({"status": "ready", "service": "raphragrance"}), 200
