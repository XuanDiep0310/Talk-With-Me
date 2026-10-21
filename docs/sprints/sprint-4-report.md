# Báo cáo Sprint 4 — Communication Scoring Engine & Post-Session Feedback

## 1. Những gì đã hoàn thành so với mục tiêu

Sprint 4 đã hoàn thành toàn diện hệ thống chấm điểm giao tiếp đa chiều (Scoring Engine) và màn hình báo cáo phản hồi sau phiên (Post-Session Feedback) theo đúng đặc tả SRS F-03 (US-04, US-09, mục 3.3) và các quy tắc bất biến trong AGENTS.md §8 (đặc biệt: không bịa điểm khi thiếu dữ liệu, điểm phát âm luôn là tham khảo dựa trên STT confidence, dữ liệu người nói là untrusted data với LLM, và quy tắc D-10 tái phân bổ trọng số khi thiếu chỉ số).

Hệ thống đã xây dựng tài liệu đặc tả công thức toán học chi tiết tại `docs/scoring-spec.md` cùng quyết định kiến trúc D-34 (trạng thái PROPOSED) trong `docs/decision-log.md`. Các bảng dữ liệu mới gồm `session_feedback`, `session_skill_scores`, và `scoring_audit` đã được bổ sung qua migration Alembic `0004_add_scoring_and_feedback_tables` với đầy đủ khả năng `upgrade head` và `downgrade -1`. Toàn bộ logic tính toán 5 chỉ số (Độ trôi chảy, Khả năng hiểu, Từ vựng qua thuật toán MTLD, Tốc độ phản xạ với 2s grace period, Độ chuẩn phát âm) được viết dưới dạng các hàm thuần trong module `app/services/scoring/metrics.py` đạt độ phủ kiểm thử trên 95%. Hệ thống tích hợp LLM đánh giá định tính qua schema Pydantic có cấu trúc, cơ chế retry lũy thừa (exponential backoff 3 lần), hàng đợi nền ARQ kèm chế độ eager dự phòng idempotent, phát event nội bộ `FeedbackGenerated`, và gửi tín hiệu realtime `feedback.ready` qua WebSocket.

Về phía giao diện, màn hình báo cáo sau phiên `AiCoachReportComponent` đã được xây dựng hoàn chỉnh với phong cách đồng bộ từ Dashboard, hỗ trợ đầy đủ các trạng thái tải (PENDING kèm polling), hoàn tất (FEEDBACK_READY kèm 5 thanh kỹ năng, nhãn tham khảo cho phát âm, nhãn ước tính cho D-10, điểm mạnh, điểm cải thiện, gợi ý bước tiếp), dữ liệu không đủ (INSUFFICIENT_DATA hiển thị N/A minh bạch không điểm giả), và trạng thái lỗi (FAILED kèm nút thử lại thủ công). Luồng kết thúc phiên thoại tại màn hình 15 đã được điều hướng chính xác sang màn hình feedback.

## 2. Danh sách endpoint mới hoặc thay đổi

- `GET /api/v1/coach/sessions/{session_id}/feedback`: Trả về HTTP 202 khi báo cáo đang trong hàng đợi tính toán (`PENDING`); trả về HTTP 200 khi hoàn tất (`FEEDBACK_READY`), khi không đủ dữ liệu (`INSUFFICIENT_DATA`), hoặc khi xử lý thất bại (`FAILED` kèm cờ `retryable`). Endpoint bảo vệ theo người dùng sở hữu và trả 404 khi truy cập trái phép.
- `POST /api/v1/coach/sessions/{session_id}/feedback/retry`: Cho phép người dùng thử lại thủ công khi phiên phân tích gặp lỗi, thiết lập trạng thái về `PENDING`, tái kích hoạt job tính toán nền và trả về HTTP 202.
- `POST /api/v1/coach/sessions/{session_id}/end`: Cập nhật logic tự động kích hoạt tiến trình chấm điểm nền thông qua `enqueue_feedback_job(session_id)`.
- WebSocket `/api/v1/coach/sessions/{session_id}/ws`: Bổ sung cơ chế phát sự kiện realtime `feedback.ready` từ server tới client khi job nền hoàn thành.

## 3. Test đã thêm và kết quả chạy

