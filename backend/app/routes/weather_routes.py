from datetime import datetime

from flask import Blueprint, jsonify, request

from app.services.weather_service import WeatherServiceError, get_daily_forecast, get_forecast


weather_bp = Blueprint("weather", __name__)


def _parse_target(value):
    if not value:
        raise ValueError("예보를 확인할 날짜와 시간이 필요합니다.")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError as error:
        raise ValueError("날짜와 시간 형식이 올바르지 않습니다.") from error


def _forecast_response(latitude, longitude, target, address=""):
    try:
        latitude, longitude = float(latitude), float(longitude)
    except (TypeError, ValueError) as error:
        raise ValueError("장소 좌표가 필요합니다.") from error
    if not (33 <= latitude <= 39.5 and 124 <= longitude <= 132):
        raise ValueError("대한민국 내 장소만 예보를 확인할 수 있습니다.")
    return get_forecast(latitude, longitude, target, address)


@weather_bp.get("/forecast")
def forecast():
    try:
        data = _forecast_response(
            request.args.get("latitude"), request.args.get("longitude"),
            _parse_target(request.args.get("at")), request.args.get("address", ""),
        )
        return jsonify({"forecast": data})
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
    except WeatherServiceError as error:
        return jsonify({"message": str(error)}), 502


@weather_bp.get("/daily")
def daily():
    try:
        latitude = request.args.get("latitude")
        longitude = request.args.get("longitude")
        try:
            latitude, longitude = float(latitude), float(longitude)
        except (TypeError, ValueError) as error:
            raise ValueError("장소 좌표가 필요합니다.") from error
        if not (33 <= latitude <= 39.5 and 124 <= longitude <= 132):
            raise ValueError("대한민국 내 장소만 예보를 확인할 수 있습니다.")
        return jsonify({"weather": get_daily_forecast(latitude, longitude)})
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
    except WeatherServiceError as error:
        return jsonify({"message": str(error)}), 502
