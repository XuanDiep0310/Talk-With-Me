import json
from unittest.mock import patch

import httpx
import pytest

from app.core.providers.llm_provider import GeminiLlmProvider, GroqLlmProvider


@pytest.mark.parametrize("provider_name", ["gemini", "groq"])
async def test_editor_provider_requests_json_without_putting_credentials_in_the_url(
    provider_name: str,
) -> None:
    expected = {"titleVi": "Đặt phòng"}
    provider = (
        GeminiLlmProvider("test-key") if provider_name == "gemini" else GroqLlmProvider("test-key")
    )

    def respond(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert "test-key" not in str(request.url)
        if provider_name == "gemini":
            assert request.headers["x-goog-api-key"] == "test-key"
            assert body["generationConfig"]["responseMimeType"] == "application/json"
            assert body["systemInstruction"]["parts"][0]["text"] == "Generate JSON."
            assert json.loads(body["contents"][0]["parts"][0]["text"]) == {"topic": "Đặt phòng"}
            return httpx.Response(
                200,
                json={"candidates": [{"content": {"parts": [{"text": json.dumps(expected)}]}}]},
            )
        assert request.headers["authorization"] == "Bearer test-key"
        assert body["response_format"] == {"type": "json_object"}
        assert body["messages"][0] == {"role": "system", "content": "Generate JSON."}
        assert json.loads(body["messages"][1]["content"]) == {"topic": "Đặt phòng"}
        return httpx.Response(
            200, json={"choices": [{"message": {"content": json.dumps(expected)}}]}
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    with patch("app.core.providers.llm_provider.httpx.AsyncClient", return_value=client):
        assert (
            await provider.generate_editor_json("Generate JSON.", {"topic": "Đặt phòng"})
            == expected
        )
