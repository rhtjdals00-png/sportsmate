import json
import math
import re
import threading
import time
from datetime import datetime, timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlencode
from urllib.request import Request, urlopen

from flask import current_app


SHORT_URL = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
MID_LAND_URL = "https://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst"
MID_TEMP_URL = "https://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa"
SHORT_BASE_HOURS = (2, 5, 8, 11, 14, 17, 20, 23)

_CACHE = {}
_CACHE_LOCK = threading.Lock()


class WeatherServiceError(RuntimeError):
    pass


def _cached(key, ttl_seconds, loader):
    now = time.time()
    with _CACHE_LOCK:
        cached = _CACHE.get(key)
        if cached and cached[0] > now:
            return cached[1]
    value = loader()
    with _CACHE_LOCK:
        _CACHE[key] = (now + ttl_seconds, value)
        if len(_CACHE) > 300:
            expired = [item_key for item_key, item in _CACHE.items() if item[0] <= now]
            for item_key in expired:
                _CACHE.pop(item_key, None)
    return value


def _request_json(url, params):
    key = current_app.config.get("KMA_API_KEY", "").strip()
    if not key:
        raise WeatherServiceError("기상청 인증키가 설정되지 않았습니다.")
    query = {"serviceKey": unquote(key), "dataType": "JSON", "pageNo": 1, "numOfRows": 1000, **params}
    request = Request(f"{url}?{urlencode(query)}", headers={"User-Agent": "SportsMate/1.0"})
    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        raise WeatherServiceError("기상청 예보를 불러오지 못했습니다.") from error

    header = payload.get("response", {}).get("header", {})
    if str(header.get("resultCode")) != "00":
        raise WeatherServiceError(header.get("resultMsg") or "기상청 예보 요청이 실패했습니다.")
    return payload.get("response", {}).get("body", {})


def latlon_to_grid(latitude, longitude):
    re_value, grid = 6371.00877, 5.0
    slat1, slat2, olon, olat = map(math.radians, (30.0, 60.0, 126.0, 38.0))
    sn = math.tan(math.pi * 0.25 + slat2 * 0.5) / math.tan(math.pi * 0.25 + slat1 * 0.5)
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(sn)
    sf = math.tan(math.pi * 0.25 + slat1 * 0.5)
    sf = math.pow(sf, sn) * math.cos(slat1) / sn
    ro = math.tan(math.pi * 0.25 + olat * 0.5)
    ro = re_value / grid * sf / math.pow(ro, sn)
    ra = math.tan(math.pi * 0.25 + math.radians(latitude) * 0.5)
    ra = re_value / grid * sf / math.pow(ra, sn)
    theta = math.radians(longitude) - olon
    if theta > math.pi:
        theta -= 2.0 * math.pi
    if theta < -math.pi:
        theta += 2.0 * math.pi
    theta *= sn
    return int(ra * math.sin(theta) + 43.0 + 0.5), int(ro - ra * math.cos(theta) + 136.0 + 0.5)


def _latest_short_base(now):
    # 발표 시각 직후 데이터 지연을 고려해 20분 전까지 완료된 발표를 사용한다.
    safe_now = now - timedelta(minutes=20)
    candidates = [safe_now.replace(hour=hour, minute=0, second=0, microsecond=0) for hour in SHORT_BASE_HOURS]
    candidates = [candidate for candidate in candidates if candidate <= safe_now]
    return max(candidates) if candidates else (safe_now - timedelta(days=1)).replace(hour=23, minute=0, second=0, microsecond=0)


def _items(body):
    value = body.get("items", {})
    return value.get("item", []) if isinstance(value, dict) else []


def _float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _precipitation(value):
    if not value or "없음" in str(value):
        return 0.0
    if "미만" in str(value):
        return 0.5
    match = re.search(r"[\d.]+", str(value))
    return float(match.group()) if match else None


def _condition(sky, pty):
    pty_map = {
        "1": ("rain", "비"), "2": ("rain_snow", "비/눈"),
        "3": ("snow", "눈"), "4": ("shower", "소나기"),
    }
    if str(pty) in pty_map:
        return pty_map[str(pty)]
    return {"1": ("clear", "맑음"), "3": ("partly_cloudy", "구름많음"), "4": ("cloudy", "흐림")}.get(str(sky), ("unknown", "날씨 정보 없음"))


