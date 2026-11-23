# Báo cáo Kiểm thử Tự động: Session State Machine (SCRUM-45)

- **Mã công việc:** [SCRUM-45](https://diepp031005.atlassian.net/browse/SCRUM-45)
- **Tên công việc:** Kiểm thử State Machine của Session (Business Logic Invariant)
- **Mục tiêu:** Tuân thủ tuyệt đối quy tắc chuyển trạng thái phiên học tại **Mục 9 AGENTS.md**
- **File bảng tính Excel bàn giao:** [`docs/test-artifacts/Test_Cases_Session_State_Machine_SCRUM-45.xlsx`](file:///d:/newcode/Nam4/Project1/Talk-With-Me/docs/test-artifacts/Test_Cases_Session_State_Machine_SCRUM-45.xlsx)
- **File mã nguồn kiểm thử tự động:** [`backend/tests/unit/test_session_state_machine.py`](file:///d:/newcode/Nam4/Project1/Talk-With-Me/backend/tests/unit/test_session_state_machine.py)

---

## 1. Tổng quan Bộ Test Cases trên Bảng tính Excel

Tệp Excel `Test_Cases_Session_State_Machine_SCRUM-45.xlsx` được thiết kế chuẩn mực phục vụ thẩm định chất lượng dự án TalkWithMe:
1. **Sheet `TEST REPORT` (Dashboard):**
   - KPI tóm tắt: Tổng số 70 test cases, 70 Passed (100%), 0 Failed, 0 Blocked, 100% Automation.
   - Bảng tổng hợp theo 7 phân hệ kịch bản nghiệp vụ (SC-01 đến SC-07).
2. **Sheet `All 70 Test Cases`:** Bảng danh mục master tổng hợp đầy đủ 70 trường hợp kiểm thử với các cột: `ID`, `Kịch Bản`, `Tên Test Case`, `Tiền Điều Kiện`, `Các Bước Thực Hiện`, `Kết Quả Mong Đợi`, `Kết Quả (Result)`, `Thực Thi`, `Pytest Node ID`, `Quy Tắc Nghiệp Vụ`.
3. **7 Sheet chi tiết tương ứng với 7 kịch bản nghiệp vụ:**
   - `SC-01 Happy Path`: Toàn bộ vòng đời bình thường của một Session.
   - `SC-02 Flaky Network`: Kiểm thử mạng chập chờn, mất kết nối và kết nối lại thành công.
   - `SC-03 Reconnect Timeout`: Mất kết nối quá 30 giây, chuyển trạng thái cưỡng bức kèm ghi nhận lý do `TIMEOUT`.
   - `SC-04 Feedback Retry`: Quy trình chấm điểm lỗi và thử lại (Retry) an toàn.
   - `SC-05 Illegal Transitions`: Chặn 28 bước nhảy trạng thái bất hợp pháp.
   - `SC-06 Mic Denied`: Bất biến từ chối mic - Session không bao giờ được chuyển sang `ACTIVE`.
   - `SC-07 Internal Invariants`: Tính toàn vẹn cấu trúc Enum và bảng tra cứu chuyển đổi trạng thái.

---

## 2. Bảng Tổng hợp Kết quả Thực thi Kiểm thử (Trích xuất từ Excel)

| STT | Mã Kịch Bản | Tên Kịch Bản Kiểm Thử | Quy Tắc Nghiệp Vụ Tham Chiếu | Tổng TC | Passed | Failed | Blocked | Automation | Manual | Trạng Thái |
|:---:|:---|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | **SC-01** | Happy Path Lifecycle | `CREATED -> ACTIVE -> ENDING -> ENDED -> FEEDBACK_READY` | 7 | 7 | 0 | 0 | 7 | 0 | **100% Passed** |
| 2 | **SC-02** | Flaky Network Reconnection | `ACTIVE <-> RECONNECTING` 2 chiều, chịu lỗi nhiều chu kỳ | 5 | 5 | 0 | 0 | 5 | 0 | **100% Passed** |
| 3 | **SC-03** | Reconnect Timeout | `RECONNECTING -> ENDING -> ENDED` sau timeout 30s | 6 | 6 | 0 | 0 | 6 | 0 | **100% Passed** |
| 4 | **SC-04** | Feedback Retry Path | `ENDED -> FAILED -> ENDED (Retry) -> FEEDBACK_READY` | 7 | 7 | 0 | 0 | 7 | 0 | **100% Passed** |
| 5 | **SC-05** | Illegal State Transitions | Chặn 28 bước nhảy trạng thái bất hợp pháp (Enum Validation) | 28 | 28 | 0 | 0 | 28 | 0 | **100% Passed** |
| 6 | **SC-06** | Microphone Permission Denied | Chặn tuyệt đối `CREATED -> ACTIVE` khi từ chối cấp quyền mic | 12 | 12 | 0 | 0 | 12 | 0 | **100% Passed** |
| 7 | **SC-07** | Internal Invariants & Enums | Toàn vẹn bảng `_VALID_TRANSITIONS`, UpperCase, StrEnum | 5 | 5 | 0 | 0 | 5 | 0 | **100% Passed** |
| | **TỔNG CỘNG** | **Toàn bộ phạm vi State Machine** | **AGENTS.md Mục 9** | **70** | **70** | **0** | **0** | **70** | **0** | **100.00%** |

---

## 3. Chi tiết 7 Kịch bản Kiểm thử Nghiệp vụ

### 3.1. SC-01: Happy Path Lifecycle (7 Test Cases)
- **TC-SM-001:** `CREATED -> ACTIVE` khi client cấp quyền microphone thành công.
- **TC-SM-002:** `ACTIVE -> ENDING` khi người dùng bấm kết thúc hoặc hết thời lượng phiên.
- **TC-SM-003:** `ENDING -> ENDED` sau khi dọn dẹp bộ đệm âm thanh và luồng kết nối.
- **TC-SM-004:** `ENDED -> FEEDBACK_READY` khi tiến trình scoring và LLM hoàn tất đánh giá.
- **TC-SM-005:** Xác thực toàn bộ chuỗi tuần tự hợp lệ không bị đứt đoạn.
- **TC-SM-006:** Xác thực `FEEDBACK_READY` là trạng thái kết thúc (Terminal State), không cho phép chuyển đi bất kỳ đâu.
- **TC-SM-007:** Xác thực `INSUFFICIENT_DATA` là trạng thái kết thúc (Terminal State) theo Rule 1.

### 3.2. SC-02: Flaky Network Reconnection (5 Test Cases)
- **TC-SM-008:** Client rớt mạng đột ngột: `ACTIVE -> RECONNECTING`.
- **TC-SM-009:** Client bắt lại mạng và gửi `lastSeq`: `RECONNECTING -> ACTIVE`.
- **TC-SM-010:** Khả năng chịu đựng nhiều chu kỳ rớt/phục hồi mạng liên tiếp (`ACTIVE <-> RECONNECTING` 3 lần).
- **TC-SM-011:** Tính nhất quán hai chiều của hàm `can_transition()`.
- **TC-SM-012:** Giá trị chuỗi enum chuẩn `"RECONNECTING"` phục vụ lưu trữ DB.

### 3.3. SC-03: Reconnect Timeout (6 Test Cases)
- **TC-SM-013:** Hết thời gian chờ 30 giây: `RECONNECTING -> ENDING`.
- **TC-SM-014:** Tiếp tục `ENDING -> ENDED` để kết thúc phiên và ghi nhận `end_reason = "TIMEOUT"`.
- **TC-SM-015:** Chặn nhảy cóc từ `RECONNECTING` sang `ENDED` mà bỏ qua `ENDING`.
- **TC-SM-016:** Xác thực logic State Machine trong task timeout nền (`_handle_timeout_after_disconnect`).
- **TC-SM-017:** Guard condition: Timeout handler tự động bỏ qua nếu người dùng đã kịp kết nối lại (`ACTIVE`) trước khi hết 30s.
- **TC-SM-018:** Guard condition: Xử lý an toàn khi session không tồn tại trong DB mà không gây crash exception.

### 3.4. SC-04: Feedback Retry Path (7 Test Cases)
- **TC-SM-019:** LLM hoặc scoring gặp sự cố: `ENDED -> FAILED` (đánh dấu `retryable=True`).
- **TC-SM-020:** Người dùng/Hệ thống kích hoạt Retry: `FAILED -> ENDED`.
- **TC-SM-021:** Retry thành công: `ENDED -> FEEDBACK_READY`.
- **TC-SM-022:** Toàn bộ chu trình Retry hợp lệ: `ENDED -> FAILED -> ENDED -> FEEDBACK_READY`.
- **TC-SM-023:** Chặn nhảy cóc từ `FAILED` trực tiếp sang `FEEDBACK_READY` (bắt buộc phải qua `ENDED`).
- **TC-SM-024:** Hàm `can_transition(FAILED, ENDED)` luôn trả về `True` để API `retry_feedback()` hoạt động mượt mà.
- **TC-SM-025:** Luồng chuyển đổi `ENDED -> INSUFFICIENT_DATA` khi phiên luyện nói dưới ngưỡng tối thiểu (Rule 1).

### 3.5. SC-05: Illegal State Transitions (28 Test Cases)
Ngăn chặn toàn diện mọi bước nhảy vi phạm logic nghiệp vụ với `InvalidSessionStateTransitionError`:
- Nhảy sớm từ `CREATED` sang `ENDED`, `RECONNECTING`, `FEEDBACK_READY`, `FAILED`.
- Quay lui từ `ACTIVE` về `CREATED` hoặc nhảy cóc sang `ENDED`, `FEEDBACK_READY`, `INSUFFICIENT_DATA`, `FAILED`.
- Quay lui từ `ENDING` về `ACTIVE`, `RECONNECTING`, `CREATED`, hoặc nhảy cóc sang `FEEDBACK_READY`.
- Rời khỏi Terminal States: `FEEDBACK_READY` hoặc `INSUFFICIENT_DATA` sang bất kỳ trạng thái nào khác.
- Quay ngược từ `ENDED` về `ACTIVE`, `ENDING`, `CREATED`, `RECONNECTING`.
- Nhảy sai từ `FAILED` sang `ACTIVE`, `FEEDBACK_READY`, `CREATED`.
- Đảm bảo exception chứa đầy đủ `from_state`, `to_state`, `reason`.
- Xử lý chuỗi trạng thái không xác định (`unknown state string`).

### 3.6. SC-06: Microphone Permission Denied (12 Test Cases)
- **TC-SM-054:** Chặn tuyệt đối `CREATED -> ACTIVE` khi `has_mic_permission=False`. Ném lỗi: `"Microphone permission denied: session cannot transition to ACTIVE"`.
- **TC-SM-055:** Thông báo lỗi thân thiện, rõ ràng phục vụ hiển thị modal cảnh báo phía frontend.
- **TC-SM-056 & TC-SM-057:** Cho phép chuyển sang `ACTIVE` khi `has_mic_permission=True` (mặc định).
- **TC-SM-058 đến TC-SM-065:** Cô lập logic: Cờ `has_mic_permission=False` chỉ áp dụng kiểm tra khi `from_state == CREATED`, không gây nhiễu cho các trạng thái khác (`RECONNECTING`, `ENDING`, `ENDED`, v.v.).

### 3.7. SC-07: Internal Invariants & Enums (5 Test Cases)
- **TC-SM-066:** 100% các giá trị trong `SessionState` đều có entry trong bảng tra cứu `_VALID_TRANSITIONS`.
- **TC-SM-067:** Tất cả các trạng thái đích trong `_VALID_TRANSITIONS` đều là enum hợp lệ.
- **TC-SM-068:** Chứng minh toán học: `can_transition()` nhất quán 100% trên toàn bộ $8 \times 8 = 64$ cặp trạng thái có thể có.
- **TC-SM-069:** Tất cả các giá trị enum đều là `UPPERCASE` để lưu trữ an toàn trong PostgreSQL.
- **TC-SM-070:** `SessionState` kế thừa `StrEnum` cho phép so sánh chuỗi nguyên bản trực tiếp.

---

## 4. Bằng chứng Thực thi (Execution Evidence)

```bash
# Lệnh chạy kiểm thử tự động cho toàn bộ bộ test State Machine
cd backend
python -m pytest tests/unit/test_session_state_machine.py -v --tb=short
```

**Kết quả thực tế ghi nhận:**
```text
============================= test session starts =============================
platform win32 -- Python 3.14.7, pytest-9.1.1, pluggy-1.6.0
rootdir: D:\newcode\Nam4\Project1\Talk-With-Me\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-1.4.0, cov-7.1.0
collected 70 items

tests\unit\test_session_state_machine.py ............................... [ 44%]
.......................................                                  [100%]

============================= 70 passed in 0.12s ==============================
```

**Kiểm tra tính tương thích hồi quy (Regression Check):**
Chạy đồng thời với các unit test liên quan của Coach và Scoring:
```text
tests\unit\test_session_state_machine.py: 70 passed
tests\unit\test_coach_unit.py: 38 passed
tests\unit\test_scoring_unit.py: 52 passed
============================= 160 passed in 0.23s =============================
```

---

## 5. Kết luận & Đánh giá DoD (Definition of Done)

- [x] **Tuân thủ AGENTS.md Mục 9:** 100% các quy tắc chuyển trạng thái và bất biến mic được bảo vệ chặt chẽ.
- [x] **Độ bao phủ:** 70/70 test cases Passed, thời gian chạy chỉ **0.12 giây** (không phụ thuộc I/O DB, không gọi mạng ngoài).
- [x] **Tài liệu kiểm thử hoàn chỉnh:** Bàn giao bảng tính Excel `Test_Cases_Session_State_Machine_SCRUM-45.xlsx` kèm file Markdown báo cáo.
- [x] **Trạng thái công việc:** **HOÀN THÀNH (DONE)**, sẵn sàng tích hợp vào pipeline CI/CD.
