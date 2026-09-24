# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)
## TalkWithMe — Ứng dụng luyện nói tiếng Anh cùng AI

*(Soạn theo khung Mẫu Tài liệu Đặc tả Yêu cầu Phần mềm – Agile/Scrum: SRS truyền thống kết hợp Epic → User Story → Acceptance Criteria)*

---

## 0. Thông tin tài liệu (Document Control)

| Mục | Nội dung |
|---|---|
| Tên tài liệu | Software Requirements Specification (SRS) – TalkWithMe |
| Phiên bản | v1.0 |
| Ngày | __________ |
| Tác giả / chủ sở hữu | BA / Product Owner |
| Người phê duyệt | __________ |
| Lịch sử phiên bản | v1.0 – __________ – Soạn thảo SRS đầy đủ chức năng – __________ |

---

## 1. Giới thiệu (Introduction)

### 1.1. Mục đích (Purpose)

Tài liệu mô tả yêu cầu chức năng và phi chức năng của ứng dụng **TalkWithMe** — nền tảng luyện nói tiếng Anh với AI theo triết lý **"Communication-First"**: ưu tiên tăng thời lượng người học thực sự nói tiếng Anh và xây dựng sự tự tin, thay vì dạy ngữ pháp rời rạc hay ngắt lời sửa lỗi liên tục. Tài liệu này là cơ sở thống nhất giữa Product Owner, Dev (Frontend/Backend/AI), QA/Test và các stakeholder về phạm vi, hành vi hệ thống và căn cứ để phát triển, kiểm thử cho bản MVP.

### 1.2. Phạm vi (Scope)

**Trong phạm vi MVP (In-Scope):**

- **Placement Test (Bài test xác định Level)**: bài test ngắn bằng giọng nói ngay khi onboarding để tự động xác định Level khởi điểm (A1–C1) của người dùng, thay vì để người dùng tự chọn.
- **AI Coach**: hội thoại giọng nói 1-1 với AI, cá nhân hoá theo hồ sơ (level A1–C1, sở thích, mục tiêu giao tiếp, điểm yếu đã ghi nhận).
- **Live Script**: hiển thị transcript thời gian thực (partial/final), phân biệt người nói, kèm timestamp.
- **Post-Session Feedback**: chấm điểm giao tiếp và gợi ý bài luyện tập tiếp theo sau mỗi phiên.
- **Scenario-based Lessons**: tối thiểu 20 tình huống roleplay thuộc 4 nhóm chủ đề (Daily Life, Social Talk, Travel & Shopping, Workplace), dạy theo **phương pháp Chunking** (cụm từ giao tiếp theo chức năng), có Chunk Drill và đánh giá hoàn thành nhiệm vụ tình huống.
- **Communication Skills Tracking / Scoring Engine**: tính 5 chỉ số (Fluency, Listening Comprehension, Vocabulary Context, Response Speed, Pronunciation Accuracy) và điểm tổng hợp theo công thức mục 3.3.
- **Gamification & Missions**: XP, Streak, Daily Missions, Quick Response Challenge 5s, hệ thống Level A1–C1 (5 Ranks).
- **Real User Voice Chatrooms**: phòng thoại 3–5 người, lọc theo Level/chủ đề, Live Script đa người dùng, Invisible AI Assistant hỗ trợ khi phòng im lặng và Private Cue Card gợi ý riêng từng người.
- Xử lý các tình huống ngoại lệ phổ biến: mất mic, mất mạng, STT/AI timeout, dữ liệu không đủ để chấm điểm (mục 8.2).

**Ngoài phạm vi MVP (Out-of-Scope):**

- Phân tích cảm xúc/độ tự tin qua ngữ điệu giọng nói (Tone analysis) — dự kiến Phase 3.
- Bộ nhớ hội thoại dài hạn (Long-term memory) qua nhiều session — dự kiến Phase 2.
- Phát âm chuẩn theo vùng (US/UK/AU) — dự kiến Phase 2.
- Video hoặc Avatar 3D, Phòng tranh luận có trọng tài AI — dự kiến Phase 3.
- AI tự sinh bài học tức thời từ tin tức thời sự (Real-time News Lessons) — dự kiến Phase 3.
- Trình tạo bài học tự động cho Admin, thư viện tình huống do cộng đồng đóng góp — dự kiến Phase 2.
- Thuật toán nhắc lại theo lịch trình (spaced repetition) đầy đủ cho Chunk Bank — MVP chỉ lưu danh sách chunk cần luyện thêm.
- Thử thách đấu trường giao tiếp 1v1 (Communication Arena), Leaderboard hàng tuần — dự kiến Phase 2/3.

### 1.3. Đối tượng sử dụng tài liệu

Product Owner, Business Analyst, Developer (Frontend/Backend/AI), Tester/QA, và các stakeholder liên quan đến việc phê duyệt phạm vi sản phẩm.

### 1.4. Định nghĩa, từ viết tắt (Definitions & Acronyms)

