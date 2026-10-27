# Báo cáo Sprint 5: Scenario Lesson (Roleplay, Chunking & Evaluation)

Sprint 5 đã hoàn thành toàn bộ các mục tiêu đặt ra cho tính năng Scenario Lessons theo phương pháp Chunking, tích hợp bài tập phản xạ (Reflex Drill), hội thoại nhập vai hai chiều với AI (Interactive Roleplay) và đánh giá nhiệm vụ chuyên sâu (Mission Evaluation). Người học có thể duyệt danh mục tình huống sinh động, học các cụm mẫu câu chức năng (OPENING, REQUEST, CLARIFY, AGREE_DECLINE, CLOSING) kèm mẫu phát âm, luyện phản xạ trước khi bước vào phòng Roleplay tương tự ứng dụng The Coach, và nhận báo cáo đánh giá chi tiết với trích xuất bằng chứng từ transcript.

### 1. Những gì đã hoàn thành so với mục tiêu
Về mặt backend, hệ thống đã thiết lập đầy đủ các bảng dữ liệu qua migration Alembic 0005 gồm `scenarios`, `scenario_requirements`, `scenario_chunks`, `user_scenario_progress`, `drill_attempts`, `chunk_bank`, và `roleplay_evaluations`. Đã seed thành công 20 tình huống giao tiếp tự nhiên chuẩn CEFR từ A1 đến C1 (tuân thủ Rule D-03) phân bổ đều cho 4 nhóm (Đời sống hằng ngày, Giao tiếp xã hội, Du lịch & Mua sắm, Nơi làm việc), mỗi tình huống gồm 4 đến 6 chunks chức năng và các mục tiêu nhiệm vụ. Hệ thống cung cấp abstraction `TtsProvider` (`FakeTtsProvider` cho dev/test và `EdgeTtsProvider` cho production). Bộ so khớp chunk `ChunkMatcher` xử lý chuẩn hóa văn bản, hỗ trợ exact match, variation match và approximate matching qua cửa sổ trượt (ngưỡng tương đồng >= 0.72) kết hợp LLM kiểm tra ngữ cảnh giao tiếp. Đánh giá sau Roleplay chạy ngầm đảm bảo tính idempotent, tính toán lại bộ 5 chỉ số chấm điểm từ Sprint 4, cập nhật các chunk cần luyện vào `chunk_bank` và phát domain event `RoleplayEvaluated`.

Về mặt frontend, Màn 17 (Thư viện tình huống) được xây dựng với thanh tiến độ tổng, bộ lọc đa năng (nhóm tình huống, trình độ CEFR, trạng thái hoàn thành) và ô tìm kiếm tức thì. Màn 18 & 19 (Chi tiết tình huống) cung cấp 3 tab liền mạch: "Bối cảnh & Mục tiêu", "Mẫu câu (Chunks)" kèm phát âm audio/Web Speech Synthesis fallback, và "Luyện phản xạ (Reflex Drill)" với các nút Nói lại, Câu tiếp theo, Bỏ qua và Bắt đầu Roleplay ngay. Màn Roleplay kế thừa giao diện hội thoại màn 15 của AI Coach, bổ sung ngăn kéo xem nhanh danh sách Chunks mục tiêu. Màn Đánh giá nhiệm vụ hiển thị trực quan kết quả PASS/FAIL từng yêu cầu kèm trích dẫn lời nói người dùng, danh sách chunk dùng tốt và chunk cần luyện thêm, điểm 5 kỹ năng giao tiếp cùng nhận xét điểm mạnh và gợi ý thực hành tiếp theo.

### 2. Danh sách endpoint mới hoặc thay đổi
- `GET /api/v1/scenarios`: Lấy danh mục tình huống kèm bộ lọc (category, level, status, q), thống kê tiến độ từng nhóm và phần trăm hoàn thành toàn thư viện.
- `GET /api/v1/scenarios/{id}`: Lấy chi tiết tình huống theo UUID hoặc slug kèm danh sách yêu cầu và chunks.
- `GET /api/v1/scenarios/{id}/chunks`: Lấy danh sách mẫu câu chức năng của tình huống.
- `POST /api/v1/scenarios/{id}/drills`: Ghi nhận lượt luyện tập phản xạ (REPEAT, NEXT, SKIP) và cập nhật tiến độ.
- `POST /api/v1/scenarios/{id}/roleplays`: Khởi tạo phiên Roleplay (`type=ROLEPLAY`), thiết lập persona cho AI và sinh câu chào mở đầu.
- `POST /api/v1/roleplays/{id}/transcript`: Gửi segment hội thoại của người dùng hoặc AI trong phiên Roleplay (idempotent).
- `POST /api/v1/roleplays/{id}/end`: Kết thúc phiên Roleplay và kích hoạt tiến trình đánh giá ngầm.
- `GET /api/v1/roleplays/{id}/evaluation`: Truy vấn kết quả đánh giá nhiệm vụ, so khớp chunk và điểm 5 kỹ năng (trả 202 khi PENDING, 200 khi COMPLETED).
- `GET /api/v1/me/chunk-bank`: Lấy sổ tay các chunk cá nhân hóa của người dùng với trạng thái `NEEDS_PRACTICE` hoặc `MASTERED`.
- WebSocket `/api/v1/ws/sessions/{session_id}`: Được nâng cấp chiến lược prompt để kích hoạt tính cách nhân vật (persona), ngữ cảnh và mục tiêu riêng khi loại session là `ROLEPLAY`.

