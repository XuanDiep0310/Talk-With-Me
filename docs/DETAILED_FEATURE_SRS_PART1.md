# TalkWithMe — Detailed Feature SRS Part 1
## AI Coach, Live Script và Post-Session Feedback

**Tài liệu:** `docs/DETAILED_FEATURE_SRS_PART1.md`  
**Phiên bản:** 1.0  
**Phạm vi:** MVP — Core Feature 1: Personalized AI Coach  
**Ngôn ngữ:** Tiếng Việt

---

## 1. Mục đích

Tài liệu này đặc tả chi tiết các yêu cầu phần mềm cho luồng luyện nói với **AI Coach** của TalkWithMe. Trọng tâm là tạo một phiên hội thoại bằng giọng nói, hiển thị **Live Script** theo thời gian thực và sinh **Post-Session Feedback** sau khi phiên kết thúc.

Triết lý thiết kế là **Communication-First**: AI không nên liên tục ngắt lời để sửa lỗi. Người học được ưu tiên nói liên tục; việc phân tích Grammar, Vocabulary, Pronunciation, Fluency và Response Speed được thực hiện chủ yếu trong và sau session.

---

## 2. Phạm vi chức năng

### 2.1. In Scope — MVP

1. Chọn/đọc profile học viên.
2. Khởi tạo AI Coach session.
3. Voice input từ microphone.
4. Speech-to-Text (STT).
5. Hiển thị Live Script theo thời gian thực.
6. AI tạo phản hồi phù hợp với level và chủ đề.
7. Theo dõi các chỉ số trong session:
   - thời gian nói;
   - thời gian ngập ngừng;
   - filler words;
   - vocabulary;
   - grammar issues;
   - response speed;
   - pronunciation/STT confidence nếu nhà cung cấp STT hỗ trợ.
8. Kết thúc session chủ động hoặc theo điều kiện hệ thống.
9. Sinh Post-Session Feedback.
10. Hiển thị điểm mạnh, điểm cần cải thiện và đề xuất luyện tập tiếp theo.
11. Xử lý các edge cases liên quan đến microphone, mạng, STT và AI response.

### 2.2. Out of Scope — MVP

- Phân tích cảm xúc/ngữ điệu chuyên sâu.
- Long-term conversational memory nhiều session.
- Voice cloning hoặc bắt chước giọng người dùng.
- Video/avatar.
- Real User Voice Chatrooms.
- AI tạo bài học tức thì từ tin tức.

---

# 3. Actors

| Actor | Vai trò |
|---|---|
| User | Người học sử dụng AI Coach |
| AI Coach | Điều phối hội thoại, đặt câu hỏi và phản hồi |
| Speech-to-Text Service | Chuyển giọng nói thành văn bản |
| AI Analysis Service | Phân tích nội dung và sinh feedback |
| Backend | Quản lý session, profile, transcript và kết quả |
| Frontend | Giao diện voice chat, Live Script và report |

---

# 4. Điều kiện đầu vào

Trước khi sử dụng AI Coach, hệ thống cần có:

- User đã đăng nhập.
- User có profile hợp lệ.
- Profile có ít nhất:
  - `level`: A1, A2, B1, B2 hoặc C1;
  - `interests`: danh sách chủ đề quan tâm;
  - `communicationGoal`: mục tiêu giao tiếp.
- Thiết bị cho phép ứng dụng truy cập microphone.
- Có kết nối mạng để sử dụng AI/STT.

Nếu profile chưa đầy đủ, hệ thống phải yêu cầu user bổ sung thông tin cần thiết trước khi bắt đầu hoặc sử dụng giá trị mặc định được cấu hình.

---

# 5. Data Model mức nghiệp vụ

## 5.1. UserProfile

| Field | Kiểu | Mô tả |
|---|---|---|
| `userId` | UUID | ID người dùng |
| `level` | Enum | A1–C1 |
| `interests` | List<String> | Chủ đề quan tâm |
| `communicationGoal` | String | Mục tiêu giao tiếp |
| `weakPoints` | List<String> | Điểm yếu đã phát hiện |
| `preferredTopics` | List<String> | Chủ đề ưu tiên |

## 5.2. CoachSession