| Thuật ngữ | Giải thích |
|---|---|
| STT | Speech-to-Text — dịch vụ chuyển giọng nói thành văn bản |
| ASR | Automatic Speech Recognition — công nghệ nhận dạng giọng nói tự động, nền tảng của STT |
| Live Script | Transcript hội thoại hiển thị theo thời gian thực |
| AI Coach | Tính năng luyện nói 1-1 với AI |
| Scenario Lesson | Bài học roleplay theo tình huống thực tế |
| Chunk | Cụm từ giao tiếp cố định, có nghĩa, dùng được ngay trong hội thoại (phương pháp Chunking) |
| Chunk Drill | Bước luyện phản xạ nghe & nhắc lại chunk trước khi roleplay |
| Chunk Bank | Danh sách chunk cá nhân người dùng cần luyện thêm hoặc đã thành thạo |
| XP | Điểm kinh nghiệm dùng cho gamification |
| Level | Trình độ tiếng Anh theo khung CEFR: A1 → A2 → B1 → B2 → C1 |
| CEFR | Common European Framework of Reference for Languages — khung tham chiếu năng lực ngôn ngữ châu Âu |
| MTLD | Measure of Textual Lexical Diversity — chỉ số đo độ đa dạng từ vựng không phụ thuộc độ dài văn bản |
| GOP | Goodness of Pronunciation — chỉ số chấm phát âm dựa trên xác suất hậu nghiệm (posterior probability) của ASR |
| Invisible AI Assistant | AI hỗ trợ ngầm trong Community Voice Room |
| Cue Card | Thẻ gợi ý câu nói, chỉ hiển thị riêng cho một người dùng |
| EC | Edge Case — tình huống ngoại lệ cần xử lý |
| AC | Acceptance Criteria — tiêu chí chấp nhận |

---

## 2. Mô tả tổng quan (Overall Description)

### 2.1. Bối cảnh sản phẩm (Product Perspective)

TalkWithMe là ứng dụng mobile/web độc lập, tích hợp các dịch vụ bên thứ ba: **Speech-to-Text** (chuyển giọng nói → văn bản kèm confidence score), **AI Language Model** (sinh hội thoại, phân tích, chấm điểm, sinh feedback), và **hạ tầng Voice Chat thời gian thực** cho Community Voice Room. Backend quản lý profile người dùng, session, transcript, kết quả chấm điểm và tiến trình gamification.

### 2.2. Nhóm người dùng & vai trò (User Classes & Characteristics)

| Vai trò | Mô tả |
|---|---|
| Người học (User) | Luyện nói với AI Coach, học Scenario Lesson, tham gia Room; mọi trình độ A1–C1 |
| AI Coach / AI Roleplay | Điều phối hội thoại 1-1, đặt câu hỏi, phản hồi theo ngữ cảnh và level, chủ động điều hướng để luyện điểm yếu |
| Invisible AI Assistant | Hỗ trợ ngầm trong Room: phá vỡ im lặng, gợi ý riêng (Cue Card) |
| Speech-to-Text Service | Chuyển giọng nói thành văn bản, cung cấp độ tin cậy (confidence) |
| AI Analysis Service | Phân tích nội dung, tính điểm giao tiếp, sinh feedback |
| Backend | Quản lý profile, session, transcript, điểm số, XP/Level |
| Frontend | Giao diện voice chat, Live Script, báo cáo, gamification |

### 2.3. Mục tiêu kinh doanh (Business Objectives)

- Tăng thời lượng người học thực sự nói tiếng Anh, giảm áp lực tâm lý khi giao tiếp.
- Cá nhân hoá lộ trình luyện tập theo trình độ và sở thích thực tế.
- Biến mỗi phiên luyện tập thành dữ liệu đo lường được, dựa trên các chỉ số có cơ sở khoa học (không "bịa" điểm), giúp người dùng thấy tiến bộ rõ ràng và đáng tin cậy.
- Tăng giữ chân người dùng qua gamification (XP, Streak, Level) và cộng đồng luyện nói (Room).

### 2.4. Giả định và phụ thuộc (Assumptions & Dependencies)

- Hệ thống phụ thuộc vào nhà cung cấp STT bên thứ ba; độ chính xác của Pronunciation Accuracy phụ thuộc vào confidence do STT trả về — đây là chỉ số **mang tính tham khảo**, không phải điểm phát âm chuẩn xác tuyệt đối (xem giới hạn tại mục 3.3).
- Phụ thuộc vào AI Language Model cho việc sinh hội thoại, chấm điểm và feedback; cần có cơ chế retry/timeout khi dịch vụ chậm hoặc lỗi.
- Giả định thiết bị người dùng có microphone hoạt động và cấp quyền truy cập.
- Giả định có kết nối mạng ổn định trong lúc luyện tập; hệ thống cần xử lý mất kết nối tạm thời mà không làm mất dữ liệu.
- Các công thức chấm điểm ở mục 3.3 dựa trên các nghiên cứu học thuật hiện có về đo lường fluency, vocabulary, pronunciation và response time trong đánh giá năng lực nói ngôn ngữ thứ hai (L2 speaking assessment); các hệ số cụ thể (trọng số 0.x) là giả định thiết kế ban đầu của sản phẩm, cần được **hiệu chỉnh bằng dữ liệu thực tế** sau khi thu thập đủ mẫu người dùng (xem Ghi chú tại mục 3.3).

---

## 3. Yêu cầu chức năng (Functional Requirements)

Yêu cầu được tổ chức theo **Epic → User Story → Acceptance Criteria** (Given/When/Then), giữ ID để trace ngược Traceability Matrix ở mục 7.

### 3.1. Cấu trúc mỗi nhóm chức năng (Feature/Epic)

