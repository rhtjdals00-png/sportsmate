import json
import re

from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models import User, UserProfile


def normalize_phone_number(value):
    digits = "".join(ch for ch in (value or "") if ch.isdigit())[:11]
    if not digits:
        return None
    if len(digits) <= 3:
        return digits
    if len(digits) <= 7:
        return f"{digits[:3]}-{digits[3:]}"
    return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"


def validate_password(password):
    if len(password) < 8:
        raise ValueError("비밀번호는 8자 이상 입력해주세요.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("비밀번호에 영문 대문자를 포함해주세요.")
    if not re.search(r"[a-z]", password):
        raise ValueError("비밀번호에 영문 소문자를 포함해주세요.")
    if not re.search(r"\d", password):
        raise ValueError("비밀번호에 숫자를 포함해주세요.")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise ValueError("비밀번호에 특수문자를 포함해주세요.")


def normalize_profile_payload(data):
    email = (data.get("email") or "").strip().lower()
    name = (data.get("name") or data.get("full_name") or "").strip()
    phone_number = normalize_phone_number(data.get("phone_number"))
    nickname = (data.get("nickname") or name or email.split("@")[0]).strip()
    return email, name, phone_number, nickname


def sync_supabase_user(data):
    auth_user_id = (data.get("auth_user_id") or data.get("id") or "").strip()
    email, name, phone_number, nickname = normalize_profile_payload(data)
    provider = (data.get("provider") or "email").strip() or "email"
    profile_image_url = (data.get("profile_image_url") or data.get("avatar_url") or "").strip() or None
    provider_id = (data.get("provider_id") or "").strip() or auth_user_id

    if not auth_user_id:
        raise ValueError("Supabase Auth 사용자 ID가 필요합니다.")
    if not email:
        raise ValueError("이메일을 입력해주세요.")
    if not name:
        name = nickname or email.split("@")[0]
    if not nickname:
        raise ValueError("닉네임을 입력해주세요.")

    user = User.query.filter_by(auth_user_id=auth_user_id).first()
    if not user:
        user = User.query.filter_by(email=email).first()
    is_new_user = user is None

    nickname_owner = User.query.filter_by(nickname=nickname).first()
    if nickname_owner and (not user or nickname_owner.id != user.id):
        if data.get("allow_nickname_suffix"):
            nickname = f"{nickname}#{auth_user_id[:6]}"
        else:
            raise ValueError("이미 사용 중인 닉네임입니다.")

    if not user:
        user = User(email=email, auth_user_id=auth_user_id, name=name, phone_number=phone_number, nickname=nickname)
        db.session.add(user)
    else:
        user.auth_user_id = user.auth_user_id or auth_user_id
        user.email = email
        user.name = name or user.name
        user.phone_number = phone_number if phone_number is not None else user.phone_number
        user.nickname = nickname or user.nickname

    user.provider = provider
    user.provider_id = provider_id
    user.profile_image_url = profile_image_url or user.profile_image_url

    if not user.profile:
        user.profile = UserProfile(
            region=(data.get("region") or "").strip() or "서울",
            bio=(data.get("bio") or "").strip(),
            exercise_level=data.get("exercise_level") or "beginner",
            preferred_sports="",
            preferred_sport_levels="{}"
        )

    db.session.commit()
    response = build_auth_response(user)
    response["is_new_user"] = is_new_user
    response["profile_complete"] = is_profile_complete(user)
    return response


def register_user(data):
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    name = (data.get("name") or "").strip()
    phone_number = normalize_phone_number(data.get("phone_number"))
    nickname = (data.get("nickname") or "").strip()

    if not name:
        raise ValueError("이름을 입력해주세요.")
    if not email:
        raise ValueError("이메일을 입력해주세요.")
    if not nickname:
        raise ValueError("닉네임을 입력해주세요.")
    validate_password(password)
    if User.query.filter_by(email=email).first():
        raise ValueError("이미 가입된 이메일입니다.")
    if User.query.filter_by(nickname=nickname).first():
        raise ValueError("이미 사용 중인 닉네임입니다.")

    preferred_sports = data.get("preferred_sports") or []
    if isinstance(preferred_sports, list):
        preferred_sports_value = ",".join(str(item).strip() for item in preferred_sports if str(item).strip())
    else:
        preferred_sports_value = str(preferred_sports)

    user = User(email=email, name=name, phone_number=phone_number, nickname=nickname)
    user.set_password(password)
    user.profile = UserProfile(
        region=(data.get("region") or "").strip() or "서울",
        bio=(data.get("bio") or "").strip(),
        exercise_level=data.get("exercise_level") or "beginner",
        preferred_sports=preferred_sports_value,
        preferred_sport_levels=json.dumps(data.get("preferred_sport_levels") or {}, ensure_ascii=False)
    )
    db.session.add(user)
    db.session.commit()
    return build_auth_response(user)


def login_user(data):
    email = (data.get("email") or "").strip().lower()
    user = User.query.filter_by(email=email).first()
    if not user or not user.password_hash or not user.check_password(data.get("password") or ""):
        raise ValueError("이메일 또는 비밀번호가 올바르지 않습니다.")
    if not user.is_active:
        raise ValueError("비활성화된 계정입니다.")
    return build_auth_response(user)




def is_profile_complete(user):
    profile = user.profile
    return bool(
        user.name
        and user.nickname
        and profile
        and profile.region
        and profile.region != "서울"
        and (profile.bio or profile.preferred_sports)
    )
def build_auth_response(user):
    token = create_access_token(identity=str(user.id))
    return {"access_token": token, "user": user.to_dict()}


