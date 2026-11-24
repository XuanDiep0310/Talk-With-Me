# Báo cáo Sprint 8 — Admin quản lý bài học tình huống

## Hoàn thành

Khu vực `/admin` có danh sách, tìm kiếm, bộ lọc, trình soạn bài và bản xem trước. Admin có thể lưu nháp, xuất bản, ẩn, khôi phục và nhân bản bài. Backend kiểm tra quyền từ DB, xử lý xung đột revision và ghi nhật ký cho mỗi thay đổi thành công. Ẩn bài chặn lượt luyện mới, còn roleplay đang diễn ra tiếp tục đến phần đánh giá. Lịch sử và sổ tay cụm từ giữ tham chiếu đến bài gốc.

## API

`GET /api/v1/me` và phản hồi cập nhật hồ sơ trả thêm `role`. Cụm `/api/v1/admin/scenarios` hỗ trợ `GET` và `POST` trên danh sách, `GET` và `PUT` trên bài cụ thể, `POST /{id}/duplicate` và `PATCH /{id}/status`. Các điểm mở bài, luyện cụm và tạo roleplay của học viên áp dụng trạng thái xuất bản. OpenAPI đã xuất lại và kiểu TypeScript đã sinh từ hợp đồng.

## Kiểm thử

Đã qua 190 unit test backend, 84 integration test và 111 frontend test. Suite integration gồm kiểm tra phân quyền theo DB, hai lần lưu đồng thời trên PostgreSQL, bảo toàn roleplay và lịch sử sau khi ẩn bài, cùng kiểm thử Schemathesis trên OpenAPI đã xuất. Playwright chạy thành công luồng admin tạo nháp, đổi thứ tự cụm từ trên màn hình hẹp, xuất bản, nhân bản và ẩn bài khi học viên sử dụng thư viện. Ruff, mypy, ESLint, kiểm tra kiểu sinh từ OpenAPI và Angular production build đều đạt.

Đã chạy `upgrade head`, `downgrade -1` và nâng cấp lại trên PostgreSQL kiểm thử. Ca migration có dữ liệu từ revision trước xác nhận tài khoản mặc định là `LEARNER`, bài cũ được xuất bản và ID bài cùng ID cụm từ được giữ nguyên.

## Quyết định và vận hành

D-42 đến D-44 ghi nhận vai trò admin nội bộ, vòng đời bài và seed chỉ bổ sung dữ liệu còn thiếu. SRS đã bổ sung biên tập thủ công. Xem [hướng dẫn vận hành](../admin-scenarios.md) và [bài học kỹ thuật](../../learning/sprint-8-admin-scenario-publishing.md).

## Việc còn lại

Đã xác minh trên môi trường cục bộ. Kiểm tra staging và cấp quyền ở production thuộc đợt phát hành. Các quyết định về phạm vi, phân quyền và cách thay bài đã được chốt trong kế hoạch.
