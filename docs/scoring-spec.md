# Đặc tả Thuật toán và Công thức Chấm điểm Giao tiếp (Communication Scoring Spec)

- **Mã tài liệu:** SPEC-SCORING-01
- **Phiên bản công thức:** `formula_version = "1.0.0"`
- **Trạng thái:** PROPOSED (Chờ duyệt bởi Chủ dự án)
- **Cơ sở quy chiếu:** SRS mục F-03 (US-04, US-09, mục 3.3) & AGENTS.md mục 8

---

## 1. Nguyên tắc cốt lõi (Core Principles)

1. **Không bịa điểm (Zero Hallucination - AGENTS.md §8 Quy tắc 1):** Khi thiếu dữ liệu hoặc không đủ điều kiện tính toán, chỉ số phải nhận giá trị `null` (`None` trong backend) và hiển thị `N/A` trên giao diện người dùng. Không gán điểm 0 hoặc điểm mặc định khi thiếu dữ liệu.
2. **Ngưỡng dữ liệu tối thiểu của phiên (Data Sufficiency Threshold):** Toàn bộ buổi nói phải đạt ngưỡng tối thiểu thì mới thực hiện chấm điểm. Nếu dưới ngưỡng, trạng thái phiên là `INSUFFICIENT_DATA`, toàn bộ các kỹ năng là `null`, điểm tổng là `null`.
3. **Pronunciation chỉ mang tính tham khảo (AGENTS.md §8 Quy tắc 2):** Ở MVP, điểm phát âm dựa trên STT confidence trung bình, luôn gắn cờ `isReference = true` và UI hiển thị nhãn "(tham khảo)".
4. **An toàn bảo mật Prompt (AGENTS.md §8 Quy tắc 10):** Nội dung người học nói qua micro được coi là dữ liệu thô (untrusted data), được bọc trong delimiter rõ ràng khi gửi vào LLM, ngăn chặn Prompt Injection.
5. **Độc lập tham số và kiểm soát phiên bản:** Mọi tham số tính toán đều được cấu hình tập trung trong `app/core/config.py` và lưu trữ `formula_version` trong bảng `session_feedback`, `session_skill_scores`, `scoring_audit`.

---

## 2. Ngưỡng dữ liệu tối thiểu của phiên (Session-level Sufficiency)

Trước khi kích hoạt Scoring Engine, kiểm tra phiên theo các ngưỡng sau:

| Tên tham số cấu hình | Giá trị mặc định | Mô tả |
|---|---|---|
| `SCORING_MIN_USER_WORDS` | 5 từ | Tổng số từ hợp lệ do người học phát biểu trong toàn bộ phiên |
| `SCORING_MIN_USER_TURNS` | 1 lượt | Số lượt nói của người học (mỗi lượt là một chuỗi segment liên tiếp) |
| `SCORING_MIN_SPOKEN_SECONDS` | 5.0 giây | Tổng thời lượng nói thực tế của người học |

- **Điều kiện INSUFFICIENT_DATA:** Nếu $\text{total\_words} < \text{SCORING\_MIN\_USER\_WORDS}$ HOẶC $\text{user\_turns} < \text{SCORING\_MIN\_USER\_TURNS}$ HOẶC $\text{spoken\_seconds} < \text{SCORING\_MIN\_SPOKEN\_SECONDS}$, hệ thống lập tức kết luận phiên là `INSUFFICIENT_DATA`. Không gọi LLM, không tính điểm thành phần.

---

## 3. Định nghĩa chi tiết 5 chỉ số kỹ năng

### 3.1. Fluency Score (Độ lưu loát)
- **Trọng số trong điểm tổng:** 25% (0.25)
- **Công thức SRS 3.3:**
  $$\text{Fluency} = 0.45 \times \text{Speech Continuity} + 0.35 \times \text{Pause Score} + 0.20 \times \text{Filler Word Score}$$

