# DATA DICTIONARY – TalkWithMe

| | |
|---|---|
| **Tài liệu** | `DATA_DICTIONARY.md` |
| **Phiên bản** | 1.0 |
| **Phạm vi** | Toàn bộ schema PostgreSQL (nguồn dữ liệu chính) và các key Redis (cache/state realtime) phục vụ AI Coach, Scenario Lessons, Gamification, Community Voice Room |
| **Liên quan** | `SRS_TalkWithMe_v2.docx` (mục 6 — Data Requirements), `docs/API_SPEC_PART2.md` |

---

## 0. Quy ước chung

- Kiểu dữ liệu ghi theo chuẩn PostgreSQL (`UUID`, `TEXT`, `TIMESTAMPTZ`, `INTEGER`, `NUMERIC`, `BOOLEAN`, `JSONB`).
- Mọi bảng có `id` dạng `UUID DEFAULT gen_random_uuid()` làm khoá chính, trừ khi ghi chú khác.
- Mọi bảng nghiệp vụ chính có `created_at TIMESTAMPTZ DEFAULT now()`; bảng có thể sửa đổi có thêm `updated_at`.
- Cột `*_id` tham chiếu khoá ngoại (FK) trừ khi ghi chú "không phải FK".
- Thời gian lưu dạng UTC (`TIMESTAMPTZ`), quy đổi timezone ở tầng ứng dụng.

---

## 1. POSTGRESQL

### 1.1. `users`

Thông tin tài khoản đăng nhập (tách riêng khỏi hồ sơ học tập để phục vụ auth độc lập).

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | Khoá chính, dùng làm `userId` xuyên suốt các bảng khác |
| `email` | TEXT | NOT NULL | — | Email đăng nhập, `UNIQUE` |
| `password_hash` | TEXT | NULL | — | Hash mật khẩu (NULL nếu đăng nhập qua OAuth) |
| `full_name` | TEXT | NOT NULL | — | Họ tên hiển thị |
| `auth_provider` | TEXT | NOT NULL | `'local'` | `local` \| `google` \| `apple` |
| `status` | TEXT | NOT NULL | `'ACTIVE'` | `ACTIVE` \| `SUSPENDED` \| `DELETED` |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Thời điểm tạo tài khoản |
| `last_login_at` | TIMESTAMPTZ | NULL | — | Lần đăng nhập gần nhất |

**Index:** `UNIQUE (email)`.

---

### 1.2. `user_profiles`

Hồ sơ học tập — dùng để cá nhân hoá AI Coach và Scenario Lessons (tương ứng `UserProfile` trong SRS).

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `user_id` | UUID | NOT NULL | — | PK & FK → `users.id` (quan hệ 1-1) |
| `level` | TEXT | NOT NULL | `'A1'` | `A1`\|`A2`\|`B1`\|`B2`\|`C1`, CHECK constraint theo enum |
| `interests` | TEXT[] | NULL | `'{}'` | Danh sách chủ đề quan tâm, VD `{travel, technology}` |
| `communication_goal` | TEXT | NULL | — | Mục tiêu giao tiếp do user nhập/chọn |
| `weak_points` | TEXT[] | NULL | `'{}'` | Điểm yếu hệ thống phát hiện qua các session (VD `{past_tense, filler_words}`) |
| `preferred_topics` | TEXT[] | NULL | `'{}'` | Chủ đề được ưu tiên gợi ý |
| `onboarding_completed` | BOOLEAN | NOT NULL | `false` | Đã hoàn tất khảo sát ban đầu hay chưa (chặn Start Session nếu `false`, theo Điều kiện đầu vào SRS mục 4) |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | Cập nhật mỗi khi profile thay đổi (trigger) |

**Index:** PK `(user_id)`. **FK:** `user_id → users.id ON DELETE CASCADE`.

---

### 1.3. `scenarios`