Mỗi Feature/Epic gồm: **Feature ID**, **Tên feature**, **Mô tả ngắn**, **Mục tiêu nghiệp vụ**, **Danh sách User Story liên quan**.

### 3.2. Mẫu một User Story trong SRS

Mỗi User Story gồm: **Story ID**, **User story** ("Là một [vai trò], tôi muốn [hành động], để [lợi ích]"), **Acceptance Criteria** dạng Given/When/Then, và **Traceability** về Feature ID.

---

### F-00 — Onboarding & Placement Test (Bài test xác định Level)

- **Mô tả ngắn:** Bước đầu tiên khi người dùng mới vào app — làm một bài test ngắn bằng giọng nói để hệ thống tự xác định Level, thay vì để người dùng tự chọn (tránh chọn sai, quá dễ hoặc quá khó).
- **Mục tiêu nghiệp vụ:** Cá nhân hoá đúng ngay từ đầu, giúp AI Coach và Scenario Lesson gợi ý nội dung phù hợp trình độ thật ngay từ session đầu tiên.
- **User stories liên quan:** US-00

| ID | User Story | Acceptance Criteria (rút gọn) |
|---|---|---|
| US-00 | Là người dùng mới, tôi muốn làm một bài test ngắn khi mới vào app, để hệ thống xác định đúng Level của tôi thay vì tôi phải tự đoán. | Given người dùng vừa đăng ký, chưa có Level — When bắt đầu Placement Test — Then hệ thống đưa ra một chuỗi câu hỏi/tình huống ngắn bằng giọng nói (nghe – lặp lại/trả lời), thời lượng ngắn gọn; sau khi hoàn thành, hệ thống phân tích phản hồi (Fluency, Vocabulary, Response Speed cơ bản) và gán Level khởi điểm (A1–C1) cho Profile. Người dùng có thể chọn "Bỏ qua, tôi tự chọn Level" nếu không muốn làm test. Nếu dữ liệu thu được không đủ để xác định Level, hệ thống gán tạm A1 và ghi chú "cần đánh giá lại" thay vì đoán bừa. |

---

### F-01 — AI Coach & Live Script

- **Mô tả ngắn:** Luyện nói tự do 1-1 với AI, theo dõi nội dung hội thoại theo thời gian thực.
- **Mục tiêu nghiệp vụ:** Cho phép người học luyện nói tự nhiên với AI, không bị ngắt lời, được cá nhân hoá theo hồ sơ.
- **User stories liên quan:** US-01 → US-04

| ID | User Story | Acceptance Criteria (rút gọn) |
|---|---|---|
| US-01 | Là người học, tôi muốn bắt đầu một phiên AI Coach theo hồ sơ của mình, để được luyện nói phù hợp trình độ. | Given đã đăng nhập và có profile hợp lệ (level, interests, goal) — When chọn topic và bấm Start — Then hệ thống tạo session ACTIVE, AI mở đầu hội thoại phù hợp level và chủ đề. |
| US-02 | Là người học, tôi muốn thấy Live Script khi tôi và AI đang nói, để theo dõi nội dung mà không cần ghi nhớ. | Given đang nói — When STT trả partial/final transcript — Then Live Script hiển thị gần thời gian thực, phân biệt rõ User/AI, kèm timestamp; tự cuộn nhưng cho phép xem lại. |
| US-03 | Là người học, tôi muốn AI không ngắt lời khi tôi ngập ngừng, để tôi không bị áp lực khi tìm từ. | Given tôi im lặng ngắn hoặc dùng filler (um, uh) — When mic vẫn hoạt động — Then AI chờ, không tự ý kết thúc lượt nói; dữ liệu ngập ngừng được ghi nhận phục vụ tính Fluency/Response Speed (xem 3.3). |
| US-04 | Là người học, tôi muốn nhận feedback sau khi kết thúc session, để biết điểm mạnh và cần cải thiện gì. | Given session kết thúc (chủ động hoặc do lỗi) — When đủ dữ liệu — Then hệ thống hiển thị Communication Scores, 2–3 Strengths, tối đa 3 Areas to Improve, và Next Practice cụ thể. Nếu thiếu dữ liệu, hiển thị INSUFFICIENT_DATA thay vì bịa điểm. |

---

### F-02 — Scenario-based Lessons (Bài học Tình huống) — theo phương pháp Chunking

- **Mô tả ngắn:** Thực hành tình huống thực tế dùng được ngay, dạy theo cụm từ chức năng thay vì ngữ pháp rời rạc.
- **Mục tiêu nghiệp vụ:** Giúp người học phản xạ giao tiếp qua tình huống, ghi nhớ theo khối cụm từ (chunk) có nghĩa.
- **Danh mục tình huống (Scenario Library):** Daily Life, Social Talk, Travel & Shopping, Workplace.
- **Cấu trúc bài học:** Situation Introduction → Useful Expressions (chunk) → Interactive Roleplay với AI → Mission Evaluation.
- **User stories liên quan:** US-05, US-06, US-06b, US-07, US-08

