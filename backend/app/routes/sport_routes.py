from functools import lru_cache

from flask import Blueprint, jsonify, request
from sqlalchemy.orm import joinedload

from app.models import Sport, SportCategory

sport_bp = Blueprint("sports", __name__)


@lru_cache(maxsize=1)
def _cached_categories():
    return [category.to_dict() for category in SportCategory.query.order_by(SportCategory.id).all()]


@lru_cache(maxsize=32)
def _cached_sports(category_id=None):
    query = Sport.query.options(joinedload(Sport.category))
    if category_id is not None:
        query = query.filter_by(category_id=category_id)
    return [sport.to_dict() for sport in query.order_by(Sport.id).all()]


@lru_cache(maxsize=1)
def _cached_sport_purposes():
    purposes = []
    for category in SportCategory.query.order_by(SportCategory.id).all():
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
