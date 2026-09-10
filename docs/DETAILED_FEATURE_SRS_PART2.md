# TÀI LIỆU SRS CHI TIẾT – PHẦN 2
## Bài học tình huống, Gamification và Đặc tả phòng thoại

**Dự án:** TalkWithMe  
**Tài liệu:** Software Requirements Specification – Part 2  
**Phiên bản:** 1.0

---

# 1. Bài học theo tình huống (Scenario-based Lessons)

## 1.1. Tổng quan

Tính năng **Scenario Lessons** cung cấp môi trường luyện giao tiếp tiếng Anh thông qua các tình huống thực tế thay vì học lý thuyết ngữ pháp riêng lẻ.

Người dùng lựa chọn một tình huống phù hợp với nhu cầu, sau đó thực hiện hội thoại với AI. Hệ thống cung cấp các mẫu câu hữu ích, thực hiện roleplay và đánh giá mức độ hoàn thành nhiệm vụ của người dùng.

## 1.2. Danh mục tình huống

Hệ thống tổ chức các tình huống theo các nhóm chính:

| Nhóm | Ví dụ tình huống |
|---|---|
| **Daily Life** | Giới thiệu bản thân, gọi món, hỏi đường, nói về sở thích |
| **Social Talk** | Small talk, đưa ra ý kiến, kể về chuyến đi |
| **Travel & Shopping** | Đổi vé máy bay, khiếu nại phòng khách sạn, mua sắm |
| **Workplace** | Giới thiệu bản thân khi phỏng vấn, trao đổi công việc, giải quyết hiểu lầm |

Trong phiên bản MVP, hệ thống cần cung cấp tối thiểu **20 tình huống phổ biến**, tập trung vào Daily Life, Travel và Workplace.

## 1.3. Cấu trúc một bài học

Mỗi bài học gồm 4 giai đoạn.

### Giai đoạn 1 – Giới thiệu tình huống

Hệ thống hiển thị:

- Tên tình huống.
- Mô tả bối cảnh.
- Vai trò của người dùng.
- Vai trò của AI.
- Mục tiêu giao tiếp.
- Các yêu cầu cần hoàn thành.

**Ví dụ:**

```text
Tình huống: Đặt bàn tại nhà hàng

Vai trò người dùng: Khách hàng
Vai trò AI: Nhân viên nhà hàng

Mục tiêu:
Đặt thành công một bàn ăn cho 4 người.
```

### Giai đoạn 2 – Mẫu câu hữu ích

Hệ thống cung cấp từ **3–5 mẫu câu** liên quan đến tình huống.

Mỗi mẫu câu gồm:

- Câu tiếng Anh.
- Nghĩa tiếng Việt.
- Phát âm mẫu.
- Ngữ cảnh sử dụng.

Mục đích là giúp người dùng có thể bắt đầu hội thoại nhanh chóng mà không cần học lý thuyết ngữ pháp riêng biệt.

### Giai đoạn 3 – Roleplay tương tác với AI

Người dùng thực hiện hội thoại với AI bằng giọng nói.

**Luồng xử lý:**

```text
Chọn tình huống
      ↓
Xem bối cảnh
      ↓
Xem mẫu câu hữu ích
      ↓
Bắt đầu Roleplay
      ↓
Người dùng nói
      ↓
Chuyển giọng nói → văn bản
      ↓
Hiển thị Live Transcript
      ↓
AI phân tích câu trả lời
      ↓
AI phản hồi
      ↓
Tiếp tục hội thoại
      ↓
Hoàn thành nhiệm vụ / Kết thúc
```

Trong quá trình roleplay:

- AI điều chỉnh độ khó từ vựng theo Level của người dùng.
- AI duy trì ngữ cảnh của tình huống.
- AI không ngắt lời người dùng khi đang nói.
- Giọng nói của người dùng được chuyển thành văn bản và hiển thị theo thời gian thực.
- AI điều hướng hội thoại hướng đến mục tiêu của tình huống.

### Giai đoạn 4 – Đánh giá nhiệm vụ

Sau khi kết thúc roleplay, hệ thống đánh giá người dùng đã hoàn thành các yêu cầu của tình huống hay chưa.

**Ví dụ:**

| Yêu cầu | Kết quả |
|---|---|
| Nêu số lượng người | PASS |
| Nêu thời gian đặt bàn | PASS |
| Xác nhận đặt bàn | PASS |
| Sử dụng ít nhất một mẫu câu | PASS |

