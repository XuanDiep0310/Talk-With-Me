"""
ScenarioService: Business logic for Scenario Lessons, Chunks, Drills, Roleplays, and Evaluations.
Adheres to Communication-First philosophy, Rule D-03, Rule D-10, and DoD.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import get_clock
from app.core.config import get_settings
from app.core.events import RoleplayEvaluated, event_bus
from app.core.providers.llm_provider import get_llm_provider
from app.core.providers.tts_provider import get_tts_provider
from app.core.ws_manager import session_ws_manager
from app.models.coach_schemas import (
    AddTranscriptSegmentRequest,
    EndSessionResponse,
    TranscriptSegmentResponse,
)
from app.models.scenario import (
    RoleplayEvaluation,
    Scenario,
)
from app.models.scenario_schemas import (
    ChunkBankItemSchema,
    ChunkBankResponse,
    ChunkToImproveItem,
    ChunkUsedWellItem,
    RecordDrillRequest,
    RecordDrillResponse,
    RequirementEvaluationItem,
    RoleplayEvaluationResponse,
    RoleplaySessionResponse,
    ScenarioCategorySummary,
    ScenarioChunkSchema,
    ScenarioChunksResponse,
    ScenarioDetailResponse,
    ScenarioLibraryResponse,
    ScenarioRequirementSchema,
    ScenarioSummarySchema,
)
from app.models.session import Session, TranscriptSegment
from app.repositories.scenario import ScenarioRepository
from app.repositories.session import SessionRepository, TranscriptRepository
from app.repositories.user import UserRepository
from app.seeds.scenario_loader import seed_scenarios
from app.services.chunk_matcher import ChunkMatcher
from app.services.scoring.service import ScoringService
from app.services.session_state_machine import SessionState, SessionStateMachine

logger = logging.getLogger(__name__)

CATEGORY_NAMES_VI = {
    "DAILY_LIFE": "Đời sống hằng ngày",
    "SOCIAL": "Giao tiếp xã hội",
    "TRAVEL_SHOPPING": "Du lịch & Mua sắm",
    "WORKPLACE": "Nơi làm việc",
}


class ScenarioService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.scenario_repo = ScenarioRepository(db)
        self.session_repo = SessionRepository(db)
        self.transcript_repo = TranscriptRepository(db)
        self.user_repo = UserRepository(db)
        self.settings = get_settings()
        self.clock = get_clock()
        self.chunk_matcher = ChunkMatcher()

    async def ensure_scenarios_seeded(self) -> None:
        """Seed scenarios from YAML files if table is empty."""
        scenarios = await self.scenario_repo.list_scenarios()
        if not scenarios:
            await seed_scenarios(self.db)

    async def list_scenarios(
        self,
        user_id: uuid.UUID,
        category: str | None = None,
        level: str | None = None,
        status_filter: str | None = None,
        q: str | None = None,
    ) -> ScenarioLibraryResponse:
        await self.ensure_scenarios_seeded()

        all_scenarios = await self.scenario_repo.list_scenarios(category=category, level=level, q=q)
        user_progress_list = await self.scenario_repo.list_user_progress(user_id)
        progress_map = {p.scenario_id: p for p in user_progress_list}

        scenario_items: list[ScenarioSummarySchema] = []
        for s in all_scenarios:
            prog = progress_map.get(s.id)
            current_status = prog.status if prog else "NOT_STARTED"
            highest_score = prog.highest_score if prog else None

            if status_filter and current_status.upper() != status_filter.upper():
                continue

            scenario_items.append(
                ScenarioSummarySchema(
                    id=s.id,
                    slug=s.slug,
                    category=s.category,
                    title_vi=s.title_vi,
                    title_en=s.title_en,
                    level=s.level,
                    estimated_duration_minutes=s.estimated_duration_minutes,
                    user_role=s.user_role,
                    ai_role=s.ai_role,
                    goals=s.goals or [],
                    sort_order=s.sort_order,
                    status=current_status,
                    highest_score=highest_score,
                    xp_reward=100,
                    chunks_count=len(s.chunks),
                )
            )

        # Overall completion statistics across all scenarios in library
        full_catalog = await self.scenario_repo.list_scenarios()
        total_count = len(full_catalog)
        completed_count = sum(1 for p in user_progress_list if p.status == "COMPLETED")
        total_progress_pct = (
            round((completed_count / max(1, total_count)) * 100) if total_count > 0 else 0
        )

        # Categorized counts
        category_summaries: list[ScenarioCategorySummary] = []
        for cat_code, cat_name in CATEGORY_NAMES_VI.items():
            cat_total = sum(1 for s in full_catalog if s.category == cat_code)
            cat_completed = sum(
                1
                for s in full_catalog
                if s.category == cat_code
                and progress_map.get(s.id)
                and progress_map[s.id].status == "COMPLETED"
            )
            category_summaries.append(
                ScenarioCategorySummary(
                    category=cat_code,
                    name_vi=cat_name,
                    total_count=cat_total,
                    completed_count=cat_completed,
                )
            )

        return ScenarioLibraryResponse(
            scenarios=scenario_items,
            total_count=total_count,
            completed_count=completed_count,
            total_progress_pct=total_progress_pct,
            categories=category_summaries,
            xp_reward=100,
        )

    async def get_scenario_detail(
        self, scenario_identifier: str | uuid.UUID, user_id: uuid.UUID
    ) -> ScenarioDetailResponse:
        await self.ensure_scenarios_seeded()

        scenario: Scenario | None = None
        if isinstance(scenario_identifier, uuid.UUID):
            scenario = await self.scenario_repo.get_by_id(scenario_identifier)
        else:
            try:
                parsed_uuid = uuid.UUID(scenario_identifier)
                scenario = await self.scenario_repo.get_by_id(parsed_uuid)
            except ValueError:
                scenario = await self.scenario_repo.get_by_slug(scenario_identifier)

        if not scenario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scenario '{scenario_identifier}' not found",
            )

        progress = await self.scenario_repo.get_user_progress(user_id, scenario.id)
        current_status = progress.status if progress else "NOT_STARTED"
        highest_score = progress.highest_score if progress else None
        practiced = progress.practiced_chunks if progress else []

        # Populate audio_url if available via provider
        tts_provider = get_tts_provider()
        chunks_schemas: list[ScenarioChunkSchema] = []
        for c in scenario.chunks:
            audio_url = c.audio_url
            if not audio_url:
                audio_url = await tts_provider.get_audio_url_or_none(c.text)
            chunks_schemas.append(
                ScenarioChunkSchema(
                    id=c.id,
                    scenario_id=c.scenario_id,
                    function_tag=c.function_tag,
                    text=c.text,
                    meaning_vi=c.meaning_vi,
                    audio_url=audio_url,
                    example_sentence=c.example_sentence,
                    accepted_variations=c.accepted_variations or [],
                    sort_order=c.sort_order,
                )
            )

        req_schemas = [
            ScenarioRequirementSchema(
                id=r.id,
                description=r.description,
                type=r.type,
                expected_chunk_function=r.expected_chunk_function,
                is_mandatory=r.is_mandatory,
                sort_order=r.sort_order,
            )
            for r in scenario.requirements
        ]

        return ScenarioDetailResponse(
            id=scenario.id,
            slug=scenario.slug,
            category=scenario.category,
            title_vi=scenario.title_vi,
            title_en=scenario.title_en,
            level=scenario.level,
            estimated_duration_minutes=scenario.estimated_duration_minutes,
            context=scenario.context,
            user_role=scenario.user_role,
            ai_role=scenario.ai_role,
            goals=scenario.goals or [],
            sort_order=scenario.sort_order,
            status=current_status,
            highest_score=highest_score,
            xp_reward=100,
            requirements=req_schemas,
            chunks=chunks_schemas,
            practiced_chunks=practiced,
        )

    async def get_scenario_chunks(self, scenario_id: uuid.UUID) -> ScenarioChunksResponse:
        scenario = await self.scenario_repo.get_by_id(scenario_id)
        if not scenario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scenario {scenario_id} not found",
            )

        tts_provider = get_tts_provider()
        chunk_items: list[ScenarioChunkSchema] = []
        for c in scenario.chunks:
            audio_url = c.audio_url or await tts_provider.get_audio_url_or_none(c.text)
            chunk_items.append(
                ScenarioChunkSchema(
                    id=c.id,
                    scenario_id=c.scenario_id,
                    function_tag=c.function_tag,
                    text=c.text,
                    meaning_vi=c.meaning_vi,
                    audio_url=audio_url,
                    example_sentence=c.example_sentence,
                    accepted_variations=c.accepted_variations or [],
                    sort_order=c.sort_order,
                )
            )

        return ScenarioChunksResponse(
            scenario_id=scenario.id,
            scenario_title=scenario.title_vi,
            chunks=chunk_items,
        )

    async def record_drill(
        self,
        scenario_id: uuid.UUID,
        user_id: uuid.UUID,
        data: RecordDrillRequest,
    ) -> RecordDrillResponse:
        chunk = await self.scenario_repo.get_chunk_by_id(data.chunk_id)
        if not chunk or chunk.scenario_id != scenario_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chunk not found for this scenario",
            )

        attempt = await self.scenario_repo.record_drill_attempt(
            user_id=user_id,
            scenario_id=scenario_id,
            chunk_id=data.chunk_id,
            is_skipped=data.is_skipped,
        )

        progress = await self.scenario_repo.upsert_user_progress(
            user_id=user_id,
            scenario_id=scenario_id,
            status="IN_PROGRESS",
            practiced_chunk_id=str(data.chunk_id),
            last_attempt_at=self.clock.now(),
        )

        return RecordDrillResponse(
            attempt_id=attempt.id,
            chunk_id=data.chunk_id,
            scenario_id=scenario_id,
            is_skipped=data.is_skipped,
            practiced_chunks=progress.practiced_chunks,
            message="Drill recorded successfully",
        )

    async def create_roleplay_session(
        self, scenario_id: uuid.UUID, user_id: uuid.UUID
    ) -> RoleplaySessionResponse:
        scenario = await self.scenario_repo.get_by_id(scenario_id)
        if not scenario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scenario {scenario_id} not found",
            )

        user = await self.user_repo.get_by_id(user_id)
        user_level = user.profile.cefr_level if user and user.profile else scenario.level

        # Create session in CREATED state
        session_id = uuid.uuid4()
        now = self.clock.now()
        session = Session(
            id=session_id,
            type="ROLEPLAY",
            user_id=user_id,
            scenario_id=scenario.id,
            level=user_level,
            status=SessionState.CREATED.value,
            started_at=now,
            duration_seconds=0.0,
            spoken_seconds=0.0,
        )
        await self.session_repo.create(session)

        # Generate in-character opening greeting from AI role
        opening_text = (
            f"Hello! I am the {scenario.ai_role}. Welcome to our conversation for '{scenario.title_en}'. "
            f"How can I help you today?"
        )
        if scenario.slug == "restaurant-reservation":
            opening_text = (
                "Good evening! Welcome to The Garden Restaurant. How can I help you tonight?"
            )
        elif scenario.slug == "supermarket-shopping":
            opening_text = (
                "Hello! Welcome to our store. Are you looking for anything specific today?"
            )
        elif scenario.slug == "hotel-check-in":
            opening_text = "Good afternoon, welcome to the Grand Hotel. Are you checking in today?"
        elif scenario.slug == "doctor-visit":
            opening_text = "Good morning. Please have a seat. What brings you in to see me today?"
        elif scenario.slug == "job-interview":
            opening_text = f"Good morning! Thank you for coming in today for the {scenario.title_en} interview. To begin, could you tell me a little about yourself?"

        opening_segment = TranscriptSegment(
            pk=uuid.uuid4(),
            id=str(uuid.uuid4()),
            session_id=session_id,
            speaker="AI",
            user_id=None,
            text=opening_text,
            start_ms=0,
            end_ms=2500,
            confidence=1.0,
            is_final=True,
            seq=1,
        )
        await self.transcript_repo.add_segment(opening_segment)

        # Mark user progress as IN_PROGRESS
        await self.scenario_repo.upsert_user_progress(
            user_id=user_id,
            scenario_id=scenario_id,
            status="IN_PROGRESS",
            last_attempt_at=now,
        )

        tts_provider = get_tts_provider()
        chunk_items = [
            ScenarioChunkSchema(
                id=c.id,
                scenario_id=c.scenario_id,
                function_tag=c.function_tag,
                text=c.text,
                meaning_vi=c.meaning_vi,
                audio_url=c.audio_url or await tts_provider.get_audio_url_or_none(c.text),
                example_sentence=c.example_sentence,
                accepted_variations=c.accepted_variations or [],
                sort_order=c.sort_order,
            )
            for c in scenario.chunks
        ]

        return RoleplaySessionResponse(
            session_id=session_id,
            scenario_id=scenario.id,
            scenario_title=scenario.title_vi,
            status=SessionState.CREATED.value,
            user_role=scenario.user_role,
            ai_role=scenario.ai_role,
            context=scenario.context,
            opening_message=opening_text,
            chunks=chunk_items,
        )

    async def add_transcript_segment(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        data: AddTranscriptSegmentRequest,
    ) -> TranscriptSegmentResponse:
        session = await self.session_repo.get_by_id(session_id)
        if not session or session.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Roleplay session not found or access denied",
            )

        if session.status == SessionState.CREATED.value:
            SessionStateMachine.transition(SessionState.CREATED, SessionState.ACTIVE)
            session.status = SessionState.ACTIVE.value
            await self.session_repo.save(session)

        existing = await self.transcript_repo.get_by_session_and_segment_id(session_id, data.id)
        if existing:
            return TranscriptSegmentResponse(
                id=existing.id,
                session_id=existing.session_id,
                speaker=existing.speaker,
                text=existing.text,
                start_ms=existing.start_ms,
                end_ms=existing.end_ms,
                confidence=existing.confidence,
                is_final=existing.is_final,
                seq=existing.seq,
            )

        max_seq = await self.transcript_repo.get_max_seq(session_id)
        seq = max_seq + 1

        segment = TranscriptSegment(
            pk=uuid.uuid4(),
            id=data.id,
            session_id=session_id,
            speaker=data.speaker,
            user_id=user_id if data.speaker == "USER" else None,
            text=data.text,
            start_ms=data.start_ms,
            end_ms=data.end_ms,
            confidence=data.confidence,
            is_final=data.is_final,
            seq=seq,
        )
        await self.transcript_repo.add_segment(segment)

        if data.speaker == "USER":
            session.spoken_seconds += (data.end_ms - data.start_ms) / 1000.0
            await self.session_repo.save(session)

        return TranscriptSegmentResponse(
            id=segment.id,
            session_id=segment.session_id,
            speaker=segment.speaker,
            user_id=segment.user_id,
            text=segment.text,
            start_ms=segment.start_ms,
            end_ms=segment.end_ms,
            confidence=segment.confidence,
            is_final=segment.is_final,
            seq=segment.seq,
        )

    async def end_roleplay_session(
        self, session_id: uuid.UUID, user_id: uuid.UUID, reason: str = "USER_REQUESTED"
    ) -> EndSessionResponse:
        session = await self.session_repo.get_by_id(session_id)
        if not session or session.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Roleplay session not found or access denied",
            )

        now = self.clock.now()
        current_state = SessionState(session.status)

        if current_state not in (
            SessionState.ENDED,
            SessionState.FEEDBACK_READY,
            SessionState.INSUFFICIENT_DATA,
            SessionState.FAILED,
        ):
            if current_state == SessionState.CREATED:
                SessionStateMachine.transition(SessionState.CREATED, SessionState.ACTIVE)
                session.status = SessionState.ACTIVE.value
                current_state = SessionState.ACTIVE

            if current_state != SessionState.ENDING:
                SessionStateMachine.transition(current_state, SessionState.ENDING)
                session.status = SessionState.ENDING.value

            SessionStateMachine.transition(SessionState.ENDING, SessionState.ENDED)
            session.status = SessionState.ENDED.value
            session.ended_at = now
            session.end_reason = reason
            if session.started_at:
                started = session.started_at
                if started.tzinfo is None and now.tzinfo is not None:
                    started = started.replace(tzinfo=UTC)
                elif started.tzinfo is not None and now.tzinfo is None:
                    now = now.replace(tzinfo=UTC)
                session.duration_seconds = max(0.0, (now - started).total_seconds())
            await self.session_repo.save(session)

        # Trigger evaluation for the ended session
        try:
            await self.evaluate_roleplay_session(session_id)
        except Exception as eval_err:
            logger.warning("Error evaluating roleplay %s: %s", session_id, eval_err)

        return EndSessionResponse(
            id=session.id,
            status=SessionState.ENDED.value,
            ended_at=session.ended_at or now,
            duration_seconds=session.duration_seconds,
            spoken_seconds=session.spoken_seconds,
            end_reason=session.end_reason,
        )

    async def evaluate_roleplay_session(self, session_id: uuid.UUID) -> RoleplayEvaluation:
        """
        Post-roleplay evaluation (idempotent):
        1. Evaluates each requirement PASS/FAIL with transcript evidence.
        2. Matches chunks (exact, variation, approximate, wrong function, not used).
        3. Records needed chunks into chunk_bank.
        4. Computes 5-skill scoring engine.
        5. Marks scenario COMPLETED if all mandatory requirements PASS.
        6. Emits RoleplayEvaluated event.
        """
        # Idempotency check: return existing completed evaluation if present
        existing_eval = await self.scenario_repo.get_evaluation_by_session_id(session_id)
        if existing_eval and existing_eval.status == "COMPLETED":
            return existing_eval

        session = await self.session_repo.get_by_id(session_id)
        if not session or not session.scenario_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Session or scenario missing"
            )

        scenario = await self.scenario_repo.get_by_id(session.scenario_id)
        if not scenario:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")

        # 1. Run 5-skill scoring engine from Sprint 4
        scoring_service = ScoringService(self.db)
        overall_score: float | None = None
        try:
            feedback_res = await scoring_service.generate_feedback(session_id)
            overall_score = feedback_res.overall_score
        except Exception as scoring_err:
            logger.warning(
                "Scoring calculation warning for roleplay %s: %s", session_id, scoring_err
            )

        # 2. Extract dialogue history and user utterances
        transcripts = await self.transcript_repo.list_by_session(session_id)
        history = [
            {"role": "user" if t.speaker == "USER" else "model", "content": t.text}
            for t in transcripts
        ]
        user_utterances = [t.text for t in transcripts if t.speaker == "USER"]

        # 3. LLM evaluation of requirements and communicative function
        llm_provider = get_llm_provider()
        req_dicts = [
            {
                "id": str(r.id),
                "description": r.description,
                "is_mandatory": r.is_mandatory,
                "type": r.type,
                "expected_chunk_function": r.expected_chunk_function,
            }
            for r in scenario.requirements
        ]
        chunk_dicts = [
            {
                "id": str(c.id),
                "function_tag": c.function_tag,
                "text": c.text,
                "meaning_vi": c.meaning_vi,
                "accepted_variations": c.accepted_variations or [],
            }
            for c in scenario.chunks
        ]

        llm_eval = await llm_provider.evaluate_roleplay(
            history=history,
            scenario_title=scenario.title_vi,
            scenario_context=scenario.context,
            requirements=req_dicts,
            chunks=chunk_dicts,
            user_level=session.level,
        )

        raw_req_evals = llm_eval.get("requirements_evaluation", [])
        functional_verdicts = llm_eval.get("functional_chunk_verdicts", {})

        # 4. Chunk matching with string normalization, variations, and functional check
        match_results = self.chunk_matcher.evaluate_all_chunks(
            chunks=chunk_dicts,
            user_utterances=user_utterances,
            llm_function_verdicts=functional_verdicts,
        )

        chunks_used_well: list[dict[str, Any]] = []
        chunks_to_improve: list[dict[str, Any]] = []

        chunk_by_id = {str(c.id): c for c in scenario.chunks}

        for m in match_results:
            c_model = chunk_by_id.get(m.chunk_id)
            if m.is_used_well:
                chunks_used_well.append(
                    {
                        "chunk_id": m.chunk_id,
                        "text": m.target_text,
                        "function_tag": m.function_tag,
                        "matched_utterance": m.matched_utterance,
                        "match_type": m.match_type.value,
                    }
                )
            else:
                chunks_to_improve.append(
                    {
                        "chunk_id": m.chunk_id,
                        "text": m.target_text,
                        "function_tag": m.function_tag,
                        "meaning_vi": c_model.meaning_vi if c_model else "",
                        "reason": m.reason,
                    }
                )
                # Record into user's chunk_bank
                if c_model:
                    await self.scenario_repo.upsert_chunk_bank(
                        user_id=session.user_id,
                        chunk_id=c_model.id,
                        status="NEEDS_PRACTICE",
                        last_reviewed_at=self.clock.now(),
                    )

        # 5. Check if all mandatory requirements passed
        mandatory_req_ids = {str(r.id) for r in scenario.requirements if r.is_mandatory}
        passed_mandatories = {
            str(re["requirement_id"])
            for re in raw_req_evals
            if re.get("status") == "PASS" and str(re.get("requirement_id")) in mandatory_req_ids
        }
        is_passed = len(passed_mandatories) == len(mandatory_req_ids) if mandatory_req_ids else True

        now = self.clock.now()

        # Update user progress
        await self.scenario_repo.upsert_user_progress(
            user_id=session.user_id,
            scenario_id=scenario.id,
            status="COMPLETED" if is_passed else "IN_PROGRESS",
            score=overall_score,
            completed_at=now if is_passed else None,
            last_attempt_at=now,
        )

        # Save evaluation record (upsert)
        evaluation = existing_eval or RoleplayEvaluation(
            id=uuid.uuid4(),
            session_id=session_id,
            scenario_id=scenario.id,
            user_id=session.user_id,
        )
        evaluation.status = "COMPLETED"
        evaluation.passed = is_passed
        evaluation.requirements_evaluation = raw_req_evals
        evaluation.chunks_used_well = chunks_used_well
        evaluation.chunks_to_improve = chunks_to_improve
        evaluation.strengths = llm_eval.get("strengths", [])
        evaluation.improvements = llm_eval.get("improvements", [])
        evaluation.next_practice = llm_eval.get("next_practice")
        evaluation.evaluated_at = now

        saved_eval = await self.scenario_repo.save_evaluation(evaluation)

        # Transition session to FEEDBACK_READY
        try:
            SessionStateMachine.transition(
                SessionState(session.status), SessionState.FEEDBACK_READY
            )
            session.status = SessionState.FEEDBACK_READY.value
            await self.session_repo.save(session)
        except Exception:
            pass

        # 6. Emit domain event RoleplayEvaluated
        await event_bus.publish(
            RoleplayEvaluated(
                session_id=session_id,
                scenario_id=scenario.id,
                user_id=session.user_id,
                passed=is_passed,
                requirements_passed=len([r for r in raw_req_evals if r.get("status") == "PASS"]),
                requirements_total=len(raw_req_evals),
                used_chunks_count=len(chunks_used_well),
                needs_practice_chunks_count=len(chunks_to_improve),
                overall_score=overall_score,
            )
        )

        # Notify active WebSocket client
        await session_ws_manager.notify_session(
            session_id,
            {
                "type": "roleplay.evaluation_ready",
                "sessionId": str(session_id),
                "passed": is_passed,
                "overallScore": overall_score,
            },
        )

        return saved_eval

    async def get_roleplay_evaluation(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> RoleplayEvaluationResponse:
        session = await self.session_repo.get_by_id(session_id)
        if not session or session.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Roleplay session not found or access denied",
            )

        evaluation = await self.scenario_repo.get_evaluation_by_session_id(session_id)
        if not evaluation:
            # Generate evaluation on-demand if session is ended
            evaluation = await self.evaluate_roleplay_session(session_id)

        scenario = await self.scenario_repo.get_by_id(evaluation.scenario_id)
        scenario_title = scenario.title_vi if scenario else "Roleplay Tình huống"

        scoring_service = ScoringService(self.db)
        _, feedback = await scoring_service.get_feedback(session_id, user_id)
        overall_score = feedback.overall_score if feedback else None

        req_items = [
            RequirementEvaluationItem(
                requirement_id=r.get("requirement_id", ""),
                description=r.get("description", ""),
                is_mandatory=r.get("is_mandatory", True),
                status=r.get("status", "FAIL"),
                evidence=r.get("evidence", ""),
                reason=r.get("reason", ""),
            )
            for r in evaluation.requirements_evaluation
        ]

        well_items = [
            ChunkUsedWellItem(
                chunk_id=c.get("chunk_id", ""),
                text=c.get("text", ""),
                function_tag=c.get("function_tag", ""),
                matched_utterance=c.get("matched_utterance"),
                match_type=c.get("match_type", "EXACT"),
            )
            for c in evaluation.chunks_used_well
        ]

        improve_items = [
            ChunkToImproveItem(
                chunk_id=c.get("chunk_id", ""),
                text=c.get("text", ""),
                function_tag=c.get("function_tag", ""),
                meaning_vi=c.get("meaning_vi"),
                reason=c.get("reason", ""),
            )
            for c in evaluation.chunks_to_improve
        ]

        return RoleplayEvaluationResponse(
            session_id=session_id,
            scenario_id=evaluation.scenario_id,
            scenario_title=scenario_title,
            status=evaluation.status,
            passed=evaluation.passed,
            overall_score=overall_score,
            requirements=req_items,
            chunks_used_well=well_items,
            chunks_to_improve=improve_items,
            strengths=evaluation.strengths or [],
            improvements=evaluation.improvements or [],
            next_practice=evaluation.next_practice,
            evaluated_at=evaluation.evaluated_at,
        )

    async def get_chunk_bank(self, user_id: uuid.UUID) -> ChunkBankResponse:
        records = await self.scenario_repo.list_chunk_bank(user_id)
        items: list[ChunkBankItemSchema] = []
        needs_practice = 0
        mastered = 0

        for r in records:
            if not r.chunk:
                continue
            if r.status == "NEEDS_PRACTICE":
                needs_practice += 1
            elif r.status == "MASTERED":
                mastered += 1

            scenario_title = r.chunk.scenario.title_vi if r.chunk.scenario else "Tình huống"
            items.append(
                ChunkBankItemSchema(
                    chunk_id=r.chunk.id,
                    scenario_id=r.chunk.scenario_id,
                    scenario_title=scenario_title,
                    function_tag=r.chunk.function_tag,
                    text=r.chunk.text,
                    meaning_vi=r.chunk.meaning_vi,
                    example_sentence=r.chunk.example_sentence,
                    status=r.status,
                    last_reviewed_at=r.last_reviewed_at,
                )
            )

        return ChunkBankResponse(
            total_count=len(items),
            needs_practice_count=needs_practice,
            mastered_count=mastered,
            items=items,
        )
