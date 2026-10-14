"""
LLM provider interface for placement level evaluation and AI Coach conversation.

All LLM operations adhere to the Communication-First rules (AGENTS.md §8 rule 9):
  - Do NOT interrupt user for hesitation or filler words.
  - Do NOT correct grammar mid-conversation.
  - Adapt vocabulary to the user's CEFR level.
  - Gently guide the conversation back if off-topic.
  - Keep responses concise (1–3 sentences) and end with an open-ended guiding question.
"""

import logging
from typing import Any, Protocol

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class LlmLevelEvaluation:
    """LLM's assessment of user level from transcript content."""

    __slots__ = ("suggested_level", "confidence", "reasoning")

    def __init__(
        self,
        suggested_level: str,
        confidence: float,
        reasoning: str,
    ) -> None:
        self.suggested_level = suggested_level
        self.confidence = confidence
        self.reasoning = reasoning


class LlmProvider(Protocol):
    """Abstract interface for LLM services."""

    async def evaluate_placement(self, transcripts: list[str]) -> LlmLevelEvaluation:
        """Evaluate placement test transcripts to suggest a CEFR level."""
        ...

    async def generate_coach_reply(
        self,
        history: list[dict[str, str]],
        user_message: str,
        user_level: str,
        topic_title: str,
        topic_min_level: str = "A1",
    ) -> str:
        """Generate friendly, concise coach response with a guiding question adapted to user level."""
        ...

    async def generate_suggested_replies(
        self,
        history: list[dict[str, str]],
        last_ai_message: str,
        user_level: str,
        topic_title: str,
        topic_min_level: str = "A1",
    ) -> list[dict[str, str]]:
        """Generate 3 sample suggested answers with Vietnamese translations, adapted to user level and topic."""
        ...

    async def translate_text(self, text: str, target_lang: str = "vi") -> str:
        """Translate text into target language (default Vietnamese)."""
        ...


