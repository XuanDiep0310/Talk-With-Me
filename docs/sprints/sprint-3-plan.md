# Sprint 3 Plan — AI Coach Voice Conversation & Live Script

1. Viết spike khảo sát STT (`docs/spikes/stt.md`) so sánh Deepgram, Google Cloud STT, Azure Speech; tạo adapter Deepgram/Google và giữ FakeSttProvider mặc định.
2. Migration DB: Bảng dùng chung `sessions`, `transcript_segments`, `coach_topics` và seed 12 chủ đề luyện nói theo UI.
3. Cài đặt `SessionStateMachine` độc lập quản lý 8 trạng thái nghiêm ngặt theo AGENTS.md mục 9.
4. Cài đặt TurnTakingPolicy (phát hiện im lặng, bỏ qua filler um/uh) và TopicRankingService (xếp hạng gợi ý theo hồ sơ học tập).
5. Xây dựng các REST endpoints: `/coach/topics`, `POST /coach/sessions`, `GET /coach/sessions/{id}`, `/transcript`, `/end`, `/feedback` (202), `POST /ws-tickets`.
6. Xây dựng WebSocket `/api/v1/ws/sessions/{session_id}?ticket=` xử lý binary audio, control events, STT streaming, LLM response, reconnect buffer lastSeq.
7. Frontend Màn 14: Duyệt chủ đề theo nhóm, gợi ý thông minh, tìm kiếm, thẻ chủ đề đang chọn, chuyển sang màn hội thoại.
8. Frontend Màn 15: Giao diện tối, timer đếm giờ, kết thúc phiên, Live Script User/AI thời gian thực kèm timestamp, smart auto-scroll, text input fallback.
9. Quản lý Microphone: Ghi âm gửi binary chunk, xử lý 10 trạng thái UX (SRS 5.1), giải phóng track mic, giữ switch Dev Mock Mode (D-08).
10. Cập nhật OpenAPI contract `openapi/openapi.json` và đồng bộ frontend models.
11. Bộ kiểm thử: Unit tests (State Machine, Turn-taking, Topic Ranking), Integration tests (Auth, WebSocket, Idempotent transcript & end, Reconnect lastSeq, Access control).
12. Viết E2E Playwright test kiểm chứng luồng chọn chủ đề -> hội thoại -> Live Script -> kết thúc phiên.
13. Hoàn thiện tài liệu kiến thức `learning/sprint-3-ai-coach-voice.md`, cập nhật `docs/decision-log.md` và viết `docs/sprints/sprint-3-report.md`.
