# API SPECIFICATION – PART 2

## Lessons API & Gamification API

| | |
|---|---|
| **Dự án** | TalkWithMe |
| **Tài liệu** | `docs/API_SPEC_PART2.md` |
| **Phiên bản** | 1.0 |
| **Phạm vi** | Scenario Lessons (F-02) và Gamification & Level System (F-04) |
| **Liên quan** | `SRS_TalkWithMe_v2.docx` (F-02, F-04), `API_SPEC_PART1.md` (AI Coach — nếu có) |

---

## 0. Quy ước chung (Conventions)

### 0.1. Base URL

```
https://api.talkwithme.app/v1
```

### 0.2. Authentication

Tất cả endpoint (trừ khi ghi chú "Internal/Service-to-Service") yêu cầu Bearer JWT trong header:

```
Authorization: Bearer <access_token>
```

Endpoint đánh dấu **[Internal]** chỉ được gọi giữa các service nội bộ (ví dụ: Coach Service gọi Gamification Service để cộng XP), xác thực bằng service token (`X-Service-Token`), không lộ ra ngoài API Gateway public.

### 0.3. Headers chung

| Header | Bắt buộc | Mô tả |
|---|---|---|
| `Authorization` | Có (trừ Internal) | `Bearer <JWT>` |
| `Content-Type` | Có (với POST/PATCH) | `application/json` |
| `Accept-Language` | Không | `vi` hoặc `en`, mặc định `vi` |
| `X-Request-Id` | Không | UUID do client sinh, dùng để trace log & đảm bảo idempotency |

### 0.4. Định dạng lỗi chuẩn

```json
{
  "error": {
    "code": "SCENARIO_NOT_FOUND",
    "message": "Không tìm thấy tình huống với ID đã cho.",
    "details": null,
    "requestId": "b3a1f2c0-..."
  }
}
```

| HTTP Status | Ý nghĩa |
|---|---|
| 400 | Request không hợp lệ (thiếu field, sai kiểu dữ liệu) |
| 401 | Chưa xác thực / token hết hạn |
| 403 | Không có quyền truy cập resource |
| 404 | Không tìm thấy resource |
| 409 | Xung đột trạng thái (VD: session đã kết thúc, mission đã claim) |
| 422 | Business rule violation (VD: chưa đủ dữ liệu để đánh giá) |
| 429 | Vượt rate limit |
| 500 | Lỗi hệ thống |

### 0.5. Phân trang (Pagination)

Query params chuẩn cho các endpoint dạng danh sách:

| Param | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `page` | integer | 1 | Trang hiện tại (bắt đầu từ 1) |
| `pageSize` | integer | 20 (max 50) | Số item mỗi trang |

Response bọc trong envelope:

```json
{
  "data": [ ... ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 87, "totalPages": 5 }
}
```

### 0.6. Idempotency

Các endpoint tạo tài nguyên (session, transcript, claim reward) hỗ trợ header `Idempotency-Key`. Nếu gửi lại cùng key trong vòng 24h, server trả về response đã xử lý trước đó thay vì tạo bản ghi mới (chống duplicate khi client retry — xem EC-09 trong SRS).

---

## 1. LESSONS API (Scenario Lessons — F-02)

### 1.1. Resource Model

```
Scenario (1) ──< LessonSession (N) ──< TranscriptSegment (N)
                        │
                        └──1── LessonResult (đánh giá nhiệm vụ + feedback)
```

- **Scenario**: định nghĩa tĩnh một tình huống (catalog, do BA/Content team quản lý).
- **LessonSession**: một lần người dùng thực hiện roleplay theo Scenario.
- **TranscriptSegment**: từng đoạn hội thoại trong session (dùng chung schema với AI Coach — xem Data Dictionary).
- **LessonResult**: kết quả đánh giá PASS/FAIL từng requirement + feedback tổng hợp.

### 1.2. Danh sách Endpoint

