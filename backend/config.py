import os
import ssl
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from dotenv import load_dotenv
from sqlalchemy.pool import NullPool

load_dotenv(Path(__file__).resolve().parent / ".env")


def required_env(name):
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is required. Check backend/.env.")
    return value


def parse_csv_env(name):
    return [item.strip() for item in required_env(name).split(",") if item.strip()]


def int_env(name, default):
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def bool_env(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def db_pool_options():
    if bool_env("SQLALCHEMY_NULL_POOL", True):
        return {"poolclass": NullPool, "pool_pre_ping": True}
    return {
        "pool_size": int_env("SQLALCHEMY_POOL_SIZE", 1),
        "max_overflow": int_env("SQLALCHEMY_MAX_OVERFLOW", 0),
        "pool_timeout": int_env("SQLALCHEMY_POOL_TIMEOUT", 10),
        "pool_recycle": int_env("SQLALCHEMY_POOL_RECYCLE", 120),
        "pool_pre_ping": True,
    }


def database_uri():
    uri = required_env("DATABASE_URL")
    if uri.startswith("postgresql://"):
        uri = uri.replace("postgresql://", "postgresql+pg8000://", 1)
    elif uri.startswith("postgres://"):
        uri = uri.replace("postgres://", "postgresql+pg8000://", 1)

    options = db_pool_options()
    if uri.startswith("postgresql+pg8000://"):
        parts = urlsplit(uri)
        query = parse_qsl(parts.query, keep_blank_values=True)
        ssl_modes = [value for key, value in query if key == "sslmode"]
        ssl_mode = ssl_modes[-1] if ssl_modes else ""
        query = [(key, value) for key, value in query if key != "sslmode"]
        uri = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
        if ssl_mode == "require":
            options["connect_args"] = {"ssl_context": ssl._create_unverified_context()}
        elif ssl_mode in {"verify-ca", "verify-full"}:
            options["connect_args"] = {"ssl_context": ssl.create_default_context()}

    return uri, options


DATABASE_URI, DATABASE_ENGINE_OPTIONS = database_uri()


class Config:
    SQLALCHEMY_DATABASE_URI = DATABASE_URI
    SQLALCHEMY_ENGINE_OPTIONS = DATABASE_ENGINE_OPTIONS
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    import datetime
    JWT_SECRET_KEY = required_env("JWT_SECRET_KEY")
    JWT_ACCESS_TOKEN_EXPIRES = datetime.timedelta(days=30)
    JSON_AS_ASCII = False
    FRONTEND_ORIGIN = parse_csv_env("FRONTEND_ORIGIN")
    NAVER_MAP_CLIENT_ID = os.getenv("NAVER_MAP_CLIENT_ID", "")
    NAVER_MAP_CLIENT_SECRET = os.getenv("NAVER_MAP_CLIENT_SECRET", "")
    NAVER_DYNAMIC_MAP_CLIENT_ID = os.getenv("NAVER_DYNAMIC_MAP_CLIENT_ID", "")
    NAVER_GEOCODE_URL = os.getenv("NAVER_GEOCODE_URL", "https://maps.apigw.ntruss.com/map-geocode/v2/geocode")
    NAVER_REVERSE_GEOCODE_URL = os.getenv("NAVER_REVERSE_GEOCODE_URL", "https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc")
    NAVER_SEARCH_CLIENT_ID = os.getenv("NAVER_SEARCH_CLIENT_ID", os.getenv("NAVER_CLIENT_ID", ""))
    NAVER_SEARCH_CLIENT_SECRET = os.getenv("NAVER_SEARCH_CLIENT_SECRET", os.getenv("NAVER_CLIENT_SECRET", ""))
    KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY", "")
    KAKAO_KEYWORD_SEARCH_URL = os.getenv("KAKAO_KEYWORD_SEARCH_URL", "https://dapi.kakao.com/v2/local/search/keyword.json")
    KAKAO_ADDRESS_SEARCH_URL = os.getenv("KAKAO_ADDRESS_SEARCH_URL", "https://dapi.kakao.com/v2/local/search/address.json")
    KAKAO_COORD2ADDRESS_URL = os.getenv("KAKAO_COORD2ADDRESS_URL", "https://dapi.kakao.com/v2/local/geo/coord2address.json")
    VWORLD_API_KEY = os.getenv("VWORLD_API_KEY", "")
    VWORLD_DOMAIN = os.getenv("VWORLD_DOMAIN", "")
    MOLIT_API_KEY = os.getenv("MOLIT_API_KEY", "")
    MOLIT_REGION_API_URL = os.getenv("MOLIT_REGION_API_URL", "")
    KMA_API_KEY = os.getenv("KMA_API_KEY", "")
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_CHAT_BUCKET = os.getenv("SUPABASE_CHAT_BUCKET", "chat-images")
    VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
    VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
    VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "")
