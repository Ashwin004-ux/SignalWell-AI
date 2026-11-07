"""LLM explanation layer. Never modifies numerical ML predictions."""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import httpx

AI_PROVIDER = os.getenv("AI_PROVIDER", "none")
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")

SYSTEM = (
    "You explain Digital Lifestyle and Wellbeing Analysis estimates for research users. "
    "You are not a clinician. Do not diagnose, treat, or assess suicide risk. "
    "Never change, invent, or override the provided ML prediction number. "
    "Use associative language. Do not claim causation. "
    "Do not use em dashes."
)


def template_explanation(prediction: Optional[float], shap: Dict[str, float], insights: List[Dict[str, str]]) -> str:
    if prediction is None:
        return "No model estimate is available. Rule-based observations below are based only on your logged values."
    parts = [
        f"The model estimate for self-reported wellbeing is {prediction:.2f} on the recorded 1 to 10 scale. "
        "This is a statistical estimate from lifestyle features, not a diagnosis."
    ]
    if shap:
        top = sorted(shap.items(), key=lambda item: abs(item[1]), reverse=True)[:5]
        labels = ", ".join(name.replace("_", " ") for name, _ in top)
        parts.append(
            f"The model identified {labels} as important features in this estimate. This is not a causal claim."
        )
    if insights:
        parts.append(" ".join(item.get("message", "") for item in insights if item.get("id") != "empty"))
    return " ".join(parts)


def explain_prediction(
    *,
    prediction: Optional[float],
    shap_values: Optional[Dict[str, float]] = None,
    insights: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    shap_values = shap_values or {}
    insights = insights or []
    fallback = template_explanation(prediction, shap_values, insights)
    if AI_PROVIDER != "openai" or not AI_API_KEY or prediction is None:
        return {
            "layer": "llm-explanation",
            "overrides_ml": False,
            "ml_prediction": prediction,
            "text": fallback,
            "provider": "template" if AI_PROVIDER == "none" or not AI_API_KEY else AI_PROVIDER,
        }

    user = (
        f"Frozen ML prediction (do not change): {prediction}\n"
        f"SHAP feature contributions: {shap_values}\n"
        f"Rule-based insights: {insights}\n"
        "Write 2 to 4 sentences for the participant. Repeat the numeric estimate exactly."
    )
    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {AI_API_KEY}"},
                json={
                    "model": AI_MODEL,
                    "temperature": 0.2,
                    "messages": [
                        {"role": "system", "content": SYSTEM},
                        {"role": "user", "content": user},
                    ],
                },
            )
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"].strip()
        if str(prediction) not in text and f"{prediction:.2f}" not in text:
            text = fallback
        return {
            "layer": "llm-explanation",
            "overrides_ml": False,
            "ml_prediction": prediction,
            "text": text,
            "provider": "openai",
        }
    except Exception:
        return {
            "layer": "llm-explanation",
            "overrides_ml": False,
            "ml_prediction": prediction,
            "text": fallback,
            "provider": "template-fallback",
        }


def chat_provider_available() -> bool:
    return AI_PROVIDER == "openai" and bool(AI_API_KEY)

def chat_reply(message: str, context_summary: str) -> str:
    if AI_PROVIDER != "openai" or not AI_API_KEY:
        return (
            "The assistant is not configured. You can still review your dashboard, check-ins, and lifestyle logs. "
            "This application does not provide medical or crisis care. If you need urgent help, contact local emergency or crisis services."
        )
    system = (
        "You are the DLWA research assistant. Non-clinical. Do not diagnose. "
        "Use only the structured summary provided. If a question needs unavailable data, say so. "
        "If the user describes crisis or harm, encourage qualified professional or local emergency help. Do not assess clinical risk."
    )
    with httpx.Client(timeout=20.0) as client:
        response = client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {AI_API_KEY}"},
            json={
                "model": AI_MODEL,
                "temperature": 0.3,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": f"Structured summary:\n{context_summary}\n\nUser message:\n{message}"},
                ],
            },
        )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"].strip()


def demo_chat_reply(message: str, context_summary: str) -> str:
    """Answer a research-demo question using only its selected synthetic context."""
    if AI_PROVIDER != "openai" or not AI_API_KEY:
        raise RuntimeError("The demo LLM provider is not configured.")
    system = (
        "You are an assistant for a synthetic digital-wellbeing research demo. "
        "Use only the supplied structured context, which contains the selected synthetic profile and date window. "
        "Never imply synthetic observations are real participant records. If a requested metric is absent, say it is unavailable; do not infer or invent numbers. "
        "Describe patterns as descriptive associations only; do not claim causation. Do not diagnose, prescribe, assess clinical risk, or give medical advice. "
        "If asked for clinical or crisis help, say this demo cannot provide it and suggest qualified local support. "
        "Clearly state that model results trained on this small synthetic fixture are software smoke-test outputs, not real-world accuracy evidence."
    )
    with httpx.Client(timeout=20.0) as client:
        response = client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {AI_API_KEY}"},
            json={
                "model": AI_MODEL,
                "temperature": 0.2,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": f"Selected synthetic context (JSON):\n{context_summary}\n\nQuestion: {message}"},
                ],
            },
        )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"].strip()
