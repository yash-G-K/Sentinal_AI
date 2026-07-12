from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""
    APP_NAME: str = "Sentinel AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "sentinel_ai"
    DB_USER: str = "root"
    DB_PASSWORD: str = "password"

    # AI Configuration
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5"

    # Security / WAF Settings
    AI_CONFIDENCE_THRESHOLD: int = 80
    TEMP_BLOCK_MINUTES: int = 30
    BOT_RATE_LIMIT: int = 100
    AI_ENABLED: bool = True

    LOG_LEVEL: str = "INFO"

    # Redis cache (optional — falls back to in-memory if not set)
    REDIS_URL: str | None = None  # e.g. "redis://localhost:6379/0"

    # Load from .env file if present
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
