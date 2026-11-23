# Quản trị bài học tình huống

## Triển khai và quyền truy cập

Áp dụng `alembic upgrade head` từ thư mục `backend` trước khi cập nhật ứng dụng. Migration `0008_scenario_admin` giữ nguyên ID của bài học và cụm từ hiện có, đặt bài cũ ở trạng thái đã xuất bản và đặt tài khoản hiện có ở vai trò học viên. Trên môi trường mới, chạy `python -m scripts.seed` để nạp dữ liệu khởi tạo. Seed bài học chỉ thêm các slug còn thiếu.

Chạy các lệnh sau từ `backend`, với cấu hình cơ sở dữ liệu của môi trường cần cấp quyền. Dùng UUID của tài khoản hiện có.

```bash
python -m scripts.admin_role grant <user-uuid>
python -m scripts.admin_role revoke <user-uuid>
```

Với Docker Compose, chạy lệnh trong container backend. Ví dụ `docker compose exec backend python -m scripts.admin_role grant <user-uuid>`.

Tài khoản được cấp quyền mở `/admin` bằng luồng đăng nhập hiện có. Nếu đã đăng nhập lúc quyền thay đổi, tải lại trang để cập nhật giao diện. API kiểm tra vai trò trong PostgreSQL trên mỗi request nên token đang còn hạn cũng mất quyền admin sau khi thu hồi.

## Biên tập và xuất bản

1. Mở **Quản trị bài học** và chọn **Tạo bài học**. Dùng mã đường dẫn duy nhất gồm chữ thường, số và dấu gạch ngang.
2. Nhập tiêu đề Việt–Anh, bối cảnh, vai trò, mục tiêu, 4–6 cụm từ và ít nhất một yêu cầu roleplay bắt buộc. Mỗi cụm cần nghĩa tiếng Việt, câu mẫu, biến thể và ba đáp án nhiễu cho mỗi chiều dịch.
3. Chọn **Lưu bản nháp**, xem lại bằng **Xem trước bản đã lưu**, rồi chọn **Xuất bản**. Mục lục và các lượt luyện mới chỉ dùng bài đã xuất bản.
4. Để thay bài đã xuất bản, **Nhân bản** sang mã đường dẫn mới, sửa bản nháp, xuất bản và kiểm tra bản mới từ giao diện học viên. Sau đó dùng **Ẩn bài học** cho bài cũ. Bản nhân có tiến độ riêng. Lịch sử, kết quả và sổ tay cũ tiếp tục gắn với bài gốc.
5. Để đưa một bài đã ẩn trở lại thư viện, lọc trạng thái **Đã ẩn**, mở bài và chọn **Khôi phục bài học**. Ẩn bài thay thế nếu chỉ muốn hiển thị một bài.

Nếu thao tác báo dữ liệu đã thay đổi, giữ lại các phần đang nhập rồi tải lại bài để kiểm tra nội dung người khác vừa lưu. Tại staging, xác nhận các bước xuất bản, ẩn và khôi phục bằng một tài khoản admin và một tài khoản học viên trước khi cấp quyền ở production.

## API và dữ liệu

Các thao tác dùng `/api/v1/admin/scenarios`, được mô tả trong [đặc tả API](API_SPEC_PART2.md) và [OpenAPI](../openapi/openapi.json). Trạng thái xuất bản lưu ở `scenarios.status` và số phiên bản chỉnh sửa lưu ở `scenarios.revision`. Bảng `scenario_admin_audit` ghi hành động, ID bài, ID người thực hiện, thời điểm UTC và `traceId` cùng giao dịch với cập nhật bài.

Hạ migration trên DB kiểm thử làm mất vai trò, trạng thái xuất bản và nhật ký biên tập. Khi cần quay lui trên một môi trường có nội dung thật, chuẩn bị snapshot trước khi triển khai. Dùng snapshot và phiên bản ứng dụng tương ứng để giữ nhất quán khả năng hiển thị bài học.

## Kiểm thử cục bộ

Cài phụ thuộc Playwright bằng `npm ci` ở gốc repo và cài Chromium bằng `npx playwright install chromium`, hoặc đặt `PLAYWRIGHT_CHANNEL=chrome` khi đã có Chrome. Luồng admin cần DB PostgreSQL riêng tên `talkwithme_admin_e2e` trên localhost, đã chạy migration và seed. Chạy backend ở cổng 8000 với Redis thử nghiệm và các provider giả lập. Chạy frontend ở cổng 4200. Dùng cùng `DATABASE_URL` cho backend và lệnh kiểm thử.

```bash
RUN_ADMIN_E2E=true npm run test:e2e -- e2e/admin-scenarios.spec.ts
```

Trong PowerShell, đặt `$env:RUN_ADMIN_E2E = 'true'` trước khi chạy lệnh npm. Bài test tạo hai tài khoản thử nghiệm và dùng CLI để cấp quyền cho tài khoản admin.