| Field | Kiểu | Mô tả |
|---|---|---|
| `sessionId` | UUID | ID session |
| `userId` | UUID | Người học |
| `topic` | String | Chủ đề hội thoại |
| `level` | Enum | Level tại thời điểm session |
| `startedAt` | DateTime | Thời điểm bắt đầu |
| `endedAt` | DateTime | Thời điểm kết thúc |
| `status` | Enum | `CREATED`, `ACTIVE`, `ENDING`, `COMPLETED`, `FAILED` |
| `durationSeconds` | Integer | Tổng thời lượng |
| `spokenSeconds` | Integer | Thời gian user thực sự nói |

## 5.3. TranscriptSegment

| Field | Kiểu | Mô tả |
|---|---|---|
| `segmentId` | UUID | ID đoạn transcript |
| `sessionId` | UUID | Session |
| `speaker` | Enum | `USER` hoặc `AI` |
| `text` | String | Nội dung transcript |
| `startTime` | Number | Timestamp bắt đầu |
| `endTime` | Number | Timestamp kết thúc |
| `confidence` | Number | Độ tin cậy STT nếu có |
| `isFinal` | Boolean | Transcript đã final hay chưa |

## 5.4. SessionFeedback

| Field | Kiểu | Mô tả |
|---|---|---|
| `sessionId` | UUID | Session tương ứng |
| `fluencyScore` | Number | Điểm Fluency |
| `listeningScore` | Number | Điểm Listening Comprehension |
| `vocabularyScore` | Number | Điểm Vocabulary Context |
| `responseSpeedScore` | Number | Điểm Response Speed |
| `pronunciationScore` | Number/null | Điểm Pronunciation |
| `strengths` | List<String> | Điểm tốt |
| `improvements` | List<String> | Điểm cần cải thiện |
| `nextPractice` | List<String> | Đề xuất luyện tập |

---

# 6. Luồng nghiệp vụ tổng thể

```text
[User mở AI Coach]
        |
        v
[Load User Profile]
        |
        v
[Chọn Topic / Start Session]
        |
        v
[Backend tạo CoachSession]
        |
        v
[AI Coach tạo Context]
        |
        v
[Request Microphone Permission]
        |
        v
[Start Voice Input]
        |
        v
[Speech-to-Text]
        |
        +------> [Live Script hiển thị]
        |
        v
[AI phân tích context]
        |
        v
[AI phản hồi bằng Voice/Text]
        |
        v
[User tiếp tục nói]
        |
        +------> [Lặp lại conversation]
        |
        v
[End Session]
        |
        v
[Aggregate Transcript + Metrics]
        |
        v
[Post-Session AI Analysis]
        |
        v
[Session Feedback]
        |
        v
[Hiển thị Report + Next Practice]
```

---

# 7. Detailed Flow — AI Coach

## UC-01: Start AI Coach Session

### Mục tiêu

Khởi tạo một phiên luyện nói cá nhân hóa dựa trên profile của user.

### Preconditions

- User đã đăng nhập.
- Profile hợp lệ.
- Hệ thống có thể truy cập backend.

### Main Flow

1. User mở màn hình **AI Coach**.
2. Frontend tải profile.
3. Hệ thống đọc:
   - English level;
   - interests;
   - communication goal;
   - weak points.
4. User chọn chủ đề hoặc hệ thống đề xuất chủ đề.
5. User nhấn **Start Session**.
6. Frontend xin quyền microphone nếu chưa được cấp.
7. Frontend gửi request tạo session.
8. Backend tạo `CoachSession`.
9. AI Context Builder tạo system context gồm:
   - level;
   - topic;
   - mục tiêu;
   - điểm yếu cần luyện;
   - nguyên tắc không ngắt lời không cần thiết.
10. AI Coach gửi lời mở đầu.
11. Session chuyển sang `ACTIVE`.
12. UI hiển thị trạng thái đang hội thoại.

### Business Rules

- AI phải dùng từ vựng và cấu trúc câu phù hợp với level.
- AI nên ưu tiên chủ đề user quan tâm.
- AI có thể đưa hội thoại về điểm yếu cần luyện nhưng không được sửa lỗi liên tục.
- AI không nên biến session thành một bài kiểm tra ngữ pháp.
- Nếu user im lặng ngắn, AI chờ thay vì lập tức kết thúc session.

### Postconditions

- Có một `CoachSession` ở trạng thái `ACTIVE`.
- Microphone sẵn sàng hoặc session chuyển sang trạng thái lỗi phù hợp.

