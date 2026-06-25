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
    CORS(app, resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGIN"]}}, supports_credentials=True)

    register_blueprints(app)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    return app

