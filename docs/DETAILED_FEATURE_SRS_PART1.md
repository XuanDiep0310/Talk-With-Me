# ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)

## TalkWithMe — AI Coach, Live Script & Phản hồi sau phiên

**Mã tài liệu:** SRS-TWM-P1-001  
**Jira:** SCRUM-7  
**Phiên bản:** 2.0  
**Tác giả / chủ sở hữu**: Phạm Hải Yến
**Người phê duyệt**:
**Sản phẩm:** TalkWithMe  
**Phạm vi chức năng:** AI Coach cá nhân hóa  
**Phạm vi:** MVP / Giai đoạn 1  
**Cập nhật lần cuối:** 2026-09-22

---

# 1. Tổng quan

## 1.1 Mục đích

Tài liệu này đặc tả các yêu cầu chức năng và phi chức năng cho tính năng **AI Coach cá nhân hóa** của TalkWithMe.

Tài liệu được sử dụng làm tài liệu tham chiếu chung cho Product Owner/Stakeholder, Business Analyst, Frontend Developer, Backend Developer, AI/ML Developer, QA/Tester và UI/UX Designer.

Các yêu cầu mô tả cách người dùng bắt đầu một phiên luyện nói với AI, cách hệ thống xử lý dữ liệu giọng nói, cách Live Script được hiển thị, cách AI duy trì cuộc hội thoại cá nhân hóa, cách kết thúc phiên và cách tạo Phản hồi sau phiên.

Tính năng tuân theo nguyên tắc **Communication-First** của TalkWithMe: hệ thống cần tối đa hóa thời gian luyện nói tiếng Anh có ý nghĩa và sự tự tin của người học thay vì liên tục ngắt lời để sửa từng lỗi riêng lẻ.

## 1.2 Phạm vi

### 1.2.1 Các chức năng trong phạm vi

1. Tải và sử dụng hồ sơ học tiếng Anh của người dùng.
2. Bắt đầu một phiên luyện nói với AI Coach.
3. Chọn hoặc nhận một chủ đề hội thoại.
4. Thực hiện hội thoại bằng giọng nói với AI.
5. Chuyển giọng nói của người dùng thành văn bản bằng Speech-to-Text (STT).
6. Hiển thị Live Script ở trạng thái tạm thời và hoàn chỉnh.
7. Phân biệt các đoạn transcript của người dùng và AI.
8. Ghi nhận dấu thời gian và các chỉ số của phiên.
9. Phát hiện các tín hiệu ngập ngừng và từ đệm cơ bản.
10. Điều chỉnh độ khó của hội thoại AI theo trình độ người dùng.
11. Hướng cuộc hội thoại đến các điểm yếu phù hợp của người dùng mà không ngắt quãng không cần thiết.
12. Kết thúc một phiên đang hoạt động.
13. Tổng hợp dữ liệu của phiên.
14. Tạo Phản hồi sau phiên.
15. Hiển thị các chỉ số Kỹ năng giao tiếp.
16. Hiển thị điểm mạnh, điểm cần cải thiện và đề xuất bài luyện tập tiếp theo.
17. Xử lý các trường hợp biên liên quan đến microphone, mạng, STT, phản hồi AI và dữ liệu không đủ.

### 1.2.2 Các chức năng ngoài phạm vi

- Ghi nhớ hội thoại dài hạn qua số lượng phiên không giới hạn.
- Phân tích cảm xúc hoặc sự tự tin từ giọng nói.
- Hội thoại bằng video/avatar.
- Phòng trò chuyện bằng giọng nói giữa người dùng thật.
- Phòng tranh luận.
- Tạo bài học bằng AI từ tin tức thời gian thực.
- Sao chép giọng nói.
- Phân loại nâng cao theo giọng vùng miền.
- Tự động chẩn đoán rối loạn ngôn ngữ.
- Chấm điểm phát âm chi tiết khi nhà cung cấp STT nền tảng không cung cấp tín hiệu phát âm đáng tin cậy.

## 1.3 Người dùng / Tác nhân

| Tác nhân               | Mô tả                                                        |
| ---------------------- | ------------------------------------------------------------ |
| Người học / Người dùng | Người dùng đã đăng ký luyện nói tiếng Anh với AI Coach       |
| AI Coach               | Đối tác hội thoại AI thực hiện và điều chỉnh phiên luyện tập |
| Dịch vụ Speech-to-Text | Dịch vụ chuyển âm thanh giọng nói thành văn bản              |
| Dịch vụ AI             | Dịch vụ tạo phản hồi AI theo ngữ cảnh và phân tích sau phiên |
| Backend                | Quản lý phiên, dữ liệu hồ sơ, transcript, chỉ số và phản hồi |
| Frontend               | Cung cấp giao diện AI Coach, Live Script và phản hồi         |

## 1.4 Định nghĩa & từ viết tắt

| Thuật ngữ            | Định nghĩa                                                                        |
| -------------------- | --------------------------------------------------------------------------------- |
| AI Coach             | Đối tác hội thoại AI được cá nhân hóa                                             |
| Phiên (Session)      | Một hoạt động luyện tập AI Coach liên tục                                         |
| Live Script          | Bản ghi lời nói được hiển thị theo thời gian thực trong phiên luyện nói           |
| Partial Transcript   | Kết quả STT tạm thời vẫn có thể thay đổi                                          |
| Final Transcript     | Kết quả STT được xem là hoàn chỉnh cho một đoạn lời nói                           |
| STT                  | Speech-to-Text — chuyển giọng nói thành văn bản                                   |
| Từ đệm (Filler Word) | Các từ/âm như “um”, “uh”, “er” được sử dụng khi ngập ngừng                        |
| Hesitation           | Khoảng dừng hoặc phản hồi chậm khi nói                                            |
| Response Speed       | Thời gian từ khi AI kết thúc câu hỏi/lời nhắc đến khi người dùng bắt đầu phản hồi |
| Phản hồi sau phiên   | Phân tích được hiển thị sau phiên luyện nói                                       |
| Điểm giao tiếp       | Chỉ số tổng hợp hoặc riêng lẻ mô tả một kỹ năng giao tiếp                         |
| Điểm yếu             | Vấn đề học tập lặp lại được xác định từ dữ liệu luyện tập trước đó hoặc hiện tại  |

