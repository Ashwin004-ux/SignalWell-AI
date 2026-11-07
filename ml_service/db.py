from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException

SUPABASE_URL = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or ""


class UserStore:
    def __init__(self, jwt: str):
        if not SUPABASE_URL or not ANON_KEY:
            raise HTTPException(status_code=503, detail="Database is not configured.")
        self.jwt = jwt
        self.headers = {
            "Authorization": f"Bearer {jwt}",
            "apikey": ANON_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def _url(self, table: str) -> str:
        return f"{SUPABASE_URL}/rest/v1/{table}"

    def select(
        self,
        table: str,
        query: str,
        *,
        maybe_single: bool = False,
    ) -> Any:
        headers = {**self.headers}
        if maybe_single:
            headers["Accept"] = "application/vnd.pgrst.object+json"
        with httpx.Client(timeout=15.0) as client:
            response = client.get(f"{self._url(table)}?{query}", headers=headers)
        if maybe_single and response.status_code == 406:
            return None
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail="Database query failed.")
        if not response.content:
            return None if maybe_single else []
        return response.json()

    def upsert(self, table: str, row: Dict[str, Any], on_conflict: str) -> Any:
        headers = {**self.headers, "Prefer": "resolution=merge-duplicates,return=representation"}
        with httpx.Client(timeout=15.0) as client:
            response = client.post(
                f"{self._url(table)}?on_conflict={on_conflict}",
                headers=headers,
                json=row,
            )
        if response.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"Could not save {table}.")
        return response.json()

    def insert(self, table: str, rows: List[Dict[str, Any]]) -> Any:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(self._url(table), headers=self.headers, json=rows)
        if response.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"Could not insert into {table}.")
        return response.json()

    def update(self, table: str, query: str, patch: Dict[str, Any]) -> Any:
        with httpx.Client(timeout=15.0) as client:
            response = client.patch(f"{self._url(table)}?{query}", headers=self.headers, json=patch)
        if response.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"Could not update {table}.")
        return response.json()

    def delete(self, table: str, query: str) -> None:
        with httpx.Client(timeout=15.0) as client:
            response = client.delete(f"{self._url(table)}?{query}", headers=self.headers)
        if response.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"Could not delete from {table}.")
