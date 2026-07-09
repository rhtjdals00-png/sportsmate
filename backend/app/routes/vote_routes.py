from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models import Participant, Vote, VoteOption, VoteResponse
from app.utils.timezone import kst_now

vote_bp = Blueprint("votes", __name__)


@vote_bp.post("/<int:vote_id>/participate")
@jwt_required()
def participate(vote_id):
    vote = Vote.query.get_or_404(vote_id)
    user_id = int(get_jwt_identity())
    participant = Participant.query.filter_by(meeting_id=vote.meeting_id, user_id=user_id, status="approved").first()
    if not participant:
        return jsonify({"message": "승인된 참여자만 투표할 수 있습니다."}), 403

    if vote.ends_at and vote.ends_at < kst_now():
        return jsonify({"message": "종료된 투표입니다."}), 400

    data = request.get_json() or {}
    raw_option_ids = data.get("option_ids")
    if raw_option_ids is None:
        raw_option_ids = [data.get("option_id")]
    if not isinstance(raw_option_ids, list):
        raw_option_ids = [raw_option_ids]

    option_ids = []
    for option_id in raw_option_ids:
        try:
            option_ids.append(int(option_id))
        except (TypeError, ValueError):
            continue
    option_ids = list(dict.fromkeys(option_ids))
    if not option_ids:
        return jsonify({"message": "투표 선택지를 선택해주세요."}), 400
    if not vote.allow_multiple:
        option_ids = option_ids[:1]

    valid_options = VoteOption.query.filter(VoteOption.vote_id == vote.id, VoteOption.id.in_(option_ids)).all()
    valid_option_ids = {option.id for option in valid_options}
    if len(valid_option_ids) != len(option_ids):
        return jsonify({"message": "유효하지 않은 투표 선택지입니다."}), 400

    VoteResponse.query.filter_by(vote_id=vote.id, user_id=user_id).delete()
    for option_id in option_ids:
        db.session.add(VoteResponse(vote_id=vote.id, option_id=option_id, user_id=user_id))
    db.session.commit()
    data = vote.to_dict()
    data["selected_option_ids"] = option_ids
    data["selected_option_id"] = option_ids[0] if option_ids else None
    return jsonify({"vote": data})
