"""Test-only fake providers for deterministic unit and integration tests.

Never imported or used by application runtime code under app/.
"""

from __future__ import annotations

import json
from typing import Any

from app.core.providers.llm_provider import LlmLevelEvaluation
from app.core.providers.speech_assessment_provider import (
    AssessedPhoneme,
    AssessedSyllable,
    AssessedWord,
    SpeechAssessmentResult,
)
from app.models.scoring_schemas import GrammarErrorItem, PostSessionLlmEvaluation


class FakeSpeechAssessmentProvider:
    """Deterministic test double for Azure Speech Pronunciation Assessment."""

    def __init__(
        self,
        *,
        transcript: str = "How long have you been working there",
        accuracy: float = 84.0,
        fluency: float = 86.0,
        prosody: float = 80.0,
        completeness: float = 95.0,
    ) -> None:
        self.transcript = transcript
        self.accuracy = accuracy
        self.fluency = fluency
        self.prosody = prosody
        self.completeness = completeness
        self.calls: list[dict[str, Any]] = []

    async def assess(
        self,
        audio_bytes: bytes,
        *,
        reference_text: str = "",
        mime_type: str = "audio/wav",
        language: str = "en-US",
    ) -> SpeechAssessmentResult:
        self.calls.append(
            {
                "bytes_len": len(audio_bytes),
                "reference_text": reference_text,
                "mime_type": mime_type,
                "language": language,
            }
        )
        text = reference_text.strip() if reference_text.strip() else self.transcript
        tokens = [t for t in text.split() if t]
        words: list[AssessedWord] = []
        for idx, tok in enumerate(tokens):
            clean = tok.strip(".,?!").lower()
            w_acc = self.accuracy - (25.0 if clean in {"you", "working"} else 0.0)
            syllables = (
                [
                    AssessedSyllable(
                        text="wor", accuracy_score=48.0, offset_ms=idx * 350, duration_ms=175
                    ),
                    AssessedSyllable(
                        text="king", accuracy_score=92.0, offset_ms=idx * 350 + 175, duration_ms=175
                    ),
                ]
                if clean == "working"
                else [
                    AssessedSyllable(
                        text=tok.strip(".,?!"),
                        accuracy_score=max(0.0, w_acc),
                        offset_ms=idx * 350,
                        duration_ms=320,
                    )
                ]
            )
            phonemes = (
                [
                    AssessedPhoneme(
                        ipa="w", accuracy_score=72.0, nbest_phonemes=[("w", 72.0), ("v", 40.0)]
                    ),
                    AssessedPhoneme(
                        ipa="ɜːr",
                        accuracy_score=42.0,
                        nbest_phonemes=[("ɔːr", 65.0), ("ɜːr", 42.0)],
                    ),
                    AssessedPhoneme(ipa="k", accuracy_score=94.0),
                ]
                if clean == "working"
                else [AssessedPhoneme(ipa=clean[:1] or "ə", accuracy_score=max(0.0, w_acc))]
            )
            words.append(
                AssessedWord(
                    word=tok.strip(".,?!"),
                    accuracy_score=max(0.0, w_acc),
                    error_type="Mispronunciation" if w_acc < 60.0 else "None",
                    offset_ms=idx * 350,
                    duration_ms=320,
                    confidence=0.92,
                    syllables=syllables,
                    phonemes=phonemes,
                )
            )
        duration = round(len(tokens) * 0.35, 2)
        return SpeechAssessmentResult(
            transcript=text,
            confidence=0.92,
            speaking_duration_seconds=duration,
            words=words,
            accuracy_score=self.accuracy,
            fluency_score=self.fluency,
            prosody_score=self.prosody,
            completeness_score=self.completeness if reference_text else None,
            is_final=True,
            word_times_measured=bool(words),
            measured_confidence=0.92,
            provider="test_fake",
        )


