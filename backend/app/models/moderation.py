from app.extensions import db
from app.utils.timezone import kst_now, to_kst_iso

class Report(db.Model):
    __tablename__ = "reports"
    id = db.Column(db.Integer, primary_key=True)
    reporter_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    target_type = db.Column(db.String(40), nullable=False)
    target_id = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(255), nullable=False)
    reason_detail = db.Column(db.Text, default="", nullable=False)
    context = db.Column(db.Text, default="{}", nullable=False)
    status = db.Column(db.String(30), default="pending", nullable=False)
    admin_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    admin_note = db.Column(db.Text, default="", nullable=False)
    resolved_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=kst_now, nullable=False)

    reporter = db.relationship("User", foreign_keys=[reporter_id])
    admin = db.relationship("User", foreign_keys=[admin_id])

    def target_label(self):
        if self.target_type == "user":
            from app.models.users import User
            target = User.query.get(self.target_id)
            if target:
                return target.nickname or target.name or target.email or f"회원 #{target.id}"
        if self.target_type == "meeting":
            from app.models.meetings import Meeting
            target = Meeting.query.get(self.target_id)
            if target:
                return target.title or f"모임 #{target.id}"
        if self.target_type == "chat_room":
            from app.models.chat import ChatRoom
            target = ChatRoom.query.get(self.target_id)
            if target and target.meeting:
                return f"{target.meeting.title} 채팅방"
            if target:
                return f"채팅방 #{target.id}"
        return f"{self.target_type} #{self.target_id}"

    def to_dict(self, include_internal=False):
        data = {
            "id": self.id,
            "reporter_id": self.reporter_id,
            "reporter_name": (
                self.reporter.nickname or self.reporter.name or self.reporter.email
                if self.reporter else "신고자"
            ),
            "target_type": self.target_type,
            "target_id": self.target_id,
            "target_name": self.target_label(),
            "reason": self.reason,
            "reason_detail": self.reason_detail or "",
            "context": self.context or "{}",
            "status": self.status,
            "created_at": to_kst_iso(self.created_at),
            "resolved_at": to_kst_iso(self.resolved_at),
        }
        if include_internal:
            data.update({
                "admin_id": self.admin_id,
                "admin_name": (
                    self.admin.nickname or self.admin.name or self.admin.email
                    if self.admin else ""
                ),
                "admin_note": self.admin_note or "",
            })
        return data
