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

--------------------------------------------------------------------------
NEW FIXES IN THIS REVISION
--------------------------------------------------------------------------
1. UNIT LETTER SWALLOWED BY THE DIGIT RUN (the missing half of fixes-doc
   item 2). The doc asks for the OCR confusion map to be applied "to the
   digits adjacent to a letter (not just the unit) — that's what turns 400g
   misread as 4009 back into a valid quantity". Only the unit *token* was
   being corrected, so the documented failure ("NET QTY 4009") still came
   back with no unit at all. _recover_unit_from_digit_tail() now handles it,
   flagged corrected_from_ocr=True and unit_status="ocr_corrected" so it is
   auditable rather than silently trusted. See that function for the
   deliberate limits on when it may fire.

2. FUZZY LABEL THRESHOLD WAS UNREACHABLE. _fuzzy_label_match used
   partial_ratio at threshold 75, but the exact case the fixes doc cites -
   "onsen FOR:" against "manufactured for" - scores 62, so the fallback
   never fired for the one input it was written for. Simply lowering the
   threshold is not safe either: partial_ratio is heavily biased toward
   short strings, so a bare "MRP" scores 67 against "marketed by" and would
   have become a manufacturer label. The check is now: a minimum length
   (kills "MRP"), an explicit exclusion list for lines that are obviously
   some *other* declaration (kills "BEST BEFORE", "NET QTY", price lines),
   and only then a blended fuzzy score at a lower threshold.

3. ONLY THE FIRST DATE ON A LINE WAS READ (real bug). _extract_dates used
   pattern.search(), one match per line, and classified the role from the
   whole line. A pack printing "MFG 31JUL2026 EXP 30JAN2027" on one line -
   completely standard - yielded manufacturing_date only; the expiry date
   was silently dropped, and with it product_context.may_expire. Dates are
   now found with finditer, and each match's role is classified from the
   text immediately preceding *that* match, falling back to the line/
   neighbourhood only when the match has no nearby keyword of its own.

4. DIMENSIONS AND UNIT-SALE-PRICE LINES LEAKED INTO net_quantity. The
   unlabelled fallback matched "<number><unit>" anywhere, so "Dimensions:
   10 x 20 x 5 cm" reported net_quantity = 5 cm, and "Unit Sale Price Rs
   15.00 per 100g" reported net_quantity = 100 g. Both are now excluded
   from that fallback - they are a different declaration, not an unlabelled
   net quantity.

5. BATCH / LOT NUMBERS COULD BECOME DATES. "Batch No 2026/07/31" parses as
   a perfectly good date with no mfg/expiry keyword nearby, so it was
   surfaced as unclear-role evidence under manufacturing_date. Batch, lot
   and licence-number contexts are now in _NON_DATE_CONTEXT.
--------------------------------------------------------------------------
"""

import re
from typing import List, Optional

from dateutil import parser as dateutil_parser
from rapidfuzz import fuzz

from .ocr_engine import OCRLine

# --------------------------------------------------------------------------
# Shared helpers
# --------------------------------------------------------------------------

CURRENCY_SYMBOLS = {"₹": "INR", "rs": "INR", "rs.": "INR", "inr": "INR"}
def _detect_currency(text: str) -> str:
    text_lower = text.lower()

    if "₹" in text:
        return "INR"
    if "rs." in text_lower or "rs " in text_lower:
        return "INR"
    if "inr" in text_lower:
        return "INR"

    return "INR"

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


# FIX (structural, per the fixes doc): exact-match unit parsing had zero
# tolerance for the digit/letter confusions Tesseract makes constantly
# (g<->9, 0<->o, l<->1, s<->5, b<->8) - the same confusion that turned a
# printed "400g" into "4009" and then made extract_net_quantity reject it
# outright for lacking a recognised unit. This generalises to every pack,
# not just that one image, by fuzzy-correcting the trailing unit characters
# against a known vocabulary instead of requiring a literal match.

_OCR_CONFUSION = str.maketrans({"9": "g", "0": "o", "1": "l", "5": "s", "8": "b"})


def _levenshtein(a: str, b: str) -> int:
    """Minimal edit distance between two short strings (unit tokens are a
    handful of characters, so an O(n*m) DP table is more than fast enough)."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        curr = [i] + [0] * len(b)
        for j, cb in enumerate(b, start=1):
            cost = 0 if ca == cb else 1
            curr[j] = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
        prev = curr
    return prev[-1]


# FIX (this revision - the missing half of fixes-doc item 2): when Tesseract
# misreads the unit letter *as a digit*, the letter disappears into the
# number and there is no unit token left for _normalize_unit_fuzzy to
# correct. "400g" comes back as the single token "4009", which the labelled
# pattern happily parses as the number 4009 with no unit - the exact
# documented Monaco failure.
#
# Only these digits are reversed, and only off the END of an otherwise
# all-digit run, because those are the confusions that actually produce a
# valid unit: 9 -> g, 1 -> l, 5 -> s (for "gms"/"gs"-style tails). The
# recovered letters must form an EXACT known unit - not an edit-distance-1
# near miss - because at this point we are already speculating about one
# character, and stacking a fuzzy match on top of that would start inventing
# quantities. A recovery never fires unless the caller says the line was
# explicitly labelled as a quantity, for the same reason: on an unlabelled
# line there is nothing to distinguish "4009" the misread weight from
# "4009" the batch number, and guessing would break the golden rule.
_UNIT_TAIL_DIGITS = {"9": "g", "1": "l", "5": "s", "0": "o"}


def _recover_unit_from_digit_tail(value: str):
    """
    "4009" -> ("400", "g"). Returns None when nothing safe can be recovered.
    """
    if not value.isdigit() or len(value) < 2:
        return None
    for tail_len in (2, 1):
        if len(value) <= tail_len:
            continue
        head, tail = value[:-tail_len], value[-tail_len:]
        if not head.isdigit() or int(head) <= 0:
            continue
        letters = "".join(_UNIT_TAIL_DIGITS.get(ch, "") for ch in tail)
        if len(letters) != tail_len:
            continue  # a digit in the tail isn't a plausible letter at all
        unit = _norm_unit(letters)
        if unit in VALID_QTY_UNITS:
            return head, unit
    return None


def _normalize_unit_fuzzy(raw: Optional[str]) -> Optional[str]:
    """
    Fuzzy-corrects a possibly OCR-garbled unit token against the known
    vocabulary: run it through the digit/letter confusion map, then accept
    it if it's an exact match OR within edit distance 1 of a valid unit -
    rather than requiring a literal match the way _norm_unit does.
    """
    if not raw:
        return None
    candidate = raw.strip(".").lower().translate(_OCR_CONFUSION)
    for valid in VALID_QTY_UNITS | set(UNIT_ALIASES):
        if candidate == valid or _levenshtein(candidate, valid) <= 1:
            return UNIT_ALIASES.get(valid, valid)
    return None


# --------------------------------------------------------------------------
# Image boundaries (PROBLEM 1 — cross-image OCR contamination)
# --------------------------------------------------------------------------
# run_ocr() returns ONE flat list covering up to three uploaded images, each
# OCRLine tagged with its 1-based image_index. Every "look at the nearby
# lines" operation in this file indexed that flat list directly, so the last
# line of image 1 and the first line of image 2 were treated as neighbours.
#
# That is not a cosmetic problem. The three uploads are typically the front,
# back and side panels of the SAME pack, so the text on either side of the
# seam is plausible label text - it does not look wrong, it just belongs to a
# different photo. Concretely, a bare "MANUFACTURED FOR:" as the last line of
# image 1 would take the first line of image 2 as its value, and every
# evidence dict carries a single bbox + image_index, so the resulting
# evidence would point a reviewer at coordinates in the wrong photo.
#
# Rather than scatter `if line.image_index == ...` through every call site,
# the traversal helpers themselves are made image-aware, so any future
# nearby-line logic inherits the boundary for free.


# FIX (found on real pack photos): a label-anchored value was accepted no
# matter how badly the line carrying it was read. On the Monaco pack the
# label "ACTURED FOR:" was recognised correctly at 0.91 confidence, but the
# following line was pure noise - "ae RSIY LAT" at 0.24 - and became the
# manufacturer. Same shape produced country_of_origin = "ange Cnr wgrera"
# from a 0.41 line.
#
# Text this poorly read is not weak evidence, it is not evidence: the golden
# rule says report nothing rather than something invented. The floor sits
# below the rule engine's own 0.6 REVIEW threshold deliberately - between
# 0.45 and 0.6 the extractor still reports the value and lets the rule
# engine route it to a human, which is the correct division of labour.
# Below 0.45 there is nothing worth a human's time.
_MIN_VALUE_CONFIDENCE = 0.45

