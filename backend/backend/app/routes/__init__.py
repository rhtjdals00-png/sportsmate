from .admin_routes import admin_bp
from .auth_routes import auth_bp
from .chat_routes import chat_bp
from .meeting_routes import meeting_bp
from .location_routes import location_bp
from .notification_routes import notification_bp
from .report_routes import report_bp
from .sport_routes import sport_bp
from .user_routes import user_bp
from .vote_routes import vote_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(user_bp, url_prefix="/api/v1/users")
    app.register_blueprint(sport_bp, url_prefix="/api/v1")
    app.register_blueprint(location_bp, url_prefix="/api/v1")
    app.register_blueprint(meeting_bp, url_prefix="/api/v1/meetings")
    app.register_blueprint(chat_bp, url_prefix="/api/v1/chatrooms")
    app.register_blueprint(notification_bp, url_prefix="/api/v1")
    app.register_blueprint(report_bp, url_prefix="/api/v1/reports")
    app.register_blueprint(admin_bp, url_prefix="/api/v1/admin")
    app.register_blueprint(vote_bp, url_prefix="/api/v1/votes")
