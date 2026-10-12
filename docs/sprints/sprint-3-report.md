# Sprint 3 Report — AI Coach Voice Conversation

## 1. Hoàn thành so với mục tiêu

Sprint 3 đã hoàn thành xuất sắc mục tiêu đặt ra: cho phép người dùng chọn chủ đề và nói chuyện trực tiếp với AI Coach bằng giọng nói, xem Live Script thời gian thực; vòng đời session vận hành theo đúng state machine chuẩn và chịu được sự cố mất kết nối mạng. Toàn bộ yêu cầu F-01 (US-01 đến US-03), SRS mục 5.1, 8.2, UI màn 14 và 15 đã được đáp ứng trọn vẹn:

- **Spike đánh giá STT (`docs/spikes/stt.md`):**
  - So sánh chi tiết 3 nhà cung cấp STT hàng đầu: Deepgram (Nova-2), Google Cloud Speech-to-Text v2, và Azure Cognitive Services Speech về độ trễ streaming, độ chính xác với giọng người Việt nói tiếng Anh, word timestamps, confidence và chi phí.
  - Đề xuất chọn Deepgram Nova-2 làm nhà cung cấp chính cho TalkWithMe.
  - Xây dựng adapter thực tế `DeepgramSttProvider` sẵn sàng kích hoạt khi có biến môi trường `DEEPGRAM_API_KEY`; mặc định giữ `FakeSttProvider` an toàn cho môi trường test và phát triển cục bộ.
- **Backend Architecture & Database:**
  - Thiết kế bảng dùng chung `sessions` (chuẩn bị mở rộng cho Roleplay Sprint 5 và Community Room Sprint 7), `transcript_segments` (unique theo `(session_id, id)` chống trùng lặp), và `coach_topics`.
  - Viết Alembic migration 0003 tạo 3 bảng và kiểm thử `upgrade head` thành công.
  - Seed 12 chủ đề đa dạng theo đúng thiết kế UI (nhóm Giới thiệu bản thân, Kể về công việc, Du lịch yêu thích, và Giao tiếp hằng ngày: Mua sắm & đặt hàng, Hỏi đường, Cuối tuần, Thời tiết).
  - Cài đặt `SessionStateMachine` chuẩn theo mục 9 AGENTS.md với 8 trạng thái, kiểm soát mọi chuyển dịch hợp lệ và từ chối nghiêm ngặt các chuyển dịch vi phạm.
  - Cài đặt chính sách `TurnTakingPolicy` theo triết lý Communication-First: từ đệm (`um`, `uh`, `you know`) và ngập ngừng không kết thúc lượt nói của người dùng; xử lý im lặng ngắn và im lặng dài.
  - Thuật toán `rank_topics()` gợi ý chủ đề thông minh dựa trên độ phù hợp CEFR level, sở thích và kỹ năng còn yếu.
  - Cung cấp đầy đủ các REST API theo quy ước: `GET /coach/topics`, `POST /coach/sessions` (kiểm tra điều kiện đã hoàn tất onboarding), `GET /coach/sessions/{id}`, `POST /coach/sessions/{id}/transcript` (idempotent), `GET /coach/sessions/{id}/transcript`, `POST /coach/sessions/{id}/end` (idempotent), `GET /coach/sessions/{id}/feedback` (tạm trả 202 theo yêu cầu, chưa tính điểm), và `POST /ws-tickets`.
  - WebSocket tổng quát `/api/v1/ws/sessions/{session_id}?ticket=` xử lý luồng binary audio chunk đệm trong RAM, bản tin điều khiển JSON, cơ chế khôi phục qua `lastSeq`, tự động chuyển sang `RECONNECTING` khi mất mạng và dọn dẹp khi timeout. Tuân thủ tuyệt đối quy tắc không lưu file audio thô xuống đĩa.
  - Xuất hợp đồng API mới nhất vào `openapi/openapi.json`.