# ==========================================================================
# EXPERIMENT SWITCH — OCR confidence gating
# ==========================================================================
# Set False to disable EVERY OCR-confidence gate in this module, so the
# extractors accept a value regardless of how badly the line was read. This
# is here to measure what the confidence gates actually cost in recall.
#
# What turning this off disables:
#   1. _readable()  — the floor on label-derived values (manufacturer,
#      common_name, country_of_origin). With it off, a 0.24-confidence line
#      of noise is accepted as a company name.
#   2. The net-quantity unit gate — "no unit token" is then always reported
#      as unit_status="confirmed_absent" rather than "ambiguous" on a badly
#      read line, so PCR-R03 hard-FAILs instead of going to REVIEW.
#
# Note this does NOT disable the rule engine's own CONFIDENCE_REVIEW_THRESHOLD
# (0.6), which is a separate gate in domain_rules/rule_engine.py. Values
# between 0 and 0.6 will still be routed to REVIEW there — so with gating off
# the extractor reports more, and the rule engine flags most of it.
#
# Leave this True in anything you demo. See the measured effect below.
OCR_CONFIDENCE_GATING = True


def _readable(line: OCRLine) -> bool:
    """True when a line is legible enough to be quoted as a field value."""
    if not OCR_CONFIDENCE_GATING:
        return True
    return line.confidence is None or line.confidence >= _MIN_VALUE_CONFIDENCE


def _image_bounds(lines: List[OCRLine], idx: int) -> tuple:
    """Half-open [start, end) index range of the run of lines sharing
    lines[idx]'s image_index.

    Scans outward from idx rather than assuming the list is grouped by
    image: run_ocr does append image-by-image today, but a future backend
    that interleaves or re-sorts lines would silently defeat a grouping
    assumption, and this is the guard everything else depends on.
    """
    if not lines:
        return 0, 0
    target = lines[idx].image_index
    start = idx
    while start > 0 and lines[start - 1].image_index == target:
        start -= 1
    end = idx + 1
    while end < len(lines) and lines[end].image_index == target:
        end += 1
    return start, end


def _following_lines(lines: List[OCRLine], idx: int, count: int):
    """Yields (j, line) for up to `count` lines after idx, stopping at the
    image boundary. Replaces every `range(i + 1, min(i + n, len(lines)))`
    loop in this file."""
    _, end = _image_bounds(lines, idx)
    for j in range(idx + 1, min(idx + 1 + count, end)):
        yield j, lines[j]


def _context_window(lines: List[OCRLine], center_idx: int, radius: int = 2) -> str:
    """Joins nearby lines' text to use as the 'context' evidence field.

    PROBLEM 1: clamped to the centre line's own image. Context is not just
    display text - _extract_dates classifies a date's role from this blob,
    so a "BEST BEFORE" on a different photo could retag a manufacturing date
    on this one.
    """
    if not lines:
        return ""
    start, end = _image_bounds(lines, center_idx)
    lo = max(start, center_idx - radius)
    hi = min(end, center_idx + radius + 1)
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
# FIX: the label patterns below previously only recognised "Manufactured
# By" / "Mfd. By" / etc. A real package printed "MANUFACTURED FOR:" (a
# distinct, legally meaningful label - the brand commissioning the goods,
# as opposed to who physically made them), which matched neither pattern
# and silently produced no manufacturer evidence at all. Both patterns now
# also recognise "manufactured for".

# PROBLEM 3 — importer/packer/marketer were competing with the real
# manufacturer. All eleven labels sat in ONE pattern and one candidate pool,
# ranked only by "does the value look like a company name" and OCR
# confidence. On a pack carrying both
#
#     Manufactured by ABC Foods
#     Imported by XYZ Pvt Ltd
#
# both lines produced a candidate, both scored 1 on the company hint, and
# whichever had the higher OCR confidence won - so the importer could be
# reported as the manufacturer. Non-deterministic, and wrong roughly half
# the time on any imported pack.
#
# The fix is a two-tier split rather than a deletion. Deleting the secondary
# labels outright was tempting and is what a literal reading of the brief
# asks for, but it would regress real packs: Rule 6(1)(a) of the Legal
# Metrology (Packaged Commodities) Rules requires the name and address of
# "the manufacturer OR the packer OR the importer", so a pack that only ever
# prints "Marketed by" or "Packed by" is making a valid declaration, and
# PCR-R01 should see it rather than get a null and FAIL a compliant pack.
#
# So: PRIMARY labels (actual manufacture) always outrank SECONDARY ones, and
# a secondary label is only ever used when NO primary label appears anywhere
# on any image. The winning evidence records which tier it came from in
# evidence["label_type"], so the rule engine can distinguish "this is the
# manufacturer" from "this is the packer, standing in for the manufacturer".
_PRIMARY_MANUFACTURER_LABELS = (
    r"mfd\.?\s*by|manufactured\s*by|manufactured\s*for|manufacturer|mfg\.?\s*by"
)
_SECONDARY_MANUFACTURER_LABELS = (
    r"marketed\s*by|packed\s*by|packer|packaged\s*by|imported\s*by|importer"
)

_PRIMARY_MANUFACTURER_PATTERN = re.compile(
    rf"(?:{_PRIMARY_MANUFACTURER_LABELS})\s*[:.\-]?\s+(.+)", re.IGNORECASE
)
_SECONDARY_MANUFACTURER_PATTERN = re.compile(
    rf"(?:{_SECONDARY_MANUFACTURER_LABELS})\s*[:.\-]?\s+(.+)", re.IGNORECASE
)

# Kept as the union for any caller that just wants "is there a
# manufacturer-ish label on this line at all".
_MANUFACTURER_PATTERN = re.compile(
    rf"(?:{_PRIMARY_MANUFACTURER_LABELS}|{_SECONDARY_MANUFACTURER_LABELS})"
    r"\s*[:.\-]?\s+(.+)",
    re.IGNORECASE,
)

# FIX (structural, per the fixes doc): the patterns above require the label
# text to be spelled exactly right. A real package OCR'd "MANUFACTURED
# FOR:" as something like "onsen FOR:" - one corrupted run of characters
# kills a literal regex outright, even though the label is clearly still
# readable to a human. This generalises to any dense/small-print label
# section, on any pack, not just that one image.
#
# This fuzzy fallback only fires for *standalone* label lines (the same
# "label alone on its own line, value on the following lines" shape
# label_only already handles below) - never to extract a value from a
# combined "label: value" line. Fuzzy matching can tell us a label is
# probably *present*; it can't reliably tell us where it *ends*, and
# guessing that boundary to slice out a value would violate the golden
# rule (extract and describe evidence, never guess).
_PRIMARY_LABEL_KEYWORDS = [
    "manufactured by", "manufactured for", "manufacturer", "mfg by", "mfd by",
]
_SECONDARY_LABEL_KEYWORDS = [
    "marketed by", "packed by", "packer", "packaged by", "imported by", "importer",
]
# Kept for callers that want the whole vocabulary (and for the default
# argument of _fuzzy_label_match, whose other users pass their own list).
_LABEL_KEYWORDS = _PRIMARY_LABEL_KEYWORDS + _SECONDARY_LABEL_KEYWORDS


# FIX (this revision): the old check was `partial_ratio(...) >= 75`, which
# never fired for the very case the fixes doc cites: "onsen FOR:" scores 62
# against "manufactured for". Measured scores on real label text:
#
#   'MANUFACTURED FOR:'  100   'MRP'            67  <- 3 chars, junk match
#   'Manufaotured By'     93   'BEST BEFORE'    59  <- a different declaration
#   'MFD BY'              80   'SALTED SNACK'   56
#   'onsen FOR:'          62   'PRICE 2500/-'   53
#
# partial_ratio slides the shorter string over the longer one, so very short
# lines score high against anything - that is why "MRP" beats "onsen FOR:".
# Lowering the threshold alone would therefore make things worse, not better.
# Three guards make the lower threshold safe:
#   1. minimum length - a 3-4 character line cannot be a fuzzy label match,
#   2. an explicit "this line is some other declaration" exclusion,
#   3. a blended score (partial / token-set / plain ratio) so a genuinely
#      similar full string is rewarded, not just a lucky substring.
_FUZZY_LABEL_THRESHOLD = 62
_FUZZY_LABEL_MIN_LEN = 6
_FUZZY_LABEL_MAX_LEN = 40

