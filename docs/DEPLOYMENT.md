# 🚀 Deployment & DevOps Specification (Hướng dẫn Triển khai)

Tài liệu này hướng dẫn cách đóng gói ứng dụng **TalkWithMe** bằng **Docker**, thiết lập môi trường phát triển (Development) và triển khai lên môi trường sản xuất (Production).

---

## 1. Cấu Trúc Docker Container (Docker Architecture)

Dự án bao gồm 4 container chính chạy đồng bộ qua `docker-compose`:
1. `frontend`: Angular Single Page Application (được build bằng Nginx server).
2. `backend`: FastAPI Uvicorn Server.
3. `postgres`: PostgreSQL Database 16.
4. `redis`: Redis 7 Cache & Pub/Sub Server.

---

## 2. File Mẫu `docker-compose.yml` (Tại thư mục gốc dự án)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: talkwithme_postgres
    restart: always
    environment:
      POSTGRES_DB: talkwithme_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: talkwithme_redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: talkwithme_backend
    restart: always
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgrespassword@postgres:5432/talkwithme_db
      - REDIS_URL=redis://redis:6379/0
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    depends_on:
      - postgres
      - redis

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: talkwithme_frontend
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
```

---

## 3. Cấu hình Biến Môi Trường (`.env`)

Tạo file `.env` tại thư mục gốc và thư mục `/backend`:

```env
# Server Config
ENVIRONMENT=development
PORT=8000
SECRET_KEY=your_super_secret_jwt_key_here_change_in_production

# Database Config
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgrespassword
POSTGRES_DB=talkwithme_db
DATABASE_URL=postgresql+asyncpg://postgres:postgrespassword@localhost:5432/talkwithme_db

# Redis Config
REDIS_URL=redis://localhost:6379/0

# External AI Keys (Free Tier)
GEMINI_API_KEY=your_gemini_api_key_from_google_ai_studio
GROQ_API_KEY=your_groq_api_key_optional
```

---

## 4. Cấu hình Nginx Proxy & WebSockets (Production Configuration)

Để hỗ trợ ứng dụng Angular SPA và kết nối WebSocket bền vững, Nginx trên server đóng vai trò Reverse Proxy:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Serve Angular Static Files
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy REST API Requests
    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Proxy Realtime WebSocket Connections
    location /ws/ {
        proxy_pass http://backend:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s; # Giữ kết nối WebSocket không bị đứt
    }
}
```
