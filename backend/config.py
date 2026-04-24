"""Centralized settings loaded from `../.env` via pydantic-settings.

Every other module imports `settings` from here. Do not read `os.environ`
directly elsewhere — keeps configuration in one auditable place.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Database
    db_host: str = Field(default="127.0.0.1")
    db_port: int = Field(default=3306)
    db_user: str = Field(default="root")
    db_password: str = Field(default="")
    db_name: str = Field(default="talos_tecmty")

    # Ollama
    ollama_host: str = Field(default="http://127.0.0.1:11434")
    ollama_model: str = Field(default="gemma4:e4b")

    # App
    backend_port: int = Field(default=8000)
    frontend_port: int = Field(default=5173)
    cors_origin: str = Field(default="http://localhost:5173")

    # Cache
    cierre_cache_ttl_seconds: int = Field(default=600)

    # Anomaly thresholds
    anomaly_zscore_soft: float = Field(default=2.0)
    anomaly_zscore_hard: float = Field(default=3.0)
    anomaly_min_history_periods: int = Field(default=3)
    anomaly_rolling_window_months: int = Field(default=12)
    outlier_max_stock_fisico: float = Field(default=1e7)
    outlier_max_importe_fisico: float = Field(default=1e8)

    @property
    def db_url(self) -> str:
        pwd = f":{self.db_password}" if self.db_password else ""
        return (
            f"mysql+pymysql://{self.db_user}{pwd}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