Catalog tình huống Scenario Lessons (dữ liệu tĩnh, do content team quản lý).

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK, tương ứng `scenarioId` trong API |
| `title` | TEXT | NOT NULL | — | Tên tình huống, VD "Đặt bàn tại nhà hàng" |
| `category` | TEXT | NOT NULL | — | `daily_life`\|`social_talk`\|`travel_shopping`\|`workplace`, CHECK constraint |
| `level` | TEXT | NOT NULL | — | Trình độ phù hợp `A1`–`C1` |
| `context` | TEXT | NOT NULL | — | Mô tả bối cảnh |
| `user_role` | TEXT | NOT NULL | — | Vai trò của người dùng trong roleplay |
| `ai_role` | TEXT | NOT NULL | — | Vai trò của AI trong roleplay |
| `goal` | TEXT | NOT NULL | — | Mục tiêu giao tiếp cần đạt |
| `estimated_minutes` | INTEGER | NOT NULL | `5` | Thời lượng ước tính |
| `thumbnail_url` | TEXT | NULL | — | Ảnh minh hoạ |
| `is_active` | BOOLEAN | NOT NULL | `true` | Cho phép ẩn scenario khỏi danh sách mà không xoá dữ liệu |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |

**Index:** `(category, level)` — phục vụ filter ở `GET /lessons`.

---

### 1.4. `scenario_requirements`

Danh sách yêu cầu cần hoàn thành của mỗi Scenario (dùng để chấm PASS/FAIL — Giai đoạn 4 SRS).

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `scenario_id` | UUID | NOT NULL | — | FK → `scenarios.id` |
| `description` | TEXT | NOT NULL | — | Mô tả yêu cầu, VD "Nêu số lượng người" |
| `display_order` | INTEGER | NOT NULL | `0` | Thứ tự hiển thị |

**Index:** `(scenario_id, display_order)`. **FK:** `scenario_id → scenarios.id ON DELETE CASCADE`.

---

### 1.5. `scenario_chunks`

Các Language Chunk (cụm từ giao tiếp cố định) của mỗi Scenario, theo **phương pháp Chunking** (thay thế mô hình "mẫu câu" rời rạc trước đây — SRS mục 3.1b). 4–6 chunk/scenario, mỗi chunk gắn nhãn chức năng giao tiếp trong tình huống.

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK, `chunkId` |
| `scenario_id` | UUID | NOT NULL | — | FK → `scenarios.id` |
| `function_tag` | TEXT | NOT NULL | — | `OPENING`\|`REQUESTING`\|`CLARIFYING`\|`AGREEING_DISAGREEING`\|`CLOSING`, CHECK constraint — chức năng giao tiếp của chunk trong tình huống |
| `text` | TEXT | NOT NULL | — | Cụm từ tiếng Anh (dạng khối, có thể chứa dấu "..." cho phần cần điền, VD "I'd like to book a table for...") |
| `vietnamese_text` | TEXT | NOT NULL | — | Nghĩa tiếng Việt của cụm từ |
| `example_sentence` | TEXT | NOT NULL | — | Một câu ví dụ đầy đủ sử dụng chunk này trong ngữ cảnh |
| `audio_url` | TEXT | NULL | — | File phát âm mẫu của cả cụm (TTS), phát âm liền mạch để rèn phản xạ theo khối |
| `display_order` | INTEGER | NOT NULL | `0` | Thứ tự hiển thị (thường theo trình tự hội thoại: Opening → ... → Closing) |

**Index:** `(scenario_id, display_order)`, `(scenario_id, function_tag)`. **FK:** `scenario_id → scenarios.id ON DELETE CASCADE`.

---

### 1.6. `coach_sessions`

