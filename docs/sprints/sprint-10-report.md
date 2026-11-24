# Báo cáo Sprint 10 — Giảm thao tác trong Admin

Trình soạn đưa đường dẫn, thứ tự, thời lượng và URL âm thanh vào phần nâng cao. Các thao tác chuyển bước, lưu nháp và xem trước nằm ở thanh cuối màn hình. Trình soạn tự đưa focus vào cụm từ hoặc nhiệm vụ vừa thêm, giữ bước khi lưu nháp lần đầu và cảnh báo nếu rời đi khi có thay đổi chưa lưu.

Nút **Xuất bản** kiểm tra nội dung, lưu nháp nếu cần rồi xuất bản bằng revision vừa nhận. Checklist đưa người dùng đến đúng trường hoặc cụm từ. Khi xuất bản thất bại sau khi lưu, lần thử lại dùng bản nháp đã tạo. Bài đã xuất bản có thể tạo bản chỉnh sửa trong một thao tác với đường dẫn tự sinh.

Danh sách bài học đưa bộ lọc phụ vào khu vực có thể mở. Danh sách bài và tài khoản hiển thị theo từng hàng gọn trên điện thoại. Trang nhóm chủ đề chỉ yêu cầu tên khi tạo nhóm. D-48 ghi lại luồng xuất bản. Các thao tác sử dụng API và dữ liệu hiện có.

Đã chạy 192 unit test backend, 87 integration test gồm kiểm thử hợp đồng, 111 frontend test, lint, mypy và Angular production build. Playwright kiểm tra trình soạn ở chiều rộng 390 px, bảo vệ nội dung chưa lưu, chuyển focus khi lỗi, thử lại xuất bản, nhân bản, tạo nhóm bằng tên và tiếp tục ở đúng bước sau khi lưu nháp.

Xem [hướng dẫn sử dụng Admin](../admin-scenarios.md) và [bài học kỹ thuật](../../learning/sprint-10-admin-usability.md).
