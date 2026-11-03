"""
Chunk matcher service: analyzes user transcripts against scenario target chunks.
Applies text normalization, exact match, accepted variations, and sliding window similarity.
Categorizes matches into: EXACT, VARIATION, APPROXIMATE, WRONG_FUNCTION, NOT_USED.
"""

from __future__ import annotations

import difflib
import re
import string
from dataclasses import dataclass
from enum import StrEnum
from typing import Any


class ChunkMatchType(StrEnum):
    EXACT = "EXACT"
    VARIATION = "VARIATION"
    APPROXIMATE = "APPROXIMATE"
    WRONG_FUNCTION = "WRONG_FUNCTION"
    NOT_USED = "NOT_USED"


@dataclass
class ChunkMatchResult:
    chunk_id: str
    target_text: str
    function_tag: str
    match_type: ChunkMatchType
    is_used_well: bool
    similarity_score: float
    matched_utterance: str | None = None
    reason: str = ""


def normalize_text(text: str) -> str:
    """Normalize text by lowercasing, stripping punctuation, and collapsing whitespace."""
    if not text:
        return ""
    # Replace punctuation with space
    t = text.lower()
    # Replace ellipsis or dashes
    t = t.replace("...", " ").replace("—", " ").replace("–", " ")
    for p in string.punctuation:
        t = t.replace(p, " ")
    # Collapse multiple whitespace
    tokens = re.split(r"\s+", t)
    return " ".join([token for token in tokens if token])


def compute_phrase_similarity(target_phrase: str, utterance: str) -> tuple[float, str]:
    """
    Computes maximum similarity score between a target phrase and any sliding window
    in the candidate utterance.
    Returns (score, best_matching_window).
    """
    p_norm = normalize_text(target_phrase)
    u_norm = normalize_text(utterance)

    if not p_norm or not u_norm:
        return 0.0, ""

    # Direct substring check
    if p_norm in u_norm:
        return 1.0, p_norm

    p_words = p_norm.split()
    u_words = u_norm.split()
    p_len = len(p_words)

    if not p_words or not u_words:
        return 0.0, ""

    # If utterance is shorter than target phrase
    if len(u_words) <= p_len + 1:
        score = difflib.SequenceMatcher(None, p_norm, u_norm).ratio()
        return score, u_norm

    # Sliding window of length p_len - 1 to p_len + 2
    best_score = 0.0
    best_window = ""

    min_w = max(1, p_len - 1)
    max_w = min(len(u_words), p_len + 2)

    for w_size in range(min_w, max_w + 1):
        for i in range(len(u_words) - w_size + 1):
            window = " ".join(u_words[i : i + w_size])
            score = difflib.SequenceMatcher(None, p_norm, window).ratio()
            if score > best_score:
                best_score = score
                best_window = window

    return best_score, best_window


class ChunkMatcher:
    """Matches dialogue utterances against chunk targets using hybrid phonetic/string rules."""

    def __init__(
        self,
        exact_threshold: float = 0.90,
        approx_threshold: float = 0.72,
    ) -> None:
        self.exact_threshold = exact_threshold
        self.approx_threshold = approx_threshold

    def match_single_chunk(
        self,
        chunk_id: str,
        target_text: str,
        function_tag: str,
        accepted_variations: list[str],
        user_utterances: list[str],
        llm_function_verdicts: dict[str, bool] | None = None,
    ) -> ChunkMatchResult:
        """
        Evaluate if a single chunk was used, how it was matched, and if functional usage is valid.
        """
        best_type = ChunkMatchType.NOT_USED
        best_score = 0.0
        best_utterance: str | None = None
        matched_text = ""

        # Check each user utterance
        for utterance in user_utterances:
            if not utterance.strip():
                continue

            # 1. Check exact target phrase
            score, window = compute_phrase_similarity(target_text, utterance)
            if score >= self.exact_threshold:
                if score > best_score:
                    best_score = score
                    best_type = ChunkMatchType.EXACT
                    best_utterance = utterance
                    matched_text = window
                continue

            # 2. Check accepted variations
            for var in accepted_variations:
                v_score, v_window = compute_phrase_similarity(var, utterance)
                if v_score >= self.exact_threshold:
                    if v_score > best_score:
                        best_score = v_score
                        best_type = ChunkMatchType.VARIATION
                        best_utterance = utterance
                        matched_text = v_window
                    break
                elif v_score >= self.approx_threshold and v_score > best_score:
                    best_score = v_score
                    best_type = ChunkMatchType.APPROXIMATE
                    best_utterance = utterance
                    matched_text = v_window

            # 3. Check approximate match on target text
            if score >= self.approx_threshold and score > best_score:
                best_score = score
                best_type = ChunkMatchType.APPROXIMATE
                best_utterance = utterance
                matched_text = window

        # Functional validation check:
        # If external verification indicates incorrect communicative function
        is_function_valid = True
        if llm_function_verdicts and chunk_id in llm_function_verdicts:
            is_function_valid = llm_function_verdicts[chunk_id]

        if best_type in (
            ChunkMatchType.EXACT,
            ChunkMatchType.VARIATION,
            ChunkMatchType.APPROXIMATE,
        ):
            if not is_function_valid:
                return ChunkMatchResult(
                    chunk_id=chunk_id,
                    target_text=target_text,
                    function_tag=function_tag,
                    match_type=ChunkMatchType.WRONG_FUNCTION,
                    is_used_well=False,
                    similarity_score=round(best_score, 2),
                    matched_utterance=best_utterance,
                    reason=f"Used wording similar to '{matched_text}' but in an inappropriate communicative function.",
                )

            return ChunkMatchResult(
                chunk_id=chunk_id,
                target_text=target_text,
                function_tag=function_tag,
                match_type=best_type,
                is_used_well=True,
                similarity_score=round(best_score, 2),
                matched_utterance=best_utterance,
                reason=f"Matched successfully via {best_type.value}.",
            )

        return ChunkMatchResult(
            chunk_id=chunk_id,
            target_text=target_text,
            function_tag=function_tag,
            match_type=ChunkMatchType.NOT_USED,
            is_used_well=False,
            similarity_score=round(best_score, 2),
            matched_utterance=None,
            reason="Chunk was not used during this session.",
        )

    def evaluate_all_chunks(
        self,
        chunks: list[dict[str, Any]],
        user_utterances: list[str],
        llm_function_verdicts: dict[str, bool] | None = None,
    ) -> list[ChunkMatchResult]:
        """Evaluate all scenario chunks against all user utterances in the session."""
        results: list[ChunkMatchResult] = []
        for c in chunks:
            res = self.match_single_chunk(
                chunk_id=str(c.get("id", "")),
                target_text=c.get("text", ""),
                function_tag=c.get("function_tag", ""),
                accepted_variations=c.get("accepted_variations", []),
                user_utterances=user_utterances,
                llm_function_verdicts=llm_function_verdicts,
            )
            results.append(res)
        return results
