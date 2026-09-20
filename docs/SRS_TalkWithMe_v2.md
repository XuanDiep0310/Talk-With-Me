# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

## TalkWithMe — Ứng dụng luyện nói tiếng Anh cùng AI

**Phiên bản:** 2.1 (Bản rút gọn, hợp nhất từ SRS chi tiết Part 1 & Part 2, cập nhật phương pháp Chunking cho Scenario Lessons)
**Ngày cập nhật:** __________ &nbsp;&nbsp;&nbsp; **Người soạn:** __________ &nbsp;&nbsp;&nbsp; **Người phê duyệt:** __________

---

## 0. Thông tin tài liệu (Document Control)

| Mục | Nội dung |
|---|---|
| Tên tài liệu | SRS – TalkWithMe (Bản hợp nhất, rút gọn) |
| Phiên bản | v2.1 |
| Nguồn hợp nhất | `DETAILED_FEATURE_SRS_PART1.md`, `DETAILED_FEATURE_SRS_PART2.md` |
| Tác giả / chủ sở hữu | BA / Product Owner |
| Người phê duyệt | __________ |
| Lịch sử phiên bản | v1.0 – Bản chi tiết theo từng feature (Part 1, Part 2)<br>v2.0 – Hợp nhất theo chuẩn SRS Agile/Scrum, rút gọn để dễ đọc và dễ trace<br>v2.1 – Scenario Lessons (F-02) đổi sang dạy theo phương pháp Chunking |

---

## 1. Giới thiệu (Introduction)

### 1.1. Mục đích (Purpose)

Tài liệu mô tả yêu cầu chức năng và phi chức năng của ứng dụng TalkWithMe — nền tảng luyện nói tiếng Anh với AI theo hướng "Communication-First" (ưu tiên duy trì hội thoại tự nhiên hơn là ngắt lời sửa lỗi liên tục). Tài liệu là cơ sở thống nhất giữa Product Owner, Dev, QA và các bên liên quan về phạm vi và hành vi hệ thống cho bản MVP.

### 1.2. Phạm vi (Scope)

**Trong phạm vi MVP (In-Scope):**

- AI Coach: hội thoại giọng nói 1-1 với AI, cá nhân hoá theo hồ sơ (level, sở thích, mục tiêu).
- Live Script: hiển thị transcript thời gian thực (partial/final), phân biệt người nói, timestamp.
- Post-Session Feedback: chấm điểm giao tiếp và gợi ý luyện tập sau mỗi phiên.
- Scenario Lessons: tối thiểu 20 tình huống roleplay theo 4 nhóm chủ đề, dạy bằng **phương pháp Chunking** (cụm từ giao tiếp theo chức năng) kèm Chunk Drill và đánh giá hoàn thành nhiệm vụ.
- Communication Scoring Engine: tính 5 chỉ số (Fluency, Listening, Vocabulary, Response Speed, Pronunciation) và điểm tổng hợp.
- Gamification: XP, Daily Missions, Streak, hệ thống Level A1–C1.
- Community Voice Room: phòng thoại 3–5 người kèm Invisible AI Assistant hỗ trợ khi phòng im lặng và Private Cue Card gợi ý riêng từng người.
- Xử lý các tình huống lỗi phổ biến: mất mic, mất mạng, STT/AI timeout, dữ liệu không đủ để chấm điểm.

**Ngoài phạm vi MVP (Out-of-Scope):**

- Phân tích cảm xúc/ngữ điệu chuyên sâu.
- Trí nhớ hội thoại dài hạn qua nhiều session.
- Voice cloning / bắt chước giọng người dùng.
- Video hoặc avatar 3D.
- AI tự sinh bài học tức thời từ tin tức thời sự.
- Thuật toán nhắc lại theo lịch trình (spaced repetition) đầy đủ cho Chunk Bank — MVP chỉ lưu danh sách chunk cần luyện thêm, chưa lên lịch nhắc tự động.

