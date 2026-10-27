# Kiến Thức Kỹ Thuật Sprint 5: Scenario Lessons, Chunking Method & Roleplay Evaluation

Tài liệu này ghi lại toàn bộ nền tảng lý thuyết và kiến trúc kỹ thuật đã triển khai trong Sprint 5 của TalkWithMe, phục vụ học tập và nghiên cứu phát triển tiếp theo.

---

## 1. Phương pháp Chunking trong Giảng dạy Tiếng Anh Giao tiếp (The Lexical Approach)

### 1.1. Bản chất phương pháp
Phương pháp **Chunking** dựa trên công trình *The Lexical Approach* của nhà ngôn ngữ học **Michael Lewis (1993)**:
> *"Language consists of grammaticalised lexis, not lexicalised grammar."* (Ngôn ngữ bao gồm các cụm từ vựng được ngữ pháp hóa, chứ không phải ngữ pháp được từ vựng hóa).

Khi người học cố dịch từng từ đơn lẻ từ tiếng Việt sang tiếng Anh rồi áp dụng công thức ngữ pháp để ghép câu, não bộ phải xử lý quá nhiều tải nhận thức (cognitive load). Điều này gây ra:
- Ngập ngừng, ấp úng kéo dài (latency lớn).
- Dịch nguyên văn sai văn cảnh (Vietnamese-English translation errors).
- Mất tự tin và phản xạ tự nhiên.

**Chunking** huấn luyện não bộ ghi nhớ và kích hoạt các cụm từ cố định hoặc bán cố định (fixed and semi-fixed expressions). Ví dụ:
- Thay vì dịch: *Xin lỗi* (Excuse me) + *tôi* (I) + *có thể* (can) + *hỏi* (ask)...
- Học chunk nguyên khối: `"Excuse me, could I ask you about...?"`

### 1.2. Hệ thống Thẻ Chức năng (Functional Tags)
Trong TalkWithMe, mỗi tình huống giao tiếp được phân rã thành một chuỗi các bước chức năng logic:
1. `OPENING`: Mở đầu tương tác lịch sự (e.g., *"Excuse me, could I ask...?"*, *"Good morning, I have an appointment for..."*).
2. `REQUEST`: Đưa ra yêu cầu hoặc mục đích chính (e.g., *"I'd like to book a table for..."*, *"How much is this bottle of...?"*).
3. `CLARIFY`: Đặt câu hỏi làm rõ, hỏi chi tiết (e.g., *"Could you tell me what ingredients are in...?"*, *"Does the rent include utilities?"*).
4. `AGREE_DECLINE`: Đồng ý, từ chối lịch sự hoặc đề xuất thay thế (e.g., *"That works for me."*, *"I'm afraid I cannot..., but could we...?"*).
5. `CLOSING`: Kết thúc hội thoại và cảm ơn (e.g., *"Thank you so much for your help!"*, *"I appreciate your assistance."*).

---

## 2. Kiến trúc Bộ So Khớp Chunk (ChunkMatcher Engine)

Trong môi trường thực tế, người dùng hiếm khi đọc chính xác 100% từng ký tự như trong sách giáo khoa. Họ có thể thêm từ nối, đổi đại từ, dùng từ đồng nghĩa hoặc phát âm gần đúng.

### 2.1. Chuẩn hóa Văn bản (Text Normalization)
Trước khi so sánh, transcript được chuẩn hóa:
- Hạ về chữ thường (`lower()`).
- Loại bỏ toàn bộ dấu câu ngoại lai (`.,!?;:"'`).
- Mở rộng các dạng viết tắt phổ biến:
  - `don't` $\rightarrow$ `do not`, `can't` $\rightarrow$ `cannot`, `i'd like` $\rightarrow$ `i would like`, `it's` $\rightarrow$ `it is`, `what's` $\rightarrow$ `what is`.
- Xóa khoảng trắng thừa (multiple whitespace compression).

### 2.2. Thuật toán Cửa sổ Trượt (Sliding Window Fuzzy Matching)
Do câu người dùng nói thường dài hơn cụm chunk mục tiêu (người dùng nói cả câu ghép), thuật toán chia câu người dùng thành các cửa sổ có kích thước tương đồng với chunk:

$$\text{Window Length} \in [L - 2, L + 2]$$

Với mỗi cửa sổ trượt $W$, độ tương đồng được tính theo công thức Gestalt Pattern Matching:

$$\text{Similarity}(W, \text{Chunk}) = \frac{2 \cdot |M|}{|W| + |\text{Chunk}|}$$

Trong đó $|M|$ là số ký tự trùng khớp theo thứ tự.

### 2.3. Bảng Phân loại Kết quả So khớp (Table-driven Matching Classification)

