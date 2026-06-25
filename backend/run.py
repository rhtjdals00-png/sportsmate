from app import create_app
from app.extensions import db
from app.services.seed_service import seed_database

app = create_app()


@app.cli.command("init-db")
def init_db():
    db.drop_all()
    db.create_all()
    seed_database()
    print("Database initialized.")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)

