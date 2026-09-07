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

from .ocr_engine import OCRLine

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
# manufacturer (PCR-R01) — UNCHANGED
# --------------------------------------------------------------------------

_MANUFACTURER_PATTERN = re.compile(
    r"(?:mfd\.?\s*by|manufactured\s*by|manufacturer|marketed\s*by|"
    r"packed\s*by|packer|packaged\s*by|mfg\.?\s*by|imported\s*by|importer)"
    r"\s*[:.\-]?\s+(.+)",
    re.IGNORECASE,
)


def extract_manufacturer(lines: List[OCRLine]) -> dict:
    for i, line, m in _find_lines_matching(lines, _MANUFACTURER_PATTERN):
        value = m.group(1).strip(" .,")
        if not value:
            continue
        return _base_evidence(line, value, line.text, _context_window(lines, i))
    # Label on this line, name/address on the next (common on packed labels).
    label_only = re.compile(
        r"(?:manufactured\s*by|manufacturer|packed\s*by|packer|imported\s*by|importer)\s*[:.\-]?\s*$",
        re.IGNORECASE,
    )
    for i, line in enumerate(lines):
        if label_only.search(line.text) and i + 1 < len(lines):
            value = lines[i + 1].text.strip(" .,")
            if value:
                ev = _base_evidence(lines[i + 1], value, f"{line.text} {value}", _context_window(lines, i))
                return ev
    return _empty_evidence()


# --------------------------------------------------------------------------
# common_name (PCR-R02)
# --------------------------------------------------------------------------
# Deliberately conservative: we only claim a common-name hit when we find an
# explicit label for it. A bare best-guess ("biggest line of text") is
# exactly the kind of confident guess the handoff doc says not to send —
# unlabelled candidates are left for backend/manual review rather than
# reported as a confirmed field.
#
# GENERALIZATION: different packages use different explicit labels for the
# same declaration (e.g. rice packs say "Product Name:", spice packs say
# "Commodity:", some say "Name of Commodity:"). We recognise all of these,
# but we still refuse to guess from unlabelled text (e.g. a bare "MIX NUTS"
# with no label anywhere near it) — that stays null/low-confidence rather
# than becoming a confident (and possibly wrong) common_name.
#
# Alternatives are ordered longest/most-specific first so that, e.g.,
# "Product Name:" is matched by the "product\s*name" branch rather than
# being partially consumed by the bare "product" branch (which would wrongly
# capture "Name: <value>" as if "Name:" were part of the value).

