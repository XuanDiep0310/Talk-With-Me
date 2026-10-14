"""
LLM provider interface for placement level evaluation.

The placement service uses this to ask an LLM to assess transcripts
and estimate a CEFR level. Only used as a secondary signal — the
primary heuristic features from estimate_level() are always authoritative.
"""

from typing import Protocol


class LlmLevelEvaluation:
    """LLM's assessment of user level from transcript content."""

    __slots__ = ("suggested_level", "confidence", "reasoning")

    def __init__(
        self,
        suggested_level: str,
        confidence: float,
        reasoning: str,
    ) -> None:
        # CEFR level string: A1, A2, B1, B2, C1
        self.suggested_level = suggested_level
        # 0.0–1.0
        self.confidence = confidence
        self.reasoning = reasoning


class LlmProvider(Protocol):
    """Abstract interface for LLM-based placement evaluation."""

    async def evaluate_placement(self, transcripts: list[str]) -> LlmLevelEvaluation:
        """
        Given a list of user answer transcripts from a placement test,
        return a CEFR level estimate with confidence and brief reasoning.
        """
        ...


class FakeLlmProvider:
    """
    Fake LLM provider for development and testing.

    Always returns B1 with high confidence regardless of input.
    Used when LLM_PROVIDER=fake (default in dev).
    """

    async def evaluate_placement(self, transcripts: list[str]) -> LlmLevelEvaluation:  # noqa: ARG002
        return LlmLevelEvaluation(
            suggested_level="B1",
            confidence=0.75,
            reasoning="Fake evaluation: vocabulary and sentence structure suggest B1.",
        )