Sau đó hệ thống tạo kết quả và phản hồi cho người dùng.

## 1.4. Yêu cầu chức năng

### FR-SL-01 – Chọn tình huống

Hệ thống phải cho phép người dùng xem và lựa chọn các tình huống có sẵn.

### FR-SL-02 – Phân loại tình huống

Hệ thống phải phân loại tình huống theo Daily Life, Social Talk, Travel & Shopping và Workplace.

### FR-SL-03 – Hiển thị bối cảnh

Hệ thống phải hiển thị bối cảnh, vai trò và mục tiêu giao tiếp trước khi bắt đầu roleplay.

### FR-SL-04 – Hiển thị mẫu câu

Hệ thống phải cung cấp từ 3–5 mẫu câu hữu ích cho mỗi tình huống.

### FR-SL-05 – Roleplay bằng giọng nói

Hệ thống phải cho phép người dùng thực hiện hội thoại với AI bằng giọng nói.

### FR-SL-06 – Live Transcript

Hệ thống phải hiển thị nội dung lời nói của người dùng dưới dạng văn bản theo thời gian thực.

### FR-SL-07 – Đánh giá nhiệm vụ

Hệ thống phải đánh giá mức độ hoàn thành các yêu cầu của tình huống.

### FR-SL-08 – Phản hồi sau bài học

Hệ thống phải cung cấp điểm mạnh, điểm cần cải thiện và đề xuất luyện tập tiếp theo.

---

# 2. Tính toán năng lực giao tiếp

## 2.1. Tổng quan

TalkWithMe đánh giá khả năng giao tiếp của người dùng dựa trên dữ liệu thu thập trong các buổi luyện nói.

Hệ thống gồm 5 chỉ số:

1. **Fluency Score** – Độ trôi chảy.
2. **Listening Comprehension** – Khả năng nghe hiểu.
3. **Vocabulary Context** – Mức độ sử dụng từ vựng trong ngữ cảnh.
4. **Response Speed** – Tốc độ phản hồi.
5. **Pronunciation Accuracy** – Độ chính xác phát âm.

Các chỉ số được chuẩn hóa về thang điểm **0–100**.

## 2.2. Công thức tính

### 2.2.1. Fluency Score

Đánh giá mức độ trôi chảy khi nói dựa trên:

- Tính liên tục của lời nói.
- Số lượng từ đệm.
- Số lần ngập ngừng không cần thiết.
- Khả năng duy trì lời nói.

Công thức đề xuất:

```text
Fluency Score =
0.50 × Speech Continuity
+ 0.30 × Pause Score
+ 0.20 × Filler Word Score
```

Trong đó các thành phần đều được chuẩn hóa về 0–100.

Điểm càng cao thì người dùng càng nói tự nhiên và ít ngập ngừng.

### 2.2.2. Listening Comprehension

Đánh giá khả năng hiểu câu hỏi hoặc yêu cầu của AI.

```text
Listening Comprehension =
0.70 × Response Relevance
+ 0.30 × Task Completion
```

Trong đó:

- **Response Relevance:** mức độ câu trả lời đúng trọng tâm.
- **Task Completion:** mức độ thực hiện đúng yêu cầu.

### 2.2.3. Vocabulary Context

Đánh giá mức độ đa dạng và phù hợp của từ vựng trong ngữ cảnh.

```text
Vocabulary Context =
0.60 × Vocabulary Diversity
+ 0.40 × Context Relevance
```

Điểm số ưu tiên việc sử dụng từ vựng phù hợp với ngữ cảnh thay vì chỉ sử dụng các từ khó.

### 2.2.4. Response Speed

Đo thời gian từ lúc AI kết thúc câu hỏi đến khi người dùng bắt đầu trả lời.

Gọi:

```text
T = thời gian phản hồi (giây)
```

Công thức đề xuất:

```text
Response Speed Score =
max(0, 100 - 10 × T)
```

Điểm nằm trong khoảng 0–100.

Ví dụ:

| Thời gian phản hồi | Điểm |
|---:|---:|
| ≤ 2 giây | 80–100 |
| 3 giây | 70 |
| 5 giây | 50 |
| 8 giây | 20 |
| ≥ 10 giây | 0 |

Chỉ số này nhằm đánh giá khả năng phản xạ trong hội thoại.

### 2.2.5. Pronunciation Accuracy

