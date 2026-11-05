# Báo cáo Sprint 6: Gamification, Tiến độ & Dashboard Thống nhất

Sprint 6 đã hoàn thành toàn diện các mục tiêu đặt ra cho hệ sinh thái Gamification và Tiến độ học tập của hệ thống TalkWithMe. Hệ thống đã hiện thực hóa đầy đủ quy tắc tính điểm kinh nghiệm (XP) qua sổ cái giao dịch bất biến, cập nhật chuỗi streak theo múi giờ địa phương kèm cron kiểm tra qua ngày, cơ chế sinh và nhận thưởng nhiệm vụ hàng ngày (Daily Missions), hệ thống huy hiệu (Badges) tự động đánh giá, thăng hạng Level CEFR đa điều kiện theo Bảng 3.4 (D-02), cùng các màn hình Dashboard, Tiến độ, Lịch sử và Thành tích hiển thị hoàn toàn bằng số liệu thật.

### 1. Những gì đã hoàn thành so với mục tiêu
Về mặt backend, kiến trúc sổ cái bất biến đã được thiết lập qua migration Alembic 0006 gồm 8 bảng: `xp_rules`, `xp_transactions`, `gamification_profiles`, `mission_definitions`, `user_daily_missions`, `badge_definitions`, `user_badges` và `notifications`, cùng việc mở rộng `level_history`. Đã seed thành công 5 quy tắc XP (tuân thủ D-01), 4 nhiệm vụ hàng ngày và 6 huy hiệu thành tích chuẩn UI. Cơ chế Domain Event Listener đã đăng ký lắng nghe `FeedbackGenerated`, `RoleplayEvaluated` và sẵn sàng cho `RoomSessionCompleted` của Sprint 7; mọi giao dịch XP được bảo đảm tính idempotent qua khóa `<rule>:<source_id>` và ràng buộc unique, đồng thời tuân thủ tuyệt đối quy tắc không cộng XP cho các phiên thiếu dữ liệu (`INSUFFICIENT_DATA`). Thuật toán Streak (D-09 & D-39) tính theo múi giờ người dùng (`user_profiles.timezone`), cộng thưởng streak một lần duy nhất trong ngày địa phương và quét reset về 0 qua cron job khi người dùng bỏ lỡ ngày hôm qua. Tiến trình thăng hạng level kiểm tra nghiêm ngặt 4 điều kiện của Bảng 3.4 (Overall score trung bình N session gần nhất, số session đủ điều kiện, số tình huống khác nhau đã hoàn thành, và ngưỡng kỹ năng tối thiểu cho B2/C1), bảo đảm bất biến không bao giờ hạ level, ghi nhận audit trail vào `level_history` và gửi thông báo chúc mừng. Thuật toán so sánh kỹ năng ưu tiên khoảng cách 31 đến 60 ngày hoặc fallback 3 session đầu tiên.

Về mặt frontend, các màn hình Dashboard (Màn 12 & 13), Tiến độ (Màn 22, 23, 24) và Thành tích (Màn 25) đã được kết nối trực tiếp với backend qua `GamificationService`. Trên thanh Header, chip streak hiển thị chuỗi ngày liên tục kèm biểu tượng ngọn lửa và chuông thông báo có dropdown tương tác (đếm số chưa đọc, đọc từng mục, đánh dấu tất cả đã đọc). Trên Sidebar, chip Level và XP hiển thị thanh tiến độ thăng hạng trực quan theo các điều kiện của D-02. Màn hình Dashboard cung cấp lời chào cá nhân hóa, điểm giao tiếp tổng hợp, 4 nhiệm vụ ngày kèm nút nhận thưởng tức thì, biểu đồ 5 kỹ năng (gắn nhãn tham khảo cho Phát âm theo Rule 2), 5 buổi luyện gần đây và thẻ khích lệ tính theo khoảng cách thăng cấp. Màn hình Tiến độ chia làm 3 tab: Kỹ năng (so sánh điểm trước/hiện tại và nhãn trạng thái), Lịch sử (phân trang cursor cho từng loại phiên luyện), và Lộ trình (bảng tiêu chí thăng hạng A1 đến C1). Màn hình Thành tích hiển thị 6 huy hiệu với tiến độ hoặc ngày nhận, danh sách nhiệm vụ ngày và lịch sử biến động XP từ sổ cái.

### 2. Danh sách endpoint mới hoặc thay đổi
- `GET /api/v1/dashboard`: Lấy thông tin tổng hợp cho Dashboard (lời chào, điểm giao tiếp, XP, streak, level, nhiệm vụ ngày, 5 kỹ năng, 5 buổi gần đây, thẻ khích lệ).
- `GET /api/v1/progress/summary`: Lấy tóm tắt tiến độ học tập kèm mức độ thay đổi điểm số trong 30 ngày qua và tổng số phút luyện tập.
- `GET /api/v1/progress/skills`: Lấy dữ liệu 5 kỹ năng giao tiếp với điểm hiện tại, điểm trước (31-60 ngày hoặc 3 session đầu), độ chênh lệch, nhãn trạng thái và cờ tham khảo.
- `GET /api/v1/progress/history`: Truy vấn lịch sử các phiên học với bộ lọc loại session và phân trang dạng con trỏ (cursor).
- `GET /api/v1/gamification/summary`: Lấy thông tin gamification tổng quát và chi tiết các điều kiện thăng cấp theo D-02.
- `GET /api/v1/missions/today`: Lấy danh sách nhiệm vụ hôm nay và tự động khởi tạo an toàn đồng thời cho lần truy cập đầu tiên trong ngày.
- `POST /api/v1/missions/{id}/claim`: Nhận thưởng XP cho nhiệm vụ đã hoàn thành, cập nhật sổ cái và tổng XP lưu sẵn.
- `GET /api/v1/badges`: Lấy danh sách toàn bộ huy hiệu cùng trạng thái đạt được, ngày trao và tiến độ hiện tại.
- `GET /api/v1/xp-history`: Truy vấn sổ cái giao dịch XP theo thứ tự thời gian mới nhất.
- `GET /api/v1/notifications`: Lấy danh sách thông báo của người dùng.
- `PATCH /api/v1/notifications/{id}/read`: Đánh dấu một thông báo đã đọc.
- `PATCH /api/v1/notifications/read-all`: Đánh dấu toàn bộ thông báo của người dùng đã đọc.
- `PATCH /api/v1/me/settings`: Bổ sung cập nhật múi giờ (`timezone`) cho hồ sơ người dùng phục vụ tính toán streak chính xác theo D-09.