### 1.3. Đối tượng sử dụng tài liệu

Product Owner, Business Analyst, Developer (Frontend/Backend/AI), Tester/QA, và các stakeholder liên quan đến việc phê duyệt phạm vi sản phẩm.

### 1.4. Định nghĩa & từ viết tắt

| Thuật ngữ | Giải thích |
|---|---|
| STT | Speech-to-Text — dịch vụ chuyển giọng nói thành văn bản |
| Live Script | Transcript hội thoại hiển thị theo thời gian thực |
| AI Coach | Tính năng luyện nói 1-1 với AI |
| Scenario Lesson | Bài học roleplay theo tình huống thực tế |
| Chunk | Cụm từ giao tiếp cố định, có nghĩa, dùng được ngay trong hội thoại (phương pháp Chunking) |
| Chunk Drill | Bước luyện phản xạ nghe & nhắc lại chunk trước khi roleplay |
| Chunk Bank | Danh sách chunk cá nhân người dùng cần luyện thêm hoặc đã thành thạo |
| XP | Điểm kinh nghiệm dùng cho gamification |
| Level | Trình độ tiếng Anh: A1 → A2 → B1 → B2 → C1 |
| Invisible AI Assistant | AI hỗ trợ ngầm trong Community Voice Room |
| Cue Card | Thẻ gợi ý câu nói, chỉ hiển thị riêng cho một người dùng |
| EC | Edge Case — tình huống ngoại lệ cần xử lý |
| AC | Acceptance Criteria — tiêu chí chấp nhận |

### 1.5. Tài liệu tham khảo

- `DETAILED_FEATURE_SRS_PART1.md` — Đặc tả chi tiết AI Coach, Live Script, Post-Session Feedback.
- `DETAILED_FEATURE_SRS_PART2.md` — Đặc tả chi tiết Scenario Lessons, Gamification, Community Voice Room.
- `docs/API_SPEC_PART2.md` — API Spec cho Lessons API & Gamification API.
- `DATA_DICTIONARY.md` — Từ điển dữ liệu PostgreSQL & Redis.

---

## 2. Mô tả tổng quan (Overall Description)

### 2.1. Bối cảnh sản phẩm

TalkWithMe là ứng dụng mobile/web độc lập, tích hợp các dịch vụ bên thứ ba: Speech-to-Text (chuyển giọng nói → văn bản), AI Language Model (sinh hội thoại, chấm điểm, phân tích), và hạ tầng Voice Chat thời gian thực cho Community Room. Backend quản lý profile người dùng, session, transcript, kết quả chấm điểm và tiến trình gamification.

### 2.2. Nhóm người dùng & vai trò

| Vai trò | Mô tả |
|---|---|
| Người học (User) | Luyện nói với AI Coach, học Scenario Lesson, tham gia Room; mọi trình độ A1–C1 |
| AI Coach / AI Roleplay | Điều phối hội thoại 1-1, đặt câu hỏi, phản hồi theo ngữ cảnh và level |
| Invisible AI Assistant | Hỗ trợ ngầm trong Room: phá vỡ im lặng, gợi ý riêng (Cue Card) |
| Speech-to-Text Service | Chuyển giọng nói thành văn bản, cung cấp độ tin cậy (confidence) |
| AI Analysis Service | Phân tích nội dung, tính điểm giao tiếp, sinh feedback |
| Backend | Quản lý profile, session, transcript, điểm số, XP/Level |
| Frontend | Giao diện voice chat, Live Script, báo cáo, gamification |

### 2.3. Mục tiêu kinh doanh

- Tăng thời lượng người học thực sự nói tiếng Anh, giảm áp lực tâm lý khi giao tiếp.
- Cá nhân hoá lộ trình luyện tập theo trình độ và sở thích thực tế.
- Biến mỗi phiên luyện tập thành dữ liệu đo lường được, giúp người dùng thấy tiến bộ rõ ràng.
- Tăng giữ chân người dùng qua gamification (XP, Streak, Level) và cộng đồng luyện nói (Room).