class FakeLlmProvider:
    """
    Fake LLM provider for development and testing.
    Always produces compliant, conversational English responses.
    """

    _REPLIES = [
        "That sounds fascinating! How often do you get the chance to do that during a regular week?",
        "I completely understand what you mean. What was the most exciting part of that experience for you?",
        "That makes total sense. Could you tell me a little more about why you feel that way?",
        "That's really inspiring! If you could change one thing about it, what would it be?",
    ]
    _counter: int = 0

    async def evaluate_placement(self, transcripts: list[str]) -> LlmLevelEvaluation:  # noqa: ARG002
        return LlmLevelEvaluation(
            suggested_level="B1",
            confidence=0.75,
            reasoning="Fake evaluation: vocabulary and sentence structure suggest B1.",
        )

    async def generate_coach_reply(
        self,
        history: list[dict[str, str]],
        user_message: str,
        user_level: str,
        topic_title: str,
        topic_min_level: str = "A1",
    ) -> str:
        return self.generate_coach_reply_sync(
            history, user_message, user_level, topic_title, topic_min_level
        )

    def generate_coach_reply_sync(
        self,
        history: list[dict[str, str]],  # noqa: ARG002
        user_message: str,
        user_level: str,
        topic_title: str,
        topic_min_level: str = "A1",  # noqa: ARG002
    ) -> str:
        msg_lower = user_message.lower()
        level = user_level.upper()

        if any(w in msg_lower for w in ("again", "hear", "clearly", "repeat", "pardon", "sorry")):
            if level in ("A1", "A2"):
                return f"No problem! What do you like about {topic_title.lower()}?"
            return f"No worries at all! I was asking: what do you enjoy most when exploring {topic_title.lower()}?"

        if any(
            w in msg_lower for w in ("travel", "beach", "city", "da nang", "hanoi", "trip", "visit")
        ):
            if level in ("A1", "A2"):
                return "That is nice! Do you like the beach or the food more?"
            return "That sounds like a wonderful destination! What is your favorite activity or local food when you are there?"

        if any(w in msg_lower for w in ("work", "job", "office", "company", "career")):
            if level in ("A1", "A2"):
                return "Great! Do you enjoy your daily work with colleagues?"
            return "Working on that sounds challenging yet rewarding! What do you find most interesting about your daily tasks?"

        if any(w in msg_lower for w in ("weekend", "free time", "hobby", "music", "sport", "game")):
            if level in ("A1", "A2"):
                return "Sounds fun! Do you do that on Saturdays?"
            return "That's a fantastic way to recharge your energy! Do you usually do that alone or with friends?"

        idx = FakeLlmProvider._counter % len(self._REPLIES)
        FakeLlmProvider._counter += 1
        return self._REPLIES[idx]

    async def generate_suggested_replies(
        self,
        history: list[dict[str, str]],  # noqa: ARG002
        last_ai_message: str,  # noqa: ARG002
        user_level: str,
        topic_title: str,
        topic_min_level: str = "A1",  # noqa: ARG002
    ) -> list[dict[str, str]]:
        level = user_level.upper()
        if level in ("A1", "A2"):
            return [
                {
                    "text": f"I really like {topic_title.lower()} because it is very fun and interesting.",
                    "translation": f"Tôi thực sự thích {topic_title.lower()} vì nó rất vui và thú vị.",
                },
                {
                    "text": "I usually do that on weekends with my friends or family.",
                    "translation": "Tôi thường làm việc đó vào cuối tuần cùng bạn bè hoặc gia đình.",
                },
                {
                    "text": "My favorite part is having good conversations and learning new things.",
                    "translation": "Phần tôi thích nhất là trò chuyện vui vẻ và học những điều mới mẻ.",
                },
            ]
        elif level in ("B1", "B2"):
            return [
                {
                    "text": f"From my perspective, engaging in {topic_title.lower()} allows me to broaden my horizons.",
                    "translation": f"Theo quan điểm của tôi, tham gia vào {topic_title.lower()} giúp tôi mở rộng tầm nhìn.",
                },
                {
                    "text": "What I appreciate most is the opportunity to solve challenges collaboratively.",
                    "translation": "Điều tôi trân trọng nhất là cơ hội được cùng nhau giải quyết các thử thách.",
                },
                {
                    "text": "Whenever I get some free time, I prioritize spending it on meaningful activities.",
                    "translation": "Bất cứ khi nào có thời gian rảnh, tôi ưu tiên dành nó cho những hoạt động ý nghĩa.",
                },
            ]
        else:  # C1
            return [
                {
                    "text": f"I find the nuanced aspects of {topic_title.lower()} particularly intellectually stimulating.",
                    "translation": f"Tôi thấy các khía cạnh tinh tế của {topic_title.lower()} đặc biệt kích thích tư duy.",
                },
                {
                    "text": "Striking the right balance between strategic focus and flexibility has been key for me.",
                    "translation": "Việc cân bằng hợp lý giữa định hướng chiến lược và sự linh hoạt là chìa khóa đối với tôi.",
                },
                {
                    "text": "It consistently provides invaluable insights that shape how I approach daily situations.",
                    "translation": "Nó liên tục mang lại những góc nhìn vô giá giúp định hình cách tôi tiếp cận các tình huống thường nhật.",
                },
            ]

    async def translate_text(self, text: str, target_lang: str = "vi") -> str:  # noqa: ARG002
        # Simple high quality dictionary-based translations for demo/dev
        lower = text.lower().strip()
        dictionary: dict[str, str] = {
            "can you ask again? i don't hear clearly.": "Bạn có thể hỏi lại được không? Tôi nghe chưa rõ.",
            "can you repeat that?": "Bạn có thể lặp lại câu đó được không?",
            "i completely understand what you mean. what was the most exciting part of that experience for you?": "Tôi hoàn toàn hiểu ý bạn. Điều thú vị nhất trong trải nghiệm đó đối với bạn là gì?",
            "that makes total sense. could you tell me a little more about why you feel that way?": "Điều đó hoàn toàn hợp lý. Bạn có thể chia sẻ thêm một chút về lý do bạn cảm thấy như vậy không?",
            "that sounds fascinating! how often do you get the chance to do that during a regular week?": "Nghe thật hấp dẫn! Bạn thường có cơ hội làm việc đó bao lâu một lần trong một tuần bình thường?",
            "that's really inspiring! if you could change one thing about it, what would it be?": "Thật sự rất truyền cảm hứng! Nếu có thể thay đổi một điều về nó, bạn sẽ đổi điều gì?",
        }
        for k, v in dictionary.items():
            if k in lower:
                return v
        return f"[Bản dịch]: {text}"