---

# 8. Conversation Loop

Trong trạng thái `ACTIVE`, hệ thống lặp theo chu trình:

```text
LISTEN
  ↓
TRANSCRIBE
  ↓
DISPLAY LIVE SCRIPT
  ↓
FINALIZE USER UTTERANCE
  ↓
ANALYZE CONTEXT
  ↓
GENERATE AI RESPONSE
  ↓
AI VOICE RESPONSE
  ↓
LISTEN AGAIN
```

## 8.1. User Speaking

1. Microphone capture audio.
2. Audio được gửi đến STT service.
3. STT trả về partial transcript.
4. Frontend hiển thị partial transcript.
5. Khi STT xác nhận câu đã hoàn thành, segment chuyển thành final.
6. Final segment được lưu vào session.

## 8.2. AI Response

AI nhận:

- conversation history trong session;
- user profile;
- current topic;
- latest user utterance;
- weak points cần luyện.

AI tạo:

- response text;
- response voice;
- optional conversation intent/metadata.

AI phải ưu tiên duy trì hội thoại tự nhiên.

---

# 9. Live Script

## 9.1. Mục tiêu

Live Script giúp user nhìn thấy nội dung mình vừa nói và nội dung AI nói mà không phải ghi nhớ toàn bộ hội thoại.

## 9.2. Yêu cầu chức năng

### LS-01 — Partial Transcript

Khi user đang nói, hệ thống phải hiển thị transcript tạm thời.

Ví dụ:

```text
User:
"I went to the..."
```

Sau khi nhận thêm audio:

```text
User:
"I went to the cinema with my friends yesterday."
```

### LS-02 — Final Transcript

Khi STT hoàn tất segment:

- đánh dấu segment là `isFinal = true`;
- không tiếp tục thay đổi nội dung segment đó trừ khi có cơ chế correction;
- lưu segment vào session.

### LS-03 — Speaker Identification

Live Script phải phân biệt:

```text
AI Coach:
What did you do last weekend?

You:
I went to the cinema with my friends.
```

### LS-04 — Timestamp

Mỗi segment nên có timestamp để phục vụ:

- tính thời lượng nói;
- tính response speed;
- phân tích khoảng ngập ngừng;
- đồng bộ transcript với audio nếu cần.

### LS-05 — Auto Scroll

Transcript tự động cuộn đến nội dung mới nhất.

User vẫn có thể cuộn lên để xem nội dung cũ.

### LS-06 — Transcript Confidence

Nếu STT cung cấp confidence score, hệ thống có thể dùng confidence để đánh dấu các đoạn cần kiểm tra.

**Không được xem confidence của STT là bằng chứng tuyệt đối rằng user phát âm sai.**

---

# 10. Trạng thái Live Script

| State | Ý nghĩa | UI đề xuất |
|---|---|---|
| `LISTENING` | Đang nghe microphone | Mic active |
| `TRANSCRIBING` | Đang chuyển giọng nói thành text | Hiện partial text |
| `FINALIZING` | Đang hoàn thiện segment | Loading nhỏ |
| `PAUSED` | Tạm dừng | Nút Resume |
| `ERROR` | STT/mạng gặp lỗi | Hiện thông báo và Retry |

---

# 11. Xử lý ngập ngừng khi nói

Ngập ngừng là dữ liệu quan trọng cho **Fluency** và **Response Speed**, nhưng không được xem là lỗi nghiêm trọng.

## 11.1. Các loại hesitation

Hệ thống có thể phát hiện:

1. Khoảng im lặng giữa hai từ/cụm từ.
2. User bắt đầu trả lời chậm sau khi AI hỏi.
3. Filler words:
   - `uh`;
   - `um`;
   - `er`;
   - các filler tương tự.
4. Lặp lại từ/cụm từ.
5. Tự sửa câu.

## 11.2. Business Rules

- Không tự động ngắt user chỉ vì user im lặng trong thời gian ngắn.
- Khoảng pause ngắn không làm session thất bại.
- Nếu user đang tìm từ, AI nên chờ trong một khoảng thời gian hợp lý.
- Nếu pause quá lâu, AI có thể đưa ra cue nhẹ.
- Feedback nên nói theo hướng hỗ trợ, ví dụ:
  - "Try starting your answer sooner."
  - "You used several fillers; try pausing silently instead."

