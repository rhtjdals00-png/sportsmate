from flask import Blueprint, jsonify, request
from sqlalchemy.orm import joinedload

from app.models import Sport, SportCategory

sport_bp = Blueprint("sports", __name__)

CATEGORY_ORDER = {
    "구기 종목": 1,
    "라켓 스포츠": 2,
    "러닝 / 야외": 3,
    "피트니스": 4,
    "기타": 5,
}

SPORT_ORDER = {
    "축구": 1,
    "풋살": 2,
    "농구": 3,
    "배구": 4,
    "야구": 5,
    "족구": 6,
    "배드민턴": 7,
    "탁구": 8,
    "테니스": 9,
    "스쿼시": 10,
    "러닝": 11,
    "등산": 12,
    "트레킹": 13,
    "자전거": 14,
    "산책": 15,
    "헬스": 16,
    "크로스핏": 17,
    "클라이밍": 18,
    "요가": 19,
    "필라테스": 20,
    "볼링": 21,
    "당구": 22,
    "골프": 23,
    "수영": 24,
}


def _category_sort_key(category):
    return (CATEGORY_ORDER.get(category.name, 999), category.id)


def _sport_sort_key(sport):
    return (CATEGORY_ORDER.get(sport.category.name, 999), SPORT_ORDER.get(sport.name, 999), sport.id)


def _cached_categories():
    categories = SportCategory.query.all()
    filtered = [cat for cat in categories if cat.name not in ["야외 활동", "야외활동"]]
    return [category.to_dict() for category in sorted(filtered, key=_category_sort_key)]


def _cached_sports(category_id=None):
    query = Sport.query.options(joinedload(Sport.category))
    if category_id is not None:
        query = query.filter_by(category_id=category_id)
    sports = query.all()
    filtered = [
        sport for sport in sports
        if sport.category.name not in ["야외 활동", "야외활동"]
        and sport.name not in ["걷기"]
    ]
    return [sport.to_dict() for sport in sorted(filtered, key=_sport_sort_key)]


def _cached_sport_purposes():
    purposes = []
    for category in sorted(SportCategory.query.all(), key=_category_sort_key):
        for purpose in category.purpose.split("/"):
            cleaned = purpose.strip()
            if cleaned and cleaned not in purposes:
                purposes.append(cleaned)
    return purposes


def _cached_json(payload):
    response = jsonify(payload)
    response.headers["Cache-Control"] = "public, max-age=300"
    return response


@sport_bp.get("/sport-categories")
def categories():
    return _cached_json({"items": _cached_categories()})


@sport_bp.get("/sports")
def sports():
    category_id = None
    if request.args.get("category_id"):
        try:
            category_id = int(request.args["category_id"])
        except (TypeError, ValueError):
            return _cached_json({"items": []})
    return _cached_json({"items": _cached_sports(category_id)})


@sport_bp.get("/sport-purposes")
def sport_purposes():
    return _cached_json({"items": _cached_sport_purposes()})