#### a. Speech Continuity (Tính liên tục của lời nói)
- **Ý nghĩa:** Đo lường tỉ lệ giữa thời lượng phát âm thực tế so với tổng thời gian các lượt nói của người học (bao gồm cả các khoảng chững lại giữa câu). Người nói tự tin, trôi chảy sẽ có tỉ lệ phát âm liên tục cao.
- **Đầu vào:**
  - $T_{spoken}$: Tổng thời gian phát âm thực tế của user (giây), tính từ các segment của user $\sum (end\_ms - start\_ms) / 1000$.
  - $T_{turn\_span}$: Tổng khoảng thời gian kéo dài các lượt nói của user. Với mỗi lượt nói bắt đầu lúc $t_{start}$ và kết thúc segment cuối lúc $t_{end}$, khoảng thời gian lượt nói là $t_{end} - t_{start}$. $T_{turn\_span} = \sum (t_{end} - t_{start})$.
- **Công thức:**
  $$\text{Continuity Ratio} = \frac{T_{spoken}}{\max(T_{turn\_span}, T_{spoken}, 0.001)}$$
  $$\text{Speech Continuity Score} = \min\left(100.0, \max\left(0.0, \frac{\text{Continuity Ratio}}{\text{CONTINUITY\_TARGET\_RATIO}} \times 100.0\right)\right)$$
- **Tham số cấu hình đề xuất:**
  - `CONTINUITY_TARGET_RATIO = 0.85`: Đạt tỉ lệ nói 85% thời lượng lượt trở lên được 100 điểm (dành 15% cho việc lấy hơi tự nhiên).
- **Điều kiện N/A:** Khi $T_{turn\_span} \le 0$ hoặc không có segment user. Lý do: `"INSUFFICIENT_TURN_DURATION"`.

#### b. Pause Score (Điểm kiểm soát quãng ngừng ngập ngừng)
- **Ý nghĩa:** Trừ điểm theo tần suất xuất hiện quãng ngừng kéo dài bất thường giữa các câu/đoạn trong lượt nói của người học.
- **Đầu vào:**
  - Quãng ngừng kéo dài giữa 2 segment liên tiếp trong cùng một lượt nói của user: $\Delta t = (start\_ms_{i+1} - end\_ms_i)$.
  - Ngưỡng xác định ngừng dài: $\Delta t \ge \text{PAUSE\_THRESHOLD\_MS}$ (mặc định 1500 ms = 1.5 giây).
  - $N_{pause}$: Tổng số lần ngắt quãng $\ge \text{PAUSE\_THRESHOLD\_MS}$.
  - $M_{spoken}$: Số phút nói của user $= \max(T_{spoken} / 60.0, 0.1)$.
  - Tần suất ngừng dài mỗi phút: $R_{pause} = \frac{N_{pause}}{M_{spoken}}$.
- **Công thức:**
  $$\text{Pause Score} = \max\left(0.0, \min\left(100.0, 100.0 - (R_{pause} \times \text{PAUSE\_PENALTY\_PER\_MIN})\right)\right)$$
- **Tham số cấu hình đề xuất:**
  - `PAUSE_THRESHOLD_MS = 1500` (1.5 giây).
  - `PAUSE_PENALTY_PER_MIN = 12.0`: Mỗi lần ngập ngừng kéo dài trên 1 phút nói trừ 12 điểm. Ví dụ 0 lần: 100đ; 2 lần/phút: 76đ; 5 lần/phút: 40đ; $\ge 8.3$ lần/phút: 0đ.
- **Điều kiện N/A:** Không có đủ thời lượng tính toán ($T_{spoken} < 3.0$ giây). Lý do: `"INSUFFICIENT_SPEECH_DURATION"`.

#### c. Filler Word Score (Điểm hạn chế từ đệm)
- **Ý nghĩa:** Đánh giá khả năng diễn đạt lưu loát mà không lạm dụng các từ chêm/đệm gây ngắt quãng suy nghĩ.
- **Đầu vào:**
  - Danh mục từ đệm nhận diện (`FILLER_WORDS`): `{"um", "uh", "er", "ah", "like", "you know", "hmm", "well"}`.
  - $F$: Tổng số từ đệm đếm được trong transcript của người học.
  - $W$: Tổng số từ trong transcript của người học.
  - Tỉ lệ từ đệm trên 100 từ: $R_{filler} = \frac{F}{\max(W, 1)} \times 100.0$.
- **Công thức:**
  $$\text{Filler Word Score} = \max\left(0.0, \min\left(100.0, 100.0 - (R_{filler} \times \text{FILLER\_PENALTY\_PER\_100})\right)\right)$$
