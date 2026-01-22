# config.py
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    SECRET_KEY: str = os.getenv("SECRET_KEY", "default-secret-key")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "jwt-secret")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./progress.db")

    # Session settings
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 5  # Auto logout after 5 minutes

    # Algorithm for JWT
    ALGORITHM: str = "HS256"


settings = Settings()
