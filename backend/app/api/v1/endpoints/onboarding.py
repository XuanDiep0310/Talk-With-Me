"""Onboarding & Two-Stage Placement endpoints."""

from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.deps import get_current_user, get_onboarding_service, get_placement_service
from app.models.auth import User
from app.models.onboarding import PlacementAnswer
from app.models.onboarding_schemas import (
    AnswerResponse,
    LevelResponse,
    OnboardingCompleteResponse,
    OnboardingOptionsResponse,
    OptionItemSchema,
    PlacementCompleteResponse,
    PlacementTestResponse,
    PreferencesResponse,
    ScriptedPlacementPromptSchema,
    SetLevelRequest,
    SubmitAnswerRequest,
    TieredQuestionSchema,
    UpdatePreferencesRequest,
)
from app.seeds.onboarding_catalog import (
    CEFR_LEVELS,
    GOALS,
    INTERESTS,
    PLACEMENT_QUESTIONS,
    SCRIPTED_PLACEMENT_PROMPTS,
    TIERED_PLACEMENT_QUESTIONS,
    WEAK_POINTS,
)
from app.services.onboarding import OnboardingService, PlacementService

router = APIRouter(tags=["Onboarding"])


@router.get(
    "/onboarding/options",
    response_model=OnboardingOptionsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get onboarding selection catalog",
)
async def get_onboarding_options() -> OnboardingOptionsResponse:
    return OnboardingOptionsResponse(
        interests=[OptionItemSchema(key=i["key"], label=i["label"]) for i in INTERESTS],
        goals=[OptionItemSchema(key=g["key"], label=g["label"]) for g in GOALS],
        weak_points=[OptionItemSchema(key=w["key"], label=w["label"]) for w in WEAK_POINTS],
        cefr_levels=CEFR_LEVELS,
        placement_questions=PLACEMENT_QUESTIONS,
        scripted_prompts=[ScriptedPlacementPromptSchema(**p) for p in SCRIPTED_PLACEMENT_PROMPTS],
        tiered_questions=[
            TieredQuestionSchema(
                id=q["id"],
                tier=q["tier"],
                tier_label=q["tier_label"],
                text=q["text"],
                translation=q["translation"],
            )
            for q in TIERED_PLACEMENT_QUESTIONS
        ],
    )


@router.put(
    "/me/preferences",
    response_model=PreferencesResponse,
    status_code=status.HTTP_200_OK,
    summary="Save onboarding preferences",
)
async def update_preferences(
    body: UpdatePreferencesRequest,
    current_user: User = Depends(get_current_user),
    onboarding_service: OnboardingService = Depends(get_onboarding_service),
) -> PreferencesResponse:
    await onboarding_service.save_preferences(
        user_id=current_user.id,
        interests=body.interests,
        goals=body.goals,
        weak_points=body.weak_points,
    )
    return PreferencesResponse(
        interests=body.interests,
        goals=body.goals,
        weak_points=body.weak_points,
    )


@router.post(
    "/placement-tests",
    response_model=PlacementTestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new two-stage placement test",
)
async def create_placement_test(
    current_user: User = Depends(get_current_user),
    placement_service: PlacementService = Depends(get_placement_service),
) -> PlacementTestResponse:
    test = await placement_service.create_test(user_id=current_user.id)
    first_q = placement_service.get_initial_question()
    return PlacementTestResponse(
        id=test.id,
        user_id=test.user_id,
        status=test.status,
        current_stage=test.current_stage,
        questions=placement_service.get_questions(),
        scripted_prompts=[
            ScriptedPlacementPromptSchema(**p) for p in placement_service.get_scripted_prompts()
        ],
        created_at=test.created_at,
        initial_tier=first_q["tier"],
        initial_tier_label=first_q["tier_label"],
        initial_question=first_q["text"],
        initial_question_translation=first_q["translation"],
    )


@router.post(
    "/placement-tests/{test_id}/answers",
    response_model=AnswerResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit a placement test answer (JSON metadata)",
)
async def submit_placement_answer(
    test_id: uuid.UUID,
    body: SubmitAnswerRequest,
    current_user: User = Depends(get_current_user),
    placement_service: PlacementService = Depends(get_placement_service),
) -> AnswerResponse:
    answer, meta = await placement_service.submit_answer(
        test_id=test_id,
        user_id=current_user.id,
        request_id=body.request_id,
        question_index=body.question_index,
        transcript=body.transcript,
        stt_confidence=body.stt_confidence,
        speaking_duration_seconds=body.speaking_duration_seconds,
        response_latency_seconds=body.response_latency_seconds,
        stage=body.stage,
        prompt_id=body.prompt_id,
        accuracy_score=body.accuracy_score,
        fluency_score=body.fluency_score,
        prosody_score=body.prosody_score,
        completeness_score=body.completeness_score,
    )
    return _to_answer_response(answer, meta)


