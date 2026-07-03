from functools import lru_cache

from flask import Blueprint, current_app, jsonify, request

from app.services.location_service import list_regions, reverse_geocode, search_places, sync_regions_from_configured_api

location_bp = Blueprint("locations", __name__)


@lru_cache(maxsize=128)
def _cached_regions(level=None, parent_code=None):
    items = list_regions(level=level or None, parent_code=parent_code or None)
    return [item.to_dict() for item in items]


def _cached_json(payload):
    response = jsonify(payload)
    response.headers["Cache-Control"] = "public, max-age=300"
    return response


@location_bp.get("/regions")
def regions():
    items = _cached_regions(request.args.get("level") or "", request.args.get("parent_code") or "")
    return _cached_json({"items": items})


@location_bp.post("/regions/sync")
def sync_regions():
    result = sync_regions_from_configured_api()
    _cached_regions.cache_clear()
    return jsonify(result)


@location_bp.get("/map/config")
def map_config():
    return jsonify({
        "naver_dynamic_map_client_id": current_app.config.get("NAVER_DYNAMIC_MAP_CLIENT_ID", "")
    })


@location_bp.get("/map/search")
def map_search():
    keyword = request.args.get("keyword", "").strip()
    if not keyword:
        return jsonify({"items": [], "source": "local"})
    result = search_places(keyword, size=min(int(request.args.get("size", 10)), 30))
    return jsonify(result)


@location_bp.get("/map/reverse")
def map_reverse():
    try:
        latitude = float(request.args.get("latitude", ""))
        longitude = float(request.args.get("longitude", ""))
    except (TypeError, ValueError):
        return jsonify({"message": "latitude와 longitude가 필요합니다."}), 400

    return jsonify({"item": reverse_geocode(latitude, longitude)})