Phiên luyện nói AI Coach (tương ứng `CoachSession` trong SRS Part 1).

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK, `sessionId` |
| `user_id` | UUID | NOT NULL | — | FK → `users.id` |
| `topic` | TEXT | NOT NULL | — | Chủ đề hội thoại |
| `level` | TEXT | NOT NULL | — | Level tại thời điểm session (snapshot, không đổi dù profile sau đó đổi level) |
| `status` | TEXT | NOT NULL | `'CREATED'` | `CREATED`\|`ACTIVE`\|`ENDING`\|`COMPLETED`\|`FAILED`, CHECK constraint |
| `started_at` | TIMESTAMPTZ | NULL | — | Thời điểm chuyển `ACTIVE` |
| `ended_at` | TIMESTAMPTZ | NULL | — | Thời điểm kết thúc |
| `duration_seconds` | INTEGER | NULL | — | Tổng thời lượng session |
| `spoken_seconds` | INTEGER | NULL | `0` | Thời gian user thực sự nói (tính từ transcript) |
| `end_reason` | TEXT | NULL | — | `USER_ENDED`\|`TIMEOUT`\|`ERROR_RECOVERY` |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |

**Index:** `(user_id, created_at DESC)` — phục vụ lịch sử & tính "số session" cho Level. **FK:** `user_id → users.id ON DELETE CASCADE`.

---

### 1.7. `lesson_sessions`