### 2.4. Giả định & phụ thuộc

- Hệ thống phụ thuộc vào nhà cung cấp STT bên thứ ba; độ chính xác pronunciation phụ thuộc vào confidence do STT trả về, không được suy diễn quá mức ý nghĩa của chỉ số này.
- Phụ thuộc vào AI Language Model cho việc sinh hội thoại, chấm điểm và feedback; cần có cơ chế retry/timeout khi dịch vụ chậm hoặc lỗi.
- Giả định thiết bị người dùng có microphone hoạt động và cấp quyền truy cập.
- Giả định có kết nối mạng ổn định trong lúc luyện tập; hệ thống cần xử lý mất kết nối tạm thời mà không làm mất dữ liệu.

---

## 3. Yêu cầu chức năng (Functional Requirements)

Yêu cầu được tổ chức theo Epic → User Story → Acceptance Criteria (Given/When/Then), giữ ID để trace ngược Traceability Matrix ở mục 8.

### F-01 — AI Coach & Live Script

**Mục tiêu nghiệp vụ:** Cho phép người học luyện nói tự do với AI, theo dõi nội dung hội thoại theo thời gian thực.

| ID | User Story | Acceptance Criteria (rút gọn) |
|---|---|---|
| US-01 | Là người học, tôi muốn bắt đầu một phiên AI Coach theo hồ sơ của mình, để được luyện nói phù hợp trình độ. | Given đã đăng nhập và có profile hợp lệ (level, interests, goal) — When chọn topic và bấm Start — Then hệ thống tạo session ACTIVE, AI mở đầu hội thoại phù hợp level và chủ đề. |
| US-02 | Là người học, tôi muốn thấy Live Script khi tôi và AI đang nói, để theo dõi nội dung mà không cần ghi nhớ. | Given đang nói — When STT trả partial/final transcript — Then Live Script hiển thị gần thời gian thực, phân biệt rõ User/AI, kèm timestamp; tự cuộn nhưng cho phép xem lại. |
| US-03 | Là người học, tôi muốn AI không ngắt lời khi tôi ngập ngừng, để tôi không bị áp lực khi tìm từ. | Given tôi im lặng ngắn hoặc dùng filler (um, uh) — When mic vẫn hoạt động — Then AI chờ, không tự ý kết thúc lượt nói; dữ liệu ngập ngừng được ghi nhận phục vụ tính Fluency/Response Speed. |
| US-04 | Là người học, tôi muốn nhận feedback sau khi kết thúc session, để biết điểm mạnh và cần cải thiện gì. | Given session kết thúc (chủ động hoặc do lỗi) — When đủ dữ liệu — Then hệ thống hiển thị Communication Scores, 2–3 Strengths, tối đa 3 Areas to Improve, và Next Practice cụ thể. Nếu dữ liệu không đủ, hiển thị trạng thái INSUFFICIENT_DATA thay vì bịa điểm. |

### F-02 — Scenario Lessons (Bài học tình huống) — theo phương pháp Chunking

**Mục tiêu nghiệp vụ:** Giúp người học luyện giao tiếp qua tình huống thực tế bằng cách ghi nhớ và phản xạ theo **cụm từ (chunk)** có nghĩa, thay vì học từ vựng/ngữ pháp rời rạc rồi tự ráp câu.