- **Frontend (Angular 19):**
  - Màn 14 (`ai-coach.component.ts`): Tìm kiếm chủ đề, hiển thị thẻ chủ đề đang chọn kèm nút "Đổi chủ đề" và "Bắt đầu nói", phân nhóm rõ ràng "Gợi ý cho bạn" và "Giao tiếp hằng ngày".
  - Màn 15 (`ai-coach-session.component.ts`): Giao diện tối chuyên dụng cho hội thoại giọng nói, đồng hồ bấm giờ trực quan, nút kết thúc và modal xác nhận, Live Script hiển thị riêng biệt người dùng và AI kèm timestamp, cuộn thông minh (smart auto-scroll) cho phép cuộn ngược lên xem lại lịch sử.
  - Triển khai dịch vụ `coach-voice.service.ts` quản lý 10 trạng thái tương tác theo SRS 5.1, tích hợp thu âm và gửi stream audio microphone thật, giải phóng toàn bộ audio track khi kết thúc phiên, công tắc Mock Mode (D-08) và ô nhập liệu văn bản thay thế khi micro gặp sự cố.
- **Tài liệu & Học tập:**
  - Cập nhật nhật ký quyết định `docs/decision-log.md` (các quyết định D-27 đến D-31).
  - Soạn tài liệu kiến thức chuyên sâu `learning/sprint-3-ai-coach-voice.md`.

---

## 2. Danh sách Endpoint mới hoặc thay đổi

- `GET /api/v1/coach/topics?q=`: Lấy danh sách chủ đề theo nhóm và nhóm "Gợi ý cho bạn" được cá nhân hóa.
- `POST /api/v1/coach/sessions`: Tạo phiên AI Coach mới; yêu cầu tài khoản đã hoàn tất onboarding. AI mở đầu câu chào theo level và chủ đề.
- `GET /api/v1/coach/sessions/{id}`: Xem chi tiết trạng thái, thời lượng và thông tin phiên luyện nói.
- `POST /api/v1/coach/sessions/{id}/transcript`: Ghi nhận đoạn transcript (idempotent theo `id`).
- `GET /api/v1/coach/sessions/{id}/transcript`: Lấy toàn bộ lịch sử transcript theo thứ tự thời gian.
- `POST /api/v1/coach/sessions/{id}/end`: Kết thúc phiên luyện nói (idempotent, thu hồi tài nguyên, cập nhật thời lượng nói).
- `GET /api/v1/coach/sessions/{id}/feedback`: Trả mã 202 kèm trạng thái PENDING (chưa tính điểm, dành cho Sprint 4).
- `POST /api/v1/ws-tickets`: Cấp một vé one-time ticket dùng 1 lần (TTL 30s) lưu trong Redis để kết nối WebSocket.
- `WS /api/v1/ws/sessions/{session_id}?ticket=`: Kênh WebSocket thời gian thực hỗ trợ stream binary audio, trao đổi thông điệp điều khiển, tiếp tục phiên với `lastSeq` và quản lý trạng thái `RECONNECTING`.

---

## 3. Test đã thêm và kết quả chạy

- **Unit Tests (`tests/unit/test_coach_unit.py`):** 38 tests đạt 100% Passed.
  - Ma trận chuyển đổi trạng thái `SessionStateMachine`: kiểm thử tất cả chuyển đổi hợp lệ (`CREATED -> ACTIVE`, `ACTIVE -> RECONNECTING -> ACTIVE`, `ACTIVE -> ENDING -> ENDED`, từ chối quyền mic `CREATED -> FAILED`) và mọi chuyển đổi không hợp lệ.
  - Chính sách `TurnTakingPolicy`: kiểm thử độ trễ im lặng ngắn, im lặng dài, và trường hợp người dùng ngập ngừng hoặc kết thúc bằng từ đệm (*um, uh, you know*).
  - Thuật toán `rank_topics()`: kiểm thử xếp hạng chủ đề theo trình độ CEFR, chủ đề yêu thích và điểm yếu cần cải thiện.
- **Integration Tests (`tests/integration/test_coach_api.py`):** 4 test suites chuyên sâu đạt 100% Passed.
  - Kiểm thử từ chối tạo session nếu người dùng chưa hoàn tất onboarding.
  - Kiểm thử gợi ý chủ đề theo đúng level và hồ sơ người dùng.
  - Kiểm thử toàn bộ vòng đời session, tính idempotent khi gọi `/end` và gửi transcript nhiều lần, kiểm tra bảo mật (truy cập phiên của người khác trả về 404).
  - Kiểm thử cơ chế cấp vé WebSocket: vé dùng 1 lần bị xóa ngay khỏi Redis, vé hết hạn hoặc giả mạo bị từ chối kết nối; luồng truyền tin qua WebSocket với `FakeSttProvider` và `FakeLlmProvider`.
