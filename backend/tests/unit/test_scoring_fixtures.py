"""
Sample transcript fixtures for scoring tests.
Includes:
- FLUENT_TRANSCRIPT: continuous, rich vocabulary, fast response, few fillers
- HESITANT_TRANSCRIPT: long pauses, multiple filler words (um, uh, you know), repetitive
- TOO_SHORT_TRANSCRIPT: under minimum sufficiency thresholds (words < 5, spoken < 5s)
"""

from typing import Any

# 1. Fluent transcript fixture:
# User speaks fluently about travel, high vocabulary diversity, no filler words, latency 1.5s (< 2s)
FLUENT_TRANSCRIPT: list[dict[str, Any]] = [
    {
        "speaker": "AI",
        "text": "Hello! Could you tell me about your favorite travel destination and what you like to do there?",
        "start_ms": 0,
        "end_ms": 3000,
        "confidence": 1.0,
    },
    {
        "speaker": "USER",
        "text": "I absolutely love traveling to Da Nang because the coastal scenery is breathtaking and vibrant.",
        "start_ms": 4500,  # Latency = (4500 - 3000) = 1500ms = 1.5s (<= 2s grace period)
        "end_ms": 9500,  # 5.0s spoken
        "confidence": 0.95,
    },
    {
        "speaker": "USER",
        "text": "Every morning I stroll along My Khe beach, breathe the fresh ocean air, and savor exquisite seafood.",
        "start_ms": 9700,  # Gap 200ms (normal breath, no long pause)
        "end_ms": 16000,  # 6.3s spoken
        "confidence": 0.93,
    },
    {
        "speaker": "AI",
        "text": "That sounds delightful! Do you prefer going there alone or with your family and companions?",
        "start_ms": 16500,
        "end_ms": 20000,
        "confidence": 1.0,
    },
    {
        "speaker": "USER",
        "text": "I usually explore with close friends because sharing memorable adventures makes every journey far more meaningful.",
        "start_ms": 21800,  # Latency = (21800 - 20000) = 1800ms = 1.8s (<= 2s)
        "end_ms": 28500,  # 6.7s spoken
        "confidence": 0.96,
    },
]

# 2. Hesitant transcript fixture:
# User pauses excessively (gap 3500ms >= 1500ms), repeats filler words ('um', 'uh', 'you know'),
# repetitive basic vocabulary, slow response latency 6.0s (> 2s)
HESITANT_TRANSCRIPT: list[dict[str, Any]] = [
    {
        "speaker": "AI",
        "text": "What do you like to do during your free time on weekends?",
        "start_ms": 0,
        "end_ms": 3000,
        "confidence": 1.0,
    },
    {
        "speaker": "USER",
        "text": "Um well I stay at home and you know...",
        "start_ms": 9000,  # Latency = (9000 - 3000) = 6000ms = 6.0s (penalized response speed)
        "end_ms": 13000,  # 4s
        "confidence": 0.78,
    },
    {
        "speaker": "USER",
        "text": "Uh like I watch TV and like I play game because game is good and game is nice you know.",
        "start_ms": 16500,  # Pause gap = 16500 - 13000 = 3500ms (long pause)
        "end_ms": 23000,  # 6.5s
        "confidence": 0.72,
    },
]

# 3. Too short transcript fixture:
# Below session thresholds (total words = 2 < 5, spoken seconds = 1.5 < 5.0)
TOO_SHORT_TRANSCRIPT: list[dict[str, Any]] = [
    {
        "speaker": "AI",
        "text": "Hello! How are you doing today?",
        "start_ms": 0,
        "end_ms": 2000,
        "confidence": 1.0,
    },
    {
        "speaker": "USER",
        "text": "I good.",
        "start_ms": 3000,
        "end_ms": 4500,  # 1.5s spoken, 2 words
        "confidence": 0.90,
    },
]
