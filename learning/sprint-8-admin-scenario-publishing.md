# Sprint 8 — Phân quyền và xuất bản bài học

## Kiểm tra quyền ở đúng nơi

Angular dùng vai trò trong `GET /me` để hiển thị liên kết và điều hướng. Quyết định cho phép thao tác nằm ở dependency `require_admin` trên FastAPI. JWT xác định tài khoản qua `sub`, sau đó backend đọc vai trò hiện tại từ DB. Nhờ vậy, việc chuyển tài khoản về `LEARNER` có hiệu lực trên request kế tiếp ngay cả khi token cũ còn hạn.

## Bảo toàn nội dung của roleplay

WebSocket và bộ chấm đọc bối cảnh, cụm từ và yêu cầu theo ID bài của session. Nếu sửa trực tiếp bài đã xuất bản, người học có thể bắt đầu nói theo yêu cầu cũ rồi được chấm bằng yêu cầu mới. Giữ nội dung sau khi xuất bản cho phép phiên dùng đúng dữ liệu từ khi bắt đầu. Ẩn bài chỉ thay đổi khả năng tìm và bắt đầu lượt luyện mới. Nhân bản cấp ID mới để lịch sử và tiến độ của hai bài được theo dõi độc lập.

## Khóa và phát hiện chỉnh sửa đồng thời

Khi hai admin cùng lưu revision 3, DB khóa hàng bài học để xử lý lần lượt. Lần lưu đầu thành công và tăng revision lên 4. Request còn lại đọc revision 4, nhận `409` và giữ bản đang nhập để người biên tập đối chiếu. Đổi trạng thái cũng kiểm tra revision. Việc bắt đầu roleplay và ghi drill khóa chia sẻ trên bài đã xuất bản cho đến khi bản ghi đầu tiên được lưu. Nhờ vậy, yêu cầu tạo lượt luyện mới và thao tác ẩn bài có thứ tự rõ ràng theo transaction.

## Seed và dữ liệu do admin biên tập

YAML là nguồn của bộ bài khởi tạo. Mỗi lần chạy seed, PostgreSQL chỉ thêm slug còn thiếu bằng `ON CONFLICT DO NOTHING`. Thao tác này tránh việc deploy hoặc chạy seed lần nữa vô tình khôi phục bài đã ẩn. ID do YAML sinh vẫn ổn định trong môi trường mới.

## Các ca kiểm thử đáng giữ

- Cấp và thu hồi quyền rồi gọi API bằng cùng một token để kiểm tra nguồn quyền thực tế.
- Gửi hai lần lưu cùng revision trên PostgreSQL để kiểm tra cả khóa hàng và phát hiện dữ liệu cũ.
- Ẩn bài trong khi phiên roleplay còn mở, sau đó xác nhận lượt luyện mới bị chặn và phiên cũ vẫn có đánh giá.
- Chạy seed lại sau khi ẩn bài và kiểm tra ID, trạng thái, lịch sử cùng sổ tay cụm từ.

Tham khảo [quy trình quản trị chính thức](../docs/admin-scenarios.md) và [decision log](../docs/decision-log.md) cho D-42 đến D-44.
