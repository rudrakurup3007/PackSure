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

from .ocr_engine import OCRLine, _COLUMN_GAP_RATIO

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


# --------------------------------------------------------------------------
# Geometric label -> value pairing
# --------------------------------------------------------------------------
# Until now, "the value belonging to this label" meant "the next line in the
# list". That is only true for a single-column layout. Indian packaging
# routinely prints a declarations TABLE - labels stacked in a left column,
# values in a right column - and after line assembly those become separate
# OCRLines whose list order interleaves by y-coordinate:
#
#     MFG. DATE:        31JUL2026          list order:  MFG. DATE:
#     BATCH NO.:        K26G69149                       31JUL2026
#     USE BY            30JAN2027                       BATCH NO.:
#                                                       K26G69149  ...
#
# List adjacency happens to work there, but only by luck of the y-sort; on
# any pack where the two columns are vertically offset it pairs each label
# with the wrong row's value. And a label whose value sits to its RIGHT is
# invisible to a "next line" search whenever another row intervenes.
#
# The bounding boxes needed to do this properly were already being carried
# on every OCRLine and simply thrown away. These helpers use them: a label's
# value is the line that is either
#   (a) on the same visual ROW and to the right of it, or
#   (b) directly BELOW it and horizontally aligned with it,
# whichever is geometrically closer, measured in units of text height so the
# thresholds are resolution-independent.
#
# When geometry yields nothing confident - degenerate or missing boxes, or a
# label with no plausible neighbour - the search falls back to the previous
# list-order behaviour, so this can only add associations, never remove ones
# that already worked.

# All expressed as multiples of the larger of the two lines' text heights.
_ROW_ALIGN_RATIO = 0.6      # vertical centre offset still counting as "same row"
_MAX_RIGHT_GAP_RATIO = 4.0  # how far right a value may sit from its label
_MAX_BELOW_GAP_RATIO = 2.0  # how far below (tighter: rows stack closely)
_EDGE_TOLERANCE_RATIO = 0.25


def _geometric_value_candidates(lines: List[OCRLine], idx: int, limit: int):
    """Lines that could plausibly be the value for the label at `idx`,
    nearest first. Image-bounded (P1) via _image_bounds."""
    if not lines:
        return []
    start, end = _image_bounds(lines, idx)
    label = lines[idx]
    lx0, ly0, lx1, ly1 = label.bbox
    label_h = max(1, ly1 - ly0)
    label_cy = (ly0 + ly1) / 2.0

    scored = []
    for j in range(start, end):
        if j == idx:
            continue
        cand = lines[j]
        cx0, cy0, cx1, cy1 = cand.bbox
        cand_h = max(1, cy1 - cy0)
        h = float(max(label_h, cand_h))
        edge = _EDGE_TOLERANCE_RATIO * h

        # (a) same row, to the right - the table-row case.
        if cx0 >= lx1 - edge and abs((cy0 + cy1) / 2.0 - label_cy) <= _ROW_ALIGN_RATIO * h:
            gap = (cx0 - lx1) / h
            if gap <= _MAX_RIGHT_GAP_RATIO:
                # direction 0 sorts before 1, so a same-row value wins an
                # exact tie against one below - a label reads rightward first.
                scored.append((round(gap, 3), 0, j))
                continue

        # (b) below and horizontally aligned - the stacked-label case.
        if cy0 >= ly1 - edge:
            overlaps = min(cx1, lx1) - max(cx0, lx0) > 0
            left_aligned = abs(cx0 - lx0) <= h
            if overlaps or left_aligned:
                gap = (cy0 - ly1) / h
                if gap <= _MAX_BELOW_GAP_RATIO:
                    scored.append((round(gap, 3), 1, j))

    scored.sort()
    return [(j, lines[j]) for _, _, j in scored[:limit]]


def _has_usable_geometry(lines: List[OCRLine], idx: int) -> bool:
    """True when the lines around `idx` carry real, distinguishable boxes.

    Callers that construct OCRLines without meaningful geometry (fixtures,
    a future OCR backend that does not report boxes, an upstream stage that
    stubs them) leave every box identical. Geometry cannot decide anything
    there, so those callers keep the old list-order behaviour.
    """
    start, end = _image_bounds(lines, idx)
    reference = lines[idx].bbox
    return any(lines[j].bbox != reference for j in range(start, end) if j != idx)


def _value_candidates(lines: List[OCRLine], idx: int, count: int):
    """Ordered (index, line) pairs to try as the value for a label line.

    When the boxes are real, geometry is AUTHORITATIVE - including its
    negative answer. An earlier version fell back to list order whenever
    geometry returned nothing, which quietly defeated the distance limits:
    a label at the top of the pack would still be paired with an unrelated
    line far below it, exactly the association this was written to stop.
    The fallback now applies only when there is no geometry to reason with.
    """
    if _has_usable_geometry(lines, idx):
        return _geometric_value_candidates(lines, idx, limit=count)
    return list(_following_lines(lines, idx, count))


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
        for j, candidate_line in _value_candidates(lines, i, 5):
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
    # --- snacks / namkeen ---
    "snack", "snacks", "namkeen", "bhel", "bhelpuri", "chips", "wafers",
    "mixture", "sev", "chivda", "papad", "papadum", "bhujia", "murukku",
    "khakhra", "mathri", "chakli", "farsan", "nachos", "popcorn", "makhana",
    "puffs", "kurkure", "fryums",
    # --- nuts / dry fruit ---
    "nuts", "cashew", "cashews", "almond", "almonds", "pistachio", "raisin",
    "raisins", "walnut", "walnuts", "peanut", "peanuts", "dryfruit",
    # --- bakery / cereal ---
    "biscuit", "biscuits", "cookie", "cookies", "cracker", "crackers",
    "bread", "bun", "rusk", "toast", "cake", "pastry", "muffin", "cereal",
    "cornflakes", "oats", "muesli", "granola", "noodles", "pasta", "macaroni",
    "vermicelli", "seviyan", "thepla", "roti", "chapati", "paratha", "khari",
    # --- staples ---
    "atta", "flour", "maida", "sooji", "suji", "rava", "besan", "rice",
    "basmati", "poha", "dal", "daal", "pulses", "lentil", "lentils", "chana",
    "rajma", "sugar", "jaggery", "gur", "salt", "sabudana", "millet", "ragi",
    # --- dairy / beverages ---
    "milk", "curd", "dahi", "yoghurt", "yogurt", "paneer", "butter", "ghee",
    "cheese", "cream", "lassi", "buttermilk", "tea", "coffee", "juice",
    "beverage", "drink", "squash", "syrup", "water", "soda", "cocoa",
    # --- condiments / cooking ---
    "oil", "masala", "spice", "spices", "haldi", "turmeric", "chilli",
    "jeera", "dhania", "pickle", "achar", "chutney", "sauce", "ketchup",
    "vinegar", "jam", "honey", "powder", "paste", "seasoning", "mix",
    # --- confectionery ---
    "chocolate", "candy", "toffee", "lollipop", "sweets", "mithai", "barfi",
    "laddu", "halwa", "papdi", "soanpapdi", "gulab", "jamun", "icecream",
    "dessert", "wafer",
    # --- ready to eat / frozen ---
    "curry", "gravy", "soup", "instant", "readytoeat", "frozen", "pizza",
    "samosa", "nugget", "nuggets", "patty",
    # --- personal / home care (non-food packaged commodities) ---
    "soap", "detergent", "powder", "liquid", "shampoo", "conditioner",
    "toothpaste", "toothbrush", "handwash", "sanitizer", "lotion", "moisturiser",
    "moisturizer", "talc", "deodorant", "perfume", "bar", "gel", "wash",
    "cleaner", "phenyl", "freshener", "incense", "agarbatti", "dhoop",
    "tissue", "napkin", "diaper", "wipes",
}