| # | Method | Path | Mô tả |
|---|---|---|---|
| 1.2.1 | GET | `/lessons/categories` | Lấy danh sách nhóm chủ đề |
| 1.2.2 | GET | `/lessons` | Lấy danh sách Scenario (có filter/phân trang) |
| 1.2.3 | GET | `/lessons/{scenarioId}` | Lấy chi tiết một Scenario (bối cảnh, vai trò, các Language Chunk theo phương pháp Chunking) |
| 1.2.4 | POST | `/lessons/{scenarioId}/sessions` | Bắt đầu một LessonSession (roleplay) |
| 1.2.5 | GET | `/lessons/sessions/{sessionId}` | Lấy trạng thái hiện tại của session |
| 1.2.6 | POST | `/lessons/sessions/{sessionId}/transcript` | Gửi/finalize một TranscriptSegment |
| 1.2.7 | POST | `/lessons/sessions/{sessionId}/end` | Kết thúc session, kích hoạt đánh giá |
| 1.2.8 | GET | `/lessons/sessions/{sessionId}/result` | Lấy kết quả đánh giá + feedback (bao gồm chunk đã dùng tốt / cần luyện thêm) |
| 1.2.9 | GET | `/lessons/history` | Lịch sử các lesson đã hoàn thành của user |
| 1.2.10 | POST | `/lessons/sessions/{sessionId}/chunks/drill` | Ghi nhận tiến độ Chunk Drill (nghe & nhắc lại) trước khi roleplay |
| 1.2.11 | GET | `/lessons/chunk-bank` | Lấy danh sách chunk cá nhân cần luyện thêm / đã thành thạo |
| 1.2.12 | PATCH | `/lessons/chunk-bank/{chunkId}` | Cập nhật trạng thái một chunk trong Chunk Bank (VD đánh dấu đã thành thạo) |

---

### 1.2.1. GET `/lessons/categories`

Lấy danh sách nhóm chủ đề (Daily Life, Social Talk, Travel & Shopping, Workplace).

**Auth:** Bearer JWT

**Response 200:**

```json
{
  "data": [
    { "categoryId": "daily_life", "name": "Daily Life", "scenarioCount": 8 },
    { "categoryId": "social_talk", "name": "Social Talk", "scenarioCount": 5 },
    { "categoryId": "travel_shopping", "name": "Travel & Shopping", "scenarioCount": 4 },
    { "categoryId": "workplace", "name": "Workplace", "scenarioCount": 3 }
  ]
}
```

---

### 1.2.2. GET `/lessons`

Lấy danh sách Scenario, hỗ trợ filter theo category, level, từ khóa tìm kiếm.

**Auth:** Bearer JWT

**Query params:**

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `category` | string | Không | `daily_life`, `social_talk`, `travel_shopping`, `workplace` |
| `level` | string | Không | `A1`\|`A2`\|`B1`\|`B2`\|`C1` — lọc scenario phù hợp trình độ |
| `search` | string | Không | Tìm theo tên tình huống |
| `page`, `pageSize` | integer | Không | Xem mục 0.5 |

**Response 200:**

```json
{
  "data": [
    {
      "scenarioId": "sc_001",
      "title": "Đặt bàn tại nhà hàng",
      "category": "daily_life",
      "level": "A2",
      "userRole": "Khách hàng",
      "aiRole": "Nhân viên nhà hàng",
      "estimatedMinutes": 5,
      "thumbnailUrl": "https://cdn.talkwithme.app/scenarios/sc_001.png"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 20, "totalPages": 1 }
}
```

---

### 1.2.3. GET `/lessons/{scenarioId}`

Lấy chi tiết đầy đủ một Scenario: bối cảnh, vai trò, mục tiêu, yêu cầu cần hoàn thành, và các **Language Chunk** theo phương pháp Chunking. Dùng cho Giai đoạn 1 & 2 trong SRS (Giới thiệu tình huống + Học Chunk).

> **Phương pháp Chunking:** thay vì trả về danh sách "mẫu câu" (sample sentences) chung, mỗi Scenario trả về `chunks[]` — các cụm từ giao tiếp cố định, mỗi chunk gắn `functionTag` (chức năng giao tiếp trong tình huống: mở đầu, đề nghị/yêu cầu, làm rõ, đồng ý/từ chối, kết thúc). Người học học và phản xạ theo cả khối cụm từ, không ráp từng từ theo ngữ pháp.

