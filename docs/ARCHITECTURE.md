# 🏗 System Architecture & Realtime Design (Kiến trúc Hệ thống)

Tài liệu này mô tả chi tiết kiến trúc tổng thể, sơ đồ kết nối các thành phần và luồng dữ liệu thời gian thực (Real-time Pipeline) của ứng dụng **TalkWithMe**.

---

## 1. Tổng quan Kiến trúc Hệ thống (High-Level Architecture)

Hệ thống tuân theo mô hình **Client-Server phân tách (Decoupled Architecture)** kết hợp kết nối 2 chiều WebSockets cho tương tác Voice & Script thời gian thực.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        ANGULAR FRONTEND CLIENT                         │
│  - Standalone Components & Signals                                      │
│  - Web Audio & Web Speech API                                          │
│  - WebSocket Client Manager (RxJS)                                     │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
             HTTP / REST APIs                   WebSockets (Full-Duplex)
                    │                                │
┌───────────────────▼────────────────────────────────▼───────────────────┐
│                          FASTAPI BACKEND API                           │
│  - Async REST Endpoints (Users, Lessons, History)                      │
│  - WebSocket Connection Handler & Connection Manager                   │
│  - Background Tasks & Stream Pipelines                                 │
└───────┬──────────────────────┬──────────────────────┬──────────────────┘
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐      ┌───────────────┐      ┌──────────────────────────┐
│  POSTGRESQL   │      │  REDIS CACHE  │      │ EXTERNAL AI & VOICE APIs │
│ - Users       │      │ - Pub/Sub     │      │ - Google Gemini API      │
│ - Lessons     │      │ - Room State  │      │ - Edge-TTS (Voice Gen)   │
│ - History     │      │ - Auth Tokens │      │ - Groq Whisper (STT)     │
└───────────────┘      └───────────────┘      └──────────────────────────┘
```

---

## 2. Chi tiết Thành phần Kiến trúc (Component Details)

### 2.1 Angular Frontend Architecture (`/frontend`)
* **Angular Version**: 18+ (Khai thác Angular Signals cho reactive state management mà không phụ thuộc quá nhiều vào NGRX).
* **Core Modules**:
  * `AudioRecorderService`: Thu âm từ Microphone của người dùng qua HTML5 MediaRecorder API.
  * `SpeechRecognitionService`: Wrapper bao bọc Web Speech API để phát hiện giọng nói và sinh Script trực tiếp trên trình duyệt.
  * `WebSocketService`: Quản lý kết nối WebSocket đến FastAPI backend với tính năng tự động Auto-reconnect & Heartbeatping.
  * `StateStore`: Quản lý trạng thái User Profile, Level, XP và Current Session State.

### 2.2 FastAPI Backend Architecture (`/backend`)
* **Framework**: FastAPI (Python 3.11+) tận dụng tối đa `asyncio` giúp xử lý hàng ngàn kết nối WebSocket đồng thời mà không bị nghẽn (non-blocking I/O).
* **Architecture Pattern**: Clean Architecture / Layered Pattern:
  ```text
  app/
  ├── api/              # Route Handlers (HTTP & WebSockets)
  ├── core/             # Configuration, Security, DB Connections
  ├── models/           # SQLModel Database Entities & Pydantic Schemas
  ├── services/         # Business Logic (AI Coach Engine, Voice Engine, Room Manager)
  └── repository/       # Database Query Layer (Async SQLAlchemy)
  ```

### 2.3 Database & Cache Layer
* **PostgreSQL 16**: Lưu trữ dữ liệu quan hệ có cấu trúc: Người dùng, tiến trình học tập, bài học tình huống, lịch sử hội thoại.
* **Redis 7**:
  * **Pub/Sub Broker**: Điều hướng tin nhắn giữa các instance FastAPI khi triển khai nhiều worker phòng chat.
  * **Session & State Cache**: Lưu trữ bộ nhớ tạm thời của hội thoại (Short-term Conversation Context) để gửi cho Gemini API.

---

## 3. Luồng Dữ liệu Thời Gian Thực (Real-time Voice & Script Data Pipeline)

### Luồng 1: Trò chuyện Voice với AI Coach (`/ws/ai-coach/{session_id}`)

```text
[User nói vào Mic] ──► Web Speech API (Client) ──► Live Text hiển thị ngay trên UI
                               │
                      (User dừng nói - Silence detected)
                               │
                       WebSocket Send Text Payload
                               │
                               ▼
                    FastAPI WebSocket Endpoint
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
   Lưu vào Redis Context History      Gọi Gemini 2.0 Flash API (Streaming)
                                                │
                                        Nhận Text Phản hồi
                                                │
                                                ▼
                                    Gọi Edge-TTS Service (Audio Stream)
                                                │
                                                ▼
                      Send Payload back (Text + Audio Base64/URL) qua WebSocket
                                                │
                                                ▼
                                    Angular phát âm thanh AI + Cập nhật Script
```

### Luồng 2: Phòng Chat Voice Nhóm Đa Người Dùng (`/ws/room/{room_id}`)

```text
User A (Angular) ── WebSocket Send Message ──► FastAPI Worker 1 ──► Redis Pub/Sub Channel
                                                                        │
                                                                        ▼
User B (Angular) ◄── WebSocket Broadcast ◄── FastAPI Worker 2 ◄─────────┘
```

---

## 4. Bảo mật & Xác thực (Security Architecture)

1. **Authentication**: JWT (JSON Web Tokens) được truyền qua Header `Authorization: Bearer <token>` đối với REST API và qua Query Parameter `ws://localhost:8000/ws/... ?token=<token>` đối với WebSocket.
2. **CORS & Rate Limiting**: Cấu hình CORS mở đúng origin của Angular client; sử dụng `slowapi` trong FastAPI để giới hạn số lượng request tránh làm quá tải API.
3. **API Key Isolation**: Mọi API Key thứ 3 (Gemini, Groq) đều nằm an toàn tại Backend `.env`, Client không bao giờ trực tiếp lộ key.
