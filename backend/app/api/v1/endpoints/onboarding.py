"""
Onboarding endpoints:
  GET  /onboarding/options                  — catalog of selectable options
  PUT  /me/preferences                      — save interests/goals/weak_points
  POST /placement-tests                     — create a new placement test
  POST /placement-tests/{id}/answers        — submit one answer (idempotent)
  POST /placement-tests/{id}/complete       — finalize test and get level estimate
  PUT  /me/level                            — self-assign level
  POST /me/onboarding/complete              — mark onboarding done

No business logic here — delegate to OnboardingService / PlacementService.
"""

import json
import uuid

from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user, get_onboarding_service, get_placement_service
from app.models.auth import User
from app.models.onboarding_schemas import (
    AnswerResponse,
    LevelResponse,
    OnboardingCompleteResponse,
    OnboardingOptionsResponse,
    OptionItemSchema,
    PlacementCompleteResponse,
    PlacementTestResponse,
    PreferencesResponse,
    SetLevelRequest,
    SubmitAnswerRequest,
    UpdatePreferencesRequest,
)
from app.seeds.onboarding_catalog import (
    CEFR_LEVELS,
    GOALS,
    INTERESTS,
    PLACEMENT_QUESTIONS,
    WEAK_POINTS,
)
from app.services.onboarding import OnboardingService, PlacementService

router = APIRouter(tags=["Onboarding"])


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------


@router.get(
    "/onboarding/options",
    response_model=OnboardingOptionsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get onboarding selection catalog",
    description="Returns lists of selectable interests, goals, and skills for onboarding step.",
)
async def get_onboarding_options() -> OnboardingOptionsResponse:
    return OnboardingOptionsResponse(
        interests=[OptionItemSchema(key=i["key"], label=i["label"]) for i in INTERESTS],
        goals=[OptionItemSchema(key=g["key"], label=g["label"]) for g in GOALS],
        weak_points=[OptionItemSchema(key=w["key"], label=w["label"]) for w in WEAK_POINTS],
        cefr_levels=CEFR_LEVELS,
        placement_questions=PLACEMENT_QUESTIONS,
    )


# ---------------------------------------------------------------------------
# Preferences
# ---------------------------------------------------------------------------


@router.put(
    "/me/preferences",
    response_model=PreferencesResponse,
    status_code=status.HTTP_200_OK,
    summary="Save onboarding preferences",
    description="Save user's selected interests, learning goals, and skills to improve. "
    "Requires at least 1 of each. All values must be valid keys from GET /onboarding/options.",
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


# ---------------------------------------------------------------------------
# Placement Test
# ---------------------------------------------------------------------------


@router.post(
    "/placement-tests",
    response_model=PlacementTestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new placement test",
    description="Initializes a new placement test session. Returns the test ID and question list.",
)
async def create_placement_test(
    current_user: User = Depends(get_current_user),
    placement_service: PlacementService = Depends(get_placement_service),
) -> PlacementTestResponse:
    test = await placement_service.create_test(user_id=current_user.id)
    return PlacementTestResponse(
        id=test.id,
        user_id=test.user_id,
        status=test.status,
        questions=placement_service.get_questions(),
        created_at=test.created_at,
    )


@router.post(
    "/placement-tests/{test_id}/answers",
    response_model=AnswerResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit a placement test answer",
    description="Submit one voice answer for the placement test. "
    "Idempotent: re-sending the same request_id returns the existing answer without creating a duplicate.",
)
async def submit_placement_answer(
    test_id: uuid.UUID,
    body: SubmitAnswerRequest,
    current_user: User = Depends(get_current_user),
    placement_service: PlacementService = Depends(get_placement_service),
) -> AnswerResponse:
    answer = await placement_service.submit_answer(
        test_id=test_id,
        user_id=current_user.id,
        request_id=body.request_id,
        question_index=body.question_index,
        transcript=body.transcript,
        stt_confidence=body.stt_confidence,
        speaking_duration_seconds=body.speaking_duration_seconds,
        response_latency_seconds=body.response_latency_seconds,
    )
    return AnswerResponse(
        id=answer.id,
        test_id=answer.test_id,
        request_id=answer.request_id,
        question_index=answer.question_index,
        transcript=answer.transcript,
        word_count=answer.word_count,
        created_at=answer.created_at,
    )


@router.post(
    "/placement-tests/{test_id}/complete",
    response_model=PlacementCompleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Complete placement test and get level estimate",
    description="Finalizes the placement test, runs the level estimation algorithm, "
    "and saves the resulting CEFR level to the user's profile.",
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
    return PlacementCompleteResponse(
        test_id=test_id,
        estimated_level=estimate.level,
        is_insufficient_data=estimate.is_insufficient_data,
        needs_reassessment=estimate.needs_reassessment,
        score=round(estimate.score, 4),
    )


# ---------------------------------------------------------------------------
# Level assignment
# ---------------------------------------------------------------------------


@router.put(
    "/me/level",
    response_model=LevelResponse,
    status_code=status.HTTP_200_OK,
    summary="Self-assign CEFR level",
    description="Allows user to manually set their own CEFR level "
    "(e.g. when skipping placement test). Source must be 'SELF'.",
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


# ---------------------------------------------------------------------------
# Onboarding completion
# ---------------------------------------------------------------------------


@router.post(
    "/me/onboarding/complete",
    response_model=OnboardingCompleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark onboarding as complete",
    description="Finishes the onboarding flow. Requires level and preferences to be set. "
    "Idempotent: calling twice returns the same completed_at timestamp.",
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