Phiên roleplay của Scenario Lessons (tương ứng `LessonSession` trong API Spec Part 2).

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK, `sessionId` |
| `user_id` | UUID | NOT NULL | — | FK → `users.id` |
| `scenario_id` | UUID | NOT NULL | — | FK → `scenarios.id` |
| `level` | TEXT | NOT NULL | — | Level snapshot tại thời điểm bắt đầu |
| `status` | TEXT | NOT NULL | `'ACTIVE'` | `ACTIVE`\|`ENDING`\|`COMPLETED`\|`FAILED` |
| `started_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |
| `ended_at` | TIMESTAMPTZ | NULL | — | — |
| `end_reason` | TEXT | NULL | — | `USER_ENDED`\|`TIMEOUT`\|`ERROR_RECOVERY` |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |

**Index:** `(user_id, scenario_id, created_at DESC)`, `(user_id, status)` (kiểm tra `SESSION_ALREADY_ACTIVE`). **FK:** `user_id → users.id ON DELETE CASCADE`, `scenario_id → scenarios.id`.

---

### 1.8. `transcript_segments`

Bảng dùng chung cho transcript của AI Coach, Scenario Lessons và Community Voice Room (phân biệt bằng `session_type` + `session_id`, không dùng FK cứng vì `session_id` trỏ tới 1 trong 3 bảng khác nhau — áp dụng mô hình *polymorphic association*, ràng buộc toàn vẹn được xử lý ở tầng ứng dụng).

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK, `segmentId` |
| `session_type` | TEXT | NOT NULL | — | `COACH`\|`LESSON`\|`ROOM` — xác định bảng session tương ứng |
| `session_id` | UUID | NOT NULL | — | Trỏ tới `coach_sessions.id` / `lesson_sessions.id` / `voice_rooms.id` tuỳ `session_type` |
| `speaker_type` | TEXT | NOT NULL | — | `USER`\|`AI` (Coach/Lesson) hoặc `PARTICIPANT`\|`AI_ASSISTANT` (Room) |
| `speaker_user_id` | UUID | NULL | — | FK → `users.id`, NULL nếu speaker là AI |
| `text` | TEXT | NOT NULL | — | Nội dung transcript |
| `start_time` | NUMERIC(10,3) | NOT NULL | — | Timestamp bắt đầu (giây, tính từ đầu session) |
| `end_time` | NUMERIC(10,3) | NULL | — | Timestamp kết thúc |
| `confidence` | NUMERIC(4,3) | NULL | — | Độ tin cậy STT (0.000–1.000), NULL nếu không áp dụng (VD lời AI) |
| `is_final` | BOOLEAN | NOT NULL | `false` | `true` khi STT đã chốt segment |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |

**Index:** `(session_type, session_id, start_time)` — phục vụ truy vấn transcript theo session và thứ tự thời gian. **Cân nhắc production:** partition theo `session_type` hoặc theo tháng (`created_at`) nếu khối lượng lớn.

---

### 1.9. `session_feedback`

Kết quả Post-Session Feedback cho AI Coach (tương ứng `SessionFeedback` trong SRS Part 1).

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `session_id` | UUID | NOT NULL | — | PK & FK → `coach_sessions.id` (1-1) |
| `status` | TEXT | NOT NULL | `'PROCESSING'` | `PROCESSING`\|`READY`\|`INSUFFICIENT_DATA`\|`FAILED` |
| `fluency_score` | NUMERIC(5,2) | NULL | — | 0–100, NULL nếu chưa tính/không đủ dữ liệu |
| `listening_score` | NUMERIC(5,2) | NULL | — | 0–100 |
| `vocabulary_score` | NUMERIC(5,2) | NULL | — | 0–100 |
| `response_speed_score` | NUMERIC(5,2) | NULL | — | 0–100 |
| `pronunciation_score` | NUMERIC(5,2) | NULL | — | 0–100, NULL nếu STT không cung cấp confidence |
| `overall_score` | NUMERIC(5,2) | NULL | — | Điểm tổng hợp theo công thức mục 3.1 SRS |
| `strengths` | JSONB | NULL | `'[]'` | Mảng chuỗi (2–3 điểm mạnh) |
| `improvements` | JSONB | NULL | `'[]'` | Mảng chuỗi (tối đa 3 điểm cần cải thiện) |
| `next_practice` | JSONB | NULL | `'[]'` | Mảng chuỗi gợi ý luyện tập tiếp theo |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | Cập nhật khi phân tích hoàn tất |

**Ràng buộc quan trọng:** khi `status = 'INSUFFICIENT_DATA'`, tất cả cột điểm số phải là `NULL` — **không** cho phép giá trị mặc định/giả (theo nguyên tắc "không bịa điểm" trong SRS). Nên enforce bằng CHECK constraint hoặc validate ở tầng ứng dụng.

---

### 1.10. `lesson_results`

Kết quả đánh giá nhiệm vụ Scenario Lesson (tương ứng US-08, `LessonResult` trong API Spec Part 2).

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `session_id` | UUID | NOT NULL | — | PK & FK → `lesson_sessions.id` (1-1) |
| `status` | TEXT | NOT NULL | `'PROCESSING'` | `PROCESSING`\|`READY`\|`INSUFFICIENT_DATA`\|`FAILED` |
| `requirements_result` | JSONB | NULL | `'[]'` | Mảng object `{requirementId, description, result: PASS/FAIL}` |
| `chunks_result` | JSONB | NULL | `'[]'` | Mảng object `{chunkId, functionTag, used: boolean, matchedText}` — kết quả đối chiếu chunk mục tiêu với transcript theo phương pháp Chunking (SRS mục 3.1b) |
| `completion_rate` | NUMERIC(4,3) | NULL | — | Tỉ lệ PASS/tổng requirement (0.000–1.000) |
| `strengths` | JSONB | NULL | `'[]'` | Mảng chuỗi |
| `improvements` | JSONB | NULL | `'[]'` | Mảng chuỗi |
| `next_practice` | JSONB | NULL | `'[]'` | Mảng chuỗi |
| `xp_awarded` | INTEGER | NULL | `0` | XP đã cộng cho lesson này (để tránh cộng trùng khi truy vấn lại) |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |

---

### 1.10b. `lesson_chunk_drill_log`

Ghi nhận thao tác Chunk Drill (US-06b) của người dùng trước khi roleplay — dữ liệu tham khảo để cá nhân hoá Chunk Bank, không dùng để chấm điểm chính thức.

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `session_id` | UUID | NOT NULL | — | FK → `lesson_sessions.id` |
| `chunk_id` | UUID | NOT NULL | — | FK → `scenario_chunks.id` |
| `action` | TEXT | NOT NULL | — | `COMPLETED`\|`SKIPPED` |
| `attempts` | INTEGER | NULL | `0` | Số lần nhắc lại (nếu `action = COMPLETED`) |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |

**Index:** `(session_id)`, `(chunk_id)`.

---

### 1.10c. `user_chunk_bank`

Danh sách chunk cá nhân cần luyện thêm hoặc đã thành thạo, tổng hợp xuyên suốt các Scenario người dùng đã luyện (MVP: danh sách tĩnh, chưa áp dụng thuật toán spaced repetition — xem SRS mục 1.2 Out-of-Scope).

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | UUID | NOT NULL | — | FK → `users.id` |
| `chunk_id` | UUID | NOT NULL | — | FK → `scenario_chunks.id` |
| `status` | TEXT | NOT NULL | `'NEEDS_PRACTICE'` | `NEEDS_PRACTICE`\|`MASTERED` |
| `source_session_id` | UUID | NULL | — | `lesson_sessions.id` của lần gần nhất phát hiện chunk này chưa dùng tốt (tham khảo, không FK cứng vì có thể bị xoá) |
| `last_seen_at` | TIMESTAMPTZ | NOT NULL | `now()` | Lần gần nhất chunk này xuất hiện trong kết quả đánh giá của người dùng |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | Cập nhật khi người dùng tự đổi `status` (VD đánh dấu `MASTERED`) |

**Index:** `UNIQUE (user_id, chunk_id)` — mỗi chunk chỉ có một bản ghi trạng thái cho mỗi user, `upsert` mỗi khi có kết quả đánh giá mới từ `lesson_results.chunks_result`.

---

### 1.11. `gamification_profiles`

Trạng thái gamification tổng hợp của user (tương ứng `GamificationProfile` trong SRS).

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `user_id` | UUID | NOT NULL | — | PK & FK → `users.id` (1-1) |
| `xp` | INTEGER | NOT NULL | `0` | Tổng XP hiện tại, CHECK `xp >= 0` |
| `level` | TEXT | NOT NULL | `'A1'` | Level hiện tại, đồng bộ với `user_profiles.level` qua trigger/service |
| `current_streak` | INTEGER | NOT NULL | `0` | Số ngày streak liên tiếp |
| `longest_streak` | INTEGER | NOT NULL | `0` | Kỷ lục streak dài nhất |
| `last_activity_date` | DATE | NULL | — | Ngày gần nhất hoàn thành hoạt động (dùng để tính streak/reset) |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |

**Lưu ý đồng bộ:** cột `xp`/`current_streak` là nguồn sự thật ghi (write-through); Redis chỉ cache đọc nhanh (xem mục 2.6).

---

### 1.12. `xp_transactions`

Sổ cái (ledger) mọi lần cộng XP — phục vụ audit, chống cộng trùng, và truy vết lịch sử.

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | UUID | NOT NULL | — | FK → `users.id` |
| `activity_type` | TEXT | NOT NULL | — | `DAILY_MISSION_COMPLETED`\|`SCENARIO_LESSON_COMPLETED`\|`COACH_SESSION_COMPLETED`\|`ROOM_SESSION_COMPLETED`\|`ALL_DAILY_MISSIONS_COMPLETED`\|`STREAK_MAINTAINED` |
| `source_id` | TEXT | NOT NULL | — | ID của session/mission gây ra giao dịch (dùng cùng `activity_type` để đảm bảo UNIQUE, chống duplicate) |
| `xp_amount` | INTEGER | NOT NULL | — | Số XP cộng (luôn dương trong MVP) |
| `balance_after` | INTEGER | NOT NULL | — | Số dư XP sau giao dịch (snapshot phục vụ audit nhanh) |
| `idempotency_key` | TEXT | NULL | — | Khoá idempotency gốc từ request, nếu có |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |

**Index:** `UNIQUE (activity_type, source_id)` — đây là ràng buộc chống cộng XP trùng lặp cốt lõi (tương ứng yêu cầu idempotency trong API Spec). `(user_id, created_at DESC)` phục vụ lịch sử XP.

---

### 1.13. `daily_missions_catalog`

Định nghĩa tĩnh các Daily Mission trong MVP.

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `mission_id` | TEXT | NOT NULL | — | PK, VD `coach_5min`, `scenario_lesson`, `room_session` |
| `title` | TEXT | NOT NULL | — | Tên hiển thị |
| `target` | INTEGER | NOT NULL | — | Ngưỡng hoàn thành (VD `5` cho "5 phút") |
| `unit` | TEXT | NOT NULL | — | Đơn vị: `phút`, `bài`, `phiên` |
| `xp_reward` | INTEGER | NOT NULL | `50` | XP thưởng khi hoàn thành |
| `is_active` | BOOLEAN | NOT NULL | `true` | Cho phép bật/tắt mission mà không xoá dữ liệu lịch sử |

---

### 1.14. `daily_mission_progress`

Tiến độ Daily Mission theo từng user, từng ngày.

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | UUID | NOT NULL | — | FK → `users.id` |
| `mission_id` | TEXT | NOT NULL | — | FK → `daily_missions_catalog.mission_id` |
| `mission_date` | DATE | NOT NULL | — | Ngày áp dụng (theo timezone chuẩn hoá của hệ thống) |
| `progress` | INTEGER | NOT NULL | `0` | Tiến độ hiện tại |
| `status` | TEXT | NOT NULL | `'NOT_STARTED'` | `NOT_STARTED`\|`IN_PROGRESS`\|`COMPLETED` |
| `claimed` | BOOLEAN | NOT NULL | `false` | Đã nhận XP hay chưa |
| `claimed_at` | TIMESTAMPTZ | NULL | — | — |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |

**Index:** `UNIQUE (user_id, mission_id, mission_date)`.

---

### 1.15. `streak_logs`

Lịch sử streak theo ngày (phục vụ hiển thị lịch sử + audit reset).

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | UUID | NOT NULL | — | FK → `users.id` |
| `log_date` | DATE | NOT NULL | — | Ngày ghi nhận |
| `completed` | BOOLEAN | NOT NULL | — | `true` nếu ngày đó hoàn thành ≥1 hoạt động yêu cầu |
| `streak_value_after` | INTEGER | NOT NULL | — | Giá trị streak sau ngày này (0 nếu bị reset) |

**Index:** `UNIQUE (user_id, log_date)`.

---

### 1.16. `level_history`

Lịch sử thay đổi Level (audit trail cho việc thăng Level).

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | UUID | NOT NULL | — | FK → `users.id` |
| `previous_level` | TEXT | NULL | — | Level trước đó (NULL cho bản ghi khởi tạo A1) |
| `new_level` | TEXT | NOT NULL | — | Level mới |
| `overall_score_snapshot` | NUMERIC(5,2) | NULL | — | Overall Communication Score tại thời điểm thăng level |
| `session_count_snapshot` | INTEGER | NULL | — | Số session tại thời điểm thăng level |
| `scenario_count_snapshot` | INTEGER | NULL | — | Số scenario hoàn thành tại thời điểm thăng level |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |

---

### 1.17. `voice_rooms`

Phòng thoại cộng đồng (Community Voice Room).

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK, `roomId` |
| `topic` | TEXT | NOT NULL | — | Chủ đề phòng (VD Travel, Gaming) |
| `level` | TEXT | NOT NULL | — | Level được lọc cho phòng |
| `max_participants` | INTEGER | NOT NULL | `5` | Giới hạn 3–5 người theo SRS |
| `status` | TEXT | NOT NULL | `'OPEN'` | `OPEN`\|`ACTIVE`\|`CLOSED` |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |
| `closed_at` | TIMESTAMPTZ | NULL | — | — |

---

### 1.18. `voice_room_participants`

Danh sách người tham gia mỗi Room (lịch sử, không chỉ trạng thái hiện tại — trạng thái realtime nằm ở Redis, xem mục 2.4).

| Cột | Kiểu | Null? | Default | Mô tả |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `room_id` | UUID | NOT NULL | — | FK → `voice_rooms.id` |
| `user_id` | UUID | NOT NULL | — | FK → `users.id` |
| `joined_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |
| `left_at` | TIMESTAMPTZ | NULL | — | — |
| `speaking_seconds` | INTEGER | NOT NULL | `0` | Tổng thời lượng nói, cập nhật khi rời phòng |

