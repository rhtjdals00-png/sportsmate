import json

from flask import current_app

from app.extensions import db
from app.models import Notification, PushSubscription

try:
    from pywebpush import WebPushException, webpush
except ImportError:
    WebPushException = Exception
    webpush = None


def create_notification(user_id, type, title, message, link_url=None, commit=False, send_push=True):
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        link_url=link_url
    )
    db.session.add(notification)
    if commit:
        db.session.commit()
    if send_push:
        send_web_push(user_id, title, message, link_url)
    return notification


def send_web_push(user_id, title, body, url=None):
    public_key = current_app.config.get("VAPID_PUBLIC_KEY")
    private_key = current_app.config.get("VAPID_PRIVATE_KEY")
    subject = current_app.config.get("VAPID_SUBJECT") or current_app.config.get("FRONTEND_ORIGIN", [""])[0]
    if not webpush or not public_key or not private_key:
        return {"sent": 0, "skipped": "web_push_not_configured"}

    subscriptions = PushSubscription.query.filter_by(user_id=user_id, is_active=True).all()
    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url or "/notifications"
    }, ensure_ascii=False)
    sent = 0
    changed = False
    for subscription in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {
                        "p256dh": subscription.p256dh,
                        "auth": subscription.auth
                    }
                },
                data=payload,
                vapid_private_key=private_key,
                vapid_claims={"sub": subject}
            )
            sent += 1
        except WebPushException as error:
            status_code = getattr(getattr(error, "response", None), "status_code", None)
            response_text = getattr(getattr(error, "response", None), "text", "")
            
            # Deactivate subscription if expired (404/410) or VAPID credentials mismatch (400/403)
            is_invalid = (
                status_code in {404, 410} or
                (status_code == 400 and "VapidPkHashMismatch" in response_text) or
                (status_code == 403 and ("VAPID" in response_text or "credentials" in response_text or "unauthorized" in response_text.lower()))
            )
            
            if is_invalid:
                subscription.is_active = False
                changed = True
                current_app.logger.info("Deactivating invalid push subscription %s for user %s (status %s)", subscription.id, user_id, status_code)
            else:
                current_app.logger.warning("Web push failed for user %s: %s", user_id, error)
        except Exception as error:
            current_app.logger.warning("Web push skipped for user %s: %s", user_id, error)
    if changed:
        db.session.commit()
    return {"sent": sent}
