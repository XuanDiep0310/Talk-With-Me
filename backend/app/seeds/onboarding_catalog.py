"""Onboarding catalog seed data (including Stage 1 Scripted + Stage 2 Unscripted prompts)."""

from typing import TypedDict

from app.core.speech.ipa import text_to_ipa


class OptionItem(TypedDict):
    key: str
    label: str


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

GOALS: list[OptionItem] = [
    {"key": "daily_conversation", "label": "Giao tiếp hằng ngày tự nhiên"},
    {"key": "work_presentation", "label": "Thuyết trình công việc"},
    {"key": "job_interview", "label": "Phỏng vấn xin việc"},
    {"key": "study_abroad", "label": "Học tập ở nước ngoài"},
    {"key": "travel_solo", "label": "Du lịch tự túc"},
]

GOAL_KEYS: frozenset[str] = frozenset(item["key"] for item in GOALS)

WEAK_POINTS: list[OptionItem] = [
    {"key": "pronunciation", "label": "Phát âm"},
    {"key": "response_speed", "label": "Tốc độ phản hồi"},
    {"key": "grammar", "label": "Ngữ pháp"},
    {"key": "vocabulary", "label": "Từ vựng"},
    {"key": "listening", "label": "Nghe hiểu"},
]

WEAK_POINT_KEYS: frozenset[str] = frozenset(item["key"] for item in WEAK_POINTS)

CEFR_LEVELS: list[str] = ["A1", "A2", "B1", "B2", "C1"]
CEFR_LEVEL_SET: frozenset[str] = frozenset(CEFR_LEVELS)

LEVEL_SOURCE_PLACEMENT = "PLACEMENT"
LEVEL_SOURCE_SELF = "SELF"
LEVEL_SOURCE_DEFAULT = "DEFAULT"

LEVEL_SOURCES: frozenset[str] = frozenset(
    [LEVEL_SOURCE_PLACEMENT, LEVEL_SOURCE_SELF, LEVEL_SOURCE_DEFAULT]
)


class ScriptedPlacementPrompt(TypedDict):
    id: str
    target_band: str
    text: str
    translation: str
    ipa: str
    focus_phonemes: list[str]


# Stage 1 Scripted prompts targeting Vietnamese L1 phonological challenges (/θ/, /ð/, /r/, clusters)
SCRIPTED_PLACEMENT_PROMPTS: list[ScriptedPlacementPrompt] = [
    {
        "id": "s1_1",
        "target_band": "A1-A2",
        "text": "I usually drink warm tea in the morning before work.",
        "translation": "Tôi thường uống trà ấm vào buổi sáng trước khi làm việc.",
        "ipa": text_to_ipa("I usually drink warm tea in the morning before work."),
        "focus_phonemes": ["ʒ", "ŋ", "w", "ɜːr"],
    },
    {
        "id": "s1_2",
        "target_band": "B1",
        "text": "How long have you been working with this international team?",
        "translation": "Bạn đã làm việc với nhóm quốc tế này bao lâu rồi?",
        "ipa": text_to_ipa("How long have you been working with this international team?"),
        "focus_phonemes": ["ð", "θ", "ɜːr", "ʃ"],
    },
    {
        "id": "s1_3",
        "target_band": "B2-C1",
        "text": "Although technology evolves rapidly, clear communication remains essential.",
        "translation": "Mặc dù công nghệ phát triển nhanh chóng, giao tiếp rõ ràng vẫn rất thiết yếu.",
        "ipa": text_to_ipa(
            "Although technology evolves rapidly, clear communication remains essential."
        ),
        "focus_phonemes": ["ð", "v", "z", "ʃ"],
    },
]


class PlacementQuestionItem(TypedDict):
    id: str
    tier: int  # 1: A1-A2, 2: B1-B2, 3: C1
    tier_label: str
    text: str
    translation: str


# Stage 2 Unscripted adaptive questions
TIERED_PLACEMENT_QUESTIONS: list[PlacementQuestionItem] = [
    {
        "id": "q1_1",
        "tier": 1,
        "tier_label": "Cơ bản (A1–A2)",
        "text": "Can you introduce yourself and tell me what you like to do in your free time?",
        "translation": "Bạn có thể giới thiệu bản thân và cho biết bạn thích làm gì vào thời gian rảnh không?",
    },
    {
        "id": "q1_2",
        "tier": 1,
        "tier_label": "Cơ bản (A1–A2)",
        "text": "Describe your daily routine. What do you usually do in the morning and evening?",
        "translation": "Hãy miêu tả thói quen hằng ngày của bạn. Bạn thường làm gì vào buổi sáng và buổi tối?",
    },
    {
        "id": "q1_3",
        "tier": 1,
        "tier_label": "Cơ bản (A1–A2)",
        "text": "What is your favorite food or drink, and where do you usually enjoy it?",
        "translation": "Món ăn hoặc đồ uống yêu thích của bạn là gì, và bạn thường thưởng thức nó ở đâu?",
    },
    {
        "id": "q2_1",
        "tier": 2,
        "tier_label": "Trung cấp (B1–B2)",
        "text": "Tell me about a memorable trip you have taken. What made it special for you?",
        "translation": "Hãy kể về một chuyến đi đáng nhớ của bạn. Điều gì đã khiến chuyến đi đó trở nên đặc biệt?",
    },
    {
        "id": "q2_2",
        "tier": 2,
        "tier_label": "Trung cấp (B1–B2)",
        "text": "Tell me about a person who has had a big influence on your life and why.",
        "translation": "Hãy kể về một người có ảnh hưởng lớn đến cuộc đời bạn và lý do vì sao.",
    },
    {
        "id": "q2_3",
        "tier": 2,
        "tier_label": "Trung cấp (B1–B2)",
        "text": "How do you think modern technology has changed the way people communicate with each other?",
        "translation": "Bạn nghĩ công nghệ hiện đại đã thay đổi cách mọi người giao tiếp với nhau như thế nào?",
    },
    {
        "id": "q3_1",
        "tier": 3,
        "tier_label": "Nâng cao (C1)",
        "text": "Some people argue that artificial intelligence will replace human jobs, while others believe it creates new opportunities. What is your perspective on this debate?",
        "translation": "Một số người cho rằng trí tuệ nhân tạo sẽ thay thế việc làm của con người, trong khi người khác tin nó tạo ra cơ hội mới. Quan điểm của bạn là gì?",
    },
    {
        "id": "q3_2",
        "tier": 3,
        "tier_label": "Nâng cao (C1)",
        "text": "How can governments and individuals strike an effective balance between rapid economic development and environmental preservation?",
        "translation": "Làm thế nào để chính phủ và mỗi cá nhân có thể tạo ra sự cân bằng hiệu quả giữa phát triển kinh tế nhanh và bảo vệ môi trường?",
    },
    {
        "id": "q3_3",
        "tier": 3,
        "tier_label": "Nâng cao (C1)",
        "text": "To what extent do you think language reflects and shapes the cultural identity of a society?",
        "translation": "Theo bạn, ngôn ngữ phản ánh và định hình bản sắc văn hóa của một xã hội ở mức độ nào?",
    },
]

PLACEMENT_QUESTIONS: list[str] = [item["text"] for item in TIERED_PLACEMENT_QUESTIONS]