**Index:** `(room_id, user_id)`.

---

## 2. REDIS

Redis dùng cho **trạng thái thời gian thực** (realtime session state, phát hiện im lặng, presence) và **cache đọc nhanh** (profile gamification), không phải nguồn dữ liệu chính thức — PostgreSQL luôn là nguồn sự thật (source of truth) cho dữ liệu cần bền vững/audit.

### 2.1. `session:coach:{sessionId}` — Hash

| Field | Kiểu giá trị | Mô tả |
|---|---|---|
| `status` | string | `LISTENING`\|`TRANSCRIBING`\|`FINALIZING`\|`PAUSED`\|`ERROR` (trạng thái Live Script — SRS mục 10) |
| `lastActivityAt` | epoch ms (string) | Dùng để phát hiện timeout không hoạt động |
| `pendingPartialText` | string | Transcript tạm thời (partial) đang hiển thị, chưa finalize vào PostgreSQL |
| `micConnected` | `"1"`/`"0"` | Trạng thái microphone |

**TTL:** 30 phút, gia hạn (refresh) mỗi khi có hoạt động mới. **Mục đích:** tránh ghi liên tục xuống PostgreSQL cho mỗi partial transcript (chỉ final transcript mới ghi PostgreSQL).

---

### 2.2. `session:lesson:{sessionId}` — Hash

