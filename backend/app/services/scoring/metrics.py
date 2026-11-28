"""Pure functions for Scoring Engine v2.0.0 (5 dimensions, no Fluency double-counting).

Dimensions:
  1. Pronunciation (Azure Accuracy 70% + Azure Prosody 30% — never PronScore)
  2. Fluency (Azure Fluency 60% + Temporal Continuity/Pause/Filler 40%)
  3. Vocabulary (MTLD Diversity 40% + Gemini Vocabulary Rubric 60%)
  4. Grammar (Gemini Grammar Rubric)
  5. Interaction & Coherence (Gemini Interaction/Coherence 75% + Response Speed 25%)
"""

from __future__ import annotations

import math
import re
from typing import Any

FILLER_WORDS = {"um", "uh", "er", "ah", "hmm", "well", "like", "you know"}


def clean_and_tokenize(text: str) -> list[str]:
    """Tokenize text into lowercase alphanumeric words."""
    cleaned = re.sub(r"[^\w\s']", " ", text.lower())
    return [tok.strip("'") for tok in cleaned.split() if tok.strip("'")]


def detect_filler_words(text: str) -> tuple[int, list[str]]:
    """Detect conversational filler words/phrases and return (count, tokens)."""
    lower = text.lower()
    found: list[str] = []
    for phrase in ["you know"]:
        matches = len(re.findall(rf"\b{re.escape(phrase)}\b", lower))
        found.extend([phrase] * matches)
        lower = re.sub(rf"\b{re.escape(phrase)}\b", " ", lower)

    for tok in clean_and_tokenize(lower):
        if tok in {"um", "uh", "er", "ah", "hmm", "well", "like"}:
            found.append(tok)
    return len(found), found


def compute_speech_continuity(
    spoken_seconds: float,
    turn_span_seconds: float,
    target_ratio: float = 0.85,
) -> tuple[float | None, str | None]:
    if turn_span_seconds <= 0.0 or spoken_seconds <= 0.0:
        return None, "INSUFFICIENT_TURN_DURATION"
    ratio = spoken_seconds / max(turn_span_seconds, spoken_seconds)
    score = min(100.0, max(0.0, (ratio / target_ratio) * 100.0))
    return round(score, 1), None


def compute_pause_score(
    long_pause_count: int,
    spoken_seconds: float,
    penalty_per_min: float = 12.0,
) -> tuple[float | None, str | None]:
    if spoken_seconds < 3.0:
        return None, "INSUFFICIENT_SPEECH_DURATION"
    minutes = max(spoken_seconds / 60.0, 0.05)
    pauses_per_min = long_pause_count / minutes
    score = max(0.0, min(100.0, 100.0 - (pauses_per_min * penalty_per_min)))
    return round(score, 1), None


def compute_filler_word_score(
    filler_count: int,
    total_words: int,
    penalty_per_100: float = 8.0,
) -> tuple[float | None, str | None]:
    if total_words < 3:
        return None, "INSUFFICIENT_WORDS"
    filler_ratio_per_100 = (filler_count / max(total_words, 1)) * 100.0
    score = max(0.0, min(100.0, 100.0 - (filler_ratio_per_100 * penalty_per_100)))
    return round(score, 1), None


def compute_fluency_score(
    continuity: float | None,
    pause: float | None,
    filler: float | None,
    azure_fluency: float | None = None,
) -> tuple[float | None, dict[str, float | str | None], str | None]:
    """Blend Azure Fluency (0.60) with temporal Fluency sub-score (0.40)."""
    temporal_weights = [(continuity, 0.45), (pause, 0.35), (filler, 0.20)]
    valid_temporal = [(val, w) for val, w in temporal_weights if val is not None]
    temporal_score: float | None = None
    if valid_temporal:
        tw = sum(w for _, w in valid_temporal)
        temporal_score = round(sum(val * (w / tw) for val, w in valid_temporal), 1)

    components: dict[str, float | str | None] = {
        "azure_fluency": round(azure_fluency, 1) if azure_fluency is not None else None,
        "speech_continuity": continuity,
        "pause_score": pause,
        "filler_word_score": filler,
        "temporal_fluency": temporal_score,
        "assessment_source": "AZURE_SPEECH" if azure_fluency is not None else "TEMPORAL_ONLY",
    }
    weights = [(azure_fluency, 0.60), (temporal_score, 0.40)]
    valid = [(val, w) for val, w in weights if val is not None]
    if not valid:
        return None, components, "ALL_FLUENCY_SIGNALS_MISSING"
    total_w = sum(w for _, w in valid)
    return round(sum(val * (w / total_w) for val, w in valid), 1), components, None