- **Tham số cấu hình đề xuất:**
  - `FILLER_PENALTY_PER_100 = 8.0`: Mỗi 1% từ đệm (1 từ đệm/100 từ) trừ 8 điểm. Ví dụ 0 từ đệm: 100đ; 2.5% từ đệm: 80đ; 5% từ đệm: 60đ; $\ge 12.5$% từ đệm: 0đ.
- **Điều kiện N/A:** $W < 3$ từ. Lý do: `"INSUFFICIENT_WORDS"`.

---

### 3.2. Listening Comprehension (Mức độ tiếp thu & hiểu)
- **Trọng số trong điểm tổng:** 20% (0.20)
- **Công thức SRS 3.3:**
  $$\text{Listening} = 0.70 \times \text{Response Relevance} + 0.30 \times \text{Task Completion}$$

#### a. Response Relevance (Mức độ liên quan của phản hồi)
- **Ý nghĩa:** Đo lường mức độ câu nói của người học bám sát nội dung câu hỏi/lời dẫn trước đó của AI Coach.
- **Đầu vào:** Cặp hội thoại liền kề $(AI_{turn}, User_{reply})$ được đưa vào LLM với hướng dẫn chấm điểm chặt chẽ (0–100).
- **Phương pháp xác định:** LLM phân tích ngữ nghĩa, trả về điểm số nguyên trong khoảng $[0, 100]$.
  - $90–100$: Trả lời trực tiếp, đầy đủ ý, mở rộng câu chuyện tự nhiên.
  - $70–89$: Trả lời đúng trọng tâm nhưng ngắn gọn hoặc hơi lệch ý phụ.
  - $40–69$: Trả lời mơ hồ, chỉ liên quan một phần nhỏ.
  - $0–39$: Lạc đề hoàn toàn, không hiểu ý AI hỏi.

#### b. Task Completion (Mức độ hoàn thành mục tiêu giao tiếp)
- **Ý nghĩa:** Người học có giải quyết được nhiệm vụ giao tiếp của chủ đề hoặc câu hỏi mở hay không (VD: mô tả trải nghiệm, đưa ra quan điểm, giải thích nguyên nhân).
- **Phương pháp xác định:** LLM phân tích toàn bộ ngữ cảnh hội thoại theo chủ đề, trả về điểm số nguyên trong khoảng $[0, 100]$.
- **Điều kiện N/A chung cho Listening:**
  - Nếu phiên không có lượt phát biểu nào của AI trước phản hồi của User (User nói đơn độc), không đo được độ hiểu câu nói của AI. Điểm Listening là `null`, lý do: `"NO_AI_PROMPT_FOUND"`.

---

### 3.3. Vocabulary Context (Vốn từ trong ngữ cảnh)
- **Trọng số trong điểm tổng:** 20% (0.20)
- **Công thức SRS 3.3:**
  $$\text{Vocabulary} = 0.40 \times \text{Vocabulary Diversity} + 0.60 \times \text{Context Relevance}$$

#### a. Vocabulary Diversity (Độ đa dạng từ vựng bằng MTLD)
- **Ý nghĩa:** Đo lường mức độ phong phú của vốn từ bằng giải thuật MTLD (Measure of Textual Lexical Diversity - McCarthy & Jarvis, 2010). Khác với TTR thô (dễ bị tụt khi văn bản dài), MTLD giữ tính ổn định bất kể độ dài văn bản.
- **Giải thuật MTLD:**
  1. Tách văn bản của User thành danh sách các từ đã chuẩn hóa (chữ thường, bỏ dấu câu).
  2. Duyệt tuần tự từ đầu đến cuối: tính tỉ lệ $TTR = \frac{\text{số từ độc nhất}}{\text{tổng số từ}}$.
  3. Khi $TTR \le \text{MTLD\_FACTOR\_THRESHOLD}$ (mặc định 0.72): ghi nhận 1 factor hoàn chỉnh, reset danh sách từ và tính tiếp cho đoạn sau.
  4. Đoạn dư cuối cùng tính factor lẻ: $factor_{tail} = \frac{1 - TTR_{tail}}{1 - \text{MTLD\_FACTOR\_THRESHOLD}}$.
  5. $MTLD = \frac{\text{Tổng số từ}}{\sum factors}$.
  6. Với chiều ngược lại (reverse), tính tương tự rồi lấy trung bình (hoặc tính forward chuẩn).
