# 🎯 Feature Specifications & Requirements (Tài liệu Chức năng Sản phẩm)

Dự án **TalkWithMe** được thiết kế với triết lý **"Communication-First"** (Giao tiếp là trên hết). Mọi tính năng phát triển phải trực tiếp phục vụ cho việc tăng thời lượng nói tiếng Anh và xây dựng sự tự tin cho người học.

---

## 1. Phân nhóm Chức năng Mấu chốt (Important Feature Breakdown)

### 🤖 Core Feature 1: Personalized AI Coach (Huấn luyện viên AI Cá nhân hóa)
AI Coach không phải là một con chatbot trả lời chung chung. AI Coach đóng vai trò như một người bạn bản xứ ghi nhớ profile cá nhân của user.
* **Cá nhân hóa theo Profile**:
  * Lưu giữ Level (A1 - C1), sở thích (Movies, Gaming, Tech, Business...), mục tiêu giao tiếp.
  * Theo dõi điểm yếu: Thói quen phát âm sai, lỗi thì quá khứ (past tense), thời gian ngập ngừng khi nói.
* **Hội thoại thông minh (Contextual Conversation)**:
  * Tự động điều chỉnh độ khó từ vựng và tốc độ nói phù hợp với Level của user.
  * Chủ động điều hướng câu chuyện để ép user luyện tập các điểm yếu mà không gây cảm giác áp lực.
* **Voice + Live Script thời gian thực**:
  * Người dùng nói bằng Giọng nói (Voice) $\rightarrow$ Màn hình hiển thị phụ đề thời gian thực (Live Transcript).
  * Giảm áp lực "nghe không kịp" hoặc "quên mất vừa nói gì".
* **Phân tích & Feedback sau Session (Post-Session Review)**:
  * Không ngắt lời user khi đang nói.
  * Sau khi kết thúc session, đưa ra báo cáo: *Điểm tốt, Điểm cần cải thiện (Grammar/Vocab/Pronunciation), Đề xuất bài luyện tập tiếp theo*.

---

### 📚 Core Feature 2: Scenario-based Practice & Lessons (Bài học Tình huống Thực tế)
Hệ thống không dạy lý thuyết ngữ pháp rời rạc mà tổ chức thành các bài thực hành tình huống dùng được ngay.
* **Danh mục Tình huống (Scenario Library)**:
  * *Daily Life*: Giới thiệu bản thân, gọi món tại nhà hàng, hỏi đường, trò chuyện về sở thích.
  * *Social Talk*: Small talk với đồng nghiệp, đưa ra ý kiến, kể lại chuyến đi chơi.
  * *Travel & Shopping*: Đổi vé máy bay tại sân bay, khiếu nại phòng khách sạn, trả giá khi mua sắm.
  * *Workplace*: Giới thiệu bản thân trong phỏng vấn, trao đổi công việc hàng ngày, giải quyết hiểu lầm.
* **Cấu trúc Bài học Tình huống**:
  1. **Situation Introduction**: Mô tả bối cảnh và mục tiêu cần đạt.
  2. **Useful Expressions**: 3 - 5 câu "ăn liền" kèm phát âm mẫu.
  3. **Interactive Roleplay với AI**: Nhập vai thực hiện nhiệm vụ (VD: Đặt thành công một bàn ăn cho 4 người).
  4. **Mission Evaluation**: AI đánh giá xem user đã hoàn thành đủ các yêu cầu tình huống chưa.

---

### 👥 Core Feature 3: Real User Voice Chatrooms (Phòng thoại Cộng đồng)
Nơi người dùng bước ra khỏi vùng an toàn để trò chuyện với người thật.
* **Phân loại phòng (Room Filtering)**:
  * Lọc theo Level (Beginner / Explorer / Speaker) và Chủ đề trò chuyện (Gaming, Coffee Chat, Travel...).
  * Sức chứa phòng nhỏ (3 - 5 người) để đảm bảo ai cũng có thời lượng nói.