## 1.5 Tài liệu tham chiếu

Tài liệu này kết hợp các phần SRS truyền thống với Feature → User Story → Acceptance Criteria và truy xuất nguồn gốc.

Cấu trúc cũng tuân theo ví dụ FRD thực tế, đặc biệt ở các phần lịch sử tài liệu, tổng quan/phạm vi, user story, mã yêu cầu chức năng, yêu cầu chung, quy tắc nghiệp vụ, điều kiện trước, bảng đặc tả use case, điều kiện sau và NFR.

---

# 2. Tổng quan sản phẩm

## 2.1 Bối cảnh sản phẩm

TalkWithMe là nền tảng web học giao tiếp tiếng Anh được xây dựng theo phương pháp **Communication-First**.

AI Coach là một trong những lộ trình học tập cốt lõi:

```text
User Profile
     |
     v
Start AI Coach Session
     |
     v
Voice Input <------> AI Coach
     |
     v
Speech-to-Text
     |
     v
Live Script
     |
     v
Session Metrics
     |
     v
Post-Session Analysis
     |
     v
Feedback + Next Practice
```

Tính năng phụ thuộc vào khả năng microphone của trình duyệt và các dịch vụ AI/STT.

## 2.2 Mục tiêu nghiệp vụ

Tính năng AI Coach cần:

1. Tăng thời gian người dùng chủ động nói tiếng Anh.
2. Giảm sự lo lắng do mắc lỗi khi nói.
3. Cung cấp hoạt động hội thoại phù hợp với trình độ và sở thích của người dùng.
4. Cung cấp phản hồi có thể hành động sau khi luyện tập thay vì ngắt lời ở mọi lỗi sai.
5. Giúp người dùng xác định các điểm yếu giao tiếp lặp lại.
6. Khuyến khích người dùng tiếp tục bằng một hoạt động luyện tập cụ thể tiếp theo.

## 2.3 Giả định và phụ thuộc

### Giả định

- Người dùng có tài khoản TalkWithMe hợp lệ.
- Người dùng đã hoàn thành các trường hồ sơ tối thiểu bắt buộc.
- Người dùng sử dụng thiết bị/trình duyệt hỗ trợ microphone.
- Người dùng cấp quyền microphone khi được yêu cầu.
- Người dùng có kết nối mạng để sử dụng dịch vụ AI/STT.

### Phụ thuộc

- API microphone của trình duyệt / thu âm thanh.
- Dịch vụ Speech-to-Text.
- Dịch vụ tạo phản hồi AI.
- API Backend.
- Cơ chế xác thực.
- Bộ lưu trữ lâu dài cho dữ liệu phiên và phản hồi.

---

# 3. Định nghĩa chức năng

## 3.1 Thông tin chức năng

**Feature ID:** F-01  
**Tên chức năng:** AI Coach cá nhân hóa  
**Độ ưu tiên:** Cao  
**Phiên bản phát hành:** MVP / Giai đoạn 1

### Mô tả ngắn

Hệ thống cung cấp một đối tác hội thoại AI sử dụng hồ sơ, trình độ tiếng Anh, sở thích, mục tiêu giao tiếp và các điểm yếu đã biết của người dùng để thực hiện một phiên luyện nói bằng giọng nói.

### Mục tiêu nghiệp vụ

Giúp người dùng có thời gian nói tiếng Anh có ý nghĩa trong môi trường ít áp lực, đồng thời nhận được phản hồi có thể đo lường và hành động sau mỗi phiên.

### User Story liên quan

- US-01 — Start personalized AI Coach session
- US-02 — Conduct voice conversation
- US-03 — View Live Script
- US-04 — Continue conversation during hesitation
- US-05 — End session
- US-06 — Receive Post-Session Feedback
- US-07 — Handle microphone/network/STT failures
- US-08 — Handle insufficient session data

---

# 4. User Story

## US-01: Bắt đầu phiên AI Coach cá nhân hóa

**Với vai trò là** người học,  
**Tôi muốn** bắt đầu một phiên luyện nói dựa trên hồ sơ và chủ đề đã chọn,  
**để** tôi có thể luyện tiếng Anh ở trình độ phù hợp.

### Tiêu chí chấp nhận

**Kịch bản 1.1 — Bắt đầu thành công**

- Cho rằng the user is logged in and has a valid profile.
- Khi the user selects a topic and starts AI Coach.
- Thì the system creates a new session.
- Và the session status becomes `ACTIVE`.
- Và the AI receives the user's relevant profile context.

**Kịch bản 1.2 — Thiếu thông tin hồ sơ**

- Cho rằng required profile information is missing.
- Khi the user attempts to start a session.
- Thì the system requests the missing information or applies a documented default.
- Và the system does not silently invent profile information.

### Quy tắc nghiệp vụ

- AI conversation difficulty must be appropriate to the user's declared level.
- Topic selection should use the user's interests where applicable.
- Known weaknesses may be incorporated into the conversation naturally.
- The AI should prioritize conversation continuity over continuous correction.

### Truy xuất nguồn gốc

`F-01 → US-01 → FR-01`

---

## US-02: Thực hiện hội thoại bằng giọng nói

**Với vai trò là** người học,  
**Tôi muốn** nói chuyện với AI bằng microphone,  
**để** tôi có thể luyện nói tiếng Anh một cách tự nhiên.

