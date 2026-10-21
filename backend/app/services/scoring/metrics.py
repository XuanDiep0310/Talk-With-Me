"""
Pure functions for calculating the 5 core communication metrics and overall score.
Fully deterministic, table-testable, with no external database or network dependencies.
Adheres strictly to SRS Section 3.3 and Decision D-10.
"""

import math
import re
from typing import Any

# Standard filler words / hesitation tokens
FILLER_WORDS = {"um", "uh", "er", "ah", "hmm", "well", "like", "you know"}


def clean_and_tokenize(text: str) -> list[str]:
    """Tokenize text into lowercase alphanumeric words."""
    cleaned = re.sub(r"[^\w\s']", " ", text.lower())
    tokens = [tok.strip("'") for tok in cleaned.split() if tok.strip("'")]
    return tokens


def detect_filler_words(text: str) -> tuple[int, list[str]]:
    """
    Detect filler words and phrases in the input text.
    Returns total filler count and list of found fillers.
    """
    lower = text.lower()
    found: list[str] = []

    # First check multi-word fillers like "you know"
    for phrase in ["you know"]:
        matches = len(re.findall(rf"\b{re.escape(phrase)}\b", lower))
        for _ in range(matches):
            found.append(phrase)
        # remove matched phrases to avoid double counting individual words
        lower = re.sub(rf"\b{re.escape(phrase)}\b", " ", lower)

    # Next check single-word fillers
    single_tokens = clean_and_tokenize(lower)
    for tok in single_tokens:
        if tok in {"um", "uh", "er", "ah", "hmm", "well", "like"}:
            found.append(tok)

    return len(found), found


def compute_speech_continuity(
    spoken_seconds: float,
    turn_span_seconds: float,
    target_ratio: float = 0.85,
) -> tuple[float | None, str | None]:
    """
    Compute Speech Continuity score.
    Ratio of actual speech duration over total user turn span.
    """
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
    """
    Compute Pause Score.
    Penalizes abnormal hesitation gaps (>= threshold) per spoken minute.
    """
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
    """
    Compute Filler Word Score.
    Penalizes filler word frequency per 100 words spoken.
    """
    if total_words < 3:
        return None, "INSUFFICIENT_WORDS"

    filler_ratio_per_100 = (filler_count / max(total_words, 1)) * 100.0
    score = max(0.0, min(100.0, 100.0 - (filler_ratio_per_100 * penalty_per_100)))
    return round(score, 1), None


def compute_fluency_score(
    continuity: float | None,
    pause: float | None,
    filler: float | None,
) -> tuple[float | None, dict[str, float | None], str | None]:
    """
    Combine Fluency score components per SRS 3.3:
    Fluency = 0.45 * Continuity + 0.35 * Pause + 0.20 * Filler
    """
    components = {
        "speech_continuity": continuity,
        "pause_score": pause,
        "filler_word_score": filler,
    }
    weights = [
        (continuity, 0.45),
        (pause, 0.35),
        (filler, 0.20),
    ]
    valid = [(val, w) for val, w in weights if val is not None]
    if not valid:
        return None, components, "ALL_COMPONENTS_MISSING"

    total_w = sum(w for _, w in valid)
    weighted_sum = sum((val * (w / total_w)) for val, w in valid)
    return round(weighted_sum, 1), components, None


def compute_listening_score(
    relevance: float | None,
    task_completion: float | None,
) -> tuple[float | None, dict[str, float | None], str | None]:
    """
    Combine Listening Comprehension score per SRS 3.3:
    Listening = 0.70 * Response Relevance + 0.30 * Task Completion
    """
    components = {
        "response_relevance": relevance,
        "task_completion": task_completion,
    }
    weights = [
        (relevance, 0.70),
        (task_completion, 0.30),
    ]
    valid = [(val, w) for val, w in weights if val is not None]
    if not valid:
        return None, components, "NO_AI_PROMPT_FOUND"

    total_w = sum(w for _, w in valid)
    weighted_sum = sum((val * (w / total_w)) for val, w in valid)
    return round(weighted_sum, 1), components, None


def compute_mtld(tokens: list[str], threshold: float = 0.72) -> float:
    """
    Compute Measure of Textual Lexical Diversity (MTLD) (McCarthy & Jarvis, 2010).
    Evaluates both forward and backward passes.
    """
    if not tokens:
        return 0.0

    def _pass(toks: list[str]) -> float:
        if not toks:
            return 0.0
        factors = 0.0
        start = 0
        current_types: set[str] = set()

        for i, word in enumerate(toks):
            current_types.add(word)
            token_count = i - start + 1
            ttr = len(current_types) / token_count
            if ttr <= threshold:
                factors += 1.0
                current_types.clear()
                start = i + 1

        remainder = len(toks) - start
        if remainder > 0:
            final_ttr = len(current_types) / remainder
            if final_ttr < 1.0:
                partial_factor = (1.0 - final_ttr) / (1.0 - threshold)
                factors += partial_factor

        if factors == 0.0:
            return float(len(toks))
        return len(toks) / factors

    forward = _pass(tokens)
    backward = _pass(list(reversed(tokens)))
    return round((forward + backward) / 2.0, 2)


