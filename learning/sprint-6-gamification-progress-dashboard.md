# Kiến thức kỹ thuật Sprint 6: Gamification, Tiến độ & Dashboard Thống nhất

Tài liệu này tổng hợp các kiến trúc, giải pháp kỹ thuật và bài học thực tế được triển khai trong Sprint 6 cho hệ thống **TalkWithMe**.

---

## 1. Kiến trúc Sổ cái Bất biến (Immutable Ledger) cho XP

### Vấn đề
Trong các ứng dụng Gamification, việc lưu trữ một cột `xp` đơn lẻ trên bảng `users` hoặc `profiles` tiềm ẩn rủi ro nghiêm trọng:
1. **Race Conditions & Inconsistency:** Khi nhiều luồng (hoàn thành session, hoàn thành daily mission, streak bonus) đồng thời cộng điểm, giá trị XP dễ bị ghi đè hoặc tính sai.
2. **Thiếu Audit Trail:** Không có bằng chứng truy vết tại sao user có số XP đó, gây khó khăn cho việc đối soát hoặc rollback khi có sự cố.
3. **Idempotency:** Nếu một event xử lý lại (network retry, worker restart), user có thể bị cộng điểm trùng lặp.

### Giải pháp kiến trúc
Áp dụng mẫu **Double-Entry Ledger Pattern (Sổ cái bất biến)**:
- **`xp_transactions`:** Bảng sổ cái ghi nhận từng biến động XP.
  - Các trường cốt lõi: `amount`, `rule_key`, `source_type`, `source_id`, `idempotency_key`, `created_at`.
  - `idempotency_key` được tạo theo định dạng chuẩn: `<rule_key>:<source_id>` (ví dụ: `COACH_SESSION:uuid-session-1`, `STREAK_BONUS:user-id:2026-11-04`).
  - Ràng buộc cơ sở dữ liệu: `UNIQUE(idempotency_key)` ngăn chặn tuyệt đối việc nhân bản giao dịch dù sự kiện bị phát lại bao nhiêu lần.
- **`gamification_profiles.total_xp`:** Trường cache tổng XP nhằm tối ưu hiệu năng đọc (O(1)).
- **Bất biến bảo vệ (Invariant):**
  $$\text{gamification\_profiles.total\_xp} = \sum \text{xp\_transactions.amount}$$
  Mỗi lần ghi nhận giao dịch mới trong cùng một DB transaction:
  ```python
  # Thêm transaction vào sổ cái
  tx = XpTransaction(...)
  session.add(tx)
  # Cập nhật cached profile
  profile.total_xp += rule.xp_amount
  ```
  Nếu transaction bị duplicate, DB raise UniqueViolation, transaction rollback toàn bộ, không có XP nào bị cộng thừa.

---

## 2. Thuật toán Tính Streak theo Múi giờ Địa phương (D-09, D-39)

### Vấn đề
Múi giờ của server thường là UTC. Tuy nhiên, người học ở Việt Nam (`Asia/Ho_Chi_Minh` = UTC+7) học lúc 23:59 đêm nay và 00:01 sáng mai phải được tính là 2 ngày liên tiếp (streak + 1). Nếu tính theo UTC, cả 2 lượt nói này đều diễn ra vào khoảng 17:00 UTC của cùng ngày, khiến streak không tăng!

### Giải pháp
1. Lưu `timezone` của user trên `user_profiles.timezone` (mặc định `Asia/Ho_Chi_Minh`).
2. Khi có hoạt động đủ điều kiện (`ACTIVE` session hoàn thành, không phải `INSUFFICIENT_DATA`), chuyển đổi thời gian hiện tại (`Clock.now()`) sang ngày địa phương (`local_date`) của user:
   ```python
   def get_user_local_date(utc_now: datetime, tz_name: str) -> date:
       try:
           tz = ZoneInfo(tz_name)
       except Exception:
           tz = ZoneInfo("Asia/Ho_Chi_Minh")
       return utc_now.astimezone(tz).date()
   ```
3. So sánh `local_date` với `profile.last_active_date`:
   - **`local_date == last_active_date`:** Đã hoạt động hôm nay rồi $\rightarrow$ Giữ nguyên streak, không cộng thêm điểm streak bonus.
   - **`local_date == last_active_date + 1 day`:** Hoạt động vào ngày liền kề $\rightarrow$ `current_streak += 1`, cập nhật `best_streak = max(best_streak, current_streak)`. Đồng thời cộng thưởng `STREAK_BONUS` (+20 XP) với idempotency key `STREAK_BONUS:<user_id>:<local_date>`.
   - **`local_date > last_active_date + 1 day`:** Bị đứt chuỗi $\rightarrow$ `current_streak = 1`.
