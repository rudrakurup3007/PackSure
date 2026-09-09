"""
PackSure — two-column layout + label/value association tests
(no OCR, no images required)

These exercise merge_label_value_columns() and the field extractors
directly on hand-built OCRLine objects with real bounding boxes, the same
style already used by the column-pairing tests in test_extraction_smoke.py.
Going straight to the extractors (rather than through pipeline.extract_
declarations) keeps these focused on the OCR-layout + association problem
the two fix requests describe, independent of the rest of the pipeline.

Run from the project root:
    python -m pytest ocr_extraction/test_field_extractors.py -q
"""

from .ocr_engine import OCRLine
from .field_extractors import (
    merge_label_value_columns,
    extract_net_quantity,
    extract_mrp,
    extract_manufacturing_and_expiry_dates,
)


def B(text, x0, y0, x1, y1, conf=0.9, image_index=1):
    return OCRLine(text=text, bbox=[x0, y0, x1, y1], confidence=conf, image_index=image_index)


def R(text, x0, y0, x1, y1, row=None, col=None, conf=0.9, image_index=1):
    """OCRLine carrying the row/column coordinates ocr_engine now sets."""
    return OCRLine(text=text, bbox=[x0, y0, x1, y1], confidence=conf,
                   image_index=image_index, row_index=row, column_index=col)


def _synth_texts(original, merged):
    """The set of texts merge_label_value_columns() added on top of the
    lines that were already there."""
    original_texts = {l.text for l in original}
    return {l.text for l in merged if l.text not in original_texts}


# ==========================================================================
# Two-column layout — declarations table (MRP / batch / MFD / USE BY)
# ==========================================================================

def _declarations_table(image_index=1):
    labels = [("MRP Rs.", 40), ("USP Rs.", 40), ("BATCH NO.", 60),
              ("MFD.", 30), ("USE BY.", 40)]
    values = [("₹ 20.00", 60), ("₹ 0.111/ml", 70), ("SP7939H27?2026", 90),
              ("27-08-26 13:46", 90), ("23-01-26", 60)]
    lines = [B(t, 0, 100 + 30 * i, w, 116 + 30 * i, image_index=image_index)
             for i, (t, w) in enumerate(labels)]
    lines += [B(t, 250, 101 + 30 * i, 250 + w, 117 + 30 * i, image_index=image_index)
              for i, (t, w) in enumerate(values)]
    return lines


def test_two_column_mrp():
    """TEST 1 / TEST 1 (doc): MRP label left, value right."""
    lines = _declarations_table()
    merged = merge_label_value_columns(lines)
    mrp = extract_mrp(merged)
    assert mrp["value"] == "20.00"


def test_two_column_batch():
    """TEST 2: batch number extracted from the right column."""
    lines = _declarations_table()
    merged = merge_label_value_columns(lines)
    synth = _synth_texts(lines, merged)
    assert any("BATCH NO." in t and "SP7939H27?2026" in t for t in synth)


def test_two_column_mfd():
    """TEST 3: manufacturing date extracted correctly."""
    lines = _declarations_table()
    merged = merge_label_value_columns(lines)
    mfg, _ = extract_manufacturing_and_expiry_dates(merged)
    assert mfg["value"] == "27-08-26"
    assert mfg["date_role"] == "manufacturing"


def test_two_column_use_by():
    """TEST 4: expiry/use-by date extracted correctly, and not confused
    with the manufacturing date."""
    lines = _declarations_table()
    merged = merge_label_value_columns(lines)
    mfg, exp = extract_manufacturing_and_expiry_dates(merged)
    assert exp["value"] == "23-01-26"
    assert exp["date_role"] == "best_before_use_by"
    assert mfg["value"] != exp["value"]


def test_single_column_layout_unchanged():
    """TEST 5: an ordinary same-line pack is not touched by the two-column
    matcher at all."""
    lines = [B("MRP: ₹20", 40, 40, 140, 56)]
    merged = merge_label_value_columns(lines)
    assert len(merged) == len(lines)
    assert extract_mrp(merged)["value"] == "20"