# Descriptor tokens short enough that a fuzzy match would be unsafe are
# required to match exactly. At four characters or fewer a single edit turns
# one real word into another ("salt"/"malt", "rice"/"ride", "oil"/"oik"), so
# fuzziness there buys recall at the cost of nonsense.
_MIN_FUZZY_DESCRIPTOR_LEN = 5

_LONG_DESCRIPTORS = sorted(d for d in _COMMODITY_DESCRIPTORS
                           if len(d) >= _MIN_FUZZY_DESCRIPTOR_LEN)

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


def _is_subsequence(short: str, long_word: str) -> bool:
    """True when `short` is `long_word` with characters removed, in order."""
    it = iter(long_word)
    return all(ch in it for ch in short)


def _match_descriptor(token: str) -> Optional[str]:
    """Returns the vocabulary word a token represents, or None.

    Exact match first, then a bounded edit-distance match for longer words.
    OCR garbles descriptor words constantly - "namkeen" comes back as
    "namkeeh", "bhelpuri" as "bhelpunri", "biscuits" as "biscults",
    "snack" as "snak" - and an exact-only lookup fails on precisely the
    packs where it is most needed. This is the same tolerance already
    applied to units (_normalize_unit_fuzzy) and labels
    (_fuzzy_label_match), for the same reason.

    The edit budget scales with word length so that a short word cannot be
    stretched into a different one: one edit for 5-7 characters, two for
    8 or more.
    """
    if token in _COMMODITY_DESCRIPTORS:
        return token
    if len(token) < _MIN_FUZZY_DESCRIPTOR_LEN:
        # Below the fuzzy floor, allow ONE specific correction: a dropped
        # character. "snak" -> "snack", "chps" -> "chips". A dropped letter
        # is the single most common OCR failure on small print, and because
        # the token must be a subsequence of a LONGER vocabulary word it
        # cannot turn one real word into another: "care" and "cake" are the
        # same length, so this rule never relates them. Substitutions in
        # short tokens ("nufs" for "nuts") stay unmatched - correcting those
        # safely is not possible at four characters.
        if len(token) >= 4:
            for word in _LONG_DESCRIPTORS:
                if len(word) == len(token) + 1 and _is_subsequence(token, word):
                    return word
        return None

    budget = 1 if len(token) <= 7 else 2
    for word in _LONG_DESCRIPTORS:
        # Cheap length prefilter before the O(n*m) distance computation.
        if abs(len(word) - len(token)) > budget:
            continue
        if _levenshtein(token, word) <= budget:
            return word
    return None


def _descriptor_score(text: str) -> int:
    """Number of distinct commodity descriptor words present in a line."""
    matched = set()
    for token in set(re.findall(r"[a-z]+", text.lower())):
        word = _match_descriptor(token)
        if word:
            matched.add(word)
    return len(matched)


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
        for j, candidate in _value_candidates(lines, i, 2):
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

    return _visually_prominent_name(lines)


# --------------------------------------------------------------------------
# Tier 3: visual prominence
# --------------------------------------------------------------------------
# Tiers 1 and 2 both need the pack to SAY something: a label, or a word in
# the commodity vocabulary. Plenty of packs do neither. "PINEAPPLE DELIGHT"
# across the front of a juice carton is the product name to every human who
# looks at it, but it carries no label and "delight" is not a commodity
# noun, so both tiers return nothing and the field comes back null.
#
# This tier is deliberately quarantined from the two above. It reads font
# size (via box height) and position, which extract_common_name's own
# contract otherwise forbids, so everything it produces is marked
# inferred=True and must reach the reviewer as REVIEW, never PASS. It is a
# reading aid, not a declaration.

# --------------------------------------------------------------------------
# Scoring weights. Every geometric feature is normalised against the panel
# itself (median text height, the image's own extent), never against a pixel
# constant, so the same weights hold across resolutions and camera distances.
_W_FONT_SIZE = 3.0            # relative height - the strongest single signal
_W_POSITION = 1.0            # prominence of the region it sits in
_W_CONFIDENCE = 0.8          # supporting only; never decides on its own
_W_SEMANTIC = 2.5            # names a commodity -> product name, not brand
_W_LENGTH = 0.8              # short phrase, not a sentence
_W_FRONT_PANEL = 1.2         # front-facing panel over a dense back panel
_W_REPEAT = 0.6              # same text seen on more than one panel
_P_NUMERIC = 2.0             # digit-heavy
_P_SYMBOL = 1.5              # symbol-heavy
_P_SENTENCE = 2.5            # sentence-like structure
_P_INGREDIENT = 2.5          # comma-separated list
_P_MARKETING = 3.0           # claims and promotional copy

_PROMINENCE_RATIO = 1.25      # floor: below this it is body text, not a name
_MIN_PROMINENT_CHARS = 3
_MAX_PROMINENT_CHARS = 45
_MIN_PROMINENT_CONFIDENCE = 0.55
_MIN_NAME_SCORE = 2.0         # below this, return null rather than guess
_LINE_JOIN_HEIGHT_TOLERANCE = 0.25   # heights within 25% belong to one phrase
_LINE_JOIN_GAP_RATIO = 0.8           # vertical gap, as a multiple of height

# Large text that is emphatically NOT the product name. Marketing claims and
# certifications are printed at display size precisely to be noticed, so
# height alone would rank them first on a lot of packs.
_MARKETING_CLAIM = re.compile(
    r"\b(new|free|now|save|offer|combo|extra|more|best|premium|special|"
    r"original|classic|pure|natural|fresh|organic|no\s+added|sugar\s*free|"
    r"gluten\s*free|low\s*fat|fat\s*free|rich\s+in|made\s+with|goodness|"
    r"enriched|fortified|\d+\s*%|buy\s*\d|push\s*straw|tear\s+here|"
    r"open\s+here|shake\s+well|serve\s+chilled|keep\s+refrigerated)\b",
    re.IGNORECASE,
)

# HARD EXCLUSIONS - a candidate matching any of these is never scored.
# Regulatory declarations, contact details, codes, prices, dates.
_NAME_EXCLUSION = re.compile(
    r"\b(ingredients?|directions?|warning|caution|dosage|composition|"
    r"storage|nutrition(?:al)?\s*(?:facts|information)?|allergen|"
    r"manufactured|marketed|packed\s*by|imported|distributed|"
    r"net\s*(?:wt|weight|qty|quantity)|m\.?r\.?p|maximum\s+retail|"
    r"batch|lot\s*no|mfg|mfd|exp(?:iry)?|best\s*before|use\s*by|"
    r"fssai|licence|license|gstin|customer\s*care|consumer\s*care)\b"
    r"|[\w.+-]+@[\w-]+\.\w+"                       # email
    r"|\b(?:www\.|https?://)\S+"                    # website
    r"|\b\d{6}\b"                                   # PIN code
    r"|\+?\d[\d\s\-]{8,}\d"                        # phone
    r"|\b\d{8,}\b"                                  # barcode / licence digits
    r"|\b(?:rs\.?|inr|₹)\s*[\d,]+"                  # price
    r"|\b\d+(?:\.\d+)?\s*(?:g|gm|kg|mg|ml|l|ltr)\b"  # quantity
    r"|\b\d{1,2}\s*[/\-.]\s*\d{1,2}\s*[/\-.]\s*\d{2,4}\b",   # date
    re.IGNORECASE,
)

