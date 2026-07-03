from flask import Blueprint, jsonify, request
from flask import current_app
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models import Notification, PushSubscription

notification_bp = Blueprint("notifications", __name__)


@notification_bp.get("/notifications")
@jwt_required()
def notifications():
    try:
        limit = max(1, min(int(request.args.get("limit", 100)), 200))
    except (TypeError, ValueError):
        limit = 100
    items = (
        Notification.query
        .filter_by(user_id=int(get_jwt_identity()))
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    return jsonify({"items": [item.to_dict() for item in items]})


@notification_bp.patch("/notifications/<int:notification_id>/read")
@jwt_required()
def read_notification(notification_id):
    item = Notification.query.filter_by(id=notification_id, user_id=int(get_jwt_identity())).first_or_404()
    item.is_read = True
    db.session.commit()
    return jsonify({"notification": item.to_dict()})


@notification_bp.get("/push-public-key")
def push_public_key():
    return jsonify({"publicKey": current_app.config.get("VAPID_PUBLIC_KEY", "")})


@notification_bp.post("/push-subscriptions")
@jwt_required()
def create_push_subscription():
    data = request.get_json() or {}
    user_id = int(get_jwt_identity())
    endpoint = data.get("endpoint", "")
    p256dh = data.get("keys", {}).get("p256dh", data.get("p256dh", ""))
    auth = data.get("keys", {}).get("auth", data.get("auth", ""))
    if not endpoint or not p256dh or not auth:
        return jsonify({"message": "푸시 구독 정보가 올바르지 않습니다."}), 400
    item = PushSubscription.query.filter_by(user_id=user_id, endpoint=endpoint).first()
    if item:
        item.p256dh = p256dh
        item.auth = auth
        item.user_agent = request.headers.get("User-Agent")
        item.is_active = True
    else:
        item = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            user_agent=request.headers.get("User-Agent")
        )
        db.session.add(item)
    db.session.commit()
    return jsonify({"subscription_id": item.id}), 201


@notification_bp.delete("/push-subscriptions/<int:subscription_id>")
@jwt_required()
def delete_push_subscription(subscription_id):
    item = PushSubscription.query.filter_by(id=subscription_id, user_id=int(get_jwt_identity())).first_or_404()
    item.is_active = False
    db.session.commit()
    return jsonify({"subscription_id": item.id, "is_active": item.is_active})
