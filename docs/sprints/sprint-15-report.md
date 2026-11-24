# Báo cáo Sprint 15 · Thao tác quản trị

Gamification có thể tạo nhiệm vụ từ sự kiện Coach, Roleplay hoặc streak, và tạo, sửa, bật/tắt huy hiệu theo tiêu chí lưu trong PostgreSQL. Tắt huy hiệu dừng cấp mới. Huy hiệu đã nhận và điều khoản nhiệm vụ đã cấp được giữ lại. Các quy tắc XP sự kiện tiếp tục dùng những sự kiện đã được ứng dụng hỗ trợ.

Chủ đề AI Coach có nút lên/xuống và xóa. API trả xung đột khi chủ đề có phiên liên kết. Chủ đề đã xóa có dấu trong DB để seed giữ quyết định đó.

Hồ sơ học viên có điều chỉnh CEFR kèm lý do, giao dịch XP có mã yêu cầu và kiểm tra số dư, cùng thao tác gửi liên kết đặt lại mật khẩu cho tài khoản dùng mật khẩu. Các thay đổi được ghi kiểm toán. Môi trường kiểm thử dùng provider email giả lập.

Session QA lưu ghi chú và kết quả chấm lại gần nhất cho mỗi phiên đã kết thúc. Kết quả nội bộ được tính bằng số đo còn lưu. Kết quả đã công bố và sổ cái XP giữ nguyên. Ghi chú và kết quả nội bộ chỉ đi qua API Admin.

Các API mới nằm dưới `/api/v1/admin/gamification/{missions,badges}`, `/api/v1/admin/coach-topics/{id}`, `/api/v1/admin/users/{id}` và `/api/v1/admin/sessions/{id}`. D-55 và D-56 ghi các quy tắc triển khai.

Đã chạy 377 ca backend, 116 ca frontend và 2 luồng Playwright. Ruff, mypy, ESLint và Angular build đều qua. Angular vẫn báo cảnh báo kích thước sẵn có của admin.scss. OpenAPI và kiểu Angular đã được tái sinh. Alembic nâng được trên PostgreSQL trống, hạ một bản và nâng lại thành công. Migration cũng đã áp dụng trên PostgreSQL local và đã xác minh frontend cùng API local nhận Sprint 15.