**Auth:** Bearer JWT

**Path params:** `scenarioId` (string, required)

**Response 200:**

```json
{
  "scenarioId": "sc_001",
  "title": "Đặt bàn tại nhà hàng",
  "category": "daily_life",
  "level": "A2",
  "context": "Bạn muốn đặt một bàn ăn cho 4 người vào tối thứ Bảy.",
  "userRole": "Khách hàng",
  "aiRole": "Nhân viên nhà hàng",
  "goal": "Đặt thành công một bàn ăn cho 4 người.",
  "requirements": [
    { "requirementId": "req_1", "description": "Nêu số lượng người" },
    { "requirementId": "req_2", "description": "Nêu thời gian đặt bàn" },
    { "requirementId": "req_3", "description": "Xác nhận đặt bàn" },
    { "requirementId": "req_4", "description": "Sử dụng ít nhất một chunk mục tiêu" }
  ],
  "chunks": [
    {
      "chunkId": "ck_001",
      "functionTag": "OPENING",
      "text": "I'd like to book a table for...",
      "vietnamese": "Tôi muốn đặt một bàn cho...",
      "audioUrl": "https://cdn.talkwithme.app/tts/sc_001_ck1.mp3",
      "exampleSentence": "I'd like to book a table for four, please."
    },
    {
      "chunkId": "ck_002",
      "functionTag": "CLARIFYING",
      "text": "Could you repeat that, please?",
      "vietnamese": "Bạn có thể lặp lại được không?",
      "audioUrl": "https://cdn.talkwithme.app/tts/sc_001_ck2.mp3",
      "exampleSentence": "Sorry, could you repeat that, please?"
    },
    {
      "chunkId": "ck_003",
      "functionTag": "CLOSING",
      "text": "That sounds great, thank you.",
      "vietnamese": "Nghe hay đấy, cảm ơn bạn.",
      "audioUrl": "https://cdn.talkwithme.app/tts/sc_001_ck3.mp3",
      "exampleSentence": "That sounds great, thank you. See you Saturday."
    }
  ]
}
```

`functionTag` enum: `OPENING`, `REQUESTING`, `CLARIFYING`, `AGREEING_DISAGREEING`, `CLOSING`.

**Lỗi:** `404 SCENARIO_NOT_FOUND` nếu `scenarioId` không tồn tại.

---

### 1.2.4. POST `/lessons/{scenarioId}/sessions`

Bắt đầu một LessonSession mới (chuyển sang Giai đoạn 3 — Roleplay). Tương ứng US-05 → US-07.

**Auth:** Bearer JWT
**Headers:** `Idempotency-Key` (khuyến nghị)

**Path params:** `scenarioId` (string, required)

**Request body:** không bắt buộc field, hệ thống tự lấy `level` từ UserProfile.

```json
{}
```

**Response 201:**

```json
{
  "sessionId": "ls_9f3a...",
  "scenarioId": "sc_001",
  "userId": "usr_123",
  "status": "ACTIVE",
  "level": "A2",
  "startedAt": "2026-09-18T09:00:00Z"
}
```

**Business rules:**
- Nếu `UserProfile` chưa có `level` hợp lệ → `422 PROFILE_INCOMPLETE`.
- `status` khởi tạo luôn là `ACTIVE`; không có trạng thái `CREATED` trung gian như CoachSession vì không cần xin quyền microphone lại (dùng chung phiên ứng dụng).

**Lỗi:**
| Code | HTTP | Mô tả |
|---|---|---|
| `SCENARIO_NOT_FOUND` | 404 | scenarioId không tồn tại |
| `PROFILE_INCOMPLETE` | 422 | Thiếu level/profile |
| `SESSION_ALREADY_ACTIVE` | 409 | User đang có 1 lesson session ACTIVE khác chưa kết thúc |

---

### 1.2.5. GET `/lessons/sessions/{sessionId}`

