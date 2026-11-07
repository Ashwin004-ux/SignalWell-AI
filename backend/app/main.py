"""
FastAPI entry point. Run with:
    uvicorn app.main:app --reload --port 8000
(from the backend/ directory, with dependencies from requirements.txt
installed and backend/.env configured — see backend/README.md).
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import ml
from app.core.config import get_settings

app = FastAPI(
    title="SignalWell AI — ML & Analysis Service",
    description="Python backend for ML-based wellbeing prediction, separate from the Next.js app's own API routes.",
    version="0.1.0",
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(ml.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
