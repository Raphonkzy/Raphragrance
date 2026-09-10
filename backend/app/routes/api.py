"""
Raphragrance — API Routes
All routes under /api/* query the local PostgreSQL PerfumeService.
"""
from flask import Blueprint, current_app, jsonify, request

api_bp = Blueprint("api", __name__, url_prefix="/api")


def _svc():
    return current_app.perfume_service


# ---------------------------------------------------------------------------
# Fragrances
# ---------------------------------------------------------------------------

@api_bp.get("/fragrances")
def list_fragrances():
    search = request.args.get("search", "")
    limit = min(int(request.args.get("limit", 20)), 100)
    page = max(int(request.args.get("page", 1)), 1)
    gender = request.args.get("gender", "")
    sort_by = request.args.get("sort_by", "popularity")  # popularity, rating, name, brand, year
    sort_order = request.args.get("sort_order", "desc")  # asc, desc
    try:
        data = _svc().get_fragrances(
            search=search, limit=limit, page=page, gender=gender,
            sort_by=sort_by, sort_order=sort_order
        )
        return jsonify({"data": data, "mock": _svc().is_using_mock})
    except Exception as exc:
        current_app.logger.error("list_fragrances error: %s", exc)
        return jsonify({"error": "Failed to fetch fragrances"}), 502


@api_bp.get("/fragrances/match")
def match_fragrances():
    notes = request.args.get("notes", "")
    accords = request.args.get("accords", "")
    limit = min(int(request.args.get("limit", 10)), 50)
    try:
        data = _svc().match_fragrances(notes=notes, accords=accords, limit=limit)
        return jsonify({"data": data, "mock": _svc().is_using_mock})
    except Exception as exc:
        current_app.logger.error("match_fragrances error: %s", exc)
        return jsonify({"error": "Failed to match fragrances"}), 502


@api_bp.get("/fragrances/similar")
def similar_fragrances():
    name = request.args.get("name", "")
    limit = min(int(request.args.get("limit", 6)), 20)
    if not name:
        return jsonify({"error": "name parameter required"}), 400
    try:
        data = _svc().get_similar(name=name, limit=limit)
        return jsonify({"data": data, "mock": _svc().is_using_mock})
    except Exception as exc:
        current_app.logger.error("similar_fragrances error: %s", exc)
        return jsonify({"error": "Failed to fetch similar fragrances"}), 502


@api_bp.get("/fragrances/<fragrance_id>")
def get_fragrance(fragrance_id: str):
    try:
        data = _svc().get_fragrance_by_id(fragrance_id)
        if data is None:
            return jsonify({"error": "Fragrance not found"}), 404
        return jsonify({"data": data, "mock": _svc().is_using_mock})
    except Exception as exc:
        current_app.logger.error("get_fragrance error: %s", exc)
        return jsonify({"error": "Failed to fetch fragrance"}), 502


# ---------------------------------------------------------------------------
# Brands
# ---------------------------------------------------------------------------

@api_bp.get("/brands/<brand_name>")
def get_brand(brand_name: str):
    try:
        data = _svc().get_brand(brand_name)
        return jsonify({"data": data, "mock": _svc().is_using_mock})
    except Exception as exc:
        current_app.logger.error("get_brand error: %s", exc)
        return jsonify({"error": "Failed to fetch brand"}), 502


# ---------------------------------------------------------------------------
# Notes & Accords
# ---------------------------------------------------------------------------

@api_bp.get("/notes")
def get_notes():
    search = request.args.get("search", "")
    try:
        data = _svc().get_notes(search=search)
        return jsonify({"data": data, "mock": _svc().is_using_mock})
    except Exception as exc:
        current_app.logger.error("get_notes error: %s", exc)
        return jsonify({"error": "Failed to fetch notes"}), 502


@api_bp.get("/accords")
def get_accords():
    search = request.args.get("search", "")
    try:
        data = _svc().get_accords(search=search)
        return jsonify({"data": data, "mock": _svc().is_using_mock})
    except Exception as exc:
        current_app.logger.error("get_accords error: %s", exc)
        return jsonify({"error": "Failed to fetch accords"}), 502
