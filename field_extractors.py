"""
PackSure — Structured Extraction
Person 2 (AI/CV — OCR & Extraction)

Turns OCR lines (ocr_engine.OCRLine) into the exact evidence contract frozen
in handoff/HANDOFF_Person2.md. This is regex/keyword-based on purpose: it's a
transparent, debuggable MVP baseline. Swap individual extract_* functions for
a model-based approach later without touching the output contract.

GOLDEN RULE (from the handoff doc): extract and describe evidence, never
guess. Every function below returns None / "unclear" / low confidence rather
than picking the more likely answer when the OCR text is ambiguous. The rule
engine (domain_rules/rule_engine.py) is built to turn that into a safe REVIEW
— it is NOT built to recover from a confident-looking wrong guess.
"""

import re
from typing import List, Optional

from ocr_extraction.ocr_engine import OCRLine

# --------------------------------------------------------------------------
# Shared helpers
# --------------------------------------------------------------------------

CURRENCY_SYMBOLS = {"₹": "INR", "rs": "INR", "rs.": "INR", "inr": "INR"}
UNIT_ALIASES = {
    "gm": "g", "gms": "g", "grams": "g", "gram": "g",
    "kgs": "kg", "kilograms": "kg",
    "mls": "ml", "millilitres": "ml", "milliliters": "ml",
    "ltr": "l", "ltrs": "l", "litre": "l", "litres": "l", "liter": "l", "liters": "l",
}
VALID_QTY_UNITS = {"g", "kg", "ml", "l", "mg", "cm", "m"}