### 3. Test đã thêm và kết quả chạy
Hệ thống kiểm thử đã được bổ sung toàn diện trên cả backend và frontend:
- Unit tests backend (`backend/tests/unit/test_gamification_unit.py`): 9 test suites với hàng chục test cases dạng bảng kiểm thử chuỗi streak (cùng ngày, liền kề, ngắt quãng, biên múi giờ 23:59 và 00:01 giờ Việt Nam), tính idempotent của XP, thăng hạng level theo bảng 3.4 cho từng cấp độ (A1 đến C1) cùng các ca biên (thiếu session, thiếu scenario, kỹ năng dưới ngưỡng, không bao giờ hạ level), đánh giá từng huy hiệu, và thuật toán xác định điểm baseline trước đó. Đạt độ phủ trên 92% cho module gamification.
- Integration tests backend (`backend/tests/integration/test_gamification_api.py`): 5 test suites kiểm tra chu trình từ domain event đến sổ cái bất biến (`total_xp == sum(transactions)`), tính an toàn đồng thời khi gọi `ensure_daily_missions`, phát lại event không cộng trùng XP, phiên `INSUFFICIENT_DATA` không sinh XP, và phân quyền truy cập. Toàn bộ backend vượt qua 265 passed, 1 skipped (0 failures).
- Backend hygiene: `ruff check app tests` và `mypy app` sạch hoàn toàn không có cảnh báo hay lỗi kiểu dữ liệu trên 87 source files.
- Alembic migration: `alembic upgrade head` và `alembic downgrade -1` chạy thành công trên database PostgreSQL trống.
- Frontend unit tests: 104/104 tests passed trên ChromeHeadless, bao gồm `gamification.service.spec.ts` kiểm thử toàn bộ các lời gọi API của dashboard, progress, missions, badges, XP ledger và notifications.
- Frontend build (`npm run build`): Biên dịch thành công trơn tru trong 4.8 giây.
- E2E tests: Thêm `e2e/gamification.spec.ts` mô phỏng hành trình hoàn thành buổi luyện nói với AI Coach và kiểm tra dữ liệu cập nhật tức thì trên Dashboard, Thành tích và Tiến độ.

### 4. Các quyết định mới và điểm lệch so với SRS/UI
Các quyết định kỹ thuật mới đã được cập nhật vào `docs/decision-log.md`:
- D-39: Quy định cập nhật Streak ngay ở hoạt động hợp lệ đầu tiên trong ngày theo giờ địa phương của user (`user_profiles.timezone`, mặc định `Asia/Ho_Chi_Minh`), cộng thưởng streak với idempotency key `STREAK_BONUS:<user_id>:<date>`, và tiến hành reset streak về 0 thông qua background cron cho những người dùng bỏ lỡ ngày hôm qua.
- Thẻ khích lệ (Motivational Card) trên Dashboard được sinh theo luật dựa trên khoảng cách tới mốc CEFR tiếp theo thay vì văn bản tĩnh, thúc đẩy người học duy trì động lực.

### 5. Việc chưa làm hoặc nợ kỹ thuật
- Tích hợp sự kiện `RoomSessionCompleted` với phòng Voice Room LiveKit sẽ được kích hoạt ở Sprint 7 khi xây dựng tính năng Community Room.
- Tính năng Nhắc nhở thông minh và Lộ trình học tập sinh tự động bằng thuật toán (Roadmap Engine) được xếp lịch triển khai ở Sprint 8 theo đúng phân bổ dự án.

### 6. Câu hỏi cần chủ dự án quyết định
- Về việc nhận thưởng Daily Missions: Hiện tại hệ thống yêu cầu người học bấm nút "Nhận thưởng" để nhận XP vào sổ cái (tạo cảm giác thành tựu theo UI). Chủ dự án có muốn duy trì nút bấm nhận thưởng này hay muốn hệ thống tự động cộng XP ngay khi điều kiện nhiệm vụ được đáp ứng?
- Về ngưỡng thăng cấp B2 và C1, hiện tại yêu cầu "Mọi kỹ năng >= 60" (với B2) và ">= 75" (với C1) đang tính trên trung bình $N=5$ session gần nhất. Chủ dự án có muốn áp dụng điều kiện này cho cả chỉ số Phát âm (Pronunciation Accuracy) vốn đang ở chế độ "tham khảo" hay tạm thời loại trừ Phát âm khỏi điều kiện tiên quyết cho đến khi nâng cấp mô hình STT chuyên sâu?