Lấy trạng thái hiện tại của một LessonSession (dùng để poll hoặc khôi phục UI sau khi reconnect).

**Auth:** Bearer JWT (chỉ chủ sở hữu session)

**Response 200:**

```json
{
  "sessionId": "ls_9f3a...",
  "scenarioId": "sc_001",
  "status": "ACTIVE",
  "startedAt": "2026-09-18T09:00:00Z",
  "durationSeconds": 87,
  "lastSegmentAt": "2026-09-18T09:01:20Z"
}
```

`status` enum: `ACTIVE`, `ENDING`, `COMPLETED`, `FAILED`.

---

### 1.2.6. POST `/lessons/sessions/{sessionId}/transcript`

Gửi/finalize một đoạn transcript. Schema và hành vi tương tự AI Coach Live Script (Part 1), dùng chung bảng `transcript_segments` với `session_type = 'LESSON'`.

**Auth:** Bearer JWT
**Headers:** `Idempotency-Key` (bắt buộc — chống duplicate theo EC-09)

**Request body:**

```json
{
  "speaker": "USER",
  "text": "I'd like to book a table for four people.",
  "startTime": 4.2,
  "endTime": 7.8,
  "confidence": 0.95,
  "isFinal": true
}
```

**Response 201:**

```json
{
  "segmentId": "seg_881a...",
  "sessionId": "ls_9f3a...",
  "isFinal": true,
  "createdAt": "2026-09-18T09:00:08Z"
}
```

**Lỗi:**
| Code | HTTP | Mô tả |
|---|---|---|
| `SESSION_NOT_ACTIVE` | 409 | Session không ở trạng thái ACTIVE |
| `VALIDATION_ERROR` | 400 | Thiếu field bắt buộc hoặc `startTime > endTime` |

---

### 1.2.7. POST `/lessons/sessions/{sessionId}/end`

Kết thúc session, kích hoạt luồng đánh giá nhiệm vụ (Giai đoạn 4) bất đồng bộ.

**Auth:** Bearer JWT

**Request body:** (tùy chọn, cho phép client báo lý do kết thúc)

```json
{ "reason": "USER_ENDED" }
```

`reason` enum: `USER_ENDED`, `TIMEOUT`, `ERROR_RECOVERY`.

**Response 200:**

```json
{
  "sessionId": "ls_9f3a...",
  "status": "COMPLETED",
  "resultStatus": "PROCESSING"
}
```

**Side-effects (async, nội bộ):**
1. Finalize transcript còn pending.
2. Gọi AI Analysis Service để đánh giá từng `requirement` (PASS/FAIL) + sinh feedback.
3. Nếu hoàn thành thành công → gọi **[Internal]** `POST /gamification/xp/award` với `activityType = SCENARIO_LESSON_COMPLETED` (+100 XP, xem mục 2).

**Lỗi:** `409 SESSION_ALREADY_ENDED` nếu gọi end lần thứ 2 (idempotent theo `sessionId`, trả lại response cũ thay vì lỗi cứng — tuỳ chính sách; khuyến nghị trả `200` với dữ liệu hiện tại thay vì `409` để tránh lỗi khi client retry).

---

### 1.2.8. GET `/lessons/sessions/{sessionId}/result`

Lấy kết quả đánh giá nhiệm vụ + feedback sau khi session COMPLETED. Tương ứng US-08.

**Auth:** Bearer JWT

**Response 200 (khi đã xử lý xong):**

