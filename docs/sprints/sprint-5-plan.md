# Kế hoạch Sprint 5 — Scenario Lesson (Roleplay, Chunking & Evaluation)

1. Thiết kế models/schemas: scenarios, scenario_requirements, scenario_chunks, user_scenario_progress, drill_attempts, chunk_bank, roleplay_evaluations; migration Alembic 0005.
2. Seed 20 tình huống (4 nhóm, mỗi bài 4-6 chunk) từ YAML files trong app/seeds/scenarios/ & test schema seed.
3. TtsProvider interface trong core/providers/tts_provider.py (Fake dev/test, Edge-TTS fallback).
4. Logic Chunk matching & functional check: Exact/variation/similarity + LLM validation.
5. Scenario & Roleplay Service, background evaluation job (ARQ / asyncio idempotent task), 5-skill scoring integration, emit RoleplayEvaluated event.
6. REST API: GET /scenarios, GET /scenarios/{id}, GET /scenarios/{id}/chunks, POST /scenarios/{id}/drills, POST /scenarios/{id}/roleplays, POST /roleplays/{id}/transcript, POST /roleplays/{id}/end, GET /roleplays/{id}/evaluation, GET /me/chunk-bank.
7. Tích hợp prompt roleplay vào ws_session WebSocket lõi cho session type=ROLEPLAY.
8. Frontend: Thư viện tình huống (màn 17), Chi tiết 3 tab (màn 18-19: Bối cảnh, Mẫu câu, Luyện phản xạ drill), Màn Roleplay (dùng lại Screen 15 UX), Màn Đánh giá nhiệm vụ (PASS/FAIL, Chunks, Strengths, Improvements, Next Practice).
9. Tests: Unit (chunk matcher, scenario completion, library filter), Integration (seeds, filters, drills, roleplay evaluation, chunk_bank, access control), E2E test.
10. Export OpenAPI, regenerate Angular client/models, linting (ruff, mypy), frontend build & test, decision-log, technical learning notes & report.
