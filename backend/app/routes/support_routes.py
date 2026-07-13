from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models import SupportInquiry, User
from app.services.notification_service import create_notification

support_bp = Blueprint("support", __name__)

CATEGORY_LABELS = {
    "account": "계정",
    "meeting": "모임",
    "payment": "결제",
    "bug": "오류 신고",
    "report": "신고/분쟁",
    "general": "기타",
}


def _current_user_id():
    return int(get_jwt_identity())


def _clean_text(value, max_length=None):
    text = (value or "").strip()
    if max_length and len(text) > max_length:
        text = text[:max_length]
    return text


def _clean_attachment(data):
    attachment_url = _clean_text(data.get("attachment_url"))
    attachment_name = _clean_text(data.get("attachment_name"), 255)
    if not attachment_url:
        return "", ""
    if not attachment_url.startswith("data:image/"):
        raise ValueError("이미지 파일만 첨부할 수 있습니다.")
    if len(attachment_url) > 4_500_000:
        raise ValueError("첨부 이미지는 3MB 이하로 올려주세요.")
    return attachment_url, attachment_name or "문의 첨부 이미지"


def _notify_admins(inquiry, display_name, category):
    admins = User.query.filter(User.role.in_(["admin", "superadmin"]), User.is_active.is_(True)).all()
    for admin in admins:
        create_notification(
            admin.id,
            "support_inquiry",
            "새 고객 문의가 접수되었습니다",
            f"{display_name}님이 {CATEGORY_LABELS[category]} 문의를 보냈습니다.",
            "/admin/support",
            commit=False,
            send_push=False,
        )


@support_bp.get("/inquiries")
@jwt_required()
def list_my_inquiries():
    user_id = _current_user_id()
    inquiries = (
        SupportInquiry.query
        .filter_by(user_id=user_id)
        .order_by(SupportInquiry.created_at.desc(), SupportInquiry.id.desc())
        .all()
    )
    return jsonify({"items": [item.to_dict() for item in inquiries]})


@support_bp.post("/inquiries")
@jwt_required()
def create_inquiry():
    user_id = _current_user_id()
    data = request.get_json() or {}
    category = data.get("category") if data.get("category") in CATEGORY_LABELS else "general"
    title = _clean_text(data.get("title"), 120)
    content = _clean_text(data.get("content"), 4000)
    try:
        attachment_url, attachment_name = _clean_attachment(data)
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    if len(title) < 2:
        return jsonify({"message": "문의 제목을 2자 이상 입력해주세요."}), 400
    if len(content) < 5:
        return jsonify({"message": "문의 내용을 5자 이상 입력해주세요."}), 400

    user = User.query.get(user_id)
    inquiry = SupportInquiry(
        user_id=user_id,
        requester_email=user.email if user else "",
        requester_name=(user.nickname or user.name) if user else "",
        source="member",
        category=category,
        title=title,
        content=content,
        attachment_url=attachment_url,
        attachment_name=attachment_name,
        status="pending",
        priority="normal",
    )
    db.session.add(inquiry)
    db.session.flush()

    display_name = (user.nickname or user.name or user.email) if user else "회원"
    _notify_admins(inquiry, display_name, category)

    db.session.commit()
    return jsonify({"item": inquiry.to_dict(), "message": "문의가 접수되었습니다."}), 201


@support_bp.post("/public-inquiries")
def create_public_inquiry():
    data = request.get_json() or {}
    category = data.get("category") if data.get("category") in CATEGORY_LABELS else "account"
    email = _clean_text(data.get("email"), 255).lower()
    name = _clean_text(data.get("name"), 120)
    title = _clean_text(data.get("title"), 120)
    content = _clean_text(data.get("content"), 4000)
    source = data.get("source") if data.get("source") in {"suspended_login", "guest"} else "guest"

    if len(email) < 5 or "@" not in email:
        return jsonify({"message": "답변을 받을 이메일을 입력해주세요."}), 400
    if len(title) < 2:
        return jsonify({"message": "문의 제목을 2자 이상 입력해주세요."}), 400
    if len(content) < 5:
        return jsonify({"message": "문의 내용을 5자 이상 입력해주세요."}), 400

    inquiry = SupportInquiry(
        user_id=None,
        requester_email=email,
        requester_name=name,
        source=source,
        category=category,
        title=title,
        content=content,
        status="pending",
        priority="high" if source == "suspended_login" else "normal",
    )
    db.session.add(inquiry)
    db.session.flush()

    display_name = inquiry.requester_name or email
    _notify_admins(inquiry, display_name, category)

    db.session.commit()
    return jsonify({"item": inquiry.to_dict(), "message": "문의가 접수되었습니다."}), 201