| ID | User Story | Acceptance Criteria (rút gọn) |
|---|---|---|
| US-05 | Là người học, tôi muốn chọn một tình huống theo nhóm chủ đề, để luyện đúng nhu cầu. | Given danh sách ≥ 20 tình huống MVP thuộc 4 nhóm chủ đề — When chọn 1 tình huống — Then hệ thống hiển thị bối cảnh, vai trò của user/AI và mục tiêu giao tiếp trước khi bắt đầu. |
| US-06 | Là người học, tôi muốn học các Chunk theo từng bước giao tiếp của tình huống, để ghi nhớ theo khối cụm từ có nghĩa. | Given đã xem bối cảnh — When vào bước học Chunk — Then hệ thống hiển thị 4–6 chunk, mỗi chunk gắn nhãn chức năng giao tiếp (Mở đầu/Đề nghị-Yêu cầu/Làm rõ/Đồng ý-Từ chối/Kết thúc), kèm nghĩa tiếng Việt, audio phát âm cụm từ, và 1 câu ví dụ đầy đủ. |
| US-06b | Là người học, tôi muốn luyện phản xạ với từng chunk trước khi roleplay, để làm quen phản xạ trước khi dùng thật. | Given đã xem danh sách chunk — When thực hiện Chunk Drill — Then hệ thống lần lượt cho nghe từng chunk và ghi âm người dùng nhắc lại (không chấm điểm chính thức ở bước này); có thể bấm "Bỏ qua"; tiến độ drill được lưu để cá nhân hoá Chunk Bank. |
| US-07 | Là người học, tôi muốn roleplay bằng giọng nói với AI theo đúng tình huống, để luyện phản xạ giao tiếp bằng cụm từ có sẵn. | Given đang roleplay — When tôi nói — Then giọng nói được chuyển thành Live Transcript; AI duy trì ngữ cảnh, điều chỉnh từ vựng theo level, không ngắt lời, hướng hội thoại về mục tiêu, và nhận diện khi tôi dùng một chunk mục tiêu hoặc biến thể gần đúng. |
| US-08 | Là người học, tôi muốn biết mình đã hoàn thành nhiệm vụ tình huống hay chưa và đã dùng được những chunk nào. | Given roleplay kết thúc — When hệ thống đối chiếu yêu cầu tình huống và chunk mục tiêu với transcript — Then trả về PASS/FAIL cho từng yêu cầu, danh sách "Chunk đã dùng tốt"/"Chunk nên luyện thêm", kèm Strengths, Improvements, Next Practice. Chunk "nên luyện thêm" được thêm vào Chunk Bank cá nhân. |

**Ghi chú thiết kế nội dung — Phương pháp Chunking:** Mỗi tình huống có 4–6 chunk mục tiêu gắn nhãn theo chức năng giao tiếp; chunk trình bày như một khối cố định kèm audio nói liền mạch cả cụm; khi đánh giá roleplay, hệ thống ưu tiên ghi nhận **việc sử dụng đúng chức năng** của chunk (chấp nhận biến thể gần đúng) hơn là yêu cầu lặp lại chính xác từng chữ; chunk chưa dùng tốt được đưa vào Chunk Bank cá nhân (cơ chế spaced repetition đầy đủ nằm ngoài phạm vi MVP).

---

### F-03 — Communication Scoring Engine (Báo cáo Năng lực Giao tiếp)

- **Mô tả ngắn:** Định lượng năng lực giao tiếp của người học dựa trên dữ liệu các phiên luyện tập.
- **Mục tiêu nghiệp vụ:** Cho người học thấy tiến bộ theo thời gian bằng các chỉ số đo được, có cơ sở khoa học, không suy diễn quá mức những gì công nghệ hiện tại đo được chính xác.
- **User stories liên quan:** US-09

| ID | User Story | Acceptance Criteria (rút gọn) |
|---|---|---|
| US-09 | Là người học, tôi muốn thấy điểm số 5 kỹ năng giao tiếp và điểm tổng hợp sau mỗi phiên, để đo lường tiến bộ theo thời gian. | Given đủ dữ liệu hội thoại — When hệ thống chấm điểm — Then tính Fluency, Listening Comprehension, Vocabulary Context, Response Speed, Pronunciation Accuracy (thang 0–100) và Overall Communication Score theo công thức mục 3.3; nếu thiếu dữ liệu một chỉ số thì hiển thị N/A thay vì điểm mặc định. |

#### 3.3. Công thức tính điểm

> **Lưu ý về cách đọc bảng này:** Các bài báo tham khảo (mục Ghi chú tham khảo bên dưới) đều dùng mô hình học sâu/LLM — trọng số của họ do máy **tự học** từ dữ liệu, không phải một công thức tuyến tính có hệ số cố định như TalkWithMe. Vì vậy, không thể "chép nguyên" hệ số từ các bài báo này. Bảng dưới đây là công thức MVP đã được **điều chỉnh theo hướng định tính** mà các bài báo chỉ ra (chỉ số nào quan trọng hơn, nên cấu trúc lại phần nào) — vẫn cần hiệu chỉnh lại bằng dữ liệu thật trước khi dùng cho quyết định quan trọng.