def _advice(label, pop, wind, temp):
    if label in {"비", "비/눈", "눈", "소나기"} or (pop is not None and pop >= 60):
        return "야외 운동 전 강수 상황을 확인하고 우산이나 방수 장비를 준비하세요."
    if wind is not None and wind >= 9:
        return "바람이 강할 수 있어 야외 운동과 장비 사용에 주의하세요."
    if temp is not None and temp >= 30:
        return "기온이 높습니다. 수분을 충분히 챙기고 한낮 운동은 피해주세요."
    if temp is not None and temp <= 0:
        return "기온이 낮습니다. 충분히 몸을 풀고 보온 장비를 준비하세요."
    return "운동하기 전 최신 예보와 현장 상황을 한 번 더 확인해주세요."


def _short_forecast(latitude, longitude, target, now):
    rows = _short_rows(latitude, longitude, now)
    grouped = _group_short_rows(rows)
    if not grouped:
        return None
    available = sorted(grouped)
    chosen = min(available, key=lambda item: abs(datetime.strptime(item, "%Y%m%d%H%M") - target))
    if abs(datetime.strptime(chosen, "%Y%m%d%H%M") - target) > timedelta(hours=2):
        return None
    return _short_item(grouped[chosen], datetime.strptime(chosen, "%Y%m%d%H%M"))


def _short_rows(latitude, longitude, now):
    nx, ny = latlon_to_grid(latitude, longitude)
    base = _latest_short_base(now)
    cache_key = ("short", nx, ny, base.strftime("%Y%m%d%H%M"))

    def load():
        return _items(_request_json(SHORT_URL, {
            "base_date": base.strftime("%Y%m%d"), "base_time": base.strftime("%H%M"), "nx": nx, "ny": ny,
        }))

    return _cached(cache_key, 1800, load)


def _group_short_rows(rows):
    grouped = {}
    for row in rows:
        timestamp = f"{row.get('fcstDate', '')}{row.get('fcstTime', '')}"
        grouped.setdefault(timestamp, {})[row.get("category")] = row.get("fcstValue")
    return grouped


def _short_item(values, forecast_at):
    condition, label = _condition(values.get("SKY"), values.get("PTY"))
    temp = _float(values.get("TMP"))
    pop = _float(values.get("POP"))
    wind = _float(values.get("WSD"))
    return {
        "available": True, "forecast_type": "short", "forecast_at": forecast_at.isoformat(),
        "condition": condition, "condition_label": label, "temperature_c": temp,
        "temperature_min_c": _float(values.get("TMN")), "temperature_max_c": _float(values.get("TMX")),
        "precipitation_probability": pop, "precipitation_mm": _precipitation(values.get("PCP")),
        "humidity": _float(values.get("REH")), "wind_speed_ms": wind,
        "message": _advice(label, pop, wind, temp),
    }


def get_daily_forecast(latitude, longitude):
    now = datetime.now()
    grouped = _group_short_rows(_short_rows(latitude, longitude, now))
    parsed = []
    for timestamp, values in sorted(grouped.items()):
        try:
            forecast_at = datetime.strptime(timestamp, "%Y%m%d%H%M")
        except ValueError:
            continue
        item = _short_item(values, forecast_at)
        if item.get("temperature_c") is not None:
            parsed.append(item)

    if not parsed:
        raise WeatherServiceError("오늘의 예보 데이터가 없습니다.")

    current = min(parsed, key=lambda item: abs(datetime.fromisoformat(item["forecast_at"]) - now))
    hourly = [item for item in parsed if now - timedelta(hours=1) <= datetime.fromisoformat(item["forecast_at"]) <= now + timedelta(hours=24)][:24]
    by_date = {}
    for item in parsed:
        date_value = item["forecast_at"][:10]
        day = by_date.setdefault(date_value, [])
        day.append(item)

    daily = []
    for date_value, items in sorted(by_date.items())[:3]:
        temperatures = [item["temperature_c"] for item in items if item.get("temperature_c") is not None]
        representative = min(items, key=lambda item: abs(datetime.fromisoformat(item["forecast_at"]).hour - 14))
        daily.append({
            "date": date_value,
            "condition": representative["condition"],
            "condition_label": representative["condition_label"],
            "temperature_min_c": min(temperatures) if temperatures else None,
            "temperature_max_c": max(temperatures) if temperatures else None,
            "precipitation_probability": max((item.get("precipitation_probability") or 0) for item in items),
        })

    return {
        "available": True,
        "current": current,
        "hourly": hourly,
        "daily": daily,
        "source": "기상청",
        "fetched_at": now.isoformat(timespec="seconds"),
    }


MID_REGIONS = [
    (("서울", "인천", "경기"), "11B00000", "11B10101"),
    (("강원",), "11D10000", "11D10401"),
    (("대전", "세종", "충남", "충청남"), "11C20000", "11C20401"),
    (("충북", "충청북"), "11C10000", "11C10301"),
    (("광주", "전남", "전라남"), "11F20000", "11F20501"),
    (("전북", "전라북"), "11F10000", "11F10201"),
    (("대구", "경북", "경상북"), "11H10000", "11H10701"),
    (("부산", "울산", "경남", "경상남"), "11H20000", "11H20201"),
    (("제주",), "11G00000", "11G00201"),
]


