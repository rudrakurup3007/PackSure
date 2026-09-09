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
from .field_extractors import merge_label_value_columns


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
    from backend.field_extractors import _best_duration_after_label
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
    from backend.ocr_engine import _words_to_lines

    def w(text, x0, x1, y0=100, y1=120):
        return {"text": text, "bbox": [x0, y0, x1, y1], "confidence": 0.9,
                "image_index": 1, "pass_index": 0}

    out = _words_to_lines([
        w("MRP", 20, 70), w("Rs", 75, 105), w("60.00", 110, 190),
        w("NET", 600, 650), w("QTY", 655, 710), w("400g", 715, 790),
    ], 1)
    assert [line.text for line in out] == ["MRP Rs 60.00", "NET QTY 400g"]


def test_normal_word_spacing_is_not_split():
    from backend.ocr_engine import _words_to_lines

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
    from backend.ocr_engine import _merge_words_across_passes, _words_to_lines

    def w(text, x0, x1, conf, pass_index):
        return {"text": text, "bbox": [x0, 100, x1, 120], "confidence": conf,
                "image_index": 1, "pass_index": pass_index}

    merged = _merge_words_across_passes([
        w("SIX", 20, 70, 0.80, 0), w("SI", 22, 68, 0.60, 1),
        w("MONTHS", 78, 180, 0.90, 0), w("MONTHS", 79, 181, 0.70, 1),
    ])
    assert _words_to_lines(merged, 1)[0].text == "SIX MONTHS"


def test_lines_are_returned_in_reading_order():
    from backend.ocr_engine import _words_to_lines

    def w(text, y0):
        return {"text": text, "bbox": [20, y0, 200, y0 + 20], "confidence": 0.9,
                "image_index": 1, "pass_index": 0}

    out = _words_to_lines([w("THIRD", 300), w("FIRST", 100), w("SECOND", 200)], 1)
    assert [line.text for line in out] == ["FIRST", "SECOND", "THIRD"]


def test_row_and_column_indices_are_published_on_each_line():
    """The label and the value printed beside it are one physical row, so
    they must share a row_index and differ in column_index - that pairing
    coordinate is what merge_label_value_columns matches on."""
    from backend.ocr_engine import _words_to_lines

    def w(text, x0, x1, y0):
        return {"text": text, "bbox": [x0, y0, x1, y0 + 20], "confidence": 0.9,
                "image_index": 1, "pass_index": 0}

    out = _words_to_lines([
        w("MRP", 20, 70, 100), w("60.00", 600, 700, 100),
        w("NET", 20, 70, 200), w("400g", 600, 700, 200),
    ], 1)
    by_text = {line.text: line for line in out}
    assert by_text["MRP"].row_index == by_text["60.00"].row_index
    assert by_text["NET"].row_index == by_text["400g"].row_index
    assert by_text["MRP"].row_index != by_text["NET"].row_index
    assert by_text["MRP"].column_index == 0
    assert by_text["60.00"].column_index == 1


def test_row_indices_count_downward_from_the_top():
    from backend.ocr_engine import _words_to_lines

    def w(text, y0):
        return {"text": text, "bbox": [20, y0, 200, y0 + 20], "confidence": 0.9,
                "image_index": 1, "pass_index": 0}

    out = _words_to_lines([w("THIRD", 300), w("FIRST", 100), w("SECOND", 200)], 1)
    assert [line.row_index for line in out] == [0, 1, 2]


# --------------------------------------------------------------------------
# Geometric label -> value pairing (two-column declaration tables)
# --------------------------------------------------------------------------

def B(text, x0, y0, x1, y1, conf=0.9, image_index=1):
    """OCRLine with real geometry, for the pairing tests."""
    return OCRLine(text=text, bbox=[x0, y0, x1, y1],
                   confidence=conf, image_index=image_index)


def test_value_to_the_right_is_paired_across_interleaved_rows():
    """The table case. Labels sit in a left column, values in a right one.
    In LIST order the label's own value is not adjacent - the next list
    entry is the following row's label. Only geometry pairs them."""
    lines = [
        B("NET WEIGHT:", 230, 700, 300, 712),
        B("110 g",       340, 700, 400, 712),
        B("MFG. DATE:",  230, 720, 300, 732),
        B("31JUL2026",   340, 720, 410, 732),
    ]
    out = extract_declarations(lines)
    qty = out["declarations"]["net_quantity"]
    assert qty["value"] == "110" and qty["unit"] == "g"