```json
{
  "sessionId": "ls_9f3a...",
  "resultStatus": "READY",
  "requirementsResult": [
    { "requirementId": "req_1", "description": "Nêu số lượng người", "result": "PASS" },
    { "requirementId": "req_2", "description": "Nêu thời gian đặt bàn", "result": "PASS" },
    { "requirementId": "req_3", "description": "Xác nhận đặt bàn", "result": "PASS" },
    { "requirementId": "req_4", "description": "Sử dụng ít nhất một chunk mục tiêu", "result": "FAIL" }
  ],
  "chunksResult": [
    { "chunkId": "ck_001", "functionTag": "OPENING", "used": true, "matchedText": "I'd like to book a table for four" },
    { "chunkId": "ck_002", "functionTag": "CLARIFYING", "used": false },
    { "chunkId": "ck_003", "functionTag": "CLOSING", "used": true, "matchedText": "That sounds great, thanks" }
  ],
  "completionRate": 0.75,
  "strengths": ["Bạn diễn đạt yêu cầu rõ ràng ngay từ đầu bằng đúng chunk mở đầu."],
  "improvements": ["Hãy thử dùng chunk 'Could you repeat that, please?' khi cần làm rõ thông tin."],
  "nextPractice": ["Thử lại tình huống này và áp dụng chunk CLARIFYING còn thiếu."],
  "xpAwarded": 100
}
```

**Business rule đối chiếu chunk:** việc xác định `used = true` không yêu cầu khớp nguyên văn — AI Analysis Service so khớp theo ngữ nghĩa/biến thể gần đúng của chunk trong transcript (xem mục 3.1b, SRS). Mọi chunk có `used = false` sau khi session `COMPLETED` sẽ được tự động thêm vào Chunk Bank cá nhân của người dùng (mục 1.2.11) với trạng thái `NEEDS_PRACTICE`.

**Response 200 (đang xử lý):**

```json
{ "sessionId": "ls_9f3a...", "resultStatus": "PROCESSING" }
```

**Response 200 (không đủ dữ liệu — tương ứng nguyên tắc "không bịa điểm" trong SRS):**

```json
{ "sessionId": "ls_9f3a...", "resultStatus": "INSUFFICIENT_DATA" }
```

`resultStatus` enum: `PROCESSING`, `READY`, `INSUFFICIENT_DATA`, `FAILED`.

---

### 1.2.9. GET `/lessons/history`

Lịch sử các LessonSession đã hoàn thành của user hiện tại, dùng cho màn hình tiến độ cá nhân và để hệ thống Level kiểm tra "số scenario hoàn thành" (mục 3.2 SRS).

**Auth:** Bearer JWT

**Query params:** `page`, `pageSize`, `category` (optional), `from`/`to` (ISO date, optional)

**Response 200:**

```json
{
  "data": [
    {
      "sessionId": "ls_9f3a...",
      "scenarioId": "sc_001",
      "scenarioTitle": "Đặt bàn tại nhà hàng",
      "completedAt": "2026-09-18T09:03:00Z",
      "completionRate": 0.75,
      "resultStatus": "READY"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 6, "totalPages": 1 }
}
```

---

---

### 1.2.10. POST `/lessons/sessions/{sessionId}/chunks/drill`

Ghi nhận việc người học đã luyện phản xạ (nghe & nhắc lại) với một chunk trong bước Chunk Drill (US-06b), trước khi vào roleplay. Bước này không chấm điểm chính thức — chỉ dùng để cá nhân hoá Chunk Bank và thống kê mức độ làm quen.

**Auth:** Bearer JWT

**Path params:** `sessionId` (string, required)

**Request body:**

```json
{ "chunkId": "ck_002", "action": "COMPLETED", "attempts": 2 }
```

`action` enum: `COMPLETED` (đã nhắc lại xong), `SKIPPED` (bấm bỏ qua).

**Response 200:**

```json
{ "sessionId": "ls_9f3a...", "chunkId": "ck_002", "recorded": true }
```

**Business rules:**
- Không bắt buộc gọi endpoint này cho mọi chunk trước khi bắt đầu roleplay (US-06b cho phép "Bỏ qua" toàn bộ bước Drill).
- Dữ liệu `action = SKIPPED` nhiều lần cho cùng một `functionTag` có thể dùng làm tín hiệu gợi ý ưu tiên chunk đó trong Chunk Bank.

---

### 1.2.11. GET `/lessons/chunk-bank`

Lấy danh sách chunk cá nhân của người dùng — tổng hợp từ các chunk chưa dùng tốt (`NEEDS_PRACTICE`) qua các Scenario đã luyện, và các chunk đã tự đánh dấu thành thạo.

**Auth:** Bearer JWT

