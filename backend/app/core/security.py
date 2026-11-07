"""
Verifies a Supabase Auth access token locally (no network round trip to
Supabase on every request) using the project's JWT secret. This is the
same token the Next.js app's cookie-based session already holds and the
browser extension already sends as a bearer token to /api/extension/sync —
this backend accepts that identical token via an Authorization header.
"""
from __future__ import annotations

from dataclasses import dataclass

import jwt
from jwt import InvalidTokenError

from app.core.config import get_settings


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    email: str | None


class InvalidTokenException(Exception):
    pass


def verify_access_token(token: str) -> AuthenticatedUser:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except InvalidTokenError as e:
        raise InvalidTokenException(str(e)) from e

    user_id = payload.get("sub")
    if not user_id:
        raise InvalidTokenException("Token has no subject claim.")

    return AuthenticatedUser(user_id=user_id, email=payload.get("email"))