def test_multi_image_two_column_tables_do_not_cross_pair():
    """TEST 6: image 1's MRP table and image 2's batch table must each be
    paired only within their own image."""
    image1 = [
        B("MRP Rs.", 0, 100, 60, 116, image_index=1),
        B("USP Rs.", 0, 130, 60, 146, image_index=1),
        B("₹ 20.00", 250, 101, 320, 117, image_index=1),
        B("₹ 0.10/ml", 250, 131, 330, 147, image_index=1),
    ]
    image2 = [
        B("BATCH NO.", 0, 100, 80, 116, image_index=2),
        B("MFD.", 0, 130, 60, 146, image_index=2),
        B("ABC123", 250, 101, 320, 117, image_index=2),
        B("27-08-26", 250, 131, 330, 147, image_index=2),
    ]
    merged = merge_label_value_columns(image1 + image2)
    synth = _synth_texts(image1 + image2, merged)
    assert any("MRP Rs." in t and "20.00" in t for t in synth)
    assert any("BATCH NO." in t and "ABC123" in t for t in synth)
    # No synthesized line may combine text from both images' fields.
    assert not any("MRP" in t and "ABC123" in t for t in synth)
    assert not any("BATCH" in t and "20.00" in t for t in synth)
    for line in merged:
        if line.text not in {l.text for l in image1 + image2}:
            # Every synthesized line's evidence must point at one image.
            assert line.image_index in (1, 2)


def test_wrapped_right_column_value_stays_with_its_row():
    """TEST 7: MFD's value wraps onto a second OCR line (date, then time).
    Both lines must belong to MFD, and "13:46" must never be assigned to
    USE BY."""
    lines = [
        B("MRP Rs.", 0, 40, 60, 56),
        B("USP Rs.", 0, 65, 60, 81),
        B("BATCH NO.", 0, 90, 80, 106),
        B("MFD.", 0, 115, 60, 131),
        B("USE BY.", 0, 140, 70, 156),
        B("20.00", 200, 41, 250, 57),
        B("0.111/-ml", 200, 66, 270, 82),
        B("SP7919H27D26", 200, 91, 320, 107),
        B("27-08-26", 200, 116, 260, 132),
        B("13:46", 200, 134, 230, 150),   # tightly wrapped under the date
        B("23-01-26", 200, 141, 260, 157),
    ]
    merged = merge_label_value_columns(lines)
    mfg, exp = extract_manufacturing_and_expiry_dates(merged)
    assert mfg["value"] == "27-08-26"
    assert mfg["date_role"] == "manufacturing"
    assert exp["value"] == "23-01-26"
    assert exp["date_role"] == "best_before_use_by"
    # The wrapped continuation line must have been folded into MFD's row,
    # not left to seed a phantom row of its own.
    synth = _synth_texts(lines, merged)
    assert any("MFD." in t and "27-08-26" in t and "13:46" in t for t in synth)


# ==========================================================================
# NET QUANTITY — spatial association, not global regex search
# ==========================================================================

def test_A_net_quantity_not_confused_with_nutrition_table():
    """TEST A: NET QTY / MRP / a nutrition-table quantity all present -
    net_quantity must come from NET QTY's own row, not the nutrition row."""
    lines = [
        B("NET QTY", 40, 40, 100, 56),
        B("MRP", 40, 65, 90, 81),
        B("Nutrition", 40, 90, 110, 106),
        B("400 g", 200, 41, 250, 57),
        B("Rs 20", 200, 66, 260, 82),
        B("100 g", 200, 91, 250, 107),
    ]
    merged = merge_label_value_columns(lines)
    qty = extract_net_quantity(merged)
    assert qty["value"] == "400"
    assert qty["unit"] == "g"