def test_value_below_still_pairs():
    """The stacked case must keep working - geometry must not only handle
    columns."""
    lines = [
        B("MANUFACTURED FOR:", 100, 500, 260, 515),
        B("PARLE BISCUITS PVT LTD", 100, 520, 300, 535),
    ]
    v = {k: ev.get("value") for k, ev in
         extract_declarations(lines)["declarations"].items() if isinstance(ev, dict)}
    assert v["manufacturer"] == "PARLE BISCUITS PVT LTD"


def test_far_away_line_is_not_paired():
    """A line on the other side of the pack is not this label's value."""
    lines = [
        B("MANUFACTURED FOR:", 100, 500, 260, 515),
        B("SOME OTHER BLOCK PVT LTD", 100, 900, 320, 915),
    ]
    v = {k: ev.get("value") for k, ev in
         extract_declarations(lines)["declarations"].items() if isinstance(ev, dict)}
    assert v["manufacturer"] is None


def test_geometric_pairing_respects_image_boundary():
    """P1 invariant holds through the new path: a value on another image is
    not a candidate however well its box happens to align."""
    lines = [
        B("MANUFACTURED FOR:", 100, 500, 260, 515, image_index=1),
        B("PARLE BISCUITS PVT LTD", 280, 500, 480, 515, image_index=2),
    ]
    v = {k: ev.get("value") for k, ev in
         extract_declarations(lines)["declarations"].items() if isinstance(ev, dict)}
    assert v["manufacturer"] is None


def test_list_order_fallback_when_geometry_is_unavailable():
    """Degenerate/identical boxes (as produced by upstream code that does not
    set geometry) must fall back to the previous list-order behaviour rather
    than failing to pair at all."""
    v, _ = values([
        L("MANUFACTURED FOR:"),
        L("PARLE BISCUITS PVT LTD"),
    ])
    assert v["manufacturer"] == "PARLE BISCUITS PVT LTD"


# --------------------------------------------------------------------------
# Declaration-table pairing (ordinal indexing)
# --------------------------------------------------------------------------

def _bikaji_table():
    """Bikaji's declaration sticker: labels left, values right, with the real
    one-row vertical offset between the two columns. Widths match the boxes
    the OCR engine actually produced for this pack."""
    rows = [("NET WEIGHT:", 80), ("MFG. DATE:", 72), ("BATCH NO.:", 76),
            ("USE BY", 52), ("MAX RETAIL PRICE", 100), ("USP PER g:", 66)]
    vals = [("110g", 40), ("31JUL2026", 74), ("K26G69149", 80),
            ("30JAN2027", 74), ("50.00", 48), ("0.45/g", 52)]
    out = [B(t, 230, 700 + 20 * i, 230 + w, 714 + 20 * i)
           for i, (t, w) in enumerate(rows)]
    out += [B(t, 340, 718 + 20 * i, 340 + w, 732 + 20 * i)
            for i, (t, w) in enumerate(vals)]
    return out


def test_columns_merge_and_pair_by_rank():
    """The point of the matcher: the value column sits one row higher than
    the label column, so no row-based pairing works. Rank pairing gets all
    six right, and the values arrive through the ORDINARY extractors -
    which is the design goal, since they see a same-line label+value."""
    d = extract_declarations(_bikaji_table())["declarations"]
    assert d["net_quantity"]["value"] == "110"
    assert d["net_quantity"]["unit"] == "g"
    assert d["mrp"]["value"] == "50.00"
    assert d["unit_sale_price"]["value"] == "0.45"
    assert d["manufacturing_date"]["value"] == "31JUL2026"
    assert d["expiry_date"]["value"] == "30JAN2027"
    assert d["manufacturing_date"]["date_role"] == "manufacturing"
    assert d["expiry_date"]["date_role"] == "best_before_use_by"