- **Chuẩn hóa sang thang 0–100:**
  $$\text{Diversity Score} = \min\left(100.0, \max\left(0.0, \frac{MTLD}{\text{MTLD\_TARGET\_BENCHMARK}} \times 100.0\right)\right)$$
- **Tham số cấu hình đề xuất:**
  - `MTLD_FACTOR_THRESHOLD = 0.72` (chuẩn ngôn ngữ học học thuật).
  - `MTLD_TARGET_BENCHMARK = 50.0`: MTLD $\ge 50$ (tương đương người học B2/C1 diễn đạt linh hoạt không lặp từ) đạt 100 điểm.
- **Điều kiện N/A:** Khi User nói ít hơn 10 từ ($\text{total\_words} < 10$). MTLD trên mẫu quá ngắn không có giá trị thống kê. Lý do: `"TEXT_TOO_SHORT_FOR_MTLD"`.

#### b. Context Relevance (Mức độ phù hợp ngữ cảnh của từ vựng)
- **Ý nghĩa:** Đánh giá từ ngữ sử dụng có tự nhiên, chuẩn xác, đúng ngữ cảnh chủ đề và đúng sắc thái nghĩa hay không (tránh dùng từ to tát nhưng sai ngữ cảnh).
- **Phương pháp xác định:** LLM đánh giá tập từ vựng của User trong tương quan với chủ đề (thang 0–100).
- **Điều kiện N/A:** Khi không có dữ liệu văn bản người dùng hợp lệ. Lý do: `"INSUFFICIENT_VOCABULARY_DATA"`.

---

### 3.4. Response Speed Score (Tốc độ phản xạ)
- **Trọng số trong điểm tổng:** 15% (0.15)
- **Công thức SRS 3.3 (có Grace Period 2 giây):**
  $$\text{Response Speed} = \begin{cases} 100, & \text{nếu } T \le 2.0\text{s} \\ \max(0.0, 100.0 - 12.0 \times (T - 2.0)), & \text{nếu } T > 2.0\text{s} \end{cases}$$
- **Đầu vào:**
  - $T$: Độ trễ phản hồi trung bình (giây) giữa lúc AI dứt lời ($end\_ms_{AI}$) đến lúc User bắt đầu cất lời ($start\_ms_{User}$) trên các lượt trao đổi:
    $$T = \frac{1}{K} \sum_{k=1}^K \frac{\max(0, start\_ms_{User, k} - end\_ms_{AI, k})}{1000.0}$$
- **Phân tích các điểm mốc:**
  - $T = 0.0$s đến $2.0$s: $100$ điểm (thời gian suy nghĩ tự nhiên hợp lý).
  - $T = 3.0$s: $100 - 12 \times 1 = 88$ điểm.
  - $T = 5.0$s: $100 - 12 \times 3 = 64$ điểm.
  - $T = 10.333$s: $100 - 12 \times 8.333 = 0$ điểm.
  - $T > 10.333$s: $0$ điểm.
- **Điều kiện N/A:** Khi không có lượt hội thoại nào dạng $(AI \rightarrow User)$ (ví dụ User nói trước hoặc User nói độc thoại). Lý do: `"NO_INTERACTIVE_TURNS"`.

---

### 3.5. Pronunciation Accuracy (Độ chính xác phát âm)
- **Trọng số trong điểm tổng:** 20% (0.20)
- **Công thức SRS 3.3:**
  $$\text{Pronunciation} = \text{Trung bình STT Confidence của các segment của User} \times 100.0$$
- **Đặc tính bắt buộc:**
  - Cờ `isReference = true` luôn được đính kèm ở API response.
  - UI luôn hiển thị nhãn "(tham khảo)".
- **Điều kiện N/A:** Khi nhà cung cấp STT không trả về chỉ số confidence (toàn bộ `confidence is null`). Lý do: `"NO_STT_CONFIDENCE_DATA"`.

---

## 4. Công thức Điểm Tổng Hợp (Overall Communication Score) và Quy tắc D-10

### 4.1. Trọng số cơ sở (Base Weights)
$$\begin{aligned}
w_{fluency} &= 0.25 \\
w_{listening} &= 0.20 \\
w_{vocabulary} &= 0.20 \\
w_{speed} &= 0.15 \\
w_{pronunciation} &= 0.20 \\
\sum w_i &= 1.00
\end{aligned}$$

