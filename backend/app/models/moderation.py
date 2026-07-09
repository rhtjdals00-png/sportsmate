from app.extensions import db
from app.utils.timezone import kst_now

class Report(db.Model):
    __tablename__ = "reports"
    id = db.Column(db.Integer, primary_key=True)
    reporter_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    target_type = db.Column(db.String(40), nullable=False)
    target_id = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(30), default="pending", nullable=False)
    created_at = db.Column(db.DateTime, default=kst_now, nullable=False)
