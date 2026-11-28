"""Unified Azure AI Speech provider for single-pass STT + Pronunciation Assessment.

Primary: Azure Speech SDK (PushAudioInputStream, Phoneme/Syllable/Prosody granularity).
Fallback: Azure Speech REST API v1 (when SDK initialization or transport fails).
Never falls back to fake data in runtime; raises ProviderUnavailableError on failure.
"""

from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
import wave
import weakref
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

from app.core.config import Settings, get_settings
from app.core.exceptions import ProviderUnavailableError

logger = logging.getLogger(__name__)

_TICK_TO_MS = 10_000

_ORIGINAL_SPEECH_ASYNC_CLIENT = httpx.AsyncClient
_SPEECH_CLIENTS: weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, httpx.AsyncClient] = (
    weakref.WeakKeyDictionary()
)


def _get_speech_http_client() -> tuple[httpx.AsyncClient, bool]:
    """Return (client, should_close). Reuses keep-alive client unless httpx.AsyncClient is mocked."""
    if httpx.AsyncClient is not _ORIGINAL_SPEECH_ASYNC_CLIENT:
        return httpx.AsyncClient(), True
    loop = asyncio.get_running_loop()
    client = _SPEECH_CLIENTS.get(loop)
    if client is None or client.is_closed:
        client = httpx.AsyncClient(
            limits=httpx.Limits(max_keepalive_connections=16, max_connections=40),
        )
        _SPEECH_CLIENTS[loop] = client
    return client, False


@dataclass(slots=True)
class AssessedPhoneme:
    ipa: str
    accuracy_score: float
    nbest_phonemes: list[tuple[str, float]] = field(default_factory=list)


@dataclass(slots=True)
class AssessedSyllable:
    text: str
    accuracy_score: float
    offset_ms: int = 0
    duration_ms: int = 0


@dataclass(slots=True)
class AssessedWord:
    word: str
    accuracy_score: float
    error_type: str = "None"
    offset_ms: int = 0
    duration_ms: int = 0
    confidence: float = 0.0
    syllables: list[AssessedSyllable] = field(default_factory=list)
    phonemes: list[AssessedPhoneme] = field(default_factory=list)

    @property
    def start_ms(self) -> int:
        return self.offset_ms

    @property
    def end_ms(self) -> int:
        return self.offset_ms + self.duration_ms


# Alias used by speech_features and tests
WordTiming = AssessedWord


@dataclass(slots=True)
class SpeechAssessmentResult:
    transcript: str
    confidence: float
    speaking_duration_seconds: float
    words: list[AssessedWord] = field(default_factory=list)
    accuracy_score: float | None = None
    fluency_score: float | None = None
    prosody_score: float | None = None
    completeness_score: float | None = None
    is_final: bool = True
    word_times_measured: bool = True
    measured_confidence: float | None = None
    provider: str = "azure_sdk"


class SpeechAssessmentProvider(Protocol):
    """Unified interface returning transcript, timings, and acoustic pronunciation assessment."""

    async def assess(
        self,
        audio_bytes: bytes,
        *,
        reference_text: str = "",
        mime_type: str = "audio/wav",
        language: str = "en-US",
    ) -> SpeechAssessmentResult: ...


def to_pcm16_16k_mono(audio_bytes: bytes, mime_type: str = "audio/wav") -> bytes:
    """Convert incoming PCM/WAV/WebM/MP4/MP3 bytes to 16kHz 16-bit mono PCM in memory."""
    if not audio_bytes:
        return b""

    lower_mime = (mime_type or "").lower()
    if "pcm" in lower_mime:
        even_len = len(audio_bytes) - (len(audio_bytes) % 2)
        return audio_bytes[:even_len]

    if len(audio_bytes) >= 44 and audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                if wf.getnchannels() == 1 and wf.getsampwidth() == 2 and wf.getframerate() == 16000:
                    return wf.readframes(wf.getnframes())
        except Exception:
            pass

    import av

    resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)
    out = bytearray()
    with av.open(io.BytesIO(audio_bytes), mode="r") as container:
        for frame in container.decode(audio=0):
            for resampled in resampler.resample(frame):
                out.extend(bytes(resampled.planes[0]))
        for resampled in resampler.resample(None):
            out.extend(bytes(resampled.planes[0]))
    return bytes(out)