### 3. Test đã thêm và kết quả chạy
Toàn bộ test suite được xây dựng đa tầng và vượt qua 100%:
- Unit tests (`backend/tests/unit/test_scenario_unit.py`): 12/12 tests passed, kiểm thử bảng so khớp chunk (exact match, variation match, approximate match, sai chức năng, không dùng), quy tắc hoàn thành tình huống khi tất cả yêu cầu bắt buộc PASS, và bộ lọc thư viện.
- Integration tests (`backend/tests/integration/test_scenario_api.py`): 7/7 tests passed, kiểm thử tính toàn vẹn của 20 tình huống seed YAML, truy vấn thư viện và lọc phân trang, lưu tiến độ reflex drill, chu trình sống của Roleplay từ khởi tạo đến đánh giá, tính idempotent khi gọi kết thúc lại, cập nhật `chunk_bank`, và kiểm soát quyền truy cập 404 giữa các người dùng.
- Frontend unit tests: 96/96 tests passed trên ChromeHeadless, bao gồm `scenario.service.spec.ts` kiểm tra tham số truy vấn HTTP, khởi tạo roleplay và gửi drill.
- Frontend build (`npm run build`): Thành công không lỗi cảnh báo hay lỗi kiểu dữ liệu.
- Backend code hygiene: `ruff check .` và `mypy app` hoàn toàn sạch trên 78 source files.

### 4. Các quyết định mới và điểm lệch so với SRS/UI
Các quyết định đã được cập nhật vào `docs/decision-log.md` (từ D-35 đến D-38):
- D-35: Thiết kế schema quan hệ chặt chẽ giữa Scenarios, Requirements, Chunks, Drill Attempts, Chunk Bank và Roleplay Evaluations.
- D-36: Triển khai abstraction `TtsProvider` phục vụ phát âm audio chunk, với cơ chế fallback tự động sang Web Speech Synthesis phía client.
- D-37: Thuật toán so khớp Chunk 2 tầng kết hợp Sliding Window Similarity (ngưỡng >= 0.72) và kiểm tra chức năng giao tiếp qua LLM; điều kiện hoàn thành tình huống dựa trên việc 100% mục tiêu bắt buộc đạt PASS.
- D-38: Hợp nhất phiên Roleplay vào kênh WebSocket session lõi của Sprint 3 với chiến lược prompt persona riêng biệt, bảo toàn triết lý Communication-First và cơ chế chống ngắt lời người học.

### 5. Việc chưa làm hoặc nợ kỹ thuật
- Tích hợp cộng điểm kinh nghiệm (XP) vào bảng giao dịch `xp_transactions` và cập nhật Level tổng thể sẽ được thực thi hoàn chỉnh ở Sprint 6 (Gamification Service) theo đúng phạm vi phân bổ.
- Tính năng Spaced Repetition (ôn tập ngắt quãng) cho các chunk trong `chunk_bank` sẽ được mở rộng trong các sprint tiếp theo khi module Lộ trình học tập (Roadmap) đi vào hoạt động.

### 6. Câu hỏi cần chủ dự án quyết định
- Đối với các chunk trong `chunk_bank`, chủ dự án có muốn quy định số lần làm đúng liên tiếp (ví dụ 3 lần đạt PASS) trước khi chuyển trạng thái từ `NEEDS_PRACTICE` sang `MASTERED`, hay chỉ cần 1 lần đạt điểm cao trong bài Roleplay là đủ?
- Về âm thanh của các tình huống nơi công sở (Workplace), hiện tại hệ thống sử dụng giọng đọc chuẩn US; dự án có mong muốn mở rộng thêm tùy chọn giọng Anh - Anh (British English) hoặc Anh - Úc (Australian English) cho các tình huống du lịch và công việc trong tương lai hay không?
