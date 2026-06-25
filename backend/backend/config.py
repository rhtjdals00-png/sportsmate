import os


class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///sportsmate.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-sportsmate-secret-at-least-32-bytes")
    JSON_AS_ASCII = False
    FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    VWORLD_API_KEY = os.getenv("VWORLD_API_KEY", "")
    VWORLD_DOMAIN = os.getenv("VWORLD_DOMAIN", "")
    MOLIT_API_KEY = os.getenv("MOLIT_API_KEY", "")
    MOLIT_REGION_API_URL = os.getenv("MOLIT_REGION_API_URL", "")
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
