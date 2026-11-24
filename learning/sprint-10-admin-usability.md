# Sprint 10 — Rút ngắn luồng xuất bản

Một nút trong UI có thể thực hiện hai lần ghi độc lập. Trình soạn giữ lại ID và revision ngay sau khi lưu nháp. Nếu bước xuất bản thất bại, lần thử tiếp theo dùng bản nháp đó để tránh tạo bài trùng. Kiểm tra trên frontend giúp người biên tập tìm lỗi sớm. Backend vẫn quyết định có được xuất bản hay không.

Checklist dùng các đường dẫn trường giống lỗi API. Với lỗi trong cụm từ, Angular chuyển bước, mở đúng cụm và đặt focus sau khi render. Ca Playwright chủ động trả lỗi ở lần xuất bản đầu để kiểm tra cả việc đưa focus và dùng lại bản đã lưu.

Ở màn hình hẹp, bảng bài học và tài khoản xếp mỗi hàng thành một nhóm thông tin. Vai trò bảng vẫn được khai báo để giữ ngữ nghĩa cho công nghệ hỗ trợ.

Xem [hướng dẫn sử dụng Admin](../docs/admin-scenarios.md).