| ID | User Story | Acceptance Criteria (rút gọn) |
|---|---|---|
| US-05 | Là người học, tôi muốn chọn một tình huống theo nhóm chủ đề (Daily Life, Social Talk, Travel & Shopping, Workplace), để luyện đúng nhu cầu. | Given danh sách ≥ 20 tình huống MVP — When chọn 1 tình huống — Then hệ thống hiển thị bối cảnh, vai trò của user/AI và mục tiêu giao tiếp trước khi bắt đầu. |
| US-06 | Là người học, tôi muốn học các Language Chunk được nhóm theo từng bước giao tiếp của tình huống, để ghi nhớ theo khối cụm từ có nghĩa thay vì từng từ rời rạc. | Given đã xem bối cảnh — When vào bước học Chunk — Then hệ thống hiển thị 4–6 chunk, mỗi chunk gắn nhãn chức năng giao tiếp (Mở đầu/Đề nghị-Yêu cầu/Làm rõ/Đồng ý-Từ chối/Kết thúc), kèm nghĩa tiếng Việt, audio phát âm cụm từ, và 1 câu ví dụ đầy đủ dùng chunk đó. |
| US-06b | Là người học, tôi muốn luyện phản xạ với từng chunk (nghe & nhắc lại, hoặc chọn chunk phù hợp cho một câu hỏi ngắn) trước khi roleplay, để làm quen phản xạ trước khi dùng thật. | Given đã xem danh sách chunk — When thực hiện Chunk Drill — Then hệ thống lần lượt cho nghe từng chunk và ghi âm người dùng nhắc lại (không chấm điểm phát âm chính thức ở bước này); có thể bấm "Bỏ qua" để vào roleplay ngay; tiến độ drill được lưu để cá nhân hoá Chunk Bank (mục 3.1b). |
| US-07 | Là người học, tôi muốn roleplay bằng giọng nói với AI theo đúng tình huống và được khuyến khích dùng các chunk vừa học, để luyện phản xạ giao tiếp thật bằng cụm từ có sẵn thay vì dịch từng từ. | Given đang roleplay — When tôi nói — Then giọng nói được chuyển thành Live Transcript; AI duy trì ngữ cảnh tình huống, điều chỉnh từ vựng theo level, không ngắt lời, hướng hội thoại về mục tiêu, và nhận diện (không bắt buộc đúng 100% từ) khi tôi dùng một chunk mục tiêu hoặc biến thể gần đúng của nó. |
| US-08 | Là người học, tôi muốn biết mình đã hoàn thành nhiệm vụ tình huống hay chưa và đã dùng được những chunk nào, để biết mức độ đạt yêu cầu và chunk nào cần luyện thêm. | Given roleplay kết thúc — When hệ thống đối chiếu các yêu cầu của tình huống và danh sách chunk mục tiêu với transcript — Then trả về PASS/FAIL cho từng yêu cầu, danh sách "Chunk đã dùng tốt" và "Chunk nên luyện thêm", kèm Strengths, Improvements và Next Practice. Chunk "nên luyện thêm" được tự động thêm vào Chunk Bank cá nhân của người dùng. |

#### 3.1b. Phương pháp Chunking — nguyên tắc thiết kế nội dung

Chunking là phương pháp dạy ngôn ngữ theo các "khối cụm từ" (chunk) có nghĩa và dùng được ngay trong giao tiếp thực tế (VD: "Could you please...", "I'd like to...", "That sounds great, but..."), thay vì dạy từ vựng đơn lẻ rồi bắt người học tự ráp câu theo ngữ pháp. Áp dụng trong Scenario Lessons như sau:

- Mỗi tình huống có 4–6 chunk mục tiêu, gắn nhãn theo chức năng giao tiếp trong tình huống đó (Mở đầu, Đề nghị/Yêu cầu, Làm rõ, Đồng ý/Từ chối, Kết thúc) thay vì chỉ liệt kê "mẫu câu" chung chung.
- Chunk được trình bày như một khối cố định (kèm audio nói liền mạch cả cụm), giúp người học phản xạ nói ra cả cụm cùng lúc thay vì ghép từng từ.
- Bước Chunk Drill (US-06b) là bước làm quen nhẹ, không chấm điểm, giúp "nạp" chunk vào phản xạ trước khi roleplay — người học có thể bỏ qua nếu đã quen.
- Khi đánh giá roleplay (US-08), hệ thống ưu tiên ghi nhận việc **sử dụng đúng chức năng** của chunk (chấp nhận biến thể gần đúng) hơn là yêu cầu lặp lại chính xác từng chữ.
- Chunk chưa dùng tốt được đưa vào Chunk Bank cá nhân để hệ thống có thể gợi lại ở các tình huống sau — cơ chế nhắc lại theo lịch trình (spaced repetition) đầy đủ nằm ngoài phạm vi MVP, bản đầu chỉ lưu danh sách và hiển thị lại khi vào mục Chunk Bank.