# Lines that clearly belong to a *different* declaration must never be
# accepted as a corrupted label for this one, at any fuzzy score.
_OTHER_DECLARATION_LINE = re.compile(
    # Found on the real Bikaji pack: "MFG. DATE:" fuzzy-scored high enough
    # against "mfg by" to be accepted as a manufacturer label, and the
    # extractor then took the following line ("BATCH NO") as the
    # manufacturer's name. A date label is a DIFFERENT declaration and must
    # never be read as a name-and-address label, however similar the letters.
    r"\b(mrp|m\.r\.p|maximum\s+retail|price|best\s*before|use\s*by|exp(?:iry)?|"
    r"mfg[.,]?\s*date|mfd[.,]?\s*date|manufacturing\s+date|packed\s+on|"
    r"net\s*(?:wt|weight|qty|quantity|contents)|ingredients?|nutrition|batch|"
    r"lot\s*no|fssai|licence|license|dimensions?|size|usp)\b",
    re.IGNORECASE,
)


def _fuzzy_label_match(text: str, keywords: List[str] = _LABEL_KEYWORDS,
                       threshold: int = _FUZZY_LABEL_THRESHOLD) -> bool:
    """Reusable across every label-anchored field (manufacturer, consumer
    care, country of origin) - just swap the keyword list.

    Returns True only for a line that plausibly *is* a corrupted standalone
    label. It never extracts a value; callers use it solely to decide
    whether to look at the following lines, so a false positive costs a
    weaker candidate, never a fabricated one.
    """
    stripped = text.strip()
    if not stripped:
        return False
    if len(stripped) < _FUZZY_LABEL_MIN_LEN or len(stripped) > _FUZZY_LABEL_MAX_LEN:
        # Too short: partial_ratio is unreliable (see table above).
        # Too long: it is prose or an address, not a bare label.
        return False
    if _OTHER_DECLARATION_LINE.search(stripped):
        return False

    lowered = stripped.lower()
    for kw in keywords:
        score = max(
            fuzz.partial_ratio(lowered, kw),
            fuzz.token_set_ratio(lowered, kw),
            fuzz.ratio(lowered, kw),
        )
        if score >= threshold:
            return True
    return False


def extract_manufacturer(lines: List[OCRLine]) -> dict:
    # FIX (found via testing, not in the original issue list): candidates
    # from the two collection passes below used to be tuples of different
    # shapes and were unpacked as if they were all the second shape, which
    # raised ValueError whenever a direct match won. Both passes now build
    # the same tuple, which also fixes the ranking itself.
    #
    # Tuple shape:
    #   (tier, label_quality, company_score, confidence, idx, line, value,
    #    raw_text)
    #
    #   tier          1 = primary manufacturer label, 0 = secondary
    #                 (packer/importer/marketer). PROBLEM 3.
    #   label_quality 1 = the label regex matched exactly, 0 = only the
    #                 fuzzy fallback recognised a corrupted label.
    #   company_score 1 = the value looks like a company name.
    #
    # Ranking is that tuple in order, so a primary label always beats a
    # secondary one no matter how confident the secondary read was - which
    # is exactly the "Manufactured by ABC Foods" vs "Imported by XYZ Pvt
    # Ltd" case. Confidence only breaks ties within the same tier.
    candidates = []

    company_hint = re.compile(
        r"\b(?:pvt|private|ltd|limited|llp|inc|corp|corporation|"
        r"industries|foods|food|enterprises|company|co\.?)\b",
        re.IGNORECASE,
    )

    # Pass 1: label and value on the same OCR line.
    for tier, pattern in ((1, _PRIMARY_MANUFACTURER_PATTERN),
                          (0, _SECONDARY_MANUFACTURER_PATTERN)):
        for i, line, m in _find_lines_matching(lines, pattern):
            value = m.group(1).strip(" .,")
            if not value:
                continue
            confidence = line.confidence if line.confidence is not None else 0.0
            company_score = 1 if company_hint.search(value) else 0
            candidates.append(
                (tier, 1, company_score, confidence, i, line, value, line.text)
            )

    # Pass 2: standalone label line, value on one of the following lines.
    # OCR often produces several duplicate/noisy versions, so inspect a few
    # following lines and keep the strongest company-looking one.
    primary_label_only = re.compile(
        rf"(?:{_PRIMARY_MANUFACTURER_LABELS})\s*[:.\-]?\s*$", re.IGNORECASE
    )
    secondary_label_only = re.compile(
        rf"(?:{_SECONDARY_MANUFACTURER_LABELS})\s*[:.\-]?\s*$", re.IGNORECASE
    )

    for i, line in enumerate(lines):
        if primary_label_only.search(line.text):
            tier, exact_label = 1, True
        elif secondary_label_only.search(line.text):
            tier, exact_label = 0, True
        elif _fuzzy_label_match(line.text, _PRIMARY_LABEL_KEYWORDS):
            tier, exact_label = 1, False
        elif _fuzzy_label_match(line.text, _SECONDARY_LABEL_KEYWORDS):
            tier, exact_label = 0, False
        else:
            continue
        label_quality = 1 if exact_label else 0

        # PROBLEM 1: _following_lines stops at the image boundary. Reading
        # lines[i + 1] off the flat list would let a bare "MANUFACTURED
        # FOR:" at the bottom of image 1 take its value from the top of
        # image 2, and the resulting bbox would point at the wrong photo.
        for j, candidate_line in _following_lines(lines, i, 5):
            value = candidate_line.text.strip(" .,")
            if not value:
                continue

            # Stop if another major declaration has started. Reuses the
            # same vocabulary as the label guard above: on a real
            # multi-column pack the "next line" after a label is often the
            # next DECLARATION rather than this label's value, and taking it
            # produced manufacturer = "BATCH NO" on the Bikaji pack.
            if _OTHER_DECLARATION_LINE.search(value) or "customer care" in value.lower():
                break

            if not _readable(candidate_line):
                continue

            # A name-and-address declaration is words, not a measurement.
            # Without this the Bikaji pack yielded manufacturer = "| 110g" -
            # the net-weight value sitting in the adjacent column. Three
            # letters is well below any real company name and well above a
            # unit suffix.
            if len(re.findall(r"[A-Za-z]", value)) < 3:
                continue

            confidence = (
                candidate_line.confidence
                if candidate_line.confidence is not None
                else 0.0
            )
            company_score = 1 if company_hint.search(value) else 0

            candidates.append(
                (
                    tier,
                    label_quality,
                    company_score,
                    confidence,
                    j,
                    candidate_line,
                    value,
                    f"{line.text} {value}",
                )
            )

    if not candidates:
        return _empty_evidence()

    best = max(candidates, key=lambda x: (x[0], x[1], x[2], x[3]))
    tier, label_quality, _, _, value_index, value_line, value, raw_text = best

    evidence = _base_evidence(
        value_line, value, raw_text, _context_window(lines, value_index)
    )
    evidence["label_match"] = "exact" if label_quality else "fuzzy"
    # PROBLEM 3: tells the rule engine whether this is the actual
    # manufacturer or a packer/importer/marketer standing in for one,
    # which are legally distinct roles even though Rule 6(1)(a) accepts
    # any of them as the required name-and-address declaration.
    evidence["label_type"] = "manufacturer" if tier else "packer_importer_marketer"
    return evidence


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


# --------------------------------------------------------------------------
# Commodity descriptor vocabulary (common_name, tier 2)
# --------------------------------------------------------------------------
# The labelled path below requires the pack to print "Product Name:" or
# "Common Name:". Real Indian FMCG packaging almost never does - Rule 6(1)(b)
# requires the NAME of the commodity, and packs satisfy it with a descriptor
# line instead of a labelled field:
#
#   Monaco       "MONACO - SALTED SNACK" / "Crispy Light Salty Snack"
#   Mixed Nuts   "MIXED NUTS" / "ROASTED & SALTED"
#   Bikaji       "Cereal based namkeen" / "chowpati bhelpuri"
#
# So the extractor could structurally never find a common name on a real
# pack, and PCR-R02 failed every single product regardless of compliance.
#
# The fix stays inside the golden rule. We are NOT inferring a name from
# font size, position or prominence - that was the original prohibition and
# it still stands. We are matching LEXICAL evidence: the pack literally
# prints a generic commodity word. "namkeen" on a package is a commodity
# declaration in a way that "MONACO" (a brand) is not, and the difference is
# in the words themselves, not in how big they are printed.
#
# Evidence from this path is tagged match_method="descriptor_vocabulary" so
# a reviewer (and the rule engine) can tell it from a cleanly labelled
# declaration.
_COMMODITY_DESCRIPTORS = {
    # snacks / namkeen
    "snack", "snacks", "namkeen", "bhel", "bhelpuri", "chips", "wafers",
    "mixture", "sev", "chivda", "papad", "nuts", "cashew", "almond",
    "peanut", "peanuts", "makhana",
    # bakery / cereal
    "biscuit", "biscuits", "cookie", "cookies", "cracker", "crackers",
    "bread", "rusk", "cake", "cereal", "oats", "noodles", "pasta", "vermicelli",
    # staples
    "atta", "flour", "maida", "rice", "dal", "pulses", "sugar", "salt",
    "poha", "suji", "rava", "besan",
    # dairy / beverages
    "milk", "curd", "paneer", "butter", "ghee", "cheese", "tea", "coffee",
    "juice", "beverage", "drink", "water", "soda",
    # condiments
    "oil", "masala", "spice", "spices", "pickle", "chutney", "sauce",
    "ketchup", "jam", "honey", "powder", "paste",
    # confectionery
    "chocolate", "candy", "toffee", "sweets", "mithai", "icecream",
    # common non-food packaged commodities
    "soap", "detergent", "shampoo", "toothpaste", "handwash", "sanitizer",
    "lotion", "cream", "oilcake", "incense", "agarbatti",
}

