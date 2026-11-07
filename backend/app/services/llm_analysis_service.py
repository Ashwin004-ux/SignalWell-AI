"""
LLM analysis service — the plain-language explanation layer, strictly
downstream of and never permitted to alter the ML layer's numeric output
(app/ml/predict.py's WellbeingPrediction). Mirrors the Next.js app's
src/lib/ai/ (provider interface + Anthropic implementation + the
structured prompt in prompt.py that forbids diagnostic language and
requires observed-data-vs-interpretation separation) — see that directory
for the full prompt text and safety framing this intentionally matches.

UNTESTED IN THIS ENVIRONMENT: calling the Anthropic API requires network
access and a real API key, neither available in the sandbox this was
written in. The HTTP call shape below matches Anthropic's documented
Messages API; verify it against a real key before relying on it.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol

from app.core.config import get_settings
from app.ml.predict import WellbeingPrediction

SYSTEM_PROMPT = """You are the analysis-writing component of SignalWell AI, a digital-wellbeing \
tool. You will be given a structured ML prediction (a number or category, plus which behavioral \
features contributed most, per SHAP) and recent activity/sleep/mood data. Write a short, \
plain-language explanation.

Rules you must follow:
- Never state or imply a clinical diagnosis (depression, anxiety disorder, or any other \
condition). You are not a medical tool.
- Clearly distinguish OBSERVED DATA (what was actually logged) from INTERPRETATION (your \
reading of what it might mean). Use hedged, non-causal language: "may be related to", \
"is worth monitoring" — never "caused by" or "means that".
- You must not change, round differently, reinterpret, or override the numeric prediction you \
were given. Treat it as fixed input, not something to re-derive.
- Keep tone calm and non-alarming, matching Section 11 of the product spec.
"""


@dataclass
class AnalysisResult:
    summary: str
    observed_data_points: list[str]
    interpretation_points: list[str]
    recommendations: list[str]


class AiProvider(Protocol):
    model_name: str

    def generate_analysis_explanation(
        self, prediction: WellbeingPrediction, context: dict
    ) -> AnalysisResult: ...

    def generate_chat_response(
        self, conversation_history: list[dict], user_message: str, wellbeing_data: dict | None
    ) -> str: ...


class AnthropicProvider:
    """
    Direct HTTPS call to the Messages API rather than the SDK, so this
    service has one fewer dependency to install — matches
    backend/requirements.txt, which lists httpx but not the anthropic
    package. Swap in the official SDK here if preferred; nothing else in
    this file would need to change.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.ai_api_key
        self.model_name = settings.ai_model_name or "claude-sonnet-4-6"

    def _call(self, system: str, user_content: str, max_tokens: int = 1000) -> str:
        import httpx  # imported lazily: lets safety_service/chatbot_service's

        # crisis short-circuit be imported and tested without httpx
        # installed, since that path never reaches this method.
        resp = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": self.model_name,
                "max_tokens": max_tokens,
                "system": system,
                "messages": [{"role": "user", "content": user_content}],
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")

    def generate_analysis_explanation(self, prediction: WellbeingPrediction, context: dict) -> AnalysisResult:
        user_content = json.dumps(
            {
                "ml_prediction": {
                    "task": prediction.task,
                    "value": prediction.value,
                    "confidence": prediction.confidence,
                    "top_contributing_features": prediction.top_contributing_features,
                },
                "recent_context": context,
                "instructions": (
                    "Respond ONLY with JSON: {summary, observed_data_points (list of strings), "
                    "interpretation_points (list of strings), recommendations (list of strings)}. "
                    "No other text."
                ),
            }
        )
        raw = self._call(SYSTEM_PROMPT, user_content)
        parsed = json.loads(raw)
        return AnalysisResult(
            summary=parsed["summary"],
            observed_data_points=parsed.get("observed_data_points", []),
            interpretation_points=parsed.get("interpretation_points", []),
            recommendations=parsed.get("recommendations", []),
        )

    def generate_chat_response(
        self, conversation_history: list[dict], user_message: str, wellbeing_data: dict | None
    ) -> str:
        messages_context = "\n".join(f"{m['role']}: {m['message']}" for m in conversation_history[-10:])
        user_content = (
            f"Conversation so far:\n{messages_context}\n\n"
            f"User's latest message: {user_message}\n\n"
            f"User's recent wellbeing data (omit if not provided): {json.dumps(wellbeing_data) if wellbeing_data else 'not shared'}"
        )
        return self._call(SYSTEM_PROMPT, user_content, max_tokens=600)


def get_ai_provider() -> AiProvider:
    settings = get_settings()
    if settings.ai_provider == "anthropic":
        return AnthropicProvider()
    raise ValueError(f"Unknown AI_PROVIDER: {settings.ai_provider}")
