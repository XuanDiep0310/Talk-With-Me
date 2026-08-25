# 🗄 Database Design & Code-First Specification (Thiết kế Cơ sở Dữ liệu)

Dự án **TalkWithMe** áp dụng phương pháp **Code-First** sử dụng **SQLModel** (thư viện hiện đại kết hợp sức mạnh của SQLAlchemy 2.0 và Pydantic) trên nền tảng cơ sở dữ liệu **PostgreSQL**.

---

## 1. Triết lý Code-First & Quản lý Migrations

1. **Code-First Approach**: Tất cả các bảng CSDL (Tables), mối quan hệ (Relationships), chỉ mục (Indexes) và ràng buộc (Constraints) được định nghĩa hoàn toàn bằng Python Code tại thư mục `backend/app/models/`.
2. **Database Migrations**: Sử dụng **Alembic** để tự động theo dõi sự thay đổi của Code Model và tạo ra các bản Migration script đồng bộ với CSDL PostgreSQL mà không mất dữ liệu.

---

## 2. Sơ đồ Quan hệ Thực thể (Entity Relationship Diagram - ERD)

```text
┌─────────────────┐       1:N       ┌───────────────────────┐
│      User       ├────────────────►│  ConversationSession  │
└────────┬────────┘                 └───────────┬───────────┘
         │                                      │
         │ 1:N                                  │ 1:N
         ▼                                      ▼
┌─────────────────┐                 ┌───────────────────────┐
│   UserMission   │                 │  ConversationMessage  │
└─────────────────┘                 └───────────────────────┘
         ▲
         │ N:1
┌─────────────────┐       1:N       ┌───────────────────────┐
│     Mission     │                 │        Lesson         │
└─────────────────┘                 └───────────────────────┘
```

---

## 3. Định nghĩa Khái quát các Bảng CSDL (Code-First Data Models)

### 3.1 Bảng `users` (Thông tin người dùng & Profile giao tiếp)

```python
from enum import Enum
from typing import Optional, List
from datetime import datetime
import uuid
from sqlmodel import SQLModel, Field, Column, JSON

class UserLevel(str, Enum):
    BEGINNER = "Beginner"     # A1
    EXPLORER = "Explorer"     # A2
    SPEAKER = "Speaker"       # B1
    COMMUNICATOR = "Communicator" # B2
    FLUENT = "Fluent"         # C1

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True, nullable=False)
    hashed_password: str = Field(nullable=False)
    full_name: str = Field(nullable=False)
    avatar_url: Optional[str] = Field(default=None)
    
    # User Progress & Gamification
    level: UserLevel = Field(default=UserLevel.BEGINNER)
    xp: int = Field(default=0)
    streak_days: int = Field(default=0)
    last_active_at: Optional[datetime] = Field(default=None)

    # Communication Profile (JSON field)
    goals: List[str] = Field(default=[], sa_column=Column(JSON))
    favorite_topics: List[str] = Field(default=[], sa_column=Column(JSON))
    
    # AI Coach Memory & Skills Rating
    ai_coach_memory: dict = Field(
        default={
            "strengths": "",
            "weaknesses": [],
            "repeated_mistakes": []
        }, 
        sa_column=Column(JSON)
    )
    skills_rating: dict = Field(
        default={
            "fluency": 50,
            "listening": 50,
            "vocabulary": 50,
            "response_speed": 50,
            "pronunciation": 50
        }, 
        sa_column=Column(JSON)
    )

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

---

### 3.2 Bảng `lessons` (Bài học Tình huống Giao tiếp)

```python
class Lesson(SQLModel, table=True):
    __tablename__ = "lessons"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(nullable=False)
    category: str = Field(index=True) # Daily Life, Travel, Work, Social
    level_required: UserLevel = Field(default=UserLevel.BEGINNER)
    description: str = Field(nullable=False)
    
    # Dynamic JSON Content for expressions & dialogue
    useful_expressions: List[dict] = Field(default=[], sa_column=Column(JSON))
    example_dialogue: List[dict] = Field(default=[], sa_column=Column(JSON))
    scenario_prompt: str = Field(nullable=False) # System prompt cho AI roleplay

    created_at: datetime = Field(default_factory=datetime.utcnow)
```

---

### 3.3 Bảng `conversation_sessions` (Lịch sử các Session Hội thoại)

```python
class SessionType(str, Enum):
    AI_COACH = "AI_Coach"
    SCENARIO_PRACTICE = "Scenario_Practice"
    PEOPLE_ROOM = "People_Room"

class ConversationSession(SQLModel, table=True):
    __tablename__ = "conversation_sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    session_type: SessionType = Field(default=SessionType.AI_COACH)
    lesson_id: Optional[uuid.UUID] = Field(default=None, foreign_key="lessons.id")
    
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = Field(default=None)
    duration_seconds: int = Field(default=0)

    # Structured Post-session AI Feedback
    summary_feedback: dict = Field(
        default={
            "overall": "",
            "good_points": [],
            "improvements": [],
            "grammar_corrections": []
        }, 
        sa_column=Column(JSON)
    )
```

---

### 3.4 Bảng `conversation_messages` (Chi tiết các câu nói / Script)

```python
class SenderType(str, Enum):
    USER = "User"
    AI = "AI"
    PEOPLE = "People"

class ConversationMessage(SQLModel, table=True):
    __tablename__ = "conversation_messages"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(foreign_key="conversation_sessions.id", index=True)
    sender_type: SenderType = Field(nullable=False)
    sender_name: str = Field(default="AI")
    
    text_content: str = Field(nullable=False)
    audio_url: Optional[str] = Field(default=None)
    
    # Highlight lỗi nếu câu này có lỗi ngữ pháp
    corrections: List[dict] = Field(default=[], sa_column=Column(JSON))
    
    timestamp: datetime = Field(default_factory=datetime.utcnow)
```

---

## 4. Quản lý Redis Caching Strategy

| Redis Key Pattern | Kiểu Dữ Liệu | Mục Đích Sử Dụng | TTL (Thời gian sống) |
| :--- | :---: | :--- | :---: |
| `session:context:{session_id}` | List / JSON | Lưu 10 tin nhắn gần nhất để làm context cho Gemini | 2 giờ |
| `room:active:{room_id}` | Hash / Set | Danh sách user đang có mặt trong phòng chat voice | Khi phòng đóng |
| `user:token:{user_id}` | String | Lưu trạng thái token đăng nhập & refresh token | 7 ngày |
