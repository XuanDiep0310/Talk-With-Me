# Hướng Dẫn Kỹ Thuật Chi Tiết Tính Năng AI Coach (Dành Cho Lập Trình Viên)

Tài liệu này giải thích toàn diện cấu trúc kỹ thuật, luồng dữ liệu thời gian thực (realtime streaming), thuật toán và quyết định thiết kế của tính năng **AI Coach (Phòng luyện nói 1-1 với trợ lý AI)** trong hệ thống TalkWithMe.

---

## 1. Triết lý Thiết kế: Communication-First & The Coach UX

TalkWithMe tuân thủ nguyên lý **Communication-First**:
1. **Tối đa hóa thời lượng người học thực sự nói**: Không làm gián đoạn dòng suy nghĩ của học viên bằng việc ngắt lời sửa lỗi ngữ pháp liên tục.
2. **Loại bỏ rào cản thao tác (One-Touch Voice UX)**:
   - Lược bỏ hoàn toàn ô gõ văn bản truyền thống.
   - Giao diện trung tâm chỉ gồm **1 nút Micro tròn** duy nhất (lấy cảm hứng từ ứng dụng *The Coach*).
   - **Thao tác đơn giản**:
     - Bấm Micro $\rightarrow$ Bắt đầu thu âm giọng nói (Micro chuyển hiệu ứng sóng âm đang ghi âm).
     - Bấm lại Micro $\rightarrow$ Hoàn tất câu nói, hệ thống giải mã giọng nói (STT), sinh câu trả lời và tự động phát âm thanh (TTS).
3. **Tránh tình trạng "Đứng hình / Bí từ" (Freezing)**:
   - Tích hợp tính năng **AI Hint (Gợi ý câu trả lời)** được may đo theo đúng trình độ CEFR của học viên (A1-C1).
   - Ban đầu luôn ẩn để người học tự tư duy; người học có thể mở lên bất kỳ lúc nào để tham khảo và nghe phát âm mẫu (🔊).
4. **Dịch tức thì không độ trễ (Zero-Latency Translation)**:
   - Hệ thống tự động dịch ngầm (pre-translation) ngay khi có câu thoại hoàn tất. Khi người học bấm nút quả địa cầu (🌐), bản dịch tiếng Việt xuất hiện ngay lập tức mà không phải chờ API quay vòng.

---

## 2. Kiến Trúc Tổng Thể Hệ Thống (System Architecture)

```mermaid
flowchart TD
    subgraph Frontend["Frontend (Angular 19 Standalone Signals)"]
        UI["AiCoachSessionComponent"]
        VoiceSvc["CoachVoiceService"]
        WebAudio["Web Audio API / MediaStream"]
        WebSpeech["SpeechSynthesis (TTS fallback)"]
    end

    subgraph Backend["Backend (FastAPI Async Monolith)"]
        WSEndpoint["WebSocket /api/v1/ws/sessions/{id}"]
        TicketAuth["One-Time Ticket Auth (Redis)"]
        StateMachine["SessionStateMachine (8 States)"]
        SessionSvc["CoachService & SessionRepository"]
    end

    subgraph External["AI Cloud Services (Providers)"]
        GroqSTT["Groq Whisper-large-v3 (STT)"]
        GroqLLM["Groq Qwen-2.5-72b / Llama-3.3 (LLM)"]
        GeminiLLM["Google Gemini 1.5 Flash (LLM)"]
    end

    WebAudio -->|Binary PCM Audio Streams| VoiceSvc
    VoiceSvc -->|WebSocket (Ticket Auth)| WSEndpoint
    WSEndpoint --> TicketAuth
    WSEndpoint --> StateMachine
    WSEndpoint -->|Audio Chunks| GroqSTT
    GroqSTT -->|Transcript Final| WSEndpoint
    WSEndpoint -->|Prompt with CEFR Level| GroqLLM
    GroqLLM -->|Concurrent AI Reply + Hint + Translation| WSEndpoint
    WSEndpoint -->|JSON Events: transcript, ai.message, ai.suggestions| VoiceSvc
    VoiceSvc -->|Auto-play & Replay| WebSpeech
    VoiceSvc -->|Signals Reactive State| UI
```

---

## 3. Quy Trình Vận Hành Một Lượt Nói (Turn-by-Turn Lifecycle)