**Query params:**

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `status` | string | Không | `NEEDS_PRACTICE`\|`MASTERED`, mặc định trả cả hai |
| `page`, `pageSize` | integer | Không | Xem mục 0.5 |

**Response 200:**

```json
{
  "data": [
    {
      "chunkId": "ck_002",
      "text": "Could you repeat that, please?",
      "vietnamese": "Bạn có thể lặp lại được không?",
      "functionTag": "CLARIFYING",
      "scenarioTitle": "Đặt bàn tại nhà hàng",
      "status": "NEEDS_PRACTICE",
      "lastSeenAt": "2026-09-18T09:03:00Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 4, "totalPages": 1 }
}
```

**Ghi chú:** MVP chưa áp dụng thuật toán nhắc lại theo lịch trình (spaced repetition) — đây chỉ là danh sách tĩnh để người học tự xem lại; việc lên lịch nhắc tự động nằm ngoài phạm vi MVP (xem SRS, mục 1.2 Out-of-Scope).

---

### 1.2.12. PATCH `/lessons/chunk-bank/{chunkId}`

Cập nhật trạng thái một chunk trong Chunk Bank, thường dùng khi người học tự đánh dấu đã thành thạo.

**Auth:** Bearer JWT

**Path params:** `chunkId` (string, required)

**Request body:**

```json
{ "status": "MASTERED" }
```

**Response 200:**

```json
{ "chunkId": "ck_002", "status": "MASTERED", "updatedAt": "2026-09-20T10:00:00Z" }
```

**Lỗi:** `404 CHUNK_NOT_IN_BANK` nếu chunk chưa từng xuất hiện trong Chunk Bank của người dùng.

---

## 2. GAMIFICATION API (F-04)

### 2.1. Khái niệm chính

| Khái niệm | Mô tả |
|---|---|
| **XP** | Điểm kinh nghiệm, cộng dồn khi hoàn thành hoạt động; chỉ dùng cho gamification, không dùng đơn độc để xác định Level |
| **Streak** | Số ngày liên tiếp hoàn thành ít nhất 1 hoạt động yêu cầu; reset về 0 nếu bỏ lỡ 1 ngày |
| **Daily Mission** | 3 nhiệm vụ hàng ngày cố định trong MVP (Coach 5 phút, 1 Scenario Lesson, 1 Room Session) |
| **Level** | A1→A2→B1→B2→C1, xét theo Overall Communication Score + số session + số scenario (bảng ngưỡng mục 3.2 SRS) |

### 2.2. Bảng quy đổi XP (tham chiếu)

| Hoạt động | XP | `activityType` |
|---|---:|---|
| Hoàn thành Daily Mission | +50 | `DAILY_MISSION_COMPLETED` |
| Hoàn thành Scenario Lesson | +100 | `SCENARIO_LESSON_COMPLETED` |
| Hoàn thành AI Coach Session | +100 | `COACH_SESSION_COMPLETED` |
| Tham gia Room Session | +100 | `ROOM_SESSION_COMPLETED` |
| Hoàn thành toàn bộ Daily Mission trong ngày | +100 (bonus) | `ALL_DAILY_MISSIONS_COMPLETED` |
| Duy trì Streak mỗi ngày | +20/ngày | `STREAK_MAINTAINED` |

### 2.3. Danh sách Endpoint

| # | Method | Path | Mô tả |
|---|---|---|---|
| 2.3.1 | GET | `/gamification/profile` | XP, Level hiện tại, Streak hiện tại |
| 2.3.2 | GET | `/gamification/missions/today` | Danh sách Daily Mission hôm nay + trạng thái |
| 2.3.3 | POST | `/gamification/missions/{missionId}/claim` | Nhận thưởng XP cho mission đã hoàn thành |
| 2.3.4 | GET | `/gamification/level/progress` | Tiến độ tới Level kế tiếp |
| 2.3.5 | GET | `/gamification/streak` | Chi tiết Streak (lịch sử, trạng thái hôm nay) |
| 2.3.6 | POST | `/gamification/xp/award` | **[Internal]** Cộng XP cho một hoạt động |
| 2.3.7 | POST | `/gamification/level/recompute` | **[Internal]** Tính lại và cập nhật Level nếu đủ điều kiện |

