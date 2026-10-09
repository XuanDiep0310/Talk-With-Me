# Sprint 2 Plan — Onboarding & Placement Test

**Branch:** `feat/sprint-2-onboarding`  
**Scope:** Backend-first. FE and tests after.

## Mục tiêu
Người dùng mới hoàn thành onboarding: Placement Test (Voice) hoặc tự chọn level → chọn sở thích, mục tiêu, kỹ năng → vào dashboard.

## Backend (ưu tiên)

1. **DB models & migration** — Mở rộng `user_profiles` (level, level_source, needs_reassessment, onboarding_completed_at), tạo bảng `placement_tests`, `placement_answers`, `level_history`, `onboarding_options` (seed).
2. **Onboarding options seed** — Interests (8), Goals (5), Weak points (5), câu hỏi test (seeded).
3. **Config mở rộng** — Ngưỡng placement, câu hỏi test, min_words, min_answers thêm vào `Settings`.
4. **STT provider stub** — `SttProvider` interface + `FakeSttProvider` trả kết quả cứng.
5. **Level estimator** — `estimate_level(features) -> LevelEstimate` thuần hàm, ngưỡng từ config.
6. **Repositories** — `PlacementTestRepository`, `OnboardingRepository`.
7. **Services** — `OnboardingService`, `PlacementService`.
8. **Endpoints:**
   - `GET /onboarding/options`
   - `PUT /me/preferences`
   - `POST /placement-tests`
   - `POST /placement-tests/{id}/answers`
   - `POST /placement-tests/{id}/complete`
   - `PUT /me/level`
   - `POST /me/onboarding/complete`
9. **OpenAPI export & Angular client re-gen**

## Frontend (sau backend)

Màn 3–11: onboarding flow Angular.

## Tests (sau backend)

Unit: `estimate_level`, `validate_preferences`. Integration: luồng đầy đủ.

## Timeline (1 agent session)
Làm backend → export OpenAPI → ghi báo cáo.