### 3.1 Bắt đầu phiên (Session Initialization)
1. Client gửi `POST /api/v1/coach/sessions` với `topic_id`.
2. Backend kiểm tra level hiện tại của người dùng (từ Onboarding/Placement Test), khởi tạo bản ghi `sessions` với trạng thái `CREATED`.
3. AI Coach tạo câu mở đầu thân thiện, phù hợp với level học viên (ví dụ A1: câu ngắn, đơn giản; B2: câu mở, giàu từ vựng).
4. Client xin vé truy cập WebSocket: `POST /api/v1/ws-tickets` $\rightarrow$ nhận `ticket` (sống 30 giây trong Redis).
5. Client mở kết nối WebSocket: `ws://host/api/v1/ws/sessions/{id}?ticket={ticket}`.
6. Backend xác thực và thu hồi vé ngay lập tức (Atomic GETDEL trong Redis). Session chuyển sang `ACTIVE`.

### 3.2 Lượt nói của người dùng (User Speaking Turn)
1. Người dùng bấm nút **Micro**:
   - `CoachVoiceService` kích hoạt `navigator.mediaDevices.getUserMedia({ audio: true })`.
   - Khởi tạo `MediaRecorder` với chunk 250ms hoặc AudioWorklet.
   - Gửi sự kiện JSON `user.speech_start` qua WebSocket, kèm các binary audio chunk liên tục.
2. Người dùng bấm lại nút **Micro**:
   - Dừng thu âm, giải phóng luồng ghi âm tạm thời.
   - Gửi sự kiện JSON `user.speech_end`.
   - Phía Backend: Thu thập toàn bộ audio buffer gửi đến `SttProvider` (Groq Whisper-large-v3).
   - `SttProvider` trả về transcript văn bản: `"I usually play soccer on the weekend."` với chỉ số confidence.
   - Backend lưu `transcript_segments` vào PostgreSQL (idempotent theo `segment_id` do client sinh).
   - Server phát sóng `transcript.final` về cho client để đưa lên Live Script.
   - **Pre-translate**: Backend kích hoạt một background task dịch câu này sang tiếng Việt để khi người học bấm nút 🌐 là có ngay.

### 3.3 Lượt phản hồi của AI Coach (AI Response Turn)
1. Khi transcript của người dùng được xác nhận, Backend kích hoạt `LlmProvider` sinh câu trả lời theo đúng bộ quy tắc:
   - **Delimiter an toàn**: Đặt nội dung nói của người dùng vào `<learner_transcript>` để chống prompt injection.
   - **CEFR Level Adjustment**:
     - *A1-A2*: Dùng từ vựng cơ bản (Oxford 3000), câu từ 6-12 từ, tốc độ chậm rãi.
     - *B1-B2*: Sử dụng câu phức, từ vựng đa dạng hơn, đặt câu hỏi khơi gợi thảo luận.
     - *C1*: Đưa vào thành ngữ, câu hỏi mang tính phản biện, chuyên sâu.
   - **Quy tắc Communication-First**: Không ngắt lời bắt lỗi ngữ pháp; khen ngợi tự nhiên và kết thúc bằng một câu hỏi gợi mở tiếp theo.
2. **Xử lý song song (Concurrent Processing via asyncio.gather)**:
   - Backend chạy song song:
     1. Sinh câu trả lời của AI Coach (`ai.message`).
     2. Dịch câu trả lời của AI sang tiếng Việt (`translation`).
     3. Sinh 3 gợi ý câu trả lời tiếp theo cho học viên (`ai.suggestions`).
   - Server gửi gói tin `ai.message` kèm audio synthesis và danh sách `ai.suggestions`.
3. Phía Client:
   - Live Script hiển thị tin nhắn của Alex.
   - Tự động phát âm thanh câu nói của AI (Auto-play).
   - Cập nhật danh sách 3 câu gợi ý vào Signal `currentSuggestions`.

---

## 4. Chi Tiết Các Tính Năng Nổi Bật