def compute_pronunciation_score(
    accuracies: list[float],
    prosodies: list[float] | None = None,
) -> tuple[float | None, dict[str, float | str | None], str | None]:
    """Pronunciation = Azure Accuracy (70%) + Azure Prosody (30%). Never uses PronScore."""
    valid_acc = [a for a in accuracies if a is not None and not math.isnan(a)]
    valid_pro = [p for p in (prosodies or []) if p is not None and not math.isnan(p)]

    if not valid_acc:
        return (
            None,
            {"accuracy": None, "prosody": None, "assessment_source": "UNAVAILABLE"},
            "NO_AZURE_PRONUNCIATION_DATA",
        )

    avg_acc = round(sum(valid_acc) / len(valid_acc), 1)
    avg_pro = round(sum(valid_pro) / len(valid_pro), 1) if valid_pro else None
    score = round(0.70 * avg_acc + 0.30 * avg_pro, 1) if avg_pro is not None else avg_acc
    components: dict[str, float | str | None] = {
        "accuracy": avg_acc,
        "prosody": avg_pro,
        "assessment_source": "AZURE_SPEECH",
    }
    return min(100.0, max(0.0, score)), components, None


def compute_mtld(tokens: list[str], threshold: float = 0.72) -> float:
    """Measure of Textual Lexical Diversity (forward + backward average)."""
    if not tokens:
        return 0.0

    def _pass(toks: list[str]) -> float:
        factors = 0.0
        start = 0
        current_types: set[str] = set()
        for i, word in enumerate(toks):
            current_types.add(word)
            ttr = len(current_types) / (i - start + 1)
            if ttr <= threshold:
                factors += 1.0
                current_types.clear()
                start = i + 1
        remainder = len(toks) - start
        if remainder > 0:
            final_ttr = len(current_types) / remainder
            if final_ttr < 1.0:
                factors += (1.0 - final_ttr) / (1.0 - threshold)
        return float(len(toks)) if factors == 0.0 else len(toks) / factors

    return round((_pass(tokens) + _pass(list(reversed(tokens)))) / 2.0, 2)


def compute_vocabulary_diversity(
    tokens: list[str],
    min_words: int = 10,
    benchmark: float = 50.0,
) -> tuple[float | None, float | None, str | None]:
    if len(tokens) < min_words:
        return None, None, "TEXT_TOO_SHORT_FOR_MTLD"
    mtld = compute_mtld(tokens)
    score = min(100.0, max(0.0, (mtld / benchmark) * 100.0))
    return round(score, 1), mtld, None


def compute_vocabulary_score(
    diversity: float | None,
    gemini_vocabulary: float | None,
    cefr_band: str | None = None,
) -> tuple[float | None, dict[str, float | str | None], str | None]:
    components: dict[str, float | str | None] = {
        "vocabulary_diversity": diversity,
        "gemini_vocabulary": gemini_vocabulary,
        "cefr_band": cefr_band,
        "assessment_source": "GEMINI",
    }
    weights = [(diversity, 0.40), (gemini_vocabulary, 0.60)]
    valid = [(val, w) for val, w in weights if val is not None]
    if not valid:
        return None, components, "INSUFFICIENT_VOCABULARY_DATA"
    total_w = sum(w for _, w in valid)
    return round(sum(val * (w / total_w) for val, w in valid), 1), components, None


def compute_grammar_score(
    gemini_grammar: float | None,
    cefr_band: str | None = None,
    grammar_errors: list[dict[str, Any]] | None = None,
) -> tuple[float | None, dict[str, Any], str | None]:
    components: dict[str, Any] = {
        "cefr_band": cefr_band,
        "grammar_errors": grammar_errors or [],
        "assessment_source": "GEMINI",
    }
    if gemini_grammar is None:
        return None, components, "NO_GEMINI_GRAMMAR_DATA"
    return round(min(100.0, max(0.0, gemini_grammar)), 1), components, None


