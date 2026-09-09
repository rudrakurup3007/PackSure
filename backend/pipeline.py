"""
PackSure — OCR + Structured Extraction Pipeline
Person 2 (AI/CV — OCR & Extraction)

This is the single entry point Person 3 (backend) should call. It takes 1-3
image paths and returns the frozen evidence contract:

    {
      "declarations": { <field_name>: {value, raw_text, confidence, bbox,
                                        image_index, context, ...extras}, ... },
      "product_context": {is_imported, may_expire, requires_unit_sale_price,
                           dimensions_relevant}
    }

`declarations` is exactly what domain_rules/rule_engine.py's `evidence` param
expects (see its `__main__` block for the same shape), and `product_context`
is exactly what it expects for `product_context`. Backend's job is to plug
these two dicts into run_all_rules(evidence, product_context) - no reshaping
should be necessary.

--------------------------------------------------------------------------
FIX (applicability vs. evidence conflation): `product_context` previously
derived "is this rule applicable" from "did we already find the evidence"
for PCR-R09 (unit_sale_price) and PCR-R10 (dimensions):

    "requires_unit_sale_price": True if unit_sale_price_value else None,
    "dimensions_relevant": True if dimensions_value else None,

Trace it through rule_engine.check_applicability(): False -> N/A, None ->
REVIEW, True -> proceed to check evidence. If the evidence was found,
applicability becomes True and the rule PASSes. But if the evidence is
genuinely missing (the actual violation we want to catch), applicability
becomes None and the rule short-circuits to REVIEW *before* it ever reaches
the "evidence is None -> FAIL" step. Structurally, those two rules could
only ever resolve to PASS, REVIEW, or N/A - never FAIL.

This MVP has no independent product-category classifier (no signal for
"does this SKU legally require a unit sale price / dimensions declaration"
other than whether we happened to find one), so it can't correctly set
applicability to False for SKUs that are genuinely exempt. Given that
constraint, applicability is now hardcoded True for both - "assume
applicable unless we build a real classifier" - so a genuinely missing
declaration correctly reaches FAIL instead of being silently absorbed into
REVIEW forever. The trade-off: a SKU that's legitimately exempt from one of
these declarations will now show FAIL instead of N/A, until a real
classifier (or a different pipeline.py contract - see handoff doc "Open
questions for you") backs this properly. Flag this trade-off to Riya/the
rules owner before it ships - it's a policy call, not just a code fix.

The two constants are lifted to module level (ASSUME_UNIT_SALE_PRICE_
APPLICABLE / ASSUME_DIMENSIONS_APPLICABLE) so that policy call is one
edit in one obvious place rather than a literal buried in a dict.

FIX (may_expire): was hardcoded to None unconditionally. It's now True
whenever we actually found expiry-date evidence on the pack - if a package
prints a best-before/use-by date (or a "best before N months" shelf-life
duration, which the extractor also reports as expiry evidence), it
obviously "may expire", regardless of what a future product-category
classifier would say. Absence of an expiry date is still left as None
(unclear) rather than False - we cannot safely conclude "this product
never expires" just because OCR didn't find a date.
--------------------------------------------------------------------------
"""

from pathlib import Path
from typing import List

from .ocr_engine import run_ocr, OCRLine
from . import field_extractors as fx


# Policy switches - see the module docstring. Set to None to send the
# corresponding rule to REVIEW instead of allowing it to FAIL, once the
# rules owner has made the call.
# P8 DECISION (unit sale price): set to None, i.e. "we cannot determine
# whether this SKU is required to declare a unit sale price".
#
# Traced through rule_engine.check_applicability():
#     True  -> applicable  -> evidence is None -> FAIL
#     None  -> REVIEW
#     False -> N/A (excluded from the score entirely)
#
# True was correct as a fix for the ORIGINAL bug (applicability was being
# derived from whether the evidence was found, so PCR-R09 could structurally
# never FAIL). But it over-corrected: unit sale price is required mainly for
# multi-piece and variable-weight packs, so most single-unit FMCG is exempt,
# and True hard-FAILs every one of them for a declaration they never needed
# to print. That is a wrong compliance result on the majority of packs.
#
# None is honest about what this MVP actually knows: there is no
# product-category classifier, so applicability is genuinely undetermined.
#
# Score impact: none. REVIEW and FAIL are both non-PASS and both scored=True
# in calculate_score(), so the denominator and numerator are unchanged - only
# the label a reviewer sees changes, from "this pack is non-compliant" to
# "this needs a human". Setting it to False would be the change that alters
# the score, and False would be a lie: we have no evidence of exemption.
#
# Restoring True is a one-line revert if the rules owner disagrees.
ASSUME_UNIT_SALE_PRICE_APPLICABLE = None