| Loại Kết Quả | Điều Kiện Kỹ Thuật | Hành Động Hệ Thống |
|---|---|---|
| `EXACT` | Normalized Spoken Text chứa chính xác Normalized Chunk Text (Similarity = 1.0) | Đánh dấu `MASTERED`, ghi nhận hoàn thành mục tiêu |
| `VARIATION` | Khớp với một trong các biến thể đã định nghĩa trong `accepted_variations` | Đánh dấu `MASTERED`, công nhận tương đương câu gốc |
| `APPROXIMATE` | Độ tương đồng trượt $\ge 0.72$ (ngưỡng tương đồng cấu hình) | Ghi nhận hoàn thành giao tiếp, lưu độ tương đồng vào báo cáo |
| `WRONG_FUNCTION` | Chunk được nói nhưng không phục vụ đúng yêu cầu/chức năng ngữ cảnh | Không tính PASS cho yêu cầu tương ứng, gợi ý luyện lại |
| `NOT_USED` | Độ tương đồng $< 0.72$ hoặc không xuất hiện trong transcript | Tự động ghi vào `chunk_bank` với trạng thái `NEEDS_PRACTICE` |

---

## 3. Kiến trúc Đánh giá Nhiệm vụ sau Roleplay (Post-Roleplay Evaluation)

### 3.1. Nguyên tắc Không Bịa Điểm (Zero Score Fabrication - Rule 1 & D-10)
- Nếu transcript không đủ lượt nói hoặc từ ngữ tối thiểu (`SCORING_MIN_USER_TURNS`, `SCORING_MIN_USER_WORDS`), hệ thống gắn nhãn `INSUFFICIENT_DATA`. Không gán điểm mặc định giả tạo.
- Điểm Pronunciation Accuracy luôn gắn cờ `isReference=true` vì dựa trên STT confidence điểm tham khảo.

### 3.2. Đánh giá Từng Yêu cầu (Requirement Evaluation with Evidence)
Mỗi tình huống có danh sách `scenario_requirements` (bắt buộc `is_mandatory=true` hoặc không bắt buộc).
Khi đánh giá:
1. LLM nhận prompt có cấu trúc chứa toàn bộ transcript, danh sách yêu cầu và chunk mục tiêu.
2. Với mỗi yêu cầu, LLM trả về JSON Schema:
   - `requirement_id`: UUID
   - `passed`: `true` hoặc `false`
   - `evidence_transcript`: Trích xuất chính xác câu người dùng đã nói làm bằng chứng (không suy diễn)
   - `feedback`: Nhận xét ngắn gọn, khích lệ
3. **Điều kiện Hoàn thành Tình huống (Scenario Completion Rule):** Tình huống chỉ chuyển sang trạng thái `COMPLETED` khi **100% các yêu cầu bắt buộc (`is_mandatory=true`) đạt `PASS`**.

### 3.3. Tính Idempotency (Tính Bất Biến khi Gọi Lại)
- Khi gọi `/api/v1/roleplays/{id}/end` nhiều lần, session không bị duplicate trạng thái hoặc sinh lại điểm 2 lần.
- Đánh giá chỉ thực hiện một lần; nếu đã có bản ghi `COMPLETED` trong `roleplay_evaluations`, API trả về kết quả đã lưu.
- Event `RoleplayEvaluated` được phát qua Event Bus trong tiến trình, sẵn sàng cho Gamification Service ở Sprint 6 cộng XP mà không bị double-count (nhờ `idempotency_key = f"roleplay:{session_id}"`).

---

## 4. Quản lý Từ vựng Cá Nhân hóa: Sổ tay Câu mẫu (`chunk_bank`)

Khi người học bỏ lỡ hoặc nói sai một chunk quan trọng trong buổi Roleplay, hệ thống không chỉ ghi nhận FAIL trên màn hình mà còn tự động đưa chunk đó vào bảng `chunk_bank`:
- Trạng thái ban đầu: `NEEDS_PRACTICE`.
- Thời gian cập nhật: `last_reviewed_at`.
- Mục đích: Dùng làm nguồn dữ liệu cho bài ôn tập Spaced Repetition (Lặp lại ngắt quãng) trong các sprint tiếp theo.
- Khi người học thực hiện lại bài Reflex Drill hoặc Roleplay đạt điểm cao với chunk đó, trạng thái có thể thăng lên `MASTERED`.

---

## 5. Persona Prompt Strategy trong WebSocket Roleplay

Khi session có `session.type == "ROLEPLAY"`, hệ thống chuyển đổi prompt của AI từ vai Coach chung sang vai nhân vật cụ thể:
1. **Thiết lập Delimiter cô lập dữ liệu:** Toàn bộ transcript người dùng được bọc trong delimiter `=== USER SPOKEN DATA ===` để ngăn Prompt Injection.
2. **Quy tắc Turn-Taking:**
   - AI không ngắt lời khi người dùng ngập ngừng.
   - Giữ độ dài câu trả lời ngắn gọn (1–3 câu) mô phỏng người đối thoại đời thực, tránh độc thoại thuyết giảng.
   - Khéo léo đưa ra câu hỏi gợi mở để người dùng kích hoạt các mục tiêu tiếp theo trong tình huống.