### Tiêu chí chấp nhận

**Kịch bản 2.1 — Người dùng nói thành công**

- Cho rằng an active session and khả dụng microphone.
- Khi the user speaks.
- Thì audio is captured.
- Và the audio is sent to STT.
- Và the resulting transcript is associated with the current session.

**Kịch bản 2.2 — AI phản hồi**

- Cho rằng a finalized user utterance.
- Khi the AI processes the utterance.
- Thì the AI generates a contextually relevant response.
- Và the response is associated with the session.
- Và the AI does not unnecessarily interrupt the user.

### Quy tắc nghiệp vụ

- Conversation history within the active session must be khả dụng to the AI.
- AI responses should be appropriate to the user's level.
- The AI should keep the conversation moving with questions or follow-ups.
- The AI may steer the conversation toward a learning target without making the interaction feel like a grammar test.

### Truy xuất nguồn gốc

`F-01 → US-02 → FR-02`

---

## US-03: Xem Live Script

**Với vai trò là** người học,  
**Tôi muốn** xem nội dung tôi và AI đang nói theo thời gian thực,  
**để** tôi có thể theo dõi cuộc hội thoại và giảm áp lực phải ghi nhớ từng câu.

### Tiêu chí chấp nhận

**Kịch bản 3.1 — Transcript tạm thời**

- Cho rằng the user is speaking.
- Khi STT returns a partial result.
- Thì the partial text is displayed in Live Script.
- Và the text may update while the utterance is still in progress.

**Kịch bản 3.2 — Transcript hoàn chỉnh**

- Cho rằng the user has hoàn chỉnhd an utterance.
- Khi STT returns a final result.
- Thì the system stores the segment as final.
- Và the final segment is displayed without being treated as tạm thời.

**Kịch bản 3.3 — Nhận diện người nói**

- Cho rằng both user and AI have spoken.
- Khi the transcript is displayed.
- Thì the interface distinguishes `USER` and `AI`.

### Quy tắc nghiệp vụ

- Partial transcript may change.
- Final transcript must not be overwritten by later partial results unless an explicit correction mechanism exists.
- Transcript should be ordered chronologically.
- The newest transcript should be visible automatically while allowing the user to review earlier messages.

### Truy xuất nguồn gốc

`F-01 → US-03 → FR-03`

---

## US-04: Xử lý tình trạng ngập ngừng khi nói

**Với vai trò là** người học,  
**Tôi muốn** có đủ thời gian suy nghĩ trước khi trả lời,  
**để** tôi có thể luyện nói mà không cảm thấy áp lực bởi việc bị sửa ngay lập tức.

### Tiêu chí chấp nhận

**Kịch bản 4.1 — Ngập ngừng ngắn**

- Cho rằng the AI has finished a question.
- Khi the user pauses briefly.
- Thì the system continues listening.
- Và the AI does not interrupt immediately.

**Kịch bản 4.2 — Ngập ngừng dài**

- Cho rằng the user remains silent beyond the configured assistance threshold.
- Khi the threshold is reached.
- Thì the system may provide a supportive cue.
- Và the session remains active.

**Kịch bản 4.3 — Từ đệm**

- Cho rằng the user uses filler words.
- Khi the session is analyzed.
- Thì filler frequency may contribute to Fluency analysis.
- Và the user is not interrupted solely because filler words were detected.

### Quy tắc nghiệp vụ

- Hesitation is a measurable learning signal, not an automatic failure.
- Short pauses must not cause session termination.
- Feedback should provide a practical improvement strategy.

### Truy xuất nguồn gốc

`F-01 → US-04 → FR-04`

---

## US-05: Kết thúc phiên AI Coach

**Với vai trò là** người học,  
**Tôi muốn** kết thúc phiên khi tôi hoàn thành,  
**để** tôi có thể nhận được bản tóm tắt quá trình luyện tập.

### Tiêu chí chấp nhận

**Kịch bản 5.1 — Kết thúc bình thường**

- Cho rằng the session is active.
- Khi the user selects `End Session`.
- Thì microphone capture stops.
- Và pending transcript data is finalized where possible.
- Và the session is marked as hoàn chỉnhd.
- Và feedback generation begins.

**Kịch bản 5.2 — Kết thúc khi AI đang phản hồi**

- Cho rằng the AI is speaking.
- Khi the user ends the session.
- Thì Âm thanh AI dừng.
- Và no new user audio is captured.
- Và existing session data is preserved.

### Truy xuất nguồn gốc

`F-01 → US-05 → FR-05`

---

## US-06: Nhận Phản hồi sau phiên

**Với vai trò là** người học,  
**Tôi muốn** nhận phản hồi sau phiên,  
**để** tôi biết mình đã làm tốt điều gì và nên luyện tập gì tiếp theo.

### Tiêu chí chấp nhận

**Kịch bản 6.1 — Đủ dữ liệu**

- Cho rằng the session contains enough speaking data.
- Khi analysis is hoàn chỉnhd.
- Thì the system displays session summary, Communication Skills metrics, strengths, improvement areas and next practice recommendations.

**Kịch bản 6.2 — Dữ liệu không đủ**

- Cho rằng the session contains insufficient speaking data.
- Khi analysis is hoàn chỉnhd.
- Thì the system does not fabricate scores.
- Và the system displays an `INSUFFICIENT_DATA` state.
- Và the user is encouraged to hoàn chỉnh another practice session.

### Quy tắc nghiệp vụ

- Feedback must be actionable.
- Hệ thống nên prioritize the most relevant improvement areas.
- A metric may be `N/A` when sufficient data is unkhả dụng.
- STT confidence must not automatically be interpreted as a literal pronunciation percentage unless the STT provider explicitly supports that interpretation.

### Truy xuất nguồn gốc

`F-01 → US-06 → FR-06`

