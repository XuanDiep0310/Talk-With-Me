"""
Topic ranking algorithm for personalized AI Coach topic suggestions.

Ranks topics based on:
  1. CEFR Level suitability (priority to matched or immediately adjacent level).
  2. Interest alignment (user's selected learning interests matching topic context).
  3. Skill improvement targeting (topic target skills matching user's weak points).
"""

from collections.abc import Sequence

from app.models.session import CoachTopic

CEFR_ORDER = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5}

# Mapping user interests to relevant topic keywords
INTEREST_KEYWORDS: dict[str, list[str]] = {
    "travel": ["travel", "destinations", "journey", "transport", "directions"],
    "technology": ["technology", "smartphone", "ai", "gadgets", "digital"],
    "food": ["dining", "food", "restaurant", "menu", "ordering"],
    "business": ["job", "career", "work", "presentation", "interview", "urgent"],
    "sports": ["sports", "exercise", "weekend", "activities"],
    "music": ["music", "creative", "hobbies", "entertainment"],
    "movies_tv": ["news", "movies", "media", "entertainment"],
    "science": ["technology", "modern", "future"],
}

# Mapping user weak points to target skill labels
WEAK_POINT_SKILL_MAP: dict[str, list[str]] = {
    "pronunciation": ["Pronunciation", "Fluency"],
    "response_speed": ["Response Speed", "Fluency"],
    "grammar": ["Grammar", "Accuracy"],
    "vocabulary": ["Vocabulary"],
    "listening": ["Listening"],
}


def calculate_topic_score(
    topic: CoachTopic,
    user_level: str | None = "A1",
    user_interests: Sequence[str] | None = None,
    user_weak_points: Sequence[str] | None = None,
) -> float:
    """Calculate personalization score for a topic given user profile attributes."""
    score = 0.0
    u_level = (user_level or "A1").upper()
    t_level = (topic.min_level or "A1").upper()

    user_order = CEFR_ORDER.get(u_level, 1)
    topic_order = CEFR_ORDER.get(t_level, 1)

    # 1. Level suitability score
    level_diff = user_order - topic_order
    if level_diff == 0:
        score += 35.0  # Exact level match
    elif level_diff == 1:
        score += 25.0  # Comfortable practice (1 level below user)
    elif level_diff == 2:
        score += 15.0  # Easy refresher
    elif level_diff < 0:
        # Too hard for current learner level
        score -= 40.0 * abs(level_diff)

    # 2. Interests alignment
    topic_text = f"{topic.title} {topic.description} {topic.category}".lower()
    interests = user_interests or []
    for interest in interests:
        keywords = INTEREST_KEYWORDS.get(interest.lower(), [interest.lower()])
        if any(kw in topic_text for kw in keywords):
            score += 20.0

    # 3. Weak points alignment
    target_skills = [s.lower() for s in (topic.target_skills or [])]
    weak_points = user_weak_points or []
    for wp in weak_points:
        wp_targets = WEAK_POINT_SKILL_MAP.get(wp.lower(), [wp.lower()])
        if any(target.lower() in target_skills for target in wp_targets):
            score += 25.0

    return score


def rank_topics(
    topics: list[CoachTopic],
    user_level: str | None = "A1",
    user_interests: Sequence[str] | None = None,
    user_weak_points: Sequence[str] | None = None,
) -> list[tuple[CoachTopic, float]]:
    """Rank list of topics by personalization score in descending order."""
    scored: list[tuple[CoachTopic, float]] = []
    for topic in topics:
        s = calculate_topic_score(
            topic=topic,
            user_level=user_level,
            user_interests=user_interests,
            user_weak_points=user_weak_points,
        )
        scored.append((topic, s))

    # Sort descending by score, tie-break by sort_order ascending
    scored.sort(key=lambda item: (-item[1], item[0].sort_order))
    return scored