def compute_vocabulary_diversity(
    tokens: list[str],
    min_words: int = 10,
    benchmark: float = 50.0,
) -> tuple[float | None, float | None, str | None]:
    """
    Compute normalized Vocabulary Diversity score using MTLD.
    Benchmark MTLD >= 50 maps to 100 points.
    """
    if len(tokens) < min_words:
        return None, None, "TEXT_TOO_SHORT_FOR_MTLD"

    mtld = compute_mtld(tokens)
    score = min(100.0, max(0.0, (mtld / benchmark) * 100.0))
    return round(score, 1), mtld, None


def compute_vocabulary_score(
    diversity: float | None,
    context_relevance: float | None,
) -> tuple[float | None, dict[str, float | None], str | None]:
    """
    Combine Vocabulary Context score per SRS 3.3:
    Vocabulary = 0.40 * Diversity + 0.60 * Context Relevance
    """
    components = {
        "vocabulary_diversity": diversity,
        "context_relevance": context_relevance,
    }
    weights = [
        (diversity, 0.40),
        (context_relevance, 0.60),
    ]
    valid = [(val, w) for val, w in weights if val is not None]
    if not valid:
        return None, components, "INSUFFICIENT_VOCABULARY_DATA"

    total_w = sum(w for _, w in valid)
    weighted_sum = sum((val * (w / total_w)) for val, w in valid)
    return round(weighted_sum, 1), components, None


def compute_response_speed(
    average_latency_seconds: float | None,
    grace_period: float = 2.0,
    penalty_per_sec: float = 12.0,
) -> tuple[float | None, dict[str, float | None], str | None]:
    """
    Compute Response Speed score per SRS 3.3:
    - If T <= 2s: 100
    - If T > 2s: max(0, 100 - 12 * (T - 2))
    - T >= 10.333s -> 0
    """
    if average_latency_seconds is None or average_latency_seconds < 0.0:
        return None, {"average_latency_seconds": None}, "NO_INTERACTIVE_TURNS"

    t = average_latency_seconds
    score = 100.0 if t <= grace_period else max(0.0, 100.0 - penalty_per_sec * (t - grace_period))
    components: dict[str, float | None] = {"average_latency_seconds": round(t, 2)}
    return round(score, 1), components, None


def compute_pronunciation_score(
    confidences: list[float],
) -> tuple[float | None, dict[str, float | None], str | None]:
    """
    Compute Pronunciation Accuracy per SRS 3.3:
    Average STT Confidence * 100. Always isReference = True.
    """
    valid = [c for c in confidences if c is not None and not math.isnan(c)]
    if not valid:
        return None, {"average_confidence": None}, "NO_STT_CONFIDENCE_DATA"

    avg_conf = sum(valid) / len(valid)
    score = min(100.0, max(0.0, avg_conf * 100.0))
    components: dict[str, float | None] = {"average_confidence": round(avg_conf, 3)}
    return round(score, 1), components, None



def compute_overall_score(
    fluency: float | None,
    listening: float | None,
    vocabulary: float | None,
    response_speed: float | None,
    pronunciation: float | None,
) -> tuple[float | None, bool]:
    """
    Compute Overall Communication Score per SRS 3.3 and Decision D-10:
    Weights: Fluency 0.25, Listening 0.20, Vocabulary 0.20, Speed 0.15, Pronunciation 0.20
    - 5 valid: exact weighted sum, partial = False
    - 4 valid (1 N/A): re-weight remaining 4, partial = True
    - <= 3 valid (>= 2 N/A): Overall is None (N/A), partial = False
    """
    weights = [
        (fluency, 0.25),
        (listening, 0.20),
        (vocabulary, 0.20),
        (response_speed, 0.15),
        (pronunciation, 0.20),
    ]
    valid = [(val, w) for val, w in weights if val is not None]

    if len(valid) == 5:
        overall = sum(val * w for val, w in valid)
        return round(overall, 1), False

    if len(valid) == 4:
        total_w = sum(w for _, w in valid)
        overall = sum(val * (w / total_w) for val, w in valid)
        return round(overall, 1), True

    return None, False


