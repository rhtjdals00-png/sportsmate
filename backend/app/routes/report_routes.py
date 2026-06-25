from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models import Report

report_bp = Blueprint("reports", __name__)


@report_bp.post("")
@jwt_required()
def create_report():
    data = request.get_json() or {}
    report = Report(
        reporter_id=int(get_jwt_identity()),
        target_type=data.get("target_type", "meeting"),
        target_id=data.get("target_id"),
        reason=data.get("reason", "")
    )
    db.session.add(report)
    db.session.commit()
    return jsonify({
        "report": {
            "id": report.id,
            "target_type": report.target_type,
            "target_id": report.target_id,
            "reason": report.reason,
            "status": report.status
        }
    }), 201
