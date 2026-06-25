from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models import Participant, Vote, VoteOption, VoteResponse

vote_bp = Blueprint("votes", __name__)


@vote_bp.post("/<int:vote_id>/participate")
@jwt_required()
def participate(vote_id):
    vote = Vote.query.get_or_404(vote_id)
    user_id = int(get_jwt_identity())
    participant = Participant.query.filter_by(meeting_id=vote.meeting_id, user_id=user_id, status="approved").first()
    if not participant:
        return jsonify({"message": "승인된 참여자만 투표할 수 있습니다."}), 403

    option_id = (request.get_json() or {}).get("option_id")
    option = VoteOption.query.filter_by(id=option_id, vote_id=vote.id).first_or_404()
    existing = VoteResponse.query.filter_by(vote_id=vote.id, user_id=user_id).first()
    if existing:
        existing.option_id = option.id
    else:
        db.session.add(VoteResponse(vote_id=vote.id, option_id=option.id, user_id=user_id))
    db.session.commit()
    return jsonify({"vote": vote.to_dict()})