- **E2E Tests (`e2e/coach.spec.ts`):** 
  - Kịch bản Playwright kiểm thử trọn vẹn luồng AI Coach: Đăng ký/Onboarding -> Vào màn 14 -> Tìm kiếm & chọn chủ đề -> Nhấn "Bắt đầu nói" -> Vào màn 15 tối -> Thấy AI gửi lời chào trong Live Script -> Tương tác hội thoại -> Thấy Live Script của người dùng và phản hồi tiếp theo của AI -> Nhấn Kết thúc & xác nhận modal -> Quay trở lại màn 14 an toàn.
- **Chất lượng mã nguồn:**
  - Toàn bộ backend test suite: 132 passed, 1 skipped (test container).
  - Backend ruff và mypy sạch sẽ, không có cảnh báo.
  - Frontend `npm run build` biên dịch thành công 100%, không lỗi template hay kiểu dữ liệu TypeScript.

---

## 4. Các quyết định mới và điểm lệch so với SRS/UI

- **D-27 (Xác thực WebSocket bằng One-Time Ticket):** Thay vì đặt Bearer JWT trực tiếp trên URL của WebSocket (dễ bị lộ trong server access log và browser history), hệ thống dùng endpoint `POST /api/v1/ws-tickets` cấp vé UUID ngắn hạn (30s) trong Redis và hủy vé ngay khi kết nối.
- **D-28 (Chính sách Turn-Taking Communication-First):** Từ đệm và ngập ngừng không kết thúc lượt nói của người dùng kể cả khi có khoảng im lặng ngắn (< 1500ms). Chỉ khi người học dừng nói hẳn vượt ngưỡng cấu hình thì hệ thống mới kích hoạt AI Coach phản hồi.
- **D-29 (Thu hồi tài nguyên Microphone triệt để):** Ngay khi kết thúc buổi nói hoặc rời màn hình, frontend chủ động dừng toàn bộ hardware tracks (`track.stop()`) và đóng AudioContext, đảm bảo không lưu giữ quyền mic ngầm.
- **D-30 (Live Script & Khắc phục Mất kết nối):** Mỗi segment transcript được cấp `seq` tăng dần. Khi mất kết nối tạm thời, session chuyển sang `RECONNECTING` (giữ trong 60s); client kết nối lại với `lastSeq` để server đồng bộ tiếp mà không mất mát hoặc lặp dữ liệu.
- **D-31 (Xử lý Audio Buffer trong RAM):** Dữ liệu âm thanh streaming được đệm tạm thời trong RAM máy chủ để proxy sang STT provider và giải phóng ngay, tuyệt đối không ghi file audio thô xuống đĩa cứng, tuân thủ nghiêm ngặt Bất biến 3 AGENTS.md.

---

## 5. Việc chưa làm hoặc nợ kỹ thuật

- Tính năng chấm điểm 5 chỉ số (Fluency, Vocabulary, Grammar, Pronunciation, Coherence), tính điểm tổng hợp và sinh báo cáo chi tiết sau buổi nói được chủ động để lại cho Sprint 4 theo đúng kế hoạch phạm vi (Endpoint `GET /coach/sessions/{id}/feedback` hiện tại trả về mã HTTP 202 PENDING).
- Chưa cộng điểm kinh nghiệm (XP), chưa tính Streak và nhiệm vụ hằng ngày cho phiên AI Coach (thuộc phạm vi Sprint 6 Gamification).

---

## 6. Câu hỏi cần chủ dự án quyết định

- Đối với nhà cung cấp STT Deepgram Nova-2, chi phí khoảng $0.0043/phút cho streaming âm thanh trực tiếp. Khi đưa vào môi trường Production thử nghiệm diện rộng, PO muốn thiết lập hạn mức (quota) thời lượng luyện nói tối đa mỗi ngày cho từng tài khoản miễn phí là bao nhiêu phút?
