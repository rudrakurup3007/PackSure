"""
PackSure — extraction smoke tests (no OCR, no images required)

Feeds hand-written OCRLine objects straight into the extractors so the
regex/parsing layer can be checked without a Tesseract run. Every case here
is either (a) a documented failure from the fixes doc, or (b) a false
positive found while fixing those.

Run from the project root:
    python -m pytest ocr_extraction/test_extraction_smoke.py -q
or, with no pytest installed:
    python ocr_extraction/test_extraction_smoke.py
"""

from .ocr_engine import OCRLine
from .pipeline import extract_declarations


def L(text, conf=0.85, image_index=1, y=0):
    return OCRLine(text=text, bbox=[0, y, 100, y + 10],
                   confidence=conf, image_index=image_index)


def values(lines):
    out = extract_declarations(lines)
    return {
        k: v.get("value")
        for k, v in out["declarations"].items()
        if isinstance(v, dict)
    }, out["product_context"]


# --------------------------------------------------------------------------
# 1. Dates — format-agnostic parsing (fixes doc item 1)
# --------------------------------------------------------------------------

def test_glued_ddmmmyyyy():
    v, _ = values([L("MFG 31JUL2026"), L("BEST BEFORE 30JAN2027")])
    assert v["manufacturing_date"] == "31JUL2026"
    assert v["expiry_date"] == "30JAN2027"


def test_numeric_and_spelled_formats():
    for text, expected in [("MFG DATE: 31-07-2026", "31-07-2026"),
                           ("Packed on 2026/07/31", "2026/07/31"),
                           ("Mfd. 31 July 2026", "31 July 2026")]:
        v, _ = values([L(text)])
        assert v["manufacturing_date"] == expected, text


def test_both_dates_on_one_line():
    """Regression: only the first date on a line used to be read, and both
    got the same role, so the expiry date was silently dropped."""
    v, ctx = values([L("MFG 31JUL2026 EXP 30JAN2027")])
    assert v["manufacturing_date"] == "31JUL2026"
    assert v["expiry_date"] == "30JAN2027"
    assert ctx["may_expire"] is True


def test_batch_number_is_not_a_date():
    """Regression: 'Batch No 2026/07/31' was being reported as a mfg date."""
    v, _ = values([L("Batch No 2026/07/31")])
    assert v["manufacturing_date"] is None


# --------------------------------------------------------------------------
# 2. Quantities / units — OCR confusion correction (fixes doc item 2)
# --------------------------------------------------------------------------

def test_unit_letter_swallowed_into_digits():
    """The documented Monaco failure: '400g' OCR'd as '4009'."""
    out = extract_declarations([L("NET QTY 4009", conf=0.62)])
    qty = out["declarations"]["net_quantity"]
    assert qty["value"] == "400"
    assert qty["unit"] == "g"
    assert qty["unit_status"] == "ocr_corrected"
    assert qty["corrected_from_ocr"] is True


def test_clean_quantity_is_not_flagged_as_corrected():
    for text in ("Net Weight: 400 g", "400g"):
        out = extract_declarations([L(text)])
        qty = out["declarations"]["net_quantity"]
        assert qty["value"] == "400" and qty["unit"] == "g", text
        assert qty["corrected_from_ocr"] is False, text


def test_dimensions_do_not_become_net_quantity():
    """Regression: 'Dimensions: 10 x 20 x 5 cm' reported net_quantity 5 cm."""
    v, _ = values([L("Dimensions: 10 x 20 x 5 cm")])
    assert v["net_quantity"] is None
    assert v["dimensions"] == "10 x 20 x 5"


def test_unit_sale_price_basis_is_not_net_quantity():
    """Regression: 'per 100g' in a USP line reported net_quantity 100 g."""
    v, _ = values([L("Unit Sale Price Rs 15.00 per 100g")])
    assert v["net_quantity"] is None
    assert v["unit_sale_price"] == "15.00"


def test_network_marks_are_not_grams():
    v, _ = values([L("5G Android phone model X")])
    assert v["net_quantity"] is None


# --------------------------------------------------------------------------
# 3. Label-anchored fields — fuzzy label matching (fixes doc item 3)
# --------------------------------------------------------------------------