---

### 2.3.1. GET `/gamification/profile`

**Auth:** Bearer JWT

**Response 200:**

```json
{
  "userId": "usr_123",
  "xp": 2400,
  "level": "B1",
  "streak": { "current": 12, "longest": 30 },
  "coursesCompletedThisLevel": 8
}
```

---

### 2.3.2. GET `/gamification/missions/today`

**Auth:** Bearer JWT

**Response 200:**

```json
{
  "date": "2026-09-18",
  "missions": [
    {
      "missionId": "coach_5min",
      "title": "Nói chuyện với AI Coach trong 5 phút",
      "progress": 5,
      "target": 5,
      "unit": "phút",
      "status": "COMPLETED",
      "xpReward": 50,
      "claimed": false
    },
    {
      "missionId": "scenario_lesson",
      "title": "Hoàn thành một Scenario Lesson",
      "progress": 0,
      "target": 1,
      "unit": "bài",
      "status": "IN_PROGRESS",
      "xpReward": 50,
      "claimed": false
    },
    {
      "missionId": "room_session",
      "title": "Tham gia một Community Voice Room",
      "progress": 0,
      "target": 1,
      "unit": "phiên",
      "status": "NOT_STARTED",
      "xpReward": 50,
      "claimed": false
    }
  ],
  "allCompletedBonus": { "xpReward": 100, "eligible": false, "claimed": false }
}
```