### F-03 — Communication Scoring Engine

**Mục tiêu nghiệp vụ:** Định lượng năng lực giao tiếp của người học dựa trên dữ liệu các phiên luyện tập.

| ID | User Story | Acceptance Criteria (rút gọn) |
|---|---|---|
| US-09 | Là người học, tôi muốn thấy điểm số 5 kỹ năng giao tiếp và điểm tổng hợp sau mỗi phiên, để đo lường tiến bộ theo thời gian. | Given đủ dữ liệu hội thoại — When hệ thống chấm điểm — Then tính Fluency, Listening Comprehension, Vocabulary Context, Response Speed, Pronunciation Accuracy (thang 0–100) và Overall Communication Score theo công thức mục 3.1; nếu thiếu dữ liệu một chỉ số thì hiển thị N/A thay vì điểm mặc định. |

**3.1. Công thức tính điểm (tóm tắt)**

| Chỉ số | Công thức |
|---|---|
| Fluency Score | 0.50×Speech Continuity + 0.30×Pause Score + 0.20×Filler Word Score |
| Listening Comprehension | 0.70×Response Relevance + 0.30×Task Completion |
| Vocabulary Context | 0.60×Vocabulary Diversity + 0.40×Context Relevance |
| Response Speed Score | max(0, 100 − 10×T) , T = giây phản hồi (T≥10s → 0 điểm) |
| Pronunciation Accuracy | Average STT Confidence × 100 (chỉ mang tính tham khảo) |
| Overall Communication Score | 0.25×Fluency + 0.20×Listening + 0.20×Vocabulary + 0.15×Response Speed + 0.20×Pronunciation |

### F-04 — Gamification & Level System

**Mục tiêu nghiệp vụ:** Tạo động lực luyện tập đều đặn và phản ánh tiến bộ trình độ qua hệ thống Level.

| ID | User Story | Acceptance Criteria (rút gọn) |
|---|---|---|
| US-10 | Là người học, tôi muốn nhận XP khi hoàn thành hoạt động, để thấy nỗ lực của mình được ghi nhận. | Given hoàn thành Daily Mission (+50), Scenario Lesson (+100), AI Coach Session (+100), hoặc Room Session (+100) — When hoạt động được xác nhận hoàn tất — Then XP được cộng ngay vào Profile. |
| US-11 | Là người học, tôi muốn duy trì Streak khi luyện tập mỗi ngày, để tạo thói quen học đều. | Given hoàn thành hoạt động yêu cầu trong ngày — When qua ngày mới — Then Streak +1 và +20 XP; nếu bỏ lỡ một ngày, Streak reset về 0. |
| US-12 | Là người học, tôi muốn được thăng Level khi đạt đủ điều kiện, để thấy trình độ thực sự được công nhận. | Given Overall Score, số session, số scenario hoàn thành đạt ngưỡng của Level kế tiếp (bảng mục 3.2) — When hệ thống kiểm tra sau mỗi buổi học — Then Level được nâng và cập nhật Profile. Hệ thống không hạ Level chỉ vì một buổi học kết quả thấp; đánh giá dựa trên nhiều session gần đây. |

**3.2. Ngưỡng thăng Level**

| Level | Điểm tổng ≥ | Số session tối thiểu | Điều kiện bổ sung |
|---|---|---|---|
| A1 | 0 | 0 | Level ban đầu |
| A2 | 40 | 5 | ≥ 3 scenario hoàn thành |
| B1 | 55 | 10 | ≥ 5 scenario hoàn thành |
| B2 | 70 | 20 | Không kỹ năng chính nào < 60 |
| C1 | 85 | 30 | Không kỹ năng chính nào < 75 |

