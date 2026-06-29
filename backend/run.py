import os

from app import create_app
from app.extensions import db
from app.services.seed_service import seed_database

app = create_app()


def required_env(name):
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is required. Check backend/.env.")
    return value


@app.cli.command("init-db")
def init_db():
    db.drop_all()
    db.create_all()
    seed_database()
    print("Database initialized.")


if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_RUN_HOST", "0.0.0.0"),
        port=int(required_env("FLASK_RUN_PORT")),
        debug=os.getenv("FLASK_DEBUG", "1") == "1"
    )