---

## US-07: Khôi phục từ lỗi giọng nói/mạng/AI

**Với vai trò là** người học,  
**Tôi muốn** có thể khôi phục sau các lỗi kỹ thuật tạm thời,  
**để** tôi không bị mất phiên luyện tập một cách không cần thiết.

### Tiêu chí chấp nhận

- Cho rằng the microphone becomes unkhả dụng, when the system detects the problem, then the user receives a clear error message and can retry microphone access.
- Cho rằng the network temporarily disconnects, when the connection is restored, then the system attempts to continue or synchronize pending data and previously saved transcript data is preserved.
- Cho rằng an AI response times out, when retry fails, then the system displays a user-friendly error and the previous user utterance remains preserved.

### Truy xuất nguồn gốc

`F-01 → US-07 → FR-07`

---

## US-08: Xử lý phiên quá ngắn

**Với vai trò là** người học,  
**Tôi muốn** biết khi nào không có đủ dữ liệu để tạo báo cáo có ý nghĩa,  
**để** tôi không nhận được các điểm hiệu suất gây hiểu nhầm.

### Tiêu chí chấp nhận

- Cho rằng the user ends the session after insufficient speaking activity.
- Khi feedback is generated.
- Thì the system marks the feedback as `INSUFFICIENT_DATA`.
- Và unkhả dụng metrics are shown as `N/A`.
- Và the system suggests continuing with another session.

### Truy xuất nguồn gốc

`F-01 → US-08 → FR-08`

---

# 5. Yêu cầu chức năng

## 5.1 Yêu cầu chung

Hệ thống phải:

1. Apply the same session state model across AI Coach screens and backend services.
2. Associate all transcript segments and metrics with a unique session.
3. Preserve chronological ordering of transcript segments.
4. Distinguish partial and final transcript states.
5. Prevent additional microphone capture after a session is hoàn chỉnhd.
6. Preserve alsẵn sàng saved session data when a tạm thời service failure occurs.
7. Use authorized user identity when reading/writing session data.
8. Avoid generating feedback from missing data by silently inventing values.
9. Provide consistent status and error messages across the AI Coach flow.

## 5.2 Functional Requirement Details

# FR-01: Tạo phiên AI Coach cá nhân hóa

### Mô tả

The system shall create an AI Coach session using the user's profile and selected conversation context.

### Điều kiện trước

- Người dùng đã được xác thực.
- Có thể truy cập hồ sơ người dùng.
- Tính năng AI Coach khả dụng.

### Dữ liệu đầu vào

| Trường   | Loại   | Bắt buộc | Mô tả                      |
| -------- | ------ | -------- | -------------------------- |
| `topic`  | String | Yes      | Conversation topic         |
| `goal`   | String | No       | Optional session objective |
| `userId` | UUID   | Yes      | Authenticated user         |

### Hành vi hệ thống

1. Load user profile.
2. Validate minimum required profile information.
3. Determine conversation level.
4. Build AI context.
5. Create `CoachSession`.
6. Set status to `ACTIVE` after successful initialization.
7. Start the conversation.

### Quy tắc nghiệp vụ

- Level must be one of `A1`, `A2`, `B1`, `B2`, `C1`.
- AI should use interests to make the conversation relevant.
- AI may use known weak points as hidden practice targets.
- Hệ thống phải not expose internal weakness labels in a way that embarrasses the learner.

### Điều kiện sau

- A unique `sessionId` exists.
- Session status is `ACTIVE`.
- Initial AI context is khả dụng.

---

# FR-02: Xử lý hội thoại bằng giọng nói

### Mô tả

The system shall capture user voice input, send it to STT, process the resulting utterance and obtain an AI response.

### Điều kiện trước

- Phiên ở trạng thái `ACTIVE`.
- Microphone khả dụng.
- Người dùng đã cấp quyền microphone.

### Đặc tả Use Case

| Hành động người dùng   | Hành vi hệ thống           |
| ---------------------- | -------------------------- |
| Start speaking         | Capture microphone audio   |
| Continue speaking      | Send/process audio for STT |
| Pause briefly          | Continue listening         |
| Finish utterance       | Finalize transcript        |
| Submit final utterance | Send context to AI         |
| AI generates response  | Display/play AI response   |
| AI finishes            | Return to listening state  |

### Điều kiện sau

- User utterance is associated with the session.
- AI response is associated with the session.
- Phiên tiếp tục hoạt động unless an error or end-session event occurs.

---

# FR-03: Xử lý Live Script

### Mô tả

The system shall display user and AI speech as a chronological real-time transcript.

### Quy tắc nghiệp vụ

1. Partial transcript can change.
2. Final transcript is treated as hoàn chỉnhd.
3. Each segment contains speaker information.
4. Each segment should have timing information.
5. The newest segment should be visible automatically.
6. User can review previous transcript content.
7. If STT confidence is khả dụng, it is stored as a signal for later analysis.

### Trạng thái Transcript

| Trạng thái | Ý nghĩa                        |
| ---------- | ------------------------------ |
| `PARTIAL`  | Temporary transcript           |
| `FINAL`    | Completed transcript           |
| `FAILED`   | Transcript đang xử lý thất bại |

### Điều kiện sau

A successfully finalized segment is stored with `segmentId`, `sessionId`, `speaker`, `text`, `startTime`, `endTime`, `confidence` when khả dụng, and `isFinal=true`.

---

# FR-04: Theo dõi ngập ngừng và tốc độ phản hồi

### Mô tả

The system shall collect basic signals related to speaking hesitation and response speed for post-session analysis.

### Quy tắc nghiệp vụ

**BR-04-01 — Thời gian phản hồi**

```text
Response Time =
User First Speech Timestamp
-
AI Prompt Finished Timestamp
```

**BR-04-02 — Ngập ngừng**