def compute_response_speed(
    average_latency_seconds: float | None,
    grace_period: float = 2.0,
    penalty_per_sec: float = 12.0,
) -> tuple[float | None, dict[str, float | None], str | None]:
    if average_latency_seconds is None or average_latency_seconds < 0.0:
        return None, {"average_latency_seconds": None}, "NO_INTERACTIVE_TURNS"
    t = average_latency_seconds
    score = 100.0 if t <= grace_period else max(0.0, 100.0 - penalty_per_sec * (t - grace_period))
    return round(score, 1), {"average_latency_seconds": round(t, 2)}, None


def compute_interaction_score(
    gemini_interaction: float | None,
    gemini_coherence: float | None,
    response_speed_score: float | None,
    average_latency_seconds: float | None = None,
) -> tuple[float | None, dict[str, Any], str | None]:
    """Interaction & Coherence = 0.75 * Semantic(Interaction + Coherence) + 0.25 * ResponseSpeed."""
    sem_weights = [(gemini_interaction, 0.55), (gemini_coherence, 0.45)]
    valid_sem = [(val, w) for val, w in sem_weights if val is not None]
    sem_score: float | None = None
    if valid_sem:
        sw = sum(w for _, w in valid_sem)
        sem_score = round(sum(val * (w / sw) for val, w in valid_sem), 1)

    components: dict[str, Any] = {
        "gemini_interaction": gemini_interaction,
        "gemini_coherence": gemini_coherence,
        "response_speed_score": response_speed_score,
        "average_latency_seconds": round(average_latency_seconds, 2)
        if average_latency_seconds is not None
        else None,
        "assessment_source": "GEMINI",
    }
    weights = [(sem_score, 0.75), (response_speed_score, 0.25)]
    valid = [(val, w) for val, w in weights if val is not None]
    if not valid:
        return None, components, "NO_INTERACTION_DATA"
    total_w = sum(w for _, w in valid)
    return round(sum(val * (w / total_w) for val, w in valid), 1), components, None


def compute_overall_score(
    pronunciation: float | None,
    fluency: float | None,
    vocabulary: float | None,
    grammar: float | None,
    interaction: float | None,
) -> tuple[float | None, bool]:
    """Equal 20% weighting across 5 dimensions with Rule D-10 missing-metric handling."""
    weights = [
        (pronunciation, 0.20),
        (fluency, 0.20),
        (vocabulary, 0.20),
        (grammar, 0.20),
        (interaction, 0.20),
    ]
    valid = [(val, w) for val, w in weights if val is not None]
    if len(valid) == 5:
        return round(sum(val * w for val, w in valid), 1), False
    if len(valid) == 4:
        total_w = sum(w for _, w in valid)
        return round(sum(val * (w / total_w) for val, w in valid), 1), True
    return None, False


def is_session_data_sufficient(
    total_words: int,
    user_turns: int,
    spoken_seconds: float,
    min_words: int = 5,
    min_turns: int = 1,
    min_spoken: float = 4.0,
) -> bool:
    return total_words >= min_words and user_turns >= min_turns and spoken_seconds >= min_spoken


def _seg_get(seg: Any, attr: str, default: Any = None) -> Any:
    return seg.get(attr, default) if isinstance(seg, dict) else getattr(seg, attr, default)


