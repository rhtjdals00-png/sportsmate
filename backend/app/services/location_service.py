import json
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen

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


def _strip_html(value):
    return re.sub(r"<[^>]+>", "", value or "").strip()


def _naver_coord(value):
    if value in (None, ""):
        return None
    try:
        return round(float(value) / 10000000, 7)
    except (TypeError, ValueError):
        return None


def _float_or_none(value):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _local_result(title, address, latitude=None, longitude=None, road_address="", category="", source=""):
    return {
        "title": _strip_html(title) or _strip_html(address),
        "address": _strip_html(address) or _strip_html(title),
        "road_address": _strip_html(road_address),
        "category": _strip_html(category),
        "latitude": _float_or_none(latitude),
        "longitude": _float_or_none(longitude),
        "source": source,
    }


def _kakao_request(url, keyword, size=10):
    api_key = current_app.config.get("KAKAO_REST_API_KEY")
    if not api_key:
        return None

    params = urlencode({"query": keyword, "size": size})
    request = Request(
        f"{url}?{params}",
        headers={
            "Authorization": f"KakaoAK {api_key}",
            "User-Agent": "SportsMate/0.1",
        },
    )
    with urlopen(request, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def _kakao_coord_request(longitude, latitude):
    api_key = current_app.config.get("KAKAO_REST_API_KEY")
    url = current_app.config.get("KAKAO_COORD2ADDRESS_URL")
    if not api_key or not url:
        return None

    params = urlencode({"x": longitude, "y": latitude})
    request = Request(
        f"{url}?{params}",
        headers={
            "Authorization": f"KakaoAK {api_key}",
            "User-Agent": "SportsMate/0.1",
        },
    )
    with urlopen(request, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def search_kakao_keyword(keyword, size=10):
    payload = _kakao_request(current_app.config.get("KAKAO_KEYWORD_SEARCH_URL"), keyword, size=size)
    if payload is None:
        return None

    items = []
    for item in payload.get("documents", []):
        road_address = item.get("road_address_name") or ""
        address = road_address or item.get("address_name") or item.get("place_name") or keyword
        items.append(_local_result(
            item.get("place_name") or address,
            address,
            latitude=item.get("y"),
            longitude=item.get("x"),
            road_address=road_address,
            category=item.get("category_name") or "\uc7a5\uc18c",
            source="kakao-keyword",
        ))
    return {"source": "kakao-keyword", "items": items}


def search_kakao_address(keyword, size=10):
    payload = _kakao_request(current_app.config.get("KAKAO_ADDRESS_SEARCH_URL"), keyword, size=size)
    if payload is None:
        return None

    items = []
    for item in payload.get("documents", []):
        road = item.get("road_address") or {}
        jibun = item.get("address") or {}
        road_address = road.get("address_name") or ""
        address = road_address or jibun.get("address_name") or item.get("address_name") or keyword
        items.append(_local_result(
            address,
            address,
            latitude=item.get("y"),
            longitude=item.get("x"),
            road_address=road_address,
            category="\uc8fc\uc18c",
            source="kakao-address",
        ))
    return {"source": "kakao-address", "items": items}


def search_naver_geocode(keyword, size=10):
    client_id = current_app.config.get("NAVER_MAP_CLIENT_ID")
    client_secret = current_app.config.get("NAVER_MAP_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None

    params = urlencode({"query": keyword})
    request = Request(
        f"{current_app.config.get('NAVER_GEOCODE_URL')}?{params}",
        headers={
            "X-NCP-APIGW-API-KEY-ID": client_id,
            "X-NCP-APIGW-API-KEY": client_secret,
            "User-Agent": "SportsMate/0.1",
        },
    )
    with urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8"))

    items = []
    for item in (payload.get("addresses") or [])[:size]:
        road_address = _strip_html(item.get("roadAddress"))
        jibun_address = _strip_html(item.get("jibunAddress"))
        address = road_address or jibun_address or keyword
        items.append(_local_result(
            address,
            address,
            latitude=item.get("y"),
            longitude=item.get("x"),
            road_address=road_address,
            category="\uc8fc\uc18c",
            source="naver-geocode",
        ))
    return {"source": "naver-geocode", "items": items}


def search_naver_places(keyword, size=10):
    client_id = current_app.config.get("NAVER_SEARCH_CLIENT_ID")
    client_secret = current_app.config.get("NAVER_SEARCH_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None

    params = urlencode({"query": keyword, "display": size, "start": 1, "sort": "random"})
    request = Request(f"https://openapi.naver.com/v1/search/local.json?{params}")
    request.add_header("X-Naver-Client-Id", client_id)
    request.add_header("X-Naver-Client-Secret", client_secret)
    with urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8"))

    items = []
    for item in payload.get("items", []):
        title = _strip_html(item.get("title"))
        road_address = _strip_html(item.get("roadAddress"))
        address = road_address or _strip_html(item.get("address")) or title
        items.append(_local_result(
            title or address,
            address,
            latitude=_naver_coord(item.get("mapy")),
            longitude=_naver_coord(item.get("mapx")),
            road_address=road_address,
            category=item.get("category"),
            source="naver-local",
        ))
    return {"source": "naver-local", "items": items}


def _naver_region_address(region, land, include_road=False):
    parts = []
    for key in ("area1", "area2", "area3", "area4"):
        name = (region.get(key) or {}).get("name")
        if name:
            parts.append(name)

    road_name = land.get("name") if include_road else ""
    if road_name:
        parts.append(road_name)

    number1 = land.get("number1")
    number2 = land.get("number2")
    if number1:
        parts.append(f"{number1}-{number2}" if number2 else str(number1))

    return " ".join(parts).strip()


def reverse_naver_geocode(latitude, longitude):
    client_id = current_app.config.get("NAVER_MAP_CLIENT_ID")
    client_secret = current_app.config.get("NAVER_MAP_CLIENT_SECRET")
    url = current_app.config.get("NAVER_REVERSE_GEOCODE_URL")
    if not client_id or not client_secret or not url:
        return None

    params = urlencode({
        "coords": f"{longitude},{latitude}",
        "orders": "roadaddr,addr",
        "output": "json",
    })
    request = Request(
        f"{url}?{params}",
        headers={
            "X-NCP-APIGW-API-KEY-ID": client_id,
            "X-NCP-APIGW-API-KEY": client_secret,
            "User-Agent": "SportsMate/0.1",
        },
    )
    with urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8"))

    for item in payload.get("results", []):
        region = item.get("region") or {}
        land = item.get("land") or {}
        is_road = item.get("name") == "roadaddr"
        address = _naver_region_address(region, land, include_road=is_road)
        if not address:
            continue
        building = ((land.get("addition0") or {}).get("value") or "").strip()
        title = building or address
        return _local_result(
            title,
            address,
            latitude=latitude,
            longitude=longitude,
            road_address=address if is_road else "",
            category="주소",
            source="naver-reverse",
        )
    return None


def reverse_kakao_geocode(latitude, longitude):
    payload = _kakao_coord_request(longitude, latitude)
    if payload is None:
        return None

    for item in payload.get("documents", []):
        road = item.get("road_address") or {}
        jibun = item.get("address") or {}
        road_address = road.get("address_name") or ""
        address = road_address or jibun.get("address_name") or ""
        if not address:
            continue
        title = road.get("building_name") or address
        return _local_result(
            title,
            address,
            latitude=latitude,
            longitude=longitude,
            road_address=road_address,
            category="주소",
            source="kakao-reverse",
        )
    return None


def reverse_geocode(latitude, longitude):
    for reverser in (reverse_naver_geocode, reverse_kakao_geocode):
        try:
            result = reverser(latitude, longitude)
        except Exception:
            continue
        if result:
            return result
    return _local_result(
        "지도에서 선택한 위치",
        "지도에서 선택한 위치",
        latitude=latitude,
        longitude=longitude,
        category="좌표",
        source="reverse-unavailable",
    )


def search_places(keyword, size=10):
    merged = []
    seen = set()
    sources = []
    for searcher in (search_kakao_address, search_naver_geocode, search_kakao_keyword, search_naver_places):
        try:
            result = searcher(keyword, size=size)
        except Exception:
            continue
        if result is None:
            continue
        sources.append(result.get("source"))
        for item in result.get("items", []):
            key = (
                item.get("title") or "",
                item.get("address") or "",
                item.get("latitude"),
                item.get("longitude"),
            )
            if key in seen:
                continue
            seen.add(key)
            merged.append(item)
            if len(merged) >= size:
                return {"source": "+".join(filter(None, sources)), "items": merged}
    if merged:
        return {"source": "+".join(filter(None, sources)), "items": merged}
    return search_vworld_places(keyword, size=size)

def search_vworld_places(keyword, size=10):
    api_key = current_app.config.get("VWORLD_API_KEY")
    if not api_key:
        return {"source": "external-unavailable", "items": []}


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
