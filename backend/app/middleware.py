"""
Raphragrance — Structured JSON request logging middleware.
Logs method, path, status, duration, and a request UUID.
"""
import json
import logging
import time
import uuid

from flask import g, request

logger = logging.getLogger("raphragrance.access")


def register_middleware(app):
    """Attach before/after request hooks for structured logging."""

    @app.before_request
    def _before():
        g.request_id = str(uuid.uuid4())
        g.start_time = time.monotonic()

    @app.after_request
    def _after(response):
        duration_ms = round((time.monotonic() - g.start_time) * 1000, 2)
        log_record = {
            "request_id": g.request_id,
            "method": request.method,
            "path": request.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
            "remote_addr": request.remote_addr,
        }
        logger.info(json.dumps(log_record))
        # Inject request-id header into every response
        response.headers["X-Request-ID"] = g.request_id
        return response
