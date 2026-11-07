"""
Settings for the FastAPI backend. Reads from environment variables (via a
.env file in local dev — see backend/.env.example) so this service and the
Next.js app can point at the same Supabase project without duplicating
secrets in two different formats.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    # Supabase's JWT signing secret (Project Settings -> API -> JWT Secret),
    # used to verify a user's access token locally without a network round
    # trip to Supabase Auth on every request. NOT the same as either key
    # above.
    supabase_jwt_secret: str

    ai_provider: str = "anthropic"
    ai_api_key: str = ""
    ai_model_name: str = ""

    cron_secret: str = ""

    cors_allow_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # populated from env/`.env`