Hệ thống có thể record response delay, speech pauses, filler-word occurrences, repeated words and self-corrections.

**BR-04-03 — Diễn giải**

Hesitation must not automatically be interpreted as lack of knowledge. Short pauses are normal in spoken conversation and should not cause session termination.

### Điều kiện sau

Hesitation-related metrics are khả dụng when enough timing/transcript data exists.

---

# FR-05: Kết thúc phiên

### Mô tả

The system shall provide a controlled process for ending an active AI Coach session.

### Đặc tả Use Case

| Hành động người dùng | Hành vi hệ thống            |
| -------------------- | --------------------------- |
| Click `End Session`  | End according to UI flow    |
| Confirm ending       | Stop microphone             |
| Stop microphone      | Finalize pending transcript |
| Finalize data        | Aggregate session metrics   |
| Aggregate hoàn chỉnh | Set session to `COMPLETED`  |
| Completed            | Start feedback generation   |

### Quy tắc nghiệp vụ

- A hoàn chỉnhd session must not accept new voice input.
- Existing transcript must not be deleted when ending.
- If finalization fails, khả dụng data must be preserved and the appropriate status reported.

---

# FR-06: Tạo Phản hồi sau phiên

### Mô tả

The system shall analyze hoàn chỉnhd session data and generate an actionable report.

### Dữ liệu đầu vào

- User profile;
- conversation topic;
- AI prompts;
- user transcript;
- AI transcript;
- timestamps;
- hesitation signals;
- filler signals;
- STT confidence when khả dụng.

### Đầu ra

| Đầu ra                  | Mô tả                                                  |
| ----------------------- | ------------------------------------------------------ |
| Session Summary         | Duration, speaking time, topic and interaction summary |
| Fluency                 | Speech continuity and hesitation-related signals       |
| Listening Comprehension | Relevance of user responses to AI prompts              |
| Vocabulary Context      | Variety and contextual appropriateness                 |
| Response Speed          | Time taken to begin responding                         |
| Pronunciation           | Available pronunciation-related signal                 |
| Strengths               | 2–3 useful positive observations                       |
| Improvements            | Key areas to improve                                   |
| Next Practice           | Concrete activities for the next session               |

### Quy tắc nghiệp vụ

- Do not generate unsupported scores.
- Do not represent STT confidence as an exact pronunciation percentage unless supported by the provider.
- Feedback should be suitable for the user's level.
- Feedback should focus on actionable learning behavior.

---

# FR-07: Xử lý lỗi kỹ thuật

## FR-07.1 Từ chối quyền microphone

**Precondition:** User has not granted microphone permission.

**Hành vi hệ thống:**

1. Do not start active voice capture.
2. Explain that microphone permission is required.
3. Provide a retry action.
4. Do not generate a normal speaking report without speaking data.

## FR-07.2 Mất kết nối microphone

**Kịch bản:** Microphone becomes unkhả dụng during an active session.

**Hành vi hệ thống:**

1. Detect microphone failure.
2. Pause audio capture.
3. Display a clear message.
4. Allow `Retry Microphone`.
5. Preserve existing transcript/session data.
6. Do not immediately terminate the session.

**Ví dụ thông báo:**

> We can't hear you. Please check your microphone and try again.

## FR-07.3 Mất kết nối mạng

**Kịch bản:** Network connection is lost during a session.

**Hành vi hệ thống:**

1. Show `Reconnecting`.
2. Preserve data alsẵn sàng saved locally/server-side.
3. Retry according to the application's retry policy.
4. Synchronize pending data after reconnection where possible.
5. If recovery fails, allow the user to save a partial session where technically supported.

## FR-07.4 STT quá thời gian chờ

**Kịch bản:** STT does not return a result within the configured timeout.

**Hành vi hệ thống:**

1. Show đang xử lý/retry status.
2. Retry the STT operation.
3. Prevent duplicate transcript segments.
4. If retry fails, allow the user to repeat the utterance.

## FR-07.5 Độ tin cậy STT thấp

**Kịch bản:** STT returns a low-confidence result.

**Hành vi hệ thống:**

- Do not automatically classify pronunciation as incorrect.
- Mark the segment as uncertain when supported.
- Request clarification/repetition where appropriate.
- Use the signal cautiously in feedback.

## FR-07.6 AI phản hồi quá thời gian chờ

**Kịch bản:** AI does not return a response.

**Hành vi hệ thống:**

1. Display a đang xử lý state.
2. Retry according to the configured retry policy.
3. If unsuccessful, display a friendly error.
4. Preserve the user's previous utterance.
5. Keep the session recoverable when possible.

## FR-07.7 Phản hồi AI trùng lặp

**Kịch bản:** A client retry causes the same AI request to be submitted more than once.

**Hành vi hệ thống:**

- Use a unique request/message identifier.
- Backend should support idempotent đang xử lý where applicable.
- The same response must not be stored or played twice.

## FR-07.8 Người dùng ngập ngừng trong thời gian ngắn

**Kịch bản:** User pauses while thinking.

**Hành vi hệ thống:**

- Continue listening.
- Do not immediately interrupt.
- Do not terminate the session.
- Record the pause as a possible fluency signal.

## FR-07.9 Người dùng ngập ngừng trong thời gian dài

**Kịch bản:** User remains silent beyond the configured assistance threshold.

**Hành vi hệ thống:**

- Keep the session khả dụng for response.
- Optionally provide a supportive cue.
- Cue should help the user start speaking rather than reveal the entire answer.

Ví dụ:

```text
Take your time. You can start with:
"I think..."
```

## FR-07.10 Phản hồi chỉ gồm từ đệm

**Kịch bản:** User says only filler words for a short period.

**Hành vi hệ thống:**

- Continue listening.
- Record filler signals.
- Do not terminate the session.
- Provide improvement feedback after the session.

