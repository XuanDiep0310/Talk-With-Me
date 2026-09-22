# 🎙 TalkWithMe — English Communication Platform (Production Monorepo)

> **"Không dạy tiếng Anh hàn lâm. Chỉ giúp bạn giao tiếp tự nhiên và tự tin hơn thông qua thực hành thực tế."**

TalkWithMe là nền tảng học tiếng Anh giao tiếp thế hệ mới, kiến trúc theo chuẩn monorepo hiện đại, sạch (Clean Architecture), sẵn sàng cho môi trường production với quy trình CI/CD tự động.

---

## 🏗 Cấu Trúc Monorepo (Monorepo Directory Structure)

```
talk-with-me/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # PR Pipeline: Lint -> Unit Test -> Integration Test -> Build
│       └── cd.yml                 # CD Pipeline: CI -> Build Docker -> Push Registry -> Deploy
├── backend/
│   ├── app/
│   │   ├── api/                   # API Routers & Dependency Injection (FastAPI Depends)
│   │   │   ├── v1/
│   │   │   │   ├── endpoints/
│   │   │   │   │   └── health.py  # Health check APIs (App, Database, Redis)
│   │   │   │   └── router.py
│   │   │   └── deps.py
│   │   ├── core/                  # Configurations, DB engine & Redis clients
│   │   │   ├── config.py          # Pydantic BaseSettings (No hardcoded secrets)
│   │   │   ├── database.py        # Async SQLAlchemy Engine & Session
│   │   │   ├── redis.py           # Async Redis Connection Pool
│   │   │   └── exceptions.py
│   │   ├── models/                # SQLAlchemy ORM & Pydantic Data Models
│   │   │   ├── base.py
│   │   │   └── health.py
│   │   ├── repositories/          # Data Access Layer
│   │   │   ├── base.py
│   │   │   └── health.py
│   │   ├── services/              # Business Logic Layer
│   │   │   └── health.py
│   │   └── main.py                # FastAPI Application & Lifespan handler
│   ├── alembic/                   # Database Migrations (Async SQLAlchemy)
│   │   ├── env.py
│   │   └── versions/
│   ├── tests/
│   │   ├── unit/                  # Pytest Unit Tests
│   │   ├── integration/           # Pytest Integration Tests (Real DB & Redis)
│   │   └── conftest.py
│   ├── alembic.ini
│   ├── pyproject.toml             # Ruff, Mypy & Pytest configurations
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── Dockerfile                 # Multi-stage production container
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/              # Services, Interceptors, Models
│   │   │   ├── features/          # Feature Modules & Standalone Components
│   │   │   │   └── health/        # System Health & Diagnostic Dashboard
│   │   │   ├── app.config.ts
│   │   │   ├── app.routes.ts
│   │   │   └── app.component.ts
│   │   ├── environments/          # Environment configs (dev, prod)
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── styles.scss
│   ├── angular.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── eslint.config.js           # ESLint / Angular ESLint configuration
│   ├── nginx.conf                 # Production Nginx reverse proxy / SPA fallback
│   └── Dockerfile                 # Multi-stage production container
├── docs/                          # Comprehensive specifications & architectural blueprints
├── .env.example                   # Master environment template
├── .pre-commit-config.yaml        # Git pre-commit hooks (Ruff, Mypy, YAML)
├── docker-compose.yml             # Full-stack Compose (Postgres, Redis, Backend, Frontend)
├── docker-compose.test.yml        # Isolated Integration Test Compose
├── Makefile                       # Developer shortcuts
└── README.md
```

---

## 🛠 Tech Stack

- **Frontend**: Angular 19+ (Standalone Components, RxJS, HttpClient, SCSS)
- **Backend**: Python 3.13+ / FastAPI, Pydantic v2, SQLAlchemy 2.0 (Async/Await + asyncpg)
- **Database**: PostgreSQL 16+ & Alembic (Code-First Migrations)
- **Cache & Message Broker**: Redis 7+
- **Containers**: Docker & Docker Compose (v2)
- **Quality & Testing**: Pytest, Asyncio, Ruff, Mypy, ESLint, Pre-commit
- **CI/CD**: GitHub Actions (Strict PR verification + Container Image deployment)

---

## 🚀 Khởi Chạy Dự Án (Quick Start)

### 1. Yêu cầu môi trường
- Python 3.11+ (Khuyên dùng Python 3.13)
- Node.js 20+ & npm
- Docker & Docker Compose

### 2. Cấu hình biến môi trường
Sao chép tệp mẫu cấu hình:
```bash
cp .env.example .env
```

---

## 🐳 Chạy Bằng Docker Compose (Khuyên dùng)