* **Tích hợp Live Script**:
  * Hiển thị phụ đề thời gian thực kèm tên người đang phát biểu trong phòng chat voice.
* **Invisible AI Assistant (Trợ lý AI Ẩn)**:
  * Khi phòng bị im lặng quá 15 giây, AI tự động đưa ra một câu hỏi gợi mở chủ đề mới.
  * Gợi ý mẫu câu cá nhân hóa (Private Cue Card) cho user nếu họ bị "bí từ".

---

### 🎯 Core Feature 4: Gamification & Missions (Hệ thống Thử thách & Động lực)
* **Daily Missions (Nhiệm vụ hàng ngày)**:
  * Nhiệm vụ đơn giản để duy trì thói quen: *Nói 5 phút với AI Coach, Học 1 tình huống mới, Tham gia 1 room chat cộng đồng*.
  * Tặng XP, Streak (chuỗi ngày học) và Badge (Huy hiệu).
* **Quick Response Challenge (Thử thách phản xạ 5s)**:
  * AI đưa ra một câu hỏi bất ngờ, user có 5 giây để bắt đầu trả lời bằng giọng nói.
  * Mục tiêu: Xóa bỏ thói quen dịch nhẩm từ tiếng Việt sang tiếng Anh trước khi nói.

---

### 📊 Core Feature 5: Communication Skills Tracking (Báo cáo Năng lực)
Hệ thống tính toán chỉ số giao tiếp tổng hợp dựa trên dữ liệu thực tế:
* **Fluency Score**: Độ trôi chảy, mật độ từ phụ (filler words: *uhm, ah*).
* **Listening Comprehension**: Khả năng phản hồi đúng trọng tâm câu hỏi AI.
* **Vocabulary Context**: Mức độ phong phú của từ vựng sử dụng trong ngữ cảnh.
* **Response Speed**: Tốc độ phản xạ đầu vào (giây).
* **Pronunciation Accuracy**: Độ chính xác của phát âm dựa trên STT confidence score.

---

## 2. Bảng Phân Nhóm Tính Năng Theo Giai Đoạn (Feature Roadmap Matrix)

| Khu vực tính năng | MVP (Giai đoạn 1) | Phase 2 (Mở rộng) | Phase 3 (Nâng cao) |
| :--- | :--- | :--- | :--- |
| **AI Coach** | Voice Chat + Live Script, Post-session Feedback, System Prompt cá nhân hóa. | Bộ nhớ dội lại (Long-term memory), phát âm chuẩn giọng theo vùng (US/UK/AU). | Phân tích cảm xúc & độ tự tin qua ngữ điệu giọng nói (Tone analysis). |
| **Lessons** | 20+ Tình huống thông dụng (Daily/Travel/Work), Useful Expressions. | Trình tạo bài học tự động cho Admin, Thư viện tình huống đóng góp bởi cộng đồng. | AI tạo bài học tức thì dựa trên tin tức hàng ngày (Real-time News Lessons). |
| **Social Rooms** | Chưa có | Room Voice 3-5 người, Live Script đa người dùng, Invisible AI Assistant. | Video Avatar chat, Phòng tranh luận (Debate room có trọng tài AI). |
| **Gamification** | Level System (5 Ranks), Daily Missions, XP & Streak. | Leaderboard hàng tuần, Quick Response Challenge 5s. | Thử thách đấu trường giao tiếp 1v1 (Communication Arena). |

---

## 3. Luồng Nghiệp Vụ Cốt Lõi (Core Business Flow)

```text
[ Đăng ký / Đăng nhập ]
          │
          ▼
[ Chọn Level & Chủ đề quan tâm ]
          │
          ├───► 🤖 [ Talk with AI Coach ] ───► Voice + Live Script ───► Session Summary & Rating
          │
          ├───► 📚 [ Practice Scenario ] ───► Useful Phrases ───► AI Roleplay Challenge
          │
          └───► 👥 [ Talk with People ]  ───► Choose Room ───► Real-time Voice Chat + AI Helper
```
