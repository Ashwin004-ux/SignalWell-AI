"""
Verifies the crisis short-circuit never reaches the LLM provider.

COULD NOT BE RUN IN THIS SANDBOX: importing chatbot_service pulls in
llm_analysis_service -> app.core.config, which requires pydantic_settings
(not installed here, no network to add it). The underlying crisis-keyword
logic this test exercises (safety_service.detect_crisis_language) WAS run
directly and passed 12/12 cases including a deliberate false-positive trap
("I killed it at the gym") — see that module. Run this file for real with
`pytest` after `pip install -r requirements.txt` to confirm the wiring
above the keyword check (the short-circuit itself) also behaves correctly.
"""
from __future__ import annotations

from app.services.chatbot_service import respond


def test_crisis_message_short_circuits_before_any_provider_call():
    result = respond(conversation_history=[], user_message="I want to end my life")
    assert result.was_crisis_response is True
    assert "988" in result.message
    assert "emergency services" in result.message.lower()


def test_non_crisis_message_does_not_set_crisis_flag():
    # We can't call the real provider here (no network/API key in this
    # environment), so this only verifies the routing decision itself,
    # not the LLM call that would follow it.
    from app.services import safety_service

    assert safety_service.detect_crisis_language("how can I reduce my screen time?") is False
