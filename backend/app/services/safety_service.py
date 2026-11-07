"""
Direct port of ../src/lib/ai/safety.ts — keep these two files in sync
manually; there is no shared source of truth between the Next.js and
Python codebases. See that file's docstring for the full reasoning: crisis
detection is a fixed, reviewed keyword/phrase check, never delegated to
the LLM, and intentionally biased toward false positives over false
negatives.

This list is a starting point, not a complete clinical instrument — see
docs/ROADMAP.md's crisis-language-review item.
"""
from __future__ import annotations

import re

_CRISIS_PATTERNS = [
    re.compile(r"\bsuicid(e|al)\b", re.IGNORECASE),
    re.compile(r"\bkill myself\b", re.IGNORECASE),
    re.compile(r"\bend my life\b", re.IGNORECASE),
    re.compile(r"\bwant to die\b", re.IGNORECASE),
    re.compile(r"\bhurt(ing)? myself\b", re.IGNORECASE),
    re.compile(r"\bself[- ]harm\b", re.IGNORECASE),
    re.compile(r"\bno reason to live\b", re.IGNORECASE),
    re.compile(r"\bcan'?t go on\b", re.IGNORECASE),
]

CRISIS_RESPONSE = """I'm really glad you reached out, and I want to take what you said seriously.

I'm not able to provide crisis support, and I don't want to guess at what would help most right now. If you're in immediate danger, please contact your local emergency services.

If you're in the US, you can call or text 988 (the Suicide & Crisis Lifeline) any time. Wherever you are, a trusted person — a friend, family member, or doctor — reaching out with you can help.

SignalWell AI provides wellbeing insights and educational guidance. It does not provide medical diagnosis or emergency mental health care."""


def detect_crisis_language(message: str) -> bool:
    return any(pattern.search(message) for pattern in _CRISIS_PATTERNS)
