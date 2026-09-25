# API SPECIFICATION – PART 1

## Authentication, User Profile & AI Coach WebSocket (`/ws/ai-coach`)

|               |                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Dự án**     | TalkWithMe                                                                                                                          |
| **Tài liệu**  | `docs/API_SPEC_PART1.md`                                                                                                            |
| **Phiên bản** | 1.0                                                                                                                                 |
| **Phạm vi**   | Authentication API, User Profile API, WebSocket `/ws/ai-coach` (AI Coach — F-01)                                                    |
| **Liên quan** | `DETAILED_FEATURE_SRS_PART2.md` (F-01, mục 2.2, mục 6), `docs/API_SPEC_PART2.md` (Lessons & Gamification API), `DATA_DICTIONARY.md` |

---

## 0. Quy ước chung (Conventions)

Áp dụng thống nhất với `DETAILED_FEATURE_SRS_PART2.md`.

### 0.1. Base URL

```
REST:      https://api.talkwithme.app/v1
WebSocket: wss://api.talkwithme.app/v1/ws
```

### 0.2. Authentication

Mọi endpoint REST (trừ `POST /auth/register`, `POST /auth/login`, `POST /auth/oauth/{provider}`, `POST /auth/refresh`, `POST /auth/forgot-password`, `POST /auth/reset-password`) yêu cầu Bearer JWT:

```
Authorization: Bearer <access_token>
```

WebSocket không dùng header `Authorization` (do giới hạn của một số client WebSocket) — xem cơ chế xác thực riêng ở mục 3.3.

### 0.3. Access Token & Refresh Token

| Token          | Thời hạn                     | Vai trò                                                                               |
| -------------- | ---------------------------- | ------------------------------------------------------------------------------------- |
| `accessToken`  | 15 phút                      | Dùng cho `Authorization` header của REST và bước `auth` của WebSocket                 |
| `refreshToken` | 30 ngày, rotate mỗi lần dùng | Dùng để lấy `accessToken` mới qua `POST /auth/refresh`, lưu ở client (secure storage) |

JWT payload (accessToken):

```json
{
  "sub": "usr_123",
  "email": "user@example.com",
  "tokenType": "access",
  "iat": 1758300000,
  "exp": 1758300900
}
```