| Chỉ số | Công thức | Ghi chú |
|---|---|---|
| **Fluency Score** | 0.45×Speech Continuity + 0.35×Pause Score + 0.20×Filler Word Score | Tăng nhẹ trọng số Pause Score (từ 0.30 lên 0.35) so với bản gốc: nhiều nghiên cứu về utterance fluency (bao gồm hướng tiếp cận của Liu et al. 2023) cho thấy tốc độ nói (continuity) và hành vi ngừng (pause) gộp lại giải thích phần lớn khác biệt về fluency, trong khi filler word là tín hiệu yếu và nhiễu hơn — nên giữ trọng số filler thấp nhất. |
| **Listening Comprehension** | 0.70×Response Relevance + 0.30×Task Completion | Giữ nguyên tỉ lệ: cách tiếp cận chấm điểm phản hồi hội thoại của Hayashi et al. (2024) cũng đặt trọng tâm vào mức độ liên quan/nội dung của câu trả lời hơn là chỉ xét đã "hoàn thành nhiệm vụ" hay chưa. |
| **Vocabulary Context** | 0.40×Vocabulary Diversity + 0.60×Context Relevance | **Đảo tỉ lệ so với bản gốc** (trước là 0.60/0.40): theo hướng nghiên cứu của Bannò et al. (2025), đánh giá từ vựng **theo đúng ngữ cảnh sử dụng** (in-context word-level assessment) phản ánh năng lực thật tốt hơn là chỉ đếm số từ khác nhau (raw diversity) — một người dùng nhiều từ "hiếm" nhưng dùng sai ngữ cảnh không nên được điểm cao hơn người dùng từ đơn giản nhưng đúng chỗ. |
| **Response Speed Score** | 100, nếu T ≤ 2s (grace period)<br>max(0, 100 − 12×(T − 2)), nếu T > 2s (T ≥ ~10.3s → 0 điểm) | **Thêm "grace period" 2 giây** so với bản gốc (bản gốc trừ điểm ngay từ giây đầu tiên): lấy cảm hứng từ Sakuma et al. (2023) và các nghiên cứu về độ trễ hội thoại tự nhiên — người bản xứ cũng cần một khoảng trễ nhất định trước khi phản hồi, và người học L2 cần thời gian xử lý ngôn ngữ nhiều hơn; phạt ngay từ mili-giây đầu tiên là không công bằng và không phản ánh đúng hội thoại tự nhiên. |
| **Pronunciation Accuracy** | MVP: Average STT Confidence × 100 (chỉ mang tính tham khảo)<br>Định hướng nâng cấp: dùng model chấm phát âm chuyên biệt (xem Ghi chú tham khảo bên dưới) | MVP dựa trên confidence do STT trả về — **chỉ mang tính tham khảo**, không dùng làm căn cứ duy nhất để kết luận phát âm sai. Cai et al. (2025) cho thấy model tốt nên kết hợp thêm tín hiệu liên quan đến fluency chứ không chỉ dùng riêng độ tin cậy âm vị — đây là hướng nâng cấp cho Phase 2. |
| **Overall Communication Score** | 0.25×Fluency + 0.20×Listening + 0.20×Vocabulary + 0.15×Response Speed + 0.20×Pronunciation | Giữ nguyên trọng số tổng hợp (chưa có bài báo nào trong danh sách tham khảo trực tiếp bàn về cách gộp 5 chỉ số này thành 1 điểm) — trọng số này vẫn là giả định thiết kế MVP, cần hiệu chỉnh bằng dữ liệu người dùng thật và/hoặc đối chiếu với đánh giá của giáo viên trước khi dùng cho quyết định quan trọng (VD: thăng Level). |

> **Nguyên tắc bắt buộc:** Không tạo điểm số giả khi thiếu dữ liệu — hiển thị `N/A` / `INSUFFICIENT_DATA` cho chỉ số/tổng điểm tương ứng (đã nêu tại US-04, US-09, và mục 8.2).

**Ghi chú tham khảo — Model chấm điểm cho từng chỉ số:**

> **Fluency Score:** Liu, J., Wumaier, A., Fan, C., & Guo, S. (2023). *Automatic Fluency Assessment Method for Spontaneous Speech without Reference Text.* Electronics, 12(8), 1775. https://doi.org/10.3390/electronics12081775 — Model chấm fluency tự động cho lời nói tự phát mà **không cần văn bản tham chiếu** trước (đúng bối cảnh AI Coach: AI không biết trước user sẽ nói gì). Đây là model nên tham khảo khi nâng cấp Fluency Score từ công thức tuyến tính đơn giản của MVP sang một model học sâu (deep learning).

> **Listening Comprehension:** Hayashi, Y., Kondo, Y., & Ishii, Y. (2024). *Automated speech scoring of dialogue response by Japanese learners of English as a foreign language.* Innovation in Language Learning and Teaching, 18(1), 32–46. https://doi.org/10.1080/17501229.2023.2217181 — Model chấm điểm **phản hồi trong hội thoại** của người học, sát với ý tưởng "Response Relevance" trong công thức Listening Comprehension.

> **Vocabulary Context:** Bannò, S., Knill, K. M., & Gales, M. J. F. (2025). *Exploiting the English Vocabulary Profile for L2 word-level vocabulary assessment with LLMs.* Proceedings of the 20th Workshop on Innovative Use of NLP for Building Educational Applications (BEA 2025), University of Cambridge. https://arxiv.org/html/2506.02758v1 — Model dùng LLM kết hợp với English Vocabulary Profile (EVP) để đánh giá mức độ phù hợp của từ vựng theo đúng ngữ cảnh câu nói — khớp với cả 2 phần "Vocabulary Diversity" và "Context Relevance" trong công thức.

