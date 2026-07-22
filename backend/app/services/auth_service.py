import json
import re
import secrets
import string

from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import current_app
from flask_jwt_extended import create_access_token
from sqlalchemy import text
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import User, UserProfile


class LoginProviderRequiredError(ValueError):
    pass


class LoginProviderMismatchError(ValueError):
    def __init__(self, registered_provider):
        self.registered_provider = registered_provider
        messages = {
            "email": "이미 이메일로 가입된 계정입니다. 이메일과 비밀번호로 로그인해 주세요.",
            "google": "이미 Google로 가입된 계정입니다. Google 로그인을 이용해 주세요.",
            "kakao": "이미 Kakao로 가입된 계정입니다. Kakao 로그인을 이용해 주세요.",
        }
        super().__init__(messages[registered_provider])


class AuthUserIdMismatchError(ValueError):
    def __init__(self):
        super().__init__("계정 연결 정보를 확인할 수 없습니다. 관리자에게 문의해 주세요.")


class InvalidStoredProviderError(ValueError):
    pass


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
    email_name = email.split("@")[0] if email else ""
    name = (data.get("name") or data.get("full_name") or "").strip()
    phone_number = normalize_phone_number(data.get("phone_number"))
    nickname = (data.get("nickname") or name or email_name).strip()
    return email, name, phone_number, nickname


def generate_user_tag():
    alphabet = string.ascii_letters + string.digits
    for _ in range(100):
        candidate = "".join(secrets.choice(alphabet) for _ in range(4))
        if not User.query.filter_by(user_tag=candidate).first():
            return candidate
    raise ValueError("사용자 태그를 생성하지 못했습니다. 다시 시도해주세요.")


def merge_auth_providers(primary_provider, existing_provider=""):
    providers = []
    for value in [primary_provider, existing_provider]:
        for item in (value or "").split(","):
            provider = item.strip().lower()
            if provider and provider not in providers:
                providers.append(provider)
    return ",".join(providers) or "email"


def provider_set(value):
    return {item.strip().lower() for item in (value or "").split(",") if item.strip()}


def newly_linked_social_provider(before_provider, after_provider):
    added = provider_set(after_provider) - provider_set(before_provider)
    for provider in ["google", "kakao"]:
        if provider in added:
            return provider
    return ""


def supabase_auth_user_exists(auth_user_id):
    try:
      result = db.session.execute(
          text("select 1 from auth.users where id = :auth_user_id limit 1"),
          {"auth_user_id": auth_user_id},
      )
      return result.first() is not None
    except Exception as error:
      db.session.rollback()
      current_app.logger.warning("Supabase auth.users id check failed: %s", error)
      raise ValueError("Supabase Auth 계정을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.") from error


