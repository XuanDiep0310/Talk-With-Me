"""
LLM provider interface for placement level evaluation and AI Coach conversation.

All LLM operations adhere to the Communication-First rules (AGENTS.md §8 rule 9):
  - Do NOT interrupt user for hesitation or filler words.
  - Do NOT correct grammar mid-conversation.
  - Adapt vocabulary to the user's CEFR level.
  - Gently guide the conversation back if off-topic.
  - Keep responses concise (1–3 sentences) and end with an open-ended guiding question.
"""

from typing import Any, Protocol

import httpx

from app.core.config import get_settings


class LlmLevelEvaluation:
    """LLM's assessment of user level from transcript content."""

    __slots__ = ("suggested_level", "confidence", "reasoning")

    def __init__(
        self,
        suggested_level: str,
        confidence: float,
        reasoning: str,
    ) -> None:
        self.suggested_level = suggested_level
        self.confidence = confidence
        self.reasoning = reasoning


class LlmProvider(Protocol):
    """Abstract interface for LLM services."""

    async def evaluate_placement(self, transcripts: list[str]) -> LlmLevelEvaluation:
        """Evaluate placement test transcripts to suggest a CEFR level."""
        ...

    async def generate_coach_reply(
        self,
        history: list[dict[str, str]],
        user_message: str,
        user_level: str,
        topic_title: str,
    ) -> str:
        """Generate friendly, concise coach response with a guiding question."""
        ...


class FakeLlmProvider:
    """
    Fake LLM provider for development and testing.
    Always produces compliant, conversational English responses.
    """

    _REPLIES = [
        "That sounds fascinating! How often do you get the chance to do that during a regular week?",
        "I completely understand what you mean. What was the most exciting part of that experience for you?",
        "That makes total sense. Could you tell me a little more about why you feel that way?",
        "That's really inspiring! If you could change one thing about it, what would it be?",
    ]
    _counter: int = 0

    async def evaluate_placement(self, transcripts: list[str]) -> LlmLevelEvaluation:  # noqa: ARG002
        return LlmLevelEvaluation(
            suggested_level="B1",
            confidence=0.75,
            reasoning="Fake evaluation: vocabulary and sentence structure suggest B1.",
        )

    async def generate_coach_reply(
        self,
        history: list[dict[str, str]],  # noqa: ARG002
        user_message: str,  # noqa: ARG002
        user_level: str,  # noqa: ARG002
        topic_title: str,  # noqa: ARG002
    ) -> str:
        idx = FakeLlmProvider._counter % len(self._REPLIES)
        FakeLlmProvider._counter += 1
        return self._REPLIES[idx]


class GeminiLlmProvider:
    """
    Google Gemini implementation for AI Coach and Placement evaluation.
    Activated when LLM_PROVIDER=gemini and LLM_API_KEY is configured.
    """

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash") -> None:
        self.api_key = api_key
        self.model = model
        self.endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

    async def evaluate_placement(self, transcripts: list[str]) -> LlmLevelEvaluation:
        prompt = (
            "Evaluate the CEFR level (A1, A2, B1, B2, or C1) for an English learner who said:\n"
            + "\n".join(f"- {t}" for t in transcripts)
            + '\nReply in JSON: {"suggested_level": "B1", "confidence": 0.8, "reasoning": "brief"}'
        )
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(self.endpoint, json=payload)
                res.raise_for_status()
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                # Parse JSON or fallback
                import json

                parsed = json.loads(text.strip("` \n").removeprefix("json"))
                return LlmLevelEvaluation(
                    suggested_level=parsed.get("suggested_level", "B1"),
                    confidence=float(parsed.get("confidence", 0.7)),
                    reasoning=parsed.get("reasoning", "Evaluated by Gemini"),
                )
        except Exception:
            return LlmLevelEvaluation(
                suggested_level="B1", confidence=0.7, reasoning="Fallback estimation"
            )

    async def generate_coach_reply(
        self,
        history: list[dict[str, str]],
        user_message: str,
        user_level: str,
        topic_title: str,
    ) -> str:
        system_instruction = (
            f"You are Alex, an encouraging English Communication Coach at TalkWithMe. "
            f"The user is at CEFR Level {user_level}, discussing the topic '{topic_title}'. "
            f"Rules:\n"
            f"1. Keep responses short and conversational (1 to 2 sentences max).\n"
            f"2. Always end with one friendly, open-ended question to keep the conversation flowing.\n"
            f"3. Do NOT interrupt or criticize grammar mid-conversation.\n"
            f"4. Adapt your vocabulary to level {user_level}."
        )

        contents: list[dict[str, Any]] = []
        for h in history[-6:]:  # Context window: last 6 turns
            role = "user" if h.get("role") == "user" else "model"
            contents.append({"role": role, "parts": [{"text": h.get("content", "")}]})
        contents.append({"role": "user", "parts": [{"text": user_message}]})

        payload = {
            "system_instruction": {"parts": [{"text": system_instruction}]},
            "contents": contents,
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 100},
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(self.endpoint, json=payload)
                res.raise_for_status()
                data = res.json()
                reply_text: str = data["candidates"][0]["content"]["parts"][0]["text"]
                return reply_text.strip()
        except Exception:
            # Fallback on timeout or external service issue
            return FakeLlmProvider._REPLIES[0]


def get_llm_provider() -> LlmProvider:
    """Factory resolving configured LLM provider."""
    settings = get_settings()
    if settings.LLM_PROVIDER.lower() in ("gemini", "google") and settings.LLM_API_KEY:
        return GeminiLlmProvider(api_key=settings.LLM_API_KEY, model=settings.LLM_MODEL)
    return FakeLlmProvider()
