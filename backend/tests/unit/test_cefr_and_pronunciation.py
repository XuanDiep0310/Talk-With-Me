"""Unit tests for Azure Speech syllable/IPA mapping, PCM conversion, and Longitudinal CEFR Model."""

from __future__ import annotations

import json
from unittest.mock import patch

import httpx
import pytest

from app.core.exceptions import ProviderUnavailableError
from app.core.providers.speech_assessment_provider import (
    AzureSpeechRestProvider,
    CompositeAzureSpeechProvider,
    parse_azure_json_segments,
    to_pcm16_16k_mono,
)
from app.core.speech.ipa import text_to_ipa, word_to_ipa
from app.core.speech.syllable_mapper import build_pronunciation_breakdown
from app.services.cefr_estimator import (
    calibrate_acoustic_for_cefr,
    estimate_cefr_from_vector,
    merge_pronunciation_modalities,
    update_ewma,
)
from tests.fakes import make_azure_json_payload, make_test_wav


class TestIpaAndSyllableMapping:
    def test_cmudict_ipa_conversion(self) -> None:
        ipa_word = word_to_ipa("working")
        assert "w" in ipa_word
        phrase_ipa = text_to_ipa("How long have you been working there")
        assert "w" in phrase_ipa and "h" in phrase_ipa

    def test_parse_azure_json_segments_extracts_syllables_and_phonemes(self) -> None:
        payload = make_azure_json_payload(transcript="working")
        res = parse_azure_json_segments([payload], provider_name="azure_sdk")
        assert res.transcript == "working"
        assert res.accuracy_score == 84.0
        assert res.fluency_score == 86.0
        assert res.prosody_score == 81.0
        working = res.words[0]
        assert [s.text for s in working.syllables] == ["wor", "king"]
        assert working.phonemes[1].accuracy_score < 60.0

    def test_syllable_mapper_builds_colors_and_vietnamese_tip(self) -> None:
        payload = make_azure_json_payload(transcript="working")
        res = parse_azure_json_segments([payload], provider_name="azure_rest")
        words_out, display_score, tip = build_pronunciation_breakdown("How long working", res)
        assert len(words_out) == 3
        assert display_score is not None and display_score > 0
        working = next(w for w in words_out if w.word == "working")
        statuses = [s.status for s in working.syllables]
        assert statuses == ["poor", "good"]
        assert "Phát âm" in tip or "Lưu ý" in tip or "âm" in tip

    def test_to_pcm16_16k_mono_parses_wav(self) -> None:
        wav_bytes = make_test_wav(duration_sec=0.2, sample_rate=16000)
        pcm = to_pcm16_16k_mono(wav_bytes, mime_type="audio/wav")
        assert len(pcm) == int(16000 * 0.2) * 2


class TestAzureProviderRealFailureSemantics:
    @pytest.mark.asyncio
    async def test_azure_rest_parses_response_without_fake_fallback(self) -> None:
        provider = AzureSpeechRestProvider(key="real-test-key", region="eastasia")
        payload = make_azure_json_payload(transcript="working")

        def respond(request: httpx.Request) -> httpx.Response:
            assert request.headers["Ocp-Apim-Subscription-Key"] == "real-test-key"
            assert "Pronunciation-Assessment" in request.headers
            return httpx.Response(200, json=payload)

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with patch(
            "app.core.providers.speech_assessment_provider.httpx.AsyncClient", return_value=client
        ):
            res = await provider.assess(make_test_wav(), reference_text="working")
            assert res.provider == "azure_rest"
            assert res.accuracy_score == 84.0

    @pytest.mark.asyncio
    async def test_unconfigured_provider_raises_503_never_fakes(self) -> None:
        from app.core.providers.speech_assessment_provider import (
            AzureSpeechSdkProvider,
            get_speech_assessment_provider,
        )

        with patch("app.core.providers.speech_assessment_provider.get_settings") as mock_cfg:
            mock_cfg.return_value.AZURE_SPEECH_KEY = ""
            mock_cfg.return_value.AZURE_SPEECH_REGION = ""
            with pytest.raises(ProviderUnavailableError) as exc_info:
                get_speech_assessment_provider()
            assert exc_info.value.status_code == 503
            detail = exc_info.value.detail
            assert isinstance(detail, dict)
            assert detail["code"] == "SPEECH_ASSESSMENT_NOT_CONFIGURED"

        composite = CompositeAzureSpeechProvider(
            sdk_provider=AzureSpeechSdkProvider(key="", region=""),
            rest_provider=AzureSpeechRestProvider(key="", region=""),
        )
        with pytest.raises(ProviderUnavailableError) as exc2:
            await composite.assess(make_test_wav(), reference_text="Hello")
        assert exc2.value.status_code == 503
        assert isinstance(exc2.value.detail, dict)
        assert exc2.value.detail["code"] == "SPEECH_ASSESSMENT_UNAVAILABLE"

    def test_json_strip_payload_validity(self) -> None:
        parsed = json.loads(json.dumps(make_azure_json_payload()))
        assert parsed["RecognitionStatus"] == "Success"


