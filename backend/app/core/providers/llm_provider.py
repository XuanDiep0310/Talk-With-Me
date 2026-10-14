"""
LLM provider interface for placement level evaluation and AI Coach conversation.

All LLM operations adhere to the Communication-First rules (AGENTS.md §8 rule 9):
  - Do NOT interrupt user for hesitation or filler words.
  - Do NOT correct grammar mid-conversation.
  - Adapt vocabulary to the user's CEFR level.
  - Gently guide the conversation back if off-topic.
  - Keep responses concise (1–3 sentences) and end with an open-ended guiding question.
"""

from typing import Any, Protocol

import httpx

from app.core.config import get_settings


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
    ) -> str:
        """Generate friendly, concise coach response with a guiding question."""
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
    ) -> str:
        return self.generate_coach_reply_sync(history, user_message, user_level, topic_title)

    def generate_coach_reply_sync(
        self,
        history: list[dict[str, str]],  # noqa: ARG002
        user_message: str,
        user_level: str,  # noqa: ARG002
        topic_title: str,
    ) -> str:
        msg_lower = user_message.lower()
        if any(w in msg_lower for w in ("again", "hear", "clearly", "repeat", "pardon", "sorry")):
            return f"No worries at all! I was asking: what do you enjoy most when exploring {topic_title.lower()}?"

        if any(w in msg_lower for w in ("travel", "beach", "city", "da nang", "hanoi", "trip", "visit")):
            return "That sounds like a wonderful destination! What is your favorite activity or local food when you are there?"

        if any(w in msg_lower for w in ("work", "job", "office", "company", "career")):
            return "Working on that sounds challenging yet rewarding! What do you find most interesting about your daily tasks?"

        if any(w in msg_lower for w in ("weekend", "free time", "hobby", "music", "sport", "game")):
            return "That's a fantastic way to recharge your energy! Do you usually do that alone or with friends?"

        idx = FakeLlmProvider._counter % len(self._REPLIES)
        FakeLlmProvider._counter += 1
        return self._REPLIES[idx]

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
    ) -> str:
        system_instruction = (
            f"You are Alex, an encouraging English Communication Coach at TalkWithMe. "
            f"The user is at CEFR Level {user_level}, discussing the topic '{topic_title}'. "
            f"Rules:\n"
            f"1. Keep responses short and conversational (1 to 2 sentences max).\n"
            f"2. Always end with one friendly, open-ended question to keep the conversation flowing.\n"
            f"3. Do NOT interrupt or criticize grammar mid-conversation.\n"
            f"4. Adapt your vocabulary to level {user_level}."
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
            # Fallback on timeout or external service issue
            return FakeLlmProvider().generate_coach_reply_sync(history, user_message, user_level, topic_title)


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
    ) -> str:
        system_instruction = (
            f"You are Alex, an encouraging and empathetic English Communication Coach at TalkWithMe. "
            f"The user is at CEFR Level {user_level}, discussing the topic '{topic_title}'.\n"
            f"Rules (Communication-First):\n"
            f"1. Directly respond to and acknowledge what the learner just said!\n"
            f"2. Keep responses short and natural (1 to 2 sentences max).\n"
            f"3. Always conclude with exactly ONE friendly, open-ended question to invite the user to speak more.\n"
            f"4. Do NOT criticize grammar or interrupt the flow.\n"
            f"5. Adapt your vocabulary to level {user_level}."
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
            return FakeLlmProvider().generate_coach_reply_sync(history, user_message, user_level, topic_title)

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