# Lines that contain descriptor words but are a different declaration.
# An ingredients list is the big one: Monaco's begins "WHEAT FLOUR, EDIBLE
# VEGETABLE OILS..." and would otherwise be read as the commodity name.
_NOT_A_DESCRIPTOR_LINE = re.compile(
    r"\b(ingredients?|nutrition|nutritional|allergen|contains|energy|protein|"
    r"carbohydrate|fat|sodium|recipe|serving|directions?|storage|"
    r"manufactured|marketed|packed\s*by|imported|customer\s*care|"
    r"consumer\s*care|mrp|maximum\s+retail|net\s*(?:wt|weight|qty|quantity)|"
    r"best\s*before|use\s*by|batch|lot\s*no|fssai|licence|license)\b",
    re.IGNORECASE,
)

_MAX_DESCRIPTOR_LINE_LEN = 60


def _descriptor_score(text: str) -> int:
    """Number of distinct commodity descriptor words present in a line."""
    tokens = set(re.findall(r"[a-z]+", text.lower()))
    return len(tokens & _COMMODITY_DESCRIPTORS)


def extract_common_name(lines: List[OCRLine]) -> dict:
    """
    Extract the common/product name only when there is explicit evidence.

    Golden-rule requirement:
      - Never infer a common name from font size, position, capitalization,
        or "most prominent" text.
      - Accept an explicitly labelled value on the same line.
      - If the label is on its own OCR line, accept a value from the next
        nearby line only when that line is clearly the continuation/value.
      - Otherwise return empty evidence so the rule engine can safely REVIEW.
    """
    # Same-line explicit label + value.
    for i, line, m in _find_lines_matching(lines, _COMMON_NAME_PATTERN):
        value = m.group(1).strip(" .,")
        if value:
            evidence = _base_evidence(line, value, line.text, _context_window(lines, i))
            evidence["match_method"] = "explicit_label"
            return evidence

    # Label-only line followed by a value line. This handles OCR/layout cases
    # where "Product Name:" and the actual value are split into separate lines.
    label_only = re.compile(
        r"^(?:name\s*of\s*commodity|common\s*name|generic\s*name|product\s*name|commodity)"
        r"\s*[:\-]?\s*$",
        re.IGNORECASE,
    )

    for i, line in enumerate(lines):
        if not label_only.match(line.text.strip()):
            continue

        # PROBLEM 1: image-bounded. A "Product Name:" label at the end of
        # one photo must not take its value from the start of the next.
        for j, candidate in _following_lines(lines, i, 2):
            if not _readable(candidate):
                continue
            value = candidate.text.strip(" .,")
            if not value:
                continue

            lowered = value.lower()
            # Do not consume another declaration or obvious non-name line.
            if any(keyword in lowered for keyword in (
                "mrp", "net qty", "net weight", "manufactured",
                "customer care", "consumer care", "best before",
                "use by", "country of origin", "made in"
            )):
                continue
            if not re.search(r"[A-Za-z]", value):
                continue

            context = _context_window(lines, i)
            evidence = _base_evidence(candidate, value, candidate.text, context)
            evidence["label_evidence"] = line.text
            evidence["match_method"] = "explicit_label"
            return evidence

    # Tier 2: no labelled declaration anywhere on the pack. Fall back to a
    # line that literally names a commodity. See _COMMODITY_DESCRIPTORS.
    best = None  # (descriptor_count, confidence, line, index)
    for i, line in enumerate(lines):
        text = line.text.strip(" .,")
        if not text or len(text) > _MAX_DESCRIPTOR_LINE_LEN:
            continue
        if not _readable(line):
            continue
        if _NOT_A_DESCRIPTOR_LINE.search(text):
            continue
        score = _descriptor_score(text)
        if not score:
            continue
        confidence = line.confidence if line.confidence is not None else 0.0
        candidate = (score, confidence, i, line, text)
        if best is None or candidate[:2] > best[:2]:
            best = candidate

    if best is not None:
        _, _, i, line, text = best
        evidence = _base_evidence(line, text, line.text, _context_window(lines, i))
        evidence["match_method"] = "descriptor_vocabulary"
        # Weaker than a labelled declaration: the pack names the commodity,
        # but not in a field we can point at. Flagged so the rule engine can
        # route it to REVIEW rather than treat it as a clean PASS.
        evidence["partial"] = True
        return evidence

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
# A dimensions declaration ("Dimensions: 10 x 20 x 5 cm", "Size 15x10cm")
# contains a number+unit run, but it is PCR-R10 evidence, not net quantity.
_DIMENSIONS_LIKE = re.compile(
    r"\b(?:dimensions?|size)\b|\d\s*[xX×]\s*\d",
    re.IGNORECASE,
)

# FIX: OCR confidence below this, on a labelled quantity line with no unit
# token recognised, is not trusted as proof the unit is genuinely absent -
# see _qty_evidence_from_match below.
_LOW_OCR_CONFIDENCE = 0.70

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


# Used ONLY by the label-on-one-line / value-on-the-next path, where the
# preceding label is what justifies treating a bare number as a quantity.
# Group 2 is always None (no unit token), which is what routes it into the
# digit-tail recovery / ambiguity handling in _qty_evidence_from_match.
_BARE_NUMBER_PATTERN = re.compile(r"\b(\d+(?:\.\d+)?)\b()")


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

    # FIX: exact-match unit parsing had zero tolerance for common OCR
    # digit/letter confusions. Try a clean match first; only fall back to
    # the fuzzy OCR-confusion correction (and flag it as such) when the
    # literal unit text isn't already valid on its own.
    exact_unit = _norm_unit(raw_unit)
    corrected_from_ocr = False
    if exact_unit and exact_unit in VALID_QTY_UNITS:
        unit = exact_unit
    else:
        fuzzy_unit = _normalize_unit_fuzzy(raw_unit)
        if fuzzy_unit and fuzzy_unit != exact_unit:
            unit = fuzzy_unit
            corrected_from_ocr = True
        else:
            unit = exact_unit

    # FIX (this revision): the unit letter may have been read as a digit and
    # swallowed into the number itself ("400g" -> "4009"), in which case
    # there is no unit token above to correct. Recover it from the tail of
    # the digit run - labelled lines only, exact units only. See
    # _recover_unit_from_digit_tail.
    recovered_tail = None
    if labelled and (not unit or unit not in VALID_QTY_UNITS) and not raw_unit:
        recovered_tail = _recover_unit_from_digit_tail(value)
        if recovered_tail:
            value, unit = recovered_tail
            corrected_from_ocr = True

    evidence = _base_evidence(line, value, line.text, _context_window(lines, i))
    evidence["corrected_from_ocr"] = corrected_from_ocr
    if recovered_tail:
        # Distinct from "confirmed_present": the unit was reconstructed from
        # a suspected OCR misread, not actually read off the pack. Downstream
        # can treat this as REVIEW-worthy rather than a clean pass.
        evidence["unit"] = unit
        evidence["unit_status"] = "ocr_corrected"
        return evidence
    if unit and unit in VALID_QTY_UNITS:
        evidence["unit"] = unit
        evidence["unit_status"] = "confirmed_present"
    elif labelled:
        if raw_unit:
            evidence["unit"] = None
            evidence["unit_status"] = "ambiguous"
        else:
            # FIX: a labelled quantity line with no unit token at all used
            # to be declared "confirmed_absent" unconditionally. On real
            # packaging a unit almost always follows the number - so on
            # low-confidence OCR, a "missing" unit is more likely a
            # misread digit run (e.g. "400g" garbled into "4009", where the
            # trailing "g" got folded into the digits) than a genuinely
            # unlabelled quantity. Only trust "confirmed_absent" when OCR
            # was confident enough that nothing plausibly got eaten;
            # otherwise report "ambiguous" so the rule engine sends it to
            # REVIEW instead of wrongly failing a compliant package.
            if (OCR_CONFIDENCE_GATING
                    and line.confidence is not None
                    and line.confidence < _LOW_OCR_CONFIDENCE):
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
        if not _QTY_LABEL_ONLY.search(line.text):
            continue
        # PROBLEM 1: lines[i + 1] read straight off the flat list, so a
        # "Net Qty:" label at the foot of one image could take the first
        # line of the next image as its quantity. _following_lines stops at
        # the image boundary and yields nothing when the label is the last
        # line of its own image.
        for next_idx, nxt in _following_lines(lines, i, 1):
            # Found while writing the cross-image test: this path only
            # accepted a next line that already carried a recognised unit,
            # so "Net Weight:" / "4009" (the same swallowed-unit misread the
            # digit-tail recovery exists to handle) fell through entirely.
            # A bare number is acceptable HERE and only here, because the
            # previous line is an explicit quantity label - the same
            # justification the labelled same-line path already uses. If no
            # unit can be recovered, _qty_evidence_from_match reports
            # ambiguous/confirmed_absent rather than inventing one.
            m = (_STANDALONE_QTY_PATTERN.search(nxt.text)
                 or _NET_QTY_LABELLED_PATTERN.search(nxt.text)
                 or _BARE_NUMBER_PATTERN.search(nxt.text))
            if not m:
                continue
            value, raw_unit = m.group(1), m.group(2)
            evidence = _qty_evidence_from_match(nxt, next_idx, lines, value, raw_unit, labelled=True)
            if evidence:
                evidence["raw_text"] = f"{line.text} {nxt.text}".strip()
                evidence["context"] = _context_window(lines, i)
                return evidence

    # 2) No explicit label anywhere — fall back to standard package notation
    #    ("400g", "1 kg", "2 L", "750mg"). The unit is right there attached
    #    to the number, so this is still real evidence, not a guess. A bare
    #    number with no unit attached is deliberately NOT matched here.
    for i, line, m in _find_lines_matching(lines, _STANDALONE_QTY_PATTERN):
        # FIX (this revision): two other declarations contain a
        # "<number><unit>" run and were being harvested as an unlabelled net
        # quantity - "Dimensions: 10 x 20 x 5 cm" reported 5 cm, and "Unit
        # Sale Price Rs 15.00 per 100g" reported 100 g. Neither is a net
        # quantity declaration; both are their own field.
        if _DIMENSIONS_LIKE.search(line.text) or _USP_LINE.search(line.text):
            continue
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
#
# FIX: _plausible_price_amount() and _PRICE_LABEL_PATTERN were previously
# defined but never called/referenced from extract_mrp() below - both are
# now wired in, matching this comment block's original intent.

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

