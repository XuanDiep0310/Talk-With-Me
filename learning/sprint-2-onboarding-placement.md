# Learning: Sprint 2 — Onboarding, Placement Test & Level Assessment

Tài liệu này ghi lại toàn bộ kiến thức kỹ thuật, thiết kế kiến trúc và mẫu code thực tế áp dụng trong **Sprint 2: Onboarding & Placement Test**.

---

## 1. Thiết kế Onboarding Flow & Nguyên tắc "Communication-First"

### 1.1. Triết lý nghiệp vụ
Theo nguyên tắc của TalkWithMe:
1. **Không đoán bừa trình độ (No guessing):** Nếu người học nói quá ngắn (< 30 từ) hoặc ít câu trả lời (< 3 câu), hệ thống **tuyệt đối không bịa điểm hay đoán bừa** sang level cao hơn. Hệ thống gán tạm `A1`, bật cờ `needs_reassessment=true` và trả cờ `is_insufficient_data=true`.
2. **Quyền tự quyết của người học:** Người dùng có thể chọn làm **Voice Placement Test** hoặc **Bỏ qua, tự chọn Level**. Cả hai luồng đều dẫn đến chọn sở thích (Interests), mục tiêu (Goals) và điểm yếu cần cải thiện (Weak Points).
3. **Bảo toàn Audit Trail:** Mọi thay đổi về Level (do Placement Test hoặc do User tự chọn) đều phải ghi lại bản ghi bất biến trong bảng `level_history`.

---

## 2. Thuật toán gán Level — Pure Function Heuristic + LLM Blending

### 2.1. Tại sao dùng Pure Function cho Core Scoring / Estimation?
- **Tách biệt hoàn toàn logic toán học và cơ sở dữ liệu:** Không phụ thuộc I/O, không gọi DB, không gọi network.
- **Dễ dàng unit test:** Kiểm thử bảng (table-driven tests) với vô số ca biên (boundary conditions) và ca thiếu dữ liệu mà không cần mock DB hay AsyncSession.

### 2.2. Trích xuất đặc trưng (Feature Extraction)
Từ mảng câu trả lời của bài kiểm tra giọng nói:
- `total_words`: Tổng số từ người học đã nói.
- `avg_words_per_answer`: Tỷ lệ từ trung bình mỗi câu.
- `avg_stt_confidence`: Độ tin cậy trung bình của bộ nhận dạng giọng nói STT (0.0 – 1.0).
- `avg_speaking_duration`: Thời lượng nói trung bình (giây).
- `avg_response_latency`: Độ trễ từ khi câu hỏi kết thúc đến khi người học bắt đầu phát âm (giây).

### 2.3. Công thức tính điểm thành phần
```python
def _feature_score(features: PlacementFeatures) -> float:
    # 1. Fluency (độ trôi chảy): mục tiêu 100 từ/câu tương ứng điểm 1.0
    fluency = min(features.avg_words_per_answer / 100.0, 1.0)

    # 2. Confidence (độ tin cậy phát âm tham khảo):
    confidence = min(features.avg_stt_confidence, 1.0)

    # 3. Speed (tốc độ phản xạ): phản xạ 1s = 1.0 điểm, >= 8s = 0.0 điểm
    latency = max(0.0, 1.0 - (features.avg_response_latency - 1.0) / 7.0)

    # Trọng số: Fluency 50%, Confidence 30%, Speed 20%
    return 0.50 * fluency + 0.30 * confidence + 0.20 * latency
```

### 2.4. Kết hợp tín hiệu LLM (LLM Blending)
Khi dữ liệu thỏa mãn điều kiện tối thiểu:
- Điểm đặc trưng (Heuristic): 70%
- Gợi ý từ mô hình ngôn ngữ lớn (LLM): 30%
$$\text{Score}_{\text{blended}} = 0.70 \times \text{Score}_{\text{features}} + 0.30 \times \text{Score}_{\text{LLM}}$$