> XP dùng cho mục đích gamification/theo dõi tiến độ, không được dùng đơn độc để xác định trình độ tiếng Anh.

### F-05 — Community Voice Room & Invisible AI Assistant

**Mục tiêu nghiệp vụ:** Tạo môi trường luyện nói nhóm tự nhiên, có AI hỗ trợ ngầm khi cần.

| ID | User Story | Acceptance Criteria (rút gọn) |
|---|---|---|
| US-13 | Là người học, tôi muốn tham gia phòng thoại 3–5 người theo Level và chủ đề, để luyện giao tiếp nhóm thực tế. | Given đã chọn Room theo Level/chủ đề — When tham gia — Then Voice Chat và Live Transcript hoạt động thời gian thực, xác định người đang phát biểu. |
| US-14 | Là người học trong Room, tôi muốn AI chủ động gợi mở khi phòng im lặng, để cuộc trò chuyện không bị đứt quãng. | Given phòng không có hội thoại đáng kể ≥ 15 giây — When ngưỡng im lặng đạt — Then Invisible AI Assistant tạo một câu hỏi ngắn, liên quan chủ đề, không lặp câu hỏi gần đây, và không chiếm phần lớn thời gian hội thoại. |
| US-15 | Là người học đang bí ý hoặc bí từ, tôi muốn nhận gợi ý riêng, để tiếp tục nói mà không lộ trước cả phòng. | Given hệ thống phát hiện tôi gặp khó khăn diễn đạt — When kích hoạt hỗ trợ — Then Private Cue Card hiển thị 2–3 mẫu câu gợi ý chỉ cho riêng tôi, không tự tạo toàn bộ câu trả lời thay tôi, cá nhân hoá theo Level. |

---

## 4. Yêu cầu phi chức năng (Non-Functional Requirements)

| Nhóm | Yêu cầu | Cách kiểm tra |
|---|---|---|
| Hiệu năng | Live Script/Live Transcript hiển thị gần thời gian thực; độ trễ partial transcript thấp, không gây cảm giác treo UI. | Đo latency từ audio input đến hiển thị transcript trên môi trường thực tế. |
| Hiệu năng | Phát hiện phòng im lặng kích hoạt đúng ngưỡng ~15 giây. | Test timer với các kịch bản im lặng 10s/15s/20s. |
| Bảo mật | Audio/transcript chỉ thu khi session ACTIVE; bảo vệ dữ liệu bằng authentication/authorization. | Kiểm tra access control và log truy cập dữ liệu nhạy cảm. |
| Bảo mật & Riêng tư | Private Cue Card không hiển thị cho thành viên khác trong Room. | Test đa người dùng trong cùng Room. |
| Độ tin cậy | Mất mạng/mic tạm thời không làm mất toàn bộ session hoặc transcript đã lưu. | Test ngắt mạng/mic giữa phiên, kiểm tra retry & đồng bộ. |
| Độ tin cậy | Lỗi AI/STT tạm thời có cơ chế retry; không tạo duplicate response/transcript khi retry. | Test idempotency với `messageId`/`requestId`. |
| Khả năng sử dụng | Luồng Scenario Lesson và feedback dễ hiểu với người mới học; AI Assistant không gây áp lực. | User testing với người dùng thực ở nhiều level. |
| Khả năng mở rộng | Hệ thống chịu tải tăng số session/Room đồng thời khi số người dùng tăng. | Load test theo kịch bản tăng trưởng người dùng. |
| Khả năng tương thích | Hỗ trợ trình duyệt/thiết bị phổ biến, quyền truy cập microphone theo từng nền tảng. | Test trên danh sách thiết bị/OS mục tiêu. |
| Accessibility | Nút mic/End Session dễ nhìn, font Live Script đủ lớn, không chỉ dùng màu để thể hiện trạng thái, có text fallback khi voice lỗi. | Review UI theo checklist accessibility cơ bản. |

