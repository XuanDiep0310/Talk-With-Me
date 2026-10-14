"""
Seed catalog of 12 AI Coach conversation topics.
Follows UI screens 14, 15 and SRS specifications.
"""

import uuid
from typing import Any

# Namespace UUID for deterministic Coach Topic UUIDs
_COACH_NAMESPACE = uuid.UUID("3c8e7182-4412-4eb9-9231-c8684bbd1400")

COACH_TOPICS_SEED: list[dict[str, Any]] = [
    {
        "id": str(uuid.uuid5(_COACH_NAMESPACE, "self-introduction")),
        "category": "Personal & Social",
        "title": "Self-Introduction & Background",
        "description": "Introduce yourself, share where you come from, your interests, and your English learning goals with Coach Alex.",
        "min_level": "A2",
        "target_skills": ["Fluency", "Vocabulary"],
        "is_active": True,
        "sort_order": 1,
    },
    {
        "id": str(uuid.uuid5(_COACH_NAMESPACE, "talking-about-job")),
        "category": "Career & Work",
        "title": "Talking About Your Job",
        "description": "Describe your daily work responsibilities, industry trends, and what you find most rewarding in your professional role.",
        "min_level": "B1",
        "target_skills": ["Fluency", "Vocabulary", "Response Speed"],
        "is_active": True,
        "sort_order": 2,
    },
    {
        "id": str(uuid.uuid5(_COACH_NAMESPACE, "favorite-travel")),
        "category": "Travel & Lifestyle",
        "title": "Favorite Travel Experiences",
        "description": "Talk about memorable destinations you have visited, local cuisines you enjoyed, and dream journeys for the future.",
        "min_level": "B1",
        "target_skills": ["Vocabulary", "Fluency"],
        "is_active": True,
        "sort_order": 3,
    },
    # Group: Daily Communication (Giao tiếp hằng ngày)
    {
        "id": str(uuid.uuid5(_COACH_NAMESPACE, "shopping-and-ordering")),
        "category": "Daily Communication",
        "title": "Shopping & Placing Orders",
        "description": "Practice conversational exchanges when inquiring about prices, bargaining politely, and asking for discounts in English.",
        "min_level": "A2",
        "target_skills": ["Listening", "Response Speed"],
        "is_active": True,
        "sort_order": 4,
    },
    {
        "id": str(uuid.uuid5(_COACH_NAMESPACE, "asking-directions")),
        "category": "Daily Communication",
        "title": "Asking for Directions & Transport",
        "description": "Learn to ask for wayfinding guidance, navigate public transit systems, and give clear road directions.",
        "min_level": "A2",
        "target_skills": ["Vocabulary", "Listening"],
        "is_active": True,
        "sort_order": 5,
    },
    {
        "id": str(uuid.uuid5(_COACH_NAMESPACE, "talking-about-weekend")),
        "category": "Daily Communication",
        "title": "Talking About Your Weekend",
        "description": "Share how you spend your free Saturdays and Sundays, hobbies you pursue, and plans for the upcoming weekend.",
        "min_level": "A2",
        "target_skills": ["Fluency", "Vocabulary"],
        "is_active": True,
        "sort_order": 6,
    },
    {
        "id": str(uuid.uuid5(_COACH_NAMESPACE, "weather-and-news")),
        "category": "Daily Communication",
        "title": "Weather & Daily News",
        "description": "Small-talk about current seasonal weather, forecasts, and exchanging thoughts on interesting news topics.",
        "min_level": "B1",
        "target_skills": ["Vocabulary", "Listening"],
        "is_active": True,
        "sort_order": 7,
    },
    {
        "id": str(uuid.uuid5(_COACH_NAMESPACE, "dining-out")),
        "category": "Daily Communication",
        "title": "Dining Out & Ordering Food",
        "description": "Order food at an English-speaking restaurant, ask about menu recommendations, and give dietary preferences.",
        "min_level": "A1",
        "target_skills": ["Vocabulary", "Response Speed"],
        "is_active": True,
        "sort_order": 8,
    },
    # Additional diverse topics
    {
        "id": str(uuid.uuid5(_COACH_NAMESPACE, "hobbies-and-free-time")),
        "category": "Personal & Social",
        "title": "Hobbies & Passion Projects",
        "description": "Discuss your creative hobbies, sports, music tastes, and how you relax after a busy study or workday.",
        "min_level": "A2",
        "target_skills": ["Fluency", "Vocabulary"],
        "is_active": True,
        "sort_order": 9,
    },
    {
        "id": str(uuid.uuid5(_COACH_NAMESPACE, "technology-in-life")),
        "category": "Modern Living",
        "title": "Technology in Everyday Life",
        "description": "Share your thoughts on smartphones, AI gadgets, social media habits, and the future of online communication.",
        "min_level": "B1",
        "target_skills": ["Vocabulary", "Fluency"],
        "is_active": True,
        "sort_order": 10,
    },
    {
        "id": str(uuid.uuid5(_COACH_NAMESPACE, "future-plans")),
        "category": "Personal & Social",
        "title": "Future Plans & Aspirations",
        "description": "Discuss your long-term career aspirations, personal goals, and where you envision yourself in 5 years.",
        "min_level": "B2",
        "target_skills": ["Fluency", "Grammar"],
        "is_active": True,
        "sort_order": 11,
    },
    {
        "id": str(uuid.uuid5(_COACH_NAMESPACE, "handling-unexpected-situations")),
        "category": "Career & Work",
        "title": "Handling Unexpected Situations",
        "description": "React flexibly in challenging workplace scenarios: rescheduling urgent meetings, handling client complaints.",
        "min_level": "B2",
        "target_skills": ["Response Speed", "Fluency"],
        "is_active": True,
        "sort_order": 12,
    },
]
