from flask import Blueprint, jsonify

from app.models import Meeting, Report, User

admin_bp = Blueprint("admin", __name__)


@admin_bp.get("/users")
def users():
    return jsonify({"items": [user.to_dict() for user in User.query.order_by(User.created_at.desc()).all()]})


@admin_bp.get("/meetings")
def meetings():
    return jsonify({"items": [meeting.to_dict() for meeting in Meeting.query.order_by(Meeting.created_at.desc()).all()]})


@admin_bp.get("/reports")
def reports():
    return jsonify({
        "items": [
            {
                "id": item.id,
                "target_type": item.target_type,
                "target_id": item.target_id,
                "reason": item.reason,
                "status": item.status
            }
            for item in Report.query.order_by(Report.created_at.desc()).all()
        ]
    })