---

## 5. Yêu cầu giao diện (Interface Requirements)

### 5.1. Giao diện người dùng (UI) — các trạng thái chính

Frontend cần thiết kế tối thiểu các UX state: Ready to Start, Requesting Microphone, Connecting, AI Speaking, User Speaking, Processing Transcript, Reconnecting, Microphone Error, AI Error, Ending Session, Generating Feedback, Feedback Ready, Insufficient Data.

### 5.2. Giao diện API (đề xuất cho AI Coach — MVP)

| Endpoint | Mục đích |
|---|---|
| `POST /api/coach/sessions` | Tạo một CoachSession mới theo topic/goal |
| `POST /api/coach/sessions/{id}/transcript` | Lưu/finalize một TranscriptSegment |
| `POST /api/coach/sessions/{id}/end` | Kết thúc session, chuyển trạng thái và kích hoạt sinh feedback |
| `GET /api/coach/sessions/{id}/feedback` | Lấy Post-Session Feedback (scores, strengths, improvements, next practice) |

Các module Scenario Lessons, Gamification và Room dùng cùng nguyên tắc REST tương tự — xem chi tiết đầy đủ trong `docs/API_SPEC_PART2.md`.

### 5.3. Tích hợp bên ngoài

- Speech-to-Text (STT) Service — chuyển giọng nói → văn bản, trả kèm confidence score.
- AI Language Model Service — sinh hội thoại, phân tích, chấm điểm, sinh feedback.
- Hạ tầng Voice Chat thời gian thực — phục vụ Community Voice Room.

---

## 6. Yêu cầu dữ liệu (Data Requirements)

| Thực thể | Trường chính | Mô tả |
|---|---|---|
| UserProfile | userId, level (A1–C1), interests[], communicationGoal, weakPoints[], preferredTopics[] | Hồ sơ cá nhân hoá dùng để điều chỉnh nội dung AI |
| CoachSession | sessionId, userId, topic, level, startedAt, endedAt, status, durationSeconds, spokenSeconds | Một phiên luyện nói AI Coach |
| TranscriptSegment | segmentId, sessionId, speaker(USER/AI), text, startTime, endTime, confidence, isFinal | Một đoạn hội thoại trong Live Script |
| SessionFeedback | sessionId, fluencyScore, listeningScore, vocabularyScore, responseSpeedScore, pronunciationScore, strengths[], improvements[], nextPractice[] | Kết quả chấm điểm và gợi ý sau session |
| ScenarioLesson | scenarioId, category, title, context, roles, goal, chunks[] (functionTag, text, meaning, audio, example) | Định nghĩa một tình huống roleplay, nội dung dạy theo phương pháp Chunking |
| ChunkBank (per user) | userId, chunkId, status (NEEDS_PRACTICE/MASTERED), lastSeenAt | Danh sách cụm từ cá nhân cần luyện thêm, tổng hợp từ các session đã làm |
| GamificationProfile | userId, xp, streak, level, dailyMissionsStatus | Trạng thái XP/Streak/Level của người dùng |
| VoiceRoom | roomId, level, topic, participants[], transcriptSegments[] | Phòng thoại cộng đồng và dữ liệu liên quan |

> Dữ liệu giọng nói và transcript là dữ liệu người dùng nhạy cảm: chỉ lưu trữ/khai thác theo chính sách bảo mật của hệ thống, không thu âm ngoài phạm vi session hợp lệ. Chi tiết đầy đủ từng cột PostgreSQL & Redis: xem `DATA_DICTIONARY.md`.

---

## 7. Các tình huống ngoại lệ chính (Exception Handling)