Đánh giá độ chính xác phát âm dựa trên kết quả nhận diện giọng nói.

Công thức đề xuất:

```text
Pronunciation Accuracy =
Average STT Confidence × 100
```

Trong đó STT Confidence được lấy từ hệ thống Speech-to-Text.

Lưu ý: STT Confidence chỉ là một chỉ báo tham khảo và không hoàn toàn đại diện cho chất lượng phát âm.

## 2.3. Điểm giao tiếp tổng hợp

Điểm giao tiếp tổng hợp được tính từ 5 chỉ số trên:

```text
Overall Communication Score =
0.25 × Fluency
+ 0.20 × Listening Comprehension
+ 0.20 × Vocabulary Context
+ 0.15 × Response Speed
+ 0.20 × Pronunciation Accuracy
```

Điểm cuối cùng nằm trong khoảng **0–100**.

**Ví dụ:**

```text
Fluency                = 80
Listening Comprehension = 75
Vocabulary Context      = 70
Response Speed          = 65
Pronunciation Accuracy  = 85

Overall =
0.25 × 80
+ 0.20 × 75
+ 0.20 × 70
+ 0.15 × 65
+ 0.20 × 85

= 76.75 ≈ 77/100
```

---

# 3. Gamification và hệ thống Level

## 3.1. Hệ thống Level

TalkWithMe sử dụng 5 Level:

```text
A1 → A2 → B1 → B2 → C1
```

Level phản ánh khả năng giao tiếp tiếng Anh của người dùng.

XP được sử dụng cho mục đích gamification và theo dõi tiến độ, **không dùng XP đơn độc để xác định trình độ tiếng Anh**.

## 3.2. Hệ thống XP

Người dùng nhận XP khi hoàn thành các hoạt động.

| Hoạt động | XP |
|---|---:|
| Hoàn thành Daily Mission | +50 XP |
| Hoàn thành Scenario Lesson | +100 XP |
| Hoàn thành AI Coach Session | +100 XP |
| Tham gia Room Session | +100 XP |
| Hoàn thành toàn bộ Daily Mission | +100 XP bonus |
| Duy trì Streak | +20 XP/ngày |

## 3.3. Daily Missions

Các nhiệm vụ hàng ngày trong MVP gồm:

1. Nói chuyện với AI Coach trong 5 phút.
2. Hoàn thành một Scenario Lesson.
3. Tham gia một Community Voice Room.

Khi hoàn thành nhiệm vụ, hệ thống cộng XP và cập nhật Streak.

## 3.4. Streak

Streak thể hiện số ngày liên tiếp người dùng duy trì hoạt động học tập.

```text
Hoàn thành hoạt động trong ngày
          ↓
       Streak +1
```

Nếu người dùng không hoàn thành hoạt động yêu cầu trong ngày, Streak sẽ được reset.

## 3.5. Điều kiện thăng Level

Việc thăng Level dựa trên nhiều yếu tố:

- Overall Communication Score.
- Số buổi luyện nói đã hoàn thành.
- Kết quả Scenario Lessons.
- Mức độ duy trì hoạt động học tập.
- Điểm tối thiểu của từng kỹ năng giao tiếp.

**Ngưỡng đề xuất:**

| Level | Điểm tổng | Số session tối thiểu | Điều kiện bổ sung |
|---|---:|---:|---|
| A1 | 0–39 | 0 | Level ban đầu |
| A2 | ≥ 40 | 5 | Hoàn thành ít nhất 3 scenario |
| B1 | ≥ 55 | 10 | Hoàn thành ít nhất 5 scenario |
| B2 | ≥ 70 | 20 | Không kỹ năng chính nào dưới 60 |
| C1 | ≥ 85 | 30 | Không kỹ năng chính nào dưới 75 |

Người dùng chỉ được thăng một Level khi **tất cả điều kiện tương ứng đều được đáp ứng**.

## 3.6. Luồng kiểm tra thăng Level

```text
Hoàn thành buổi học
        ↓
Tính các chỉ số giao tiếp
        ↓
Cập nhật Overall Communication Score
        ↓
Kiểm tra số session
        ↓
Kiểm tra số scenario
        ↓
Kiểm tra điểm kỹ năng
        ↓
Đủ điều kiện?
    ↙          ↘
   Có           Không
   ↓              ↓
Thăng Level    Giữ Level
   ↓
Cập nhật Profile
```

