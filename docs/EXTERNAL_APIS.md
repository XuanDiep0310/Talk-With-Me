# 🔌 External APIs & Free Integration Strategy (Tích hợp API Bên Thứ 3)

Để giảm tối đa chi phí vận hành ban đầu mà vẫn đảm bảo trải nghiệm giao tiếp giọng nói và trí tuệ nhân tạo mượt mà, **TalkWithMe** sử dụng chiến lược tích hợp các dịch vụ AI / Voice miễn phí tối ưu.

---

## 1. Danh Sách Dịch Vụ Bên Thứ 3 & Gói Miễn Phí (Free APIs Matrix)

| Phân Loại API | Tên Dịch Vụ / Library | Hạn Mạch Miễn Phí (Free Limits) | Vai Trò Trong Hệ Thống |
| :--- | :--- | :--- | :--- |
| **LLM (AI Core)** | **Google Gemini API** (`gemini-2.0-flash`) | **15 Requests/Min (RPM)**, 1M Tokens/Min, 1,500 Requests/Ngày *(Google AI Studio)* | Xử lý hội thoại AI Coach, nhập vai tình huống, nhận xét lỗi ngữ pháp. |
| **STT (Speech-to-Text)** | **Browser Web Speech API** | **100% FREE & Unlimited** *(Client-side)* | Chuyển giọng nói của User thành phụ đề thời gian thực (Live Script) ngay trên trình duyệt. |
| *(STT Fallback)* | **Groq Whisper API** (`whisper-large-v3-turbo`) | **Generous Free Tier** *(Groq Cloud)* | Chuyển đổi file âm thanh khi người dùng thu âm từ các thiết bị không hỗ trợ Web Speech. |
| **TTS (Text-to-Speech)** | **Edge-TTS** (`edge-tts` Python Package) | **100% FREE & Unlimited** *(Microsoft Edge Neural Voice)* | Sinh âm thanh đọc câu trả lời của AI Coach với giọng nói tự nhiên chuẩn US/UK. |

---

## 2. Chi Tiết Triển Khai Kỹ Thuật (Technical Implementation Details)

### 2.1 Google Gemini API Integration (`backend/app/services/gemini_service.py`)
* **Model**: `gemini-2.0-flash` (Được chọn vì có Latency thấp nhất, đáp ứng thời gian thực cho Voice Conversation).
* **System Prompt Optimization**:
  ```python
  AI_COACH_SYSTEM_PROMPT = """
  You are an encouraging, friendly English Communication Coach named Alex.
  Your goal is to help the user practice English conversation naturally.
  User Profile: Level={level}, Topics={topics}, Weaknesses={weaknesses}.
  Rules:
  1. Keep your responses short, natural, and conversational (1-3 sentences max).
  2. Always end your response with an open-ended question to keep the conversation flowing.
  3. Do NOT correct grammar mid-conversation. Just reply naturally.
  """
  ```

---

### 2.2 Web Speech API (Client-side Frontend Angular)
* **Thư viện native**: Browser API `window.webkitSpeechRecognition` hoặc `window.SpeechRecognition`.
* **Cấu hình Angular Service**:
  ```typescript
  // frontend/src/app/core/services/speech-recognition.service.ts
  this.recognition.continuous = true;
  this.recognition.interimResults = true; // Hiện phụ đề thời gian thực từng từ
  this.recognition.lang = 'en-US';
  ```

---

### 2.3 Edge-TTS Service (Backend Python Voice Generator)
* **Gói Python**: `pip install edge-tts`
* **Ưu điểm**: Không tốn API Key, tạo âm thanh chuẩn định dạng MP3 / Audio Stream trực tiếp.
* **Danh sách giọng nói ưu tiên**:
  * Giọng Nữ (US): `en-US-AnaNeural` hoặc `en-US-JennyNeural`
  * Giọng Nam (US): `en-US-GuyNeural`
  * Giọng Nam (UK): `en-GB-RyanNeural`

```python
import edge_tts

async def generate_speech(text: str, voice: str = "en-US-JennyNeural") -> bytes:
    communicate = edge_tts.Communicate(text, voice)
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
    return audio_data
```

---

## 3. Chiến Lược Dự Phòng Lỗi (Fallback & Resilience Strategy)

```text
               ┌──────────────────────────────┐
               │    User Nói Vào Microphone    │
               └──────────────┬───────────────┘
                              │
               ┌──────────────▼───────────────┐
               │ Trình duyệt hỗ trợ WebSpeech?│
               └──────┬────────────────┬──────┘
                      │ YES            │ NO
                      ▼                ▼
            [ Web Speech API ]    [ Send WebM Audio Blob to FastAPI ]
            (Realtime Client)                  │
                                       [ Groq Whisper API ]
                                       (Backend Fallback STT)
```

1. **Khi Gemini API chạm ngưỡng Rate Limit (429 Too Many Requests)**:
   * Tự động chuyển đổi tạm thời sang mô hình dự phòng `Llama 3.1 8B` thông qua **Groq API** (miễn phí) để đảm bảo cuộc hội thoại không bị gián đoạn.
2. **Khi không có kết nối Mạng Internet mạnh**:
   * Trình duyệt giữ lại dữ liệu thu âm cục bộ (Audio Blob) và tự động thử gửi lại khi khôi phục kết nối.
