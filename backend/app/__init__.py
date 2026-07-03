from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from .extensions import db, jwt, migrate
from .routes import register_blueprints


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        from app.models.users import User
        try:
            user_id = int(jwt_data["sub"])
            user = User.query.get(user_id)
            if not user or not user.is_active:
                return None
            return user
        except Exception:
            return None

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_data):
        from app.models.users import User
        try:
            user_id = int(jwt_data["sub"])
            user = User.query.get(user_id)
            if not user or not user.is_active:
                return True
            return False
        except Exception:
            return True

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_data):
        from app.models.users import User
        try:
            user_id = int(jwt_data["sub"])
            user = User.query.get(user_id)
            if user and not user.is_active:
                return jsonify({"message": "정지된 회원입니다."}), 401
        except Exception:
            pass
        return jsonify({"message": "인증에 실패했습니다."}), 401

    CORS(app, resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGIN"]}}, supports_credentials=True)

    register_blueprints(app)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    return app

