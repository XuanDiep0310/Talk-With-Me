# 🎙 TalkWithMe — English Communication Platform

> **"Không dạy tiếng Anh hàn lâm. Chỉ giúp bạn giao tiêp tự nhiên và tự tin hơn thông qua thực hành thực tế."**

TalkWithMe là nền tảng học tiếng Anh giao tiếp thế hệ mới, tập trung 100% vào phản xạ giao tiếp tự nhiên thông qua **Cá nhân hóa AI Coach**, **Tình huống thực tế (Roleplay Scenarios)**, **Phòng trò chuyện nhóm (Community Chatrooms)** và **Công nghệ Voice + Live Script thời gian thực**.

---

## 📌 Bộ Tài Liệu Dự Án Chuẩn (Project Documentation Suite)

Tài liệu chi tiết của dự án được phân chia rõ ràng trong thư mục [`/docs`](./docs/):

| STT | Tài liệu | Mô tả chi tiết |
| :---: | :--- | :--- |
| 1 | 📋 [**Product Requirements (PRD)**](./PRD.md) | Tổng quan concept sản phẩm, triết lý thiết kế và phân nhóm tính năng. |
| 2 | 🎯 [**Feature Specifications**](./docs/FEATURES.md) | Bảng chi tiết toàn bộ tính năng cốt lõi (Important Features) & Luồng nghiệp vụ. |
| 3 | 🏗 [**System Architecture**](./docs/ARCHITECTURE.md) | Kiến trúc tổng thể Angular + FastAPI + Postgres + Redis & Luồng dữ liệu Realtime. |
| 4 | 🗄 [**Database Design (Code-First)**](./docs/DATABASE_DESIGN.md) | Thiết kế DB theo phương pháp Code-First (SQLModel/SQLAlchemy 2.0), ERD & Migrations. |
| 5 | 🔌 [**External APIs & Integration**](./docs/EXTERNAL_APIS.md) | Chiến lược tích hợp AI/Voice API miễn phí (Gemini API, Web Speech API, Edge-TTS, Groq Whisper). |
| 6 | 🚀 [**Deployment & DevOps**](./docs/DEPLOYMENT.md) | Hướng dẫn đóng gói Docker Compose, Nginx Reverse Proxy, SSL & Biến môi trường. |
| 7 | 🗺 [**Development Roadmap**](./docs/DEVELOPMENT_ROADMAP.md) | Lộ trình phát triển qua từng giai đoạn (MVP, Phase 2, Nice-to-Have). |
| 8 | 🐙 [**GitHub Workflow Rules**](./docs/GITHUB_WORKFLOW_GUIDELINES.md) | Quy tắc đặt tên nhánh 1-Ticket-1-Branch, Commit Conventional, Pull Request & Code Review. |

---

## 🛠 Bộ Công Nghệ Sử Dụng (Tech Stack Summary)

* **Frontend**: Angular 18+ (Standalone Components, Angular Signals, RxJS, Custom Glassmorphism UI)
* **Backend**: FastAPI (Python 3.11+, Async/Await, WebSockets, SQLModel / Async SQLAlchemy)
* **Database**: PostgreSQL 16+ (Relational storage, JSONB support for transcripts)
* **Cache & Message Broker**: Redis 7+ (Session caching, WebSocket Pub/Sub for chatrooms)
* **AI & Audio Services**: Google Gemini 2.0 Flash (LLM), Browser Web Speech API (STT), Microsoft Edge-TTS (Voice Synthesis)

---

## 🚀 Khởi Động Nhanh (Quick Start for Developers)

### 1. Yêu cầu môi trường
* Python 3.11+
* Node.js 20+ & Angular CLI (`npm i -g @angular/cli`)
* Docker & Docker Compose (cho PostgreSQL & Redis)

### 2. Khởi tạo môi trường DB & Cache
```bash
docker-compose up -d postgres redis
```

### 3. Chạy Backend (FastAPI)
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Swagger UI API Docs sẽ có tại: `http://localhost:8000/docs`

### 4. Chạy Frontend (Angular)
```bash
cd frontend
npm install
ng serve --port 4200
```
Ứng dụng sẽ chạy tại: `http://localhost:4200`
