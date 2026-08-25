# 🗺 Development Roadmap & Phased Execution (Lộ Trình Phát Triển Dự Án)

Để đảm bảo sản phẩm ra mắt đúng tiến độ và xác thực được mô hình nhanh nhất, dự án **TalkWithMe** được chia thành 4 giai đoạn phát triển chiến lược.

---

## 📅 Giai Đoạn 1: Setup Infrastructure & Core Engine (Tuần 1)
> **Mục tiêu**: Xây dựng xong nền tảng kỹ thuật cơ bản cho cả Frontend & Backend.

* [x] **Khởi tạo bộ tài liệu chuẩn**: PRD, Architecture, Feature Spec, Database Design, API Spec, Deployment.
* [ ] **Khởi tạo Codebase**:
  * Setup Angular 18 project với Standalone components và cấu trúc CSS layout Glassmorphic / Dark mode.
  * Setup FastAPI project với Async SQLAlchemy/SQLModel và kết nối Postgres, Redis.
  * Tạo file `docker-compose.yml` chạy local Postgres & Redis.
* [ ] **Tích hợp Voice Base Core**:
  * Triển khai `WebSpeechService` ở Angular để bắt tiếng Anh từ Microphone.
  * Triển khai `edge-tts` service ở FastAPI để tạo file âm thanh từ văn bản.
  * Thiết lập WebSocket handshake 2 chiều đơn giản giữa Angular và FastAPI.

---

## 📅 Giai Đoạn 2: MVP Core Launch — Personalized AI Coach (Tuần 2 - Tuần 3)
> **Mục tiêu**: Hoàn thiện tính năng quan trọng nhất — Trò chuyện Voice + Live Script với AI Coach.

* [ ] **Tích hợp Gemini 2.0 Flash API**:
  * Thiết lập System Prompt cá nhân hóa theo User Profile (Level A1 - C1, sở thích).
  * Xử lý lưu lịch sử hội thoại (Short-term context) vào Redis.
* [ ] **Màn hình Trò chuyện Voice + Live Transcript**:
  * Thiết kế UI/UX ấn tượng: Nút Mic sóng âm (Audio visualizer animation), luồng chạy chữ Script thời gian thực.
  * Không ngắt lời người dùng khi đang phát biểu.
* [ ] **Post-Session Review Dashboard**:
  * Khi kết thúc cuộc gọi, AI phân tích lại toàn bộ hội thoại và đưa ra bảng tổng kết: *Grammar corrections, Good expressions, Fluency score*.
  * Lưu trữ thông tin session vào CSDL PostgreSQL.

---

## 📅 Giai Đoạn 3: Lessons & Gamified Progress (Tuần 4)
> **Mục tiêu**: Bổ sung nội dung thực hành tình huống và hệ thống thúc đẩy động lực học tập.

* [ ] **Scenario-based Lessons**:
  * Xây dựng bộ bài học mẫu: *Daily Life, Travel, Work Communication*.
  * Chế độ nhập vai Roleplay Challenge với tiêu chí hoàn thành nhiệm vụ.
* [ ] **Hệ thống Level & Missions**:
  * Tính điểm XP, cập nhật Rank (Beginner $\rightarrow$ Fluent).
  * Hệ thống Nhiệm vụ hàng ngày (Daily Missions) & Đếm chuỗi ngày học (Streak).

---

## 📅 Giai Đoạn 4: Phase 2 Expansion — Community Voice Rooms (Tuần 5+)
> **Mục tiêu**: Mở rộng tương tác cộng đồng giữa các người dùng thật.

* [ ] **Voice Chatrooms 3 - 5 Người**:
  * Triển khai Redis Pub/Sub để phát Live Script của từng user lên màn hình chung của phòng.
  * Tích hợp Invisible AI Assistant: Tự động mồi câu hỏi khi phòng im lặng > 15 giây.
* [ ] **Thử thách Phản xạ 5s (Quick Response Challenge)**:
  * Đếm ngược 5 giây ép người dùng phản xạ tiếng Anh tức thì.
