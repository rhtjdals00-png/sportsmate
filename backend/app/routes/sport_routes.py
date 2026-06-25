from flask import Blueprint, jsonify, request

from app.models import Sport, SportCategory

sport_bp = Blueprint("sports", __name__)


@sport_bp.get("/sport-categories")
def categories():
    return jsonify({"items": [category.to_dict() for category in SportCategory.query.order_by(SportCategory.id).all()]})


@sport_bp.get("/sports")
def sports():
    query = Sport.query
    if request.args.get("category_id"):
        query = query.filter_by(category_id=int(request.args["category_id"]))
    return jsonify({"items": [sport.to_dict() for sport in query.order_by(Sport.id).all()]})


@sport_bp.get("/sport-purposes")
def sport_purposes():
    categories = SportCategory.query.order_by(SportCategory.id).all()
    purposes = []
    for category in categories:
        for purpose in category.purpose.split("/"):
            cleaned = purpose.strip()
            if cleaned and cleaned not in purposes:
                purposes.append(cleaned)
    return jsonify({"items": purposes})