def test_corrupted_manufacturer_label_recovers_value():
    """The documented case: 'MANUFACTURED FOR:' OCR'd as 'onsen FOR:'."""
    out = extract_declarations([L("onsen FOR:"), L("PARLE BISCUITS PVT LTD")])
    mfr = out["declarations"]["manufacturer"]
    assert mfr["value"] == "PARLE BISCUITS PVT LTD"
    assert mfr["label_match"] == "fuzzy"


def test_clean_label_is_marked_exact():
    out = extract_declarations([L("Manufactured By: ABC Foods Pvt Ltd")])
    assert out["declarations"]["manufacturer"]["label_match"] == "exact"


def test_short_and_other_declaration_lines_are_not_labels():
    """Regression guard: a bare 'MRP' scores 67 against 'marketed by' under
    partial_ratio, and would become a manufacturer label without the
    length + other-declaration guards."""
    for junk in ("MRP", "BEST BEFORE", "NET QTY", "PRICE 2500/-", "INGREDIENTS"):
        v, _ = values([L(junk), L("SOME RANDOM TEXT")])
        assert v["manufacturer"] is None, junk


def test_corrupted_origin_label():
    v, _ = values([L("PRODUCT 0F"), L("INDIA")])
    assert v["country_of_origin"] == "INDIA"


def test_corrupted_consumer_care_label():
    v, _ = values([L("CONSUNER CAR3: 1800223333")])
    assert v["consumer_care"] == "1800223333"


# --------------------------------------------------------------------------
# 4. Duration shelf-life + multi-pass stutter (fixes doc item 4)
# --------------------------------------------------------------------------

def test_spelled_out_duration():
    v, ctx = values([L("BEST BEFORE SIX MONTHS FROM PACKAGING", conf=0.90)])
    assert v["expiry_date"] == "6 MONTHS"
    assert ctx["may_expire"] is True


def test_duration_survives_duplicated_word_fragments():
    v, _ = values([L("BEST BEFORE BEST BEFORE SIX SIX MONTHS FROM PACKAGING")])
    assert v["expiry_date"] == "6 MONTHS"


# --------------------------------------------------------------------------
# 5. MRP
# --------------------------------------------------------------------------

def test_stray_glyph_before_amount():
    """'MRP 2 60.00' — the '2' is a misread 'Rs.' glyph, not the price."""
    v, _ = values([L("MRP 2 60.00")])
    assert v["mrp"] == "60.00"


def test_promotional_amounts_are_not_mrp():
    v, _ = values([L("Rs.100 off on orders above Rs.500")])
    assert v["mrp"] is None


def test_labelled_mrp_beats_unlabelled_price():
    v, _ = values([L("MRP Rs 60.00"), L("PRICE 45/-")])
    assert v["mrp"] == "60.00"


# --------------------------------------------------------------------------
# 6. Contract shape / robustness
# --------------------------------------------------------------------------

EXPECTED_FIELDS = {
    "manufacturer", "common_name", "net_quantity", "mrp", "manufacturing_date",
    "expiry_date", "consumer_care", "country_of_origin", "unit_sale_price",
    "dimensions", "principal_display_panel_colocation",
}


def test_contract_shape_on_empty_input():
    out = extract_declarations([])
    assert set(out["declarations"]) == EXPECTED_FIELDS
    assert set(out["product_context"]) == {
        "is_imported", "may_expire", "requires_unit_sale_price",
        "dimensions_relevant",
    }


def test_missing_confidence_does_not_crash():
    lines = [OCRLine("Manufactured By: ABC Ltd", [0, 0, 1, 1], None, 1)]
    v, _ = values(lines)
    assert v["manufacturer"] == "ABC Ltd"


def test_conflicting_origin_signals_resolve_to_the_declaration():
    """SUPERSEDED BEHAVIOUR (PROBLEM 5): this previously asserted
    is_imported is None. The origin declaration is now authoritative and
    the disagreement is surfaced via origin_conflict instead of erasing a
    directly-stated fact. Flipping
    field_extractors.ORIGIN_DECLARATION_OVERRIDES_IMPORTER restores the old
    result."""
    out = extract_declarations([L("Imported by: XYZ"), L("Made in India")])
    assert out["product_context"]["is_imported"] is False
    assert out["declarations"]["country_of_origin"]["origin_conflict"] is True


# --------------------------------------------------------------------------
# PROBLEM 1 — cross-image contamination
# --------------------------------------------------------------------------