def sync_supabase_user(data):
    auth_user_id = (data.get("auth_user_id") or data.get("id") or "").strip()
    email, name, phone_number, nickname = normalize_profile_payload(data)
    login_provider = (data.get("login_provider") or "").strip().lower()
    profile_image_url = (data.get("profile_image_url") or data.get("avatar_url") or "").strip() or None
    force_profile_update = bool(data.get("force_profile_update"))

    if not auth_user_id:
        raise ValueError("Supabase Auth 사용자 ID가 필요합니다.")
    if not email:
        raise ValueError("이메일을 입력해주세요.")
    if not name:
        name = nickname or email.split("@")[0]
    if not nickname:
        raise ValueError("닉네임을 입력해주세요.")
    if not supabase_auth_user_exists(auth_user_id):
        raise ValueError("Supabase Auth 계정이 존재하지 않습니다. 다시 로그인해주세요.")

    user = User.query.options(joinedload(User.profile)).filter_by(auth_user_id=auth_user_id).first()
    if not user:
        user = User.query.options(joinedload(User.profile)).filter_by(email=email).first()
        if user and user.auth_user_id is not None and user.auth_user_id != auth_user_id:
            raise AuthUserIdMismatchError()
    is_new_user = user is None
    if is_new_user and login_provider not in {"email", "google", "kakao"}:
        raise LoginProviderRequiredError("가입 방식을 확인할 수 없습니다. 다시 로그인해주세요.")
    if not is_new_user:
        stored_provider = (user.provider or "").strip().lower()
        if stored_provider not in {"email", "google", "kakao"}:
            raise InvalidStoredProviderError("계정의 가입 방식 정보를 확인할 수 없습니다. 고객센터에 문의해 주세요.")
        if login_provider and stored_provider != login_provider:
            raise LoginProviderMismatchError(stored_provider)

    from app.utils.settings import load_system_settings
    settings = load_system_settings()
    if settings.get("maintenanceMode") is True:
        if is_new_user or (user and user.role not in ["superadmin", "admin"]):
            raise ValueError("현재 서비스 점검 중입니다. 일반 회원은 로그인할 수 없습니다.")


    before_provider = user.provider if user else ""

    if not user:
        # Check if phone number is already in use by another user
        phone_number_to_set = phone_number
        if phone_number:
            existing = User.query.filter_by(phone_number=phone_number).first()
            if existing:
                phone_number_to_set = None
        user = User(
            email=email,
            auth_user_id=auth_user_id,
            name=name,
            phone_number=phone_number_to_set,
            nickname=nickname,
            user_tag=generate_user_tag(),
            provider=login_provider,
            provider_id=auth_user_id,
        )
        db.session.add(user)
    else:
        if not user.is_active:
            raise ValueError("정지된 회원입니다.")
        user.auth_user_id = user.auth_user_id or auth_user_id
        user.email = email
        # 2026-07-02: Supabase 동기화는 초기값 보강에만 쓰고, SportsMate DB에서 관리하는 계정 정보는 보존.
        user.name = name if force_profile_update and name else (user.name or name)
        
        # Check if target phone number is already in use by another user
        target_phone = phone_number if force_profile_update and phone_number else (user.phone_number or phone_number)
        if target_phone and target_phone != user.phone_number:
            existing = User.query.filter(User.phone_number == target_phone, User.id != user.id).first()
            if existing:
                # Do NOT update user.phone_number since it is in use by another user.
                pass
            else:
                user.phone_number = target_phone
        else:
            user.phone_number = user.phone_number or target_phone

        user.nickname = nickname if force_profile_update and nickname else (user.nickname or nickname)
        user.user_tag = user.user_tag or generate_user_tag()

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

    withdraw_response = check_withdraw_and_login(user)
    if withdraw_response:
        withdraw_response["is_new_user"] = is_new_user
        withdraw_response["profile_complete"] = is_profile_complete(user)
        linked_provider = "" if is_new_user else newly_linked_social_provider(before_provider, user.provider)
        withdraw_response["provider_linked"] = bool(linked_provider)
        withdraw_response["linked_provider"] = linked_provider
        return withdraw_response

    response = build_auth_response(user)
    response["is_new_user"] = is_new_user
    response["profile_complete"] = is_profile_complete(user)
    linked_provider = "" if is_new_user else newly_linked_social_provider(before_provider, user.provider)
    response["provider_linked"] = bool(linked_provider)
    response["linked_provider"] = linked_provider
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
    if phone_number:
        if User.query.filter_by(phone_number=phone_number).first():
            raise ValueError("이미 가입된 핸드폰 번호입니다.")
    preferred_sports = data.get("preferred_sports") or []
    if isinstance(preferred_sports, list):
        preferred_sports_value = ",".join(str(item).strip() for item in preferred_sports if str(item).strip())
    else:
        preferred_sports_value = str(preferred_sports)

    user = User(email=email, name=name, phone_number=phone_number, nickname=nickname, user_tag=generate_user_tag())
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


def check_withdraw_and_login(user):
    if not user.is_active:
        raise ValueError("정지된 회원입니다.")

    from app.utils.settings import load_system_settings
    settings = load_system_settings()
    if settings.get("maintenanceMode") is True and user.role not in ["superadmin", "admin"]:
        raise ValueError("현재 서비스 점검 중입니다. 일반 회원은 로그인할 수 없습니다.")

    if user.status == "withdrawn_pending":
        if not user.is_in_withdraw_grace_period():
            try:
                db.session.delete(user)
                db.session.commit()
            except Exception as e:
                db.session.rollback()
            raise ValueError("30일 탈퇴 유예 기간이 만료되어 계정이 영구 삭제되었습니다. 신규 회원가입을 이용해 주세요.")
        
        response = build_auth_response(user)
        response["account_restoration_required"] = True
        response["remaining_days"] = user.remaining_withdraw_days()
        response["withdrawn_at"] = user.withdrawn_at.isoformat() if user.withdrawn_at else None
        return response
    return None