class FakeLlmProvider:
    """Deterministic test double for Gemini LLM."""

    _counter: int = 0

    async def generate_editor_json(self, instruction: str, data: dict[str, object]) -> object:  # noqa: ARG002
        if data.get("task") == "coach_topic":
            return {
                "category": "DAILY_LIFE",
                "title": "Making Weekend Plans",
                "description": "Invite a friend to a weekend activity and agree on a time and place.",
                "minLevel": "A2",
                "targetSkills": ["Fluency", "Vocabulary"],
            }
        if data.get("task") == "distractors":
            return {
                "meaningVi": data.get("meaningVi") or "Tôi có thể giúp gì cho bạn?",
                "distractorsEn": [
                    "Are you staying here?",
                    "When does it open?",
                    "How much is the total?",
                ],
                "distractorsVi": ["Bạn ở lại đây à?", "Mấy giờ mở cửa?", "Tổng cộng bao nhiêu?"],
            }
        phrases = [
            ("Good afternoon.", "Chào buổi chiều.", "Hello there.", "Good afternoon. How are you?"),
            (
                "Could you help me?",
                "Bạn giúp tôi được không?",
                "Can you help me?",
                "Could you help me with my booking?",
            ),
            (
                "Could you repeat that?",
                "Bạn nhắc lại được không?",
                "Can you say that again?",
                "Could you repeat that number?",
            ),
            (
                "That works for me.",
                "Như vậy phù hợp với tôi.",
                "That sounds good to me.",
                "That works for me. Thank you.",
            ),
        ]
        count = data.get("chunkCount")
        tags = ["OPENING", "REQUEST", "CLARIFY", "AGREE_DECLINE"]
        return {
            "titleVi": data.get("topic"),
            "titleEn": "Practice a conversation",
            "context": "Bạn cần hỏi thông tin và xác nhận chi tiết trước khi kết thúc cuộc hội thoại.",
            "userRole": "Khách hàng",
            "aiRole": "Nhân viên hỗ trợ",
            "goals": ["Hỏi và xác nhận thông tin."],
            "chunks": [
                {
                    "functionTag": tags[idx],
                    "text": text,
                    "meaningVi": meaning,
                    "acceptedVariations": [variation],
                    "exampleSentence": example,
                    "distractorsEn": ["How far is it?", "Did you call me?", "What day is it?"],
                    "distractorsVi": [
                        "Cách đây bao xa?",
                        "Bạn đã gọi tôi à?",
                        "Hôm nay là ngày gì?",
                    ],
                }
                for idx, (text, meaning, variation, example) in enumerate(
                    phrases[: count if isinstance(count, int) else 4]
                )
            ],
            "requirements": [
                {"description": "Đặt một câu hỏi.", "isMandatory": True},
                {"description": "Xác nhận thông tin.", "isMandatory": True},
            ],
        }

    async def evaluate_placement(self, transcripts: list[str]) -> LlmLevelEvaluation:
        total_words = sum(len(t.split()) for t in transcripts)
        avg_w = total_words / max(len(transcripts), 1)
        if avg_w >= 45:
            return LlmLevelEvaluation(
                "C1", 0.85, "Vốn từ và cấu trúc câu phong phú.", 86.0, 84.0, 86.0
            )
        if avg_w >= 25:
            return LlmLevelEvaluation("B2", 0.82, "Diễn đạt mạch lạc, đủ ý.", 76.0, 74.0, 78.0)
        if avg_w >= 12:
            return LlmLevelEvaluation(
                "B1", 0.80, "Giao tiếp ổn trong các tình huống quen thuộc.", 64.0, 62.0, 66.0
            )
        if avg_w >= 6:
            return LlmLevelEvaluation("A2", 0.78, "Nói được câu đơn cơ bản.", 48.0, 46.0, 50.0)
        return LlmLevelEvaluation("A1", 0.75, "Cần luyện thêm câu hoàn chỉnh.", 34.0, 32.0, 38.0)

    def generate_coach_reply_sync(
        self,
        history: list[dict[str, str]],  # noqa: ARG002
        user_message: str,  # noqa: ARG002
        user_level: str,
        topic_title: str,
        topic_min_level: str = "A1",  # noqa: ARG002
        *,
        interruption_context: dict[str, Any] | None = None,
    ) -> str:
        if interruption_context:
            return (
                f"Got it, let's jump right into your point about {topic_title}. "
                "What detail stands out most to you?"
            )
        lvl = (user_level or "B1").upper()
        if lvl in ("A1", "A2"):
            return f"That's nice about {topic_title}! What do you like most about it?"
        if lvl == "C1":
            return (
                f"That's a compelling perspective on {topic_title}. "
                "How do you see that evolving over the next few years?"
            )
        return f"That sounds great about {topic_title}! Could you share a bit more about that?"

    async def generate_coach_reply(
        self,
        history: list[dict[str, str]],
        user_message: str,
        user_level: str,
        topic_title: str,
        topic_min_level: str = "A1",
        *,
        interruption_context: dict[str, Any] | None = None,
        learner_directives: str | None = None,  # noqa: ARG002
    ) -> str:
        return self.generate_coach_reply_sync(
            history,
            user_message,
            user_level,
            topic_title,
            topic_min_level,
            interruption_context=interruption_context,
        )

    async def generate_suggested_replies(
        self,
        history: list[dict[str, str]],  # noqa: ARG002
        last_ai_message: str,  # noqa: ARG002
        user_level: str,
        topic_title: str,
        topic_min_level: str = "A1",  # noqa: ARG002
    ) -> list[dict[str, str]]:
        lvl = (user_level or "A1").upper()
        if lvl in ("A1", "A2"):
            return [
                {
                    "text": f"I like talking about {topic_title} very much.",
                    "translation": f"Tôi rất thích nói về {topic_title}.",
                },
                {
                    "text": "I usually do this on weekends with friends.",
                    "translation": "Tôi thường làm việc này vào cuối tuần cùng bạn bè.",
                },
                {
                    "text": "Can you tell me more about your favorite part?",
                    "translation": "Bạn có thể kể thêm về phần bạn thích nhất không?",
                },
            ]
        if lvl in ("B1", "B2"):
            return [
                {
                    "text": f"From my perspective, {topic_title} gives us a great opportunity to grow.",
                    "translation": f"Theo góc nhìn của tôi, {topic_title} mang lại cơ hội phát triển rất tốt.",
                },
                {
                    "text": "I really appreciate how we prioritize practical communication skills here.",
                    "translation": "Tôi rất trân trọng cách chúng ta ưu tiên kỹ năng giao tiếp thực tế.",
                },
                {
                    "text": "How does that change your perspective when schedules get busy?",
                    "translation": "Điều đó thay đổi góc nhìn của bạn thế nào khi lịch trình bận rộn?",
                },
            ]
        return [
            {
                "text": f"That offers a remarkably nuanced perspective on {topic_title}.",
                "translation": f"Điều đó mang lại một góc nhìn sâu sắc và tinh tế về {topic_title}.",
            },
            {
                "text": "Balancing strategic foresight with empathy seems invaluable in the long run.",
                "translation": "Cân bằng giữa tầm nhìn chiến lược và sự thấu cảm là điều vô giá về lâu dài.",
            },
            {
                "text": "What makes that approach so intellectually compelling in real contexts?",
                "translation": "Điều gì khiến cách tiếp cận đó hấp dẫn về mặt tư duy trong thực tế?",
            },
        ]

    async def translate_text(self, text: str, target_lang: str = "vi") -> str:  # noqa: ARG002
        return f"[Dịch] {text}"

    async def evaluate_post_session(
        self,
        history: list[dict[str, str]],
        topic_title: str,
        user_level: str,
    ) -> PostSessionLlmEvaluation:
        user_texts = [
            h.get("text", "") for h in history if (h.get("speaker") or "").upper() == "USER"
        ]
        total_words = sum(len(t.split()) for t in user_texts)
        avg_w = total_words / max(len(user_texts), 1)
        lvl = (user_level or "B1").upper()
        if lvl == "A1" or avg_w < 6:
            v_score, g_score, i_score, c_score, band = 42.0, 40.0, 44.0, 42.0, "A1"
        elif lvl == "A2" or avg_w < 14:
            v_score, g_score, i_score, c_score, band = 55.0, 52.0, 58.0, 56.0, "A2"
        elif lvl == "B1" or avg_w < 25:
            v_score, g_score, i_score, c_score, band = 68.0, 64.0, 72.0, 70.0, "B1"
        elif lvl == "B2" or avg_w < 40:
            v_score, g_score, i_score, c_score, band = 78.0, 75.0, 80.0, 78.0, "B2"
        else:
            v_score, g_score, i_score, c_score, band = 88.0, 86.0, 90.0, 88.0, "C1"

        return PostSessionLlmEvaluation(
            vocabulary_score=v_score,
            vocabulary_cefr_band=band,
            grammar_score=g_score,
            grammar_cefr_band=band,
            grammar_errors=[
                GrammarErrorItem(
                    original="Yesterday I go to work",
                    correction="Yesterday I went to work",
                    explanation_vi="Dùng thì quá khứ đơn 'went' cho mốc thời gian đã qua.",
                    severity="moderate",
                )
            ],
            interaction_score=i_score,
            coherence_score=c_score,
            strengths=[
                f"Phản xạ tự nhiên và bám sát chủ đề '{topic_title}'.",
                "Giữ mạch hội thoại tốt qua các lượt hỏi đáp.",
            ],
            improvements=[
                "Mở rộng thêm từ vựng miêu tả và lưu ý chia thì quá khứ khi kể chuyện.",
            ],
            next_practice=f"Luyện thêm các cấu trúc nối câu trong chủ đề '{topic_title}'.",
        )

    async def generate_roleplay_reply(
        self,
        history: list[dict[str, str]],  # noqa: ARG002
        user_message: str,  # noqa: ARG002
        user_level: str,  # noqa: ARG002
        scenario_context: str,  # noqa: ARG002
        ai_role: str,
        user_role: str,  # noqa: ARG002
        goals: list[str],  # noqa: ARG002
        target_chunks: list[str],  # noqa: ARG002
    ) -> str:
        return f"Certainly! As the {ai_role}, I'd be happy to help you with that. Anything else?"

    async def evaluate_roleplay(
        self,
        history: list[dict[str, str]],
        scenario_title: str,
        scenario_context: str,  # noqa: ARG002
        requirements: list[dict[str, Any]],
        chunks: list[dict[str, Any]],
        user_level: str,  # noqa: ARG002
    ) -> dict[str, Any]:
        user_turns = [h.get("content", "") for h in history if h.get("role") == "user"]
        all_text = " ".join(user_turns).lower()
        total_words = len(all_text.split())
        req_evals = []
        for idx, req in enumerate(requirements):
            passed = total_words >= 5 and len(user_turns) >= 1
            req_evals.append(
                {
                    "requirement_id": str(req.get("id", "")),
                    "description": req.get("description", ""),
                    "is_mandatory": req.get("is_mandatory", True),
                    "status": "PASS" if passed else "FAIL",
                    "evidence": user_turns[min(idx, len(user_turns) - 1)] if user_turns else "",
                    "reason": "Hoàn thành nhiệm vụ giao tiếp."
                    if passed
                    else "Chưa đủ dữ liệu nói.",
                }
            )
        verdicts = {str(c.get("id", "")): True for c in chunks}
        return {
            "requirements_evaluation": req_evals,
            "functional_chunk_verdicts": verdicts,
            "strengths": [
                f"Giao tiếp tự tin trong tình huống '{scenario_title}'.",
                "Phản hồi đúng ngữ cảnh.",
            ],
            "improvements": ["Áp dụng thêm các cụm mẫu câu mục tiêu để tự nhiên hơn."],
            "next_practice": f"Ôn lại các cụm chưa dùng trong '{scenario_title}'.",
        }