## FR-07.11 Phiên quá ngắn

**Kịch bản:** User ends the session before enough speech is khả dụng.

**Hành vi hệ thống:**

- Mark feedback `INSUFFICIENT_DATA`.
- Do not invent scores.
- Show khả dụng session information.
- Suggest another session.

## FR-07.12 Người dùng đi lệch chủ đề

**Kịch bản:** User's response moves away from the current topic.

**Hành vi hệ thống:**

The AI should attempt a natural transition back to the intended topic instead of immediately rejecting the response.

## FR-07.13 AI không hiểu người dùng

**Kịch bản:** AI cannot confidently interpret the user's response.

**Hành vi hệ thống:**

The AI should request clarification or rephrasing rather than inventing the user's intended meaning.

## FR-07.14 Ứng dụng / trình duyệt trở nên không hoạt động

**Kịch bản:** Browser tab or application becomes inactive.

**Hành vi hệ thống:**

- Follow browser/device audio lifecycle rules.
- If voice capture cannot continue, pause the session.
- Do not silently record outside an active session.
- Allow the user to resume where supported.

## FR-07.15 Lưu phản hồi thất bại

**Kịch bản:** Feedback is generated but cannot be persisted.

**Hành vi hệ thống:**

- Do not display a false success state.
- Retry persistence where appropriate.
- Preserve report data temporarily where technically supported.
- Avoid creating duplicate feedback records.

---

# 6. Yêu cầu về Kỹ năng giao tiếp

## FR-08: Các chỉ số giao tiếp

Hệ thống có thể calculate the following metrics from khả dụng session data.

### 6.1 Điểm độ trôi chảy

Signals may include pause frequency, filler frequency, continuity of speech, repeated words and self-correction. Fluency should not be calculated solely from speaking speed.

### 6.2 Khả năng nghe hiểu

The system evaluates whether the user's response addresses the AI's question or conversational intent.

### 6.3 Từ vựng theo ngữ cảnh

The system evaluates vocabulary variety and contextual appropriateness rather than relying only on raw unique-word count.

### 6.4 Tốc độ phản hồi

Measures the delay between AI prompt completion and the user's first speech.

### 6.5 Độ chính xác phát âm

Pronunciation-related feedback may use khả dụng provider signals. If reliable pronunciation data is unkhả dụng:

```text
Pronunciation: N/A
```

Hệ thống phải not fabricate a pronunciation score.

---

# 7. Yêu cầu phi chức năng

## NFR-01: Hiệu năng

| ID       | Requirement                                                                              | Verification        |
| -------- | ---------------------------------------------------------------------------------------- | ------------------- |
| NFR-01.1 | Live Script should display khả dụng partial STT results without unnecessary UI blocking. | Integration test    |
| NFR-01.2 | Final transcript đang xử lý should not freeze the conversation UI.                       | UI test             |
| NFR-01.3 | Feedback generation must expose a đang xử lý state while analysis is running.            | UI/integration test |

Exact latency targets should be confirmed with the technical team before becoming release thresholds.

## NFR-02: Độ tin cậy

- Temporary network failure must not automatically erase saved session data.
- Retry operations must not create duplicate transcript or AI messages.
- Session state transitions must be consistent.

## NFR-03: Bảo mật và quyền riêng tư

- Only authenticated users can access their own sessions.
- User audio/transcript data must not be exposed to another user.
- Microphone capture must occur only during an active voice interaction.
- Hệ thống phải stop capture when the session ends.
- Access to session and feedback APIs must be authorized.

## NFR-04: Khả năng sử dụng

- Microphone status must be visible.
- Speaking/listening states must be understandable.
- Live Script text must be readable.
- Error messages must tell the user what action can be taken.
- Feedback must avoid overwhelming the learner with excessive corrections.

## NFR-05: Khả năng tiếp cận

- Important controls should be keyboard accessible where supported.
- Trạng thái should not be communicated only through color.
- Text alternatives should exist for important voice interactions where applicable.
- Font sizes and controls should remain readable on supported browsers.

## NFR-06: Tương thích

The MVP should support modern browsers with microphone/audio capture support and the real-time communication mechanism selected by the technical architecture. The exact browser/version matrix is TBD.

## NFR-07: Ghi log và giám sát

Hệ thống nên log technical events needed to diagnose microphone initialization failure, STT failure, AI response failure, network/reconnection events, session finalization failure and feedback persistence failure.

Logs must avoid unnecessarily storing sensitive raw audio or personal data.

---

# 8. Yêu cầu giao diện

## 8.1 Giao diện người dùng

### Màn hình 1 — Bắt đầu AI Coach

Bắt buộc information:

- Topic;
- user level;
- optional goal;
- Start Session button.

### Màn hình 2 — AI Coach đang hoạt động

Bắt buộc elements:

- AI response area;
- microphone status;
- speaking/listening state;
- Live Script;
- End Session action;
- connection/error status.

### Màn hình 3 — Phản hồi sau phiên

Bắt buộc sections:

```text
Session Summary
      ↓
Communication Skills
      ↓
Strengths
      ↓
Areas to Improve
      ↓
Next Practice
```

## 8.2 Giao diện API

Suggested MVP endpoints:

### POST `/api/coach/sessions`

Tạo một phiên mới.

### POST `/api/coach/sessions/{sessionId}/transcript`

Lưu/hoàn tất một đoạn transcript.

### POST `/api/coach/sessions/{sessionId}/end`

Ends an active session.

### GET `/api/coach/sessions/{sessionId}/feedback`

Returns generated feedback.

Exact API paths and schemas are implementation details and must be aligned with the project's actual backend contract before development.

## 8.3 External Services