_MRP_LABEL_PATTERN = re.compile(
    r"(?:mrp|m\.r\.p\.?|maximum\s+retail\s+price)", re.IGNORECASE
)
_AMOUNT_TOKEN_PATTERN = re.compile(r"[\d,]+(?:\.\d{1,2})?")

_BARE_CURRENCY_PRICE_PATTERN = re.compile(
    r"(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)


def _best_price_amount_after_label(text: str, label_end: int) -> Optional[str]:
    """
    FIX (found via testing on a real package photo): OCR frequently misreads
    the currency symbol right after "MRP" as a stray 1-2 digit number (e.g.
    "MRP 2 60.00" where "2" is a misread "Rs." glyph). The old
    _MRP_AMOUNT_PATTERN captured the *first* digit run after the label, so
    it returned that stray "2" as the MRP instead of the real "60.00" that
    is sitting right there on the same line. This now looks at every
    plausible number in the text immediately after the label and, when one
    of them has a decimal point (the normal way a price is printed -
    "60.00"), prefers that one over a shorter integer-looking artifact.
    """
    tail = text[label_end:label_end + 40]
    candidates = [t for t in _AMOUNT_TOKEN_PATTERN.findall(tail) if _plausible_price_amount(t)]
    if not candidates:
        return None
    decimals = [t for t in candidates if "." in t]
    return decimals[0] if decimals else candidates[0]

def extract_mrp(lines: List[OCRLine]) -> dict:
    mrp_hits, price_candidates = [], []

    for i, line in enumerate(lines):
        text = line.text
        if _USP_PATTERN.search(text) or _USP_LINE.search(text):
            continue  # "Unit Sale Price" lines contain the word "price" too - not MRP
        if _NON_MRP_PRICE_CONTEXT.search(text):
            continue  # "orders above Rs.500", "Rs.100 off", etc - not a price declaration

        m = _MRP_LABEL_PATTERN.search(text)
        if m:
            amount = _best_price_amount_after_label(text, m.end())
            if amount:
                mrp_hits.append((i, line, amount))
                continue

        m2 = _BARE_CURRENCY_PRICE_PATTERN.search(text)
        if m2 and _plausible_price_amount(m2.group(1)):
            price_candidates.append((i, line, m2.group(1)))
            continue

        # A bare "PRICE 2500/-" with no currency symbol produces no hit
        # above (no Rs./INR/₹ present) - fold it into the same price
        # candidate pool rather than losing it entirely.
        m3 = _PRICE_LABEL_PATTERN.search(text)
        if m3 and _plausible_price_amount(m3.group(2)):
            price_candidates.append((i, line, m3.group(2)))

    if mrp_hits:
        i, line, amount = mrp_hits[0]
        evidence = _base_evidence(
            line,
            amount.replace(",", ""),
            line.text,
            _context_window(lines, i),
        )
        evidence["currency"] = _detect_currency(line.text)
        evidence["context_confirmed"] = True
        return evidence

    if len(price_candidates) == 1:
        i, line, amount = price_candidates[0]
        evidence = _base_evidence(
            line,
            amount.replace(",", ""),
            line.text,
            _context_window(lines, i),
        )
        evidence["currency"] = _detect_currency(line.text)
        evidence["context_confirmed"] = True
        return evidence

    if len(price_candidates) > 1:
        # Multiple unlabelled/PRICE-only prices, none of them tagged MRP:
        # report the best candidate with context_confirmed=False rather
        # than guessing which one is MRP.
        i, line, amount = price_candidates[0]
        evidence = _base_evidence(
            line,
            amount.replace(",", ""),
            line.text,
            _context_window(lines, i),
        )
        evidence["currency"] = _detect_currency(line.text)
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
# FIX (structural, per the fixes doc): the old _DATE_PATTERN was a hardcoded
# list of literal date formats. Every format outside that list failed
# silently - confirmed on real packaging: "31JUL2026" and "30JAN2027" (day +
# month abbreviation + year, glued together with zero separators) matched
# neither branch, so manufacturing_date/expiry_date stayed null even though
# OCR read the text fine. This generalises to every pack, not just that one
# image: a real date parser already knows every DD/MM/YYYY, MMM-DD-YYYY,
# DDMMMYYYY, ISO, etc. permutation, so we don't hand-enumerate them.
#
# Two-stage approach:
#   Stage 1 (cheap, broad): _DATE_CANDIDATE_PATTERN just flags "this span
#   probably contains a date" - a day/month/year arrangement in any of the
#   common orders, with zero or more separators between the parts (so a
#   glued "31JUL2026" is captured just as readily as "31/07/2026" or
#   "31 July 2026").
#   Stage 2 (precise): _try_parse_date() hands the candidate string to
#   dateutil.parser.parse(fuzzy=True, dayfirst=True) instead of trying to
#   regex-parse the actual date value. Anything the broad regex over-matched
#   (e.g. a stray digit run that isn't really a date) gets rejected here,
#   since dateutil raises on nonsense rather than guessing.
_MONTH_NAMES = (
    r"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
)
_DATE_CANDIDATE_PATTERN = re.compile(
    r"\b("
    rf"\d{{1,2}}\s*[/\-., ]?\s*(?:{_MONTH_NAMES})\.?\s*[/\-., ]?\s*\d{{2,4}}"      # D MON Y / DDMMMYYYY
    rf"|(?:{_MONTH_NAMES})\.?\s*[/\-., ]?\s*\d{{1,2}}\s*[/\-., ]?\s*\d{{2,4}}"     # MON D Y
    r"|\d{1,2}\s*[/\-.]\s*\d{1,2}\s*[/\-.]\s*\d{2,4}"                             # D/M/Y numeric
    r"|\d{4}\s*[/\-.]\s*\d{1,2}\s*[/\-.]\s*\d{1,2}"                               # Y/M/D numeric (ISO-ish)
    r")\b",
    re.IGNORECASE,
)


def _try_parse_date(candidate: str):
    """Stage 2: delegate the actual date interpretation to dateutil rather
    than a regex. Returns a datetime on success, None on anything that isn't
    really a date (dateutil raises instead of guessing)."""
    try:
        return dateutil_parser.parse(candidate, fuzzy=True, dayfirst=True)
    except (ValueError, OverflowError, TypeError):
        return None
# FIX (found via testing on a real package photo): a package printed
# "BEST BEFORE SIX MONTHS FROM PACKAGING" - a spelled-out number, which is
# at least as common on Indian FMCG packaging as a digit. The old pattern
# only matched \d+, so this - a real, legally meaningful shelf-life
# declaration - was silently dropped: expiry_date stayed null, which in
# turn meant product_context.may_expire stayed None even though the
# package explicitly states it has a shelf life.
_DURATION_NUMBER_WORDS = {
    "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6",
    "seven": "7", "eight": "8", "nine": "9", "ten": "10", "eleven": "11",
    "twelve": "12", "eighteen": "18", "twenty-four": "24", "thirty": "30",
    "thirty-six": "36",
}
_DURATION_NUMBER_ALT = "|".join(
    re.escape(w) for w in sorted(_DURATION_NUMBER_WORDS, key=len, reverse=True)
)

# FIX (per the fixes doc — "code (dedup gap)"): the pattern above required
# the number+unit to sit immediately next to the label, separated only by
# an optional colon/dash. On a real package this line was OCR'd at 0.90
# confidence but with duplicated word fragments from the label re-read
# twice against dense/glossy print (e.g. "BEST BEFORE BEST BEFORE SIX
# MONTHS" / "BEST BEFORE SIX SIX MONTHS FROM PACKAGING") - the immediate-
# adjacency requirement broke on the very first attempt, and unlike the
# label-only fallback used elsewhere in this file, there was no fallback
# here at all, so a clearly-readable shelf-life declaration was silently
# dropped.
#
# Fix, in the same spirit as _best_price_amount_after_label above: split
# "find the label" from "find the value" instead of requiring them glued
# together. First collapse immediately-repeated tokens (the duplicate-
# fragment case), then search a short window after the label for the
# number+unit rather than requiring strict adjacency. This is still
# evidence-only - it never invents a number/unit that isn't actually
# printed, it just tolerates the noise OCR adds around a label that IS
# genuinely there.
_DURATION_LABEL_PATTERN = re.compile(
    r"(?:best\s*before|use\s*by|exp(?:iry)?\.?)", re.IGNORECASE,
)
_DURATION_VALUE_PATTERN = re.compile(
    rf"(\d+|{_DURATION_NUMBER_ALT})\s*(months?|years?|days?|weeks?)",
    re.IGNORECASE,
)


# Markers that mean "a different declaration starts here", used to stop the
# next-line lookahead in _best_duration_after_label. Deliberately narrow:
# these are declaration labels, not general text, so a noisy OCR fragment
# between the label and its value does not abort the search.
_OTHER_DECLARATION_AFTER_LABEL = re.compile(
    r"\b(mrp|m\.r\.p|maximum\s+retail|price|net\s*(?:wt|weight|qty|quantity|contents)|"
    r"manufactured|marketed|packed\s*by|imported\s*by|consumer\s*care|customer\s*care|"
    r"ingredients?|nutrition|batch|lot\s*no|fssai)\b",
    re.IGNORECASE,
)


def _dedup_consecutive_words(text: str) -> str:
    """Collapses immediately-repeated whitespace-separated tokens, case-
    insensitively - e.g. "BEST BEFORE BEST BEFORE SIX SIX MONTHS" becomes
    "BEST BEFORE SIX MONTHS". OCR on dense/glossy/curved print sometimes
    re-reads the same short span twice back-to-back; this collapses that
    duplication without touching genuinely distinct words."""
    tokens = text.split()
    out = []
    prev_lower = None
    for tok in tokens:
        low = tok.lower()
        if low == prev_lower:
            continue
        out.append(tok)
        prev_lower = low
    return " ".join(out)


def _best_duration_after_label(
    text: str,
    label_end: int,
    lines: Optional[List[OCRLine]] = None,
    line_idx: Optional[int] = None,
    lookahead: int = 2,
) -> Optional[tuple]:
    """Looks for a number+unit duration belonging to a best-before/use-by/exp
    label, tolerating duplicated word fragments rather than requiring the
    value to sit immediately next to the label.

    PROBLEM 2 — the value is very often on the NEXT line:

        Best Before:            Best Before
        6 months                6 Months

    Both are ordinary label layouts, and OCR splits them into two OCRLines,
    so searching only `text` after `label_end` found nothing and the whole
    shelf-life declaration was dropped.

    Return contract is UNCHANGED: (number_string, unit_word) or None. The
    two new arguments are optional and keyword-friendly, so any existing
    caller passing only (text, label_end) keeps the old same-line-only
    behaviour and cannot break.

    Line boundaries are respected in both directions:
      - only `lookahead` lines are consulted, so a duration printed further
        down the pack for an unrelated reason is not vacuumed up;
      - _following_lines stops at the image boundary (PROBLEM 1), so a
        "Best Before:" at the foot of image 1 cannot take "6 months" from
        the top of image 2.

    The same-line tail is always tried first: if the value is right there,
    the next lines are never consulted at all, so this cannot change the
    result for any pack that already worked.
    """
    tail = text[label_end:label_end + 40]
    m = _DURATION_VALUE_PATTERN.search(_dedup_consecutive_words(tail))
    if m:
        return m.group(1), m.group(2)

    if lines is None or line_idx is None:
        return None

    for _, nxt in _following_lines(lines, line_idx, lookahead):
        candidate = nxt.text.strip()
        if not candidate:
            continue
        # Stop at the next declaration rather than reading past it - "Best
        # Before:" followed by "MRP Rs 60" must not yield a duration, and
        # a line that is itself another label means this one had no value.
        if _OTHER_DECLARATION_AFTER_LABEL.search(candidate):
            break
        m = _DURATION_VALUE_PATTERN.search(_dedup_consecutive_words(candidate))
        if m:
            return m.group(1), m.group(2)
        # A line with no duration and no other-declaration marker is noise
        # (a stray fragment); keep looking within the lookahead window.
    return None
_PHONE_LIKE = re.compile(r"(?:\+91[\s-]?)?[6-9]\d{9}\b|\b\d{10,}\b")
# FIX (this revision): batch/lot/licence numbers are frequently printed in a
# date-shaped form ("Batch No 2026/07/31") and parsed cleanly as dates. With
# no mfg/expiry keyword nearby they were classified "unclear" and then parked
# under manufacturing_date, i.e. a batch number was being reported as a
# manufacturing date.
_NON_DATE_CONTEXT = re.compile(
    r"\b(orders?|price|mrp|rs\.?|inr|model|call|phone|helpline|customer|consumer|"
    r"batch|lot|b\.?\s*no|fssai|licence|license|reg\.?\s*no)\b",
    re.IGNORECASE,
)


def _classify_date_role(blob: str) -> str:
    if _MFG_KEYWORDS.search(blob):
        return "manufacturing"
    if _EXP_KEYWORDS.search(blob):
        return "best_before_use_by"
    return "unclear"


# FIX (this revision): a line very commonly carries BOTH dates - "MFG
# 31JUL2026 EXP 30JAN2027" is standard Indian FMCG date-panel printing.
# Classifying from the whole line means whichever keyword family is checked
# first wins for every date on that line, so both dates get the same role and
# one of them is thrown away. Each match is now classified from the text
# immediately before it; the line/neighbourhood blob is only the fallback for
# a date with no keyword of its own.
_ROLE_LOOKBEHIND_CHARS = 24


def _classify_match_role(line_text: str, match_start: int, blob: str) -> str:
    """Role for ONE date match, preferring the keyword nearest to it."""
    prefix = line_text[max(0, match_start - _ROLE_LOOKBEHIND_CHARS):match_start]

    mfg = _MFG_KEYWORDS.search(prefix)
    exp = _EXP_KEYWORDS.search(prefix)
    if mfg and exp:
        # Both appear before this date - the nearer one owns it.
        return "manufacturing" if mfg.start() > exp.start() else "best_before_use_by"
    if mfg:
        return "manufacturing"
    if exp:
        return "best_before_use_by"

    # No keyword immediately before this date. If the line as a whole carries
    # exactly one keyword family, that's still solid evidence; if it carries
    # both, this particular date is genuinely unattributable and stays
    # unclear rather than being assigned to whichever we happen to test first.
    line_mfg = bool(_MFG_KEYWORDS.search(line_text))
    line_exp = bool(_EXP_KEYWORDS.search(line_text))
    if line_mfg and not line_exp:
        return "manufacturing"
    if line_exp and not line_mfg:
        return "best_before_use_by"
    if line_mfg and line_exp:
        return "unclear"

    return _classify_date_role(blob)


def _looks_like_phone_fragment(line_text: str, date_text: str) -> bool:
    """Reject date-shaped slices that sit inside a phone / long digit run."""
    if _PHONE_LIKE.search(line_text) and date_text in re.sub(r"\s+", "", line_text):
        return True
    return False


def _extract_dates(lines: List[OCRLine]) -> List[dict]:
    """Finds every date (and best-before duration) on the pack with its role."""
    found = []
    seen = set()

    # FIX (this revision): finditer, not search. _find_lines_matching yields
    # at most one match per line, so the second date on a combined
    # "MFG ... EXP ..." line was never even looked at.
    for i, line in enumerate(lines):
        blob = _context_window(lines, i, radius=1)
        for m in _DATE_CANDIDATE_PATTERN.finditer(line.text):
            date_text = m.group(1).strip()
            if _looks_like_phone_fragment(line.text, date_text):
                continue
            # Stage 2: confirm the broad candidate is an actual date before
            # trusting it. This is what lets the candidate regex stay loose
            # (and therefore format-agnostic) without turning random digit
            # runs into false-positive dates.
            parsed = _try_parse_date(date_text)
            if parsed is None:
                continue
            # Bare years and marketing copy should not become dates; the
            # regex already requires a day/month structure. Still skip
            # obvious price/batch lines with no mfg/expiry keyword nearby.
            role = _classify_match_role(line.text, m.start(), f"{line.text} {blob}")
            if role == "unclear" and _NON_DATE_CONTEXT.search(line.text):
                continue
            key = (line.image_index, date_text, role)
            if key in seen:
                continue
            seen.add(key)
            evidence = _base_evidence(line, date_text, line.text, blob)
            evidence["date_role"] = role
            # Informational only, alongside the raw matched text - downstream
            # consumers that want a normalised date don't have to re-parse it.
            evidence["parsed_date"] = parsed.date().isoformat()
            found.append(evidence)

    for i, line in enumerate(lines):
        label_m = _DURATION_LABEL_PATTERN.search(line.text)
        if not label_m:
            continue
        # PROBLEM 2 — caller change: pass the line list and this line's
        # index so the helper can fall through to the next line or two when
        # the label has no value after it on its own line ("Best Before:" /
        # "6 months"). The first two arguments are unchanged.
        result = _best_duration_after_label(
            line.text, label_m.end(), lines=lines, line_idx=i
        )
        if not result:
            continue
        num_raw, unit_word = result
        num = _DURATION_NUMBER_WORDS.get(num_raw.lower(), num_raw)
        value = f"{num} {unit_word}".strip()
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
# consumer_care (PCR-R06)
# --------------------------------------------------------------------------
# FIX (Priority 3 per the fixes doc): _CARE_KEYWORDS required an exact
# spelling of "consumer care" / "helpline" / etc. A corrupted label (e.g.
# dense small print) used to mean the phone/email sitting right there on
# the same line was never even looked at. This is a low-risk addition: the
# fuzzy check only decides whether to *look* at a line for a phone/email -
# it never guesses the value itself, so it can only recover evidence that
# was already unambiguously present, never invent any.

_PHONE_PATTERN = re.compile(r"(\+?\d[\d\s\-]{8,14}\d)")
_EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_CARE_KEYWORDS = re.compile(
    r"consumer\s*care|customer\s*care|customer\s*service|helpline|toll\s*free|"
    r"for\s+complaints|careline|grievance",
    re.IGNORECASE,
)
_CARE_LABEL_KEYWORDS = [
    "consumer care", "customer care", "customer service", "helpline",
    "toll free", "for complaints", "careline", "grievance",
]


# PROBLEM 6 — the fallback comment said "an email or phone number anywhere
# counts as a partial match", but the loop only ever looked for an email. A
# pack printing a bare toll-free number with a corrupted label produced no
# consumer-care evidence at all.
#
# A phone fallback is riskier than an email fallback, because an email
# address is self-identifying (the "@" makes it unambiguous) while a bare
# run of digits is not - MRP, net quantity, dates, batch codes, FSSAI
# licence numbers, pincodes and EAN barcodes are all just digits. So the
# unlabelled phone fallback validates the SHAPE of the number and rejects
# lines that carry a different declaration, rather than accepting any digit
# run the way the email branch can afford to.
#
# Accepted shapes (Indian consumer-care numbers as actually printed):
#   1800 xxx xxxx / 1800-xxx-xxxx   toll-free
#   +91 xxxxxxxxxx                  explicit country code
#   0xx-xxxxxxxx                    STD-prefixed landline
#   xxxxxxxxxx                      10 digits starting 6-9 (mobile)
# A 12/13-digit EAN barcode, a 14-digit FSSAI licence, a 6-digit pincode and
# a 4-6 digit price all fail these.
_TOLLFREE_PATTERN = re.compile(r"\b(1800[\s\-]?\d{2,4}[\s\-]?\d{3,4})\b")
_INTL_PHONE_PATTERN = re.compile(r"(\+91[\s\-]?\d{5}[\s\-]?\d{5}|\+91[\s\-]?\d{10})")
_STD_PHONE_PATTERN = re.compile(r"\b(0\d{2,4}[\s\-]\d{6,8})\b")
_MOBILE_PATTERN = re.compile(r"(?<!\d)([6-9]\d{9})(?!\d)")

_PHONE_SHAPES = (_TOLLFREE_PATTERN, _INTL_PHONE_PATTERN,
                 _STD_PHONE_PATTERN, _MOBILE_PATTERN)

# A line making one of these declarations is not a consumer-care line, even
# if some digit run on it happens to look phone-shaped.
_NOT_A_PHONE_LINE = re.compile(
    r"\b(mrp|m\.r\.p|maximum\s+retail|price|rs\.?|inr|₹|"
    r"net\s*(?:wt|weight|qty|quantity|contents)|batch|lot\s*no|fssai|licence|license|"
    r"best\s*before|use\s*by|mfg|mfd|exp(?:iry)?|pin\s*code|gstin|barcode|ean)\b",
    re.IGNORECASE,
)


def _find_phone(text: str, strict: bool) -> Optional[str]:
    """Returns a phone-shaped substring, or None.

    strict=False is used on a line that already carries an explicit
    consumer-care label - the label is the evidence that these digits are a
    contact number, so the looser original pattern is kept and behaviour on
    packs that already worked is unchanged.

    strict=True is the unlabelled fallback, where the number itself has to
    carry all the evidence.
    """
    if not strict:
        m = _PHONE_PATTERN.search(text)
        return m.group(1) if m else None
    if _NOT_A_PHONE_LINE.search(text):
        return None
    for pattern in _PHONE_SHAPES:
        m = pattern.search(text)
        if m:
            return m.group(1)
    return None


def extract_consumer_care(lines: List[OCRLine]) -> dict:
    # Strongest evidence: an explicit (or fuzzily recognised) consumer-care
    # label with a contact on the same line.
    for i, line in enumerate(lines):
        if _CARE_KEYWORDS.search(line.text) or _fuzzy_label_match(line.text, _CARE_LABEL_KEYWORDS):
            phone = _find_phone(line.text, strict=False)
            email = _EMAIL_PATTERN.search(line.text)
            value = phone if phone else (email.group(0) if email else None)
            if value:
                return _base_evidence(line, value, line.text, _context_window(lines, i))

    # Fallback: an email anywhere on the pack. Self-identifying, so this
    # stays ahead of the phone fallback.
    for i, line in enumerate(lines):
        email = _EMAIL_PATTERN.search(line.text)
        if email:
            ev = _base_evidence(line, email.group(0), line.text, _context_window(lines, i))
            ev["partial"] = True
            return ev

    # PROBLEM 6: fallback the comment always promised - a phone-shaped
    # number anywhere, subject to the shape and declaration checks above.
    for i, line in enumerate(lines):
        phone = _find_phone(line.text, strict=True)
        if phone:
            ev = _base_evidence(line, phone, line.text, _context_window(lines, i))
            ev["partial"] = True
            return ev

    return _empty_evidence()


# --------------------------------------------------------------------------
# country_of_origin (PCR-R07)
# --------------------------------------------------------------------------
# FIX (Priority 3 per the fixes doc): _ORIGIN_PATTERN, like the manufacturer
# pattern, only matches when the label and value sit together on one clean
# line with the label spelled exactly right. Add the same fuzzy fallback
# used for manufacturer: if a standalone, corrupted-but-recognisable label
# line is found, look at the next line for the value - never used to slice
# a value out of a combined line, for the same golden-rule reason as above.

_ORIGIN_PATTERN = re.compile(
    r"(?:country\s*of\s*origin|origin\s*country)\s*[:\-]?\s*(.+)|"
    r"made\s+in\s*[:\-]?\s*(.+)|"
    r"product\s+of\s*[:\-]?\s*(.+)|"
    r"produce\s+of\s*[:\-]?\s*(.+)",
    re.IGNORECASE,
)
_ORIGIN_LABEL_ONLY = re.compile(
    r"(?:country\s*of\s*origin|origin\s*country|made\s+in|product\s+of|produce\s+of)"
    r"\s*[:\-]?\s*$",
    re.IGNORECASE,
)
_ORIGIN_LABEL_KEYWORDS = [
    "country of origin", "origin country", "made in", "product of", "produce of",
]
_IMPORTED_BY = re.compile(r"\bimported\s+by\b", re.IGNORECASE)
_INDIA_ALIASES = {"india", "in", "bharat", "hindustan"}

# --------------------------------------------------------------------------
# PROBLEM 4 — importer text bleeding into the country value
# --------------------------------------------------------------------------
# _ORIGIN_PATTERN captures `(.+)` to end of line, so a single OCR line
# reading "Made in India. Imported by ABC Pvt Ltd" produced
# country_of_origin = "India. Imported by ABC Pvt Ltd". That is not a
# country, so any downstream country-list validation in the rule engine
# fails it, and a compliant pack gets flagged.
#
# The cleanup has to be conservative in the other direction too: real
# country names contain spaces, "of", and "and" ("United Arab Emirates",
# "Republic of Korea", "Trinidad and Tobago"), so a naive "first word only"
# or "cut at the first space" rule would mangle them.
#
# Two cuts, in order:
#   1. at a sentence/segment boundary - a full stop, comma, semicolon, pipe
#      or dash that is followed by more text. Country names do not contain
#      these; the next declaration almost always follows one.
#   2. at the start of any known following-declaration keyword, for the case
#      where OCR dropped the punctuation ("Made in India Imported by ABC").
# Then a length sanity check: nothing plausible as a country name runs past
# ~40 characters, and if the result is empty we keep the original rather
# than inventing a truncation.
_ORIGIN_TRAILING_DECLARATION = re.compile(
    r"\s+(?=(?:imported\s+by|importer|marketed\s+by|packed\s+by|packer|packaged\s+by|"
    r"manufactured\s+(?:by|for)|manufacturer|mfd\.?\s*by|mfg\.?\s*by|distributed\s+by|"
    r"net\s*(?:wt|weight|qty|quantity)|mrp|best\s*before|use\s*by|customer\s*care|"
    r"consumer\s*care|for\s+complaints)\b)",
    re.IGNORECASE,
)
_ORIGIN_SEGMENT_BREAK = re.compile(r"[.,;|]\s*\S|\s+[-\u2013\u2014]\s+")
_MAX_COUNTRY_LEN = 40


def _clean_origin_value(value: str) -> str:
    """Trims trailing non-country text off a country-of-origin capture.

    "India. Imported by ABC Pvt Ltd" -> "India"
    "United Arab Emirates"           -> "United Arab Emirates"  (untouched)
    """
    cleaned = value.strip()

    # Cut 2 first (keyword), because OCR often loses the punctuation that
    # cut 1 relies on, and cutting at the keyword is the more precise of
    # the two when both would fire.
    keyword_cut = _ORIGIN_TRAILING_DECLARATION.search(cleaned)
    if keyword_cut:
        cleaned = cleaned[:keyword_cut.start()]

    segment_cut = _ORIGIN_SEGMENT_BREAK.search(cleaned)
    if segment_cut:
        cleaned = cleaned[:segment_cut.start()]

    cleaned = cleaned.strip(" .,;:-|")

    # If cleanup produced nothing, or the result is still implausibly long
    # for a country name, fall back to the original capture rather than
    # reporting a value we invented by truncation. Over-long evidence is
    # visibly wrong to a reviewer; a silently truncated country is not.
    if not cleaned:
        return value.strip()
    if len(cleaned) > _MAX_COUNTRY_LEN:
        return value.strip()
    return cleaned


# --------------------------------------------------------------------------
# PROBLEM 5 — what "Made in India" + "Imported by ABC" should mean
# --------------------------------------------------------------------------
# Current behaviour: both signals present -> is_imported = None -> the rule
# engine's applicability check turns that into REVIEW.
#
# The two signals are not actually the same kind of claim:
#   - "Made in India" / "Country of Origin: X" is the ORIGIN declaration
#     (Rule 6(1)(f)). It states where the goods were made.
#   - "Imported by ABC Pvt Ltd" is a NAME-AND-ADDRESS declaration
#     (Rule 6(1)(a)). It states which entity is responsible for the pack in
#     India. It is about a company's role, not about the goods' origin.
#
# So they only look contradictory. An explicit origin declaration answers
# "is this imported?" directly and completely; the importer line answers a
# different question. Treating a directly-stated fact as unknown because a
# weaker proxy for it disagrees is the wrong resolution - and REVIEW is not
# a free "safe" option, because a queue full of correctly-declared packs is
# how reviewers learn to rubber-stamp.
#
# Hence: when an origin declaration is present it is authoritative for
# is_imported. The importer mention is not discarded - it is recorded on the
# evidence as importer_mentioned, and when the two disagree,
# origin_conflict=True is set so the rule engine can still route that
# specific pack to REVIEW if the rules owner wants it to. The importer line
# remains the sole signal when NO origin declaration was found at all, which
# is the case it is genuinely informative for.
#
# This IS a policy change, not just a code fix - flag it to Riya/the rules
# owner. Flip the constant to restore the old conservative behaviour.
ORIGIN_DECLARATION_OVERRIDES_IMPORTER = True


def _origin_is_india(value: str) -> bool:
    token = re.sub(r"[^a-z]", "", value.strip().lower())
    return token in _INDIA_ALIASES or value.strip().lower() in _INDIA_ALIASES


def _origin_evidence(line: OCRLine, i: int, lines: List[OCRLine], value: str,
                     raw_text: str, imported_mention: bool):
    value = _clean_origin_value(value)          # PROBLEM 4
    evidence = _base_evidence(line, value, raw_text, _context_window(lines, i))
    made_in_india = _origin_is_india(value)

    # PROBLEM 5. An origin declaration was found (that is why we are here),
    # so it decides is_imported.
    if imported_mention and made_in_india:
        evidence["importer_mentioned"] = True
        evidence["origin_conflict"] = True
        is_imported = False if ORIGIN_DECLARATION_OVERRIDES_IMPORTER else None
    elif imported_mention:
        # Both signals agree: non-Indian origin AND an importer named.
        evidence["importer_mentioned"] = True
        is_imported = True
    else:
        is_imported = not made_in_india

    return evidence, is_imported


def extract_country_of_origin(lines: List[OCRLine]):
    """Returns (evidence, is_imported) - is_imported is None when we can't tell."""
    imported_mention = any(_IMPORTED_BY.search(line.text) for line in lines)

    for i, line, m in _find_lines_matching(lines, _ORIGIN_PATTERN):
        value = next((g.strip(" .,") for g in m.groups() if g and g.strip(" .,")), "")
        # P1 (tiny change, strictly required): _ORIGIN_PATTERN's separator
        # `[:\-]?` is optional and `\s*` can consume nothing, so `(.+)` on a
        # STANDALONE label line "Country of Origin:" captures the colon
        # itself and returns value=":". That same-line match then returned
        # before the label-only/next-line fallback below ever ran, making
        # the valid same-image association
        #     IMAGE 1: Country of Origin:
        #     IMAGE 1: INDIA
        # unreachable. P1's invariant has a positive half - a same-image
        # label->value pair MUST still resolve - so this had to be fixed for
        # the P1 work to be correct rather than merely restrictive.
        # Requiring a letter in the capture is the smallest safe filter: no
        # country name lacks one, and it changes nothing for any line that
        # actually carries a value.
        if not re.search(r"[A-Za-z]", value):
            continue
        if not value:
            continue
        return _origin_evidence(line, i, lines, value, line.text, imported_mention)

    # Fuzzy fallback: a standalone (possibly OCR-corrupted) label line with
    # the value on the next line, same shape as the manufacturer fallback.
    for i, line in enumerate(lines):
        exact_label = bool(_ORIGIN_LABEL_ONLY.search(line.text))
        if not (exact_label or _fuzzy_label_match(line.text, _ORIGIN_LABEL_KEYWORDS)):
            continue
        # PROBLEM 1: image-bounded, as above.
        for j, candidate_line in _following_lines(lines, i, 2):
            if not _readable(candidate_line):
                continue
            value = candidate_line.text.strip(" .,")
            # A country name is words. Same floor as the manufacturer path:
            # without it, a stray "I" off a noisy Monaco line was reported as
            # the country of origin.
            if len(re.findall(r"[A-Za-z]", value)) < 3:
                continue
            evidence, is_imported = _origin_evidence(
                candidate_line, j, lines, value, f"{line.text} {value}", imported_mention
            )
            evidence["label_match"] = "exact" if exact_label else "fuzzy"
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