def test_B_net_quantity_value_below_the_label():
    """TEST B: NET QTY label, value stacked directly beneath it - the
    plain single-column label/value fallback, unaffected by the two-column
    matcher (too few lines to look like a table)."""
    lines = [
        B("NET QTY", 40, 40, 110, 56),
        B("400 g", 40, 60, 100, 76),
    ]
    merged = merge_label_value_columns(lines)
    qty = extract_net_quantity(merged)
    assert qty["value"] == "400"
    assert qty["unit"] == "g"


def test_C_mrp_and_net_quantity_do_not_cross_pair():
    """TEST C: MRP then NET QTY as two rows - each keeps its own value."""
    lines = [
        B("MRP", 40, 40, 90, 56),
        B("NET QTY", 40, 65, 110, 81),
        B("20", 200, 41, 230, 57),
        B("400 g", 200, 66, 260, 82),
    ]
    merged = merge_label_value_columns(lines)
    assert extract_net_quantity(merged)["value"] == "400"
    assert extract_mrp(merged)["value"] == "20"


def test_D_mfd_and_use_by_both_present_same_line_pairs():
    """TEST D: MFD and USE BY on their own rows, same-line label/value
    style once paired."""
    lines = [
        B("MFD", 40, 40, 90, 56),
        B("USE BY", 40, 65, 100, 81),
        B("27-08-26 13:46", 200, 41, 320, 57),
        B("23-01-26", 200, 66, 280, 82),
    ]
    merged = merge_label_value_columns(lines)
    mfg, exp = extract_manufacturing_and_expiry_dates(merged)
    assert mfg["value"] == "27-08-26"
    assert exp["value"] == "23-01-26"


def test_G_single_column_pack_regression():
    """TEST G: an ordinary single-column pack must extract exactly as
    before - no two-column matcher involvement at all."""
    lines = [
        B("NET QTY: 400 g", 40, 40, 200, 56),
        B("MRP: Rs 20", 40, 65, 200, 81),
        B("MFD: 27-08-26", 40, 90, 220, 106),
        B("USE BY: 23-01-26", 40, 115, 230, 131),
    ]
    merged = merge_label_value_columns(lines)
    assert len(merged) == len(lines)
    assert extract_net_quantity(merged)["value"] == "400"
    assert extract_mrp(merged)["value"] == "20"
    mfg, exp = extract_manufacturing_and_expiry_dates(merged)
    assert mfg["value"] == "27-08-26"
    assert exp["value"] == "23-01-26"


def test_H_multi_image_scan_no_cross_field_association():
    """TEST H: MRP lives on image 1, NET QTY on image 2 - neither may
    borrow the other's value."""
    lines = [
        B("MRP ₹20", 40, 40, 120, 56, image_index=1),
        B("NET QTY 400 g", 40, 40, 160, 56, image_index=2),
    ]
    mrp = extract_mrp(lines)
    qty = extract_net_quantity(lines)
    assert mrp["value"] == "20"
    assert mrp["image_index"] == 1
    assert qty["value"] == "400"
    assert qty["unit"] == "g"
    assert qty["image_index"] == 2


# ==========================================================================
# Regression guards — behaviour that must survive these changes untouched
# ==========================================================================

def test_dropped_line_still_rejects_the_whole_block():
    """A genuinely MISSING right-column value (not a wrap) must still
    reject the whole block rather than shift every later pairing by one."""
    labels = [("NET WEIGHT:", 80), ("MFG. DATE:", 72), ("BATCH NO.:", 76),
              ("USE BY", 52), ("MAX RETAIL PRICE", 100), ("USP PER g:", 66)]
    values = [("110g", 40), ("31JUL2026", 74), ("K26G69149", 80),
              ("30JAN2027", 74), ("50.00", 48)]  # USP's value dropped
    lines = [B(t, 230, 700 + 20 * i, 230 + w, 714 + 20 * i)
             for i, (t, w) in enumerate(labels)]
    lines += [B(t, 340, 718 + 20 * i, 340 + w, 732 + 20 * i)
              for i, (t, w) in enumerate(values)]
    merged = merge_label_value_columns(lines)
    assert len(merged) == len(lines)