class GeminiLlmProvider:
    """
    Google Gemini implementation for AI Coach and Placement evaluation.
    Activated when LLM_PROVIDER=gemini and LLM_API_KEY is configured.
    """

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash") -> None:
        self.api_key = api_key
        self.model = model
        self.endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

    async def evaluate_placement(self, transcripts: list[str]) -> LlmLevelEvaluation:
        prompt = (
            "Evaluate the CEFR level (A1, A2, B1, B2, or C1) for an English learner who said:\n"
            + "\n".join(f"- {t}" for t in transcripts)
            + '\nReply in JSON: {"suggested_level": "B1", "confidence": 0.8, "reasoning": "brief"}'
        )
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(self.endpoint, json=payload)
                res.raise_for_status()
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                # Parse JSON or fallback
                import json

                parsed = json.loads(text.strip("` \n").removeprefix("json"))
                return LlmLevelEvaluation(
                    suggested_level=parsed.get("suggested_level", "B1"),
                    confidence=float(parsed.get("confidence", 0.7)),
                    reasoning=parsed.get("reasoning", "Evaluated by Gemini"),
                )
        except Exception:
            return LlmLevelEvaluation(
                suggested_level="B1", confidence=0.7, reasoning="Fallback estimation"
            )

    async def generate_coach_reply(
        self,
        history: list[dict[str, str]],
        user_message: str,
        user_level: str,
        topic_title: str,
        topic_min_level: str = "A1",
    ) -> str:
        system_instruction = (
            f"You are Alex, an encouraging English Communication Coach at TalkWithMe. "
            f"The user is at CEFR Level {user_level}, discussing the topic '{topic_title}' (Topic min level: {topic_min_level}). "
            f"Rules:\n"
            f"1. Keep responses short and conversational (1 to 2 sentences max).\n"
            f"2. Always end with one friendly, open-ended question to keep the conversation flowing.\n"
            f"3. Do NOT interrupt or criticize grammar mid-conversation.\n"
            f"4. CEFR CALIBRATION: Strictly adapt your vocabulary and sentence length to level {user_level}."
        )

        contents: list[dict[str, Any]] = []
        for h in history[-6:]:  # Context window: last 6 turns
            role = "user" if h.get("role") == "user" else "model"
            contents.append({"role": role, "parts": [{"text": h.get("content", "")}]})
        contents.append({"role": "user", "parts": [{"text": user_message}]})

        payload = {
            "system_instruction": {"parts": [{"text": system_instruction}]},
            "contents": contents,
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 100},
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(self.endpoint, json=payload)
                res.raise_for_status()
                data = res.json()
                reply_text: str = data["candidates"][0]["content"]["parts"][0]["text"]
                return reply_text.strip()
        except Exception:
            return FakeLlmProvider().generate_coach_reply_sync(
                history, user_message, user_level, topic_title, topic_min_level
            )

    async def generate_suggested_replies(
        self,
        history: list[dict[str, str]],
        last_ai_message: str,
        user_level: str,
        topic_title: str,
        topic_min_level: str = "A1",
    ) -> list[dict[str, str]]:
        prompt = (
            f"You are an English coach assistant. The learner is at CEFR Level {user_level}, "
            f"discussing '{topic_title}' (Room min level: {topic_min_level}).\n"
            f"Coach's last question: '{last_ai_message}'\n"
            f"Generate exactly 3 diverse, natural sample answers that the learner could say to reply.\n"
            f"Tailor vocabulary and structure strictly to CEFR level {user_level}.\n"
            f"Output strictly a JSON list of 3 objects with 'text' (English) and 'translation' (Vietnamese).\n"
            f'Example: [{{"text": "...", "translation": "..."}}]\n'
            f"No markdown fences, no explanations."
        )
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.6, "maxOutputTokens": 350},
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(self.endpoint, json=payload)
                res.raise_for_status()
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                if text.startswith("```"):
                    text = text.strip("`").removeprefix("json").strip()
                import json

                parsed = json.loads(text)
                if isinstance(parsed, list) and len(parsed) > 0:
                    results: list[dict[str, str]] = []
                    for item in parsed[:3]:
                        if isinstance(item, dict) and "text" in item:
                            results.append(
                                {
                                    "text": str(item.get("text", "")).strip(),
                                    "translation": str(item.get("translation", "")).strip(),
                                }
                            )
                    if results:
                        return results
        except Exception:
            pass

        return await FakeLlmProvider().generate_suggested_replies(
            history, last_ai_message, user_level, topic_title, topic_min_level
        )

    async def translate_text(self, text: str, target_lang: str = "vi") -> str:
        prompt = (
            f"Translate the following English sentence to natural, conversational Vietnamese. "
            f"Output ONLY the translated sentence, without quotation marks or explanations:\n{text}"
        )
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(self.endpoint, json=payload)
                res.raise_for_status()
                data = res.json()
                translated: str = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                return translated
        except Exception:
            return await FakeLlmProvider().translate_text(text, target_lang)


