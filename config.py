# config.py
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    SECRET_KEY: str = os.getenv("SECRET_KEY", "default-secret-key")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "jwt-secret")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./progress.db")

    # Session settings
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 5  # Auto logout after 5 minutes

    # Algorithm for JWT
    ALGORITHM: str = "HS256"

    # Make ADMIN_PASSWORD mutable (instance variable, not class variable)
    def __init__(self):
        self.ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")


settings = Settings()
