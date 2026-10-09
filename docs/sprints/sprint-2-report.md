# Sprint 2 Report — Onboarding & Placement Test

## 1. Hoàn thành so với mục tiêu

Sprint 2 đã hoàn thành toàn bộ mục tiêu đề ra cho luồng Onboarding & Placement Test theo đúng yêu cầu F-00 (US-00) và UI màn 3 đến 11:
- **Backend:**
  - Mở rộng bảng `user_profiles` với các trường: `level_source`, `needs_reassessment`, `onboarding_completed_at`.
  - Tạo bảng `placement_tests`, `placement_answers` (hỗ trợ lưu transcript, confidence, thời lượng nói, độ trễ và ràng buộc duy nhất `request_id` đảm bảo tính idempotent), và bảng audit log `level_history`.
  - Danh mục onboarding (Interests, Goals, Weak Points, Questions) được cấu hình và seed chuẩn hóa.
  - Cài đặt thuật toán thuần `estimate_level(features)` kết hợp đặc trưng phát âm/phản xạ với đánh giá LLM, xử lý nghiêm ngặt trường hợp thiếu dữ liệu (gán A1 + `needs_reassessment=true`, không đoán bừa).
  - Cung cấp đầy đủ 7 endpoints onboarding và cập nhật lại endpoint `GET /me` trả về thông tin hồ sơ học tập.
  - Xuất file hợp đồng OpenAPI `openapi/openapi.json` mới nhất.
- **Frontend:**
  - Hoàn thiện luồng giao diện Onboarding (Màn 3-11) hỗ trợ cả 2 nhánh: Voice Test và Tự chọn level.
  - Tích hợp công tắc Dev Mock Mode (D-08) cho phép kiểm tra micro và voice test giả lập hoặc dùng thiết bị thật.
  - Thống nhất thanh Stepper chuẩn 5 bước rõ ràng và mượt mà (D-20).
  - Thiết lập Guard 2 chiều: ngăn người chưa onboarding vào dashboard, và ngăn người đã hoàn tất vào lại onboarding.
  - Hiển thị đầy đủ sở thích và mục tiêu học tập trong màn hồ sơ cá nhân (Màn 26).
- **Test:**
  - Viết 22 unit tests cho thuật toán đánh giá level và validation tùy chọn.
  - Viết 7 integration tests bao phủ đầy đủ các kịch bản: luồng Voice Test hoàn chỉnh, luồng tự chọn level, ca thiếu dữ liệu gán A1, từ chối thiếu tùy chọn, tính idempotent khi gọi complete 2 lần, và bảo mật kiểm tra truy cập tài nguyên của người khác trả về 404.
  - Viết 2 kịch bản E2E Playwright cho cả 2 nhánh Onboarding.
- **Tài liệu hóa:**
  - Ghi lại toàn bộ kiến thức kỹ thuật vào `learning/sprint-2-onboarding-placement.md`.
  - Cập nhật nhật ký quyết định `docs/decision-log.md` (các quyết định D-20 đến D-23).

## 2. Danh sách Endpoint mới hoặc thay đổi

- `GET /api/v1/onboarding/options`: Trả về danh mục các sở thích, mục tiêu, kỹ năng, level và câu hỏi kiểm tra.
- `PUT /api/v1/me/preferences`: Lưu các lựa chọn sở thích, mục tiêu, kỹ năng của người dùng (yêu cầu tối thiểu 1 lựa chọn cho mỗi nhóm).
- `POST /api/v1/placement-tests`: Khởi tạo phiên làm bài kiểm tra Placement Test.
- `POST /api/v1/placement-tests/{id}/answers`: Nộp câu trả lời âm thanh/transcript (idempotent qua `requestId`).
- `POST /api/v1/placement-tests/{id}/complete`: Hoàn tất bài test và chạy thuật toán tính điểm đề xuất Level.
- `PUT /api/v1/me/level`: Tự chọn hoặc gán Level khởi điểm cho tài khoản (ghi nhận vào `level_history`).
- `POST /api/v1/me/onboarding/complete`: Đánh dấu hoàn tất quá trình onboarding (idempotent).
- `GET /api/v1/me`: Cập nhật schema trả về đầy đủ `cefrLevel`, `levelSource`, `needsReassessment`, `interests`, `goals`, `weakPoints`, `onboardingCompletedAt`.

## 3. Test đã thêm và kết quả chạy

- **Unit tests (`tests/unit/test_onboarding_unit.py`):** 22 tests Passed 100% (kiểm thử ma trận bảng điểm cho mọi level A1–C1, kiểm thử ca thiếu từ / thiếu câu, kiểm thử validation request).
- **Integration tests (`tests/integration/test_onboarding_api.py`):** 7 tests Passed 100% trên SQLite in-memory AsyncSession.
- **Toàn bộ backend test suite:** 89 passed (bao gồm cả các test auth/health từ sprint trước).
- **Frontend build & lint:** `ng build` và `eslint .` thành công 100%, không có lỗi type hay cú pháp.
- **E2E test suite (`e2e/onboarding.spec.ts`):** Đã bổ sung kịch bản kiểm tra cả 2 nhánh (Voice Test và Self-selected) kết hợp xác minh Guard.

## 4. Các quyết định mới và điểm lệch so với SRS/UI

- **D-20 (Thống nhất Stepper):** Do các màn UI từ màn 3 đến 11 có số bước ghi không đồng nhất ("Bước 1/5", "Bước 2/5", "Bước 3/5" bị trùng lặp ở một số màn phụ), hệ thống chuẩn hóa Stepper về 5 bước tuyến tính: 1. Bắt đầu/Kiểm tra mic $\rightarrow$ 2. Xác định Level $\rightarrow$ 3. Sở thích $\rightarrow$ 4. Mục tiêu $\rightarrow$ 5. Kỹ năng cần cải thiện.
- **D-21 (Đánh giá Level tự động):** Kết hợp trọng số giữa Fluency (50%), STT Confidence (30%), Tốc độ phản xạ (20%) với gợi ý của LLM (30%). Xử lý triệt để ca thiếu dữ liệu bằng cách gán tạm A1 và gắn cờ `needs_reassessment=true`.
- **D-22 (Onboarding Guard):** Áp dụng bảo vệ định tuyến 2 chiều để đảm bảo trạng thái người dùng luôn nhất quán.
- **D-23 (Dev Mock Switch):** Bổ sung công tắc chuyển đổi giả lập mic/voice test trên giao diện Onboarding để phục vụ phát triển thuận tiện khi chưa kết nối thiết bị mic hoặc dịch vụ STT thật.

## 5. Việc chưa làm hoặc nợ kỹ thuật

- Provider STT thật (Google Cloud Speech hoặc Azure Speech) sẽ được hoàn thiện cùng kết nối WebSocket ở các Sprint sau (AI Coach và Scenario). Hiện tại hệ thống vận hành trơn tru với `FakeSttProvider` và `FakeLlmProvider`.
- Chưa cấu hình Spaced Repetition (thuộc phạm vi các sprint sau).

## 6. Câu hỏi cần chủ dự án quyết định

- Hiện tại câu hỏi Placement Test đang gồm 5 câu hỏi cố định được seed trong cấu hình. Trong tương lai (Phase 2), PO có muốn phát triển tính năng Adaptive Placement Test (câu hỏi sau tự động tăng hoặc giảm độ khó dựa trên câu trả lời trước) hay không?