Ngưỡng CEFR:
- $\ge 0.80 \rightarrow \mathbf{C1}$
- $\ge 0.60 \rightarrow \mathbf{B2}$
- $\ge 0.40 \rightarrow \mathbf{B1}$
- $\ge 0.20 \rightarrow \mathbf{A2}$
- $< 0.20 \rightarrow \mathbf{A1}$

---

## 3. Kiến trúc Idempotency cho Client-Generated UUID

Khi client gửi câu trả lời qua mạng không dây, mạng có thể chập chờn hoặc người dùng ấn lặp lại:
1. Client sinh `requestId` (UUID v4 ngẫu nhiên) cho mỗi câu trả lời.
2. Bảng `placement_answers` có ràng buộc `UniqueConstraint("test_id", "request_id")`.
3. Backend kiểm tra:
```python
existing = await self._answer_repo.get_by_request_id(test_id, request_id)
if existing is not None:
    return existing  # Trả lại bản ghi đã lưu, không ném lỗi, không tạo bản ghi trùng
```

Tương tự với `POST /me/onboarding/complete`:
- Nếu `profile.onboarding_completed_at` đã có giá trị, backend trả lại trạng thái hiện tại (HTTP 200) thay vì ném lỗi, đảm bảo tính idempotent.

---

## 4. Bảo mật truy cập tài nguyên (Scoped Resources)

Theo quy ước **AGENTS.md §7 & §8 rule 7**:
- Truy vấn tài nguyên của người khác **phải trả 404 Not Found**, không trả 403 Forbidden để tránh rò rỉ sự tồn tại của ID tài nguyên (resource enumeration).
- Query luôn gắn chặt điều kiện `where(test_id == test_id, user_id == current_user.id)`:
```python
test = await self._test_repo.get_by_id_and_user(test_id, user_id)
if test is None:
    raise HTTPException(status_code=404, detail={"code": "PLACEMENT_TEST_NOT_FOUND", "message": "Placement test not found."})
```

---

## 5. Angular Routing & Onboarding Guard

### 5.1. Hai chiều bảo vệ Onboarding
1. **`authGuard` bảo vệ Dashboard và các trang học:**
   - Chưa đăng nhập $\rightarrow$ Chuyển về `/login`.
   - Đã đăng nhập nhưng `onboardingCompletedAt == null` $\rightarrow$ Chuyển về `/onboarding`.
2. **`onboardingGuard` bảo vệ màn Onboarding:**
   - Chưa đăng nhập $\rightarrow$ Chuyển về `/login`.
   - Đã đăng nhập và đã hoàn thành onboarding (`onboardingCompletedAt != null`) $\rightarrow$ Chuyển tiếp sang `/dashboard`. Không cho người dùng đã làm xong vào lại onboarding.

### 5.2. Stepper tuyến tính thống nhất (D-20)
Màn hình prototype cũ có số bước nhảy lung tung giữa Voice Test và Manual. Chuẩn hóa về 5 bước:
- **Bước 1/5:** Bắt đầu / Kiểm tra micro
- **Bước 2/5:** Xác định Level (Voice Test hoặc Tự chọn Level)
- **Bước 3/5:** Chọn sở thích (Interests)
- **Bước 4/5:** Chọn mục tiêu học tập (Goals)
- **Bước 5/5:** Chọn kỹ năng cần cải thiện (Weak Points)

---

## 6. Mẫu thiết kế Mock Mode cho Voice & Media Stream (D-08)

Khi phát triển local hoặc chạy CI mà thiết bị không có micro thật:
- Client có công tắc `useMock`:
  - Khi bật: Giả lập tín hiệu mic đã sẵn sàng, giả lập audio transcript gửi lên backend.
  - Khi tắt: Gọi `navigator.mediaDevices.getUserMedia({ audio: true })` thật để xin quyền từ trình duyệt.
- Backend hỗ trợ `STT_PROVIDER=fake`:
  - Trả về transcript tiếng Anh mẫu với confidence và speaking duration đo đạc được, giúp kiểm thử toàn bộ luồng mà không tốn chi phí gọi Cloud STT.