def test_manufacturer_label_cannot_cross_image_boundary():
    """A bare label at the end of image 1 must not take its value from the
    first line of image 2."""
    v, _ = values([
        L("MANUFACTURED FOR:", image_index=1),
        L("PARLE BISCUITS PVT LTD", image_index=2),
    ])
    assert v["manufacturer"] is None


def test_common_name_label_cannot_cross_image_boundary():
    """Uses a value with NO commodity descriptor word in it, so the tier-2
    vocabulary fallback cannot find it independently. That isolates the
    cross-image LABEL path, which is what P1 is about. (A value like
    "Salted Snack" would legitimately be found on image 2 by the descriptor
    fallback - independent detection, not label association.)"""
    v, _ = values([
        L("Product Name:", image_index=1),
        L("Zorbix Deluxe", image_index=2),
    ])
    assert v["common_name"] is None


def test_common_name_descriptor_fallback_is_not_label_association():
    """A descriptor line on another image IS still found - it is
    self-contained evidence - but it must be reported as vocabulary
    evidence, never as the image-1 label's value."""
    out = extract_declarations([
        L("Product Name:", image_index=1),
        L("Salted Snack", image_index=2),
    ])
    cn = out["declarations"]["common_name"]
    assert cn["value"] == "Salted Snack"
    assert cn["match_method"] == "descriptor_vocabulary"
    assert cn["image_index"] == 2


def test_labelled_common_name_outranks_descriptor_line():
    out = extract_declarations([
        L("Product Name: Chowpati Bhelpuri"),
        L("Cereal based namkeen"),
    ])
    cn = out["declarations"]["common_name"]
    assert cn["value"] == "Chowpati Bhelpuri"
    assert cn["match_method"] == "explicit_label"


def test_ingredients_line_is_not_a_common_name():
    """Monaco's ingredients list opens with 'WHEAT FLOUR, EDIBLE VEGETABLE
    OILS' - two descriptor words - and must not become the commodity name."""
    v, _ = values([
        L("INGREDIENTS: WHEAT FLOUR, EDIBLE VEGETABLE OILS, SUGAR"),
    ])
    assert v["common_name"] is None


def test_brand_name_alone_is_not_a_common_name():
    """Golden rule: prominence is not evidence. A brand with no commodity
    word must still yield nothing."""
    v, _ = values([L("MONACO"), L("PARLE")])
    assert v["common_name"] is None


def test_net_quantity_label_cannot_cross_image_boundary():
    """'4009' resolves to 400 g ONLY via the labelled path (the digit-tail
    unit recovery is labelled-only), so it isolates the cross-image label
    lookup. A bare '400 g' would not: the unlabelled standalone fallback
    would legitimately find it on image 2, which is correct behaviour."""
    out = extract_declarations([
        L("Net Weight:", image_index=1),
        L("4009", image_index=2),
    ])
    assert out["declarations"]["net_quantity"]["value"] is None


def test_net_quantity_label_still_reaches_next_line_in_same_image():
    out = extract_declarations([
        L("Net Weight:", image_index=1),
        L("4009", image_index=1),
    ])
    qty = out["declarations"]["net_quantity"]
    assert qty["value"] == "400" and qty["unit"] == "g"


def test_origin_label_cannot_cross_image_boundary():
    v, _ = values([
        L("Country of Origin", image_index=1),
        L("India", image_index=2),
    ])
    assert v["country_of_origin"] is None


def test_duration_label_cannot_cross_image_boundary():
    v, _ = values([
        L("Best Before:", image_index=1),
        L("6 months", image_index=2),
    ])
    assert v["expiry_date"] is None


def test_context_window_does_not_cross_image_boundary():
    """Context is not decoration - _extract_dates classifies a date's role
    from it, so a keyword on another photo must not leak in."""
    out = extract_declarations([
        L("31JUL2026", image_index=1),
        L("BEST BEFORE", image_index=2),
    ])
    mfg = out["declarations"]["manufacturing_date"]
    assert "BEST BEFORE" not in (mfg["context"] or "")
    # With no expiry keyword reachable, the date stays unclear-role rather
    # than being retagged as an expiry from the other image.
    assert mfg["date_role"] == "unclear"


def test_positive_manufacturer_same_image():
    v, _ = values([
        L("Manufactured By:", image_index=1),
        L("ABC Foods", image_index=1),
    ])
    assert v["manufacturer"] == "ABC Foods"