class TestCalibratedCefrModel:
    def test_l2_intelligibility_calibration_curves(self) -> None:
        # B1-level native-similarity (~70) maps higher on communicative intelligibility
        assert calibrate_acoustic_for_cefr(70.0) >= 70.0
        assert calibrate_acoustic_for_cefr(30.0) < 30.0

    def test_ewma_damps_single_outlier_spike(self) -> None:
        normal = update_ewma(60.0, 70.0, alpha=0.35)
        outlier = update_ewma(60.0, 95.0, alpha=0.35)
        assert normal is not None and outlier is not None
        assert normal == 63.5
        # Delta > 20 -> effective_alpha = 0.35 * 0.7 = 0.245 -> 60 + 35*0.245 = 68.6
        assert outlier == 68.6

    def test_modality_merge_weights_unscripted_higher(self) -> None:
        merged = merge_pronunciation_modalities(scripted=90.0, unscripted=60.0)
        assert merged == 69.0  # 0.70*60 + 0.30*90

    def test_conjunctive_guardrail_prevents_b2_inflation_when_fluency_low(self) -> None:
        # High Vocab/Grammar/Interaction (82+) + severely limited Fluency (38) must cap below B2
        est = estimate_cefr_from_vector(
            {
                "pronunciation": 72.0,
                "fluency": 38.0,
                "vocabulary": 84.0,
                "grammar": 82.0,
                "interaction": 82.0,
            },
            unscripted_count=4,
            scripted_count=2,
        )
        assert est.estimated_cefr in ("A2", "B1")
        assert "fluency" in est.limiting_dimensions

    def test_balanced_strong_profile_reaches_c1(self) -> None:
        est = estimate_cefr_from_vector(
            {
                "pronunciation": 86.0,
                "fluency": 88.0,
                "vocabulary": 90.0,
                "grammar": 88.0,
                "interaction": 90.0,
            },
            unscripted_count=6,
            scripted_count=3,
        )
        assert est.estimated_cefr == "C1"
        assert est.confidence == "HIGH"


class TestAzureNeuralTtsProvider:
    @pytest.mark.asyncio
    async def test_azure_tts_sends_ssml_and_returns_mp3(self) -> None:
        from app.core.providers.tts_provider import AzureSpeechTtsProvider

        provider = AzureSpeechTtsProvider(key="real-tts-key", region="southeastasia")

        def respond(request: httpx.Request) -> httpx.Response:
            assert request.headers["Ocp-Apim-Subscription-Key"] == "real-tts-key"
            assert request.headers["X-Microsoft-OutputFormat"] == "audio-24khz-48kbitrate-mono-mp3"
            body = request.content.decode("utf-8")
            assert "en-US-JennyNeural" in body
            assert "Hello &amp; welcome" in body
            return httpx.Response(200, content=b"ID3-mp3-bytes")

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with patch("app.core.providers.tts_provider.httpx.AsyncClient", return_value=client):
            out = await provider.synthesize("Hello & welcome", voice="en-US-JennyNeural")
            assert out == b"ID3-mp3-bytes"

    @pytest.mark.asyncio
    async def test_composite_tts_raises_503_when_all_providers_fail(self) -> None:
        from app.core.providers.tts_provider import CompositeTtsProvider, EdgeTtsProvider

        class BrokenEdge(EdgeTtsProvider):
            async def synthesize(self, text: str, voice: str = "en-US-JennyNeural") -> bytes:  # noqa: ARG002
                raise RuntimeError("403 forbidden")

        provider = CompositeTtsProvider(azure_provider=None, edge_provider=BrokenEdge())
        with pytest.raises(ProviderUnavailableError) as exc_info:
            await provider.synthesize("Hello")
        assert exc_info.value.status_code == 503
