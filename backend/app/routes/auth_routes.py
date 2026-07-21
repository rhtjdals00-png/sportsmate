from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import text

from app.extensions import db
from app.models import User
from app.services.auth_service import InvalidStoredProviderError, LoginProviderMismatchError, LoginProviderRequiredError, login_user, login_with_supabase, register_user, sync_supabase_user, verify_supabase_user

auth_bp = Blueprint("auth", __name__)

CHECKABLE_FIELDS = {
    "email": User.email,
    "nickname": User.nickname,
    "phone_number": User.phone_number,
}

FIELD_LABELS = {
    "email": "이메일",
    "nickname": "닉네임",
    "phone_number": "핸드폰 번호",
}

SUPPORTED_LOGIN_PROVIDERS = {"email", "google", "kakao"}


def normalize_phone_number(value):
    digits = "".join(ch for ch in (value or "") if ch.isdigit())[:11]
    if not digits:
        return ""
    if len(digits) <= 3:
        return digits
    if len(digits) <= 7:
        return f"{digits[:3]}-{digits[3:]}"
    return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"


def auth_email_exists(email):
    try:
        result = db.session.execute(
            text(
                """
                select 1
                from auth.users
                where lower(email) = :email
                  and email_confirmed_at is not null
                limit 1
                """
            ),
            {"email": email.lower()},
        )
        return result.first() is not None
    except Exception as error:
        db.session.rollback()
        current_app.logger.warning("Supabase auth.users email check failed: %s", error)
        return False


@auth_bp.get("/availability")
def availability():
    field = (request.args.get("field") or "").strip()
    value = (request.args.get("value") or "").strip()

    if field not in CHECKABLE_FIELDS:
        return jsonify({"message": "확인할 수 없는 항목입니다."}), 400
    if not value:
        return jsonify({"available": True, "message": ""})

    # 닉네임은 user_tag로 식별하므로 중복을 허용합니다.
    if field == "nickname":
        return jsonify({"available": True, "message": "사용 가능한 닉네임입니다."})

    if field == "email":
        value = value.lower()
    if field == "phone_number":
        value = normalize_phone_number(value)

    exists = User.query.filter(CHECKABLE_FIELDS[field] == value).first() is not None
    if field == "email":
        exists = exists or auth_email_exists(value)
    label = FIELD_LABELS[field]
    return jsonify({
        "available": not exists,
        "message": f"이미 사용 중인 {label}입니다." if exists else f"사용 가능한 {label}입니다."
    })


@auth_bp.post("/email-verification")
def request_email_verification():
    email = ((request.get_json() or {}).get("email") or "").strip().lower()
    if not email:
        return jsonify({"message": "이메일을 입력해주세요."}), 400
    if User.query.filter_by(email=email).first() or auth_email_exists(email):
        return jsonify({"message": "이미 가입된 이메일입니다."}), 400
    return jsonify({"message": "Supabase Auth에서 인증 메일을 발송합니다."})


@auth_bp.post("/sync")
def sync_user():
    access_token = (request.headers.get("X-Supabase-Access-Token") or "").strip()
    if not access_token:
        return jsonify({"message": "Supabase 인증 토큰이 필요합니다."}), 401

    try:
        supabase_user = verify_supabase_user(access_token)
    except ValueError:
        return jsonify({"message": "Supabase 인증 토큰이 유효하지 않습니다."}), 401

    verified_auth_user_id = (supabase_user.get("id") or "").strip()
    verified_email = (supabase_user.get("email") or "").strip().lower()
    if not verified_auth_user_id:
        return jsonify({"message": "Supabase 사용자 정보를 확인할 수 없습니다."}), 401
    if not verified_email:
        return jsonify({"message": "Supabase 계정 이메일을 확인할 수 없습니다."}), 400

    data = request.get_json() or {}
    requested_login_provider = data.get("login_provider")
    if requested_login_provider is not None:
        if not isinstance(requested_login_provider, str):
            return jsonify({"message": "login_provider 형식이 올바르지 않습니다."}), 400
        requested_login_provider = requested_login_provider.strip().lower()
        if requested_login_provider not in SUPPORTED_LOGIN_PROVIDERS:
            return jsonify({"message": "login_provider 형식이 올바르지 않습니다."}), 400

        verified_identity_providers = {
            (identity.get("provider") or "").strip().lower()
            for identity in (supabase_user.get("identities") or [])
        }
        if requested_login_provider not in verified_identity_providers:
            return jsonify({"message": "선택한 로그인 방식을 Supabase 계정에서 확인할 수 없습니다."}), 401
        data["login_provider"] = requested_login_provider
    else:
        # Session restoration has no newly selected login method. Existing
        # users may restore their session, while new users are still rejected
        # by sync_supabase_user until an explicit provider is supplied.
        data.pop("login_provider", None)

    requested_auth_user_id = (data.get("auth_user_id") or data.get("id") or "").strip()
    requested_email = (data.get("email") or "").strip().lower()
    if requested_auth_user_id and requested_auth_user_id != verified_auth_user_id:
        return jsonify({"message": "인증 사용자 정보가 일치하지 않습니다."}), 401
    if requested_email and requested_email != verified_email:
        return jsonify({"message": "인증 이메일 정보가 일치하지 않습니다."}), 401

    data["auth_user_id"] = verified_auth_user_id
    data["email"] = verified_email

    try:
        return jsonify(sync_supabase_user(data))
    except LoginProviderRequiredError as error:
        return jsonify({
            "success": False,
            "code": "LOGIN_PROVIDER_REQUIRED",
            "message": str(error),
        }), 400
    except LoginProviderMismatchError as error:
        return jsonify({
            "success": False,
            "code": "LOGIN_PROVIDER_MISMATCH",
            "registered_provider": error.registered_provider,
            "message": str(error),
        }), 409
    except InvalidStoredProviderError as error:
        return jsonify({
            "success": False,
            "code": "LOGIN_PROVIDER_INVALID",
            "message": str(error),
        }), 409
    except ValueError as error:
        msg = str(error)
        if "서비스 점검" in msg:
            return jsonify({"message": msg, "maintenance": True}), 503
        return jsonify({"message": msg}), 400


@auth_bp.post("/register")
def register():
    try:
        return jsonify(register_user(request.get_json() or {})), 201
    except ValueError as error:
        return jsonify({"message": str(error)}), 400


@auth_bp.post("/login")
def login():
    try:
        return jsonify(login_user(request.get_json() or {}))
    except ValueError as error:
        msg = str(error)
        if "서비스 점검" in msg:
            return jsonify({"message": msg, "maintenance": True}), 503
        return jsonify({"message": msg}), 401


@auth_bp.post("/social-login")
def social_login():
    try:
        return jsonify(login_with_supabase(request.get_json() or {}))
    except ValueError as error:
        msg = str(error)
        if "서비스 점검" in msg:
            return jsonify({"message": msg, "maintenance": True}), 503
        return jsonify({"message": msg}), 401


@auth_bp.post("/logout")
def logout():
    return jsonify({"message": "로그아웃되었습니다."})


@auth_bp.get("/me")
@jwt_required()
def me():
    user = User.query.get_or_404(int(get_jwt_identity()))
    return jsonify({"user": user.to_dict()})
