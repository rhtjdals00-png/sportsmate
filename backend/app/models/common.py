from app.extensions import db
from app.utils.timezone import kst_now

class TimestampMixin:
    created_at = db.Column(db.DateTime, default=kst_now, nullable=False)
    updated_at = db.Column(db.DateTime, default=kst_now, onupdate=kst_now, nullable=False)