def _norm_unit(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    u = raw.strip(".").lower()
    return UNIT_ALIASES.get(u, u)


def _context_window(lines: List[OCRLine], center_idx: int, radius: int = 2) -> str:
    """Joins nearby lines' text to use as the 'context' evidence field."""
    lo, hi = max(0, center_idx - radius), min(len(lines), center_idx + radius + 1)
    return " | ".join(l.text for l in lines[lo:hi])


def _find_lines_matching(lines: List[OCRLine], pattern: re.Pattern):
    """Yields (index, line, match) for every line whose text matches pattern."""
    for i, line in enumerate(lines):
        m = pattern.search(line.text)
        if m:
            yield i, line, m


def _base_evidence(line: OCRLine, value, raw_text: str, context: Optional[str] = None) -> dict:
    return {
        "value": value,
        "raw_text": raw_text,
        "confidence": line.confidence,
        "bbox": line.bbox,
        "image_index": line.image_index,
        "context": context,
    }


def _empty_evidence() -> dict:
    return {"value": None, "raw_text": None, "confidence": None, "bbox": None,
            "image_index": None, "context": None}


# --------------------------------------------------------------------------
# manufacturer (PCR-R01)
# --------------------------------------------------------------------------

_MANUFACTURER_PATTERN = re.compile(
    r"(?:mfd\.?\s*by|manufactured\s*by|marketed\s*by|packed\s*by|mfg\.?\s*by)[:\s]+(.+)",
    re.IGNORECASE,
)


def extract_manufacturer(lines: List[OCRLine]) -> dict:
    for i, line, m in _find_lines_matching(lines, _MANUFACTURER_PATTERN):
        value = m.group(1).strip(" .,")
        if not value:
            continue
        return _base_evidence(line, value, line.text, _context_window(lines, i))
    return _empty_evidence()


# --------------------------------------------------------------------------
# common_name (PCR-R02)
# --------------------------------------------------------------------------
# Deliberately conservative: we only claim a common-name hit when we find an
# explicit label for it. A bare best-guess ("biggest line of text") is
# exactly the kind of confident guess the handoff doc says not to send —
# unlabelled candidates are left for backend/manual review rather than
# reported as a confirmed field.

_COMMON_NAME_PATTERN = re.compile(
    r"(?:common\s*name|generic\s*name)[:\s]+(.+)", re.IGNORECASE
)


def extract_common_name(lines: List[OCRLine]) -> dict:
    for i, line, m in _find_lines_matching(lines, _COMMON_NAME_PATTERN):
        value = m.group(1).strip(" .,")
        if value:
            return _base_evidence(line, value, line.text, _context_window(lines, i))
    return _empty_evidence()


# --------------------------------------------------------------------------
# net_quantity (PCR-R03)
# --------------------------------------------------------------------------

_NET_QTY_PATTERN = re.compile(
    r"net\s*(?:wt\.?|weight|qty\.?|quantity|contents)[:\s]*"
    r"([\d]+(?:\.\d+)?)\s*"
    r"([a-zA-Z\.]+)?",
    re.IGNORECASE,
)


def extract_net_quantity(lines: List[OCRLine]) -> dict:
    for i, line, m in _find_lines_matching(lines, _NET_QTY_PATTERN):
        value, raw_unit = m.group(1), m.group(2)
        unit = _norm_unit(raw_unit)
        evidence = _base_evidence(line, value, line.text, _context_window(lines, i))
        if unit and unit in VALID_QTY_UNITS:
            evidence["unit"] = unit
            evidence["unit_status"] = "confirmed_present"
        elif raw_unit:
            # something followed the number, but it's not a recognised unit
            evidence["unit"] = None
            evidence["unit_status"] = "ambiguous"
        else:
            evidence["unit"] = None
            evidence["unit_status"] = "confirmed_absent"
        return evidence
    return _empty_evidence()


# --------------------------------------------------------------------------
# mrp (PCR-R04)
# --------------------------------------------------------------------------

_MRP_PATTERN = re.compile(
    r"(?:mrp|m\.r\.p\.?|maximum\s*retail\s*price)[:\s]*"
    r"(rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)
_GENERIC_PRICE_PATTERN = re.compile(r"(rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)


def extract_mrp(lines: List[OCRLine]) -> dict:
    mrp_hits, price_hits = [], []
    for i, line, m in _find_lines_matching(lines, _MRP_PATTERN):
        mrp_hits.append((i, line, m.group(1), m.group(2)))
    for i, line, m in _find_lines_matching(lines, _GENERIC_PRICE_PATTERN):
        price_hits.append((i, line, m.group(1), m.group(2)))

    if mrp_hits:
        i, line, currency_sym, amount = mrp_hits[0]
        evidence = _base_evidence(line, amount.replace(",", ""), line.text, _context_window(lines, i))
        evidence["currency"] = CURRENCY_SYMBOLS.get((currency_sym or "").lower(), "INR")
        # explicitly labelled "MRP" -> confident even if other prices exist elsewhere
        evidence["context_confirmed"] = True
        return evidence

    if len(price_hits) == 1:
        i, line, currency_sym, amount = price_hits[0]
        evidence = _base_evidence(line, amount.replace(",", ""), line.text, _context_window(lines, i))
        evidence["currency"] = CURRENCY_SYMBOLS.get((currency_sym or "").lower(), "INR")
        evidence["context_confirmed"] = True
        return evidence

    if len(price_hits) > 1:
        # Multiple price-like values, none explicitly labelled MRP: per the
        # handoff doc, send the best candidate with context_confirmed=False
        # rather than guessing which one is MRP.
        i, line, currency_sym, amount = price_hits[0]
        evidence = _base_evidence(line, amount.replace(",", ""), line.text, _context_window(lines, i))
        evidence["currency"] = CURRENCY_SYMBOLS.get((currency_sym or "").lower(), "INR")
        evidence["context_confirmed"] = False
        return evidence

    return _empty_evidence()


# --------------------------------------------------------------------------
# manufacturing_date / expiry_date (PCR-R05 / PCR-R08)
# --------------------------------------------------------------------------

_MFG_KEYWORDS = re.compile(r"\b(mfg|mfd|manufacturing\s*date|date\s*of\s*manufacture|packed\s*on)\b", re.IGNORECASE)
_EXP_KEYWORDS = re.compile(r"\b(best\s*before|use\s*by|exp\.?|expiry)\b", re.IGNORECASE)
_DATE_PATTERN = re.compile(
    r"\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{1,2}[/\-.]\d{4}|"
    r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{2,4})\b",
    re.IGNORECASE,
)


def _classify_date_role(line_text: str) -> str:
    if _MFG_KEYWORDS.search(line_text):
        return "manufacturing"
    if _EXP_KEYWORDS.search(line_text):
        return "best_before_use_by"
    return "unclear"


def _extract_dates(lines: List[OCRLine]) -> List[dict]:
    """Finds every date on the pack along with its classified role."""
    found = []
    for i, line, m in _find_lines_matching(lines, _DATE_PATTERN):
        role = _classify_date_role(line.text)
        evidence = _base_evidence(line, m.group(1), line.text, _context_window(lines, i))
        evidence["date_role"] = role
        found.append(evidence)
    return found


def extract_manufacturing_and_expiry_dates(lines: List[OCRLine]):
    """
    Returns (manufacturing_date_evidence, expiry_date_evidence).
    These are two separate fields even if the pack only has one date on it
    (per the handoff doc) - an unmatched role never gets forced into the
    other field.
    """
    dates = _extract_dates(lines)
    mfg_evidence = _empty_evidence()
    exp_evidence = _empty_evidence()
    mfg_evidence["date_role"] = None
    exp_evidence["date_role"] = None

    for d in dates:
        if d["date_role"] == "manufacturing" and mfg_evidence["value"] is None:
            mfg_evidence = d
        elif d["date_role"] == "best_before_use_by" and exp_evidence["value"] is None:
            exp_evidence = d
        elif d["date_role"] == "unclear":
            # An unanchored date: report it once as "unclear" evidence rather
            # than guessing which field it belongs to. If both slots are
            # still empty, surface it under manufacturing_date so it isn't
            # silently dropped - the rule engine treats "unclear" as REVIEW
            # regardless of which field carries it.
            if mfg_evidence["value"] is None:
                mfg_evidence = d

    return mfg_evidence, exp_evidence


# --------------------------------------------------------------------------
# consumer_care (PCR-R06)
# --------------------------------------------------------------------------

_PHONE_PATTERN = re.compile(r"(\+?\d[\d\s\-]{8,14}\d)")
_EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_CARE_KEYWORDS = re.compile(r"consumer\s*care|customer\s*care|helpline|toll\s*free", re.IGNORECASE)


def extract_consumer_care(lines: List[OCRLine]) -> dict:
    for i, line in enumerate(lines):
        if _CARE_KEYWORDS.search(line.text):
            phone = _PHONE_PATTERN.search(line.text)
            email = _EMAIL_PATTERN.search(line.text)
            value = phone.group(1) if phone else (email.group(0) if email else None)
            if value:
                return _base_evidence(line, value, line.text, _context_window(lines, i))
    # fall back: an email or phone number anywhere counts as a partial match
    for i, line in enumerate(lines):
        email = _EMAIL_PATTERN.search(line.text)
        if email:
            ev = _base_evidence(line, email.group(0), line.text, _context_window(lines, i))
            ev["partial"] = True
            return ev
    return _empty_evidence()


# --------------------------------------------------------------------------
# country_of_origin (PCR-R07)
# --------------------------------------------------------------------------

_ORIGIN_PATTERN = re.compile(r"country\s*of\s*origin[:\s]+(.+)|made\s*in[:\s]+(.+)", re.IGNORECASE)


def extract_country_of_origin(lines: List[OCRLine]):
    """Returns (evidence, is_imported) - is_imported is None when we can't tell."""
    for i, line, m in _find_lines_matching(lines, _ORIGIN_PATTERN):
        value = (m.group(1) or m.group(2) or "").strip(" .,")
        if not value:
            continue
        evidence = _base_evidence(line, value, line.text, _context_window(lines, i))
        is_imported = value.strip().lower() not in {"india", "in"}
        return evidence, is_imported
    return _empty_evidence(), None  # unknown -> product_context left as None (-> REVIEW upstream)


# --------------------------------------------------------------------------
# unit_sale_price (PCR-R09)
# --------------------------------------------------------------------------

_USP_PATTERN = re.compile(
    r"(?:unit\s*sale\s*price|usp)[:\s]*(rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:per|/)?\s*([a-zA-Z]+)?",
    re.IGNORECASE,
)


def extract_unit_sale_price(lines: List[OCRLine]) -> dict:
    for i, line, m in _find_lines_matching(lines, _USP_PATTERN):
        currency_sym, amount, unit = m.group(1), m.group(2), m.group(3)
        evidence = _base_evidence(line, amount.replace(",", ""), line.text, _context_window(lines, i))
        evidence["currency"] = CURRENCY_SYMBOLS.get((currency_sym or "").lower(), "INR")
        evidence["unit"] = _norm_unit(unit)
        return evidence
    return _empty_evidence()


# --------------------------------------------------------------------------
# dimensions (PCR-R10)
# --------------------------------------------------------------------------

_DIMENSIONS_PATTERN = re.compile(
    r"(?:dimensions?|size)[:\s]*([\d]+(?:\.\d+)?\s*[xX×]\s*[\d]+(?:\.\d+)?(?:\s*[xX×]\s*[\d]+(?:\.\d+)?)?)\s*(cm|mm|m|in|inch(?:es)?)?",
    re.IGNORECASE,
)


def extract_dimensions(lines: List[OCRLine]) -> dict:
    for i, line, m in _find_lines_matching(lines, _DIMENSIONS_PATTERN):
        value, unit = m.group(1).strip(), m.group(2)
        evidence = _base_evidence(line, value, line.text, _context_window(lines, i))
        evidence["unit"] = _norm_unit(unit) if unit else None
        return evidence
    return _empty_evidence()


# --------------------------------------------------------------------------
# principal_display_panel_colocation (PCR-R11, experimental, never scored)
# --------------------------------------------------------------------------

def extract_pdp_colocation_evidence(lines: List[OCRLine], field_evidence: dict) -> dict:
    """
    Per the handoff doc, this rule is experimental / not scored - the MVP
    only needs to collect raw evidence (bbox, nearby_text, image_geometry),
    not implement an actual placement check. We pass through what we already
    have; a real panel-boundary detector can replace this later.
    """
    return {
        "bbox": field_evidence.get("bbox"),
        "nearby_text": field_evidence.get("context"),
        "context_confirmed": None,
        "image_geometry": None,
    }
