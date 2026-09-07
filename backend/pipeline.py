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

Open questions this pipeline currently answers "no" to (see
handoff/HANDOFF_Person2.md "Open questions for you"):
  - may_expire: not classified by this MVP -> always None (-> REVIEW for
    PCR-R08). Hardcode a default here if the team decides otherwise.
  - is_imported: partially inferred from the country_of_origin text itself
    (see field_extractors.py) - True/False when an explicit origin/"made in"
    line is found, None otherwise.
  - requires_unit_sale_price / dimensions_relevant: NOT classified by this
    MVP -> always None (-> REVIEW for PCR-R09/PCR-R10). See note below.

FIX (this pass): requires_unit_sale_price / dimensions_relevant used to be
derived as `True if <field>_value else None` - i.e. "applicable" was set to
True only when the corresponding declaration had already been found, and
None otherwise. That's circular, not a real applicability classification:
it meant PCR-R09/PCR-R10 could never resolve to N/A (the field is never
actually classified False), and could never genuinely FAIL either (whenever
"applicable" was True, the value was by construction already present, so
the rule could only trivially PASS). A real "does this commodity category
require a unit sale price / have relevant dimensions" classification is out
of scope for this MVP's OCR-only pipeline - per HANDOFF_Person2.md's open
question 1, the honest answer for now is "we don't know", so both are always
None here. That correctly routes PCR-R09/PCR-R10 to REVIEW (not a silent,
misleading PASS) until product/category classification is implemented
upstream.
"""

from typing import List

from .ocr_engine import run_ocr, OCRLine
from . import field_extractors as fx


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
    for _field, evidence in declarations.items():
        if isinstance(evidence, dict) and evidence.get("value") is not None:
            evidence["value"] = str(evidence["value"])
    declarations["principal_display_panel_colocation"] = fx.extract_pdp_colocation_evidence(
        lines, declarations["manufacturer"]
    )

    product_context = {
        "is_imported": is_imported,                      # None if undetermined
        "may_expire": None,                               # not classified by this MVP - see module docstring
        "requires_unit_sale_price": None,                  # not classified by this MVP - see module docstring
        "dimensions_relevant": None,                       # not classified by this MVP - see module docstring
    }

    return {"declarations": declarations, "product_context": product_context}


def run_pipeline(image_paths: List[str]) -> dict:
    """Full pipeline: images on disk -> frozen evidence contract dict."""
    lines = run_ocr(image_paths)
    return extract_declarations(lines)


if __name__ == "__main__":
    import json
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m backend.pipeline <image1> [image2] [image3]")
        sys.exit(1)

    output = run_pipeline(sys.argv[1:])
    print(json.dumps(output, indent=2))