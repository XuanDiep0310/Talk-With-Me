# Báo cáo Sprint 9 — Nâng cấp trang quản trị

## Hoàn thành

Trình soạn bài có ba bước, tự gợi ý mã đường dẫn từ tiêu đề và dùng các ô riêng cho mục tiêu, biến thể và đáp án nhiễu. Danh sách cụm từ hỗ trợ gập mở và kéo thả, kèm nút sắp xếp dùng được bằng bàn phím. Checklist chỉ rõ phần còn thiếu và bản xem trước dùng giao diện học viên với nội dung đang soạn. AI có thể điền bản nháp và gợi ý đáp án để admin kiểm tra trước khi lưu.

Danh sách bài có tìm kiếm tức thì, tab trạng thái kèm số lượng, xem nhanh, nhân bản và công tắc hiển thị. Admin có thể quản lý nhóm chủ đề, xem số liệu tổng quan, tra tài khoản, đổi quyền và khóa hoặc mở khóa từ giao diện. CLI dùng để cấp quyền admin đầu tiên hoặc phục hồi quyền vận hành.

## API và dữ liệu

`GET /api/v1/admin/scenarios` trả thêm bộ đếm. Bổ sung `POST /generate` và `POST /generate-distractors` dưới đường dẫn đó. Bổ sung `/api/v1/admin/scenario-categories`, `GET /api/v1/admin/users`, `PATCH /api/v1/admin/users/{id}` và `GET /api/v1/admin/overview`. Thư viện học viên đọc tên nhóm từ DB. OpenAPI và kiểu TypeScript đã được cập nhật.

## Kiểm thử

Đã qua 192 unit test backend, 87 integration test và 111 frontend test. Kiểm thử Schemathesis xác nhận hợp đồng OpenAPI. Playwright xác nhận soạn bài trên màn hình hẹp, xem trước dữ liệu chưa lưu, xuất bản, tìm kiếm, xem nhanh, đổi trạng thái, đổi quyền, khóa tài khoản và dùng AI giả lập. Ruff, mypy, ESLint và Angular production build đều đạt.

Đã nâng cấp DB test có dữ liệu Sprint 8. Trên PostgreSQL trống, đã chạy `upgrade head`, hạ hai revision Sprint 9 lần lượt và nâng cấp lại. Tích hợp HTTP Gemini và Groq được kiểm tra bằng transport giả lập.

## Quyết định và việc còn lại

D-45 đến D-47 ghi nhận mã nhóm ổn định, chặn xóa nhóm còn bài, kiểm duyệt nội dung AI trước khi xuất bản và ghi audit khi quản trị tài khoản. Kết nối thoại đã thiết lập có thể tiếp tục tới khi ngắt kết nối. Còn bước kiểm tra bằng khóa Gemini hoặc Groq của môi trường staging khi phát hành. Xem [hướng dẫn vận hành](../admin-scenarios.md) và [bài học kỹ thuật](../../learning/sprint-9-admin-editor-and-accounts.md).
