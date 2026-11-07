"""
Supabase client factories for the FastAPI backend.

Mirrors the Next.js app's src/lib/supabase/server.ts split exactly:
  - get_user_client(access_token): scoped to one user's session via their
    JWT, so every query still goes through Postgres RLS exactly as it
    would from the browser. Use this whenever a request is on behalf of a
    specific signed-in user.
  - get_service_role_client(): bypasses RLS entirely. Only for trusted
    server-side code (the scheduled jobs, the ML training/prediction
    pipeline writing ml_models/ml_predictions, which intentionally have no
    user-facing insert policy — see supabase/ml_policies.sql). This must
    never be constructed in response to anything an unauthenticated or
    arbitrary caller can trigger — every call site that uses it is
    protected by either a verified user session performing an action
    explicitly scoped to themselves, or the CRON_SECRET check (see
    api/deps.py).
"""
from __future__ import annotations

from supabase import Client, create_client

from app.core.config import get_settings


def get_service_role_client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_user_client(access_token: str) -> Client:
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    # postgrest-py: attach the user's JWT so RLS evaluates auth.uid() as
    # that user, not as the anon role.
    client.postgrest.auth(access_token)
    return client