Cấu trúc tương tự `session:coach:{sessionId}`, dùng cho `lesson_sessions`.

| Field | Kiểu giá trị | Mô tả |
|---|---|---|
| `status` | string | Tương tự trạng thái Live Script |
| `lastActivityAt` | epoch ms (string) | — |
| `pendingPartialText` | string | — |

**TTL:** 30 phút.

---

### 2.3. `room:{roomId}:state` — Hash

| Field | Kiểu giá trị | Mô tả |
|---|---|---|
| `status` | string | `OPEN`\|`ACTIVE`\|`CLOSED` (đồng bộ với PostgreSQL, cache đọc nhanh) |
| `lastSpeechAt` | epoch ms (string) | Thời điểm phát hiện hoạt động nói gần nhất — dùng để tính khoảng im lặng |
| `currentTopic` | string | Chủ đề hiện tại của phòng |
| `lastAiPromptAt` | epoch ms (string) | Lần cuối AI Assistant chủ động đặt câu hỏi (tránh spam) |

**TTL:** không đặt TTL cố định; xoá key khi Room chuyển `CLOSED` (dọn dẹp chủ động qua code, không dựa vào TTL).

---

### 2.4. `room:{roomId}:participants` — Set

Danh sách `userId` đang **hiện diện thực tế** trong phòng (khác với bảng `voice_room_participants` ở PostgreSQL là lịch sử tham gia).