def test_complete_row_cover_beats_geometry_and_list_position():
    """The value column is printed a full row BELOW its labels, so every
    geometric row band lines up with the wrong label - but the OCR engine
    put each label and its value in the same row_index. The explicit row
    coordinate must win over both geometry and list order - it explains
    every label in the block, so nothing is left stranded."""
    lines = [
        R("MRP Rs.", 0, 100, 60, 116, row=0, col=0),
        R("BATCH NO.", 0, 130, 80, 146, row=1, col=0),
        R("₹ 20.00", 200, 128, 270, 144, row=0, col=1),
        R("SP123", 200, 158, 270, 174, row=1, col=1),
    ]
    synth = _synth_texts(lines, merge_label_value_columns(lines))
    assert any("MRP Rs." in t and "20.00" in t for t in synth)
    assert any("BATCH NO." in t and "SP123" in t for t in synth)
    assert not any("BATCH" in t and "20.00" in t for t in synth)


def _four_row_table(values):
    """Four labelled rows; `values` supplies the right column as
    (text, y, row_index) triples so a test can drop or add lines."""
    labels = [("MRP Rs.", 60), ("BATCH NO.", 80), ("MFD.", 60), ("USE BY.", 70)]
    lines = [R(t, 0, 100 + 30 * i, w, 116 + 30 * i, row=i, col=0)
             for i, (t, w) in enumerate(labels)]
    lines += [R(t, 200, y, 290, y + 16, row=r, col=1) for t, y, r in values]
    return lines


def test_dropped_value_does_not_shift_the_rows_below_it():
    """The MRP row's value never made it out of OCR. Every OTHER row must
    still pair with its own value - the drop may not shift them up by one,
    and it may not take the whole block down with it either."""
    lines = _four_row_table([("SP123", 131, 1), ("27-08-26", 161, 2),
                             ("23-01-26", 191, 3)])
    merged = merge_label_value_columns(lines)
    synth = _synth_texts(lines, merged)
    assert any("BATCH NO." in t and "SP123" in t for t in synth)
    assert not any("MRP" in t and "SP123" in t for t in synth)
    mfg, exp = extract_manufacturing_and_expiry_dates(merged)
    assert mfg["value"] == "27-08-26"
    assert exp["value"] == "23-01-26"
    assert extract_mrp(merged)["value"] != "123"


def test_extra_right_column_line_does_not_shift_later_pairs():
    """A stray extra detection in the right column belongs to no label's
    row. It must be ignored, not consumed by the row above or allowed to
    push every following value onto the wrong label."""
    lines = _four_row_table([("20.00", 101, 0), ("SP123", 131, 1),
                             ("27-08-26", 161, 2), ("23-01-26", 191, 3),
                             ("STRAYLINE", 260, 4)])
    merged = merge_label_value_columns(lines)
    synth = _synth_texts(lines, merged)
    assert any("MRP Rs." in t and "20.00" in t for t in synth)
    assert any("USE BY." in t and "23-01-26" in t for t in synth)
    assert not any("STRAYLINE" in t for t in synth)
    mfg, exp = extract_manufacturing_and_expiry_dates(merged)
    assert mfg["value"] == "27-08-26"
    assert exp["value"] == "23-01-26"


def test_drop_and_extra_together_are_not_mispaired():
    """The case equal-counts could never catch: one value dropped and one
    stray line added leaves both columns the same length, so ordinal
    pairing shifted every row below the drop while looking perfectly
    well-formed. MFD must not inherit the USE BY date."""
    lines = _four_row_table([("SP123", 131, 1), ("27-08-26", 161, 2),
                             ("23-01-26", 191, 3), ("STRAYLINE", 260, 4)])
    merged = merge_label_value_columns(lines)
    synth = _synth_texts(lines, merged)
    assert not any("MFD." in t and "23-01-26" in t for t in synth)
    assert not any("MRP" in t and "SP123" in t for t in synth)
    mfg, exp = extract_manufacturing_and_expiry_dates(merged)
    assert mfg["value"] == "27-08-26"
    assert exp["value"] == "23-01-26"