| Tình huống | Cách xử lý mong đợi |
|---|---|
| Từ chối / mất quyền microphone | Không chuyển session sang ACTIVE; hiển thị hướng dẫn cấp quyền; cho phép thử lại; không tạo feedback giả. |
| Mất mạng khi đang nói | Giữ buffer transcript đã có; hiển thị trạng thái Reconnecting, retry theo backoff; đồng bộ dữ liệu khi kết nối lại. |
| STT timeout / confidence thấp | Retry request, không tạo transcript trùng lặp; không kết luận phát âm sai chỉ vì confidence thấp; AI có thể hỏi lại. |
| AI response timeout | Retry; nếu thất bại, thông báo lỗi thân thiện, giữ nguyên lượt nói trước đó của user. |
| Session quá ngắn / thiếu dữ liệu | Không tạo điểm số đầy đủ; đánh dấu feedback là INSUFFICIENT_DATA; gợi ý luyện phiên khác. |
| Người dùng nói lạc chủ đề | AI không từ chối ngay mà khéo léo dẫn hội thoại quay lại chủ đề chính. |
| Lưu kết quả session thất bại ở backend | Giữ báo cáo tạm ở client nếu có thể; cho retry; không báo thành công khi server chưa xác nhận; tránh tạo feedback trùng lặp. |
| Ứng dụng chuyển nền (background) | Tạm dừng session nếu nền tảng không hỗ trợ ghi âm nền; không âm thầm ghi âm ngoài phiên hợp lệ; cho phép resume khi quay lại. |

---

## 8. Ma trận truy vết (Traceability Matrix)

| Feature ID | Tên Feature | User Story | Nguồn chi tiết |
|---|---|---|---|
| F-01 | AI Coach & Live Script | US-01 → US-04 | SRS Part 1, mục 7–15 |
| F-02 | Scenario Lessons (Chunking) | US-05, US-06, US-06b, US-07, US-08 | SRS Part 2, mục 1 (cập nhật: phương pháp Chunking) |
| F-03 | Communication Scoring Engine | US-09 | SRS Part 1 mục 14 & Part 2 mục 2 |
| F-04 | Gamification & Level System | US-10 → US-12 | SRS Part 2, mục 3 |
| F-05 | Community Voice Room & Invisible AI Assistant | US-13 → US-15 | SRS Part 2, mục 4 |

---

## 9. Phụ lục (Appendices)

### 9.1. Luồng nghiệp vụ tổng quát

```
Đăng ký/Đăng nhập → Chọn Level & chủ đề quan tâm
   ├─ Nhánh AI Coach: Chọn topic → Start Session → Voice Conversation ⇄ Live Script → End Session → Post-Session Feedback
   ├─ Nhánh Scenario: Chọn tình huống → Xem bối cảnh → Học Chunk theo chức năng → Chunk Drill (tuỳ chọn) → AI Roleplay → Đánh giá nhiệm vụ + Chunk đã dùng → Cập nhật Chunk Bank
   └─ Nhánh Room: Chọn Room → Voice Chat nhóm → Theo dõi im lặng → AI Prompt / Private Cue Card
→ Cộng XP/Streak → Kiểm tra điều kiện thăng Level → Cập nhật Profile
```

### 9.2. Definition of Done — MVP (tóm tắt)

- Người dùng thực hiện được trọn vẹn 3 luồng: AI Coach, Scenario Lesson, Community Room.
- Live Script/Live Transcript hiển thị đúng, phân biệt người nói, có timestamp.
- Communication Scoring Engine tính đủ 5 chỉ số + điểm tổng hợp, không bịa điểm khi thiếu dữ liệu.
- Scenario Lessons dạy theo phương pháp Chunking: hiển thị đúng chunk theo chức năng, có Chunk Drill, và kết quả đánh giá phân biệt được chunk đã dùng tốt / cần luyện thêm.
- XP, Streak, Level hoạt động đúng quy tắc đã định nghĩa (mục 3.2).
- Invisible AI Assistant phát hiện im lặng ≥15s và Private Cue Card hoạt động đúng, riêng tư.
- Tối thiểu các nhóm ngoại lệ ở mục 7 được xử lý và có test tương ứng.
- Microphone không tiếp tục thu âm sau khi session kết thúc.