def test_merge_does_not_confuse_mrp_with_unit_price():
    """Nearest-neighbour pairing reports the per-unit price as the MRP on
    this layout, because the value column is offset upward."""
    labels = [("#MRP Rs.", 40), ("USP Rs.", 65), ("BATCH NO.", 90),
              ("MFD.", 115), ("USE BY.", 140)]
    vals = [("20.00", 10), ("0.111/-ml", 40), ("SP7919H27D26", 68),
            ("27/04/26 19:46", 96), ("23/10/26", 124)]
    lines = [B(t, 50, y, 140, y + 16) for t, y in labels]
    lines += [B(t, 180, y, 300, y + 16) for t, y in vals]
    d = extract_declarations(lines)["declarations"]
    assert d["mrp"]["value"] == "20.00"
    assert d["unit_sale_price"]["value"] == "0.111"


def test_no_merge_when_counts_mismatch():
    """A dropped OCR line would shift every pairing by one, attaching the
    wrong value to every label below it. The block must be rejected whole."""
    lines = [l for l in _bikaji_table() if l.text != "0.45/g"]
    merged = merge_label_value_columns(lines)
    assert len(merged) == len(lines)


def test_no_merge_when_a_left_band_line_is_not_a_label():
    """Stray OCR noise in the label column means we do not understand the
    block's shape, so nothing is paired."""
    lines = _bikaji_table() + [B("~ ,, x", 230, 700 - 20, 300, 700 - 6)]
    merged = merge_label_value_columns(lines)
    assert len(merged) == len(lines)


def test_single_column_pack_is_unaffected():
    """Regression guard: an ordinary same-line pack must not be detected as
    a two-column block."""
    lines = [
        B("MANUFACTURED BY: NUTRI FOODS PVT LTD", 100, 100, 420, 116),
        B("MRP Rs 199.00", 100, 130, 260, 146),
        B("Net Qty: 250 g", 100, 160, 250, 176),
    ]
    assert len(merge_label_value_columns(lines)) == len(lines)
    d = extract_declarations(lines)["declarations"]
    assert d["mrp"]["value"] == "199.00"
    assert d["net_quantity"]["value"] == "250"


# --------------------------------------------------------------------------
# Wrapped two-column values (MFD date + time on separate right-column lines)
# --------------------------------------------------------------------------
# A right-column value can legitimately spill onto a second physical OCR
# line - most commonly an MFD date with its time printed just underneath -
# without that being a dropped/extra declaration row. merge_label_value_
# columns must fold the wrap back into its own row instead of rejecting the
# whole block (which would silently lose every field in it, not just MFD).

def _wrapped_mfd_table():
    """Same shape as _bikaji_table's five-row layout, except the MFD row's
    value spills onto a second right-column line ("13:46" under
    "27-08-26"), well clear of the USE BY row beneath it."""
    rows = [("MRP Rs.", 0), ("USP Rs.", 40), ("BATCH NO.", 80),
            ("MFD.", 120), ("USE BY.", 200)]
    labels = [B(t, 50, y, 140, y + 14) for t, y in rows]
    vals = [
        B("20.00", 180, 0, 260, 14),
        B("0.111/ml", 180, 40, 260, 54),
        B("SP7939H27?2026", 180, 80, 300, 94),
        B("27-08-26", 180, 120, 260, 134),
        B("13:46", 180, 138, 240, 152),
        B("23-01-26", 180, 200, 260, 214),
    ]
    return labels + vals


def test_wrapped_mfd_value_pairs_with_its_own_label():
    """TEST 7 / TEST E — a right-column value split across two OCR lines
    ("27-08-26" then "13:46") must still resolve to the MFD row, not be
    dropped or bleed into USE BY."""
    d = extract_declarations(_wrapped_mfd_table())["declarations"]
    assert d["manufacturing_date"]["value"] == "27-08-26"
    assert d["manufacturing_date"]["date_role"] == "manufacturing"
    assert d["expiry_date"]["value"] == "23-01-26"
    assert d["expiry_date"]["date_role"] == "best_before_use_by"


def test_wrapped_value_does_not_pollute_use_by():
    """The wrapped continuation line ("13:46") must not become part of, or
    displace, the USE BY row's own value."""
    d = extract_declarations(_wrapped_mfd_table())["declarations"]
    assert "13:46" not in (d["expiry_date"]["raw_text"] or "")


def test_other_rows_in_a_wrapped_block_are_unaffected():
    """The wrap only touches the MFD row; every other row in the same block
    must still resolve exactly as the unwrapped table does."""
    d = extract_declarations(_wrapped_mfd_table())["declarations"]
    assert d["mrp"]["value"] == "20.00"
    assert d["unit_sale_price"]["value"] == "0.111"