def is_session_data_sufficient(
    total_words: int,
    user_turns: int,
    spoken_seconds: float,
    min_words: int = 5,
    min_turns: int = 1,
    min_spoken: float = 5.0,
) -> bool:
    """
    Check if session dialogue satisfies minimum data sufficiency thresholds.
    If not, entire feedback status becomes INSUFFICIENT_DATA.
    """
    return (
        total_words >= min_words
        and user_turns >= min_turns
        and spoken_seconds >= min_spoken
    )


def extract_session_turn_metrics(
    segments: list[Any],
    pause_threshold_ms: int = 1500,
) -> dict[str, Any]:
    """
    Extract turn-based conversational timing and lexical metrics from transcript segments.
    """
    # Filter and sort segments chronologically
    sorted_segs = sorted(segments, key=lambda s: s.start_ms if hasattr(s, "start_ms") else s.get("start_ms", 0))

    user_segments = []
    user_turns: list[list[Any]] = []
    current_turn: list[Any] = []
    current_speaker: str | None = None

    for seg in sorted_segs:
        spk = (seg.speaker if hasattr(seg, "speaker") else seg.get("speaker", "")).upper()
        if spk == current_speaker:
            current_turn.append(seg)
        else:
            if current_turn and current_speaker == "USER":
                user_turns.append(current_turn)
            current_speaker = spk
            current_turn = [seg]


    if current_turn and current_speaker == "USER":
        user_turns.append(current_turn)

    for seg in sorted_segs:
        spk = (seg.speaker if hasattr(seg, "speaker") else seg.get("speaker", "")).upper()
        if spk == "USER":
            user_segments.append(seg)

    # 1. Total words & clean tokens
    all_user_text = " ".join(
        (s.text if hasattr(s, "text") else s.get("text", "")).strip() for s in user_segments
    )
    tokens = clean_and_tokenize(all_user_text)
    total_words = len(tokens)

    # 2. Filler words
    filler_count, found_fillers = detect_filler_words(all_user_text)

    # 3. Spoken seconds & turn span
    spoken_seconds = 0.0
    turn_span_seconds = 0.0
    long_pause_count = 0

    for turn in user_turns:
        if not turn:
            continue
        first_seg = turn[0]
        last_seg = turn[-1]
        t_start = first_seg.start_ms if hasattr(first_seg, "start_ms") else first_seg.get("start_ms", 0)
        t_end = last_seg.end_ms if hasattr(last_seg, "end_ms") else last_seg.get("end_ms", 0)
        span = max(0.0, (t_end - t_start) / 1000.0)
        turn_span_seconds += span

        # Check pauses between consecutive segments within this user turn
        for i in range(len(turn) - 1):
            s1 = turn[i]
            s2 = turn[i + 1]
            e1 = s1.end_ms if hasattr(s1, "end_ms") else s1.get("end_ms", 0)
            st2 = s2.start_ms if hasattr(s2, "start_ms") else s2.get("start_ms", 0)
            gap_ms = st2 - e1
            if gap_ms >= pause_threshold_ms:
                long_pause_count += 1

    for s in user_segments:
        st = s.start_ms if hasattr(s, "start_ms") else s.get("start_ms", 0)
        en = s.end_ms if hasattr(s, "end_ms") else s.get("end_ms", 0)
        if en > st:
            spoken_seconds += (en - st) / 1000.0

    # 4. Interactive Response latencies: time from AI speech end to User speech start
    latencies: list[float] = []
    last_ai_end_ms: int | None = None

    for seg in sorted_segs:
        spk = (seg.speaker if hasattr(seg, "speaker") else seg.get("speaker", "")).upper()
        st = seg.start_ms if hasattr(seg, "start_ms") else seg.get("start_ms", 0)
        en = seg.end_ms if hasattr(seg, "end_ms") else seg.get("end_ms", 0)

        if spk == "AI":
            last_ai_end_ms = en
        elif spk == "USER" and last_ai_end_ms is not None:
            latency = max(0.0, (st - last_ai_end_ms) / 1000.0)
            latencies.append(latency)
            last_ai_end_ms = None  # Consume once per turn


    avg_latency = (sum(latencies) / len(latencies)) if latencies else None

    # 5. Confidences
    confidences = [
        (s.confidence if hasattr(s, "confidence") else s.get("confidence"))
        for s in user_segments
        if (s.confidence if hasattr(s, "confidence") else s.get("confidence")) is not None
    ]

    return {
        "total_words": total_words,
        "tokens": tokens,
        "filler_count": filler_count,
        "found_fillers": found_fillers,
        "user_turns": len(user_turns),
        "spoken_seconds": round(spoken_seconds, 2),
        "turn_span_seconds": round(turn_span_seconds, 2),
        "long_pause_count": long_pause_count,
        "average_latency_seconds": avg_latency,
        "latencies": latencies,
        "confidences": confidences,
        "all_user_text": all_user_text,
    }