class GroqLlmProvider:
    """
    Groq Cloud LLM implementation for ultra-fast, intelligent, free-tier AI Coach.
    Uses qwen/qwen3.8-27b via OpenAI-compatible API.
    """

    def __init__(self, api_key: str, model: str = "qwen/qwen3.8-27b") -> None:
        self.api_key = api_key
        self.model = model
        self.api_url = "https://api.groq.com/openai/v1/chat/completions"

    async def evaluate_placement(self, transcripts: list[str]) -> LlmLevelEvaluation:
        system_prompt = (
            "You are an expert CEFR English evaluator. Evaluate the learner's transcript and "
            'reply strictly with JSON: {"suggested_level": "A1"|"A2"|"B1"|"B2"|"C1", "confidence": 0.85, "reasoning": "brief"}'
        )
        user_content = "\n".join(f"- {t}" for t in transcripts)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Learner answers:\n{user_content}"},
        ]
        headers = {"Authorization": f"Bearer {self.api_key}"}
        payload = {
            "model": self.model,
            "messages": messages,
            "response_format": {"type": "json_object"},
            "temperature": 0.3,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(self.api_url, json=payload, headers=headers)
                res.raise_for_status()
                data = res.json()
                content = data["choices"][0]["message"]["content"]
                import json

                parsed = json.loads(content)
                return LlmLevelEvaluation(
                    suggested_level=parsed.get("suggested_level", "B1"),
                    confidence=float(parsed.get("confidence", 0.8)),
                    reasoning=parsed.get("reasoning", "Evaluated by Groq"),
                )
        except Exception:
            return LlmLevelEvaluation(
                suggested_level="B1", confidence=0.7, reasoning="Fallback estimation"
            )

    async def generate_coach_reply(
        self,
        history: list[dict[str, str]],
        user_message: str,
        user_level: str,
        topic_title: str,
        topic_min_level: str = "A1",
    ) -> str:
        system_instruction = (
            f"You are Alex, an encouraging and empathetic English Communication Coach at TalkWithMe. "
            f"The user is at CEFR Level {user_level}, discussing the topic '{topic_title}' (Topic min level: {topic_min_level}).\n"
            f"Rules (Communication-First):\n"
            f"1. Directly respond to and acknowledge what the learner just said!\n"
            f"2. Keep responses short and natural (1 to 2 sentences max).\n"
            f"3. Always conclude with exactly ONE friendly, open-ended question to invite the user to speak more.\n"
            f"4. Do NOT criticize grammar or interrupt the flow.\n"
            f"5. CEFR CALIBRATION: Strictly adapt your vocabulary, sentence length, and syntax to CEFR level {user_level}. "
            f"For A1/A2, use simple, common words and keep questions under 12 words. For B1/B2, speak naturally. For C1, use richer vocabulary."
        )

        messages: list[dict[str, str]] = [{"role": "system", "content": system_instruction}]
        for h in history[-6:]:
            role = "user" if h.get("role") == "user" else "assistant"
            messages.append({"role": role, "content": h.get("content", "")})
        messages.append({"role": "user", "content": user_message})

        headers = {"Authorization": f"Bearer {self.api_key}"}
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 120,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(self.api_url, json=payload, headers=headers)
                res.raise_for_status()
                data = res.json()
                reply_text: str = data["choices"][0]["message"]["content"]
                return reply_text.strip().strip('"')
        except Exception:
            return FakeLlmProvider().generate_coach_reply_sync(
                history, user_message, user_level, topic_title, topic_min_level
            )

    async def generate_suggested_replies(
        self,
        history: list[dict[str, str]],
        last_ai_message: str,
        user_level: str,
        topic_title: str,
        topic_min_level: str = "A1",
    ) -> list[dict[str, str]]:
        system_prompt = (
            f"You are an expert English Speaking Coach Assistant at TalkWithMe. "
            f"The learner is at CEFR Level {user_level}, practicing the topic '{topic_title}' (Topic min level: {topic_min_level}).\n"
            f'Given the coach\'s latest question: "{last_ai_message}", '
            f"generate exactly 3 natural, practical sample answers the learner could speak.\n"
            f"CRITICAL CEFR LEVEL CONSTRAINTS:\n"
            f"- For A1/A2: Use simple vocabulary, high-frequency words, short clauses (6-12 words max), no idioms.\n"
            f"- For B1/B2: Use practical connectors (because, although, usually, from my perspective), varied sentence patterns (12-20 words).\n"
            f"- For C1: Use sophisticated vocabulary, nuanced idioms, and articulate expression.\n"
            f"Output strictly a JSON list of 3 objects with 'text' (English answer) and 'translation' (natural Vietnamese translation).\n"
            f'Example: [{{"text": "...", "translation": "..."}}, {{"text": "...", "translation": "..."}}, {{"text": "...", "translation": "..."}}]\n'
            f"No markdown formatting, no explanations."
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Coach question: {last_ai_message}"},
        ]
        headers = {"Authorization": f"Bearer {self.api_key}"}
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.6,
            "max_tokens": 350,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(self.api_url, json=payload, headers=headers)
                res.raise_for_status()
                data = res.json()
                content = data["choices"][0]["message"]["content"].strip()
                if content.startswith("```"):
                    content = content.strip("`").removeprefix("json").strip()
                import json

                parsed = json.loads(content)
                if isinstance(parsed, list) and len(parsed) > 0:
                    results: list[dict[str, str]] = []
                    for item in parsed[:3]:
                        if isinstance(item, dict) and "text" in item:
                            results.append(
                                {
                                    "text": str(item.get("text", "")).strip(),
                                    "translation": str(item.get("translation", "")).strip(),
                                }
                            )
                    if results:
                        return results
        except Exception as exc:
            logger.warning("Groq suggestions generation fallback: %s", exc)

        return await FakeLlmProvider().generate_suggested_replies(
            history, last_ai_message, user_level, topic_title, topic_min_level
        )

    async def translate_text(self, text: str, target_lang: str = "vi") -> str:
        system_prompt = (
            "You are a professional English-to-Vietnamese translator. Translate the given English "
            "sentence into natural, colloquial Vietnamese. Output ONLY the translated sentence, without quotation marks or explanations."
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ]
        headers = {"Authorization": f"Bearer {self.api_key}"}
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 120,
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(self.api_url, json=payload, headers=headers)
                res.raise_for_status()
                data = res.json()
                translated: str = data["choices"][0]["message"]["content"].strip().strip('"')
                return translated
        except Exception:
            return await FakeLlmProvider().translate_text(text, target_lang)


def get_llm_provider() -> LlmProvider:
    """Factory resolving configured LLM provider."""
    settings = get_settings()
    llm_choice = settings.LLM_PROVIDER.lower()

    # If Groq key is present and choice is groq (or default with key)
    groq_key = getattr(settings, "GROQ_API_KEY", "")
    if llm_choice == "groq" and groq_key:
        return GroqLlmProvider(api_key=groq_key)

    if llm_choice in ("gemini", "google") and settings.LLM_API_KEY:
        return GeminiLlmProvider(api_key=settings.LLM_API_KEY, model=settings.LLM_MODEL)

    # If user provided a Groq key without changing LLM_PROVIDER, use Groq automatically
    if groq_key:
        return GroqLlmProvider(api_key=groq_key)

    return FakeLlmProvider()