def test_genuinely_dropped_line_still_rejects_whole_block():
    """A wrap is not a licence to paper over an actually-missing value on a
    block that has no wrap at all - the plain dropped-line case must still
    reject the block exactly as before."""
    lines = [l for l in _bikaji_table() if l.text != "0.45/g"]
    merged = merge_label_value_columns(lines)
    assert len(merged) == len(lines)


def test_two_extra_right_lines_do_not_get_guessed_at():
    """More than one extra right-column line is not a single clean wrap -
    collapsing it would be a guess, so the block is rejected whole rather
    than silently mispaired."""
    lines = _wrapped_mfd_table() + [B("STRAY", 180, 220, 220, 234)]
    merged = merge_label_value_columns(lines)
    assert len(merged) == len(lines)


# --------------------------------------------------------------------------
# Spatial MFD / EXP date association outside a validated table block
# --------------------------------------------------------------------------
# merge_label_value_columns only fires on a full, validated declaration
# table (>= 2 rows per column, every left line a known label, counts
# matching). A lone "MFD." / "USE BY." label with its date to the right is
# common on smaller packs and never forms a "table" by that definition, so
# date extraction must still find it directly via the same geometric
# label -> value search net_quantity and manufacturer already use.

def test_standalone_mfd_label_finds_date_via_geometry():
    lines = [
        B("MFD.", 50, 100, 90, 114),
        B("27-08-26 13:46", 180, 100, 300, 114),
        B("USE BY.", 50, 140, 110, 154),
        B("23-01-26", 180, 140, 260, 154),
    ]
    d = extract_declarations(lines)["declarations"]
    assert d["manufacturing_date"]["value"] == "27-08-26"
    assert d["manufacturing_date"]["date_role"] == "manufacturing"
    assert d["expiry_date"]["value"] == "23-01-26"
    assert d["expiry_date"]["date_role"] == "best_before_use_by"


def test_standalone_use_by_label_value_below_finds_date_via_geometry():
    """The stacked case (value directly under its label) must work for
    dates exactly as it already does for manufacturer/common_name."""
    lines = [
        B("USE BY.", 50, 100, 100, 114),
        B("23-01-26", 50, 118, 130, 132),
    ]
    d = extract_declarations(lines)["declarations"]
    assert d["expiry_date"]["value"] == "23-01-26"
    assert d["expiry_date"]["date_role"] == "best_before_use_by"


def test_geometric_date_association_does_not_cross_images():
    """A bare MFD label on one image and an unrelated date on another are
    never associated - the date is, at most, surfaced unattributed."""
    lines = [
        B("MFD.", 50, 100, 90, 114, image_index=1),
        B("23-01-26", 180, 100, 260, 114, image_index=2),
    ]
    d = extract_declarations(lines)["declarations"]
    assert d["manufacturing_date"]["date_role"] != "manufacturing"
    assert d["expiry_date"]["value"] is None


# --------------------------------------------------------------------------
# Whole-photo orientation + over-printed declaration stickers
# --------------------------------------------------------------------------
# The "Pineapple Delight" carton: dot-matrix declarations over-printed on a
# glossy panel, photographed upside down. Two independent hazards in one
# image - the frame is inverted, and the value column sits a full row above
# its labels, so the OCR engine's own row clustering pairs each label with
# the row above's value. These go through _words_to_lines, NOT hand-built
# OCRLines, so the row_index/column_index the engine really produces is
# what gets tested.

def _pineapple_words(rotated=False):
    panel = [("#MRP Rs.", 50, 40, 140, 56), ("USP Rs.", 50, 65, 140, 81),
             ("BATCH NO.", 50, 90, 140, 106), ("MFD.", 50, 115, 140, 131),
             ("USE BY.", 50, 140, 140, 156),
             ("20.00", 180, 10, 300, 26), ("0.111/-ml", 180, 40, 300, 56),
             ("SP7919H27D26", 180, 68, 300, 84),
             ("27/04/26 19:46", 180, 96, 300, 112),
             ("23/10/26", 180, 124, 300, 140)]
    width, height = 350, 200
    words = []
    for text, x0, y0, x1, y1 in panel:
        bbox = [width - x1, height - y1, width - x0, height - y0] if rotated \
            else [x0, y0, x1, y1]
        words.append({"text": text, "bbox": bbox, "confidence": 0.88,
                      "image_index": 1, "pass_index": 0})
    return words