4. **Cron quét nửa đêm (Midnight Sweep):**
   Một background job định kỳ (cron) kiểm tra các user mà ngày địa phương hiện tại đã vượt quá `last_active_date + 1 day` $\rightarrow$ reset `current_streak = 0`.

---

## 3. Hệ thống Thăng hạng Level CEFR Theo Bảng 3.4 & Quyết định D-02

### Nguyên tắc bất biến
- **Không bao giờ hạ level:** Dù học viên có buổi nói điểm thấp, level hiện tại vẫn được bảo lưu (AGENTS.md §8 Quy tắc 4).
- **Đa điều kiện (Multi-criteria):** XP không dùng đơn độc để thăng cấp. Phải thỏa mãn đồng thời:
  1. **Điểm giao tiếp trung bình (Overall Score):** Tính trung bình trên $N$ session hợp lệ gần nhất (mặc định $N=5$).
  2. **Số session hoàn thành:** Tổng số session có kết quả feedback hợp lệ.
  3. **Số tình huống hoàn thành (Distinct Scenarios):** Đếm số kịch bản khác nhau mà học viên đã PASS toàn bộ yêu cầu bắt buộc.
  4. **Ngưỡng kỹ năng tối thiểu:** Đối với B2 ($\ge 60$ mọi kỹ năng) và C1 ($\ge 75$ mọi kỹ năng).

### Bảng tiêu chuẩn thăng cấp (SRS Bảng 3.4)

| Level đích | Overall Score (TB 5 session) | Số session tối thiểu | Số tình huống khác nhau | Kỹ năng tối thiểu |
|:---:|:---:|:---:|:---:|:---:|
| **A2** | $\ge 40$ | $\ge 5$ | $\ge 3$ | Không yêu cầu |
| **B1** | $\ge 55$ | $\ge 10$ | $\ge 5$ | Không yêu cầu |
| **B2** | $\ge 70$ | $\ge 20$ | $\ge 5$ | Không kỹ năng nào $< 60$ |
| **C1** | $\ge 85$ | $\ge 30$ | $\ge 5$ | Không kỹ năng nào $< 75$ |

### Ghi nhận lịch sử thăng hạng & Thông báo
Khi người học đạt đủ các điều kiện của level cao hơn:
1. Cập nhật `users.cefr_level` và `gamification_profiles.current_level`.
2. Tạo bản ghi audit trail trong `level_history` với `from_level`, `to_level`, `reason = "AUTOMATIC_ADVANCEMENT"`.
3. Sinh thông báo chúc mừng trong bảng `notifications`.

---

## 4. Thuật toán So sánh Điểm Kỹ năng Trước và Hiện tại (`prev` vs `current`)

Để người học thấy rõ sự tiến bộ trên tab Kỹ năng (Screen 22):
1. **`current`:** Điểm trung bình của kỹ năng trong các session gần nhất (hoặc session mới nhất).
2. **`prev` (Cột mốc so sánh):**
   - **Ưu tiên 1:** Điểm trung bình của các session diễn ra trong khoảng từ **31 đến 60 ngày trước**.
   - **Ưu tiên 2 (Fallback):** Nếu người học mới tham gia chưa đủ 30 ngày, hệ thống lấy trung bình **3 session hoàn thành đầu tiên** trong lịch sử của họ làm baseline.
   - **Ưu tiên 3:** Nếu vẫn không đủ dữ liệu $\rightarrow$ trả `prev = null` và frontend hiển thị dấu gạch ngang `—` (Tuyệt đối không bịa điểm - Rule 1).

---

## 5. An toàn Đồng thời khi Tạo Nhiệm vụ Hàng ngày (Daily Missions)

### Vấn đề
Khi người dùng mở nhiều tab hoặc app gửi đồng thời nhiều request tới `/dashboard` và `/missions/today` vào lần đầu truy cập trong ngày, nếu dùng logic:
```python
if not exists:
    create_missions()
```
Sẽ xảy ra race condition gây lỗi `IntegrityError: duplicate key value violates unique constraint "uq_user_daily_mission"`.

### Giải pháp
Sử dụng cú pháp **UPSERT / Insert ignore**:
- Bảng `user_daily_missions` có unique constraint: `UNIQUE(user_id, mission_date, mission_id)`.
- Khi khởi tạo:
  ```python
  stmt = insert(UserDailyMission).values(mission_rows)
  stmt = stmt.on_conflict_do_nothing(
      constraint="uq_user_daily_mission"
  )
  await session.execute(stmt)
  ```
- Kết hợp với việc tương thích dialect SQLite (cho test nhanh trong bộ nhớ) và PostgreSQL (cho integration/production).