**Thao tác:** `SADD` khi join, `SREM` khi leave/disconnect. **TTL:** không đặt; dọn dẹp khi Room đóng.

---

### 2.5. `room:{roomId}:silence_timer` — String (dùng cơ chế keyspace notification hoặc polling)

**Giá trị:** `"1"` (placeholder). **TTL:** 15 giây (đúng ngưỡng phát hiện im lặng theo SRS mục 4.3).

**Cơ chế:** mỗi khi phát hiện có người nói, hệ thống `SET room:{roomId}:silence_timer 1 EX 15` (reset timer). Khi key **hết hạn** (Redis keyspace notification `expired` event), Invisible AI Assistant Service nhận sự kiện và kích hoạt tạo câu hỏi gợi mở — tránh phải polling liên tục.

---

### 2.6. `gamification:{userId}:profile_cache` — Hash

Cache đọc nhanh cho `GET /gamification/profile`, đồng bộ ghi-qua (write-through) mỗi khi `gamification_profiles` ở PostgreSQL thay đổi.

| Field | Kiểu giá trị | Mô tả |
|---|---|---|
| `xp` | integer (string) | Bản sao của `gamification_profiles.xp` |
| `level` | string | Bản sao của `gamification_profiles.level` |
| `currentStreak` | integer (string) | Bản sao của `current_streak` |