Không nên đánh giá user theo hướng tiêu cực như "Bạn nói quá tệ" hoặc "Bạn không biết tiếng Anh".

## 11.3. Response Speed

Một cách tính MVP:

```text
responseTime = first_user_speech_timestamp
               - ai_question_finished_timestamp
```

Nếu user chưa bắt đầu nói sau một khoảng timeout được cấu hình:

```text
responseTime = timeout_threshold
```

Không nên dùng một ngưỡng cứng duy nhất để kết luận khả năng giao tiếp của user.

---

# 12. Post-Session Feedback

## 12.1. Mục tiêu

Sau session, hệ thống biến dữ liệu hội thoại thành feedback ngắn gọn, dễ hành động và phù hợp với level.

## 12.2. Trigger

Feedback được tạo khi:

- user nhấn **End Session**;
- hoặc session đạt thời lượng tối đa;
- hoặc hệ thống buộc phải kết thúc vì lỗi không thể phục hồi.

## 12.3. Processing Flow

```text
[End Session]
      ↓
[Stop Microphone]
      ↓
[Finalize Pending Transcript]
      ↓
[Collect Session Metrics]
      ↓
[AI Analysis]
      ↓
[Calculate Scores]
      ↓
[Generate Feedback]
      ↓
[Save SessionFeedback]
      ↓
[Display Report]
```

---

# 13. Feedback Content

## 13.1. Summary

Hiển thị:

- tổng thời lượng session;
- thời lượng user nói;
- số lượt trao đổi;
- chủ đề đã luyện.

Ví dụ:

```text
Great session!

You practiced:
Travel — Weekend Trip

Speaking time:
6m 24s
```

## 13.2. Strengths

AI chọn 2–3 điểm nổi bật.

Ví dụ:

```text
✓ You kept the conversation going.
✓ You used travel vocabulary naturally.
✓ Your answers became longer during the session.
```

## 13.3. Areas to Improve

AI chọn tối đa 3 vấn đề quan trọng nhất.

Ví dụ:

```text
Grammar:
You often used the present tense when talking about past events.

Fluency:
You used several filler words before longer answers.

Vocabulary:
Try using more specific words when describing experiences.
```

## 13.4. Suggested Next Practice

Feedback phải dẫn đến hành động tiếp theo.

Ví dụ:

```text
Next practice:
1. Practice telling a story using the past tense.
2. Try answering within 3 seconds.
3. Practice 5 travel expressions.
```

---

# 14. Communication Scores

## 14.1. Fluency Score

Phản ánh:

- continuity of speech;
- pause frequency;
- filler word frequency;
- self-correction frequency.

Không chỉ dựa trên tốc độ nói.

## 14.2. Listening Comprehension

Đánh giá khả năng phản hồi đúng câu hỏi/ý của AI.

Có thể dựa trên:

- semantic relevance;
- task completion;
- contextual appropriateness.

## 14.3. Vocabulary Context

Đánh giá:

- mức độ đa dạng từ vựng;
- khả năng dùng từ đúng ngữ cảnh;
- mức độ phù hợp với chủ đề.

Không nên chỉ đếm số lượng từ khác nhau.

## 14.4. Response Speed

Đo thời gian từ khi AI hoàn tất câu hỏi đến khi user bắt đầu nói.

## 14.5. Pronunciation Accuracy

Nếu STT cung cấp confidence hoặc pronunciation-related signals, hệ thống có thể sử dụng chúng làm tín hiệu tham khảo.

**Requirement quan trọng:** STT confidence không được được diễn giải trực tiếp thành "phát âm đúng X%" nếu nhà cung cấp STT không đảm bảo ý nghĩa đó.

---

# 15. Score Display

MVP nên hiển thị điểm theo thang 100:

```text
Communication Skills

Fluency              78
Listening             84
Vocabulary            72
Response Speed        69
Pronunciation         80
```

Nếu không đủ dữ liệu cho một metric:

```text
Pronunciation         N/A
```

Không được tự tạo điểm mặc định chỉ để lấp đầy UI.

---

# 16. Edge Cases

## EC-01 — Microphone Permission Denied

### Scenario

User từ chối quyền microphone.

### Expected Behavior

1. Session chưa được chuyển sang `ACTIVE`.
2. Hiển thị thông báo:
   - microphone permission is required;
   - hướng dẫn mở quyền microphone.