def test_wrapped_value_folds_into_its_own_row_by_row_index():
    """A value that spilled onto a second OCR line gets its own row_index
    with no label in it. It belongs to the row above, not to the labelled
    row beneath it."""
    lines = [
        R("MRP Rs.", 0, 100, 60, 116, row=0, col=0),
        R("BATCH NO.", 0, 130, 80, 146, row=1, col=0),
        R("MFD.", 0, 160, 60, 176, row=2, col=0),
        R("USE BY.", 0, 220, 70, 236, row=4, col=0),
        R("20.00", 200, 101, 260, 117, row=0, col=1),
        R("SP123", 200, 131, 270, 147, row=1, col=1),
        R("27-08-26", 200, 161, 270, 177, row=2, col=1),
        R("13:46", 200, 180, 240, 196, row=3, col=1),   # wrapped, own row
        R("23-01-26", 200, 221, 270, 237, row=4, col=1),
    ]
    merged = merge_label_value_columns(lines)
    synth = _synth_texts(lines, merged)
    assert any("MFD." in t and "27-08-26" in t and "13:46" in t for t in synth)
    assert not any("USE BY." in t and "13:46" in t for t in synth)
    mfg, exp = extract_manufacturing_and_expiry_dates(merged)
    assert mfg["value"] == "27-08-26"
    assert exp["value"] == "23-01-26"


def test_row_matching_never_pairs_across_images():
    """Identical row indices on two different images are not the same row."""
    lines = [
        R("MRP Rs.", 0, 100, 60, 116, row=0, col=0, image_index=1),
        R("BATCH NO.", 0, 130, 80, 146, row=1, col=0, image_index=1),
        R("20.00", 200, 101, 260, 117, row=0, col=1, image_index=1),
        R("SP123", 200, 131, 270, 147, row=1, col=1, image_index=1),
        R("MFD.", 0, 100, 60, 116, row=0, col=0, image_index=2),
        R("USE BY.", 0, 130, 70, 146, row=1, col=0, image_index=2),
        R("27-08-26", 200, 101, 270, 117, row=0, col=1, image_index=2),
        R("23-01-26", 200, 131, 270, 147, row=1, col=1, image_index=2),
    ]
    synth = _synth_texts(lines, merge_label_value_columns(lines))
    assert any("MRP Rs." in t and "20.00" in t for t in synth)
    assert any("MFD." in t and "27-08-26" in t for t in synth)
    assert not any("MRP" in t and "27-08-26" in t for t in synth)
    assert not any("MFD" in t and "20.00" in t for t in synth)


def test_net_qty_row_beats_a_nutrition_quantity_on_another_row():
    """NET QTY's own row supplies its value; the nutrition table's "100 g"
    two rows down must never reach it."""
    lines = [
        R("NET QTY", 0, 100, 70, 116, row=0, col=0),
        R("MRP", 0, 130, 50, 146, row=1, col=0),
        R("Per serving", 0, 160, 90, 176, row=2, col=0),
        R("400 g", 200, 101, 250, 117, row=0, col=1),
        R("Rs 20", 200, 131, 260, 147, row=1, col=1),
        R("100 g", 200, 161, 250, 177, row=2, col=1),
    ]
    merged = merge_label_value_columns(lines)
    qty = extract_net_quantity(merged)
    assert qty["value"] == "400"
    assert qty["unit"] == "g"


def test_single_column_with_row_indices_is_untouched():
    """One column means no label/value columns to pair, row indices or
    not."""
    lines = [
        R("NET QTY: 400 g", 40, 40, 200, 56, row=0, col=0),
        R("MRP: Rs 20", 40, 65, 200, 81, row=1, col=0),
        R("MFD: 27-08-26", 40, 90, 220, 106, row=2, col=0),
    ]
    assert len(merge_label_value_columns(lines)) == len(lines)


