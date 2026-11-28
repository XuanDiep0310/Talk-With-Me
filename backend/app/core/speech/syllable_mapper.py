"""Align Azure Speech syllable & phoneme scores with display words for UI rendering."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.providers.speech_assessment_provider import (
    AssessedWord,
    SpeechAssessmentResult,
)
from app.core.speech.ipa import word_to_ipa


@dataclass(slots=True)
class SyllableDetail:
    text: str
    accuracy_score: float
    status: str  # good | fair | poor


@dataclass(slots=True)
class PhonemeDetail:
    ipa: str
    accuracy_score: float
    heard_as: str | None = None


@dataclass(slots=True)
class WordDetail:
    word: str
    accuracy_score: float
    error_type: str
    ipa: str
    status: str  # good | fair | poor
    syllables: list[SyllableDetail]
    phonemes: list[PhonemeDetail]


def score_to_status(score: float, error_type: str = "None") -> str:
    if error_type == "Omission" or score < 50.0:
        return "poor"
    if score < 80.0:
        return "fair"
    return "good"


def _normalize_token(word: str) -> str:
    return re.sub(r"[^a-z0-9']", "", word.lower())


def _split_syllables_fallback(clean_word: str) -> list[str]:
    """Fallback orthographic syllable splitter when Azure omits syllable segments."""
    chunks = re.findall(r"[^aeiouy]*[aeiouy]+(?:[^aeiouy](?![aeiouy]))*", clean_word, re.I)
    if not chunks:
        return [clean_word]
    joined = "".join(chunks)
    if len(joined) < len(clean_word):
        chunks[-1] += clean_word[len(joined) :]
    return chunks


def _reconcile_syllables(display_word: str, assessed: AssessedWord | None) -> list[SyllableDetail]:
    clean = re.sub(r"^[^\w']+|[^\w']+$", "", display_word)
    if not clean:
        return [SyllableDetail(text=display_word, accuracy_score=100.0, status="good")]

    if assessed and assessed.syllables:
        joined = "".join(s.text for s in assessed.syllables)
        if joined.lower() == clean.lower():
            # Preserve exact casing of original word
            out: list[SyllableDetail] = []
            cursor = 0
            for syl in assessed.syllables:
                seg = clean[cursor : cursor + len(syl.text)]
                cursor += len(syl.text)
                out.append(
                    SyllableDetail(
                        text=seg or syl.text,
                        accuracy_score=syl.accuracy_score,
                        status=score_to_status(syl.accuracy_score, assessed.error_type),
                    )
                )
            return out

    w_score = assessed.accuracy_score if assessed else 0.0
    err_type = assessed.error_type if assessed else "Omission"
    if assessed and assessed.phonemes and len(assessed.phonemes) > 1:
        parts = _split_syllables_fallback(clean)
        if len(parts) > 1:
            step = max(1, len(assessed.phonemes) // len(parts))
            syllables_out: list[SyllableDetail] = []
            for idx, part in enumerate(parts):
                ph_slice = (
                    assessed.phonemes[idx * step : (idx + 1) * step] or assessed.phonemes[-1:]
                )
                avg_sc = round(sum(p.accuracy_score for p in ph_slice) / len(ph_slice), 1)
                syllables_out.append(
                    SyllableDetail(
                        text=part, accuracy_score=avg_sc, status=score_to_status(avg_sc, err_type)
                    )
                )
            return syllables_out

    return [
        SyllableDetail(
            text=clean,
            accuracy_score=round(w_score, 1),
            status=score_to_status(w_score, err_type),
        )
    ]


def _generate_coaching_tip(words: list[WordDetail]) -> str:
    lowest_ph: tuple[float, str, str] | None = None
    for w in words:
        for ph in w.phonemes:
            if lowest_ph is None or ph.accuracy_score < lowest_ph[0]:
                lowest_ph = (ph.accuracy_score, ph.ipa, w.word)

    if lowest_ph is None or lowest_ph[0] >= 80.0:
        return "Phát âm rõ ràng và tự nhiên! Hãy giữ nhịp điệu ổn định như vậy."

    _, ipa, word = lowest_ph
    if any(sym in ipa for sym in ("θ", "ð")):
        return f"Lưu ý từ '{word}': đặt nhẹ đầu lưỡi giữa hai răng cho âm /{ipa}/."
    if any(sym in ipa for sym in ("ɜ", "r", "ɹ")):
        return f"Lưu ý từ '{word}': cuộn nhẹ đầu lưỡi vào trong khi phát âm /{ipa}/."
    if any(sym in ipa for sym in ("ʃ", "ʒ", "tʃ", "dʒ")):
        return f"Lưu ý từ '{word}': tròn môi nhẹ khi phát âm /{ipa}/ để âm rõ nét hơn."
    if any(sym in ipa for sym in ("t", "d", "k", "p", "s", "z")):
        return f"Lưu ý từ '{word}': bật rõ phụ âm /{ipa}/ (đặc biệt ở cuối từ)."
    return f"Hãy nghe chậm lại từ '{word}' và nhấn rõ âm /{ipa}/ rồi thử lại nhé."


def build_pronunciation_breakdown(
    reference_text: str,
    result: SpeechAssessmentResult,
) -> tuple[list[WordDetail], float | None, str]:
    """Map Azure assessment result onto display words, returning (words, display_score, tip_vi)."""
    assessed_words = list(result.words)
    display_tokens = (
        [t for t in reference_text.strip().split() if t]
        if reference_text.strip()
        else [w.word for w in assessed_words]
    )

    used_indices: set[int] = set()
    aligned: list[WordDetail] = []

    for tok in display_tokens:
        norm_tok = _normalize_token(tok)
        matched: AssessedWord | None = None
        for idx, candidate in enumerate(assessed_words):
            if idx not in used_indices and _normalize_token(candidate.word) == norm_tok:
                matched = candidate
                used_indices.add(idx)
                break

        w_acc = matched.accuracy_score if matched else 0.0
        err_type = (
            matched.error_type if matched else ("Omission" if reference_text.strip() else "None")
        )
        phonemes: list[PhonemeDetail] = []
        if matched:
            for ph in matched.phonemes:
                heard = (
                    ph.nbest_phonemes[0][0]
                    if ph.nbest_phonemes and ph.nbest_phonemes[0][0] != ph.ipa
                    else None
                )
                phonemes.append(
                    PhonemeDetail(ipa=ph.ipa, accuracy_score=ph.accuracy_score, heard_as=heard)
                )

        aligned.append(
            WordDetail(
                word=tok,
                accuracy_score=round(w_acc, 1),
                error_type=err_type,
                ipa=word_to_ipa(tok) or tok.lower(),
                status=score_to_status(w_acc, err_type),
                syllables=_reconcile_syllables(tok, matched),
                phonemes=phonemes,
            )
        )

    # Display score for scripted pronunciation: Accuracy (0.70) + Prosody (0.30), never PronScore
    if result.accuracy_score is not None and result.prosody_score is not None:
        display_score: float | None = round(
            0.70 * result.accuracy_score + 0.30 * result.prosody_score, 1
        )
    elif result.accuracy_score is not None:
        display_score = round(result.accuracy_score, 1)
    else:
        display_score = None

    return aligned, display_score, _generate_coaching_tip(aligned)
