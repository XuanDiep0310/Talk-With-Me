"""Derive session QA and scoring signals while no audio is retained."""

from math import isfinite

from app.core.providers.stt_provider import SttResult
from app.models.session import TranscriptSegment
from app.services.scoring.metrics import clean_and_tokenize, detect_filler_words


def apply_speech_features(
    segment: TranscriptSegment,
    *,
    pause_threshold_ms: int,
    stt: SttResult | None = None,
    capture_offset_ms: int | None = None,
    playback_end_ms: int | None = None,
) -> None:
    segment.word_count = len(clean_and_tokenize(segment.text))
    segment.filler_count, _ = detect_filler_words(segment.text)
    segment.speech_source = "TEXT" if stt is None else "STT_NO_WORD_TIMES"
    confidence = stt.measured_confidence if stt else None
    segment.confidence = (
        confidence
        if confidence is not None and isfinite(confidence) and 0 <= confidence <= 1
        else None
    )
    if stt is None or not stt.word_times_measured:
        return

    ranges = sorted((word.start_ms, word.end_ms) for word in stt.words)
    if (
        not ranges
        or any(start < 0 or end < start for start, end in ranges)
        or not any(end > start for start, end in ranges)
    ):
        return

    start, end = ranges[0]
    spoken = end - start
    long_pause_count = 0
    long_pause_ms = 0
    for next_start, next_end in ranges[1:]:
        gap = next_start - end
        if gap >= pause_threshold_ms:
            long_pause_count += 1
            long_pause_ms += gap
        spoken += max(0, next_end - max(next_start, end))
        end = max(end, next_end)

    segment.speech_source = "STT"
    segment.speech_ms = spoken
    segment.speech_span_ms = end - start
    segment.long_pause_count = long_pause_count
    segment.long_pause_ms = long_pause_ms
    if capture_offset_ms is not None:
        segment.start_ms = capture_offset_ms + start
        segment.end_ms = capture_offset_ms + end
        if playback_end_ms is not None and playback_end_ms <= segment.start_ms:
            segment.response_latency_ms = segment.start_ms - playback_end_ms
