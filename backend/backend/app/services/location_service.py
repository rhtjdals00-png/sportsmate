import json
from urllib.parse import urlencode
from urllib.request import urlopen

from flask import current_app
from sqlalchemy import or_

from app.extensions import db
from app.models import Region


def list_regions(level=None, parent_code=None):
    query = Region.query
    if level:
        query = query.filter_by(level=level)
    if parent_code:
        query = query.filter_by(parent_code=parent_code)
    return query.order_by(Region.code.asc()).all()


def upsert_regions(region_rows):
    saved = []
    for row in region_rows:
        code = str(row.get("code") or row.get("region_cd") or row.get("adm_cd") or "").strip()
        name = (row.get("name") or row.get("region_nm") or row.get("adm_nm") or "").strip()
        if not code or not name:
            continue

        parent_code = str(row.get("parent_code") or row.get("parent_cd") or "").strip() or None
        level = row.get("level") or ("sido" if parent_code is None else "sigungu")
        full_name = row.get("full_name") or row.get("full_nm") or name
        region = Region.query.filter_by(code=code).first()
        if not region:
            region = Region(code=code)
            db.session.add(region)
        region.name = name
        region.level = level
        region.parent_code = parent_code
        region.full_name = full_name
        region.latitude = row.get("latitude") or row.get("lat")
        region.longitude = row.get("longitude") or row.get("lon") or row.get("lng")
        saved.append(region)
    db.session.commit()
    return saved


def sync_regions_from_configured_api():
    api_url = current_app.config.get("MOLIT_REGION_API_URL")
    api_key = current_app.config.get("MOLIT_API_KEY")
    if not api_url:
        return {"synced": 0, "message": "MOLIT_REGION_API_URL이 설정되지 않아 내장 지역 데이터를 사용합니다."}

    params = {}
    if api_key:
        params["serviceKey"] = api_key
    separator = "&" if "?" in api_url else "?"
    target_url = f"{api_url}{separator}{urlencode(params)}" if params else api_url

    with urlopen(target_url, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))

    rows = payload.get("items") or payload.get("data") or payload.get("response", {}).get("body", {}).get("items", [])
    if isinstance(rows, dict):
        rows = rows.get("item", [])
    saved = upsert_regions(rows)
    return {"synced": len(saved), "message": "지역 데이터를 동기화했습니다."}


def search_vworld_places(keyword, size=10):
    api_key = current_app.config.get("VWORLD_API_KEY")
    if not api_key:
        keyword_filter = f"%{keyword}%"
        fallback = Region.query.filter(or_(Region.name.ilike(keyword_filter), Region.full_name.ilike(keyword_filter))).limit(size).all()
        return {
            "source": "local",
            "items": [
                {
                    "title": region.full_name,
                    "address": region.full_name,
                    "latitude": region.latitude,
                    "longitude": region.longitude
                }
                for region in fallback
            ]
        }

    params = {
        "service": "search",
        "request": "search",
        "version": "2.0",
        "crs": "EPSG:4326",
        "size": size,
        "page": 1,
        "query": keyword,
        "type": "PLACE",
        "format": "json",
        "key": api_key
    }
    if current_app.config.get("VWORLD_DOMAIN"):
        params["domain"] = current_app.config["VWORLD_DOMAIN"]
    target_url = f"https://api.vworld.kr/req/search?{urlencode(params)}"
    with urlopen(target_url, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))

    raw_items = payload.get("response", {}).get("result", {}).get("items", [])
    return {
        "source": "vworld",
        "items": [
            {
                "title": item.get("title"),
                "address": item.get("address", {}).get("road") or item.get("address", {}).get("parcel"),
                "latitude": float(item.get("point", {}).get("y")) if item.get("point", {}).get("y") else None,
                "longitude": float(item.get("point", {}).get("x")) if item.get("point", {}).get("x") else None
            }
            for item in raw_items
        ]
    }