`status` enum: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`.

---

### 2.3.3. POST `/gamification/missions/{missionId}/claim`

Nhận XP cho một mission đã ở trạng thái `COMPLETED` nhưng chưa `claimed`.

**Auth:** Bearer JWT
**Headers:** `Idempotency-Key` (khuyến nghị)

**Response 200:**

```json
{ "missionId": "coach_5min", "claimed": true, "xpAwarded": 50, "newXpTotal": 2450 }
```

**Lỗi:**
| Code | HTTP | Mô tả |
|---|---|---|
| `MISSION_NOT_COMPLETED` | 409 | Mission chưa đạt target |
| `MISSION_ALREADY_CLAIMED` | 409 | Đã claim trước đó |
| `MISSION_NOT_FOUND` | 404 | missionId không tồn tại cho ngày hôm nay |

---

### 2.3.4. GET `/gamification/level/progress`

**Auth:** Bearer JWT

**Response 200:**

```json
{
  "currentLevel": "B1",
  "nextLevel": "B2",
  "requirements": {
    "overallScore": { "current": 68, "required": 70 },
    "sessionCount": { "current": 22, "required": 20 },
    "scenarioCount": { "current": 6, "required": 5 },
    "minSkillScore": { "current": 55, "required": 60 }
  },
  "eligibleForLevelUp": false
}
```

---

### 2.3.5. GET `/gamification/streak`

**Auth:** Bearer JWT

**Response 200:**

```json
{
  "current": 12,
  "longest": 30,
  "todayCompleted": true,
  "history": [
    { "date": "2026-09-17", "completed": true },
    { "date": "2026-09-16", "completed": true }
  ]
}
```

---

### 2.3.6. POST `/gamification/xp/award` **[Internal]**

Được gọi bởi các service khác (Coach Service, Lessons Service, Room Service) khi một hoạt động hoàn tất, để cộng XP và cập nhật tiến độ Daily Mission/Streak. Không public ra ngoài API Gateway.

**Auth:** `X-Service-Token`
**Headers:** `Idempotency-Key` **bắt buộc** (khóa theo `sourceId` để tránh cộng trùng XP khi retry — xem EC-09 & AC liên quan)

**Request body:**

```json
{
  "userId": "usr_123",
  "activityType": "SCENARIO_LESSON_COMPLETED",
  "sourceId": "ls_9f3a...",
  "occurredAt": "2026-09-18T09:03:00Z"
}
```

**Response 200:**

```json
{
  "userId": "usr_123",
  "xpAwarded": 100,
  "newXpTotal": 2500,
  "missionProgressUpdated": ["scenario_lesson"],
  "streakUpdated": true
}
```

**Business rules:**
- Idempotent theo `(activityType, sourceId)`: gọi lại với cùng cặp giá trị không cộng XP lần 2.
- Sau khi cộng XP, service tự động gọi nội bộ tới bước cập nhật Streak (nếu đây là hoạt động đầu tiên hoàn thành trong ngày) và cập nhật tiến độ Daily Mission tương ứng.
- Sau khi cập nhật, hệ thống trigger `POST /gamification/level/recompute` (async) để kiểm tra điều kiện thăng Level.

---

### 2.3.7. POST `/gamification/level/recompute` **[Internal]**

Tính lại Level dựa trên dữ liệu tổng hợp mới nhất (Overall Communication Score, số session, số scenario, điểm kỹ năng tối thiểu — bảng ngưỡng mục 3.2 SRS).

**Auth:** `X-Service-Token`

**Request body:**

```json
{ "userId": "usr_123" }
```

**Response 200 (không đổi Level):**

```json
{ "userId": "usr_123", "levelChanged": false, "currentLevel": "B1" }
```

**Response 200 (thăng Level):**

```json
{ "userId": "usr_123", "levelChanged": true, "previousLevel": "B1", "currentLevel": "B2" }
```

**Business rules:**
- Chỉ cho phép **tăng** Level qua endpoint này; không hạ Level tự động (theo nguyên tắc SRS: không hạ Level chỉ vì một buổi học kết quả thấp).
- Việc hạ Level (nếu có trong tương lai) phải là một quy trình riêng, đánh giá theo xu hướng nhiều session, không nằm trong phạm vi MVP.

---

## 3. Bảng mã lỗi tổng hợp (Error Codes Reference)

| Code | HTTP | Áp dụng cho |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Mọi endpoint POST/PATCH |
| `UNAUTHORIZED` | 401 | Mọi endpoint |
| `FORBIDDEN` | 403 | Truy cập resource không thuộc sở hữu |
| `SCENARIO_NOT_FOUND` | 404 | Lessons API |
| `SESSION_NOT_FOUND` | 404 | Lessons API |
| `MISSION_NOT_FOUND` | 404 | Gamification API |
| `CHUNK_NOT_IN_BANK` | 404 | Lessons API (Chunk Bank) |
| `PROFILE_INCOMPLETE` | 422 | Lessons API (start session) |
| `SESSION_ALREADY_ACTIVE` | 409 | Lessons API |
| `SESSION_NOT_ACTIVE` | 409 | Lessons API |
| `SESSION_ALREADY_ENDED` | 409 | Lessons API |
| `MISSION_NOT_COMPLETED` | 409 | Gamification API |
| `MISSION_ALREADY_CLAIMED` | 409 | Gamification API |
| `INSUFFICIENT_DATA` | — (không phải lỗi, là `resultStatus`) | Lessons API |
| `RATE_LIMITED` | 429 | Mọi endpoint public |
| `INTERNAL_ERROR` | 500 | Mọi endpoint |

---

## 4. Sự kiện nội bộ liên quan (Event Contract — tham khảo)

Ngoài gọi API trực tiếp, các service có thể giao tiếp qua message queue (khuyến nghị cho môi trường production nhiều instance):

| Event | Publisher | Subscriber | Payload chính |
|---|---|---|---|
| `lesson_session.completed` | Lessons Service | Gamification Service | `userId, sessionId, scenarioId, completionRate` |
| `coach_session.completed` | Coach Service | Gamification Service | `userId, sessionId, durationSeconds` |
| `room_session.completed` | Room Service | Gamification Service | `userId, roomId, durationSeconds` |
| `xp.awarded` | Gamification Service | Notification Service | `userId, xpAwarded, newXpTotal` |
| `level.changed` | Gamification Service | Notification Service, Lessons Service | `userId, previousLevel, currentLevel` |

Payload nên bao gồm `eventId` duy nhất để subscriber tự đảm bảo idempotency, tương tự cơ chế `Idempotency-Key` ở REST API.