### 4.1 Bố Cục Đáp Ứng Của AI Hint (Responsive Adaptive Layout)
- **Vấn đề**: Người học thường bị bối rối hoặc bí từ. Nếu hiện gợi ý đè lên micro sẽ làm che mất nội dung chat; nếu luôn luôn hiện thì làm người học ỷ lại không chịu tự nghĩ.
- **Giải pháp UX**:
  - Ban đầu luôn ẩn (`showHints = signal(false)`).
  - **Trên Màn Hình Rộng (Laptop / Máy tính bảng $\ge$ 768px)**:
    - Bố cục flex 2 cột ngang: Cột chính bên trái là **Live Script** cuộn độc lập, cột bên phải là **Aside Sidebar** (`w-80 lg:w-96`) hiển thị 3 câu gợi ý với badge Level người học.
    - Có nút bật/tắt `💡 Gợi ý` ngay trên thanh Header.
  - **Trên Màn Hình Điện Thoại (< 768px)**:
    - Nút icon `💡` đặt ở góc phải **ngang hàng hoàn toàn với nút Micro** ở thanh điều khiển đáy màn hình (Bottom Bar).
    - Khi chạm vào icon `💡`, một **Bottom Sheet Drawer** trượt nhẹ từ dưới lên với nền mờ (backdrop blur), chứa 3 câu gợi ý cùng nút loa 🔊 nghe thử phát âm trước khi người học tự nhấn mic nói.

### 4.2 Cơ Chế Zero-Latency Translation (Dịch Tức Thì)
- **Vấn đề**: Nếu người dùng nhấn nút "Dịch" mới gửi HTTP request lên server để gọi LLM dịch, người dùng sẽ phải chờ 1-2 giây quay vòng (loading spinner), làm giảm trải nghiệm đàm thoại.
- **Giải pháp**:
  - **Pre-computed Translation**: Ngay khi câu thoại (của User hoặc AI) được sinh ra, backend dịch sẵn qua LLM và đính kèm trong payload:
    ```json
    {
      "type": "ai.message",
      "text": "That sounds relaxing! What position do you usually play?",
      "translation": "Nghe thật thư giãn! Bạn thường chơi ở vị trí nào?",
      "seq": 4
    }
    ```
  - **Frontend Cache**: `AiCoachSessionComponent` lưu trữ bản dịch vào `translationMap` ngay khi nhận dữ liệu.
  - Nút chuyển đổi dịch được tinh giản thành icon `🌐` duy nhất (đã bỏ chữ "Dịch" thừa theo yêu cầu), khi bấm sẽ hiển thị ngay lập tức văn bản tiếng Việt màu xanh ngọc mềm mại dưới bong bóng thoại.

### 4.3 Quản Lý Bộ Nhớ & Thu Hồi Tài Nguyên Micro
- Rò rỉ microphone là lỗi phổ biến trong các ứng dụng WebRTC/WebAudio: biểu tượng chấm đỏ ghi âm trên tab trình duyệt vẫn sáng dù người dùng đã rời trang.
- Để khắc phục triệt để, `AiCoachSessionComponent` và `CoachVoiceService` cài đặt cơ chế dọn dẹp chặt chẽ:
  ```typescript
  cleanup(): void {
    // 1. Dừng tất cả MediaStream tracks của mic
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    // 2. Đóng WebSocket
    if (this.ws) {
      this.ws.close(1000, 'Session clean termination');
      this.ws = null;
    }
    // 3. Hủy bỏ AudioContext và SpeechSynthesis đang phát
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
  ```
- Hàm này luôn được gọi trong `ngOnDestroy()` của component và khi người dùng xác nhận kết thúc phiên.

---

## 5. Hướng Dẫn Cài Đặt Nhà Cung Cấp Miễn Phí (Free Providers Setup)

TalkWithMe cung cấp kiến trúc **Provider Interface** cắm rút linh hoạt (`SttProvider`, `LlmProvider`, `TtsProvider`). Trong môi trường development hoặc triển khai chi phí thấp, bạn có thể sử dụng các nhà cung cấp hoàn toàn miễn phí sau:

