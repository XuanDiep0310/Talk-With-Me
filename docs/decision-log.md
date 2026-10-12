# Decision Log — TalkWithMe

Ghi lại mọi quyết định kỹ thuật và thiết kế quan trọng, đặc biệt những nơi SRS/UI mâu thuẫn hoặc chưa rõ. Nguồn sự thật mới nhất khi tài liệu mâu thuẫn.

| ID | Chủ đề | Phương án đã chọn | Sprint | Trạng thái |
|---|---|---|---|---|
| D-01 | Quy tắc XP | Bảng cấu hình `xp_rules`, seed theo SRS (Daily Mission 50, Scenario 100, Coach 100, Room 100, Streak bonus 20). Số trên UI chỉ là dữ liệu hiển thị lấy từ cấu hình | — | PROPOSED |
| D-02 | Thăng level | Theo SRS 3.4 (điểm, số session, số scenario, điều kiện kỹ năng tối thiểu). XP không dùng đơn độc. API trả về từng điều kiện và mức hiện tại để UI vẽ thanh tiến độ | — | PROPOSED |
| D-03 | Số tình huống | Seed 20 tình huống, 5 tình huống mỗi nhóm trong 4 nhóm | — | PROPOSED |
| D-04 | Mục tiêu và kỹ năng cần cải thiện | Chọn nhiều, lưu dạng mảng (`goals[]`, `weak_points[]`) | — | PROPOSED |
| D-05 | Tính năng ngoài SRS | Huy hiệu, thông báo, cài đặt: làm bản đơn giản. Roadmap: endpoint sinh theo luật, làm ở Sprint 8 | — | PROPOSED |
| D-06 | STT | Client gửi audio qua WebSocket tới backend, backend proxy sang nhà cung cấp STT sau interface `SttProvider`. Không lưu audio thô | — | PROPOSED |
| D-07 | Voice Room | LiveKit làm SFU, backend cấp token và quản lý trạng thái qua `VoiceRoomProvider` | — | PROPOSED |
| D-08 | Voice test và mic | Backend làm API thật. Frontend có công tắc mock cho dev | — | PROPOSED |
| D-09 | Múi giờ | Mỗi user có `timezone` (mặc định `Asia/Ho_Chi_Minh`); streak, mission, nhắc nhở tính theo ngày địa phương của user | — | PROPOSED |
| D-10 | Điểm tổng khi thiếu chỉ số | Nếu thiếu 1 trong 5 chỉ số, tính lại trọng số trên các chỉ số còn lại và gắn `partial=true`; thiếu từ 2 chỉ số trở lên thì điểm tổng là N/A | — | PROPOSED |
| D-11 | Cấu trúc thư mục backend | Giữ cấu trúc flat (`app/models/`, `app/repositories/`, `app/services/`, `app/api/v1/endpoints/`) thay vì chuyển sang module-per-domain như AGENTS.md mô tả, vì codebase còn nhỏ. Sẽ refactor sang module khi cần ở Sprint sau. | 1 | DECIDED |
| D-12 | AI voice setting | AGENTS.md chỉ định `female/male` nhưng frontend mock có thêm `neutral`. Chọn theo AGENTS.md: chỉ `female` và `male`. Frontend cập nhật bỏ `neutral`. | 1 | DECIDED |
| D-13 | Avatar upload Sprint 1 | Endpoint `POST /me/avatar` nhận multipart file, lưu qua `StorageProvider`. Dev dùng `FakeStorageProvider` lưu local disk vào `uploads/avatars/`. Avatar URL trả về là đường dẫn tương đối qua `/api/v1/static/`. | 1 | DECIDED |
| D-14 | Refresh token storage Frontend | `access_token` lưu trong memory (JavaScript variable). `refresh_token` lưu trong `localStorage` (chấp nhận XSS risk ở MVP vì không có HttpOnly cookie setup phức tạp). Cần upgrade lên HttpOnly cookie ở Phase 2. | 1 | DECIDED |
| D-15 | Google OAuth Frontend | Sprint 1: gọi Google Identity Services JS SDK để lấy ID token, sau đó POST `/auth/google`. Không làm redirect OAuth flow server-side ở Sprint 1. | 1 | DECIDED |
| D-16 | Error response format | Thống nhất format: `{ "code": "SNAKE_UPPER", "message": "...", "traceId": "...", "details": {} }`. Tạo `core/errors.py` để register exception handler toàn cục. | 1 | DECIDED |
| D-17 | Rate limit login | Dùng Redis, key = `rate_limit:login:{email}:{ip}`. Giới hạn 5 lần sai trong 15 phút. Khi vượt: trả 429, body chuẩn với `retryAfter` giây. | 1 | DECIDED |
| D-18 | Password reset token | Lưu `token_hash` (SHA-256 của token ngẫu nhiên 32 bytes) vào `password_reset_tokens`. Token dùng một lần. Luôn trả HTTP 200 cho `/auth/forgot-password` dù email không tồn tại. | 1 | DECIDED |
| D-19 | user_profiles và user_settings quan hệ | Một-một với `users`. Tự động tạo khi tạo user (trong transaction). | 1 | DECIDED |
| D-20 | Thống nhất Stepper Onboarding (Màn 3-11) | UI prototype có số bước không đồng nhất ("Bước x/5" nhảy lung tung giữa voice test và manual). Thống nhất chuẩn 5 bước tuyến tính: Bước 1 (Bắt đầu / Kiểm tra mic), Bước 2 (Voice Test / Chọn Level), Bước 3 (Sở thích), Bước 4 (Mục tiêu), Bước 5 (Kỹ năng cần cải thiện). Thanh tiến độ luôn tăng 20% mỗi bước. | 2 | DECIDED |
| D-21 | Đánh giá Level tự động (Placement Test) | Dùng hàm thuần `estimate_level` kết hợp trọng số heuristic: Độ lưu loát (50%), STT confidence (30%), Tốc độ phản hồi (20%). Nếu đủ điều kiện (>= 3 câu trả lời, >= 30 từ), kết hợp 30% trọng số từ gợi ý của LLM. Khi thiếu dữ liệu (< 3 câu hoặc < 30 từ): không đoán bừa (AGENTS.md §8 rule 1), gán tạm A1, cờ `needs_reassessment=true`, trả `is_insufficient_data=true`. | 2 | DECIDED |
| D-22 | Onboarding Guard & Routing | Người dùng chưa hoàn thành onboarding (`onboarding_completed_at == null`) bị chặn không cho vào các màn dashboard/học tập và chuyển hướng về `/onboarding`. Người dùng đã hoàn thành onboarding bị chặn không cho vào lại `/onboarding` và chuyển tiếp đến `/dashboard`. | 2 | DECIDED |
| D-23 | Dev Mock Switch cho Voice Test (D-08) | Thêm công tắc checkbox "Dev Mock Mode" trên thanh header màn Onboarding để chuyển đổi giữa giả lập micro/audio STT và gọi mediaDevices getUserMedia thật. Hợp đồng backend giữ nguyên STT thật/fake theo cấu hình backend `STT_PROVIDER`. | 2 | DECIDED |
| D-24 | Adaptive Placement Test (Phase 2) | Chuyển bộ câu hỏi cố định sang mô hình phân tầng (Tier 1: A1-A2, Tier 2: B1-B2, Tier 3: C1). Thuật toán tự động tăng/giảm độ khó dựa trên kết quả câu trước và dừng sớm khi hội tụ level. | 2 | PROPOSED |
| D-25 | Nhà cung cấp STT & TTS Miễn phí | Client ưu tiên dùng Web Speech API (nhanh, 0đ); Backend dev dùng Groq Cloud Whisper API hoặc faster-whisper (open-source); TTS dùng Web Speech Synthesis trên client và edge-tts trên server. | 2 | PROPOSED |
| D-26 | Phát lại âm thanh người dùng & AI | Lưu tạm audio Blob của người học trong bộ nhớ Client (không lưu file thô lên server - tuân thủ Rule 3) để hiển thị loa phát lại nguyên văn giọng thật; Phản hồi của AI phát bằng Web Speech Synthesis/edge-tts. | 2 | PROPOSED |