def test_drop_and_extra_without_row_indices_rejects_the_block():
    """Same drop-plus-stray shape, but on lines with no row information at
    all. Equal counts made this look well-formed to ordinal pairing, which
    paired MRP with the batch code and MFD with the expiry date. With no
    row coordinate to appeal to, the block must be rejected outright
    rather than paired on a coincidence of counts."""
    lines = [
        B("MRP Rs.", 0, 100, 60, 116),
        B("BATCH NO.", 0, 130, 80, 146),
        B("MFD.", 0, 160, 60, 176),
        B("USE BY.", 0, 190, 70, 206),
        B("SP123", 200, 131, 270, 147),      # MRP's value never read
        B("27-08-26", 200, 161, 270, 177),
        B("23-01-26", 200, 191, 270, 207),
        B("STRAYLINE", 200, 250, 290, 266),  # unrelated extra detection
    ]
    merged = merge_label_value_columns(lines)
    assert len(merged) == len(lines)


def test_impossible_chronology_is_not_silently_corrected():
    """MFD after USE BY (impossible) must be reported exactly as read, not
    rewritten to make the dates consistent - that judgement belongs to the
    compliance/rule layer, not extraction."""
    lines = [
        B("MFD", 40, 40, 90, 56),
        B("USE BY", 40, 65, 100, 81),
        B("27-08-26", 200, 41, 260, 57),
        B("23-01-26", 200, 66, 260, 82),
    ]
    merged = merge_label_value_columns(lines)
    mfg, exp = extract_manufacturing_and_expiry_dates(merged)
    assert mfg["value"] == "27-08-26"
    assert exp["value"] == "23-01-26"


# ==========================================================================
# Pineapple Delight carton — dot-matrix date noise and an unlabelled name
# ==========================================================================

def test_doubled_separator_from_dot_matrix_coder_still_parses():
    """The coder prints the year separator as "/-"; both dates on the pack
    came back null because the numeric branch allowed only one separator
    character between parts."""
    lines = [B("MFD. 27/04/-26 19:46", 50, 100, 320, 116),
             B("USEBY. 23/10/-26", 50, 130, 300, 146)]
    mfg, exp = extract_manufacturing_and_expiry_dates(lines)
    assert mfg["value"] == "27/04/26"
    assert mfg["date_role"] == "manufacturing"
    assert exp["value"] == "23/10/26"
    assert exp["date_role"] == "best_before_use_by"


def test_misread_month_digit_is_not_guessed_into_a_valid_date():
    """"23/40/26" is a dot-matrix 1 read as a 4. Collapsing separators is
    not a licence to repair digits - an impossible month stays unparsed."""
    lines = [B("USE BY. 23/40/-26", 50, 100, 300, 116)]
    _, exp = extract_manufacturing_and_expiry_dates(lines)
    assert exp["value"] is None


def test_unlabelled_product_name_is_read_but_flagged():
    from .field_extractors import extract_common_name
    lines = [
        B("PINEAPPLE DELIGHT", 40, 10, 420, 70, conf=0.93),
        B("#MRPRs. 20.00", 50, 340, 300, 356),
        B("USEBY. 23/10/-26", 50, 370, 300, 386),
    ]
    name = extract_common_name(lines)
    assert name["value"] == "PINEAPPLE DELIGHT"
    assert name["inferred"] is True
    assert name["match_method"] == "visual_prominence"


def test_prominent_marketing_line_does_not_become_the_product_name():
    from .field_extractors import extract_common_name
    lines = [
        B("50% MORE FREE", 40, 10, 420, 70, conf=0.95),
        B("#MRPRs. 20.00", 50, 340, 300, 356),
        B("USEBY. 23/10/-26", 50, 370, 300, 386),
    ]
    assert extract_common_name(lines)["value"] is None


def test_prominent_declaration_does_not_become_the_product_name():
    from .field_extractors import extract_common_name
    lines = [
        B("MRP Rs. 20.00", 40, 10, 420, 70, conf=0.95),
        B("BATCHNO. SP7919H27D26", 50, 340, 320, 356),
        B("USEBY. 23/10/-26", 50, 370, 300, 386),
    ]
    assert extract_common_name(lines)["value"] is None