# Require an explicit declaration label + separator. A bare "product"/"commodity"
# word must not capture slogans, "product of <country>", or large unlabelled titles.
_COMMON_NAME_PATTERN = re.compile(
    r"(?:name\s*of\s*commodity|common\s*name|generic\s*name|product\s*name|commodity)"
    r"\s*[:\-]\s*(.+)",
    re.IGNORECASE,
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
# GENERALIZATION: some packages explicitly label the quantity ("Net Weight:
# 400g"), others just print "<number><unit>" directly on the pack with no
# label at all (e.g. "400g", "1 kg", "250 ml"). We support both, but a
# standalone number is ONLY treated as quantity evidence when a recognised
# unit is attached directly to it — a bare number like "2026" or "3000/-"
# never becomes quantity, because there is no unit evidence to justify that,
# and guessing would violate the golden rule.

_NET_QTY_LABELLED_PATTERN = re.compile(
    r"(?:net\s*(?:wt\.?|weight|qty\.?|quantity|contents)|(?:\bqty\.?|\bquantity))"
    r"\s*[:\-]?\s*"
    r"([\d]+(?:\.\d+)?)\s*"
    r"([a-zA-Z\.]+)?",
    re.IGNORECASE,
)
_QTY_LABEL_ONLY = re.compile(
    r"(?:net\s*(?:wt\.?|weight|qty\.?|quantity|contents)|(?:\bqty\.?|\bquantity))\s*[:\-]?\s*$",
    re.IGNORECASE,
)
_GROSS_WEIGHT = re.compile(r"\bgross\b", re.IGNORECASE)
_QTY_FALSE_CONTEXT = re.compile(
    r"\b(model|android|lte|wifi|wi-fi|network|version)\b",
    re.IGNORECASE,
)

# Every unit token (canonical + alias) we're willing to accept immediately
# after a number with no label. Sorted longest-first purely for readability/
# defensiveness; the trailing \b in the pattern already prevents a shorter
# token (e.g. "m") from matching inside a longer one (e.g. "mg").
_QTY_UNIT_TOKENS = sorted(set(VALID_QTY_UNITS) | set(UNIT_ALIASES.keys()), key=len, reverse=True)
_QTY_UNIT_ALT = "|".join(re.escape(u) for u in _QTY_UNIT_TOKENS)

_STANDALONE_QTY_PATTERN = re.compile(
    rf"\b(\d+(?:\.\d+)?)\s*({_QTY_UNIT_ALT})\b",
    re.IGNORECASE,
)


def _qty_false_positive(value: str, raw_unit: Optional[str], line_text: str) -> bool:
    if _QTY_FALSE_CONTEXT.search(line_text):
        return True
    # "5G"/"4G" network marks: uppercase G glued to a small integer is not grams.
    if raw_unit == "G" and value.isdigit() and int(value) <= 5:
        return True
    return False


def _qty_evidence_from_match(line: OCRLine, i: int, lines: List[OCRLine], value: str, raw_unit: Optional[str], labelled: bool) -> Optional[dict]:
    if _GROSS_WEIGHT.search(line.text):
        return None
    if _qty_false_positive(value, raw_unit, line.text):
        return None
    unit = _norm_unit(raw_unit)
    evidence = _base_evidence(line, value, line.text, _context_window(lines, i))
    if unit and unit in VALID_QTY_UNITS:
        evidence["unit"] = unit
        evidence["unit_status"] = "confirmed_present"
    elif labelled:
        if raw_unit:
            evidence["unit"] = None
            evidence["unit_status"] = "ambiguous"
        else:
            evidence["unit"] = None
            evidence["unit_status"] = "confirmed_absent"
    else:
        # Standalone match already required a recognised unit token.
        if not unit or unit not in VALID_QTY_UNITS:
            return None
        evidence["unit"] = unit
        evidence["unit_status"] = "confirmed_present"
    return evidence


def extract_net_quantity(lines: List[OCRLine]) -> dict:
    # 1) Explicit "Net Weight:" / "Net Qty:" / "Quantity:" style labels take
    #    priority — they're the strongest evidence and preserve the original
    #    unit_status handling (confirmed_present / ambiguous / confirmed_absent).
    for i, line, m in _find_lines_matching(lines, _NET_QTY_LABELLED_PATTERN):
        evidence = _qty_evidence_from_match(line, i, lines, m.group(1), m.group(2), labelled=True)
        if evidence:
            return evidence

    # Label on one line, amount+unit on the next.
    for i, line in enumerate(lines):
        if _QTY_LABEL_ONLY.search(line.text) and i + 1 < len(lines):
            nxt = lines[i + 1]
            m = _STANDALONE_QTY_PATTERN.search(nxt.text) or _NET_QTY_LABELLED_PATTERN.search(nxt.text)
            if not m:
                continue
            value, raw_unit = m.group(1), m.group(2)
            evidence = _qty_evidence_from_match(nxt, i + 1, lines, value, raw_unit, labelled=True)
            if evidence:
                evidence["raw_text"] = f"{line.text} {nxt.text}".strip()
                evidence["context"] = _context_window(lines, i)
                return evidence

    # 2) No explicit label anywhere — fall back to standard package notation
    #    ("400g", "1 kg", "2 L", "750mg"). The unit is right there attached
    #    to the number, so this is still real evidence, not a guess. A bare
    #    number with no unit attached is deliberately NOT matched here.
    for i, line, m in _find_lines_matching(lines, _STANDALONE_QTY_PATTERN):
        evidence = _qty_evidence_from_match(line, i, lines, m.group(1), m.group(2), labelled=False)
        if evidence:
            return evidence

    return _empty_evidence()


# --------------------------------------------------------------------------
# mrp (PCR-R04)
# --------------------------------------------------------------------------
# GENERALIZATION: in addition to "MRP"/"M.R.P."/"Maximum Retail Price" and a
# bare currency symbol + amount, packages sometimes just print "PRICE" as
# the label (with or without a currency symbol, often with a trailing
# "/-"). An explicit "PRICE" label is real price evidence, but per the
# handoff doc it must NOT be treated as automatically proving MRP the way
# an explicit "MRP" label is — so it is folded into the same conservative
# "price candidate" pool as bare currency amounts, not treated as an MRP
# hit. That preserves the existing behaviour: context_confirmed is True
# only when it is the single price-like candidate found on the whole
# package, and False the moment there's more than one, exactly as before.

_MRP_PATTERN = re.compile(
    r"(?:mrp|m\.r\.p\.?|maximum\s*retail\s*price)[:\s]*"
    r"(rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)
_GENERIC_PRICE_PATTERN = re.compile(r"(rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)

# Explicit "PRICE" label, with an optional currency symbol/code and an
# optional trailing "/-" (a very common Indian packaging convention, e.g.
# "PRICE 2500/-"). Word-bounded so it doesn't match inside "priced" etc.
# Negative lookbehind skips "unit sale price" / "sale price" USP lines.
_PRICE_LABEL_PATTERN = re.compile(
    r"(?<!sale\s)\bprice\b\s*[:\-]?\s*(rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)\s*/?-?",
    re.IGNORECASE,
)
_USP_LINE = re.compile(r"unit\s*sale\s*price|\busp\b", re.IGNORECASE)
_NON_MRP_PRICE_CONTEXT = re.compile(
    r"\b(orders?|above|minimum|discount|off\b|save|cashback|emi|cod)\b",
    re.IGNORECASE,
)


def _plausible_price_amount(amount: str) -> bool:
    cleaned = amount.replace(",", "").strip()
    if not re.fullmatch(r"\d+(?:\.\d{1,2})?", cleaned):
        return False
    digits = cleaned.split(".")[0]
    if len(digits) >= 10:
        return False  # phone numbers
    try:
        value = float(cleaned)
    except ValueError:
        return False
    if value <= 0 or value > 1_000_000:
        return False
    return True


def extract_mrp(lines: List[OCRLine]) -> dict:
    mrp_hits, price_hits = [], []

    for i, line, m in _find_lines_matching(lines, _MRP_PATTERN):
        if _plausible_price_amount(m.group(2)):
            mrp_hits.append((i, line, m.group(1), m.group(2)))
    mrp_indices = {i for i, _, _, _ in mrp_hits}

    seen_price_idx = set()
    # Explicit "PRICE" label candidates (lines already claimed by the more
    # specific MRP pattern above are not reconsidered here).
    for i, line, m in _find_lines_matching(lines, _PRICE_LABEL_PATTERN):
        if i in mrp_indices or i in seen_price_idx:
            continue
        if _USP_LINE.search(line.text) or _NON_MRP_PRICE_CONTEXT.search(line.text):
            continue
        if not _plausible_price_amount(m.group(2)):
            continue
        price_hits.append((i, line, m.group(1), m.group(2)))
        seen_price_idx.add(i)

    # Bare currency-symbol amounts, same de-dup rules.
    for i, line, m in _find_lines_matching(lines, _GENERIC_PRICE_PATTERN):
        if i in mrp_indices or i in seen_price_idx:
            continue
        if _USP_LINE.search(line.text) or _NON_MRP_PRICE_CONTEXT.search(line.text):
            continue
        if not _plausible_price_amount(m.group(2)):
            continue
        price_hits.append((i, line, m.group(1), m.group(2)))
        seen_price_idx.add(i)

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
# manufacturing_date / expiry_date (PCR-R05 / PCR-R08) — UNCHANGED
# --------------------------------------------------------------------------

_MFG_KEYWORDS = re.compile(
    r"\b(mfg|mfd|pkd|packed(?:\s*(?:on|date))?|packing\s*date|"
    r"manufactured(?:\s*(?:on|date))?|manufacturing\s*date|"
    r"date\s*of\s*(?:manufacture|packing|pack))\b",
    re.IGNORECASE,
)
_EXP_KEYWORDS = re.compile(
    r"\b(best\s*before|best\s*by|use\s*by|exp(?:iry|ires|iration)?\.?|bbd)\b",
    re.IGNORECASE,
)
_DATE_PATTERN = re.compile(
    r"\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{1,2}[/\-.]\d{4}|"
    r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{2,4})\b",
    re.IGNORECASE,
)
_DURATION_PATTERN = re.compile(
    r"(?:best\s*before|use\s*by|exp(?:iry)?\.?)\s*[:\-]?\s*"
    r"(\d+\s*(?:months?|years?|days?|weeks?))",
    re.IGNORECASE,
)
_PHONE_LIKE = re.compile(r"(?:\+91[\s-]?)?[6-9]\d{9}\b|\b\d{10,}\b")
_NON_DATE_CONTEXT = re.compile(
    r"\b(orders?|price|mrp|rs\.?|inr|model|call|phone|helpline|customer|consumer)\b",
    re.IGNORECASE,
)


def _classify_date_role(blob: str) -> str:
    if _MFG_KEYWORDS.search(blob):
        return "manufacturing"
    if _EXP_KEYWORDS.search(blob):
        return "best_before_use_by"
    return "unclear"


def _looks_like_phone_fragment(line_text: str, date_text: str) -> bool:
    """Reject date-shaped slices that sit inside a phone / long digit run."""
    if _PHONE_LIKE.search(line_text) and date_text in re.sub(r"\s+", "", line_text):
        return True
    return False


def _extract_dates(lines: List[OCRLine]) -> List[dict]:
    """Finds every date (and best-before duration) on the pack with its role."""
    found = []
    seen = set()

    for i, line, m in _find_lines_matching(lines, _DATE_PATTERN):
        date_text = m.group(1)
        if _looks_like_phone_fragment(line.text, date_text):
            continue
        # Bare years and marketing copy should not become dates; the regex
        # already requires a day/month structure. Still skip obvious price lines
        # with no manufacturing/expiry keyword in the neighbourhood.
        blob = _context_window(lines, i, radius=1)
        role = _classify_date_role(f"{line.text} {blob}")
        if role == "unclear" and _NON_DATE_CONTEXT.search(line.text):
            continue
        key = (line.image_index, date_text, role)
        if key in seen:
            continue
        seen.add(key)
        evidence = _base_evidence(line, date_text, line.text, blob)
        evidence["date_role"] = role
        found.append(evidence)

    for i, line, m in _find_lines_matching(lines, _DURATION_PATTERN):
        value = m.group(1).strip()
        key = (line.image_index, value.lower(), "best_before_use_by")
        if key in seen:
            continue
        seen.add(key)
        evidence = _base_evidence(line, value, line.text, _context_window(lines, i))
        evidence["date_role"] = "best_before_use_by"
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
# consumer_care (PCR-R06) — UNCHANGED
# --------------------------------------------------------------------------

_PHONE_PATTERN = re.compile(r"(\+?\d[\d\s\-]{8,14}\d)")
_EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_CARE_KEYWORDS = re.compile(
    r"consumer\s*care|customer\s*care|customer\s*service|helpline|toll\s*free|"
    r"for\s+complaints|careline|grievance",
    re.IGNORECASE,
)


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
# country_of_origin (PCR-R07) — UNCHANGED
# --------------------------------------------------------------------------

_ORIGIN_PATTERN = re.compile(
    r"(?:country\s*of\s*origin|origin\s*country)\s*[:\-]?\s*(.+)|"
    r"made\s+in\s*[:\-]?\s*(.+)|"
    r"product\s+of\s*[:\-]?\s*(.+)|"
    r"produce\s+of\s*[:\-]?\s*(.+)",
    re.IGNORECASE,
)
_IMPORTED_BY = re.compile(r"\bimported\s+by\b", re.IGNORECASE)
_INDIA_ALIASES = {"india", "in", "bharat", "hindustan"}


def _origin_is_india(value: str) -> bool:
    token = re.sub(r"[^a-z]", "", value.strip().lower())
    return token in _INDIA_ALIASES or value.strip().lower() in _INDIA_ALIASES


def extract_country_of_origin(lines: List[OCRLine]):
    """Returns (evidence, is_imported) - is_imported is None when we can't tell."""
    imported_mention = any(_IMPORTED_BY.search(line.text) for line in lines)

    for i, line, m in _find_lines_matching(lines, _ORIGIN_PATTERN):
        value = next((g.strip(" .,") for g in m.groups() if g and g.strip(" .,")), "")
        if not value:
            continue
        evidence = _base_evidence(line, value, line.text, _context_window(lines, i))
        made_in_india = _origin_is_india(value)
        if imported_mention and made_in_india:
            is_imported = None  # conflicting signals — do not guess
        elif imported_mention:
            is_imported = True
        else:
            is_imported = not made_in_india
        return evidence, is_imported

    if imported_mention:
        return _empty_evidence(), True
    return _empty_evidence(), None  # unknown -> product_context left as None (-> REVIEW upstream)


# --------------------------------------------------------------------------
# unit_sale_price (PCR-R09) — UNCHANGED
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
# dimensions (PCR-R10) — UNCHANGED
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
# UNCHANGED
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