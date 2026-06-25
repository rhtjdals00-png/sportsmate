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


def build_auth_response(user):
    token = create_access_token(identity=str(user.id))
    return {"access_token": token, "user": user.to_dict()}

