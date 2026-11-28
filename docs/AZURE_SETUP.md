# Hướng dẫn Setup Azure AI Speech & Môi trường Real Providers cho TalkWithMe

Tài liệu này hướng dẫn cấu hình hệ thống **TalkWithMe** với bộ provider thật mặc định:
- **Azure AI Speech (SDK primary + REST fallback)**: Nhận dạng giọng nói (STT) + Chấm điểm phát âm đa tầng (Accuracy, Fluency, Prosody, từng âm tiết & âm vị IPA `NBestPhonemes`) cho Placement Test, Scenario Drill/Shadowing và AI Coach.
- **Google Gemini (`gemini-2.5-flash`)**: Hội thoại AI Coach (kèm xử lý ngữ cảnh ngắt lời barge-in), đặt gợi ý câu trả lời, dịch thuật và chấm rubric ngữ nghĩa (Vocabulary, Grammar + sửa lỗi, Interaction & Coherence).
- **Edge-TTS (`edge`)**: Phát giọng đọc AI tiếng Anh theo stream HTTP `/api/v1/voice/tts/stream`, hỗ trợ ngắt audio tức thì khi người dùng chen ngang.

> Hệ thống không phụ thuộc Azure OpenAI — bạn chỉ cần tạo **1 Azure AI Speech resource** (có gói **Free F0** miễn phí 5 giờ audio/tháng) và dùng **Google Gemini API Key**.

---

## 1. Tạo Azure AI Speech Resource trên Azure Portal

