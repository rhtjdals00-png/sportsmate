import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import current_app
from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models import User, UserProfile


def register_user(data):
    if User.query.filter_by(email=data["email"]).first():
        raise ValueError("이미 가입된 이메일입니다.")

    user = User(email=data["email"], nickname=data["nickname"])
    user.set_password(data["password"])
    user.profile = UserProfile()
    db.session.add(user)
    db.session.commit()
    return build_auth_response(user)


def login_user(data):
    user = User.query.filter_by(email=data["email"]).first()
    if not user or not user.check_password(data["password"]):
        raise ValueError("이메일 또는 비밀번호가 올바르지 않습니다.")
    if not user.is_active:
        raise ValueError("비활성화된 계정입니다.")
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
    nickname = metadata.get("name") or metadata.get("full_name") or metadata.get("nickname") or email.split("@")[0]
    avatar_url = metadata.get("avatar_url") or metadata.get("picture")

    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(email=email, nickname=nickname, provider=provider, provider_id=provider_id, profile_image_url=avatar_url)
        user.set_password(f"supabase:{provider}:{provider_id}")
        user.profile = UserProfile()
        db.session.add(user)
    else:
        user.provider = provider
        user.provider_id = provider_id or user.provider_id
        user.nickname = user.nickname or nickname
        user.profile_image_url = user.profile_image_url or avatar_url
        if not user.profile:
            user.profile = UserProfile()

    if not user.is_active:
        raise ValueError("비활성화된 계정입니다.")

    db.session.commit()
    return build_auth_response(user)


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


def build_auth_response(user):
    token = create_access_token(identity=str(user.id))
    return {"access_token": token, "user": user.to_dict()}
