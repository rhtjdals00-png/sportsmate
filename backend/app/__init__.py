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
            if not user or not user.is_active or user.status == "withdrawn_pending" or user.role == "pending_withdrawal":
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
            if not user or not user.is_active or user.status == "withdrawn_pending" or user.role == "pending_withdrawal":
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
    with app.app_context():
        from app.services.schema_compat import ensure_chat_message_columns
        ensure_chat_message_columns(app)

    @app.before_request
    def check_maintenance():
        from flask import request
        from app.utils.settings import load_system_settings
        
        settings = load_system_settings()
        if settings.get("maintenanceMode") is True:
            path = request.path
            
            # Exempt basic health check and admin routes
            if path == "/api/health" or path.startswith("/api/v1/admin"):
                return None
                
            # Allow login and logout requests
            if path in ["/api/v1/auth/login", "/api/v1/auth/social-login", "/api/v1/auth/logout", "/api/v1/auth/sync"]:
                return None
                
            # Verify if the user is an admin
            from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
            from app.models.users import User
            
            is_admin = False
            try:
                verify_jwt_in_request(optional=True)
                identity = get_jwt_identity()
                if identity:
                    user = User.query.get(int(identity))
                    if user and user.role in ["superadmin", "admin"]:
                        is_admin = True
            except Exception:
                pass
                
            if not is_admin:
                return jsonify({
                    "message": "현재 서비스 점검 중입니다. 이용에 불편을 드려 죄송합니다.",
                    "maintenance": True
                }), 503

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    return app

