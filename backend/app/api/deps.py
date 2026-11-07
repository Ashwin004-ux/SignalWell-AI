from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from supabase import Client

from app.core.config import get_settings
from app.core.security import AuthenticatedUser, InvalidTokenException, verify_access_token
from app.core.supabase import get_service_role_client, get_user_client


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or malformed Authorization header.")
    return authorization.split(" ", 1)[1].strip()


def get_current_user(authorization: str | None = Header(default=None)) -> AuthenticatedUser:
    token = _extract_bearer_token(authorization)
    try:
        return verify_access_token(token)
    except InvalidTokenException:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session.")


def get_user_supabase_client(authorization: str | None = Header(default=None)) -> Client:
    """RLS-scoped client for the current request's user — use this for any
    read/write that should only ever touch that user's own rows."""
    token = _extract_bearer_token(authorization)
    return get_user_client(token)


def require_cron_secret(authorization: str | None = Header(default=None)) -> None:
    """Authorizes scheduled-job endpoints. Not a user session — a fixed
    shared secret, same pattern as the Next.js app's /api/cron/* routes."""
    settings = get_settings()
    if not settings.cron_secret:
        raise HTTPException(status_code=500, detail="CRON_SECRET is not configured.")
    if authorization != f"Bearer {settings.cron_secret}":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized.")


def get_admin_supabase_client() -> Client:
    return get_service_role_client()