def _pineapple_values(rotated):
    from backend.ocr_engine import _orient
    declarations = extract_declarations(
        _orient(_pineapple_words(rotated), 1))["declarations"]
    return {k: v.get("value") for k, v in declarations.items()
            if isinstance(v, dict)}


def test_overprinted_sticker_is_not_paired_a_row_out():
    """The engine's row clustering puts "#MRP Rs." in the same row band as
    the per-ml price and "BATCH NO." in the same band as the manufacturing
    date, because the value column is over-printed one row high. A row
    coordinate that explains only some of the labels must not be trusted
    over the ordinal reading that explains all of them."""
    v = _pineapple_values(rotated=False)
    assert v["mrp"] == "20.00"
    assert v["unit_sale_price"] == "0.111"
    assert v["manufacturing_date"] == "27/04/26"
    assert v["expiry_date"] == "23/10/26"


def test_upside_down_photo_extracts_the_same_declarations():
    """Same panel, photographed 180 degrees out. The angle classifier
    recovers the text but leaves the boxes in the photo's frame, so without
    correction the label column sits to the RIGHT of its values and the
    rows read bottom-to-top."""
    assert _pineapple_values(rotated=True) == _pineapple_values(rotated=False)


def test_orientation_is_scored_on_layout_not_text():
    """An inverted frame scores lower because its labels have no value to
    the right of, or below, them."""
    from backend.ocr_engine import (_orientation_score, _words_to_lines,
                                    _merge_words_across_passes)

    def read(rotated):
        return _words_to_lines(
            _merge_words_across_passes(_pineapple_words(rotated)), 1)

    assert _orientation_score(read(False)) > _orientation_score(read(True))


def test_upright_photo_is_left_alone():
    """A flip is only applied when it strictly improves the layout score, so
    an already-upright single-column pack is untouched."""
    from backend.ocr_engine import _orient

    def w(text, x0, x1, y0):
        return {"text": text, "bbox": [x0, y0, x1, y0 + 16], "confidence": 0.9,
                "image_index": 1, "pass_index": 0}

    out = _orient([w("Net Qty:", 20, 100, 100), w("250 g", 110, 180, 100),
                   w("MRP Rs", 20, 100, 130), w("199.00", 110, 180, 130)], 1)
    assert [line.text for line in out][0].startswith("Net Qty")


# --------------------------------------------------------------------------
# Schema round-trip — catches values field_extractors.py produces that
# schemas.py silently drops or rejects before rule_engine.py ever sees them.
#
# Every other test above asserts against the raw pipeline dict. main.py
# never hands rule_engine.py the raw dict: it goes through
# StructuredDeclarations.model_validate(...).model_dump() first. A value
# that is valid in the raw dict but not declared in schemas.py either
# crashes there (unrecognized enum member -> ValidationError -> 500) or is
# silently stripped (extra="ignore" on an undeclared field) - either way,
# rule_engine.py's corresponding branch (unit_status == "ocr_corrected",
# origin_conflict) never actually fires in production, and no test above
# would notice.
# --------------------------------------------------------------------------

def _round_trip(declarations: dict) -> dict:
    from .schemas import StructuredDeclarations
    return StructuredDeclarations.model_validate(declarations).model_dump()


def test_ocr_corrected_unit_status_survives_schema_round_trip():
    out = extract_declarations([L("NET QTY 4009", conf=0.62)])
    dumped = _round_trip(out["declarations"])
    assert dumped["net_quantity"]["unit_status"] == "ocr_corrected"


def test_origin_conflict_survives_schema_round_trip():
    out = extract_declarations([L("Made in India. Imported by ABC Pvt Ltd")])
    dumped = _round_trip(out["declarations"])
    assert dumped["country_of_origin"]["origin_conflict"] is True


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


# --------------------------------------------------------------------------
# Monster 350ml can — declarations split across the label and the can base
# --------------------------------------------------------------------------

