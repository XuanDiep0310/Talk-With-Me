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
