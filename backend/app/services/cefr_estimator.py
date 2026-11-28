"""Calibrated Longitudinal CEFR Estimation Model (pure deterministic research module).

Key contributions:
  1. Native-likeness -> L2 Intelligibility calibration for Azure Speech acoustic scores.
  2. Strict separation of Pronunciation (Accuracy + Prosody) and Fluency (no double-counting).
  3. Modality-aware EWMA updates separating Scripted drills from Unscripted conversation.
  4. Hybrid Compensatory + Conjunctive CEFR Rubric preventing single-skill inflation.
"""

from __future__ import annotations

from dataclasses import dataclass

CEFR_LEVELS = ("A1", "A2", "B1", "B2", "C1")

DIMENSION_WEIGHTS: dict[str, float] = {
    "pronunciation": 0.15,
    "fluency": 0.20,
    "vocabulary": 0.20,
    "grammar": 0.20,
    "interaction": 0.25,
}

DIMENSION_LABELS_VI: dict[str, str] = {
    "pronunciation": "Phát âm",
    "fluency": "Độ lưu loát",
    "vocabulary": "Vốn từ vựng",
    "grammar": "Ngữ pháp",
    "interaction": "Tương tác & Mạch lạc",
}


@dataclass(frozen=True)
class CefrEstimation:
    raw_vector: dict[str, float | None]
    calibrated_vector: dict[str, float | None]
    dimension_bands: dict[str, float | None]
    estimated_cefr: str
    continuous_score: float  # 1.0 (A1) to 5.0 (C1)
    confidence: str  # LOW | MEDIUM | HIGH
    limiting_dimensions: list[str]
    explanation_vi: str


def calibrate_acoustic_for_cefr(raw_score: float) -> float:
    """Map Azure native-likeness score (0-100) to L2 communicative intelligibility (0-100).

    L2 learners at B1/B2 commonly achieve 65-82 on native-referenced acoustic models while
    remaining clearly intelligible; severe unintelligibility (<45) stays penalized.
    """
    s = max(0.0, min(100.0, float(raw_score)))
    if s < 45.0:
        return round((s / 45.0) * 38.0, 1)
    if s < 70.0:
        return round(38.0 + ((s - 45.0) / 25.0) * 32.0, 1)
    if s <= 88.0:
        return round(70.0 + ((s - 70.0) / 18.0) * 22.0, 1)
    return round(92.0 + ((s - 88.0) / 12.0) * 8.0, 1)


def score_to_band(score_0_100: float) -> float:
    """Convert a 0-100 calibrated skill score to continuous CEFR band [1.0, 5.0]."""
    s = max(0.0, min(100.0, float(score_0_100)))
    if s < 40.0:
        return round(1.0 + (s / 40.0) * 1.0, 2)
    if s < 55.0:
        return round(2.0 + ((s - 40.0) / 15.0) * 1.0, 2)
    if s < 70.0:
        return round(3.0 + ((s - 55.0) / 15.0) * 1.0, 2)
    if s < 85.0:
        return round(4.0 + ((s - 70.0) / 15.0) * 0.6, 2)
    return round(4.6 + ((s - 85.0) / 15.0) * 0.4, 2)


def band_to_cefr(band: float) -> str:
    if band >= 4.6:
        return "C1"
    if band >= 4.0:
        return "B2"
    if band >= 3.0:
        return "B1"
    if band >= 2.0:
        return "A2"
    return "A1"


def update_ewma(prev: float | None, new_val: float | None, alpha: float) -> float | None:
    """Exponentially weighted moving average with outlier damping."""
    if new_val is None:
        return prev
    if prev is None:
        return round(float(new_val), 1)
    delta = float(new_val) - float(prev)
    effective_alpha = alpha * 0.7 if abs(delta) > 20.0 else alpha
    return round((1.0 - effective_alpha) * float(prev) + effective_alpha * float(new_val), 1)


def merge_pronunciation_modalities(
    scripted: float | None,
    unscripted: float | None,
) -> float | None:
    """Weight spontaneous unscripted pronunciation higher than scripted drills."""
    if unscripted is not None and scripted is not None:
        return round(0.70 * unscripted + 0.30 * scripted, 1)
    if unscripted is not None:
        return round(unscripted, 1)
    if scripted is not None:
        return round(scripted, 1)
    return None