def _mid_region(address):
    for names, land_id, temp_id in MID_REGIONS:
        if any(name in (address or "") for name in names):
            return land_id, temp_id
    return None, None


def _latest_mid_base(now):
    safe_now = now - timedelta(minutes=20)
    hour = 18 if safe_now.hour >= 18 else 6
    candidate = safe_now.replace(hour=hour, minute=0, second=0, microsecond=0)
    return candidate if candidate <= safe_now else (candidate - timedelta(days=1)).replace(hour=18)


def _mid_forecast(target, address, now):
    land_id, temp_id = _mid_region(address)
    if not land_id:
        return {"available": False, "forecast_type": "mid", "forecast_at": target.isoformat(), "message": "중기예보 지역을 확인할 수 없습니다."}
    base = _latest_mid_base(now)
    tm_fc = base.strftime("%Y%m%d%H%M")
    land = _cached(("mid-land", land_id, tm_fc), 21600, lambda: (_items(_request_json(MID_LAND_URL, {"regId": land_id, "tmFc": tm_fc})) or [{}])[0])
    temp = _cached(("mid-temp", temp_id, tm_fc), 21600, lambda: (_items(_request_json(MID_TEMP_URL, {"regId": temp_id, "tmFc": tm_fc})) or [{}])[0])
    day = (target.date() - base.date()).days
    if day < 4 or day > 10:
        return None
    period = "Am" if target.hour < 12 else "Pm"
    weather_key = f"wf{day}{period}" if day <= 7 else f"wf{day}"
    rain_key = f"rnSt{day}{period}" if day <= 7 else f"rnSt{day}"
    label = land.get(weather_key) or "예보 정보 없음"
    condition = "rain" if "비" in label else "snow" if "눈" in label else "clear" if "맑" in label else "cloudy"
    min_temp, max_temp = _float(temp.get(f"taMin{day}")), _float(temp.get(f"taMax{day}"))
    pop = _float(land.get(rain_key))
    return {
        "available": True, "forecast_type": "mid", "forecast_at": target.isoformat(),
        "condition": condition, "condition_label": label, "temperature_c": None,
        "temperature_min_c": min_temp, "temperature_max_c": max_temp,
        "precipitation_probability": pop, "precipitation_mm": None, "humidity": None, "wind_speed_ms": None,
        "message": _advice(label, pop, None, max_temp),
    }


def get_extended_forecast(address):
    now = datetime.now()
    daily = []
    condition_priority = {"clear": 0, "cloudy": 1, "rain": 2, "snow": 3}

    for offset in range(4, 11):
        target_date = now.date() + timedelta(days=offset)
        base_target = datetime.combine(target_date, datetime.min.time())
        periods = [
            _mid_forecast(base_target.replace(hour=9), address, now),
            _mid_forecast(base_target.replace(hour=15), address, now),
        ]
        periods = [item for item in periods if item and item.get("available")]
        if not periods:
            continue

        labels = []
        for item in periods:
            label = item.get("condition_label") or "예보 정보 없음"
            if label not in labels:
                labels.append(label)
        representative = max(periods, key=lambda item: condition_priority.get(item.get("condition"), 1))
        precipitation_values = [
            item.get("precipitation_probability")
            for item in periods
            if item.get("precipitation_probability") is not None
        ]
        daily.append({
            "date": target_date.isoformat(),
            "condition": representative.get("condition") or "cloudy",
            "condition_label": " / ".join(labels),
            "temperature_min_c": periods[0].get("temperature_min_c"),
            "temperature_max_c": periods[0].get("temperature_max_c"),
            "precipitation_probability": max(precipitation_values) if precipitation_values else None,
        })

    return {
        "daily": daily,
        "source": "기상청 중기예보",
        "fetched_at": now.isoformat(timespec="seconds"),
    }


def get_forecast(latitude, longitude, target, address=""):
    now = datetime.now()
    if target < now - timedelta(hours=2):
        return {"available": False, "forecast_type": "unavailable", "forecast_at": target.isoformat(), "message": "지난 일정의 예보는 제공하지 않습니다."}
    days = (target.date() - now.date()).days
    result = _short_forecast(latitude, longitude, target, now) if days <= 3 else _mid_forecast(target, address, now) if days <= 10 else None
    if result is None:
        result = {"available": False, "forecast_type": "unavailable", "forecast_at": target.isoformat(), "message": "기상정보가 없습니다."}
    return {**result, "source": "기상청", "fetched_at": now.isoformat(timespec="seconds")}