@router.post(
    "/placement-tests/{test_id}/audio-answers",
    response_model=AnswerResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit Stage 1 (Scripted) or Stage 2 (Unscripted) audio answer via Azure Speech",
)
async def submit_placement_audio_answer(
    test_id: uuid.UUID,
    audio: UploadFile = File(...),
    request_id: str = Form(..., min_length=1, max_length=36),
    stage: int = Form(..., ge=1, le=2),
    question_index: int = Form(..., ge=0),
    prompt_id: str | None = Form(None),
    response_latency_seconds: float | None = Form(None, ge=0.0),
    current_user: User = Depends(get_current_user),
    placement_service: PlacementService = Depends(get_placement_service),
) -> AnswerResponse:
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMPTY_AUDIO", "message": "Không nhận được dữ liệu âm thanh."},
        )
    answer, meta = await placement_service.submit_audio_answer(
        test_id=test_id,
        user_id=current_user.id,
        request_id=request_id,
        stage=stage,
        question_index=question_index,
        audio_bytes=audio_bytes,
        mime_type=audio.content_type or "audio/wav",
        prompt_id=prompt_id,
        response_latency_seconds=response_latency_seconds,
    )
    return _to_answer_response(answer, meta)


@router.post(
    "/placement-tests/{test_id}/complete",
    response_model=PlacementCompleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Complete two-stage placement test and initialize learner CEFR profile",
)
async def complete_placement_test(
    test_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    placement_service: PlacementService = Depends(get_placement_service),
) -> PlacementCompleteResponse:
    _test, estimate = await placement_service.complete_test(
        test_id=test_id,
        user_id=current_user.id,
    )
    cefr_est = estimate.cefr_estimation
    return PlacementCompleteResponse(
        test_id=test_id,
        estimated_level=estimate.level,
        is_insufficient_data=estimate.is_insufficient_data,
        needs_reassessment=estimate.needs_reassessment,
        score=round(estimate.score, 4),
        continuous_band=estimate.continuous_band,
        dimension_scores=estimate.dimension_scores,
        limiting_dimensions=cefr_est.limiting_dimensions if cefr_est else [],
        explanation_vi=cefr_est.explanation_vi if cefr_est else "",
    )


@router.put(
    "/me/level",
    response_model=LevelResponse,
    status_code=status.HTTP_200_OK,
    summary="Self-assign CEFR level",
)
async def set_level(
    body: SetLevelRequest,
    current_user: User = Depends(get_current_user),
    onboarding_service: OnboardingService = Depends(get_onboarding_service),
) -> LevelResponse:
    profile = await onboarding_service.set_level_self(
        user_id=current_user.id,
        level=body.level,
    )
    return LevelResponse(
        cefr_level=profile.cefr_level or body.level,
        level_source=profile.level_source or body.source,
        needs_reassessment=profile.needs_reassessment,
    )


@router.post(
    "/me/onboarding/complete",
    response_model=OnboardingCompleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark onboarding as complete",
)
async def complete_onboarding(
    current_user: User = Depends(get_current_user),
    onboarding_service: OnboardingService = Depends(get_onboarding_service),
) -> OnboardingCompleteResponse:
    profile = await onboarding_service.complete_onboarding(user_id=current_user.id)
    assert profile.onboarding_completed_at is not None
    return OnboardingCompleteResponse(
        onboarding_completed_at=profile.onboarding_completed_at,
        cefr_level=profile.cefr_level or "A1",
        level_source=profile.level_source or "DEFAULT",
        needs_reassessment=profile.needs_reassessment,
        interests=json.loads(profile.interests or "[]"),
        goals=json.loads(profile.goals or "[]"),
        weak_points=json.loads(profile.weak_points or "[]"),
    )


def _to_answer_response(answer: PlacementAnswer, meta: dict[str, Any]) -> AnswerResponse:
    return AnswerResponse(
        id=answer.id,
        test_id=answer.test_id,
        request_id=answer.request_id,
        stage=answer.stage,
        prompt_id=answer.prompt_id,
        question_index=answer.question_index,
        transcript=answer.transcript,
        word_count=answer.word_count,
        created_at=answer.created_at,
        current_tier=int(meta["current_tier"]),
        current_tier_label=str(meta["current_tier_label"]),
        next_question=meta.get("next_question"),
        next_question_index=meta.get("next_question_index"),
        next_tier=meta.get("next_tier"),
        next_tier_label=meta.get("next_tier_label"),
        next_question_translation=meta.get("next_question_translation"),
        is_converged=bool(meta["is_converged"]),
        can_finish_early=bool(meta["can_finish_early"]),
        total_answered=int(meta["total_answered"]),
        current_estimated_level=str(meta["current_estimated_level"]),
        pronunciation=meta.get("pronunciation"),
        next_stage=int(meta.get("next_stage", 2)),
        stage1_completed=bool(meta.get("stage1_completed", False)),
    )
