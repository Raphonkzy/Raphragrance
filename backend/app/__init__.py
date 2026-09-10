"""
Raphragrance — Flask Application Factory
"""
import logging
import os

from flask import Flask, send_from_directory
from flask_cors import CORS

from .config import get_config
from .middleware import register_middleware
from .routes.api import api_bp
from .routes.health import health_bp
from .services.perfume_service import PerfumeService


def create_app() -> Flask:
    cfg = get_config()

    # -----------------------------------------------------------------------
    # Logging setup
    # -----------------------------------------------------------------------
    logging.basicConfig(
        level=getattr(logging, cfg.LOG_LEVEL, logging.INFO),
        format="%(message)s",
    )

    # -----------------------------------------------------------------------
    # Resolve static frontend directory
    # -----------------------------------------------------------------------
    # When running in Docker the built Next.js export is at /app/frontend_dist
    # For local dev without Docker we look for it relative to this file.
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    static_dir = os.environ.get(
        "FRONTEND_DIST",
        os.path.join(base_dir, "frontend_dist"),
    )
    has_static = os.path.isdir(static_dir)

    # -----------------------------------------------------------------------
    # Flask app
    # -----------------------------------------------------------------------
    app = Flask(__name__, static_folder=static_dir if has_static else None)
    app.config.from_object(cfg)

    # CORS
    CORS(app, origins=cfg.CORS_ORIGINS)

    # Middleware
    register_middleware(app)

    # -----------------------------------------------------------------------
    # Database perfume service (attached to app)
    # -----------------------------------------------------------------------
    app.perfume_service = PerfumeService(  # type: ignore[attr-defined]
        db_url=cfg.DATABASE_URL,
    )

    # -----------------------------------------------------------------------
    # Register blueprints
    # -----------------------------------------------------------------------
    app.register_blueprint(health_bp)
    app.register_blueprint(api_bp)

    # -----------------------------------------------------------------------
    # Serve Next.js static export (SPA fallback)
    # -----------------------------------------------------------------------
    if has_static:
        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve_frontend(path):
            # Serve static assets directly
            file_path = os.path.join(static_dir, path)
            if path and os.path.isfile(file_path):
                return send_from_directory(static_dir, path)
            # SPA fallback — serve index.html for all routes
            return send_from_directory(static_dir, "index.html")
    else:
        @app.route("/")
        def root():
            from flask import jsonify
            return jsonify({
                "service": "Raphragrance API",
                "status": "running",
                "note": "Frontend not built yet. Run: cd frontend && npm run build",
                "endpoints": ["/healthz", "/readyz", "/api/fragrances", "/api/notes", "/api/accords"],
            })

    return app