3. Cho phép user thử lại.
4. Không tạo feedback giả nếu chưa có dữ liệu nói.

---

## EC-02 — Microphone Disconnected

### Scenario

Microphone bị ngắt trong session.

### Expected Behavior

1. Phát hiện audio input unavailable.
2. Tạm dừng capture.
3. Hiển thị:

```text
We can't hear you.
Please check your microphone and try again.
```

4. Cho phép `Retry Microphone`.
5. Không kết thúc session ngay lập tức.

---

## EC-03 — Network Lost While User Is Speaking

### Scenario

Mất mạng trong lúc user nói.

### Expected Behavior

1. Giữ audio/transcript buffer nếu khả thi.
2. Không xóa transcript đã có.
3. Hiển thị trạng thái `Reconnecting`.
4. Retry theo exponential backoff.
5. Nếu reconnect thành công:
   - tiếp tục session;
   - đồng bộ dữ liệu pending.
6. Nếu thất bại lâu hơn timeout:
   - chuyển session sang `FAILED` hoặc cho phép `Save Partial Session`.

---

## EC-04 — STT Timeout

### Scenario

Audio đã gửi nhưng STT không trả kết quả.

### Expected Behavior

- Hiển thị trạng thái đang xử lý.
- Retry request.
- Không tạo duplicate transcript.
- Nếu retry thất bại, cho user thử nói lại.

---

## EC-05 — STT Low Confidence

### Scenario

STT trả confidence thấp.

### Expected Behavior

- Không tự động kết luận user phát âm sai.
- Có thể đánh dấu transcript là uncertain.
- Nếu cần, AI hỏi lại câu vừa nói.
- Feedback pronunciation chỉ sử dụng dữ liệu đủ tin cậy.

---

## EC-06 — User Hesitates

### Scenario

User im lặng vài giây sau câu hỏi của AI.

### Expected Behavior

- Không ngắt ngay.
- Hiển thị trạng thái listening.
- Cho user thời gian suy nghĩ.
- Nếu vượt ngưỡng cấu hình, AI có thể đưa cue:

```text
Take your time. You can start with:
"I think..."
```

---

## EC-07 — User Says Only Filler Words

### Scenario

User nói:

```text
"Um... uh... I... I think..."
```

### Expected Behavior

- Không kết thúc session.
- Ghi nhận filler/hesitation metrics.
- AI chờ user hoàn thành ý.
- Feedback đưa ra một gợi ý cải thiện cụ thể.

---

## EC-08 — AI Response Timeout

### Scenario

AI không phản hồi trong thời gian cho phép.

### Expected Behavior

1. Hiển thị trạng thái generating.
2. Retry request.
3. Nếu retry thất bại:

```text
I'm having trouble responding right now.
Let's try that again.
```

4. Không làm mất transcript của user.

---

## EC-09 — Duplicate AI Response

### Scenario

Client retry request khiến AI response bị gửi hai lần.

### Expected Behavior

Mỗi AI response phải có `messageId`/`requestId` duy nhất.

Backend phải hỗ trợ idempotency để tránh lưu hoặc phát hai response giống nhau.

---

## EC-10 — User Ends Session During AI Response

### Scenario

User nhấn End Session trong khi AI đang nói.

### Expected Behavior

1. Dừng AI audio.
2. Stop microphone.
3. Finalize transcript đã nhận.
4. Không nhận thêm input.
5. Chuyển session sang `ENDING`.
6. Sinh feedback từ dữ liệu đã có.
7. Chuyển `COMPLETED`.

---

## EC-11 — Very Short Session

### Scenario

User kết thúc sau vài giây và gần như chưa nói.

### Expected Behavior

Không tạo đánh giá đầy đủ.

Hiển thị:

```text
Not enough speaking data yet.

Try another session for a more useful report.
```

Có thể lưu session nhưng đánh dấu feedback là `INSUFFICIENT_DATA`.

---

## EC-12 — User Goes Off Topic

### Scenario

User nói ngoài chủ đề.

### Expected Behavior

AI không được lập tức từ chối.

AI nên kéo cuộc hội thoại trở lại một cách tự nhiên:

```text
That's interesting. Speaking of travel, ...
```

---

## EC-13 — AI Does Not Understand User

### Scenario

AI không hiểu câu trả lời.

### Expected Behavior

AI yêu cầu clarification thay vì giả định ý user.

