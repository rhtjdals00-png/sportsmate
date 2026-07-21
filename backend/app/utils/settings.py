import os
import json

from app.utils.timezone import kst_now

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "system_settings.json")

def load_system_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    # default settings
    return {
        "siteName": "SportsMate",
        "adminEmail": "admin@sportsmate.co.kr",
        "maintenanceMode": False,
        "suspensionGracePeriod": 30,
        "defaultMaxParticipants": 6,
        "mannerRatingDecrement": 1.5,
        "autoBanReportCount": 5,
        "sessionExpiryMinutes": 60,
        "termsVersion": "v1.4",
        "supabaseUrl": os.getenv("SUPABASE_URL", "https://ssuncptlzlmuulqmtnqf.supabase.co"),
        "kakaoApiKey": os.getenv("KAKAO_REST_API_KEY", "5d3ec3100e15e07c16c5a3799a090f1c"),
        "googleClientId": "40413-t9tr8ha.apps.googleusercontent.com"
    }

def save_system_settings(settings):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False


SETTINGS_LOGS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "system_settings_logs.json")

def load_settings_logs():
    if os.path.exists(SETTINGS_LOGS_FILE):
        try:
            with open(SETTINGS_LOGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []

def add_settings_log(admin_name, changes):
    logs = load_settings_logs()
    new_entry = {
        "timestamp": kst_now().strftime("%Y-%m-%d %H:%M:%S"),
        "admin": admin_name,
        "changes": changes if changes else ["변경 사항 없음"]
    }
    logs.append(new_entry)
    # Keep only the last 100 logs
    if len(logs) > 100:
        logs = logs[-100:]
    try:
        with open(SETTINGS_LOGS_FILE, "w", encoding="utf-8") as f:
            json.dump(logs, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False
