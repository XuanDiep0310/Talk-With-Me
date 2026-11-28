import json
from unittest.mock import patch

import httpx

from app.core.providers.llm_provider import GeminiLlmProvider


async def test_editor_provider_requests_json_without_putting_credentials_in_the_url() -> None:
    expected = {"titleVi": "Đặt phòng"}
    provider = GeminiLlmProvider("test-key")

    def respond(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert "test-key" not in str(request.url)
        assert request.headers["x-goog-api-key"] == "test-key"
        assert body["generationConfig"]["responseMimeType"] == "application/json"
        assert body["systemInstruction"]["parts"][0]["text"] == "Generate JSON."
        assert json.loads(body["contents"][0]["parts"][0]["text"]) == {"topic": "Đặt phòng"}
        return httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": json.dumps(expected)}]}}]},
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    with patch("app.core.providers.llm_provider.httpx.AsyncClient", return_value=client):
        assert (
            await provider.generate_editor_json("Generate JSON.", {"topic": "Đặt phòng"})
            == expected
        )


async def test_groq_openai_compatible_and_fallback_provider() -> None:
    from app.core.providers.llm_provider import (
        FallbackLlmProvider,
        OpenAiCompatibleLlmProvider,
        _build_single_llm_provider,
    )

    provider = _build_single_llm_provider("groq", "gsk_test", "")
    assert isinstance(provider, OpenAiCompatibleLlmProvider)
    assert "api.groq.com" in provider.endpoint
    assert provider.model == "llama-3.3-70b-versatile"

    def respond_ok(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer gsk_test"
        body = json.loads(request.content)
        assert body["model"] == "llama-3.3-70b-versatile"
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {"suggestions": [{"text": "Yes, please!", "translation": "Vâng!"}]}
                            )
                        }
                    }
                ]
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(respond_ok))
    with patch("app.core.providers.llm_provider.httpx.AsyncClient", return_value=client):
        suggs = await provider.generate_suggested_replies([], "Hi!", "A2", "Travel")
        assert suggs == [{"text": "Yes, please!", "translation": "Vâng!"}]

    class FailingLlm:
        async def translate_text(self, text: str, target_lang: str = "vi") -> str:  # noqa: ARG002
            raise RuntimeError("429 Quota exceeded")

    class BackupLlm:
        async def translate_text(self, text: str, target_lang: str = "vi") -> str:  # noqa: ARG002
            return f"translated:{text}"

    fb = FallbackLlmProvider(primary=FailingLlm(), fallback=BackupLlm())  # type: ignore[arg-type]
    assert await fb.translate_text("Hello") == "translated:Hello"
