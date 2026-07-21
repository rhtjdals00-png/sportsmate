from app import create_app
from app.models.users import User
from flask_jwt_extended import create_access_token

app = create_app()
with app.app_context():
    user = User.query.filter_by(email="kjhi4691@gmail.com").first()
    token = create_access_token(identity=str(user.id))

print(token)