def estimate_cefr_from_vector(
    raw_vector: dict[str, float | None],
    *,
    unscripted_count: int = 1,
    scripted_count: int = 0,
) -> CefrEstimation:
    """Run L2 calibration + hybrid compensatory/conjunctive CEFR rubric on a 5D skill vector."""
    calibrated: dict[str, float | None] = {}
    bands: dict[str, float | None] = {}

    for dim in DIMENSION_WEIGHTS:
        val = raw_vector.get(dim)
        if val is None:
            calibrated[dim] = None
            bands[dim] = None
            continue
        cal_val = (
            calibrate_acoustic_for_cefr(val) if dim == "pronunciation" else round(float(val), 1)
        )
        calibrated[dim] = cal_val
        bands[dim] = score_to_band(cal_val)

    valid_weights = [
        (bands[d], DIMENSION_WEIGHTS[d]) for d in DIMENSION_WEIGHTS if bands[d] is not None
    ]
    if not valid_weights:
        return CefrEstimation(
            raw_vector=raw_vector,
            calibrated_vector=calibrated,
            dimension_bands=bands,
            estimated_cefr="A1",
            continuous_score=1.0,
            confidence="LOW",
            limiting_dimensions=list(DIMENSION_WEIGHTS.keys()),
            explanation_vi="Chưa có đủ dữ liệu đa chiều để ước lượng trình độ CEFR.",
        )

    total_w = sum(w for _, w in valid_weights)
    comp_band = sum(float(b) * (w / total_w) for b, w in valid_weights if b is not None)

    # Conjunctive guardrails across core communicative dimensions
    comm_dims = ("fluency", "vocabulary", "grammar", "interaction")
    comm_bands = {d: bands[d] for d in comm_dims if bands[d] is not None}
    limiting: list[str] = []
    effective_band = comp_band

    if comp_band >= 4.6:
        blockers = [d for d, b in comm_bands.items() if b is not None and b < 3.8]
        if bands.get("pronunciation") is not None and float(bands["pronunciation"] or 0) < 3.2:
            blockers.append("pronunciation")
        if blockers:
            limiting = blockers
            effective_band = min(effective_band, 4.45)

    if effective_band >= 4.0:
        blockers = [d for d, b in comm_bands.items() if b is not None and b < 2.8]
        if bands.get("pronunciation") is not None and float(bands["pronunciation"] or 0) < 2.5:
            blockers.append("pronunciation")
        if blockers:
            limiting = blockers
            effective_band = min(effective_band, 3.85)

    if effective_band >= 3.0:
        blockers = [d for d, b in comm_bands.items() if b is not None and b < 2.0]
        if blockers:
            limiting = blockers
            effective_band = min(effective_band, 2.85)

    # Identify weakest observed dimension even when not blocked
    if not limiting:
        scored_dims = [(d, float(b)) for d, b in bands.items() if b is not None]
        if scored_dims:
            min_dim, min_b = min(scored_dims, key=lambda item: item[1])
            if min_b < effective_band - 0.35:
                limiting = [min_dim]

    continuous = round(max(1.0, min(5.0, effective_band)), 2)
    est_cefr = band_to_cefr(continuous)

    observed_count = sum(1 for v in bands.values() if v is not None)
    if unscripted_count >= 5 and observed_count == 5:
        confidence = "HIGH"
    elif unscripted_count >= 2 or (
        unscripted_count >= 1 and scripted_count >= 1 and observed_count >= 4
    ):
        confidence = "MEDIUM"
    else:
        confidence = "LOW"

    if limiting:
        weak_names = ", ".join(DIMENSION_LABELS_VI.get(d, d) for d in limiting)
        explanation = (
            f"Ước lượng CEFR {est_cefr} ({continuous}/5.0) dựa trên {unscripted_count} phiên giao tiếp"
            f" và {scripted_count} lượt đọc mẫu. Điểm nghẽn cần ưu tiên cải thiện: {weak_names}."
        )
    else:
        explanation = (
            f"Ước lượng CEFR {est_cefr} ({continuous}/5.0) với sự phát triển cân bằng giữa các kỹ năng"
            f" sau {unscripted_count} phiên giao tiếp."
        )

    return CefrEstimation(
        raw_vector=raw_vector,
        calibrated_vector=calibrated,
        dimension_bands=bands,
        estimated_cefr=est_cefr,
        continuous_score=continuous,
        confidence=confidence,
        limiting_dimensions=limiting,
        explanation_vi=explanation,
    )
