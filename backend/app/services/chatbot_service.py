"""
Chatbot orchestration: runs the fixed crisis-safety check BEFORE any model
call, short-circuiting to the fixed CRISIS_RESPONSE if triggered (so a
crisis-indicating message never reaches the LLM, and the LLM's output
never substitutes for the reviewed resource text). Only when the safety
check doesn't trigger does this call the LLM provider.

UNTESTED IN THIS ENVIRONMENT (needs httpx + a real Anthropic API key, see
llm_analysis_service.py's own caveat) — but the safety short-circuit logic
in `respond` below has no such dependency and IS exercised by
tests/test_chatbot_service.py.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.services.llm_analysis_service import get_ai_provider
from app.services.safety_service import CRISIS_RESPONSE, detect_crisis_language


@dataclass
class ChatResult:
    message: str
    was_crisis_response: bool


def respond(conversation_history: list[dict], user_message: str, wellbeing_data: dict | None = None) -> ChatResult:
    if detect_crisis_language(user_message):
        return ChatResult(message=CRISIS_RESPONSE, was_crisis_response=True)

    provider = get_ai_provider()
    reply = provider.generate_chat_response(conversation_history, user_message, wellbeing_data)
    return ChatResult(message=reply, was_crisis_response=False)
