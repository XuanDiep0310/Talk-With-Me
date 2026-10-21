# Sprint 4 Plan — Scoring Engine & Post-Session Feedback

1. Viết `docs/scoring-spec.md` định nghĩa chi tiết 5 chỉ số, MTLD, ngưỡng dữ liệu tối thiểu, tham số, cập nhật `docs/decision-log.md`.
2. Tạo Alembic migration cho 3 bảng: `session_feedback`, `session_skill_scores`, `scoring_audit`.
3. Cài đặt module `scoring` với các hàm thuần: Fluency (Continuity, Pause, Filler), Listening, Vocabulary (MTLD, Context), Response Speed, Pronunciation, Overall (D-10).
4. Thiết lập cấu hình `formula_version`, trọng số, ngưỡng trong `core/config.py`.
5. Tạo LLM schema Pydantic cho structured evaluation & retry backoff, coi transcript là dữ liệu (Rule 10).
6. Tạo ARQ worker task & fallback execution `generate_feedback(session_id)` idempotent, dispatch event `FeedbackGenerated`.
7. Triển khai API: `GET /coach/sessions/{id}/feedback`, `POST /coach/sessions/{id}/feedback/retry`, WebSocket `feedback.ready`.
8. Viết unit tests chuyên sâu cho scoring (độ phủ ≥ 90%), fixtures transcript (trôi chảy, ngập ngừng, quá ngắn).
9. Viết integration tests: `/end` → feedback, idempotency, LLM failure/retry, INSUFFICIENT_DATA, phân quyền 404.
10. Cập nhật `openapi/openapi.json` và build lại Angular client/types.
11. Xây dựng màn Post-Session Feedback trên Angular: 5 thanh kỹ năng, Overall score, Strengths, Improvements, Next practice, states PENDING/INSUFFICIENT_DATA/FAILED retry.
12. Tích hợp chuyển hướng từ màn 15 sang màn feedback khi kết thúc phiên và viết E2E test Playwright.
13. Chạy ruff, mypy strict, pytest, karma/build, cập nhật `docs/sprints/sprint-4-report.md` và `learning/sprint-4-scoring-feedback.md`.
