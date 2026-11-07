import os
from typing import Optional

import httpx
from fastapi import Header, HTTPException

SUPABASE_URL = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or ""
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")


async def get_user_id(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        if ENVIRONMENT != "production":
            raise HTTPException(status_code=401, detail="Authentication required.")
        raise HTTPException(status_code=401, detail="Authentication required.")
    token = authorization.split(" ", 1)[1].strip()
    if not SUPABASE_URL or not ANON_KEY:
        raise HTTPException(status_code=503, detail="Authentication service is not configured.")
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": ANON_KEY},
        )
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    payload = response.json()
    user_id = payload.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session.")
    return str(user_id)


def bearer_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")
    return authorization.split(" ", 1)[1].strip()