class FakeTtsProvider:
    """Test-only TTS double."""

    async def synthesize(self, text: str, voice: str = "en-US-AvaNeural") -> bytes:  # noqa: ARG002
        return b"\xff\xfb\x90d" + text.encode("utf-8")[:64]

    async def get_audio_url_or_none(self, text: str, voice: str = "en-US-AvaNeural") -> str | None:  # noqa: ARG002
        return None


def make_test_wav(duration_sec: float = 0.5, sample_rate: int = 16000) -> bytes:
    """Helper producing a tiny valid 16kHz PCM16 WAV byte payload for tests."""
    import io
    import wave

    n_samples = int(duration_sec * sample_rate)
    pcm = b"\x00\x00" * n_samples
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)
    return buf.getvalue()


def make_azure_json_payload(
    transcript: str = "How long have you been working there",
) -> dict[str, Any]:
    """Return a realistic Azure Pronunciation Assessment JSON payload for parser tests."""
    return json.loads(
        json.dumps(
            {
                "RecognitionStatus": "Success",
                "DisplayText": transcript,
                "NBest": [
                    {
                        "Confidence": 0.91,
                        "Display": transcript,
                        "PronunciationAssessment": {
                            "AccuracyScore": 84.0,
                            "FluencyScore": 86.0,
                            "ProsodyScore": 81.0,
                            "CompletenessScore": 100.0,
                            "PronScore": 85.0,
                        },
                        "Words": [
                            {
                                "Word": "working",
                                "Offset": 1_200_000,
                                "Duration": 4_500_000,
                                "PronunciationAssessment": {
                                    "AccuracyScore": 65.0,
                                    "ErrorType": "None",
                                },
                                "Syllables": [
                                    {
                                        "Syllable": "w er",
                                        "Grapheme": "wor",
                                        "AccuracyScore": 45.0,
                                        "Offset": 1_200_000,
                                        "Duration": 2_000_000,
                                    },
                                    {
                                        "Syllable": "k ih ng",
                                        "Grapheme": "king",
                                        "AccuracyScore": 88.0,
                                        "Offset": 3_200_000,
                                        "Duration": 2_500_000,
                                    },
                                ],
                                "Phonemes": [
                                    {
                                        "Phoneme": "w",
                                        "PronunciationAssessment": {"AccuracyScore": 74.0},
                                    },
                                    {
                                        "Phoneme": "ɜːr",
                                        "PronunciationAssessment": {
                                            "AccuracyScore": 42.0,
                                            "NBestPhonemes": [
                                                {"Phoneme": "ɔːr", "Score": 68.0},
                                                {"Phoneme": "ɜːr", "Score": 42.0},
                                            ],
                                        },
                                    },
                                ],
                            }
                        ],
                    }
                ],
            }
        )
    )