def test_positive_common_name_same_image():
    v, _ = values([
        L("Product Name:", image_index=1),
        L("Salted Snack", image_index=1),
    ])
    assert v["common_name"] == "Salted Snack"


def test_positive_net_quantity_same_image():
    out = extract_declarations([
        L("Net Weight:", image_index=1),
        L("400 g", image_index=1),
    ])
    qty = out["declarations"]["net_quantity"]
    assert qty["value"] == "400" and qty["unit"] == "g"


def test_positive_origin_same_image():
    v, _ = values([
        L("Country of Origin:", image_index=1),
        L("INDIA", image_index=1),
    ])
    assert v["country_of_origin"] == "INDIA"


def test_unlabelled_evidence_still_found_on_a_later_image():
    """Do-not-overcorrect guard. The restriction is on relative label->value
    association, NOT on which images may be searched. A self-contained
    declaration on image 2 must still be found when image 1 carries none."""
    out = extract_declarations([
        L("MONACO", image_index=1),
        L("SALTED SNACK", image_index=1),
        L("NET WEIGHT: 400 g", image_index=2),
        L("MRP Rs 60.00", image_index=2),
    ])
    d = out["declarations"]
    assert d["net_quantity"]["value"] == "400"
    assert d["net_quantity"]["image_index"] == 2
    assert d["mrp"]["value"] == "60.00"


def test_label_and_value_on_the_same_later_image():
    """A label->value pair wholly inside image 3 is a valid association."""
    v, _ = values([
        L("FRONT OF PACK", image_index=1),
        L("MANUFACTURED FOR:", image_index=3),
        L("PARLE BISCUITS PVT LTD", image_index=3),
    ])
    assert v["manufacturer"] == "PARLE BISCUITS PVT LTD"


def test_date_not_retagged_by_keyword_on_another_image():
    """IMAGE 1: 31JUL2026 / IMAGE 2: BEST BEFORE -> the date must not be
    classified as an expiry on the strength of image 2's keyword."""
    out = extract_declarations([
        L("31JUL2026", image_index=1),
        L("BEST BEFORE", image_index=2),
    ])
    assert out["declarations"]["expiry_date"]["value"] is None
    assert out["declarations"]["manufacturing_date"]["date_role"] != "best_before_use_by"


def test_date_on_later_image_not_claimed_by_earlier_label():
    """IMAGE 1: BEST BEFORE / IMAGE 2: 30JAN2027 -> no association."""
    out = extract_declarations([
        L("BEST BEFORE", image_index=1),
        L("30JAN2027", image_index=2),
    ])
    assert out["declarations"]["expiry_date"]["value"] is None
    mfg = out["declarations"]["manufacturing_date"]
    assert mfg["value"] == "30JAN2027"      # still found, just unattributed
    assert mfg["date_role"] == "unclear"


def test_same_image_next_line_still_works():
    """Guard against over-correcting: within one image the fallback must
    behave exactly as before."""
    v, _ = values([
        L("MANUFACTURED FOR:", image_index=1),
        L("PARLE BISCUITS PVT LTD", image_index=1),
    ])
    assert v["manufacturer"] == "PARLE BISCUITS PVT LTD"


# --------------------------------------------------------------------------
# PROBLEM 2 — best-before duration on the next line
# --------------------------------------------------------------------------

def test_duration_on_next_line_with_colon():
    v, ctx = values([L("Best Before:"), L("6 months")])
    assert v["expiry_date"] == "6 months"
    assert ctx["may_expire"] is True


def test_duration_on_next_line_without_colon():
    v, _ = values([L("Best Before"), L("6 Months")])
    assert v["expiry_date"] == "6 Months"


def test_duration_two_lines_below():
    """A stray OCR fragment between the label and its value must not stop
    the lookahead."""
    v, _ = values([L("Best Before"), L("~"), L("12 months")])
    assert v["expiry_date"] == "12 months"


def test_duration_lookahead_stops_at_next_declaration():
    """'Best Before' followed by a different declaration must NOT produce a
    duration harvested from further down the pack."""
    v, _ = values([L("Best Before"), L("MRP Rs 60.00"), L("6 months")])
    assert v["expiry_date"] is None


def test_duration_same_line_still_preferred():
    v, _ = values([L("BEST BEFORE 9 MONTHS FROM PACKAGING"), L("18 months")])
    assert v["expiry_date"] == "9 MONTHS"