### 0.4. Định dạng lỗi chuẩn

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email hoặc mật khẩu không đúng.",
    "details": null,
    "requestId": "b3a1f2c0-..."
  }
}
```

| HTTP Status | Ý nghĩa                                    |
| ----------- | ------------------------------------------ |
| 400         | Request không hợp lệ                       |
| 401         | Chưa xác thực / token hết hạn hoặc sai     |
| 403         | Không có quyền / tài khoản bị khoá         |
| 404         | Không tìm thấy resource                    |
| 409         | Xung đột trạng thái (VD: email đã tồn tại) |
| 422         | Business rule violation                    |
| 429         | Vượt rate limit                            |
| 500         | Lỗi hệ thống                               |

### 0.5. Headers chung

| Header          | Bắt buộc                 | Mô tả                                                           |
| --------------- | ------------------------ | --------------------------------------------------------------- |
| `Authorization` | Có (trừ endpoint public) | `Bearer <JWT>`                                                  |
| `Content-Type`  | Có (POST/PATCH)          | `application/json`                                              |
| `X-Request-Id`  | Không                    | UUID do client sinh, dùng để trace log                          |
| `X-Device-Id`   | Khuyến nghị              | Định danh thiết bị, dùng để quản lý phiên đăng nhập đa thiết bị |

---

## 1. AUTHENTICATION API

### 1.1. Resource Model

```
User (1) ──1── UserProfile
User (1) ──< RefreshToken (N)   (quản lý session đăng nhập đa thiết bị, xem Data Dictionary bảng users)
```

### 1.2. Danh sách Endpoint

| #     | Method | Path                     | Mô tả                                   |
| ----- | ------ | ------------------------ | --------------------------------------- |
| 1.2.1 | POST   | `/auth/register`         | Đăng ký tài khoản bằng email/mật khẩu   |
| 1.2.2 | POST   | `/auth/login`            | Đăng nhập bằng email/mật khẩu           |
| 1.2.3 | POST   | `/auth/oauth/{provider}` | Đăng nhập/đăng ký qua Google hoặc Apple |
| 1.2.4 | POST   | `/auth/refresh`          | Lấy `accessToken` mới từ `refreshToken` |
| 1.2.5 | POST   | `/auth/logout`           | Thu hồi `refreshToken` hiện tại         |
| 1.2.6 | POST   | `/auth/forgot-password`  | Gửi email đặt lại mật khẩu              |
| 1.2.7 | POST   | `/auth/reset-password`   | Đặt lại mật khẩu bằng token từ email    |

---

### 1.2.1. POST `/auth/register`

**Auth:** Không yêu cầu

**Request JSON Schema:**

```json
{
  "$id": "AuthRegisterRequest",
  "type": "object",
  "required": ["email", "password", "fullName"],
  "properties": {
    "email": { "type": "string", "format": "email", "maxLength": 254 },
    "password": { "type": "string", "minLength": 8, "maxLength": 72 },
    "fullName": { "type": "string", "minLength": 1, "maxLength": 120 }
  }
}
```

**Request ví dụ:**

```json
{
  "email": "arka@example.com",
  "password": "Str0ngP@ss!",
  "fullName": "Arka Maulana"
}
```

**Response 201 JSON Schema:**

```json
{
  "$id": "AuthTokenResponse",
  "type": "object",
  "required": [
    "userId",
    "email",
    "fullName",
    "accessToken",
    "refreshToken",
    "expiresIn"
  ],
  "properties": {
    "userId": { "type": "string", "format": "uuid" },
    "email": { "type": "string", "format": "email" },
    "fullName": { "type": "string" },
    "accessToken": { "type": "string" },
    "refreshToken": { "type": "string" },
    "expiresIn": {
      "type": "integer",
      "description": "Số giây accessToken còn hiệu lực"
    }
  }
}
```

**Response ví dụ:**

```json
{
  "userId": "usr_123",
  "email": "arka@example.com",
  "fullName": "Arka Maulana",
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "rtk_9f3a...",
  "expiresIn": 900
}
```

**Business rules:**

- Mật khẩu tối thiểu 8 ký tự, phải chứa ít nhất 1 chữ hoa, 1 chữ số (validate ở tầng backend, không chỉ frontend).
- Tự động tạo bản ghi `user_profiles` rỗng (`onboarding_completed = false`) và `gamification_profiles` khởi tạo (`xp = 0, level = 'A1'`) ngay khi tạo `users`.

**Lỗi:**
| Code | HTTP | Mô tả |
|---|---|---|
| `EMAIL_ALREADY_EXISTS` | 409 | Email đã được đăng ký |
| `WEAK_PASSWORD` | 400 | Mật khẩu không đạt yêu cầu độ mạnh |
| `VALIDATION_ERROR` | 400 | Thiếu field hoặc sai định dạng |

---

### 1.2.2. POST `/auth/login`

**Auth:** Không yêu cầu

**Request JSON Schema:**

```json
{
  "$id": "AuthLoginRequest",
  "type": "object",
  "required": ["email", "password"],
  "properties": {
    "email": { "type": "string", "format": "email" },
    "password": { "type": "string", "minLength": 1 }
  }
}
```

**Response 200:** giống `AuthTokenResponse` (mục 1.2.1), thêm field `isNewUser: false`.

**Lỗi:**
| Code | HTTP | Mô tả |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Email hoặc mật khẩu không đúng (thông báo chung, không tiết lộ email tồn tại hay không) |
| `ACCOUNT_SUSPENDED` | 403 | Tài khoản đã bị khoá (`users.status = 'SUSPENDED'`) |

---

### 1.2.3. POST `/auth/oauth/{provider}`

Đăng nhập/đăng ký qua bên thứ ba. `provider`: `google` \| `apple`.

**Auth:** Không yêu cầu

**Request JSON Schema:**

```json
{
  "$id": "AuthOAuthRequest",
  "type": "object",
  "required": ["idToken"],
  "properties": {
    "idToken": {
      "type": "string",
      "description": "ID token trả về từ Google/Apple SDK phía client"
    }
  }
}
```

**Response 200:** giống `AuthTokenResponse`, thêm field `isNewUser: boolean` (`true` nếu đây là lần đầu đăng nhập, hệ thống vừa tạo tài khoản mới).

**Business rules:**

- Backend xác thực `idToken` trực tiếp với Google/Apple trước khi tin tưởng email trong token.
- Nếu email từ OAuth trùng với một tài khoản `local` đã tồn tại, liên kết tài khoản OAuth vào `users` hiện có (cập nhật `auth_provider`), không tạo tài khoản trùng.

**Lỗi:**
| Code | HTTP | Mô tả |
|---|---|---|
| `INVALID_OAUTH_TOKEN` | 401 | `idToken` không hợp lệ hoặc hết hạn |
| `OAUTH_PROVIDER_NOT_SUPPORTED` | 400 | `provider` không phải `google`/`apple` |

---

### 1.2.4. POST `/auth/refresh`

**Auth:** Không yêu cầu (xác thực bằng chính `refreshToken`)

**Request JSON Schema:**

```json
{
  "$id": "AuthRefreshRequest",
  "type": "object",
  "required": ["refreshToken"],
  "properties": { "refreshToken": { "type": "string" } }
}
```

**Response 200 JSON Schema:**

```json
{
  "$id": "AuthRefreshResponse",
  "type": "object",
  "required": ["accessToken", "refreshToken", "expiresIn"],
  "properties": {
    "accessToken": { "type": "string" },
    "refreshToken": {
      "type": "string",
      "description": "refreshToken mới (rotate) — client phải thay thế token cũ"
    },
    "expiresIn": { "type": "integer" }
  }
}
```

**Business rules:**

- Áp dụng **refresh token rotation**: mỗi lần refresh thành công, `refreshToken` cũ bị vô hiệu hoá ngay lập tức và trả về token mới. Nếu một `refreshToken` đã bị vô hiệu hoá được dùng lại (dấu hiệu bị đánh cắp), thu hồi toàn bộ token của user và yêu cầu đăng nhập lại.

**Lỗi:**
| Code | HTTP | Mô tả |
|---|---|---|
| `REFRESH_TOKEN_INVALID` | 401 | Token không tồn tại/đã bị thu hồi |
| `REFRESH_TOKEN_EXPIRED` | 401 | Token hết hạn (>30 ngày) |
| `REFRESH_TOKEN_REUSE_DETECTED` | 401 | Phát hiện dùng lại token cũ đã rotate — toàn bộ session bị thu hồi |

---

### 1.2.5. POST `/auth/logout`

**Auth:** Bearer JWT

**Request JSON Schema:**

```json
{
  "$id": "AuthLogoutRequest",
  "type": "object",
  "required": ["refreshToken"],
  "properties": { "refreshToken": { "type": "string" } }
}
```

**Response:** `204 No Content`

**Business rules:** chỉ thu hồi `refreshToken` được truyền vào (thiết bị hiện tại); không ảnh hưởng đến session đăng nhập trên thiết bị khác. Muốn đăng xuất toàn bộ thiết bị, dùng `DELETE /auth/sessions` (ngoài phạm vi MVP, ghi chú cho tương lai).

---

### 1.2.6. POST `/auth/forgot-password`

**Auth:** Không yêu cầu

**Request JSON Schema:**

```json
{
  "$id": "AuthForgotPasswordRequest",
  "type": "object",
  "required": ["email"],
  "properties": { "email": { "type": "string", "format": "email" } }
}
```

**Response 200 (luôn trả cùng một thông điệp, kể cả khi email không tồn tại — chống dò email):**

```json
{
  "message": "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu."
}
```

**Business rules:** token đặt lại mật khẩu (gửi qua email) có hiệu lực 15 phút, dùng một lần.

---

### 1.2.7. POST `/auth/reset-password`

**Auth:** Không yêu cầu

**Request JSON Schema:**

```json
{
  "$id": "AuthResetPasswordRequest",
  "type": "object",
  "required": ["resetToken", "newPassword"],
  "properties": {
    "resetToken": { "type": "string" },
    "newPassword": { "type": "string", "minLength": 8, "maxLength": 72 }
  }
}
```

**Response:** `200 OK`, `{ "message": "Đặt lại mật khẩu thành công." }`

**Lỗi:**
| Code | HTTP | Mô tả |
|---|---|---|
| `RESET_TOKEN_INVALID` | 401 | Token sai/đã dùng |
| `RESET_TOKEN_EXPIRED` | 401 | Token hết hạn (>15 phút) |
| `WEAK_PASSWORD` | 400 | Mật khẩu mới không đạt yêu cầu |

**Business rules:** sau khi đặt lại mật khẩu thành công, thu hồi toàn bộ `refreshToken` hiện có của user (buộc đăng nhập lại trên mọi thiết bị).

---

## 2. USER PROFILE API

### 2.1. Resource Model

```
User (1) ──1── UserProfile   (level, interests, communicationGoal, weakPoints, preferredTopics, onboardingCompleted)
```

Tương ứng bảng `users` + `user_profiles` trong `DATA_DICTIONARY.md`.

### 2.2. Danh sách Endpoint

| #     | Method | Path                   | Mô tả                                             |
| ----- | ------ | ---------------------- | ------------------------------------------------- |
| 2.2.1 | GET    | `/users/me`            | Lấy thông tin tài khoản hiện tại                  |
| 2.2.2 | GET    | `/users/me/profile`    | Lấy hồ sơ học tập hiện tại                        |
| 2.2.3 | PATCH  | `/users/me/profile`    | Cập nhật một phần hồ sơ học tập                   |
| 2.2.4 | POST   | `/users/me/onboarding` | Hoàn tất khảo sát ban đầu, khởi tạo hồ sơ học tập |
| 2.2.5 | DELETE | `/users/me`            | Yêu cầu xoá tài khoản                             |

---

### 2.2.1. GET `/users/me`

**Auth:** Bearer JWT

**Response 200 JSON Schema:**

```json
{
  "$id": "UserResponse",
  "type": "object",
  "required": [
    "userId",
    "email",
    "fullName",
    "authProvider",
    "status",
    "createdAt"
  ],
  "properties": {
    "userId": { "type": "string", "format": "uuid" },
    "email": { "type": "string", "format": "email" },
    "fullName": { "type": "string" },
    "authProvider": { "type": "string", "enum": ["local", "google", "apple"] },
    "status": { "type": "string", "enum": ["ACTIVE", "SUSPENDED", "DELETED"] },
    "createdAt": { "type": "string", "format": "date-time" },
    "lastLoginAt": { "type": ["string", "null"], "format": "date-time" }
  }
}
```

---

### 2.2.2. GET `/users/me/profile`

**Auth:** Bearer JWT

**Response 200 JSON Schema:**

```json
{
  "$id": "UserProfileResponse",
  "type": "object",
  "required": ["userId", "level", "onboardingCompleted"],
  "properties": {
    "userId": { "type": "string", "format": "uuid" },
    "level": { "type": "string", "enum": ["A1", "A2", "B1", "B2", "C1"] },
    "interests": { "type": "array", "items": { "type": "string" } },
    "communicationGoal": { "type": ["string", "null"] },
    "weakPoints": { "type": "array", "items": { "type": "string" } },
    "preferredTopics": { "type": "array", "items": { "type": "string" } },
    "onboardingCompleted": { "type": "boolean" },
    "updatedAt": { "type": "string", "format": "date-time" }
  }
}
```

**Response ví dụ:**

```json
{
  "userId": "usr_123",
  "level": "B1",
  "interests": ["travel", "technology"],
  "communicationGoal": "Tự tin phỏng vấn xin việc bằng tiếng Anh",
  "weakPoints": ["past_tense", "filler_words"],
  "preferredTopics": ["workplace", "travel"],
  "onboardingCompleted": true,
  "updatedAt": "2026-09-18T09:00:00Z"
}
```

---

### 2.2.3. PATCH `/users/me/profile`

Cập nhật một phần hồ sơ. Chỉ gửi các field cần thay đổi.

**Auth:** Bearer JWT

**Request JSON Schema:**

```json
{
  "$id": "UserProfileUpdateRequest",
  "type": "object",
  "minProperties": 1,
  "properties": {
    "interests": {
      "type": "array",
      "items": { "type": "string" },
      "maxItems": 10
    },
    "communicationGoal": { "type": "string", "maxLength": 500 },
    "preferredTopics": {
      "type": "array",
      "items": { "type": "string" },
      "maxItems": 10
    }
  },
  "additionalProperties": false
}
```

**Response 200:** `UserProfileResponse` (mục 2.2.2) đã cập nhật.

**Business rules:**

- `level` **không** nằm trong schema cho phép cập nhật thủ công qua endpoint này — Level chỉ được thay đổi qua `POST /gamification/level/recompute` **[Internal]** (xem `docs/API_SPEC_PART2.md`, mục 2.3.7), trừ lần khởi tạo ban đầu ở bước Onboarding (mục 2.2.4).
- `weakPoints` cũng không cho client tự sửa — chỉ được hệ thống ghi nhận tự động từ AI Analysis Service.

**Lỗi:**
| Code | HTTP | Mô tả |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Field không hợp lệ hoặc gửi field bị cấm (`level`, `weakPoints`) |

---

### 2.2.4. POST `/users/me/onboarding`

Hoàn tất khảo sát ban đầu (chọn trình độ tự đánh giá hoặc theo bài kiểm tra xếp lớp, sở thích, mục tiêu). Bắt buộc gọi trước khi có thể bắt đầu `CoachSession` hoặc `LessonSession` (xem `PROFILE_INCOMPLETE` trong `docs/API_SPEC_PART2.md`).

**Auth:** Bearer JWT

**Request JSON Schema:**

```json
{
  "$id": "OnboardingRequest",
  "type": "object",
  "required": ["initialLevel", "communicationGoal"],
  "properties": {
    "initialLevel": {
      "type": "string",
      "enum": ["A1", "A2", "B1", "B2", "C1"]
    },
    "interests": {
      "type": "array",
      "items": { "type": "string" },
      "maxItems": 10
    },
    "communicationGoal": { "type": "string", "maxLength": 500 },
    "preferredTopics": {
      "type": "array",
      "items": { "type": "string" },
      "maxItems": 10
    }
  }
}
```

**Response 200:** `UserProfileResponse` với `onboardingCompleted = true`.

**Business rules:**

- Gọi endpoint này lần thứ 2 trở đi sẽ trả lỗi `409 ONBOARDING_ALREADY_COMPLETED` — muốn đổi `level`/sở thích sau đó, dùng `PATCH /users/me/profile` (trừ `level`, vốn do hệ thống tự quản lý từ thời điểm này trở đi).

**Lỗi:**
| Code | HTTP | Mô tả |
|---|---|---|
| `ONBOARDING_ALREADY_COMPLETED` | 409 | Đã hoàn tất onboarding trước đó |
| `VALIDATION_ERROR` | 400 | Thiếu `initialLevel`/`communicationGoal` hoặc sai enum |

---

### 2.2.5. DELETE `/users/me`

Yêu cầu xoá tài khoản (đánh dấu `status = 'DELETED'`, ẩn danh hoá dữ liệu cá nhân theo chính sách bảo mật; không xoá cứng ngay lập tức để phục vụ đối soát/khiếu nại trong một khoảng thời gian giữ lại theo chính sách công ty).

**Auth:** Bearer JWT

**Request JSON Schema:**

```json
{
  "$id": "DeleteAccountRequest",
  "type": "object",
  "required": ["confirmation"],
  "properties": {
    "confirmation": { "type": "string", "const": "DELETE" }
  }
}
```

**Response:** `202 Accepted`, `{ "message": "Yêu cầu xoá tài khoản đã được ghi nhận." }`

---

## 3. WEBSOCKET `/ws/ai-coach` (AI Coach — F-01)

### 3.1. Mục đích

Kênh giao tiếp hai chiều thời gian thực phục vụ toàn bộ vòng đời một `CoachSession`: xác thực kết nối, bắt đầu session, stream audio, nhận Live Script (partial/final transcript), nhận phản hồi của AI, và kết thúc session. Thay thế việc gọi nhiều REST request riêng lẻ cho từng đoạn hội thoại (giảm độ trễ, đúng yêu cầu "gần thời gian thực" trong SRS mục 4).

> Với Scenario Lessons (F-02), kênh tương ứng là `/ws/lessons` — dùng cùng nguyên tắc message nhưng nằm ngoài phạm vi tài liệu Part 1 này (tham khảo `docs/API_SPEC_PART2.md` cho REST endpoints tương ứng).

### 3.2. Kết nối (Handshake)

```
wss://api.talkwithme.app/v1/ws/ai-coach
```

- Không truyền JWT qua query string (tránh lộ token trong access log của proxy/CDN).
- Sau khi kết nối WebSocket thành công (bắt tay HTTP Upgrade hoàn tất), client **bắt buộc** gửi message `auth` là message đầu tiên (mục 3.4.1). Server chờ tối đa 5 giây; nếu không nhận được `auth` hợp lệ, server đóng kết nối với close code `4401`.
- Một user chỉ được phép có **1 kết nối `/ws/ai-coach` đang ACTIVE** tại một thời điểm; kết nối thứ 2 từ cùng user sẽ khiến server đóng kết nối cũ với close code `4409` trước khi chấp nhận kết nối mới (tránh 2 session chồng chéo trên nhiều thiết bị).

### 3.3. Xác thực & vòng đời kết nối

```
Client                                   Server
  |--- WebSocket Upgrade ----------------->|
  |<-- 101 Switching Protocols ------------|
  |--- {"type":"auth", token} ------------>|
  |<-- {"type":"auth_ack", status:"ok"} ---|
  |--- {"type":"start_session", topic} --->|
  |<-- {"type":"session_started", ...} ----|
  |--- {"type":"audio_chunk", ...} x N --->|
  |<-- {"type":"transcript_partial"} ------|
  |<-- {"type":"transcript_final"} --------|
  |<-- {"type":"ai_thinking"} -------------|
  |<-- {"type":"ai_response", ...} --------|
  |            ... lặp lại các lượt ...    |
  |--- {"type":"end_session"} ------------>|
  |<-- {"type":"session_ending"} ----------|
  |<-- {"type":"session_ended"} -----------|
  |<-- {"type":"feedback_ready"} ----------|
  |--- Close (1000) ----------------------|
