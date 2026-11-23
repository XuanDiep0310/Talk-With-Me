# Quản trị bài học tình huống

## Triển khai và quyền truy cập

Áp dụng `alembic upgrade head` từ thư mục `backend` trước khi cập nhật ứng dụng. Migration `0008_scenario_admin` giữ ID bài và cụm từ hiện có. Sprint 9 bổ sung `0009_scenario_categories` cho danh mục nhóm chủ đề và `0010_admin_accounts` cho nhật ký quản trị tài khoản và phiên bản đăng nhập. Trên môi trường mới, chạy `python -m scripts.seed` để nạp dữ liệu khởi tạo. Seed bài học chỉ thêm các slug còn thiếu.

Admin đã có quyền có thể cấp hoặc thu hồi quyền ở **Tài khoản**. Để cấp tài khoản quản trị đầu tiên hoặc phục hồi quyền vận hành, chạy các lệnh từ `backend` với cấu hình DB của môi trường. Dùng UUID của tài khoản hiện có.

```bash
python -m scripts.admin_role grant <user-uuid>
python -m scripts.admin_role revoke <user-uuid>
```

Với Docker Compose, chạy lệnh trong container backend. Ví dụ `docker compose exec backend python -m scripts.admin_role grant <user-uuid>`.

Tài khoản được cấp quyền mở `/admin` bằng luồng đăng nhập hiện có. Nếu đã đăng nhập lúc quyền thay đổi, tải lại trang để cập nhật giao diện. API kiểm tra vai trò trong PostgreSQL trên mỗi request nên token đang còn hạn cũng mất quyền admin sau khi thu hồi.

## Biên tập và xuất bản

1. Mở **Bài học** và chọn **Tạo bài học**. Mã đường dẫn được gợi ý từ tiêu đề tiếng Việt và có thể sửa.
2. Soạn qua ba bước **Thông tin chung**, **Cụm từ** và **Yêu cầu roleplay**. Có thể nhập chủ đề rồi chọn **Tạo bài bằng AI**, hoặc gợi ý đáp án nhiễu ngay tại mỗi cụm từ. Khi dùng AI, kiểm tra nội dung và độ phù hợp với CEFR trước khi lưu.
3. Mở **Xem trước giao diện người học** ở bất kỳ bước nào. Sau khi kiểm tra checklist, chọn **Lưu bản nháp**, rồi chọn **Xuất bản**. Mục lục và các lượt luyện mới chỉ dùng bài đã xuất bản.
4. Để thay bài đã xuất bản, **Nhân bản** sang mã đường dẫn mới, sửa bản nháp, xuất bản và kiểm tra bản mới từ giao diện học viên. Sau đó dùng **Ẩn bài học** cho bài cũ. Bản nhân có tiến độ riêng. Lịch sử, kết quả và sổ tay cũ tiếp tục gắn với bài gốc.
5. Để đưa một bài đã ẩn trở lại thư viện, lọc trạng thái **Đã ẩn**, mở bài và chọn **Khôi phục bài học**. Ẩn bài thay thế nếu chỉ muốn hiển thị một bài.

Nếu thao tác báo dữ liệu đã thay đổi, giữ lại các phần đang nhập rồi tải lại bài để kiểm tra nội dung người khác vừa lưu. Tại staging, xác nhận các bước xuất bản, ẩn và khôi phục bằng một tài khoản admin và một tài khoản học viên trước khi cấp quyền ở production.

## Tổng quan, nhóm chủ đề và tài khoản

`/admin` hiển thị số tài khoản, số buổi luyện đã kết thúc và số bài theo trạng thái. Hai chỉ số gần đây dùng cửa sổ 7 ngày tính theo UTC. Tại **Bài học**, nhấn trạng thái để lọc, hoặc tìm bằng tên và mã đường dẫn. Từng dòng có xem nhanh, nhân bản và đổi trạng thái.

Tại **Nhóm chủ đề**, admin có thể thêm nhóm, đổi tên hiển thị và xóa nhóm trống. Mã nhóm giữ ổn định sau khi tạo. Nhóm đang được bất kỳ bài nào tham chiếu cần giữ lại để bảo toàn lịch sử.

Tại **Tài khoản**, tìm theo tên hoặc email và mở thao tác cấp quyền, thu hồi quyền, khóa hoặc mở khóa. Thao tác trên chính tài khoản cần một admin khác xác nhận. Khi khóa, các token hiện tại mất quyền. Sau khi mở khóa, tài khoản cần đăng nhập lại. Kết nối thoại đã được thiết lập có thể tiếp tục tới khi ngắt kết nối.

## Cấu hình AI

Dùng `LLM_PROVIDER=gemini` cùng `LLM_API_KEY` và `LLM_MODEL`, hoặc `LLM_PROVIDER=groq` cùng `GROQ_API_KEY`. Môi trường phát triển và Playwright dùng `LLM_PROVIDER=fake`. Chức năng sinh nội dung chỉ điền biểu mẫu. Lỗi provider hoặc dữ liệu không hợp lệ được trả về để admin giữ và tiếp tục sửa bản đang soạn.

Gemini mặc định dùng `gemini-3.5-flash-lite`. Kiểm tra biến `LLM_MODEL` nếu môi trường đang ghim một model cũ. Xem [danh mục Gemini](https://aistudio.google.com/docs/models), [Gemini generateContent](https://aistudio.google.com/api-reference/generate-content) và [chế độ JSON của Groq](https://console.groq.com/docs/structured-outputs).

## API và dữ liệu

Các thao tác dùng `/api/v1/admin/scenarios`, được mô tả trong [đặc tả API](API_SPEC_PART2.md) và [OpenAPI](../openapi/openapi.json). Trạng thái xuất bản lưu ở `scenarios.status` và số phiên bản chỉnh sửa lưu ở `scenarios.revision`. Bảng `scenario_admin_audit` ghi hành động, ID bài, ID người thực hiện, thời điểm UTC và `traceId` cùng giao dịch với cập nhật bài.

Hạ migration trên DB kiểm thử làm mất vai trò, trạng thái xuất bản và nhật ký biên tập. Khi cần quay lui trên một môi trường có nội dung thật, chuẩn bị snapshot trước khi triển khai. Dùng snapshot và phiên bản ứng dụng tương ứng để giữ nhất quán khả năng hiển thị bài học.

## Kiểm thử cục bộ

Cài phụ thuộc Playwright bằng `npm ci` ở gốc repo và cài Chromium bằng `npx playwright install chromium`, hoặc đặt `PLAYWRIGHT_CHANNEL=chrome` khi đã có Chrome. Luồng admin cần DB PostgreSQL riêng tên `talkwithme_admin_e2e` trên localhost, đã chạy migration và seed. Chạy backend ở cổng 8000 với Redis thử nghiệm và các provider giả lập. Chạy frontend ở cổng 4200. Dùng cùng `DATABASE_URL` cho backend và lệnh kiểm thử.

```bash
RUN_ADMIN_E2E=true npm run test:e2e -- e2e/admin-scenarios.spec.ts
```

Trong PowerShell, đặt `$env:RUN_ADMIN_E2E = 'true'` trước khi chạy lệnh npm. Bài test tạo hai tài khoản thử nghiệm và dùng CLI để cấp quyền cho tài khoản admin.

Nếu cổng mặc định đang được dùng, đặt `PLAYWRIGHT_BASE_URL` cho URL Angular và `PLAYWRIGHT_API_URL` cho URL FastAPI có hậu tố `/api/v1`. Thêm origin frontend vào CORS backend thử nghiệm.