| Service                | Mục đích                                    |
| ---------------------- | ------------------------------------------- |
| Browser Microphone API | Capture user voice                          |
| STT Provider           | Convert voice to text                       |
| AI Provider            | Generate conversation and feedback          |
| Backend API            | Session and data management                 |
| Database               | Persist profile/session/transcript/feedback |

---

# 9. Yêu cầu dữ liệu

## 9.1 Hồ sơ người dùng

| Trường              | Loại   | Mô tả                     |
| ------------------- | ------ | ------------------------- |
| `userId`            | UUID   | User identifier           |
| `level`             | Enum   | A1–C1                     |
| `interests`         | List   | Topics of interest        |
| `communicationGoal` | String | Communication goal        |
| `weakPoints`        | List   | Known learning weaknesses |
| `preferredTopics`   | List   | Preferred practice topics |

## 9.2 Phiên Coach

| Trường            | Loại     | Mô tả                  |
| ----------------- | -------- | ---------------------- |
| `sessionId`       | UUID     | Unique session         |
| `userId`          | UUID     | Owner                  |
| `topic`           | String   | Topic                  |
| `goal`            | String   | Session goal           |
| `level`           | Enum     | Level used by AI       |
| `startedAt`       | DateTime | Start time             |
| `endedAt`         | DateTime | End time               |
| `status`          | Enum     | Session state          |
| `durationSeconds` | Integer  | Total duration         |
| `spokenSeconds`   | Integer  | User speaking duration |

### Trạng thái phiên

```text
CREATED
ACTIVE
ENDING
COMPLETED
FAILED
```

## 9.3 Đoạn Transcript

| Trường       | Loại          | Mô tả                      |
| ------------ | ------------- | -------------------------- |
| `segmentId`  | UUID          | Segment ID                 |
| `sessionId`  | UUID          | Session                    |
| `speaker`    | Enum          | USER / AI                  |
| `text`       | String        | Transcript                 |
| `startTime`  | Number        | Start timestamp            |
| `endTime`    | Number        | End timestamp              |
| `confidence` | Number / null | STT confidence if khả dụng |
| `isFinal`    | Boolean       | Final or partial           |
| `status`     | Enum          | PARTIAL / FINAL / FAILED   |

## 9.4 Phản hồi phiên

| Trường               | Loại          | Mô tả                                           |
| -------------------- | ------------- | ----------------------------------------------- |
| `sessionId`          | UUID          | Related session                                 |
| `fluencyScore`       | Number / null | Fluency                                         |
| `listeningScore`     | Number / null | Listening                                       |
| `vocabularyScore`    | Number / null | Vocabulary                                      |
| `responseSpeedScore` | Number / null | Response speed                                  |
| `pronunciationScore` | Number / null | Pronunciation                                   |
| `strengths`          | List          | Positive observations                           |
| `improvements`       | List          | Improvement areas                               |
| `nextPractice`       | List          | Recommended practice                            |
| `status`             | Enum          | PROCESSING / READY / INSUFFICIENT_DATA / FAILED |

---

# 10. Thông báo hệ thống

| Code        | Loại    | Kịch bản              | Ví dụ                                                      |
| ----------- | ------- | --------------------- | ---------------------------------------------------------- |
| MIC-ERR-01  | Error   | Microphone unkhả dụng | We can't hear you. Check your microphone and try again.    |
| MIC-WRN-01  | Warning | Permission required   | Microphone permission is required to practice speaking.    |
| NET-WRN-01  | Warning | Reconnecting          | Connection lost. Trying to reconnect...                    |
| STT-ERR-01  | Error   | STT thất bại          | We couldn't process your speech. Please try again.         |
| AI-ERR-01   | Error   | AI response thất bại  | I'm having trouble responding right now. Let's try again.  |
| DATA-WRN-01 | Warning | Insufficient data     | Not enough speaking data for a hoàn chỉnh report yet.      |
| SES-INF-01  | Info    | Feedback đang xử lý   | Your session is hoàn chỉnh. We're preparing your feedback. |

---

# 11. Chuyển đổi trạng thái

## 11.1 Trạng thái phiên

```text
CREATED
   |
   v
ACTIVE
   |
   +--------------------+
   |                    |
   v                    v
ENDING                FAILED
   |
   v
COMPLETED
```

## 11.2 Trạng thái giọng nói/Transcript

```text
LISTENING
    |
    v
TRANSCRIBING
    |
    +----> FAILED
    |
    v
FINAL
    |
    v
AI PROCESSING
    |
    v
AI SPEAKING
    |
    v
LISTENING
```

---

# 12. Ma trận truy xuất nguồn gốc

| Chức năng | User Story | Yêu cầu chức năng | Phạm vi kiểm thử chính           |
| --------- | ---------- | ----------------- | -------------------------------- |
| F-01      | US-01      | FR-01             | Session creation/personalization |
| F-01      | US-02      | FR-02             | Voice conversation               |
| F-01      | US-03      | FR-03             | Live Script                      |
| F-01      | US-04      | FR-04             | Hesitation/response speed        |
| F-01      | US-05      | FR-05             | Session ending                   |
| F-01      | US-06      | FR-06, FR-08      | Feedback/metrics                 |
| F-01      | US-07      | FR-07             | Error recovery                   |
| F-01      | US-08      | FR-06             | Insufficient data                |

---

# 13. Tổng hợp tiêu chí chấp nhận

## AC-01 — Session Creation

- [ ] User can start an AI Coach session.
- [ ] Session receives a unique ID.
- [ ] User profile context is loaded.
- [ ] AI uses the configured level and topic.

## AC-02 — Voice Conversation

- [ ] User can provide microphone input.
- [ ] STT processes the input.
- [ ] AI receives finalized user utterances.
- [ ] AI provides a contextual response.

## AC-03 — Live Script

- [ ] Partial transcript is displayed.
- [ ] Final transcript is displayed.
- [ ] User and AI are distinguishable.
- [ ] Transcript is chronologically ordered.