### Khởi động toàn bộ hệ thống:
```bash
# Sử dụng Makefile
make docker-up

# Hoặc dùng Docker Compose trực tiếp
docker compose up --build -d
```

### Các dịch vụ khả dụng:
- **Frontend Dashboard**: [http://localhost](http://localhost) (hoặc port được cấu hình trong `.env`)
- **Backend Swagger UI**: [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`

### Dừng hệ thống:
```bash
make docker-down
# Hoặc
docker compose down -v
```

---

## 💻 Chạy Môi Trường Phát Triển (Local Development)

### 1. Khởi chạy Database & Redis (Docker)
```bash
make dev
# Hoặc: docker compose up -d postgres redis
```

### 2. Cài đặt và Chạy Backend
```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate
# Linux/macOS
source venv/bin/activate

pip install -r requirements-dev.txt

# Chạy server với hot-reload
uvicorn app.main:app --reload --port 8000
```

### 3. Cài đặt và Chạy Frontend
```bash
cd frontend
npm install
npm start
```
Frontend sẽ chạy tại [http://localhost:4200](http://localhost:4200).

---

## 🗄 Database Migrations (Alembic)

Alembic đã được cấu hình tương thích hoàn toàn với SQLAlchemy 2.0 Async:

```bash
# Di chuyển vào thư mục backend
cd backend

# Tạo file migration tự động từ models
alembic revision --autogenerate -m "Add initial tables"

# Cập nhật database lên bản mới nhất
alembic upgrade head

# Rollback phiên bản trước đó
alembic downgrade -1
```

---

## 🧪 Testing & Code Quality

### 1. Backend Testing (Pytest)
```bash
# Chạy Unit Tests
cd backend
pytest tests/unit -v --cov=app

# Chạy toàn bộ tests (bao gồm Unit và Integration Test)
pytest tests/ -v
```

### 2. Backend Integration Test Trong Docker (Isolated Environment)
Test runner sẽ khởi chạy container PostgreSQL và Redis độc lập để kiểm thử toàn diện:
```bash
make test-integration
# Hoặc:
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-test-runner
docker compose -f docker-compose.test.yml down -v
```

### 3. Frontend Testing & Linting
```bash
cd frontend

# Unit Tests (Karma / Jasmine Headless)
npm run test

# ESLint
npm run lint
```

### 4. Code Format & Static Analysis
```bash
# Kiểm tra định dạng và typecheck backend
ruff check backend
ruff format --check backend
mypy backend/app --config-file=backend/pyproject.toml

# Tự động sửa format
ruff check backend --fix
ruff format backend
```

---

## 🐙 CI/CD Pipelines (GitHub Actions)

### 1. Pull Request Pipeline (`.github/workflows/ci.yml`)
Mỗi khi tạo hoặc cập nhật Pull Request vào `main` hoặc `develop`, workflow sẽ thực hiện tuần tự:
1. **Lint**: Chạy Ruff, Mypy và ESLint.
2. **Unit Test**: Pytest (backend coverage) và Angular headless tests.
3. **Integration Test**: Khởi động PostgreSQL & Redis Service Containers và chạy test tích hợp.
4. **Build Validation**: Kiểm tra build Angular production bundle và xác thực cú pháp Docker Compose.

### 2. CD Pipeline (`.github/workflows/cd.yml`)
Khi code được merge vào `main` hoặc `develop`:
1. Chạy toàn bộ bộ kiểm thử CI.
2. Build Docker images cho Frontend & Backend tối ưu hoá bộ nhớ đệm (Buildx & GitHub Actions cache).
3. Đẩy Docker images lên **GitHub Packages / Container Registry (GHCR)**.
4. Kích hoạt bước Deploy với các cấu hình GitHub Secrets (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`).

---

## 📚 Tài Liệu Bổ Sung Trong `/docs`
- 📋 [`PRD.md`](./PRD.md) — Product Requirements & Concept.
- 🎯 [`FEATURES.md`](./docs/FEATURES.md) — Đặc tả chi tiết từng tính năng nghiệp vụ.
- 🏗 [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — Thiết kế kiến trúc tổng thể & Realtime data flow.
- 🗄 [`DATABASE_DESIGN.md`](./docs/DATABASE_DESIGN.md) — Thiết kế Schema & ERD chi tiết.
- 🔌 [`EXTERNAL_APIS.md`](./docs/EXTERNAL_APIS.md) — Chiến lược tích hợp AI (Gemini Flash, TTS, STT).
- 🐙 [`GITHUB_WORKFLOW_GUIDELINES.md`](./docs/GITHUB_WORKFLOW_GUIDELINES.md) — Quy tắc Git & PR.
