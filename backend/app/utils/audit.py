import os
import json

from app.utils.timezone import kst_now

def load_audit_logs():
    file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "system_audit_logs.json")
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []

def log_admin_action(admin_name, action_type, description, target_id=None):
    file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "system_audit_logs.json")
    logs = load_audit_logs()
    new_entry = {
        "timestamp": kst_now().strftime("%Y-%m-%d %H:%M:%S"),
        "admin": admin_name,
        "action_type": action_type,
        "description": description,
        "target_id": target_id
    }
    logs.append(new_entry)
    if len(logs) > 200:
        logs = logs[-200:]
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(logs, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False