Hệ thống không nên hạ Level của người dùng chỉ vì một buổi học có kết quả thấp. Việc đánh giá lại nên dựa trên nhiều session gần đây.

---

# 4. Trợ lý AI ẩn trong Room Chat

## 4.1. Tổng quan

**Invisible AI Assistant** là trợ lý AI hoạt động bên trong Community Voice Room.

Mục đích:

- Giảm tình trạng phòng bị im lặng.
- Gợi ý chủ đề mới.
- Giúp người dùng tiếp tục nói khi bị bí ý tưởng hoặc bí từ.
- Hỗ trợ hội thoại nhưng không chiếm quyền điều khiển cuộc trò chuyện.

AI chỉ can thiệp khi thực sự cần thiết.

## 4.2. Đặc điểm Room

Một Room có:

- 3–5 người tham gia.
- Lọc theo Level.
- Lọc theo chủ đề.
- Voice Chat thời gian thực.
- Live Transcript.
- Invisible AI Assistant.

Các chủ đề ví dụ:

- Gaming.
- Coffee Chat.
- Travel.
- Movies.
- Technology.

## 4.3. Phát hiện im lặng

AI theo dõi hoạt động nói chuyện trong phòng.

```text
Theo dõi hội thoại
       ↓
Phát hiện hoạt động nói
       ↓
Phòng im lặng ≥ 15 giây?
      ↙          ↘
    Không         Có
      ↓            ↓
Tiếp tục       Tạo câu hỏi
hội thoại          ↓
              Hiển thị prompt
```

Khi phòng không có hội thoại đáng kể trong **15 giây hoặc lâu hơn**, AI tạo một câu hỏi ngắn liên quan đến chủ đề hiện tại.

**Ví dụ:**

```text
Chủ đề: Travel

AI:
"What's the most interesting place you've visited?"
```

## 4.4. Nguyên tắc tạo câu hỏi

Câu hỏi do AI tạo ra phải:

- Liên quan đến chủ đề hiện tại.
- Phù hợp với Level của người dùng/phòng.
- Ngắn và dễ hiểu.
- Khuyến khích người dùng tiếp tục nói.
- Không lặp lại câu hỏi gần đây.
- Không chiếm phần lớn thời gian hội thoại.

AI đóng vai trò **người hỗ trợ/facilitator**, không phải một thành viên chính của phòng.

## 4.5. Private Cue Card

Khi phát hiện người dùng gặp khó khăn trong việc diễn đạt, hệ thống có thể hiển thị **Private Cue Card**.

Cue Card chỉ hiển thị cho người dùng đó và không hiển thị cho các thành viên khác.

**Ví dụ:**

```text
💡 Gợi ý:

Bạn có thể nói:

"In my opinion, ..."
"I think the main reason is ..."
"For example, ..."
```

Cue Card chỉ nên cung cấp **gợi ý**, không tự động tạo toàn bộ câu trả lời thay cho người dùng.

## 4.6. Yêu cầu chức năng

### FR-ROOM-01 – Phát hiện im lặng

Hệ thống phải phát hiện phòng không có hoạt động hội thoại đáng kể trong ít nhất 15 giây.

### FR-ROOM-02 – Tạo câu hỏi theo chủ đề

Hệ thống phải tạo câu hỏi dựa trên chủ đề hiện tại của Room.

### FR-ROOM-03 – AI can thiệp

Hệ thống phải cung cấp câu hỏi gợi mở khi đạt ngưỡng im lặng.

### FR-ROOM-04 – Private Cue Card

Hệ thống phải có khả năng hiển thị gợi ý nói riêng cho từng người dùng.

### FR-ROOM-05 – Cá nhân hóa theo Level

AI phải điều chỉnh độ khó của câu hỏi và mẫu câu theo Level của người dùng.

### FR-ROOM-06 – Không gây gián đoạn

AI không được liên tục can thiệp khi cuộc hội thoại đang diễn ra bình thường.

### FR-ROOM-07 – Live Transcript

Hệ thống phải hiển thị phụ đề thời gian thực và xác định người đang phát biểu.

---

# 5. Yêu cầu phi chức năng

## 5.1. Hiệu năng

- Live Transcript phải được hiển thị với độ trễ thấp.
- AI phản hồi trong thời gian phù hợp với hội thoại.
- Cơ chế phát hiện im lặng phải kích hoạt khoảng sau 15 giây.

## 5.2. Khả năng sử dụng