Ví dụ:

```text
Could you say that in another way?
```

---

## EC-14 — App Backgrounded

### Scenario

User chuyển ứng dụng sang background.

### Expected Behavior

Tùy platform:

- nếu background voice không được hỗ trợ: pause session;
- nếu được hỗ trợ: tuân thủ permission và lifecycle của OS;
- không ghi âm âm thầm ngoài trạng thái session hợp lệ.

Khi quay lại app:

```text
Session paused.
Resume when you're ready.
```

---

## EC-15 — Session Data Save Failure

### Scenario

Session đã kết thúc nhưng backend không lưu được report.

### Expected Behavior

- Giữ report tạm thời ở client nếu có thể.
- Hiển thị retry.
- Không báo "Saved successfully" khi server chưa xác nhận.
- Không tạo duplicate feedback khi retry.

---

# 17. Non-Functional Requirements

## NFR-01 — Responsiveness

Live Script phải xuất hiện transcript càng gần thời gian thực càng tốt.

Mục tiêu UX MVP:

- partial transcript bắt đầu xuất hiện sau một khoảng trễ ngắn;
- final transcript không gây cảm giác UI bị treo.

## NFR-02 — Reliability

Mất kết nối tạm thời không được làm mất toàn bộ session.

## NFR-03 — Privacy

Audio và transcript là dữ liệu người dùng.

Hệ thống phải:

- chỉ thu âm khi session đang hoạt động;
- thông báo trạng thái microphone rõ ràng;
- không tiếp tục thu âm sau khi session kết thúc;
- bảo vệ transcript theo cơ chế authentication/authorization.

## NFR-04 — Accessibility

- Nút microphone và End Session dễ nhìn.
- Live Script có font đủ lớn.
- Không chỉ dùng màu để thể hiện trạng thái.
- Có text fallback khi voice output không hoạt động.

---

# 18. API Contract đề xuất cho MVP

## POST `/api/coach/sessions`

Tạo session.

### Request

```json
{
  "topic": "Travel",
  "goal": "Talk about a weekend trip"
}
```

### Response

```json
{
  "sessionId": "uuid",
  "status": "ACTIVE",
  "topic": "Travel",
  "level": "B1"
}
```

## POST `/api/coach/sessions/{sessionId}/transcript`

Lưu/finalize transcript segment.

```json
{
  "speaker": "USER",
  "text": "I went to Da Nang last weekend.",
  "startTime": 12.4,
  "endTime": 16.8,
  "confidence": 0.93,
  "isFinal": true
}
```

## POST `/api/coach/sessions/{sessionId}/end`

Kết thúc session.

### Response

```json
{
  "sessionId": "uuid",
  "status": "COMPLETED",
  "feedbackStatus": "PROCESSING"
}
```

## GET `/api/coach/sessions/{sessionId}/feedback`

Lấy Post-Session Feedback.

```json
{
  "sessionId": "uuid",
  "fluencyScore": 78,
  "listeningScore": 84,
  "vocabularyScore": 72,
  "responseSpeedScore": 69,
  "pronunciationScore": 80,
  "strengths": [
    "You kept the conversation going.",
    "You used travel vocabulary naturally."
  ],
  "improvements": [
    "Practice past tense when describing previous events.",
    "Try reducing filler words."
  ],
  "nextPractice": [
    "Tell a 1-minute story about your last trip.",
    "Practice 5 travel expressions."
  ]
}
```

---

# 19. Acceptance Criteria

## AC-01 — Start Session

**Given** user đã đăng nhập và có profile  
**When** user chọn topic và Start Session  
**Then** hệ thống tạo một `CoachSession` và bắt đầu AI Coach.

## AC-02 — Personalization

**Given** user có level B1 và interest là Travel  
**When** session bắt đầu  
**Then** AI sử dụng level và topic để điều chỉnh hội thoại.

## AC-03 — Live Script

**Given** user đang nói  
**When** STT trả partial transcript  
**Then** Live Script hiển thị nội dung gần thời gian thực.

## AC-04 — Final Transcript

**Given** user hoàn thành một lượt nói  
**When** STT xác nhận final transcript  
**Then** hệ thống lưu một `TranscriptSegment` với `isFinal=true`.

## AC-05 — No Unnecessary Interruption

