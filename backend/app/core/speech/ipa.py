"""Standard English-to-IPA converter powered by CMUdict (pronouncing) with lightweight fallback."""

from __future__ import annotations

import re
from functools import lru_cache

import pronouncing

_ARPABET_TO_IPA: dict[str, str] = {
    "AA": "ɑː",
    "AE": "æ",
    "AH": "ʌ",
    "AO": "ɔː",
    "AW": "aʊ",
    "AY": "aɪ",
    "B": "b",
    "CH": "tʃ",
    "D": "d",
    "DH": "ð",
    "EH": "ɛ",
    "ER": "ɜːr",
    "EY": "eɪ",
    "F": "f",
    "G": "ɡ",
    "HH": "h",
    "IH": "ɪ",
    "IY": "iː",
    "JH": "dʒ",
    "K": "k",
    "L": "l",
    "M": "m",
    "N": "n",
    "NG": "ŋ",
    "OW": "oʊ",
    "OY": "ɔɪ",
    "P": "p",
    "R": "r",
    "S": "s",
    "SH": "ʃ",
    "T": "t",
    "TH": "θ",
    "UH": "ʊ",
    "UW": "uː",
    "V": "v",
    "W": "w",
    "Y": "j",
    "Z": "z",
    "ZH": "ʒ",
}


def _arpabet_to_ipa(arpabet: str) -> str:
    parts = arpabet.split()
    out: list[str] = []
    for tok in parts:
        stress = ""
        base = tok
        if tok and tok[-1] in {"0", "1", "2"}:
            stress_digit = tok[-1]
            base = tok[:-1]
            if stress_digit == "1" and len(parts) > 2:
                stress = "ˈ"
            elif stress_digit == "2" and len(parts) > 3:
                stress = "ˌ"
        if base == "AH" and tok.endswith("0"):
            ipa = "ə"
        elif base == "ER" and tok.endswith("0"):
            ipa = "ər"
        else:
            ipa = _ARPABET_TO_IPA.get(base, base.lower())
        out.append(f"{stress}{ipa}")
    return "".join(out)


@lru_cache(maxsize=4096)
def word_to_ipa(word: str) -> str:
    """Convert a single English word to IPA without surrounding slashes."""
    clean = re.sub(r"[^a-zA-Z']", "", word).lower().strip("'")
    if not clean:
        return ""

    phones = pronouncing.phones_for_word(clean)
    if phones:
        return _arpabet_to_ipa(phones[0])

    # Fallback contraction split or simple orthographic transliteration
    if "'" in clean:
        base, suffix = clean.split("'", 1)
        base_phones = pronouncing.phones_for_word(base)
        if base_phones:
            suffix_map = {"s": "z", "t": "t", "d": "d", "m": "m", "re": "r", "ve": "v", "ll": "l"}
            return _arpabet_to_ipa(base_phones[0]) + suffix_map.get(suffix, suffix)

    return clean


def text_to_ipa(text: str) -> str:
    """Convert an English phrase or sentence into slash-delimited IPA."""
    tokens = [t for t in re.findall(r"[A-Za-z0-9']+", text) if t]
    if not tokens:
        return ""
    ipa_words = [word_to_ipa(tok) or tok.lower() for tok in tokens]
    return f"/{' '.join(ipa_words)}/"
