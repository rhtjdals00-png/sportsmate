import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")


def required_env(name):
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is required. Check backend/.env.")
    return value


class Config:
    SQLALCHEMY_DATABASE_URI = required_env("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = required_env("JWT_SECRET_KEY")
    JSON_AS_ASCII = False
    FRONTEND_ORIGIN = required_env("FRONTEND_ORIGIN")
    VWORLD_API_KEY = os.getenv("VWORLD_API_KEY", "")
    VWORLD_DOMAIN = os.getenv("VWORLD_DOMAIN", "")
    MOLIT_API_KEY = os.getenv("MOLIT_API_KEY", "")
    MOLIT_REGION_API_URL = os.getenv("MOLIT_REGION_API_URL", "")
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