def test_duration_helper_return_contract_unchanged():
    """The (number, unit) contract and the two-argument call signature must
    both still work for any existing caller."""
    from .field_extractors import _best_duration_after_label
    result = _best_duration_after_label("BEST BEFORE 6 MONTHS", len("BEST BEFORE"))
    assert result == ("6", "MONTHS")
    assert _best_duration_after_label("BEST BEFORE", len("BEST BEFORE")) is None


# --------------------------------------------------------------------------
# PROBLEM 3 — manufacturer vs importer/packer/marketer
# --------------------------------------------------------------------------

def test_manufacturer_beats_importer():
    out = extract_declarations([
        L("Manufactured by ABC Foods"),
        L("Imported by XYZ Pvt Ltd"),
    ])
    mfr = out["declarations"]["manufacturer"]
    assert mfr["value"] == "ABC Foods"
    assert mfr["label_type"] == "manufacturer"


def test_manufacturer_beats_importer_regardless_of_confidence():
    """The importer line is read more confidently and still must not win."""
    out = extract_declarations([
        L("Manufactured by ABC Foods", conf=0.55),
        L("Imported by XYZ Pvt Ltd", conf=0.99),
    ])
    assert out["declarations"]["manufacturer"]["value"] == "ABC Foods"


def test_manufacturer_beats_marketer_and_packer():
    for secondary in ("Marketed by XYZ Pvt Ltd", "Packed by XYZ Pvt Ltd",
                      "Packaged by XYZ Pvt Ltd", "Importer XYZ Pvt Ltd"):
        v, _ = values([L("Manufactured by ABC Foods"), L(secondary)])
        assert v["manufacturer"] == "ABC Foods", secondary


def test_secondary_label_used_when_no_manufacturer_label():
    """Rule 6(1)(a) accepts manufacturer OR packer OR importer, so a pack
    that only declares a packer must still yield evidence - tagged as such
    rather than silently passed off as the manufacturer."""
    out = extract_declarations([L("Packed by XYZ Pvt Ltd")])
    mfr = out["declarations"]["manufacturer"]
    assert mfr["value"] == "XYZ Pvt Ltd"
    assert mfr["label_type"] == "packer_importer_marketer"


# --------------------------------------------------------------------------
# PROBLEM 4 — country-of-origin cleanup
# --------------------------------------------------------------------------

def test_origin_strips_trailing_importer():
    v, _ = values([L("Made in India. Imported by ABC Pvt Ltd")])
    assert v["country_of_origin"] == "India"


def test_origin_strips_importer_without_punctuation():
    v, _ = values([L("Made in China Imported by ABC Pvt Ltd")])
    assert v["country_of_origin"] == "China"


def test_multiword_country_names_survive_cleanup():
    """The cleanup must not truncate legitimate country names."""
    for text, expected in [
        ("Country of Origin: United Arab Emirates", "United Arab Emirates"),
        ("Country of Origin: Republic of Korea", "Republic of Korea"),
        ("Made in Trinidad and Tobago", "Trinidad and Tobago"),
        ("Country of Origin: New Zealand", "New Zealand"),
    ]:
        v, _ = values([L(text)])
        assert v["country_of_origin"] == expected, text


# --------------------------------------------------------------------------
# PROBLEM 5 — is_imported interpretation
# --------------------------------------------------------------------------

def test_origin_declaration_overrides_importer_mention():
    """'Made in India' is the origin declaration; 'Imported by' is a
    name-and-address declaration about a company's role. The origin
    declaration answers is_imported directly."""
    out = extract_declarations([L("Made in India. Imported by ABC Pvt Ltd")])
    assert out["product_context"]["is_imported"] is False
    origin = out["declarations"]["country_of_origin"]
    assert origin["importer_mentioned"] is True
    assert origin["origin_conflict"] is True


def test_agreeing_signals_report_imported():
    out = extract_declarations([L("Made in China"), L("Imported by ABC Pvt Ltd")])
    assert out["product_context"]["is_imported"] is True


def test_importer_alone_implies_imported():
    _, ctx = values([L("Imported by ABC Pvt Ltd")])
    assert ctx["is_imported"] is True


def test_no_origin_signal_stays_unknown():
    _, ctx = values([L("MRP Rs 60.00")])
    assert ctx["is_imported"] is None


