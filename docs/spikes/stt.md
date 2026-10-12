# Spike: Đánh giá và Lựa chọn Nhà cung cấp Speech-to-Text (STT) cho TalkWithMe

## 1. Bối cảnh và Tiêu chí Đánh giá

Trong TalkWithMe, AI Coach và các phiên đàm thoại (Scenario Roleplay, Voice Room) yêu cầu chuyển đổi giọng nói thành văn bản theo thời gian thực (Live Script) theo triết lý *Communication-First*:
- **Streaming Latency**: Độ trễ từ lúc người dùng nói đến khi server nhận được partial/final transcript phải dưới 400ms để trải nghiệm đối thoại không bị giật hay chậm nhịp.
- **Độ chính xác với giọng người Việt nói tiếng Anh (Vietnamese-accented English)**: Người học tiếng Anh Việt Nam thường gặp khó khăn với âm đuôi (ending sounds), nối âm, ngữ điệu (intonation) và nguyên âm đôi. Engine STT cần có khả năng suy luận theo ngữ cảnh tốt để không nhận diện sai từ vựng cơ bản.
- **Word Timestamps & Confidence**: Cần trả mốc thời gian từng từ (`start_ms`, `end_ms`) để tính các chỉ số Fluency / Pause / Response Speed, và `confidence` (0.0–1.0) cho chỉ số Pronunciation Accuracy tham khảo (SRS 3.3).
- **Chi phí & Khả năng Tích hợp**: Chi phí vận hành thấp (học viên luyện nói hàng giờ mỗi tháng), hỗ trợ WebSocket streaming hai chiều, dễ bảo trì.

---

## 2. So sánh Chi tiết 3 Nhà cung cấp STT Hàng đầu

| Tiêu chí | **Deepgram (Nova-2)** | **Google Cloud Speech-to-Text v2** | **Azure Cognitive Speech Service** |
|---|---|---|---|
| **Giao thức Streaming** | WebSocket hai chiều (`wss://api.deepgram.com/v1/listen`) | gRPC bi-directional streaming / REST | SDK qua WebSocket / REST |
| **Độ trễ trung bình (Streaming Latency)** | **~250 – 350 ms** (Cực nhanh, tối ưu cho voice agents) | ~500 – 800 ms (Trung bình) | ~400 – 600 ms (Khá) |
| **Độ chính xác với giọng Việt nói tiếng Anh** | **Rất cao**: Model Nova-2 được huấn luyện đa dạng ngữ âm quốc tế, bù trừ tốt hiện tượng nuốt âm đuôi và phát âm không chuẩn của người học L2. | **Cao**: Model `latest_long` và Chirp nhận diện tốt nhưng đôi khi quá khắt khe với phát âm ngọng âm đuôi. | **Cao**: Model có khả năng lọc nhiễu tốt, tuy nhiên cần tinh chỉnh cấu hình locale. |
| **Word Timestamps** | Có (`start`, `end` theo giây/mili-giây cho từng từ). | Có (`word_offsets` nếu bật cờ cấu hình). | Có (`Offset`, `Duration` trong detailed result). |
| **Confidence Score** | Có cho từng từ và toàn bộ đoạn nói (`confidence`: 0.0 – 1.0). | Có cho toàn bộ transcript và từng từ (kèm model Chirp/Standard). | Có (dưới dạng NBest Confidence 0.0 – 1.0). |
| **Xử lý Filler Words (um, uh)** | Hỗ trợ cờ `filler_words=true` (phát hiện rõ `um`, `uh` để phục vụ tính Turn-Taking và Fluency). | Không chính thức lọc riêng filler; thường bỏ qua hoặc viết tắt. | Nhận diện filler word nếu dùng Speech SDK chuyên dụng. |
| **Chi phí (Pay-as-you-go)** | **\$0.0043 – \$0.0059 / phút** (Rẻ nhất thị trường, tặng \$200 tín dụng dùng thử). | \$0.016 – \$0.024 / phút (Gấp 3–4 lần Deepgram). | \$0.016 / phút (Gấp ~3 lần Deepgram). |
| **Mức độ tích hợp backend** | Cực kỳ đơn giản: Gửi trực tiếp audio frames qua WebSocket hoặc HTTP POST, nhận JSON event stream. | Phức tạp: Yêu cầu Google Service Account JSON, gRPC dependencies nặng. | Khá: Yêu cầu Azure SDK hoặc WebSocket URL có subscription key. |

---

## 3. Đề xuất Lựa chọn: Deepgram Nova-2

Chúng tôi đề xuất chọn **Deepgram (Nova-2)** làm nhà cung cấp STT chính thức cho hệ thống TalkWithMe vì:
1. **Độ trễ tối thiểu**: Với độ trễ streaming chỉ ~300ms, hệ thống đáp ứng tức thì Live Script trên giao diện người dùng, không tạo cảm giác AI đang "nghĩ lâu".
2. **Khả năng nhận diện ngữ âm Việt**: Nova-2 hiểu ngữ cảnh câu nói rất xuất sắc ngay cả khi người dùng phát âm sai phụ âm cuối hoặc ngập ngừng.
3. **Hỗ trợ Word Timestamps & Filler Words nguyên bản**: Deepgram trả trực tiếp `words[]` gồm mốc thời gian và độ tin cậy, đặc biệt có thể giữ lại các từ đệm (`um`, `uh`), hỗ trợ chính sách không ngắt lời của Turn-Taking Policy.
4. **Hiệu quả kinh tế**: Chi phí chỉ bằng 1/3 so với Google Cloud và Azure.

---

## 4. Kiến trúc Adapter STT trong Codebase

Để tuân thủ triết lý cách ly kiến trúc (AGENTS.md mục 6):
- Mọi dịch vụ STT nằm sau interface `SttProvider` trong `app/core/providers/stt_provider.py`.
- **Mặc định khi phát triển & kiểm thử**: Hệ thống sử dụng `FakeSttProvider` (không tốn chi phí, không cần kết nối mạng).
- **Khi kết nối thật**: Hệ thống cung cấp `DeepgramSttProvider`.

### Cách bật Deepgram STT thật:
1. Đăng ký tài khoản tại [Deepgram Console](https://console.deepgram.com/) và tạo một API Key.
2. Thêm vào tệp `.env` ở thư mục gốc hoặc `backend/.env`:
   ```bash
   STT_PROVIDER=deepgram
   DEEPGRAM_API_KEY=your_deepgram_api_key_here
   ```
3. Khởi động lại backend. `SttProviderFactory` sẽ tự động khởi tạo `DeepgramSttProvider` để giao tiếp với API Deepgram.