> **Response Speed Score:** Sakuma, J., Fujie, S., Zhao, H., & Kobayashi, T. (2023). *Improving the response timing estimation for spoken dialogue systems by reducing the effect of speech recognition delay.* Interspeech 2023. https://www.isca-archive.org/interspeech_2023/sakuma23_interspeech.pdf — **Lưu ý:** đây là model ước lượng thời điểm phản hồi hợp lý trong hệ thống hội thoại nói chung (turn-taking timing), không phải bài chuyên biệt về đánh giá tốc độ phản hồi của người học L2 — dùng làm tham khảo kỹ thuật (cách đo/ước lượng độ trễ chính xác hơn), chưa phải một model "chấm điểm" Response Speed hoàn chỉnh cho ngữ cảnh học ngôn ngữ.

> **Pronunciation Accuracy:** Cai, D., Naismith, B., Kostromitina, M., Teng, Z., Yancey, K. P., & LaFlair, G. T. (2025). *Developing an Automatic Pronunciation Scorer: Aligning Speech Evaluation Models and Applied Linguistics Constructs.* Language Learning. https://onlinelibrary.wiley.com/doi/full/10.1111/lang.70000 — Nhóm nghiên cứu Duolingo English Test mô tả model chấm phát âm tự động dùng deep neural network, huấn luyện trên bộ dữ liệu được con người chấm điểm theo chuẩn ngôn ngữ học ứng dụng hiện hành, và cho kết quả tương quan cao hơn các bộ chấm phát âm tự động khác khi so với chuyên gia chấm tay. Đây là model nên tham khảo khi TalkWithMe nâng cấp Pronunciation Accuracy từ việc chỉ dùng STT confidence sang một model chấm phát âm chuyên biệt hơn (Phase 2).

> **Phạm vi áp dụng:** Các ghi chú trên chỉ nhằm gợi ý **model/phương pháp kỹ thuật** cho từng chỉ số riêng lẻ khi nâng cấp ở Phase 2 — không phải cơ sở cho trọng số (0.x) hay công thức tổng hợp trong bảng, các trọng số này vẫn là giả định thiết kế MVP của TalkWithMe, cần hiệu chỉnh bằng dữ liệu thực tế.

---

### F-04 — Gamification & Level System

- **Mô tả ngắn:** Tạo động lực luyện tập đều đặn và phản ánh tiến bộ trình độ qua hệ thống Level.
- **Mục tiêu nghiệp vụ:** Duy trì thói quen luyện tập (retention) và công nhận trình độ thực sự của người học.
- **User stories liên quan:** US-10 → US-12

| ID | User Story | Acceptance Criteria (rút gọn) |
|---|---|---|
| US-10 | Là người học, tôi muốn nhận XP khi hoàn thành hoạt động, để thấy nỗ lực của mình được ghi nhận. | Given hoàn thành Daily Mission (+50), Scenario Lesson (+100), AI Coach Session (+100), hoặc Room Session (+100) — When hoạt động được xác nhận hoàn tất — Then XP được cộng ngay vào Profile. |
| US-11 | Là người học, tôi muốn duy trì Streak khi luyện tập mỗi ngày, để tạo thói quen học đều. | Given hoàn thành hoạt động yêu cầu trong ngày — When qua ngày mới — Then Streak +1 và +20 XP; nếu bỏ lỡ một ngày, Streak reset về 0. |
| US-12 | Là người học, tôi muốn được thăng Level khi đạt đủ điều kiện, để thấy trình độ thực sự được công nhận. | Given Overall Score, số session, số scenario hoàn thành đạt ngưỡng của Level kế tiếp (bảng 3.4) — When hệ thống kiểm tra sau mỗi buổi học — Then Level được nâng và cập nhật Profile. Hệ thống không hạ Level chỉ vì một buổi học kết quả thấp; đánh giá dựa trên nhiều session gần đây. |

#### 3.4. Ngưỡng thăng Level

| Level | Điểm tổng ≥ | Số session tối thiểu | Điều kiện bổ sung |
|---|---|---|---|
| A1 | 0 | 0 | Level ban đầu |
| A2 | 40 | 5 | ≥ 3 scenario hoàn thành |
| B1 | 55 | 10 | ≥ 5 scenario hoàn thành |
| B2 | 70 | 20 | Không kỹ năng chính nào < 60 |
| C1 | 85 | 30 | Không kỹ năng chính nào < 75 |

> Ngưỡng 5 Level (A1–C1) và nguyên tắc "không kỹ năng chính nào dưới X điểm" bám theo triết lý đánh giá đa tiêu chí (Range, Accuracy, Fluency, Interaction, Coherence) của khung CEFR (Common European Framework of Reference for Languages) — một người học không được coi là đạt Level nếu chỉ mạnh một mặt (VD: nói nhanh) nhưng yếu mặt khác (VD: không hiểu được phản hồi). XP dùng cho mục đích gamification/theo dõi tiến độ, **không được dùng đơn độc để xác định trình độ tiếng Anh.**

---

### F-05 — Real User Voice Chatrooms (Phòng thoại Cộng đồng) & Invisible AI Assistant

- **Mô tả ngắn:** Môi trường luyện nói nhóm với người thật, có AI hỗ trợ ngầm khi cần.
- **Mục tiêu nghiệp vụ:** Đưa người học ra khỏi vùng an toàn 1-1 với AI, luyện giao tiếp nhóm thực tế nhưng vẫn có lưới an toàn.
- **User stories liên quan:** US-13 → US-15