def _monster_can():
    """Back label (image 1) plus the inkjet-coded can base (image 2)."""
    return [
        B("HIGH CAFFEINE (105 mg/350 ml), NOT RECOMMENDED", 280, 140, 700, 170, conf=0.8),
        B("SENSITIVE TO CAFFEINE. CONSUME NOT MORE THAN 500ml PER DAY.", 280, 210, 700, 240, conf=0.8),
        B("ERYTHRITOL, TAURINE (400 mg/100 ml), FLAVORS", 280, 280, 700, 310, conf=0.78),
        B("NUTRITION INFORMATION PER 1 SERVING IN 1 CONTAINER (350 ml)", 280, 405, 700, 435, conf=0.78),
        B("CHOLESTEROL 0 mg (0% RDA), SODIUM 276 mg (14% RDA)", 280, 490, 700, 520, conf=0.78),
        B("NET QUANTITY.", 283, 1262, 420, 1292),
        B("350 ml", 510, 1258, 580, 1292),
        B("MFG:28/JUL/26 22:55", 230, 430, 570, 470, conf=0.62, image_index=2),
        B("H) EXP:28/JUL/28", 270, 585, 530, 625, conf=0.6, image_index=2),
        B("USP Rs.0.36/ml", 300, 640, 500, 680, conf=0.55, image_index=2),
    ]


def test_net_quantity_label_with_a_trailing_period_is_recognised():
    """The can prints "NET QUANTITY." - the label patterns accepted ":" and
    "-" after a label but not a full stop, so the label was invisible and
    extraction fell through to the unlabelled scan."""
    d = extract_declarations(_monster_can())["declarations"]
    assert d["net_quantity"]["value"] == "350"
    assert d["net_quantity"]["unit"] == "ml"


def test_caffeine_warning_is_never_the_net_quantity():
    """"HIGH CAFFEINE (105 mg/350 ml)" is the first number+unit on the
    panel. Even with no net-quantity label at all, a figure inside a
    warning, an ingredients list or a nutrition table must not be taken as
    the declared quantity."""
    lines = [l for l in _monster_can() if l.text != "NET QUANTITY."]
    lines = [l for l in lines if l.text != "350 ml"]
    d = extract_declarations(lines)["declarations"]
    assert d["net_quantity"]["value"] is None


def test_dates_come_from_the_can_base_not_the_label():
    d = extract_declarations(_monster_can())["declarations"]
    assert d["manufacturing_date"]["value"] == "28/JUL/26"
    assert d["manufacturing_date"]["image_index"] == 2
    assert d["expiry_date"]["value"] == "28/JUL/28"
    assert d["expiry_date"]["image_index"] == 2


def test_extra_ocr_passes_are_tagged_and_fused():
    """Each preprocessing variant must report under its own pass_index, in
    original-image coordinates, so _merge_words_across_passes can recognise
    two passes reading the same word and keep the better one."""
    from backend.ocr_engine import (PaddleOCRBackend, _rescale_words,
                                    _merge_words_across_passes, _words_to_lines)

    class FakeEngine:
        """Pass 0 misreads the day as "2B"; a later pass gets "28"."""
        def __init__(self):
            self.calls = 0

        def ocr(self, target, cls=True):
            self.calls += 1
            text, score = ("MFG:2B/JUL/26", 0.41) if self.calls == 1 \
                else ("MFG:28/JUL/26", 0.88)
            scale = 1 if self.calls == 1 else 2
            box = [[10 * scale, 10 * scale], [300 * scale, 10 * scale],
                   [300 * scale, 40 * scale], [10 * scale, 40 * scale]]
            return [[[box, (text, score)]]]

    backend = PaddleOCRBackend(engine=FakeEngine())
    pass0 = backend._words_from_result(backend._run_engine("x"), 1)
    pass1 = backend._words_from_result(backend._run_engine("x"), 1)
    for w in pass1:
        w["pass_index"] = 1
    words = pass0 + _rescale_words(pass1, 2.0)
    lines = _words_to_lines(_merge_words_across_passes(words), 1)
    assert lines[0].text == "MFG:28/JUL/26"


def test_preprocessing_variants_do_not_destroy_the_dots():
    """Variant generation must return the original untouched as pass 0 and
    add variants, never replace or erode the source."""
    import numpy as np
    from backend.ocr_engine import _preprocess_variants
    image = np.full((60, 200, 3), 200, dtype=np.uint8)
    image[28:32, 40:44] = 20          # a dot of a dot-matrix glyph
    variants = _preprocess_variants(image)
    assert variants[0][0] == "original"
    assert variants[0][1] is image
    assert len(variants) > 1
    for _, variant in variants[1:]:
        assert variant.min() < variant.max()   # the dot survived
