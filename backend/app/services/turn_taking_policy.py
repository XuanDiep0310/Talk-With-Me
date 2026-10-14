"""
Turn-Taking Policy according to Communication-First rules (AGENTS.md §8 rule 9, SRS F-01 US-03).

Rules:
  - Do NOT interrupt user when hesitating or using filler words (um, uh, er, ah, hmm).
  - Short silence (< silence_threshold_ms) does NOT end the user's turn.
  - Long silence (>= silence_threshold_ms) with a complete thought triggers turn completion.
  - If utterance ends with a filler word, turn remains OPEN even during silence.
"""

import re

# Standard English conversational filler words
FILLER_WORDS: frozenset[str] = frozenset(
    [
        "um",
        "uh",
        "er",
        "ah",
        "hmm",
        "like",
        "well",
        "you know",
        "i mean",
    ]
)


class TurnTakingPolicy:
    """Evaluates whether the user's turn is complete based on audio silence and speech content."""

    def __init__(self, default_silence_threshold_ms: int = 1500) -> None:
        self.silence_threshold_ms = default_silence_threshold_ms

    @staticmethod
    def is_filler_word(token: str) -> bool:
        """Check if a word/token is a recognized filler word."""
        clean = re.sub(r"[^\w\s]", "", token).strip().lower()
        return clean in FILLER_WORDS

    @staticmethod
    def ends_with_filler(text: str) -> bool:
        """Check if the latest spoken words in the text indicate hesitation or filler."""
        if not text:
            return False

        # Clean punctuation and split into tokens
        tokens = [re.sub(r"[^\w]", "", w).lower() for w in text.strip().split()]
        tokens = [t for t in tokens if t]
        if not tokens:
            return False

        last_token = tokens[-1]
        if last_token in FILLER_WORDS:
            return True

        # Check two-word fillers like "you know"
        if len(tokens) >= 2:
            last_two = f"{tokens[-2]} {tokens[-1]}"
            if last_two in FILLER_WORDS:
                return True

        return False

    def should_end_turn(
        self,
        transcript: str,
        silence_duration_ms: int,
        is_speech_end_event: bool = False,
    ) -> bool:
        """
        Determine if the user has completed their turn and AI should respond.

        Returns False if:
          1. Silence duration is below the silence threshold.
          2. Utterance ends with hesitation/filler words (giving user time to finish).
          3. Transcript is empty.
        """
        clean_text = transcript.strip()
        if not clean_text:
            return False

        # If user is hesitating with a filler, do not interrupt!
        if self.ends_with_filler(clean_text):
            return False

        # If explicit client speech_end event fired and not ending with filler
        if is_speech_end_event:
            return True

        # Otherwise require silence to exceed threshold
        return silence_duration_ms >= self.silence_threshold_ms