### 4.2. Xử lý khi có chỉ số N/A theo Quyết định D-10
1. **Đủ 5 chỉ số hợp lệ:**
   $$\text{Overall} = \sum_{i=1}^5 w_i \times S_i, \quad partial = \text{false}$$
2. **Thiếu đúng 1 chỉ số (1 chỉ số N/A):**
   - Giả sử chỉ số thứ $k$ bị N/A.
   - Tính lại tổng trọng số các chỉ số còn lại: $W_{valid} = \sum_{j \ne k} w_j$.
   - Tính điểm tổng theo trọng số chuẩn hóa:
     $$\text{Overall} = \sum_{j \ne k} \left(\frac{w_j}{W_{valid}}\right) \times S_j, \quad partial = \text{true}$$
3. **Thiếu từ 2 chỉ số trở lên ( $\ge 2$ chỉ số N/A):**
   - Điểm tổng không đủ độ tin cậy để kết luận năng lực giao tiếp.
   - $\text{Overall} = \text{null}$, $partial = \text{false}$.
   - UI hiển thị `"N/A"` cho điểm tổng.

---

## 5. Cấu trúc Đánh giá Định tính qua LLM (Structured LLM Feedback)

LLM được gọi 1 lần duy nhất với cấu trúc JSON đầu ra bắt buộc kiểm tra bằng Pydantic:

```json
{
  "response_relevance": 85.0,
  "task_completion": 80.0,
  "context_relevance": 88.0,
  "strengths": [
    "Duy trì câu trả lời liên tục và sử dụng từ nối tự nhiên khi kể về chuyến đi.",
    "Phản xạ trả lời nhanh chóng đối với các câu hỏi mở của AI Coach."
  ],
  "improvements": [
    "Nên mở rộng thêm chi tiết cụ thể thay vì chỉ dừng ở các câu đơn ngắn.",
    "Hạn chế chêm từ ngập ngừng 'you know' khi chuyển ý."
  ],
  "next_practice": "Thử thách tiếp theo: Luyện tập tình huống 'Đặt phòng khách sạn' để tăng cường vốn từ vựng chuyên sâu."
}
```

- **Ràng buộc đầu ra:**
  - `strengths`: từ 2 đến 3 nhận xét tích cực, súc tích bằng tiếng Việt.
  - `improvements`: tối đa 3 nhận xét mang tính xây dựng bằng tiếng Việt.
  - `next_practice`: 1 gợi ý cụ thể gắn với chủ đề hoặc bài học tiếp theo.
- **Xử lý lỗi & Retry:**
  - Áp dụng Retry với Exponential Backoff (3 lần).
  - Nếu thất bại sau 3 lần retry: ghi nhận `status = FAILED`, `retryable = true`, không điền điểm số giả.

---

## 6. Mô hình Cơ sở Dữ liệu

```
                +---------------------+
                |       sessions      |
                +---------------------+
                           | 1
                           |
                           | 1
                +---------------------+
                |  session_feedback   |
                +---------------------+
                | session_id (PK, FK) |
                | status              |
                | formula_version     |
                | overall_score (null)|
                | partial (bool)      |
                | strengths (JSON)    |
                | improvements (JSON) |
                | next_practice (null)|
                | generated_at        |
                +---------------------+
                    | 1           | 1
                    |             |
                    | *           | *
+-------------------------+   +-----------------------+
|  session_skill_scores   |   |     scoring_audit     |
+-------------------------+   +-----------------------+
| id (PK, UUID)           |   | id (PK, UUID)         |
| session_id (FK)         |   | session_id (FK)       |
| skill_name (VARCHAR)    |   | input_summary (JSON)  |
| score (FLOAT, nullable) |   | formula_version (STR) |
| components (JSON)       |   | created_at (TIMESTAMP)|
| na_reason (VARCHAR,null)|   +-----------------------+
| is_reference (BOOLEAN)  |
+-------------------------+
```

---

## 7. Đề xuất ghi vào Decision Log

Quyết định này được ghi nhận trong `docs/decision-log.md` dưới mã:
- **D-34:** Đặc tả chi tiết thành phần chấm điểm Fluency, Listening, Vocabulary, Response Speed, Pronunciation, giải thuật MTLD và cơ chế xử lý N/A (Trạng thái: PROPOSED).