## AC-04 — Hesitation

- [ ] Short hesitation does not end the session.
- [ ] Hesitation can be recorded for analysis.
- [ ] Filler words can contribute to fluency analysis.
- [ ] AI can provide a supportive cue after a configured threshold.

## AC-05 — Post-Session Feedback

- [ ] Session summary is displayed.
- [ ] Available communication metrics are displayed.
- [ ] Strengths are displayed.
- [ ] Improvement areas are displayed.
- [ ] Next practice is displayed.
- [ ] Missing metrics are not fabricated.

## AC-06 — Microphone Failure

- [ ] Microphone failure is detected.
- [ ] User receives a clear message.
- [ ] User can retry.
- [ ] Existing session data remains khả dụng.

## AC-07 — Network Failure

- [ ] Connection loss is visible.
- [ ] Reconnection is attempted.
- [ ] Previously saved data is preserved.
- [ ] Duplicate records are avoided.

## AC-08 — Insufficient Data

- [ ] System does not create misleading scores.
- [ ] Feedback is marked `INSUFFICIENT_DATA`.
- [ ] User receives a next-step recommendation.

---

# 14. Kịch bản kiểm thử / Danh sách kiểm tra trường hợp biên

| ID    | Kịch bản                                | Kết quả mong đợi                          |
| ----- | --------------------------------------- | ----------------------------------------- |
| TC-01 | Start session with valid profile        | Phiên chuyển sang ACTIVE                  |
| TC-02 | Start session with inhoàn chỉnh profile | Missing information is handled explicitly |
| TC-03 | Microphone permission denied            | Session does not start voice capture      |
| TC-04 | Microphone disconnected during speech   | Session pauses/recovery is offered        |
| TC-05 | Network lost during speech              | Reconnect/preserve data                   |
| TC-06 | STT partial result                      | Partial Live Script shown                 |
| TC-07 | STT final result                        | Final segment saved                       |
| TC-08 | Low STT confidence                      | No automatic pronunciation failure        |
| TC-09 | User pauses briefly                     | AI continues listening                    |
| TC-10 | User pauses for long time               | Supportive cue may appear                 |
| TC-11 | User uses filler words                  | Filler signal recorded                    |
| TC-12 | AI response timeout                     | Retry/error handling                      |
| TC-13 | Duplicate AI request                    | No duplicate response                     |
| TC-14 | User ends during AI speech              | Audio stops and session finalizes         |
| TC-15 | Very short session                      | INSUFFICIENT_DATA                         |
| TC-16 | Feedback persistence fails              | Retry/error, no false success             |
| TC-17 | User goes off topic                     | AI redirects naturally                    |
| TC-18 | AI cannot understand                    | AI requests clarification                 |

---

# 15. Phụ lục

## Phụ lục A — Luồng nghiệp vụ cốt lõi

```text
[Login / Register]
        |
        v
[Complete Profile]
        |
        v
[Choose Level & Topic]
        |
        v
[Start AI Coach]
        |
        v
[Create Session]
        |
        v
[Request Microphone]
        |
        v
[User Speaks]
        |
        v
[STT]
        |
        +--------------------+
        |                    |
        v                    v
[Live Script]        [Session Metrics]
        |                    |
        +---------+----------+
                  |
                  v
          [AI Context Analysis]
                  |
                  v
           [AI Response]
                  |
                  v
           [AI Voice Đầu ra]
                  |
                  v
          [User Speaks Again]
                  |
                  v
             [Repeat]
                  |
                  v
            [End Session]
                  |
                  v
         [Finalize Transcript]
                  |
                  v
         [Analyze Session Data]
                  |
                  v
        [Post-Session Feedback]
                  |
                  v
        [Next Practice Activity]
```

## Phụ lục B — Ví dụ Phản hồi

```text
SESSION SUMMARY
Topic: Weekend Travel
Duration: 6m 24s
Speaking Time: 4m 51s

COMMUNICATION SKILLS
Fluency: 78
Listening Comprehension: 84
Vocabulary Context: 72
Response Speed: 69
Pronunciation: N/A

STRENGTHS
- You kept the conversation going.
- You answered questions with relevant details.
- You used several travel-related expressions naturally.

AREAS TO IMPROVE
- Practice past tense when describing previous events.
- Try reducing filler words before longer answers.
- Start responses a little sooner.

NEXT PRACTICE
1. Tell a one-minute story about your last trip.
2. Practice five travel expressions.
3. Answer three questions without translating mentally first.
```

## Phụ lục C — Tiêu chí hoàn thành MVP

The feature is considered sẵn sàng for MVP when:

- [ ] All core user stories are implemented.
- [ ] Main acceptance criteria pass.
- [ ] Live Script supports partial and final transcript.
- [ ] Session state is persisted correctly.
- [ ] Microphone failure is recoverable.
- [ ] Network/STT/AI failures have defined recovery behavior.
- [ ] Hesitation does not cause unnecessary interruption.
- [ ] Post-Session Feedback is generated from actual session data.
- [ ] Insufficient data does not produce fabricated scores.
- [ ] User can see clear next-practice recommendations.
- [ ] Access to session data is authorized.
- [ ] QA has executed the edge-case checklist.

## Phụ lục D — Các yêu cầu cần làm rõ

The following values are intentionally left as configurable/TBD rather than being invented in this SRS:

1. Exact partial-STT latency target.
2. Exact long-hesitation threshold.
3. Exact AI response timeout.
4. Exact retry count/backoff policy.
5. Supported browser/version matrix.
6. Final AI/STT provider.
7. Final scoring formula for each Communication Skill metric.
8. Final data-retention period for audio/transcript data.

These values should be confirmed with Product Owner and technical stakeholders before becoming implementation-level acceptance thresholds.
