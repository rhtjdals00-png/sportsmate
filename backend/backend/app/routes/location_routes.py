from flask import Blueprint, jsonify, request

from app.services.location_service import list_regions, search_vworld_places, sync_regions_from_configured_api

location_bp = Blueprint("locations", __name__)


@location_bp.get("/regions")
def regions():
    items = list_regions(level=request.args.get("level"), parent_code=request.args.get("parent_code"))
    return jsonify({"items": [item.to_dict() for item in items]})


@location_bp.post("/regions/sync")
def sync_regions():
    result = sync_regions_from_configured_api()
    return jsonify(result)


@location_bp.get("/map/search")
def map_search():
    keyword = request.args.get("keyword", "").strip()
    if not keyword:
        return jsonify({"items": [], "source": "local"})
    result = search_vworld_places(keyword, size=min(int(request.args.get("size", 10)), 30))
    return jsonify(result)