# ==========================================================================
# MRP vs unit sale price — the per-unit denominator
# ==========================================================================

def _price(*texts):
    return [B(t, 50, 100 + 30 * i, 400, 120 + 30 * i) for i, t in enumerate(texts)]


def test_per_unit_price_is_the_usp_even_with_no_usp_label():
    from .field_extractors import extract_unit_sale_price
    usp = extract_unit_sale_price(_price("Rs.125/-", "Rs.0.36/ml"))
    assert usp["value"] == "0.36"
    assert usp["unit"] == "ml"


def test_per_unit_price_never_becomes_the_mrp():
    """A can whose "USP" label was lost to the coder used to report its
    per-millilitre price as the maximum retail price."""
    assert extract_mrp(_price("Rs.0.36/ml"))["value"] is None


def test_rupee_only_price_is_the_mrp():
    assert extract_mrp(_price("Rs.125/-"))["value"] == "125"


def test_rupees_and_paise_marker_is_not_a_unit():
    """"/-" is the Indian "and no paise" marker, not a per-unit denominator."""
    from .field_extractors import extract_unit_sale_price
    assert extract_unit_sale_price(_price("Rs.125/-"))["value"] is None


def test_both_prices_separate_cleanly_on_one_pack():
    from .field_extractors import extract_unit_sale_price
    lines = _price("Rs.125/-", "Rs.0.36/ml")
    assert extract_mrp(lines)["value"] == "125"
    assert extract_unit_sale_price(lines)["value"] == "0.36"


def test_ingredient_ratio_is_not_a_unit_price():
    from .field_extractors import extract_unit_sale_price
    assert extract_unit_sale_price(
        _price("TAURINE (400 mg/100 ml), FLAVORS"))["value"] is None


# ==========================================================================
# Date roles from chronology when the pack labels neither date
# ==========================================================================

def _dates(*texts, image_index=1):
    return [B(t, 50, 100 + 30 * i, 400, 120 + 30 * i, image_index=image_index)
            for i, t in enumerate(texts)]


def test_older_of_two_unlabelled_dates_is_the_manufacturing_date():
    mfg, exp = extract_manufacturing_and_expiry_dates(
        _dates("28/JUL/26", "28/JUL/28"))
    assert mfg["value"] == "28/JUL/26" and mfg["date_role"] == "manufacturing"
    assert exp["value"] == "28/JUL/28" and exp["date_role"] == "best_before_use_by"


def test_chronology_does_not_depend_on_reading_order():
    mfg, exp = extract_manufacturing_and_expiry_dates(
        _dates("28/JUL/28", "28/JUL/26"))
    assert mfg["value"] == "28/JUL/26"
    assert exp["value"] == "28/JUL/28"


def test_chronological_roles_are_flagged_as_inferred():
    """The pack never said which is which, so this must reach the reviewer
    as REVIEW, not as a clean PASS."""
    mfg, exp = extract_manufacturing_and_expiry_dates(
        _dates("28/JUL/26", "28/JUL/28"))
    assert mfg["inferred"] is True and exp["inferred"] is True
    assert mfg["role_source"] == "chronology"


def test_a_labelled_date_always_beats_chronology():
    mfg, exp = extract_manufacturing_and_expiry_dates(
        _dates("MFG 28/JUL/26", "28/JUL/28"))
    assert mfg["value"] == "28/JUL/26"
    assert mfg.get("inferred") is not True


def test_three_dates_are_not_a_two_way_choice():
    mfg, exp = extract_manufacturing_and_expiry_dates(
        _dates("28/JUL/26", "28/JUL/27", "28/JUL/28"))
    assert exp["value"] is None


def test_identical_dates_are_not_ordered():
    mfg, exp = extract_manufacturing_and_expiry_dates(
        _dates("28/JUL/26", "28/JUL/26"))
    assert exp["value"] is None


def test_chronology_never_reasons_across_images():
    lines = _dates("28/JUL/26", image_index=1) + _dates("28/JUL/28", image_index=2)
    mfg, exp = extract_manufacturing_and_expiry_dates(lines)
    assert exp["value"] is None


