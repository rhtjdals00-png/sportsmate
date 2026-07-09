from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from app.extensions import db
from app.models.chatbot import ChatbotSession, ChatbotMessage

chatbot_bp = Blueprint("chatbot", __name__)


def ensure_session_access(session_id, user_id):
    session = ChatbotSession.query.get_or_404(session_id)
    if session.user_id != user_id:
        raise PermissionError("해당 대화에 접근 권한이 없습니다.")
    return session


@chatbot_bp.get("/sessions")
@jwt_required()
def get_sessions():
    user_id = int(get_jwt_identity())
    sessions = (
        ChatbotSession.query.filter_by(user_id=user_id)
        .order_by(ChatbotSession.updated_at.desc())
        .all()
    )
    return jsonify({"items": [s.to_dict() for s in sessions]})


@chatbot_bp.post("/sessions")
@jwt_required()
def create_session():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    title = (data.get("title") or "").strip() or "새로운 대화"

    session = ChatbotSession(user_id=user_id, title=title)
    db.session.add(session)
    db.session.commit()
    return jsonify(session.to_dict()), 210


@chatbot_bp.get("/sessions/<int:session_id>/messages")
@jwt_required()
def get_messages(session_id):
    user_id = int(get_jwt_identity())
    try:
        session = ensure_session_access(session_id, user_id)
    except PermissionError as e:
        return jsonify({"message": str(e)}), 403

    messages = session.messages
    return jsonify({"items": [m.to_dict() for m in messages]})


@chatbot_bp.post("/sessions/<int:session_id>/message")
@jwt_required()
def send_message(session_id):
    user_id = int(get_jwt_identity())
    try:
        session = ensure_session_access(session_id, user_id)
    except PermissionError as e:
        return jsonify({"message": str(e)}), 403

    data = request.get_json() or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"message": "메시지를 입력해주세요."}), 400

    # 1. 유저 메시지 저장
    user_msg = ChatbotMessage(session_id=session.id, role="user", content=content)
    db.session.add(user_msg)

    # 2. 봇의 모의(Mock) 응답 생성
    bot_reply_content = generate_mock_reply(content)
    bot_msg = ChatbotMessage(session_id=session.id, role="assistant", content=bot_reply_content)
    db.session.add(bot_msg)

    # 3. 만약 세션의 제목이 기본값 "새로운 대화"라면, 첫 번째 질문 내용으로 제목 자동 업데이트
    if session.title == "새로운 대화":
        summary = content[:15] + "..." if len(content) > 15 else content
        session.title = summary

    # 4. 세션 수정 시각 업데이트 (최근 대화 순으로 상단 노출하기 위함)
    session.updated_at = db.func.now()

    db.session.commit()

    return jsonify({
        "user_message": user_msg.to_dict(),
        "bot_message": bot_msg.to_dict()
    }), 210


@chatbot_bp.route("/sessions/<int:session_id>", methods=["PUT"])
@jwt_required()
def update_session(session_id):
    user_id = int(get_jwt_identity())
    try:
        session = ensure_session_access(session_id, user_id)
    except PermissionError as e:
        return jsonify({"message": str(e)}), 403

    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"message": "수정할 제목을 입력해주세요."}), 400

    session.title = title
    session.updated_at = db.func.now()
    db.session.commit()
    return jsonify(session.to_dict())


@chatbot_bp.delete("/sessions/<int:session_id>")
@jwt_required()
def delete_session(session_id):
    user_id = int(get_jwt_identity())
    try:
        session = ensure_session_access(session_id, user_id)
    except PermissionError as e:
        return jsonify({"message": str(e)}), 403

    db.session.delete(session)
    db.session.commit()
    return jsonify({"message": "대화방이 삭제되었습니다."})


def generate_mock_reply(user_content):
    """LLM 연동 전에 보여줄 임시 모의 응답 생성기"""
    text = user_content.lower()
    if "모임" in text or "추천" in text:
        return "현재 활성화된 다양한 스포츠 모임이 있습니다. 배드민턴, 풋살, 농구 등의 인기 모임을 확인해보세요! 상세 검색은 '모임 찾기' 메뉴에서도 가능합니다."
    elif "날씨" in text or "야외" in text:
        return "오늘 날씨에 맞춰 실외 구장이나 실내 체육관을 검색해 보시는 것은 어떨까요? 위치 검색을 통해 가까운 체육시설을 찾아드릴 수 있습니다."
    elif "안녕" in text or "하이" in text:
        return "안녕하세요! SportsMate AI 어시스턴트입니다. 스포츠 모임 참여, 장소 탐색, 혹은 앱 이용 방법에 대해 무엇이든 편하게 여쭤보세요!"
    elif "개발자" in text or "만든" in text:
        return "저는 SportsMate 팀에서 개발한 AI 챗봇입니다. 현재는 임시 응답 모드로 작동 중이며, 곧 스마트한 AI 기능을 탑재할 예정입니다."
    else:
        return f"보내주신 의견('{user_content}')을 잘 들었습니다. 현재 저는 임시 챗봇 모드로 작동 중이어서 자세한 안내는 어렵지만, 곧 정식 AI 비서 기능이 런칭될 예정이니 기대해주세요!"