# --------------------------------------------------------------------------
# PROBLEM 6 — consumer-care phone fallback
# --------------------------------------------------------------------------

def test_labelled_phone_is_strong_evidence():
    out = extract_declarations([L("Customer Care: 1800-123-4567")])
    care = out["declarations"]["consumer_care"]
    assert care["value"] is not None and "1800" in care["value"]
    assert "partial" not in care


def test_unlabelled_phone_fallback():
    out = extract_declarations([L("SOME BRAND"), L("1800 123 4567")])
    care = out["declarations"]["consumer_care"]
    assert care["value"] == "1800 123 4567"
    assert care["partial"] is True


def test_mobile_number_fallback():
    v, _ = values([L("SOME BRAND"), L("9876543210")])
    assert v["consumer_care"] == "9876543210"


def test_email_still_preferred_over_phone():
    v, _ = values([L("care@abc.com"), L("9876543210")])
    assert v["consumer_care"] == "care@abc.com"


def test_non_phone_digit_runs_are_not_consumer_care():
    """MRP, quantity, dates, batch codes, barcodes, licences and pincodes
    must never become a phone number."""
    for junk in ("MRP Rs 6000000", "NET QTY 4009", "MFG 31JUL2026",
                 "Batch No 8901234567890", "FSSAI Lic No 10012345678901",
                 "MUMBAI 400099", "8901234567890"):
        v, _ = values([L(junk)])
        assert v["consumer_care"] is None, junk


# --------------------------------------------------------------------------
# PROBLEM 9 — OCR line reconstruction
# --------------------------------------------------------------------------

def test_side_by_side_columns_do_not_merge():
    from .ocr_engine import _words_to_lines

    def w(text, x0, x1, y0=100, y1=120):
        return {"text": text, "bbox": [x0, y0, x1, y1], "confidence": 0.9,
                "image_index": 1, "pass_index": 0}

    out = _words_to_lines([
        w("MRP", 20, 70), w("Rs", 75, 105), w("60.00", 110, 190),
        w("NET", 600, 650), w("QTY", 655, 710), w("400g", 715, 790),
    ], 1)
    assert [line.text for line in out] == ["MRP Rs 60.00", "NET QTY 400g"]


def test_normal_word_spacing_is_not_split():
    from .ocr_engine import _words_to_lines

    def w(text, x0, x1, y0=100, y1=120):
        return {"text": text, "bbox": [x0, y0, x1, y1], "confidence": 0.9,
                "image_index": 1, "pass_index": 0}

    out = _words_to_lines([
        w("MANUFACTURED", 20, 180), w("FOR:", 188, 240),
        w("PARLE", 250, 330), w("BISCUITS", 338, 450),
    ], 1)
    assert [line.text for line in out] == ["MANUFACTURED FOR: PARLE BISCUITS"]


def test_word_level_dedup_across_passes_preserved():
    """Regression guard on the existing multi-pass dedup - two passes
    reading the same word must not both survive into the line text."""
    from .ocr_engine import _merge_words_across_passes, _words_to_lines

    def w(text, x0, x1, conf, pass_index):
        return {"text": text, "bbox": [x0, 100, x1, 120], "confidence": conf,
                "image_index": 1, "pass_index": pass_index}

    merged = _merge_words_across_passes([
        w("SIX", 20, 70, 0.80, 0), w("SI", 22, 68, 0.60, 1),
        w("MONTHS", 78, 180, 0.90, 0), w("MONTHS", 79, 181, 0.70, 1),
    ])
    assert _words_to_lines(merged, 1)[0].text == "SIX MONTHS"


def test_lines_are_returned_in_reading_order():
    from .ocr_engine import _words_to_lines

    def w(text, y0):
        return {"text": text, "bbox": [20, y0, 200, y0 + 20], "confidence": 0.9,
                "image_index": 1, "pass_index": 0}

    out = _words_to_lines([w("THIRD", 300), w("FIRST", 100), w("SECOND", 200)], 1)
    assert [line.text for line in out] == ["FIRST", "SECOND", "THIRD"]


if __name__ == "__main__":
    import sys, traceback

    tests = [(n, f) for n, f in sorted(globals().items())
             if n.startswith("test_") and callable(f)]
    failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"PASS  {name}")
        except Exception:
            failed += 1
            print(f"FAIL  {name}")
            traceback.print_exc()
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