- Luồng Scenario Lesson phải dễ hiểu đối với người mới học tiếng Anh.
- Feedback phải được trình bày rõ ràng, dễ hiểu.
- AI Assistant không được tạo cảm giác gây áp lực cho người dùng.

## 5.3. Độ tin cậy

- Lỗi Speech-to-Text không được làm kết thúc session.
- Lỗi AI tạm thời phải có cơ chế thử lại.
- Kết quả session phải được lưu sau khi hoàn thành.

## 5.4. Bảo mật và riêng tư

- Dữ liệu giọng nói và transcript chỉ được lưu trữ theo chính sách bảo mật của hệ thống.
- Private Cue Card không được hiển thị cho người dùng khác trong Room.

---

# 6. Tiêu chí nghiệm thu (Acceptance Criteria)

## 6.1. Scenario Lessons

- [ ] Người dùng có thể lựa chọn tình huống.
- [ ] Hệ thống hiển thị bối cảnh, vai trò và mục tiêu.
- [ ] Hệ thống cung cấp 3–5 mẫu câu hữu ích.
- [ ] Người dùng có thể thực hiện roleplay bằng giọng nói.
- [ ] Live Transcript được hiển thị.
- [ ] AI đánh giá mức độ hoàn thành nhiệm vụ.
- [ ] Người dùng nhận được feedback sau bài học.

## 6.2. Communication Skills

- [ ] Hệ thống tính Fluency Score.
- [ ] Hệ thống tính Listening Comprehension.
- [ ] Hệ thống tính Vocabulary Context.
- [ ] Hệ thống tính Response Speed.
- [ ] Hệ thống tính Pronunciation Accuracy.
- [ ] Hệ thống tính Overall Communication Score.

## 6.3. Gamification & Level

- [ ] Người dùng nhận XP sau khi hoàn thành hoạt động.
- [ ] Daily Missions có thể được hoàn thành và nhận thưởng.
- [ ] Streak được cập nhật theo hoạt động hàng ngày.
- [ ] Level được hiển thị trong Profile.
- [ ] Hệ thống kiểm tra điều kiện thăng Level.
- [ ] Người dùng có thể tiến triển A1 → A2 → B1 → B2 → C1 khi đáp ứng điều kiện.

## 6.4. Invisible AI Assistant

- [ ] Hệ thống phát hiện phòng im lặng ít nhất 15 giây.
- [ ] AI tạo câu hỏi phù hợp với chủ đề.
- [ ] AI không can thiệp không cần thiết khi đang có hội thoại.
- [ ] Private Cue Card có thể hiển thị cho từng người dùng.
- [ ] Cue Card được cá nhân hóa theo Level/ngữ cảnh.
- [ ] Live Transcript xác định người đang phát biểu.

---

# 7. Luồng nghiệp vụ tổng quát

```text
[Đăng ký / Đăng nhập]
          ↓
[Chọn Level & Chủ đề quan tâm]
          ↓
   ┌──────┴────────┐
   ↓               ↓
[Scenario]      [Talk with People]
   ↓               ↓
[Bối cảnh]      [Chọn Room]
   ↓               ↓
[Mẫu câu]       [Voice Chat]
   ↓               ↓
[AI Roleplay]   [Theo dõi hội thoại]
   ↓               ↓
[Đánh giá]      [Phát hiện im lặng]
   ↓               ↓
[Communication]  [AI Prompt / Cue Card]
   ↓               ↓
   └──────┬────────┘
          ↓
    [XP / Streak]
          ↓
   [Kiểm tra Level]
          ↓
 [Cập nhật tiến độ]
```

---

# 8. Đối chiếu với Feature Specifications

| Feature trong FEATURES.md | SRS Part 2 |
|---|---|
| Scenario-based Practice & Lessons | Mục 1 |
| Situation Introduction | Mục 1.3 |
| Useful Expressions | Mục 1.3 |
| Interactive Roleplay | Mục 1.3 |
| Mission Evaluation | Mục 1.3–1.4 |
| Communication Skills Tracking | Mục 2 |
| Level System | Mục 3 |
| Daily Missions | Mục 3.3 |
| XP & Streak | Mục 3.2–3.4 |
| Real User Voice Chatrooms | Mục 4 |
| Invisible AI Assistant | Mục 4 |
| Phát hiện im lặng 15 giây | Mục 4.3 |
| Private Cue Card | Mục 4.5 |
| Core Business Flow | Mục 7 |