# ==========================================================================
# Product-name candidate ranking (the conditions spec)
# ==========================================================================

def N(text, x0, y0, x1, y1, conf=0.9, image_index=1):
    return B(text, x0, y0, x1, y1, conf=conf, image_index=image_index)


def _name(lines):
    from .field_extractors import extract_common_name
    return extract_common_name(lines)["value"]


def test_name_beats_small_regulatory_text():
    assert _name([N("ALMOND MILK", 100, 100, 500, 170),
                  N("Net Quantity: 1 L", 100, 300, 320, 318),
                  N("Manufactured by ABC Foods Pvt Ltd", 100, 330, 420, 348)
                  ]) == "ALMOND MILK"


def test_large_mrp_does_not_beat_a_smaller_name():
    assert _name([N("MRP Rs 299", 100, 80, 480, 160),
                  N("MASALA OATS", 100, 220, 340, 262),
                  N("Batch No A7F29X", 100, 300, 300, 318)]) == "MASALA OATS"


def test_large_slogan_does_not_beat_the_name():
    assert _name([N("50% MORE FREE", 80, 60, 520, 140),
                  N("INSTANT COFFEE", 100, 200, 360, 244),
                  N("Store in a cool dry place", 100, 300, 340, 318)
                  ]) == "INSTANT COFFEE"


def test_descriptor_beats_the_larger_brand_above_it():
    """The tallest text on a pack is usually the brand; the commodity
    descriptor is set below it, smaller."""
    assert _name([N("MONSTER", 100, 60, 500, 150),
                  N("ENERGY DRINK", 110, 170, 430, 212),
                  N("Net Quantity 350 ml", 100, 320, 320, 338)]) == "ENERGY DRINK"


def test_same_name_across_two_images_is_preferred():
    assert _name([N("ALMOND MILK", 100, 100, 500, 170, image_index=1),
                  N("Net Qty 1 L", 100, 300, 300, 318, image_index=1),
                  N("ALMOND MILK", 100, 100, 500, 170, image_index=2),
                  N("Ingredients: Water, Almonds, Salt", 100, 300, 520, 318,
                    image_index=2)]) == "ALMOND MILK"


def test_pack_with_no_name_returns_null_not_random_text():
    assert _name([N("Ingredients: Sugar, Milk Solids, Cocoa", 60, 100, 520, 120),
                  N("Store in a cool dry place", 60, 140, 400, 160),
                  N("MRP Rs 45", 60, 180, 200, 200)]) is None


def test_a_name_may_contain_numbers():
    assert _name([N("Vitamin B12", 100, 100, 420, 170),
                  N("Net Wt 100 g", 100, 300, 300, 318)]) == "Vitamin B12"


def test_two_line_name_is_joined_before_ranking():
    assert _name([N("PINEAPPLE", 100, 60, 420, 120),
                  N("DELIGHT", 105, 124, 400, 184),
                  N("MRP Rs 20", 100, 300, 260, 318)]) == "PINEAPPLE DELIGHT"


def test_contact_details_are_never_the_name():
    assert _name([N("INFO@MONSTERENERGY.COM", 60, 100, 420, 130),
                  N("000-800-040-1274", 60, 140, 300, 170),
                  N("MRP Rs 125", 60, 180, 220, 200)]) is None


def test_ranking_exposes_a_per_feature_breakdown():
    """The debug log the spec asks for - development only, never returned
    through the API."""
    from .field_extractors import rank_product_name_candidates
    ranked = rank_product_name_candidates(
        [N("ALMOND MILK", 100, 100, 500, 170),
         N("Net Quantity: 1 L", 100, 300, 320, 318),
         N("Manufactured by ABC Foods", 100, 330, 420, 348)])
    top = ranked[0]
    assert top["text"] == "ALMOND MILK"
    for key in ("font_score", "position_score", "confidence_score",
                "semantic_score", "final_score"):
        assert key in top