def restore_user(user_id):
    user = User.query.get(user_id)
    if not user:
        raise ValueError("사용자를 찾을 수 없습니다.")
    if user.status == "withdrawn_pending" or user.role == "pending_withdrawal":
        if not user.is_in_withdraw_grace_period():
            try:
                db.session.delete(user)
                db.session.commit()
            except Exception as e:
                db.session.rollback()
            raise ValueError("30일 탈퇴 유예 기간이 만료되어 복구할 수 없으며 계정이 영구 삭제되었습니다.")
        user.status = "active"
        user.role = "user"
        user.withdrawn_at = None
        user.deleted_at = None
        db.session.commit()
    return build_auth_response(user)


def login_user(data):
    email = (data.get("email") or "").strip().lower()
    user = User.query.options(joinedload(User.profile)).filter_by(email=email).first()
    if not user or not user.password_hash or not user.check_password(data.get("password") or ""):
        raise ValueError("이메일 또는 비밀번호가 올바르지 않습니다.")

    withdraw_response = check_withdraw_and_login(user)
    if withdraw_response:
        return withdraw_response

    return build_auth_response(user)

def login_with_supabase(data):
    supabase_user = verify_supabase_user(data.get("access_token", ""))
    email = supabase_user.get("email")
    if not email:
        raise ValueError("소셜 계정 이메일을 확인하지 못했습니다.")

    metadata = supabase_user.get("user_metadata") or {}
    app_metadata = supabase_user.get("app_metadata") or {}
    provider = app_metadata.get("provider") or data.get("provider") or "supabase"
    provider_id = supabase_user.get("id")

    nickname = metadata.get("nickname") or metadata.get("name") or metadata.get("full_name") or email.split("@")[0]
    name = metadata.get("name") or metadata.get("full_name") or nickname

    avatar_url = metadata.get("avatar_url") or metadata.get("picture")
    phone_number = normalize_phone_number(metadata.get("phone_number") or supabase_user.get("phone"))

    user = User.query.options(joinedload(User.profile)).filter_by(auth_user_id=provider_id).first() if provider_id else None
    if not user:
        user = User.query.options(joinedload(User.profile)).filter_by(email=email).first()
    if not user:
        is_new_user = True
        user = User(
            auth_user_id=provider_id,
            email=email,
            name=name,
            phone_number=phone_number,
            nickname=nickname,
            provider=provider,
            provider_id=provider_id,
            profile_image_url=avatar_url
        )
        user.profile = UserProfile()
        db.session.add(user)
    else:
        is_new_user = False
        user.auth_user_id = user.auth_user_id or provider_id
        user.name = user.name or name
        # 2026-07-02: 소셜 재로그인 시 Supabase metadata가 기존 계정 정보를 덮어쓰지 않도록 보존.
        user.phone_number = user.phone_number or phone_number
        # 2026-07-02: 소셜 재로그인 시에도 provider의 email 연동 표시를 유지.
        user.provider = merge_auth_providers(provider, user.provider)
        user.provider_id = provider_id or user.provider_id
        user.nickname = user.nickname or nickname
        user.user_tag = user.user_tag or generate_user_tag()
        user.profile_image_url = user.profile_image_url or avatar_url
        if not user.profile:
            user.profile = UserProfile()

    db.session.commit()

    withdraw_response = check_withdraw_and_login(user)
    if withdraw_response:
        withdraw_response["is_new_user"] = is_new_user
        withdraw_response["profile_complete"] = is_profile_complete(user)
        return withdraw_response

    response = build_auth_response(user)
    response["is_new_user"] = is_new_user
    response["profile_complete"] = is_profile_complete(user)
    return response


def verify_supabase_user(access_token):
    if not access_token:
        raise ValueError("소셜 로그인 토큰이 없습니다.")

    supabase_url = current_app.config.get("SUPABASE_URL", "").rstrip("/")
    anon_key = current_app.config.get("SUPABASE_ANON_KEY", "")
    if not supabase_url or not anon_key:
        raise ValueError("Supabase 환경변수가 설정되지 않았습니다.")

    request = Request(
        f"{supabase_url}/auth/v1/user",
        headers={
            "apikey": anon_key,
            "Authorization": f"Bearer {access_token}"
        }
    )
    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        raise ValueError("소셜 로그인 검증에 실패했습니다.") from error

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


def should_prompt_profile_intro(user):
    if is_profile_complete(user):
        return False
    return not user.profile_intro_dismissed


def build_auth_response(user):
    token = create_access_token(identity=str(user.id))
    return {
        "access_token": token,
        "user": user.to_dict(),
        "profile_complete": is_profile_complete(user),
        "profile_intro_required": should_prompt_profile_intro(user)
    }
