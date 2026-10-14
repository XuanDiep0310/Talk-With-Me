"""
Onboarding catalog seed data.

Contains the canonical lists of interests, goals, weak_points, and
placement test questions. These are seeded into the database at startup
and referenced by the GET /onboarding/options endpoint.

All labels are in Vietnamese (UI language).
All keys are in English (stored in DB and API).
"""

from typing import TypedDict


class OptionItem(TypedDict):
    key: str
    label: str


# Interests to display in UI — 8 options
INTERESTS: list[OptionItem] = [
    {"key": "travel", "label": "Du lịch"},
    {"key": "technology", "label": "Công nghệ"},
    {"key": "food", "label": "Ẩm thực"},
    {"key": "business", "label": "Kinh doanh"},
    {"key": "sports", "label": "Thể thao"},
    {"key": "music", "label": "Âm nhạc"},
    {"key": "movies_tv", "label": "Phim & TV"},
    {"key": "science", "label": "Khoa học"},
]

INTEREST_KEYS: frozenset[str] = frozenset(item["key"] for item in INTERESTS)

# Learning goals — 5 options
GOALS: list[OptionItem] = [
    {"key": "daily_conversation", "label": "Giao tiếp hằng ngày tự nhiên"},
    {"key": "work_presentation", "label": "Thuyết trình công việc"},
    {"key": "job_interview", "label": "Phỏng vấn xin việc"},
    {"key": "study_abroad", "label": "Học tập ở nước ngoài"},
    {"key": "travel_solo", "label": "Du lịch tự túc"},
]

GOAL_KEYS: frozenset[str] = frozenset(item["key"] for item in GOALS)

# Skills to improve — 5 options
WEAK_POINTS: list[OptionItem] = [
    {"key": "pronunciation", "label": "Phát âm"},
    {"key": "response_speed", "label": "Tốc độ phản hồi"},
    {"key": "grammar", "label": "Ngữ pháp"},
    {"key": "vocabulary", "label": "Từ vựng"},
    {"key": "listening", "label": "Nghe hiểu"},
]

WEAK_POINT_KEYS: frozenset[str] = frozenset(item["key"] for item in WEAK_POINTS)

# CEFR levels in order
CEFR_LEVELS: list[str] = ["A1", "A2", "B1", "B2", "C1"]
CEFR_LEVEL_SET: frozenset[str] = frozenset(CEFR_LEVELS)

# Level source values
LEVEL_SOURCE_PLACEMENT = "PLACEMENT"
LEVEL_SOURCE_SELF = "SELF"
LEVEL_SOURCE_DEFAULT = "DEFAULT"

LEVEL_SOURCES: frozenset[str] = frozenset(
    [LEVEL_SOURCE_PLACEMENT, LEVEL_SOURCE_SELF, LEVEL_SOURCE_DEFAULT]
)

# Placement test questions — seeded in config, used by placement service
PLACEMENT_QUESTIONS: list[str] = [
    "Tell me about a memorable trip you have taken. What did you like about it?",
    "Describe your daily routine. What do you usually do after work or school?",
    "What is your favorite hobby and why do you enjoy it?",
    "Tell me about a person who has had a big influence on your life.",
    "What do you think about the role of technology in our daily lives today?",
]