# Instruction copy: "Store in a cool dry place", "Shake well before use".
_INSTRUCTION_OPENER = re.compile(
    r"^(use|apply|store|mix|shake|take|keep|refrigerate|consume|serve|"
    r"dissolve|add|pour|wash|rinse|dispose|read|see)\b",
    re.IGNORECASE,
)

# Sentence-like structure: function words that belong to prose, not to a
# name. "Store in a cool and dry place" has three; "Almond Milk" has none.
_SENTENCE_MARKER = re.compile(
    r"\b(in|on|at|for|with|from|and|or|the|a|an|of|to|be|is|are|not|"
    r"before|after|per|may|should|must|do|does)\b",
    re.IGNORECASE,
)

# A random alphanumeric run (BATCH A7F29X, SP7919H27D26): letters and digits
# interleaved inside one token, with no vowel pattern of a real word.
_CODE_TOKEN = re.compile(r"^(?=\S*\d)(?=\S*[A-Za-z])[A-Za-z0-9]{5,}$")


def _normalise_name(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _join_connected_lines(lines: List[OCRLine]) -> List[OCRLine]:
    """Combines OCR boxes that form ONE visually connected phrase.

    A two-line product name ("PINEAPPLE" above "DELIGHT", or a brand set
    over its descriptor) arrives as separate OCRLines. Classified
    separately, each half is a weaker candidate than the whole, and the
    returned value is half a name.

    Joined only when the lines are set in the SAME SIZE (heights within
    _LINE_JOIN_HEIGHT_TOLERANCE), sit within _LINE_JOIN_GAP_RATIO of a text
    height of each other, overlap horizontally, and share an image - i.e.
    they are typographically one block. A descriptor set smaller than the
    brand above it is a different size and stays a separate candidate,
    which is what lets the brand-vs-name rule below see both.
    """
    joined: List[OCRLine] = []
    for line in sorted(lines, key=lambda l: (l.image_index, l.bbox[1], l.bbox[0])):
        host = joined[-1] if joined else None
        if host is not None and host.image_index == line.image_index:
            h_host, h_line = _text_height(host), _text_height(line)
            similar = abs(h_host - h_line) <= _LINE_JOIN_HEIGHT_TOLERANCE * max(h_host, h_line)
            gap = line.bbox[1] - host.bbox[3]
            close = -h_line <= gap <= _LINE_JOIN_GAP_RATIO * min(h_host, h_line)
            overlapping = min(host.bbox[2], line.bbox[2]) > max(host.bbox[0], line.bbox[0])
            if similar and close and overlapping:
                confidences = [c for c in (host.confidence, line.confidence)
                               if c is not None]
                joined[-1] = OCRLine(
                    text=f"{host.text} {line.text}",
                    bbox=[min(host.bbox[0], line.bbox[0]), min(host.bbox[1], line.bbox[1]),
                          max(host.bbox[2], line.bbox[2]), max(host.bbox[3], line.bbox[3])],
                    confidence=round(sum(confidences) / len(confidences), 3)
                    if confidences else None,
                    image_index=host.image_index,
                    words=list(host.words) + list(line.words),
                    row_index=host.row_index,
                    column_index=host.column_index,
                )
                continue
        joined.append(line)
    return joined


def _panel_prominence(lines: List[OCRLine]) -> dict:
    """Per-image score for "this looks like the front panel": tall text and
    little regulatory copy. A back panel is dense small print."""
    by_image: dict = {}
    for line in lines:
        by_image.setdefault(line.image_index, []).append(line)
    scores = {}
    for image_index, group in by_image.items():
        heights = sorted(_text_height(l) for l in group)
        median = heights[len(heights) // 2] or 1
        tallest = heights[-1] / median
        regulatory = sum(1 for l in group if _NAME_EXCLUSION.search(l.text))
        density = regulatory / max(1, len(group))
        scores[image_index] = tallest * (1.0 - density)
    top = max(scores.values()) if scores else 1.0
    return {k: v / top for k, v in scores.items()} if top else scores


def _name_candidate_score(line: OCRLine, text: str, median_height: float,
                          bounds: tuple, panel: float, repeats: int) -> Optional[dict]:
    """Scores one candidate. Returns None for a hard exclusion, otherwise a
    breakdown dict - the per-feature values are what the debug log prints."""
    if not (_MIN_PROMINENT_CHARS <= len(text) <= _MAX_PROMINENT_CHARS):
        return None
    confidence = line.confidence if line.confidence is not None else 0.0
    if confidence < _MIN_PROMINENT_CONFIDENCE:
        return None
    # Strict label patterns only, NOT _is_known_label: that one falls back
    # to fuzzy matching, which scored the brand "MONSTER" as a declaration
    # label and excluded it before it could be ranked. Fuzzy matching earns
    # its place when recovering a corrupted label; used as an exclusion it
    # silently deletes brand names.
    if any(pattern.search(text) for pattern in _ANY_LABEL_PATTERNS):
        return None
    if _NAME_EXCLUSION.search(text):
        return None
    if _INSTRUCTION_OPENER.search(text):
        return None
    # Marketing copy is excluded outright when it names no commodity at
    # all: "50% MORE FREE" set across the front of a pack is display text
    # with nothing behind it, and a penalty alone still let it through on
    # packs where it was the only large text. When the phrase DOES carry a
    # descriptor ("RICH IN CALCIUM ALMOND MILK"), it stays a candidate and
    # takes the penalty instead, per the promotional-text rule.
    if _MARKETING_CLAIM.search(text) and not _descriptor_score(text):
        return None
    if all(_CODE_TOKEN.match(t) for t in text.split()):
        return None
    letters = sum(c.isalpha() for c in text)
    if letters < max(_MIN_PROMINENT_CHARS, len(text.replace(" ", "")) * 0.5):
        return None

    ratio = _text_height(line) / median_height
    if ratio < _PROMINENCE_RATIO:
        return None

    x0, y0, x1, y1 = bounds
    width = max(1, x1 - x0)
    height = max(1, y1 - y0)
    x_centre = ((line.bbox[0] + line.bbox[2]) / 2 - x0) / width
    y_centre = ((line.bbox[1] + line.bbox[3]) / 2 - y0) / height
    # Prominent regions, NOT "must be centred": horizontal centrality counts
    # for more than vertical position, and the vertical term only mildly
    # prefers the upper-middle band, so a name set low on the pack is not
    # ruled out. Position is a weighted feature, never a hard rule.
    position = (1.0 - abs(x_centre - 0.5) * 2) * 0.7 + (1.0 - abs(y_centre - 0.4)) * 0.3

    body = text.replace(" ", "")
    digits = sum(c.isdigit() for c in body) / max(1, len(body))
    symbols = sum(not c.isalnum() for c in body) / max(1, len(body))
    words = text.split()
    sentence_markers = len(_SENTENCE_MARKER.findall(text)) / max(1, len(words))
    commas = text.count(",")

    # Short phrase, not one word and not a paragraph: peaks around 2-3 words.
    length = 1.0 - min(1.0, abs(len(words) - 2.5) / 4.0)

    score = (
        _W_FONT_SIZE * min(ratio / 3.0, 1.0)
        + _W_POSITION * max(0.0, position)
        + _W_CONFIDENCE * confidence
        + _W_SEMANTIC * min(1.0, _descriptor_score(text) / 2.0)
        + _W_LENGTH * length
        + _W_FRONT_PANEL * panel
        + _W_REPEAT * (1.0 if repeats > 1 else 0.0)
        - _P_NUMERIC * digits
        - _P_SYMBOL * symbols
        - _P_SENTENCE * min(1.0, sentence_markers * 2)
        - _P_INGREDIENT * min(1.0, commas / 3.0)
        - _P_MARKETING * (1.0 if _MARKETING_CLAIM.search(text) else 0.0)
    )
    return {
        "text": text, "final_score": round(score, 3),
        "font_score": round(min(ratio / 3.0, 1.0), 3),
        "position_score": round(max(0.0, position), 3),
        "confidence_score": round(confidence, 3),
        "semantic_score": round(min(1.0, _descriptor_score(text) / 2.0), 3),
        "length_score": round(length, 3),
        "front_panel_score": round(panel, 3),
        "numeric_penalty": round(digits, 3),
        "symbol_penalty": round(symbols, 3),
        "sentence_penalty": round(min(1.0, sentence_markers * 2), 3),
        "prominence_ratio": round(ratio, 2),
        "descriptors": _descriptor_score(text),
    }


def rank_product_name_candidates(lines: List[OCRLine]) -> List[dict]:
    """Public for debugging: the ranked candidate list with the per-feature
    breakdown, highest first. Log this, do not return it through the API."""
    joined = _join_connected_lines([l for l in lines
                                    if l.text.strip() and _readable(l)])
    if len(joined) < 2:
        return []

    # Baseline is the 25th percentile, not the median. Most text on a pack
    # is small print, so the lower quartile IS the body-text height - while
    # a median taken over a panel with only a handful of detections is set
    # by the name itself, which then cannot possibly exceed it. That is why
    # a large "Vitamin B12" beside one small declaration scored a ratio of
    # exactly 1.0 and was rejected as body text.
    heights = sorted(_text_height(l) for l in joined)
    median_height = heights[int(len(heights) * 0.25)] or 1
    panels = _panel_prominence(joined)

    counts: dict = {}
    for line in joined:
        counts[_normalise_name(line.text)] = counts.get(_normalise_name(line.text), 0) + 1

    scored = []
    for i, line in enumerate(joined):
        text = line.text.strip(" .,:-")
        start, end = _image_bounds(joined, i)
        page = joined[start:end]
        bounds = (min(l.bbox[0] for l in page), min(l.bbox[1] for l in page),
                  max(l.bbox[2] for l in page), max(l.bbox[3] for l in page))
        entry = _name_candidate_score(
            line, text, median_height, bounds,
            panels.get(line.image_index, 0.0),
            counts.get(_normalise_name(line.text), 1))
        if entry is None:
            continue
        entry["line"] = line
        entry["index"] = i
        scored.append(entry)

    scored.sort(key=lambda e: e["final_score"], reverse=True)
    return scored


def _visually_prominent_name(lines: List[OCRLine]) -> dict:
    ranked = rank_product_name_candidates(lines)
    if not ranked:
        return _empty_evidence()

    best = ranked[0]
    # BRAND vs PRODUCT NAME. The tallest text on a pack is usually the
    # brand; the product descriptor is set below it, smaller. So when a
    # lower-ranked candidate actually NAMES a commodity and the winner does
    # not, the descriptor is the common name and the winner is the brand.
    # Bounded: the challenger must still be a real candidate in its own
    # right (within half the leader's score), so this cannot promote a
    # scrap of body text over a genuine name.
    if not best["descriptors"]:
        for other in ranked[1:]:
            if other["descriptors"] and other["final_score"] >= best["final_score"] * 0.5:
                best = other
                break

    if best["final_score"] < _MIN_NAME_SCORE:
        return _empty_evidence()

    line, i = best["line"], best["index"]
    evidence = _base_evidence(line, best["text"], line.text,
                              _context_window(lines, min(i, len(lines) - 1)))
    evidence["match_method"] = "visual_prominence"
    evidence["partial"] = True
    # Read off the pack's typography, not off a declaration. See the module
    # comment above and schemas.DeclarationField.inferred.
    evidence["inferred"] = True
    evidence["prominence_ratio"] = best["prominence_ratio"]
    evidence["name_score"] = best["final_score"]
    return evidence


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

# FIX (Monster 350ml can): the separator class allowed ":" and "-" but not
# a full stop, and this can prints the declaration as "NET QUANTITY." with a
# period. Neither the labelled nor the label-only pattern matched, so the
# label was invisible and extraction fell through to the unlabelled scan -
# which returned "105 mg" out of the caffeine warning at the top of the
# panel. A trailing "." after a declaration label is punctuation, not a
# different label.
_NET_QTY_LABELLED_PATTERN = re.compile(
    r"(?:net\s*(?:wt\.?|weight|qty\.?|quantity|contents)|(?:\bqty\.?|\bquantity))"
    r"\s*[:\-.]?\s*"
    r"([\d]+(?:\.\d+)?)\s*"
    r"([a-zA-Z\.]+)?",
    re.IGNORECASE,
)
_QTY_LABEL_ONLY = re.compile(
    r"(?:net\s*(?:wt\.?|weight|qty\.?|quantity|contents)|(?:\bqty\.?|\bquantity))\s*[:\-.]?\s*$",
    re.IGNORECASE,
)
_GROSS_WEIGHT = re.compile(r"\bgross\b", re.IGNORECASE)
# A number+unit sitting inside an ingredients list, a nutrition table or a
# consumption warning is never the net quantity - it is a per-serving or
# per-100ml figure, or a daily limit. Without this guard the UNLABELLED
# fallback returns the first such number on the panel, which on any
# caffeinated drink is the caffeine warning ("HIGH CAFFEINE (105 mg/350
# ml)") long before the real declaration at the foot of the label.
#
# This only ever REJECTS candidates, so the worst case is a null quantity
# routed to REVIEW - never a wrong one reported as a pass.
_QTY_FALSE_CONTEXT = re.compile(
    r"\b(model|android|lte|wifi|wi-fi|network|version"
    r"|ingredients?|nutrition(?:al)?|caffeine|serving|servings|rda"
    r"|per\s*\d+\s*(?:g|ml)|energy|protein|carbohydrate|sugars?|sodium"
    r"|cholesterol|taurine|vitamin|niacin|preservatives?|sweeteners?"
    r"|flavou?rs?|regulators?|not\s+more\s+than|per\s+day|kcal|ppm)\b",
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
        for next_idx, nxt in _value_candidates(lines, i, 2):
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

# A price with a UNIT attached to it is a unit sale price by construction:
# "Rs.0.36/ml", "Rs 0.111/ml", "₹2.50 per 100 g". The MRP is the price of
# the pack, so it never carries a per-unit denominator. That structural
# difference is available even when neither declaration is labelled, which
# on inkjet-coded packs is common - "USP" is exactly the three characters a
# dot-matrix coder most often loses.
#
# "/-" (Rs.125/-, the Indian "and no paise" marker) is deliberately NOT a
# unit: the group after the slash must be a real quantity unit, so
# "Rs.125/-" can never be read as a per-unit price.
_PER_UNIT_PRICE_PATTERN = re.compile(
    r"(rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,3})?)\s*"
    r"(?:/|per\s+)\s*"
    r"(?:\d+\s*)?"
    r"(g|gm|gms|gram|grams|kg|mg|ml|l|ltr|litre|liter|cl|pc|pcs|piece|unit)\b",
    re.IGNORECASE,
)
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

# "MAX RETAIL PRICE" (found on a real Bikaji sticker) was not covered - the
# pattern only accepted the fully spelled "maximum". Both abbreviations are
# common on Indian packaging, and this gap affected extract_mrp itself, not
# just the column matcher that surfaced it.
_MRP_LABEL_PATTERN = re.compile(
    r"(?:mrp|m\.r\.p\.?|max(?:imum)?\.?\s+retail\s+price)", re.IGNORECASE
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
            # An UNLABELLED price carrying a unit denominator ("Rs.0.36/ml")
            # is a unit sale price, not the MRP - the MRP prices the pack,
            # so it never has a per-unit denominator. Without this, a can
            # whose "USP" label was lost to a dot-matrix coder reported its
            # per-millilitre price as the maximum retail price: a Rs.125 can
            # declared at Rs.0.36. _PER_UNIT_PRICE_PATTERN treats "/-" as
            # punctuation rather than a unit, so "Rs.125/-" is unaffected.
            per_unit = _PER_UNIT_PRICE_PATTERN.search(text)
            if per_unit and per_unit.group(2) == m2.group(1):
                continue
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
    r"|\d{1,2}\s*[/\-.]{1,2}\s*\d{1,2}\s*[/\-.]{1,2}\s*\d{2,4}"                   # D/M/Y numeric
    r"|\d{4}\s*[/\-.]{1,2}\s*\d{1,2}\s*[/\-.]{1,2}\s*\d{1,2}"                     # Y/M/D numeric (ISO-ish)
    r")\b",
    re.IGNORECASE,
)


# FIX (found on the Pineapple Delight carton): inkjet/dot-matrix coders
# print the year separator as a slash immediately followed by the hyphen
# that ends the field, and OCR reads both - "27/04/-26", "23/10/-26". The
# numeric branches above allowed exactly ONE separator character between
# parts, so neither the candidate regex nor dateutil saw a date at all and
# BOTH dates on the pack came back null. That is not a parsing near-miss:
# it silently fails PCR-R05 and PCR-R08 on every pack printed by that
# class of coder.
#
# Collapsing a run of separators to its first character is safe in a way
# that repairing a DIGIT would not be: no character is invented and no
# reading is chosen between alternatives - "27/04/-26" has only one
# possible date in it. A misread digit ("23/40/26" for 23/10/26, the 1
# read as a 4 on the same pack) is a different problem entirely and is
# deliberately NOT touched here; it stays unparseable rather than being
# guessed into a plausible month.
_DATE_SEPARATOR_RUN = re.compile(r"([/\-.])[/\-.]+")


def _clean_date_candidate(candidate: str) -> str:
    return _DATE_SEPARATOR_RUN.sub(r"\1", candidate).strip()


def _try_parse_date(candidate: str):
    """Stage 2: delegate the actual date interpretation to dateutil rather
    than a regex. Returns a datetime on success, None on anything that isn't
    really a date (dateutil raises instead of guessing)."""
    try:
        return dateutil_parser.parse(candidate, fuzzy=True, dayfirst=True)
    except (ValueError, OverflowError, TypeError):
        pass
    cleaned = _clean_date_candidate(candidate)
    if cleaned == candidate:
        return None
    try:
        return dateutil_parser.parse(cleaned, fuzzy=True, dayfirst=True)
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

    for _, nxt in _value_candidates(lines, line_idx, lookahead):
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
            date_text = _clean_date_candidate(m.group(1).strip())
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

    # FIX (spatial MFD/EXP association): the pass above only looks at a
    # line's OWN text, so a label that sits on its own OCRLine with no date
    # printed on that same line - "MFD." followed by "27-08-26 13:46" on a
    # separate physical line, or a right-column value that never got pulled
    # onto the label's line by merge_label_value_columns (e.g. because the
    # rest of the block didn't validate as a clean table) - was invisible to
    # it. This does NOT fall back to "the next line in the list": it goes
    # through _value_candidates, the same geometry-first (same-row-right,
    # then below-and-aligned, image-bounded) search net_quantity and the
    # other label->value fields already use, and only falls back to list
    # order when no real geometry is available (fixtures, degenerate boxes).
    # A candidate line is only trusted if the SAME broad date-shape +
    # dateutil validation used above accepts it, so this cannot invent a
    # date any more than the same-line path can.
    for i, line in enumerate(lines):
        if _DATE_CANDIDATE_PATTERN.search(line.text):
            continue  # already has its own date; the pass above handles it
        if _MFG_KEYWORDS.search(line.text):
            role = "manufacturing"
        elif _EXP_KEYWORDS.search(line.text):
            role = "best_before_use_by"
        else:
            continue

        for j, cand in _value_candidates(lines, i, 3):
            cand_text = cand.text.strip()
            if not cand_text:
                continue
            # A candidate that is itself another label - MFG/EXP or one of
            # the other declarations - with no date on it means the search
            # has walked off this label's value onto the next row/field;
            # stop rather than reach past it (same rule as the duration
            # lookahead above).
            if not _DATE_CANDIDATE_PATTERN.search(cand_text) and (
                _MFG_KEYWORDS.search(cand_text)
                or _EXP_KEYWORDS.search(cand_text)
                or _OTHER_DECLARATION_AFTER_LABEL.search(cand_text)
            ):
                break

            found_date = False
            for m in _DATE_CANDIDATE_PATTERN.finditer(cand_text):
                date_text = m.group(1).strip()
                if _looks_like_phone_fragment(cand_text, date_text):
                    continue
                parsed = _try_parse_date(date_text)
                if parsed is None:
                    continue
                found_date = True

                # The same physical date may already be sitting in `found`
                # with role "unclear" - the flat same-line pass above has no
                # notion of columns, so it can see this exact date/label pair
                # as unrelated lines and fail to classify a role for it. Now
                # that spatial association HAS confirmed which label this
                # date belongs to, upgrade that entry in place rather than
                # adding a second, differently-roled record of the same date
                # that the first-match-wins selection below would never see.
                upgraded = False
                for existing in found:
                    if (existing["image_index"] == cand.image_index
                            and existing["value"] == date_text
                            and existing["date_role"] == "unclear"):
                        existing["date_role"] = role
                        seen.discard((cand.image_index, date_text, "unclear"))
                        seen.add((cand.image_index, date_text, role))
                        upgraded = True
                        break
                if upgraded:
                    continue

                key = (cand.image_index, date_text, role)
                if key in seen:
                    continue
                seen.add(key)
                evidence = _base_evidence(
                    cand, date_text, cand_text, _context_window(lines, j)
                )
                evidence["date_role"] = role
                evidence["parsed_date"] = parsed.date().isoformat()
                found.append(evidence)
            if found_date:
                break  # nearest candidate that actually carries a date wins

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

    return _assign_roles_by_chronology(dates, mfg_evidence, exp_evidence)


# Two dates, neither anchored to an MFG/EXP keyword - which happens whenever
# a dot-matrix coder loses the label but keeps the digits. Chronology
# resolves it: a pack is manufactured before it expires, so of two dates the
# earlier is the manufacturing date and the later is the expiry.
#
# This IS an inference, and it is the one rule_engine.py's presence_with_role
# branch explicitly refuses to make on its own ("never infer manufacturing vs
# best_before_use_by here"). So it is made HERE, where the evidence lives,
# and every date it assigns is marked inferred=True so the rule engine can
# route it to REVIEW instead of PASS. The dates are never rewritten - only
# the role is assigned, and only when the pack itself said nothing.
#
# Deliberately narrow:
#   - only when BOTH roles are otherwise unresolved (a pack that labelled
#     one of its dates has told us something, and that always wins)
#   - only for exactly two parseable dates; three or more (a packed date, a
#     best-before and a batch date that parsed) is not a two-way choice
#   - only when the two dates actually differ
def _assign_roles_by_chronology(dates, mfg_evidence, exp_evidence):
    if mfg_evidence.get("date_role") == "manufacturing" or \
            exp_evidence["value"] is not None:
        return mfg_evidence, exp_evidence

    parseable = [d for d in dates if d.get("parsed_date")]
    if len(parseable) != 2:
        return mfg_evidence, exp_evidence
    if any(d.get("date_role") in ("manufacturing", "best_before_use_by")
           for d in parseable):
        return mfg_evidence, exp_evidence

    earlier, later = sorted(parseable, key=lambda d: d["parsed_date"])
    if earlier["parsed_date"] == later["parsed_date"]:
        return mfg_evidence, exp_evidence
    if earlier.get("image_index") != later.get("image_index"):
        return mfg_evidence, exp_evidence  # P1: never reason across images

    earlier = dict(earlier)
    later = dict(later)
    earlier["date_role"] = "manufacturing"
    later["date_role"] = "best_before_use_by"
    earlier["inferred"] = True
    later["inferred"] = True
    earlier["role_source"] = "chronology"
    later["role_source"] = "chronology"
    return earlier, later


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
        for j, candidate_line in _value_candidates(lines, i, 2):
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
    # The label frequently carries the basis unit BEFORE the amount
    # ("USP PER g: 0.45/g", "USP Rs. PER ml 0.111"), which the old
    # `[:\s]*` could not step over - so a cleanly printed USP declaration
    # matched nothing. Also widened to three decimals: unit prices are
    # routinely printed to more precision than an MRP ("Rs 0.111/-ml").
    r"(?:unit\s*sale\s*price|usp)\s*(?:per\s*[a-zA-Z]+)?\s*[:.\s]*"
    r"(rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,3})?)\s*(?:per|/)?\s*([a-zA-Z]+)?",
    re.IGNORECASE,
)


def extract_unit_sale_price(lines: List[OCRLine]) -> dict:
    for i, line, m in _find_lines_matching(lines, _USP_PATTERN):
        currency_sym, amount, unit = m.group(1), m.group(2), m.group(3)
        evidence = _base_evidence(line, amount.replace(",", ""), line.text, _context_window(lines, i))
        evidence["currency"] = CURRENCY_SYMBOLS.get((currency_sym or "").lower(), "INR")
        evidence["unit"] = _norm_unit(unit)
        evidence["match_method"] = "explicit_label"
        return evidence

    # No "USP"/"unit sale price" label anywhere: accept the per-unit price
    # FORM instead. See _PER_UNIT_PRICE_PATTERN - the unit denominator is
    # itself the declaration, not an inference about one.
    for i, line, m in _find_lines_matching(lines, _PER_UNIT_PRICE_PATTERN):
        if _QTY_FALSE_CONTEXT.search(line.text):
            continue  # "TAURINE (400 mg/100 ml)" is not a price
        currency_sym, amount, unit = m.group(1), m.group(2), m.group(3)
        if not _plausible_price_amount(amount.replace(",", "")):
            continue
        evidence = _base_evidence(line, amount.replace(",", ""), line.text,
                                  _context_window(lines, i))
        evidence["currency"] = CURRENCY_SYMBOLS.get((currency_sym or "").lower(), "INR")
        evidence["unit"] = _norm_unit(unit)
        evidence["match_method"] = "per_unit_form"
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

# ==========================================================================
# Two-column label/value table merging
# ==========================================================================
# Indian packs routinely print the variable declarations as two stacked
# columns - labels on the left, values on the right:
#
#     #MRP Rs.          Rs 20.00
#     USP Rs.           Rs 0.111/-ml
#     BATCH NO.         SP7919H27D26
#     MFD.              27/04/26 19:46
#     USE BY.           23/10/26
#
# ocr_engine._split_at_column_gaps correctly separates those into distinct
# OCRLines. Nothing then puts them back together: every extractor in this
# file looks for a label and its value on the SAME line, or on the NEXT
# line. Neither holds here - the value is in the other column, and under
# perspective skew (a photo taken at an angle, or a sticker applied
# slightly crooked) the value's row does not even line up vertically with
# its label's row. On both real packs we have, the value column sits about
# one row higher than the label column.
#
# WHY RANK AND NOT GEOMETRY. Row POSITION is what skew destroys; row ORDER
# is what it preserves. The Nth label belongs to the Nth value however far
# the columns have drifted apart vertically. Pairing by nearest-neighbour
# reports the per-unit price as the MRP on the pack above; pairing by rank
# gets all five rows right.
#
# WHY SYNTHESIZE LINES instead of extracting values here. Emitting a merged
# "label value" OCRLine means extract_mrp, extract_unit_sale_price,
# extract_manufacturing_and_expiry_dates and the rest see the same-line
# shape they already handle, with their own normalisation, role
# classification and context_confirmed logic intact. Extracting values
# directly in this function would mean reimplementing all of that, and the
# reimplementation would drift.
#
# The original label-only and value-only lines are KEPT. A merged line is an
# addition, never a replacement: if a pairing is wrong, the underlying
# evidence is still there for another pass or a context window to use.
#
# FALSE-NEGATIVE BIAS. A wrong pairing produces confidently wrong evidence,
# which is worse than the empty evidence we get today. So a block is merged
# only when its shape is unambiguous - see the three guards in Steps 2-3.

# The union of every label vocabulary already defined in this module. Built
# from the existing patterns rather than a new list, so a label the
# extractors understand is automatically a label this matcher understands.
# The USP label half, split out from _USP_PATTERN so a label-only line in a
# column ("USP Rs.", "USP PER g:") is recognised on its own.
_USP_LABEL_ONLY = re.compile(
    r"\busp\b|unit\s*sale\s*price|price\s*per\s*(?:g|ml|kg|l)\b",
    re.IGNORECASE,
)

_ANY_LABEL_PATTERNS = (
    _MRP_LABEL_PATTERN,
    _USP_LABEL_ONLY,
    _QTY_LABEL_ONLY,
    _MFG_KEYWORDS,
    _EXP_KEYWORDS,
    _DURATION_LABEL_PATTERN,
    _CARE_KEYWORDS,
    _ORIGIN_LABEL_ONLY,
    _COMMON_NAME_PATTERN,
    # Batch/lot is not a declaration we report, but it occupies a row in
    # these tables. Without it the block fails Step 2 and nothing merges.
    re.compile(r"\bbatch\s*no|lot\s*no|b\.?\s*no\b", re.IGNORECASE),
)

_MIN_COLUMN_ROWS = 2          # per band, per the spec
_MAX_LABEL_LEN = 30           # a table label is short; prose is not a label
_WIDTH_RATIO_LIMIT = 3.0      # reject a label band containing a full-width banner
# Vertical overlap (as a fraction of the shorter box) at which a value is
# considered to sit on a label's row.
_ROW_MATCH_OVERLAP = 0.5
# How far below its first line a wrapped continuation may start, as a
# multiple of the text height above it.
_WRAP_GAP_RATIO = 1.5
# How far an individual label->value offset may stray from the block's
# median offset, as a fraction of the row pitch, before ordinal pairing is
# refused. Comfortably under 1.0, so a one-row shift can never pass.
_RANK_OFFSET_TOLERANCE = 0.6


def _text_height(line: OCRLine) -> float:
    return max(1.0, float(line.bbox[3] - line.bbox[1]))


def _is_known_label(text: str) -> bool:
    """True when a line is a label in ANY field's vocabulary."""
    stripped = text.strip()
    if not stripped or len(stripped) > _MAX_LABEL_LEN:
        return False
    if any(p.search(stripped) for p in _ANY_LABEL_PATTERNS):
        return True
    # Same fuzzy thresholding the manufacturer/care/origin fallbacks use,
    # so an OCR-corrupted label still counts.
    return _fuzzy_label_match(stripped, _LABEL_KEYWORDS)


def _column_bands(block: List[tuple], gap: float):
    """Split (index, line) entries into a left and a right band separated by
    a column gutter, or (None, None) if they do not form two columns."""
    left_edges = sorted(line.bbox[0] for _, line in block)
    split = None
    for a, b in zip(left_edges, left_edges[1:]):
        if b - a > gap:
            split = (a + b) / 2.0
            break
    if split is None:
        return None, None
    left = [(i, l) for i, l in block if l.bbox[0] < split]
    right = [(i, l) for i, l in block if l.bbox[0] >= split]
    if len(left) < _MIN_COLUMN_ROWS or len(right) < _MIN_COLUMN_ROWS:
        return None, None
    # The gutter must be real: the right column must start after the left
    # column ENDS. Comparing against the split midpoint instead (an earlier
    # version) rejected every genuine table, because a label's text
    # naturally extends past the midpoint between the two columns' left
    # edges - "MAX RETAIL PRICE" is wider than the gap before its value.
    if min(l.bbox[0] for _, l in right) < max(l.bbox[2] for _, l in left):
        return None, None
    return left, right


def _centre_y(line: OCRLine) -> float:
    return (line.bbox[1] + line.bbox[3]) / 2.0


def _v_overlap_ratio(a: OCRLine, b: OCRLine) -> float:
    """Vertical overlap of two boxes as a fraction of the SHORTER box's
    height. 1.0 means one sits entirely within the other's row band."""
    top = max(a.bbox[1], b.bbox[1])
    bottom = min(a.bbox[3], b.bbox[3])
    if bottom <= top:
        return 0.0
    return (bottom - top) / min(_text_height(a), _text_height(b))


def _x_overlaps(a: OCRLine, b: OCRLine) -> bool:
    return min(a.bbox[2], b.bbox[2]) > max(a.bbox[0], b.bbox[0])


def _median(values: list) -> float:
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return float(ordered[mid])
    return (ordered[mid - 1] + ordered[mid]) / 2.0


def _wrap_host(pairs: list, line: OCRLine):
    """The pair whose value this line is a wrapped continuation of: the
    nearest value ENDING above it, in the same image, horizontally
    overlapping it, within one text height. None when nothing qualifies."""
    host = None
    for pair in pairs:
        previous = pair[1][-1]
        if previous.image_index != line.image_index:
            continue
        gap = line.bbox[1] - previous.bbox[3]
        if gap < 0 or gap > _WRAP_GAP_RATIO * _text_height(previous):
            continue
        if not _x_overlaps(previous, line):
            continue
        if host is None or previous.bbox[3] > host[1][-1].bbox[3]:
            host = pair
    return host


def _pair_by_row_index(left: list, right: list):
    """PRIORITY 1-3: pair by the OCR engine's own row/column coordinates.

    ocr_engine._words_to_lines clusters words into physical rows BEFORE
    _split_at_column_gaps cuts each row into columns, so a label and the
    value printed beside it carry the same row_index and ascending
    column_index. Matching on that is immune to the failure this replaced:
    a dropped, duplicated or extra OCR line changes only its OWN row, and
    can no longer shift every pair beneath it, because no pairing here
    depends on list position or on any other row's outcome.

    Returns None (not an empty list) when the block carries no row
    information, or when no row contains both a label and a value - both
    mean "row matching has nothing to say here", and the caller falls
    through to geometry.
    """
    if any(l.row_index is None for _, l in left) or \
       any(l.row_index is None for _, l in right):
        return None

    rows: dict = {}
    for _, line in right:
        rows.setdefault(line.row_index, []).append(line)
    label_rows = {l.row_index for _, l in left}

    pairs: list = []
    consumed = set()
    for _, label in sorted(left, key=lambda e: e[1].bbox[1]):
        # Same image (P1), same row, and to the RIGHT of the label - a
        # value never precedes its own label within a row.
        same_row = [v for v in rows.get(label.row_index, [])
                    if v.image_index == label.image_index
                    and (label.column_index is None or v.column_index is None
                         or v.column_index > label.column_index)]
        if not same_row:
            continue  # this row's value is missing; every other row stands
        same_row.sort(key=lambda v: (v.column_index if v.column_index is not None
                                     else 0, v.bbox[0]))
        pairs.append([label, list(same_row)])
        consumed.update(id(v) for v in same_row)

    if not pairs:
        return None

    # A value that wrapped onto a second physical line lands in a row of
    # its own with no label in it. Fold it back into the row above, but
    # never across an intervening label row - that would be guessing.
    for line in sorted((l for _, l in right), key=lambda l: l.bbox[1]):
        if id(line) in consumed or line.row_index in label_rows:
            continue
        host = _wrap_host(pairs, line)
        if host is None:
            continue
        if any(host[0].row_index < r < line.row_index for r in label_rows):
            continue
        host[1].append(line)
        consumed.add(id(line))

    return pairs


def _pair_by_geometry(left: list, right: list):
    """PRIORITY 4-5: fall back to bounding-box geometry when the lines
    carry no row_index (hand-built OCRLines, or any producer other than
    _words_to_lines).

    Each value takes the label whose row band it overlaps best, one to
    one, and one unmatched value may be folded in as a wrapped
    continuation of the value above it.

    All-or-nothing on purpose. If any label ends up without a value, or
    more than one value is left over, this returns None rather than
    emitting the pairs it did resolve: with no row information, a block
    whose value column is offset by a whole row (common on packs where
    the declarations are over-printed at fill time) produces exactly the
    same overlaps as a block with a dropped first value, and nothing in
    the geometry distinguishes them. Rejecting the block loses evidence;
    guessing invents it.
    """
    left_lines = sorted((l for _, l in left), key=lambda l: l.bbox[1])
    right_lines = sorted((l for _, l in right), key=lambda l: l.bbox[1])

    claims = []
    for vi, value in enumerate(right_lines):
        for li, label in enumerate(left_lines):
            if label.image_index != value.image_index:
                continue  # never pair across images (P1)
            overlap = _v_overlap_ratio(label, value)
            if overlap >= _ROW_MATCH_OVERLAP:
                claims.append((overlap, -abs(_centre_y(label) - _centre_y(value)),
                               vi, li))
    claims.sort(reverse=True)

    value_of: dict = {}
    taken = set()
    for _, _, vi, li in claims:
        if li in value_of or vi in taken:
            continue
        value_of[li] = vi
        taken.add(vi)

    leftover = [vi for vi in range(len(right_lines)) if vi not in taken]
    if len(leftover) > 1:
        return None  # more than one stray line is not a single clean wrap

    pairs = [[left_lines[li], [right_lines[value_of[li]]]]
             for li in sorted(value_of)]

    if leftover:
        host = _wrap_host(pairs, right_lines[leftover[0]])
        if host is None:
            return None
        host[1].append(right_lines[leftover[0]])

    if len(value_of) != len(left_lines):
        return None
    return pairs


def _pair_by_rank(left: list, right: list):
    """LAST RESORT: ordinal pairing, but only for a value column that is
    uniformly offset from its label column.

    This is the layout the ordinal matcher was originally written for and
    the one test_columns_merge_and_pair_by_rank pins: on a real Bikaji
    declaration sticker the value column sits a full row below its labels,
    so every value overlaps the row band of the NEXT label down and
    geometry confidently reads the whole table off by one. Order survives
    that offset; position does not.

    Unlike the previous unconditional zip(), the ordinal hypothesis now
    has to be earned: counts must match exactly, and every label-to-value
    vertical offset must agree with the block's median offset to well
    within one row pitch. A dropped, extra or shifted line breaks that
    agreement (one pair is a full pitch out of line) and the block is
    rejected instead of silently mispaired.
    """
    if len(left) != len(right) or len(left) < 2:
        return None

    left_lines = sorted((l for _, l in left), key=lambda l: l.bbox[1])
    right_lines = sorted((l for _, l in right), key=lambda l: l.bbox[1])
    if any(label.image_index != value.image_index
           for label, value in zip(left_lines, right_lines)):
        return None

    centres = [_centre_y(l) for l in left_lines]
    pitch = _median([b - a for a, b in zip(centres, centres[1:])])
    if pitch <= 0:
        return None

    offsets = [_centre_y(value) - _centre_y(label)
               for label, value in zip(left_lines, right_lines)]
    median_offset = _median(offsets)
    if max(abs(o - median_offset) for o in offsets) > _RANK_OFFSET_TOLERANCE * pitch:
        return None

    return [[label, [value]] for label, value in zip(left_lines, right_lines)]


def merge_label_value_columns(lines: List[OCRLine]) -> List[OCRLine]:
    """Adds synthesized "label value" lines for validated two-column blocks.

    Pairing is SPATIAL: a label takes the value on its own physical row
    (ocr_engine's row_index where available, bounding-box geometry
    otherwise), with ordinal order kept only as a validated last resort
    for uniformly offset columns. See Step 3 below.

    This replaced an unconditional `zip(left, right)` guarded only by "the
    two columns must have equal counts". That guard catches a single drop
    or a single extra line, but not both at once: one dropped value plus
    one stray right-column line leaves the counts equal, and every pair
    below the drop silently shifts up by one - a batch code reported as
    the MRP, an expiry date as the manufacturing date, at full confidence.

    Returns the original lines plus any merged lines, re-sorted by
    (y0, x0) - the same key ocr_engine uses - so nothing downstream needs
    to know some lines are synthetic.
    """
    if len(lines) < 2 * _MIN_COLUMN_ROWS:
        return lines

    merged: List[OCRLine] = []
    scanned = 0
    while scanned < len(lines):
        start, end = _image_bounds(lines, scanned)
        scanned = end

        block = [(i, lines[i]) for i in range(start, end)
                 if lines[i].text.strip() and _readable(lines[i])]
        if len(block) < 2 * _MIN_COLUMN_ROWS:
            continue

        heights = sorted(_text_height(l) for _, l in block)
        gap = heights[len(heights) // 2] * _COLUMN_GAP_RATIO

        # Step 1: two consistent x0 bands separated by a real gutter.
        left, right = _column_bands(block, gap)
        if left is None:
            continue

        # A full-width banner (a product name across the pack) can start in
        # the left band and is not a table row. Reject a label band whose
        # widths are wildly inconsistent rather than trying to guess which
        # line is the odd one out.
        #
        # FIX: this now checks the LABEL band only. Applied to the value
        # band it rejected legitimate tables, because a value column's
        # widths are legitimately uneven - a batch code beside a wrapped
        # "13:46" is a 4x ratio on a perfectly ordinary pack, and that
        # alone was throwing away every field in the block. The banner this
        # guard exists for is a label-band problem: a value band cannot
        # contain one, since _column_bands already requires the whole right
        # band to start after the left band ends.
        label_widths = [l.bbox[2] - l.bbox[0] for _, l in left]
        if max(label_widths) > _WIDTH_RATIO_LIMIT * max(1, min(label_widths)):
            continue

        # Step 2: EVERY left-band line must be a recognized label. One
        # unrecognized line means we do not understand the block's shape,
        # and pairing an unknown shape is how wrong values get produced.
        if not all(_is_known_label(l.text) for _, l in left):
            continue

        # Step 3: decide which value belongs to which label, spatially.
        #
        #   1. row_index/column_index straight off the OCR engine's own row
        #      clustering - but only when it explains EVERY label in the
        #      block. See below.
        #   2. bounding-box geometry, when the lines carry no row
        #      information at all. All-or-nothing.
        #   3. ordinal order, and only for a value column uniformly offset
        #      from its labels - the skewed-sticker case. See _pair_by_rank.
        #   4. failing all of those, a partial row cover if there is one.
        #
        # The completeness condition on (1) is not fussiness, it is the
        # whole safety argument. On a pack whose declarations are
        # over-printed a full row high - the Bikaji sticker, the Pineapple
        # Delight carton - the row clustering in ocr_engine puts each label
        # in the same row band as the value belonging to the row ABOVE it.
        # The row coordinate is then not merely unhelpful, it is confidently
        # wrong: "MRP Rs." lands on the per-ml price, "BATCH NO." on the
        # manufacturing date. What gives that away is that the shift leaves
        # a value stranded at the top with no label and a label stranded at
        # the bottom with no value - an incomplete cover. So an incomplete
        # row cover defers to a uniformly-offset ordinal reading, and is
        # used only when that is unavailable too.
        #
        # Every strategy pairs within one image only (P1), and a block none
        # of them can resolve is left unpaired rather than guessed at.
        row_pairs = _pair_by_row_index(left, right)
        if row_pairs is not None and len(row_pairs) == len(left):
            pairs = row_pairs
        else:
            pairs = None
            if row_pairs is None:
                pairs = _pair_by_geometry(left, right)
            pairs = pairs or _pair_by_rank(left, right) or row_pairs
        if not pairs:
            continue

        # Step 4: synthesize one "label value" line per resolved row.
        for label_line, value_lines in pairs:
            value_lines = [v for v in value_lines
                           if v.image_index == label_line.image_index]
            if not value_lines:
                continue
            boxes = [label_line.bbox] + [v.bbox for v in value_lines]
            confidences = [c for c in [label_line.confidence]
                           + [v.confidence for v in value_lines] if c is not None]
            words = list(label_line.words)
            for value_line in value_lines:
                words += list(value_line.words)
            merged.append(OCRLine(
                text=" ".join([label_line.text] + [v.text for v in value_lines]),
                bbox=[min(b[0] for b in boxes), min(b[1] for b in boxes),
                      max(b[2] for b in boxes), max(b[3] for b in boxes)],
                confidence=round(sum(confidences) / len(confidences), 3)
                if confidences else None,
                image_index=label_line.image_index,
                words=words,
                row_index=label_line.row_index,
                column_index=label_line.column_index,
            ))

    if not merged:
        return lines

    # Step 5: originals + synthesized, in reading order.
    combined = list(lines) + merged
    combined.sort(key=lambda l: (l.bbox[1], l.bbox[0]))
    return combined