### 5.1 Groq Cloud (Khuyên dùng — Rất nhanh và Miễn phí)
Groq cung cấp LPU (Language Processing Unit) với tốc độ phản hồi cực nhanh (< 300ms) và miễn phí quota hàng ngày rất hào phóng.
1. Truy cập [https://console.groq.com/keys](https://console.groq.com/keys) và tạo một API Key miễn phí.
2. Thêm vào tệp `backend/.env`:
   ```ini
   GROQ_API_KEY=gsk_your_groq_api_key_here
   STT_PROVIDER=groq          # Sử dụng mô hình whisper-large-v3
   LLM_PROVIDER=groq          # Sử dụng mô hình qwen/qwen-2.5-72b-instruct hoặc llama-3.3-70b-versatile
   ```
3. Khởi động lại backend:
   ```powershell
   cd d:\TalkWithMe\backend
   .\venv\Scripts\Activate.ps1
   python -m uvicorn app.main:app --reload
   ```

### 5.2 Google Gemini (Google AI Studio Free Tier)
Nếu muốn sử dụng mô hình của Google:
1. Truy cập [https://aistudio.google.com/](https://aistudio.google.com/) và tạo API Key miễn phí.
2. Cấu hình trong `backend/.env`:
   ```ini
   GEMINI_API_KEY=AIzaSy...
   LLM_PROVIDER=gemini        # Sử dụng mô hình gemini-1.5-flash
   ```

### 5.3 Môi trường Dev không cần Internet (Fake Mode)
Khi phát triển offline hoặc chạy Unit Test / CI:
```ini
STT_PROVIDER=fake
LLM_PROVIDER=fake
TTS_PROVIDER=fake
```
Hệ thống sẽ tự động phản hồi bằng dữ liệu giả lập thông minh theo ngữ cảnh mà không cần gọi ra Internet. Trên giao diện frontend còn có nút công tắc **Mock Mic** (D-08) giúp kiểm thử toàn bộ luồng hội thoại mà không cần micro thật.

---

## 6. Bảng Tra Cứu Sự Kiện WebSocket (API Contract)

| Tên sự kiện | Chiều | Ý nghĩa | Payload tiêu biểu |
|---|---|---|---|
| `user.speech_start` | Client $\rightarrow$ Server | Bắt đầu câu nói mới | `{"type": "user.speech_start", "timestamp": 1234}` |
| `user.speech_end` | Client $\rightarrow$ Server | Kết thúc câu nói | `{"type": "user.speech_end", "timestamp": 5678}` |
| `user.text` | Client $\rightarrow$ Server | Gửi văn bản trực tiếp (Mock/Fallback) | `{"type": "user.text", "text": "Hello Alex", "segmentId": "uuid"}` |
| `ping` | Client $\rightarrow$ Server | Giữ nhịp tim kết nối (Heartbeat) | `{"type": "ping"}` |
| `session.state` | Server $\rightarrow$ Client | Đồng bộ trạng thái phiên | `{"type": "session.state", "state": "ACTIVE"}` |
| `transcript.final` | Server $\rightarrow$ Client | Kết quả STT câu nói người dùng | `{"type": "transcript.final", "id": "uuid", "text": "...", "speaker": "USER", "translation": "..."}` |
| `ai.message` | Server $\rightarrow$ Client | Câu thoại phản hồi của AI Coach | `{"type": "ai.message", "id": "uuid", "text": "...", "speaker": "AI", "translation": "..."}` |
| `ai.suggestions` | Server $\rightarrow$ Client | Gợi ý 3 câu trả lời theo Level | `{"type": "ai.suggestions", "suggestions": [{"text": "...", "translation": "..."}]}` |
| `error` | Server $\rightarrow$ Client | Báo lỗi nghiệp vụ | `{"type": "error", "code": "MICROPHONE_ERROR", "message": "..."}` |

---

## 7. Tổng Kết

Tính năng AI Coach trong TalkWithMe kết hợp chặt chẽ giữa:
- **Backend hiệu năng cao**: Xử lý bất đồng bộ (Async Python), quản lý vòng đời chặt chẽ qua State Machine 8 trạng thái, chống mất dữ liệu khi rớt mạng bằng `lastSeq` và `RECONNECTING`.
- **Frontend phản ứng nhanh (Angular 19 Signals)**: Giao diện tối ưu thao tác 1 nút mic ("The Coach"), bố cục gợi ý thích ứng thiết bị và cơ chế dịch tức thì không độ trễ.
- **Tối ưu chi phí vận hành**: Sẵn sàng tích hợp các API miễn phí hàng đầu như Groq Cloud và Gemini Flash, mang lại trải nghiệm luyện nói mượt mà, chân thực cho người học tiếng Anh tại Việt Nam.
