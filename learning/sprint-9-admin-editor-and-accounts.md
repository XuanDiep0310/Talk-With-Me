# Sprint 9 — Trình soạn bài và quản lý tài khoản

Form Angular giữ một bản nháp xuyên ba bước. Khi lưu, các ô danh sách được cắt khoảng trắng và bỏ mục rỗng. Checklist hiển thị thiếu sót theo từng cụm, còn backend kiểm tra lại trước khi xuất bản. Hộp xem trước truyền bản nháp vào component học viên ở chế độ xem và chặn thao tác bắt đầu luyện tập.

Ngay khi truy vấn tìm kiếm đổi, danh sách hủy lượt tra trước bằng RxJS `switchMap`. Khoảng chờ 300 ms giảm số request khi gõ. Bộ đếm được tính tại DB trước khi áp dụng trạng thái và phân trang nên dùng được cho tất cả tab.

Gemini và Groq nhận yêu cầu hệ thống riêng với dữ liệu chủ đề. Backend kiểm tra JSON bằng Pydantic và tái sử dụng điều kiện xuất bản. Kết quả trở về biểu mẫu để admin duyệt. Provider Fake cho phép kiểm tra cả luồng mà không gửi dữ liệu ra ngoài.

Thay đổi tài khoản khóa các hàng admin và tài khoản đích theo thứ tự ID, đọc lại quyền rồi ghi audit cùng transaction. Tăng phiên bản đăng nhập khi khóa làm token cũ mất hiệu lực cả sau khi mở khóa. Truy vấn đếm chỉ tính phiên đã có thời điểm kết thúc.

Xem [hướng dẫn quản trị chính thức](../docs/admin-scenarios.md) và [decision log](../docs/decision-log.md).
