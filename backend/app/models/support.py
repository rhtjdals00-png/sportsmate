from app.extensions import db
from app.utils.timezone import to_kst_iso
from .common import TimestampMixin


class SupportInquiry(db.Model, TimestampMixin):
    __tablename__ = "support_inquiries"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    requester_email = db.Column(db.String(255), default="", nullable=False)
    requester_name = db.Column(db.String(120), default="", nullable=False)
    source = db.Column(db.String(30), default="member", nullable=False, index=True)
    category = db.Column(db.String(40), default="general", nullable=False, index=True)
    title = db.Column(db.String(120), nullable=False)
    content = db.Column(db.Text, nullable=False)
    attachment_url = db.Column(db.Text, default="", nullable=False)
    attachment_name = db.Column(db.String(255), default="", nullable=False)
    status = db.Column(db.String(30), default="pending", nullable=False, index=True)
    priority = db.Column(db.String(20), default="normal", nullable=False)
    admin_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    admin_response = db.Column(db.Text, default="", nullable=False)
    internal_note = db.Column(db.Text, default="", nullable=False)
    resolved_at = db.Column(db.DateTime)

    user = db.relationship("User", foreign_keys=[user_id], backref=db.backref("support_inquiries", lazy="dynamic"))
    admin = db.relationship("User", foreign_keys=[admin_id])

    def to_dict(self, include_internal=False):
        def user_summary(user):
            if not user:
                return None
            return {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "nickname": user.nickname,
                "user_tag": user.user_tag,
                "display_name": user.nickname or user.name or user.email,
            }

        data = {
            "id": self.id,
            "user_id": self.user_id,
            "requester_email": self.requester_email or "",
            "requester_name": self.requester_name or "",
            "requester_display_name": (self.user.nickname or self.user.name or self.user.email) if self.user else (self.requester_name or self.requester_email or "비회원"),
            "source": self.source or "member",
            "category": self.category,
            "title": self.title,
            "content": self.content,
            "attachment_url": self.attachment_url or "",
            "attachment_name": self.attachment_name or "",
            "status": self.status,
            "priority": self.priority,
            "admin_id": self.admin_id,
            "admin_response": self.admin_response or "",
            "resolved_at": to_kst_iso(self.resolved_at),
            "created_at": to_kst_iso(self.created_at),
            "updated_at": to_kst_iso(self.updated_at),
            "user": user_summary(self.user),
            "admin": user_summary(self.admin),
        }
        if include_internal:
            data["internal_note"] = self.internal_note or ""
        return data