# PCR-R10 (dimensions) is RETIRED for this MVP, at the team's decision.
#
# False means check_applicability() returns "N/A", and calculate_score()
# excludes every N/A result from both the numerator and the denominator - so
# the rule disappears from the compliance score entirely rather than sitting
# in it as a permanent non-PASS. This is the correct switch for retiring a
# rule: None would keep it in the score as a REVIEW, and True was FAILing
# every pack that had no dimensions declaration to find.
#
# Kept as a constant rather than deleted so the evidence is still collected
# (extract_dimensions still runs and still populates declarations) and the
# rule can be revived by flipping this back once a product-category
# classifier can say which SKUs actually require the declaration.
#
# To remove PCR-R10 from the UI as well, delete its entry from rules.json -
# this switch controls scoring, not whether the card renders.
ASSUME_DIMENSIONS_APPLICABLE = False

MAX_IMAGES = 3


def extract_declarations(lines: List[OCRLine]) -> dict:
    manufacturing_date, expiry_date = fx.extract_manufacturing_and_expiry_dates(lines)
    country_of_origin, is_imported = fx.extract_country_of_origin(lines)

    declarations = {
        "manufacturer": fx.extract_manufacturer(lines),
        "common_name": fx.extract_common_name(lines),
        "net_quantity": fx.extract_net_quantity(lines),
        "mrp": fx.extract_mrp(lines),
        "manufacturing_date": manufacturing_date,
        "expiry_date": expiry_date,
        "consumer_care": fx.extract_consumer_care(lines),
        "country_of_origin": country_of_origin,
        "unit_sale_price": fx.extract_unit_sale_price(lines),
        "dimensions": fx.extract_dimensions(lines),
    }
    declarations["principal_display_panel_colocation"] = fx.extract_pdp_colocation_evidence(
        lines, declarations["manufacturer"]
    )

    product_context = {
        "is_imported": is_imported,                      # None if undetermined
        "may_expire": True if expiry_date["value"] else None,
        # See module docstring "FIX (applicability vs. evidence conflation)":
        # hardcoded True so a genuinely missing declaration can reach FAIL
        # instead of being structurally unable to ever leave REVIEW. Needs a
        # real product-category classifier to become accurate per-SKU.
        "requires_unit_sale_price": ASSUME_UNIT_SALE_PRICE_APPLICABLE,
        "dimensions_relevant": ASSUME_DIMENSIONS_APPLICABLE,
    }

    return {"declarations": declarations, "product_context": product_context}


def run_pipeline(image_paths: List[str]) -> dict:
    """Full pipeline: validated image paths -> frozen evidence contract dict."""
    if not isinstance(image_paths, (list, tuple)):
        raise TypeError(f"image_paths must be a list/tuple containing 1 to {MAX_IMAGES} paths")

    paths = list(image_paths)
    if not (1 <= len(paths) <= MAX_IMAGES):
        raise ValueError(f"Expected 1 to {MAX_IMAGES} images, got {len(paths)}")

    for path in paths:
        if not isinstance(path, (str, Path)) or not str(path).strip():
            raise ValueError("Every image path must be a non-empty string/path")
        if not Path(path).is_file():
            raise FileNotFoundError(f"OCR image not found: {path}")

    lines = run_ocr([str(path) for path in paths])
    return extract_declarations(lines)


if __name__ == "__main__":
    import json
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m ocr_extraction.pipeline <image1> [image2] [image3]")
        sys.exit(1)

    output = run_pipeline(sys.argv[1:])
    print(json.dumps(output, indent=2))