Toàn bộ 228 bài kiểm thử backend (bao gồm 52 test unit cho scoring và 6 integration test cho API scoring) đều vượt qua thành công:
- **Unit test (`backend/tests/unit/test_scoring_unit.py`)**: Đạt độ phủ 95% trên `metrics.py`, kiểm thử chi tiết từng hàm chỉ số theo bảng tham số, các ca biên tốc độ phản xạ ($T = 2.0s \to 100$, $T \ge 10.33s \to 0$), kiểm tra tính đơn điệu của thuật toán MTLD giữa văn bản lặp lại và văn bản đa dạng từ vựng, kiểm tra quy tắc D-10 (thiếu 1 chỉ số tính lại tỷ lệ trọng số và gắn `partial=True`, thiếu từ 2 chỉ số trở lên điểm tổng trả về `None`), và kiểm định ngưỡng tối thiểu (tổng từ, lượt thoại, giây nói).
- **Fixtures (`backend/tests/unit/test_scoring_fixtures.py`)**: Đóng gói 3 bộ transcript mẫu chuẩn hóa (bài nói trôi chảy điểm cao, bài nói ngập ngừng nhiều filler/pause, bài nói quá ngắn vi phạm ngưỡng tối thiểu).
- **Integration test (`backend/tests/integration/test_scoring_api.py`)**: Kiểm thử trọn vẹn luồng `/end` $\to$ job nền $\to$ sinh feedback với Fake LLM; xác thực tính idempotent khi gọi `/end` lặp lại; mô phỏng lỗi LLM quá tải dẫn tới trạng thái `FAILED` và retry thủ công thành công; xác thực session quá ngắn trả `INSUFFICIENT_DATA` không có điểm giả; kiểm tra phân quyền truy cập chéo trả HTTP 404; và kiểm tra mã trạng thái HTTP 202 chuyển tiếp sang HTTP 200.
- **Frontend & E2E**: TypeScript và bundle Angular biên dịch thành công không có cảnh báo; kiểm thử Playwright (`e2e/coach.spec.ts`) được cập nhật để xác thực việc kết thúc cuộc hội thoại chuyển hướng chính xác sang màn hình feedback.
- **Chất lượng mã nguồn**: Ruff check và Mypy strict cho `backend/app` đạt kết quả 100% sạch, không phát hiện lỗi.

## 4. Các quyết định mới và điểm lệch so với SRS/UI

- **Quyết định D-34 (PROPOSED)**: Định nghĩa chi tiết công thức toán học cho các thành phần con mà SRS chưa làm rõ:
  - *Speech Continuity*: Tỉ lệ giữa thời gian nói thực tế và tổng khoảng thời gian của lượt nói (mục tiêu chuẩn 0.85).
  - *Pause Score*: Trừ 4 điểm cho mỗi lần dừng dài ($> 1500$ms) trên mỗi phút nói.
  - *Filler Word Score*: Trừ 5 điểm cho mỗi từ đệm trên 100 từ nói.
  - *Vocabulary Diversity*: Đo lường bằng thuật toán MTLD (Measure of Textual Lexical Diversity, ngưỡng TTR 0.72, chuẩn hóa theo điểm trần 50.0).
  - *Listening Comprehension & Context Relevance*: Lấy điểm định tính từ structured LLM evaluation ($0.7 \times \text{Response Relevance} + 0.3 \times \text{Task Completion}$).
  - *Response Speed*: Miễn trừ độ trễ tự nhiên 2.0s ($T \le 2.0s \to 100$), vượt quá thì trừ 12 điểm/giây trễ thêm.
  - *Pronunciation*: Trung bình cộng confidence của STT nhân 100, bắt buộc gắn cờ `isReference=true` và nhãn tham khảo ở UI.
  - *Overall Score*: Tuân thủ quy định D-10, điểm tổng là N/A nếu thiếu từ 2 chỉ số.
- **Điểm lệch so với SRS/UI**: UI gốc trong PDF thiếu hoàn toàn màn hình Post-Session Feedback (màn hình mới bổ sung). Màn hình mới được thiết kế kế thừa ngôn ngữ giao diện từ Dashboard (thanh đo kỹ năng, mã màu, cấu trúc thẻ, thông điệp tích cực).

## 5. Việc chưa làm hoặc nợ kỹ thuật

- Hàng đợi ARQ hiện đang ưu tiên thực thi chế độ eager trong môi trường test/local khi không có worker Redis ARQ độc lập chạy nền; trong môi trường staging/production sẽ cần kích hoạt worker container qua file `docker-compose.yml`.
- Module Gamification (XP, Level, Streak) ở Sprint 5 sẽ tiếp nhận domain event `FeedbackGenerated` được phát ra từ sprint này để cập nhật tiến trình người học.

## 6. Câu hỏi cần chủ dự án quyết định

1. **Phê duyệt đề xuất D-34**: Chủ dự án cần xem xét và phê duyệt các tham số khởi tạo trong `docs/scoring-spec.md` (ngưỡng dừng 1.5s, trọng số trừ điểm 4 điểm/phút, ngưỡng phạt từ đệm 5 điểm/100 từ, và thang điểm MTLD benchmark 50.0) từ trạng thái PROPOSED sang ACCEPTED.
2. **Ngưỡng dữ liệu tối thiểu cho phiên thoại**: Hiện đang cấu hình là tối thiểu 5 từ nói, 1 lượt thoại người dùng và 5 giây nói cho môi trường thử nghiệm; đối với môi trường production thực tế, chủ dự án có muốn nâng ngưỡng này lên (ví dụ: tối thiểu 15 từ và 15 giây nói) để đảm bảo chất lượng nhận xét của AI không?