**Given** user đang ngập ngừng trong thời gian ngắn  
**When** microphone vẫn hoạt động  
**Then** AI không được tự động ngắt user chỉ vì pause ngắn.

## AC-06 — Hesitation Tracking

**Given** user có khoảng pause/filler words  
**When** session kết thúc  
**Then** dữ liệu hesitation được sử dụng để hỗ trợ tính Fluency/Response Speed.

## AC-07 — End Session

**Given** session đang `ACTIVE`  
**When** user nhấn End Session  
**Then** microphone dừng, transcript được finalize và session chuyển sang `COMPLETED` nếu dữ liệu được lưu thành công.

## AC-08 — Feedback

**Given** session có đủ dữ liệu  
**When** phân tích hoàn tất  
**Then** user nhìn thấy:
- Communication Scores;
- Strengths;
- Areas to Improve;
- Next Practice.

## AC-09 — Insufficient Data

**Given** user nói quá ít để đánh giá  
**When** session kết thúc  
**Then** hệ thống không bịa điểm số và hiển thị trạng thái `INSUFFICIENT_DATA`.

## AC-10 — Microphone Failure

**Given** microphone bị mất kết nối  
**When** hệ thống phát hiện lỗi  
**Then** user nhận được thông báo rõ ràng và có tùy chọn retry.

## AC-11 — Network Recovery

**Given** mạng tạm thời mất trong session  
**When** kết nối trở lại  
**Then** hệ thống tiếp tục hoặc đồng bộ phần dữ liệu còn thiếu mà không làm mất transcript đã lưu.

## AC-12 — AI Timeout

**Given** AI response timeout  
**When** retry thất bại  
**Then** hệ thống thông báo lỗi thân thiện và không làm mất lượt nói trước đó.

## AC-13 — Feedback Actionability

**Given** session hoàn thành  
**When** feedback được hiển thị  
**Then** mỗi nhóm lỗi chính phải có ít nhất một đề xuất luyện tập có thể thực hiện.

---

# 20. UX States quan trọng

Frontend cần thiết kế tối thiểu các trạng thái:

```text
1. Ready to Start
2. Requesting Microphone
3. Connecting
4. AI Speaking
5. User Speaking
6. Processing Transcript
7. Reconnecting
8. Microphone Error
9. AI Error
10. Ending Session
11. Generating Feedback
12. Feedback Ready
13. Insufficient Data
```

---

# 21. Definition of Done — MVP

Feature được xem là hoàn thành khi:

- [ ] User có thể Start AI Coach session.
- [ ] AI sử dụng profile để cá nhân hóa conversation.
- [ ] User có thể nói bằng microphone.
- [ ] Live Script hiển thị partial và final transcript.
- [ ] Transcript phân biệt User/AI.
- [ ] Session ghi nhận timestamps.
- [ ] Hệ thống xử lý hesitation/filler cơ bản.
- [ ] User có thể End Session.
- [ ] Session được lưu thành công.
- [ ] Post-Session Feedback được sinh và hiển thị.
- [ ] Có ít nhất 5 nhóm edge case được xử lý.
- [ ] Không tạo điểm số giả khi dữ liệu không đủ.
- [ ] Microphone không tiếp tục thu sau khi session kết thúc.
- [ ] Có retry cho các lỗi microphone, STT, network và AI.
- [ ] Có test cho các luồng chính và edge cases.

---

# 22. Tóm tắt

MVP của AI Coach TalkWithMe được xây dựng quanh ba năng lực chính:

```text
PERSONALIZED AI COACH
        │
        ├── Profile-aware conversation
        │
        ├── Voice Conversation
        │
        └── Context-aware response
                 │
                 ▼
            LIVE SCRIPT
                 │
                 ├── Partial Transcript
                 ├── Final Transcript
                 ├── Speaker Identification
                 └── Timestamp
                 │
                 ▼
          POST-SESSION REVIEW
                 │
                 ├── Fluency
                 ├── Listening
                 ├── Vocabulary
                 ├── Response Speed
                 ├── Pronunciation
                 ├── Strengths
                 ├── Improvements
                 └── Next Practice
```

Mục tiêu cuối cùng của feature không phải là tối đa hóa số lượng lỗi được phát hiện mà là **tăng thời lượng người học thực sự nói tiếng Anh, giảm áp lực khi giao tiếp và biến mỗi session thành một bước luyện tập có thể đo lường và tiếp tục cải thiện.**