| ID | User Story | Acceptance Criteria (rút gọn) |
|---|---|---|
| US-13 | Là người học, tôi muốn tham gia phòng thoại 3–5 người theo Level và chủ đề, để luyện giao tiếp nhóm thực tế. | Given đã chọn Room theo Level/chủ đề — When tham gia — Then Voice Chat và Live Transcript hoạt động thời gian thực, xác định người đang phát biểu. |
| US-14 | Là người học trong Room, tôi muốn AI chủ động gợi mở khi phòng im lặng, để cuộc trò chuyện không bị đứt quãng. | Given phòng không có hội thoại đáng kể ≥ 15 giây — When ngưỡng im lặng đạt — Then Invisible AI Assistant tạo một câu hỏi ngắn, liên quan chủ đề, không lặp câu hỏi gần đây, và không chiếm phần lớn thời gian hội thoại. |
| US-15 | Là người học đang bí ý hoặc bí từ, tôi muốn nhận gợi ý riêng, để tiếp tục nói mà không lộ trước cả phòng. | Given hệ thống phát hiện tôi gặp khó khăn diễn đạt — When kích hoạt hỗ trợ — Then Private Cue Card hiển thị 2–3 mẫu câu gợi ý chỉ cho riêng tôi, không tự tạo toàn bộ câu trả lời thay tôi, cá nhân hoá theo Level. |

---

## 4. Yêu cầu phi chức năng (Non-Functional Requirements)

### 4.1. Hiệu năng (Performance)

- Live Script/Live Transcript hiển thị gần thời gian thực; độ trễ partial transcript thấp, không gây cảm giác treo UI. *Cách kiểm tra: đo latency từ audio input đến hiển thị transcript trên môi trường thực tế.*
- Phát hiện phòng im lặng kích hoạt đúng ngưỡng ~15 giây. *Cách kiểm tra: test timer với các kịch bản im lặng 10s/15s/20s.*

### 4.2. Bảo mật (Security)

- Audio/transcript chỉ thu khi session ACTIVE; bảo vệ dữ liệu bằng authentication/authorization. *Cách kiểm tra: kiểm tra access control và log truy cập dữ liệu nhạy cảm.*
- Private Cue Card không hiển thị cho thành viên khác trong Room. *Cách kiểm tra: test đa người dùng trong cùng Room.*

### 4.3. Khả năng sẵn sàng & độ tin cậy (Availability & Reliability)

- Mất mạng/mic tạm thời không làm mất toàn bộ session hoặc transcript đã lưu. *Cách kiểm tra: test ngắt mạng/mic giữa phiên, kiểm tra retry & đồng bộ.*
- Lỗi AI/STT tạm thời có cơ chế retry; không tạo duplicate response/transcript khi retry. *Cách kiểm tra: test idempotency với `messageId`/`requestId`.*

### 4.4. Khả năng mở rộng (Scalability)

- Hệ thống chịu tải tăng số session/Room đồng thời khi số người dùng tăng. *Cách kiểm tra: load test theo kịch bản tăng trưởng người dùng.*

### 4.5. Khả năng sử dụng (Usability)

- Luồng Scenario Lesson và feedback dễ hiểu với người mới học; AI Assistant không gây áp lực. *Cách kiểm tra: user testing với người dùng thực ở nhiều level.*
- Nút mic/End Session dễ nhìn, font Live Script đủ lớn, không chỉ dùng màu để thể hiện trạng thái, có text fallback khi voice lỗi (accessibility cơ bản).

### 4.6. Khả năng tương thích (Compatibility)

- Hỗ trợ trình duyệt/thiết bị phổ biến, quyền truy cập microphone theo từng nền tảng. *Cách kiểm tra: test trên danh sách thiết bị/OS mục tiêu.*

### 4.7. Yêu cầu khác

- Logging/audit cho các thao tác chấm điểm và thay đổi Level, phục vụ truy vết khi người dùng khiếu nại kết quả.
- Không suy diễn quá mức ý nghĩa của Pronunciation Accuracy (chỉ dựa trên STT confidence) trong bất kỳ thông báo nào gửi tới người dùng — luôn gắn nhãn "tham khảo" (xem 3.3).

---

## 5. Yêu cầu về giao diện (Interface Requirements)

### 5.1. Giao diện người dùng (UI)

Frontend cần thiết kế tối thiểu các UX state: Ready to Start, Requesting Microphone, Connecting, AI Speaking, User Speaking, Processing Transcript, Reconnecting, Microphone Error, AI Error, Ending Session, Generating Feedback, Feedback Ready, Insufficient Data.

### 5.2. Giao diện API / tích hợp bên ngoài

**API chính (đề xuất cho AI Coach — MVP):**

| Endpoint | Mục đích |
|---|---|
| `POST /api/coach/sessions` | Tạo một CoachSession mới theo topic/goal |
| `POST /api/coach/sessions/{id}/transcript` | Lưu/finalize một TranscriptSegment |
| `POST /api/coach/sessions/{id}/end` | Kết thúc session, chuyển trạng thái và kích hoạt sinh feedback |
| `GET /api/coach/sessions/{id}/feedback` | Lấy Post-Session Feedback (scores, strengths, improvements, next practice) |

Các module Scenario Lessons, Gamification và Room dùng cùng nguyên tắc REST tương tự.