1. Đăng nhập [Azure Portal](https://portal.azure.com/).
2. Chọn **Create a resource** → tìm **Speech** (tên đầy đủ: *Speech — Azure AI services*) → nhấn **Create**.
3. Điền thông tin tạo resource:
   - **Subscription**: Chọn subscription của bạn (Azure for Students hoặc Pay-As-You-Go).
   - **Resource group**: Tạo mới, ví dụ `rg-talkwithme-dev`.
   - **Region**: Chọn **`Southeast Asia`** (Singapore, mã `southeastasia`) hoặc **`East Asia`** (Hong Kong, mã `eastasia`) để độ trễ audio từ Việt Nam thấp nhất.
     - *Lưu ý*: Chấm phát âm **Prosody** và **Phoneme IPA** hoạt động tốt trên cả `southeastasia`, `eastasia`, `eastus`, `westus2`. Nếu gặp lỗi Prosody ở region bất kỳ, chuyển sang `eastus` hoặc `southeastasia`.
   - **Name**: Ví dụ `talkwithme-speech-dev`.
   - **Pricing tier**:
     - Chọn **`Free F0`** cho môi trường dev/đồ án (miễn phí 5 giờ Speech-to-Text + Pronunciation Assessment mỗi tháng, tối đa 1 kết nối đồng thời phù hợp 1–2 người test).
     - Chọn **`Standard S0`** khi demo nhiều người hoặc triển khai thực tế (tính phí theo giờ sử dụng thực tế, hỗ trợ concurrency cao).
4. Nhấn **Review + create** → **Create** và đợi triển khai xong (~30 giây).
5. Vào resource vừa tạo → ở menu trái chọn **Resource Management → Keys and Endpoint**:
   - Copy **KEY 1** → gán cho `AZURE_SPEECH_KEY`.
   - Copy **Location/Region** (ví dụ `southeastasia`) → gán cho `AZURE_SPEECH_REGION`.

---

## 2. Lấy Google Gemini API Key

1. Truy cập [Google AI Studio](https://aistudio.google.com/apikey).
2. Nhấn **Create API key** trong project Google Cloud của bạn.
3. Copy API Key → gán cho `LLM_API_KEY`.

---

## 3. Cấu hình biến môi trường (`.env`)

Sao chép file mẫu `.env.example` ở thư mục gốc (hoặc `backend/.env`) thành `.env` và điền đầy đủ giá trị thật:

```dotenv
# PostgreSQL & Redis (nếu dùng docker-compose.yml thì giữ postgres/redis; chạy uvicorn ngoài Docker thì đặt localhost)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=talkwithme

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Security & Frontend CORS
FRONTEND_URL="http://localhost:4200"
JWT_SECRET_KEY="thay-bang-chuoi-bi-mat-ngau-nhien-toi-thieu-32-ky-tu"

# Azure AI Speech (Bắt buộc — hệ thống KHÔNG fallback sang mock data ở runtime)
SPEECH_ASSESSMENT_PROVIDER="azure_sdk"   # hoặc "azure_rest" nếu muốn đi trực tiếp qua REST
AZURE_SPEECH_KEY="<KEY_1_TU_AZURE_PORTAL>"
AZURE_SPEECH_REGION="southeastasia"
AZURE_SPEECH_LANGUAGE="en-US"

# Text-to-Speech (Azure Neural TTS chính + Edge-TTS fallback)
TTS_PROVIDER="azure"

# Google Gemini LLM
LLM_PROVIDER="gemini"
LLM_API_KEY="<GEMINI_API_KEY>"
LLM_MODEL="gemini-2.5-flash"

# Công thức chấm điểm & Mô hình CEFR
SCORING_FORMULA_VERSION="2.0.0"
CEFR_MODEL_VERSION="cefr-est-1.0.0"
```

---

## 4. Khởi động Database, Migration & Seed dữ liệu

Đảm bảo PostgreSQL 16 và Redis 7 đang chạy (qua Docker Compose hoặc cài trực tiếp):

```powershell
# 1. Bật Postgres & Redis (từ thư mục gốc D:\TalkWithMe)
docker compose up -d postgres redis

# 2. Cài thư viện backend & chạy Alembic migration
cd backend
pip install -r requirements.txt
alembic upgrade head

# 3. Nạp dữ liệu mẫu (scenarios, coach topics, gamification rules)
python scripts/seed.py
```

Nếu bạn build container `backend` bằng Docker (`docker compose up --build`), `Dockerfile` đã cài sẵn `libssl3`, `ca-certificates` và `libasound2t64` cần thiết cho runtime C++ của `azure-cognitiveservices-speech` trên Linux.

---

## 5. Chạy Backend & Frontend Local

Terminal 1 (Backend FastAPI):
```powershell
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Terminal 2 (Frontend Angular):
```powershell
cd frontend
npm install
npm start
```

Mở trình duyệt Chrome hoặc Edge tại `http://localhost:4200` (trình duyệt chỉ cấp quyền `getUserMedia` / WebAudio Microphone trên `http://localhost` hoặc `https://`).

---

## 6. Kiểm tra nhanh hoạt động từng tính năng thật

1. **Chấm phát âm từng âm tiết (`/api/v1/pronunciation/assess`)**:
   - Vào **Tình huống (Scenarios)** → chọn 1 bài học → chuyển tới bước **Luyện phát âm cụm** hoặc **Nghe & Nhại lại**.
   - Bấm micro nói thử một cụm (hoặc cố ý đọc sai nhẹ 1 âm tiết như *wor-king*), nhấn dừng → kiểm tra vòng điểm, màu sắc xanh/vàng/đỏ trên từng âm tiết, click vào từ để xem IPA phoneme lỗi và mẹo tiếng Việt.
2. **Placement Test 2 giai đoạn (`/onboarding`)**:
   - Tạo tài khoản mới → làm **Voice Test**: Giai đoạn 1 đọc 3 câu mẫu (chấm phát âm từng âm tiết) → Giai đoạn 2 trả lời AI Coach bằng giọng nói thật (chú ý nếu môi trường chạy chưa có Key Azure hoặc Gemini, backend sẽ trả lỗi `503 SPEECH_ASSESSMENT_NOT_CONFIGURED` hoặc `LLM_NOT_CONFIGURED` đúng theo chính sách không fake điểm).
3. **AI Coach rảnh tay liên tục & Ngắt lời (Barge-in)**:
   - Bắt đầu một phiên AI Coach → cấp quyền micro → nói tự nhiên mà không cần bấm nút gửi lượt.
   - Thử nói chen ngang trong lúc Coach Alex đang phát âm: âm thanh AI dừng ngay lập tức (`user.barge_in`) và lượt trả lời tiếp theo của Alex nối mạch hợp lý với câu ngắt lời của bạn.
4. **Hồ sơ CEFR dài hạn (`/progress`)**:
   - Hoàn thành ít nhất 1 phiên AI Coach đủ điều kiện hoặc Placement Test → vào **Tiến độ & Kỹ năng** → kiểm tra khối **Ước lượng năng lực CEFR dài hạn**, biểu đồ Radar 5 trục, danh sách âm vị yếu và lộ trình cá nhân hóa.

---

## 7. Xử lý sự cố thường gặp

| Lỗi gặp phải | Nguyên nhân | Cách khắc phục |
|---|---|---|
| HTTP `503 SPEECH_ASSESSMENT_NOT_CONFIGURED` | Chưa điền `AZURE_SPEECH_KEY` hoặc `AZURE_SPEECH_REGION` | Kiểm tra file `.env` đang nạp bởi backend (`env_file` hoặc shell env) |
| HTTP `503 SPEECH_ASSESSMENT_UNAVAILABLE` | Key sai, hết quota F0, hoặc container thiếu `libssl3` | Kiểm tra Key 1/Region trên Azure Portal; thử đổi `SPEECH_ASSESSMENT_PROVIDER="azure_rest"` để test qua HTTPS thuần |
| HTTP `503 LLM_NOT_CONFIGURED` / `LLM_UNAVAILABLE` | Thiếu `LLM_API_KEY` hoặc Gemini rate-limit | Tạo lại key ở Google AI Studio và kiểm tra `LLM_MODEL="gemini-2.5-flash"` |
| Trình duyệt không ghi âm được | Truy cập qua IP LAN `http://192.168.x.x` thay vì `localhost` | Truy cập bằng `http://localhost:4200` ở dev hoặc cấu hình HTTPS/Reverse Proxy khi deploy |
| Micro AI Coach tự ngắt khi AI đang nói | Tiếng loa ngoài lọt lại vào mic | Đeo tai nghe hoặc tăng nhẹ ngưỡng phòng ồn; dịch vụ VAD đã bật `echoCancellation: true` và ngưỡng tăng gấp 3.2 lần khi AI phát tiếng |
