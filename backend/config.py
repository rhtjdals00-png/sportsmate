import os
import ssl
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")


def required_env(name):
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is required. Check backend/.env.")
    return value


def parse_csv_env(name):
    return [item.strip() for item in required_env(name).split(",") if item.strip()]
  
def database_uri():
    uri = required_env("DATABASE_URL")
    if uri.startswith("postgresql://"):
        uri = uri.replace("postgresql://", "postgresql+pg8000://", 1)
    elif uri.startswith("postgres://"):
        uri = uri.replace("postgres://", "postgresql+pg8000://", 1)

    options = {}
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
    JWT_SECRET_KEY = required_env("JWT_SECRET_KEY")
    JSON_AS_ASCII = False
    FRONTEND_ORIGIN = parse_csv_env("FRONTEND_ORIGIN")
    VWORLD_API_KEY = os.getenv("VWORLD_API_KEY", "")
    VWORLD_DOMAIN = os.getenv("VWORLD_DOMAIN", "")
    MOLIT_API_KEY = os.getenv("MOLIT_API_KEY", "")
    MOLIT_REGION_API_URL = os.getenv("MOLIT_REGION_API_URL", "")
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