def extract_session_turn_metrics(
    segments: list[Any],
    pause_threshold_ms: int = 1500,
) -> dict[str, Any]:
    """Extract temporal, lexical, latency, and Azure acoustic metrics from transcript segments."""
    sorted_segs = sorted(
        (s for s in segments if _seg_get(s, "is_final", True)),
        key=lambda s: int(_seg_get(s, "seq", 0) or 0),
    )

    user_segments: list[Any] = []
    user_turns: list[list[Any]] = []
    current_turn: list[Any] = []
    current_speaker: str | None = None

    for seg in sorted_segs:
        spk = str(_seg_get(seg, "speaker", "")).upper()
        if spk == current_speaker:
            current_turn.append(seg)
        else:
            if current_turn and current_speaker == "USER":
                user_turns.append(current_turn)
            current_speaker = spk
            current_turn = [seg]
        if spk == "USER":
            user_segments.append(seg)

    if current_turn and current_speaker == "USER":
        user_turns.append(current_turn)

    all_user_text = " ".join(str(_seg_get(s, "text", "")).strip() for s in user_segments)
    tokens = clean_and_tokenize(all_user_text)
    total_words = len(tokens)
    filler_count, found_fillers = detect_filler_words(all_user_text)

    # Temporal speech features (preferring STT-measured speech_ms when present)
    measured = [s for s in user_segments if _seg_get(s, "speech_ms", None) is not None]
    if measured:
        spoken_seconds = sum(_seg_get(s, "speech_ms", 0) for s in measured) / 1000.0
        turn_span_seconds = sum((_seg_get(s, "speech_span_ms", 0) or 0) for s in measured) / 1000.0
        long_pause_count = sum((_seg_get(s, "long_pause_count", 0) or 0) for s in measured)
        latencies = [
            _seg_get(s, "response_latency_ms") / 1000.0
            for s in measured
            if _seg_get(s, "response_latency_ms", None) is not None
        ]
        spoken_word_count = sum((_seg_get(s, "word_count", 0) or 0) for s in measured)
        speech_filler_count = sum((_seg_get(s, "filler_count", 0) or 0) for s in measured)
    else:
        spoken_seconds = 0.0
        turn_span_seconds = 0.0
        long_pause_count = 0
        for turn in user_turns:
            if not turn:
                continue
            t_start = _seg_get(turn[0], "start_ms", 0) or 0
            t_end = _seg_get(turn[-1], "end_ms", 0) or 0
            turn_span_seconds += max(0.0, (t_end - t_start) / 1000.0)
            for i in range(len(turn) - 1):
                e1 = _seg_get(turn[i], "end_ms", 0) or 0
                st2 = _seg_get(turn[i + 1], "start_ms", 0) or 0
                if st2 - e1 >= pause_threshold_ms:
                    long_pause_count += 1
        for s in user_segments:
            st = _seg_get(s, "start_ms", 0) or 0
            en = _seg_get(s, "end_ms", 0) or 0
            if en > st:
                spoken_seconds += (en - st) / 1000.0
        latencies = []
        last_ai_end_ms: int | None = None
        for seg in sorted_segs:
            spk = str(_seg_get(seg, "speaker", "")).upper()
            st = _seg_get(seg, "start_ms", 0) or 0
            en = _seg_get(seg, "end_ms", 0) or 0
            if spk == "AI":
                last_ai_end_ms = en
            elif spk == "USER" and last_ai_end_ms is not None:
                latencies.append(max(0.0, (st - last_ai_end_ms) / 1000.0))
                last_ai_end_ms = None
        spoken_word_count = total_words
        speech_filler_count = filler_count

    avg_latency = (sum(latencies) / len(latencies)) if latencies else None

    # Azure acoustic arrays
    accuracies = [
        float(_seg_get(s, "pronunciation_accuracy"))
        for s in user_segments
        if _seg_get(s, "pronunciation_accuracy", None) is not None
    ]
    azure_fluencies = [
        float(_seg_get(s, "pronunciation_fluency"))
        for s in user_segments
        if _seg_get(s, "pronunciation_fluency", None) is not None
    ]
    prosodies = [
        float(_seg_get(s, "pronunciation_prosody"))
        for s in user_segments
        if _seg_get(s, "pronunciation_prosody", None) is not None
    ]
    phoneme_errors: list[dict[str, Any]] = []
    for s in user_segments:
        errs = _seg_get(s, "phoneme_errors", None)
        if isinstance(errs, list):
            phoneme_errors.extend(errs)

    avg_azure_fluency = (
        round(sum(azure_fluencies) / len(azure_fluencies), 1) if azure_fluencies else None
    )

    return {
        "total_words": total_words,
        "tokens": tokens,
        "filler_count": speech_filler_count,
        "spoken_word_count": spoken_word_count,
        "found_fillers": found_fillers,
        "user_turns": len(user_turns),
        "spoken_seconds": round(spoken_seconds, 2),
        "turn_span_seconds": round(turn_span_seconds, 2),
        "long_pause_count": long_pause_count,
        "average_latency_seconds": avg_latency,
        "latencies": latencies,
        "accuracies": accuracies,
        "prosodies": prosodies,
        "avg_azure_fluency": avg_azure_fluency,
        "phoneme_errors": phoneme_errors,
        "all_user_text": all_user_text,
    }
