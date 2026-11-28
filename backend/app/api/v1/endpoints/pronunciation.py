"""Endpoints for Scripted / Shadowing syllable-level pronunciation assessment and IPA."""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from app.api.deps import get_current_user, get_speech_provider
from app.core.providers.speech_assessment_provider import SpeechAssessmentProvider
from app.core.speech.ipa import text_to_ipa
from app.core.speech.syllable_mapper import build_pronunciation_breakdown
from app.models.auth import User
from app.models.pronunciation_schemas import (
    IpaResponse,
    PhonemeScoreSchema,
    PronunciationAssessResponse,
    SyllableScoreSchema,
    WordPronunciationSchema,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pronunciation", tags=["Pronunciation"])

_MAX_AUDIO_BYTES = 5 * 1024 * 1024
_PASS_THRESHOLD = 60.0


@router.get(
    "/ipa",
    response_model=IpaResponse,
    status_code=status.HTTP_200_OK,
    summary="Convert English text to IPA phonetic transcription",
)
async def get_ipa(
    text: str = Query(..., min_length=1, max_length=500),
    current_user: User = Depends(get_current_user),  # noqa: ARG001
) -> IpaResponse:
    return IpaResponse(text=text, ipa=text_to_ipa(text))


@router.post(
    "/assess",
    response_model=PronunciationAssessResponse,
    status_code=status.HTTP_200_OK,
    summary="Assess scripted/shadowing pronunciation at syllable and phoneme granularity",
)
async def assess_pronunciation(
    audio: UploadFile = File(...),
    reference_text: str = Form(..., min_length=1, max_length=500),
    mode: Literal["scripted", "shadowing"] = Form("scripted"),
    current_user: User = Depends(get_current_user),  # noqa: ARG001
    speech_provider: SpeechAssessmentProvider = Depends(get_speech_provider),
) -> PronunciationAssessResponse:
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMPTY_AUDIO", "message": "Không nhận được dữ liệu âm thanh."},
        )
    if len(audio_bytes) > _MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail={"code": "AUDIO_TOO_LARGE", "message": "Tệp âm thanh vượt quá giới hạn 5MB."},
        )

    result = await speech_provider.assess(
        audio_bytes,
        reference_text=reference_text.strip(),
        mime_type=audio.content_type or "audio/wav",
    )
    words, display_score, tip = build_pronunciation_breakdown(reference_text, result)

    return PronunciationAssessResponse(
        transcript=result.transcript,
        reference_text=reference_text.strip(),
        mode=mode,
        provider=result.provider,
        display_score=display_score,
        accuracy_score=result.accuracy_score,
        fluency_score=result.fluency_score,
        prosody_score=result.prosody_score,
        completeness_score=result.completeness_score,
        ipa=text_to_ipa(reference_text),
        words=[
            WordPronunciationSchema(
                word=w.word,
                accuracy_score=w.accuracy_score,
                error_type=w.error_type,
                ipa=w.ipa,
                status=w.status,
                syllables=[
                    SyllableScoreSchema(
                        text=s.text,
                        accuracy_score=s.accuracy_score,
                        status=s.status,
                    )
                    for s in w.syllables
                ],
                phonemes=[
                    PhonemeScoreSchema(
                        ipa=p.ipa,
                        accuracy_score=p.accuracy_score,
                        heard_as=p.heard_as,
                    )
                    for p in w.phonemes
                ],
            )
            for w in words
        ],
        coaching_tip_vi=tip,
        passed=(display_score is not None and display_score >= _PASS_THRESHOLD),
    )
