# PackSure — OCR & Structured Extraction Module

**Owner:** Person 2 (AI/CV — OCR & Extraction)
**Consumes:** 1–3 package images (per the `/scan` contract in the architecture doc)
**Produces:** the frozen evidence contract from `handoff/HANDOFF_Person2.md`, ready to hand straight to `domain_rules/rule_engine.py`

## Quick start

```bash
pip install -r requirements.txt
sudo apt-get install tesseract-ocr   # system binary, not a pip package

# generate the synthetic test images (only needed once)
python make_test_images.py

# run the pipeline on one or more images
python -m ocr_extraction.pipeline test_images/compliant_label.png
```

## What this module outputs

```python
from ocr_extraction.pipeline import run_pipeline

result = run_pipeline(["image1.jpg", "image2.jpg"])
# {
#   "declarations": { "manufacturer": {...}, "net_quantity": {...}, ... },
#   "product_context": { "is_imported": ..., "may_expire": ..., ... }
# }
```

`result["declarations"]` and `result["product_context"]` are **exactly** the
two arguments `domain_rules.rule_engine.run_all_rules(evidence,
product_context)` expects — see that file's `__main__` block, which uses the
identical shape. Backend should be able to call:

```python
from domain_rules.rule_engine import run_all_rules, calculate_score
results = run_all_rules(result["declarations"], result["product_context"])
score = calculate_score(results)
```

with no reshaping in between. `sample_output/*.json` has one pre-computed
example of this full round-trip (extraction → rule engine → score) per test
image, so you can see the exact shape without running anything.

## Files

| File | Purpose |
|---|---|
| `ocr_engine.py` | Wraps Tesseract; groups word-level OCR into line-level blocks with `bbox`, `confidence`, `image_index`. Swap this class out to change OCR backends later. |
| `field_extractors.py` | One `extract_*` function per field, matching the exact evidence shape frozen in the handoff doc (`value`, `raw_text`, `confidence`, `bbox`, `context`, plus field-specific extras like `unit_status`, `date_role`, `context_confirmed`). |
| `pipeline.py` | The single entry point (`run_pipeline`) backend should call. Combines OCR + extraction into the final `declarations` / `product_context` dict. |
| `../make_test_images.py` | Generates the 6 synthetic test images below. |
| `../test_images/*.png` | Test images, one per edge case. Invented labels — not real products. |
| `../sample_output/*.json` | Pre-computed pipeline output **and** rule-engine result for each test image. |

## Test images and what each one proves

| Image | Demonstrates |
|---|---|
| `compliant_label.png` | Baseline — most fields extract cleanly and PASS. |
| `missing_unit.png` | Net quantity has a number but no unit at all → `unit_status: "confirmed_absent"` → rule engine returns **FAIL**, not REVIEW. |
| `ambiguous_date.png` | A floating date with no MFG/Best-Before keyword nearby → `date_role: "unclear"` → **REVIEW**, never guessed. |
| `multiple_prices.png` | Two unlabelled prices on the pack → `context_confirmed: false` → **REVIEW** rather than picking one. |
| `imported_product.png` | "Country of Origin: Switzerland" → `product.is_imported: true` inferred, which makes the conditional PCR-R07 rule applicable (and it PASSes here). |
| `low_confidence.png` | Heavily degraded (JPEG-artifacted) text → several fields land below the rule engine's 0.6 confidence floor → **REVIEW** even where a value was technically read. |

Run `python make_test_images.py` to regenerate these from scratch if you want
to tweak the scenarios.

## Known gaps / things to flag back to Riya

Per the "Open questions for you" section of `HANDOFF_Person2.md`:

- **`common_name`**: not reliably extracted by this MVP. Distinguishing the
  generic commodity name from the brand name/slogan needs either a curated
  keyword list per category or a small classifier — out of scope for the
  regex-based baseline here. Currently only fires if the pack explicitly
  labels a line "Common Name:" / "Generic Name:", which real packaging
  almost never does. **This will show as FAIL on every real scan until
  addressed** — flag before demo day.
- **`may_expire`**: not classified at all → always `None` → PCR-R08 always
  resolves to REVIEW. Confirm with Riya whether that's acceptable for MVP or
  whether it should default to `True` for food categories.
- **`is_imported`**, **`requires_unit_sale_price`**, **`dimensions_relevant`**:
  partially inferred (see `pipeline.py`'s `extract_declarations`) only when
  the relevant text is explicitly present on the pack (e.g. "Country of
  Origin: X", a `unit_sale_price` or `dimensions` line). Packs that qualify
  but don't explicitly print these will fall back to `None` → REVIEW.
- **`net_quantity` ambiguous vs. confirmed-absent**: currently, "a number
  followed by unrecognized text" → `"ambiguous"`; "a number followed by
  nothing" → `"confirmed_absent"`. Worth a second pass with more real
  packaging samples to check this heuristic holds up.

## Swapping in a better OCR/extraction backend later

- To change OCR engines: replace `PytesseractBackend` in `ocr_engine.py` with
  a class exposing the same `read_image(path, image_index) -> List[OCRLine]`
  method (e.g. wrapping Google Vision or an EasyOCR/PaddleOCR model).
- To improve field extraction: replace individual `extract_*` functions in
  `field_extractors.py` with a model-based approach. Keep the same return
  shape (the dict keys documented above) and nothing downstream needs to
  change.