```

**Heartbeat:** client gửi `ping` mỗi 20 giây; server phản hồi `pong`. Nếu server không nhận được `ping` trong 45 giây, coi kết nối đã chết và đóng (dọn dẹp `session:coach:{sessionId}` trong Redis — xem `DATA_DICTIONARY.md` mục 2.1).

### 3.4. Message Schema — Client → Server

#### 3.4.1. `auth`

```json
{
  "$id": "WsAuthMessage",
  "type": "object",
  "required": ["type", "token"],
  "properties": {
    "type": { "const": "auth" },
    "token": {
      "type": "string",
      "description": "accessToken JWT, giống REST Authorization header"
    }
  }
}
```

#### 3.4.2. `start_session`

```json
{
  "$id": "WsStartSessionMessage",
  "type": "object",
  "required": ["type", "topic"],
  "properties": {
    "type": { "const": "start_session" },
    "topic": { "type": "string", "maxLength": 200 }
  }
}
```

**Business rule:** server kiểm tra `user_profiles.onboarding_completed = true` trước khi tạo `coach_sessions`; nếu chưa, gửi `error` với `code = "PROFILE_INCOMPLETE"` và đóng kết nối.

#### 3.4.3. `audio_chunk`

```json
{
  "$id": "WsAudioChunkMessage",
  "type": "object",
  "required": [
    "type",
    "sessionId",
    "seq",
    "audioBase64",
    "format",
    "sampleRate"
  ],
  "properties": {
    "type": { "const": "audio_chunk" },
    "sessionId": { "type": "string", "format": "uuid" },
    "seq": {
      "type": "integer",
      "minimum": 0,
      "description": "Số thứ tự chunk, tăng dần, dùng để phát hiện mất gói"
    },
    "audioBase64": {
      "type": "string",
      "description": "Dữ liệu audio đã encode base64"
    },
    "format": { "type": "string", "enum": ["opus", "pcm16"] },
    "sampleRate": { "type": "integer", "enum": [16000, 48000] },
    "isLast": {
      "type": "boolean",
      "default": false,
      "description": "true nếu đây là chunk cuối của một lượt nói (kết thúc utterance)"
    }
  }
}
```

**Business rule:** khi `isLast = true`, server chốt (finalize) transcript của lượt nói đó, ghi vào `transcript_segments` (`is_final = true`), rồi mới gọi AI Language Model sinh phản hồi — tránh gọi AI khi transcript còn dở dang.

#### 3.4.4. `end_session`

```json
{
  "$id": "WsEndSessionMessage",
  "type": "object",
  "required": ["type"],
  "properties": {
    "type": { "const": "end_session" },
    "sessionId": { "type": "string", "format": "uuid" },
    "reason": {
      "type": "string",
      "enum": ["USER_ENDED", "TIMEOUT", "ERROR_RECOVERY"],
      "default": "USER_ENDED"
    }
  }
}
```

#### 3.4.5. `ping`

```json
{
  "$id": "WsPingMessage",
  "type": "object",
  "required": ["type"],
  "properties": { "type": { "const": "ping" } }
}
```

---

### 3.5. Message Schema — Server → Client

#### 3.5.1. `auth_ack`

```json
{
  "$id": "WsAuthAckMessage",
  "type": "object",
  "required": ["type", "status"],
  "properties": {
    "type": { "const": "auth_ack" },
    "status": { "type": "string", "enum": ["ok", "error"] },
    "message": { "type": "string" }
  }
}
```

#### 3.5.2. `session_started`

```json
{
  "$id": "WsSessionStartedMessage",
  "type": "object",
  "required": ["type", "sessionId", "status"],
  "properties": {
    "type": { "const": "session_started" },
    "sessionId": { "type": "string", "format": "uuid" },
    "status": { "const": "ACTIVE" },
    "aiOpeningText": {
      "type": "string",
      "description": "Câu mở đầu của AI theo topic/level"
    },
    "aiOpeningAudioUrl": {
      "type": ["string", "null"],
      "description": "TTS audio của câu mở đầu, null nếu client tự dùng TTS phía client"
    }
  }
}
```

#### 3.5.3. `transcript_partial`

```json
{
  "$id": "WsTranscriptPartialMessage",
  "type": "object",
  "required": ["type", "sessionId", "speaker", "text"],
  "properties": {
    "type": { "const": "transcript_partial" },
    "sessionId": { "type": "string", "format": "uuid" },
    "speaker": { "const": "USER" },
    "text": { "type": "string" },
    "confidence": { "type": ["number", "null"], "minimum": 0, "maximum": 1 }
  }
}
```

> Không ghi `transcript_partial` xuống PostgreSQL — chỉ cập nhật cache `session:coach:{sessionId}.pendingPartialText` (Redis, xem `DATA_DICTIONARY.md` mục 2.1), tránh ghi DB liên tục.

#### 3.5.4. `transcript_final`

```json
{
  "$id": "WsTranscriptFinalMessage",
  "type": "object",
  "required": [
    "type",
    "sessionId",
    "segmentId",
    "speaker",
    "text",
    "startTime",
    "isFinal"
  ],
  "properties": {
    "type": { "const": "transcript_final" },
    "sessionId": { "type": "string", "format": "uuid" },
    "segmentId": { "type": "string", "format": "uuid" },
    "speaker": { "type": "string", "enum": ["USER", "AI"] },
    "text": { "type": "string" },
    "startTime": { "type": "number" },
    "endTime": { "type": ["number", "null"] },
    "confidence": { "type": ["number", "null"], "minimum": 0, "maximum": 1 },
    "isFinal": { "const": true }
  }
}
```

#### 3.5.5. `ai_thinking`

```json
{
  "$id": "WsAiThinkingMessage",
  "type": "object",
  "required": ["type", "sessionId"],
  "properties": {
    "type": { "const": "ai_thinking" },
    "sessionId": { "type": "string", "format": "uuid" }
  }
}
```

Dùng để frontend hiển thị UX state "Processing" (SRS mục 5.1) trong lúc chờ AI Language Model sinh phản hồi.

#### 3.5.6. `ai_response`

```json
{
  "$id": "WsAiResponseMessage",
  "type": "object",
  "required": ["type", "sessionId", "segmentId", "text"],
  "properties": {
    "type": { "const": "ai_response" },
    "sessionId": { "type": "string", "format": "uuid" },
    "segmentId": { "type": "string", "format": "uuid" },
    "text": { "type": "string" },
    "audioUrl": {
      "type": ["string", "null"],
      "description": "TTS audio của câu trả lời AI"
    }
  }
}
```

Server tự động ghi message này vào `transcript_segments` với `speaker_type = 'AI'`, `is_final = true` trước khi gửi cho client (không cần client gọi thêm REST để lưu lời AI).

#### 3.5.7. `session_ending` / `session_ended`

```json
{
  "$id": "WsSessionEndingMessage",
  "type": "object",
  "required": ["type", "sessionId", "status"],
  "properties": {
    "type": { "const": "session_ending" },
    "sessionId": { "type": "string", "format": "uuid" },
    "status": { "const": "ENDING" }
  }
}
```

```json
{
  "$id": "WsSessionEndedMessage",
  "type": "object",
  "required": ["type", "sessionId", "status", "durationSeconds"],
  "properties": {
    "type": { "const": "session_ended" },
    "sessionId": { "type": "string", "format": "uuid" },
    "status": { "const": "COMPLETED" },
    "durationSeconds": { "type": "integer" }
  }
}
```

#### 3.5.8. `feedback_ready`

```json
{
  "$id": "WsFeedbackReadyMessage",
  "type": "object",
  "required": ["type", "sessionId", "resultStatus"],
  "properties": {
    "type": { "const": "feedback_ready" },
    "sessionId": { "type": "string", "format": "uuid" },
    "resultStatus": {
      "type": "string",
      "enum": ["READY", "INSUFFICIENT_DATA", "FAILED"]
    }
  }
}
```

**Business rule:** message này chỉ là tín hiệu (notification) — client sau đó gọi `GET /api/coach/sessions/{id}/feedback` (REST, xem `SRS_TalkWithMe_v2.md` mục 5.2) để lấy nội dung đầy đủ, tránh truyền payload lớn qua WebSocket sau khi kết nối có thể đã sắp đóng.

#### 3.5.9. `error`

```json
{
  "$id": "WsErrorMessage",
  "type": "object",
  "required": ["type", "code", "message", "recoverable"],
  "properties": {
    "type": { "const": "error" },
    "code": { "type": "string" },
    "message": { "type": "string" },
    "recoverable": {
      "type": "boolean",
      "description": "true nếu client có thể tự retry (VD lỗi STT tạm thời), false nếu cần đóng và mở lại kết nối"
    }
  }
}
```

#### 3.5.10. `pong`

```json
{
  "$id": "WsPongMessage",
  "type": "object",
  "required": ["type"],
  "properties": { "type": { "const": "pong" } }
}
```

---

### 3.6. Mã lỗi & Close Code cho WebSocket

| Code (trong message `error`) | recoverable | Mô tả                                                       | Tương ứng EC trong SRS |
| ---------------------------- | ----------- | ----------------------------------------------------------- | ---------------------- |
| `AUTH_FAILED`                | false       | Token không hợp lệ/hết hạn khi gửi `auth`                   | —                      |
| `PROFILE_INCOMPLETE`         | false       | Chưa hoàn tất Onboarding                                    | mục 4 SRS              |
| `STT_TIMEOUT`                | true        | Dịch vụ STT không phản hồi kịp, server sẽ tự retry          | STT timeout            |
| `AI_RESPONSE_TIMEOUT`        | true        | AI Language Model không phản hồi kịp, server sẽ tự retry    | AI response timeout    |
| `AUDIO_FORMAT_INVALID`       | false       | `format`/`sampleRate` không được hỗ trợ                     | —                      |
| `SESSION_NOT_FOUND`          | false       | `sessionId` không khớp với session đang mở trên kết nối này | —                      |
| `RATE_LIMITED`               | true        | Gửi `audio_chunk` quá nhanh so với giới hạn                 | —                      |
| `INTERNAL_ERROR`             | true        | Lỗi hệ thống không xác định, có thể thử lại                 | —                      |

| WebSocket Close Code | Ý nghĩa                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `1000`               | Đóng bình thường (client hoặc server chủ động kết thúc đúng luồng) |
| `1011`               | Lỗi server không mong muốn                                         |
| `4401`               | Xác thực thất bại hoặc không gửi `auth` trong 5 giây đầu           |
| `4409`               | Có kết nối `/ws/ai-coach` khác của cùng user đang ACTIVE           |
| `4429`               | Vượt rate limit kết nối/message                                    |

### 3.7. Ghi chú xử lý mất kết nối (Reconnect)

Theo EC "Mất mạng khi đang nói" trong SRS mục 7: khi client phát hiện kết nối WebSocket đóng đột ngột (không phải do nhận `session_ended`), client:

1. Hiển thị trạng thái `Reconnecting`.
2. Thử kết nối lại theo backoff (1s → 2s → 4s → tối đa 16s, tối đa 5 lần).
3. Sau khi kết nối lại và `auth` thành công, gửi lại `start_session` **không kèm topic mới** mà kèm `sessionId` cũ (mở rộng schema `start_session` với field `resumeSessionId` tuỳ chọn) để server khôi phục session `ACTIVE` hiện có thay vì tạo mới, tránh tạo `CoachSession` trùng lặp.
4. Nếu server xác nhận `sessionId` cũ vẫn `ACTIVE` (chưa timeout quá 30 phút không hoạt động — xem TTL Redis mục 2.1 `DATA_DICTIONARY.md`), trả `session_started` với cùng `sessionId`; nếu đã hết hạn, trả `error` với `code = "SESSION_NOT_FOUND"` và client cần bắt đầu session mới.

---

## 4. Bảng mã lỗi REST tổng hợp (Authentication & User Profile)

| Code                                                                                 | HTTP | Áp dụng cho                                                           |
| ------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------------- |
| `VALIDATION_ERROR`                                                                   | 400  | Mọi endpoint POST/PATCH                                               |
| `WEAK_PASSWORD`                                                                      | 400  | `/auth/register`, `/auth/reset-password`                              |
| `UNAUTHORIZED`                                                                       | 401  | Mọi endpoint yêu cầu Bearer JWT                                       |
| `INVALID_CREDENTIALS`                                                                | 401  | `/auth/login`                                                         |
| `INVALID_OAUTH_TOKEN`                                                                | 401  | `/auth/oauth/{provider}`                                              |
| `REFRESH_TOKEN_INVALID` \| `REFRESH_TOKEN_EXPIRED` \| `REFRESH_TOKEN_REUSE_DETECTED` | 401  | `/auth/refresh`                                                       |
| `RESET_TOKEN_INVALID` \| `RESET_TOKEN_EXPIRED`                                       | 401  | `/auth/reset-password`                                                |
| `ACCOUNT_SUSPENDED`                                                                  | 403  | `/auth/login` và mọi endpoint khác nếu `users.status = SUSPENDED`     |
| `EMAIL_ALREADY_EXISTS`                                                               | 409  | `/auth/register`                                                      |
| `ONBOARDING_ALREADY_COMPLETED`                                                       | 409  | `/users/me/onboarding`                                                |
| `RATE_LIMITED`                                                                       | 429  | Mọi endpoint public (đặc biệt `/auth/login`, `/auth/forgot-password`) |
| `INTERNAL_ERROR`                                                                     | 500  | Mọi endpoint                                                          |

---

## 5. Ghi chú bảo mật bổ sung

- Rate limit riêng cho `/auth/login` (VD 5 lần/phút/IP + 10 lần/phút/email) để chống brute-force, tách biệt với rate limit chung ở `docs/API_SPEC_PART2.md` mục 0 (áp dụng cơ chế Redis `rate_limit:{key}:{endpoint}` — xem `DATA_DICTIONARY.md` mục 2.9, mở rộng key theo IP/email cho nhóm endpoint Auth).
- Mật khẩu lưu bằng thuật toán băm một chiều có salt (VD bcrypt/argon2), không bao giờ lưu plaintext hay log ra ngoài.
- `idToken` của OAuth luôn được xác thực server-side với nhà cung cấp (Google/Apple), không tin tưởng payload gửi thẳng từ client.
- Toàn bộ endpoint Auth bắt buộc chạy qua HTTPS/WSS; không hỗ trợ HTTP/WS thuần ở môi trường production.