**Hệ thống bên ngoài cần tích hợp:**
- Speech-to-Text (STT) Service — chuyển giọng nói → văn bản, trả kèm confidence score.
- AI Language Model Service — sinh hội thoại, phân tích, chấm điểm, sinh feedback.
- Hạ tầng Voice Chat thời gian thực — phục vụ Community Voice Room.

### 5.3. Giao diện phần cứng

Không áp dụng cho MVP (không có thiết bị IoT/máy in/scanner liên quan); yêu cầu duy nhất là microphone của thiết bị người dùng (xem 2.4).

---

## 6. Yêu cầu dữ liệu (Data Requirements)

| Thực thể | Trường chính | Mô tả |
|---|---|---|
| UserProfile | userId, level (A1–C1), interests[], communicationGoal, weakPoints[], preferredTopics[] | Hồ sơ cá nhân hoá dùng để điều chỉnh nội dung AI |
| CoachSession | sessionId, userId, topic, level, startedAt, endedAt, status, durationSeconds, spokenSeconds | Một phiên luyện nói AI Coach |
| TranscriptSegment | segmentId, sessionId, speaker(USER/AI), text, startTime, endTime, confidence, isFinal | Một đoạn hội thoại trong Live Script |
| SessionFeedback | sessionId, fluencyScore, listeningScore, vocabularyScore, responseSpeedScore, pronunciationScore, strengths[], improvements[], nextPractice[] | Kết quả chấm điểm và gợi ý sau session |
| ScenarioLesson | scenarioId, category, title, context, roles, goal, chunks[] (functionTag, text, meaning, audio, example) | Định nghĩa một tình huống roleplay, nội dung dạy theo phương pháp Chunking |
| ChunkBank (per user) | userId, chunkId, status (NEEDS_PRACTICE/MASTERED), lastSeenAt | Danh sách cụm từ cá nhân cần luyện thêm |
| GamificationProfile | userId, xp, streak, level, dailyMissionsStatus | Trạng thái XP/Streak/Level của người dùng |
| VoiceRoom | roomId, level, topic, participants[], transcriptSegments[] | Phòng thoại cộng đồng và dữ liệu liên quan |

> Dữ liệu giọng nói và transcript là dữ liệu người dùng nhạy cảm: chỉ lưu trữ/khai thác theo chính sách bảo mật của hệ thống, không thu âm ngoài phạm vi session hợp lệ.

---

## 7. Ma trận truy vết (Traceability Matrix)

| Feature ID | Tên Feature | User Story | Ghi chú |
|---|---|---|---|
| F-00 | Onboarding & Placement Test | US-00 | Mục 3, F-00 |
| F-01 | AI Coach & Live Script | US-01 → US-04 | Mục 3, F-01 |
| F-02 | Scenario-based Lessons (Chunking) | US-05, US-06, US-06b, US-07, US-08 | Mục 3, F-02 |
| F-03 | Communication Scoring Engine | US-09 | Mục 3, F-03; công thức tại 3.3 |
| F-04 | Gamification & Level System | US-10 → US-12 | Mục 3, F-04; ngưỡng Level tại 3.4 |
| F-05 | Community Voice Room & Invisible AI Assistant | US-13 → US-15 | Mục 3, F-05 |

---

## 8. Phụ lục (Appendices)

### 8.1. Luồng nghiệp vụ tổng quát (Business Flow)

```text
[ Đăng ký / Đăng nhập ]
          │
          ▼
[ Placement Test — xác định Level ] ──(Bỏ qua)──► [ Tự chọn Level ]
          │                                              │
          ▼                                              ▼
          └──────────────► [ Chọn Chủ đề quan tâm ] ◄────┘
          │
          ├───► 🤖 [ Talk with AI Coach ] ───► Voice + Live Script ───► Session Summary & Rating
          │
          ├───► 📚 [ Practice Scenario (Chunking) ] ───► Useful Chunks ───► AI Roleplay Challenge
          │
          └───► 👥 [ Talk with People (Room) ] ───► Choose Room ───► Real-time Voice Chat + AI Helper
                     │
                     ▼
          Cộng XP/Streak ───► Kiểm tra điều kiện thăng Level ───► Cập nhật Profile
```

### 8.2. Các tình huống ngoại lệ chính (Exception Handling)

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

### 8.3. Definition of Done — MVP (tóm tắt)

- Người dùng thực hiện được trọn vẹn 3 luồng: AI Coach, Scenario Lesson, Community Room.
- Live Script/Live Transcript hiển thị đúng, phân biệt người nói, có timestamp.
- Communication Scoring Engine tính đủ 5 chỉ số + điểm tổng hợp theo công thức mục 3.3, không bịa điểm khi thiếu dữ liệu.
- Scenario Lessons dạy theo phương pháp Chunking: hiển thị đúng chunk theo chức năng, có Chunk Drill, và kết quả đánh giá phân biệt được chunk đã dùng tốt / cần luyện thêm.
- XP, Streak, Level hoạt động đúng quy tắc đã định nghĩa (mục 3.4).
- Invisible AI Assistant phát hiện im lặng ≥15s và Private Cue Card hoạt động đúng, riêng tư.
- Tối thiểu các nhóm ngoại lệ ở mục 8.2 được xử lý và có test tương ứng.
- Microphone không tiếp tục thu âm sau khi session kết thúc.