**TTL:** 10 phút (fallback tự làm mới từ PostgreSQL nếu cache miss, tránh dữ liệu cũ vĩnh viễn nếu write-through lỗi).

---

### 2.7. `gamification:{userId}:missions:{date}` — Hash

Cache tiến độ Daily Mission trong ngày, giảm tải PostgreSQL cho các cập nhật tiến độ realtime (VD: đang đếm phút nói chuyện với AI Coach).

| Field | Kiểu giá trị | Mô tả |
|---|---|---|
| `coach_5min` | integer (string) | Tiến độ hiện tại của mission tương ứng |
| `scenario_lesson` | integer (string) | — |
| `room_session` | integer (string) | — |

**TTL:** đến hết ngày (tính theo UTC hoặc timezone chuẩn hoá — `EXPIREAT` tại 00:00 ngày hôm sau). **Đồng bộ:** ghi xuống `daily_mission_progress` khi mission đạt `target` (chuyển `COMPLETED`), không đợi hết ngày mới ghi.

---

### 2.8. `idempotency:{idempotencyKey}` — String (JSON đã serialize response)

Lưu response đã xử lý cho các request có `Idempotency-Key`, dùng chung cho mọi API có khả năng bị retry (transcript, xp/award, mission claim...).

**Giá trị:** JSON response đã trả về lần đầu. **TTL:** 24 giờ (đúng theo chính sách idempotency mục 0.6 trong API Spec).

---

### 2.9. `rate_limit:{userId}:{endpoint}` — String (counter)

**Giá trị:** số lượt gọi trong cửa sổ hiện tại. **Thao tác:** `INCR` + `EXPIRE` (sliding/fixed window tuỳ cấu hình). **TTL:** theo cửa sổ rate limit (VD 60 giây cho endpoint transcript vì tần suất gọi cao).

---

### 2.10. `presence:{userId}` — String

**Giá trị:** `"online"` hoặc device/session identifier. **TTL:** 60 giây, được client heartbeat gia hạn liên tục — dùng để xác định user có đang active trong Room/Session hay đã mất kết nối đột ngột (phục vụ EC "mất mạng"/"app background").

---

### 2.11. `ws:conn:{connectionId}` — Hash

Ánh xạ kết nối WebSocket (dùng cho Live Script/Live Transcript realtime) tới user và session hiện tại.

| Field | Kiểu giá trị | Mô tả |
|---|---|---|
| `userId` | string | — |
| `sessionType` | string | `COACH`\|`LESSON`\|`ROOM` |
| `sessionId` | string | ID session/room tương ứng |

**TTL:** không đặt cố định; xoá khi client disconnect (`on close` handler), hoặc TTL an toàn 2 giờ để tự dọn rác nếu handler disconnect lỗi.

---

## 3. Ghi chú đồng bộ dữ liệu (PostgreSQL ⇄ Redis)

| Nguyên tắc | Áp dụng |
|---|---|
| PostgreSQL là nguồn sự thật cho mọi dữ liệu cần audit, tính điểm, hoặc hiển thị lịch sử | `xp_transactions`, `session_feedback`, `lesson_results`, `level_history` |
| Redis chỉ cache/state tạm thời, có thể mất mà không ảnh hưởng tính đúng đắn nghiệp vụ | `session:*`, `room:*:state`, `presence:*`, `ws:conn:*` |
| Ràng buộc idempotency phải có ở **cả hai** tầng | Redis (`idempotency:*`, TTL ngắn hạn để chặn retry tức thời) + PostgreSQL (`UNIQUE (activity_type, source_id)` trong `xp_transactions`, để đảm bảo đúng ngay cả khi Redis bị mất dữ liệu) |
| Mọi giá trị cache có TTL hoặc cơ chế dọn dẹp chủ động rõ ràng | Tránh rò rỉ bộ nhớ Redis khi session/room không đóng đúng quy trình |