def pcm16_to_wav_bytes(pcm_bytes: bytes, sample_rate: int = 16000) -> bytes:
    """Wrap raw 16kHz 16-bit mono PCM bytes in a WAV container in memory."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    return buf.getvalue()


def _extract_pa_field(node: dict[str, Any], key: str) -> float | None:
    pa = node.get("PronunciationAssessment")
    if isinstance(pa, dict) and pa.get(key) is not None:
        return float(pa[key])
    if node.get(key) is not None:
        return float(node[key])
    return None


def parse_azure_json_segments(
    payloads: list[dict[str, Any]],
    *,
    provider_name: str,
) -> SpeechAssessmentResult:
    """Parse one or more Azure Speech Pronunciation JSON payloads into a unified result."""
    transcript_parts: list[str] = []
    words: list[AssessedWord] = []
    confidences: list[float] = []
    acc_weighted: list[tuple[float, int]] = []
    flu_weighted: list[tuple[float, int]] = []
    pro_weighted: list[tuple[float, int]] = []
    comp_weighted: list[tuple[float, int]] = []

    for payload in payloads:
        nbest = payload.get("NBest") or []
        if not nbest:
            display_only = str(payload.get("DisplayText", "")).strip()
            if display_only:
                transcript_parts.append(display_only)
            continue

        top = nbest[0]
        seg_text = str(top.get("Display") or payload.get("DisplayText") or "").strip()
        if seg_text:
            transcript_parts.append(seg_text)

        conf = top.get("Confidence")
        if conf is not None:
            confidences.append(float(conf))

        raw_words = top.get("Words") or []
        weight = max(1, len(raw_words))

        seg_acc = _extract_pa_field(top, "AccuracyScore")
        seg_flu = _extract_pa_field(top, "FluencyScore")
        seg_pro = _extract_pa_field(top, "ProsodyScore")
        seg_comp = _extract_pa_field(top, "CompletenessScore")
        if seg_acc is not None:
            acc_weighted.append((seg_acc, weight))
        if seg_flu is not None:
            flu_weighted.append((seg_flu, weight))
        if seg_pro is not None:
            pro_weighted.append((seg_pro, weight))
        if seg_comp is not None:
            comp_weighted.append((seg_comp, weight))

        for w in raw_words:
            w_pa = w.get("PronunciationAssessment") or {}
            w_acc = _extract_pa_field(w, "AccuracyScore")
            error_type = str(w_pa.get("ErrorType") or w.get("ErrorType") or "None")
            offset_ms = int(w.get("Offset", 0)) // _TICK_TO_MS
            duration_ms = int(w.get("Duration", 0)) // _TICK_TO_MS

            syllables: list[AssessedSyllable] = []
            for syl in w.get("Syllables") or []:
                syl_acc = _extract_pa_field(syl, "AccuracyScore")
                grapheme = str(syl.get("Grapheme") or syl.get("Syllable") or "").strip()
                if grapheme:
                    syllables.append(
                        AssessedSyllable(
                            text=grapheme,
                            accuracy_score=round(
                                syl_acc if syl_acc is not None else (w_acc or 0.0), 1
                            ),
                            offset_ms=int(syl.get("Offset", 0)) // _TICK_TO_MS,
                            duration_ms=int(syl.get("Duration", 0)) // _TICK_TO_MS,
                        )
                    )

            phonemes: list[AssessedPhoneme] = []
            for ph in w.get("Phonemes") or []:
                ph_pa = ph.get("PronunciationAssessment") or {}
                ph_acc = _extract_pa_field(ph, "AccuracyScore")
                nbest_raw = ph_pa.get("NBestPhonemes") or ph.get("NBestPhonemes") or []
                nbest_list = [
                    (str(item.get("Phoneme", "")), float(item.get("Score", 0.0)))
                    for item in nbest_raw[:3]
                    if item.get("Phoneme")
                ]
                ipa_sym = str(ph.get("Phoneme") or "").strip()
                if ipa_sym:
                    phonemes.append(
                        AssessedPhoneme(
                            ipa=ipa_sym,
                            accuracy_score=round(
                                ph_acc if ph_acc is not None else (w_acc or 0.0), 1
                            ),
                            nbest_phonemes=nbest_list,
                        )
                    )

            w_conf = float(conf) if conf is not None else ((w_acc or 0.0) / 100.0)
            words.append(
                AssessedWord(
                    word=str(w.get("Word", "")),
                    accuracy_score=round(w_acc if w_acc is not None else 0.0, 1),
                    error_type=error_type,
                    offset_ms=offset_ms,
                    duration_ms=duration_ms,
                    confidence=round(min(1.0, max(0.0, w_conf)), 3),
                    syllables=syllables,
                    phonemes=phonemes,
                )
            )

    def _wavg(items: list[tuple[float, int]]) -> float | None:
        if not items:
            return None
        total_w = sum(w for _, w in items)
        return round(sum(v * w for v, w in items) / total_w, 1) if total_w > 0 else None

    avg_conf = round(sum(confidences) / len(confidences), 3) if confidences else 0.0
    duration_sec = 0.0
    if words:
        duration_sec = max(0.0, (words[-1].end_ms - words[0].start_ms) / 1000.0)

    return SpeechAssessmentResult(
        transcript=" ".join(transcript_parts).strip(),
        confidence=avg_conf,
        speaking_duration_seconds=round(duration_sec, 2),
        words=words,
        accuracy_score=_wavg(acc_weighted),
        fluency_score=_wavg(flu_weighted),
        prosody_score=_wavg(pro_weighted),
        completeness_score=_wavg(comp_weighted),
        is_final=True,
        word_times_measured=bool(words),
        measured_confidence=avg_conf if confidences else None,
        provider=provider_name,
    )


class AzureSpeechSdkProvider:
    """Primary Azure Speech SDK provider (single-pass STT + Pronunciation Assessment)."""

    def __init__(self, key: str, region: str, language: str = "en-US") -> None:
        self.key = key
        self.region = region
        self.language = language

    def _assess_sync(
        self, pcm_bytes: bytes, reference_text: str, language: str
    ) -> SpeechAssessmentResult:
        import azure.cognitiveservices.speech as speechsdk

        speech_config = speechsdk.SpeechConfig(subscription=self.key, region=self.region)
        speech_config.speech_recognition_language = language
        speech_config.set_property(
            speechsdk.PropertyId.SpeechServiceResponse_RequestDetailedResultTrueFalse, "true"
        )
        speech_config.set_property(
            speechsdk.PropertyId.SpeechServiceResponse_OutputFormatOption, "Detailed"
        )

        audio_format = speechsdk.audio.AudioStreamFormat(
            samples_per_second=16000, bits_per_sample=16, channels=1
        )
        push_stream = speechsdk.audio.PushAudioInputStream(stream_format=audio_format)
        audio_config = speechsdk.audio.AudioConfig(stream=push_stream)

        pa_config = speechsdk.PronunciationAssessmentConfig(
            reference_text=reference_text,
            grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
            granularity=speechsdk.PronunciationAssessmentGranularity.Phoneme,
            enable_miscue=bool(reference_text),
        )
        pa_config.phoneme_alphabet = "IPA"
        pa_config.nbest_phoneme_count = 3
        pa_config.enable_prosody_assessment()

        recognizer = speechsdk.SpeechRecognizer(
            speech_config=speech_config, audio_config=audio_config
        )
        pa_config.apply_to(recognizer)

        duration_sec = len(pcm_bytes) / (16000 * 2)
        payloads: list[dict[str, Any]] = []

        if duration_sec <= 14.0:
            push_stream.write(pcm_bytes)
            push_stream.close()
            result = recognizer.recognize_once_async().get()
            if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                raw_json = result.properties.get(
                    speechsdk.PropertyId.SpeechServiceResponse_JsonResult
                )
                if raw_json:
                    payloads.append(json.loads(raw_json))
            elif result.reason == speechsdk.ResultReason.Canceled:
                cancellation = speechsdk.CancellationDetails.from_result(result)
                if cancellation.reason == speechsdk.CancellationReason.Error:
                    raise RuntimeError(
                        f"Azure SDK error {cancellation.error_code}: {cancellation.error_details}"
                    )
        else:
            import threading

            done = threading.Event()
            error_msg: list[str] = []

            def on_recognized(evt: speechsdk.SpeechRecognitionEventArgs) -> None:
                if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
                    raw = evt.result.properties.get(
                        speechsdk.PropertyId.SpeechServiceResponse_JsonResult
                    )
                    if raw:
                        payloads.append(json.loads(raw))

            def on_canceled(evt: speechsdk.SpeechRecognitionCanceledEventArgs) -> None:
                if evt.reason == speechsdk.CancellationReason.Error:
                    error_msg.append(f"{evt.error_code}: {evt.error_details}")
                done.set()

            recognizer.recognized.connect(on_recognized)
            recognizer.canceled.connect(on_canceled)
            recognizer.session_stopped.connect(lambda _evt: done.set())

            recognizer.start_continuous_recognition_async().get()
            chunk_size = 3200
            for i in range(0, len(pcm_bytes), chunk_size):
                push_stream.write(pcm_bytes[i : i + chunk_size])
            push_stream.close()
            done.wait(timeout=max(15.0, duration_sec + 10.0))
            recognizer.stop_continuous_recognition_async().get()

            if error_msg and not payloads:
                raise RuntimeError("; ".join(error_msg))

        return parse_azure_json_segments(payloads, provider_name="azure_sdk")

    async def assess(
        self,
        audio_bytes: bytes,
        *,
        reference_text: str = "",
        mime_type: str = "audio/wav",
        language: str = "en-US",
    ) -> SpeechAssessmentResult:
        pcm_bytes = await asyncio.to_thread(to_pcm16_16k_mono, audio_bytes, mime_type)
        if not pcm_bytes:
            return SpeechAssessmentResult(
                transcript="",
                confidence=0.0,
                speaking_duration_seconds=0.0,
                word_times_measured=False,
                provider="azure_sdk",
            )
        return await asyncio.to_thread(
            self._assess_sync, pcm_bytes, reference_text, language or self.language
        )


class AzureSpeechRestProvider:
    """Fallback Azure Speech REST API v1 provider for Pronunciation Assessment."""

    def __init__(self, key: str, region: str, language: str = "en-US") -> None:
        self.key = key
        self.region = region
        self.language = language

    async def assess(
        self,
        audio_bytes: bytes,
        *,
        reference_text: str = "",
        mime_type: str = "audio/wav",
        language: str = "en-US",
    ) -> SpeechAssessmentResult:
        pcm_bytes = await asyncio.to_thread(to_pcm16_16k_mono, audio_bytes, mime_type)
        if not pcm_bytes:
            return SpeechAssessmentResult(
                transcript="",
                confidence=0.0,
                speaking_duration_seconds=0.0,
                word_times_measured=False,
                provider="azure_rest",
            )

        wav_bytes = pcm16_to_wav_bytes(pcm_bytes)
        pa_params: dict[str, Any] = {
            "GradingSystem": "HundredMark",
            "Granularity": "Phoneme",
            "Dimension": "Comprehensive",
            "EnableMiscue": bool(reference_text),
            "EnableProsodyAssessment": True,
            "PhonemeAlphabet": "IPA",
            "NBestPhonemeCount": 3,
        }
        if reference_text:
            pa_params["ReferenceText"] = reference_text

        pa_header = base64.b64encode(json.dumps(pa_params).encode("utf-8")).decode("ascii")
        lang = language or self.language
        url = (
            f"https://{self.region}.stt.speech.microsoft.com/"
            f"speech/recognition/conversation/cognitiveservices/v1"
        )
        headers = {
            "Ocp-Apim-Subscription-Key": self.key,
            "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
            "Accept": "application/json",
            "Pronunciation-Assessment": pa_header,
        }
        client, should_close = _get_speech_http_client()
        try:
            resp = await client.post(
                url,
                params={"language": lang, "format": "detailed"},
                headers=headers,
                content=wav_bytes,
                timeout=20.0,
            )
            resp.raise_for_status()
            data = resp.json()
        finally:
            if should_close:
                await client.aclose()

        return parse_azure_json_segments([data], provider_name="azure_rest")

    async def transcribe_fast(
        self,
        audio_bytes: bytes,
        *,
        mime_type: str = "audio/wav",
        language: str = "en-US",
    ) -> str:
        """Lightweight plain STT snapshot (no PA scoring) for low-latency live partial transcripts."""
        pcm_bytes = await asyncio.to_thread(to_pcm16_16k_mono, audio_bytes, mime_type)
        if not pcm_bytes:
            return ""
        wav_bytes = pcm16_to_wav_bytes(pcm_bytes)
        lang = language or self.language
        url = (
            f"https://{self.region}.stt.speech.microsoft.com/"
            f"speech/recognition/conversation/cognitiveservices/v1"
        )
        headers = {
            "Ocp-Apim-Subscription-Key": self.key,
            "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
            "Accept": "application/json",
        }
        client, should_close = _get_speech_http_client()
        try:
            resp = await client.post(
                url,
                params={"language": lang},
                headers=headers,
                content=wav_bytes,
                timeout=8.0,
            )
            resp.raise_for_status()
            data = resp.json()
            return str(data.get("DisplayText") or data.get("Text") or "").strip()
        finally:
            if should_close:
                await client.aclose()


class CompositeAzureSpeechProvider:
    """Routes short utterances (<=14s) to pooled REST fast-path with SDK fallback, and long audio to SDK."""

    def __init__(
        self,
        sdk_provider: AzureSpeechSdkProvider,
        rest_provider: AzureSpeechRestProvider,
        prefer_rest: bool = False,
    ) -> None:
        self.sdk_provider = sdk_provider
        self.rest_provider = rest_provider
        self.prefer_rest = prefer_rest

    @staticmethod
    def _is_short_utterance(audio_bytes: bytes, mime_type: str) -> bool:
        mt = mime_type.lower()
        # 16kHz 16-bit mono = 32,000 bytes/sec -> 14s = 448,000 bytes
        if "pcm" in mt or "wav" in mt:
            return len(audio_bytes) <= 460_000
        return len(audio_bytes) <= 240_000

    async def transcribe_fast(
        self,
        audio_bytes: bytes,
        *,
        mime_type: str = "audio/wav",
        language: str = "en-US",
    ) -> str:
        """Delegate live partial transcript snapshot to keep-alive REST STT."""
        return await self.rest_provider.transcribe_fast(
            audio_bytes, mime_type=mime_type, language=language
        )

    async def assess(
        self,
        audio_bytes: bytes,
        *,
        reference_text: str = "",
        mime_type: str = "audio/wav",
        language: str = "en-US",
    ) -> SpeechAssessmentResult:
        use_rest_first = self.prefer_rest or self._is_short_utterance(audio_bytes, mime_type)
        if use_rest_first:
            try:
                return await self.rest_provider.assess(
                    audio_bytes,
                    reference_text=reference_text,
                    mime_type=mime_type,
                    language=language,
                )
            except Exception as rest_exc:
                if self.prefer_rest:
                    logger.error("Azure REST Speech Assessment failed: %s", rest_exc)
                    raise ProviderUnavailableError(
                        code="SPEECH_ASSESSMENT_UNAVAILABLE",
                        message="Dịch vụ đánh giá giọng nói Azure tạm thời không khả dụng.",
                    ) from rest_exc
                logger.warning(
                    "Azure REST fast-path failed (%s); falling back to SDK.",
                    type(rest_exc).__name__,
                )

        try:
            return await self.sdk_provider.assess(
                audio_bytes,
                reference_text=reference_text,
                mime_type=mime_type,
                language=language,
            )
        except Exception as sdk_exc:
            logger.warning(
                "Azure Speech SDK failed (%s); falling back to REST API.",
                type(sdk_exc).__name__,
            )
            try:
                return await self.rest_provider.assess(
                    audio_bytes,
                    reference_text=reference_text,
                    mime_type=mime_type,
                    language=language,
                )
            except Exception as rest_exc:
                logger.error("Azure REST fallback also failed: %s", rest_exc)
                raise ProviderUnavailableError(
                    code="SPEECH_ASSESSMENT_UNAVAILABLE",
                    message="Dịch vụ đánh giá giọng nói Azure tạm thời không khả dụng.",
                ) from rest_exc


def get_speech_assessment_provider(
    settings: Settings | None = None,
) -> SpeechAssessmentProvider:
    """Resolve the real Azure Speech Assessment provider; never falls back to fake data."""
    settings = settings or get_settings()
    if not settings.AZURE_SPEECH_KEY or not settings.AZURE_SPEECH_REGION:
        raise ProviderUnavailableError(
            code="SPEECH_ASSESSMENT_NOT_CONFIGURED",
            message="Chưa cấu hình AZURE_SPEECH_KEY hoặc AZURE_SPEECH_REGION.",
        )

    sdk = AzureSpeechSdkProvider(
        key=settings.AZURE_SPEECH_KEY,
        region=settings.AZURE_SPEECH_REGION,
        language=settings.AZURE_SPEECH_LANGUAGE,
    )
    rest = AzureSpeechRestProvider(
        key=settings.AZURE_SPEECH_KEY,
        region=settings.AZURE_SPEECH_REGION,
        language=settings.AZURE_SPEECH_LANGUAGE,
    )
    prefer_rest = settings.SPEECH_ASSESSMENT_PROVIDER.lower() == "azure_rest"
    return CompositeAzureSpeechProvider(
        sdk_provider=sdk, rest_provider=rest, prefer_rest=prefer_rest
    )
