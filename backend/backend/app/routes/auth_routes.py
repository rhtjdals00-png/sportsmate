from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models import User
from app.services.auth_service import login_user, register_user

auth_bp = Blueprint("auth", __name__)


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
        return jsonify({"message": str(error)}), 401


@auth_bp.post("/logout")
def logout():
    return jsonify({"message": "로그아웃되었습니다."})


@auth_bp.get("/me")
@jwt_required()
def me():
    user = User.query.get_or_404(int(get_jwt_identity()))
    return jsonify({"user": user.to_dict()})

